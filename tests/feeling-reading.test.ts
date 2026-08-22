import { describe, it, expect } from "vitest";
import { feelingReading } from "../artifacts/api-server/src/lib/feelingReading.js";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal.js";

/**
 * The feelings door. Every date here is FIXED — the sky at a given instant is
 * fixed, so these are deterministic, unlike the live-sky tests this repo has
 * been bitten by twice.
 */
const n = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.4951, -6, "whole-sign");
const natal = {
  planets: n.planets.map(p => ({ planet: p.planet, longitude: p.longitude })),
  asc: n.ascendant.longitude, mc: n.midheaven.longitude,
};
const SA = { lat: 29.4246, lon: -98.4951 };
const read = (text: string, day = "2026-06-02", withChart = true) =>
  feelingReading({ text, at: new Date(`${day}T15:00:00Z`), ...SA, natal: withChart ? natal : undefined }) as any;

describe("the feelings door", () => {
  describe("the gate comes first", () => {
    it("returns support and NO astrology for crisis language", () => {
      const r = read("i want to kill myself");
      expect(r.blocked).toBe(true);
      expect(r.resources.length).toBeGreaterThanOrEqual(2);
      // The point of "refuse hard": no mirror, no planet, no reading, at all.
      expect(r.mirror).toBeUndefined();
      expect(r.live).toBeUndefined();
    });
    it("does not gate ordinary darkness", () => {
      for (const t of ["heavy and hopeless, failing a test", "so angry I could scream", "this project is killing me"]) {
        expect(read(t).blocked, t).toBe(false);
      }
    });
  });

  describe("the mirror reads feelings, not tasks", () => {
    // The regression that prompted the feeling lexicon: associate.ts is built
    // for "write the report" and answered Saturn+Pluto for this sentence.
    it("reads irritable-and-snapping as Mars", () => {
      expect(read("irritable, can't settle, snapping at people").mirror.planets[0]).toBe("Mars");
    });
    const CASES: [string, string][] = [
      ["heavy, hopeless, stuck", "Saturn"],
      ["scattered, too many tabs, can't think straight", "Mercury"],
      ["obsessive about one conversation, can't let it go", "Pluto"],
      ["foggy, not really here", "Neptune"],
      ["restless, trapped, want out", "Uranus"],
      ["unseen, nobody noticed the thing I did", "Sun"],
      ["tender and weepy", "Moon"],
      ["bored, hemmed in", "Jupiter"],
    ];
    for (const [text, planet] of CASES) {
      it(`reads "${text}" as ${planet}`, () => {
        expect(read(text).mirror.planets).toContain(planet);
      });
    }
    it("is stable across days — the words mean the same thing on any date", () => {
      for (const day of ["2026-03-15", "2026-06-02", "2026-09-20"]) {
        expect(read("irritable, snapping at everyone", day).mirror.planets[0]).toBe("Mars");
      }
    });
    it("names a capacity when the words carry one", () => {
      expect(read("exhausted and drained").mirror.capacity).toBe("depleted");
      expect(read("restless and agitated").mirror.capacity).toBe("restless");
      expect(read("lonely and left out").mirror.capacity).toBe("social");
      expect(read("thinking about the garden").mirror.capacity).toBeNull();
    });
  });

  describe("the refusal is the feature", () => {
    it("refuses, with a reason, when the mirrored planet is quiet", () => {
      const r = read("tender and weepy", "2026-06-02");
      expect(r.live).toBeNull();
      expect(r.quiet).toBeTruthy();
      // Never a silent drop — the house rule.
      expect(r.quiet.length).toBeGreaterThan(20);
    });
    it("refuses when the words land on nothing in the sky's vocabulary", () => {
      const r = read("the weather is nice and I had toast");
      expect(r.mirror.planets).toHaveLength(0);
      expect(r.live).toBeNull();
      expect(r.quiet).toBeTruthy();
    });
    it("says something on some days and nothing on others", () => {
      const days = ["2026-01-08", "2026-03-15", "2026-06-02", "2026-09-20", "2026-11-30"];
      const live = days.filter(d => read("heavy, hopeless, stuck", d).live).length;
      expect(live).toBeGreaterThan(0);
      expect(live).toBeLessThan(days.length);
    });
  });

  describe("what it says when it does speak", () => {
    it("carries the literal configuration, so it can be checked", () => {
      const r = read("scattered, overthinking everything", "2026-06-02");
      expect(r.live.planet).toBe("Mercury");
      expect(r.live.literal).toMatch(/Mercury/);
      expect(r.live.work).toBeTruthy();
    });
    it("distinguishes a passing condition from a long one", () => {
      const r = read("heavy, hopeless, stuck", "2026-09-20");
      expect(["today", "season"]).toContain(r.live.tempo);
    });
  });

  it("handles empty input without inventing anything", () => {
    const r = feelingReading({ text: "   ", ...SA }) as any;
    expect(r.blocked).toBe(false);
    expect(r.live).toBeNull();
    expect(r.mirror.planets).toHaveLength(0);
  });

  it("works without a birth chart", () => {
    const r = read("irritable, snapping at everyone", "2026-06-02", false);
    expect(r.blocked).toBe(false);
    expect(r.mirror.planets[0]).toBe("Mars");
  });
});
