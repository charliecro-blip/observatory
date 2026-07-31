import { Router, type IRouter } from "express";
import { db, goals, projects, milestones, planningWindows, tasks } from "@workspace/db";
import { eq, and, desc, gte, lte, lt } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// ── AI milestone breakdown ──────────────────────────────────────────────────
// "Break this Guiding Star into steps": propose 4–7 ordered milestones for a
// big aim, each tagged with the element its work lives in (so later weaving
// lands each step's tasks in the right sky windows). Preview only — nothing
// is written until the client commits the accepted steps.
const ELEMS = new Set(["fire", "earth", "air", "water"]);
router.post("/planning/breakdown", requireTesterId, async (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  if (!title) { res.status(400).json({ error: "title required" }); return; }

  const fallback = () => ({
    milestones: [
      { title: "Define what 'done' looks like", element: "air" },
      { title: "Do the groundwork / research", element: "air" },
      { title: "Build the core of it", element: "earth" },
      { title: "Refine and finish", element: "earth" },
      { title: "Share it / put it into the world", element: "fire" },
    ],
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You break a big personal goal into an ordered sequence of 4-7 concrete milestones (steps). " +
            "Reply ONLY with JSON {\"milestones\":[{\"title\": short imperative step, \"element\": one of \"fire\"|\"earth\"|\"air\"|\"water\"}]}. " +
            "element = the KIND of work the step is: fire = launching/pitching/visible action; earth = building/finishing/structured making; " +
            "air = research/writing/planning/communicating; water = reflection/rest/creative-intuitive. " +
            "Order them so each depends on the ones before. Keep titles under 8 words.",
        },
        { role: "user", content: description ? `${title} — ${description}` : title },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const arr = Array.isArray(parsed.milestones) ? parsed.milestones : [];
    if (arr.length === 0) { res.json(fallback()); return; }
    res.json({
      milestones: arr.slice(0, 7).map((m: any) => ({
        title: String(m.title ?? "").trim() || "Step",
        element: ELEMS.has(String(m.element)) ? m.element : "earth",
      })),
    });
  } catch {
    res.json(fallback());
  }
});

// Commit accepted breakdown steps: ensure a backing project for the star, then
// insert the milestones in order. Returns the created milestones.
router.post("/planning/breakdown/commit", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const goalId = parseInt(String(req.body?.goalId ?? ""), 10);
  const steps: any[] = Array.isArray(req.body?.milestones) ? req.body.milestones : [];
  if (!goalId || steps.length === 0) { res.status(400).json({ error: "goalId and milestones required" }); return; }

  const goal = (await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.testerId, testerId))).limit(1))[0];
  if (!goal) { res.status(404).json({ error: "Star not found" }); return; }

  let proj = (await db.select().from(projects).where(and(eq(projects.testerId, testerId), eq(projects.goalId, goalId))).limit(1))[0];
  if (!proj) {
    [proj] = await db.insert(projects).values({ testerId, title: goal.title, goalId }).returning();
  }
  const created = [];
  for (const s of steps.slice(0, 12)) {
    const [m] = await db.insert(milestones).values({
      testerId, projectId: proj.id, title: String(s.title ?? "Step").trim(),
      description: ELEMS.has(String(s.element)) ? `element:${s.element}` : null,
    }).returning();
    created.push(m);
  }
  res.json({ created, count: created.length });
});

// ── Star progress rollup ────────────────────────────────────────────────────
// Turns a Guiding Star into a project: task → step (milestone) → star. Returns,
// per goalId, the milestone breakdown and an overall percent, so the UI can
// draw one progress ring. A step counts done when all its tasks are done (or
// it has no tasks but is marked completed).
router.get("/planning/star-progress", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const [projRows, mileRows, taskRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.testerId, testerId)),
    db.select().from(milestones).where(eq(milestones.testerId, testerId)),
    db.select().from(tasks).where(eq(tasks.testerId, testerId)),
  ]);
  // project.id → goalId (a star's steps live on a backing project, goalId = star.id)
  const projGoal = new Map<number, number>();
  for (const p of projRows) if (p.goalId != null) projGoal.set(p.id, p.goalId);

  // tasks grouped by milestoneId
  const byMile = new Map<number, { done: number; total: number }>();
  for (const t of taskRows) {
    if (t.milestoneId == null) continue;
    const b = byMile.get(t.milestoneId) ?? { done: 0, total: 0 };
    b.total += 1;
    if (t.done === "true") b.done += 1;
    byMile.set(t.milestoneId, b);
  }

  const out: Record<number, { pct: number; tasksDone: number; tasksTotal: number; stepsDone: number; stepsTotal: number; milestones: any[] }> = {};
  for (const m of mileRows) {
    const goalId = projGoal.get(m.projectId);
    if (goalId == null) continue;
    const tc = byMile.get(m.id) ?? { done: 0, total: 0 };
    const stepDone = m.status === "completed" || (tc.total > 0 && tc.done === tc.total);
    const g = out[goalId] ?? { pct: 0, tasksDone: 0, tasksTotal: 0, stepsDone: 0, stepsTotal: 0, milestones: [] };
    g.tasksDone += tc.done; g.tasksTotal += tc.total;
    g.stepsTotal += 1; if (stepDone) g.stepsDone += 1;
    g.milestones.push({ id: m.id, title: m.title, status: m.status, tasksDone: tc.done, tasksTotal: tc.total, done: stepDone });
    out[goalId] = g;
  }
  // Percent: prefer task granularity, fall back to steps when a star has no tasks yet.
  for (const g of Object.values(out)) {
    g.pct = g.tasksTotal > 0 ? Math.round((g.tasksDone / g.tasksTotal) * 100)
      : g.stepsTotal > 0 ? Math.round((g.stepsDone / g.stepsTotal) * 100) : 0;
  }
  res.json(out);
});

