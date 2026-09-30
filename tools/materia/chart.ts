// Chart assembly — everything the temperament and significator layers need,
// computed once from birth data.
//
// Reuses the app's own ephemeris and dignity engine rather than re-deriving
// them: artifacts/api-server/src/lib/{natal,astro,dignity}.ts. Sect and the
// almuten are computed here because nothing in the app computed them
// correctly — the deleted blueprint route inferred sect from the Sun's house
// number, which whole-sign houses distort, and never computed an almuten at
// all.

import { computeNatalChart, type ComputedNatalChart, type NatalPlanet } from "../../artifacts/api-server/src/lib/natal";
import { julianDay, getPlanetaryHour, getSunriseSunset } from "../../artifacts/api-server/src/lib/astro";
import { essentialDignity, accidentalDignity, type EssentialDignity, type AccidentalDignity } from "../../artifacts/api-server/src/lib/dignity";
import type { HouseSystem } from "../../artifacts/api-server/src/lib/houses";
import {
  CLASSICAL_SEVEN, SIGN_RULER, SIGNS, moonQuarter, seasonOfBirth, solarPhase,
  type Classical, type Sign, type MoonQuarter, type Season, type SolarPhase,
} from "./qualities";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

export interface BirthData {
  name: string;
  date: string;        // YYYY-MM-DD, local to the birthplace
  time: string;        // HH:MM, local to the birthplace, 24h
  lat: number;         // degrees north positive
  lon: number;         // degrees east positive
  utcOffset: number;   // hours east of UTC at the birth moment, e.g. -8 for PST
  place?: string;
  timeAccuracy?: "exact" | "approximate" | "unknown";
}

// ── Aspects ──────────────────────────────────────────────────────────────────
// Ptolemaic only. The composite temperament method counts "planets aspecting
// the Ascendant / the Moon", which in every traditional formulation means the
// five Ptolemaic aspects — the minor aspects are a later addition and are not
// part of this calculation. Orbs from C_tables §4, taken at the tighter end of
// each range because a temperament factor that fires on everything measures
// nothing.
export const ASPECT_DEFS = [
  { name: "conjunction", angle: 0,   orb: 8, nature: "blending" },
  { name: "sextile",     angle: 60,  orb: 5, nature: "supportive" },
  { name: "square",      angle: 90,  orb: 7, nature: "friction-bearing" },
  { name: "trine",       angle: 120, orb: 7, nature: "supportive" },
  { name: "opposition",  angle: 180, orb: 8, nature: "polarizing" },
] as const;

export interface Aspect {
  a: string; b: string;
  name: string; nature: string;
  exactAngle: number; orb: number;
  applying: boolean | null;
}

export function findAspect(lonA: number, lonB: number): { name: string; nature: string; angle: number; orb: number } | null {
  const sep = Math.abs(norm360(lonA - lonB + 180) - 180);
  for (const d of ASPECT_DEFS) {
    const orb = Math.abs(sep - d.angle);
    if (orb <= d.orb) return { name: d.name, nature: d.nature, angle: d.angle, orb };
  }
  return null;
}

