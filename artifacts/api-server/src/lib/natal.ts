/**
 * Natal chart calculations — Ascendant, MC, Whole Sign houses,
 * transit aspects, and health insights.
 */

import { julianDay, getPlanetPositions, sunLongitude, moonLongitude } from "./astro.js";
import { computeCusps, assignHouse, type HouseSystem } from "./houses.js";

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

// Health notes for transit aspect combinations
function buildTransitHealthNote(
  transitPlanet: string,
  natalPlanet: string,
  aspect: string,
  natalHouse: number,
): string {
  const stressAspects = ["Square", "Opposition"];
  const flowAspects = ["Trine", "Sextile"];
  const isStress = stressAspects.includes(aspect);
  const isFlow = flowAspects.includes(aspect);
  const isConjunct = aspect === "Conjunction";

  // Health-relevant house notes — specific to domain and tracking suggestion
  if (natalHouse === 6) {
    if (isStress) return `${transitPlanet} is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in the 6th house. This aspect may correspond with pressure on your health routines, digestion, or daily rhythm. It is worth tracking energy dips, stress-related symptoms, and any disruptions to sleep or digestion during this period.`;
    if (isFlow) return `${transitPlanet} is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in the 6th house. This supportive aspect can describe a period where health practices feel more accessible. Consider initiating or deepening a routine you have been putting off.`;
    return `${transitPlanet} is conjunct your natal ${natalPlanet} in the 6th house. Conjunctions here can intensify whatever is active in your health and daily life domain. Track your energy, digestion, and routine quality during this window.`;
  }
  if (natalHouse === 1) {
    if (isStress) return `${transitPlanet} is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in the 1st house. This aspect may correspond with a period of lower physical resilience or challenge to your usual energy baseline. Prioritizing rest, grounding practices, and body awareness is especially useful now.`;
    if (isFlow) return `${transitPlanet} is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in the 1st house. This aspect can describe a period where the body feels more aligned and responsive. New health practices initiated now may take root more easily.`;
    return `${transitPlanet} is conjunct your natal ${natalPlanet} in the 1st house. Conjunctions here can correspond with notable shifts in physical vitality or body awareness. Track how your constitution responds during this window.`;
  }
  if (natalHouse === 10) {
    if (isStress) return `${transitPlanet} is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in the 10th house. This aspect may correspond with work-related depletion or role pressure affecting your energy. Monitoring stress levels and protecting recovery time is especially relevant now.`;
    if (isFlow) return `${transitPlanet} is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in the 10th house. This aspect may describe a period where professional purpose and physical wellbeing feel more aligned — work engagement may feel renewing rather than draining.`;
    return `${transitPlanet} is conjunct your natal ${natalPlanet} in the 10th house. This can correspond with a significant vocational moment with downstream effects on energy and health. Track how work demands are affecting your body.`;
  }

  // Planet-specific language for other houses — complete, readable sentences
  type PlanetEntry = { stress: string; flow: string; conjunct: string };
  const planetNotes: Record<string, PlanetEntry> = {
    Saturn: {
      stress: `Saturn is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Saturn stress aspects can correspond with increased pressure, fatigue from responsibility, or a feeling of restriction. Consistent sleep, nutrition, and pacing tend to be the most useful support during Saturn transits.`,
      flow: `Saturn is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Saturn flow aspects can describe a period of consolidation. Health practices that require discipline and patience tend to take hold well during this window.`,
      conjunct: `Saturn is conjunct your natal ${natalPlanet} in House ${natalHouse}. This can mark a period of sustained pressure or strengthening in the area of your chart this planet governs. Steady, sustainable effort tends to be rewarded.`,
    },
    Mars: {
      stress: `Mars is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Mars stress aspects can correspond with energy volatility, irritability, or inflammation-adjacent patterns. Watch for overexertion or stress-driven symptoms in the coming days.`,
      flow: `Mars is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. This aspect can describe a period of heightened physical drive. Physical activity and assertive action tend to feel natural and productive now.`,
      conjunct: `Mars is conjunct your natal ${natalPlanet} in House ${natalHouse}. This can correspond with a surge of energy or urgency. Channeling this deliberately — through exercise or focused effort — may prevent it from turning into agitation.`,
    },
    Jupiter: {
      stress: `Jupiter is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Jupiter stress aspects can correspond with excess tendencies — overindulgence, overcommitment, or overlooking physical limits. Moderation is especially useful to monitor now.`,
      flow: `Jupiter is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Jupiter flow aspects can describe a period where healing and recovery feel more accessible than usual. Restorative practices may yield stronger results.`,
      conjunct: `Jupiter is conjunct your natal ${natalPlanet} in House ${natalHouse}. This can describe a period of growth or increased capacity — but also a tendency to overextend. Notice if you are doing too much and neglecting maintenance.`,
    },
    Neptune: {
      stress: `Neptune is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Neptune stress aspects can correspond with diffuse symptoms, sensitivity, or signals that are hard to name. Sleep quality, hydration, and emotional clarity are worth tracking carefully during this longer-moving transit.`,
      flow: `Neptune is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Neptune flow aspects can describe a period of heightened intuition and receptivity. Restful, low-stimulation practices may feel especially nourishing.`,
      conjunct: `Neptune is conjunct your natal ${natalPlanet} in House ${natalHouse}. This is a slow, longer transit that can correspond with subtle and sometimes elusive shifts. Tracking patterns over weeks rather than days will reveal more.`,
    },
    Pluto: {
      stress: `Pluto is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Pluto stress aspects are slow-moving and can correspond with deep pressure to transform or release something. Psychological and somatic practices alongside physical care are often the most effective support.`,
      flow: `Pluto is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Pluto flow aspects can describe a period of quiet but lasting transformation. Deep healing work initiated now may have long-term effects.`,
      conjunct: `Pluto is conjunct your natal ${natalPlanet} in House ${natalHouse}. This significant, slow transit can correspond with fundamental shifts in how this part of your chart operates. Long-term pattern tracking is more useful than single-day readings.`,
    },
    Uranus: {
      stress: `Uranus is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Uranus stress aspects can correspond with sudden changes, disrupted patterns, or heightened nervous system sensitivity. Flexibility and grounding practices are useful during Uranus transits.`,
      flow: `Uranus is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Uranus flow aspects can describe a period where breaking old patterns feels natural. Experimenting with new health approaches may work especially well now.`,
      conjunct: `Uranus is conjunct your natal ${natalPlanet} in House ${natalHouse}. This can correspond with sudden shifts in energy or routine. Building in adaptability and tracking what changes is more useful than trying to maintain strict consistency.`,
    },
    Moon: {
      stress: `The Moon is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Moon stress aspects can correspond with emotional sensitivity, fluid retention, or bodily rhythms feeling off. This transit passes quickly — logging how you feel now builds useful lunar cycle pattern awareness over time.`,
      flow: `The Moon is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Moon flow aspects can describe a brief window where emotional and physical rhythms feel more aligned. Nourishing practices and early rest tend to feel especially restorative.`,
      conjunct: `The Moon is conjunct your natal ${natalPlanet} in House ${natalHouse}. This brief transit can correspond with heightened body awareness or emotional sensitivity. Logging how you feel now may reveal useful lunar cycle patterns over time.`,
    },
    Sun: {
      stress: `The Sun is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Sun stress aspects can correspond with tension between current life demands and the needs symbolized by your natal ${natalPlanet}. Notice where you feel pulled in conflicting directions.`,
      flow: `The Sun is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Sun flow aspects can describe a period where your current focus naturally supports what your natal ${natalPlanet} represents. Identity and vitality may feel more integrated than usual.`,
      conjunct: `The Sun is conjunct your natal ${natalPlanet} in House ${natalHouse}. This annual transit can correspond with increased attention to whatever this planet governs in your chart. A good moment to check in intentionally with that area of your health and life.`,
    },
    Mercury: {
      stress: `Mercury is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Mercury stress aspects can correspond with scattered thinking, communication friction, or nervous system overload. Slowing down and reducing mental demands is often the most useful support.`,
      flow: `Mercury is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Mercury flow aspects can describe a period where thinking and communication feel sharper. Good timing for health research, planning, or articulating what you have been noticing.`,
      conjunct: `Mercury is conjunct your natal ${natalPlanet} in House ${natalHouse}. This brief transit can correspond with increased mental activity in the area of your chart this planet governs. A useful moment to process information and articulate what you have been observing.`,
    },
    Venus: {
      stress: `Venus is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Venus stress aspects can correspond with tension in relationships, values, or pleasure patterns — sometimes showing up as comfort eating, social friction, or neglected self-care.`,
      flow: `Venus is forming a ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. Venus flow aspects can describe a period of ease, pleasure, and relational warmth. Restorative and enjoyable health practices feel especially nourishing now.`,
      conjunct: `Venus is conjunct your natal ${natalPlanet} in House ${natalHouse}. This can correspond with a period of harmony or increased social connection in the area this planet governs. Nourishing, pleasurable activities tend to feel more accessible.`,
    },
  };

  const entry = planetNotes[transitPlanet];
  if (entry) {
    return isConjunct ? entry.conjunct : isStress ? entry.stress : entry.flow;
  }

  // Generic fallback — still complete and trackable
  const qualifier = isStress ? "challenging" : isFlow ? "supportive" : "activating";
  return `${transitPlanet} is forming a ${qualifier} ${aspect.toLowerCase()} to your natal ${natalPlanet} in House ${natalHouse}. It may be worth tracking how you feel in the domains associated with this natal placement over the coming days.`;
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

  const byTransit: Record<string, string[]> = {
    Moon:    ["sleep", "emotional sensitivity", "digestion", "fluid retention"],
    Mercury: ["nervous system", "cognitive clarity", "anxiety"],
    Venus:   ["appetite", "pleasure patterns", "social energy"],
    Sun:     ["energy levels", "vitality"],
    Mars:    ["inflammation", "motivation", "physical drive", "pain/tension"],
    Jupiter: ["appetite", "digestion", "excess"],
    Saturn:  ["fatigue", "joint/structural stress", "endurance"],
    Uranus:  ["nervous system", "disrupted rhythms"],
    Neptune: ["sleep", "sensitivity", "diffuse symptoms", "hydration", "emotional overwhelm"],
    Pluto:   ["deep fatigue", "elimination", "intensity"],
  };

  const byNatal: Record<string, string[]> = {
    Moon:      ["emotional body", "sleep", "digestion", "hormonal rhythm"],
    Sun:       ["vitality", "life force"],
    Mars:      ["inflammation", "muscle tension", "energy drive"],
    Mercury:   ["nervous system", "anxiety", "cognitive patterns"],
    Venus:     ["appetite", "comfort patterns"],
    Jupiter:   ["liver", "digestion", "excess"],
    Saturn:    ["structure", "fatigue", "joints"],
    Ascendant: ["physical constitution", "body resilience", "energy presentation"],
  };

  const byHouse: Record<number, string[]> = {
    1: ["energy levels", "physical constitution"],
    2: ["diet", "appetite"],
    6: ["health routines", "digestion", "daily stress"],
    8: ["fatigue", "chronic patterns", "emotional intensity"],
    10: ["work stress", "career pressure", "motivation"],
  };

  for (const d of byTransit[transitPlanet] ?? []) domains.add(d);
  for (const d of byNatal[natalPlanet] ?? []) domains.add(d);
  for (const d of byHouse[natalHouse] ?? []) domains.add(d);

  return [...domains].slice(0, 5);
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

export function computeTransitAspects(natal: ComputedNatalChart): TransitAspect[] {
  const now = new Date();
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
        healthNote: buildTransitHealthNote(transit.planet, natal_p.planet, asp.name, natal_p.houseNumber),
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
        healthNote: buildTransitHealthNote(transit.planet, "Ascendant", ascAsp.name, 1),
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
    .slice(0, 20);
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
