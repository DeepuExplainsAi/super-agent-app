import { createOpenAiCompatible } from "./openai-compat.ts";
import type { ModelProvider } from "./types.ts";

export interface LocalAiOptions {
  /** Loopback only: LocalAI, Ollama (/v1) or LM Studio. */
  baseUrl?: string;
  defaultModel?: string;
  fetch?: typeof fetch;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function createLocalAi(options: LocalAiOptions = {}): ModelProvider {
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:8080/v1";
  if (!LOOPBACK.has(new URL(baseUrl).hostname)) throw new Error("LocalAI endpoint must be on loopback (localhost / 127.0.0.1)");
  return createOpenAiCompatible({
    id: "localai",
    baseUrl,
    isFree: () => true,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.defaultModel ? { defaultModel: options.defaultModel } : {}),
  });
}
