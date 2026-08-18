import { Router } from "express";
import { db } from "@workspace/db";
import { habits, habitLogs } from "@workspace/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  julianDay, moonPhase, getPlanetPositions, getDailyElementEmphasis,
  getPlanetaryHour, getMajorAspects, voidOfCourse, getSunriseSunset,
} from "../lib/astro.js";
// Habit timing lives in a lib, not here: routes/habits.ts imports the database
// at module load, so scoring kept in this file could not be tested without
// provisioning Postgres — and so was not tested at all.
import { csv, phaseQuadrant, scoreHabitTiming } from "../lib/habitTiming.js";

const router = Router();

function tid(req: any, res: any): string | null {
  const id = req.headers["x-tester-id"] as string | undefined;
  if (!id) { res.status(400).json({ error: "Missing x-tester-id header." }); return null; }
  return id;
}


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

// A star list from whatever the client sent: an array of ids, a CSV string, a
// single id, or nothing. Deduped, positive integers only.
const normalizeStarIds = (v: unknown): number[] => {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : v != null ? [v] : [];
  return [...new Set(raw.map(x => parseInt(String(x), 10)).filter(n => Number.isInteger(n) && n > 0))];
};

// "bed" is the person's own time, not the sky's — the server validates it but
// never computes its instant (solarTimes has no entry for it, so solarAnchorAt
// stays null and the client renders the time from the chronotype it already
// holds). Inventing a bedtime server-side would be a fabricated fallback.
const SOLAR_ANCHORS = ["sunrise", "noon", "sunset", "bed"] as const;
const normalizeSolarAnchor = (v: unknown): string | null =>
  SOLAR_ANCHORS.includes(v as any) ? (v as string) : null;

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
/**
 * The two starter dailies — the first thing a new account contains.
 *
 * Structured's best onboarding move, per COMPETITIVE-UX-2026-07-29: an empty
 * habits screen asks a new user to invent a practice before they know what the
 * app does with one. Two real rows make the first interaction EDITING rather
 * than creating, and — because they carry solar anchors — they teach that a
 * daily can move with the season without a word of explanation.
 *
 * IDEMPOTENT, and that is the whole safety story. It seeds only into an account
 * with zero habits, so a double-tap, a remount, or a re-run of onboarding
 * cannot produce four rows. A seed that can double-fire is worse than no seed:
 * the user's first act becomes deleting our mess.
 */
