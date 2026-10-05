/**
 * THE ELECTION REPORT (plan Part A, Phase 2; owner 2026-10-04: "a thorough
 * breakdown of different times/options, with my chart and my calendar").
 *
 * Find a time answers "when, this week" with a list. An election over a
 * fortnight or a month needs the other things a person weighs: what the
 * governing planet is doing across the whole span, which days to leave alone
 * and why, which good times your own calendar has already taken, and whether
 * waiting would be better. This composes those from the SAME engine calls Find
 * a time makes (`searchTiming`), in chunks of seven civil days, so no time in
 * the report exists that the engine did not produce. Nothing here ranks by
 * judgment of its own beyond a stated ordering, and no prose is generated.
 *
 * Gaps are output, with reasons (CLAUDE.md): a chunk that failed, the windows
 * withheld, a calendar that could not be read, and a chart that was absent all
 * appear in `coverage` rather than being dropped.
 */
import { searchTiming, type TimingSearchRequest } from "./timingSearch.js";
import { presentTiming, type TimingCandidate } from "./timingPresentation.js";
import { activityByKey, modeOf, primarySignificatorsOf, type ActivityCorrespondence } from "./activityCorrespondences.js";
import { isRetrograde, julianDay } from "./astro.js";
import { computeDayArc } from "./dayarc.js";
import { civilDayOffsetIn, dayBoundsInZone, dayKeyInZone, offsetMinutesFor } from "./localClock.js";
import { readCalendar } from "./calendarCommitments.js";
import type { SuitabilityReason } from "./electionEngine.js";

const WAKE_START = 7;
const WAKE_END = 23;
const MAX_DAYS = 30;
const CHUNK_DAYS = 7;
const MAX_PICKS = 5;
const MAX_BUSY_STRONG = 3;
/** A day this much void (of the waking hours) is left alone. */
const VOID_DAY_SHARE = 0.6;
/** A day with less open calendar than this has no room for the thing. */
const MIN_FREE_MINUTES = 90;
const MOTION_SCAN_DAYS = 200;
/** Eight hours or more is "the day", not a chosen time. */
const BROAD_MS = 8 * 3600000;
/** How far past a station to look when asking whether waiting would help. */
const AFTER_CLEARS_DAYS = 14;

export interface ReportInput {
  activity: string;
  /** First instant of the horizon; the report runs `days` civil days from its day. */
  start: Date;
  days: number;
  timeZone: string;
  location: { lat: number; lon: number };
  natal?: TimingSearchRequest["natal"];
  calendar?: TimingSearchRequest["calendar"];
  extraActivities?: ActivityCorrespondence[];
}

export interface ReportPick {
  id: string;
  date: string;
  start: string;
  end: string;
  /** "7:00 AM" and "11:00 PM" in the request's zone. */
  startClock: string;
  endClock: string;
  /** A day-long window, which says less than an hour-sized one. */
  broad: boolean;
  tier: "good" | "great";
  suitability: "clear" | "qualified" | "defer";
  /** The engine's evidence, the fact first, as it already writes it. */
  evidence: string[];
  /** What counts against this window: the same facts, named plainly. */
  objections: string[];
  /** This window carries testimony from the person's chart. */
  personal: boolean;
  /** The engine's own score for the window: the last tiebreak, never shown as a number. */
  score: number;
  availability: "clear" | "conflict" | "unchecked" | "unavailable";
  /** Other windows the engine gave the same day, best first. */
  alsoThatDay: { start: string; end: string; startClock: string; endClock: string; tier: "good" | "great" }[];
}

export interface AvoidDay {
  date: string;
  reasons: string[];
}

export interface Motion {
  planet: string;
  retrograde: boolean;
  /** The civil day the current motion began, when it began within the scan. */
  since: string | null;
  /** The civil day it next changes, when that is within the scan. */
  until: string | null;
  /** One literal sentence, or null when the planet is direct throughout. */
  sentence: string | null;
}

