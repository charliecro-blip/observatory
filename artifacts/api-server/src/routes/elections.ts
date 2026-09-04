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
import { eq, and, gte } from "drizzle-orm";
import { ACTIVITIES, ACTIVITY_CATEGORIES, matchActivity, activityByKey, rankActivities } from "../lib/activityCorrespondences.js";
import { customActivitiesFor } from "./customActivities.js";
import { computeElections } from "../lib/electionEngine.js";
import { findRareWindows, rareToday } from "../lib/rareWindows.js";
import { linesUp, type HeldItem, needsWeaving, pickBestWindow } from "../lib/linesUp.js";
import { findLongSessions } from "../lib/longSession.js";
import { narrateSession } from "../lib/sessionNarration.js";
import { weaveDay, type WeaveItem } from "../lib/dayWeaver.js";
import { weaveWeek, weekDates, type WeekItem } from "../lib/weekWeaver.js";
import { needsResolution } from "../lib/needsResolution.js";
import { tasks, goals, habits, habitLogs, planningWindows, testerProfiles } from "@workspace/db";
import { fetchGcalBusy } from "./googleCal.js";
import { readCalendar, bucketByDay, spanOf } from "../lib/calendarCommitments.js";
import { dayBoundsIn, dayBoundsInZone } from "../lib/localClock.js";
import { computeNatalChart } from "../lib/natal.js";
import { vocSpansBetween } from "../lib/dayarc.js";
import { julianDay, eclipseWindow } from "../lib/astro.js";
import { requireFeature } from "../middlewares/entitlement.js";
import { dayMet as habitDayMet } from "../lib/habitCadence.js";

const router: IRouter = Router();

