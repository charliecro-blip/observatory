/**
 * Email reports — the day / week / month ahead, composed as an email.
 *
 *   GET /api/reports/preview?span=day|week|month&tz=&lat=&lon=&format=html|json
 *
 * Phase 1 (this): the CONTENT — real data composed into subject + HTML + text,
 * previewable in a browser tab so the voice can be tuned before any sending
 * infrastructure exists. Phase 2 wires a sender (e.g. Resend) + a morning cron
 * on Railway + a Settings opt-in with an email address. Push/text notifications
 * are a later phase still (owner call, 2026-07-05).
 *
 * Voice rules (see artifacts/tides/EMAIL-REPORTS.md): describe conditions,
 * never promise outcomes; weather register; short enough to read at the
 * kitchen counter; the reader's own aims lead, the sky supports.
 */
import { Router, type IRouter } from "express";
import { db, natalCharts, planningWindows, goals, emailSubscriptions, tasks, habits, habitLogs, usageEvents } from "@workspace/db";
import { and, eq, gte, lte, lt, inArray } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { sendEmail, emailConfigured } from "../lib/email.js";
import { bustEmailSubscriptionCache } from "../lib/notifier.js";
import {
  julianDay, moonPhase, voidOfCourse, getDailyElementEmphasis, getPlanetPositions,
} from "../lib/astro.js";
import { computeNatalChart, computeTransitAspects, computeTransitForecast } from "../lib/natal.js";
import { computeElections } from "../lib/electionEngine.js";
import { dayReading } from "../lib/synthesis.js";
import { computeDayArc } from "../lib/dayarc.js";
import { domicileLord } from "../lib/dignity.js";
import {
  SIGN_GUIDE, PHASE_GUIDE, DAY_RULER, DAY_RULER_GIFT, favoredActivities, bestFor,
  easeOff, transitMeaning, rankTransits, type DaySky,
} from "../lib/interpretation.js";

const router: IRouter = Router();

// Point in the lunar cycle, from the phase name, for activity-fit scoring.
function phaseKeyOf(name: string): DaySky["phaseKey"] {
  if (name === "New Moon") return "new";
  if (name === "Full Moon") return "full";
  return /wan|last quarter|balsamic/i.test(name) ? "waning" : "waxing";
}
// Julian day at LOCAL noon of the day `d` offsets from today — one clean
// reference so the week's moon signs match the daily card (no tz double-count).
function localNoonJd(tz: number, d: number): number {
  const dayLocal = new Date(Date.now() - tz * 60000 + d * 86400000);
  const utcMs = Date.UTC(dayLocal.getUTCFullYear(), dayLocal.getUTCMonth(), dayLocal.getUTCDate(), 12, 0, 0) + tz * 60000;
  return julianDay(new Date(utcMs));
}
async function activeStars(testerId: string) {
  return db.select().from(goals).where(and(eq(goals.testerId, testerId), eq(goals.status, "active")));
}

// ── The reader's own day ─────────────────────────────────────────────────────
// The composer used to import only natalCharts/planningWindows/goals, so it
// could describe the sky in fine detail and knew nothing about what the person
// actually had to do — 0 of 30 simulated emails named a single task or due
// date. These are the joins that let the email be about the reader.

const DETAILS = ["minimal", "medium", "full"] as const;
type Detail = (typeof DETAILS)[number];

/** An/a, so we stop emailing "A Aquarius Moon" (7 of 30 days). */
const artcl = (w: string) => (/^[aeiou]/i.test(w) ? "An" : "A");

interface OwnedRow { text: string; planet: string | null; sort: number; title: string; overdueDays: number }

async function ownedToday(testerId: string, todayStr: string, tomorrowStr: string) {
  const open = await db.select().from(tasks).where(and(
    eq(tasks.testerId, testerId), eq(tasks.done, "false"),
  ));
  const rows: OwnedRow[] = [];
  for (const t of open) {
    if (!t.dueDate) continue;
    // How long this has actually been hanging around — from the ORIGINAL due
    // date where auto-rollover has been carrying it, else the due date itself.
    const from = t.originalDueDate ?? t.dueDate;
    const ageDays = Math.max(0, Math.round(
      (Date.parse(todayStr + "T12:00:00Z") - Date.parse(String(from) + "T12:00:00Z")) / 86400000));
    const carried = !!(t.originalDueDate && t.originalDueDate < (t.dueDate ?? ""));
    if (t.dueDate === todayStr) {
      rows.push({
        title: t.title, overdueDays: carried ? ageDays : 0,
        text: `${t.title}${carried ? ` · carried ${ageDays} day${ageDays === 1 ? "" : "s"}` : ""}`,
        planet: t.planet ?? null, sort: carried ? 0 : 1,
      });
    } else if (t.dueDate === tomorrowStr) {
      rows.push({ title: t.title, overdueDays: 0, text: `${t.title} · due tomorrow`, planet: t.planet ?? null, sort: 3 });
    } else if (t.dueDate < todayStr) {
      rows.push({
        title: t.title, overdueDays: ageDays,
        text: `${t.title} · ${ageDays} day${ageDays === 1 ? "" : "s"} overdue`,
        planet: t.planet ?? null, sort: 0,
      });
    }
  }
  return rows.sort((a, b) => a.sort - b.sort);
}