export interface ElectionReport {
  status: "complete" | "partial" | "error" | "unsupported";
  activity: { key: string; label: string } | null;
  horizon: { start: string; end: string; days: number; timeZone: string };
  /** What the governing planets are doing across the span. */
  motion: Motion[];
  /** Slow contacts between the sky and the person's chart that hold through
   *  the span ("Saturn squares your natal Ascendant…"), said once. */
  standing: string[];
  /** Best first: open calendar, then tier, then specificity. One per day. */
  picks: ReportPick[];
  /** Strong windows the calendar has already taken. */
  busyButStrong: ReportPick[];
  avoid: AvoidDay[];
  /**
   * When a governing planet is retrograde through the whole span and the
   * activity is a beginning, the two weeks after it turns direct, searched
   * the same way. An empty `picks` is an answer: the engine found nothing then. The honest answer to "can it wait?". Calendar not checked.
   */
  afterClears: { from: string; planet: string; searchedDays: number; picks: ReportPick[] } | null;
  coverage: {
    scannedDays: number;
    failedChunks: number;
    chart: "applied" | "absent" | "birth-time-unknown";
    /** "not-connected": no Google Calendar is linked; "unavailable": it is, but could not be read. */
    calendar: "checked" | "unchecked" | "not-connected" | "unavailable";
    /** Windows computed and deliberately not listed, by reason. */
    withheld: { hourOnly: number; voidMoon: number };
  };
}

const clockIn = (d: Date | number | string, tz: string) =>
  new Date(d).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });

const REASON_TEXT = (r: SuitabilityReason): string =>
  r.kind === "primary-significator-retrograde" ? `${r.planet} is retrograde`
    : r.kind === "primary-significator-stationing-retrograde" ? `${r.planet} is stationing retrograde`
    : r.kind === "primary-significator-stationing-direct" ? `${r.planet} is stationing direct`
    : r.kind === "significator-station" ? `${r.planet} is stationing`
    : r.kind === "natal-objection" ? `${r.text.charAt(0).toUpperCase()}${r.text.slice(1)}`
    : `${r.planet} is retrograde`;

