/**
 * WHICH STARS A HABIT SERVES.
 *
 * A habit can serve several Guiding Stars (owner 2026-08-16: "one walk can
 * serve 'get fit' and 'clear head' both"), so membership lives in a CSV
 * `starIds` with `goalId` mirroring the first entry for every reader written
 * before that existed. Two columns holding one fact means every consumer has
 * to know the precedence, and by 2026-08-19 four of them did — three on the
 * client (Habits, the Stars hub, Home) plus the momentum route — each with
 * its own copy of the same six-token parse.
 *
 * That is how the two columns eventually disagree, so the parse lives here.
 *
 * A habit is ONE ledger item counted by each of its stars, never one item per
 * star. Anything grouping by star has to count distinct habits or its totals
 * stop matching the tally the person can see.
 */

export interface StarLinked {
  goalId?: number | null;
  starIds?: string | null;
}

/** Every star id this habit serves, whichever column carries them. */
export function starIdsOf(h: StarLinked): number[] {
  if (typeof h.starIds === "string" && h.starIds.length) {
    const ids = h.starIds.split(",").map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (ids.length) return ids;
  }
  return h.goalId ? [h.goalId] : [];
}

/** Does this habit serve that star? */
export function servesStar(h: StarLinked, starId: number): boolean {
  return starIdsOf(h).includes(starId);
}