// ── Goals ─────────────────────────────────────────────────────────────────────

router.get("/planning/goals", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const status = req.query.status as string | undefined;
  const conditions = [eq(goals.testerId, testerId)];
  if (status) conditions.push(eq(goals.status, status));
  const rows = await db.select().from(goals).where(and(...conditions)).orderBy(desc(goals.createdAt));
  res.json(rows);
});

// Guiding Stars are deliberately few — a max of 5 active at once keeps this a
// focus tool, not a second to-do list.
const MAX_ACTIVE_GUIDING_STARS = 5;

router.post("/planning/goals", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { title, description, horizon, status, element, planet, activityKey, anchorKind, anchorPlanet, anchorHouse, anchorUntil } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  if ((status ?? "active") === "active") {
    const active = await db.select().from(goals).where(and(eq(goals.testerId, testerId), eq(goals.status, "active")));
    if (active.length >= MAX_ACTIVE_GUIDING_STARS) {
      res.status(400).json({ error: "max_guiding_stars", message: `Only ${MAX_ACTIVE_GUIDING_STARS} active Guiding Stars at a time — retire or pause one first.` });
      return;
    }
  }
  const [inserted] = await db.insert(goals).values({
    testerId, title: title.trim(),
    description: description ?? null,
    horizon: horizon ?? null,
    status: status ?? "active",
    element: element ?? null,
    planet: planet ?? null,
    activityKey: activityKey ?? null,
    anchorKind: anchorKind ?? null,
    anchorPlanet: anchorPlanet ?? null,
    anchorHouse: anchorHouse ?? null,
    anchorUntil: anchorUntil ?? null,
  }).returning();
  res.status(201).json(inserted);
});

router.patch("/planning/goals/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Goal not found" }); return; }
  const { title, description, horizon, status, element, planet, activityKey, anchorKind, anchorPlanet, anchorHouse, anchorUntil } = req.body;
  if (status === "active" && existing.status !== "active") {
    const active = await db.select().from(goals).where(and(eq(goals.testerId, testerId), eq(goals.status, "active")));
    if (active.length >= MAX_ACTIVE_GUIDING_STARS) {
      res.status(400).json({ error: "max_guiding_stars", message: `Only ${MAX_ACTIVE_GUIDING_STARS} active Guiding Stars at a time — retire or pause one first.` });
      return;
    }
  }
  const updates: Partial<typeof goals.$inferSelect> & { updatedAt: Date } = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (horizon !== undefined) updates.horizon = horizon;
  if (status !== undefined) updates.status = status;
  if (element !== undefined) updates.element = element;
  if (planet !== undefined) updates.planet = planet;
  if (activityKey !== undefined) updates.activityKey = activityKey;
  if (anchorKind !== undefined) updates.anchorKind = anchorKind;
  if (anchorPlanet !== undefined) updates.anchorPlanet = anchorPlanet;
  if (anchorHouse !== undefined) updates.anchorHouse = anchorHouse;
  if (anchorUntil !== undefined) updates.anchorUntil = anchorUntil;
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
  // Ascending: steps are an ORDERED sequence (each depends on the ones before),
  // so they must display and weave in creation order, not newest-first.
  const rows = await db.select().from(milestones).where(and(...conditions)).orderBy(milestones.createdAt, milestones.id);
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

// ── Guiding Stars overview ──────────────────────────────────────────────────
// Kept at the historical /planning/north-stars path (frontend hook unchanged).

