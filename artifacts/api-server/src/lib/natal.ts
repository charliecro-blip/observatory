/**
 * Natal chart calculations — Ascendant, MC, Whole Sign houses,
 * transit aspects, and health insights.
 */

import { julianDay, getPlanetPositions, lunarNodes, getAsteroids, sunLongitude, moonLongitude } from "./astro.js";
import { computeCusps, assignHouse, type HouseSystem } from "./houses.js";
import { an } from "./article.js";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function longitudeToSign(deg: number): { sign: string; degree: number } {
  const index = Math.floor(normalize360(deg) / 30) % 12;
  return { sign: SIGNS[index], degree: normalize360(deg) % 30 };
}

function signIndex(sign: string): number {
  return SIGNS.indexOf(sign);
}

// ── GMST / ASC / MC ────────────────────────────────────────────────────────────

function computeGMST(jd: number): number {
  // Greenwich Mean Sidereal Time in degrees (Meeus Ch. 12)
  const T = (jd - 2451545.0) / 36525;
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return normalize360(gmst);
}

function computeObliquity(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return 23.439291111 - 0.013004167 * T - 0.0000001639 * T * T + 0.0000005036 * T * T * T;
}

function computeRAMC(jd: number, lonDeg: number): number {
  return normalize360(computeGMST(jd) + lonDeg);
}

function computeMC(ramc: number, eps: number): number {
  // Robust form: sin/cos of RAMC (not tan) preserves the quadrant.
  // The tan() form silently returns MC±180° for RAMC in (90°, 270°).
  const ramcRad = ramc * DEG2RAD;
  const epsRad = eps * DEG2RAD;
  const mc = Math.atan2(Math.sin(ramcRad), Math.cos(ramcRad) * Math.cos(epsRad)) * RAD2DEG;
  return normalize360(mc);
}

function computeASC(ramc: number, eps: number, lat: number): number {
  const ramcRad = ramc * DEG2RAD;
  const epsRad = eps * DEG2RAD;
  const latRad = lat * DEG2RAD;
  const numerator = -Math.cos(ramcRad);
  const denominator = Math.sin(epsRad) * Math.tan(latRad) + Math.cos(epsRad) * Math.sin(ramcRad);
  // atan2(-cos, denom) gives the Descendant; add 180° to obtain the true Ascendant.
  const asc = Math.atan2(numerator, denominator) * RAD2DEG + 180;
  return normalize360(asc);
}

// ── Natal chart computation ────────────────────────────────────────────────────

export interface NatalPlanet {
  planet: string;
  sign: string;
  degree: number;
  retrograde: boolean;
  longitude: number;
  houseNumber: number;
}

export interface HouseData {
  number: number;
  sign: string;
  cuspDegree: number;
  planets: string[];
}

export interface ComputedNatalChart {
  ascendant: { sign: string; degree: number; longitude: number };
  midheaven: { sign: string; degree: number; longitude: number };
  planets: NatalPlanet[];
  houses: HouseData[];
}

