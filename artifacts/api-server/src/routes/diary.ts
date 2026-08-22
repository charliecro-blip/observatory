/**
 * THE DIARY — workings. Set an intention, stamp the sky, come back and say
 * how it went. GET lists, POST sets, PATCH closes, DELETE removes.
 *
 * The sky stamp is the literal layer only: signs, phase, the hour's ruler
 * where location is known, and the moment's qualifiers (eclipse corridor,
 * a node, a station…). Facts, not a reading — the reading is the person's.
 */
import { Router, type IRouter } from "express";
import { db, workings } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { julianDay, getPlanetPositions, moonPhase, voidOfCourse, getPlanetaryHour, getSunriseSunset } from "../lib/astro.js";
import { computeQualifiers } from "../lib/qualifiers.js";

const router: IRouter = Router();

function stampSky(now: Date, lat?: number, lon?: number) {
  const jd = julianDay(now);
  const planets = getPlanetPositions(jd);
  const sun = planets.find(p => p.planet === "Sun")!, moon = planets.find(p => p.planet === "Moon")!;
  const { name: phase } = moonPhase(jd);
  const { voc } = voidOfCourse(jd);
  let hour: string | null = null;
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    try {
      const polar = getSunriseSunset(jd, lat!, lon!).polar;
      if (!polar) hour = getPlanetaryHour(now, lat!, lon!).ruler;
    } catch { /* no hour */ }
  }
  const qualifiers = computeQualifiers(jd, planets, { voc }).map(q => ({ key: q.key, literal: q.literal, plain: q.plain }));
  return {
    at: now.toISOString(),
    sun: `${sun.sign} ${sun.degree.toFixed(1)}°`,
    moon: `${moon.sign} ${moon.degree.toFixed(1)}°`,
    phase, voc, hour,
    retrograde: planets.filter(p => p.retrograde).map(p => p.planet),
    qualifiers,
  };
}

router.get("/diary", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const rows = await db.select().from(workings).where(eq(workings.testerId, testerId)).orderBy(desc(workings.createdAt)).limit(200);
  res.json({ workings: rows });
});

router.post("/diary", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { intention, date, goalId, taskId, habitId, lat, lon } = req.body ?? {};
  if (typeof intention !== "string" || !intention.trim() || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "intention and date (YYYY-MM-DD) required" });
    return;
  }
  const [row] = await db.insert(workings).values({
    testerId, date, intention: intention.trim().slice(0, 4000),
    goalId: Number.isInteger(goalId) ? goalId : null,
    taskId: Number.isInteger(taskId) ? taskId : null,
    habitId: Number.isInteger(habitId) ? habitId : null,
    skyStamp: stampSky(new Date(), typeof lat === "number" ? lat : undefined, typeof lon === "number" ? lon : undefined),
  }).returning();
  res.status(201).json(row);
});

router.patch("/diary/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(String(req.params.id), 10);
  const { outcome, felt, intention } = req.body ?? {};
  const set: Record<string, unknown> = {};
  if (typeof outcome === "string") { set.outcome = outcome.trim().slice(0, 4000) || null; set.outcomeAt = new Date(); }
  if (felt === null || ["aligned", "mixed", "off"].includes(felt)) set.felt = felt;
  if (typeof intention === "string" && intention.trim()) set.intention = intention.trim().slice(0, 4000);
  if (!Object.keys(set).length) { res.status(400).json({ error: "nothing to change" }); return; }
  const [row] = await db.update(workings).set(set).where(and(eq(workings.id, id), eq(workings.testerId, testerId))).returning();
  if (!row) { res.status(404).json({ error: "not found" }); return; }
  res.json(row);
});

router.delete("/diary/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(String(req.params.id), 10);
  await db.delete(workings).where(and(eq(workings.id, id), eq(workings.testerId, testerId)));
  res.json({ ok: true });
});

export default router;

