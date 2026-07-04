import { Router } from "express";
import { db } from "@workspace/db";
import { habits, habitLogs } from "@workspace/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";

const router = Router();

function tid(req: any, res: any): string | null {
  const id = req.headers["x-tester-id"] as string | undefined;
  if (!id) { res.status(400).json({ error: "Missing x-tester-id header." }); return null; }
  return id;
}

// GET /habits — list active habits with recent streak (last 14 days)
router.get("/habits", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const rows = await db.select().from(habits).where(and(eq(habits.testerId, testerId), eq(habits.status, "active"))).orderBy(habits.createdAt);

  // Fetch last 14 days of logs for all habits
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const logs = await db.select().from(habitLogs).where(and(eq(habitLogs.testerId, testerId), gte(habitLogs.date, cutoffStr)));

  const logsByHabit = logs.reduce((acc, l) => {
    (acc[l.habitId] ??= new Set()).add(l.date);
    return acc;
  }, {} as Record<number, Set<string>>);

  // Build last-14-day streak array and current streak count
  const today = new Date();
  const enriched = rows.map(h => {
    const doneSet = logsByHabit[h.id] ?? new Set();
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (13 - i));
      const ds = d.toISOString().slice(0, 10);
      const isToday = ds === today.toISOString().slice(0, 10);
      return { date: ds, done: doneSet.has(ds), isToday };
    });
    // Current streak: count consecutive done days backwards from yesterday
    let streak = 0;
    for (let i = 12; i >= 0; i--) {
      if (days[i].done) streak++; else break;
    }
    return { ...h, days, streak, doneToday: doneSet.has(today.toISOString().slice(0, 10)) };
  });

  res.json(enriched);
});

// POST /habits
router.post("/habits", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const { name, description, emoji, favoredElements, favoredPhases, bestWindowType, minimumViable, goalId, projectId } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [row] = await db.insert(habits).values({ testerId, name, description, emoji, favoredElements, favoredPhases, bestWindowType, minimumViable, goalId: goalId ?? null, projectId: projectId ?? null }).returning();
  res.status(201).json(row);
});

// PATCH /habits/:id
router.patch("/habits/:id", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const id = parseInt(req.params.id);
  const { name, description, emoji, favoredElements, favoredPhases, bestWindowType, minimumViable, status, goalId, projectId } = req.body;
  const [row] = await db.update(habits).set({ name, description, emoji, favoredElements, favoredPhases, bestWindowType, minimumViable, status, goalId, projectId }).where(and(eq(habits.id, id), eq(habits.testerId, testerId))).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

// DELETE /habits/:id
router.delete("/habits/:id", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  await db.update(habits).set({ status: "archived" }).where(and(eq(habits.id, parseInt(req.params.id)), eq(habits.testerId, testerId)));
  res.json({ ok: true });
});

// POST /habits/:id/log — mark done for a date
router.post("/habits/:id/log", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const habitId = parseInt(req.params.id);
  const date = req.body.date ?? new Date().toISOString().slice(0, 10);
  // Upsert: delete existing then insert
  await db.delete(habitLogs).where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.testerId, testerId), eq(habitLogs.date, date)));
  const [row] = await db.insert(habitLogs).values({ testerId, habitId, date }).returning();
  res.status(201).json(row);
});

// DELETE /habits/:id/log — unmark done for a date
router.delete("/habits/:id/log", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const habitId = parseInt(req.params.id);
  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  await db.delete(habitLogs).where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.testerId, testerId), eq(habitLogs.date, date)));
  res.json({ ok: true });
});

export default router;
