/**
 * Auspice timing API.
 *
 * GET /api/tides/now      — Current timing snapshot: element, planetary hour, VOC, quality label
 * GET /api/tides/windows  — Upcoming timing windows (next 12 hours in 2-hour blocks)
 */
import { Router, type IRouter } from "express";
import {
  julianDay, moonPhase, getPlanetPositions,
  voidOfCourse, getPlanetaryHour, getDailyElementEmphasis,
  getMajorAspects, getLocalAngles, getAngularPlanets,
  getLastMoonAspect, getNextAngularCrossings,
} from "../lib/astro.js";
import { db } from "@workspace/db";
import { natalCharts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeNatalChart, computeTransitAspects } from "../lib/natal.js";

const router: IRouter = Router();

// ── Seed rule data (inlined from auspice-seed-rules-v1.json) ─────────────────

const PLANETARY_HOUR_RULES: Record<string, {
  prompt: string;
  supports: string[];
}> = {
  Moon:    { prompt: "What needs care, nourishment, or a gentler rhythm?", supports: ["body care", "home", "rest", "emotional processing", "food", "care", "domestic rhythms"] },
  Mercury: { prompt: "What needs to be named, written, sorted, or communicated?", supports: ["writing", "calls", "email", "scheduling", "study", "editing", "sorting", "commerce"] },
  Venus:   { prompt: "What would become easier if you softened, beautified, or connected?", supports: ["art", "design", "relational care", "pleasure", "invitations", "aesthetic refinement", "dates"] },
  Mars:    { prompt: "What needs courage, movement, or a clean cut?", supports: ["movement", "action", "exercise", "boundary work", "errands", "hard edits", "decisive problem-solving"] },
  Jupiter: { prompt: "What wants to grow, be shared, or be understood in a larger frame?", supports: ["teaching", "publishing", "big-picture planning", "outreach", "generosity", "study", "launches"] },
  Saturn:  { prompt: "What needs structure, patience, or maintenance?", supports: ["structure", "discipline", "planning", "accounting", "cleanup", "commitments", "maintenance", "finishing"] },
  Sun:     { prompt: "What needs to be seen, clarified, or led?", supports: ["visibility", "presenting", "leadership", "self-expression", "creative confidence", "direction"] },
};

const VOC_SUPPORTS = ["rest", "cleanup", "review", "finishing", "routine", "spiritual practice", "reflection", "maintenance"];
const VOC_CAUTIONS = ["major launch", "important beginning", "high-stakes commitment", "signing contracts", "pitches and requests"];

const ELEMENT_QUALITIES: Record<string, { quality: string; invitation: string }> = {
  fire:   { quality: "active",      invitation: "Vital force is available. This window supports initiation, expression, and movement." },
  earth:  { quality: "grounding",   invitation: "Steady rhythm is present. This window supports tending, building, and material care." },
  air:    { quality: "clarifying",  invitation: "Mental currents are open. This window supports communication, study, and connection." },
  water:  { quality: "receptive",   invitation: "The tide is inward. This window supports feeling, reflection, and emotional depth." },
  spirit: { quality: "liminal",     invitation: "The field is between states. This window is for rest, inner listening, and releasing what does not need force." },
};

// ── /api/tides/now ─────────────────────────────────────────────────────────

