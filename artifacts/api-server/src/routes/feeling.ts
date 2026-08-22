/**
 * POST /feeling — "here's how I am", read against the sky.
 *
 * THIS FILE EXISTS SO THAT NOTHING HERE CAN BE STORED BY ACCIDENT. The route
 * began life in diary.ts, which is the module about keeping things; a helper
 * added there later would sit one line away from a handler whose whole promise
 * is the opposite. There is no db write in this file and there should never be
 * one. A person who typed the hardest sentence they have should not discover it
 * saved somewhere afterwards — keeping a moment is the diary's separate,
 * deliberate act.
 *
 * The crisis gate runs inside feelingReading(), before the mirror and before
 * any planet is looked up, and a blocked read returns support with no astrology
 * attached at any size.
 *
 * The chart is read to enrich the sky, never written.
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, natalCharts } from "@workspace/db";
import { requireTesterId } from "../middlewares/testerId.js";
import { feelingReading } from "../lib/feelingReading.js";
import { computeNatalChart } from "../lib/natal.js";

const router = Router();
router.post("/feeling", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { text, lat, lon } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) { res.status(400).json({ error: "text required" }); return; }
  if (text.length > 2000) { res.status(400).json({ error: "text too long" }); return; }

  let natal;
  try {
    const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
    if (stored?.birthDate && stored.birthTime != null && stored.timeKnown !== false) {
      const n = computeNatalChart(stored.birthDate, stored.birthTime, Number(stored.birthLat), Number(stored.birthLon), Number(stored.utcOffset), "whole-sign");
      natal = { planets: n.planets.map(p => ({ planet: p.planet, longitude: p.longitude })), asc: n.ascendant.longitude, mc: n.midheaven.longitude };
    }
  } catch { /* chartless is a first-class case here as everywhere */ }

  res.json(feelingReading({
    text,
    lat: typeof lat === "number" ? lat : 40.7,
    lon: typeof lon === "number" ? lon : -74.0,
    natal,
  }));
});

export default router;