export function computeNatalChart(
  birthDate: string,
  birthTime: string,
  birthLat: number,
  birthLon: number,
  utcOffset: number,
  houseSystem: HouseSystem = "regiomontanus",
): ComputedNatalChart {
  // Build UTC datetime
  // UTC offset only shifts the hour; minutes remain the same.
  const [year, month, day] = birthDate.split("-").map(Number);
  const [hour, minute] = birthTime.split(":").map(Number);
  const utcHour = hour - utcOffset; // may overflow 24 — Date.UTC handles that automatically
  const birthDateUTC = new Date(Date.UTC(year, month - 1, day, Math.floor(utcHour), minute));

  const jd = julianDay(birthDateUTC);
  const eps = computeObliquity(jd);
  const ramc = computeRAMC(jd, birthLon);

  const ascLon = computeASC(ramc, eps, birthLat);
  const mcLon = computeMC(ramc, eps);

  const ascSign = longitudeToSign(ascLon);
  const mcSign = longitudeToSign(mcLon);

  // House cusps for the requested system
  const cuspLongitudes = computeCusps(houseSystem, { ascLon, mcLon, ramc, eps, lat: birthLat });

  const houses: HouseData[] = cuspLongitudes.map((cuspLon, h) => ({
    number: h + 1,
    sign: longitudeToSign(cuspLon).sign,
    cuspDegree: cuspLon,
    planets: [],
  }));

  // Compute natal planet positions
  const rawPlanets = getPlanetPositions(jd);
  const natalPlanets: NatalPlanet[] = rawPlanets.map((p) => {
    const lonFull = (SIGNS.indexOf(p.sign) * 30) + p.degree;
    const houseNumber = assignHouse(lonFull, cuspLongitudes);
    return {
      planet: p.planet,
      sign: p.sign,
      degree: p.degree,
      retrograde: p.retrograde,
      longitude: lonFull,
      houseNumber,
    };
  });

  // Lunar nodes — the eclipse/karmic axis, a core natal placement (☊ / ☋).
  const nodes = lunarNodes(jd);
  for (const [name, n] of [["North Node", nodes.north], ["South Node", nodes.south]] as const) {
    natalPlanets.push({
      planet: name, sign: n.sign, degree: n.degree, retrograde: true,
      longitude: n.longitude, houseNumber: assignHouse(n.longitude, cuspLongitudes),
    });
  }

  // Asteroid goddesses — first-class natal placements now (Ceres/Pallas/Juno/
  // Vesta): they get a house, land in the chart wheel, and can be aspected.
  for (const a of getAsteroids(jd)) {
    natalPlanets.push({
      planet: a.planet, sign: a.sign, degree: a.degree, retrograde: a.retrograde,
      longitude: a.longitude, houseNumber: assignHouse(a.longitude, cuspLongitudes),
    });
  }

  // Populate house planet lists
  for (const planet of natalPlanets) {
    houses[planet.houseNumber - 1].planets.push(planet.planet);
  }

  return {
    ascendant: { sign: ascSign.sign, degree: ascSign.degree, longitude: ascLon },
    midheaven: { sign: mcSign.sign, degree: mcSign.degree, longitude: mcLon },
    planets: natalPlanets,
    houses,
  };
}

// ── Transit aspects ────────────────────────────────────────────────────────────

const ASPECTS = [
  { name: "Conjunction", angle: 0, orb: 8 },
  { name: "Sextile", angle: 60, orb: 6 },
  { name: "Square", angle: 90, orb: 7 },
  { name: "Trine", angle: 120, orb: 8 },
  { name: "Opposition", angle: 180, orb: 8 },
] as const;