/** Dailies not yet logged today — the habit half of "what's mine today". */
async function openDailies(testerId: string, todayStr: string) {
  const rows = await db.select().from(habits).where(and(
    eq(habits.testerId, testerId), eq(habits.status, "active"), eq(habits.cadence, "daily"),
  ));
  if (!rows.length) return [] as string[];
  const logged = await db.select().from(habitLogs).where(and(
    eq(habitLogs.testerId, testerId), eq(habitLogs.date, todayStr),
    inArray(habitLogs.habitId, rows.map((h) => h.id)),
  ));
  const doneIds = new Set(logged.map((l) => l.habitId));
  return rows.filter((h) => !doneIds.has(h.id)).map((h) => h.name);
}

/** One line of yesterday — the only block that proves the app is watching. */
async function yesterdayLine(testerId: string, yStr: string): Promise<string | null> {
  const closed = await db.select().from(tasks).where(and(
    eq(tasks.testerId, testerId), eq(tasks.done, "true"),
  ));
  const n = closed.filter((t) => t.dueDate === yStr).length;
  if (n > 0) return `Yesterday you closed ${n}.`;
  return "Yesterday was quiet — that's a day in the log too.";
}

function localDate(tz: number, offsetDays = 0): Date {
  return new Date(Date.now() - tz * 60000 + offsetDays * 86400000);
}
function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Block { heading?: string; lines: string[] }

async function natalFor(testerId: string) {
  const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
  if (!stored) return null;
  return {
    stored,
    computed: computeNatalChart(stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset),
    timeKnown: stored.timeKnown !== false,
  };
}

// ── Email instrumentation ────────────────────────────────────────────────────
// There was NO email telemetry at all: no sent, no open, no click. Which meant
// the one surface that reaches people who never open the app was also the one
// surface we could not measure — a subscriber could quietly stop reading for a
// month and nothing would record it.

export async function logEmailEvent(testerId: string, event: string, props: Record<string, unknown> = {}) {
  try { await db.insert(usageEvents).values({ testerId, event, props }); } catch { /* telemetry must never break a send */ }
}

/** 1×1 transparent GIF — the open beacon. */
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// ── Span composers ────────────────────────────────────────────────────────────
// Exported so the notifier can compose + send the same reports on its cron.

