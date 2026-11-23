import { FAILOVER_KINDS, ProviderError, type ChatEvent, type ChatRequest, type ModelProvider } from "./types.ts";

export interface FailoverOptions {
  /** Provider ids in order, user-reorderable. Default: kiro -> opencode -> openrouter -> localai. */
  order?: string[];
  cooldownMs?: number;
  now?: () => number;
}

export const DEFAULT_ORDER = ["kiro", "opencode", "openrouter", "localai"];

export interface FailoverChain {
  chat(request: ChatRequest): AsyncIterable<ChatEvent>;
  setOrder(order: string[]): void;
  /** Providers currently cooling down, with the time they come back. */
  cooling(): Record<string, number>;
}

/** One conversation, many providers: on quota / rate limit / removed model / timeout, mark the provider cooling down and
 * continue the same messages on the next. A notice event tells the chat which one took over. */
export function createFailoverChain(providers: ModelProvider[], options: FailoverOptions = {}): FailoverChain {
  const byId = new Map(providers.map((p) => [p.id, p]));
  let order = options.order ?? DEFAULT_ORDER;
  const cooldown = options.cooldownMs ?? 5 * 60_000;
  const now = options.now ?? Date.now;
  const until = new Map<string, number>();

  return {
    setOrder(next) { order = next; },
    cooling() { return Object.fromEntries([...until].filter(([, t]) => t > now())); },
    async *chat(request) {
      const candidates = order.map((id) => byId.get(id)).filter((p): p is ModelProvider => p !== undefined);
      let last: ProviderError | undefined;
      let previous: string | undefined;
      for (const provider of candidates) {
        if ((until.get(provider.id) ?? 0) > now()) continue;
        if (!(await provider.status().catch(() => ({ signedIn: false }))).signedIn) continue;
        if (previous) yield { type: "notice", text: `${previous} is unavailable, continuing with ${provider.id}.` };
        let started = false;
        try {
          for await (const event of provider.chat(request)) {
            if (event.type === "text") started = true;
            yield event;
          }
          return;
        } catch (error) {
          const failure = error instanceof ProviderError ? error : new ProviderError(provider.id, "other", String(error));
          if (!FAILOVER_KINDS.has(failure.kind)) throw failure;
          // Text already shown to the person cannot be taken back; switching mid-answer would duplicate it.
          if (started) throw failure;
          until.set(provider.id, now() + cooldown);
          last = failure; previous = provider.id;
        }
      }
      throw last ?? new ProviderError("failover", "unavailable", "No provider is signed in. Add an OpenRouter key or sign in to OpenCode or Kiro.");
    },
  };
}
