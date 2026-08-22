import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { julianDay, getMajorAspects, getLastMoonAspect } from "../artifacts/api-server/src/lib/astro.js";

/**
 * THE ELECTION SCAN'S COST, pinned.
 *
 * A 14-day scan scores every planetary hour in the range — 336 moments — and
 * took 42 SECONDS of blocked event loop on a synchronous route, so one person
 * opening Launch stalled every other request for most of a minute. Three
 * changes brought it to ~8s. Each was verified to leave the answers untouched,
 * and each is easy to undo by accident, so each is pinned here.
 */
describe("the election scan's cost", () => {
  const MOMENTS = Array.from({ length: 12 }, (_, i) =>
    julianDay(new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + i * 613 * 3600_000)));

  it("gives identical Moon pairs whether or not the other pairs are computed", () => {
    // getMajorAspects walks every non-Moon pair through a 6-hour, 14-day
    // station sweep. Callers that read only the Moon's aspects were paying for
    // thirty-six pairs they discarded — twice per scored moment, once directly
    // and once inside getLastMoonAspect.
    const isMoon = (a: { planet1: string; planet2: string }) =>
      a.planet1 === "Moon" || a.planet2 === "Moon";
    for (const jd of MOMENTS) {
      expect(getMajorAspects(jd, true).filter(isMoon), `jd ${jd}`)
        .toEqual(getMajorAspects(jd).filter(isMoon));
    }
  });

  it("computes only Moon pairs when asked for only Moon pairs", () => {
    for (const jd of MOMENTS) {
      const moonOnly = getMajorAspects(jd, true);
      expect(moonOnly.every(a => a.planet1 === "Moon" || a.planet2 === "Moon")).toBe(true);
    }
  });

  it("lets a caller hand in the aspects it already has", () => {
    // Not a cache — the same value, passed along. scoreElection computed the
    // Moon's aspects and then getLastMoonAspect computed them again.
    for (const jd of MOMENTS) {
      const shared = getMajorAspects(jd, true);
      expect(getLastMoonAspect(jd, shared)).toEqual(getLastMoonAspect(jd));
    }
  });

  it("keeps enough ternary iterations that the rounded answer cannot move", () => {
    // Each iteration evaluates the ephemeris twice and narrows the bracket by a
    // third; the result is then rounded to 0.01h. 60 was computing precision
    // toFixed(2) discarded. But 26 was too few — it moved 27 of 400 sampled
    // moments by one unit in that last decimal, 36 seconds, and these times are
    // printed to the minute. 30 is the first count that is byte-identical to
    // 60 across 400 moments; the floor here is that measurement, not a guess.
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/astro.ts"), "utf-8");
    const m = /const TERNARY_ITERS = (\d+);/.exec(src);
    expect(m, "TERNARY_ITERS must stay a single named constant").toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(30);
  });
});
