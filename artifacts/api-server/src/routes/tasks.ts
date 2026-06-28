import { Router } from "express";
import { db } from "@workspace/db";
import { tasks } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

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
  const rows = await db.select().from(tasks)
    .where(date
      ? and(eq(tasks.testerId, testerId), eq(tasks.dueDate, date))
      : eq(tasks.testerId, testerId))
    .orderBy(tasks.sortOrder, tasks.createdAt);
  res.json(rows);
});

// POST /tasks
router.post("/tasks", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const { title, notes, dueDate, bestWindowType, goalId, projectId, sortOrder } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const [row] = await db.insert(tasks).values({
    testerId, title, notes, dueDate, bestWindowType,
    goalId: goalId ?? null, projectId: projectId ?? null,
    sortOrder: sortOrder ?? 0,
  }).returning();
  res.status(201).json(row);
});

// PATCH /tasks/:id
router.patch("/tasks/:id", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const id = parseInt(req.params.id);
  const { title, notes, done, dueDate, bestWindowType, goalId, projectId, sortOrder } = req.body;
  const [row] = await db.update(tasks)
    .set({ title, notes, done: done !== undefined ? String(done) : undefined, dueDate, bestWindowType, goalId, projectId, sortOrder, updatedAt: new Date() })
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
