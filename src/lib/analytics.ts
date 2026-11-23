// Telemetry is removed in this build: nothing is collected or sent. The exports remain so call sites stay unchanged.
const GATE_KEY = "omb-email-gate";

export function analyticsEnabled(): boolean {
  return false;
}

export function setAnalyticsEnabled(_enabled: boolean) {}

export function initAnalytics(): Promise<void> {
  return Promise.resolve();
}

export function analyticsSurface(): "local" | "server" {
  return globalThis.window?.ogb?.environments ? "local" : "server";
}

export function track(_event: string, _props?: Record<string, unknown>) {}

export function emailGateDone(): boolean {
  return Boolean(localStorage.getItem(GATE_KEY));
}
export function setEmailGateDone(status: "submitted" | "skipped") {
  localStorage.setItem(GATE_KEY, status);
}
