/**
 * The election engine (owner 2026-07-20): pick an activity → tiered times.
 *
 * GOOD times (the sky's general weather, localized):
 *   · the activity's planetary hour (needs lat/lon — allowed here, unlike
 *     shareable cards, because this is in-app and per-user)
 *   · the swell around a Moon aspect to the activity's significators
 *   · an all-day Moon-sign affinity
 *   · for void-favoring activities (rest, clearing), the void itself
 *
 * GREAT times (the sky speaking to YOU, or to itself, about this matter):
 *   · a planetary hour and a Moon-aspect swell OVERLAPPING (stacked good)
 *   · a significator moving through one of the activity's governing houses
 *     in the user's NATAL chart (whole-sign), or the Moon crossing one today
 *   · a transiting significator in tight soft aspect to its own natal place
 *   · a standing sky aspect between two significators (≤3°, supportive)
 *
 * Honesty layer: per-activity Mercury-Rx stance (hard = classically blocked,
 * surfaced as a caution, great tier withheld), VoC avoidance drops windows
 * inside the void, phase bias nudges rather than excludes.
 */

import { ACTIVITIES, modeOf, tempoOf, primarySignificatorsOf, type ActivityCorrespondence } from "./activityCorrespondences.js";
import { motionOf, TRADITIONAL_PLANETS } from "./motion.js";
import {
  julianDay, moonLongitude, sunLongitude, getPlanetaryHour, getPlanetPositions,
  getMajorAspects, isRetrograde, SIGNS, moonFinalAspectInSign, eclipseWindow,
  getSunriseSunset, scanMoonPerfections,
} from "./astro.js";
import { computeDayArc } from "./dayarc.js";
import { civilDayOffsetIn } from "./localClock.js";
import { computeCusps, assignHouse } from "./houses.js";
import type { ComputedNatalChart } from "./natal.js";

const SOFT_W: Record<string, number> = { conjunction: 1.0, trine: 0.85, sextile: 0.65, quintile: 0.5, "semi-sextile": 0.35 };
const HARD_W: Record<string, number> = { square: 0.7, "semi-square": 0.4, sesquiquadrate: 0.4 };
const WEEKDAY_RULERS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;
const norm360 = (d: number) => ((d % 360) + 360) % 360;
const sep180 = (a: number, b: number) => { const d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; };

/** Why a window that otherwise qualified was held back from `great`. */
export type CapReason =
  | "mercury-retrograde" | "eclipse-window"
  | "retrograde-significator" | "malefic-final-aspect"
  | "significator-stationing";

/** How many independent source families agree. A claim about the SKY. */
export type SupportLevel = "supported" | "convergent";

/**
 * What acting on that agreement is worth. A claim about the MATTER.
 *
 *   clear     — nothing qualifies it
 *   qualified — usable, with a named complication; often better for revising,
 *               renegotiating or a soft opening than for a clean start
 *   defer     — a real electional objection to beginning here
 */
export type Suitability = "clear" | "qualified" | "defer";

export type SuitabilityReason =
  | { kind: "primary-significator-stationing-retrograde"; planet: string }
  | { kind: "primary-significator-stationing-direct"; planet: string }
  | { kind: "primary-significator-retrograde"; planet: string }
  | { kind: "significator-station"; planet: string }
  | { kind: "mercury-retrograde"; planet: string };

/** Severity of each reason, so `suitability` stays a pure function of them. */
const DEFER_REASONS = new Set<SuitabilityReason["kind"]>([
  "primary-significator-stationing-retrograde",
]);
const QUALIFY_REASONS = new Set<SuitabilityReason["kind"]>([
  "primary-significator-stationing-direct",
  "primary-significator-retrograde",
  "mercury-retrograde",
]);
// `significator-station` on a non-inception is deliberately in NEITHER set:
// it is worth SAYING and must not hold anything back.

export interface ElectionWindow {
  date: string; dow: string;
  startAt: string; endAt: string;          // ISO instants (schedulable)
  startClock: string; endClock: string;
  allDay?: boolean;
  tier: "good" | "great";
  score: number;
  why: string;
  sources: string[];                        // raw: hour | moon | sign | voc | natal-house | natal-contact | sky
  /** Normalized independent families present in this window. What the tier
   *  is counted from, and what convergence language must be derived from. */
  families: SourceFamily[];
  /** THIS window carries personal (natal) testimony supporting this activity.
   *  Distinct from the result's `chartAvailable`. */
  personal: boolean;
  /** The personal testimony is what lifted this window to `great` — without
   *  it, it would be `good`. Only meaningful when tier === "great". */
  personalDecidedTier: boolean;
  /** Set when the window met the bar for `great` and a traditional gate
   *  demoted it. Null when it was never close, or was not demoted. */
  cappedBy: CapReason | null;
  /** Independent agreement. Replaces what `tier` used to half-mean. */
  supportLevel: SupportLevel;
  /** Families discriminating enough to establish the claim. */
  establishingFamilies: SourceFamily[];
  /** Families that strengthen an established claim but cannot create one. */
  reinforcingFamilies: SourceFamily[];
  /** A matching hour sharpens a lunar swell into a window with clean edges.
   *  Ranks supported windows; deliberately does NOT promote them. */
  stackedHourMoon: boolean;
  /** Fitness for acting, held SEPARATE from agreement. */
  suitability: Suitability;
  /** Structured, so the surface can explain rather than just demote. */
  suitabilityReasons: SuitabilityReason[];
  /** The same testimonies as `why`, unjoined, one per line of reasoning. */
  evidence?: Evidence[];
  /**
   * Whether the reasons list finished with nothing qualifying it.
   *
   * Deliberately NOT "nothing in the window is contradicted" — that is a claim
   * about the sky, and it would require knowing the search was exhaustive. A
   * false negative there reads as a guarantee and becomes indefensible the
   * moment the orb table changes. This is the narrower thing Compass can
   * actually know: it examined its own reasons and recorded no objection.
   *
   * It lives here rather than in the view because it is an assertion, and
   * assertions belong to the engine that can justify them.
   */
  noObjections: boolean;
}

/**
 * One testimony, with the KIND of claim it makes attached.
 *
 * The testimonies were always computed separately and then joined into a single
 * `why` string; the join was what threw the structure away. Carrying the family
 * buys three things a joined string cannot: the reader knows what kind of claim
 * they are reading before they read it, order becomes controllable without
 * string surgery, and — the decisive one — a surface can DERIVE its short
 * verdict line from the first testimony instead of maintaining a second,
 * hand-written copy that drifts from this one.
 *
 * `family` is an open set, not an enum. Views must render whatever arrives
 * rather than switch on a fixed list, so a new kind of testimony shows up
 * instead of vanishing.
 */
export interface Evidence {
  family: string;
  text: string;
}

export interface ElectionResult {
  activity: { key: string; label: string; gloss: string; category: string };
  span: "day" | "week" | "month";
  /** A natal chart was available to the computation. Says NOTHING about
   *  whether any returned window uses it — that is `personalized` below and
   *  `personal` per window. */
  chartAvailable: boolean;
  /** At least one returned window actually carries personal testimony. This
   *  used to be `!!natal`, which let a response of entirely global windows
   *  describe itself as personalized. */
  personalized: boolean;
  cautions: string[];
  windows: ElectionWindow[];
  /**
   * What was computed and deliberately NOT listed, with the count. A gap is
   * output, never a silent drop (CLAUDE.md): the interface can say "nine
   * matching hours this week aren't shown on their own" instead of the
   * person wondering where the Mercury hours went.
   */
  withheld: { hourOnly: number };
}

