import type { Action } from "./types.ts";

/** "Send webhook" node: lets a user-run n8n (or anything else) be called. No n8n code is included. */
export const webhookAction: Action = async (input) => {
  const { url, body } = input as { url: string; body?: unknown };
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`webhook ${response.status}`);
  return response.json().catch(() => ({}));
};
