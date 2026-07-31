/**
 * How good is a given moment for a given kind of work?
 *
 * This exists so the cascade grades a MOVED window in exactly the language the
 * weaver used to place it. Two different scores for the same question would be
 * worse than no second opinion at all — you'd get a confident picture of a
 * subtly different question, and no way to tell from the outside.
 *
 * `Tier` and `TIER_NOTE` were previously private to routes/plan.ts. They live
 * here now and plan.ts imports them, so there is one grading vocabulary rather
 * than a seventh favorability scale (BACKLOG §7 parks vocabulary
 * proliferation deliberately — this is the opposite move).
 */
import { computeDayArc, findPeakWindows, type DayArc } from "./dayarc.js";
import { getPlanetaryHour } from "./astro.js";

// "great" = a peak in the work's own lane, or its planet's own hour.
// "workable" = a real slot that will do.
// "against" = runs counter to the work's current.
export type Tier = "great" | "workable" | "against";

export const TIER_NOTE: Record<Tier, string> = {
  great: "a great time for this",
  workable: "this time will do",
  against: "swimming against the current — the only open water left",
};

/**
 * Which elemental curve a window type should be read against.
 *
 * `planning_windows` stores a windowType but no element — the element is known
 * when the weaver places a task and is lost at commit. associate.ts has only
 * the other direction (element → windowType), and that map is lossy: fire and
 * earth BOTH default to deep_work, so it cannot simply be inverted.
 *
 * So this is a deliberate choice, not a derivation. `deep_work` reads as earth
 * (sustained building, the more common case for a scheduled block) rather than
 * fire (the initiating burst). If a window ever carries a real element, prefer
 * that over this table — it is a fallback for rows that never recorded one.
 */
export const WINDOW_ELEMENT: Record<string, string> = {
  deep_work: "earth",
  admin: "earth",
  planning: "air",
  study: "air",
  social: "air",
  creative: "water",
  relationship: "water",
  recovery: "water",
  retreat: "water",
  launch: "fire",
};

/** Ranked worst→best, so two tiers can be compared without a lookup table. */
const TIER_RANK: Record<Tier, number> = { against: 0, workable: 1, great: 2 };

export function compareTiers(a: Tier, b: Tier): number {
  return TIER_RANK[a] - TIER_RANK[b];
}

// Only the seven classical planets rule hours.
const HOUR_RULERS = new Set(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);

export interface MomentVerdict {
  tier: Tier;
  tierNote: string;
  planetaryHour: string;
  /** 0..1 energy of the work's own elemental curve at that hour. */
  energy: number;
  /** Where that sits within the element's OWN range today — the comparable one. */
  relative: number;
  inOwnPeak: boolean;
  /** Local hour the block starts, for "runs past your day" checks. */
  startHour: number;
}

/**
 * Grade one placement.
 *
 * The workable/against line is drawn on energy NORMALISED within that
 * element's own range for that day — not on a raw value, and not on a
 * percentile of the day.
 *
 * Both of the obvious alternatives were tried and measured (2026-08-12, Austin):
 *
 *   fire   min=0.218  p25=0.295  p50=0.345  max=0.824
 *   earth  min=0.262  p25=0.294  p50=0.423  max=0.529
 *   air    min=0.213  p25=0.276  p50=0.291  max=0.448
 *   water  min=0.146  p25=0.218  p50=0.238  max=0.267
 *
 * A RAW threshold is meaningless across elements: water's best hour of the day
 * (0.267) sits below air's 25th percentile (0.276), so any fixed number grades
 * every water block "against" and almost no air block.
 *
 * The MEDIAN is worse than it sounds: half of every day is below it by
 * definition, so half of all moments would be reported as "swimming against
 * the current" — a phrase that means "the only open water left". Calibrating
 * it that way made the first end-to-end run grade three ordinary afternoon
 * blocks "against → against", which is both alarming and uninformative.
 *
 * Normalising within the element's own daily range keeps "against" rare and
 * comparable, and it self-calibrates on a flat day as well as a dramatic one.
 *
 * The 0.10 itself is measured, not chosen for feel. Share of the working day
 * (06:00–23:00) graded "against", by threshold, across three unlike days:
 *
 *              0.10   0.15   0.20   0.25   0.30
 *   worst el.   18%    38%    41%    47%    56%    ← earth, 2026-08-12
 *   typical      6%     9%    12%    15%    18%
 *
 * Earth on 2026-08-12 is the stress case: a compressed range (0.262–0.529)
 * whose peaks fall at 02:00–07:30 and 10:00–12:48, leaving a long flat
 * afternoon. At 0.25 nearly half that day reads "against"; at 0.10 it is 18%,
 * and every other day/element sampled sits at or below 15%.
 */
const AGAINST_BELOW = 0.10; // bottom tenth of the element's own daily range
export function tierForMoment(opts: {
  element: string;
  startMs: number;
  durMs: number;
  lat: number;
  lon: number;
  tzOffsetMin: number;
  planets?: string[];
  /** Reuse a computed arc when grading many moments on the same day. */
  arc?: DayArc;
}): MomentVerdict {
  const { element, startMs, durMs, lat, lon, tzOffsetMin } = opts;
  const arc = opts.arc ?? computeDayArc(new Date(startMs), lat, lon, tzOffsetMin);
  const curve = arc.curves[element] ?? arc.curve;

  const dayStartMs = new Date(arc.dayStart).getTime();
  const startHour = (startMs - dayStartMs) / 3600000;
  const endHour = startHour + durMs / 3600000;

  // Nearest curve point, matching how the weaver reads energy.
  let energy = 0.5;
  let bestD = Infinity;
  for (const p of curve) {
    const d = Math.abs(p.hour - startHour);
    if (d < bestD) { bestD = d; energy = p.e; }
  }

  const inOwnPeak = findPeakWindows(curve, 3, 2).some(
    (p) => startHour < p.endHour && endHour > p.startHour,
  );

  const ruler = getPlanetaryHour(new Date(startMs), lat, lon).ruler;
  const ownHour = !!opts.planets?.some((p) => HOUR_RULERS.has(p) && p === ruler);

  let lo = Infinity, hi = -Infinity;
  for (const p of curve) { if (p.e < lo) lo = p.e; if (p.e > hi) hi = p.e; }
  // A perfectly flat curve has no low point to be against.
  const relative = hi > lo ? (energy - lo) / (hi - lo) : 1;

  let tier: Tier;
  let note: string;
  if (inOwnPeak || ownHour) {
    tier = "great";
    note = ownHour && !inOwnPeak ? `a great time — ${ruler}'s own hour` : TIER_NOTE.great;
  } else if (relative >= AGAINST_BELOW) {
    tier = "workable";
    note = TIER_NOTE.workable;
  } else {
    tier = "against";
    note = TIER_NOTE.against;
  }

  return { tier, tierNote: note, planetaryHour: ruler, energy, relative, inOwnPeak, startHour };
}