export function clockOf(ms: number, tzOffsetMin: number): string {
  const s = new Date(ms - tzOffsetMin * 60000);
  let h = s.getUTCHours(); const m = s.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Enumerate the local day's planetary hours (localized good-time layer).
function dayHours(dayStartMs: number, lat: number, lon: number): { ruler: string; startMs: number; endMs: number }[] {
  const out: { ruler: string; startMs: number; endMs: number }[] = [];
  let t = dayStartMs + 60000;
  const dayEnd = dayStartMs + 24 * 3600000;
  for (let i = 0; i < 30 && t < dayEnd; i++) {
    const ph = getPlanetaryHour(new Date(t), lat, lon);
    out.push({ ruler: ph.ruler, startMs: ph.startTime.getTime(), endMs: ph.endTime.getTime() });
    t = ph.endTime.getTime() + 60000;
  }
  return out;
}

/**
 * CANONICAL SOURCE FAMILIES.
 *
 * Tier decisions must count independent *kinds* of testimony, not rows. Three
 * separate branches used to push the bare string "natal" — a significator
 * transiting a governing house, the Moon crossing one, and a significator
 * contacting its own natal place — and the GREAT test read
 * `daySources.length` BEFORE the emit-time dedupe. Two firings of the same
 * broad natal family could therefore satisfy a threshold that documents itself
 * as "two independent signals".
 *
 * Measured 2026-08-03 over 30 days x 46 activities on a real chart: this never
 * actually mis-tiered a window (every GREAT carried three distinct families).
 * It is fixed because the code contradicted its own stated semantics, because
 * promoting this tier to the centre of the product widens the exposure, and
 * because calibration has to count what the UI claims it counts — not because
 * anyone hit it.
 */
export type SourceFamily =
  | "planetary-time"   // hour ruler, weekday ruler
  | "lunar-contact"    // Moon aspecting a significator
  | "lunar-condition"  // Moon sign affinity, phase, void of course
  | "standing-sky"     // non-lunar aspect between significators
  | "natal-house"      // transiting body in a governing natal house
  | "natal-contact"    // transit to its own natal place
  | "planetary-motion"; // speed/direction matching the activity's tempo

const FAMILY_OF: Record<string, SourceFamily> = {
  hour: "planetary-time",
  moon: "lunar-contact",
  sign: "lunar-condition",
  voc: "lunar-condition",
  sky: "standing-sky",
  "natal-house": "natal-house",
  "natal-contact": "natal-contact",
  motion: "planetary-motion",
};
const familiesOf = (srcs: string[]): SourceFamily[] =>
  [...new Set(srcs.map(x => FAMILY_OF[x]).filter(Boolean) as SourceFamily[])];
const PERSONAL_FAMILIES = new Set<SourceFamily>(["natal-house", "natal-contact"]);

/**
 * ESTABLISHING vs REINFORCING — what each family is allowed to CLAIM.
 *
 * Counting distinct families was still too blunt, in both directions. Two
 * strong testimonies can be genuinely convergent (the Moon applying exactly to
 * the significator, and that significator contacting its own natal place),
 * while three broad ones need not be (a matching hour, a preferred Moon sign
 * and a preferred phase are three labels, none of them unusual).
 *
 * So the question is not how many families agree but what each family is
 * discriminating enough to establish. Establishing families are relational or
 * event-specific: the Moon APPLYING to this activity's significator is a real
 * celestial event with a time. Reinforcing families are recurrent conditions:
 * a Mercury hour comes round every day for every Mercurial activity.
 *
 * The governing sentence, from the doctrinal review: planetary hours are
 * independent enough to appear in the evidence, but not discriminating enough
 * to establish convergence without additional testimony.
 *
 * This also settles the hour x Moon convention that was preserved through the
 * family-counting fix. The two stay VISIBLY separate families — collapsing
 * them would make the receipt less truthful, since they come from different
 * techniques — but the hour cannot be the second voice. Their overlap becomes
 * a modifier (`stackedHourMoon`) that sharpens and ranks a window rather than
 * promoting it.
 */
const ESTABLISHING_FAMILIES = new Set<SourceFamily>([
  "lunar-contact",    // the Moon applying to a significator — an event, with a time
  "standing-sky",     // a tight aspect between this activity's own significators
  "natal-contact",    // a close transit to the relevant natal planet
]);
const roleOf = (f: SourceFamily): "establishing" | "reinforcing" =>
  ESTABLISHING_FAMILIES.has(f) ? "establishing" : "reinforcing";
/**
 * Acts for which an hour by itself is too small a thing to suggest.
 *
 * `revision` joined on 2026-08-22, after measuring what actually sources a
 * window across all 50 activities over a week:
 *
 *     execution     0/144   0%      inception   0/81    0%
 *     revision     23/ 50  46%   ← editing, finishing, repairing a bond
 *     maintenance  27/ 50  54%      recovery   13/60   22%
 *
 * The guard was working exactly as written for the two modes it named, and
 * nearly half of revision's windows were the planetary hour and nothing else.
 * The note below defends hour-only rows for UPKEEP and RECOVERY — "a Mercury
 * hour is exactly the right grain for errands" — and revision is neither.
 * Redrafting a chapter or repairing a bond is substantial work, and an hour
 * alone is not a reason to schedule it.
 */
const SUBSTANTIAL_MODES = new Set<ReturnType<typeof modeOf>>(["inception", "execution", "revision"]);

/**
 * THE AGREEMENT RULE, in one place.
 *
 * "How many independent testimonies agree" is the second axis of the
 * canonical verdict (suitability being the first), and until now it existed
 * only as an expression inline in `computeElections` — so anything else
 * wanting the same answer had to restate it, which is how a codebase ends
 * up with two modules quietly disagreeing about convergence.
 *
 * Exported and pure: at least one ESTABLISHING testimony must sit at the
 * centre. Two of them converge on their own; one plus two reinforcing
 * conditions also does. A pile of reinforcing conditions never does,
 * however tall.
 */
/**
 * One day's Moon perfections, computed once.
 *
 * `scanMoonPerfections` sweeps a whole day in ten-minute steps, and
 * `evaluateActivityInterval` is called in tight loops — once per candidate
 * slot in the planner, once per option in the session finder. Calling it
 * per interval made the assessment quadratic in a way the unit tests found
 * immediately (every suite that assesses many intervals went from seconds
 * to timeouts), which is the same defect the rare-window scan had before
 * its geometry was made local.
 *
 * Keyed by local day-start, capped so a long-running process cannot grow it
 * without bound.
 */
const moonPerfCache = new Map<number, ReturnType<typeof scanMoonPerfections>>();
function moonPerfectionsForDay(dayStartMs: number): ReturnType<typeof scanMoonPerfections> {
  const hit = moonPerfCache.get(dayStartMs);
  if (hit) return hit;
  const scan = scanMoonPerfections(dayStartMs);
  if (moonPerfCache.size > 16) moonPerfCache.clear();
  moonPerfCache.set(dayStartMs, scan);
  return scan;
}

export function supportLevelFrom(families: SourceFamily[]): SupportLevel {
  const establishing = families.filter(f => roleOf(f) === "establishing");
  const reinforcing = families.filter(f => roleOf(f) === "reinforcing");
  return establishing.length >= 2 || (establishing.length >= 1 && reinforcing.length >= 2)
    ? "convergent" : "supported";
}

/**
 * THE CANONICAL ACTIVITY VERDICT.
 *
 * One interval plus one activity has exactly one astrological judgment, and it
 * is made here. Every layer above — the long-session finder, the day weaver,
 * the week weaver, Home — receives this as immutable evidence and may add only
 * PRACTICAL constraints: a calendar clash, a full day, a missing duration.
 *
 * This exists because the alternative was measured and it was bad. Before it,
 * `longSession` derived its own suitability from the activity's voc policy,
 * mode, and Moon-sign fit, and disagreed with this engine on 25 of 125
 * activity-days — the engine saying `clear` while the session finder said
 * `qualified` for the same afternoon. A user saw both.
 *
 * WHAT BELONGS HERE
 * ---------------------------------------------------------------------------
 * Anything that depends on what the sky means FOR AN ACTIVITY: whether a void
 * qualifies it, whether a retrograde significator caps it, whether a station
 * matters, whether the Moon's sign is aligned or contrary. Note that these are
 * activity-relative, which is why they cannot live in `dayTimeline`: a void is
 * a serious objection to an inception, a useful shift for finishing, and close
 * to irrelevant to an already-running deep-work session.
 *
 * WHAT DOES NOT
 * ---------------------------------------------------------------------------
 * Whether the person is free, whether the day is overloaded, whether a deadline
 * can be met, whether a duration is known. Those are practical, and higher
 * layers own them entirely.
 */
/**
 * What a sky event MEANS for a given activity.
 *
 * The role a void or an ingress plays is not a property of the event — it
 * depends entirely on what you intend to do. A void beginning is:
 *
 *   · a serious objection to an inception meant to last;
 *   · a useful shift for finishing and refining;
 *   · close to irrelevant to a deep-work session already under way;
 *   · positively suitable for clearing, retreat, or rest.
 *
 * `dayTimeline` used to stamp these roles universally, which put a judgment
 * where the activity is unknown — the same defect that had two modules
 * disagreeing about suitability on 20% of activity-days.
 */
export type SkyEventRole = "anchor" | "qualification" | "internal-chapter" | "irrelevant";

export function skyEventRole(kind: string, activityKey: string): SkyEventRole {
  const act = ACTIVITIES.find(a => a.key === activityKey);
  if (!act) return "irrelevant";
  const mode = modeOf(act.key);

  if (kind === "moon-perfects") {
    // A perfection has a clock time worth building around — but only when the
    // activity has some relationship to lunar contact at all.
    return Object.keys(act.planets ?? {}).length ? "anchor" : "internal-chapter";
  }

  if (kind === "void-begins" || kind === "void-ends") {
    if (act.voc === "favor") return "internal-chapter";   // the void suits this
    if (act.voc === "neutral") return "irrelevant";
    // "avoid": how much it bites depends on whether this is a BEGINNING.
    return mode === "inception" ? "qualification" : "internal-chapter";
  }

  if (kind === "moon-ingress") return "internal-chapter";
  if (kind === "hour-change") {
    // An hour change matters to activities that name preferred rulers, and is
    // texture to everything else.
    return (act.hourRulers ?? []).length ? "internal-chapter" : "irrelevant";
  }
  return "irrelevant";
}

export interface ActivityAssessment {
  activityKey: string;
  startAt: Date;
  endAt: Date;
  suitability: Suitability;
  suitabilityReasons: SuitabilityReason[];
  /** Moon-sign affinity: a PRIOR for ranking, never a driver of suitability. */
  backgroundFit: "aligned" | "neutral" | "contrary";
  /**
   * The testimony families active over this interval — the receipt behind
   * `supportLevel`, in the same taxonomy the window engine uses.
   *
   * Natal families never appear here: this function is given no chart, and
   * claiming personal reinforcement it cannot see would be a fabrication.
   */
  families: SourceFamily[];
  /**
   * The agreement axis: how much independent testimony converges.
   *
   * Second of the two axes, alongside `suitability`. They answer different
   * questions and must never be fused — a retrograde significator does not
   * make the supporting testimonies disappear, it changes what acting on
   * their agreement is worth.
   */
  supportLevel: SupportLevel;
  /** Interval-specific sky events, already judged for this activity. */
  transitions: { kind: string; at: Date; role: "qualification" | "internal-chapter" | "irrelevant" }[];
}

const ELEMENT_OF_SIGN_IDX = ["fire", "earth", "air", "water"] as const;
const ELEMENT_ANTIPATHY: Record<string, string> = { fire: "water", water: "fire", air: "earth", earth: "air" };

export function evaluateActivityInterval(opts: {
  activityKey: string;
  startAt: Date;
  endAt: Date;
}): ActivityAssessment | null {
  const act = ACTIVITIES.find(a => a.key === opts.activityKey);
  if (!act) return null;

  const { startAt, endAt } = opts;
  const midJd = julianDay(new Date((startAt.getTime() + endAt.getTime()) / 2));
  const actMode = modeOf(act.key);
  const sigPlanets = primarySignificatorsOf(act.key, act.planets);

  const reasons: SuitabilityReason[] = [];

  // ── Significator motion. Identical rules to computeElections, because they
  //    ARE the same rules — that is the point of having one evaluator.
  const stations = sigPlanets
    .filter(p => TRADITIONAL_PLANETS.has(p) && p !== "Sun" && p !== "Moon")
    .map(p => ({ planet: p, motion: motionOf(p, midJd) }))
    .filter(x => x.motion && x.motion.phase.startsWith("stationing"));
  for (const st of stations) {
    const first = st.motion!.phase === "stationing-retrograde";
    if (actMode === "inception") {
      reasons.push(first
        ? { kind: "primary-significator-stationing-retrograde", planet: st.planet }
        : { kind: "primary-significator-stationing-direct", planet: st.planet });
    } else {
      reasons.push({ kind: "significator-station", planet: st.planet });
    }
  }
  if (actMode === "inception") {
    for (const p of sigPlanets) {
      if (p === "Sun" || p === "Moon" || !TRADITIONAL_PLANETS.has(p)) continue;
      if (stations.some(st => st.planet === p)) continue;
      if (isRetrograde(p, midJd)) reasons.push({ kind: "primary-significator-retrograde", planet: p });
    }
  }
  if (act.mercuryRx === "hard" && isRetrograde("Mercury", midJd)) {
    reasons.push({ kind: "mercury-retrograde", planet: "Mercury" });
  }

  // ── Moon sign: a PRIOR. Reported, never a suitability driver — a hard filter
  //    on something that lasts two and a half days makes an activity
  //    unschedulable for days at a time.
  const moonSign = SIGNS[Math.floor(norm360(moonLongitude(midJd)) / 30) % 12];
  const signElement = ELEMENT_OF_SIGN_IDX[SIGNS.indexOf(moonSign) % 4];
  const backgroundFit: ActivityAssessment["backgroundFit"] =
    act.signs?.[moonSign] ? "aligned"
    : ELEMENT_ANTIPATHY[act.element] === signElement ? "contrary"
    : "neutral";

  const suitability: Suitability =
    reasons.some(r => DEFER_REASONS.has(r.kind)) ? "defer"
    : reasons.some(r => QUALIFY_REASONS.has(r.kind)) ? "qualified"
    : "clear";

  // ── THE AGREEMENT AXIS (Pass 3 of the one-authority migration).
  //
  // The assessment answered "what is acting on this worth" but not "how much
  // agrees", so every caller wanting the second had to go back to
  // computeElections and recompute it on the same internals — the gap the
  // August handoff called the highest-leverage architecture step.
  //
  // Which families are ACTIVE over this interval, using the same taxonomy
  // and the same rule as the window engine:
  //
  //   planetary-time  — the hour's ruler is one this activity names
  //   lunar-contact   — the Moon perfects an aspect to a significator inside
  //                     the interval (an event, with a time: establishing)
  //   lunar-condition — the Moon's sign is one this activity favours
  //
  // Natal families are absent by construction: this function takes no chart,
  // and inventing personal reinforcement from a chart it cannot see would be
  // exactly the fabrication the house rules forbid. A caller holding a chart
  // still gets those from computeElections.
  const families: SourceFamily[] = [];
  const hourRuler = act.hourRulers?.length
    ? getPlanetaryHour(new Date((startAt.getTime() + endAt.getTime()) / 2)).ruler
    : null;
  if (hourRuler && act.hourRulers.includes(hourRuler)) families.push("planetary-time");
  if (act.signs?.[moonSign]) families.push("lunar-condition");
  const sigSet = new Set(sigPlanets);
  if (sigSet.size) {
    const dayStart = new Date(startAt); dayStart.setHours(0, 0, 0, 0);
    const perfects = moonPerfectionsForDay(dayStart.getTime())
      .some(ev => sigSet.has(ev.planet)
        && ev.timeMs >= startAt.getTime() && ev.timeMs <= endAt.getTime());
    if (perfects) families.push("lunar-contact");
  }

  return {
    activityKey: act.key, startAt, endAt,
    suitability, suitabilityReasons: reasons, backgroundFit,
    families,
    supportLevel: supportLevelFrom(families),
    transitions: [],
  };
}

export function computeElections(opts: {
  activityKey: string;
  span: "day" | "week" | "month";
  lat: number; lon: number; tzOffsetMin: number;
  natal?: ComputedNatalChart | null;
  /**
   * Whether the birth TIME is known. False means the stored chart was built
   * from a substituted noon (Settings writes `birthTime || "12:00"` with
   * timeKnown:false), so its Ascendant — and therefore every house cusp — is
   * fabricated. Planet positions remain usable; houses must not be.
   *
   * Defaults true because every caller that has a chart today has a real time;
   * the flag exists so that stops being an assumption.
   */
  timeKnown?: boolean;
  /**
   * Whether `lat`/`lon` are the user's real location or a timezone guess.
   *
   * Planetary hours are cut from local sunrise and sunset, so on a guessed
   * meridian every hour boundary is wrong. Hiding those hours in the interface
   * was only half the fix — they were still generating candidate windows,
   * contributing the `planetary-time` family, and therefore influencing which
   * windows exist and whether they converge. A hidden guessed factor that
   * changes the answer is worse than a visible one.
   *
   * When false: no hour candidates, no `planetary-time`. Universal lunar and
   * planetary testimony is unaffected — the Moon aspects the same planets
   * wherever you are standing.
   *
   * Defaults true so existing internal callers and fixtures keep their
   * meaning; the routes pass it explicitly.
   */
  locationKnown?: boolean;
  startAt?: Date;
  /**
   * The viewer's IANA zone, e.g. "America/Chicago". Optional so every caller
   * that only has `tzOffsetMin` keeps its exact current behavior — but a
   * multi-day span stepped by raw milliseconds silently drifts across any DST
   * transition inside it, and a week/month scan crosses one far more often
   * than a single day does. When present, this is what makes each day in
   * the scan land on the correct CIVIL date rather than "24 hours later".
   */
  timeZone?: string;
}): ElectionResult | null {
  const act = ACTIVITIES.find(a => a.key === opts.activityKey);
  if (!act) return null;
  const { lat, lon, tzOffsetMin } = opts;
  const days = opts.span === "day" ? 1 : opts.span === "week" ? 7 : 30;
  const start = opts.startAt ?? new Date();
  const aspectW: Record<string, number> = act.aspects === "effort" ? { ...SOFT_W, ...HARD_W } : SOFT_W;

  // Natal groundwork: whole-sign cusps from the natal Ascendant, and each
  // significator's own natal longitude (for transit-to-natal returns).
  const natal = opts.natal ?? null;
  // No known birth time → no houses. A noon-substituted Ascendant would
  // otherwise generate `natal-house` testimony that is pure artifact, and
  // (since personal families can decide the tier) could promote a window to
  // GREAT on the strength of a house placement nobody computed. Transit-to-
  // natal contacts survive: planetary longitudes barely move across a day.
  const houseTestimonyAllowed = opts.timeKnown !== false;
  const locationKnown = opts.locationKnown !== false;
  const cusps = natal && houseTestimonyAllowed ? computeCusps("whole-sign", { ascLon: natal.ascendant.longitude, mcLon: natal.midheaven.longitude, lat, lon, jd: 0 } as any) : null;
  const natalLonOf = (p: string) => natal?.planets.find(x => x.planet === p)?.longitude ?? null;

  const cautions: string[] = [];
  const startJd = julianDay(start);
  const mercRx = isRetrograde("Mercury", startJd);

  // ── Verified electional gates (Hampar / DeLuce / March — see
  // SYNTHESIS-BOOK-NOTES.md) ─────────────────────────────────────────────────
  // 1. Eclipse window: delay elections within ±1 week of any eclipse — an
  //    unstable sky to launch in. GREAT is suppressed; the caution says why.
  const ecl = eclipseWindow(startJd);
  if (ecl.active) cautions.push(`A ${ecl.kind} eclipse falls within a week — the tradition delays elections near eclipses. Windows stay usable, but nothing gets the GREAT stamp.`);
  // 2. Retrograde significators: the matter's own planets should be direct.
  //    A retrograde significator caps the tier (success-with-revision, not GREAT).
  // Formal significators, not "everything weighted >= 0.8". Weight says how
  // strongly a planet corresponds to the activity; role says whether it is
  // carrying the matter such that its debility compromises the undertaking.
  // The old cutoff was never defended — it was just a number.
  const sigPlanets = primarySignificatorsOf(act.key, act.planets);
  const rxSigs = sigPlanets.filter(p => p !== "Sun" && p !== "Moon" && isRetrograde(p, startJd));
  // Also narrowed: the top tier is only withheld for INCEPTIONS now, so the
  // caution no longer promises a demotion it will not deliver for a long run.
  if (rxSigs.length) {
    const withheld = modeOf(act.key) === "inception";
    cautions.push(`${rxSigs.join(" and ")} — this activity's significator${rxSigs.length > 1 ? "s are" : " is"} retrograde: doable, but expect re-work${withheld ? "; for a beginning, the tradition withholds the best stamp" : ""}.`);
  }
  // Was "the tradition blocks this outright". That stopped being true when the
  // retrograde handling moved from a tier cap to the suitability axis: this now
  // QUALIFIES a window rather than refusing it, and the copy has to say what the
  // rule does. Only a stationing primary significator on an inception defers.
  if (mercRx && act.mercuryRx === "hard") cautions.push("Mercury is retrograde — the tradition counts this against a clean start. Usable for revisiting, re-sending or a soft opening; wait for the direct station if it must be final.");
  if (mercRx && act.mercuryRx === "soft") cautions.push("Mercury is retrograde — doable, but expect revisions and follow-ups; leave slack.");
  if (mercRx && act.mercuryRx === "favor") cautions.push("Mercury is retrograde — which actually suits this: re- work runs well under it.");

  const windows: ElectionWindow[] = [];
  // Candidates the hour made and nothing else backed — counted, not shown.
  let hourOnlyWithheld = 0;
  const finalAspectMemo = new Map<string, ReturnType<typeof moonFinalAspectInSign>>();

  for (let d = 0; d < days; d++) {
    // Civil-day stepping when a zone is available: `civilDayOffsetIn` adds
    // CALENDAR days, so a week/month scan crossing a DST transition still
    // lands on the correct date for every day after it. `+ d * 86400000`
    // (kept as the fallback for callers with only a numeric offset) drifts
    // by an hour at the transition and stays drifted for the rest of the
    // scan — a month spanning "spring forward" was reading day 20 as if it
    // were day 20 minus an hour, which can be the wrong civil day entirely
    // near a boundary.
    const instant = opts.timeZone
      ? civilDayOffsetIn(start, d, opts.timeZone)
      : new Date(start.getTime() + d * 86400000);
    const arc = computeDayArc(instant, lat, lon, tzOffsetMin, opts.timeZone);
    const dayStartMs = new Date(arc.dayStart).getTime();
    const noonInstant = new Date(dayStartMs + 12 * 3600000);
    // Zone-aware labeling asks the REAL zone what date this is, rather than
    // reconstructing it from the numeric-offset snapshot — the same snapshot
    // that made the day boundary itself wrong near a transition. Cosmetic
    // (a mislabeled date string, not a wrong window), but free to fix once
    // the zone is already in hand.
    const dateLabel = opts.timeZone
      ? noonInstant.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: opts.timeZone })
      : new Date(dayStartMs - tzOffsetMin * 60000 + 12 * 3600000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const dow = opts.timeZone
      ? noonInstant.toLocaleDateString("en-US", { weekday: "short", timeZone: opts.timeZone })
      : new Date(dayStartMs - tzOffsetMin * 60000 + 12 * 3600000).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const jdNoon = julianDay(noonInstant);
    // Was: mercRx/ecl/rxSigs computed once at the SCAN's start date and reused
    // for every day's tier gating below — a week/month scan spanning a real
    // eclipse or a Mercury station saw it on day 0 only, so e.g. a month scan
    // crossing a total solar eclipse mid-month stamped GREAT windows straight
    // through it (audit F5). Evaluate them per-day, at this day's own jdNoon.
    const dayMercRx = isRetrograde("Mercury", jdNoon);
    const dayEcl = eclipseWindow(jdNoon);
    // NARROWED, on doctrinal advice. The old rule capped the top tier whenever
  // ANY non-luminary significator was retrograde — including an outer planet
  // holding a 0.3 weight. Measured consequence: the median activity was barred
  // from `great` for 38% of the year, because Pluto is retrograde 45% of it,
  // Neptune 43% and Uranus 40%.
  //
  // Two things were wrong with that. Bonatti's and Ramesey's caution is about
  // the planet formally SIGNIFYING THE MATTER — in a tradition that had no
  // outer planets at all, so they cannot inherit the rule written before their
  // discovery. And it is a rule about BEGINNINGS whose inception chart
  // describes how the matter unfolds; a long run does not become a worse run
  // because a secondary Saturn is retrograde.
  //
  // So: traditional planets only, and only for inceptions.
  const actMode = modeOf(act.key);
  const dayRxSigs = actMode === "inception"
    ? sigPlanets.filter(p => p !== "Sun" && p !== "Moon" &&
        TRADITIONAL_PLANETS.has(p) && isRetrograde(p, jdNoon))
    : [];
  // Stations are recorded regardless of mode — they are the strongest motion
  // statement a planet makes, and the surface should be able to say so even
  // where nothing is capped. Traditional doctrine treats the first station as
  // reversal and the second as incomplete recovery; neither is a power boost.
  const sigStations = sigPlanets
    .filter(p => TRADITIONAL_PLANETS.has(p) && p !== "Sun" && p !== "Moon")
    .map(p => ({ planet: p, motion: motionOf(p, jdNoon) }))
    .filter(x => x.motion && x.motion.phase.startsWith("stationing"));
    const moonSign = SIGNS[Math.floor(norm360(moonLongitude(jdNoon)) / 30) % 12];
    const waxing = norm360(moonLongitude(jdNoon) - sunLongitude(jdNoon)) < 180;
    // Reuses `dow` (already computed above, zone-aware when a zone is given)
    // rather than re-deriving a weekday from a separate `local` Date — one
    // computation of "what weekday is this civil day" instead of two that
    // could disagree near a transition.
    const dayRuler = WEEKDAY_RULERS[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dow)];
    const vocSpans = (arc.vocWindows ?? []).map(v => [Date.parse(v.start), Date.parse(v.end)] as [number, number]);
    const inVoc = (a: number, b: number) => vocSpans.some(([s, e]) => a < e && b > s);

    // ── Day-level GREAT signals ─────────────────────────────────────────────
    const daySources: string[] = [];
    const dayWhy: Evidence[] = [];
    let dayBoost = 1;

    const positions = getPlanetPositions(jdNoon);
    const lonOf = (p: string): number | null => {
      if (p === "Sun") return norm360(sunLongitude(jdNoon));
      if (p === "Moon") return norm360(moonLongitude(jdNoon));
      const row = positions.find(x => x.planet === p);
      return row ? SIGNS.indexOf(row.sign) * 30 + row.degree : null;
    };

    if (natal && cusps) {
      for (const p of Object.keys(act.planets)) {
        if (p === "Moon") continue; // the dedicated Moon-crossing line below covers it
        const tl = lonOf(p);
        if (tl == null) continue;
        const house = assignHouse(tl, cusps);
        if (act.houses.includes(house)) {
          daySources.push("natal-house"); dayBoost *= 1.2;
          dayWhy.push({ family: "personal", text: `${p} is moving through your ${house}${house === 1 ? "st" : house === 2 ? "nd" : house === 3 ? "rd" : "th"} — this matter's own house` });
          break;
        }
      }
      const moonHouse = assignHouse(norm360(moonLongitude(jdNoon)), cusps);
      if (act.houses.includes(moonHouse)) {
        daySources.push("natal-house"); dayBoost *= 1.15;
        dayWhy.push({ family: "personal", text: `the Moon crosses your ${moonHouse}${moonHouse === 1 ? "st" : moonHouse === 2 ? "nd" : moonHouse === 3 ? "rd" : "th"} today` });
      }
      // Transit-to-natal return: a significator softly touching its own natal place.
      for (const p of Object.keys(act.planets)) {
        // The Moon travels ~13°/day, so a noon-substituted birth time puts its
        // natal longitude up to ~6.5° out — three times the 2° orb below. Its
        // "return" would be noise wearing a decimal point.
        if (!houseTestimonyAllowed && p === "Moon") continue;
        const tl = lonOf(p); const nl = natalLonOf(p);
        if (tl == null || nl == null) continue;
        const s = sep180(tl, nl);
        const near = [0, 60, 120].find(A => Math.abs(s - A) <= 2);
        if (near != null) {
          daySources.push("natal-contact"); dayBoost *= 1.15;
          dayWhy.push({ family: "personal", text: `${p} ${near === 0 ? "conjoins" : near === 120 ? "trines" : "sextiles"} your natal ${p}` });
          break;
        }
      }
    }

    // ── Mercury tempo — Compass synthesis, not inherited doctrine ───────────
  // Recorded on every window it fits, but NOT counted toward convergence yet.
  // Adding a convergence-eligible family while the threshold is under review
  // would be a threshold change wearing a feature's clothes: October already
  // yields 214 convergent windows and we have told the reviewer we would not
  // move the bar until the hour x Moon question is settled. `MOTION_COUNTS`
  // flips it on in one place once that lands, and the harness can measure both
  // sides of the switch in the meantime.
  const MOTION_COUNTS = false;
  const actTempo = tempoOf(act.key);
  let tempoMatch: { fits: boolean; note: string } | null = null;
  if (actTempo !== "either" && Object.keys(act.planets).includes("Mercury")) {
    const mm = motionOf("Mercury", jdNoon);
    if (mm) {
      // Retrograde and slow both serve deliberate work; only genuinely swift
      // direct motion serves quick work. Stations are excluded from BOTH —
      // a planet turning is not a tempo, and the tradition reads it as
      // impeded rather than as any kind of favourable speed.
      const stationing = mm.phase.startsWith("stationing");
      if (!stationing) {
        const slowish = mm.speedBand === "slow" || mm.speedBand === "very-slow" || mm.phase === "retrograde";
        const swift = mm.phase === "direct" && mm.speedBand === "fast";
        if (actTempo === "deliberate" && slowish) {
          tempoMatch = { fits: true, note: mm.phase === "retrograde"
            ? "Mercury is retrograde — Compass reads this as suiting revision and review"
            : "Mercury is moving slowly — Compass reads this as suiting careful work" };
        } else if (actTempo === "quick" && swift) {
          tempoMatch = { fits: true, note: "Mercury is swift — Compass reads this as suiting quick exchange" };
        }
      }
    }
  }
  if (tempoMatch?.fits) {
    dayWhy.push({ family: "tempo", text: tempoMatch.note });
    if (MOTION_COUNTS) daySources.push("motion");
  }

  const sigs = Object.keys(act.planets).filter(p => p !== "Moon");
    const pair = getMajorAspects(jdNoon).find(pa =>
      (SOFT_W as any)[pa.aspect] > 0 && pa.orb <= 3 &&
      sigs.includes(pa.planet1) && sigs.includes(pa.planet2) && pa.planet1 !== pa.planet2);
    if (pair) {
      daySources.push("sky"); dayBoost *= 1.2;
      dayWhy.push({ family: "sky", text: `${pair.planet1}–${pair.planet2} ${pair.aspect} standing in the sky` });
    }
    const phaseMatch = act.phase === null ? null : (act.phase === "waxing" ? waxing : act.phase === "waning" ? !waxing : null);
    if (phaseMatch === true) { dayBoost *= 1.1; dayWhy.push({ family: "moon", text: act.phase === "waxing" ? "waxing, as this wants" : "waning, as this wants" }); }
    if (phaseMatch === false) dayBoost *= 0.9;

    const dayMatch = (act.planets[dayRuler] ?? 0) > 0;
    if (dayMatch) { dayBoost *= 1.1; dayWhy.push({ family: "day", text: `${dayRuler}'s day` }); }

    // ── Candidates ──────────────────────────────────────────────────────────
    interface Cand { startMs: number; endMs: number; score: number; why: Evidence[]; sources: string[]; allDay?: boolean }
    const cands: Cand[] = [];

    // Planetary hours (waking, matching rulers). Suppressed entirely when the
    // location is a guess — see `locationKnown`. Not merely hidden: an hour
    // computed on the wrong meridian must not create a window or count toward
    // convergence.
    //
    // ALSO suppressed under a polar day or night. getSunriseSunset invents a
    // symmetric twelve-hour day when the Sun neither rises nor sets, and
    // exposes `polar` precisely so callers can withhold — which dayTimeline,
    // longSession and synthesis all do. This file, the canonical authority
    // and the one that most loudly documents the no-fabrication rule, was the
    // one consumer that skipped the check: at a KNOWN polar location it built
    // hour candidates on the fabricated sunrise and counted them toward the
    // planetary-time family. Hours are the one family the poles genuinely
    // cannot answer; the Moon, sign and natal testimony below survive.
    const polar = getSunriseSunset(julianDay(new Date(dayStartMs + 12 * 3600000)), lat, lon).polar;
    const hours = locationKnown && !polar
      ? dayHours(dayStartMs, lat, lon).filter(h => act.hourRulers.includes(h.ruler))
      : [];
    for (const h of hours) {
      const startMs = Math.max(h.startMs, dayStartMs + 7 * 3600000);
      const endMs = Math.min(h.endMs, dayStartMs + 23 * 3600000);
      if (endMs - startMs < 30 * 60000) continue;
      cands.push({ startMs, endMs, score: 0.5, why: [{ family: "hour", text: `${h.ruler} hour` }], sources: ["hour"] });
    }

    // Moon-aspect swells
    for (const ev of scanMoonPerfections(dayStartMs)) {
      const aw = aspectW[ev.aspect] ?? 0;
      const pw = act.planets[ev.planet] ?? 0;
      if (aw === 0 || pw === 0) continue;
      const startMs = Math.max(ev.timeMs - 2.5 * 3600000, dayStartMs + 7 * 3600000);
      const endMs = Math.min(ev.timeMs + 2.5 * 3600000, dayStartMs + 23 * 3600000);
      if (endMs - startMs < 1.5 * 3600000) continue;
      const hard = ev.aspect in HARD_W;
      // APPLYING, not "exact at".
      //
      // The candidate spans exact ± 2.5h, but windows are INTERSECTED with
      // other candidates before display, so a five-hour lunar span routinely
      // narrows to under an hour — and then "exact 7:49 PM" sits under a window
      // that ends at 6:06 PM and reads as a contradiction. The number was right
      // and the phrasing asserted something false about it.
      //
      // What is true across the whole span is that the Moon is APPLYING toward
      // that moment: the aspect tightens through the window and perfects later.
      // Said that way it explains the window instead of arguing with it.
      const applying = ev.timeMs > startMs;
      const when = clockOf(ev.timeMs, tzOffsetMin);
      cands.push({
        startMs, endMs, score: aw * pw,
        // Three cases, because "exact at 7:49 PM" under a window ending 6:10 PM
        // read as a contradiction. Which one applies is a fact about this
        // window, so it is computed rather than phrased generically: the
        // aspect can perfect after the window shuts (still gathering while you
        // work), perfect inside it, or already have perfected.
        why: [{
          family: "moon",
          text: `Moon–${ev.planet} ${ev.aspect}, ${
            !applying ? `exact at ${when}`
            : ev.timeMs > endMs
              ? `reaches exactitude at ${when}, after the window closes but while the aspect is still gathering`
              : `applying toward exactitude at ${when}, inside the window`
          }${hard ? " · raw fuel" : ""}`,
        }],
        sources: ["moon"],
      });
    }

    // Sign-day affinity
    const gloss = act.signs[moonSign];
    if (gloss) cands.push({
      startMs: dayStartMs + 7 * 3600000, endMs: dayStartMs + 23 * 3600000,
      // One testimony, not a middot-join: " · " inside evidence text is the
      // joined-blur the linesUp contract forbids (tests/linesUp.test.ts).
      score: 0.45, why: [{ family: "moon", text: `Moon in ${moonSign} — ${gloss}` }], sources: ["sign"], allDay: true,
    });

    // The void: a window for void-favoring activities, a filter for avoiders
    if (act.voc === "favor") {
      for (const [s, e] of vocSpans) {
        let a = Math.max(s, dayStartMs + 7 * 3600000);
        const b = Math.min(e, dayStartMs + 23 * 3600000);
        a = Math.max(a, b - 4 * 3600000);
        if (b - a < 1.5 * 3600000) continue;
        cands.push({ startMs: a, endMs: b, score: 0.55, why: [{ family: "moon", text: "the Moon is void of course — slack water" }], sources: ["voc"] });
      }
    }

    // ── Merge overlapping hour × moon candidates → stacked GREAT ────────────
    const hoursC = cands.filter(c => c.sources.includes("hour"));
    const moons = cands.filter(c => c.sources.includes("moon"));
    for (const h of hoursC) {
      for (const m of moons) {
        const s = Math.max(h.startMs, m.startMs), e = Math.min(h.endMs, m.endMs);
        if (e - s >= 45 * 60000) {
          cands.push({ startMs: s, endMs: e, score: h.score + m.score + 0.3, why: [...m.why, ...h.why], sources: ["moon", "hour"] });
        }
      }
    }

    // A merged moon×hour row supersedes the bare hour inside it — one moment,
    // one row.
    const merged = cands.filter(c => c.sources.includes("moon") && c.sources.includes("hour"));
    const superseded = new Set(
      cands.filter(c => c.sources.length === 1 && c.sources[0] === "hour" &&
        merged.some(m => m.startMs <= c.startMs + 60000 && m.endMs >= c.endMs - 60000)));

    // ── Score, tier, emit ────────────────────────────────────────────────────
    for (const c of cands) {
      if (superseded.has(c)) continue;
      if (act.voc === "avoid" && !c.allDay && inVoc(c.startMs, c.endMs) && !c.sources.includes("voc")) continue;
      const score = c.score * dayBoost;
      // GREAT requires TWO independent signals (owner 2026-07-20: one wasn't
      // scarce enough — Venus hours recur daily and a governing house holds
      // the Moon for days). Signals: an hour×moon stack counts as one; each
      // natal firing (significator in the matter's house, Moon crossing it,
      // transit-to-natal return) and a standing sky pair count as one each.
      // Sign-affinity days stay good — they're ambient quality, not elections.
      const stacked = c.sources.includes("moon") && c.sources.includes("hour");
      const substantive = c.sources.includes("moon") || c.sources.includes("hour");
      // Count DISTINCT day-level families, not rows. `daySources.length` let
      // one broad family fire twice and clear a threshold that documents
      // itself as two independent signals.
      //
      // The hour x Moon stack still counts as ONE, deliberately, even though
      // it spans two families. That convention predates this fix (owner
      // 2026-07-20: one signal wasn't scarce enough, Venus hours recur daily)
      // and normalising it away here would silently reclassify every stacked
      // window as GREAT — a threshold change smuggled in under a bug fix.
      // Whether the stack SHOULD count as two is a calibration question, and
      // the pre-tier family histogram in tools/ exists to answer it.
      const dayFamilies = familiesOf(daySources);
      const greatSignals = (stacked ? 1 : 0) + dayFamilies.length;

      // ── TWO AXES, not one overloaded tier ────────────────────────────────
      //
      // supportLevel answers: how many independent testimonies agree?
      // suitability  answers: what is acting on that agreement worth?
      //
      // These were fused, and fusing them made the engine say something false.
      // A retrograde significator does not make the supporting testimonies
      // disappear — the Mercury hour still overlaps the Moon–Mercury aspect.
      // It changes how confidently that agreement can carry a clean beginning.
      // Collapsing it into "this is now merely good" threw away both facts and
      // told the user neither.
      //
      //   Convergent · qualified  — several factors agree, but Mercury is
      //                             retrograde: better for revision than release
      //   Convergent · defer      — strongly activated, but the primary
      //                             significator is stationing retrograde
      //
      // which is more informative than a silent demotion, and is the shape the
      // Cultivator's `minimumViable` was waiting for.
      // At least one establishing testimony must sit at the centre. Two of them
      // converge on their own; one plus two reinforcing conditions also does.
      // A pile of reinforcing conditions never does, however tall.
      const allFamilies = familiesOf([...c.sources, ...daySources]);
      // The shared rule — same function `evaluateActivityInterval` calls, so
      // the two can no longer drift apart on what "convergent" means.
      const supportLevel: SupportLevel = supportLevelFrom(allFamilies);

      // THE HOUR ALONE IS NOT A WINDOW (owner 2026-08-21).
      //
      // Measured before this: over ten activities for one week, 68 of the 100
      // windows returned carried no lunar testimony at all — a matching
      // planetary hour, sometimes with the weekday's ruler or a standing
      // condition behind it. "First draft" and "admin errands" were ten for
      // ten. The doctrine above already says the hour cannot establish
      // convergence; it was still allowed to establish the window itself,
      // so every Mercury hour of every day became a suggestion.
      //
      // The rule: for a SUBSTANTIAL act — a beginning or a piece of real
      // work — a window needs something with a time of its own that is not
      // the hour: the Moon applying to a significator, the Moon's sign, a
      // standing aspect between the significators, a natal contact. The hour
      // stays in the evidence and in the hour x Moon stack, where it sharpens
      // a window; it no longer makes one. Upkeep and recovery keep their
      // hour-only rows — a Mercury hour is exactly the right grain for
      // errands, and nobody plans a fortnight around them.
      const hourCarriesIt = !allFamilies.some(f => roleOf(f) === "establishing" || f === "lunar-condition");
      if (hourCarriesIt && SUBSTANTIAL_MODES.has(actMode)) { hourOnlyWithheld++; continue; }

      // Kept as a MODIFIER, not a promotion. The hour x Moon overlap is still
      // the thing that turns a several-hour lunar swell into a window with a
      // clean start and end, so it should decide which supported window leads —
      // just not whether the window crosses the threshold.
      const stackedHourMoon = allFamilies.includes("lunar-contact") && allFamilies.includes("planetary-time");

      // Collected first, DERIVED after — rather than mutating a variable as we
      // go. Each reason carries its own severity, so suitability is a pure
      // function of the reasons and cannot drift out of step with the list the
      // UI shows.
      const suitabilityReasons: SuitabilityReason[] = [];
      const qualify = (reason: SuitabilityReason) => suitabilityReasons.push(reason);
      const defer = (reason: SuitabilityReason) => suitabilityReasons.push(reason);

      // Motion of the traditional significators. Only inceptions inherit the
      // classical objection — see the dayRxSigs comment above — but a STATION
      // is recorded on any activity, because it is the strongest motion
      // statement a planet makes and worth naming even where nothing is held
      // back. Traditional doctrine reads the first station as reversal and the
      // second as recovery not yet complete; neither is a power boost.
      for (const st of sigStations) {
        const first = st.motion!.phase === "stationing-retrograde";
        if (actMode === "inception") {
          if (first) defer({ kind: "primary-significator-stationing-retrograde", planet: st.planet });
          else qualify({ kind: "primary-significator-stationing-direct", planet: st.planet });
        } else {
          suitabilityReasons.push({ kind: "significator-station", planet: st.planet });
        }
      }
      for (const p of dayRxSigs) {
        if (sigStations.some(st => st.planet === p)) continue;   // already spoken for
        qualify({ kind: "primary-significator-retrograde", planet: p });
      }
      if (dayMercRx && act.mercuryRx === "hard") {
        qualify({ kind: "mercury-retrograde", planet: "Mercury" });
      }

      // Eclipse and the malefic final aspect stay TIER caps rather than
      // becoming suitability: they are objections to the moment itself, not to
      // what you intend to do in it. Deliberately not replaced with a new hard
      // cap invented to preserve scarcity — scarcity should come from the
      // convergence definition, and refusal from real electional objections.
      const suitability: Suitability =
        suitabilityReasons.some(r => DEFER_REASONS.has(r.kind)) ? "defer"
        : suitabilityReasons.some(r => QUALIFY_REASONS.has(r.kind)) ? "qualified"
        : "clear";

      let tier: "good" | "great" = supportLevel === "convergent" ? "great" : "good";
      let cappedBy: CapReason | null = null;
      if (tier === "great" && dayEcl.active) { tier = "good"; cappedBy = "eclipse-window"; }
      if (tier === "great" && !c.allDay) {
        // Memoized per sign occupancy — every window in the same Moon sign
        // shares one final aspect, and the scan isn't free.
        const cJd = julianDay(new Date(c.startMs));
        const signKey = Math.floor(norm360(moonLongitude(cJd)) / 30) + ":" + Math.floor(cJd);
        if (!finalAspectMemo.has(signKey)) finalAspectMemo.set(signKey, moonFinalAspectInSign(cJd));
        const fin = finalAspectMemo.get(signKey)!;
        if (fin && (fin.aspect === "square" || fin.aspect === "opposition") && (fin.planet === "Mars" || fin.planet === "Saturn")) {
          tier = "good"; cappedBy = "malefic-final-aspect"; // the ending sours
        }
      }
      // `defer` withholds the top tier too — it is a refusal, not a caveat.
      if (tier === "great" && suitability === "defer") { tier = "good"; cappedBy ??= "significator-stationing"; }

      // Window-level personal provenance. `personalized` on the RESULT only
      // ever meant "a natal chart was available" — it said nothing about
      // whether any particular window carried personal testimony, so a wholly
      // global window sat inside a response labelled personalized. Four
      // different claims were collapsed into one boolean; these separate them.
      const families = familiesOf([...c.sources, ...daySources]);
      const personalFamilies = families.filter(f => PERSONAL_FAMILIES.has(f));
      // Would this window still be GREAT without its personal testimony? Only
      // meaningful when it IS great — otherwise there is no tier to have
      // decided.
      // Recomputed under the establishing/reinforcing rule: would this still
      // converge with the personal families removed?
      const nonPersonal = allFamilies.filter(f => !PERSONAL_FAMILIES.has(f));
      const npEst = nonPersonal.filter(f => roleOf(f) === "establishing").length;
      const npReinf = nonPersonal.filter(f => roleOf(f) === "reinforcing").length;
      const personalDecidedTier = supportLevel === "convergent" &&
        !(npEst >= 2 || (npEst >= 1 && npReinf >= 2));
      windows.push({
        date: dateLabel, dow,
        startAt: new Date(c.startMs).toISOString(), endAt: new Date(c.endMs).toISOString(),
        startClock: clockOf(c.startMs, tzOffsetMin), endClock: clockOf(c.endMs, tzOffsetMin),
        allDay: c.allDay, tier, score: parseFloat(score.toFixed(3)),
        // Joined for callers that want one line, and kept APART for the ones
        // that want to show the reasoning. Every testimony is computed
        // separately and the join was throwing that structure away — a panel
        // showing "the Moon is applying to Mercury… / Saturn's hour contains
        // the window… / your 10th house is reinforced…" is three facts a reader
        // can weigh, where the joined string is one blur they can only accept.
        why: [...c.why, ...dayWhy].map(e => e.text).join(" · "),
        evidence: [...c.why, ...dayWhy],
        sources: [...new Set([...c.sources, ...daySources])],
        families,
        personal: personalFamilies.length > 0,
        personalDecidedTier,
        cappedBy,
        supportLevel,
        establishingFamilies: allFamilies.filter(f => roleOf(f) === "establishing"),
        reinforcingFamilies: allFamilies.filter(f => roleOf(f) === "reinforcing"),
        stackedHourMoon,
        suitability,
        suitabilityReasons,
        // The whole assertion, and its whole justification: the reasons list
        // ran and came back empty. Note what this is NOT derived from — the
        // absence of aspects, orbs, or malefics anywhere in the sky. Compass
        // does not search for those exhaustively and must not imply it did.
        noObjections: suitabilityReasons.length === 0,
      });
    }
  }

  // ── Span selection ───────────────────────────────────────────────────────
  // Day: everything, chronological (it's a menu of the day). Week: top 10 by
  // score, ≤3/day. Month: best window per day, top 14 days.
  let out = windows;
  if (opts.span !== "day") {
    const perDayCap = opts.span === "week" ? 3 : 1;
    const byDay: Record<string, number> = {};
    out = [];
    for (const w of [...windows].sort((a, b) => b.score - a.score)) {
      if ((byDay[w.date] ?? 0) >= perDayCap) continue;
      byDay[w.date] = (byDay[w.date] ?? 0) + 1;
      out.push(w);
      if (out.length >= (opts.span === "week" ? 10 : 14)) break;
    }
  }
  out.sort((a, b) => a.startAt.localeCompare(b.startAt));

  return {
    activity: { key: act.key, label: act.label, gloss: act.gloss, category: act.category },
    span: opts.span,
    chartAvailable: !!natal,
    personalized: out.some(w => w.personal),
    cautions, windows: out,
    withheld: { hourOnly: hourOnlyWithheld },
  };
}
