/**
 * How many distinct days this person has actually opened Compass.
 *
 * Used to hold back asks that only make sense once someone has a rhythm to
 * keep. The notification prompt was gated on `!firstRun`, which meant it
 * appeared on the SECOND visit — the owner's objection was that being asked to
 * "keep the rhythm going" off the first start is asking someone to commit to a
 * habit they have not formed yet.
 *
 * Distinct DAYS rather than sessions or elapsed time: someone who opened the
 * app four times in one afternoon has not yet kept a rhythm, and someone who
 * installed it a fortnight ago and never returned has not either. Days seen is
 * the signal that matches the thing being asked about.
 *
 * localStorage rather than the server: it is a UI nudge, and a fresh device
 * starting the count over is the correct behaviour, not a bug — the ask is
 * about this person's habit here.
 */

const KEY = "obs_days_seen";
const MAX_KEPT = 30;   // enough for any threshold; no reason to grow forever

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(-MAX_KEPT) : [];
  } catch { return []; }
}

/** Record today, and return how many distinct days have been seen. */
export function recordVisit(today: string): number {
  try {
    const days = read();
    if (!days.includes(today)) {
      days.push(today);
      localStorage.setItem(KEY, JSON.stringify(days.slice(-MAX_KEPT)));
    }
    return days.length;
  } catch { return 0; }
}

/** Distinct days seen, without recording one. */
export function daysSeen(): number {
  return read().length;
}