router.get("/tides/now", async (req, res) => {
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const date = new Date();
  const jd   = julianDay(date);

  // Optional personal transits — computed when x-tester-id header is present
  const testerId = (req.headers["x-tester-id"] as string) ?? null;
  let personalTransits: Array<{
    transitPlanet: string;
    aspect: string;
    natalPlanet: string;
    natalSign: string;
    natalHouse: number;
    orb: number;
    exact: boolean;
    severity: string;
    summary: string;
  }> = [];

  if (testerId) {
    try {
      const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
      if (stored) {
        const natal = computeNatalChart(stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset);
        const transits = computeTransitAspects(natal);
        personalTransits = transits
          .filter((t) => t.severity === "strong" || t.severity === "major" || (t.severity === "moderate" && t.exact))
          .slice(0, 5)
          .map((t) => ({
            transitPlanet: t.transitPlanet,
            aspect:        t.aspect.toLowerCase(),
            natalPlanet:   t.natalPlanet,
            natalSign:     t.natalSign,
            natalHouse:    t.natalHouse,
            orb:           t.orb,
            exact:         t.exact,
            severity:      t.severity,
            summary:       `${t.transitPlanet} ${t.aspect.toLowerCase()} your natal ${t.natalPlanet}${t.exact ? " (exact)" : ` (${t.orb}°)`}`,
          }));
      }
    } catch (_) {
      // Gracefully skip transits if chart unavailable
    }
  }

  const planets        = getPlanetPositions(jd);
  const { name: moonPhaseName, fraction } = moonPhase(jd);
  const moonSign       = planets.find((p) => p.planet === "Moon")!.sign;
  const sunSign        = planets.find((p) => p.planet === "Sun")!.sign;
  const { voc }        = voidOfCourse(jd);
  const elemEmph       = getDailyElementEmphasis(jd);
  const planHour       = getPlanetaryHour(date, lat, lon);
  const retrogrades    = planets.filter((p) => p.retrograde).map((p) => p.planet);
  const aspects        = getMajorAspects(jd);
  const localAngles    = getLocalAngles(jd, lat, lon);
  const angularPlanets = getAngularPlanets(jd, lat, lon);
  const lastMoonAspect = getLastMoonAspect(jd);

  // Moon's current applying aspects — most dynamically significant
  const moonAspects = aspects.filter((a) => a.planet1 === "Moon" || a.planet2 === "Moon");

  const hourRules   = PLANETARY_HOUR_RULES[planHour.ruler] ?? PLANETARY_HOUR_RULES.Sun;
  const elemQuality = ELEMENT_QUALITIES[elemEmph.element] ?? ELEMENT_QUALITIES.water;

  // Enriched scoring: VOC -2, retrogrades -1, benefics angular +1 each, malefics angular -1 each,
  // applying Moon trine/sextile to benefic +1, applying Moon sq/opp malefic -1
  let score = 5;
  if (voc) score -= 2;
  if (retrogrades.length >= 2) score -= 1;
  if (elemEmph.element === "fire" || elemEmph.element === "air") score += 1;

  for (const ap of angularPlanets) {
    if (ap.benefic) score += 1;
    if (ap.malefic) score -= 1;
  }

  const BENEFIC_PLANETS = new Set(["Venus", "Jupiter"]);
  const MALEFIC_PLANETS = new Set(["Mars", "Saturn"]);
  for (const asp of moonAspects) {
    if (!asp.applying) continue;
    const other = asp.planet1 === "Moon" ? asp.planet2 : asp.planet1;
    if ((asp.aspect === "trine" || asp.aspect === "sextile") && BENEFIC_PLANETS.has(other)) score += 1;
    if ((asp.aspect === "square" || asp.aspect === "opposition") && MALEFIC_PLANETS.has(other)) score -= 1;
  }

  const qualityLabel =
    score >= 8 ? "excellent" :
    score >= 5 ? "good" :
    score >= 2 ? "workable" :
    score >= -1 ? "mixed" : "avoid_if_possible";

  const DAY_RULERS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const dayRuler = DAY_RULERS[date.getDay()];

  res.json({
    timestamp: date.toISOString(),
    dayRuler,
    momentLabel: voc
      ? `Void Moon in ${moonSign}`
      : `${planHour.ruler} Hour — ${elemEmph.element.charAt(0).toUpperCase() + elemEmph.element.slice(1)} (${moonSign})`,
    quality: qualityLabel,
    element: elemEmph,
    planetaryHour: {
      ...planHour,
      prompt:   hourRules.prompt,
      supports: voc ? VOC_SUPPORTS : hourRules.supports,
      cautions: voc ? VOC_CAUTIONS : [],
    },
    voidOfCourse: voc,
    moonPhase: moonPhaseName,
    moonFraction: fraction,
    moonSign,
    sunSign,
    retrogrades,
    aspects,
    moonAspects,
    lastMoonAspect,
    localAngles,
    angularPlanets,
    invitation: voc
      ? "The Moon is between signs. This is not the cleanest window for beginning something that needs momentum. It may be better for tending what is already in motion, resting, reviewing, or clearing loose ends."
      : elemQuality.invitation,
    personalTransits,
  });
});

