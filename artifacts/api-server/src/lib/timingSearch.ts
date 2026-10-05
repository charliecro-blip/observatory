import { createHash } from "node:crypto";
import {
  computeElections,
  evaluateActivityInterval,
  type ActivityAssessment,
  type ElectionResult,
} from "./electionEngine.js";
import { findLongSessions, type LongSessionResult } from "./longSession.js";
import {
  activityByKey,
  type ActivityCorrespondence,
} from "./activityCorrespondences.js";
import { dayBoundsInZone, offsetMinutesFor } from "./localClock.js";
import { readCalendar, type BusyResult } from "./calendarCommitments.js";

export interface TimingSearchRequest {
  activity: string;
  /** Absolute ISO instants with Z or an explicit offset; end is exclusive. */
  start: string;
  end: string;
  timeZone: string;
  /** Any explicit duration selects the canonical session finder. */
  durationMinutes?: number;
  /** Supplied intervals: same activity and elapsed duration, assessed in input order. */
  candidateIntervals?: { start: string; end: string }[];
  location?: { lat: number; lon: number };
  calendar?: { result: BusyResult; source: string; fetchedAt: string };
  natal?: {
    chart: NonNullable<Parameters<typeof computeElections>[0]["natal"]>;
    timeKnown: boolean;
    /** YYYY-MM-DD, for the year's lord (natal resonance R2). */
    birthDate?: string;
    /** Self-reported caution planets (natal resonance O5). */
    cautionPlanets?: string[];
  };
  extraActivities?: ActivityCorrespondence[];
}
export type Availability = {
  status: "unchecked" | "clear" | "conflict" | "unavailable";
  source: string | null;
  fetchedAt: string | null;
};
type Span = { start: string; end: string };
export type TimingSearchDay = Span &
  (
    | {
        kind: "ordinary";
        result: ElectionResult;
        availability: Availability[];
        excludedBoundaryWindows: number;
      }
    | {
        kind: "session";
        evidenceCoverage: "interval_assessment_not_window_eligibility";
        result: LongSessionResult;
        availability: Availability[];
        shortfallAvailability: Availability | null;
      }
    | {
        kind: "comparison";
        evidenceCoverage: "interval_assessment_not_window_eligibility";
        result: ActivityAssessment;
        availability: Availability;
        broad: boolean;
      }
    | { kind: "error"; code: "canonical_scan_failed" }
  );
export type TimingSearchResult =
  | { status: "invalid" | "unsupported"; code: string }
  | {
      status: "complete" | "partial" | "error";
      outcome: "results" | "empty" | "indeterminate";
      interpretation: {
        activity: string;
        mode: "ordinary" | "session" | "comparison";
        durationMinutes: number | null;
        timeZone: string;
        horizon: Span;
        wakingHours: { start: 7; end: 23 } | null;
      };
      provenance: {
        adapterVersion: "1";
        engine:
          | "computeElections"
          | "findLongSessions"
          | "evaluateActivityInterval";
        activityRuleHash: string;
        computedAt: string;
      };
      context: {
        location: "applied" | "unknown";
        natal:
          | "applied"
          | "omitted_session_unsupported"
          | "omitted_comparison_unsupported"
          | "absent";
        birthTimeKnown: boolean | null;
        calendar: Availability;
      };
      coverage: {
        requested: Span;
        scanned: Span[];
        failed: Span[];
        boundaryPolicy:
          | "whole_windows_only"
          | "bounded_sessions"
          | "supplied_intervals";
      };
      days: TimingSearchDay[];
    };

const canonical = { ordinary: computeElections, session: findLongSessions };
/** One orchestration boundary, with injectable canonical calls for failure tests.
 * No re-ranking, scoring, clipped-window promotion, or strict-inception path.
 * Calendar conflicts are marked; the original astronomical intervals survive.
 */
