/**
 * NATAL RESONANCE: the moment read against the nativity (plan Part A, Phase 1;
 * owner 2026-10-04: "especially resonance between transits and the natal
 * chart — those are important electional factors").
 *
 * An election for a person is two charts at once. The engine reads the moment
 * well and the nativity barely: for a haircut it asked only whether Venus or
 * the Moon was in the natal 1st, or Venus touched natal Venus, so a fortnight in
 * which the Moon returned to its own place, transiting Venus squared natal
 * Saturn and Venus (lord of the year) turned retrograde came back with no
 * personal testimony at all.
 *
 * This module is pure: it computes the natal points an election reads and the
 * contacts the sky makes with them. `electionEngine.ts` decides what those
 * contacts are worth. Every rule names the natal point it read, so a line of
 * evidence can always say which part of the chart answered.
 *
 * THE NATAL POINTS
 *   chart ruler      the Ascendant's domicile lord (traditional rulers)
 *   significators    the activity's primary planets, at their natal places
 *   lord of the year the domicile lord of the annually profected sign
 *   malefics         natal Mars and Saturn, for objections
 *   benefics         natal Venus and Jupiter
 *
 * Without a birth time the Ascendant, and with it the chart ruler, the year's
 * lord and the rising-sign rule, are fiction: those rules are withheld, the
 * same treatment house testimony already gets.
 */
import { moonLongitude, julianDay, getLocalAngles, getNatalDegreeAngles, SIGNS } from "./astro.js";
import { SIGN_RULERS, type ComputedNatalChart } from "./natal.js";
import { computeProfection } from "./currents.js";

const norm360 = (x: number) => ((x % 360) + 360) % 360;
/** Smallest angular distance, 0..180. */
const sep = (a: number, b: number) => { const d = norm360(a - b); return d > 180 ? 360 - d : d; };

/**
 * The rules, each switchable in one place. The calibration harness
 * (`tools/natal-resonance-calibration.ts`) flips these to measure each rule's
 * fire rate and what it changes; an owner ruling that a rule is not doctrine is
 * a `false` here. Not exported as `const` so the harness can toggle it.
 */
export const RESONANCE_RULES: Record<RuleId, boolean> = {
  R1: true, R2: true, R3: true, R4: true, R5: true, R6: true, R7: true, R8: true,
  O1: true, O2: true, O3: true, O4: true,
};
export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "O1" | "O2" | "O3" | "O4";

export interface NatalPoint { planet: string; lon: number }

export interface NatalFrame {
  timeKnown: boolean;
  ascLon: number | null;
  ascSign: string | null;
  chartRuler: string | null;
  /** The chart ruler's natal longitude. */
  rulerLon: number | null;
  /** The activity's primary significators at their natal places. */
  significators: NatalPoint[];
  natalMoon: number | null;
  malefics: NatalPoint[];
  benefics: NatalPoint[];
  natalLonOf: (planet: string) => number | null;
}

export function natalFrame(natal: ComputedNatalChart, sigPlanets: string[], timeKnown: boolean): NatalFrame {
  const natalLonOf = (p: string) => natal.planets.find((x) => x.planet === p)?.longitude ?? null;
  const pts = (ps: string[]) => ps.flatMap((p) => { const lon = natalLonOf(p); return lon == null ? [] : [{ planet: p, lon }]; });
  const ascLon = timeKnown ? natal.ascendant.longitude : null;
  const ascSign = ascLon == null ? null : SIGNS[Math.floor(norm360(ascLon) / 30)];
  const chartRuler = ascSign ? SIGN_RULERS[ascSign] ?? null : null;
  return {
    timeKnown, ascLon, ascSign, chartRuler,
    rulerLon: chartRuler ? natalLonOf(chartRuler) : null,
    significators: pts(sigPlanets),
    natalMoon: natalLonOf("Moon"),
    malefics: pts(["Mars", "Saturn"]),
    benefics: pts(["Venus", "Jupiter"]),
    natalLonOf,
  };
}

