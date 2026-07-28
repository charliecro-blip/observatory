/**
 * GET /api/position-fix — "where you are in time" (lib/positionFix.ts).
 * Profections are Ascendant-based, so a known birth time is required; without
 * one the endpoint says so honestly instead of profecting off a noon guess.
 */
import { Router, type IRouter } from "express";
import { db, natalCharts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { computeNatalChart } from "../lib/natal.js";
import { positionFix } from "../lib/positionFix.js";

const router: IRouter = Router();

router.get("/position-fix", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
  if (!stored) { res.json({ available: false, reason: "no-chart" }); return; }
  if (stored.timeKnown === false) { res.json({ available: false, reason: "no-birth-time" }); return; }
  try {
    const natal = computeNatalChart(stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset);
    res.json({ available: true, fix: positionFix(natal, stored.birthDate) });
  } catch (e) {
    res.status(500).json({ available: false, reason: "compute-failed" });
  }
});

export default router;