export function searchTiming(
  q: TimingSearchRequest,
  engines: typeof canonical & {
    comparison?: typeof evaluateActivityInterval;
  } = canonical,
): TimingSearchResult {
  const absolute = (s: unknown): s is string =>
    typeof s === "string" &&
    /T.*(?:Z|[+-]\d\d:\d\d)$/.test(s) &&
    Number.isFinite(Date.parse(s));
  if (
    !q ||
    !absolute(q.start) ||
    !absolute(q.end) ||
    Date.parse(q.end) <= Date.parse(q.start)
  )
    return { status: "invalid", code: "invalid_horizon" };
  try {
    if (!q.timeZone) throw new Error();
    new Intl.DateTimeFormat("en", { timeZone: q.timeZone });
  } catch {
    return { status: "invalid", code: "invalid_timezone" };
  }
  if (
    q.durationMinutes !== undefined &&
    (!Number.isInteger(q.durationMinutes) ||
      q.durationMinutes < 1 ||
      q.durationMinutes > 1440)
  )
    return { status: "invalid", code: "invalid_duration" };
  if (
    q.location &&
    (!Number.isFinite(q.location.lat) ||
      !Number.isFinite(q.location.lon) ||
      Math.abs(q.location.lat) > 90 ||
      Math.abs(q.location.lon) > 180)
  )
    return { status: "invalid", code: "invalid_location" };
  if (
    q.calendar &&
    (!absolute(q.calendar.fetchedAt) ||
      !q.calendar.result ||
      !Array.isArray(q.calendar.result.busy) ||
      q.calendar.result.busy.some(
        (b) =>
          !Number.isFinite(b.startMs) ||
          !Number.isFinite(b.endMs) ||
          b.endMs <= b.startMs,
      ))
  )
    return { status: "invalid", code: "invalid_calendar" };
  const act =
    activityByKey(q.activity) ??
    q.extraActivities?.find((a) => a.key === q.activity);
  if (!act) return { status: "unsupported", code: "unknown_activity" };
  const comparison = q.candidateIntervals !== undefined;
  const session = !comparison && q.durationMinutes !== undefined;
  if (
    comparison &&
    (!Array.isArray(q.candidateIntervals) ||
      q.candidateIntervals.length < 2 ||
      q.candidateIntervals.length > 6 ||
      !q.durationMinutes ||
      q.candidateIntervals.some(
        (c) =>
          !c ||
          Object.keys(c).some((k) => k !== "start" && k !== "end") ||
          !absolute(c.start) ||
          !absolute(c.end) ||
          Date.parse(c.end) - Date.parse(c.start) !==
            q.durationMinutes! * 60000 ||
          Date.parse(c.start) < Date.parse(q.start) ||
          Date.parse(c.end) > Date.parse(q.end),
      ))
  )
    return { status: "invalid", code: "invalid_comparison_intervals" };
  if (
    comparison &&
    new Set(
      q.candidateIntervals!.map(
        (c) => `${Date.parse(c.start)}/${Date.parse(c.end)}`,
      ),
    ).size !== q.candidateIntervals!.length
  )
    return { status: "invalid", code: "duplicate_comparison_interval" };
  if (session && !activityByKey(q.activity))
    return { status: "unsupported", code: "custom_session_unsupported" };
  const start = new Date(q.start),
    end = new Date(q.end);
  const spans: { start: Date; end: Date; day: Date }[] = [];
  for (let cursor = start; cursor < end; ) {
    const [day, next] = dayBoundsInZone(cursor, q.timeZone);
    if (next <= cursor) return { status: "invalid", code: "invalid_civil_day" };
    spans.push({ start: cursor, end: new Date(Math.min(+next, +end)), day });
    if (spans.length > 7)
      return { status: "invalid", code: "horizon_exceeds_seven_civil_days" };
    cursor = next;
  }
  const cal = q.calendar ? readCalendar(q.calendar.result) : null;
  const availability = (s?: number, e?: number): Availability => ({
    status: !cal
      ? "unchecked"
      : !cal.consulted
        ? "unavailable"
        : s !== undefined &&
            e !== undefined &&
            cal.commitments.some((c) => +c.startAt < e && +c.endAt > s)
          ? "conflict"
          : "clear",
    source: q.calendar?.source ?? null,
    fetchedAt: q.calendar?.fetchedAt ?? null,
  });
  const days: TimingSearchDay[] = [];
  const scanned: Span[] = [],
    failed: Span[] = [];
  const work = comparison
    ? q.candidateIntervals!.map((c) => ({
        start: new Date(c.start),
        end: new Date(c.end),
        day: new Date(c.start),
      }))
    : spans;
  for (const span of work) {
    const bounds = {
      start: span.start.toISOString(),
      end: span.end.toISOString(),
    };
    const common = {
      activityKey: q.activity,
      lat: q.location?.lat ?? 0,
      lon: q.location?.lon ?? 0,
      locationKnown: !!q.location,
      timeZone: q.timeZone,
      tzOffsetMin: offsetMinutesFor(span.day, q.timeZone),
    };
    try {
      if (comparison) {
        const result = (engines.comparison ?? evaluateActivityInterval)({
          activityKey: q.activity,
          startAt: span.start,
          endAt: span.end,
          lat: q.location?.lat,
          lon: q.location?.lon,
          extraActivities: q.extraActivities,
          natal: q.natal ? { chart: q.natal.chart, timeKnown: q.natal.timeKnown, birthDate: q.natal.birthDate, cautionPlanets: q.natal.cautionPlanets } : undefined,
          timeZone: q.timeZone,
        });
        if (!result) throw new Error();
        const [day, next] = dayBoundsInZone(span.start, q.timeZone);
        days.push({
          ...bounds,
          kind: "comparison",
          evidenceCoverage: "interval_assessment_not_window_eligibility",
          result,
          availability: availability(+span.start, +span.end),
          broad: +span.start === +day && +span.end === +next,
        });
      } else if (session) {
        const result = engines.session({
          ...common,
          date: span.day,
          minutes: q.durationMinutes!,
          startAt: span.start,
          endAt: span.end,
          wakeHour: 7,
          sleepHour: 23,
          natal: q.natal ? { chart: q.natal.chart, timeKnown: q.natal.timeKnown, birthDate: q.natal.birthDate, cautionPlanets: q.natal.cautionPlanets } : undefined,
        });
        if (!result) throw new Error();
        days.push({
          ...bounds,
          kind: "session",
          evidenceCoverage: "interval_assessment_not_window_eligibility",
          result,
          availability: result.options.map((o) =>
            availability(+o.candidate.startAt, +o.candidate.endAt),
          ),
          shortfallAvailability: result.shortfall?.candidate
            ? availability(
                +result.shortfall.candidate.startAt,
                +result.shortfall.candidate.endAt,
              )
            : null,
        });
      } else {
        const result = engines.ordinary({
          ...common,
          startAt: span.start,
          span: "day",
          natal: q.natal?.chart,
          timeKnown: q.natal?.timeKnown,
          birthDate: q.natal?.birthDate,
          cautionPlanets: q.natal?.cautionPlanets,
          extraActivities: q.extraActivities,
        });
        if (!result) throw new Error();
        const windows = result.windows.filter(
          (w) =>
            Date.parse(w.startAt) >= +span.start &&
            Date.parse(w.endAt) <= +span.end,
        );
        days.push({
          ...bounds,
          kind: "ordinary",
          result: {
            ...result,
            windows,
            personalized: windows.some((w) => w.personal),
          },
          excludedBoundaryWindows: result.windows.length - windows.length,
          availability: windows.map((w) =>
            availability(Date.parse(w.startAt), Date.parse(w.endAt)),
          ),
        });
      }
      scanned.push(bounds);
    } catch {
      failed.push(bounds);
      days.push({ ...bounds, kind: "error", code: "canonical_scan_failed" });
    }
  }
  const hasResults = days.some((d) =>
    d.kind === "ordinary"
      ? d.result.windows.length > 0
      : d.kind === "comparison" ||
        (d.kind === "session" && d.result.options.length > 0),
  );
  return {
    status: !failed.length ? "complete" : scanned.length ? "partial" : "error",
    outcome: hasResults ? "results" : failed.length ? "indeterminate" : "empty",
    interpretation: {
      activity: q.activity,
      mode: comparison ? "comparison" : session ? "session" : "ordinary",
      durationMinutes: q.durationMinutes ?? null,
      timeZone: q.timeZone,
      horizon: { start: start.toISOString(), end: end.toISOString() },
      wakingHours: session ? { start: 7, end: 23 } : null,
    },
    provenance: {
      adapterVersion: "1",
      engine: comparison
        ? "evaluateActivityInterval"
        : session
          ? "findLongSessions"
          : "computeElections",
      activityRuleHash: createHash("sha256")
        .update(JSON.stringify(act))
        .digest("hex"),
      computedAt: new Date().toISOString(),
    },
    context: {
      location: q.location ? "applied" : "unknown",
      // Every mode reads the chart now (2026-10-05); the two "omitted"
      // values stay in the type for responses already stored.
      natal: !q.natal ? "absent" : "applied",
      birthTimeKnown: q.natal?.timeKnown ?? null,
      calendar: availability(+start, +end),
    },
    coverage: {
      requested: { start: start.toISOString(), end: end.toISOString() },
      scanned,
      failed,
      boundaryPolicy: comparison
        ? "supplied_intervals"
        : session
          ? "bounded_sessions"
          : "whole_windows_only",
    },
    days,
  };
}
