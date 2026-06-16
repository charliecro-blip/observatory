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
  const today = todayString();
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
  const date = body.date ?? todayString();

  const [row] = await db
    .insert(dailyCheckIns)
    .values({
      testerId,
      date,
      energy: body.energy ?? null,
      mood: body.mood ?? null,
      stress: body.stress ?? null,
      focus: body.focus ?? null,
      digestion: body.digestion ?? null,
      sleepQuality: body.sleepQuality ?? null,
      pain: body.pain ?? null,
      regulation: body.regulation ?? null,
      symptomTags: body.symptomTags ?? null,
      behaviorTags: body.behaviorTags ?? null,
      notes: body.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [dailyCheckIns.testerId, dailyCheckIns.date],
      set: {
        energy: body.energy ?? null,
        mood: body.mood ?? null,
        stress: body.stress ?? null,
        focus: body.focus ?? null,
        digestion: body.digestion ?? null,
        sleepQuality: body.sleepQuality ?? null,
        pain: body.pain ?? null,
        regulation: body.regulation ?? null,
        symptomTags: body.symptomTags ?? null,
        behaviorTags: body.behaviorTags ?? null,
        notes: body.notes ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(row);
});

export default router;
