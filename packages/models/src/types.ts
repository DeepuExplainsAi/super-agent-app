export interface ModelInfo {
  id: string;
  name?: string;
  free?: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PermissionRequest {
  title: string;
  options: { id: string; name: string; kind: string }[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** In-app approval card for agent providers (ACP). Return an option id, or null to deny. */
  onPermission?: (request: PermissionRequest) => Promise<string | null>;
}

export interface UsageInfo {
  note?: string;
  requestsUsed?: number;
  creditsLeft?: number;
}

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "notice"; text: string }
  | { type: "done"; provider: string; stopReason?: string };

export interface ModelProvider {
  id: string;
  status(): Promise<{ signedIn: boolean; note?: string }>;
  listModels(): Promise<ModelInfo[]>;
  chat(request: ChatRequest): AsyncIterable<ChatEvent>;
  usage?(): Promise<UsageInfo>;
}

export type ProviderErrorKind = "quota" | "rate_limit" | "model_removed" | "timeout" | "unavailable" | "auth" | "aborted" | "other";

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly provider: string;
  constructor(provider: string, kind: ProviderErrorKind, message: string) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
  }
}

/** Kinds where another provider can take over; "aborted" (user stop) and "other" (bad request) never fail over. */
export const FAILOVER_KINDS: ReadonlySet<ProviderErrorKind> = new Set(["quota", "rate_limit", "model_removed", "timeout", "unavailable", "auth"]);
