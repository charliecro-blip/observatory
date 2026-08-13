/**
 * RARE WINDOWS — "when is the next genuinely exceptional time for this?"
 *
 * The gap this fills, in the owner's words (2026-08-13): asking for a date
 * night returns every upcoming Venus hour, when what a person actually wants
 * to know is when the *rare* one is — the day Venus is in her own sign and
 * receiving Jupiter and Uranus at once, versus the ordinary Tuesday where
 * she merely rules an hour. Both are "a Venus hour". Only one is worth
 * rearranging a week for.
 *
 * WHAT THIS IS NOT: a second judge of "is this well-timed". The canonical
 * engine (electionEngine.ts) still owns that, and it owns the hour-level
 * question. This module answers a different one — WHICH DAYS in a long
 * horizon are unusual for this activity — and deliberately stops at the day.
 * The intended flow is: rare-window finder picks the day, the canonical
 * engine picks the hour within it. One authority each, no overlap.
 * (See HANDOFF-ONE-AUTHORITY-DECISION-2026-08-10.md for why that boundary
 * is drawn so carefully.)
 *
 * HOW RARITY IS MEASURED: the score below is meaningless in absolute terms —
 * it is only meaningful against its own distribution. So the scan computes
 * every day in the horizon, then reports each candidate's PERCENTILE within
 * that horizon. "Top 2% of the next two years" is a claim a person can check
 * and a claim the engine can actually support. A fixed threshold would have
 * been a number pulled from the air, and worse, would fire at a different
 * rate for every activity (Venus is dignified far more often than Saturn is).
 */

import { getPlanetPositions, julianDay, moonPhase } from "./astro.js";
import { essentialDignity } from "./dignity.js";
import { ACTIVITIES, type ActivityCorrespondence } from "./activityCorrespondences.js";

const CLASSICAL = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const BENEFIC = new Set(["Venus", "Jupiter"]);
const MALEFIC = new Set(["Mars", "Saturn"]);
const SOFT = new Set(["trine", "sextile"]);
const HARD = new Set(["square", "opposition"]);

/**
 * Aspect geometry, computed here rather than via getMajorAspects().
 *
 * Not duplication of judgment — this makes no claim about applying,
 * separating, or perfection, which is exactly why it can be cheap. The
 * canonical getMajorAspects runs a fourteen-day station-aware scan per call
 * (fifty-six full position computations) to answer questions this module
 * never asks; at 730 days that was forty thousand ephemeris evaluations and
 * a twenty-five-second API request. A day-scale rarity judgment needs only
 * "are these two within orb of an angle today", which is arithmetic on two
 * longitudes.
 */
const ASPECT_ANGLES: Array<{ name: string; angle: number; orb: number }> = [
  { name: "conjunction", angle: 0, orb: 8 },
  { name: "sextile", angle: 60, orb: 6 },
  { name: "square", angle: 90, orb: 7 },
  { name: "trine", angle: 120, orb: 8 },
  { name: "opposition", angle: 180, orb: 8 },
];

function aspectBetween(lonA: number, lonB: number): { name: string; orb: number } | null {
  let raw = Math.abs(lonA - lonB) % 360;
  if (raw > 180) raw = 360 - raw;
  for (const a of ASPECT_ANGLES) {
    const orb = Math.abs(raw - a.angle);
    if (orb <= a.orb) return { name: a.name, orb };
  }
  return null;
}

export interface RareDay {
  /** Local civil date of the day, YYYY-MM-DD. */
  date: string;
  /** Raw score — comparable only within one scan. */
  score: number;
  /** Where this day sits in the scanned horizon, 0–100. */
  percentile: number;
  /** Plain-language reasons, strongest first. */
  reasons: string[];
  /** Anything genuinely working against it, named rather than hidden. */
  against: string[];
}

export interface RareScan {
  activityKey: string;
  activityLabel: string;
  /** Days scanned. */
  horizonDays: number;
  /** The exceptional days found, best first. */
  days: RareDay[];
  /** Set when the horizon holds nothing unusual — the honest empty answer. */
  none?: string;
  /** The best day's percentile, for callers wanting to phrase the claim. */
  topPercentile?: number;
}

