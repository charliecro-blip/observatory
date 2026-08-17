/**
 * Momentum — the daily progress loop's data source (owner 2026-07-17).
 *
 *   GET  /planning/momentum?days=&lat=&lon=&tz=  → the whole loop in one call:
 *        - streak: "days at the helm" (forgiving — one missed day lowers sail
 *          but doesn't sink the run; two does)
 *        - stars[]: per active Guiding Star — next move, TODAY's best window
 *          for its element, steps done/total, wins this week + this lunation
 *        - ledger[]: the wake — auto wins (completed tasks/steps/habits/
 *          sessions, derived from completion timestamps) merged with NAMED
 *          wins, newest first
 *        - cycleStart: the last New Moon (the lunation the cycle counts run on)
 *   POST /planning/wins { text, goalId?, date? }  → name a win
 *
 * Auto wins are derived, never stored — the ledger can't drift from reality.
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { goals, projects, milestones, tasks, habits, habitLogs, planningWindows, wins, intentions, dailyCheckIns } from "@workspace/db/schema";
import { and, eq, gte, desc } from "drizzle-orm";
import { newMoonDates } from "../lib/lunarCycle.js";
import { computeDayArc, findPeakWindows } from "../lib/dayarc.js";

const router: IRouter = Router();

function requireTesterId(req: any, res: any): string | null {
  const t = req.headers["x-tester-id"] as string;
  if (!t) { res.status(401).json({ error: "Missing tester id" }); return null; }
  return t;
}


const localDateOf = (dt: Date | string | null, tzOffsetMin: number): string | null => {
  if (!dt) return null;
  const ms = typeof dt === "string" ? Date.parse(dt) : dt.getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms - tzOffsetMin * 60000).toISOString().slice(0, 10);
};

interface LedgerItem {
  date: string; goalId: number | null; text: string; source: string; winId?: number;
  /** Set on a named win that touches a task/habit — the §-touches join. */
  taskId?: number | null; habitId?: number | null; minutes?: number | null;
}

