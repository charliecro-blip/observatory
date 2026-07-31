/**
 * Client error reporting — so a beta tester hitting a crash is something we
 * learn about, rather than something they mention if they happen to remember.
 *
 * The ErrorBoundary already caught render crashes and showed "Something went
 * wrong". It reported them nowhere. Same for anything thrown outside React —
 * an unhandled promise rejection just vanished into the console of a browser
 * we will never see.
 *
 * Deliberately NOT a third-party SDK: this reuses the existing /api/events
 * ingest, so there's no new schema, no new sub-processor to add to the privacy
 * policy, and nothing to configure before it works.
 *
 * Two limits that matter more than they look:
 *
 *   · DEDUPE — a crash inside a render loop can fire hundreds of times a
 *     second. Each one is a database write, and this database is billed by
 *     compute time; the notifier's polling already taught us that lesson once.
 *     Each distinct message is reported once per session, with a hard ceiling.
 *
 *   · TRUNCATION — an error message can quote whatever the user typed. We keep
 *     enough to debug and no more.
 */
const MAX_PER_SESSION = 10;
const MAX_MESSAGE = 300;
const MAX_STACK = 1200;

const seen = new Set<string>();
let sent = 0;

export type ErrorSource = "render" | "window" | "promise" | "query";

export function reportError(source: ErrorSource, err: unknown, context?: Record<string, unknown>): void {
  try {
    if (sent >= MAX_PER_SESSION) return;

    const error = err instanceof Error ? err : new Error(String(err));
    const message = (error.message || "unknown").slice(0, MAX_MESSAGE);

    // Dedupe on source + message, not the stack: the same bug reached from two
    // code paths is one bug, and we only need to hear about it once.
    const key = `${source}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent++;

    const testerId = localStorage.getItem("obs_tester_id") ?? "";
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
      body: JSON.stringify({
        event: "client_error",
        props: {
          source,
          message,
          stack: (error.stack ?? "").slice(0, MAX_STACK),
          // Path only — never the query string, which can carry parameters we
          // have no business storing next to an account id.
          path: location.pathname,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          ...context,
        },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never be the thing that breaks the app.
  }
}

/**
 * Catch what React cannot: errors thrown outside the render tree, and promise
 * rejections nobody awaited. Call once, at boot.
 */
export function installGlobalErrorReporting(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (e) => {
    // Resource load failures (a missing image) surface here with no `error`
    // object; they're noise, not crashes.
    if (!e.error) return;
    reportError("window", e.error, { at: `${e.filename ?? ""}:${e.lineno ?? 0}` });
  });

  window.addEventListener("unhandledrejection", (e) => {
    reportError("promise", e.reason);
  });
}
