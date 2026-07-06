import { Router, type IRouter } from "express";
import { db, healthLogs, dailyCheckIns, planningWindows } from "@workspace/db";
import { and, eq, desc, gte, lte } from "drizzle-orm";
import {
  ListLogsQueryParams,
  CreateLogBody,
  GetLogParams,
  UpdateLogParams,
  UpdateLogBody,
  DeleteLogParams,
} from "@workspace/api-zod";
import { getAstroSnapshot, moonPhase, julianDay, getDailyElementEmphasis } from "../lib/astro.js";
import { requireTesterId } from "../middlewares/testerId.js";
import { computeNatalChart, computeTransitAspects } from "../lib/natal.js";
import { natalCharts } from "@workspace/db";

const router: IRouter = Router();

router.get("/logs", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { limit, offset } = ListLogsQueryParams.parse(req.query);
  const rows = await db
    .select()
    .from(healthLogs)
    .where(eq(healthLogs.testerId, testerId))
    .orderBy(desc(healthLogs.loggedAt))
    .limit(limit ?? 50)
    .offset(offset ?? 0);
  res.json(rows);
});

router.post("/logs", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const body = CreateLogBody.parse(req.body);
  const astroSnapshot = JSON.stringify(getAstroSnapshot(new Date()));
  // logDate comes from the client (user's local YYYY-MM-DD) — not part of the Zod schema.
  const logDate: string | null = (typeof req.body?.logDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.logDate))
    ? req.body.logDate
    : null;
  const loggedAt = body.loggedAt ? new Date(body.loggedAt) : new Date();
  const baseValues = { ...body, testerId, loggedAt, astroSnapshot };

  let row;
  try {
    // logDate column requires migration: ALTER TABLE health_logs ADD COLUMN log_date text;
    [row] = await db.insert(healthLogs).values({ ...baseValues, logDate }).returning();
  } catch (err: any) {
    if (err?.message?.includes("log_date") || err?.code === "42703") {
      // Column doesn't exist yet — insert without it
      [row] = await db.insert(healthLogs).values(baseValues).returning();
    } else {
      throw err;
    }
  }
  res.status(201).json(row);
});

// NOTE: /logs/day and /logs/timeline are declared later in this file, and
// Express matches in declaration order — this param route would swallow them
// (id="timeline" → ZodError 500). Express 5 dropped regex params, so guard
// by hand: non-numeric ids fall through to the named routes below.
router.get("/logs/:id", requireTesterId, async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) { next(); return; }
  const testerId = res.locals.testerId as string;
  const { id } = GetLogParams.parse(req.params);
  const [row] = await db
    .select()
    .from(healthLogs)
    .where(and(eq(healthLogs.id, id), eq(healthLogs.testerId, testerId)));
  if (!row) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  res.json(row);
});

router.patch("/logs/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = UpdateLogParams.parse(req.params);
  const body = UpdateLogBody.parse(req.body);
  const [row] = await db
    .update(healthLogs)
    .set(body)
    .where(and(eq(healthLogs.id, id), eq(healthLogs.testerId, testerId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  res.json(row);
});

router.delete("/logs/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = DeleteLogParams.parse(req.params);
  await db
    .delete(healthLogs)
    .where(and(eq(healthLogs.id, id), eq(healthLogs.testerId, testerId)));
  res.status(204).end();
});

// Viewer timezone offset in minutes, Date.getTimezoneOffset convention
// (positive = behind UTC). Day boundaries are the viewer's local midnights —
// without this, evening activity in the Americas files under tomorrow.
function tzOffsetMin(req: { query: Record<string, unknown> }): number {
  const raw = parseInt((req.query.tz as string) ?? "", 10);
  return Number.isFinite(raw) ? raw : 0;
}

// Local YYYY-MM-DD → [startUtc, endUtc) for that viewer-local day.
function localDayBounds(date: string, tz: number): [Date, Date] {
  const [year, month, day] = date.split("-").map(Number);
  const startUtc = new Date(Date.UTC(year, month - 1, day) + tz * 60000);
  return [startUtc, new Date(startUtc.getTime() + 86400000)];
}

// UTC instant → the viewer's local YYYY-MM-DD.
function localDateOf(d: Date, tz: number): string {
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

// ── The Log: Day detail view ──────────────────────────────────────────────────
// GET /api/logs/day?date=YYYY-MM-DD&lat=40.7&lon=-74.0&tz=240
// Returns: daily check-in + completed activities + health logs + sky context for that date
router.get("/logs/day", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const date = (req.query.date as string) ?? new Date().toISOString().split("T")[0];
  const tz = tzOffsetMin(req);
  const [dayStart, dayEnd] = localDayBounds(date, tz);

  // Fetch daily check-in for this date
  const [checkIn] = await db
    .select()
    .from(dailyCheckIns)
    .where(and(eq(dailyCheckIns.testerId, testerId), eq(dailyCheckIns.date, date)));

  // Fetch completed planning windows for this date
  const activities = await db
    .select()
    .from(planningWindows)
    .where(
      and(
        eq(planningWindows.testerId, testerId),
        gte(planningWindows.completedAt, dayStart),
        lte(planningWindows.completedAt, dayEnd),
      ),
    )
    .orderBy(desc(planningWindows.completedAt));

  // Fetch health logs for this date
  const healthLogsForDay = await db
    .select()
    .from(healthLogs)
    .where(
      and(
        eq(healthLogs.testerId, testerId),
        gte(healthLogs.loggedAt, dayStart),
        lte(healthLogs.loggedAt, dayEnd),
      ),
    )
    .orderBy(desc(healthLogs.loggedAt));

  // Compute sky context for this date — sampled at local noon (the day's
  // representative middle; also what the timeline uses, so the two agree
  // when the Moon changes signs mid-day).
  const dayDate = new Date(dayStart.getTime() + 12 * 3600000);
  const phaseData = moonPhase(julianDay(dayDate));
  const element = getDailyElementEmphasis(julianDay(dayDate));
  let personalTransits = null;

  // If user has natal chart, compute their personal transits for this date
  const chart = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0];
  if (chart) {
    const natal = computeNatalChart(chart.birthDate, chart.birthTime, chart.birthLat, chart.birthLon, chart.utcOffset);
    const transits = computeTransitAspects(natal, dayDate);
    personalTransits = transits
      .filter((t) => t.severity === "strong" || t.severity === "major")
      .slice(0, 6);
  }

  res.json({
    date,
    checkIn: checkIn ?? null,
    activities: activities.map((a) => ({
      id: a.id,
      title: a.title,
      windowType: a.windowType,
      completedAt: a.completedAt,
      notes: a.notes,
    })),
    healthLogs: healthLogsForDay.map((h) => ({
      id: h.id,
      type: h.type,
      name: h.activityName ?? h.supplementName ?? h.type,
      mood: h.mood,
      energy: h.energyLevel,
      notes: h.notes,
      loggedAt: h.loggedAt,
    })),
    sky: {
      moonPhase: phaseData.fraction,
      element: element.element,
      personalTransits,
    },
  });
});

