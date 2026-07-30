import { Router } from "express";
import { db } from "@workspace/db";
import { tasks } from "@workspace/db/schema";
import { eq, and, desc, lt, isNull, sql } from "drizzle-orm";
import { associateDeterministic } from "../lib/associate.js";

const router = Router();

function requireTesterId(req: any, res: any): string | null {
  const id = req.headers["x-tester-id"] as string | undefined;
  if (!id) { res.status(400).json({ error: "Missing x-tester-id header." }); return null; }
  return id;
}

// GET /tasks
router.get("/tasks", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const date = req.query.date as string | undefined;
  const goalId = req.query.goalId ? parseInt(req.query.goalId as string, 10) : undefined;
  const milestoneId = req.query.milestoneId ? parseInt(req.query.milestoneId as string, 10) : undefined;
  const conds = [eq(tasks.testerId, testerId)];
  if (date) conds.push(eq(tasks.dueDate, date));
  if (goalId) conds.push(eq(tasks.goalId, goalId));
  if (milestoneId) conds.push(eq(tasks.milestoneId, milestoneId));
  const rows = await db.select().from(tasks)
    .where(and(...conds))
    .orderBy(tasks.sortOrder, tasks.createdAt);
  res.json(rows);
});

// POST /tasks/rollover — carry undone, overdue TASKS forward to today.
//
// Deliberately scoped to tasks and nothing else. A scheduled planning WINDOW
// must never move on its own: a window is a claim on a specific moment the sky
// supported, so silently relocating one doesn't just shuffle logistics, it
// retracts the reason the block existed. (Motion reschedules silently and its
// users call it "AI calendar anxiety" — see COMPETITIVE-UX Part C.)
//
// `originalDueDate` is stamped on the first roll only, so the list can say
// "carried from Tue" instead of quietly pretending the task was always due
// today. The client sends its LOCAL date; the server never guesses.
router.post("/tasks/rollover", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const today = String(req.body?.today ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    res.status(400).json({ error: "today (YYYY-MM-DD, viewer-local) required" });
    return;
  }
  const rolled = await db.update(tasks)
    .set({
      dueDate: today,
      // COALESCE keeps the FIRST original date across repeated rolls, so a
      // task carried for a week still reports where it actually started.
      originalDueDate: sql`COALESCE(${tasks.originalDueDate}, ${tasks.dueDate})`,
    })
    .where(and(
      eq(tasks.testerId, testerId),
      eq(tasks.done, "false"),
      lt(tasks.dueDate, today),
    ))
    .returning({ id: tasks.id });
  res.json({ rolled: rolled.length });
});

// POST /tasks
router.post("/tasks", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const { title, notes, dueDate, bestWindowType, estMinutes, energy, goalId, projectId, milestoneId, sortOrder, planet } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  // Diagnose the task's ruling planet from its title so specific tasks under a
  // star each time to their own planet ("write the plan" reads Mercury even on
  // a Mars star). An explicit planet from the client wins.
  const diagnosedPlanet = planet ?? associateDeterministic(title).planets[0] ?? null;
  const [row] = await db.insert(tasks).values({
    testerId, title, notes, dueDate, bestWindowType, planet: diagnosedPlanet,
    estMinutes: estMinutes ?? null, energy: energy ?? null,
    goalId: goalId ?? null, projectId: projectId ?? null, milestoneId: milestoneId ?? null,
    sortOrder: sortOrder ?? 0,
  }).returning();
  res.status(201).json(row);
});

// PATCH /tasks/:id
router.patch("/tasks/:id", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const id = parseInt(req.params.id);
  const { title, notes, done, dueDate, bestWindowType, estMinutes, energy, goalId, projectId, milestoneId, sortOrder, planet } = req.body;
  const [row] = await db.update(tasks)
    .set({ title, notes, done: done !== undefined ? String(done) : undefined, dueDate, bestWindowType, estMinutes, energy, goalId, projectId, milestoneId, sortOrder, planet, updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.testerId, testerId)))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

// DELETE /tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const id = parseInt(req.params.id);
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.testerId, testerId)));
  res.json({ ok: true });
});

export default router;