router.get("/elections/activities", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string | undefined;
  // A tester's own custom activities ride alongside the built-in fifty in
  // the SAME picker — sortage into astrological energies was the whole
  // point of letting someone add one (owner 2026-09-03). No testerId means
  // exactly the impersonal list this route has always returned.
  const custom = testerId ? await customActivitiesFor(testerId) : [];
  const all = [...ACTIVITIES, ...custom];
  res.json({
    categories: ACTIVITY_CATEGORIES,
    activities: all.map(a => ({
      key: a.key, label: a.label, category: a.category, element: a.element,
      planets: a.planets, hourRulers: a.hourRulers, signs: Object.keys(a.signs),
      houses: a.houses, phase: a.phase, voc: a.voc, mercuryRx: a.mercuryRx,
      windowType: a.windowType, gloss: a.gloss,
      custom: custom.some(c => c.key === a.key),
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

  // Started HERE, awaited after the inventory reads: the calendar fetch (D6)
  // rides Google's latency, and running it beside the DB work instead of
  // after it keeps the loop's new honesty from costing the landing page the
  // very seconds the study measured (D7). The promise never rejects — the
  // helper returns {ok:false} on every failure path.
  const busyPromise = (async () => {
    try {
      const dayStart = new Date(Date.now() - ((Date.now() - tzOffsetMin * 60000) % 86400000));
      return await fetchGcalBusy(testerId, dayStart.toISOString(), new Date(dayStart.getTime() + 86400000).toISOString());
    } catch { return { ok: false as const, connected: false, busy: [] }; }
  })();

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
        // The deadline, so the loop's plain why-line can state it.
        dueDate: t.dueDate ?? null,
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
      // COUNTS, not presence — a `several` habit's first tick today must not
      // read as "kept" the way one tick reads for every other cadence. A
      // Map here rather than a Set, so isDoneToday can ask "how many" and not
      // just "at all". The rule itself is shared with habits.ts — see
      // lib/habitCadence's dayMet.
      const todayCounts = new Map<number, number>();
      for (const l of logs.filter(l => l.date === todayStr)) {
        todayCounts.set(l.habitId, (todayCounts.get(l.habitId) ?? 0) + 1);
      }
      const isDoneToday = (h: typeof habitRows[number]) =>
        habitDayMet(h.cadence as any, todayCounts.get(h.id) ?? 0, h.targetPerDay);
      const thisWeek = new Map<number, number>();
      for (const l of logs) {
        if (l.date >= weekAgo) thisWeek.set(l.habitId, (thisWeek.get(l.habitId) ?? 0) + 1);
      }
      for (const h of habitRows) {
        if (h.status !== "active") continue;
        if (isDoneToday(h)) continue;                    // already kept today
        if (h.cadence === "occasional") continue;       // tracked, never chased
        if (h.cadence === "weekly") {
          // A weekly habit that has already met its target this week is not
          // outstanding — pressing it again is the manufactured obligation
          // the cadence model exists to prevent.
          const target = h.targetPerWeek ?? 3;
          if ((thisWeek.get(h.id) ?? 0) >= target) continue;
        }
        // A `several` habit stays offered until TODAY'S target is met —
        // isDoneToday already handled that above — but once met it should not
        // also be chased against a weekly sum the way a weekly habit is; there
        // is no separate weekly gate for it here by design.
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
  // The calendar's commitments, consulted by the loop before it names a time
  // (HOME study D6). Failure degrades to "didn't consult it" — an unreachable
  // calendar must not take the landing page's answer down with it, and the
  // fetch is bounded to 2.5s and has been running beside the DB reads above.
  const b = await busyPromise;
  const busy = b.ok ? b.busy : [];
  // "Consulted and answered" — the only state in which the plain why-line may
  // make claims about free time. No calendar linked and a failed fetch both
  // leave busy empty, and neither is evidence of a clear day.
  const busyKnown = b.ok && b.connected;

  try {
    res.json(linesUp({ held, lat, lon, tzOffsetMin, timeZone, natal, timeKnown, locationKnown, busy, busyKnown }));
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
router.get("/elections/long-session", requireFeature("sessions.long"), async (req, res) => {
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

  // "Where does a week actually have hours free in a row" is a claim about
  // AVAILABILITY, and until now it was only a claim about waking hours: the
  // scan knew when you were awake and nothing about what you had already
  // agreed to. A four-hour span with a one-hour meeting inside it was returned
  // as uninterrupted.
  //
  // No tester header is not an error here — it just means there is no calendar
  // to read, and the answer says so rather than implying the hours were checked.
  const testerId = (req.headers["x-tester-id"] as string | undefined)?.trim();
  const [dayStart, dayEnd] = timeZone ? dayBoundsInZone(date, timeZone) : dayBoundsIn(date, tzOffsetMin);
  const cal = readCalendar(
    testerId
      ? await (async () => { try { return await fetchGcalBusy(testerId, dayStart.toISOString(), dayEnd.toISOString()); } catch { return null; } })()
      : { ok: true, connected: false, busy: [] },
  );

  const result = findLongSessions({ activityKey, minutes, date, lat, lon, wakeHour, sleepHour, locationKnown, tzOffsetMin, timeZone, commitments: cal.commitments });
  if (!result) { res.status(404).json({ error: "unknown activity" }); return; }

  res.json({
    ...result,
    calendar: { consulted: cal.consulted, connected: cal.connected, commitments: cal.commitments.length },
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
router.get("/elections/shape-day", requireFeature("shape.day"), async (req, res) => {
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
  // The plain weave (home-base build 2026-08-16): the astro-quiet lens asks
  // for placement without elections — deadline pressure, stated energy, busy
  // blocks, first-fit. Same weaver, one flag; refusals stay honest either way.
  const consultSky = req.query.sky !== "false";
  const date = new Date();

  // The calendar's commitments, so no placement lands on a meeting. Failure
  // degrades to "didn't consult it", same contract as the loop's busy read.
  const busyPromise = (async () => {
    try {
      const dayStart = new Date(Date.now() - ((Date.now() - tzOffsetMin * 60000) % 86400000));
      return await fetchGcalBusy(testerId, dayStart.toISOString(), new Date(dayStart.getTime() + 86400000).toISOString());
    } catch { return { ok: false as const, connected: false, busy: [] }; }
  })();

  // THE ROUTE RHYTHM reaches the weaver here. The preference is the synced
  // blob on the profile; "route" asks the weave to keep each item's usual
  // slot, which is read off the person's own past windows — the same title,
  // placed at about the same clock, at least twice in the last six weeks.
  let protectRoutine = false;
  const usualStarts = new Map<string, string>();
  try {
    const prof = (await db.select({ prefs: testerProfiles.prefs }).from(testerProfiles).where(eq(testerProfiles.testerId, testerId)).limit(1))[0];
    // Override-aware, like the client's effectiveRhythm: an accepted gear
    // change is the rhythm in force until its date.
    const disp = (prof?.prefs as any)?.display ?? {};
    const ov = disp.rhythmOverride;
    const rhythm = ov && ov.until && Date.parse(ov.until) > Date.now() ? ov.rhythm : disp.rhythm;
    protectRoutine = rhythm === "route";
    if (protectRoutine) {
      const since = new Date(Date.now() - 42 * 86400000);
      const past = await db.select({ title: planningWindows.title, startAt: planningWindows.startTime })
        .from(planningWindows)
        .where(and(eq(planningWindows.testerId, testerId), gte(planningWindows.startTime, since)));
      const byTitle = new Map<string, number[]>();
      for (const w of past) {
        if (!w.startAt) continue;
        // Minutes after local midnight, in the viewer's zone.
        const local = new Date(new Date(w.startAt).getTime() - tzOffsetMin * 60000);
        const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
        const k = w.title.trim().toLowerCase();
        byTitle.set(k, [...(byTitle.get(k) ?? []), mins]);
      }
      for (const [k, list] of byTitle) {
        if (list.length < 2) continue;
        const sorted = [...list].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        // A habit of timing, not a coincidence: most placements within 45 min of the median.
        const near = sorted.filter(m => Math.abs(m - median) <= 45).length;
        if (near * 2 >= sorted.length) {
          usualStarts.set(k, `${String(Math.floor(median / 60)).padStart(2, "0")}:${String(median % 60).padStart(2, "0")}`);
        }
      }
    }
  } catch { /* no profile or no history: the weave runs without a routine to protect */ }

  const items: WeaveItem[] = [];
  try {
    for (const t of await db.select().from(tasks).where(eq(tasks.testerId, testerId))) {
      if (!needsWeaving(t)) continue;
      items.push({
        id: `task-${t.id}`, title: t.title, kind: "task",
        estMinutes: t.estMinutes, dueDate: t.dueDate, startedAt: t.startedAt ? String(t.startedAt) : null,
        activityKey: t.activityKey, energy: t.energy,
        usualStart: usualStarts.get(t.title.trim().toLowerCase()) ?? null,
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

  const b = await busyPromise;
  const commitments = b.ok
    ? b.busy.map(x => ({ startAt: new Date(x.startMs), endAt: new Date(x.endMs) }))
    : [];

  res.json(weaveDay({ items, date, lat, lon, wakeHour, sleepHour, locationKnown, tzOffsetMin, timeZone, commitments, consultSky, protectRoutine }));
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
router.get("/elections/shape-week", requireFeature("shape.week"), async (req, res) => {
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

  // THE WEEK'S REAL COMMITMENTS. Shape Today has consulted the calendar since
  // it was built; the week never did, so the two rooms could disagree about
  // the same Tuesday — Today routing around the dentist while the week placed
  // an afternoon of deep work straight through it.
  //
  // The days come from `weekDates` rather than being recomputed here, because
  // the weaver reads `commitmentsByDay` by those exact keys and quietly
  // ignores any others; a near-miss key would restore the bug while looking
  // like a fix.
  const startDate = new Date();
  const { dates, keys } = weekDates(startDate, days, tzOffsetMin, timeZone);
  const { startIso, endIso } = spanOf(dates, tzOffsetMin, timeZone);
  const cal = readCalendar(
    await (async () => { try { return await fetchGcalBusy(testerId, startIso, endIso); } catch { return null; } })(),
  );
  const commitmentsByDay = bucketByDay(cal.commitments, dates, keys, tzOffsetMin, timeZone);

  const woven = weaveWeek({ items, startDate, lat, lon, wakeHour, sleepHour, locationKnown, days, tzOffsetMin, timeZone, commitmentsByDay });

  res.json({
    ...woven,
    // Said out loud, because a week shaped around a calendar and a week shaped
    // in ignorance of one look exactly alike once the placements are drawn.
    // The warning rides the channel the surface already renders, so no client
    // has to remember to check a flag before believing the hours.
    warnings: cal.consulted ? woven.warnings : [
      ...woven.warnings,
      "Your calendar didn't answer just now, so these times were chosen without it and may land on something you've already agreed to.",
    ],
    calendar: { consulted: cal.consulted, connected: cal.connected, commitments: cal.commitments.length },
  });
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

  // A custom activity's key (e.g. "custom-14") is invisible to the built-in
  // ACTIVITIES table, so its own rule set has to ride along here too — the
  // same reason /elections/activities merges them into one picker.
  const extraActivities = testerId ? await customActivitiesFor(testerId) : [];

  const result = computeElections({ activityKey, span, lat, lon, tzOffsetMin, timeZone, natal, timeKnown, locationKnown, extraActivities });
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


/**
 * GET /plan/inventory — what you're holding, and where the week has room.
 *
 * The Schedule room used to render seven open tasks as the sentence "You're
 * holding 7 things already" and offer a paste box for work not yet captured
 * (workshop, 2026-08-21). This is the inventory itself: every open task with
 * the kind of work it is, whether it can be placed at all, and the hour this
 * week that suits it.
 *
 * SPREAD, NOT STACKED. Asked independently, five different tasks all answer
 * "Friday 7 AM" — the engine's day opens at the waking hour and a whole-day
 * sign affinity starts there too, so the naive version of this view would put
 * the entire list on one morning. Windows are handed out greedily by
 * practical priority, at most two a day, and a day already used is skipped
 * when another day is available. The elections are computed ONCE per distinct
 * activity, not once per task.
 */
const INVENTORY_MEMO = new Map<string, ReturnType<typeof computeElections>>();

router.get("/plan/inventory", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (!testerId) { res.status(401).json({ error: "tester required" }); return; }
  const hasCoords = req.query.lat != null && req.query.lon != null;
  const locationKnown = hasCoords && req.query.locationKnown !== "false";
  const lat = parseFloat((req.query.lat as string) ?? "40.7");
  const lon = parseFloat((req.query.lon as string) ?? "-74.0");
  const tzOffsetMin = parseInt((req.query.tz as string) ?? "0", 10) || 0;
  const timeZone = typeof req.query.timeZone === "string" && req.query.timeZone ? req.query.timeZone : undefined;

  let natal = null; let timeKnown = true;
  try {
    const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
    if (stored?.birthDate && stored.birthTime != null) {
      natal = computeNatalChart(stored.birthDate, stored.birthTime, Number(stored.birthLat), Number(stored.birthLon), Number(stored.utcOffset), "whole-sign");
      timeKnown = stored.timeKnown !== false;
    }
  } catch { /* chartless is fine */ }

  let rows: Array<typeof tasks.$inferSelect> = [];
  try { rows = await db.select().from(tasks).where(eq(tasks.testerId, testerId)); }
  catch { res.status(503).json({ error: "could not read your list" }); return; }

  const open = rows.filter(t => t.done !== "true");
  // Practical priority — the same order the weaver uses, so the two agree
  // about what comes first.
  const today = new Date(Date.now() - tzOffsetMin * 60000).toISOString().slice(0, 10);
  const rank = (t: typeof tasks.$inferSelect) =>
    t.planningWindowId != null ? 5
    : t.dueDate && t.dueDate < today ? 0
    : t.dueDate === today ? 1
    : t.dueDate ? 2 : 3;
  const ordered = [...open].sort((a, b) => rank(a) - rank(b) || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));

  // One election scan per DISTINCT activity, reused across every task that
  // shares it — and MEMOIZED across requests, because the engine is
  // synchronous and a week scan is ~380ms. Five of them measured 1.9s of
  // blocked thread, which is how this repo has produced a 90-second calendar
  // request before. The key carries everything the answer depends on
  // (chart included, via the tester) and the day, so it cannot serve
  // yesterday's week or another person's houses.
  const dayKey = today;
  const scanFor = (key: string) => {
    const memoKey = `${testerId}|${dayKey}|${key}|${lat.toFixed(2)}|${lon.toFixed(2)}|${tzOffsetMin}|${timeZone ?? ""}|${locationKnown}`;
    const hit = INVENTORY_MEMO.get(memoKey);
    if (hit) return hit;
    const out = computeElections({
      activityKey: key, span: "week", lat, lon, tzOffsetMin, timeZone, natal, timeKnown, locationKnown,
    });
    if (INVENTORY_MEMO.size >= 200) INVENTORY_MEMO.delete(INVENTORY_MEMO.keys().next().value!);
    INVENTORY_MEMO.set(memoKey, out);
    return out;
  };
  // Bounded work per request: a list spanning a dozen kinds of work would
  // otherwise scan a dozen weeks. Beyond the cap a task is still placeable and
  // simply has no proposed hour, which the interface says rather than hides.
  const MAX_SCANS = 6;
  const scanned = new Set<string>();

  const usedPerDay = new Map<string, number>();
  const nowMs = Date.now();
  const holding = ordered.map(t => {
    // The stored kind first; failing that, the same deterministic read of the
    // title the weaver uses, at the same bar (a weak match is not a
    // classification). Inferred, never written: naming the work is the
    // person's to confirm, and the interface marks which is which. Without
    // this six of seven ordinary tasks said "needs a kind of work" for a fact
    // the app could derive for free.
    const stored = t.activityKey ? activityByKey(t.activityKey) : null;
    const guess = stored ? null : (() => {
      const r = rankActivities(t.title, 2);
      return r[0] && r[0].score >= 2.0 ? r[0].activity : null;
    })();
    const act = stored ?? guess;
    // When nothing matches well enough, offer the nearest few rather than
    // only reporting the gap — a row that says "needs a kind of work" and
    // gives no way to give it one is a scolding, not a control.
    const kindOptions = act ? [] : rankActivities(t.title, 3)
      .filter(r => r.score > 0)
      .map(r => ({ key: r.activity.key, label: r.activity.label }));
    const base = {
      id: t.id, title: t.title, dueDate: t.dueDate ?? null,
      estMinutes: t.estMinutes ?? null, goalId: t.goalId ?? null,
      activityKey: act?.key ?? null, activityLabel: act?.label ?? null,
      inferredKind: !!guess,
      kindOptions,
    };
    if (t.planningWindowId != null) return { ...base, state: "scheduled" as const };
    if (!act) return { ...base, state: "needs-kind" as const };
    if (!t.estMinutes) return { ...base, state: "needs-duration" as const };

    if (!scanned.has(act.key) && scanned.size >= MAX_SCANS) {
      return { ...base, state: "placeable" as const, window: null, unscanned: true };
    }
    scanned.add(act.key);
    const scan = scanFor(act.key);
    const all = scan?.windows ?? [];
    // Skip days that already have their share, unless nothing else is left.
    const roomy = all.filter(w => (usedPerDay.get(w.date) ?? 0) < 2);
    const win = pickBestWindow(roomy.length ? roomy : all, nowMs);
    if (win) usedPerDay.set(win.date, (usedPerDay.get(win.date) ?? 0) + 1);
    return {
      ...base,
      state: "placeable" as const,
      window: win ? {
        date: win.date, dow: win.dow, startAt: win.startAt, endAt: win.endAt,
        startClock: win.startClock, endClock: win.endClock, allDay: !!win.allDay,
        tier: win.tier, why: win.why,
      } : null,
    };
  });

  // The week's own conditions, said before anything is offered — the room
  // promised "the stretches of your week that suit each kind of work" and
  // showed no stretches at all.
  const dayMs = 86400000;
  const startOfToday = Date.parse(`${today}T00:00:00Z`) + tzOffsetMin * 60000;
  const voidDays = new Set(
    vocSpansBetween(startOfToday, startOfToday + 7 * dayMs)
      .map(v => new Date(Date.parse(v.start) - tzOffsetMin * 60000).toISOString().slice(0, 10)),
  );
  // The corridor as the rest of the app reads it, from today — an eclipse
  // eight days out still shapes the week the room is about to place work in.
  const ecl = eclipseWindow(julianDay(new Date(startOfToday + 12 * 3600000)));
  const eclipse = ecl.active && ecl.kind
    ? { kind: ecl.kind, date: new Date(startOfToday + (ecl.daysAway ?? 0) * dayMs).toISOString().slice(0, 10), daysAway: ecl.daysAway ?? 0 }
    : null;
  res.json({
    holding,
    week: { days: 7, voidDays: [...voidDays].sort(), eclipse },
  });
});
