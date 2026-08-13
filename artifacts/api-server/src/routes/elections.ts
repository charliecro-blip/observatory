/**
 * Elections — the activity picker's data source (owner 2026-07-20).
 *
 *   GET /elections/activities → the full correspondence list, grouped by
 *   category, for the picker UI and for star/step sortage. One canonical
 *   table (lib/activityCorrespondences) feeds this, the /associate grounding,
 *   and the coming good/great election engine.
 */
import { Router, type IRouter } from "express";
import { db, natalCharts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ACTIVITIES, ACTIVITY_CATEGORIES, matchActivity } from "../lib/activityCorrespondences.js";
import { computeElections } from "../lib/electionEngine.js";
import { findRareWindows, rareToday } from "../lib/rareWindows.js";
import { linesUp, type HeldItem, needsWeaving } from "../lib/linesUp.js";
import { findLongSessions } from "../lib/longSession.js";
import { narrateSession } from "../lib/sessionNarration.js";
import { weaveDay, type WeaveItem } from "../lib/dayWeaver.js";
import { weaveWeek, type WeekItem } from "../lib/weekWeaver.js";
import { needsResolution } from "../lib/needsResolution.js";
import { tasks, goals, habits, habitLogs } from "@workspace/db";
import { computeNatalChart } from "../lib/natal.js";

const router: IRouter = Router();

router.get("/elections/activities", (_req, res) => {
  res.json({
    categories: ACTIVITY_CATEGORIES,
    activities: ACTIVITIES.map(a => ({
      key: a.key, label: a.label, category: a.category, element: a.element,
      planets: a.planets, hourRulers: a.hourRulers, signs: Object.keys(a.signs),
      houses: a.houses, phase: a.phase, voc: a.voc, mercuryRx: a.mercuryRx,
      windowType: a.windowType, gloss: a.gloss,
    })),
  });
});

// Sortage probe: match free text to an activity (stars, steps, tasks).
router.get("/elections/match", (req, res) => {
  const text = (req.query.text as string) ?? "";
  const hit = matchActivity(text);
  res.json(hit ? { key: hit.activity.key, label: hit.activity.label, score: hit.score, gloss: hit.activity.gloss } : null);
});

/**
 * GET /elections/lines-up — timing for what this person is ALREADY holding.
 *
 * Home's primary module. It reads the inventory itself rather than making the
 * user restate it: the previous design put a timing engine and the task list on
 * one screen and left the join to the reader.
 *
 * Nothing enters this feed that the person does not hold. A globally strong
 * window with no relationship to their life is exactly the horoscope-generator
 * output the product refuses.
 */
