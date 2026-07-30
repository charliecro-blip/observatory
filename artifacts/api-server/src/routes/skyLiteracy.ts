import { Router, type IRouter } from "express";
import { db, dailyCheckIns } from "@workspace/db";
import { and, eq, gte, lte } from "drizzle-orm";
import { julianDay, getMoonContacts } from "../lib/astro.js";
import { requireTesterId } from "../middlewares/testerId.js";

// Sky literacy — the data behind "your saturnine day": when the Moon contacts
// a given planet (the weekly rhythm that teaches each archetype), plus the
// user's own felt-ratings on those days. The reference and the personal
// evidence, one payload.

const router: IRouter = Router();

const PLANETS = new Set(["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);

// UTC instant → viewer-local YYYY-MM-DD (tz = getTimezoneOffset minutes).
function localDateOf(d: Date, tz: number): string {
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

// GET /api/sky-literacy/:planet?tz=300&lookback=30
router.get("/sky-literacy/:planet", requireTesterId, async (req, res) => {
  const planet = String(req.params.planet);
  if (!PLANETS.has(planet)) {
    res.status(400).json({ error: "Unknown planet" });
    return;
  }
  const testerId = res.locals.testerId as string;
  const tzRaw = parseInt((req.query.tz as string) ?? "", 10);
  const tz = Number.isFinite(tzRaw) ? tzRaw : 0;
  const lookback = Math.min(parseInt((req.query.lookback as string) ?? "30", 10) || 30, 90);

  const now = new Date();
  const jdNow = julianDay(now);

  // Ahead: the next contacts within 8 days (the Moon reaches every planet
  // roughly weekly, so this window almost always holds at least one).
  const ahead = getMoonContacts(planet, jdNow, jdNow + 8);

  // Behind: hard-contact days in the lookback window, as viewer-local dates.
  const past = getMoonContacts(planet, jdNow - lookback, jdNow)
    .filter((c) => c.hard)
    .map((c) => ({ ...c, date: localDateOf(new Date(c.at), tz) }));

  // Join with the user's check-ins on those days — the personal evidence.
  const dates = [...new Set(past.map((p) => p.date))];
  let feltDays: Array<{ date: string; aspect: string; felt: string | null; notes: string | null }> = [];
  if (dates.length) {
    const rows = await db.select().from(dailyCheckIns).where(and(
      eq(dailyCheckIns.testerId, testerId),
      gte(dailyCheckIns.date, dates[dates.length - 1] < dates[0] ? dates[dates.length - 1] : dates[0]),
      lte(dailyCheckIns.date, dates[dates.length - 1] > dates[0] ? dates[dates.length - 1] : dates[0]),
    ));
    const byDate = new Map(rows.map((r) => [r.date, r]));
    feltDays = past.map((p) => {
      const row = byDate.get(p.date);
      const felt = row?.behaviorTags?.find((t) => t.startsWith("felt:"))?.slice(5) ?? null;
      return { date: p.date, aspect: p.aspect, felt, notes: row?.notes ?? null };
    });
  }

  res.json({
    planet,
    next: ahead.slice(0, 4),
    nextHard: ahead.find((c) => c.hard) ?? null,
    pastHardDays: feltDays,
    ratedCount: feltDays.filter((d) => d.felt).length,
    alignedCount: feltDays.filter((d) => d.felt === "aligned").length,
  });
});

export default router;
