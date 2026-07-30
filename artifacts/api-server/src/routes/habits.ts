import { Router } from "express";
import { db } from "@workspace/db";
import { habits, habitLogs } from "@workspace/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import {
  julianDay, moonPhase, getPlanetPositions, getDailyElementEmphasis,
  getPlanetaryHour, getMajorAspects, voidOfCourse, getSunriseSunset,
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

// ── Cadence ───────────────────────────────────────────────────────────────
// How many completions a cadence wants inside a ROLLING 7-day window. Rolling,
// not calendar-week, on purpose: a Monday reset creates a cliff (miss Sunday
// and the week is "lost"), which is exactly the pressure this model exists to
// remove. `occasional` returns 0 — tracked, never scored.
const CADENCES = ["daily", "most_days", "weekly", "occasional"] as const;
type Cadence = (typeof CADENCES)[number];
const normalizeCadence = (v: unknown): Cadence =>
  CADENCES.includes(v as Cadence) ? (v as Cadence) : "daily";

function windowTargetFor(cadence: Cadence, targetPerWeek: number | null): number {
  if (cadence === "daily") return 7;
  if (cadence === "most_days") return 5;
  if (cadence === "weekly") return Math.min(7, Math.max(1, targetPerWeek ?? 3));
  return 0; // occasional
}

const SOLAR_ANCHORS = ["sunrise", "noon", "sunset"] as const;
const normalizeSolarAnchor = (v: unknown): string | null =>
  SOLAR_ANCHORS.includes(v as any) ? (v as string) : null;

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

  // The client's LOCAL date anchors the whole day/streak window — the server's
  // UTC "today" is tomorrow for a US-evening user (the 8pm-ET rollover bug),
  // which visually un-checked habits mid-evening and broke streaks. UTC stays
  // the fallback for old clients only.
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test((req.query.today as string) ?? "")
    ? (req.query.today as string)
    : new Date().toISOString().slice(0, 10);

  // Today's solar events, so a daily anchored to sunrise/noon/sunset can say
  // when that actually is here, today — the body's schedule, not a clock time.
  // Anchored to the CLIENT's local day, not julianDay(now): after 00:00 UTC a
  // US-evening user was being shown tomorrow morning's sunrise as "today's".
  const { sunrise, sunset } = getSunriseSunset(julianDay(new Date(todayStr + "T12:00:00Z")), lat, lon);
  const solarTimes: Record<string, string> = {
    sunrise: sunrise.toISOString(),
    noon: new Date((sunrise.getTime() + sunset.getTime()) / 2).toISOString(),
    sunset: sunset.toISOString(),
  };
  const dayStrAt = (offset: number) => {
    // Date-string arithmetic anchored at noon UTC so the offset math itself
    // can't roll a day.
    const d = new Date(todayStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  // Fetch last 14 days of logs for all habits
  const cutoffStr = dayStrAt(-14);
  const logs = await db.select().from(habitLogs).where(and(eq(habitLogs.testerId, testerId), gte(habitLogs.date, cutoffStr)));

  const logsByHabit = logs.reduce((acc, l) => {
    (acc[l.habitId] ??= new Set()).add(l.date);
    return acc;
  }, {} as Record<number, Set<string>>);

  // Build last-14-day streak array and current streak count
  const enriched = rows.map(h => {
    const doneSet = logsByHabit[h.id] ?? new Set();
    const days = Array.from({ length: 14 }, (_, i) => {
      const ds = dayStrAt(-(13 - i));
      return { date: ds, done: doneSet.has(ds), isToday: ds === todayStr };
    });
    // Current streak: count consecutive done days backwards from yesterday
    let streak = 0;
    for (let i = 12; i >= 0; i--) {
      if (days[i].done) streak++; else break;
    }
    // Cadence progress over the rolling 7 days ending today (inclusive), which
    // is what a non-daily habit should actually be judged against. `days` is
    // ordered oldest→newest, so the last 7 entries are that window.
    const cadence = normalizeCadence((h as any).cadence);
    const windowTarget = windowTargetFor(cadence, (h as any).targetPerWeek ?? null);
    const windowDone = days.slice(-7).filter(d => d.done).length;
    const timing = scoreHabitTiming(h as any, sky);
    const solarAnchor = normalizeSolarAnchor((h as any).solarAnchor);
    return {
      ...h,
      // Normalize the comma-strings to arrays for the client (the merged
      // practices model reads planets/elements as lists).
      favoredElements: csv(h.favoredElements),
      favoredPlanets: csv((h as any).favoredPlanets),
      favoredPhases: csv(h.favoredPhases),
      days, streak, doneToday: doneSet.has(todayStr),
      cadence, windowTarget, windowDone,
      // `occasional` has no target, so it can never be "behind".
      cadenceMet: windowTarget === 0 || windowDone >= windowTarget,
      solarAnchor,
      solarAnchorAt: solarAnchor ? solarTimes[solarAnchor] ?? null : null,
      resonance: timing.match, resonanceNote: timing.note,
    };
  });

  res.json(enriched);
});

// POST /habits
router.post("/habits", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const { name, description, emoji, favoredElements, favoredPhases, favoredPlanets, bestWindowType, minimumViable, goalId, projectId, milestoneId, cadence, targetPerWeek, solarAnchor } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  // Client may send arrays (the merged model) or comma-strings — store as CSV.
  const asCsv = (v: unknown): string | null =>
    Array.isArray(v) ? v.join(",") : (typeof v === "string" && v ? v : null);
  const cad = normalizeCadence(cadence);
  const [row] = await db.insert(habits).values({
    testerId, name, description, emoji,
    favoredElements: asCsv(favoredElements), favoredPhases: asCsv(favoredPhases), favoredPlanets: asCsv(favoredPlanets),
    bestWindowType, minimumViable, goalId: goalId ?? null, projectId: projectId ?? null, milestoneId: milestoneId ?? null,
    cadence: cad,
    // Only a `weekly` habit carries an explicit target; the others are implied
    // by the cadence itself, so storing a number would just go stale.
    targetPerWeek: cad === "weekly" ? Math.min(7, Math.max(1, parseInt(String(targetPerWeek ?? 3), 10) || 3)) : null,
    // A solar anchor only means something for something you do every day.
    solarAnchor: cad === "daily" ? normalizeSolarAnchor(solarAnchor) : null,
  }).returning();
  res.status(201).json(row);
});

// PATCH /habits/:id
router.patch("/habits/:id", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const id = parseInt(req.params.id);
  const { name, description, emoji, favoredElements, favoredPhases, bestWindowType, minimumViable, status, goalId, projectId, cadence, targetPerWeek, solarAnchor } = req.body;
  // Drizzle skips `undefined` in .set(), so absent fields stay untouched — only
  // send the cadence trio when the caller actually supplied a cadence.
  const cadencePatch = cadence === undefined ? {} : (() => {
    const cad = normalizeCadence(cadence);
    return {
      cadence: cad,
      targetPerWeek: cad === "weekly" ? Math.min(7, Math.max(1, parseInt(String(targetPerWeek ?? 3), 10) || 3)) : null,
      solarAnchor: cad === "daily" ? normalizeSolarAnchor(solarAnchor) : null,
    };
  })();
  const [row] = await db.update(habits).set({ name, description, emoji, favoredElements, favoredPhases, bestWindowType, minimumViable, status, goalId, projectId, ...cadencePatch }).where(and(eq(habits.id, id), eq(habits.testerId, testerId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
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
