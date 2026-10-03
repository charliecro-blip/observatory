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

// ── Health insights ────────────────────────────────────────────────────────────

const SIXTH_HOUSE_THEMES: Record<string, string[]> = {
  Aries: [
    "Prone to inflammation, headaches, and adrenal surges under stress",
    "High-intensity activity is medicine — but watch for burnout cycles",
    "Iron and B-vitamins support your constitution; watch for fever-prone patterns",
    "Healing happens fastest when you channel Mars energy deliberately",
  ],
  Taurus: [
    "Throat, thyroid, and neck are constitutional areas of focus",
    "Slow metabolism and weight regulation benefit from consistent routine",
    "Sensory therapies — massage, warm baths, nourishing foods — are deeply healing",
    "Venus rulership favors beautiful, pleasurable approaches to health",
  ],
  Gemini: [
    "Nervous system and respiratory system need regular calming",
    "Mental overwhelm and anxiety translate directly into physical symptoms",
    "Breathwork, varied movement, and cognitive-somatic therapies work well",
    "Watch for scattered health routines — consistency is key",
  ],
  Cancer: [
    "Digestive system is emotionally sensitive — gut-brain axis is strong",
    "Emotional state directly impacts physical health; emotional hygiene is medical",
    "Fluid retention and hormonal sensitivity around lunar cycles",
    "Nurturing, warm, home-based healing environments are most effective",
  ],
  Leo: [
    "Heart health and circulation are constitutional focus areas",
    "Ego-related stress and overexertion are the primary health risks",
    "Spine and back benefit from regular attention and strengthening",
    "Joy is medicine — creative expression has direct healing power",
  ],
  Virgo: [
    "Digestive hypersensitivity and nervous system refinement are key themes",
    "Microbiome health, detailed nutrition protocols, and herbs work powerfully",
    "Over-analysis and worry manifest as gut and nervous system symptoms",
    "Purification routines and precise supplementation protocols are your medicine",
  ],
  Libra: [
    "Kidneys, adrenals, and blood sugar regulation are constitutional themes",
    "Indecision and relationship stress manifest as physical imbalance",
    "Balance in all things — sleep, work, movement, nutrition — is health",
    "Beauty and symmetry practices support healing; ugly environments harm",
  ],
  Scorpio: [
    "Hormonal system, elimination, and reproductive health are focus areas",
    "Suppressed emotions and trauma lodge in the body — deep healing is needed",
    "Regenerative protocols, fasting, and transformation practices are powerful",
    "Watch for obsessive health patterns or cycles of depletion and rebirth",
  ],
  Sagittarius: [
    "Liver, hips, and sciatic nerve are constitutional areas of attention",
    "Excess tendencies — in food, stimulants, or activity — are the main risk",
    "Outdoor movement, philosophical alignment, and travel support healing",
    "Optimism is a health asset; pessimism depletes the liver and hips",
  ],
  Capricorn: [
    "Bones, joints, skin, and teeth are the constitutional focus",
    "Chronic overwork and self-neglect are primary health risks",
    "Cold therapy, mineral-rich nutrition, and structural bodywork are powerful",
    "Building health systematically over time — slow but lasting results",
  ],
  Aquarius: [
    "Circulation, ankles, and the nervous system have constitutional sensitivity",
    "Nervous system irregularity and spasm are stress responses to watch",
    "Community-based healing, breathwork, and electrical therapies resonate",
    "Unconventional health approaches often work better than conventional ones",
  ],
  Pisces: [
    "Immune sensitivity, lymphatic system, and feet need regular attention",
    "Substance sensitivity — to medications, alcohol, and chemicals — is high",
    "Sleep quality and dream states profoundly affect physical health",
    "Spiritual and water-based therapies, boundaries, and rest are primary medicine",
  ],
};