// GET /api/logs/timeline?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&tz=240&limit=50&offset=0
// Returns: chronological list of days with one-line summaries. A day appears
// when it has ANY signal — a check-in, a completed activity, or a health log —
// not just check-in days. Three range queries total (no per-day queries).
router.get("/logs/timeline", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const tz = tzOffsetMin(req);
  const startDate = (req.query.startDate as string) ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  })();
  const endDate = (req.query.endDate as string) ?? new Date().toISOString().split("T")[0];
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50"), 500);
  const offset = parseInt((req.query.offset as string) ?? "0");

  const [rangeStart] = localDayBounds(startDate, tz);
  const [, rangeEnd] = localDayBounds(endDate, tz);

  const [checkIns, doneWindows, healthRows] = await Promise.all([
    db.select().from(dailyCheckIns).where(and(
      eq(dailyCheckIns.testerId, testerId),
      gte(dailyCheckIns.date, startDate),
      lte(dailyCheckIns.date, endDate),
    )),
    db.select().from(planningWindows).where(and(
      eq(planningWindows.testerId, testerId),
      gte(planningWindows.completedAt, rangeStart),
      lte(planningWindows.completedAt, rangeEnd),
    )),
    db.select().from(healthLogs).where(and(
      eq(healthLogs.testerId, testerId),
      gte(healthLogs.loggedAt, rangeStart),
      lte(healthLogs.loggedAt, rangeEnd),
    )),
  ]);

  const byDate = new Map<string, {
    checkIn: typeof checkIns[number] | null;
    activitiesCount: number;
    healthCount: number;
  }>();
  const bucket = (date: string) => {
    let b = byDate.get(date);
    if (!b) { b = { checkIn: null, activitiesCount: 0, healthCount: 0 }; byDate.set(date, b); }
    return b;
  };

  for (const ci of checkIns) bucket(ci.date).checkIn = ci;
  for (const w of doneWindows) {
    if (w.completedAt) bucket(localDateOf(w.completedAt, tz)).activitiesCount += 1;
  }
  for (const h of healthRows) {
    bucket(h.logDate ?? localDateOf(h.loggedAt, tz)).healthCount += 1;
  }

  // The felt-rating is stored as behaviorTags entries: felt:aligned, tideChar:deep …
  const feltOf = (ci: typeof checkIns[number] | null) =>
    ci?.behaviorTags?.find((t) => t.startsWith("felt:"))?.slice(5) ?? null;

  const summaries = [...byDate.entries()]
    .filter(([date]) => date >= startDate && date <= endDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(offset, offset + limit)
    .map(([date, b]) => {
      const [dayStart] = localDayBounds(date, tz);
      const noonUtc = new Date(dayStart.getTime() + 12 * 3600000);
      return {
        date,
        element: getDailyElementEmphasis(julianDay(noonUtc)).element,
        mood: b.checkIn?.mood ?? null,
        energy: b.checkIn?.energy ?? null,
        felt: feltOf(b.checkIn),
        notes: b.checkIn?.notes ?? "",
        activitiesCount: b.activitiesCount,
        healthCount: b.healthCount,
      };
    });

  res.json({ summaries, count: summaries.length });
});

export default router;
