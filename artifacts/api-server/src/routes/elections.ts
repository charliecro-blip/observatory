/**
 * Elections — the activity picker's data source (owner 2026-07-20).
 *
 *   GET /elections/activities → the full correspondence list, grouped by
 *   category, for the picker UI and for star/step sortage. One canonical
 *   table (lib/activityCorrespondences) feeds this, the /associate grounding,
 *   and the coming good/great election engine.
 */
import { Router, type IRouter } from "express";
import { db, natalCharts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ACTIVITIES, ACTIVITY_CATEGORIES, matchActivity } from "../lib/activityCorrespondences.js";
import { computeElections } from "../lib/electionEngine.js";
import { computeNatalChart } from "../lib/natal.js";

const router: IRouter = Router();

router.get("/elections/activities", (_req, res) => {
  res.json({
    categories: ACTIVITY_CATEGORIES,
    activities: ACTIVITIES.map(a => ({
      key: a.key, label: a.label, category: a.category, element: a.element,
      planets: a.planets, hourRulers: a.hourRulers, signs: Object.keys(a.signs),
      houses: a.houses, phase: a.phase, voc: a.voc, mercuryRx: a.mercuryRx,
      windowType: a.windowType, gloss: a.gloss,
    })),
  });
});

// Sortage probe: match free text to an activity (stars, steps, tasks).
router.get("/elections/match", (req, res) => {
  const text = (req.query.text as string) ?? "";
  const hit = matchActivity(text);
  res.json(hit ? { key: hit.activity.key, label: hit.activity.label, score: hit.score, gloss: hit.activity.gloss } : null);
});

// The engine: activity → tiered times. Personalizes when the tester has a
// natal chart on file (x-tester-id header); works chart-less at GOOD tier.
router.get("/elections/times", async (req, res) => {
  const activityKey = (req.query.activity as string) ?? "";
  const span = (["day", "week", "month"].includes(req.query.span as string) ? req.query.span : "week") as "day" | "week" | "month";
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;

  let natal = null;
  let timeKnown = true;
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (testerId) {
    try {
      const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
      if (stored?.birthDate && stored.birthTime != null) {
        natal = computeNatalChart(stored.birthDate, stored.birthTime, Number(stored.birthLat), Number(stored.birthLon), Number(stored.utcOffset), "whole-sign");
        // `birthTime != null` is NOT the same question as "is the time known".
        // Settings stores `birthTime || "12:00"` alongside timeKnown:false, so
        // an untimed chart arrives here looking fully specified and would have
        // been given house cusps derived from a noon nobody was born at.
        timeKnown = stored.timeKnown !== false;
      }
    } catch { /* chartless is fine — GOOD tier only */ }
  }

  const result = computeElections({ activityKey, span, lat, lon, tzOffsetMin, natal, timeKnown });
  if (!result) { res.status(404).json({ error: "unknown activity" }); return; }
  res.json(result);
});

export default router;
