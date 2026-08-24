/**
 * THE BETA FEEDBACK DOOR.
 *
 * What existed before this was a mailto: link near the bottom of Settings,
 * which asks a tester to leave the app, compose an email, and describe from
 * memory a thing that confused them a minute ago. Most of that never arrives,
 * and what does arrives without the one detail that makes it actionable —
 * where they were and what the app was showing at the time.
 *
 * WHY "WRONG" IS THE VALUABLE ONE. The other four tell us about the interface.
 * "Wrong" tells us the engine made a claim a person disagreed with, which is
 * the only calibration signal we get from outside our own tests. It is worth
 * more if it arrives with the surface and the recommendation attached, so the
 * client sends those.
 *
 * WHERE IT IS STORED. A row in `usage_events`, event "feedback". Deliberately
 * not a new table: this ships to a running beta, `event` is already indexed,
 * and a migration that has to land before the endpoint stops 500ing is a
 * needless way to break a live app. Promoting it to its own table later is a
 * read-side change, not a rewrite.
 *
 * WHAT IS NOT STORED. `context` is an ALLOWLIST, not a passthrough. A client
 * that grows a habit of attaching more state cannot quietly start posting a
 * journal line or a chart into an analytics table — unknown keys are dropped
 * here rather than trusted there.
 */
import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, usageEvents } from "@workspace/db";
import { requireAdmin } from "./events";
import { KINDS, CONTEXT_KEYS, NOTE_MAX, cleanContext, isKind } from "../lib/feedbackContext.js";

const router = Router();

router.post("/feedback", async (req, res) => {
  const { kind, note, context } = req.body ?? {};
  if (!isKind(kind)) {
    res.status(400).json({ error: "kind must be one of: " + KINDS.join(", ") });
    return;
  }
  const text = typeof note === "string" ? note.trim().slice(0, NOTE_MAX) : "";
  const testerId = ((req.headers["x-tester-id"] as string) || "").trim() || null;

  try {
    // Awaited, unlike /events' fire-and-forget: a person who took the trouble
    // to write something is owed a real answer about whether it was kept.
    await db.insert(usageEvents).values({
      testerId,
      event: "feedback",
      props: { kind, note: text, ...cleanContext(context) },
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(503).json({ error: "could not save that just now" });
  }
});

router.get("/feedback", requireAdmin, async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) ?? "50", 10) || 50));
  const rows = await db.select()
    .from(usageEvents)
    .where(eq(usageEvents.event, "feedback"))
    .orderBy(desc(usageEvents.createdAt))
    .limit(limit);
  res.json({
    count: rows.length,
    entries: rows.map(r => ({ at: r.createdAt, testerId: r.testerId, ...(r.props ?? {}) })),
  });
});

export default router;
export { KINDS, CONTEXT_KEYS, NOTE_MAX, cleanContext };