// Active Guiding Stars with this week's sessions (scheduled + completed + ad-hoc),
// in one call — this is what the Now/Ahead surfaces render directly.
router.get("/planning/north-stars", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const stars = await db.select().from(goals)
    .where(and(eq(goals.testerId, testerId), eq(goals.status, "active")))
    .orderBy(desc(goals.createdAt));

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);

  const result = [];
  for (const g of stars) {
    const sessions = await db.select().from(planningWindows).where(and(
      eq(planningWindows.testerId, testerId),
      eq(planningWindows.goalId, g.id),
      gte(planningWindows.startTime, weekStart),
      lte(planningWindows.startTime, weekEnd),
    )).orderBy(planningWindows.startTime);
    result.push({
      ...g,
      sessionsThisWeek: sessions,
      scheduledCount: sessions.filter(s => !s.adHoc).length,
      completedCount: sessions.filter(s => !!s.completedAt).length,
    });
  }
  res.json(result);
});

// ── Planning Windows ──────────────────────────────────────────────────────────

router.get("/planning/windows", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const date = req.query.date as string | undefined; // YYYY-MM-DD — legacy, UTC-bounded
  // The viewer's own local day, as a half-open instant range. The client knows
  // its offset exactly (including DST, since it does calendar arithmetic on a
  // local Date), so it sends the boundaries rather than making the server
  // guess a timezone it was never told.
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const goalId = req.query.goalId ? parseInt(req.query.goalId as string, 10) : undefined;
  const conditions = [eq(planningWindows.testerId, testerId)];
  if (from && to) {
    conditions.push(gte(planningWindows.startTime, new Date(from)));
    // Half-open: a window starting exactly at tomorrow's midnight is tomorrow's.
    conditions.push(lt(planningWindows.startTime, new Date(to)));
  } else if (date) {
    // Shipped bug, kept only as a fallback for a browser still running a cached
    // bundle: these are UTC day bounds applied to a LOCAL calendar date. For a
    // US-Central viewer that shifts the window by 5 hours — measured 2026-07-31,
    // 4 of 7 test windows filed on the wrong day. Everything from 19:00 local
    // onward dropped out of "today" and yesterday's evening appeared in it,
    // which is exactly the band the evening ritual and the cascade read.
    // Same disease as the app-wide UTC rollover fix (BACKLOG §1); this route
    // was missed because its dates live in timestamptz rather than a date string.
    const dayStart = new Date(date + "T00:00:00.000Z");
    const dayEnd = new Date(date + "T23:59:59.999Z");
    conditions.push(gte(planningWindows.startTime, dayStart));
    conditions.push(lte(planningWindows.startTime, dayEnd));
  }
  if (goalId) conditions.push(eq(planningWindows.goalId, goalId));
  const rows = await db.select().from(planningWindows).where(and(...conditions)).orderBy(planningWindows.startTime);
  res.json(rows);
});

router.post("/planning/windows", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { title, windowType, startTime, endTime, projectId, goalId, notes, adHoc } = req.body;
  if (!title?.trim() || !startTime || !endTime) {
    res.status(400).json({ error: "title, startTime, and endTime are required" }); return;
  }
  const [inserted] = await db.insert(planningWindows).values({
    testerId, title: title.trim(),
    windowType: windowType ?? "deep_work",
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    projectId: projectId ?? null,
    goalId: goalId ?? null,
    notes: notes ?? null,
    adHoc: !!adHoc,
    completedAt: adHoc ? new Date() : null, // ad-hoc sessions are logged as already done
  }).returning();
  res.status(201).json(inserted);
});

router.patch("/planning/windows/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(planningWindows).where(and(eq(planningWindows.id, id), eq(planningWindows.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Window not found" }); return; }
  const { title, windowType, startTime, endTime, projectId, goalId, notes } = req.body;
  const updates: Partial<typeof planningWindows.$inferSelect> & { updatedAt: Date } = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (windowType !== undefined) updates.windowType = windowType;
  if (startTime !== undefined) updates.startTime = new Date(startTime);
  if (endTime !== undefined) updates.endTime = new Date(endTime);
  if (projectId !== undefined) updates.projectId = projectId;
  if (goalId !== undefined) updates.goalId = goalId;
  if (notes !== undefined) updates.notes = notes;
  const [updated] = await db.update(planningWindows).set(updates).where(eq(planningWindows.id, id)).returning();
  res.json(updated);
});

// Mark a scheduled session complete (or un-complete it).
router.post("/planning/windows/:id/complete", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(req.params.id as string, 10);
  const existing = (await db.select().from(planningWindows).where(and(eq(planningWindows.id, id), eq(planningWindows.testerId, testerId))).limit(1))[0] ?? null;
  if (!existing) { res.status(404).json({ error: "Window not found" }); return; }
  const done = req.body?.done !== false;
  const [updated] = await db.update(planningWindows)
    .set({ completedAt: done ? new Date() : null, updatedAt: new Date() })
    .where(eq(planningWindows.id, id)).returning();
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
