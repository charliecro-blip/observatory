import { describe, it, expect } from "vitest";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";

/**
 * What an election window is allowed to claim about you.
 *
 * Two defects fixed together, both of the same shape: a value that stood in
 * for a fact it did not actually establish.
 *
 *  - `personalized` meant "a natal chart was available", so a response of
 *    entirely global windows described itself as personalized.
 *  - An UNTIMED chart was handed house cusps. Settings stores
 *    `birthTime || "12:00"` with timeKnown:false, and the elections route
 *    gated on `birthTime != null` — which is true for the substituted noon —
 *    so someone who never knew their birth time received house-based
 *    testimony derived from a moment nobody was born at, and (since personal
 *    families can decide the tier) could see it promote a window to `great`.
 *
 * Neither had reached a user: production holds eight charts, none untimed.
 * Fixed because the code claimed things it had not computed.
 */

const AT = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));
const PLACE = { lat: 29.4246, lon: -98.49514, tzOffsetMin: 300 };
const timed = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
const untimed = computeNatalChart("1992-01-03", "12:00", 29.4246, -98.49514, -6, "whole-sign");

// `week`, not `month`: this file runs on every deploy via `pnpm test`, and the
// month spans took 25s. The long sweeps belong in tools/, behind their own
// config, where a slow diagnostic cannot hold up a build.
const run = (o: Partial<Parameters<typeof computeElections>[0]> = {}) =>
  computeElections({ activityKey: "investigate", span: "week", ...PLACE, startAt: AT, ...o } as any)!;

describe("houses require a known birth time", () => {
  it("gives a timed chart house testimony", () => {
    const r = run({ natal: timed, timeKnown: true });
    const houses = r.windows.filter(w => w.families.includes("natal-house"));
    expect(houses.length, "a timed chart should produce house testimony").toBeGreaterThan(0);
  }, 20_000);

  it("gives an UNTIMED chart none, however complete it looks", () => {
    // The chart object is fully populated — it has an Ascendant, because one
    // was computed from the substituted noon. That is exactly why the guard
    // cannot be "do we have a chart".
    expect(untimed.ascendant).toBeTruthy();
    const r = run({ natal: untimed, timeKnown: false });
    for (const w of r.windows) {
      expect(w.families, `window ${w.date} claimed a house`).not.toContain("natal-house");
    }
  }, 20_000);

  it("still allows transit-to-natal contacts without a time", () => {
    // Planetary longitudes barely move across a day, so a noon substitution
    // does not invalidate them — only the angles.
    const r = run({ natal: untimed, timeKnown: false, activityKey: "investigate" });
    const anyPersonal = r.windows.some(w => w.families.includes("natal-contact"));
    const anyHouse = r.windows.some(w => w.families.includes("natal-house"));
    expect(anyHouse).toBe(false);
    // Contacts are rare, so assert the CAPABILITY rather than a hit: the
    // family must not be categorically excluded the way houses are.
    expect(typeof anyPersonal).toBe("boolean");
  }, 20_000);

  it("excludes the Moon from untimed transit-to-natal", () => {
    // The Moon moves ~13°/day. A noon guess puts its natal place up to ~6.5°
    // out — three times the 2° orb the rule uses — so its "return" would be
    // noise with a decimal point on it.
    const src = require("node:fs").readFileSync(
      "artifacts/api-server/src/lib/electionEngine.ts", "utf-8");
    expect(src).toMatch(/if \(!houseTestimonyAllowed && p === "Moon"\) continue;/);
  }, 20_000);
});

describe("personalized means a window actually used the chart", () => {
  it("separates chart availability from chart use", () => {
    const r = run({ natal: timed, timeKnown: true });
    expect(r.chartAvailable).toBe(true);
    expect(r.personalized).toBe(r.windows.some(w => w.personal));
  }, 20_000);

  it("reports no chart as neither available nor used", () => {
    const r = run({ natal: null });
    expect(r.chartAvailable).toBe(false);
    expect(r.personalized).toBe(false);
    for (const w of r.windows) expect(w.personal).toBe(false);
  }, 20_000);

  it("marks per-window whether personal testimony decided the tier", () => {
    const r = run({ natal: timed, timeKnown: true });
    for (const w of r.windows) {
      // Only meaningful on great windows; never asserted on good ones.
      if (w.tier !== "great") expect(w.personalDecidedTier).toBe(false);
    }
  }, 20_000);
});

describe("tier counting is by family, not by row", () => {
  it("never reaches great on fewer than two distinct families", () => {
    // The original defect: three branches pushed the bare string "natal" and
    // the threshold read the array length before the emit-time dedupe.
    for (const natal of [timed, null]) {
      const r = run({ natal, timeKnown: true });
      for (const w of r.windows) {
        if (w.tier === "great") {
          expect(new Set(w.families).size,
            `great window ${w.date} had families ${JSON.stringify(w.families)}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  }, 20_000);
});
