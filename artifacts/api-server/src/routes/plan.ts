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
import { associateDeterministic, WINDOW_TYPES, type Association } from "../lib/associate.js";
import { wakingSegments } from "../lib/waking.js";
import { endOfLocalDay, isValidTimeZone } from "../lib/localday.js";
import { computeDayArc, findPeakWindows } from "../lib/dayarc.js";
import { getPlanetaryHour } from "../lib/astro.js";
import { glossHolds } from "../lib/glossCondition.js";
import { type Tier, TIER_NOTE } from "../lib/timingTier.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { evaluateActivityInterval } from "../lib/electionEngine.js";
import { rankActivities } from "../lib/activityCorrespondences.js";

const router: IRouter = Router();

type Energy = "low" | "medium" | "high";
type Horizon = "day" | "week" | "month";

interface ParsedTask {
  title: string;
  estimatedMinutes: number;
  energy: Energy;
  dueDate: string | null; // YYYY-MM-DD
  /** The Guiding Star this serves, when the intake named one. */
  goalId?: number | null;
  /**
   * The classification as REVIEWED BY THE USER, when the request came from the
   * edit pass rather than a raw dump.
   *
   * The Planner tells the user "the read is a guess, not a verdict" and lets
   * them change fire to earth. That control was a false affordance: the weave
   * route kept only title, estimate, energy and due date, then re-ran
   * associateDeterministic(title) — so the correction appeared on screen and
   * was silently discarded at scheduling time.
   *
   * That is the most damaging shape a bug can take in this product, because it
   * teaches that inspectability is decorative. If the user can see the reason,
   * the reason has to be the one that acts.
   */
  assoc?: Association;
  classificationSource?: "user" | "deterministic" | "ai";
}

const HORIZON_DAYS: Record<Horizon, number> = { day: 1, week: 7, month: 28 };
const DEFAULT_MINUTES = 45;

function clampMinutes(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return DEFAULT_MINUTES;
  // Kept to a sane range, but NOT rounded to quarter-hours. The estimate is
  // the user's own read of their work — snapping 50 minutes to 45 changes
  // what they said while the field goes on displaying what they typed, which
  // is the field lying about what was saved.
  return Math.max(1, Math.min(480, Math.round(v)));
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

// Waking hours (local, 0–24) we're willing to schedule into — the tide's energy
// peaks can fall in the middle of the night, and for actually *doing* things we
// keep to the person's day, nudging a nocturnal peak to the morning rather than
// booking 3 AM. The client passes the profile's wake/sleep; these are the
// fallback for anyone who hasn't set a chronotype.
const DEFAULT_WAKE = 8, DEFAULT_SLEEP = 21;

interface DayGrid {
  date: string;
  dayStartMs: number;
  arc: ReturnType<typeof computeDayArc>;
}

/** Per-day arcs for the horizon — peaks come from these, and so does the
 *  gap-fallback sampler (energy at an arbitrary hour). */
function buildDays(days: number, lat: number, lon: number, tz: number): DayGrid[] {
  const now = Date.now();
  const out: DayGrid[] = [];
  for (let d = 0; d < days; d++) {
    const arc = computeDayArc(new Date(now + d * 86400000), lat, lon, tz);
    const dayStartMs = new Date(arc.dayStart).getTime();
    out.push({ date: new Date(dayStartMs - tz * 60000).toISOString().slice(0, 10), dayStartMs, arc });
  }
  return out;
}

/** Every candidate energy-peak window across the horizon, per elemental lane. */
// wakingSegments / isAwakeAt live in lib/waking.ts — pure arithmetic, kept
// out of this route so they are testable without a database.
function buildSlots(dayGrids: DayGrid[], wake: number, sleep: number): Slot[] {
  const slots: Slot[] = [];
  for (const { date, dayStartMs, arc } of dayGrids) {
    for (const element of ["fire", "earth", "air", "water"]) {
      const curve = arc.curves[element] ?? arc.curve;
      for (const p of findPeakWindows(curve, 3, 2)) {
        // Clip the peak to each waking segment. A peak straddling the sleep
        // gap yields the parts that are actually awake rather than being
        // dropped whole or stretched across the gap.
        for (const [lo, hi] of wakingSegments(wake, sleep)) {
          const startHour = Math.max(p.startHour, lo);
          const endHour = Math.min(Math.max(p.endHour, startHour + 1), hi);
          if (endHour - startHour < 0.5) continue;   // nothing usable left
          slots.push({
            date,
            element,
            startMs: dayStartMs + startHour * 3600000,
            endMs: dayStartMs + endHour * 3600000,
            peakE: p.peakE,
          });
        }
      }
    }
  }
  return slots;
}

/** Energy of an element's curve at a given local hour (nearest point). */
function energyAt(grid: DayGrid, element: string, hour: number): number {
  const curve = grid.arc.curves[element] ?? grid.arc.curve;
  let best = 0.5, bestD = Infinity;
  for (const p of curve) {
    const d = Math.abs(p.hour - hour);
    if (d < bestD) { bestD = d; best = p.e; }
  }
  return best;
}

// Timing tiers — the app's grading language for a placement. Defined once in
// lib/timingTier.ts and shared, so the cascade can grade a MOVED window in the
// same words the weaver used to place it. Nothing honest is hidden behind a
// refusal to schedule.

// Only the seven classical planets rule hours — an outer-planet association
// (Uranus/Neptune/Pluto) can't be hour-targeted.
const HOUR_RULERS = new Set(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);

// "HH:MM" → fractional local hour (0–24); null-safe.
function hourFromClock(v: unknown, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? ""));
  if (!m) return fallback;
  const h = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  return h >= 0 && h <= 24 ? h : fallback;
}