function angularDiff(a: number, b: number): number {
  const diff = Math.abs((a - b + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

function findAspect(lon1: number, lon2: number): { name: string; orb: number } | null {
  const diff = angularDiff(lon1, lon2);
  for (const asp of ASPECTS) {
    const orb = Math.abs(diff - asp.angle);
    if (orb <= asp.orb) return { name: asp.name, orb: Math.round(orb * 10) / 10 };
  }
  return null;
}

// A transit's reading: what it is, where it lands, and what that contact
// tends to be like. Rewritten 2026-10-03 (owner-approved): the health tracker
// these came from told people to track digestion, energy dips and "stress-
// related symptoms", and closed most notes with an instruction. CLAUDE.md:
// describe conditions, never promise outcomes. One fact sentence, one meaning
// sentence, no instructions.
const HOUSE_THEME: Record<number, string> = {
  1: "self and how you show up", 2: "money and what you value", 3: "conversations and nearby ties",
  4: "home and roots", 5: "play, romance and making things", 6: "routines and daily work",
  7: "partners", 8: "shared resources and intimacy", 9: "study, travel and belief",
  10: "work and reputation", 11: "friends and groups", 12: "rest and what stays hidden",
};
const ASPECT_VERB: Record<string, string> = {
  Conjunction: "joins", Opposition: "opposes", Square: "squares", Trine: "trines", Sextile: "sextiles",
};
const ordinalOf = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

const TRANSIT_MEANING: Record<string, { stress: string; flow: string; conjunct: string }> = {
  Saturn: {
    stress: "Saturn under tension tends to bring limits and slow progress, a stretch where pacing usually holds up better than force.",
    flow: "Saturn in an easy aspect tends to bring steadiness, which suits commitments that need patience to take hold.",
    conjunct: "Saturn here concentrates responsibility and structure, often a season of sustained effort in this part of life.",
  },
  Mars: {
    stress: "Mars under tension tends to bring heat, with short tempers, haste and friction around effort.",
    flow: "Mars in an easy aspect tends to bring drive and a readier willingness to act.",
    conjunct: "Mars here tends to raise urgency and energy, which runs hot when it has nowhere to go.",
  },
  Jupiter: {
    stress: "Jupiter under tension tends toward too much: overcommitting, overspending, or promising more than the time allows.",
    flow: "Jupiter in an easy aspect tends to bring room and generosity, a stretch where more feels possible.",
    conjunct: "Jupiter here tends to enlarge whatever it touches, including the appetite to take on more.",
  },
  Neptune: {
    stress: "Neptune under tension tends to blur edges, so plans, signals and motives can be harder to read than usual.",
    flow: "Neptune in an easy aspect tends to soften things, which suits imagination, rest and receptivity.",
    conjunct: "Neptune here is slow and subtle, and what it changes often only shows over weeks.",
  },
  Pluto: {
    stress: "Pluto under tension brings slow, deep pressure to let go of something or remake it in this part of life.",
    flow: "Pluto in an easy aspect tends toward quiet, lasting change that builds without much noise.",
    conjunct: "Pluto here marks a long, fundamental change in how this part of life works.",
  },
  Uranus: {
    stress: "Uranus under tension tends to bring sudden changes and restlessness, with routines harder to hold.",
    flow: "Uranus in an easy aspect makes breaking an old pattern feel natural rather than forced.",
    conjunct: "Uranus here tends to shake up routine, and what changes is often what had gone stale.",
  },
  Moon: {
    stress: "The Moon's contact lasts a few hours, and under tension it tends to bring a passing mood or friction.",
    flow: "The Moon's contact lasts a few hours, and an easy one tends to bring a passing ease in mood and company.",
    conjunct: "The Moon's contact lasts a few hours, during which this part of life sits closer to the surface.",
  },
  Sun: {
    stress: "The Sun's yearly pass here can pull current demands against what this placement needs.",
    flow: "The Sun's yearly pass here tends to line current focus up with what this placement wants.",
    conjunct: "The Sun's yearly pass puts this placement in the spotlight for a few days.",
  },
  Mercury: {
    stress: "Mercury under tension tends to scatter attention and make conversations and plans more effortful.",
    flow: "Mercury in an easy aspect tends to make thinking, talking and planning come more easily.",
    conjunct: "Mercury here brings more thinking and talk about this part of life for a few days.",
  },
  Venus: {
    stress: "Venus under tension tends to bring friction around relationships, money, or what you value.",
    flow: "Venus in an easy aspect tends to bring ease, pleasure and warmth with other people.",
    conjunct: "Venus here tends to bring harmony and company to this part of life.",
  },
};

export function buildTransitNote(
  transitPlanet: string,
  natalPlanet: string,
  aspect: string,
  natalHouse: number,
): string {
  const isStress = aspect === "Square" || aspect === "Opposition";
  const isConjunct = aspect === "Conjunction";
  const lead = transitPlanet === "Sun" || transitPlanet === "Moon" ? `The ${transitPlanet}` : transitPlanet;
  const verb = ASPECT_VERB[aspect] ?? `forms ${aspect.toLowerCase()} to`;
  const theme = HOUSE_THEME[natalHouse];
  const fact = `${lead} ${verb} your natal ${natalPlanet} in your ${ordinalOf(natalHouse)} house${theme ? ` (${theme})` : ""}.`;
  const m = TRANSIT_MEANING[transitPlanet];
  const meaning = m ? (isConjunct ? m.conjunct : isStress ? m.stress : m.flow)
    : "Its themes are most active while the aspect is within orb.";
  return `${fact} ${meaning}`;
}

// ── Transit scoring ────────────────────────────────────────────────────────────

const PLANET_WEIGHT: Record<string, number> = {
  Moon: 1, Mercury: 1, Venus: 1, Sun: 2, Mars: 3,
  Jupiter: 2, Saturn: 4, Uranus: 4, Neptune: 4, Pluto: 5,
};

const ASPECT_WEIGHT: Record<string, number> = {
  Conjunction: 5, Opposition: 4, Square: 3, Trine: 2, Sextile: 1,
};

const NATAL_SENSITIVITY: Record<string, number> = {
  Ascendant: 4, Moon: 4, Sun: 3, Mars: 3, Saturn: 3,
  MC: 2, Venus: 2, Mercury: 2, Jupiter: 2,
  Uranus: 1, Neptune: 1, Pluto: 1,
};

const MEDICAL_HOUSE_BONUS: Record<number, number> = {
  1: 3, 2: 2, 6: 4, 8: 3, 10: 2,
};

function orbPoints(orb: number): number {
  if (orb <= 1) return 4;
  if (orb <= 2) return 3;
  if (orb <= 3) return 2;
  if (orb <= 5) return 1;
  return 0;
}

function inferDomains(
  transitPlanet: string,
  natalPlanet: string,
  natalHouse: number,
): string[] {
  const domains = new Set<string>();

  // Life conditions, not symptoms (owner 2026-09-30, density audit W16). The
  // tables came from the retired health tracker and printed "fatigue, joint/
  // structural stress" and "nervous system" as what a transit is "often felt
  // around", which predicts the body. CLAUDE.md: describe conditions, never
  // promise outcomes.
  const byTransit: Record<string, string[]> = {
    Moon:    ["moods", "sleep", "home life"],
    Mercury: ["attention", "conversations", "plans and paperwork"],
    Venus:   ["pleasure", "relationships", "money"],
    Sun:     ["energy", "confidence"],
    Mars:    ["drive", "friction", "physical effort"],
    Jupiter: ["appetite for more", "opportunities", "overreach"],
    Saturn:  ["limits", "commitments", "endurance"],
    Uranus:  ["routines", "restlessness", "sudden changes"],
    Neptune: ["rest", "sensitivity", "blurred edges"],
    Pluto:   ["intensity", "control", "letting go"],
  };

  const byNatal: Record<string, string[]> = {
    Moon:      ["moods", "home life"],
    Sun:       ["sense of direction"],
    Mars:      ["anger", "competition"],
    Mercury:   ["how you think and talk"],
    Venus:     ["relationships", "comfort"],
    Jupiter:   ["optimism", "excess"],
    Saturn:    ["structure", "responsibility"],
    Ascendant: ["how you show up"],
  };

  const byHouse: Record<number, string[]> = {
    1: ["how you show up"],
    2: ["money", "what you value"],
    6: ["routines", "daily workload"],
    8: ["shared resources", "intensity"],
    10: ["work", "reputation"],
  };

  for (const d of byTransit[transitPlanet] ?? []) domains.add(d);
  for (const d of byNatal[natalPlanet] ?? []) domains.add(d);
  for (const d of byHouse[natalHouse] ?? []) domains.add(d);

  // The Set only catches exact duplicates — "deep fatigue" (transit list) and
  // "fatigue" (natal list) both survived it and read as a repeat. Drop any
  // domain that's a sub-phrase of one already kept.
  const deduped: string[] = [];
  for (const d of domains) {
    const overlaps = deduped.findIndex((kept) => kept.includes(d) || d.includes(kept));
    if (overlaps === -1) deduped.push(d);
    else if (d.length > deduped[overlaps].length) deduped[overlaps] = d; // keep the more specific phrase
  }

  return deduped.slice(0, 5);
}

function scoreTransit(
  transitPlanet: string,
  natalPlanet: string,
  aspect: string,
  orb: number,
  natalHouse: number,
  chartRuler: string,
  sixthRuler: string,
): { score: number; severity: "mild" | "moderate" | "strong" | "major" } {
  const planetW = PLANET_WEIGHT[transitPlanet] ?? 1;
  const aspectW = ASPECT_WEIGHT[aspect] ?? 1;
  const orbW = orbPoints(orb);

  // Natal point sensitivity — chart ruler and 6th ruler elevate to 4
  let natalSens = NATAL_SENSITIVITY[natalPlanet] ?? 1;
  if (natalPlanet === chartRuler || natalPlanet === sixthRuler) natalSens = Math.max(natalSens, 4);

  const houseBonus = MEDICAL_HOUSE_BONUS[natalHouse] ?? 0;

  const score = planetW + aspectW + orbW + natalSens + houseBonus;

  const severity: "mild" | "moderate" | "strong" | "major" =
    score >= 17 ? "major" :
    score >= 13 ? "strong" :
    score >= 8  ? "moderate" : "mild";

  return { score, severity };
}

export interface TransitAspect {
  transitPlanet: string;
  transitSign: string;
  natalPlanet: string;
  natalSign: string;
  natalHouse: number;
  aspect: string;
  orb: number;
  healthNote: string;
  exact: boolean;
  score: number;
  severity: "mild" | "moderate" | "strong" | "major";
  likelyDomains: string[];
}

export function computeTransitAspects(natal: ComputedNatalChart, at?: Date, limit = 20): TransitAspect[] {
  const now = at ?? new Date();
  const jd = julianDay(now);
  const currentPlanets = getPlanetPositions(jd);

  // Derive chart ruler and 6th house ruler for sensitivity bonuses
  const chartRuler = SIGN_RULERS[natal.ascendant.sign] ?? "";
  const sixthRuler = SIGN_RULERS[natal.houses[5].sign] ?? "";

  const transitAspects: TransitAspect[] = [];

  for (const transit of currentPlanets) {
    const transitLon = (SIGNS.indexOf(transit.sign) * 30) + transit.degree;

    // Check aspects to natal planets
    for (const natal_p of natal.planets) {
      const asp = findAspect(transitLon, natal_p.longitude);
      if (!asp) continue;
      const { score, severity } = scoreTransit(
        transit.planet, natal_p.planet, asp.name, asp.orb,
        natal_p.houseNumber, chartRuler, sixthRuler,
      );
      transitAspects.push({
        transitPlanet: transit.planet,
        transitSign: transit.sign,
        natalPlanet: natal_p.planet,
        natalSign: natal_p.sign,
        natalHouse: natal_p.houseNumber,
        aspect: asp.name,
        orb: asp.orb,
        healthNote: buildTransitNote(transit.planet, natal_p.planet, asp.name, natal_p.houseNumber),
        exact: asp.orb <= 1,
        score,
        severity,
        likelyDomains: inferDomains(transit.planet, natal_p.planet, natal_p.houseNumber),
      });
    }

    // Check aspect to ASC
    const ascLon = natal.ascendant.longitude;
    const ascAsp = findAspect(transitLon, ascLon);
    if (ascAsp) {
      const { score, severity } = scoreTransit(
        transit.planet, "Ascendant", ascAsp.name, ascAsp.orb, 1, chartRuler, sixthRuler,
      );
      transitAspects.push({
        transitPlanet: transit.planet,
        transitSign: transit.sign,
        natalPlanet: "Ascendant",
        natalSign: natal.ascendant.sign,
        natalHouse: 1,
        aspect: ascAsp.name,
        orb: ascAsp.orb,
        healthNote: buildTransitNote(transit.planet, "Ascendant", ascAsp.name, 1),
        exact: ascAsp.orb <= 1,
        score,
        severity,
        likelyDomains: inferDomains(transit.planet, "Ascendant", 1),
      });
    }
  }

  // Sort by score descending — most astrologically significant first
  return transitAspects
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export interface TransitForecastItem {
  transitPlanet: string;
  transitSign: string;
  natalPlanet: string;
  natalSign: string;
  natalHouse: number | null;
  aspect: string;
  orb: number;          // tightest orb reached within the window
  exact: boolean;       // does it perfect (orb ≤ 1°) inside the window
  score: number;
  severity: string;
  likelyDomains: string[];
  peakDate: string;     // ISO — the day it's tightest
  dayOffset: number;    // days from today to the peak
}

/**
 * Scan the next `days` and return each transit-to-natal aspect that gets tight
 * within the window, dated to the day it peaks. The Moon is skipped (it makes
 * dozens of passes a month — noise for a forecast). Slow transits already in
 * orb are surfaced at their tightest day in-window. This is "your transits for
 * the weeks ahead" — a dated list, not just today's snapshot.
 */
export function computeTransitForecast(natal: ComputedNatalChart, days = 30): TransitForecastItem[] {
  const byKey = new Map<string, { a: TransitAspect; orb: number; dayOffset: number; date: Date }>();
  const start = Date.now();
  for (let d = 0; d <= days; d++) {
    const date = new Date(start + d * 86400000);
    date.setUTCHours(12, 0, 0, 0);
    for (const a of computeTransitAspects(natal, date, Number.POSITIVE_INFINITY)) {
      if (a.transitPlanet === "Moon") continue;
      const key = `${a.transitPlanet}|${a.aspect}|${a.natalPlanet}`;
      const prev = byKey.get(key);
      if (!prev || a.orb < prev.orb) byKey.set(key, { a, orb: a.orb, dayOffset: d, date });
    }
  }
  const out: TransitForecastItem[] = [];
  for (const { a, orb, dayOffset, date } of byKey.values()) {
    if (orb > 2.5) continue; // only surface transits that actually get tight in-window
    out.push({
      transitPlanet: a.transitPlanet,
      transitSign: a.transitSign,
      natalPlanet: a.natalPlanet,
      natalSign: a.natalSign,
      natalHouse: a.natalHouse,
      aspect: a.aspect,
      orb: parseFloat(orb.toFixed(2)),
      exact: orb <= 1,
      score: a.score,
      severity: a.severity,
      likelyDomains: a.likelyDomains,
      peakDate: date.toISOString(),
      dayOffset,
    });
  }
  return out.sort((x, y) => x.dayOffset - y.dayOffset);
}

// ── Planetary Sensitivity ("Caution Periods" diagnosis) ───────────────────────
// Any planet can be a personal trigger, not just the classic "heavy" outer
// ones — so this scores all ten. The score is a background HINT (surfaced to
// pre-suggest likely answers in the frontend questionnaire); the actual
// diagnosis is self-reported by the user, since the same transit can land
// completely differently for two people with the same aspect on paper.

export const ALL_PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"] as const;
export type CautionPlanet = (typeof ALL_PLANETS)[number];

const PERSONAL_POINTS = ["Sun", "Moon", "Mercury", "Venus", "Mars"] as const;

const HARD_ASPECTS = new Set(["Conjunction", "Square", "Opposition"]);

const ASPECT_HIT_WEIGHT: Record<string, number> = { Conjunction: 3, Opposition: 2.5, Square: 2 };
const ASPECT_MAX_ORB: Record<string, number> = { Conjunction: 8, Opposition: 8, Square: 7 };

export const PLANET_ARCHETYPE: Record<CautionPlanet, { label: string; feel: string }> = {
  Sun:     { label: "Ego friction",   feel: "clashes with authority (including your own pride), burnout from overexertion, vitality dips" },
  Moon:    { label: "Emotional",      feel: "moodiness, emotional overwhelm, feeling reactive or easily thrown" },
  Mercury: { label: "Mental",         feel: "miscommunication, mental fog or scatter, decision paralysis, information overload" },
  Venus:   { label: "Relational",     feel: "relationship friction, overspending, aesthetic or values clashes, feeling under-appreciated" },
  Mars:    { label: "Combustible",    feel: "irritability, conflict, impulsiveness, accidents, frustration boiling over" },
  Uranus:  { label: "Disruptive",     feel: "sudden shifts, things breaking from routine, feeling knocked off course" },
  Neptune: { label: "Hazy / diffuse", feel: "fog, low motivation, sleepiness, things feeling unclear or hard to pin down" },
  Saturn:  { label: "Heavy",          feel: "weight, restriction, anxiety, a sense of being tested or held back" },
  Pluto:   { label: "Intense",        feel: "high stakes, power struggles, things feeling scarier or more consequential than usual" },
  Jupiter: { label: "Excess",         feel: "overdoing it — overcommitting, overspending, overindulging" },
};

export interface PlanetarySensitivityHit {
  personalPoint: string;   // e.g. "Moon" or "Ascendant"
  aspect: string;
  orb: number;
}

export interface PlanetarySensitivity {
  planet: CautionPlanet;
  score: number;
  hits: PlanetarySensitivityHit[];
  angular: boolean;   // natal placement is near one of the four chart angles
}

/**
 * Scores every planet's natal "chargedness" for this specific chart: hard
 * aspects (conjunction/square/opposition) to the other personal points +
 * Ascendant, weighted by aspect type and orb tightness, plus a flat bonus if
 * the planet itself sits near one of the four angles (ASC/MC/DSC/IC).
 * This is a HINT, not the diagnosis — the frontend questionnaire uses it to
 * pre-suggest likely answers, but the user picks their own sensitivities.
 */
export function computePlanetarySensitivity(natal: ComputedNatalChart): PlanetarySensitivity[] {
  const ascLon = natal.ascendant.longitude;
  const mcLon = natal.midheaven.longitude;
  const dscLon = normalize360(ascLon + 180);
  const icLon = normalize360(mcLon + 180);
  const angles = [ascLon, mcLon, dscLon, icLon];
  const ANGLE_ORB = 8;

  const results: PlanetarySensitivity[] = [];

  for (const target of ALL_PLANETS) {
    const targetPlanet = natal.planets.find((p) => p.planet === target);
    if (!targetPlanet) continue;

    const hits: PlanetarySensitivityHit[] = [];
    let score = 0;

    for (const point of PERSONAL_POINTS) {
      if (point === target) continue; // don't aspect a planet against itself
      const natalPoint = natal.planets.find((p) => p.planet === point);
      if (!natalPoint) continue;
      const asp = findAspect(targetPlanet.longitude, natalPoint.longitude);
      if (!asp || !HARD_ASPECTS.has(asp.name)) continue;
      const orbFactor = 1 - asp.orb / (ASPECT_MAX_ORB[asp.name] ?? 8);
      score += (ASPECT_HIT_WEIGHT[asp.name] ?? 1) * Math.max(0.15, orbFactor);
      hits.push({ personalPoint: point, aspect: asp.name, orb: asp.orb });
    }

    const ascAsp = findAspect(targetPlanet.longitude, ascLon);
    if (ascAsp && HARD_ASPECTS.has(ascAsp.name)) {
      const orbFactor = 1 - ascAsp.orb / (ASPECT_MAX_ORB[ascAsp.name] ?? 8);
      score += (ASPECT_HIT_WEIGHT[ascAsp.name] ?? 1) * Math.max(0.15, orbFactor);
      hits.push({ personalPoint: "Ascendant", aspect: ascAsp.name, orb: ascAsp.orb });
    }

    const angular = angles.some((a) => angularDiff(targetPlanet.longitude, a) <= ANGLE_ORB);
    if (angular) score += 2;

    results.push({ planet: target as CautionPlanet, score: parseFloat(score.toFixed(2)), hits, angular });
  }

  return results.sort((a, b) => b.score - a.score);
}
