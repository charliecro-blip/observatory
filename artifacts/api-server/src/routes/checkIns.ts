import { Router, type IRouter } from "express";
import { db, dailyCheckIns } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { UpsertCheckInBody } from "@workspace/api-zod";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

router.get("/check-ins/today", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  // The client passes its LOCAL date — the server's UTC "today" is a different
  // day for US-evening users (the 8pm-ET rollover bug). UTC stays the fallback
  // for old clients only.
  const today = (req.query.date as string | undefined) ?? todayString();
  const [row] = await db
    .select()
    .from(dailyCheckIns)
    .where(and(eq(dailyCheckIns.testerId, testerId), eq(dailyCheckIns.date, today)));
  if (!row) {
    res.status(404).json({ error: "No check-in for today" });
    return;
  }
  res.json(row);
});

router.post("/check-ins", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const body = UpsertCheckInBody.parse(req.body);
  // A daily record must be stamped with the WRITER's day. The old fallback to
  // the server's UTC date is what filed a US-evening reflection under tomorrow;
  // the callers all send `date` now, and a new one shouldn't be able to
  // reintroduce the bug by forgetting to.
  if (!body.date) {
    res.status(400).json({ error: "date (YYYY-MM-DD, the viewer's local day) is required" });
    return;
  }
  const date = body.date;

  // Partial upsert: only fields present in the body are written. Different
  // surfaces write different slices of the same day (journal → notes,
  // felt-rating → behaviorTags, a scores form → energy/mood/…) and must not
  // null each other out. Send an explicit null to clear a field.
  const FIELDS = [
    "energy", "mood", "stress", "focus", "digestion",
    "sleepQuality", "pain", "regulation", "symptomTags", "behaviorTags", "notes",
  ] as const;
  const provided: Record<string, unknown> = {};
  for (const f of FIELDS) {
    if ((body as Record<string, unknown>)[f] !== undefined) provided[f] = (body as Record<string, unknown>)[f];
  }

  const [row] = await db
    .insert(dailyCheckIns)
    .values({ testerId, date, ...provided })
    .onConflictDoUpdate({
      target: [dailyCheckIns.testerId, dailyCheckIns.date],
      set: { ...provided, updatedAt: new Date() },
    })
    .returning();

  res.json(row);
});

export default router;
