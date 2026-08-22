/**
 * Electional astrology ("Launch") API.
 *
 * GET /api/election/categories — list of venture categories the feature supports
 * GET /api/election/scan       — ranked windows for a category across a date range
 */
import { Router, type IRouter } from "express";
import { ELECTION_CATEGORIES, scanElection } from "../lib/inceptionElection.js";

const router: IRouter = Router();

/**
 * MEMOIZED, because the engine is synchronous and this scan is the slowest
 * request the app makes. A 14-day scan — the default the Launch page asks for —
 * scores every planetary hour in the range: 336 calls to scoreElection, each
 * doing its own getMajorAspects (26ms) and getLastMoonAspect (16ms). Measured
 * end to end at 66 SECONDS of blocked event loop, so one person opening Launch
 * stalls every other request on the server for over a minute. This repo has
 * shipped a 90-second calendar request before, the same way.
 *
 * The key carries everything the answer depends on — category, range, place and
 * the day — so it cannot serve yesterday's scan or another latitude's hours.
 * Bounded, because an unbounded memo on a per-location key is a slow leak.
 *
 * This makes the SECOND view instant; the first still pays the full cost. The
 * real fix is to stop scoring all 336 hours to show 30 windows — rank the days
 * coarsely first, then score hours only inside the best few — which is a change
 * to the scan strategy rather than a cache, and wants its own measurement.
 */
const SCAN_MEMO = new Map<string, ReturnType<typeof scanElection>>();
const SCAN_MEMO_MAX = 64;

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
    // The day, not the instant: a scan started at 09:00 and one at 09:05 answer
    // the same question, and keying on the timestamp would never hit.
    const dayKey = startParam ? start.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const memoKey = `${category}|${dayKey}|${days}|${lat.toFixed(2)}|${lon.toFixed(2)}`;
    const hit = SCAN_MEMO.get(memoKey);
    if (hit) { res.json(hit); return; }

    const scan = scanElection(category, start, days, lat, lon);
    if (SCAN_MEMO.size >= SCAN_MEMO_MAX) SCAN_MEMO.delete(SCAN_MEMO.keys().next().value as string);
    SCAN_MEMO.set(memoKey, scan);
    res.json(scan);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "election scan failed" });
  }
});

export default router;
