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
import { goals, projects, milestones, tasks, habits, habitLogs, planningWindows, wins, dailyCheckIns } from "@workspace/db/schema";
import { and, eq, gte, desc } from "drizzle-orm";
import { julianDay, moonLongitude, sunLongitude } from "../lib/astro.js";
import { computeDayArc, findPeakWindows } from "../lib/dayarc.js";

const router: IRouter = Router();

function requireTesterId(req: any, res: any): string | null {
  const t = req.headers["x-tester-id"] as string;
  if (!t) { res.status(401).json({ error: "Missing tester id" }); return null; }
  return t;
}

const elongation = (jd: number) => (((moonLongitude(jd) - sunLongitude(jd)) % 360) + 360) % 360;

// Most recent New Moon: walk back day by day until the elongation wraps.
function lastNewMoonDate(tzOffsetMin: number): string {
  const now = Date.now();
  let prev = elongation(julianDay(new Date(now)));
  for (let d = 1; d <= 31; d++) {
    const t = now - d * 86400000;
    const e = elongation(julianDay(new Date(t)));
    if (e > prev) {
      // elongation increased going BACK in time → we just crossed 0 (new moon
      // fell between d and d-1 days ago); call the later day the cycle start.
      return new Date(now - (d - 1) * 86400000 - tzOffsetMin * 60000).toISOString().slice(0, 10);
    }
    prev = e;
  }
  return new Date(now - 29 * 86400000 - tzOffsetMin * 60000).toISOString().slice(0, 10);
}

const localDateOf = (dt: Date | string | null, tzOffsetMin: number): string | null => {
  if (!dt) return null;
  const ms = typeof dt === "string" ? Date.parse(dt) : dt.getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms - tzOffsetMin * 60000).toISOString().slice(0, 10);
};

interface LedgerItem { date: string; goalId: number | null; text: string; source: string; winId?: number }

router.get("/planning/momentum", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const days = Math.min(120, Math.max(7, parseInt((req.query.days as string) ?? "45", 10)));
  const today = localDateOf(new Date(), tzOffsetMin)!;
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  const [allGoals, allProjects, allMilestones, allTasks, allHabits, hLogs, named, sessions, checkins] = await Promise.all([
    db.select().from(goals).where(eq(goals.testerId, testerId)),
    db.select().from(projects).where(eq(projects.testerId, testerId)),
    db.select().from(milestones).where(eq(milestones.testerId, testerId)),
    db.select().from(tasks).where(eq(tasks.testerId, testerId)),
    db.select().from(habits).where(eq(habits.testerId, testerId)),
    db.select().from(habitLogs).where(and(eq(habitLogs.testerId, testerId), gte(habitLogs.date, sinceDate))),
    db.select().from(wins).where(and(eq(wins.testerId, testerId), gte(wins.date, sinceDate))).orderBy(desc(wins.date)),
    db.select().from(planningWindows).where(eq(planningWindows.testerId, testerId)),
    db.select({ date: dailyCheckIns.date }).from(dailyCheckIns).where(and(eq(dailyCheckIns.testerId, testerId), gte(dailyCheckIns.date, sinceDate))),
  ]);

  const goalTitle = new Map(allGoals.map(g => [g.id, g.title]));
  const projectGoal = new Map(allProjects.map(p => [p.id, p.goalId ?? null]));
  const habitById = new Map(allHabits.map(h => [h.id, h]));

  // ── The wake: derived auto wins + named wins, newest first ─────────────────
  const ledger: LedgerItem[] = [];
  for (const t of allTasks) {
    if (t.done !== "true") continue;
    const d = localDateOf(t.updatedAt as any, tzOffsetMin);
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
    ledger.push({ date: w.date, goalId: w.goalId ?? null, text: w.text, source: "named", winId: w.id });
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
  const cycleStart = lastNewMoonDate(tzOffsetMin);
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
    // Today's best window for the star's element — waking hours, from the same
    // lens curves the tide chart uses.
    const curve = arc.curves[g.element ?? "overall"] ?? arc.curve;
    const peak = findPeakWindows(curve, 3, 3)
      .map(p => ({ ...p, startHour: Math.max(p.startHour, 7), endHour: Math.min(p.endHour, 23) }))
      .filter(p => p.endHour - p.startHour >= 1)
      .sort((a, b) => b.peakE - a.peakE)[0] ?? null;
    const gWins = ledger.filter(l => l.goalId === g.id);
    return {
      id: g.id, title: g.title, element: g.element,
      stepsDone, stepsTotal: stepsAll.length,
      openTasks: gTasks.length,
      nextMove,
      bestWindowToday: peak ? { startClock: clockOf(peak.startHour), endClock: clockOf(peak.endHour) } : null,
      winsWeek: gWins.filter(l => l.date >= weekStart).length,
      winsCycle: gWins.filter(l => l.date >= cycleStart).length,
      winsToday: gWins.filter(l => l.date === today).length,
    };
  });

  res.json({
    today, streak, cycleStart, weekStart,
    winsToday: ledger.filter(l => l.date === today).length,
    winsWeek: ledger.filter(l => l.date >= weekStart).length,
    winsCycle: ledger.filter(l => l.date >= cycleStart).length,
    stars,
    ledger: ledger.slice(0, 200),
  });
});

// POST /planning/wins — name a win (the evening harvest's written line)
router.post("/planning/wins", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const { text, goalId, date, tz } = req.body ?? {};
  if (!text || !String(text).trim()) { res.status(400).json({ error: "text required" }); return; }
  const tzOffsetMin = parseInt(tz, 10) || 0;
  const day = (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
    ? date : localDateOf(new Date(), tzOffsetMin)!;
  const [row] = await db.insert(wins).values({
    testerId, date: day, goalId: goalId ?? null, text: String(text).trim().slice(0, 500),
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