// Exported so the Studio's cycle card can render the same numbers the app
// shows — one source of truth for the loop.
export async function computeMomentum(testerId: string, tzOffsetMin: number, lat: number, lon: number, days = 70) {
  days = Math.min(120, Math.max(7, days));
  const today = localDateOf(new Date(), tzOffsetMin)!;
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  const [allGoals, allProjects, allMilestones, allTasks, allHabits, hLogs, named, sessions, checkins, allIntentions] = await Promise.all([
    db.select().from(goals).where(eq(goals.testerId, testerId)),
    db.select().from(projects).where(eq(projects.testerId, testerId)),
    db.select().from(milestones).where(eq(milestones.testerId, testerId)),
    db.select().from(tasks).where(eq(tasks.testerId, testerId)),
    db.select().from(habits).where(eq(habits.testerId, testerId)),
    db.select().from(habitLogs).where(and(eq(habitLogs.testerId, testerId), gte(habitLogs.date, sinceDate))),
    db.select().from(wins).where(and(eq(wins.testerId, testerId), gte(wins.date, sinceDate))).orderBy(desc(wins.date)),
    db.select().from(planningWindows).where(eq(planningWindows.testerId, testerId)),
    db.select({ date: dailyCheckIns.date }).from(dailyCheckIns).where(and(eq(dailyCheckIns.testerId, testerId), gte(dailyCheckIns.date, sinceDate))),
    db.select().from(intentions).where(eq(intentions.testerId, testerId)).orderBy(desc(intentions.createdAt)),
  ]);

  const goalTitle = new Map(allGoals.map(g => [g.id, g.title]));
  const projectGoal = new Map(allProjects.map(p => [p.id, p.goalId ?? null]));
  const habitById = new Map(allHabits.map(h => [h.id, h]));

  // ── The wake: derived auto wins + named wins, newest first ─────────────────
  const ledger: LedgerItem[] = [];
  for (const t of allTasks) {
    if (t.done !== "true") continue;
    // `completedAt` if we have it, `updatedAt` only as the legacy fallback.
    // updatedAt moves on ANY edit, so renaming a task finished last month
    // re-dated it as a win today — and any bulk write would flood the ledger.
    // Seeding 42 historical completions surfaced this as "Today's wins · 42".
    const d = localDateOf((t.completedAt ?? t.updatedAt) as any, tzOffsetMin);
    if (!d || d < sinceDate) continue;
    const gid = t.goalId ?? (t.projectId ? projectGoal.get(t.projectId) ?? null : null);
    ledger.push({ date: d, goalId: gid, text: `finished: ${t.title}`, source: "task" });
  }
  for (const m of allMilestones) {
    if (m.status !== "completed") continue;
    const d = localDateOf(m.updatedAt as any, tzOffsetMin);
    if (!d || d < sinceDate) continue;
    ledger.push({ date: d, goalId: projectGoal.get(m.projectId) ?? null, text: `step done: ${m.title}`, source: "step" });
  }
  for (const l of hLogs) {
    const h = habitById.get(l.habitId);
    ledger.push({ date: l.date, goalId: h?.goalId ?? null, text: `kept: ${h?.name ?? "habit"}`, source: "habit" });
  }
  for (const w of sessions) {
    if (!w.completedAt || !w.goalId) continue;
    const d = localDateOf(w.completedAt as any, tzOffsetMin);
    if (!d || d < sinceDate) continue;
    ledger.push({ date: d, goalId: w.goalId, text: `session: ${w.title}`, source: "session" });
  }
  for (const w of named) {
    ledger.push({
      date: w.date, goalId: w.goalId ?? null, text: w.text, source: "named", winId: w.id,
      taskId: w.taskId ?? null, habitId: w.habitId ?? null, minutes: w.minutes ?? null,
    });
  }
  ledger.sort((a, b) => b.date.localeCompare(a.date));

  // ── Days at the helm — forgiving streak over "the loop was touched" ────────
  // A helm day = any win (auto or named) or a daily check-in. One missed day
  // lowers sail (doesn't count, doesn't sink); two consecutive misses end it.
  const activeDays = new Set<string>(ledger.map(l => l.date));
  for (const c of checkins) activeDays.add(c.date);
  let streak = 0;
  let gaps = 0;
  for (let d = 0; d < days; d++) {
    const day = new Date(Date.parse(today + "T12:00:00Z") - d * 86400000).toISOString().slice(0, 10);
    if (activeDays.has(day)) { streak++; gaps = 0; }
    else if (d === 0) { /* today just hasn't happened yet — don't count a gap */ }
    else if (++gaps >= 2) break;
  }

  // ── Per-star: next move, today's best window, progress, win counts ─────────
  const { cycleStart, prevCycleStart } = newMoonDates(tzOffsetMin);
  const weekStart = new Date(Date.parse(today + "T12:00:00Z") - 6 * 86400000).toISOString().slice(0, 10);
  const arc = computeDayArc(new Date(), lat, lon, tzOffsetMin);
  const dayStartMs = new Date(arc.dayStart).getTime();
  const clockOf = (h: number) => {
    const s = new Date(dayStartMs + h * 3600000 - tzOffsetMin * 60000);
    let hh = s.getUTCHours(); const mm = s.getUTCMinutes();
    const ampm = hh >= 12 ? "PM" : "AM"; hh = hh % 12 || 12;
    return mm === 0 ? `${hh} ${ampm}` : `${hh}:${String(mm).padStart(2, "0")} ${ampm}`;
  };

  const stars = allGoals.filter(g => g.status === "active").map(g => {
    const projIds = allProjects.filter(p => p.goalId === g.id).map(p => p.id);
    const stepsAll = allMilestones.filter(m => projIds.includes(m.projectId));
    const stepsDone = stepsAll.filter(m => m.status === "completed").length;
    const gTasks = allTasks.filter(t =>
      (t.goalId === g.id || (t.projectId != null && projIds.includes(t.projectId))) && t.done !== "true");
    // Next move: the first open task (milestone-ordered work first), else the
    // first un-finished step, else "break it down".
    const nextTask = gTasks.sort((a, b) => (a.milestoneId ?? 1e9) - (b.milestoneId ?? 1e9) || a.id - b.id)[0];
    const nextStep = stepsAll.find(m => m.status !== "completed");
    const nextMove = nextTask ? { kind: "task", id: nextTask.id, title: nextTask.title }
      : nextStep ? { kind: "step", id: nextStep.id, title: nextStep.title }
      : null;
    // Today's best window — from the star's ruling PLANET curve when it has one
    // (Mars-activated hours for a training star), else its element curve, else
    // overall. Planets time more precisely than elements.
    // `g.planet && …` evaluates to "" when planet is an empty string, and ??
    // only catches null/undefined — so an empty planet fed "" to
    // findPeakWindows instead of falling back to the element curve.
    const curve = (g.planet ? arc.curves[`planet:${g.planet}`] : undefined)
      ?? arc.curves[g.element ?? "overall"]
      ?? arc.curve;
    const peak = findPeakWindows(curve, 3, 3)
      .map(p => ({ ...p, startHour: Math.max(p.startHour, 7), endHour: Math.min(p.endHour, 23) }))
      .filter(p => p.endHour - p.startHour >= 1)
      .sort((a, b) => b.peakE - a.peakE)[0] ?? null;
    const gWins = ledger.filter(l => l.goalId === g.id);
    return {
      id: g.id, title: g.title, element: g.element, planet: g.planet ?? null,
      stepsDone, stepsTotal: stepsAll.length,
      openTasks: gTasks.length,
      nextMove,
      bestWindowToday: peak ? { startClock: clockOf(peak.startHour), endClock: clockOf(peak.endHour) } : null,
      winsWeek: gWins.filter(l => l.date >= weekStart).length,
      winsCycle: gWins.filter(l => l.date >= cycleStart).length,
      winsToday: gWins.filter(l => l.date === today).length,
    };
  });

  return {
    today, streak, cycleStart, prevCycleStart, weekStart,
    intentions: allIntentions.filter(i => i.cycleStart === cycleStart),
    prevIntentions: allIntentions.filter(i => i.cycleStart === prevCycleStart),
    winsPrevCycle: ledger.filter(l => l.date >= prevCycleStart && l.date < cycleStart).length,
    winsToday: ledger.filter(l => l.date === today).length,
    winsWeek: ledger.filter(l => l.date >= weekStart).length,
    winsCycle: ledger.filter(l => l.date >= cycleStart).length,
    stars,
    ledger: ledger.slice(0, 200),
  };
}

