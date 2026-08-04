/**
 * "I could not retrieve your life" must never render as "there is nothing in
 * your life."
 *
 * Most queries called `r.json()` without checking `r.ok`, so a 500 or a
 * dropped connection parsed the error body — or an empty one — and handed it
 * to react-query as DATA. The component then rendered it as an empty task
 * list, no Guiding Stars, no habits, a free week. react-query has a perfectly
 * good error state; it was simply never reached, because nothing ever threw.
 *
 * The Planner already distinguishes an unavailable calendar from an empty one,
 * and that distinction is exactly what the rest of the app was missing.
 *
 * Throwing is the whole mechanism: an error state is what react-query gives
 * you for free once a queryFn rejects.
 */

export class HttpError extends Error {
  constructor(public status: number, public url: string, message?: string) {
    super(message ?? `Request failed (${status})`);
    this.name = "HttpError";
  }
}

/**
 * Parse a response, or throw.
 *
 * `absentStatuses` is for endpoints where a status genuinely MEANS absence
 * rather than failure — /api/natal-chart answers 404 when you have not added
 * one, and that is a real answer, not a broken request. Listing it explicitly
 * keeps "this 404 is data" a decision someone made rather than the accidental
 * behaviour of every endpoint at once.
 */
export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit & { absentStatuses?: number[]; absentValue?: T },
): Promise<T> {
  const { absentStatuses, absentValue, ...rest } = init ?? {};
  const r = await fetch(input, rest);
  if (!r.ok) {
    if (absentStatuses?.includes(r.status)) return absentValue as T;
    let detail = "";
    try { detail = (await r.text()).slice(0, 200); } catch { /* body already gone */ }
    throw new HttpError(r.status, String(input), detail || undefined);
  }
  return r.json() as Promise<T>;
}
