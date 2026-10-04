import { describe, it, expect } from "vitest";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeDayArc } from "../artifacts/api-server/src/lib/dayarc";

// 2026-10-04: all-day windows were exempt from void-of-course avoidance, so a
// haircut on Tue Oct 6 read "good, 7 AM–11 PM" while the Moon was void from
// 5:21 AM to 9:52 PM (Austin, America/Chicago). Anchored dates, not the live sky.
const AUSTIN = { lat: 30.19, lon: -97.8, tzOffsetMin: 300, timeZone: "America/Chicago" };
const voidOn = (day: string) => ((computeDayArc(new Date(`${day}T12:00:00-05:00`), AUSTIN.lat, AUSTIN.lon, 300, "America/Chicago") as any).vocWindows ?? [])
  .map((v: any) => [Date.parse(v.start), Date.parse(v.end)] as [number, number]);

describe("void of course and day-long windows", () => {
  it("drops a day that is void nearly throughout, and says so", () => {
    const r = computeElections({ activityKey: "haircut", span: "day", ...AUSTIN, startAt: new Date("2026-10-06T05:00:00Z") } as any)!;
    const voids = voidOn("2026-10-06");
    expect(voids.length).toBeGreaterThan(0);
    for (const w of r.windows)
      expect(voids.some(([s, e]) => Date.parse(w.startAt) < e && Date.parse(w.endAt) > s), `${w.startClock}–${w.endClock}`).toBe(false);
    expect(r.withheld.voidMoon).toBeGreaterThan(0);
  });

  it("keeps the clear part of a day the void only covers in part", () => {
    // Sun Oct 4: void until 5:54 PM, then the Moon enters Leo.
    const r = computeElections({ activityKey: "haircut", span: "day", ...AUSTIN, startAt: new Date("2026-10-04T05:00:00Z") } as any)!;
    const voids = voidOn("2026-10-04");
    for (const w of r.windows)
      expect(voids.some(([s, e]) => Date.parse(w.startAt) < e && Date.parse(w.endAt) > s), `${w.startClock}–${w.endClock}`).toBe(false);
  });
});
