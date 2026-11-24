import { z } from "zod";
import type { ProviderAdapter, ProviderDriver, ProviderInstance, ProviderSnapshot } from "../contracts.ts";
import { newEventId } from "../contracts.ts";
import {
  createFailoverChain, createKiro, createLocalAi, createOpenCode, createOpenRouter, DEFAULT_ORDER, ProviderError,
  type ChatMessage, type ModelProvider,
} from "../../packages/models/src/index.ts";
import type { RuntimeEvent } from "../../shared/runtime-events.ts";

const DRIVER_KIND = "superagent-failover";
const configSchema = z.object({
  order: z.array(z.string().trim().min(1)).min(1).default([...DEFAULT_ORDER]),
  localaiUrl: z.string().trim().url().optional(),
  model: z.string().trim().min(1).optional(),
});
type FailoverConfig = z.output<typeof configSchema>;

const MODELS = { default: "auto", options: [{ id: "auto", label: "Automatic (first available)" }] };

/** Test seam: replaces the real providers. */
export interface FailoverDriverDeps { providers?: (config: FailoverConfig, environment: Record<string, string>) => ModelProvider[] }

export function createFailoverDriver(deps: FailoverDriverDeps = {}): ProviderDriver<FailoverConfig> {
  const providersFor = deps.providers ?? ((config, environment) => [
    createKiro(), createOpenCode(),
    createOpenRouter({ apiKey: () => environment.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY }),
    createLocalAi(config.localaiUrl ? { baseUrl: config.localaiUrl } : {}),
  ]);
  return {
    driverKind: DRIVER_KIND,
    metadata: { displayName: "Super Agent (automatic failover)", supportsMultipleInstances: false, access: "api" },
    models: MODELS,
    decodeConfig: (raw) => configSchema.parse(raw ?? {}),
    defaultConfig: () => configSchema.parse({}),
    async create(input): Promise<ProviderInstance> {
      const providers = providersFor(input.config, input.environment);
      const chain = createFailoverChain(providers, { order: input.config.order });
      const listeners = new Set<(event: RuntimeEvent) => void>();
      const active = new Map<string, { turnId: string; abort: AbortController; done: Promise<void> }>();
      const emit = (event: RuntimeEvent) => { for (const listener of [...listeners]) listener(event); };

      const adapter: ProviderAdapter = {
        provider: DRIVER_KIND,
        capabilities: { sessionModelSwitch: "unsupported" },
        async sendTurn(turn) {
          if (active.has(turn.threadId)) throw new Error("This conversation already has a turn running.");
          const turnId = crypto.randomUUID();
          const abort = new AbortController();
          const base = () => ({ eventId: newEventId(), provider: DRIVER_KIND, threadId: turn.threadId, turnId, createdAt: new Date().toISOString() });
          const messages: ChatMessage[] = [
            ...(turn.system ? [{ role: "system" as const, content: turn.system }] : []),
            ...(turn.transcript ?? []).map((m) => ({ role: m.role, content: m.text })),
            { role: "user", content: turn.text },
          ];
          const model = turn.model && turn.model !== "auto" ? turn.model : input.config.model;
          const done = (async () => {
            let text = "", ok = false, stopReason: string | null = null;
            try {
              for await (const event of chain.chat({ messages, ...(model ? { model } : {}), signal: abort.signal, timeoutMs: 120_000 })) {
                if (event.type === "text") {
                  text += event.text;
                  emit({ ...base(), type: "content.delta", streamKind: "assistant_text", delta: event.text } as RuntimeEvent);
                } else if (event.type === "notice") {
                  const note = `_${event.text}_\n\n`;
                  text += note;
                  emit({ ...base(), type: "content.delta", streamKind: "assistant_text", delta: note } as RuntimeEvent);
                } else stopReason = event.stopReason ?? "stop";
              }
              if (text) emit({ ...base(), type: "item.completed", itemType: "assistant_text", text } as RuntimeEvent);
              ok = Boolean(text);
              if (!ok) throw new ProviderError("failover", "other", "The model returned an empty response.");
            } catch (error) {
              if (!abort.signal.aborted) {
                emit({ ...base(), type: "runtime.error", message: error instanceof Error ? error.message : String(error), terminal: true } as RuntimeEvent);
              }
            } finally {
              active.delete(turn.threadId);
              emit({ ...base(), type: "turn.completed", ok, stopReason, cost: null } as RuntimeEvent);
            }
          })();
          active.set(turn.threadId, { turnId, abort, done });
          emit({ ...base(), type: "turn.started" } as RuntimeEvent);
          return { turnId };
        },
        async interruptTurn(threadId) { active.get(threadId)?.abort.abort(); },
        async respondToRequest() { return "unavailable"; },
        hasSession: (threadId) => active.has(threadId),
        async stopAll() { for (const turn of active.values()) turn.abort.abort(); await Promise.all([...active.values()].map((t) => t.done)); },
        onEvent(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
      };

      return {
        instanceId: input.instanceId, driverKind: DRIVER_KIND, displayName: input.displayName, enabled: input.enabled,
        models: MODELS, adapter,
        async snapshot(): Promise<ProviderSnapshot> {
          for (const p of providers) if ((await p.status().catch(() => ({ signedIn: false }))).signedIn) return { state: "available", authenticated: true };
          return { state: "unavailable", reason: "No provider is signed in. Add an OpenRouter key or sign in to OpenCode or Kiro." };
        },
        dispose: () => adapter.stopAll(),
      };
    },
  };
}

export const SuperAgentFailoverDriver = createFailoverDriver();
