/**
 * Electional astrology ("Launch") API.
 *
 * GET /api/election/categories — list of venture categories the feature supports
 * GET /api/election/scan       — ranked windows for a category across a date range
 */
import { Router, type IRouter } from "express";
import { ELECTION_CATEGORIES, scanElection } from "../lib/election.js";

const router: IRouter = Router();

router.get("/election/categories", (_req, res) => {
  res.json({
    categories: ELECTION_CATEGORIES.map((c) => ({
      key: c.key, label: c.label, weight: c.weight, description: c.description,
    })),
  });
});

router.get("/election/scan", (req, res) => {
  const category = (req.query.category as string) ?? "";
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const days = Math.min(30, Math.max(1, parseInt((req.query.days as string) ?? "14", 10)));
  const startParam = req.query.start as string | undefined;
  const start = startParam ? new Date(startParam) : new Date();

  if (!ELECTION_CATEGORIES.some((c) => c.key === category)) {
    res.status(400).json({ error: `Unknown category: ${category}` });
    return;
  }

  try {
    const scan = scanElection(category, start, days, lat, lon);
    res.json(scan);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "election scan failed" });
  }
});

export default router;
