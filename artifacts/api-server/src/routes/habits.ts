import { Router } from "express";
import { db } from "@workspace/db";
import { habits, habitLogs } from "@workspace/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import {
  julianDay, moonPhase, getPlanetPositions, getDailyElementEmphasis,
  getPlanetaryHour, getMajorAspects, voidOfCourse,
} from "../lib/astro.js";

const router = Router();

function tid(req: any, res: any): string | null {
  const id = req.headers["x-tester-id"] as string | undefined;
  if (!id) { res.status(400).json({ error: "Missing x-tester-id header." }); return null; }
  return id;
}

// Habits absorbed the old "practices/cultivations" timing model (2026-07-09
// merge): each habit is scored against the current sky the way cultivations
// were, so ONE daily-doing surface carries both the streak game and the timing
// intelligence.
function phaseQuadrant(name: string): string {
  if (name.includes("New")) return "new";
  if (name.includes("Waxing")) return "waxing";
  if (name.includes("Full")) return "full";
  return "waning";
}
const csv = (v: unknown): string[] =>
  String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function scoreHabitTiming(
  h: { favoredElements: string | null; favoredPhases: string | null; favoredPlanets?: string | null; minimumViable: string | null },
  sky: { element: string; hourRuler: string; phase: string; voc: boolean; moonApplyingTo: Set<string>; retro: Set<string> },
): { match: string; note: string } {
  const elems = csv(h.favoredElements);
  const phases = csv(h.favoredPhases);
  const favored = csv(h.favoredPlanets);
  let score = 0;
  const why: string[] = [];
  if (elems.includes(sky.element)) { score += 3; why.push(`it's a ${sky.element} day`); }
  if (favored.includes(sky.hourRuler)) { score += 2; why.push(`${sky.hourRuler}'s hour is running`); }
  for (const fp of favored) {
    if (sky.moonApplyingTo.has(fp)) { score += 1; why.push(`the Moon is lighting up ${fp}`); }
    if (sky.retro.has(fp)) { score -= 1; }
  }
  if (phases.includes(sky.phase)) { score += 1; why.push(`the ${sky.phase} moon favors it`); }
  if (sky.voc) score -= 1;

  const match = score >= 5 ? "resonant" : score >= 2 ? "supported" : score >= 0 ? "neutral" : score >= -2 ? "soften" : "protect";
  const note =
    match === "resonant" ? `Strongly backed right now — ${why[0] ?? "the sky is with it"}.`
    : match === "supported" ? `Supported today${why[0] ? ` — ${why[0]}` : ""}.`
    : match === "neutral" ? "A neutral day for this — do it if you feel like it."
    : `Consider the minimum today${h.minimumViable ? `: ${h.minimumViable}` : ""}.`;
  return { match, note };
}

// GET /habits — list active habits with recent streak (last 14 days) + how
// each one sits against today's sky (the merged practices timing).
router.get("/habits", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const rows = await db.select().from(habits).where(and(eq(habits.testerId, testerId), eq(habits.status, "active"))).orderBy(habits.createdAt);

  // Current sky snapshot for timing resonance
  const nowDate = new Date();
  const jd = julianDay(nowDate);
  const elem = getDailyElementEmphasis(jd).element;
  const hourRuler = getPlanetaryHour(nowDate, lat, lon).ruler;
  const { name: phaseName } = moonPhase(jd);
  const planets = getPlanetPositions(jd);
  const retro = new Set(planets.filter((p) => p.retrograde).map((p) => p.planet));
  const moonAspects = getMajorAspects(jd).filter((a) => a.planet1 === "Moon" || a.planet2 === "Moon");
  const moonApplyingTo = new Set(moonAspects.filter((a) => a.applying).map((a) => (a.planet1 === "Moon" ? a.planet2 : a.planet1)));
  const sky = { element: elem, hourRuler, phase: phaseQuadrant(phaseName), voc: voidOfCourse(jd).voc, moonApplyingTo, retro };

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
    const timing = scoreHabitTiming(h as any, sky);
    return {
      ...h,
      // Normalize the comma-strings to arrays for the client (the merged
      // practices model reads planets/elements as lists).
      favoredElements: csv(h.favoredElements),
      favoredPlanets: csv((h as any).favoredPlanets),
      favoredPhases: csv(h.favoredPhases),
      days, streak, doneToday: doneSet.has(today.toISOString().slice(0, 10)),
      resonance: timing.match, resonanceNote: timing.note,
    };
  });

  res.json(enriched);
});

// POST /habits
router.post("/habits", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const { name, description, emoji, favoredElements, favoredPhases, favoredPlanets, bestWindowType, minimumViable, goalId, projectId, milestoneId } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  // Client may send arrays (the merged model) or comma-strings — store as CSV.
  const asCsv = (v: unknown) => Array.isArray(v) ? v.join(",") : (v ?? null);
  const [row] = await db.insert(habits).values({
    testerId, name, description, emoji,
    favoredElements: asCsv(favoredElements), favoredPhases: asCsv(favoredPhases), favoredPlanets: asCsv(favoredPlanets),
    bestWindowType, minimumViable, goalId: goalId ?? null, projectId: projectId ?? null, milestoneId: milestoneId ?? null,
  }).returning();
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