/** POST /api/plan/parse — raw dump → editable structured tasks (with a lane preview). */
router.post("/plan/parse", requireTesterId, async (req, res) => {
  const tz = Number.isFinite(parseInt(req.body.tz, 10)) ? parseInt(req.body.tz, 10) : 0;
  // An IANA zone name when the client sends one. The numeric offset cannot
  // answer "when does this local day end" across a DST boundary, because the
  // offset itself changes there.
  const tzName: string | null = isValidTimeZone(req.body.tzName) ? req.body.tzName : null;
  const todayISO = new Date(Date.now() - tz * 60000).toISOString().slice(0, 10);
  const items = await parseList(String(req.body.rawList ?? ""), todayISO);
  const tasks = items.map((t) => {
    const a = associateDeterministic(t.title);
    return { ...t, element: a.element, windowType: a.windowType, planets: a.planets, rationale: a.rationale };
  });
  res.json({ tasks });
});

const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE;

router.post("/plan/weave", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const lat = parseFloat(req.body.lat ?? "40.7");
  const lon = parseFloat(req.body.lon ?? "-74.0");
  const tz = Number.isFinite(parseInt(req.body.tz, 10)) ? parseInt(req.body.tz, 10) : 0;
  // An IANA zone name when the client sends one. The numeric offset cannot
  // answer "when does this local day end" across a DST boundary, because the
  // offset itself changes there.
  const tzName: string | null = isValidTimeZone(req.body.tzName) ? req.body.tzName : null;
  const horizon: Horizon = (["day", "week", "month"].includes(req.body.horizon) ? req.body.horizon : "week");
  // The plain weave (home-base build 2026-08-16). `sky: false` skips the
  // planetary-hour pass and the peak-window pass entirely: placement runs on
  // deadline pressure, stated energy and open time alone, and every placement
  // grades "workable" — the one tier whose note ("this time will do") already
  // carries no sky vocabulary. Same weaver, same honesty about refusals.
  const consultSky = req.body.sky !== false;
  const days = HORIZON_DAYS[horizon];
  const nowMs = Date.now();
  const horizonEndMs = nowMs + days * 86400000;
  const todayISO = new Date(nowMs - tz * 60000).toISOString().slice(0, 10);

  // Structured tasks come either pre-parsed from the client (after an edit pass)
  // or as a raw dump we AI-parse here.
  let items: ParsedTask[];
  if (Array.isArray(req.body.tasks) && req.body.tasks.length > 0) {
    items = req.body.tasks.slice(0, 30).map((t: any) => {
      const title = String(t.title ?? "").trim() || "Untitled";
      // Trust the reviewed card, but validate it — this is still request input.
      // An unrecognised element or window type falls back to the deterministic
      // read rather than being passed through into scheduling.
      const derived = associateDeterministic(title);
      const EL = ["fire", "earth", "air", "water"] as const;
      const element = EL.includes(t.element) ? t.element as Association["element"] : null;
      // A task may name several lanes. Validated the same way as the single
      // one — anything unrecognised is dropped rather than passed through.
      const elements = Array.isArray(t.elements)
        ? [...new Set((t.elements as unknown[]).filter((e): e is Association["element"] =>
            typeof e === "string" && (EL as readonly string[]).includes(e)))]
        : [];
      const windowType = WINDOW_TYPES.includes(t.windowType) ? t.windowType : null;
      const edited = element != null || windowType != null || elements.length > 0;
      const assoc: Association | undefined = edited ? {
        ...derived,
        element: element ?? elements[0] ?? derived.element,
        elements: elements.length ? elements : undefined,
        windowType: (windowType ?? derived.windowType) as typeof derived.windowType,
        planets: Array.isArray(t.planets) && t.planets.length
          ? (t.planets as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 3)
          : derived.planets,
        rationale: typeof t.rationale === "string" && t.rationale.trim()
          ? t.rationale.trim() : derived.rationale,
      } : undefined;
      return {
        title,
        estimatedMinutes: clampMinutes(t.estimatedMinutes),
        energy: normEnergy(t.energy),
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate ?? "") ? t.dueDate : null,
        assoc,
        // Rides through the weave so commit can attach it; the intake is
        // where a person knows what a task is in service of.
        goalId: Number.isFinite(Number(t.goalId)) && Number(t.goalId) > 0 ? Number(t.goalId) : null,
        classificationSource: (edited ? "user" : "deterministic") as "user" | "deterministic",
      };
    });
  } else {
    items = await parseList(String(req.body.rawList ?? ""), todayISO);
  }
  if (items.length === 0) { res.json({ horizon, planned: [], unplaced: [] }); return; }

  // Waking window from the caller's chronotype (falls back to a generic day).
  const wake = hourFromClock(req.body.wakeTime, DEFAULT_WAKE);
  // Kept as given. Overnight rhythms are modelled by wakingSegments rather
  // than flattened into a day that ends at 9pm.
  const sleep = hourFromClock(req.body.sleepTime, DEFAULT_SLEEP);
  // One extra day beyond the horizon: when someone weaves "today" at 9pm
  // there is no waking water left today — the fallback rolls into tomorrow
  // morning instead of refusing (peak-slot pass stays within the horizon).
  const dayGrids = buildDays(days + 1, lat, lon, tz);
  const horizonGrids = dayGrids.slice(0, days);
  const slots = buildSlots(horizonGrids, wake, sleep).filter((s) => s.endMs > nowMs);

  // Existing calendar blocks in the horizon become busy time we won't overwrite —
  // both the app's own planning windows and (when passed) Google Calendar events.
  const existing = await db.select().from(planningWindows).where(and(
    eq(planningWindows.testerId, testerId),
    gte(planningWindows.startTime, new Date(nowMs)),
    lte(planningWindows.startTime, new Date(horizonEndMs)),
  ));
  // `lanes` rather than one element: the alternatives pass has to grade a
  // slot the same way the original placement did, and a multi-lane task
  // matches in any of its lanes.
  const placementCtx: { index: number; candidates: Slot[]; durMs: number; dueMs: number; lanes: Set<string>; chosen: number }[] = [];
  const reserved: { s: number; e: number }[] = existing.map((w) => ({
    s: new Date(w.startTime).getTime(), e: new Date(w.endTime).getTime(),
  }));
  if (Array.isArray(req.body.busy)) {
    for (const b of req.body.busy) {
      const s = Date.parse(b?.startAt ?? b?.start ?? "");
      const e = Date.parse(b?.endAt ?? b?.end ?? "");
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) reserved.push({ s, e });
    }
  }

  // Enrich + order: hard deadlines first, then the longest/most-demanding work,
  // so the constrained tasks claim their scarce good windows before the rest.
  // The user's reviewed classification wins. Re-deriving here is what made the
  // edit control a lie; the deterministic read is now only the FALLBACK, for
  // items that never went through a review pass.
  const enriched = items.map((t) => ({
    ...t,
    assoc: t.assoc ?? associateDeterministic(t.title),
    classificationSource: t.classificationSource ?? "deterministic",
  }));
  const ENERGY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  enriched.sort((a, b) => {
    const ad = a.dueDate ? Date.parse(a.dueDate) : Infinity;
    const bd = b.dueDate ? Date.parse(b.dueDate) : Infinity;
    if (ad !== bd) return ad - bd;
    // Plain weave: high-energy work claims the early stretches — the walk
    // hands out time in clock order from the person's own wake hour, so
    // ordering IS placement. The sky path keeps its original order.
    if (!consultSky) {
      const e = (ENERGY_RANK[a.energy ?? ""] ?? 1) - (ENERGY_RANK[b.energy ?? ""] ?? 1);
      if (e !== 0) return e;
    }
    return b.estimatedMinutes - a.estimatedMinutes;
  });

  const planned: any[] = [];
  const unplaced: any[] = [];

  for (const t of enriched) {
    const durMs = t.estimatedMinutes * 60000;
    // END OF THE DUE DAY, where the user lives. `Date.parse("2026-08-04")` is
    // UTC midnight, so adding a day put the deadline at UTC midnight too —
    // five hours early for Chicago, eight for Los Angeles. A task due today
    // could not be scheduled for this evening.
    //
    // With a zone name this is the next local midnight, correct across DST.
    // Without one, fall back to the numeric offset, which is right except on
    // the two transition days.
    const dueMs = t.dueDate
      ? (tzName
          ? endOfLocalDay(t.dueDate, tzName)
          : Date.parse(t.dueDate) + 86400000 + tz * 60000)
      : Infinity;

    // THE ASTROLOGICAL VERDICT IS INHERITED, NOT INVENTED.
    //
    // This was `(s.element === t.assoc.element ? 1000 : 0) + s.peakE * 100` — a
    // blended score with magic weights, standing in for suitability, and a
    // third independent astrological authority alongside the election engine
    // and the session finder. The same defect that had two of those disagreeing
    // on 20% of activity-days.
    //
    // The canonical evaluator now decides. A `defer` slot is removed outright;
    // `clear` beats `qualified`; and only then does the elemental lane break
    // the tie. Lexicographic, so a strong lane match can never outrank a real
    // electional objection — which the multiply-and-add version did by
    // construction, since 1000 swamps everything.
    //
    // Tasks here carry an element, not an activity key, so the activity is
    // resolved from the title at the same confidence bar the weavers use. When
    // it cannot be resolved there is no verdict to inherit and the ordering
    // falls back to the elemental lane alone — no invented judgment either way.
    const ranked = rankActivities(t.title ?? "", 1)[0];
    const activityKey = ranked && ranked.score >= 2.0 ? ranked.activity.key : null;
    const SUIT_RANK: Record<string, number> = { clear: 0, qualified: 1, defer: 2 };
    const verdictOf = (s: Slot) => {
      if (!activityKey) return null;
      return evaluateActivityInterval({
        activityKey,
        startAt: new Date(s.startMs),
        endAt: new Date(s.startMs + durMs),
      });
    };
    // The lanes this task accepts. A multi-element task matches in ANY of
    // them — that is the whole point of naming more than one — so the rank
    // is set membership rather than equality with the primary.
    const lanes = new Set<string>(t.assoc.elements?.length ? t.assoc.elements : [t.assoc.element]);
    const laneRank = (s: Slot) => (lanes.has(s.element) ? 0 : 1);
    // Not computed at all in plain mode — each verdict is a full election
    // evaluation per slot, and a sweep nobody reads is the 90-second-calendar
    // defect shape (getMajorAspects-in-a-loop).
    const candidates = !consultSky ? [] : slots
      .filter((s) => s.startMs >= nowMs && s.startMs + durMs <= Math.min(s.endMs + 30 * 60000, dueMs))
      .map((s) => ({ s, v: verdictOf(s) }))
      .filter(({ v }) => v?.suitability !== "defer")
      .sort((a, b) =>
        (SUIT_RANK[a.v?.suitability ?? "clear"] - SUIT_RANK[b.v?.suitability ?? "clear"]) ||
        (laneRank(a.s) - laneRank(b.s)) ||
        (b.s.peakE - a.s.peakE))
      .map(({ s }) => s);

    const push = (start: number, date: string, matchedLane: boolean, tier: Tier, note?: string) => {
      reserved.push({ s: start, e: start + durMs });
      // Kept so a second pass can offer alternatives once every item has been
      // placed. Computing them here would be wrong: `reserved` is still
      // growing, so a slot that looks free now may be taken by the next task.
      placementCtx.push({ index: planned.length, candidates, durMs, dueMs, lanes, chosen: start });
      planned.push({
        title: t.title,
        estimatedMinutes: t.estimatedMinutes,
        energy: t.energy,
        dueDate: t.dueDate,
        ...(t.goalId ? { goalId: t.goalId } : {}),
        element: t.assoc.element,
        ...(t.assoc.elements?.length ? { elements: t.assoc.elements } : {}),
        windowType: t.assoc.windowType,
        planets: t.assoc.planets,
        // THE GLOSS ONLY WHEN IT IS TRUE OF THIS BLOCK.
        //
        // A handful of glosses are written in the definite — "SUITS the
        // retrograde", "the void is for this" — and this is the line the
        // Planner renders as the block's explanation. Shown on a day without
        // the condition, the app asserts a sky that is not there: on
        // 2026-08-31, Mercury direct, a woven task read "Drafting classically
        // SUITS the retrograde".
        //
        // Checked at the block's own instant, not the day's, because a void
        // Moon opens and closes inside a day.
        rationale: glossHolds(t.assoc.rationaleNeeds, new Date(start))
          ? t.assoc.rationale : undefined,
        date,
        startAt: new Date(start).toISOString(),
        endAt: new Date(start + durMs).toISOString(),
        planetaryHour: getPlanetaryHour(new Date(start), lat, lon).ruler,
        matchedLane,
        tier,
        tierNote: note ?? TIER_NOTE[tier],
      });
    };

    let placed = false;

    // Pass 0 — short tasks with a clear planetary voice go to that planet's
    // OWN HOUR. For a 30-minute "reply to DMs" the Mercury hour matters more
    // than which element the Moon is in; the element lane is the right frame
    // for the big multi-hour blocks, not the small stitches.
    const hourTargets = new Set(t.assoc.planets.filter((p) => HOUR_RULERS.has(p)));
    if (consultSky && t.estimatedMinutes <= 75 && hourTargets.size > 0) {
      outer0: for (const grid of dayGrids) {
        for (const [segLo, segHi] of wakingSegments(wake, sleep))
        for (let h = segLo; h + t.estimatedMinutes / 60 <= segHi; h += 0.5) {
          const start = grid.dayStartMs + h * 3600000;
          if (start < nowMs) continue;
          if (start + durMs > dueMs) break outer0;
          if (!hourTargets.has(getPlanetaryHour(new Date(start), lat, lon).ruler)) continue;
          if (reserved.some((r) => overlaps(start, start + durMs, r.s, r.e))) continue;
          const ruler = getPlanetaryHour(new Date(start), lat, lon).ruler;
          // Same wording as timingTier, deliberately: two places building the
          // same sentence is how they start disagreeing.
          push(start, grid.date, true, "great", `a great time — the ${ruler} hour`);
          placed = true;
          break outer0;
        }
      }
    }

    // Pass 1 — the sky's peak windows, own lane first.
    for (const s of candidates) {
      if (placed) break;
      const start = s.startMs;
      if (reserved.some((r) => overlaps(start, start + durMs, r.s, r.e))) continue;
      const matched = lanes.has(s.element);
      push(start, s.date, matched, matched ? "great" : "workable");
      placed = true;
      break;
    }

    // Pass 2 — no peak fit, so walk the plain open water: every half hour of
    // every waking day before the deadline. A task must never bounce just
    // because the *best* windows are taken; it gets an honest tier instead.
    if (!placed) {
      outer: for (const grid of dayGrids) {
        for (const [segLo, segHi] of wakingSegments(wake, sleep))
        for (let h = segLo; h + t.estimatedMinutes / 60 <= segHi; h += 0.5) {
          const start = grid.dayStartMs + h * 3600000;
          if (start < nowMs) continue;
          if (start + durMs > dueMs) break outer; // past the deadline — later days won't help
          if (reserved.some((r) => overlaps(start, start + durMs, r.s, r.e))) continue;
          // The best of its lanes: a task that is both fire and water should
          // be graded on whichever curve is actually strong at this hour,
          // not on whichever lane happens to be listed first.
          if (consultSky) {
            const e = Math.max(...[...lanes].map((el) => energyAt(grid, el, h)));
            push(start, grid.date, false, e >= 0.35 ? "workable" : "against");
          } else {
            // Plain mode never grades a slot against a current it was told
            // not to consult. "workable" is the flat, honest tier.
            push(start, grid.date, false, "workable");
          }
          placed = true;
          break outer;
        }
      }
    }

    // Only a genuinely full calendar lands here now.
    if (!placed) {
      unplaced.push({
        title: t.title, estimatedMinutes: t.estimatedMinutes, energy: t.energy, dueDate: t.dueDate,
        element: t.assoc.element, windowType: t.assoc.windowType, planets: t.assoc.planets,
        // No block, so no block instant — gated on now instead, because this
        // is shown inside a weave the reader is looking at right now, and a
        // gloss in the definite reads as current wherever it appears.
        rationale: glossHolds(t.assoc.rationaleNeeds, new Date()) ? t.assoc.rationale : undefined,
        reason: t.dueDate
          ? "every waking slot before the deadline is already booked — free something up or push the date"
          : "the whole range is booked solid — clear a block and weave again",
      });
    }
  }

  // ── Alternatives — "move it", not just "take it or leave it" ──────────────
  // The weaver ranked every viable slot and then threw all but the winner
  // away, which is what made a woven plan take-it-or-leave-it: the only
  // response to a placement you disliked was to delete it and weave again.
  // These are the runner-up slots it already computed, filtered against the
  // FINAL reservation set so an offered alternative is genuinely free.
  // Claimed across ALL items, not per item. Offering the same free slot to
  // three different tasks means any two of those moves collide — and an app
  // whose distinguishing behaviour is capacity honesty must not hand out
  // options that quietly conflict. Interval-based, not start-time-based:
  // a 90-minute alternative at 12:00 and a 30-minute one at 13:00 have
  // different starts and still overlap.
  //
  // The guarantee this buys: ANY SUBSET of the offered moves can be taken
  // together without producing an overlap.
  const claimed: { s: number; e: number }[] = [];

  for (const ctx of placementCtx) {
    const item = planned[ctx.index];
    if (!item) continue;
    const alts: { startAt: string; endAt: string; date: string; tier: Tier; tierNote: string; planetaryHour: string }[] = [];
    const seenDays = new Set<string>();
    for (const c of ctx.candidates) {
      if (alts.length >= 3) break;
      const start = c.startMs;
      if (start === ctx.chosen) continue;
      if (start < nowMs || start + ctx.durMs > ctx.dueMs) continue;
      // Free against everything finally booked, minus this item's own slot.
      const clash = reserved.some((r) =>
        !(r.s === ctx.chosen && r.e === ctx.chosen + ctx.durMs) &&
        overlaps(start, start + ctx.durMs, r.s, r.e));
      if (clash) continue;
      // One option per day: three choices on the same afternoon is a worse
      // offer than three different days, and it is days people want to move by.
      if (seenDays.has(c.date)) continue;
      if (claimed.some((k) => overlaps(start, start + ctx.durMs, k.s, k.e))) continue;
      seenDays.add(c.date);
      claimed.push({ s: start, e: start + ctx.durMs });
      const matched = ctx.lanes.has(c.element);
      const tier: Tier = matched ? "great" : "workable";
      alts.push({
        startAt: new Date(start).toISOString(),
        endAt: new Date(start + ctx.durMs).toISOString(),
        date: c.date, tier, tierNote: TIER_NOTE[tier],
        planetaryHour: getPlanetaryHour(new Date(start), lat, lon).ruler,
      });
    }
    (item as any).alternatives = alts;
  }

  planned.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  res.json({ horizon, planned, unplaced });
});

