/**
 * Sprints — short, time-bound pushes, and the transit weather they can ride.
 *
 *   GET  /transits/spans?tz=   → week-scale spans (lib/transitSpans), each
 *        flagged personal when a planet steering one of the person's active
 *        Guiding Stars is in the pair — the inventory-grounded case.
 *   GET  /sprints?tz=          → the person's sprints with their tallies
 *        (wins.sprintId is the tally; the ledger stays the one record).
 *   POST /sprints              → start one (chosen or transit-born)
 *   PATCH /sprints/:id         → finish it, set it down, or adjust the target
 *
 * CAPACITY HONESTY. At most three active sprints: a fourth "short push" is a
 * standing workload wearing a costume, and the refusal says so plainly. The
 * suggestion rate-limiting lives on the CLIENT (one at a time, dismissals
 * remembered, cooldown) — the server only reports the weather.
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sprints, wins, goals, habits, habitLogs } from "@workspace/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";
import { transitSpans } from "../lib/transitSpans.js";

const router: IRouter = Router();

function requireTesterId(req: any, res: any): string | null {
  const t = req.headers["x-tester-id"] as string;
  if (!t) { res.status(401).json({ error: "Missing tester id" }); return null; }
  return t;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const localToday = (tzOffsetMin: number) =>
  new Date(Date.now() - tzOffsetMin * 60000).toISOString().slice(0, 10);

const MAX_ACTIVE = 3;
const MAX_SPAN_RESULTS = 8;
const MAX_SPRINT_DAYS = 30;

// ── The weather ─────────────────────────────────────────────────────────────

router.get("/transits/spans", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  const spans = transitSpans({ tzOffsetMin }).slice(0, MAX_SPAN_RESULTS);

  // Personal when the pair touches something the person ALREADY holds — a
  // planet steering an active star, or one an active habit favors. That
  // grounding is what keeps a suggestion from being the horoscope-generator
  // shape: the sky met their inventory, not the other way round.
  let starsByPlanet = new Map<string, { id: number; title: string }>();
  let habitsByPlanet = new Map<string, { id: number; name: string; planet: string }>();
  try {
    const [goalRows, habitRows] = await Promise.all([
      db.select().from(goals).where(eq(goals.testerId, testerId)),
      db.select().from(habits).where(and(eq(habits.testerId, testerId), eq(habits.status, "active"))),
    ]);
    starsByPlanet = new Map(goalRows
      .filter(g => g.status === "active" && g.planet)
      .map(g => [g.planet as string, { id: g.id, title: g.title }]));
    // WHICH habit a planet reaches for (owner, 2026-08-19: "make sure it's
    // not just the same habits"). This took the FIRST match and kept it
    // forever, so one planet proposed one habit for the rest of time.
    //
    // Three rules, in order:
    //   1. never a habit that already had a sprint in the last 30 days —
    //      novelty is the whole reason the suggestion exists;
    //   2. prefer one that is BEHIND its own cadence — a sprint is a push
    //      for something slipping, not a victory lap for something already
    //      kept every day;
    //   3. rotate among what's left, keyed to the day, so two candidates
    //      genuinely alternate instead of one winning permanently.
    const weekAgo = new Date(Date.now() - 7 * 86400000 - tzOffsetMin * 60000).toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400000 - tzOffsetMin * 60000).toISOString().slice(0, 10);
    const [logRows, recentSprints] = await Promise.all([
      db.select().from(habitLogs).where(and(eq(habitLogs.testerId, testerId), gte(habitLogs.date, weekAgo))),
      db.select().from(sprints).where(and(eq(sprints.testerId, testerId), gte(sprints.startDate, monthAgo))),
    ]);
    const sprintedRecently = new Set(recentSprints.map(r => r.habitId).filter(Boolean));
    const keptThisWeek = new Map<number, number>();
    for (const l of logRows) keptThisWeek.set(l.habitId, (keptThisWeek.get(l.habitId) ?? 0) + 1);
    const weeklyTarget = (h: typeof habitRows[number]) =>
      h.cadence === "daily" ? 7 : h.cadence === "most_days" ? 5
      : h.cadence === "weekly" ? (h.targetPerWeek ?? 3) : 0;
    // A stable day number, so the rotation changes daily but not per request.
    const dayIdx = Math.floor((Date.now() - tzOffsetMin * 60000) / 86400000);

    const byPlanet = new Map<string, typeof habitRows>();
    for (const h of habitRows) {
      if (sprintedRecently.has(h.id)) continue;
      for (const p of String(h.favoredPlanets ?? "").split(",").map(x => x.trim()).filter(Boolean)) {
        const arr = byPlanet.get(p) ?? [];
        arr.push(h);
        byPlanet.set(p, arr);
      }
    }
    for (const [p, candidates] of byPlanet) {
      const shortfall = (h: typeof habitRows[number]) => {
        const target = weeklyTarget(h);
        return target === 0 ? -1 : target - (keptThisWeek.get(h.id) ?? 0);
      };
      // Behind first (largest shortfall), then rotate within the tie.
      const ranked = [...candidates].sort((a, b) => shortfall(b) - shortfall(a));
      const topShortfall = shortfall(ranked[0]);
      const tied = ranked.filter(h => shortfall(h) === topShortfall);
      const pick = tied[dayIdx % tied.length];
      habitsByPlanet.set(p, { id: pick.id, name: pick.name, planet: p });
    }
  } catch { /* inventory unread — spans stay global */ }

  res.json({
    spans: spans.map(s => ({
      ...s,
      personal: starsByPlanet.get(s.transitPlanet) ?? starsByPlanet.get(s.targetPlanet) ?? null,
      habitMatch: habitsByPlanet.get(s.transitPlanet) ?? habitsByPlanet.get(s.targetPlanet) ?? null,
    })),
  });
});

