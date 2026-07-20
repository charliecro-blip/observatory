/**
 * Elections — the activity picker's data source (owner 2026-07-20).
 *
 *   GET /elections/activities → the full correspondence list, grouped by
 *   category, for the picker UI and for star/step sortage. One canonical
 *   table (lib/activityCorrespondences) feeds this, the /associate grounding,
 *   and the coming good/great election engine.
 */
import { Router, type IRouter } from "express";
import { ACTIVITIES, ACTIVITY_CATEGORIES, matchActivity } from "../lib/activityCorrespondences.js";

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

export default router;
