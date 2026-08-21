/**
 * THE CHART PROPOSES A WORKING RHYTHM (DESIGN-WORKING-RHYTHM-2026-08-21 §2,
 * §3, §7 step 2). The chart is the prior; the record is the posterior.
 *
 * Four functions, four planets, one preset each — and an overall, which is
 * the mode of the four. This is astrological interpretation stated as
 * interpretation: every line carries the literal placement first ("Mercury
 * in Sagittarius, mutable fire") and the reading after it, so a person who
 * holds the symbolism lightly can still see exactly what was read.
 *
 * Dials, not planets, are the product's schema; the planets are how the
 * proposal is explained. That is why this returns per-FUNCTION trims rather
 * than "your type".
 */
import type { ComputedNatalChart } from "./natal.js";
import { computeTransitAspects, type ComputedNatalChart as Chart } from "./natal.js";
import { julianDay } from "./astro.js";
import { motionOf } from "./motion.js";

export type Rhythm = "tide" | "campaign" | "route" | "field";
export type Modality = "cardinal" | "fixed" | "mutable";
export type Element = "fire" | "earth" | "air" | "water";

const MODALITY: Record<string, Modality> = {
  Aries: "cardinal", Cancer: "cardinal", Libra: "cardinal", Capricorn: "cardinal",
  Taurus: "fixed", Leo: "fixed", Scorpio: "fixed", Aquarius: "fixed",
  Gemini: "mutable", Virgo: "mutable", Sagittarius: "mutable", Pisces: "mutable",
};
const ELEMENT: Record<string, Element> = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

const BY_MODALITY: Record<Modality, Rhythm> = { cardinal: "campaign", fixed: "route", mutable: "field" };
const BY_ELEMENT: Record<Element, Rhythm> = { fire: "campaign", earth: "route", air: "field", water: "tide" };

export interface FunctionProposal {
  key: "planning" | "action" | "recovery" | "commitment";
  label: string;
  planet: string;
  sign: string;
  modality: Modality;
  element: Element;
  trim: Rhythm;
  /** The placement, literally. */
  literal: string;
  /** One line of reading behind it. */
  reading: string;
}

export interface RhythmProposal {
  overall: Rhythm;
  /** The Sun's element — the payoff language, not a structure. */
  element: Element;
  functions: FunctionProposal[];
}

const READING: Record<FunctionProposal["key"], Record<Rhythm, string>> = {
  planning: {
    campaign: "planning wants a target and a start date",
    route: "planning wants a sequence it can repeat",
    field: "planning wants options held open until late",
    tide: "planning enters through meaning before structure",
  },
  action: {
    campaign: "effort comes in pushes, with a finish line",
    route: "effort comes in long, even blocks",
    field: "effort alternates, and variety keeps it going",
    tide: "effort follows pull, and wants protecting once it starts",
  },
  recovery: {
    campaign: "rest comes through motion",
    route: "rest comes through the familiar",
    field: "rest comes through exchange and change",
    tide: "rest comes through withdrawal",
  },
  commitment: {
    campaign: "a hard target, then permission to drop it",
    route: "what was said holds",
    field: "the intention holds while the hour can move",
    tide: "a commitment holds when it feels right, and slips when it doesn't",
  },
};

function trimFor(key: FunctionProposal["key"], sign: string): Rhythm {
  const m = MODALITY[sign], e = ELEMENT[sign];
  if (key === "recovery") return BY_ELEMENT[e];
  // Water placements enter through meaning whichever their modality.
  if (e === "water") return "tide";
  return BY_MODALITY[m];
}

export function proposeRhythm(natal: ComputedNatalChart): RhythmProposal | null {
  const find = (p: string) => natal.planets.find(x => x.planet === p);
  const spec: { key: FunctionProposal["key"]; label: string; planet: string }[] = [
    { key: "planning", label: "Planning", planet: "Mercury" },
    { key: "action", label: "Action", planet: "Mars" },
    { key: "recovery", label: "Recovery", planet: "Moon" },
    { key: "commitment", label: "Commitment", planet: "Saturn" },
  ];
  const functions: FunctionProposal[] = [];
  for (const s of spec) {
    const p = find(s.planet);
    if (!p || !MODALITY[p.sign]) return null;
    const trim = trimFor(s.key, p.sign);
    functions.push({
      key: s.key, label: s.label, planet: s.planet, sign: p.sign,
      modality: MODALITY[p.sign], element: ELEMENT[p.sign], trim,
      literal: `${s.planet} in ${p.sign} (${MODALITY[p.sign]} ${ELEMENT[p.sign]})`,
      reading: READING[s.key][trim],
    });
  }
  const sun = find("Sun");
  const counts = new Map<Rhythm, number>();
  for (const f of functions) counts.set(f.trim, (counts.get(f.trim) ?? 0) + 1);
  // Ties go to planning — the Plan page is the first surface a rhythm shapes.
  let overall: Rhythm = functions[0].trim, best = 0;
  for (const f of functions) {
    const n = counts.get(f.trim) ?? 0;
    if (n > best) { best = n; overall = f.trim; }
  }
  return { overall, element: sun ? ELEMENT[sun.sign] ?? "water" : "water", functions };
}

/**
 * A GEAR CHANGE — a transit lighting one working style, offered as an
 * invitation, never applied. Priority is fixed and documented: the faster,
 * nearer thing first.
 */
