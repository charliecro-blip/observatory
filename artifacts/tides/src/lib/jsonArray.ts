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
 * Two audits found that bug in seven different places, which is why this is
 * one greppable name rather than a convention people forget.
 *
 * BUT: the first version of this returned `[]` on failure, which traded a
 * crash for a lie — "you have no tasks" when the truth was "we couldn't load
 * your tasks". For an app whose whole pitch is that it's paying attention,
 * false emptiness is its own kind of damage.
 *
 * So `jsonArray` THROWS on a failed response. React Query then keeps the last
 * successful data and flags `isError`, which lets a surface show the real
 * three states:
 *
 *   empty        — the request succeeded and there is genuinely nothing
 *   unavailable  — it failed and we have nothing cached
 *   stale        — it failed but we're still showing the last good list
 *
 * Use `jsonArrayOrEmpty` only where a failure genuinely is indistinguishable
 * from empty and no surface reports it (rare — prefer the throwing version).
 */

export class ListFetchError extends Error {
  readonly status: number;
  constructor(status: number, message?: string) {
    super(message ?? `Couldn't load that list (${status}).`);
    this.name = "ListFetchError";
    this.status = status;
  }
}

/** Throws on a non-2xx or a malformed body, so React Query can hold last-good data. */
export async function jsonArray<T = unknown>(r: Response): Promise<T[]> {
  if (!r.ok) {
    const msg = r.status === 429
      ? "Too many requests just now — Compass will retry shortly."
      : undefined;
    throw new ListFetchError(r.status, msg);
  }
  const j = await r.json().catch(() => null);
  // A 200 that isn't a list is a server bug, not an empty list — don't paper
  // over it by rendering "nothing here".
  if (!Array.isArray(j)) throw new ListFetchError(200, "That list came back in an unexpected shape.");
  return j as T[];
}

/** Non-throwing variant. Prefer `jsonArray` unless the caller truly can't report failure. */
export async function jsonArrayOrEmpty<T = unknown>(r: Response): Promise<T[]> {
  try {
    return await jsonArray<T>(r);
  } catch {
    return [];
  }
}

/**
 * What a list surface should actually render.
 * Pass React Query's flags straight in.
 */
export type ListState = "ok" | "empty" | "stale" | "unavailable";

export function listState(opts: {
  data: unknown[] | undefined;
  isError: boolean;
  isLoading?: boolean;
}): ListState {
  const has = !!opts.data && opts.data.length > 0;
  if (opts.isError) return has ? "stale" : "unavailable";
  if (opts.isLoading && !has) return "ok";
  return has ? "ok" : "empty";
}
