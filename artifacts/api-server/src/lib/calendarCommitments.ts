/**
 * WHAT THE CALENDAR COULD TELL US — and the difference between the answers.
 *
 * Three states that a boolean cannot hold apart:
 *
 *   consulted + connected   the calendar was read; `commitments` is what it said
 *   consulted, no account   there is no calendar linked; the day really is unclaimed
 *   NOT consulted           the read failed — we know nothing about this day
 *
 * The third is why this exists. Collapsing a failed fetch to an empty array
 * turns "I could not reach your calendar" into "your calendar is clear", which
 * is the one error this app must not make: it does not merely miss a meeting,
 * it asserts free time that was never checked. Compass is allowed to say it
 * does not know. It is not allowed to invent availability.
 */
import { dayBoundsIn, dayBoundsInZone } from "./localClock.js";
import type { Commitment } from "./dayTimeline.js";

export interface BusySpan { startMs: number; endMs: number }

export interface CalendarRead {
  /** False when the lookup threw or the token could not be refreshed. */
  consulted: boolean;
  /** Whether an account is linked at all. */
  connected: boolean;
  commitments: Commitment[];
}

/** The shape `fetchGcalBusy` returns, narrowed to what this needs. */
export interface BusyResult { ok: boolean; connected: boolean; busy: BusySpan[] }

export function readCalendar(r: BusyResult | null | undefined): CalendarRead {
  if (!r || !r.ok) return { consulted: false, connected: r?.connected ?? false, commitments: [] };
  return {
    consulted: true,
    connected: r.connected,
    commitments: r.busy.map(b => ({ startAt: new Date(b.startMs), endAt: new Date(b.endMs) })),
  };
}

/**
 * Split commitments across the days they touch, CLIPPED to each day's bounds.
 *
 * Clipping rather than assigning by start time, because an 11pm-to-1am block
 * occupies the tail of one day and the head of the next. Filed only under its
 * start day, the next morning reads as free; filed whole under both, each day
 * is charged for two hours it does not owe and the week's least-loaded
 * arithmetic drifts. The clipped halves are correct for both jobs.
 *
 * `dates` and `keys` must come from `weekDates` — the weaver reads this map by
 * those exact keys and silently ignores any others.
 */
export function bucketByDay(
  commitments: Commitment[],
  dates: Date[],
  keys: string[],
  tzOffsetMin: number,
  timeZone?: string,
): Record<string, Commitment[]> {
  const out: Record<string, Commitment[]> = Object.fromEntries(keys.map(k => [k, [] as Commitment[]]));
  dates.forEach((d, i) => {
    const [start, end] = timeZone ? dayBoundsInZone(d, timeZone) : dayBoundsIn(d, tzOffsetMin);
    const s = start.getTime(), e = end.getTime();
    for (const c of commitments) {
      const from = Math.max(c.startAt.getTime(), s);
      const to = Math.min(c.endAt.getTime(), e);
      if (to > from) out[keys[i]].push({ startAt: new Date(from), endAt: new Date(to), title: c.title });
    }
  });
  return out;
}

/** The instant range covering every day in the week, for one calendar query. */
export function spanOf(dates: Date[], tzOffsetMin: number, timeZone?: string): { startIso: string; endIso: string } {
  const bounds = dates.map(d => (timeZone ? dayBoundsInZone(d, timeZone) : dayBoundsIn(d, tzOffsetMin)));
  const start = Math.min(...bounds.map(b => b[0].getTime()));
  const end = Math.max(...bounds.map(b => b[1].getTime()));
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}
