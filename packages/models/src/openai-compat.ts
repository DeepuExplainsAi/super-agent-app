import { ProviderError, type ChatEvent, type ChatRequest, type ModelInfo, type ModelProvider, type ProviderErrorKind } from "./types.ts";

export interface OpenAiCompatOptions {
  id: string;
  baseUrl: string;
  /** Read at call time so a key saved later is picked up; never stored here. */
  apiKey?: () => string | undefined | Promise<string | undefined>;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  defaultModel?: string;
  keyRequired?: boolean;
  /** Pick which listed models count as free. */
  isFree?: (model: Record<string, any>) => boolean;
}

export function kindForStatus(status: number, body: string): ProviderErrorKind {
  if (status === 429) return "rate_limit";
  if (status === 402 || /quota|credit|insufficient|limit exceeded/i.test(body)) return "quota";
  if (status === 401 || status === 403) return "auth";
  if (status === 404 || /model.*(not found|removed|unavailable|deprecated)/i.test(body)) return "model_removed";
  if (status >= 500 || status === 408) return "unavailable";
  return "other";
}

function combined(signal: AbortSignal | undefined, timeoutMs: number | undefined): AbortSignal | undefined {
  const signals = [signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined].filter((s): s is AbortSignal => s !== undefined);
  return signals.length ? AbortSignal.any(signals) : undefined;
}

export function createOpenAiCompatible(options: OpenAiCompatOptions): ModelProvider {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, "");

  async function headers(): Promise<Record<string, string>> {
    const key = await options.apiKey?.();
    return { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}), ...options.headers };
  }

  async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    try {
      return await doFetch(`${base}${path}`, { ...init, headers: await headers(), ...(signal ? { signal } : {}) });
    } catch (error) {
      if (signal?.aborted) {
        const timedOut = signal.reason instanceof DOMException && signal.reason.name === "TimeoutError";
        throw new ProviderError(options.id, timedOut ? "timeout" : "aborted", timedOut ? "request timed out" : "stopped");
      }
      throw new ProviderError(options.id, "unavailable", error instanceof Error ? error.message : String(error));
    }
  }

  async function failure(response: Response): Promise<ProviderError> {
    const body = await response.text().catch(() => "");
    return new ProviderError(options.id, kindForStatus(response.status, body), `${response.status} ${body.slice(0, 200)}`);
  }

  return {
    id: options.id,
    async status() {
      if (options.keyRequired && !(await options.apiKey?.())) return { signedIn: false, note: "No API key set." };
      return { signedIn: true };
    },
    async listModels(): Promise<ModelInfo[]> {
      const response = await request("/models", { method: "GET" });
      if (!response.ok) throw await failure(response);
      const body = (await response.json()) as { data?: Record<string, any>[] };
      return (body.data ?? []).map((m) => ({ id: String(m.id), name: m.name ?? String(m.id), free: options.isFree?.(m) ?? false }));
    },
    async *chat(req: ChatRequest): AsyncGenerator<ChatEvent> {
      const model = req.model ?? options.defaultModel;
      if (!model) throw new ProviderError(options.id, "model_removed", "no model chosen");
      const signal = combined(req.signal, req.timeoutMs);
      const response = await request("/chat/completions", { method: "POST", body: JSON.stringify({ model, messages: req.messages, stream: true }) }, signal);
      if (!response.ok) throw await failure(response);
      if (!response.body) throw new ProviderError(options.id, "unavailable", "empty response");
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
          buffer += decoder.decode(chunk, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") { yield { type: "done", provider: options.id, stopReason: "end_turn" }; return; }
            const parsed = JSON.parse(data) as { error?: { message?: string; code?: unknown }; choices?: { delta?: { content?: string } }[] };
            if (parsed.error) throw new ProviderError(options.id, kindForStatus(Number(parsed.error.code) || 500, parsed.error.message ?? ""), parsed.error.message ?? "stream error");
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) yield { type: "text", text };
          }
        }
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        const timedOut = signal?.reason instanceof DOMException && signal.reason.name === "TimeoutError";
        throw new ProviderError(options.id, signal?.aborted ? (timedOut ? "timeout" : "aborted") : "unavailable", error instanceof Error ? error.message : String(error));
      }
      yield { type: "done", provider: options.id };
    },
  };
}
