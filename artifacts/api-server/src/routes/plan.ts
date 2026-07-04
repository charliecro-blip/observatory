/**
 * The Planner — "give me everything you need to do, I'll weave it into the
 * calendar at the times the sky best supports it." GTD meets astrology.
 *
 *   POST /api/plan/weave   — dump a task list (or structured tasks) + a horizon
 *                            (day/week/month). We AI-parse each line into
 *                            {title, estimatedMinutes, energy, dueDate}, map it
 *                            to an elemental timing lane (associate), then
 *                            greedily slot each task into the highest-energy open
 *                            window for its lane, before its deadline, without
 *                            double-booking existing calendar blocks. Returns a
 *                            proposed schedule (nothing is written yet).
 *
 *   POST /api/plan/commit  — writes an approved schedule: one task + one
 *                            planning window per item, onto the Ahead calendar.
 */
import { Router, type IRouter } from "express";
import { db, tasks, planningWindows } from "@workspace/db";
import { and, eq, gte, lte } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { associateDeterministic, WINDOW_TYPES } from "../lib/associate.js";
import { computeDayArc, findPeakWindows } from "../lib/dayarc.js";
import { getPlanetaryHour } from "../lib/astro.js";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

type Energy = "low" | "medium" | "high";
type Horizon = "day" | "week" | "month";

interface ParsedTask {
  title: string;
  estimatedMinutes: number;
  energy: Energy;
  dueDate: string | null; // YYYY-MM-DD
}

const HORIZON_DAYS: Record<Horizon, number> = { day: 1, week: 7, month: 28 };
const DEFAULT_MINUTES = 45;

function clampMinutes(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return DEFAULT_MINUTES;
  return Math.max(15, Math.min(240, Math.round(v / 15) * 15));
}

function normEnergy(e: unknown): Energy {
  const s = String(e ?? "").toLowerCase();
  return s === "low" || s === "high" ? s : "medium";
}

/**
 * Turn a free-text dump ("write the report, 2h, due fri\nreply to landlord\ngym")
 * into structured tasks. One AI call for the whole list; a plain line-split
 * fallback keeps the feature working without the model.
 */
async function parseList(rawList: string, todayISO: string): Promise<ParsedTask[]> {
  const lines = rawList.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const fallback = (): ParsedTask[] =>
    lines.map((title) => ({ title, estimatedMinutes: DEFAULT_MINUTES, energy: "medium" as Energy, dueDate: null }));

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `Today is ${todayISO}. Parse this to-do list into structured tasks. ` +
            `Reply ONLY with JSON {"tasks": [{"title": short imperative task, "estimatedMinutes": integer 15-240 (your best guess for how long it takes), "energy": one of "low"|"medium"|"high" (how much focus/drive it demands), "dueDate": "YYYY-MM-DD" or null}]}. ` +
            `Keep one object per real task; strip time/priority notes out of the title into the fields. Interpret relative deadlines ("by friday", "tomorrow") against today's date.`,
        },
        { role: "user", content: lines.join("\n") },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const arr = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    if (arr.length === 0) return fallback();
    return arr.slice(0, 30).map((t: any) => ({
      title: String(t.title ?? "").trim() || "Untitled",
      estimatedMinutes: clampMinutes(t.estimatedMinutes),
      energy: normEnergy(t.energy),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate ?? "") ? t.dueDate : null,
    }));
  } catch {
    return fallback();
  }
}

interface Slot {
  date: string;       // viewer-local YYYY-MM-DD
  element: string;
  startMs: number;    // instant
  endMs: number;      // instant (the peak window's natural end)
  peakE: number;
}

// Waking hours (local) we're willing to schedule into. The tide's energy peaks
// can fall in the middle of the night; for actually *doing* things we keep to the
// day, nudging a nocturnal peak to the morning rather than booking 3 AM.
// (A proper chronotype-aware window is a follow-up.)
const WAKE_START = 8, WAKE_END = 21;

/** Every candidate energy-peak window across the horizon, per elemental lane. */
function buildSlots(days: number, lat: number, lon: number, tz: number): Slot[] {
  const now = Date.now();
  const slots: Slot[] = [];
  for (let d = 0; d < days; d++) {
    const arc = computeDayArc(new Date(now + d * 86400000), lat, lon, tz);
    const dayStartMs = new Date(arc.dayStart).getTime();
    const localDate = new Date(dayStartMs - tz * 60000).toISOString().slice(0, 10);
    for (const element of ["fire", "earth", "air", "water"]) {
      const curve = arc.curves[element] ?? arc.curve;
      for (const p of findPeakWindows(curve, 3, 2)) {
        const startHour = Math.max(p.startHour, WAKE_START);
        if (startHour >= WAKE_END) continue; // peak sits at night — skip for task-doing
        const endHour = Math.min(Math.max(p.endHour, startHour + 1), WAKE_END + 1);
        slots.push({
          date: localDate,
          element,
          startMs: dayStartMs + startHour * 3600000,
          endMs: dayStartMs + endHour * 3600000,
          peakE: p.peakE,
        });
      }
    }
  }
  return slots;
}

const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE;

