/**
 * logEvent — fire-and-forget usage analytics (owner 2026-07-20). Never throws,
 * never blocks; the server route is at /api/api/events... no — /api/events via
 * the router mount. Sends the tester id so the owner's summary can see who's
 * active and which surfaces get used.
 */
export function logEvent(event: string, props?: Record<string, unknown>): void {
  try {
    const testerId = localStorage.getItem("obs_tester_id") ?? "";
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
      body: JSON.stringify({ event, props }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* analytics must never affect the app */ }
}
