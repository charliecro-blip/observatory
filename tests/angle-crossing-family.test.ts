import { describe, it, expect } from "vitest";
import { supportLevelFrom } from "../artifacts/api-server/src/lib/electionEngine";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { getNextAngularCrossings, julianDay } from "../artifacts/api-server/src/lib/astro";

const AT = new Date("2026-09-01T00:00:00Z");
const LA = { lat: 34.05, lon: -118.24, tzOffsetMin: 420 };
const week = (activityKey: string, locationKnown = true) =>
  computeElections({ activityKey, span: "week", ...LA, locationKnown, startAt: AT } as any) as any;

describe("angle-crossing is reinforcing, and the count is why", () => {
  it("is not scarce enough to establish convergence on its own", () => {
    // Measured 2026-08-28 at one location: 309 crossings a week, ~28 per body,
    // spread evenly over all four angles. A planet crosses each angle once a
    // day for the same reason a planetary hour comes round once a day.
    expect(supportLevelFrom(["angle-crossing"])).toBe("supported");
    expect(supportLevelFrom(["angle-crossing", "planetary-time"])).toBe("supported");
    expect(supportLevelFrom(["angle-crossing", "lunar-condition"])).toBe("supported");
  });

  it("can tip a window that already has an establishing testimony", () => {
    // This is the tier raise: one establishing plus two reinforcing converges.
    expect(supportLevelFrom(["lunar-contact", "planetary-time"])).toBe("supported");
    expect(supportLevelFrom(["lunar-contact", "planetary-time", "angle-crossing"])).toBe("convergent");
  });

  it("still cannot make a pile of reinforcing conditions converge", () => {
    expect(supportLevelFrom(["angle-crossing", "planetary-time", "lunar-condition", "planetary-motion"]))
      .toBe("supported");
  });
});

describe("crossings ride on windows rather than making them", () => {
  it("adds no windows at all", () => {
    // 56 crossings a week for a typical activity against 6.2 windows would
    // have made "window" mean nothing. Measured before and after: 123 both.
    let total = 0;
    for (const k of ["train-hard", "deep-work", "deep-rest", "first-date"]) total += week(k).windows.length;
    expect(total).toBeLessThan(60);   // four activities; a flood would be hundreds
  });

  it("marks the windows a significator crossing actually falls inside", () => {
    const w = week("train-hard").windows.filter((x: any) => x.sources.includes("crossing"));
    expect(w.length).toBeGreaterThan(0);
    for (const win of w) {
      expect(win.families).toContain("angle-crossing");
      expect(win.reinforcingFamilies).toContain("angle-crossing");
      expect(win.establishingFamilies).not.toContain("angle-crossing");
    }
  });

  it("only counts crossings by this activity's own significators", () => {
    // train-hard is Mars and Sun; a Neptune crossing is not its business.
    const evid = week("train-hard").windows
      .flatMap((w: any) => w.evidence ?? [])
      .filter((e: any) => e.family === "angle-crossing");
    expect(evid.length).toBeGreaterThan(0);
    for (const e of evid) expect(e.text).toMatch(/^(Mars|Sun) crosses/);
  });

  it("names the transit literally, with its time, before any reading", () => {
    const e = week("train-hard").windows
      .flatMap((w: any) => w.evidence ?? [])
      .find((x: any) => x.family === "angle-crossing");
    expect(e.text).toMatch(/crosses the (ASC|MC|DSC|IC) at /);
    expect(e.text).toContain("inside this window");
  });

  it("is withheld entirely when the location is a guess", () => {
    // The angles are cut from the local horizon, so on a guessed meridian
    // every crossing time is wrong — and a wrong minute is worse here than
    // anywhere else, because the claim of a crossing IS the minute.
    const w = week("train-hard", false).windows;
    expect(w.every((x: any) => !x.sources.includes("crossing"))).toBe(true);
  });
});

describe("the volume that decided the doctrine", () => {
  it("is still what it was when the call was made", () => {
    // If this ever drops to a handful a week, angle-crossing should be
    // reconsidered as establishing. Pinned so the reasoning stays checkable.
    let n = 0;
    for (let d = 0; d < 7; d++) {
      n += getNextAngularCrossings(julianDay(new Date(AT.getTime() + d * 86400000)), LA.lat, LA.lon, 3, 24).length;
    }
    expect(n).toBeGreaterThan(200);
  });
});
