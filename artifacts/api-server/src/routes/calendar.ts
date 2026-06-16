import { Router, type IRouter } from "express";
import { db, cultivations, cultivationCheckIns, healthLogs } from "@workspace/db";
import { eq, and, gte, lte, desc, or, isNull } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { getAstroSnapshot, getDailyElementEmphasis } from "../lib/astro.js";

const router: IRouter = Router();

// ── GET /api/calendar?month=YYYY-MM ───────────────────────────────────────────
// Returns a day map: { "2025-01-05": { sessions: N, logs: N }, ... }

router.get("/calendar", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const monthParam = (req.query.month as string) ?? new Date().toISOString().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(monthParam)) {
    res.status(400).json({ error: "Invalid month format, expected YYYY-MM" });
    return;
  }

  const [year, month] = monthParam.split("-").map(Number);
  const startDate = `${monthParam}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${monthParam}-${String(lastDay).padStart(2, "0")}`;

  const checkins = await db
    .select({
      date: cultivationCheckIns.date,
      element: cultivations.element,
      elements: cultivations.elements,
    })
    .from(cultivationCheckIns)
    .innerJoin(cultivations, eq(cultivationCheckIns.cultivationId, cultivations.id))
    .where(
      and(
        eq(cultivationCheckIns.testerId, testerId),
        gte(cultivationCheckIns.date, startDate),
        lte(cultivationCheckIns.date, endDate),
        eq(cultivationCheckIns.completed, true),
      ),
    );

  const logs = await db
    .select({ loggedAt: healthLogs.loggedAt, logDate: healthLogs.logDate })
    .from(healthLogs)
    .where(
      and(
        eq(healthLogs.testerId, testerId),
        or(
          and(gte(healthLogs.logDate, startDate), lte(healthLogs.logDate, endDate)),
          and(
            isNull(healthLogs.logDate),
            gte(healthLogs.loggedAt, new Date(`${startDate}T00:00:00.000Z`)),
            lte(healthLogs.loggedAt, new Date(`${endDate}T23:59:59.999Z`)),
          ),
        ),
      ),
    );

  // Tally element occurrences per day to pick the dominant one
  const elementTally: Record<string, Record<string, number>> = {};

  type DayEntry = { sessions: number; logs: number; element: string | null };
  const dayMap: Record<string, DayEntry> = {};

  for (const ci of checkins) {
    dayMap[ci.date] ??= { sessions: 0, logs: 0, element: null };
    dayMap[ci.date].sessions++;

    const el: string = (ci.elements?.[0]) ?? ci.element ?? "earth";
    elementTally[ci.date] ??= {};
    elementTally[ci.date][el] = (elementTally[ci.date][el] ?? 0) + 1;
  }

  // Set dominant element per day
  for (const [date, tally] of Object.entries(elementTally)) {
    const dominant = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    if (dayMap[date]) dayMap[date].element = dominant;
  }

  for (const log of logs) {
    const dateStr = log.logDate ?? log.loggedAt.toISOString().split("T")[0];
    dayMap[dateStr] ??= { sessions: 0, logs: 0, element: null };
    dayMap[dateStr].logs++;
  }

  res.json({ month: monthParam, days: dayMap });
});

// ── GET /api/calendar/:date ───────────────────────────────────────────────────
// Returns all entries for a given YYYY-MM-DD date.

router.get("/calendar/:date", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const dateStr = req.params.date as string;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.status(400).json({ error: "Invalid date format, expected YYYY-MM-DD" });
    return;
  }

  const checkinsRaw = await db
    .select({
      id: cultivationCheckIns.id,
      cultivationId: cultivationCheckIns.cultivationId,
      date: cultivationCheckIns.date,
      completed: cultivationCheckIns.completed,
      note: cultivationCheckIns.note,
      durationMinutes: cultivationCheckIns.durationMinutes,
      effortLevel: cultivationCheckIns.effortLevel,
      cultivationTitle: cultivations.title,
      cultivationDomain: cultivations.domain,
      cultivationElement: cultivations.element,
      cultivationElements: cultivations.elements,
    })
    .from(cultivationCheckIns)
    .innerJoin(cultivations, eq(cultivationCheckIns.cultivationId, cultivations.id))
    .where(and(eq(cultivationCheckIns.testerId, testerId), eq(cultivationCheckIns.date, dateStr)));

  const logsRaw = await db
    .select()
    .from(healthLogs)
    .where(
      and(
        eq(healthLogs.testerId, testerId),
        or(
          eq(healthLogs.logDate, dateStr),
          and(
            isNull(healthLogs.logDate),
            gte(healthLogs.loggedAt, new Date(`${dateStr}T00:00:00.000Z`)),
            lte(healthLogs.loggedAt, new Date(`${dateStr}T23:59:59.999Z`)),
          ),
        ),
      ),
    )
    .orderBy(desc(healthLogs.loggedAt));

  // Auspice context for this date (noon UTC as proxy)
  const dayDate = new Date(`${dateStr}T12:00:00.000Z`);
  const astro = getAstroSnapshot(dayDate);
  const jdNoon = (dayDate.getTime() / 86400000) + 2440587.5;
  const emphasis = getDailyElementEmphasis(jdNoon);
  const rhythm = {
    moonSign: astro.moonSign,
    moonPhase: astro.moonPhase,
    moonFraction: astro.moonFraction,
    sunSign: astro.sunSign,
    voidOfCourse: astro.voidOfCourse,
    element: emphasis.element,
  };

  res.json({ date: dateStr, checkins: checkinsRaw, logs: logsRaw, rhythm });
});

export default router;