router.post("/habits/seed-starters", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;

  // A plain check-then-insert is NOT idempotent under concurrency, and this
  // route gets called concurrently for real: React StrictMode double-invokes in
  // development, and a double-tap on a slow connection does it in production.
  // Measured before this lock: four concurrent calls produced four rows —
  // "Rise and shine" twice, "Wind down" twice.
  //
  // An advisory lock serialises seeds per tester without a schema change (a
  // unique index would be the other answer, and adding one mid-beta is exactly
  // the kind of migration BACKLOG §9a says to avoid). It is released when the
  // transaction ends, however it ends.
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${testerId}))`);

    const existing = await tx.select({ id: habits.id }).from(habits)
      .where(eq(habits.testerId, testerId)).limit(1);
    if (existing.length) return null;

  // Deliberately plain and obviously editable. These are a starting shape, not
  // a prescription — the copy should invite a rename, not feel precious.
  const starters = [
    {
      name: "Rise and shine", emoji: "☀",
      description: "Anchored to sunrise — it moves with the season. Rename it, or make it yours.",
      solarAnchor: "sunrise",
    },
    {
      name: "Wind down", emoji: "☾",
      description: "Anchored to sunset. Edit or delete freely — these two are just a starting rhythm.",
      solarAnchor: "sunset",
    },
  ];

    return tx.insert(habits).values(starters.map((h) => ({
      testerId, name: h.name, emoji: h.emoji, description: h.description,
      cadence: "daily", solarAnchor: h.solarAnchor, status: "active",
    }))).returning();
  });

  if (!result) { res.json({ seeded: 0, reason: "already has habits" }); return; }
  res.status(201).json({ seeded: result.length, habits: result });
});

router.post("/habits", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const { name, description, emoji, favoredElements, favoredPhases, favoredPlanets, bestWindowType, minimumViable, goalId, goalIds, projectId, milestoneId, cadence, targetPerWeek, solarAnchor, flavor } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  // Client may send arrays (the merged model) or comma-strings — store as CSV.
  const asCsv = (v: unknown): string | null =>
    Array.isArray(v) ? v.join(",") : (typeof v === "string" && v ? v : null);
  // One habit, several stars. `goalIds` (array) is the full list; a legacy
  // single `goalId` is read as a list of one. goalId always mirrors the first
  // entry so no existing reader of the single column ever disagrees.
  const starList = normalizeStarIds(goalIds ?? goalId);
  const cad = normalizeCadence(cadence);
  const [row] = await db.insert(habits).values({
    testerId, name, description, emoji,
    favoredElements: asCsv(favoredElements), favoredPhases: asCsv(favoredPhases), favoredPlanets: asCsv(favoredPlanets),
    bestWindowType, minimumViable,
    goalId: starList[0] ?? null, starIds: starList.length ? starList.join(",") : null,
    projectId: projectId ?? null, milestoneId: milestoneId ?? null,
    cadence: cad,
    // Only a `weekly` habit carries an explicit target; the others are implied
    // by the cadence itself, so storing a number would just go stale.
    targetPerWeek: cad === "weekly" ? Math.min(7, Math.max(1, parseInt(String(targetPerWeek ?? 3), 10) || 3)) : null,
    // Any cadence can anchor to the day (owner 2026-08-16: "doing habits at
    // sunrise, noon, sunset, or before bed") — a 3×/week run at sunrise is
    // as real an anchor as a daily one. The old daily-only rule is gone.
    solarAnchor: normalizeSolarAnchor(solarAnchor),
    // "chore" is the only flavor; anything else is a practice (null).
    flavor: flavor === "chore" ? "chore" : null,
  }).returning();
  res.status(201).json(row);
});

// PATCH /habits/:id
router.patch("/habits/:id", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const id = parseInt(req.params.id);
  const { name, description, emoji, favoredElements, favoredPhases, bestWindowType, minimumViable, status, goalId, goalIds, projectId, cadence, targetPerWeek, solarAnchor } = req.body;
  // Drizzle skips `undefined` in .set(), so absent fields stay untouched — only
  // send the cadence pair when the caller actually supplied a cadence.
  const cadencePatch = cadence === undefined ? {} : (() => {
    const cad = normalizeCadence(cadence);
    return {
      cadence: cad,
      targetPerWeek: cad === "weekly" ? Math.min(7, Math.max(1, parseInt(String(targetPerWeek ?? 3), 10) || 3)) : null,
    };
  })();
  // The anchor patches independently of cadence now — any cadence may anchor
  // to the day, and re-anchoring must not require resending the cadence.
  const anchorPatch = solarAnchor === undefined ? {} : { solarAnchor: normalizeSolarAnchor(solarAnchor) };
  // Star links patch as ONE list. Either spelling (goalIds list, legacy
  // goalId single, or explicit null to unlink) writes both columns, so the
  // single-column readers and the list can never disagree.
  const starPatch = (goalIds === undefined && goalId === undefined) ? {} : (() => {
    const list = normalizeStarIds(goalIds ?? goalId);
    return { goalId: list[0] ?? null, starIds: list.length ? list.join(",") : null };
  })();
  const [row] = await db.update(habits).set({ name, description, emoji, favoredElements, favoredPhases, bestWindowType, minimumViable, status, projectId, ...starPatch, ...cadencePatch, ...anchorPatch }).where(and(eq(habits.id, id), eq(habits.testerId, testerId))).returning();
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
