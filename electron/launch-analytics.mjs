// Telemetry is removed in this build: launch stages are never sent anywhere.
export function desktopLaunchAnalytics() {
  return { stage() {}, serverFailed() {}, crashed() {} };
}
