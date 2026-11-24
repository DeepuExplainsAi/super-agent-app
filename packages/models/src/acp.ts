import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { ProviderError, type ChatEvent, type ChatRequest, type ModelInfo, type ModelProvider } from "./types.ts";

type Json = Record<string, any>;

export interface AcpProviderOptions {
  id: "opencode" | "kiro" | string;
  /** The user's own installed binary (`opencode`, `kiro-cli`). Never bundled. */
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Cheap local check that the user is signed in (so failover can skip us). */
  signedIn?: () => boolean | Promise<boolean>;
  signInHint?: string;
  idleCloseMs?: number;
}

const PROTOCOL_VERSION = 1;

/** JSON-RPC over stdio, one process kept per provider and closed when idle. */
class AcpConnection {
  private child: ChildProcessWithoutNullStreams | undefined;
  private nextId = 1;
  private buffer = "";
  private pending = new Map<number, { resolve(v: any): void; reject(e: Error): void }>();
  private handlers = new Set<(msg: Json) => void>();
  capabilities: Json = {};
  ready: Promise<void> | undefined;
  onExit: (() => void) | undefined;

  private readonly options: AcpProviderOptions;

  constructor(options: AcpProviderOptions) {
    this.options = options;
  }

  get alive(): boolean {
    return this.child !== undefined && this.child.exitCode === null;
  }

  start(): Promise<void> {
    this.ready ??= this.boot().catch((error) => { this.close(); throw error; });
    return this.ready;
  }

  private async boot(): Promise<void> {
    const child = spawn(this.options.command, this.options.args, {
      cwd: this.options.cwd, env: { ...process.env, ...this.options.env }, stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    const failed = new Promise<never>((_, reject) => {
      child.once("error", (e: NodeJS.ErrnoException) =>
        reject(new ProviderError(this.options.id, "unavailable", e.code === "ENOENT" ? `${this.options.command} is not installed` : e.message)));
    });
    child.stderr.on("data", (d) => { if (process.env.ACP_DEBUG) process.stderr.write(d); });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.read(chunk));
    child.once("exit", () => {
      for (const p of this.pending.values()) p.reject(new ProviderError(this.options.id, "unavailable", "agent process exited"));
      this.pending.clear();
      this.child = undefined; this.ready = undefined;
      this.onExit?.();
    });
    const init = await Promise.race([
      this.request("initialize", { protocolVersion: PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } }),
      failed,
    ]);
    // Read what the server advertises; never infer features from a version number.
    this.capabilities = init?.agentCapabilities ?? {};
  }

  private read(chunk: string): void {
    this.buffer += chunk;
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let msg: Json;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id !== undefined && !msg.method) {
        const waiting = this.pending.get(msg.id);
        if (!waiting) continue;
        this.pending.delete(msg.id);
        if (msg.error) waiting.reject(new ProviderError(this.options.id, kindForAcpError(msg.error), msg.error.message ?? "agent error"));
        else waiting.resolve(msg.result);
      } else {
        for (const handler of this.handlers) handler(msg);
      }
    }
  }

  send(message: Json): void {
    this.child?.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  }

  request(method: string, params: Json): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ id, method, params });
    });
  }

  listen(handler: (msg: Json) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  close(): void {
    this.child?.kill();
    this.child = undefined; this.ready = undefined;
  }
}

export function kindForAcpError(error: Json): ProviderError["kind"] {
  const text = `${error.message ?? ""} ${JSON.stringify(error.data ?? "")}`;
  if (/rate.?limit|too many requests|429/i.test(text)) return "rate_limit";
  if (/quota|credit|usage limit|insufficient|exceeded/i.test(text)) return "quota";
  if (/not signed in|login|unauthori[sz]ed|auth/i.test(text) || error.code === -32000) return "auth";
  if (/model.*(not found|unavailable|removed)/i.test(text)) return "model_removed";
  return "other";
}

/** Models a new session offers: the `models` block (Kiro) or the `model` config option (OpenCode 1.19+). */
export function sessionModels(session: Json): { id: string; name: string }[] {
  const legacy = (session?.models?.availableModels ?? []) as Json[];
  if (legacy.length) return legacy.map((m) => ({ id: String(m.modelId ?? m.id), name: String(m.name ?? m.modelId ?? m.id) }));
  const option = ((session?.configOptions ?? []) as Json[]).find((o) => o.id === "model" || o.category === "model");
  const flat = ((option?.options ?? []) as Json[]).flatMap((o) => (Array.isArray(o.options) ? o.options : [o]));
  return flat.map((m) => ({ id: String(m.value), name: String(m.name ?? m.value) }));
}

/** Pure mapping of a `session/update` notification to chat events (exported for tests). */
export function updateToEvents(update: Json): ChatEvent[] {
  if (update?.sessionUpdate === "agent_message_chunk" && update.content?.type === "text" && update.content.text) {
    return [{ type: "text", text: String(update.content.text) }];
  }
  return [];
}

