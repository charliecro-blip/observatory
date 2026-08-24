/**
 * Usage events — fire-and-forget analytics ingest + a summary the owner reads.
 *   POST /events { event, props }         — log (never blocks the client)
 *   GET  /events/summary?days=14          — counts by event, by view, active testers  [admin]
 *   GET  /events/errors?days=7            — client crashes, grouped, worst first     [admin]
 */
import { Router, type IRouter, type RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { db } from "@workspace/db";
import { usageEvents } from "@workspace/db/schema";
import { gte, sql } from "drizzle-orm";

const router: IRouter = Router();

/**
 * The read endpoints below were reachable by anyone on the internet. That was
 * survivable while they returned counts; it stopped being survivable the moment
 * one of them returned error messages and stack traces, which can quote
 * whatever the user had on screen — published next to their account id.
 *
 * Gated on ADMIN_TOKEN, and **closed by default**: with no token configured
 * these 404 in production rather than falling open. 404 and not 401, so the
 * endpoints don't advertise themselves to someone scanning.
 *
 * Ingest (POST /events) stays open — the app has to be able to write.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected) {
    // No token set: usable locally, invisible in production.
    if (process.env["NODE_ENV"] === "production") { res.status(404).end(); return; }
    next();
    return;
  }
  const given = String(req.headers["x-admin-token"] ?? "");
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(404).end(); return; }
  next();
};

router.post("/events", async (req, res) => {
  const { event, props } = req.body ?? {};
  if (!event || typeof event !== "string") { res.status(400).json({ error: "event required" }); return; }
  const testerId = (req.headers["x-tester-id"] as string) || null;
  // Never let logging failures affect the app.
  db.insert(usageEvents).values({ testerId, event: event.slice(0, 60), props: props ?? null }).catch(() => {});
  res.status(202).json({ ok: true });
});

router.get("/events/summary", requireAdmin, async (req, res) => {
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

/**
 * Client crashes, grouped by message. Reporting them is only half the job —
 * without somewhere to read them they're just rows nobody opens.
 *
 * Grouped, not listed: one bug hitting six people is one line with a six, and
 * "how many people did this reach" is the number that decides whether you stop
 * what you're doing.
 */
router.get("/events/errors", requireAdmin, async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt((req.query.days as string) ?? "7", 10)));
  const since = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      message: sql<string>`props->>'message'`,
      source: sql<string>`props->>'source'`,
      occurrences: sql<number>`count(*)::int`,
      testers: sql<number>`count(distinct tester_id)::int`,
      firstSeen: sql<string>`min(created_at)`,
      lastSeen: sql<string>`max(created_at)`,
      lastPath: sql<string>`(array_agg(props->>'path' ORDER BY created_at DESC))[1]`,
      lastStack: sql<string>`(array_agg(props->>'stack' ORDER BY created_at DESC))[1]`,
    })
    .from(usageEvents)
    .where(sql`event = 'client_error' and created_at >= ${since.toISOString()}`)
    .groupBy(sql`props->>'message'`, sql`props->>'source'`)
    // People affected first, then raw volume — a loop that fired 400 times for
    // one person matters less than a crash that reached four.
    .orderBy(sql`count(distinct tester_id) desc, count(*) desc`);
  res.json({ days, distinctErrors: rows.length, errors: rows });
});

export default router;