export async function composeDay(testerId: string, tz: number, lat: number, lon: number, detail: Detail = "medium") {
  const now = new Date();
  const jd = julianDay(now);
  const local = localDate(tz);
  const { name: phaseName, fraction } = moonPhase(jd);
  const elem = getDailyElementEmphasis(jd);
  // The void is a WINDOW, not a property of the day — and treating it as the
  // latter shipped a real miss: on 2026-07-30 the Moon was void until 8:01 AM
  // and in Pisces thereafter, and the 7 AM email went out titled "Begin nothing
  // today". By the time it was read the condition had already ended.
  //
  // `voidOfCourse(jd)` answers only "is it void at this instant", which at send
  // time is 7 AM. computeDayArc already returns the real windows with true
  // ingress ends (it is what the app's own rail uses to say "until 8:01 AM"),
  // so the email uses those instead.
  const vocWindows = computeDayArc(now, lat, lon, tz).vocWindows;
  const dayEndMs = Date.parse(localDate(tz, 1).toISOString().slice(0, 10) + "T00:00:00Z") + tz * 60000;
  // Only what is still AHEAD of the reader matters — a void that closed before
  // they opened the email is not a caution, it is history.
  const vocAhead = vocWindows
    .map((w) => ({ start: Date.parse(w.start), end: Date.parse(w.end) }))
    .filter((w) => w.end > now.getTime() && w.start < dayEndMs)
    .sort((a, b) => a.start - b.start);
  const { voc: vocNow } = voidOfCourse(jd);
  // "Begin nothing today" is only honest when the void actually owns the day.
  // Under four hours ahead of them, it is a spell to work around, not a verdict
  // on the day — and it must not take the subject line.
  const vocAheadMs = vocAhead.reduce((n, w) => n + (Math.min(w.end, dayEndMs) - Math.max(w.start, now.getTime())), 0);
  const vocDominatesDay = vocAheadMs >= 4 * 3600000;
  const voc = vocAhead.length > 0;
  const mercuryRx = getPlanetPositions(jd).some((p) => p.planet === "Mercury" && p.retrograde);
  const moonSign = elem.moonSign;
  const dayRuler = DAY_RULER[local.getUTCDay()];
  const phaseKey = phaseKeyOf(phaseName);
  const sky: DaySky = { moonSign, dayRuler, waxing: phaseKey === "new" || phaseKey === "waxing", phaseKey, voc, mercuryRx };
  const sg = SIGN_GUIDE[moonSign];
  const weekday = local.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

  const blocks: Block[] = [];

  // The woven reading (synthesis engine) — day scope, so the rotating hour
  // doesn't carry an all-day email. Natal fetched early for the asc-ruler.
  const natal = await natalFor(testerId);
  const ascRuler = natal?.timeKnown ? domicileLord(natal.computed.ascendant.longitude) : undefined;
  const reading = dayReading(now, lat, lon, { tzOffsetMin: tz, ascRuler, scope: "day", natal: natal ? {
    planets: natal.computed.planets.map((p) => ({ planet: p.planet, longitude: p.longitude })),
    asc: natal.timeKnown ? natal.computed.ascendant.longitude : undefined,
    mc: natal.timeKnown ? natal.computed.midheaven.longitude : undefined,
  } : undefined });

  // ── The reader's own day, fetched first because it now leads ──────────────
  const todayStr = local.toISOString().slice(0, 10);
  const tomorrowStr = localDate(tz, 1).toISOString().slice(0, 10);
  const yStr = localDate(tz, -1).toISOString().slice(0, 10);
  const owned = await ownedToday(testerId, todayStr, tomorrowStr);
  const dailies = await openDailies(testerId, todayStr);
  const fav = favoredActivities(sky, 3);

  const dayStart = new Date(todayStr + "T00:00:00Z");
  const wins = await db.select().from(planningWindows).where(and(
    eq(planningWindows.testerId, testerId),
    gte(planningWindows.startTime, new Date(dayStart.getTime() + tz * 60000)),
    lte(planningWindows.startTime, new Date(dayStart.getTime() + tz * 60000 + 86400000)),
  )).orderBy(planningWindows.startTime);

  // 1) HEADLINE — their obligation first, the day's shape second. For a
  // lock-screen reader this single line IS the email, so it must stand alone.
  const dueCount = owned.filter((o) => o.sort <= 1).length;
  // The shape phrase MUST come from the same place as the footer's sky line,
  // or a 50-word email contradicts itself: the woven flavour weights the day
  // ruler and Sun, so it printed "A fire day" directly above "A Gemini Moon"
  // on 21 of 30 days. The Moon's own element is what the reader is told.
  const shape = cap(`${sg?.element ?? elem.element} day`);
  const headline = dueCount > 0
    ? `${dueCount} thing${dueCount === 1 ? "" : "s"} of yours today. ${shape}.`
    : wins.length > 0
      ? `${wins.length} block${wins.length === 1 ? "" : "s"} on your calendar. ${shape}.`
      : `Nothing due today. ${shape}.`;
  blocks.push({ lines: [headline] });

  // 2) TODAY — the reader's actual rows. Capped at three: a list you can't
  // finish is a list you stop reading.
  const todayLines = [...owned.slice(0, 3).map((o) => o.text)];
  if (dailies.length) todayLines.push(`Dailies not yet logged: ${dailies.slice(0, 3).join(" · ")}`);
  for (const w of wins.slice(0, 2)) {
    const t = new Date(new Date(w.startTime).getTime() - tz * 60000);
    todayLines.push(`${t.toISOString().slice(11, 16)} — ${w.title} (on your calendar)`);
  }
  if (todayLines.length) blocks.push({ heading: "Yours today", lines: todayLines });

  // 3) THE ONE WINDOW — pointed at the reader's OWN first item, not at the
  // sky's favourite activity. Keying it to fav[0] made this block restate
  // "Lean into" line 1 in 30 of 30 emails, adding nothing.
  const target = owned[0] ?? null;
  const activityKey = target?.planet
    ? (fav.find((f) => f.key && String(f.key).toLowerCase().includes(String(target.planet).toLowerCase()))?.key ?? fav[0]?.key)
    : fav[0]?.key;
  if (activityKey) {
    const el = computeElections({ activityKey, span: "day", lat, lon, tzOffsetMin: tz, natal: natal?.computed ?? null, startAt: now });
    // Never offer a window that has already elapsed at send time (7 of 30
    // emails did — "the hard conversation, 7:09 AM" in a 7:00 AM email), and
    // keep it inside plausible waking hours.
    const nowClock = new Date(now.getTime() - tz * 60000).toISOString().slice(11, 16);
    const w = el?.windows?.find((x) => {
      if (x.allDay) return false;
      const start = x.startAt ? new Date(new Date(x.startAt).getTime() - tz * 60000).toISOString().slice(11, 16) : x.startClock;
      const hh = parseInt(String(start).slice(0, 2), 10);
      return start > nowClock && hh >= 6 && hh <= 22;
    });
    if (w) {
      const forWhat = target ? target.text.split(" · ")[0] : fav[0]?.label.toLowerCase();
      blocks.push({ heading: "Your window", lines: [
        detail === "minimal"
          ? `${w.startClock}–${w.endClock} — the best stretch today for ${forWhat}.`
          : `${w.startClock}–${w.endClock} for ${forWhat} — ${w.why.split(" · ")[0]}.`,
      ] });
    }
  }

  // 4) THE WARNING — conditional, and stated ONCE. The void used to be
  // repeated 4–6 times per void day ("begin nothing you want to last" printed
  // verbatim three times in a single email); rarity is what makes it read.
  const launching = wins.some((w) => /launch|publish|announce|sign|send/i.test(w.title))
    || owned.some((o) => /launch|publish|announce|sign|send/i.test(o.text));
  // Render on ANY void day: the subject line leads with "Begin nothing today"
  // when the Moon is void, so the body has to explain it or the email opens on
  // an unanswered promise.
  if (voc) {
    const w = vocAhead[0];
    const clock = (ms: number) => new Date(ms - tz * 60000).toISOString().slice(11, 16);
    const endsToday = w.end < dayEndMs;
    blocks.push({ heading: "One caution", lines: [
      vocNow && endsToday
        // The case that shipped wrong. Name the hour it lifts, and say what
        // the day becomes afterwards, so a 7 AM reader isn't handed a verdict
        // that expires before their first coffee.
        ? `The Moon is void until ${clock(w.end)} — finish and tidy, but begin nothing you want to last until then. After that the day is ordinary.`
        : vocNow
          ? "The Moon is void for the rest of today — finish and tidy freely, but begin nothing you want to last."
          : `The Moon goes void at ${clock(w.start)}${endsToday ? ` and lifts at ${clock(w.end)}` : " for the rest of the day"} — start what matters before then.`,
    ] });
  }

  // 5) YESTERDAY — one line, and the only part that proves the app is watching.
  const yLine = await yesterdayLine(testerId, yStr);
  if (yLine) blocks.push({ heading: "Yesterday", lines: [yLine] });

  // 6) TOWARD YOUR STARS — on a MATCH only. The old version fired every day
  // and, because one earth-tagged star meets four elements, spent 23 of 30
  // mornings telling the reader today was not for their only goal.
  const stars = await activeStars(testerId);
  const dayEl = sg?.element;
  const starMatch = stars.find((s) => s.element === dayEl);
  if (starMatch) {
    blocks.push({ heading: "Toward your stars", lines: [
      `${cap(String(dayEl))} day — the current suits “${starMatch.title}.” One step counts double.`,
    ] });
  }

  // 7) THE SKY, BRIEFLY — everything this email used to lead with, demoted to
  // a footer and gated by the register the subscriber actually chose.
  if (detail !== "minimal") {
    const skyLine = detail === "full"
      ? `${artcl(moonSign)} ${moonSign} Moon on ${weekday} — ${sg?.feel ?? `an ${elem.element} day`}. ${cap(dayRuler)}'s day: the hours favor ${DAY_RULER_GIFT[dayRuler]}. Moon ${phaseName.toLowerCase()}, ${Math.round(fraction * 100)}% lit.`
      : `${artcl(moonSign)} ${moonSign} Moon — ${sg?.feel ?? `an ${elem.element} day`}.`;
    blocks.push({ heading: "The sky, briefly", lines: [skyLine] });
  }

  // SUBJECT — their thing + a number or time, then a short reason. Must carry
  // a varying token: the old "[Sign] Moon — [activities]" formula repeated
  // verbatim on consecutive days (16 of 29 pairs), and Gmail threads identical
  // subjects, so day two could vanish into day one.
  // The subject must carry something that CHANGES, or consecutive days thread
  // together in Gmail and day two disappears into day one. An ageing item
  // supplies that naturally (and saying "4 days overdue" is more use than
  // "1 due today" repeated for a fortnight); otherwise the date does it.
  const dayNum = local.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const top = owned[0];
  const subject = top && top.overdueDays > 0
    ? `“${top.title.slice(0, 26)}” — ${top.overdueDays} day${top.overdueDays === 1 ? "" : "s"} on`
    : dueCount > 0
      ? `${dueCount} due ${dayNum}${top ? ` — ${top.title.slice(0, 24)}` : ""}`
      : vocDominatesDay
        ? `Begin nothing today — ${dayNum}`
        : starMatch
          ? `${cap(String(dayEl))} day for “${starMatch.title.slice(0, 22)}” — ${dayNum}`
          : wins.length > 0
            ? `${wins.length} block${wins.length === 1 ? "" : "s"} today — ${dayNum}`
            : `A quiet ${weekday} — ${dayNum}`;
  return { title: fmtDay(local), subject, blocks };
}

