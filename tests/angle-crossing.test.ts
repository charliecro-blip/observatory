import { describe, it, expect } from "vitest";
import { activeCrossings, WINDOW_MIN } from "../artifacts/tides/src/components/AngleCrossing";

/**
 * WHICH ANGLE CROSSINGS ARE LIVE.
 *
 * A chart angle sweeps the ecliptic at ~14°/hr, so a 3° orb is ~12.9 minutes
 * either side of exact. That arithmetic decided what appeared at the top of
 * the page and was never testable, because it lived inside a render tree in a
 * 3000-line file.
 *
 * Anchored to a fixed instant — a test that reads the live sky inherits the
 * weather of whichever day it runs on (the day-flaky lesson).
 */

const NOW = new Date("2026-08-19T18:00:00Z");
const at = (minsFromNow: number) =>
  new Date(NOW.getTime() + minsFromNow * 60000).toISOString();
const cross = (mins: number, planet = "Venus", angle = "ASC") =>
  ({ planet, angle, at: at(mins) });

describe("active angle crossings", () => {
  it("uses the ~13-minute window the 14°/hr sweep implies", () => {
    expect(WINDOW_MIN).toBeGreaterThan(12);
    expect(WINDOW_MIN).toBeLessThan(14);
  });

  it("counts a crossing live on either side of exact", () => {
    expect(activeCrossings([cross(-10)], NOW)).toHaveLength(1);
    expect(activeCrossings([cross(10)], NOW)).toHaveLength(1);
    expect(activeCrossings([cross(0)], NOW)).toHaveLength(1);
  });

  it("drops one outside the window in both directions", () => {
    expect(activeCrossings([cross(-45)], NOW)).toHaveLength(0);
    expect(activeCrossings([cross(45)], NOW)).toHaveLength(0);
  });

  it("shows ALL simultaneous crossings, nearest to exact first", () => {
    // The defect this pins: taking only the nearest concealed a second
    // crossing entirely — Jupiter AND Saturn at an angle showed as one.
    const rows = activeCrossings([cross(9, "Saturn", "MC"), cross(-2, "Jupiter", "ASC")], NOW);
    expect(rows.map(r => r.c.planet)).toEqual(["Jupiter", "Saturn"]);
  });

  it("reports the orb the elapsed minutes imply", () => {
    const [row] = activeCrossings([cross(-6)], NOW);
    expect(row.orbDeg).toBeCloseTo(6 * (14 / 60), 5);
  });

  it("answers empty for no crossings, and for a malformed instant", () => {
    expect(activeCrossings(undefined, NOW)).toEqual([]);
    expect(activeCrossings([], NOW)).toEqual([]);
    // A bad timestamp must be dropped, never rendered as "peaking now" —
    // NaN minutes would pass an unguarded window check.
    expect(activeCrossings([{ planet: "Mars", angle: "ASC", at: "not a date" }], NOW)).toEqual([]);
  });
});