router.get("/elections/lines-up", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (!testerId) { res.status(401).json({ error: "tester required" }); return; }

  const hasCoords = req.query.lat != null && req.query.lon != null;
  const locationKnown = hasCoords && req.query.locationKnown !== "false";
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  // The viewer's IANA zone, e.g. "America/Chicago" — optional, sent alongside
  // the numeric offset. Corrects the offset for the SPECIFIC day in question
  // rather than trusting a snapshot, which is wrong by up to an hour on the
  // day a DST clock changes and stays wrong for a multi-day scan that runs
  // past one. Absent for any client that hasn't been updated yet, which is
  // exactly why every callee treats it as optional.
  const timeZone = typeof req.query.timeZone === "string" && req.query.timeZone ? req.query.timeZone : undefined;

  let natal = null;
  let timeKnown = true;
  try {
    const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
    if (stored?.birthDate && stored.birthTime != null) {
      natal = computeNatalChart(stored.birthDate, stored.birthTime, Number(stored.birthLat), Number(stored.birthLon), Number(stored.utcOffset), "whole-sign");
      timeKnown = stored.timeKnown !== false;
    }
  } catch { /* chartless is fine — GOOD tier only */ }

  const held: HeldItem[] = [];
  try {
    const openTasks = await db.select().from(tasks).where(eq(tasks.testerId, testerId));
    for (const t of openTasks) {
      if (t.done === "true") continue;
      held.push({
        id: `task-${t.id}`, title: t.title, kind: "task", activityKey: t.activityKey,
        // The reserved block, if there is one.
        scheduledFor: t.planningWindowId != null ? String(t.planningWindowId) : null,
        // When it was started — what lets the engine say "keep going" rather
        // than proposing a switch off work already underway.
        startedAt: t.startedAt ? new Date(t.startedAt).toISOString() : null,
      });
    }
    // Guiding Stars are directional, so the STEP is what gets timed, not the
    // aim. "Get fit" has no window; "long run" does.
    const stars = await db.select().from(goals).where(eq(goals.testerId, testerId));
    for (const g of stars) {
      if (g.status === "done" || g.status === "paused") continue;
      // The Star's own diagnosed activityKey is used when it has one — that
      // classification came from the planet-diagnosis flow and the user can see
      // and change it, so the keyword matcher must not overrule it.
      held.push({ id: `star-${g.id}`, title: g.title, kind: "star-step", activityKey: g.activityKey });
    }

    // ── HABITS ARE WORK TOO (integration audit 2026-08-13, gap 1).
    //
    // The habits table carries a complete timing signature — favoured
    // elements, phases, planets, a kind of work, a solar anchor — and the
    // timing engine had never read the table at all. Someone filled that
    // form in and nothing consumed a word of it. Optional was meant to mean
    // "the suggestion is skipped", not "the answer is discarded".
    //
    // Only what is genuinely OUTSTANDING is offered: a habit already done
    // today needs no window, and one whose cadence does not want it today
    // is not owed a slot. `occasional` habits are tracked and never scored,
    // so they are never chased here either.
    const habitRows = await db.select().from(habits).where(eq(habits.testerId, testerId));
    if (habitRows.length) {
      // The viewer's civil day, not the server's — habit logs are keyed to
      // the local date, and a server in UTC would ask about tomorrow all
      // evening for anyone west of it.
      const todayStr = new Date(Date.now() - tzOffsetMin * 60000).toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const logs = await db.select().from(habitLogs).where(eq(habitLogs.testerId, testerId));
      const doneToday = new Set(logs.filter(l => l.date === todayStr).map(l => l.habitId));
      const thisWeek = new Map<number, number>();
      for (const l of logs) {
        if (l.date >= weekAgo) thisWeek.set(l.habitId, (thisWeek.get(l.habitId) ?? 0) + 1);
      }
      for (const h of habitRows) {
        if (h.status !== "active") continue;
        if (doneToday.has(h.id)) continue;              // already kept today
        if (h.cadence === "occasional") continue;       // tracked, never chased
        if (h.cadence === "weekly") {
          // A weekly habit that has already met its target this week is not
          // outstanding — pressing it again is the manufactured obligation
          // the cadence model exists to prevent.
          const target = h.targetPerWeek ?? 3;
          if ((thisWeek.get(h.id) ?? 0) >= target) continue;
        }
        held.push({
          id: `habit-${h.id}`, title: h.name, kind: "habit",
          // No stored activityKey on habits — the title is matched the same
          // way a task's is, so the correspondence table stays the one
          // classifier rather than habits growing a private scheme.
          activityKey: null,
        });
      }
    }
  } catch {
    res.status(503).json({ error: "could not read your inventory", reason: "inventory-unread" });
    return;
  }

  // AN OUTAGE IS NOT A QUIET DAY.
  //
  // Unprotected, a throw in here became a generic 500, and the client could
  // only report "a connection problem" — which is a guess, and the wrong one
  // when the request arrived fine and the sky read is what failed. Worse, the
  // two failures need different words: not knowing what someone holds and not
  // having judged the sky are different admissions.
  //
  // The failure time is carried out because the surface states it, and a time
  // the client invents is not evidence of anything.
  try {
    res.json(linesUp({ held, lat, lon, tzOffsetMin, timeZone, natal, timeKnown, locationKnown }));
  } catch (err) {
    req.log?.error({ err }, "lines-up: sky read failed");
    res.status(503).json({
      error: "could not read the sky",
      reason: "sky-unread",
      at: new Date().toISOString(),
    });
  }
});

/**
 * GET /elections/long-session — a 3-4 hour block, with its internal arc.
 *
 * Returns DISTINCT TRADEOFFS rather than one winner: duration, exactitude and
 * availability are different things to want. When nothing of the requested
 * length exists it reports the shortfall — a four-hour request must never
 * quietly become the activity's twenty-minute minimum viable form.
 */
