import { Router, type IRouter } from "express";
import { db, natalCharts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpsertNatalChartBody } from "@workspace/api-zod";
import { julianDay } from "../lib/astro.js";
import { computeNatalChart, computeTransitAspects, computeNatalHealthInsights } from "../lib/natal.js";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

async function getStoredChart(testerId: string) {
  const rows = await db
    .select()
    .from(natalCharts)
    .where(eq(natalCharts.testerId, testerId))
    .limit(1);
  return rows[0] ?? null;
}

function buildResponse(stored: typeof natalCharts.$inferSelect) {
  const computed = computeNatalChart(
    stored.birthDate,
    stored.birthTime,
    stored.birthLat,
    stored.birthLon,
    stored.utcOffset,
  );
  const timeKnown = stored.timeKnown !== false;
  // When the birth time is unknown, everything below is genuinely unknowable —
  // don't ship a fabricated Ascendant/houses to the client where it could be
  // shown as fact. Planet signs and aspects survive (Moon is approximate).
  const suppressed = timeKnown ? computed : {
    ...computed,
    ascendant: null,
    midheaven: null,
    houses: [],
    planets: computed.planets.map((p) => ({ ...p, houseNumber: null })),
  };
  return {
    id: stored.id,
    birthDate: stored.birthDate,
    birthTime: stored.birthTime,
    birthPlace: stored.birthPlace,
    birthLat: stored.birthLat,
    birthLon: stored.birthLon,
    utcOffset: stored.utcOffset,
    timeKnown,
    createdAt: stored.createdAt,
    ...suppressed,
  };
}

// GET /api/natal-chart
router.get("/natal-chart", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const stored = await getStoredChart(testerId);
  if (!stored) {
    res.status(404).json({ error: "No natal chart saved yet" });
    return;
  }
  res.json(buildResponse(stored));
});

// POST /api/natal-chart
router.post("/natal-chart", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const body = UpsertNatalChartBody.parse(req.body);
  // timeKnown isn't in the generated zod body — read it directly, default true.
  const timeKnown = (req.body as { timeKnown?: boolean })?.timeKnown !== false;
  const existing = await getStoredChart(testerId);

  let stored: typeof natalCharts.$inferSelect;
  if (existing) {
    const [updated] = await db
      .update(natalCharts)
      .set({ ...body, timeKnown, updatedAt: new Date() })
      .where(eq(natalCharts.id, existing.id))
      .returning();
    stored = updated;
  } else {
    const [inserted] = await db
      .insert(natalCharts)
      .values({ ...body, timeKnown, testerId })
      .returning();
    stored = inserted;
  }

  res.json(buildResponse(stored));
});

// GET /api/natal-chart/health-insights
router.get("/natal-chart/health-insights", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const stored = await getStoredChart(testerId);
  if (!stored) {
    res.status(404).json({ error: "No natal chart saved yet" });
    return;
  }
  const computed = computeNatalChart(
    stored.birthDate,
    stored.birthTime,
    stored.birthLat,
    stored.birthLon,
    stored.utcOffset,
  );
  const insights = computeNatalHealthInsights(computed);
  res.json(insights);
});

// GET /api/natal-chart/transits
router.get("/natal-chart/transits", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const stored = await getStoredChart(testerId);
  if (!stored) {
    res.status(404).json({ error: "No natal chart saved yet" });
    return;
  }
  const computed = computeNatalChart(
    stored.birthDate,
    stored.birthTime,
    stored.birthLat,
    stored.birthLon,
    stored.utcOffset,
  );
  const transits = computeTransitAspects(computed);
  res.json(transits);
});

// GET /api/natal-chart/debug
// Returns full computed chart data for the current tester — for sanity-checking
// that different birth data produces different charts.
router.get("/natal-chart/debug", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const stored = await getStoredChart(testerId);
  if (!stored) {
    res.status(404).json({
      testerId,
      error: "No natal chart saved yet for this tester. Save birth data first.",
    });
    return;
  }

  // Reconstruct UTC birth datetime for inspection
  const [year, month, day] = stored.birthDate.split("-").map(Number);
  const [hour, minute] = (stored.birthTime ?? "12:00").split(":").map(Number);
  const utcHour = hour - stored.utcOffset;
  const birthUTC = new Date(Date.UTC(year, month - 1, day, Math.floor(utcHour), minute));

  const jd = julianDay(birthUTC);
  const computed = computeNatalChart(
    stored.birthDate,
    stored.birthTime,
    stored.birthLat,
    stored.birthLon,
    stored.utcOffset,
  );

  res.json({
    testerId,
    savedBirthData: {
      birthDate: stored.birthDate,
      birthTime: stored.birthTime,
      birthPlace: stored.birthPlace,
      birthLat: stored.birthLat,
      birthLon: stored.birthLon,
      utcOffset: stored.utcOffset,
    },
    convertedUTCDatetime: birthUTC.toISOString(),
    julianDay: parseFloat(jd.toFixed(5)),
    ascendant: {
      sign: computed.ascendant.sign,
      degree: parseFloat(computed.ascendant.degree.toFixed(2)),
      longitude: parseFloat(computed.ascendant.longitude.toFixed(4)),
    },
    midheaven: {
      sign: computed.midheaven.sign,
      degree: parseFloat(computed.midheaven.degree.toFixed(2)),
      longitude: parseFloat(computed.midheaven.longitude.toFixed(4)),
    },
    planets: computed.planets.map((p) => ({
      planet: p.planet,
      sign: p.sign,
      degree: parseFloat(p.degree.toFixed(2)),
      longitude: parseFloat(p.longitude.toFixed(4)),
      houseNumber: p.houseNumber,
      retrograde: p.retrograde,
    })),
    houseCusps: computed.houses.map((h) => ({
      house: h.number,
      sign: h.sign,
      cuspDegree: parseFloat(h.cuspDegree.toFixed(2)),
      planets: h.planets,
    })),
    houseSystem: "Regiomontanus",
  });
});

export default router;
