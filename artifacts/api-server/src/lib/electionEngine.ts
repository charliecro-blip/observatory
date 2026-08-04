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

import { ACTIVITIES, modeOf, type ActivityCorrespondence } from "./activityCorrespondences.js";
import { motionOf, TRADITIONAL_PLANETS } from "./motion.js";
import {
  julianDay, moonLongitude, sunLongitude, getPlanetaryHour, getPlanetPositions,
  getMajorAspects, isRetrograde, SIGNS, moonFinalAspectInSign, eclipseWindow,
} from "./astro.js";
import { computeDayArc } from "./dayarc.js";
import { scanMoonPerfections } from "./studioCard.js";
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
  /** Fitness for acting, held SEPARATE from agreement. */
  suitability: Suitability;
  /** Structured, so the surface can explain rather than just demote. */
  suitabilityReasons: SuitabilityReason[];
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
}

function clockOf(ms: number, tzOffsetMin: number): string {
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
  | "natal-contact";   // transit to its own natal place

const FAMILY_OF: Record<string, SourceFamily> = {
  hour: "planetary-time",
  moon: "lunar-contact",
  sign: "lunar-condition",
  voc: "lunar-condition",
  sky: "standing-sky",
  "natal-house": "natal-house",
  "natal-contact": "natal-contact",
};
const familiesOf = (srcs: string[]): SourceFamily[] =>
  [...new Set(srcs.map(x => FAMILY_OF[x]).filter(Boolean) as SourceFamily[])];
const PERSONAL_FAMILIES = new Set<SourceFamily>(["natal-house", "natal-contact"]);

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
  startAt?: Date;
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
  const sigPlanets = Object.entries(act.planets).filter(([, w]) => w >= 0.8).map(([p]) => p);
  const rxSigs = sigPlanets.filter(p => p !== "Sun" && p !== "Moon" && isRetrograde(p, startJd));
  if (rxSigs.length) cautions.push(`${rxSigs.join(" and ")} — this activity's significator${rxSigs.length > 1 ? "s are" : " is"} retrograde: doable, but expect re-work; the tradition withholds the best stamp.`);
  if (mercRx && act.mercuryRx === "hard") cautions.push("Mercury is retrograde — the tradition blocks this outright; wait for the direct station, or use the time to prepare.");
  if (mercRx && act.mercuryRx === "soft") cautions.push("Mercury is retrograde — doable, but expect revisions and follow-ups; leave slack.");
  if (mercRx && act.mercuryRx === "favor") cautions.push("Mercury is retrograde — which actually suits this: re- work runs well under it.");

  const windows: ElectionWindow[] = [];
  const finalAspectMemo = new Map<string, ReturnType<typeof moonFinalAspectInSign>>();

  for (let d = 0; d < days; d++) {
    const instant = new Date(start.getTime() + d * 86400000);
    const arc = computeDayArc(instant, lat, lon, tzOffsetMin);
    const dayStartMs = new Date(arc.dayStart).getTime();
    const local = new Date(dayStartMs - tzOffsetMin * 60000 + 12 * 3600000);
    const dateLabel = local.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const dow = local.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const jdNoon = julianDay(new Date(dayStartMs + 12 * 3600000));
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
    const dayRuler = WEEKDAY_RULERS[local.getUTCDay()];
    const vocSpans = (arc.vocWindows ?? []).map(v => [Date.parse(v.start), Date.parse(v.end)] as [number, number]);
    const inVoc = (a: number, b: number) => vocSpans.some(([s, e]) => a < e && b > s);

    // ── Day-level GREAT signals ─────────────────────────────────────────────
    const daySources: string[] = [];
    const dayWhy: string[] = [];
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
          dayWhy.push(`${p} is moving through your ${house}${house === 1 ? "st" : house === 2 ? "nd" : house === 3 ? "rd" : "th"} — this matter's own house`);
          break;
        }
      }
      const moonHouse = assignHouse(norm360(moonLongitude(jdNoon)), cusps);
      if (act.houses.includes(moonHouse)) {
        daySources.push("natal-house"); dayBoost *= 1.15;
        dayWhy.push(`the Moon crosses your ${moonHouse}${moonHouse === 1 ? "st" : moonHouse === 2 ? "nd" : moonHouse === 3 ? "rd" : "th"} today`);
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
          dayWhy.push(`${p} ${near === 0 ? "conjoins" : near === 120 ? "trines" : "sextiles"} your natal ${p}`);
          break;
        }
      }
    }

    const sigs = Object.keys(act.planets).filter(p => p !== "Moon");
    const pair = getMajorAspects(jdNoon).find(pa =>
      (SOFT_W as any)[pa.aspect] > 0 && pa.orb <= 3 &&
      sigs.includes(pa.planet1) && sigs.includes(pa.planet2) && pa.planet1 !== pa.planet2);
    if (pair) {
      daySources.push("sky"); dayBoost *= 1.2;
      dayWhy.push(`${pair.planet1}–${pair.planet2} ${pair.aspect} standing in the sky`);
    }
    const phaseMatch = act.phase === null ? null : (act.phase === "waxing" ? waxing : act.phase === "waning" ? !waxing : null);
    if (phaseMatch === true) { dayBoost *= 1.1; dayWhy.push(act.phase === "waxing" ? "waxing, as this wants" : "waning, as this wants"); }
    if (phaseMatch === false) dayBoost *= 0.9;

    const dayMatch = (act.planets[dayRuler] ?? 0) > 0;
    if (dayMatch) { dayBoost *= 1.1; dayWhy.push(`${dayRuler}'s day`); }

    // ── Candidates ──────────────────────────────────────────────────────────
    interface Cand { startMs: number; endMs: number; score: number; why: string[]; sources: string[]; allDay?: boolean }
    const cands: Cand[] = [];

    // Planetary hours (waking, matching rulers)
    const hours = dayHours(dayStartMs, lat, lon).filter(h => act.hourRulers.includes(h.ruler));
    for (const h of hours) {
      const startMs = Math.max(h.startMs, dayStartMs + 7 * 3600000);
      const endMs = Math.min(h.endMs, dayStartMs + 23 * 3600000);
      if (endMs - startMs < 30 * 60000) continue;
      cands.push({ startMs, endMs, score: 0.5, why: [`${h.ruler} hour`], sources: ["hour"] });
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
      cands.push({
        startMs, endMs, score: aw * pw,
        why: [`Moon ${ev.aspect} ${ev.planet} · exact ${clockOf(ev.timeMs, tzOffsetMin)}${hard ? " · raw fuel" : ""}`],
        sources: ["moon"],
      });
    }

    // Sign-day affinity
    const gloss = act.signs[moonSign];
    if (gloss) cands.push({
      startMs: dayStartMs + 7 * 3600000, endMs: dayStartMs + 23 * 3600000,
      score: 0.45, why: [`Moon in ${moonSign} · ${gloss}`], sources: ["sign"], allDay: true,
    });

    // The void: a window for void-favoring activities, a filter for avoiders
    if (act.voc === "favor") {
      for (const [s, e] of vocSpans) {
        let a = Math.max(s, dayStartMs + 7 * 3600000);
        const b = Math.min(e, dayStartMs + 23 * 3600000);
        a = Math.max(a, b - 4 * 3600000);
        if (b - a < 1.5 * 3600000) continue;
        cands.push({ startMs: a, endMs: b, score: 0.55, why: ["void of course · slack water"], sources: ["voc"] });
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
      const supportLevel: SupportLevel = substantive && greatSignals >= 2 ? "convergent" : "supported";

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
      const nonPersonalDayFamilies = dayFamilies.filter(f => !PERSONAL_FAMILIES.has(f));
      const personalDecidedTier = supportLevel === "convergent" &&
        (stacked ? 1 : 0) + nonPersonalDayFamilies.length < 2;
      windows.push({
        date: dateLabel, dow,
        startAt: new Date(c.startMs).toISOString(), endAt: new Date(c.endMs).toISOString(),
        startClock: clockOf(c.startMs, tzOffsetMin), endClock: clockOf(c.endMs, tzOffsetMin),
        allDay: c.allDay, tier, score: parseFloat(score.toFixed(3)),
        why: [...c.why, ...dayWhy].join(" · "),
        sources: [...new Set([...c.sources, ...daySources])],
        families,
        personal: personalFamilies.length > 0,
        personalDecidedTier,
        cappedBy,
        supportLevel,
        suitability,
        suitabilityReasons,
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
  };
}