// ── The sprints ─────────────────────────────────────────────────────────────

router.get("/sprints", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const rows = await db.select().from(sprints)
    .where(eq(sprints.testerId, testerId))
    .orderBy(sprints.createdAt);
  const ids = rows.map(r => r.id);
  const tallies = new Map<number, { count: number; dates: string[] }>();
  if (ids.length) {
    const winRows = await db.select().from(wins)
      .where(and(eq(wins.testerId, testerId), inArray(wins.sprintId, ids)));
    for (const w of winRows) {
      if (!w.sprintId) continue;
      const t = tallies.get(w.sprintId) ?? { count: 0, dates: [] };
      t.count += 1;
      if (!t.dates.includes(w.date)) t.dates.push(w.date);
      tallies.set(w.sprintId, t);
    }
  }
  // A habit-linked sprint tallies from the habit's OWN log inside its window
  // — the tap wrote habitLogs, the one record of a kept day, and deriving
  // here is what makes double-entry impossible (same design as auto wins).
  const habitIds = [...new Set(rows.map(r => r.habitId).filter((x): x is number => !!x))];
  const habitDates = new Map<number, string[]>();
  if (habitIds.length) {
    const earliest = rows.filter(r => r.habitId).map(r => r.startDate).sort()[0];
    const logRows = await db.select().from(habitLogs)
      .where(and(eq(habitLogs.testerId, testerId), inArray(habitLogs.habitId, habitIds), gte(habitLogs.date, earliest)));
    for (const l of logRows) {
      const arr = habitDates.get(l.habitId) ?? [];
      arr.push(l.date);
      habitDates.set(l.habitId, arr);
    }
  }
  res.json(rows.map(r => {
    if (r.habitId) {
      const dates = (habitDates.get(r.habitId) ?? [])
        .filter(d => d >= r.startDate && d <= r.endDate).sort();
      return { ...r, tally: dates.length, tallyDates: dates };
    }
    const t = tallies.get(r.id);
    return { ...r, tally: t?.count ?? 0, tallyDates: (t?.dates ?? []).sort() };
  }));
});

router.post("/sprints", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const { title, startDate, endDate, source, transitKey, transitLabel, goalId, habitId, targetCount, tz } = req.body ?? {};
  if (!title || !String(title).trim()) { res.status(400).json({ error: "title required" }); return; }
  const tzOffsetMin = parseInt(tz, 10) || 0;
  const start = DATE_RE.test(startDate ?? "") ? startDate : localToday(tzOffsetMin);
  if (!DATE_RE.test(endDate ?? "") || endDate < start) {
    res.status(400).json({ error: "a sprint needs an end date on or after its start" });
    return;
  }
  const days = Math.round((Date.parse(endDate) - Date.parse(start)) / 86400000) + 1;
  if (days > MAX_SPRINT_DAYS) {
    res.status(400).json({ error: "past a month it isn't a sprint — give it a shorter window, or make it a habit" });
    return;
  }
  const active = await db.select({ id: sprints.id }).from(sprints)
    .where(and(eq(sprints.testerId, testerId), eq(sprints.status, "active")));
  if (active.length >= MAX_ACTIVE) {
    res.status(400).json({ error: "three sprints are already running — finish or set one down first" });
    return;
  }
  const asId = (v: unknown) => Number.isInteger(v) && (v as number) > 0 ? v as number : null;
  const [row] = await db.insert(sprints).values({
    testerId,
    title: String(title).trim().slice(0, 200),
    startDate: start,
    endDate,
    source: source === "transit" ? "transit" : "chosen",
    transitKey: typeof transitKey === "string" && transitKey ? transitKey.slice(0, 120) : null,
    transitLabel: typeof transitLabel === "string" && transitLabel ? transitLabel.slice(0, 120) : null,
    goalId: asId(goalId),
    habitId: asId(habitId),
    targetCount: Number.isInteger(targetCount) && targetCount > 0 ? Math.min(99, targetCount) : null,
  }).returning();
  res.status(201).json(row);
});

router.patch("/sprints/:id", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const id = parseInt(req.params.id, 10);
  const { status, targetCount } = req.body ?? {};
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) {
    if (!["active", "done", "ended"].includes(status)) {
      res.status(400).json({ error: "status must be active, done, or ended" });
      return;
    }
    patch.status = status;
  }
  if (targetCount !== undefined) {
    patch.targetCount = Number.isInteger(targetCount) && targetCount > 0 ? Math.min(99, targetCount) : null;
  }
  const [row] = await db.update(sprints).set(patch)
    .where(and(eq(sprints.id, id), eq(sprints.testerId, testerId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