router.get("/elections/long-session", (req, res) => {
  const activityKey = (req.query.activity as string) ?? "";
  const minutes = Math.min(600, Math.max(30, parseInt((req.query.minutes as string) ?? "240", 10) || 240));
  const hasCoords = req.query.lat != null && req.query.lon != null;
  const locationKnown = hasCoords && req.query.locationKnown !== "false";
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const dateParam = req.query.date as string | undefined;
  // Parsed as a LOCAL date. `new Date("2026-08-05")` is UTC midnight, which is
  // the previous day for every western longitude.
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? new Date(Number(dateParam.slice(0, 4)), Number(dateParam.slice(5, 7)) - 1, Number(dateParam.slice(8, 10)), 12, 0, 0)
    : new Date();

  const wakeHour = req.query.wake != null ? parseFloat(req.query.wake as string) : undefined;
  const sleepHour = req.query.sleep != null ? parseFloat(req.query.sleep as string) : undefined;

  // The narration embeds clock times in prose, so it must be written in the
  // VIEWER's zone — the server's is UTC in production.
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  // The viewer's IANA zone, e.g. "America/Chicago" — optional, sent alongside
  // the numeric offset. Corrects the offset for the SPECIFIC day in question
  // rather than trusting a snapshot, which is wrong by up to an hour on the
  // day a DST clock changes and stays wrong for a multi-day scan that runs
  // past one. Absent for any client that hasn't been updated yet, which is
  // exactly why every callee treats it as optional.
  const timeZone = typeof req.query.timeZone === "string" && req.query.timeZone ? req.query.timeZone : undefined;

  const result = findLongSessions({ activityKey, minutes, date, lat, lon, wakeHour, sleepHour, locationKnown, tzOffsetMin, timeZone });
  if (!result) { res.status(404).json({ error: "unknown activity" }); return; }

  res.json({
    ...result,
    options: result.options.map(o => ({ ...o, narration: narrateSession(o.candidate, tzOffsetMin) })),
    shortfall: result.shortfall && {
      ...result.shortfall,
      narration: result.shortfall.candidate ? narrateSession(result.shortfall.candidate, tzOffsetMin) : null,
    },
  });
});

/**
 * GET /elections/shape-day — place what the person holds into today's time.
 *
 * Deliberately not "fill my day". Gaps and refusals are part of the answer:
 * `openTime` and `unplaced` are returned alongside `placed`, and the client is
 * expected to render open stretches as deliberate rather than as failure.
 */
router.get("/elections/shape-day", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (!testerId) { res.status(401).json({ error: "tester required" }); return; }

  const hasCoords = req.query.lat != null && req.query.lon != null;
  const locationKnown = hasCoords && req.query.locationKnown !== "false";
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const wakeHour = req.query.wake != null ? parseFloat(req.query.wake as string) : undefined;
  const sleepHour = req.query.sleep != null ? parseFloat(req.query.sleep as string) : undefined;
  // The weaver decides what "today" means with this; without it, a UTC server
  // rolls the user's evening into tomorrow and marks today's work overdue.
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  // The viewer's IANA zone, e.g. "America/Chicago" — optional, sent alongside
  // the numeric offset. Corrects the offset for the SPECIFIC day in question
  // rather than trusting a snapshot, which is wrong by up to an hour on the
  // day a DST clock changes and stays wrong for a multi-day scan that runs
  // past one. Absent for any client that hasn't been updated yet, which is
  // exactly why every callee treats it as optional.
  const timeZone = typeof req.query.timeZone === "string" && req.query.timeZone ? req.query.timeZone : undefined;
  const date = new Date();

  const items: WeaveItem[] = [];
  try {
    for (const t of await db.select().from(tasks).where(eq(tasks.testerId, testerId))) {
      if (!needsWeaving(t)) continue;
      items.push({
        id: `task-${t.id}`, title: t.title, kind: "task",
        estMinutes: t.estMinutes, dueDate: t.dueDate, startedAt: t.startedAt ? String(t.startedAt) : null,
        activityKey: t.activityKey,
      });
    }
    for (const g of await db.select().from(goals).where(eq(goals.testerId, testerId))) {
      if (g.status === "done" || g.status === "paused") continue;
      items.push({ id: `star-${g.id}`, title: g.title, kind: "star-step", activityKey: g.activityKey });
    }
  } catch {
    res.status(503).json({ error: "could not read your inventory" });
    return;
  }

  res.json(weaveDay({ items, date, lat, lon, wakeHour, sleepHour, locationKnown, tzOffsetMin, timeZone }));
});

