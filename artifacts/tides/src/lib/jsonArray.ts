/**
 * THE guard for any query whose result is rendered with .map()/.filter().
 *
 * A non-2xx response still resolves `r.json()` — usually to an error object
 * like `{error: "Too many requests…"}` — without throwing. React Query then
 * hands that object to a component that expects an array, `.filter` is not a
 * function, and because the whole app sits inside ONE top-level ErrorBoundary
 * (App.tsx), a transient 429/500 on any list endpoint blanks the ENTIRE app
 * rather than degrading the one widget.
 *
 * Two audits found this same class of bug in seven different places. Use this
 * everywhere instead of `return r.json()` when the caller expects a list, so
 * the guard is one greppable name rather than a convention people forget.
 */
export async function jsonArray<T = unknown>(r: Response): Promise<T[]> {
  try {
    const j = await r.json();
    return Array.isArray(j) ? (j as T[]) : [];
  } catch {
    // Malformed/empty body (proxy error page, aborted request) — an empty
    // list is always safe to render; throwing here would surface as a crash.
    return [];
  }
}
