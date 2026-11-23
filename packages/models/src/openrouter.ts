import { createOpenAiCompatible } from "./openai-compat.ts";
import type { ModelProvider } from "./types.ts";

export interface OpenRouterOptions {
  apiKey: () => string | undefined | Promise<string | undefined>;
  fetch?: typeof fetch;
  baseUrl?: string;
  /** Pinned model, else the first free model from the live list is the caller's choice. */
  defaultModel?: string;
}

/** User's own OpenRouter key; models come from the live list, none are hard-coded. */
export function createOpenRouter(options: OpenRouterOptions): ModelProvider {
  return createOpenAiCompatible({
    id: "openrouter",
    baseUrl: options.baseUrl ?? "https://openrouter.ai/api/v1",
    apiKey: options.apiKey,
    keyRequired: true,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.defaultModel ? { defaultModel: options.defaultModel } : {}),
    isFree: (m) => Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0,
  });
}