export interface Gear {
  rhythm: Rhythm;
  literal: string;
  reading: string;
  /** ISO date the condition is expected to have passed (orb opened, or
   *  Mercury direct). */
  until: string;
  /**
   * THE MECHANISM, on request (owner 2026-08-21: "options for more info").
   * What the transit is, the rule that fired and its orb, how the end date
   * was found, and the interpretation's provenance — Compass synthesis,
   * said as such. Facts first, reading after, as everywhere else.
   */
  detail: string[];
}

const HARD = new Set(["Conjunction", "Square", "Opposition"]);
const GEAR_RULES: { transit: string; natal: Set<string>; orb: number; rhythm: Rhythm; reading: string; why: string }[] = [
  { transit: "Mars", natal: new Set(["Mars", "Sun", "Ascendant"]), orb: 3, rhythm: "campaign",
    reading: "your action gear is louder than usual; shorter pushes and tighter decisions tend to suit it",
    why: "Mars transits to the Sun, Mars or Ascendant are read in the tradition as a rise in drive and friction. Compass pairs that with Campaign because one clear move gives the drive a target and keeps decisions short." },
  { transit: "Saturn", natal: new Set(["Sun", "Moon", "Mercury", "Ascendant"]), orb: 3, rhythm: "route",
    reading: "a consolidating stretch; protecting the route tends to suit it",
    why: "Saturn transits to the Sun, Moon, Mercury or Ascendant are read as seasons of pruning and consolidation. Compass pairs that with Route because protecting what you already keep tends to hold up better than re-planning under it." },
  { transit: "Neptune", natal: new Set(["Sun", "Moon", "Mercury"]), orb: 2, rhythm: "tide",
    reading: "a foggy stretch for decisions; reading the day before committing tends to suit it",
    why: "Neptune transits to the Sun, Moon or Mercury are read as a loss of edge in judgment. Compass pairs that with Tide because reading the day before committing builds a pause in." },
  { transit: "Uranus", natal: new Set(["Mercury", "Sun", "Ascendant"]), orb: 2, rhythm: "field",
    reading: "plans want to move; keeping options open tends to suit it",
    why: "Uranus transits to Mercury, the Sun or Ascendant are read as sudden changes of plan. Compass pairs that with Field because a plan held as options costs less to change." },
];

export function currentGear(natal: Chart, now = new Date()): Gear | null {
  const transits = computeTransitAspects(natal, now, 40) as any[];
  for (const rule of GEAR_RULES) {
    const hit = transits.find(t => t.transitPlanet === rule.transit && rule.natal.has(t.natalPlanet) && HARD.has(t.aspect) && Number(t.orb) <= rule.orb);
    if (!hit) continue;
    // Walk forward a day at a time until the same aspect has opened past orb.
    let until = new Date(now.getTime() + 86400000);
    for (let d = 1; d <= 60; d++) {
      const at = new Date(now.getTime() + d * 86400000);
      const still = (computeTransitAspects(natal, at, 40) as any[])
        .some(t => t.transitPlanet === rule.transit && t.natalPlanet === hit.natalPlanet && t.aspect === hit.aspect && Number(t.orb) <= rule.orb);
      until = at;
      if (!still) break;
    }
    const untilStr = until.toISOString().slice(0, 10);
    return {
      rhythm: rule.rhythm,
      literal: `${hit.transitPlanet} ${String(hit.aspect).toLowerCase()} your ${hit.natalPlanet} · ${Number(hit.orb).toFixed(1)}°`,
      reading: rule.reading,
      until: untilStr,
      detail: [
        `Transiting ${hit.transitPlanet} is ${Number(hit.orb).toFixed(1)}° from a ${String(hit.aspect).toLowerCase()} to your natal ${hit.natalPlanet}. Compass offers a gear change when a hard aspect from ${hit.transitPlanet} is within ${rule.orb}°.`,
        `The end date is where that orb opens past ${rule.orb}° again, checked a day at a time: about ${untilStr}. A retrograde can bring it back; if it does, the offer returns.`,
        rule.why,
        "The transit-to-rhythm pairing is Compass's own reading, while the aspect and the dates are measured.",
      ],
    };
  }
  // Mercury retrograde: keep options open and capture before deciding.
  const mm = motionOf("Mercury", julianDay(now));
  if (mm && mm.phase === "retrograde") {
    let until = new Date(now.getTime() + 86400000);
    for (let d = 1; d <= 30; d++) {
      const at = new Date(now.getTime() + d * 86400000);
      until = at;
      const m = motionOf("Mercury", julianDay(at));
      if (!m || m.phase !== "retrograde") break;
    }
    const untilStr = until.toISOString().slice(0, 10);
    return {
      rhythm: "field", literal: "Mercury retrograde",
      reading: "plans get revised under it; keeping options open and capturing before deciding tends to suit it",
      until: untilStr,
      detail: [
        "Mercury is moving retrograde, apparently backward against the stars, which the tradition reads as a season of revision and re-sending rather than clean starts.",
        `The end date is the station, where it turns direct: about ${untilStr}.`,
        "Compass pairs it with Field because a plan held as options costs less to change; that pairing is Compass's own reading, while the motion and the date are measured.",
      ],
    };
  }
  return null;
}
