import { Router, type IRouter } from "express";
import { db, healthLogs, supplements, activities } from "@workspace/db";
import { and, gte, count, avg, sql, desc, eq } from "drizzle-orm";
import { getAstroSnapshot } from "../lib/astro.js";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

router.get("/insights/summary", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);

  const [todayCount] = await db
    .select({ count: count() })
    .from(healthLogs)
    .where(and(eq(healthLogs.testerId, testerId), gte(healthLogs.loggedAt, startOfDay)));

  const [weekCount] = await db
    .select({ count: count() })
    .from(healthLogs)
    .where(and(eq(healthLogs.testerId, testerId), gte(healthLogs.loggedAt, startOfWeek)));

  const [activeSupps] = await db
    .select({ count: count() })
    .from(supplements)
    .where(and(eq(supplements.testerId, testerId), sql`${supplements.active} = true`));

  const [activeActs] = await db
    .select({ count: count() })
    .from(activities)
    .where(and(eq(activities.testerId, testerId), sql`${activities.active} = true`));

  const [moodAvg] = await db
    .select({ avg: avg(healthLogs.mood) })
    .from(healthLogs)
    .where(and(eq(healthLogs.testerId, testerId), gte(healthLogs.loggedAt, startOfWeek)));

  const [energyAvg] = await db
    .select({ avg: avg(healthLogs.energyLevel) })
    .from(healthLogs)
    .where(and(eq(healthLogs.testerId, testerId), gte(healthLogs.loggedAt, startOfWeek)));

  const recentSymptoms = await db
    .select({ symptoms: healthLogs.symptoms })
    .from(healthLogs)
    .where(and(eq(healthLogs.testerId, testerId), gte(healthLogs.loggedAt, startOfWeek)))
    .orderBy(desc(healthLogs.loggedAt))
    .limit(20);

  const symptomCounts: Record<string, number> = {};
  for (const row of recentSymptoms) {
    if (row.symptoms) {
      const parts = row.symptoms.split(",").map((s) => s.trim());
      for (const s of parts) {
        if (s) symptomCounts[s] = (symptomCounts[s] ?? 0) + 1;
      }
    }
  }
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);

  const astro = getAstroSnapshot(now);

  res.json({
    totalLogsToday: todayCount?.count ?? 0,
    totalLogsThisWeek: weekCount?.count ?? 0,
    activeSupplements: activeSupps?.count ?? 0,
    activeActivities: activeActs?.count ?? 0,
    avgMoodThisWeek: moodAvg?.avg ? parseFloat(moodAvg.avg) : null,
    avgEnergyThisWeek: energyAvg?.avg ? parseFloat(energyAvg.avg) : null,
    topSymptoms,
    currentMoonPhase: astro.moonPhase,
    moonSign: astro.moonSign,
    sunSign: astro.sunSign,
  });
});

router.get("/insights/patterns", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const logs = await db
    .select()
    .from(healthLogs)
    .where(eq(healthLogs.testerId, testerId))
    .orderBy(desc(healthLogs.loggedAt))
    .limit(200);

  const patterns: Array<{
    id: string;
    label: string;
    description: string;
    correlation: number;
    astroFactor: string | null;
    dataPoints: number;
  }> = [];

  const moodEnergyPairs = logs.filter((l) => l.mood !== null && l.energyLevel !== null);
  if (moodEnergyPairs.length >= 3) {
    const correlation = pearsonCorrelation(
      moodEnergyPairs.map((l) => l.mood!),
      moodEnergyPairs.map((l) => l.energyLevel!),
    );
    patterns.push({
      id: "mood-energy",
      label: "Mood — Energy Correlation",
      description: "Your mood and energy levels tend to move together",
      correlation,
      astroFactor: null,
      dataPoints: moodEnergyPairs.length,
    });
  }

  const moonPhaseGroups: Record<string, number[]> = {};
  for (const log of logs) {
    if (log.astroSnapshot && log.mood !== null) {
      try {
        const snap = JSON.parse(log.astroSnapshot);
        const phase = snap.moonPhase as string;
        if (phase) {
          moonPhaseGroups[phase] ??= [];
          moonPhaseGroups[phase].push(log.mood!);
        }
      } catch {}
    }
  }
  for (const [phase, moods] of Object.entries(moonPhaseGroups)) {
    if (moods.length >= 2) {
      const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
      patterns.push({
        id: `moon-${phase.replace(/\s/g, "-").toLowerCase()}`,
        label: `Mood during ${phase}`,
        description: `Average mood score during ${phase} phase`,
        correlation: (avg - 5) / 5,
        astroFactor: phase,
        dataPoints: moods.length,
      });
    }
  }

  const supplementCounts: Record<string, number> = {};
  for (const log of logs) {
    if (log.supplementName) {
      supplementCounts[log.supplementName] = (supplementCounts[log.supplementName] ?? 0) + 1;
    }
  }
  for (const [name, cnt] of Object.entries(supplementCounts)) {
    if (cnt >= 2) {
      patterns.push({
        id: `supp-${name.toLowerCase().replace(/\s/g, "-")}`,
        label: `${name} tracking`,
        description: `Logged ${cnt} times`,
        correlation: 0,
        astroFactor: null,
        dataPoints: cnt,
      });
    }
  }

  res.json(patterns.slice(0, 10));
});

router.get("/insights/astro", (_req, res) => {
  const astro = getAstroSnapshot(new Date());
  res.json(astro);
});

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0);
  const denomX = Math.sqrt(xs.reduce((s, x) => s + (x - meanX) ** 2, 0));
  const denomY = Math.sqrt(ys.reduce((s, y) => s + (y - meanY) ** 2, 0));
  return denomX * denomY === 0 ? 0 : num / (denomX * denomY);
}

export default router;