/** The year's lord on a given date; null without a birth time or birth date. */
export function yearLordOn(frame: NatalFrame, birthDate: string | undefined, at: Date): { lord: string; house: number } | null {
  if (!frame.ascSign || !birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const p = computeProfection(birthDate, at, frame.ascSign);
  return p.timeLord ? { lord: p.timeLord, house: p.house } : null;
}

/** "the Moon", "the Sun", "Venus": how a body is named mid-sentence. */
export const body = (p: string) => (p === "Sun" || p === "Moon" ? `the ${p}` : p);
/** "an 11th-house", "a 4th-house". */
export const article = (n: number) => (n === 8 || n === 11 || n === 18 ? "an" : "a");

/**
 * Planets whose contacts last weeks or months. A contact from one of these
 * cannot tell one window from another, so it is stated once for the span
 * (`standing`) instead of being stamped on every window inside it. Measured on
 * the owner's chart, 2026-10-04: Saturn square the natal Ascendant held all
 * fortnight and capped every top-tier haircut window.
 */
const SLOW = new Set(["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);

export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

const SOFT = [{ deg: 0, verb: "conjoins" }, { deg: 60, verb: "sextiles" }, { deg: 120, verb: "trines" }];
const HARD = [{ deg: 0, verb: "conjoins" }, { deg: 90, verb: "squares" }, { deg: 180, verb: "opposes" }];

/** Who each natal target is, in the words an evidence line uses. */
interface Target { key: string; lon: number; label: string }
function supportTargets(f: NatalFrame): Target[] {
  const out: Target[] = [];
  const seen = new Set<string>();
  const add = (key: string, lon: number | null, label: string) => { if (lon == null || seen.has(key)) return; seen.add(key); out.push({ key, lon, label }); };
  if (f.chartRuler) add(f.chartRuler, f.rulerLon, `your natal ${f.chartRuler}, which rules your Ascendant`);
  for (const s of f.significators) add(s.planet, s.lon, `your natal ${s.planet}`);
  add("ASC", f.ascLon, "your natal Ascendant");
  return out;
}

export interface DayContact {
  rule: RuleId;
  /** The transiting planet that made the contact. */
  planet: string;
  text: string;
}

/**
 * Slow contacts that hold for a day or more: R5, R6 (supports) and O1, O2
 * (objections). `lonOf` gives TRANSITING longitudes at the day's noon.
 */
export function dayContacts(f: NatalFrame, transitSigs: string[], lonOf: (p: string) => number | null): { supports: DayContact[]; objections: DayContact[]; standing: DayContact[] } {
  const supports: DayContact[] = [];
  const objections: DayContact[] = [];
  const standing: DayContact[] = [];
  const targets = supportTargets(f);
  const seen = new Set<string>();

  // R5: a transiting significator in soft aspect to the chart ruler, a natal
  // significator, or the Ascendant, within 2°. Its contact with its OWN natal
  // place is the engine's existing `natal-contact` rule and is left to it.
  if (RESONANCE_RULES.R5) for (const p of transitSigs) {
    if (p === "Moon") continue; // the Moon's contacts are timed events (R3)
    const tl = lonOf(p); if (tl == null) continue;
    for (const t of targets) {
      if (t.key === p) continue;
      const hit = SOFT.find((a) => Math.abs(sep(tl, t.lon) - a.deg) <= 2);
      if (hit && !seen.has(`${p}>${t.key}`)) { seen.add(`${p}>${t.key}`); (SLOW.has(p) ? standing : supports).push({ rule: "R5", planet: p, text: `${p} ${hit.verb} ${t.label}` }); }
    }
  }
  // R6: a benefic transiting the natal Ascendant, chart ruler or significator.
  if (RESONANCE_RULES.R6) for (const [p, orb] of [["Venus", 2], ["Jupiter", 3]] as const) {
    const tl = lonOf(p); if (tl == null) continue;
    for (const t of targets) {
      if (t.key === p) continue;
      const hit = SOFT.find((a) => Math.abs(sep(tl, t.lon) - a.deg) <= orb);
      if (hit && !seen.has(`${p}>${t.key}`)) { seen.add(`${p}>${t.key}`); (SLOW.has(p) ? standing : supports).push({ rule: "R6", planet: p, text: `${p} ${hit.verb} ${t.label}` }); }
    }
  }
  // O1: transiting Mars or Saturn in hard aspect to the chart ruler, a natal
  // significator, or the Ascendant, within 1°. Was 1.5°: Mars held it about
  // five days and it fired on 18% of chart-days in calibration (2026-10-04).
  if (RESONANCE_RULES.O1) for (const p of ["Mars", "Saturn"]) {
    const tl = lonOf(p); if (tl == null) continue;
    for (const t of targets) {
      const hit = HARD.find((a) => Math.abs(sep(tl, t.lon) - a.deg) <= 1);
      if (hit) (SLOW.has(p) ? standing : objections).push({ rule: "O1", planet: p, text: `${p} ${hit.verb} ${t.label}` });
    }
  }
  // O2: a transiting significator in hard aspect to a natal malefic, within 1°.
  if (RESONANCE_RULES.O2) for (const p of transitSigs) {
    if (p === "Moon") continue;
    const tl = lonOf(p); if (tl == null) continue;
    for (const m of f.malefics) {
      if (m.planet === p) continue;
      const hit = HARD.find((a) => Math.abs(sep(tl, m.lon) - a.deg) <= 1);
      if (hit) (SLOW.has(p) ? standing : objections).push({ rule: "O2", planet: p, text: `${p} ${hit.verb} your natal ${m.planet}` });
    }
  }
  return { supports, objections, standing };
}

export interface MoonNatalEvent {
  rule: "R3" | "R4" | "O3";
  timeMs: number;
  target: string;
  aspect: string;
  /** "the Moon trines your natal Venus" — completed with the time by the caller. */
  phrase: string;
}

const ASPECT_NOUN: Record<number, string> = { 0: "conjunction", 60: "sextile", 90: "square", 120: "trine", 180: "opposition" };

/**
 * The Moon's perfections to natal points over one span: R3 and R4 (supports)
 * and O3 (objections). Natal points do not move, so the Moon's separation from
 * one increases monotonically and every aspect is one clean crossing, found
 * on a 20-minute grid and bisected to the second.
 */
export function moonToNatal(f: NatalFrame, startMs: number, endMs: number): MoonNatalEvent[] {
  const wants: { rule: "R3" | "R4" | "O3"; target: string; lon: number; label: string; angles: number[] }[] = [];
  // R4: the Moon's return, when the Moon rules the Ascendant or the matter.
  // Needs a birth time: the natal Moon moves ~0.5° an hour.
  const moonGoverns = f.chartRuler === "Moon" || f.significators.some((s) => s.planet === "Moon");
  const returns = RESONANCE_RULES.R4 && f.timeKnown && moonGoverns && f.natalMoon != null;
  // The return IS the Moon's conjunction with its natal place; named once.
  if (RESONANCE_RULES.R3) for (const t of supportTargets(f))
    wants.push({ rule: "R3", target: t.key, lon: t.lon, label: t.label, angles: returns && t.key === "Moon" ? [60, 120, 240, 300] : [0, 60, 120, 240, 300] });
  if (returns) wants.push({ rule: "R4", target: "Moon", lon: f.natalMoon!, label: "your natal Moon", angles: [0] });
  if (RESONANCE_RULES.O3) for (const m of f.malefics)
    wants.push({ rule: "O3", target: m.planet, lon: m.lon, label: `your natal ${m.planet}`, angles: [0, 90, 180, 270] });
  if (!wants.length) return [];

  const STEP = 20 * 60000;
  const moonAt = (ms: number) => norm360(moonLongitude(julianDay(new Date(ms))));
  const out: MoonNatalEvent[] = [];
  let prevMs = startMs;
  let prevMoon = moonAt(startMs);
  for (let t = startMs + STEP; t <= endMs + STEP - 1; t += STEP) {
    const ms = Math.min(t, endMs);
    const m = moonAt(ms);
    for (const w of wants) {
      const d0 = norm360(prevMoon - w.lon), d1 = norm360(m - w.lon);
      for (const A of w.angles) {
        const crossed = d1 >= d0 ? d0 < A && A <= d1 : A > d0 || A <= d1;
        if (!crossed) continue;
        // Bisect on progress from the step start (wrap-safe, as scanMoonPerfections does).
        let lo = prevMs, hi = ms;
        const target = norm360(A - d0);
        for (let i = 0; i < 16; i++) {
          const mid = (lo + hi) / 2;
          if (norm360(norm360(moonAt(mid) - w.lon) - d0) >= target) hi = mid; else lo = mid;
        }
        const deg = A > 180 ? 360 - A : A;
        out.push({
          rule: w.rule, timeMs: Math.round(hi / 1000) * 1000, target: w.target, aspect: ASPECT_NOUN[deg],
          phrase: w.rule === "R4" ? "the Moon returns to its place in your chart"
            : `the Moon ${ASPECT_NOUN[deg] === "conjunction" ? "conjoins" : ASPECT_NOUN[deg] === "opposition" ? "opposes" : `${ASPECT_NOUN[deg]}s`} ${w.label}`,
        });
      }
    }
    prevMs = ms; prevMoon = m;
    if (ms >= endMs) break;
  }
  return out.sort((a, b) => a.timeMs - b.timeMs);
}

export interface NatalAngleHit {
  rule: "R7" | "O4";
  timeMs: number;
  planet: string;
  angle: "ASC" | "MC";
  text: string;
}

/**
 * When the local Ascendant or Midheaven sweeps a natal degree: R7 for natal
 * Venus, Jupiter and the chart ruler (support), O4 for natal Mars and Saturn
 * (objection). Each natal degree rises once and culminates once a day, so these
 * are reinforcing at most: common, and exact to the minute.
 */
/**
 * Memo for the two activity-independent day scans (angles, rising sign): a
 * week of elections for several activities asks the same chart-day each time,
 * and the angle scan steps every two minutes. Keyed by everything the answer
 * depends on, and capped so a long-running process cannot grow it.
 */
const dayMemo = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T {
  if (dayMemo.has(key)) return dayMemo.get(key) as T;
  const v = make();
  if (dayMemo.size > 256) dayMemo.clear();
  dayMemo.set(key, v);
  return v;
}
const frameKey = (f: NatalFrame) => `${f.ascLon ?? "-"}|${f.chartRuler ?? "-"}|${f.benefics.map(b => b.lon.toFixed(3)).join(",")}|${f.malefics.map(b => b.lon.toFixed(3)).join(",")}`;

export function natalOnAngles(f: NatalFrame, dayStartMs: number, lat: number, lon: number): NatalAngleHit[] {
  return memo(`ang|${frameKey(f)}|${dayStartMs}|${lat.toFixed(2)}|${lon.toFixed(2)}|${RESONANCE_RULES.R7}|${RESONANCE_RULES.O4}`, () => natalOnAnglesUncached(f, dayStartMs, lat, lon));
}
function natalOnAnglesUncached(f: NatalFrame, dayStartMs: number, lat: number, lon: number): NatalAngleHit[] {
  const sup = RESONANCE_RULES.R7 ? [...f.benefics, ...(f.chartRuler && f.rulerLon != null && !f.benefics.some((b) => b.planet === f.chartRuler) ? [{ planet: f.chartRuler, lon: f.rulerLon }] : [])] : [];
  const obj = RESONANCE_RULES.O4 ? f.malefics : [];
  if (!sup.length && !obj.length) return [];
  const events = getNatalDegreeAngles([...sup, ...obj].map((p) => ({ planet: p.planet, longitude: p.lon })), julianDay(new Date(dayStartMs)), lat, lon, 24);
  // O4 counts only the RISING of a natal malefic: with culminations too it
  // fired 3.5 times per chart-day in calibration, an objection to a large
  // share of every day's hour-sized windows.
  return events.filter((e) => e.angle === "ASC" || sup.some((x) => x.planet === e.planet)).map((e) => {
    const timeMs = Math.round(((e.jd - 2440587.5) * 86400000) / 1000) * 1000;
    const isObj = obj.some((o) => o.planet === e.planet) && !sup.some((s) => s.planet === e.planet);
    const ruler = e.planet === f.chartRuler ? ", which rules your Ascendant," : "";
    return {
      rule: isObj ? "O4" as const : "R7" as const, timeMs, planet: e.planet, angle: e.angle,
      text: `your natal ${e.planet}${ruler} ${e.angle === "ASC" ? "rises" : "culminates"}`,
    };
  });
}

/**
 * R8, narrowed: the stretches of a day when the natal Ascendant's own sign is
 * rising. The plan's wider form (same sign, sextile or trine) holds for 5 of 12
 * signs, about 40% of every day, which is a label rather than a testimony.
 */
export function ownSignRising(f: NatalFrame, dayStartMs: number, lat: number, lon: number): [number, number][] {
  if (!RESONANCE_RULES.R8 || !f.ascSign) return [];
  return memo(`rise|${f.ascSign}|${dayStartMs}|${lat.toFixed(2)}|${lon.toFixed(2)}`, () => ownSignRisingUncached(f, dayStartMs, lat, lon));
}
function ownSignRisingUncached(f: NatalFrame, dayStartMs: number, lat: number, lon: number): [number, number][] {
  const STEP = 10 * 60000;
  const spans: [number, number][] = [];
  let open: number | null = null;
  for (let t = dayStartMs; t <= dayStartMs + 24 * 3600000; t += STEP) {
    const rising = getLocalAngles(julianDay(new Date(t)), lat, lon).ascSign === f.ascSign;
    if (rising && open == null) open = t;
    if (!rising && open != null) { spans.push([open, t]); open = null; }
  }
  if (open != null) spans.push([open, dayStartMs + 24 * 3600000]);
  return spans;
}