const FIRST_HOUSE_THERAPIES: Record<string, string[]> = {
  Aries: [
    "Dynamic, vigorous movement as daily medicine — running, martial arts, HIIT",
    "Iron-rich and anti-inflammatory foods support your Mars-ruled constitution",
    "Quick action on health impulses — your body signals clearly; trust them",
    "Channel competitiveness into health goals; you thrive with measurable targets",
  ],
  Taurus: [
    "Slow, sensory-rich movement: yoga, hiking, dancing — body pleasure heals you",
    "Grounding in nature and routine is genuinely therapeutic",
    "Massage, bodywork, and tactile therapies go deep for you",
    "Consistent, unhurried protocols work better than intense short-term approaches",
  ],
  Gemini: [
    "Variety in exercise prevents boredom-driven health neglect",
    "Breathwork and pranayama directly address your nervous system constitution",
    "Journaling and talk therapy are as important as physical modalities",
    "Your body responds well to movement that also stimulates the mind",
  ],
  Cancer: [
    "Warm, nourishing foods prepared at home are foundational to your health",
    "Water — swimming, baths, time near water — is deeply restorative",
    "Emotional release practices (somatic work, crying, journaling) prevent physical stagnation",
    "Safety and comfort in healing environments matter enormously for you",
  ],
  Leo: [
    "Heart-centered movement: dance, community sports, anything joyful and expressive",
    "Sunlight is medicine for you — prioritize daily sun exposure",
    "Creative expression — art, performance, play — is directly healing",
    "Spinal care and back strengthening are constitutional priorities",
  ],
  Virgo: [
    "Precise nutrition tracking and supplementation protocols suit your analytical nature",
    "Herbal medicine and naturopathy resonate with your constitution",
    "Purification routines: regular detoxing, clean eating, fasting cycles",
    "Routine is health for you — your body thrives on consistent, measured practices",
  ],
  Libra: [
    "Partner or group exercise keeps you motivated — you thrive in health community",
    "Beauty rituals are genuinely therapeutic — aesthetics affect your physical state",
    "Gentle detox practices, alkaline nutrition, and kidney support are helpful",
    "Balance and moderation in everything — extremes in any direction deplete you",
  ],
  Scorpio: [
    "Deep tissue massage, structural integration, and intense bodywork suit you",
    "Regenerative protocols: extended fasting, cold exposure, detox work powerfully",
    "Shadow work and psychological healing are inseparable from physical health",
    "Intensity in practice is fine — you need depth, not superficiality",
  ],
  Sagittarius: [
    "Outdoor exercise, hiking, and travel are primary vitality boosters",
    "Liver support through bitter herbs, reduced alcohol, and regular movement",
    "Philosophy and meaning — having a 'why' for your health — is essential fuel",
    "Hip mobility and lower back care are structural priorities",
  ],
  Capricorn: [
    "Structured, disciplined protocols build lasting health for your constitution",
    "Cold therapy, strength training, and mineral-rich nutrition are powerful tools",
    "Patience and long-game thinking: your health compounds slowly but surely",
    "Rest and recovery deserve as much scheduling discipline as work",
  ],
  Aquarius: [
    "Innovative health approaches often work better than conventional ones for you",
    "Community healing circles, group breathwork, and social movement resonate",
    "Technology-assisted health tracking suits your analytical, systems-oriented mind",
    "Circulation support through alternating temperature therapy and movement",
  ],
  Pisces: [
    "Water therapy — swimming, flotation, baths — is your deepest restorative",
    "Sleep hygiene and dream practices are not optional — they are foundational",
    "Spiritual and energetic healing modalities work powerfully for you",
    "Boundaries around stimulation protect your sensitive nervous system",
  ],
};

const TENTH_HOUSE_THERAPIES: Record<string, string[]> = {
  Aries: [
    "Purpose-driven physical challenges and leadership roles vitalize you",
    "Stagnant or powerless career situations deplete health quickly — take action",
    "Being a pioneer in your field is medicine; following orders depletes you",
  ],
  Taurus: [
    "Work environments with beauty, comfort, and stability support physical health",
    "Financial security is a health issue for you — instability manifests physically",
    "Careers with tangible, beautiful outputs nourish your constitution",
  ],
  Gemini: [
    "Mental stimulation and communication in your work is health-sustaining",
    "Mentally repetitive or isolating work creates nervous system depletion",
    "Multiple projects and intellectual variety in your career supports vitality",
  ],
  Cancer: [
    "Caregiving, nurturing roles, or working from home support wellbeing",
    "Your career needs an emotional component — purely analytical work depletes you",
    "Safe, home-like work environments have direct health benefits",
  ],
  Leo: [
    "Recognition, creativity, and leadership in your vocation sustain your vitality",
    "Being unseen or underappreciated in work depletes your heart and spine",
    "Performance, teaching, or any role where you shine heals your constitution",
  ],
  Virgo: [
    "Service-oriented work with clear purpose and precision suits your constitution",
    "Chaotic or imprecise work environments are health hazards for you",
    "Analysis, healing, or technical roles that help others optimize vitality",
  ],
  Libra: [
    "Partnership and collaboration in career are health-supportive",
    "Unfair or imbalanced work situations manifest as physical symptoms",
    "Beautiful, harmonious work environments matter to your health",
  ],
  Scorpio: [
    "Deep, transformative work that involves research or healing sustains vitality",
    "Superficial or inauthentic career roles are particularly depleting",
    "Power and depth in your vocation are health requirements, not luxuries",
  ],
  Sagittarius: [
    "Work involving travel, teaching, or philosophical growth sustains vitality",
    "Confining or narrow career roles contract your health",
    "Freedom and meaning in your vocation are literal health requirements",
  ],
  Capricorn: [
    "Achievement, mastery, and building something lasting support your constitution",
    "Working toward long-term, structured goals provides health-sustaining purpose",
    "Authority and earned status in your field reduce stress and support vitality",
  ],
  Aquarius: [
    "Innovative, future-oriented work in service of collective wellbeing heals you",
    "Conformist or hierarchically rigid environments are health hazards",
    "Group leadership and humanitarian purpose sustain your vitality",
  ],
  Pisces: [
    "Creative, spiritual, or healing vocations nourish your constitution deeply",
    "Corporate or purely materialistic career paths deplete your energy",
    "Service from a place of spiritual purpose, not sacrifice, is your medicine",
  ],
};

