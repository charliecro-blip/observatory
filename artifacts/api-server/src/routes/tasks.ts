import { Router } from "express";
import { db } from "@workspace/db";
import { tasks } from "@workspace/db/schema";
import { eq, and, desc, lt, isNull, isNotNull, sql } from "drizzle-orm";
import { associateDeterministic } from "../lib/associate.js";
import { openai, isOpenAiConfigured } from "@workspace/integrations-openai-ai-server";

const router = Router();

function requireTesterId(req: any, res: any): string | null {
  const id = req.headers["x-tester-id"] as string | undefined;
  if (!id) { res.status(400).json({ error: "Missing x-tester-id header." }); return null; }
  return id;
}

// GET /tasks
// SORTING FIELDS (plan Part B). Each is optional: absent leaves the stored
// value alone, null or "" clears it, anything else is validated. Clearing
// `parkedAs` clears its waiting details with it, since "waiting on Sam" means
// nothing once a task is back in play.
const PARKED = new Set(["someday", "waiting"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
type SortingSet = { nextStep?: string | null; context?: string | null; parkedAs?: string | null; waitingOn?: string | null; checkBackOn?: string | null };
function sortingFields(body: Record<string, unknown>): { set: SortingSet } | { error: string } {
  const set: SortingSet = {};
  const text = (key: "nextStep" | "context" | "waitingOn", max: number): string | null => {
    if (!(key in body)) return null;
    const v = body[key];
    if (v === null || v === "") { set[key] = null; return null; }
    if (typeof v !== "string" || v.trim().length > max) return `${key} must be text of at most ${max} characters`;
    set[key] = v.trim();
    return null;
  };
  const bad = text("nextStep", 300) ?? text("context", 40) ?? text("waitingOn", 120);
  if (bad) return { error: bad };
  if ("parkedAs" in body) {
    const v = body.parkedAs;
    if (v === null || v === "") { set.parkedAs = null; set.waitingOn = null; set.checkBackOn = null; }
    else if (typeof v === "string" && PARKED.has(v)) set.parkedAs = v;
    else return { error: "parkedAs must be someday, waiting, or null" };
  }
  if ("checkBackOn" in body && set.checkBackOn === undefined) {
    const v = body.checkBackOn;
    if (v === null || v === "") set.checkBackOn = null;
    else if (typeof v === "string" && ISO_DATE.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`))) set.checkBackOn = v;
    else return { error: "checkBackOn must be a date (YYYY-MM-DD) or null" };
  }
  return { set };
}

/**
 * A parent link (plan Part B, T3), checked: the parent must be the same
 * person's, must not be the task itself, and must not itself be a step, since
 * steps are one level deep. `undefined` leaves the link alone, null clears it.
 */
async function parentField(testerId: string, body: Record<string, unknown>, selfId: number | null): Promise<{ parentId?: number | null } | { error: string }> {
  if (!("parentId" in body)) return {};
  const v = body.parentId;
  if (v === null) return { parentId: null };
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0 || v === selfId) return { error: "parentId must be another task's id, or null" };
  const [parent] = await db.select({ id: tasks.id, parentId: tasks.parentId }).from(tasks).where(and(eq(tasks.id, v), eq(tasks.testerId, testerId))).limit(1);
  if (!parent) return { error: "no such parent task" };
  if (parent.parentId != null) return { error: "a step can't hold steps of its own" };
  if (selfId != null) {
    const [kid] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.parentId, selfId), eq(tasks.testerId, testerId))).limit(1);
    if (kid) return { error: "a task with steps can't become a step" };
  }
  return { parentId: v };
}

router.get("/tasks", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const date = req.query.date as string | undefined;
  const goalId = req.query.goalId ? parseInt(req.query.goalId as string, 10) : undefined;
  const milestoneId = req.query.milestoneId ? parseInt(req.query.milestoneId as string, 10) : undefined;
  const conds = [eq(tasks.testerId, testerId)];
  if (goalId) conds.push(eq(tasks.goalId, goalId));
  if (milestoneId) conds.push(eq(tasks.milestoneId, milestoneId));
  // Parked tasks (someday, waiting on someone) are out of every list until
  // put back in play, so they are left out unless asked for: `?parked=include`
  // (the Tasks page, which shows them in their own section) or `only`.
  if (req.query.parked === "only") conds.push(isNotNull(tasks.parkedAs));
  else if (req.query.parked !== "include") conds.push(isNull(tasks.parkedAs));

  // "TODAY'S TASKS" MEANS DUE TODAY *OR* SCHEDULED TODAY.
  //
  // This filtered on dueDate alone, which quietly excluded everything the
  // weaver places: a task woven into this afternoon carries no deadline
  // unless the user typed one, so its dueDate is null. The whole plan was
  // committed, the windows existed, and Today still said "nothing is on
  // today's list yet — and with nothing to place, the sky has nothing to
  // time" (owner, 2026-08-13). The list was not empty; the question was.
  //
  // A task's scheduled moment lives on its linked planning window, so the
  // day filter has to reach through `planningWindowId`. The viewer's offset
  // decides which instants are "today" — absent it, the local day is
  // unknowable here and only the dueDate half of the question can be
  // answered honestly, which is the pre-existing behaviour.
  if (date) {
    const tzMin = Number.parseInt((req.query.tz as string) ?? "", 10);
    if (Number.isFinite(tzMin)) {
      // getTimezoneOffset() convention: minutes to ADD to local to get UTC.
      const startMs = Date.parse(`${date}T00:00:00Z`) + tzMin * 60000;
      const endMs = startMs + 86400000;
      conds.push(sql`(${tasks.dueDate} = ${date} OR EXISTS (
        SELECT 1 FROM planning_windows pw
        WHERE pw.id = ${tasks.planningWindowId}
          AND pw.start_time >= ${new Date(startMs)}
          AND pw.start_time <  ${new Date(endMs)}
      ))`);
    } else {
      conds.push(eq(tasks.dueDate, date));
    }
  }

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
  const { title, notes, dueDate, bestWindowType, estMinutes, energy, goalId, projectId, milestoneId, sortOrder, planet, activityKey, planningWindowId } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const sorting = sortingFields(req.body);
  if ("error" in sorting) { res.status(400).json({ error: sorting.error }); return; }
  const parent = await parentField(testerId, req.body ?? {}, null);
  if ("error" in parent) { res.status(400).json({ error: parent.error }); return; }
  // Diagnose the task's ruling planet from its title so specific tasks under a
  // star each time to their own planet ("write the plan" reads Mercury even on
  // a Mars star). An explicit planet from the client wins.
  const diagnosedPlanet = planet ?? associateDeterministic(title).planets[0] ?? null;
  const [row] = await db.insert(tasks).values({
    testerId, title, notes, dueDate, bestWindowType, planet: diagnosedPlanet,
    // The client already sent this when a window was chosen at creation; the
    // route simply dropped it, which is why the relation had to be guessed
    // from titles downstream.
    planningWindowId: typeof planningWindowId === "number" ? planningWindowId : null,
    estMinutes: estMinutes ?? null, energy: energy ?? null, activityKey: activityKey ?? null,
    goalId: goalId ?? null, projectId: projectId ?? null, milestoneId: milestoneId ?? null,
    sortOrder: sortOrder ?? 0,
    ...sorting.set,
    ...parent,
  }).returning();
  res.status(201).json(row);
});

// PATCH /tasks/:id
router.patch("/tasks/:id", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const id = parseInt(req.params.id);
  const sorting = sortingFields(req.body);
  if ("error" in sorting) { res.status(400).json({ error: sorting.error }); return; }
  const parent = await parentField(testerId, req.body ?? {}, id);
  if ("error" in parent) { res.status(400).json({ error: parent.error }); return; }
  const { title, notes, done, started, dueDate, bestWindowType, estMinutes, energy, goalId, projectId, milestoneId, sortOrder, planet, activityKey, planningWindowId } = req.body;
  // Stamp the moment it flipped to done, and clear it if it flips back — this
  // is the only record of WHEN work happened. `updatedAt` won't do: it moves
  // on any edit, so a retitled task would look like it was finished today.
  const completedAt = done === undefined ? undefined : (String(done) === "true" ? new Date() : null);
  // Same for starting. The timing engine is stateless and recomputes from the
  // sky every render, so without a start stamp it cannot know you are already
  // mid-way through something and will happily propose switching you off it.
  //
  // Finishing also CLEARS the start: a completed task is not in progress, and
  // leaving the stamp behind would let a finished item keep claiming the
  // "keep going" slot for the rest of its window.
  const startedAt = String(done) === "true" ? null
    : started === undefined ? undefined
    : (String(started) === "true" ? new Date() : null);
  const [row] = await db.update(tasks)
    .set({ title, notes, done: done !== undefined ? String(done) : undefined, completedAt, startedAt, planningWindowId, dueDate, bestWindowType, estMinutes, energy, goalId, projectId, milestoneId, sortOrder, planet, activityKey, ...sorting.set, ...parent, updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.testerId, testerId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// POST /tasks/:id/next-step-suggestion — one suggested next physical action
// (plan Part B, T2). A suggestion, never a write: the client shows it in the
// field and nothing is saved until the person saves it. Without a model
// configured this says so (503) rather than inventing a step from the title.
router.post("/tasks/:id/next-step-suggestion", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const id = parseInt(req.params.id);
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.testerId, testerId))).limit(1);
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  if (!isOpenAiConfigured) { res.status(503).json({ error: "suggestions_unavailable" }); return; }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 60,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You turn a task into the single smallest physical action that starts it: something a person could do in the next five minutes without deciding anything first. " +
            'Reply ONLY with JSON: {"step": "..."}. The step starts with a verb, is under twelve words, lowercase, with no ending punctuation. ' +
            "Name the object when you can infer it. Never restate the task, never give advice, never add a reason. " +
            'Examples: "study herbs" → "open the herbs book to where you stopped"; "call the bank" → "find the number for the bank"; ' +
            '"plan the launch" → "open a blank page titled launch"; "clean the garage" → "carry one box to the curb".',
        },
        { role: "user", content: JSON.stringify({ task: task.title, notes: task.notes ?? undefined }) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const step = String((JSON.parse(raw) as { step?: unknown }).step ?? "").trim().replace(/[.!]+$/, "");
    if (!step || step.length > 120) { res.status(502).json({ error: "no_suggestion" }); return; }
    res.json({ suggestion: step });
  } catch {
    res.status(502).json({ error: "no_suggestion" });
  }
});

// DELETE /tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const id = parseInt(req.params.id);
  // A deleted task's steps are kept as tasks of their own rather than
  // deleted with it: removing a heading should not silently remove work.
  await db.update(tasks).set({ parentId: null }).where(and(eq(tasks.parentId, id), eq(tasks.testerId, testerId)));
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.testerId, testerId)));
  res.json({ ok: true });
});

// POST /tasks/:id/steps-suggestion — a task broken into a few physical steps
// (plan Part B, T3). A suggestion, never a write; the client previews the
// steps and creates the ones kept as child tasks. Without a model this says
// so (503). Unlike the Guiding Star breakdown it has no generic fallback: a
// list of steps that isn't about this task would be invented work.
router.post("/tasks/:id/steps-suggestion", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const id = parseInt(req.params.id);
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.testerId, testerId))).limit(1);
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  if (!isOpenAiConfigured) { res.status(503).json({ error: "suggestions_unavailable" }); return; }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You break one task into the physical steps that would get it done, in order: two to six of them, each something a person could start without deciding anything first. " +
            'Reply ONLY with JSON: {"steps": ["...", "..."]}. Each step starts with a verb, is under ten words, lowercase, with no ending punctuation. ' +
            "Name the objects when you can infer them. No advice, no reasons, no step that only restates the task. If the task is already a single step, return just that one step.",
        },
        { role: "user", content: JSON.stringify({ task: task.title, notes: task.notes ?? undefined, nextStep: task.nextStep ?? undefined }) },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { steps?: unknown };
    const steps = (Array.isArray(parsed.steps) ? parsed.steps : [])
      .map((x) => String(x ?? "").trim().replace(/[.!]+$/, ""))
      .filter((x) => x && x.length <= 120)
      .slice(0, 6);
    if (!steps.length) { res.status(502).json({ error: "no_suggestion" }); return; }
    res.json({ steps });
  } catch {
    res.status(502).json({ error: "no_suggestion" });
  }
});

export default router;
