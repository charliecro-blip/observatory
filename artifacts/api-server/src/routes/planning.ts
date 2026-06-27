import { Router, type IRouter } from "express";
import { db, goals, projects, milestones, planningWindows } from "@workspace/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

// ── Goals ─────────────────────────────────────────────────────────────────────

router.get("/planning/goals", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const status = req.query.status as string | undefined;
  const conditions = [eq(goals.testerId, testerId)];
  if (status) conditions.push(eq(goals.status, status));
  const rows = await db.select().from(goals).where(and(...conditions)).orderBy(desc(goals.createdAt));
  res.json(rows);
});

router.post("/planning/goals", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { title, description, horizon, status } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  const [inserted] = await db.insert(goals).values({
    testerId, title: title.trim(),
    description: description ?? null,
    horizon: horizon ?? null,
    status: status ?? "active",
  }).returning();
  res.status(201).json(inserted);
});

router.patch("/planning/goals/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Goal not found" }); return; }
  const { title, description, horizon, status } = req.body;
  const updates: Partial<typeof goals.$inferSelect> & { updatedAt: Date } = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (horizon !== undefined) updates.horizon = horizon;
  if (status !== undefined) updates.status = status;
  const [updated] = await db.update(goals).set(updates).where(eq(goals.id, id)).returning();
  res.json(updated);
});

router.delete("/planning/goals/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Goal not found" }); return; }
  await db.delete(goals).where(eq(goals.id, id));
  res.status(204).send();
});

// ── Projects ──────────────────────────────────────────────────────────────────

router.get("/planning/projects", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const status = req.query.status as string | undefined;
  const goalId = req.query.goalId ? parseInt(req.query.goalId as string, 10) : undefined;
  const conditions = [eq(projects.testerId, testerId)];
  if (status) conditions.push(eq(projects.status, status));
  if (goalId) conditions.push(eq(projects.goalId, goalId));
  const rows = await db.select().from(projects).where(and(...conditions)).orderBy(desc(projects.createdAt));
  res.json(rows);
});

router.post("/planning/projects", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { title, description, goalId, status, priority } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  const [inserted] = await db.insert(projects).values({
    testerId, title: title.trim(),
    description: description ?? null,
    goalId: goalId ?? null,
    status: status ?? "active",
    priority: priority ?? "medium",
  }).returning();
  res.status(201).json(inserted);
});

router.patch("/planning/projects/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Project not found" }); return; }
  const { title, description, goalId, status, priority } = req.body;
  const updates: Partial<typeof projects.$inferSelect> & { updatedAt: Date } = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (goalId !== undefined) updates.goalId = goalId;
  if (status !== undefined) updates.status = status;
  if (priority !== undefined) updates.priority = priority;
  const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
  res.json(updated);
});

router.delete("/planning/projects/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Project not found" }); return; }
  await db.delete(milestones).where(eq(milestones.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  res.status(204).send();
});

// ── Milestones ────────────────────────────────────────────────────────────────

router.get("/planning/milestones", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
  const conditions = [eq(milestones.testerId, testerId)];
  if (projectId) conditions.push(eq(milestones.projectId, projectId));
  const rows = await db.select().from(milestones).where(and(...conditions)).orderBy(desc(milestones.createdAt));
  res.json(rows);
});

router.post("/planning/milestones", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { title, description, projectId, targetDate, status } = req.body;
  if (!title?.trim() || !projectId) { res.status(400).json({ error: "title and projectId are required" }); return; }
  const [inserted] = await db.insert(milestones).values({
    testerId, title: title.trim(),
    description: description ?? null,
    projectId: parseInt(projectId, 10),
    targetDate: targetDate ?? null,
    status: status ?? "pending",
  }).returning();
  res.status(201).json(inserted);
});

router.patch("/planning/milestones/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(milestones).where(and(eq(milestones.id, id), eq(milestones.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Milestone not found" }); return; }
  const { title, description, targetDate, status } = req.body;
  const updates: Partial<typeof milestones.$inferSelect> & { updatedAt: Date } = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (targetDate !== undefined) updates.targetDate = targetDate;
  if (status !== undefined) updates.status = status;
  const [updated] = await db.update(milestones).set(updates).where(eq(milestones.id, id)).returning();
  res.json(updated);
});

router.delete("/planning/milestones/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(milestones).where(and(eq(milestones.id, id), eq(milestones.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Milestone not found" }); return; }
  await db.delete(milestones).where(eq(milestones.id, id));
  res.status(204).send();
});

// ── Planning Windows ──────────────────────────────────────────────────────────

router.get("/planning/windows", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const date = req.query.date as string | undefined; // YYYY-MM-DD filter for a specific day
  const conditions = [eq(planningWindows.testerId, testerId)];
  if (date) {
    const dayStart = new Date(date + "T00:00:00.000Z");
    const dayEnd = new Date(date + "T23:59:59.999Z");
    conditions.push(gte(planningWindows.startTime, dayStart));
    conditions.push(lte(planningWindows.startTime, dayEnd));
  }
  const rows = await db.select().from(planningWindows).where(and(...conditions)).orderBy(planningWindows.startTime);
  res.json(rows);
});

router.post("/planning/windows", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { title, windowType, startTime, endTime, projectId, notes } = req.body;
  if (!title?.trim() || !startTime || !endTime) {
    res.status(400).json({ error: "title, startTime, and endTime are required" }); return;
  }
  const [inserted] = await db.insert(planningWindows).values({
    testerId, title: title.trim(),
    windowType: windowType ?? "deep_work",
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    projectId: projectId ?? null,
    notes: notes ?? null,
  }).returning();
  res.status(201).json(inserted);
});

router.patch("/planning/windows/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(planningWindows).where(and(eq(planningWindows.id, id), eq(planningWindows.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Window not found" }); return; }
  const { title, windowType, startTime, endTime, projectId, notes } = req.body;
  const updates: Partial<typeof planningWindows.$inferSelect> & { updatedAt: Date } = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (windowType !== undefined) updates.windowType = windowType;
  if (startTime !== undefined) updates.startTime = new Date(startTime);
  if (endTime !== undefined) updates.endTime = new Date(endTime);
  if (projectId !== undefined) updates.projectId = projectId;
  if (notes !== undefined) updates.notes = notes;
  const [updated] = await db.update(planningWindows).set(updates).where(eq(planningWindows.id, id)).returning();
  res.json(updated);
});

router.delete("/planning/windows/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(planningWindows).where(and(eq(planningWindows.id, id), eq(planningWindows.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Window not found" }); return; }
  await db.delete(planningWindows).where(eq(planningWindows.id, id));
  res.status(204).send();
});

export default router;
