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
import { sprints, wins, goals } from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";
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

  // Personal when the pair touches a planet steering one of the person's
  // active stars. That grounding is what keeps a suggestion from being the
  // horoscope-generator shape — the sky met something they already hold.
  let starsByPlanet = new Map<string, { id: number; title: string }>();
  try {
    const rows = await db.select().from(goals).where(eq(goals.testerId, testerId));
    starsByPlanet = new Map(rows
      .filter(g => g.status === "active" && g.planet)
      .map(g => [g.planet as string, { id: g.id, title: g.title }]));
  } catch { /* chartless of stars is fine — spans stay global */ }

  res.json({
    spans: spans.map(s => ({
      ...s,
      personal: starsByPlanet.get(s.transitPlanet) ?? starsByPlanet.get(s.targetPlanet) ?? null,
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
  res.json(rows.map(r => {
    const t = tallies.get(r.id);
    return { ...r, tally: t?.count ?? 0, tallyDates: (t?.dates ?? []).sort() };
  }));
});

router.post("/sprints", async (req, res) => {
  const testerId = requireTesterId(req, res);
  if (!testerId) return;
  const { title, startDate, endDate, source, transitKey, transitLabel, goalId, targetCount, tz } = req.body ?? {};
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