// ── /api/tides/week ────────────────────────────────────────────────────────

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WEEK_ELEMENT_TONES: Record<string, string> = {
  fire:   "Active and expressive. Good for initiating, moving, and bringing energy to what needs momentum.",
  earth:  "Grounding and steady. Good for tending, building, and attending to material rhythms.",
  air:    "Clear and connective. Good for writing, communication, study, and sorting through ideas.",
  water:  "Receptive and emotional. Good for reflection, rest, processing, and relational depth.",
  spirit: "Liminal. The Moon is between signs — a good day for rest, review, and releasing what does not need force.",
};

router.get("/tides/week", (req, res) => {
  const lat   = parseFloat((req.query.lat as string) ?? "40.7");
  const lon   = parseFloat((req.query.lon as string) ?? "-74.0");
  const now   = new Date();

  // Start from today UTC midnight
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const days: Array<{
    date: string;
    dayLabel: string;
    moonSign: string;
    moonPhase: string;
    moonFraction: number;
    element: string;
    voidPeriods: boolean; // has any VOC window today?
    quality: string;
    bestFor: string[];
    tone: string;
  }> = [];

  for (let d = 0; d < 7; d++) {
    const dayMs   = todayUtc.getTime() + d * 86400000;
    const dayDate = new Date(dayMs);
    const noonJd  = julianDay(new Date(dayMs + 12 * 3600000)); // noon UTC

    const { name: phaseName, fraction } = moonPhase(noonJd);
    const planetsNoon = getPlanetPositions(noonJd);
    const moonSignNoon = planetsNoon.find((p) => p.planet === "Moon")!.sign;
    const elemNoon  = getDailyElementEmphasis(noonJd);

    // Check morning (9am) and afternoon (3pm) for VOC presence
    const amJd  = julianDay(new Date(dayMs + 9  * 3600000));
    const pmJd  = julianDay(new Date(dayMs + 15 * 3600000));
    const amVoc = voidOfCourse(amJd).voc;
    const pmVoc = voidOfCourse(pmJd).voc;
    const hasVoc = amVoc || pmVoc || elemNoon.voidOfCourse;

    // Best-for list from the hour rules of the emphasis element
    const element = elemNoon.element;
    const hourFamily = element === "spirit" ? "moon" :
      element === "fire" ? "mars" :
      element === "earth" ? "saturn" :
      element === "air" ? "mercury" : "moon";
    const bestFor = (PLANETARY_HOUR_RULES[hourFamily.charAt(0).toUpperCase() + hourFamily.slice(1)]?.supports ?? []).slice(0, 4);

    let score = 5;
    if (hasVoc) score -= 1;
    const retrogrades = planetsNoon.filter((p) => p.retrograde).length;
    if (retrogrades >= 2) score -= 1;

    const qualityLabel =
      score >= 7 ? "excellent" :
      score >= 5 ? "good" :
      score >= 2 ? "workable" : "mixed";

    days.push({
      date:         dayDate.toISOString().split("T")[0],
      dayLabel:     DAY_LABELS[dayDate.getUTCDay()],
      moonSign:     moonSignNoon,
      moonPhase:    phaseName,
      moonFraction: fraction,
      element,
      voidPeriods:  hasVoc,
      quality:      qualityLabel,
      bestFor,
      tone: WEEK_ELEMENT_TONES[element] ?? WEEK_ELEMENT_TONES.water,
    });
  }

  // Dominant element of the week (most frequent)
  const elCounts: Record<string, number> = {};
  days.forEach((d) => { elCounts[d.element] = (elCounts[d.element] ?? 0) + 1; });
  const weekEl = Object.entries(elCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "water";

  const weekTone = {
    fire:   "An active week. Energy is available for initiation, visibility, and momentum. Pace yourself — not every day will carry the same heat.",
    earth:  "A grounding week. Steady tending serves better than bursts. Good for building, maintaining, and attending to what is already in motion.",
    air:    "A clarifying week. Communication, sorting, writing, and study are favored. Watch for scattered attention in the busier windows.",
    water:  "A receptive week. More is asked of the inner life than the outer. Good for integration, reflection, and relational care.",
    spirit: "An in-between week. The Moon moves through several sign changes, and the quality of time shifts often. Flexibility and rest will serve better than forcing.",
  }[weekEl] ?? "";

  res.json({ weekOf: days[0]?.date, days, weekTone, weekElement: weekEl });
});

// ── /api/tides/windows ─────────────────────────────────────────────────────

router.get("/tides/windows", (req, res) => {
  const lat   = parseFloat((req.query.lat as string) ?? "40.7");
  const lon   = parseFloat((req.query.lon as string) ?? "-74.0");
  const hours = Math.min(parseInt((req.query.hours as string) ?? "12"), 24);
  const now   = new Date();

  const windows: Array<{
    startTime: string;
    endTime: string;
    element: string;
    voidOfCourse: boolean;
    planetaryHour: string;
    quality: string;
  }> = [];

  // Walk actual planetary hour boundaries
  const seen = new Set<string>();
  let cursor = new Date(now.getTime());
  const windowEnd = new Date(now.getTime() + hours * 3600000);

  while (cursor < windowEnd && windows.length < 12) {
    const planHour = getPlanetaryHour(cursor, lat, lon);
    const key = planHour.startTime.toISOString();
    if (!seen.has(key)) {
      seen.add(key);
      const mid = new Date((planHour.startTime.getTime() + planHour.endTime.getTime()) / 2);
      const jd = julianDay(mid);
      const { voc } = voidOfCourse(jd);
      const elemEmph = getDailyElementEmphasis(jd);
      const planets  = getPlanetPositions(jd);
      const retrogrades = planets.filter((p) => p.retrograde).length;

      let score = 5;
      if (voc) score -= 2;
      if (retrogrades >= 2) score -= 1;
      if (elemEmph.element === "fire" || elemEmph.element === "air") score += 1;

      const qualityLabel =
        score >= 8 ? "excellent" :
        score >= 5 ? "good" :
        score >= 2 ? "workable" :
        score >= -1 ? "mixed" : "avoid_if_possible";

      windows.push({
        startTime:    planHour.startTime.toISOString(),
        endTime:      planHour.endTime.toISOString(),
        element:      elemEmph.element,
        voidOfCourse: voc,
        planetaryHour: planHour.ruler,
        quality:      qualityLabel,
      });
    }
    cursor = new Date(planHour.endTime.getTime() + 60000);
  }

  res.json({ windows });
});

// ── /api/tides/practices ───────────────────────────────────────────────────
// Returns active cultivations sorted and annotated by how well they match
// the current timing weather.

import { cultivations, cultivationCheckIns } from "@workspace/db";
import { and } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";

// Moon phase name → quadrant
function phaseQuadrant(phaseName: string): string {
  if (phaseName.includes("New"))    return "new";
  if (phaseName.includes("Waxing")) return "waxing";
  if (phaseName.includes("Full"))   return "full";
  return "waning";
}

const MATCH_LABELS: Record<string, string> = {
  resonant:  "resonant",
  supported: "supported",
  neutral:   "neutral",
  soften:    "soften",
  protect:   "protect the minimum",
};

router.get("/tides/practices", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");

  const date = new Date();
  const jd   = julianDay(date);

  // Current timing snapshot
  const planets      = getPlanetPositions(jd);
  const { name: moonPhaseName } = moonPhase(jd);
  const elemEmph     = getDailyElementEmphasis(jd);
  const planHour     = getPlanetaryHour(date, lat, lon);
  const retrogrades  = new Set(planets.filter((p) => p.retrograde).map((p) => p.planet));
  const aspects      = getMajorAspects(jd);
  const moonAspects  = aspects.filter((a) => a.planet1 === "Moon" || a.planet2 === "Moon");
  const { voc }      = voidOfCourse(jd);
  const phase        = phaseQuadrant(moonPhaseName);

  // Moon's applying aspects to benefics/malefics
  const moonApplyingTo = new Set(
    moonAspects
      .filter((a) => a.applying)
      .map((a) => (a.planet1 === "Moon" ? a.planet2 : a.planet1)),
  );

  // Active cultivations + today's check-ins
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select()
    .from(cultivations)
    .where(and(eq(cultivations.testerId, testerId), eq(cultivations.status, "active")));

  const todayCheckIns = await db
    .select()
    .from(cultivationCheckIns)
    .where(and(eq(cultivationCheckIns.testerId, testerId), eq(cultivationCheckIns.date, today)));
  const ciMap = new Map(todayCheckIns.map((ci) => [ci.cultivationId, ci]));

  const scored = rows.map((c) => {
    const favored  = (c.favoredPlanets as string[] | null) ?? [];
    const cautions = (c.cautionPlanets as string[] | null) ?? [];
    const phases   = (c.favoredPhases  as string[] | null) ?? [];
    const cElems   = (c.elements       as string[] | null) ?? (c.element ? [c.element] : []);

    let score = 0;

    // Element match
    if (cElems.includes(elemEmph.element)) score += 3;
    else if (!voc && elemEmph.element !== "spirit") score += 0;

    // Planetary hour match
    if (favored.includes(planHour.ruler)) score += 2;

    // Favored planet currently active (not retrograde, applying Moon aspect)
    for (const fp of favored) {
      if (moonApplyingTo.has(fp)) score += 1;
      if (retrogrades.has(fp))    score -= 1;
    }

    // Caution planet applying Moon aspect or in exact transit
    for (const cp of cautions) {
      if (moonApplyingTo.has(cp)) score -= 2;
      if (retrogrades.has(cp))    score -= 1;
    }

    // Moon phase match
    if (phases.includes(phase)) score += 1;

    // VOC: pull everything toward Spirit/rest work
    if (voc) {
      const isRestPractice = cElems.includes("spirit") || cElems.includes("water");
      score += isRestPractice ? 2 : -2;
    }

    // Classify
    const match =
      score >= 5 ? "resonant" :
      score >= 2 ? "supported" :
      score >= 0 ? "neutral" :
      score >= -2 ? "soften" : "protect";

    // One-line recommendation
    let recommendation = "";
    if (match === "resonant") {
      recommendation = voc
        ? "Favored even in this void window — gentle practice supported."
        : `Good timing. The ${elemEmph.element} field and ${planHour.ruler} hour support this practice.`;
    } else if (match === "supported") {
      recommendation = `Supported. ${planHour.ruler} hour is aligned; settle in and tend this.`;
    } else if (match === "neutral") {
      recommendation = "Neutral timing. Tend it from habit and rhythm rather than momentum.";
    } else if (match === "soften") {
      const reasonParts: string[] = [];
      if (voc) reasonParts.push("Moon is void");
      for (const cp of cautions) {
        if (moonApplyingTo.has(cp)) reasonParts.push(`Moon applying to ${cp}`);
        if (retrogrades.has(cp))    reasonParts.push(`${cp} retrograde`);
      }
      recommendation = `Consider softening today. ${reasonParts.join("; ") || "Timing is less favorable"}. ${c.minimumViable ? `Minimum viable: ${c.minimumViable}.` : ""}`;
    } else {
      recommendation = `Protect the minimum. ${c.minimumViable ?? "Rest if needed — this practice can wait."}`;
    }

    return { ...c, score, match, recommendation, todayCheckIn: ciMap.get(c.id) ?? null };
  });

  // Sort: resonant → supported → neutral → soften → protect
  const ORDER = ["resonant", "supported", "neutral", "soften", "protect"];
  scored.sort((a, b) => ORDER.indexOf(a.match) - ORDER.indexOf(b.match));

  res.json({
    asOf: date.toISOString(),
    timing: {
      element: elemEmph.element,
      voidOfCourse: voc,
      moonPhase: moonPhaseName,
      phase,
      planetaryHourRuler: planHour.ruler,
      retrogrades: [...retrogrades],
    },
    practices: scored,
  });
});