export async function composeWeek(testerId: string, tz: number, _lat: number, _lon: number) {
  const blocks: Block[] = [];
  const dname = (d: number) => fmtShort(localDate(tz, d)).replace(/,.*$/, "");

  // Fetched HERE rather than three blocks down, because the day-by-day reading
  // needs it. Without it `dayReading` falls back to a chart-less synthesis and
  // printed "A fire day — courage and initiative to spend" for 6 of the 7 day
  // lines: a week-ahead email in which every day was the same day.
  const natal = await natalFor(testerId);
  const ascRuler = natal?.timeKnown ? domicileLord(natal.computed.ascendant.longitude) : undefined;
  const natalArg = natal ? {
    planets: natal.computed.planets.map((p) => ({ planet: p.planet, longitude: p.longitude })),
    asc: natal.timeKnown ? natal.computed.ascendant.longitude : undefined,
    mc: natal.timeKnown ? natal.computed.midheaven.longitude : undefined,
  } : undefined;

  // ── The reader's own week, first — the same correction the daily got ─────
  // The weekly opened on the sky and never mentioned the reader's work at all.
  // A week-ahead email whose first line is about the Moon is a horoscope; one
  // that opens with what's actually due is a week ahead.
  const todayStr = localDate(tz).toISOString().slice(0, 10);
  const weekEndStr = localDate(tz, 7).toISOString().slice(0, 10);
  const dueThisWeek = await db.select().from(tasks).where(and(
    eq(tasks.testerId, testerId), eq(tasks.done, "false"),
  ));
  const upcoming = dueThisWeek
    .filter((t) => t.dueDate && t.dueDate >= todayStr && t.dueDate < weekEndStr)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const overdue = dueThisWeek.filter((t) => t.dueDate && t.dueDate < todayStr);

  // Per-day: concrete guidance from the sign, not just element/quality.
  const perDay: { d: number; voc: boolean; sky: DaySky }[] = [];
  const dayLines: string[] = [];
  for (let d = 0; d < 7; d++) {
    const jd = localNoonJd(tz, d);
    const local = localDate(tz, d);
    const moonSign = getDailyElementEmphasis(jd).moonSign;
    const phaseKey = phaseKeyOf(moonPhase(jd).name);
    const dayRuler = DAY_RULER[local.getUTCDay()];
    const vocDay = voidOfCourse(jd).voc;
    const rxDay = getPlanetPositions(jd).some((p) => p.planet === "Mercury" && p.retrograde);
    const sky: DaySky = { moonSign, dayRuler, waxing: phaseKey === "new" || phaseKey === "waxing", phaseKey, voc: vocDay, mercuryRx: rxDay };
    const sg = SIGN_GUIDE[moonSign];
    // Day-specific, not just the (multi-day) Moon sign: the planetary day and
    // per-day activity fit differ even when the Moon holds the same sign.
    const fav = favoredActivities(sky, 2);
    const favText = fav.length ? fav.map((f) => f.label.toLowerCase()).join(", ") : (sg?.favors ?? []).slice(0, 2).join(", ");
    // The woven flavour's keynote (before "carried by") leads each day line —
    // the same synthesis the daily card runs, at local noon, day scope.
    const noonDate = new Date((localNoonJd(tz, d) - 2440587.5) * 86400000);
    const keynote = dayReading(noonDate, _lat, _lon, {
      tzOffsetMin: tz, ascRuler, scope: "day", natal: natalArg,
    }).flavour.split(", carried by")[0];
    // The shape word comes from the MOON's element, exactly as the daily's
    // headline does. The woven flavour weights the day ruler and Sun, so
    // deriving it here instead printed "A fire day" above "Pisces Moon" — the
    // weekly and the daily describing the same date differently, which is the
    // single fastest way to make a reader stop trusting both.
    const shape = sg?.element ? `${cap(sg.element)} day` : cap(keynote);
    dayLines.push(`${fmtShort(local)} — ${shape}. ${moonSign} Moon, ${dayRuler} day: ${favText}.${vocDay ? " Void spell — keep it light." : ""}`);
    perDay.push({ d, voc: vocDay, sky });
  }
  // 1) HEADLINE — the reader's week, not the sky's. Stands alone on a lock
  // screen, which is where most of these are actually read.
  const weekHeadline = upcoming.length > 0
    ? `${upcoming.length} thing${upcoming.length === 1 ? "" : "s"} due this week${overdue.length ? `, ${overdue.length} still open from before` : ""}.`
    : overdue.length > 0
      ? `Nothing new due this week — ${overdue.length} still open from before.`
      : "Nothing due this week. A clear run.";
  blocks.push({ lines: [weekHeadline] });

  // 2) WHAT'S DUE, WHEN — their rows against the days, capped at five. The
  // point of a week-ahead is matching the work to the days, and it cannot do
  // that without naming the work.
  if (upcoming.length) {
    blocks.push({
      heading: "Due this week",
      lines: upcoming.slice(0, 5).map((t) => {
        const off = Math.round(
          (Date.parse(String(t.dueDate) + "T12:00:00Z") - Date.parse(todayStr + "T12:00:00Z")) / 86400000);
        const when = off === 0 ? "today" : off === 1 ? "tomorrow" : dname(off);
        return `${when} — ${t.title}`;
      }),
    });
  }

  blocks.push({ heading: "Day by day", lines: dayLines });

  // Standout days — best for focus / people / rest, by concrete activity fit.
  //
  // AHEAD only. These searched from d=0, so the week's headline recommendation
  // was routinely the day you were reading it on ("Deep focus — Thu" in an
  // email sent Thu morning), and `restDay` fell back to perDay[0] — today —
  // whenever no void fell in the week. A week-ahead email that nominates today
  // has no forward function at all; that is what the daily is for.
  const ahead = perDay.filter((p) => p.d >= 1);
  const pick = (cats: string[]) => {
    let best: { d: number; label: string; score: number } | null = null;
    for (const p of ahead) { const b = bestFor(p.sky, cats); if (b && (!best || b.score > best.score)) best = { d: p.d, label: b.label, score: b.score }; }
    return best;
  };
  const focus = pick(["craft", "mind"]);
  const people = pick(["love", "social"]);
  // A void day if there is one ahead; otherwise the quietest day ahead, never
  // today, and never silently the first row of the array.
  const restDay = ahead.find((p) => p.voc)
    ?? [...ahead].sort((a, b) => (bestFor(a.sky, ["craft", "mind"])?.score ?? 0) - (bestFor(b.sky, ["craft", "mind"])?.score ?? 0))[0]
    ?? null;
  const stand: string[] = [];
  if (focus) stand.push(`Deep focus — ${dname(focus.d)}: best for ${focus.label.toLowerCase()}.`);
  if (people) stand.push(`People & connection — ${dname(people.d)}: best for ${people.label.toLowerCase()}.`);
  if (restDay) stand.push(`Keep light / rest — ${dname(restDay.d)}${restDay.voc ? " (Moon void)" : ""}.`);
  if (stand.length) blocks.push({ heading: "The standout days", lines: stand });

  // Scheduled windows this week
  const wins = await db.select().from(planningWindows).where(and(
    eq(planningWindows.testerId, testerId),
    gte(planningWindows.startTime, new Date()),
    lte(planningWindows.startTime, new Date(Date.now() + 7 * 86400000)),
  )).orderBy(planningWindows.startTime);
  if (wins.length) {
    blocks.push({
      heading: "Already on your calendar",
      lines: wins.slice(0, 8).map((w) => {
        const t = new Date(new Date(w.startTime).getTime() - tz * 60000);
        return `${fmtShort(t)} ${t.toISOString().slice(11, 16)} — ${w.title}`;
      }),
    });
  }

  // The long weather this week — footnote: top 2 transits, dated + interpreted.
  // (natal is fetched at the top now; the day-by-day reading needs it.)
  if (natal) {
    let fc = computeTransitForecast(natal.computed, 7);
    if (!natal.timeKnown) fc = fc.filter((t) => t.natalPlanet !== "Ascendant");
    const lines = rankTransits(fc).slice(0, 2).map((t) => {
      const when = t.dayOffset === 0 ? "now" : dname(t.dayOffset);
      return `${when} — ${transitMeaning(t.transitPlanet, t.aspect, t.natalPlanet)}`;
    });
    if (lines.length) blocks.push({ heading: "The long weather this week", lines });
  }

  blocks.push({ lines: ["Plan the deep work into the strong days; keep the void spells light."] });
  // Subject leads with the reader's load when there is one. "Your week ahead —
  // the shape of the next seven days" is a subject about us; "4 due this week"
  // is a subject about them, and it is the one that survives a lock screen.
  const subject = upcoming.length > 0
    ? `${upcoming.length} due this week${focus ? ` — deep work ${dname(focus.d)}` : ""}`
    : focus && people
      ? `Your week — focus ${dname(focus.d)}, people ${dname(people.d)}`
      : "Your week ahead — the shape of the next seven days";
  return { title: `Week of ${fmtDay(localDate(tz))}`, subject, blocks };
}