router.get("/planning/momentum", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const days = parseInt((req.query.days as string) ?? "70", 10);
  res.json(await computeMomentum(testerId, tzOffsetMin, lat, lon, days));
});

// POST /planning/wins — name a win. Any hour, any date, any door: the evening
// harvest, the capture sheet's "did" mode, Home's log-it line, a finished
// session, the Log's backfill box. A win can attach to a star (goalId), a
// task (taskId — that's a TOUCH: worked on, not done), or a habit (habitId),
// and can carry minutes when it came from a timed stretch.
router.post("/planning/wins", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const { text, goalId, taskId, habitId, minutes, date, tz } = req.body ?? {};
  if (!text || !String(text).trim()) { res.status(400).json({ error: "text required" }); return; }
  const tzOffsetMin = parseInt(tz, 10) || 0;
  const day = (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
    ? date : localDateOf(new Date(), tzOffsetMin)!;
  const asId = (v: unknown) => Number.isInteger(v) && (v as number) > 0 ? v as number : null;
  const [row] = await db.insert(wins).values({
    testerId, date: day,
    goalId: asId(goalId), taskId: asId(taskId), habitId: asId(habitId),
    minutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(24 * 60, Math.round(minutes)) : null,
    text: String(text).trim().slice(0, 500),
  }).returning();
  res.status(201).json(row);
});

// GET /planning/touches — per task, the dated record of "worked on" (wins
// carrying a taskId, last 14 days). This is what partial progress IS here:
// touches, never gauges. `done` stays binary; no percentage exists to serve.
router.get("/planning/touches", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  const sinceDate = new Date(Date.now() - 14 * 86400000 - tzOffsetMin * 60000).toISOString().slice(0, 10);
  const rows = await db.select().from(wins)
    .where(and(eq(wins.testerId, testerId), gte(wins.date, sinceDate)));
  const touches: Record<string, { dates: string[]; minutes: number }> = {};
  for (const w of rows) {
    if (!w.taskId) continue;
    const t = (touches[w.taskId] ??= { dates: [], minutes: 0 });
    if (!t.dates.includes(w.date)) t.dates.push(w.date);
    t.minutes += w.minutes ?? 0;
  }
  for (const t of Object.values(touches)) t.dates.sort();
  res.json({ touches, since: sinceDate });
});

// POST /planning/intentions — set a New-Moon intention for the current cycle
router.post("/planning/intentions", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const { text, goalId, tz } = req.body ?? {};
  if (!text || !String(text).trim()) { res.status(400).json({ error: "text required" }); return; }
  const tzOffsetMin = parseInt(tz, 10) || 0;
  const { cycleStart } = newMoonDates(tzOffsetMin);
  const [row] = await db.insert(intentions).values({
    testerId, cycleStart, goalId: goalId ?? null, text: String(text).trim().slice(0, 500),
  }).returning();
  res.status(201).json(row);
});

// DELETE /planning/wins/:id — un-name a win (typos happen)
router.delete("/planning/wins/:id", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const id = parseInt(req.params.id, 10);
  await db.delete(wins).where(and(eq(wins.id, id), eq(wins.testerId, testerId)));
  res.json({ ok: true });
});

export default router;
