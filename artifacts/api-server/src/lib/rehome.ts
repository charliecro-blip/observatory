/**
 * Choosing where an undone block goes next.
 *
 * Pulled out of the route so its invariants can be tested without a database
 * — they are the whole product claim here, and "I watched it look right once"
 * is not a test:
 *
 *   · never proposes a time that has already gone
 *   · never proposes a time that collides with something already booked
 *   · never proposes options that overlap EACH OTHER (otherwise it is one
 *     option offered three times)
 *   · stays inside waking hours
 */
import { tierForMoment, type MomentVerdict } from "./timingTier.js";
import type { DayArc } from "./dayarc.js";

export interface Slot {
  startMs: number;
  endMs: number;
  verdict: MomentVerdict;
}

export interface RehomeInput {
  /** Local midnight of the target day, as an instant. */
  dayStartMs: number;
  durMs: number;
  element: string;
  /** Already-claimed intervals on that day. */
  busy: { startMs: number; endMs: number }[];
  wakeHour: number;
  sleepHour: number;
  nowMs: number;
  lat: number;
  lon: number;
  tzOffsetMin: number;
  arc: DayArc;
  limit?: number;
}

const RANK = { great: 2, workable: 1, against: 0 } as const;

/** Quarter-hour grid. A CHOICE of slot, not a measurement — see the route. */
const STEP_MS = 15 * 60_000;

export function pickRehomeSlots(input: RehomeInput): Slot[] {
  const { dayStartMs, durMs, element, busy, wakeHour, sleepHour, nowMs, lat, lon, tzOffsetMin, arc } = input;
  const limit = input.limit ?? 3;

  const scored: Slot[] = [];
  const lastStart = dayStartMs + (sleepHour * 3600_000) - durMs;
  for (let startMs = dayStartMs + wakeHour * 3600_000; startMs <= lastStart; startMs += STEP_MS) {
    if (startMs < nowMs) continue;
    const endMs = startMs + durMs;
    if (busy.some((b) => startMs < b.endMs && endMs > b.startMs)) continue;
    scored.push({
      startMs, endMs,
      verdict: tierForMoment({ element, startMs, durMs, lat, lon, tzOffsetMin, arc }),
    });
  }

  scored.sort((a, b) =>
    (RANK[b.verdict.tier] - RANK[a.verdict.tier]) || (b.verdict.relative - a.verdict.relative));

  // The gap is the block's OWN length (floor of an hour). A flat hour would
  // let a 90-minute block be offered at 9:30 and 10:30, which overlap by half
  // an hour and are not two choices in any sense the reader cares about.
  const spacing = Math.max(3600_000, durMs);
  const picks: Slot[] = [];
  for (const s of scored) {
    if (picks.length >= limit) break;
    if (picks.some((p) => Math.abs(p.startMs - s.startMs) < spacing)) continue;
    picks.push(s);
  }
  return picks.sort((a, b) => a.startMs - b.startMs);
}