async function composeMonth(testerId: string, tz: number, _lat: number, _lon: number) {
  const blocks: Block[] = [];

  // Lunation anchors — named by sign, with what the cycle turn is for.
  const lunations: string[] = [];
  let lastName = moonPhase(julianDay(new Date())).name;
  for (let d = 1; d <= 30; d++) {
    const jd = localNoonJd(tz, d);
    const { name } = moonPhase(jd);
    if (name !== lastName && (name === "New Moon" || name === "Full Moon")) {
      const sign = getDailyElementEmphasis(jd).moonSign;
      const sg = SIGN_GUIDE[sign];
      lunations.push(name === "New Moon"
        ? `${fmtShort(localDate(tz, d))} — New Moon in ${sign}: begin quietly. A cycle for ${sg?.favors[0] ?? "planting"}.`
        : `${fmtShort(localDate(tz, d))} — Full Moon in ${sign}: culminate and release what's ripe.`);
    }
    lastName = name;
  }
  if (lunations.length) blocks.push({ heading: "The month's anchor points", lines: lunations });

  // Transits, week by week — the top 1–2 that matter, interpreted (not listed).
  const natal = await natalFor(testerId);
  if (natal) {
    let fc = computeTransitForecast(natal.computed, 30);
    if (!natal.timeKnown) fc = fc.filter((t) => t.natalPlanet !== "Ascendant");
    const weeks: typeof fc[] = [[], [], [], []];
    for (const t of fc) weeks[Math.min(3, Math.floor(t.dayOffset / 7))].push(t);
    weeks.forEach((w, i) => {
      const top = rankTransits(w).slice(0, 2).map((t) =>
        `${fmtShort(new Date(Date.parse(t.peakDate) - tz * 60000)).replace(/,.*$/, "")} — ${transitMeaning(t.transitPlanet, t.aspect, t.natalPlanet)}`);
      if (top.length) blocks.push({ heading: i === 0 ? "This week" : `Week of ${fmtShort(localDate(tz, i * 7)).replace(/,.*$/, "")}`, lines: top });
    });
  } else {
    blocks.push({ lines: ["Add your birth chart in Settings and this report gains the personal layer — the transits landing on your chart, dated and read."] });
  }

  blocks.push({ lines: ["A month is a tide too — the lunations are its high and low water. Aim the big beginnings just after the New Moon."] });
  const subject = "Your month ahead — the lunations and what lands on your chart";
  return { title: `The month from ${fmtDay(localDate(tz))}`, subject, blocks };
}