router.post("/plan/commit", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const list: any[] = Array.isArray(req.body.items) ? req.body.items : [];
  if (list.length === 0) { res.status(400).json({ error: "items required" }); return; }

  // ALL OR NOTHING. This looped two independent inserts per item with no
  // enclosing transaction, so a failure partway could leave some approved
  // items written, a task without its window, or a half-committed schedule the
  // UI had already described as one commitment. The copy said "commit this
  // plan"; the persistence said "attempt these 2N writes".
  //
  // Each pair is also LINKED now. The two were previously related by title —
  // Today decided whether a task was already placed by comparing normalised
  // strings — and title equality is not an identity relation: two tasks called
  // "Send invoice" collapse into one, so a genuinely loose task could vanish
  // from the loose list or appear scheduled when it was not.
  const created = await db.transaction(async (tx) => {
    const out: { taskId: number; windowId: number }[] = [];
    for (const it of list) {
      if (!it?.title?.trim() || !it.startAt || !it.endAt) continue;
      const windowType = WINDOW_TYPES.includes(it.windowType) ? it.windowType : "deep_work";
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(it.dueDate ?? "") ? it.dueDate : null;

      // Window first, so the task can point at it in one write rather than
      // needing an update — no window is ever briefly orphaned.
      // The Guiding Star this belongs to, when the intake named one. Carried
      // on BOTH rows: the window so a session counts toward the star, the
      // task so the star's own page can see it. Dropped here previously, so
      // work dumped into the planner arrived unattached to anything it was
      // actually in service of (owner, 2026-08-13).
      const goalId = Number.isFinite(Number(it.goalId)) && Number(it.goalId) > 0
        ? Number(it.goalId) : null;

      const [win] = await tx.insert(planningWindows).values({
        testerId, title: it.title.trim(), windowType,
        startTime: new Date(it.startAt), endTime: new Date(it.endAt),
        notes: "Planned by the weaver",
        ...(goalId ? { goalId } : {}),
      }).returning();
      const [task] = await tx.insert(tasks).values({
        testerId, title: it.title.trim(), dueDate, bestWindowType: windowType,
        planningWindowId: win.id,
        ...(goalId ? { goalId } : {}),
      }).returning();
      out.push({ taskId: task.id, windowId: win.id });
    }
    return out;
  });
  // A deterministic receipt of every pair written, so the client can say what
  // landed rather than inferring it.
  res.json({ created, count: created.length });
});

export default router;
