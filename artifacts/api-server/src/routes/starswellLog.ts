/**
 * THE STARSWELL LOG: marks from /today, saved to the person's Compass account.
 *
 * Stored as `usage_events` rows with event "starswell_log", for the reason the
 * feedback door gives: no migration has to land before the endpoint works, and
 * moving it to its own table later is a read-side change. Identity is the same
 * `x-tester-id` every other Compass route uses; with none, nothing is saved and
 * the page keeps the mark on the device.
 */
import { Router } from "express";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, usageEvents } from "@workspace/db";
import { cleanEntry, latestMarks } from "../lib/starswellLog.js";

const router = Router();
const EVENT = "starswell_log";

function testerOf(req: { headers: Record<string, unknown> }): string | null {
  const id = String(req.headers["x-tester-id"] ?? "").trim();
  return id && id.length <= 100 ? id : null;
}

router.post("/starswell/log", async (req, res) => {
  const testerId = testerOf(req);
  if (!testerId) { res.status(401).json({ error: "sign in to Compass to save marks to your account" }); return; }
  const entry = cleanEntry(req.body);
  if (!entry) { res.status(400).json({ error: "key must be date|hour|card and value one of did, noticed, skip or null" }); return; }
  try {
    await db.insert(usageEvents).values({ testerId, event: EVENT, props: entry });
    res.status(201).json({ ok: true });
  } catch {
    res.status(503).json({ error: "could not save that just now" });
  }
});

router.get("/starswell/log", async (req, res) => {
  const testerId = testerOf(req);
  if (!testerId) { res.status(401).json({ error: "sign in to Compass to load your marks" }); return; }
  const days = Math.min(400, Math.max(1, parseInt(String(req.query.days ?? "60"), 10) || 60));
  try {
    const rows = await db.select({ props: usageEvents.props })
      .from(usageEvents)
      .where(and(eq(usageEvents.event, EVENT), eq(usageEvents.testerId, testerId),
        gte(usageEvents.createdAt, new Date(Date.now() - days * 864e5))))
      .orderBy(asc(usageEvents.createdAt), asc(usageEvents.id))
      .limit(20000);
    res.json({ marks: latestMarks(rows) });
  } catch {
    res.status(503).json({ error: "could not load marks just now" });
  }
});

export default router;
