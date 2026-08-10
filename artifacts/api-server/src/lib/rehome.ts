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
 *   · never proposes a moment the canonical engine would call `defer`
 *
 * That last one is new, and the reasoning behind it is the actual "one
 * authority" ruling on this file: `tierForMoment`'s great/workable/against is
 * NOT a competing astrological judgment — it never gated a placement, only
 * ranked and captioned one, using the same elemental energy curve the day/
 * week weavers already place work against. It is legitimate for THAT: "is
 * this slot better or worse than that one, on the axis the weaver itself
 * uses" is a real, different question from "is this activity well-supported
 * right now", and letting it answer the first one is not the false-authority
 * problem the audit was pointing at.
 *
 * What WAS a real gap: nothing here ever asked the canonical engine at all.
 * A slot could rank "great" on the elemental curve while sitting inside a
 * moment `evaluateActivityInterval` would call `defer` — a real electional
 * objection, the kind classical practice treats as a genuine reason not to
 * begin. Filter first, on the question that can actually forbid a moment;
 * rank second, on the question that only compares two permitted ones.
 */
import { tierForMoment, type MomentVerdict } from "./timingTier.js";
import { evaluateActivityInterval } from "./electionEngine.js";
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
  /**
   * The matched activity correspondence for the block being re-homed, if
   * one was ever recorded (`planning_windows.activity_key`). Optional and
   * genuinely so: a window with no matched activity has nothing for the
   * canonical engine to judge, and skipping the filter is the honest move —
   * not a fabricated "clear" standing in for an unanswerable question.
   */
  activityKey?: string | null;
}

const RANK = { great: 2, workable: 1, against: 0 } as const;

/** Quarter-hour grid. A CHOICE of slot, not a measurement — see the route. */
const STEP_MS = 15 * 60_000;

export function pickRehomeSlots(input: RehomeInput): Slot[] {
  const { dayStartMs, durMs, element, busy, wakeHour, sleepHour, nowMs, lat, lon, tzOffsetMin, arc, activityKey } = input;
  const limit = input.limit ?? 3;

  const scored: Slot[] = [];
  const lastStart = dayStartMs + (sleepHour * 3600_000) - durMs;
  for (let startMs = dayStartMs + wakeHour * 3600_000; startMs <= lastStart; startMs += STEP_MS) {
    if (startMs < nowMs) continue;
    const endMs = startMs + durMs;
    if (busy.some((b) => startMs < b.endMs && endMs > b.startMs)) continue;
    // The canonical objection, asked FIRST — it can forbid a moment; the
    // elemental curve below can only rank among what survives.
    if (activityKey) {
      const assessment = evaluateActivityInterval({ activityKey, startAt: new Date(startMs), endAt: new Date(endMs) });
      if (assessment?.suitability === "defer") continue;
    }
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