/**
 * GET /elections/shape-week — the week's work distributed across days.
 *
 * Distribution is the one thing this does that shaping each day separately
 * cannot: seven days optimised independently will happily carry five
 * consecutive major blocks, because each day alone had room.
 *
 * Days deliberately left open are part of the answer, not a failure to fill.
 */
router.get("/elections/shape-week", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (!testerId) { res.status(401).json({ error: "tester required" }); return; }

  const hasCoords = req.query.lat != null && req.query.lon != null;
  const locationKnown = hasCoords && req.query.locationKnown !== "false";
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const wakeHour = req.query.wake != null ? parseFloat(req.query.wake as string) : undefined;
  const sleepHour = req.query.sleep != null ? parseFloat(req.query.sleep as string) : undefined;
  const days = Math.min(14, Math.max(2, parseInt((req.query.days as string) ?? "7", 10) || 7));
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  // The viewer's IANA zone, e.g. "America/Chicago" — optional, sent alongside
  // the numeric offset. Corrects the offset for the SPECIFIC day in question
  // rather than trusting a snapshot, which is wrong by up to an hour on the
  // day a DST clock changes and stays wrong for a multi-day scan that runs
  // past one. Absent for any client that hasn't been updated yet, which is
  // exactly why every callee treats it as optional.
  const timeZone = typeof req.query.timeZone === "string" && req.query.timeZone ? req.query.timeZone : undefined;

  const items: WeekItem[] = [];
  try {
    for (const t of await db.select().from(tasks).where(eq(tasks.testerId, testerId))) {
      if (!needsWeaving(t)) continue;
      items.push({
        id: `task-${t.id}`, title: t.title, kind: "task",
        estMinutes: t.estMinutes, dueDate: t.dueDate,
        startedAt: t.startedAt ? String(t.startedAt) : null,
        activityKey: t.activityKey,
        starId: t.goalId != null ? `goal-${t.goalId}` : null,
      });
    }
    for (const g of await db.select().from(goals).where(eq(goals.testerId, testerId))) {
      if (g.status === "done" || g.status === "paused") continue;
      items.push({ id: `star-${g.id}`, title: g.title, kind: "star-step", activityKey: g.activityKey, starId: `goal-${g.id}` });
    }
  } catch {
    res.status(503).json({ error: "could not read your inventory" });
    return;
  }

  res.json(weaveWeek({ items, startDate: new Date(), lat, lon, wakeHour, sleepHour, locationKnown, days, tzOffsetMin, timeZone }));
});

/**
 * GET /elections/needs-resolution — what still blocks placement.
 *
 * Asked when the person opens a scheduling surface, never at capture. The two
 * uncertainties are returned SEPARATELY because they are different questions:
 * what kind of work is this, and how much room should it get.
 */
router.get("/elections/needs-resolution", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (!testerId) { res.status(401).json({ error: "tester required" }); return; }
  try {
    const rows = (await db.select().from(tasks).where(eq(tasks.testerId, testerId)))
      .filter(t => t.done !== "true")
      // A confirmed key is the person's own answer and outranks the matcher.
      .map(t => ({ id: `task-${t.id}`, title: t.title, estMinutes: t.estMinutes, activityKey: t.activityKey }));
    res.json(needsResolution(rows));
  } catch {
    res.status(503).json({ error: "could not read your inventory" });
  }
});