interface DayScore {
  ms: number;
  date: string;
  score: number;
  reasons: string[];
  against: string[];
}

/** Noon UTC-ish sample for a day — a day-scale question wants a day-scale sample. */
function sampleFor(ms: number): number {
  return julianDay(new Date(ms));
}

function fmtDate(ms: number, tzOffsetMin: number): string {
  const local = new Date(ms - tzOffsetMin * 60000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

/** One day's sky, computed once and shared by every activity scored on it. */
interface DaySky {
  ms: number;
  positions: ReturnType<typeof getPlanetPositions>;
  byName: Map<string, ReturnType<typeof getPlanetPositions>[number]>;
  waxing: boolean;
}

function skyFor(ms: number): DaySky {
  const jd = sampleFor(ms);
  const positions = getPlanetPositions(jd);
  const phase = moonPhase(jd);
  const name = phase.name.toLowerCase();
  return {
    ms,
    positions,
    byName: new Map(positions.map((p) => [p.planet, p])),
    waxing: name.includes("waxing") || name.includes("new"),
  };
}

/**
 * Score one day for one activity. Everything here is about STANDING
 * conditions — the slow layer that makes a day unusual — never the hour,
 * which the canonical engine owns.
 *
 * Takes a precomputed sky because the across-everything scan (`rareToday`)
 * scores sixty activities against the same day, and recomputing the
 * ephemeris per activity made that sixty times more expensive than it is.
 */
function scoreDay(act: ActivityCorrespondence, sky: DaySky, tzOffsetMin: number): DayScore {
  const { ms, positions, byName } = sky;
  const reasons: string[] = [];
  const against: string[] = [];
  let score = 0;

  // Day/night matters for triplicity. Austin-ish default is fine: the sect
  // boundary moves by minutes across a continent, and this is a day-scale
  // judgment. Callers with real coordinates pass them through the route.
  const isDay = true;

  // The significators, weighted as the correspondence declares them.
  const sigs = Object.entries(act.planets).filter(([p]) => CLASSICAL.includes(p));

  for (const [planet, weight] of sigs) {
    const pos = byName.get(planet);
    if (!pos) continue;

    // ── Essential dignity: the single biggest driver of rarity. A planet in
    // its own sign or exaltation is the classical definition of "strong to
    // act", and it is genuinely uncommon — Venus is in Libra about one month
    // in twelve, Saturn in Capricorn for two years out of thirty.
    const dig = essentialDignity(planet, pos.longitude, isDay);
    if (dig.dignities.includes("domicile")) {
      score += 5 * weight;
      reasons.push(`${planet} is in ${pos.sign}, its own sign`);
    } else if (dig.dignities.includes("exaltation")) {
      score += 4.5 * weight;
      reasons.push(`${planet} is exalted in ${pos.sign}`);
    } else if (dig.dignities.includes("triplicity")) {
      score += 1.5 * weight;
      reasons.push(`${planet} has triplicity in ${pos.sign}`);
    } else if (dig.dignities.includes("detriment")) {
      score -= 3.5 * weight;
      against.push(`${planet} is in detriment in ${pos.sign}`);
    } else if (dig.dignities.includes("fall")) {
      score -= 3 * weight;
      against.push(`${planet} is in fall in ${pos.sign}`);
    }

    // Retrograde significator — a real objection for anything begun.
    if (pos.retrograde) {
      score -= 2.5 * weight;
      against.push(`${planet} is retrograde`);
    }

    // ── Aspects TO the significator. Soft aspects from benefics are the
    // classic "well-received" picture; hard aspects from malefics are the
    // classic objection. Tightness matters more than presence: a 1° trine is
    // a different fact from an 8° one.
    for (const otherPos of positions) {
      const other = otherPos.planet;
      if (other === planet) continue;
      const asp = aspectBetween(pos.longitude, otherPos.longitude);
      if (!asp) continue;
      const orb = asp.orb;
      const tight = Math.max(0, 1 - orb / 8);      // 1.0 at exact → 0 at 8°
      if (SOFT.has(asp.name) && BENEFIC.has(other)) {
        score += 2.6 * weight * tight;
        if (tight > 0.55) reasons.push(`${planet} ${asp.name}s ${other} (${orb.toFixed(1)}°)`);
      } else if (asp.name === "conjunction" && BENEFIC.has(other)) {
        score += 2.2 * weight * tight;
        if (tight > 0.55) reasons.push(`${planet} meets ${other} (${orb.toFixed(1)}°)`);
      } else if (SOFT.has(asp.name) && !MALEFIC.has(other)) {
        // Soft aspects from the rest (including the moderns) — real support,
        // smaller claim. This is what catches Venus trine Uranus.
        score += 1.1 * weight * tight;
        if (tight > 0.7) reasons.push(`${planet} ${asp.name}s ${other} (${orb.toFixed(1)}°)`);
      } else if (HARD.has(asp.name) && MALEFIC.has(other)) {
        score -= 2.2 * weight * tight;
        if (tight > 0.5) against.push(`${planet} ${asp.name}s ${other} (${orb.toFixed(1)}°)`);
      }
    }
  }

  // ── Moon phase, where the activity declares a preference. A launch wants a
  // waxing Moon; a release wants a waning one. Modest weight — it recurs
  // monthly, so it cannot be what makes a day rare.
  const waxing = sky.waxing;
  if (act.phase === "waxing" && waxing) { score += 0.8; }
  else if (act.phase === "waxing" && !waxing) { score -= 0.5; against.push("the Moon is waning"); }
  else if (act.phase === "waning" && !waxing) { score += 0.8; }

  return { ms, date: fmtDate(ms, tzOffsetMin), score, reasons, against };
}

/** Percentile of `v` within a sorted ascending array. */
function percentileOf(sorted: number[], v: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
  return (lo / Math.max(1, sorted.length - 1)) * 100;
}

export interface RareOptions {
  /** How far ahead to look. Default two years — long enough for a Saturn or
   *  Jupiter sign change to be inside the horizon, which is what makes the
   *  rarest windows rare. */
  horizonDays?: number;
  /** Minimum percentile to report. Default 97 — see the calibration note. */
  minPercentile?: number;
  /** Cap on returned days. */
  limit?: number;
  /** Viewer's UTC offset in minutes (Date.getTimezoneOffset convention). */
  tzOffsetMin?: number;
  /** Skip the first N days (the caller already knows about today). */
  skipDays?: number;
}

/**
 * Find the exceptional days for an activity across a long horizon.
 *
 * Returns an honest empty result rather than a weak "best available" when
 * the horizon genuinely holds nothing unusual — a rare-window finder that
 * always finds something is just a ranker with a louder adjective.
 */
export function findRareWindows(activityKey: string, fromMs: number, opts: RareOptions = {}): RareScan {
  const act = ACTIVITIES.find((a) => a.key === activityKey);
  if (!act) throw new Error(`unknown activity: ${activityKey}`);

  const horizonDays = opts.horizonDays ?? 730;
  const minPercentile = opts.minPercentile ?? 97;
  const limit = opts.limit ?? 5;
  const tzOffsetMin = opts.tzOffsetMin ?? 0;
  const skipDays = opts.skipDays ?? 0;

  const all: DayScore[] = [];
  for (let d = 0; d < horizonDays; d++) {
    all.push(scoreDay(act, skyFor(fromMs + d * 86400000), tzOffsetMin));
  }

  const sorted = all.map((d) => d.score).sort((a, b) => a - b);
  const eligible = all.slice(skipDays);

  // Rank by score, then keep only those clearing the percentile bar. Days
  // adjacent to a chosen day are dropped: a 3-day stretch of the same
  // configuration is ONE occasion, and listing it three times would overstate
  // how often this happens.
  const ranked = [...eligible].sort((a, b) => b.score - a.score);
  const picked: DayScore[] = [];
  for (const cand of ranked) {
    if (picked.length >= limit) break;
    if (percentileOf(sorted, cand.score) < minPercentile) break;
    if (picked.some((p) => Math.abs(p.ms - cand.ms) < 5 * 86400000)) continue;
    picked.push(cand);
  }

  picked.sort((a, b) => a.ms - b.ms);

  const days: RareDay[] = picked.map((d) => ({
    date: d.date,
    score: Math.round(d.score * 100) / 100,
    percentile: Math.round(percentileOf(sorted, d.score) * 10) / 10,
    // Dedupe and cap: the same fact can arrive from two significators.
    reasons: [...new Set(d.reasons)].slice(0, 5),
    against: [...new Set(d.against)].slice(0, 3),
  }));

  const scan: RareScan = {
    activityKey: act.key,
    activityLabel: act.label,
    horizonDays,
    days,
  };
  if (!days.length) {
    scan.none = `Nothing exceptional for ${act.label.toLowerCase()} in the next ${Math.round(horizonDays / 30)} months — the ordinary good windows are the answer here.`;
  } else {
    scan.topPercentile = Math.max(...days.map((d) => d.percentile));
  }
  return scan;
}

/** How far either side a day must lead to count as its occasion's crest. */
const PEAK_RADIUS = 4;

export interface RareTodayHit {
  activityKey: string;
  activityLabel: string;
  category: string;
  percentile: number;
  reasons: string[];
  against: string[];
}

/**
 * "Is TODAY exceptional for anything?" — the across-every-category question,
 * for the homepage.
 *
 * Deliberately strict. This is the one surface nobody opts into, so the bar
 * is higher than the picker's: an activity qualifies only in the top
 * `minPercentile` of a two-year horizon, which for most activities means a
 * handful of days a year. Most days return nothing, and that is the correct
 * behaviour — a banner that fires often is a banner people stop reading, and
 * Compass's whole stance is that an ordinary day is a valid answer.
 *
 * One sky per day, shared across every activity: the naive version recomputed
 * the ephemeris once per activity per day (sixty times the work) and took
 * seconds.
 */
export function rareToday(fromMs: number, opts: {
  horizonDays?: number;
  minPercentile?: number;
  tzOffsetMin?: number;
  limit?: number;
} = {}): { date: string; hits: RareTodayHit[] } {
  const horizonDays = opts.horizonDays ?? 730;
  const minPercentile = opts.minPercentile ?? 99;
  const tzOffsetMin = opts.tzOffsetMin ?? 0;
  const limit = opts.limit ?? 3;

  // The horizon's skies, computed once for all activities.
  const skies: DaySky[] = [];
  for (let d = 0; d < horizonDays; d++) skies.push(skyFor(fromMs + d * 86400000));

  // The days on either side of today, so "is today the crest" can be asked.
  // Without them a stretch of Venus in Libra fires the banner every morning
  // for a week, which is how a rare-moment notice becomes wallpaper.
  const before: DaySky[] = [];
  for (let d = PEAK_RADIUS; d >= 1; d--) before.push(skyFor(fromMs - d * 86400000));

  const hits: RareTodayHit[] = [];
  for (const act of ACTIVITIES) {
    const scores = skies.map((s) => scoreDay(act, s, tzOffsetMin));
    const sorted = scores.map((s) => s.score).sort((a, b) => a - b);
    const today = scores[0];
    const pct = percentileOf(sorted, today.score);
    if (pct < minPercentile) continue;

    // ── THE CREST RULE. A multi-day configuration is ONE occasion. Today
    // earns the banner only if it is the strongest day of its own stretch —
    // strictly better than the days behind it (so the notice fires once, on
    // the way up) and at least as good as the days ahead.
    const neighbours = [
      ...before.map((s) => scoreDay(act, s, tzOffsetMin).score),
      ...scores.slice(1, PEAK_RADIUS + 1).map((s) => s.score),
    ];
    const priorMax = Math.max(...before.map((s) => scoreDay(act, s, tzOffsetMin).score), -Infinity);
    const aheadMax = Math.max(...scores.slice(1, PEAK_RADIUS + 1).map((s) => s.score), -Infinity);
    if (neighbours.length && (today.score <= priorMax || today.score < aheadMax)) continue;
    hits.push({
      activityKey: act.key,
      activityLabel: act.label,
      category: act.category,
      percentile: Math.round(pct * 10) / 10,
      reasons: [...new Set(today.reasons)].slice(0, 3),
      against: [...new Set(today.against)].slice(0, 2),
    });
  }

  hits.sort((a, b) => b.percentile - a.percentile);
  return { date: fmtDate(fromMs, tzOffsetMin), hits: hits.slice(0, limit) };
}
