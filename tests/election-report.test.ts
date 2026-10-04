import { describe, it, expect } from "vitest";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { buildElectionReport } from "../artifacts/api-server/src/lib/electionReport";

// Anchored: Sunday 2026-10-04, 10:00 AM in Austin. Venus stationed retrograde
// Oct 3 and turns direct Nov 13; the Moon is void on the dates asserted below.
const chart: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
const B = (s: string, e: string) => ({ startMs: Date.parse(s), endMs: Date.parse(e) });
const busy = [
  B("2026-10-05T08:00-05:00", "2026-10-05T21:00-05:00"),
  B("2026-10-09T14:30-05:00", "2026-10-09T23:00-05:00"),
  B("2026-10-12T08:00-05:00", "2026-10-12T21:00-05:00"),
];
const input = (activity: string, over: object = {}) => ({
  activity, start: new Date("2026-10-04T15:00:00Z"), days: 14, timeZone: "America/Chicago",
  location: { lat: 30.1912, lon: -97.8028 }, natal: { chart, timeKnown: true },
  calendar: { result: { ok: true, connected: true, busy }, source: "Google Calendar", fetchedAt: "2026-10-04T15:00:00Z" },
  ...over,
});

describe("election report", () => {
  const r = buildElectionReport(input("haircut") as any);

  it("states what the governing planet is doing across the span", () => {
    expect(r.motion.map((m) => m.sentence)).toEqual(["Venus is retrograde from Oct 3 until Nov 13."]);
  });

  it("covers every day it was asked to, and says what it could not read", () => {
    expect(r.status).toBe("complete");
    expect(r.coverage).toMatchObject({ scannedDays: 14, failedChunks: 0, chart: "applied", calendar: "checked" });
    expect(r.horizon.days).toBe(14);
  });

  it("lists open times only as picks, one per day, never overlapping the calendar", () => {
    expect(r.picks.length).toBeGreaterThan(0);
    expect(new Set(r.picks.map((p) => p.date)).size).toBe(r.picks.length);
    for (const p of r.picks) {
      expect(p.availability).toBe("clear");
      expect(busy.some((b) => Date.parse(p.start) < b.endMs && Date.parse(p.end) > b.startMs), p.date).toBe(false);
    }
  });

  it("keeps strong times the calendar has taken apart, labeled", () => {
    const taken = r.busyButStrong.find((p) => p.date === "2026-10-09");
    expect(taken?.availability).toBe("conflict");
  });

  it("names each day to leave alone with the one fact that says why", () => {
    const by = Object.fromEntries(r.avoid.map((a) => [a.date, a.reasons]));
    expect(by["2026-10-06"]).toEqual(["The Moon is void of course until 9:52 PM."]);
    expect(by["2026-10-08"]).toEqual(["The Moon is void of course all day."]);
    // A day it avoids is never also a pick.
    for (const p of r.picks) expect(by[p.date]).toBeUndefined();
  });

  it("answers 'can it wait?' for a beginning governed by a retrograde planet, and an empty answer counts", () => {
    expect(r.afterClears).toMatchObject({ from: "2026-11-13", planet: "Venus", searchedDays: 14 });
    const none = buildElectionReport(input("meditate") as any);
    expect(none.afterClears).toBeNull();
  });

  it("says plainly when the chart or the calendar was not used", () => {
    const bare = buildElectionReport(input("haircut", { natal: undefined, calendar: undefined }) as any);
    expect(bare.coverage).toMatchObject({ chart: "absent", calendar: "unchecked" });
    expect(bare.picks.every((p) => p.availability === "unchecked")).toBe(true);
    expect(buildElectionReport(input("haircut", { natal: { chart, timeKnown: false } }) as any).coverage.chart).toBe("birth-time-unknown");
  });

  it("lists times when the calendar cannot be read, and says why", () => {
    const off = (connected: boolean) => buildElectionReport(input("haircut", {
      calendar: { result: { ok: false, connected, busy: [] }, source: "Google Calendar", fetchedAt: "2026-10-04T15:00:00Z" },
    }) as any);
    const notLinked = off(false);
    expect(notLinked.coverage.calendar).toBe("not-connected");
    expect(notLinked.picks.length).toBeGreaterThan(0);
    expect(notLinked.picks.every((p) => p.availability === "unavailable")).toBe(true);
    expect(off(true).coverage.calendar).toBe("unavailable");
  });

  it("refuses an activity it does not know instead of guessing", () => {
    expect(buildElectionReport(input("not-an-activity") as any)).toMatchObject({ status: "unsupported", picks: [] });
  });
}, 120000);
