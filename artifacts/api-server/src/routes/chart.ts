/**
 * The Chart — practitioner surface. The live "astro clock": natal wheel with
 * current transits overlaid, the full geometry (houses, cusps, angles), a
 * ranked transit stack, and AI-dynamic explication of any single transit read
 * against the whole chart (not a static per-aspect blurb).
 *
 *   GET  /api/chart/now         — everything the bi-wheel + stack needs
 *   POST /api/chart/explicate   — a rich reading of one transit, in context
 */
import { Router, type IRouter } from "express";
import { db, natalCharts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { computeNatalChart, computeTransitAspects } from "../lib/natal.js";
import { getPlanetPositions, julianDay, getMajorAspects, SIGNS } from "../lib/astro.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { isOpenAiConfigured } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

async function storedChart(testerId: string) {
  return (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
}

const lonOf = (sign: string, degree: number) => SIGNS.indexOf(sign) * 30 + degree;

// GET /api/chart/now — the bi-wheel payload.
router.get("/chart/now", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const stored = await storedChart(testerId);
  if (!stored) { res.status(404).json({ error: "No natal chart saved yet" }); return; }

  const timeKnown = stored.timeKnown !== false;
  const houseSystem = (req.query.houseSystem as any) ?? "whole-sign";
  const natal = computeNatalChart(stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset, houseSystem);

  const now = new Date();
  const jd = julianDay(now);
  const transitRaw = getPlanetPositions(jd);
  const transit = transitRaw.map((p) => ({
    planet: p.planet, sign: p.sign, degree: p.degree,
    longitude: lonOf(p.sign, p.degree), retrograde: p.retrograde,
  }));

  // Transit→natal aspects (the practitioner's main read), ranked by importance.
  const aspects = computeTransitAspects(natal, now, 40)
    .sort((a, b) => b.score - a.score)
    .map((a) => ({
      transitPlanet: a.transitPlanet, natalPlanet: a.natalPlanet, aspect: a.aspect,
      orb: a.orb, exact: a.exact, severity: a.severity, natalHouse: a.natalHouse,
    }));

  // Current transit-to-transit aspects (the mundane sky), from the station-aware
  // engine so retrograde perfection timing is honest.
  const LUM = new Set(["Sun", "Moon"]);
  const skyAspects = getMajorAspects(jd)
    // same display rule as Today: non-luminary pairs only under 5 deg orb
    .filter((a) => LUM.has(a.planet1) || LUM.has(a.planet2) || a.orb < 5)
    .map((a) => ({
    planet1: a.planet1, planet2: a.planet2, aspect: a.aspect, orb: a.orb,
    applying: a.applying, exactAt: a.hoursToExact != null ? new Date(now.getTime() + a.hoursToExact * 3600000).toISOString() : null,
    neverPerfected: a.neverPerfected ?? false, stationsBeforeExact: a.stationsBeforeExact ?? false,
  }));

  res.json({
    timeKnown,
    natal: {
      planets: natal.planets.map((p) => ({
        planet: p.planet, sign: p.sign, degree: p.degree, longitude: p.longitude,
        retrograde: p.retrograde, house: timeKnown ? p.houseNumber : null,
      })),
      // Houses/angles are unknowable without a birth time — suppress them.
      cusps: timeKnown ? natal.houses.map((h) => h.cuspDegree) : null,
      ascendant: timeKnown ? natal.ascendant.longitude : null,
      midheaven: timeKnown ? natal.midheaven.longitude : null,
    },
    transit,
    aspects,
    skyAspects,
  });
});

// POST /api/chart/explicate — AI reading of one transit, in the whole-chart context.
router.post("/chart/explicate", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const stored = await storedChart(testerId);
  if (!stored) { res.status(404).json({ error: "No natal chart saved yet" }); return; }

  const { transitPlanet, natalPlanet, aspect } = req.body ?? {};
  if (!transitPlanet || !natalPlanet || !aspect) { res.status(400).json({ error: "transitPlanet, natalPlanet, aspect required" }); return; }

  // Same house system as the wheel (/chart/now), or the house number a
  // practitioner reads in the stack won't match the one in the reading.
  const houseSystem = (req.body?.houseSystem as any) ?? "whole-sign";
  const natal = computeNatalChart(stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset, houseSystem);
  const target = computeTransitAspects(natal, new Date(), 40).find(
    (a) => a.transitPlanet === transitPlanet && a.natalPlanet === natalPlanet && a.aspect === aspect,
  );
  if (!target) { res.status(404).json({ error: "That transit isn't active right now" }); return; }

  const natalP = natal.planets.find((p) => p.planet === natalPlanet);
  const timeKnown = stored.timeKnown !== false;
  // The whole-chart context the reading reasons across — this is what makes it
  // dynamic rather than a per-aspect blurb: the reader sees the natal placement,
  // the house, and the other loud transits at the same time.
  const others = computeTransitAspects(natal, new Date(), 40)
    .filter((a) => !(a.transitPlanet === transitPlanet && a.natalPlanet === natalPlanet))
    .sort((a, b) => b.score - a.score).slice(0, 4)
    .map((a) => `${a.transitPlanet} ${a.aspect.toLowerCase()} ${a.natalPlanet} (${a.orb.toFixed(1)}°)`);

  const ctx = [
    `Transit: ${transitPlanet} ${aspect.toLowerCase()} natal ${natalPlanet}, orb ${target.orb.toFixed(1)}°${target.exact ? " (exact)" : ""}.`,
    natalP ? `Natal ${natalPlanet} is in ${natalP.sign}${timeKnown && natalP.houseNumber ? `, ${natalP.houseNumber}th house` : ""}${natalP.retrograde ? ", retrograde" : ""}.` : "",
    `Transiting ${transitPlanet} is in ${target.transitSign}.`,
    others.length ? `Also active in the chart right now: ${others.join("; ")}.` : "",
  ].filter(Boolean).join(" ");

  // No key configured → the deterministic reading below, reached without a
  // doomed round trip. Degrading beats refusing: this transit is real whether
  // or not a model is available to write about it.
  const deterministic = () => res.json({
    transit: { transitPlanet, natalPlanet, aspect, orb: target.orb, exact: target.exact, severity: target.severity, natalHouse: timeKnown ? target.natalHouse : null },
    reading: target.healthNote,
  });
  if (!isOpenAiConfigured) { deterministic(); return; }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are an experienced, grounded astrologer writing a transit interpretation for an astrologically literate reader. " +
            "Use correct terminology freely (no need to define aspects or houses). Read THIS transit specifically, weighing it against the rest of the chart context given. " +
            "Two or three tight paragraphs. Psychologically nuanced, honest about difficulty, never fatalistic or predictive of specific events. " +
            "Name the felt texture, the invitation, and the shadow. No hedging boilerplate, no 'the stars suggest'.",
        },
        { role: "user", content: ctx },
      ],
    });
    res.json({
      transit: { transitPlanet, natalPlanet, aspect, orb: target.orb, exact: target.exact, severity: target.severity, natalHouse: timeKnown ? target.natalHouse : null },
      reading: completion.choices[0]?.message?.content ?? "",
    });
  } catch {
    // Deterministic fallback so the feature degrades rather than breaks.
    res.json({
      transit: { transitPlanet, natalPlanet, aspect, orb: target.orb, exact: target.exact, severity: target.severity, natalHouse: timeKnown ? target.natalHouse : null },
      reading: target.healthNote,
    });
  }
});

export default router;