export async function composeNewMoon(testerId: string, tz: number, _lat: number, _lon: number) {
  const blocks: Block[] = [];

  // The next New Moon (or today's, if we're on it). Scan by phase name.
  let nmDay = 0;
  for (let d = 0; d <= 32; d++) {
    if (moonPhase(localNoonJd(tz, d)).name === "New Moon") { nmDay = d; break; }
  }
  const nmDate = localDate(tz, nmDay);
  const sign = getDailyElementEmphasis(localNoonJd(tz, nmDay)).moonSign;
  const sg = SIGN_GUIDE[sign];

  // 1) The reset — plain, grounded, not a wall of questions.
  blocks.push({ lines: [
    `The Moon goes new in ${sign} ${nmDay === 0 ? "today" : `on ${fmtDay(nmDate)}`} — the start of a fresh ~29-day cycle.`,
    `New Moons are for planting, not harvesting. ${sg ? `${cap(sg.feel)}.` : ""} Name one intention and begin it small.`,
  ] });

  // 2) What this cycle is genuinely for — concrete, from the sign.
  if (sg) blocks.push({ heading: `A ${sign} cycle favors`, lines: sg.favors.slice(0, 4).map((f) => cap(f)) });

  // 3) The cycle's shape — the dates that mark its arc.
  const shape: string[] = [`${fmtShort(localDate(tz, nmDay + 7))} — First Quarter: act through the first resistance.`];
  for (let d = nmDay + 11; d <= nmDay + 18; d++) {
    if (moonPhase(localNoonJd(tz, d)).name === "Full Moon") {
      const fSign = getDailyElementEmphasis(localNoonJd(tz, d)).moonSign;
      shape.push(`${fmtShort(localDate(tz, d))} — Full Moon in ${fSign}: what you planted comes to light.`);
      break;
    }
  }
  shape.push(`${fmtShort(localDate(tz, nmDay + 22))} — Last Quarter: let go of what didn't take.`);
  blocks.push({ heading: "The cycle's shape", lines: shape });

  // 4) Toward your stars — seed one now; it rides the whole cycle.
  const stars = await activeStars(testerId);
  if (stars.length) {
    // Only claim a fit when there IS one. The old line fell back to stars[0]
    // and then asserted the cycle "favors" it regardless — producing
    // "seed an intention toward 'aligned spine' — a Leo cycle favors perform,
    // present, publish", which is a non-sequitur the reader can see through.
    // With one star and four elements, ~75% of cycles hit that fallback.
    const matched = stars.find((s) => s.element === sg?.element) ?? null;
    const star = matched ?? stars[0];
    blocks.push({ heading: "Toward your stars", lines: [matched
      ? `Seed an intention toward “${star.title}” now — a ${sign} cycle ${sg ? `favors ${sg.favors[0]}` : "suits it"}, and what you set at the dark Moon rides the whole month's tide.`
      // No elemental match: say so plainly and offer the cycle for what it is,
      // rather than pretending the sky is pointing at their aim.
      : `This is not ${artcl(star.element ?? "matching").toLowerCase()} ${star.element ?? "matching"} cycle — “${star.title}” isn't what this month is built for. Use it for ${sg ? sg.favors[0] : "what the sign favours"} instead, and let the star keep its own pace.`,
    ] });
  }

  // 5) Landing on your chart — a single transit near the cycle's start.
  const natal = await natalFor(testerId);
  if (natal) {
    const ts = rankTransits(
      computeTransitForecast(natal.computed, Math.max(1, nmDay + 4))
        .filter((t) => Math.abs(t.dayOffset - nmDay) <= 3 && (natal.timeKnown || t.natalPlanet !== "Ascendant"))
    );
    if (ts[0]) blocks.push({ heading: "As the cycle opens", lines: [
      `${transitMeaning(ts[0].transitPlanet, ts[0].aspect, ts[0].natalPlanet)} Begin with that in mind.`,
    ] });
  }

  blocks.push({ lines: ["→ Set your intention in Compass — it will carry it to the Full Moon and check in."] });
  const subject = `New Moon in ${sign} — a fresh cycle begins`;
  return { title: `New Moon · ${fmtDay(nmDate)}`, subject, blocks };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

export function renderHtml(title: string, subject: string, blocks: Block[], track?: { testerId: string; span: string; base?: string }): string {
  const base = (track?.base ?? process.env["PUBLIC_BASE_URL"] ?? "https://compass.day").replace(/\/$/, "");
  const blockHtml = blocks.map((b) => `
    ${b.heading ? `<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a89a88;margin:22px 0 8px;">${b.heading}</div>` : `<div style="height:14px"></div>`}
    ${b.lines.map((l) => `<div style="font-size:14px;line-height:1.7;color:#2b2820;margin-bottom:4px;">${l}</div>`).join("")}
  `).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#efe9dc;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:Georgia,'Times New Roman',serif;">
    <div style="background:#f7f2e6;border:1px solid #ddd2ba;border-radius:14px;padding:26px 28px;">
      <div style="font-size:20px;color:#1b1a17;letter-spacing:0.3px;margin-bottom:2px;">Compass</div>
      <div style="font-size:12px;color:#8a8278;margin-bottom:18px;">${title}</div>
      <div style="font-size:16px;color:#1b1a17;font-style:italic;border-left:3px solid #c8b06a;padding-left:12px;margin-bottom:6px;">${subject.replace(/^[^—]*— /, "")}</div>
      ${blockHtml}
      <div style="border-top:1px solid #e3d9c2;margin-top:24px;padding-top:12px;font-size:11px;color:#a89a88;line-height:1.6;">
        Conditions, not fate — the sky describes the weather; you steer.<br/>
        ${track
          ? `<a href="${base}/api/reports/c?t=${encodeURIComponent(track.testerId)}&s=${encodeURIComponent(track.span)}&to=${encodeURIComponent(base + "/")}" style="color:#8a7a58;">Open today in Compass</a>
             · <a href="${base}/api/reports/c?t=${encodeURIComponent(track.testerId)}&s=${encodeURIComponent(track.span)}&to=${encodeURIComponent(base + "/?settings=email")}" style="color:#a89a88;">fewer emails</a>`
          : "Open Compass · adjust what lands in this report in Settings."}
      </div>
    </div>
  </div>
  ${track ? `<img src="${base}/api/reports/o.gif?t=${encodeURIComponent(track.testerId)}&s=${encodeURIComponent(track.span)}" width="1" height="1" alt="" style="display:block;border:0;"/>` : ""}
  </body></html>`;
}

function renderText(title: string, blocks: Block[]): string {
  return [`COMPASS — ${title}`, "", ...blocks.flatMap((b) => [
    ...(b.heading ? [b.heading.toUpperCase()] : [""]),
    ...b.lines.map((l) => `  ${l.replace(/<[^>]+>/g, "")}`),
  ])].join("\n");
}

router.get("/reports/preview", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const span = ["day", "week", "month", "newmoon"].includes(String(req.query.span)) ? String(req.query.span) : "day";
  const tz = Number.isFinite(parseInt(String(req.query.tz), 10)) ? parseInt(String(req.query.tz), 10) : 0;
  const lat = parseFloat(String(req.query.lat ?? "40.7"));
  const lon = parseFloat(String(req.query.lon ?? "-74.0"));

  const detail = (DETAILS as readonly string[]).includes(String(req.query.detail))
    ? (String(req.query.detail) as Detail) : "medium";
  const composed = span === "week" ? await composeWeek(testerId, tz, lat, lon)
    : span === "month" ? await composeMonth(testerId, tz, lat, lon)
    : span === "newmoon" ? await composeNewMoon(testerId, tz, lat, lon)
    : await composeDay(testerId, tz, lat, lon, detail);

  if (req.query.format === "json") {
    res.json({ span, subject: composed.subject, title: composed.title, blocks: composed.blocks, text: renderText(composed.title, composed.blocks) });
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderHtml(composed.title, composed.subject, composed.blocks));
});

// ── Email subscription (the Settings opt-in) ─────────────────────────────────

router.get("/reports/email-subscription", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const row = (await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.testerId, testerId)).limit(1))[0] ?? null;
  res.json({ subscription: row, senderConfigured: emailConfigured() });
});

