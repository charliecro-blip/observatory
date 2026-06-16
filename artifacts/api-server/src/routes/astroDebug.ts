import { Router, type IRouter } from "express";
import { getDebugSnapshot, getAstroSnapshot } from "../lib/astro.js";

const router: IRouter = Router();

/**
 * GET /api/astro/debug
 * Returns raw planetary longitudes + sign labels for today (or ?date=YYYY-MM-DD).
 * Use this to sanity-check the ephemeris calculations.
 */
router.get("/astro/debug", (req, res) => {
  const dateStr = req.query.date as string | undefined;
  const date = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();

  if (isNaN(date.getTime())) {
    res.status(400).json({ error: "Invalid date. Use ?date=YYYY-MM-DD" });
    return;
  }

  const debug = getDebugSnapshot(date);
  res.json(debug);
});

/**
 * GET /api/astro/snapshot
 * Returns the full astro snapshot used by Body Weather + Oracle.
 */
router.get("/astro/snapshot", (req, res) => {
  const dateStr = req.query.date as string | undefined;
  const date = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();
  res.json(getAstroSnapshot(date));
});

export default router;