/** Every Ptolemaic aspect between the bodies given. */
export function aspectsAmong(bodies: Array<{ planet: string; longitude: number }>): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const hit = findAspect(bodies[i].longitude, bodies[j].longitude);
      if (hit) {
        out.push({
          a: bodies[i].planet, b: bodies[j].planet,
          name: hit.name, nature: hit.nature,
          exactAngle: hit.angle, orb: hit.orb, applying: null,
        });
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

/** Aspects from the classical seven to a single point (the Ascendant, say). */
export function aspectsToPoint(
  planets: NatalPlanet[], pointLon: number, only: readonly string[] = CLASSICAL_SEVEN,
): Array<{ planet: string; name: string; nature: string; orb: number }> {
  const out: Array<{ planet: string; name: string; nature: string; orb: number }> = [];
  for (const p of planets) {
    if (!only.includes(p.planet)) continue;
    const hit = findAspect(p.longitude, pointLon);
    if (hit) out.push({ planet: p.planet, name: hit.name, nature: hit.nature, orb: hit.orb });
  }
  return out.sort((a, b) => a.orb - b.orb);
}

// ── Sect ─────────────────────────────────────────────────────────────────────
// Day chart = the Sun above the horizon at birth. Computed from the Sun's
// actual altitude, not from which house it landed in: under whole-sign houses
// a Sun a few degrees above the Ascendant sits in the 12th and would be read
// as a night chart, and under any system a Sun near a cusp is a coin-flip.
// Sect drives triplicity rulership, so getting it wrong quietly re-scores
// every dignity in the chart.

/** Greenwich mean sidereal time in degrees. */
function gmst(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return norm360(
    280.46061837 + 360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T - (T * T * T) / 38710000,
  );
}

/** Mean obliquity of the ecliptic, degrees (Meeus 22.2). */
function obliquity(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return 23.439291 - 0.0130042 * T - 1.64e-7 * T * T + 5.036e-7 * T * T * T;
}

export interface Sect {
  isDay: boolean;
  sunAltitude: number;      // degrees above the horizon, negative below
  label: "day" | "night";
  /** The luminary of the sect in favour, and the malefic it tempers. */
  luminary: "Sun" | "Moon";
  benefic: "Jupiter" | "Venus";
  malefic: "Mars" | "Saturn";
  outOfSectMalefic: "Mars" | "Saturn";
}

export function computeSect(jd: number, sunLongitude: number, lat: number, lon: number): Sect {
  const eps = obliquity(jd) * DEG2RAD;
  const lam = sunLongitude * DEG2RAD;
  // Ecliptic → equatorial. The Sun's ecliptic latitude is ~0, so beta drops out.
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const lst = norm360(gmst(jd) + lon);                 // local sidereal time, degrees
  const H = norm360(lst - ra * RAD2DEG) * DEG2RAD;     // local hour angle
  const alt = Math.asin(
    Math.sin(lat * DEG2RAD) * Math.sin(dec) +
    Math.cos(lat * DEG2RAD) * Math.cos(dec) * Math.cos(H),
  ) * RAD2DEG;

  const isDay = alt > 0;
  return {
    isDay, sunAltitude: alt, label: isDay ? "day" : "night",
    luminary: isDay ? "Sun" : "Moon",
    benefic: isDay ? "Jupiter" : "Venus",
    // The in-sect malefic is the one sharing the chart's sect: Saturn by day,
    // Mars by night. It is the more tractable of the two; its opposite is the
    // one traditionally read as harder to accommodate.
    malefic: isDay ? "Saturn" : "Mars",
    outOfSectMalefic: isDay ? "Mars" : "Saturn",
  };
}

// ── Dignity across the chart ─────────────────────────────────────────────────
export interface PlanetDignity {
  planet: Classical;
  sign: Sign;
  degree: number;
  longitude: number;
  house: number;
  retrograde: boolean;
  essential: EssentialDignity;
  accidental: AccidentalDignity;
  total: number;
  /** Plain-language condition, for the report's evidence lines. */
  condition: string;
}

// The dignity engine labels its accidental factors for a scoring table, not
// for a reader — "angular(1/10)" and "cadent(6/8)" are internal identifiers.
// A report that prints them is showing its working where it should be showing
// its finding.
const ACCIDENTAL_PROSE: Record<string, string> = {
  "angular(1/10)": "angular",
  "angular/succedent(7/4/11)": "well-placed by house",
  "succedent(2/5)": "succedent",
  "cadent(9)": "cadent",
  "cadent(3)": "cadent",
  "cadent(12)": "in the 12th",
  "cadent(6/8)": "cadent",
  retrograde: "retrograde",
  combust: "combust",
  cazimi: "cazimi",
  "under the beams": "under the Sun's beams",
  slow: "slow in motion",
};

function conditionLabel(e: EssentialDignity, a: AccidentalDignity): string {
  const strong = e.dignities.filter(d => ["domicile", "exaltation", "triplicity", "term", "face"].includes(d));
  const parts: string[] = [];
  if (strong.length) parts.push(`in ${strong.join(" and ")}`);
  if (e.dignities.includes("detriment")) parts.push("in detriment");
  if (e.dignities.includes("fall")) parts.push("in fall");
  if (e.peregrine) parts.push("peregrine");

  // Only the factors a reader would care about — "direct" and "free of the
  // Sun's beams" are the unremarkable default for most planets in most charts.
  const notable = a.factors
    .filter(f => f in ACCIDENTAL_PROSE)
    .map(f => ACCIDENTAL_PROSE[f]);
  if (notable.length) parts.push(notable.join(", "));

  return parts.length ? parts.join("; ") : "without essential dignity and unremarkable by circumstance";
}

/** How strong a planet is, judged on both registers rather than the net. */
export function strengthLabel(e: EssentialDignity, a: AccidentalDignity): string {
  const essStrong = e.score >= 3, essWeak = e.score <= -4;
  const accStrong = a.score >= 8, accWeak = a.score <= 0;
  if (essStrong && accStrong) return "strong on both registers";
  if (essStrong && accWeak) return "dignified by sign but poorly circumstanced";
  if (essStrong) return "dignified by sign";
  if (essWeak && accStrong) return "essentially weak but accidentally prominent";
  if (essWeak) return "weak on both registers";
  return "middling";
}

export function chartDignities(natal: ComputedNatalChart, sect: Sect): PlanetDignity[] {
  const sun = natal.planets.find(p => p.planet === "Sun");
  return CLASSICAL_SEVEN.map((name) => {
    const p = natal.planets.find(q => q.planet === name)!;
    const essential = essentialDignity(name, p.longitude, sect.isDay);
    const accidental = accidentalDignity(name, {
      house: p.houseNumber,
      retrograde: p.retrograde,
      sunLongitude: sun?.longitude,
      longitude: p.longitude,
      isDay: sect.isDay,
    });
    return {
      planet: name, sign: p.sign as Sign, degree: p.degree, longitude: p.longitude,
      house: p.houseNumber, retrograde: p.retrograde,
      essential, accidental,
      total: essential.score + accidental.score,
      condition: conditionLabel(essential, accidental),
    };
  });
}

// ── Almuten of the Ascendant (temperament factor 11) ─────────────────────────
// "The planet of highest essential dignity at the Ascendant degree" (Part V).
// Scored on essential dignity alone at that one degree — domicile 5,
// exaltation 4, triplicity 3, term 2, face 1 — which is the classical almuten
// procedure. Ties are reported as ties rather than broken arbitrarily.
export interface Almuten {
  winners: Classical[];
  scores: Array<{ planet: Classical; score: number; dignities: string[] }>;
  tied: boolean;
}

export function almutenOf(longitude: number, isDay: boolean): Almuten {
  const scores = CLASSICAL_SEVEN.map((planet) => {
    const e = essentialDignity(planet, longitude, isDay);
    // Only the positive dignities count toward an almuten; the peregrine
    // penalty essentialDignity applies is a condition score, not a claim on
    // the degree, and would drag every non-ruler to the same floor.
    const positive = e.dignities.filter(d => ["domicile", "exaltation", "triplicity", "term", "face"].includes(d));
    const score = positive.reduce((s, d) =>
      s + ({ domicile: 5, exaltation: 4, triplicity: 3, term: 2, face: 1 } as Record<string, number>)[d], 0);
    return { planet, score, dignities: positive };
  }).sort((a, b) => b.score - a.score);

  const top = scores[0].score;
  const winners = scores.filter(s => s.score === top).map(s => s.planet);
  return { winners, scores, tied: winners.length > 1 };
}

// ── Lord of the Geniture (temperament factor 10) ─────────────────────────────
// The chart's overall strongest planet — essential plus accidental dignity.
// Lilly's procedure adds testimony weightings a machine cannot honestly
// reproduce, so this is the defensible subset: the dignity total the engine
// can actually compute, with the runner-up reported so a near-tie is visible
// rather than hidden behind a single name.
export interface LordOfGeniture {
  planet: Classical;
  total: number;
  runnerUp: { planet: Classical; total: number };
  clear: boolean;
}

export function lordOfGeniture(dignities: PlanetDignity[]): LordOfGeniture {
  const ranked = [...dignities].sort((a, b) => b.total - a.total);
  const [first, second] = ranked;
  return {
    planet: first.planet, total: first.total,
    runnerUp: { planet: second.planet, total: second.total },
    clear: first.total - second.total >= 3,
  };
}

// ── The whole assembled chart ────────────────────────────────────────────────
export interface MateriaChart {
  birth: BirthData;
  houseSystem: HouseSystem;
  jd: number;
  utcMoment: Date;
  natal: ComputedNatalChart;
  sect: Sect;
  dignities: PlanetDignity[];
  byPlanet: Record<string, PlanetDignity>;
  aspects: Aspect[];
  aspectsToAsc: Array<{ planet: string; name: string; nature: string; orb: number }>;
  aspectsToMoon: Array<{ planet: string; name: string; nature: string; orb: number }>;
  ascRuler: Classical;
  ascRulerPlacement: NatalPlanet;
  almuten: Almuten;
  lord: LordOfGeniture;
  moonQuarter: MoonQuarter;
  moonElongation: number;
  season: Season;
  ascRulerPhase: SolarPhase;
  planetsInFirst: NatalPlanet[];
  planetaryDay: string;
  planetaryHour: { ruler: string; hourNumber: number; isDayHour: boolean } | null;
  polarWarning: string | null;
}

export function buildChart(birth: BirthData, houseSystem: HouseSystem = "whole-sign"): MateriaChart {
  const [y, m, d] = birth.date.split("-").map(Number);
  const [hh, mm] = birth.time.split(":").map(Number);
  // The whole offset, not just the hour — half-hour and 45-minute zones (India,
  // Nepal, parts of Australia) are real birthplaces, and computeNatalChart's
  // own path floors the offset to whole hours. Building the UTC instant here
  // and passing a zero offset keeps those births accurate to the minute.
  const utcMs = Date.UTC(y, m - 1, d, hh, mm) - birth.utcOffset * 3600_000;
  const utcMoment = new Date(utcMs);
  const jd = julianDay(utcMoment);

  const natal = computeNatalChart(
    `${utcMoment.getUTCFullYear()}-${String(utcMoment.getUTCMonth() + 1).padStart(2, "0")}-${String(utcMoment.getUTCDate()).padStart(2, "0")}`,
    `${String(utcMoment.getUTCHours()).padStart(2, "0")}:${String(utcMoment.getUTCMinutes()).padStart(2, "0")}`,
    birth.lat, birth.lon, 0, houseSystem,
  );

  const sun = natal.planets.find(p => p.planet === "Sun")!;
  const moon = natal.planets.find(p => p.planet === "Moon")!;
  const sect = computeSect(jd, sun.longitude, birth.lat, birth.lon);
  const dignities = chartDignities(natal, sect);
  const byPlanet = Object.fromEntries(dignities.map(d => [d.planet, d])) as Record<string, PlanetDignity>;

  const classical = natal.planets.filter(p => (CLASSICAL_SEVEN as readonly string[]).includes(p.planet));
  const ascRuler = SIGN_RULER[natal.ascendant.sign as Sign];
  const ascRulerPlacement = natal.planets.find(p => p.planet === ascRuler)!;

  const moonElongation = norm360(moon.longitude - sun.longitude);

  // Planetary hour needs a real sunrise; above the polar circles the app's own
  // sunrise routine reports `polar` rather than inventing a twelve-hour day.
  // Withhold the hour there instead of scoring a fiction.
  const rise = getSunriseSunset(jd, birth.lat, birth.lon);
  let planetaryHour: MateriaChart["planetaryHour"] = null;
  let polarWarning: string | null = null;
  if (rise.polar) {
    polarWarning = `The Sun neither rose nor set on this date at ${birth.lat.toFixed(1)}° latitude (polar ${rise.polar}). The planetary hour of birth is withheld — dividing a day that has no sunrise into twelve hours would be invention. Sect is unaffected: it is computed from the Sun's actual altitude (${sect.sunAltitude.toFixed(1)}°).`;
  } else {
    const ph = getPlanetaryHour(utcMoment, birth.lat, birth.lon);
    planetaryHour = { ruler: ph.ruler, hourNumber: ph.hourNumber, isDayHour: ph.isDayHour };
  }

  // The planetary day begins at sunrise, not midnight — a birth before sunrise
  // belongs to the previous day's ruler.
  const dayIndex = utcMs < rise.sunrise.getTime()
    ? (new Date(utcMs).getUTCDay() + 6) % 7
    : new Date(utcMs).getUTCDay();
  const planetaryDay = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"][dayIndex];

  return {
    birth, houseSystem, jd, utcMoment, natal, sect, dignities, byPlanet,
    aspects: aspectsAmong(classical.map(p => ({ planet: p.planet, longitude: p.longitude }))),
    aspectsToAsc: aspectsToPoint(natal.planets, natal.ascendant.longitude),
    aspectsToMoon: aspectsToPoint(natal.planets.filter(p => p.planet !== "Moon"), moon.longitude),
    ascRuler, ascRulerPlacement,
    almuten: almutenOf(natal.ascendant.longitude, sect.isDay),
    lord: lordOfGeniture(dignities),
    moonQuarter: moonQuarter(moonElongation),
    moonElongation,
    season: seasonOfBirth(sun.longitude, birth.lat),
    ascRulerPhase: solarPhase(ascRulerPlacement.longitude, sun.longitude),
    planetsInFirst: natal.planets.filter(
      p => p.houseNumber === 1 && (CLASSICAL_SEVEN as readonly string[]).includes(p.planet),
    ),
    planetaryDay, planetaryHour, polarWarning,
  };
}

export { SIGNS };