router.post("/reports/email-subscription", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { email, spans, sendHour, enabled, lat, lon, detail, timeZone } = req.body ?? {};
  if (!email || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: "a valid email is required" });
    return;
  }
  const clean = {
    email: email.trim(),
    spans: Array.isArray(spans) && spans.length ? spans.filter((s: string) => ["day", "week", "newmoon"].includes(s)) : ["day"],
    sendHour: Number.isInteger(sendHour) && sendHour >= 4 && sendHour <= 12 ? sendHour : 7,
    enabled: enabled === false ? "false" : "true",
    // Mirror the client's astroDetail so the composer can speak the register
    // the reader actually chose (it previously had no way to know).
    detail: (DETAILS as readonly string[]).includes(String(detail)) ? String(detail) : "medium",
    timeZone: (() => {
      if (typeof timeZone !== "string" || !timeZone) return null;
      try { new Intl.DateTimeFormat("en-US", { timeZone }); return timeZone; } catch { return null; }
    })(),
    lat: lat != null ? String(lat) : null,
    lon: lon != null ? String(lon) : null,
    updatedAt: new Date(),
  };
  const existing = (await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.testerId, testerId)).limit(1))[0];
  if (existing) await db.update(emailSubscriptions).set(clean).where(eq(emailSubscriptions.testerId, testerId));
  else await db.insert(emailSubscriptions).values({ testerId, ...clean });
  bustEmailSubscriptionCache(); // the notifier's hourly cache shouldn't delay a new opt-in
  res.json({ ok: true });
});