export function createAcpProvider(options: AcpProviderOptions): ModelProvider {
  const connection = new AcpConnection(options);
  let idleTimer: NodeJS.Timeout | undefined;
  let active = 0;
  const idleMs = options.idleCloseMs ?? 120_000;

  const arm = () => {
    clearTimeout(idleTimer);
    if (active === 0) idleTimer = setTimeout(() => connection.close(), idleMs).unref();
  };

  return {
    id: options.id,
    async status() {
      const signedIn = options.signedIn ? await options.signedIn() : true;
      return signedIn ? { signedIn } : { signedIn, note: options.signInHint ?? "Not signed in." };
    },
    async listModels(): Promise<ModelInfo[]> {
      await connection.start();
      const session = await connection.request("session/new", { cwd: options.cwd ?? process.cwd(), mcpServers: [] });
      return sessionModels(session);
    },
    async *chat(req: ChatRequest): AsyncGenerator<ChatEvent> {
      active++; clearTimeout(idleTimer);
      const queue: (ChatEvent | { end: true; error?: Error })[] = [];
      let wake: (() => void) | undefined;
      const push = (item: ChatEvent | { end: true; error?: Error }) => { queue.push(item); wake?.(); };
      let sessionId: string | undefined;
      let stopListening: (() => void) | undefined;
      const abort = () => {
        if (sessionId) connection.send({ method: "session/cancel", params: { sessionId } });
      };
      req.signal?.addEventListener("abort", abort, { once: true });
      const timer = req.timeoutMs ? setTimeout(() => { abort(); push({ end: true, error: new ProviderError(options.id, "timeout", "agent timed out") }); }, req.timeoutMs) : undefined;
      try {
        await connection.start();
        const session = await connection.request("session/new", { cwd: options.cwd ?? process.cwd(), mcpServers: [] });
        sessionId = String(session.sessionId);
        if (req.model && sessionModels(session).some((m) => m.id === req.model)) {
          if (session?.models) await connection.request("session/set_model", { sessionId, modelId: req.model });
          else await connection.request("session/set_config_option", { sessionId, configId: "model", value: req.model });
        }
        stopListening = connection.listen((msg) => {
          if (msg.method === "session/update" && msg.params?.sessionId === sessionId) {
            for (const event of updateToEvents(msg.params.update)) push(event);
          } else if (msg.method === "session/request_permission" && msg.params?.sessionId === sessionId) {
            const tool = msg.params.toolCall ?? {};
            const choices = (msg.params.options ?? []) as { optionId: string; name: string; kind: string }[];
            const ask = req.onPermission?.({ title: String(tool.title ?? "Permission needed"), options: choices.map((o) => ({ id: o.optionId, name: o.name, kind: o.kind })) }) ?? Promise.resolve(null);
            // No approval card or a dismissed one means deny; never auto-approve.
            void ask.catch(() => null).then((picked) => connection.send({
              id: msg.id,
              result: { outcome: picked ? { outcome: "selected", optionId: picked } : { outcome: "cancelled" } },
            }));
          }
        });
        const prompt = req.messages.map((m) => (m.role === "system" ? `[system] ${m.content}` : m.content)).join("\n\n");
        connection.request("session/prompt", { sessionId, prompt: [{ type: "text", text: prompt }] }).then(
          (result) => { push({ type: "done", provider: options.id, stopReason: String(result?.stopReason ?? "end_turn") }); },
          (error) => { push({ end: true, error }); },
        );
        for (;;) {
          while (queue.length === 0) await new Promise<void>((resolve) => { wake = resolve; });
          const item = queue.shift()!;
          if ("end" in item) { if (item.error) throw item.error; return; }
          yield item;
          if (item.type === "done") return;
        }
      } catch (error) {
        if (req.signal?.aborted) throw new ProviderError(options.id, "aborted", "stopped");
        throw error instanceof ProviderError ? error : new ProviderError(options.id, "unavailable", error instanceof Error ? error.message : String(error));
      } finally {
        clearTimeout(timer);
        stopListening?.();
        req.signal?.removeEventListener("abort", abort);
        active--; arm();
      }
    },
  };
}

export const createOpenCode = (extra: Partial<AcpProviderOptions> = {}): ModelProvider =>
  createAcpProvider({ id: "opencode", command: "opencode", args: ["acp"], signInHint: "Run `opencode auth login` in a terminal.", ...extra });

export const createKiro = (extra: Partial<AcpProviderOptions> = {}): ModelProvider =>
  createAcpProvider({ id: "kiro", command: "kiro-cli", args: ["acp"], signInHint: "Run `kiro-cli login` in a terminal.", ...extra });