router.post("/plan/weave", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const lat = parseFloat(req.body.lat ?? "40.7");
  const lon = parseFloat(req.body.lon ?? "-74.0");
  const tz = Number.isFinite(parseInt(req.body.tz, 10)) ? parseInt(req.body.tz, 10) : 0;
  const horizon: Horizon = (["day", "week", "month"].includes(req.body.horizon) ? req.body.horizon : "week");
  const days = HORIZON_DAYS[horizon];
  const nowMs = Date.now();
  const horizonEndMs = nowMs + days * 86400000;
  const todayISO = new Date(nowMs - tz * 60000).toISOString().slice(0, 10);

  // Structured tasks come either pre-parsed from the client (after an edit pass)
  // or as a raw dump we AI-parse here.
  let items: ParsedTask[];
  if (Array.isArray(req.body.tasks) && req.body.tasks.length > 0) {
    items = req.body.tasks.slice(0, 30).map((t: any) => ({
      title: String(t.title ?? "").trim() || "Untitled",
      estimatedMinutes: clampMinutes(t.estimatedMinutes),
      energy: normEnergy(t.energy),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate ?? "") ? t.dueDate : null,
    }));
  } else {
    items = await parseList(String(req.body.rawList ?? ""), todayISO);
  }
  if (items.length === 0) { res.json({ horizon, planned: [], unplaced: [] }); return; }

  const slots = buildSlots(days, lat, lon, tz).filter((s) => s.endMs > nowMs);

  // Existing calendar blocks in the horizon become busy time we won't overwrite.
  const existing = await db.select().from(planningWindows).where(and(
    eq(planningWindows.testerId, testerId),
    gte(planningWindows.startTime, new Date(nowMs)),
    lte(planningWindows.startTime, new Date(horizonEndMs)),
  ));
  const reserved: { s: number; e: number }[] = existing.map((w) => ({
    s: new Date(w.startTime).getTime(), e: new Date(w.endTime).getTime(),
  }));

  // Enrich + order: hard deadlines first, then the longest/most-demanding work,
  // so the constrained tasks claim their scarce good windows before the rest.
  const enriched = items.map((t) => ({ ...t, assoc: associateDeterministic(t.title) }));
  enriched.sort((a, b) => {
    const ad = a.dueDate ? Date.parse(a.dueDate) : Infinity;
    const bd = b.dueDate ? Date.parse(b.dueDate) : Infinity;
    if (ad !== bd) return ad - bd;
    return b.estimatedMinutes - a.estimatedMinutes;
  });

  const planned: any[] = [];
  const unplaced: any[] = [];

  for (const t of enriched) {
    const durMs = t.estimatedMinutes * 60000;
    const dueMs = t.dueDate ? Date.parse(t.dueDate) + 86400000 : Infinity; // end of the due day

    // Prefer slots in the task's own elemental lane; fall back to any lane.
    const rank = (s: Slot) => (s.element === t.assoc.element ? 1000 : 0) + s.peakE * 100;
    const candidates = slots
      .filter((s) => s.startMs >= nowMs && s.startMs + durMs <= Math.min(s.endMs + 30 * 60000, dueMs))
      .sort((a, b) => rank(b) - rank(a));

    let placed = false;
    for (const s of candidates) {
      const start = s.startMs;
      const end = start + durMs;
      if (reserved.some((r) => overlaps(start, end, r.s, r.e))) continue;
      reserved.push({ s: start, e: end });
      const ruler = getPlanetaryHour(new Date(start), lat, lon).ruler;
      planned.push({
        title: t.title,
        estimatedMinutes: t.estimatedMinutes,
        energy: t.energy,
        dueDate: t.dueDate,
        element: t.assoc.element,
        windowType: t.assoc.windowType,
        planets: t.assoc.planets,
        rationale: t.assoc.rationale,
        date: s.date,
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
        planetaryHour: ruler,
        matchedLane: s.element === t.assoc.element,
      });
      placed = true;
      break;
    }
    if (!placed) {
      unplaced.push({
        title: t.title, estimatedMinutes: t.estimatedMinutes, energy: t.energy, dueDate: t.dueDate,
        element: t.assoc.element, windowType: t.assoc.windowType, planets: t.assoc.planets, rationale: t.assoc.rationale,
        reason: t.dueDate ? "no open window before the deadline" : "no open window in this range",
      });
    }
  }

  planned.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  res.json({ horizon, planned, unplaced });
});

router.post("/plan/commit", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const list: any[] = Array.isArray(req.body.items) ? req.body.items : [];
  if (list.length === 0) { res.status(400).json({ error: "items required" }); return; }

  const created: { taskId: number; windowId: number }[] = [];
  for (const it of list) {
    if (!it?.title?.trim() || !it.startAt || !it.endAt) continue;
    const windowType = WINDOW_TYPES.includes(it.windowType) ? it.windowType : "deep_work";
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(it.dueDate ?? "") ? it.dueDate : null;

    const [task] = await db.insert(tasks).values({
      testerId, title: it.title.trim(), dueDate, bestWindowType: windowType,
    }).returning();
    const [win] = await db.insert(planningWindows).values({
      testerId, title: it.title.trim(), windowType,
      startTime: new Date(it.startAt), endTime: new Date(it.endAt),
      notes: "Planned by the weaver",
    }).returning();
    created.push({ taskId: task.id, windowId: win.id });
  }
  res.json({ created, count: created.length });
});

export default router;