const dayLabel = (key: string, tz: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

/**
 * Daily scan for when a planet's motion began and next changes, then an hourly
 * bisection inside the flipping day so the date named is the station's own
 * civil day, not the first noon sample after it.
 */
function motionOf(planet: string, from: Date, tz: string): Motion {
  const rx = (ms: number) => isRetrograde(planet, julianDay(new Date(ms)));
  const dayMs = 86400000;
  const at = (d: number) => +from + d * dayMs;
  const now = rx(at(0));
  const stationDay = (lo: number, hi: number): string => {
    // lo and hi differ in motion; find the first hour where it changed.
    let a = lo;
    for (let h = 1; h <= 24; h++) { if (rx(lo + (h * dayMs) / 24) !== rx(lo)) { a = lo + (h * dayMs) / 24; break; } a = hi; }
    return dayKeyInZone(new Date(a), tz);
  };
  let since: string | null = null;
  let until: string | null = null;
  for (let d = 1; d <= MOTION_SCAN_DAYS; d++) if (rx(at(d)) !== now) { until = stationDay(at(d - 1), at(d)); break; }
  if (now) for (let d = -1; d >= -MOTION_SCAN_DAYS; d--) if (!rx(at(d))) { since = stationDay(at(d), at(d + 1)); break; }
  const sentence = now
    ? `${planet} is retrograde${since ? ` from ${dayLabel(since, tz)}` : ""}${until ? ` until ${dayLabel(until, tz)}` : ""}.`
    : until ? `${planet} turns retrograde on ${dayLabel(until, tz)}.` : null;
  return { planet, retrograde: now, since, until, sentence };
}

const AVAIL_ORDER = { clear: 0, unchecked: 1, unavailable: 2, conflict: 3 } as const;
const SUIT_ORDER = { clear: 0, qualified: 1, defer: 2 } as const;

function toPick(c: TimingCandidate & { id: string }, tz: string): ReportPick | null {
  if (c.kind !== "ordinary") return null;
  const w = c.evidence;
  return {
    id: c.id, date: dayKeyInZone(new Date(c.start), tz), start: c.start, end: c.end,
    startClock: clockIn(c.start, tz), endClock: clockIn(c.end, tz),
    // A window the void clipped to most of the day is still a day, not a time.
    broad: c.broad || Date.parse(c.end) - Date.parse(c.start) >= BROAD_MS, tier: w.tier, suitability: c.suitability,
    evidence: (w.evidence ?? []).map((e: { text: string }) => e.text),
    objections: c.reasons.map(REASON_TEXT),
    personal: w.personal, score: w.score, availability: c.availability.status, alsoThatDay: [],
  };
}

const rankKey = (p: ReportPick) => [AVAIL_ORDER[p.availability], p.tier === "great" ? 0 : 1, p.broad ? 1 : 0, SUIT_ORDER[p.suitability], -p.score];
function byRank(a: ReportPick, b: ReportPick): number {
  const ka = rankKey(a), kb = rankKey(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return a.start.localeCompare(b.start);
}

/** One best pick per civil day, the rest folded into it. */
function onePerDay(picks: ReportPick[]): ReportPick[] {
  const byDay = new Map<string, ReportPick[]>();
  for (const p of picks) byDay.set(p.date, [...(byDay.get(p.date) ?? []), p]);
  return [...byDay.values()].map((day) => {
    const sorted = [...day].sort(byRank);
    const [best, ...rest] = sorted;
    return { ...best, alsoThatDay: rest.slice(0, 2).map((r) => ({ start: r.start, end: r.end, startClock: r.startClock, endClock: r.endClock, tier: r.tier })) };
  });
}

interface Chunked {
  picks: ReportPick[];
  scanned: number;
  failed: number;
  withheld: { hourOnly: number; voidMoon: number };
  dayHasWindow: Set<string>;
  standing: Set<string>;
}

function scan(input: ReportInput, start: Date, days: number, calendar: ReportInput["calendar"]): Chunked {
  const tz = input.timeZone;
  const out: Chunked = { picks: [], scanned: 0, failed: 0, withheld: { hourOnly: 0, voidMoon: 0 }, dayHasWindow: new Set(), standing: new Set() };
  const day0 = dayBoundsInZone(start, tz)[0];
  for (let i = 0; i < days; i += CHUNK_DAYS) {
    const n = Math.min(CHUNK_DAYS, days - i);
    const cs = i === 0 ? start : dayBoundsInZone(civilDayOffsetIn(day0, i, tz), tz)[0];
    const ce = dayBoundsInZone(civilDayOffsetIn(day0, i + n, tz), tz)[0];
    const result = searchTiming({
      activity: input.activity, start: cs.toISOString(), end: ce.toISOString(), timeZone: tz,
      location: input.location, natal: input.natal, calendar, extraActivities: input.extraActivities,
    });
    const presented = presentTiming(result);
    if (!("days" in result)) { out.failed += n; continue; }
    out.failed += result.coverage.failed.length;
    out.scanned += result.coverage.scanned.length;
    for (const d of result.days) if (d.kind === "ordinary") {
      out.withheld.hourOnly += d.result.withheld.hourOnly;
      out.withheld.voidMoon += d.result.withheld.voidMoon ?? 0;
      for (const c of d.result.cautions) if (c.endsWith("holds through this stretch.")) out.standing.add(c);
    }
    for (const c of presented.candidates) {
      const p = toPick(c, tz);
      if (p) { out.picks.push(p); out.dayHasWindow.add(p.date); }
    }
  }
  return out;
}

export function buildElectionReport(input: ReportInput): ElectionReport {
  const tz = input.timeZone;
  const act = activityByKey(input.activity) ?? input.extraActivities?.find((a) => a.key === input.activity);
  const days = Math.max(1, Math.min(MAX_DAYS, Math.floor(input.days)));
  const dayStart = dayBoundsInZone(input.start, tz)[0];
  const horizonEnd = dayBoundsInZone(civilDayOffsetIn(dayStart, days, tz), tz)[0];
  const horizon = { start: input.start.toISOString(), end: horizonEnd.toISOString(), days, timeZone: tz };
  const empty = (status: ElectionReport["status"]): ElectionReport => ({
    status, activity: act ? { key: act.key, label: act.label } : null, horizon, motion: [], standing: [], picks: [], busyButStrong: [], avoid: [], afterClears: null,
    coverage: { scannedDays: 0, failedChunks: 0, chart: "absent", calendar: "unchecked", withheld: { hourOnly: 0, voidMoon: 0 } },
  });
  if (!act) return empty("unsupported");

  // What the governing planets are doing. The Sun and Moon are not retrograde.
  const governing = primarySignificatorsOf(act.key, act.planets).filter((p) => p !== "Sun" && p !== "Moon");
  const motion = governing.map((p) => motionOf(p, input.start, tz)).filter((m) => m.sentence);

  const main = scan(input, input.start, days, input.calendar);
  const cal = input.calendar ? readCalendar(input.calendar.result) : null;
  const all = main.picks;
  // A calendar that could not be read is not a conflict: those times are
  // listed, ranked below confirmed-open ones, and `coverage.calendar` says why.
  const open = all.filter((p) => p.availability !== "conflict");
  const taken = all.filter((p) => p.availability === "conflict");
  const picks = onePerDay(open).sort(byRank).slice(0, MAX_PICKS);
  const busyButStrong = onePerDay(taken).filter((p) => p.tier === "great").sort(byRank).slice(0, MAX_BUSY_STRONG);

  // Days to leave alone, each with the one fact that says why.
  const avoid: AvoidDay[] = [];
  const freeMinutes = (from: number, to: number): number | null => {
    if (!cal?.consulted) return null;
    const spans = cal.commitments.map((c) => [Math.max(+c.startAt, from), Math.min(+c.endAt, to)] as [number, number]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
    let busy = 0, cursor = from;
    for (const [a, b] of spans) { const s = Math.max(a, cursor); if (b > s) busy += b - s; cursor = Math.max(cursor, b); }
    return Math.round((to - from - busy) / 60000);
  };
  for (let i = 0; i < days; i++) {
    const noon = new Date(+dayBoundsInZone(civilDayOffsetIn(dayStart, i, tz), tz)[0] + 12 * 3600000);
    const date = dayKeyInZone(noon, tz);
    if (+noon + 12 * 3600000 <= +input.start) continue; // already past
    const reasons: string[] = [];
    const arc: any = computeDayArc(noon, input.location.lat, input.location.lon, offsetMinutesFor(noon, tz), tz);
    const base = dayBoundsInZone(noon, tz)[0];
    const from = +base + WAKE_START * 3600000, to = +base + WAKE_END * 3600000;
    let voidMs = 0;
    const clipped: [number, number][] = [];
    for (const v of arc.vocWindows ?? []) {
      const a = Math.max(Date.parse(v.start), from), b = Math.min(Date.parse(v.end), to);
      if (b > a) { voidMs += b - a; clipped.push([a, b]); }
    }
    if (voidMs / (to - from) >= VOID_DAY_SHARE) {
      const vs = Math.min(...clipped.map((c) => c[0])), ve = Math.max(...clipped.map((c) => c[1]));
      reasons.push(vs <= from && ve >= to ? "The Moon is void of course all day."
        : vs <= from ? `The Moon is void of course until ${clockIn(ve, tz)}.`
        : ve >= to ? `The Moon is void of course from ${clockIn(vs, tz)} on.`
        : `The Moon is void of course from ${clockIn(vs, tz)} to ${clockIn(ve, tz)}.`);
    }
    const free = freeMinutes(Math.max(from, +input.start), to);
    if (free != null && free < MIN_FREE_MINUTES) reasons.push(`Your calendar leaves ${free < 1 ? "no open time" : `${free} minutes open`} between ${clockIn(from, tz)} and ${clockIn(to, tz)}.`);
    if (!reasons.length && !main.dayHasWindow.has(date)) reasons.push("The engine found no window this day.");
    if (reasons.length && !picks.some((p) => p.date === date)) avoid.push({ date, reasons });
  }

  // Can it wait? Only when a governing planet is retrograde through the whole
  // span and this is a beginning: the first week after it turns direct.
  let afterClears: ElectionReport["afterClears"] = null;
  const blocking = motion.filter((m) => m.retrograde && m.until && m.until >= dayKeyInZone(horizonEnd, tz));
  if (blocking.length && modeOf(act.key) === "inception") {
    const latest = blocking.reduce((a, b) => (a.until! > b.until! ? a : b));
    const from = new Date(`${latest.until}T12:00:00Z`);
    const after = scan(input, dayBoundsInZone(from, tz)[0], AFTER_CLEARS_DAYS, undefined);
    afterClears = { from: latest.until!, planet: latest.planet, searchedDays: AFTER_CLEARS_DAYS, picks: onePerDay(after.picks).sort(byRank).slice(0, MAX_PICKS) };
  }

  const failed = main.failed;
  return {
    status: failed ? (main.scanned ? "partial" : "error") : "complete",
    activity: { key: act.key, label: act.label },
    horizon, motion, standing: [...main.standing], picks, busyButStrong, avoid, afterClears,
    coverage: {
      scannedDays: main.scanned, failedChunks: failed,
      chart: !input.natal ? "absent" : input.natal.timeKnown ? "applied" : "birth-time-unknown",
      calendar: !input.calendar ? "unchecked" : cal?.consulted ? "checked" : cal?.connected ? "unavailable" : "not-connected",
      withheld: main.withheld,
    },
  };
}
