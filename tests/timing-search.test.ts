import { describe, it, expect } from "vitest";
import { searchTiming, type TimingSearchRequest } from "../artifacts/api-server/src/lib/timingSearch";
import { computeElections, evaluateActivityInterval } from "../artifacts/api-server/src/lib/electionEngine";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { findLongSessions } from "../artifacts/api-server/src/lib/longSession";
const q: TimingSearchRequest = { activity: "deep-work", start: "2026-09-05T05:00:00Z", end: "2026-09-07T05:00:00Z", timeZone: "America/Chicago" };
const run = (request = q, engines?: Parameters<typeof searchTiming>[1]) => {
  const result = searchTiming(request, engines);
  if (!("days" in result)) throw new Error(JSON.stringify(result));
  return result;
};
describe("canonical timing search", () => {
  it("runs chartless without inventory, with exact canonical ordinary parity", () => {
    const result = run();
    expect(result.status).toBe("complete");
    expect(result.context.natal).toBe("absent");
    for (const day of result.days) {
      if (day.kind !== "ordinary") throw new Error();
      const direct = computeElections({ activityKey: q.activity, span: "day", startAt: new Date(day.start), timeZone: q.timeZone, tzOffsetMin: 300, lat: 0, lon: 0, locationKnown: false })!;
      expect(day.result).toEqual(direct);
      expect(day.availability.every(a => a.status === "unchecked")).toBe(true);
    }
  });
  it("preserves qualified results and their reasons", () => {
    const r = run({ ...q, activity: "sign-contract", start: "2026-10-25T05:00:00Z", end: "2026-10-27T05:00:00Z", location: { lat: 29.4246, lon: -98.49514 } });
    const ws = r.days.flatMap(d => d.kind === "ordinary" ? d.result.windows : []);
    expect(ws.some(w => w.suitability !== "clear" && w.suitabilityReasons.length > 0)).toBe(true);
  });
  it("returns honest empty results for a one-second horizon", () => {
    const r = run({ ...q, end: "2026-09-05T05:00:01Z" });
    expect(r.outcome).toBe("empty");
    expect(r.status).toBe("complete");
  });
  it("distinguishes partial and failed coverage from empty", () => {
    let n = 0;
    const r = run(q, { session: findLongSessions, ordinary: opts => { if (n++ === 0) throw Error(); return computeElections(opts); } });
    expect(r.status).toBe("partial"); expect(r.coverage.failed).toHaveLength(1); expect(r.coverage.scanned).toHaveLength(1);
    const error = run(q, { session: findLongSessions, ordinary: () => { throw Error(); } });
    expect(error.status).toBe("error"); expect(error.outcome).toBe("indeterminate");
  });
  it("keeps civil DST boundaries and never widens the requested horizon", () => {
    const r = run({ ...q, start: "2026-10-31T05:00:00Z", end: "2026-11-02T06:00:00Z" });
    expect(r.coverage.scanned).toEqual([{ start: "2026-10-31T05:00:00.000Z", end: "2026-11-01T05:00:00.000Z" }, { start: "2026-11-01T05:00:00.000Z", end: "2026-11-02T06:00:00.000Z" }]);
  });
  it("returns 3-hour weekend sessions with canonical parity and scoped evidence", () => {
    const r = run({ ...q, durationMinutes: 180 });
    expect(r.outcome).toBe("results");
    for (const d of r.days) {
      if (d.kind !== "session") throw Error();
      expect(d.result).toEqual(findLongSessions({ activityKey: q.activity, minutes: 180, date: new Date(d.start), startAt: new Date(d.start), endAt: new Date(d.end), lat: 0, lon: 0, locationKnown: false, timeZone: q.timeZone, tzOffsetMin: 300, wakeHour: 7, sleepHour: 23 }));
      for (const { candidate: c } of d.result.options) {
        expect(+c.endAt - +c.startAt).toBe(180 * 60000);
        expect(c.assessment).toEqual(evaluateActivityInterval({ activityKey: q.activity, startAt: c.startAt, endAt: c.endAt }));
        expect(c.arc).toEqual([]);
        expect(c.assessment.families).not.toContain("planetary-time");
      }
    }
  });
  it("bounds selection before ranking and reports duration shortfall", () => {
    const r = run({ ...q, start: "2026-09-05T18:07:00Z", end: "2026-09-05T19:07:00Z", durationMinutes: 180 });
    const d = r.days[0]; if (d.kind !== "session") throw Error();
    expect(d.result.options).toEqual([]); expect(d.result.shortfall?.longestMinutes).toBe(60);
    expect(d.result.shortfall?.candidate?.startAt.toISOString()).toBe("2026-09-05T18:07:00.000Z");
  });
  it("marks conflicts without changing astronomy and distinguishes calendar failure", () => {
    const base = run({ ...q, durationMinutes: 180 });
    const calendar = { source: "fixture", fetchedAt: q.start, result: { ok: true, connected: true, busy: [{ startMs: Date.parse(q.start), endMs: Date.parse(q.end) }] } };
    const busy = run({ ...q, durationMinutes: 180, calendar });
    expect(busy.days.map(d => d.kind === "session" && d.result)).toEqual(base.days.map(d => d.kind === "session" && d.result));
    expect(busy.days.every(d => d.kind === "session" && d.availability.every(a => a.status === "conflict"))).toBe(true);
    const failed = run({ ...q, calendar: { ...calendar, result: { ...calendar.result, ok: false } } });
    expect(failed.context.calendar.status).toBe("unavailable");
  });
  it("rejects unknown activities, invalid zones, local timestamps, and unbounded work", () => {
    expect(searchTiming({ ...q, activity: "psychedelic-trip" }).status).toBe("unsupported");
    for (const change of [{ timeZone: "Nowhere" }, { start: "2026-09-05T00:00:00" }, { end: "2026-10-05T00:00:00Z" }, { durationMinutes: 0 }]) expect(searchTiming({ ...q, ...change }).status).toBe("invalid");
  });
});

it("keeps custom rules explicit and refuses custom session substitution", () => {
  const custom = { ...ACTIVITIES[0], key: "custom-fixture" };
  expect(run({ ...q, activity: custom.key, extraActivities: [custom] }).status).toBe("complete");
  expect(searchTiming({ ...q, activity: custom.key, extraActivities: [custom], durationMinutes: 180 })).toEqual({ status: "unsupported", code: "custom_session_unsupported" });
});
it("reports a supplied natal chart as omitted for sessions", () => {
  const natal = { chart: computeNatalChart("1990-01-01", "12:00", 30, -97, -6, "whole-sign"), timeKnown: false };
  expect(run({ ...q, natal, durationMinutes: 180 }).context.natal).toBe("omitted_session_unsupported");
  const ordinary = run({ ...q, natal });
  expect(ordinary.context.natal).toBe("applied");
  expect(ordinary.context.birthTimeKnown).toBe(false);
});
it("rejects an excessive horizon before invoking either engine", () => {
  let calls = 0;
  searchTiming({ ...q, end: "2026-10-05T05:00:00Z" }, { ordinary: () => { calls++; return null; }, session: () => { calls++; return null; } });
  expect(calls).toBe(0);
});
