import { describe, it, expect } from "vitest";
import { getNextAngularCrossings, julianDay, isSignificantCrossing } from "../artifacts/api-server/src/lib/astro";
import { readFileSync } from "node:fs";

const LA = { lat: 34.05, lon: -118.24 };
const AT = new Date("2026-08-28T07:00:00Z");   // local midnight in Los Angeles
const jd = julianDay(AT);

describe("a reported crossing has actually crossed", () => {
  it("reaches exact — every one of them, at either orb", () => {
    // THE INVARIANT. A crossing is a body arriving AT an angle, so the
    // separation at the reported moment is zero. Measured 2026-08-28 before
    // the fix at orb 40 (which is what the week scans with): four of the day's
    // crossings came back at 12, 12.66, 26.37 and 28.21 degrees — bodies that
    // never reached the angle inside the window at all.
    for (const orb of [3, 40]) {
      const cs = getNextAngularCrossings(jd, LA.lat, LA.lon, orb, 24);
      expect(cs.length, `orb ${orb}`).toBeGreaterThan(30);
      for (const c of cs) {
        expect(c.orbAtExact, `${c.planet} ${c.angle} @orb ${orb} at ${c.crossingTime}`)
          .toBeLessThan(0.5);
      }
    }
  });

  it("never stamps one with the scan's own boundary", () => {
    // Those four all carried 07:04:00 to the second — four minutes past the
    // window's end — while every genuine crossing lands on an irregular one.
    const end = AT.getTime() + 24 * 3600000;
    for (const c of getNextAngularCrossings(jd, LA.lat, LA.lon, 40, 24)) {
      expect(Date.parse(c.crossingTime), `${c.planet} ${c.angle}`).toBeLessThanOrEqual(end);
    }
  });

  // The "just perfected, reported with a negative offset" case is pinned in
  // regressions.test.ts, anchored on the Sun at noon. I removed that behaviour
  // while chasing these artifacts and that test caught it; a second copy here
  // would only be a flakier version of the same check.

  it("keeps the same body meeting the same angle twice in a day", () => {
    // Genuine, not a duplicate: the sidereal day is 23h56m, so inside a
    // 24-hour window an angle can return to a slow body's longitude a second
    // time. Dropping these as duplicates would lose a real crossing.
    const cs = getNextAngularCrossings(jd, LA.lat, LA.lon, 40, 24);
    const pairs = new Map<string, number[]>();
    for (const c of cs) {
      const k = `${c.planet}-${c.angle}`;
      pairs.set(k, [...(pairs.get(k) ?? []), Date.parse(c.crossingTime)]);
    }
    for (const [k, times] of pairs) {
      if (times.length < 2) continue;
      const gapH = (Math.max(...times) - Math.min(...times)) / 3600000;
      expect(gapH, `${k} pair should be a sidereal day apart, not minutes`).toBeGreaterThan(20);
    }
  });
});

describe("which crossings reach a page", () => {
  it("is one rule, not two copies of one", () => {
    // It was written out twice — once for /tides/now, once for the week —
    // under a comment promising the two surfaces could not disagree.
    const routes = readFileSync("artifacts/api-server/src/routes/tides.ts", "utf8");
    expect(routes).toContain("isSignificantCrossing");
    expect(routes.split("isSignificantCrossing").length - 1).toBeGreaterThanOrEqual(3);
    // And the old inline copy is gone from both.
    expect(routes).not.toContain('if ((c.benefic || c.malefic) && (c.angle === "ASC"');
  });

  it("admits every body on the two angles that carry the weight", () => {
    // The old rule let through the Moon, the benefics and malefics at ASC/MC,
    // and the Sun at MC — so Mercury never appeared despite having a
    // signification, and the four beyond Saturn were computed ~28 times a week
    // each and dropped in silence.
    for (const planet of ["Mercury", "Uranus", "Neptune", "Pluto", "Chiron"]) {
      expect(isSignificantCrossing({ planet, angle: "ASC" }), planet).toBe(true);
      expect(isSignificantCrossing({ planet, angle: "MC" }), planet).toBe(true);
      expect(isSignificantCrossing({ planet, angle: "IC" }), planet).toBe(false);
    }
  });

  it("keeps all four angles for the Moon alone", () => {
    for (const angle of ["ASC", "MC", "DSC", "IC"]) {
      expect(isSignificantCrossing({ planet: "Moon", angle }), angle).toBe(true);
    }
  });
});
