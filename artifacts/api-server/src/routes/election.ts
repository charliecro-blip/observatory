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
 * MEMOIZED, because the engine is synchronous and this is the slowest request
 * the app makes. A 14-day scan — the Launch page's default — scores every
 * planetary hour in the range, 336 calls to scoreElection.
 *
 * It measured 42 seconds of blocked event loop, so one person opening Launch
 * stalled every other request for most of a minute; this repo has shipped a
 * 90-second calendar request before, the same way. The engine itself is ~8s now
 * (see tests/election-scan-cost.test.ts for what changed and why each step
 * leaves the answers untouched), which is survivable rather than good, so the
 * memo stays.
 *
 * The key carries everything the answer depends on — category, range, place and
 * the day — so it cannot serve yesterday's scan or another latitude's hours.
 * Bounded, because an unbounded memo on a per-location key is a slow leak.
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
