/**
 * Usage events — fire-and-forget analytics ingest + a summary the owner reads.
 *   POST /events { event, props }         — log (never blocks the client)
 *   GET  /events/summary?days=14          — counts by event, by view, active testers
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usageEvents } from "@workspace/db/schema";
import { gte, sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/events", async (req, res) => {
  const { event, props } = req.body ?? {};
  if (!event || typeof event !== "string") { res.status(400).json({ error: "event required" }); return; }
  const testerId = (req.headers["x-tester-id"] as string) || null;
  // Never let logging failures affect the app.
  db.insert(usageEvents).values({ testerId, event: event.slice(0, 60), props: props ?? null }).catch(() => {});
  res.status(202).json({ ok: true });
});

router.get("/events/summary", async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt((req.query.days as string) ?? "14", 10)));
  const since = new Date(Date.now() - days * 86400000);
  const [byEvent, byView, testers] = await Promise.all([
    db.select({ event: usageEvents.event, n: sql<number>`count(*)::int` })
      .from(usageEvents).where(gte(usageEvents.createdAt, since))
      .groupBy(usageEvents.event).orderBy(sql`count(*) desc`),
    db.select({ view: sql<string>`props->>'view'`, n: sql<number>`count(*)::int` })
      .from(usageEvents).where(sql`event = 'view' and created_at >= ${since.toISOString()}`)
      .groupBy(sql`props->>'view'`).orderBy(sql`count(*) desc`),
    db.select({ n: sql<number>`count(distinct tester_id)::int` })
      .from(usageEvents).where(gte(usageEvents.createdAt, since)),
  ]);
  res.json({ days, activeTesters: testers[0]?.n ?? 0, byEvent, byView });
});

export default router;
