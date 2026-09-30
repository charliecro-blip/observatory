import { describe, expect, it } from "vitest";
import { dayPerfections } from "../artifacts/api-server/src/lib/perfections";
import { ASPECT_DEFS, getPlanetPositions, julianDay } from "../artifacts/api-server/src/lib/astro";

// 2026-09-30, a Chicago day (CDT, UTC-5).
const START = Date.parse("2026-09-30T05:00:00Z");
const END = Date.parse("2026-10-01T05:00:00Z");

/** Orb read through getPlanetPositions — a different path from the search's own
 *  longitude reads, so agreement is a check, not a tautology. */
function orbAt(ms: number, a: string, b: string, aspect: string): number {
  const pos = getPlanetPositions(julianDay(new Date(ms)));
  const la = pos.find((p) => p.planet === a)!.longitude;
  const lb = pos.find((p) => p.planet === b)!.longitude;
  const raw = (((la - lb) % 360) + 360) % 360;
  const sep = raw > 180 ? 360 - raw : raw;
  return Math.abs(sep - ASPECT_DEFS.find((d) => d.name === aspect)!.angle);
}

describe("dayPerfections", () => {
  const found = dayPerfections(START, END);

  it("finds the Moon's sextile to Mars at 3:06 PM, not the 3:53 the hourly feed printed", () => {
    const hit = found.find((p) => p.body1 === "Moon" && p.body2 === "Mars" && p.aspect === "sextile");
    expect(hit).toBeDefined();
    const local = new Date(hit!.at).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
    expect(local).toBe("3:06 PM");
  });

  it("reports each perfection once", () => {
    const keys = found.map((p) => `${p.body1}|${p.body2}|${p.aspect}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("puts every hit at a true minimum that reaches the angle", () => {
    expect(found.length).toBeGreaterThan(0);
    for (const p of found) {
      const t = Date.parse(p.at);
      const at = orbAt(t, p.body1, p.body2, p.aspect);
      const label = `${p.body1} ${p.aspect} ${p.body2} ${p.at}`;
      expect(at, label).toBeLessThan(0.02);
      expect(orbAt(t - 10 * 60000, p.body1, p.body2, p.aspect), label).toBeGreaterThan(at);
      expect(orbAt(t + 10 * 60000, p.body1, p.body2, p.aspect), label).toBeGreaterThan(at);
    }
  });

  it("keeps to the window and to the five major aspects", () => {
    const majors = new Set(ASPECT_DEFS.map((d) => d.name));
    for (const p of found) {
      expect(Date.parse(p.at)).toBeGreaterThanOrEqual(START);
      expect(Date.parse(p.at)).toBeLessThan(END);
      expect(majors.has(p.aspect)).toBe(true);
    }
  });

  it("finds the slow pairs too, across a month, each within its own day", () => {
    // Planet pairs perfect every few days; a month without one would mean the
    // pair search is silent, which is the bug this replaces.
    let pairs = 0;
    for (let d = 0; d < 30; d++) {
      const s = START + d * 86400000;
      for (const p of dayPerfections(s, s + 86400000)) if (!p.lunar) {
        pairs++;
        expect(orbAt(Date.parse(p.at), p.body1, p.body2, p.aspect)).toBeLessThan(0.02);
      }
    }
    expect(pairs).toBeGreaterThan(3);
  });

  it("is cheap enough for a single-day request", () => {
    const t = performance.now();
    dayPerfections(START + 7 * 86400000, END + 7 * 86400000);
    expect(performance.now() - t).toBeLessThan(400);
  });
});