export interface HouseInsight {
  houseNumber: number;
  sign: string;
  ruler: string;
  rulerSign: string;
  rulerHouse: number;
  planetsInHouse: string[];
  themes: string[];
  currentActivations: string[];
}

export interface NatalHealthInsights {
  ascendant: HouseInsight;
  sixthHouse: HouseInsight;
  tenthHouse: HouseInsight;
  summary: string;
}

export function computeNatalHealthInsights(natal: ComputedNatalChart): NatalHealthInsights {
  const now = new Date();
  const jd = julianDay(now);
  const currentPlanets = getPlanetPositions(jd);

  function getHouseInsight(houseNumber: number, themesMap: Record<string, string[]>): HouseInsight {
    const house = natal.houses[houseNumber - 1];
    const sign = house.sign;
    const ruler = SIGN_RULERS[sign];

    // Find ruler's current position in natal chart
    const rulerNatal = natal.planets.find((p) => p.planet === ruler);
    const rulerSign = rulerNatal?.sign ?? sign;
    const rulerHouse = rulerNatal?.houseNumber ?? houseNumber;

    const themes = themesMap[sign] ?? [];

    // Current activations: transit planets currently in this house sign or aspecting ruler
    const houseLabel = houseNumber === 1 ? "1st house (body & constitution)" : houseNumber === 6 ? "6th house (health & daily rhythm)" : "10th house (purpose & career)";
    const houseDomain = houseNumber === 6
      ? "health routines, digestion, sleep quality, and daily energy patterns"
      : houseNumber === 1
      ? "physical vitality, body awareness, energy levels, and constitutional resilience"
      : "career demands and their effect on your health and energy";
    const rulerDomain = houseNumber === 6
      ? "health routines, digestion, and nervous system regulation"
      : houseNumber === 1
      ? "physical constitution, energy, and body resilience"
      : "how work demands connect to your physical and emotional energy";

    const currentActivations: string[] = [];
    for (const tp of currentPlanets) {
      if (tp.sign === sign) {
        currentActivations.push(
          `${tp.planet} is currently transiting ${sign}, the sign of your ${houseLabel}. This may correspond with heightened sensitivity in the domain of ${houseDomain} — worth tracking in your logs.`
        );
      }
      if (rulerNatal) {
        const transitLon = (SIGNS.indexOf(tp.sign) * 30) + tp.degree;
        const asp = findAspect(transitLon, rulerNatal.longitude);
        if (asp && asp.orb <= 5) {
          const strength = asp.orb <= 1 ? "an exact" : asp.orb <= 3 ? "a close" : "a forming";
          currentActivations.push(
            `${tp.planet} is forming ${strength} ${asp.name.toLowerCase()} to your natal ${ruler} — the ruler of your ${houseLabel}. This transit may correspond with shifts in ${rulerDomain}. It is worth tracking how you feel in this area over the next few days.`
          );
        }
      }
    }

    return {
      houseNumber,
      sign,
      ruler,
      rulerSign,
      rulerHouse,
      planetsInHouse: house.planets,
      themes,
      currentActivations: [...new Set(currentActivations)].slice(0, 4),
    };
  }

  const ascendantInsight = getHouseInsight(1, FIRST_HOUSE_THERAPIES);
  const sixthHouseInsight = getHouseInsight(6, SIXTH_HOUSE_THEMES);
  const tenthHouseInsight = getHouseInsight(10, TENTH_HOUSE_THERAPIES);

  // Generate summary — complete, grammatically correct sentences with no mid-sentence theme embedding
  const ascSign = natal.ascendant.sign;
  const sixthSign = natal.houses[5].sign;
  const tenthSign = natal.houses[9].sign;

  function toSentence(s: string): string {
    const t = s.trim();
    return t.endsWith(".") || t.endsWith("—") ? t.replace(/—$/, ".") : t + ".";
  }

  const ascTheme = FIRST_HOUSE_THERAPIES[ascSign]?.[0] ?? "Movement and self-care are foundational to your health.";
  const sixthTheme = SIXTH_HOUSE_THEMES[sixthSign]?.[0] ?? "Health sensitivity patterns are a central wellness focus.";
  const tenthTheme = TENTH_HOUSE_THERAPIES[tenthSign]?.[0] ?? "Purposeful work supports your constitution.";

  const summary = `${ascSign} rising shapes your physical constitution and healing style. ${toSentence(ascTheme)} Your 6th house in ${sixthSign} highlights a core health tendency: ${toSentence(sixthTheme)} With ${tenthSign} at the Midheaven, your vocation connects directly to vitality: ${toSentence(tenthTheme)}`;

  return {
    ascendant: ascendantInsight,
    sixthHouse: sixthHouseInsight,
    tenthHouse: tenthHouseInsight,
    summary,
  };
}
