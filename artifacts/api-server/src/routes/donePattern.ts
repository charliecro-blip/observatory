/**
 * GET /check-ins/done-pattern?days=60&today=YYYY-MM-DD&tz=
 *
 * What you actually GET DONE on each kind of day — the behavioural replacement
 * for the felt rating.
 *
 * The felt rating asked people to grade a day aligned/mixed/off and then showed
 * that back to them. Two problems with it as evidence, on top of costing thirty
 * seconds a day:
 *
 *   · It was write-only. Traced 2026-07-31: zero references in electionEngine,
 *     election, synthesis, dayarc, interpretation or plan. It changed no
 *     recommendation anywhere.
 *   · It is confounded by its own advice. The app says "a Deep day — rest",
 *     you rest, and it asks whether that felt right. Agreement there is
 *     compliance, not evidence.
 *
 * Completions are not self-report and nobody was told to produce them. They
 * cost the user nothing.
 *
 * SAME EPISTEMIC RULES as the felt pattern, because they were the right ones:
 * silent below a floor of evidence, always shows the counts and the date range,
 * always gives the comparison against other days, and describes what HAPPENED
 * rather than what a day causes.
 */
import { Router, type IRouter } from "express";
import { db, tasks, habitLogs, planningWindows } from "@workspace/db";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { julianDay, getDailyElementEmphasis, voidOfCourse } from "../lib/astro.js";

const router: IRouter = Router();

const CHARACTER_OF: Record<string, string> = {
  fire: "surge", earth: "building", air: "clear", water: "deep",
};

/** The sky's character for a local date, sampled at local noon. */
function skyFor(dateStr: string, tzOffsetMin: number): { character: string; voc: boolean } {
  const noonUtcMs = Date.parse(dateStr + "T12:00:00Z") + tzOffsetMin * 60000;
  const jd = julianDay(new Date(noonUtcMs));
  const el = getDailyElementEmphasis(jd);
  return { character: CHARACTER_OF[el.element] ?? "deep", voc: voidOfCourse(jd).voc };
}

router.get("/check-ins/done-pattern", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const days = Math.min(180, Math.max(14, parseInt(String(req.query.days ?? "60"), 10) || 60));
  const tz = parseInt(String(req.query.tz ?? "0"), 10) || 0;
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.today ?? ""))
    ? String(req.query.today) : new Date().toISOString().slice(0, 10);
  const since = (() => {
    const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  })();
  const sinceDate = new Date(since + "T00:00:00Z");

  // The viewer's local day for an instant — a task finished at 9pm CDT belongs
  // to that day, not to tomorrow in UTC. This is the same rule the rest of the
  // app learned the hard way (BACKLOG §1, the UTC day-rollover).
  const localDay = (d: Date | string | null) =>
    d ? new Date(new Date(d).getTime() - tz * 60000).toISOString().slice(0, 10) : null;

  const [doneTasks, logs, wins] = await Promise.all([
    db.select().from(tasks).where(and(
      eq(tasks.testerId, testerId), eq(tasks.done, "true"), isNotNull(tasks.completedAt))),
    db.select().from(habitLogs).where(and(
      eq(habitLogs.testerId, testerId), gte(habitLogs.date, since))),
    db.select().from(planningWindows).where(and(
      eq(planningWindows.testerId, testerId), isNotNull(planningWindows.completedAt),
      gte(planningWindows.startTime, sinceDate))),
  ]);

  // One row per local day that has ANY completion on it.
  const perDay = new Map<string, number>();
  const bump = (day: string | null) => { if (day && day >= since && day <= today) perDay.set(day, (perDay.get(day) ?? 0) + 1); };
  for (const t of doneTasks) bump(localDay(t.completedAt));
  for (const l of logs) bump(l.date);
  for (const w of wins) bump(localDay(w.completedAt));

  // Every day in range, so a day with ZERO completions counts as evidence too —
  // otherwise the pattern only ever sees the days that went well.
  const byCharacter: Record<string, { days: number; active: number; items: number }> = {};
  const voidDays = { days: 0, active: 0, items: 0 };
  const otherDays = { days: 0, active: 0, items: 0 };
  let totalDays = 0, totalActive = 0, totalItems = 0;

  for (let i = 0; i <= days; i++) {
    const d = new Date(sinceDate.getTime() + i * 86400000).toISOString().slice(0, 10);
    if (d > today) break;
    const n = perDay.get(d) ?? 0;
    const sky = skyFor(d, tz);
    totalDays++; totalItems += n; if (n > 0) totalActive++;
    byCharacter[sky.character] ??= { days: 0, active: 0, items: 0 };
    byCharacter[sky.character].days++; byCharacter[sky.character].items += n;
    if (n > 0) byCharacter[sky.character].active++;
    const bucket = sky.voc ? voidDays : otherDays;
    bucket.days++; bucket.items += n; if (n > 0) bucket.active++;
  }

  // Floors, deliberately the same shape as the felt pattern's: a handful of
  // days of one character is an anecdote. Below these we say NOTHING, rather
  // than something shaped like a finding.
  const MIN_PER_CHARACTER = 5;
  const MIN_TOTAL_ACTIVE = 8;

  const characters = Object.entries(byCharacter)
    .filter(([, v]) => v.days >= MIN_PER_CHARACTER)
    .map(([character, v]) => ({
      character, days: v.days, activeDays: v.active, items: v.items,
      perDay: v.days ? v.items / v.days : 0,
      // The comparison that makes a number mean anything: the same rate across
      // every other day in the window.
      otherDays: totalDays - v.days,
      otherPerDay: totalDays - v.days > 0 ? (totalItems - v.items) / (totalDays - v.days) : null,
    }))
    .sort((a, b) => b.perDay - a.perDay);

  res.json({
    enough: totalActive >= MIN_TOTAL_ACTIVE && characters.length >= 2,
    daysObserved: totalDays,
    activeDays: totalActive,
    itemsCompleted: totalItems,
    range: { from: since, to: today },
    characters,
    // The owner's own hypothesis, measurable directly: does less get finished
    // on void days? Reported with both counts so it can be judged, and only
    // when there are enough void days to be worth a sentence.
    voidOfCourse: voidDays.days >= 4 ? {
      days: voidDays.days, perDay: voidDays.items / voidDays.days,
      otherDays: otherDays.days,
      otherPerDay: otherDays.days ? otherDays.items / otherDays.days : null,
    } : null,
    sources: { tasks: doneTasks.length, habits: logs.length, windows: wins.length },
  });
});

export default router;