// ── /api/tides/crossings ───────────────────────────────────────────────────

const CROSSING_INTERPRETATIONS: Record<string, Record<string, string>> = {
  Venus:   { ASC: "grace and ease on the surface — good for connection, presentation, relational work", MC: "favor for visibility, creative expression, public-facing work", DSC: "relational warmth, receptivity, partnership", IC: "beauty and ease in private rhythm, home, or self-care" },
  Jupiter: { ASC: "expansion, confidence, and good fortune in new beginnings", MC: "favorable moment for outreach, teaching, publishing, or making your work visible", DSC: "generosity in relationship, good for collaborative work", IC: "expansive groundedness — good for rooting something new" },
  Mars:    { ASC: "high energy, drive, and initiative — but watch for impulsiveness", MC: "strong will and ambition activated — good for decisive action, less for diplomacy", DSC: "relational friction or strong desire energy", IC: "inner drive; can be restless energy needing grounding" },
  Saturn:  { ASC: "seriousness, structure, patience called for — slow down and commit", MC: "accountability, discipline, long-term building — not the moment for shortcuts", DSC: "testing of relationship structures; commitment or contraction", IC: "grounding in foundation work, but possible heaviness or restriction" },
  Mercury: { ASC: "mental clarity, expressiveness, good for communication and quick decisions", MC: "good for negotiation, writing, or any work requiring sharp thinking", DSC: "attentive listening, good for dialogue", IC: "sorting through inner narrative or private logistics" },
  Sun:     { ASC: "vitality and self-expression amplified — be seen", MC: "solar moment for leadership, clarity, and forward-facing work", DSC: "warmth in partnership; others see you clearly now", IC: "inner radiance; restore and self-nourish" },
  Moon:    { ASC: "emotional sensitivity heightened — receptive and intuitive", MC: "public emotional intelligence; good for care-forward visibility", DSC: "attunement in relationship, emotional resonance", IC: "deep rest, home, self-care, inner work" },
};

router.get("/tides/crossings", (req, res) => {
  const lat   = parseFloat((req.query.lat as string) ?? "40.7");
  const lon   = parseFloat((req.query.lon as string) ?? "-74.0");
  const hours = Math.min(parseFloat((req.query.hours as string) ?? "24"), 48);
  const date  = new Date();
  const jd    = julianDay(date);

  const crossings = getNextAngularCrossings(jd, lat, lon, 3, hours);

  const annotated = crossings.map((c) => ({
    ...c,
    interpretation: CROSSING_INTERPRETATIONS[c.planet]?.[c.angle]
      ?? `${c.planet} contacts the ${c.angle} — themes of ${c.planet.toLowerCase()} activated at this angle`,
  }));

  res.json({ asOf: date.toISOString(), crossings: annotated });
});

export default router;