// The engine: activity → tiered times. Personalizes when the tester has a
// natal chart on file (x-tester-id header); works chart-less at GOOD tier.
router.get("/elections/times", async (req, res) => {
  const activityKey = (req.query.activity as string) ?? "";
  const span = (["day", "week", "month"].includes(req.query.span as string) ? req.query.span : "week") as "day" | "week" | "month";
  // ABSENT coordinates are not a reason to invent New York. The client sends
  // locationKnown=false when it only has a timezone guess; the fallback then
  // supports the universal layer and nothing local.
  const hasCoords = req.query.lat != null && req.query.lon != null;
  const locationKnown = hasCoords && req.query.locationKnown !== "false";
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  // The viewer's IANA zone, e.g. "America/Chicago" — optional, sent alongside
  // the numeric offset. Corrects the offset for the SPECIFIC day in question
  // rather than trusting a snapshot, which is wrong by up to an hour on the
  // day a DST clock changes and stays wrong for a multi-day scan that runs
  // past one. Absent for any client that hasn't been updated yet, which is
  // exactly why every callee treats it as optional.
  const timeZone = typeof req.query.timeZone === "string" && req.query.timeZone ? req.query.timeZone : undefined;

  let natal = null;
  let timeKnown = true;
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (testerId) {
    try {
      const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
      if (stored?.birthDate && stored.birthTime != null) {
        natal = computeNatalChart(stored.birthDate, stored.birthTime, Number(stored.birthLat), Number(stored.birthLon), Number(stored.utcOffset), "whole-sign");
        // `birthTime != null` is NOT the same question as "is the time known".
        // Settings stores `birthTime || "12:00"` alongside timeKnown:false, so
        // an untimed chart arrives here looking fully specified and would have
        // been given house cusps derived from a noon nobody was born at.
        timeKnown = stored.timeKnown !== false;
      }
    } catch { /* chartless is fine — GOOD tier only */ }
  }

  const result = computeElections({ activityKey, span, lat, lon, tzOffsetMin, timeZone, natal, timeKnown, locationKnown });
  if (!result) { res.status(404).json({ error: "unknown activity" }); return; }
  res.json(result);
});

/**
 * The rare-window question: not "when is the next good hour for this" (that
 * is /elections/times) but "when is the next EXCEPTIONAL day for it" — the
 * one worth moving a week around. Day-scale by design; the hour inside a
 * returned day still comes from the canonical engine above.
 */
/**
 * "Is today exceptional for anything at all?" — the homepage's question,
 * across every category. Strict by construction (see rareToday): most days
 * answer with an empty list, which is the point.
 */
router.get("/elections/rare-today", async (req, res) => {
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  const testerId = req.headers["x-tester-id"] as string | undefined;

  // What the person actually holds, so a once-in-two-years day for their own
  // work leads over one for an activity they have never mentioned. Failure
  // here degrades to the unranked notice rather than losing it: knowing the
  // sky is still worth something when the inventory read fails.
  const heldActivityKeys: string[] = [];
  if (testerId) {
    try {
      const rows = await db.select().from(tasks).where(eq(tasks.testerId, testerId));
      for (const t of rows) {
        if (t.done === "true") continue;
        const key = t.activityKey ?? matchActivity(t.title ?? "")?.activity.key;
        if (key) heldActivityKeys.push(key);
      }
      const starRows = await db.select().from(goals).where(eq(goals.testerId, testerId));
      for (const g of starRows) {
        if (g.status === "done" || g.status === "paused") continue;
        const key = g.activityKey ?? matchActivity(g.title ?? "")?.activity.key;
        if (key) heldActivityKeys.push(key);
      }
      const habitRows = await db.select().from(habits).where(eq(habits.testerId, testerId));
      for (const h of habitRows) {
        if (h.status !== "active") continue;
        const key = matchActivity(h.name ?? "")?.activity.key;
        if (key) heldActivityKeys.push(key);
      }
    } catch { /* unranked is still true */ }
  }

  res.json(rareToday(Date.now(), { tzOffsetMin, limit: 3, heldActivityKeys }));
});

router.get("/elections/rare", (req, res) => {
  const activityKey = (req.query.activity as string) ?? "";
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  // Two years by default: long enough that a Jupiter or Saturn sign change
  // falls inside it, which is what produces the rarest windows of all.
  const horizonDays = Math.min(1460, Math.max(30, parseInt((req.query.days as string) ?? "730", 10) || 730));
  const limit = Math.min(10, Math.max(1, parseInt((req.query.limit as string) ?? "5", 10) || 5));
  try {
    res.json(findRareWindows(activityKey, Date.now(), { horizonDays, limit, tzOffsetMin }));
  } catch {
    res.status(404).json({ error: "unknown activity" });
  }
});

export default router;