// Send the day report NOW to the stored address — the "send me a test" button.
router.post("/reports/email-test", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const sub = (await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.testerId, testerId)).limit(1))[0];
  if (!sub) { res.status(404).json({ error: "no subscription saved yet" }); return; }
  const tz = Number.isFinite(parseInt(String(req.query.tz), 10)) ? parseInt(String(req.query.tz), 10) : 0;
  const lat = parseFloat(sub.lat ?? "40.7"), lon = parseFloat(sub.lon ?? "-74.0");
  const d = await composeDay(testerId, tz, lat, lon, ((sub as any).detail as Detail) ?? "medium");
  const sent = await sendEmail(sub.email, d.subject, renderHtml(d.title, d.subject, d.blocks));
  res.json({ sent, senderConfigured: emailConfigured() });
});

// ── Open + click endpoints ───────────────────────────────────────────────────
// Deliberately unauthenticated: they're hit by a mail client, which cannot
// send headers. They accept a tester id and record an event — nothing is read
// back and nothing is returned, so this grants no access to anything. (Note
// the contrast with the withdrawn calendar feed, where the same id in a URL
// was a *credential*; here it is only a label on a metric.)
router.get("/reports/o.gif", async (req, res) => {
  const t = String(req.query.t ?? ""); const span = String(req.query.s ?? "day");
  if (t) void logEmailEvent(t, "email_open", { span });
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.send(PIXEL);
});

router.get("/reports/c", async (req, res) => {
  const t = String(req.query.t ?? ""); const span = String(req.query.s ?? "day");
  const to = String(req.query.to ?? "/");
  if (t) void logEmailEvent(t, "email_click", { span, to });
  // Only ever bounce to our own origin — an open redirector is a phishing gift.
  const base = (process.env["PUBLIC_BASE_URL"] ?? "https://compass.day").replace(/\/$/, "");
  const safe = to.startsWith(base) ? to : base + "/";
  res.redirect(302, safe);
});

export default router;
