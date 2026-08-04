import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ACTIVITIES, modeOf, primarySignificatorsOf } from "../artifacts/api-server/src/lib/activityCorrespondences";
import { TRADITIONAL_PLANETS } from "../artifacts/api-server/src/lib/motion";

/**
 * Role, not weight.
 *
 * The engine derived "which planet carries the matter" from
 * `weight >= 0.8` — a number nobody ever defended. Weight says how strongly a
 * planet CORRESPONDS to an activity; role says whether its debility
 * compromises the undertaking. A 0.8 planet can be secondary and a 0.6 planet
 * can be the one the tradition would judge.
 */

describe("every inception names its significators explicitly", () => {
  const inceptions = ACTIVITIES.filter((a) => modeOf(a.key) === "inception");

  it("has inceptions to check", () => {
    expect(inceptions.length).toBeGreaterThan(5);
  });

  it("assigns each one a primary that is not merely the weight cutoff", () => {
    const byWeight = (a: any) =>
      Object.entries(a.planets).filter(([, w]) => (w as number) >= 0.8).map(([p]) => p).sort();
    let differsSomewhere = false;
    for (const a of inceptions) {
      const primary = primarySignificatorsOf(a.key, a.planets);
      expect(primary.length, `${a.key} has no primary significator`).toBeGreaterThan(0);
      // Each primary must actually be a significator of the activity.
      for (const p of primary) {
        expect(Object.keys(a.planets), `${a.key} names ${p}, which is not in its planets`).toContain(p);
      }
      if (JSON.stringify(primary.slice().sort()) !== JSON.stringify(byWeight(a))) differsSomewhere = true;
    }
    // If the explicit table exactly reproduced the cutoff everywhere, it would
    // be ceremony rather than a decision.
    expect(differsSomewhere, "explicit roles reproduce the >= 0.8 cutoff exactly").toBe(true);
  });

  it("names the planet that carries the matter, not the loudest correspondence", () => {
    // publish weights Mercury and Jupiter equally at 0.9; the act of
    // publishing is communication, so Mercury carries it.
    expect(primarySignificatorsOf("publish", { Mercury: 0.9, Jupiter: 0.9, Sun: 0.8 })).toEqual(["Mercury"]);
    // sign-contract is the document itself.
    expect(primarySignificatorsOf("sign-contract", { Mercury: 1.0, Saturn: 0.7 })).toEqual(["Mercury"]);
    // move-home: the home and the land under it — Saturn at 0.7 would have
    // been excluded by the old >= 0.8 cutoff despite signifying property.
    expect(primarySignificatorsOf("move-home", { Moon: 1.0, Saturn: 0.7, Venus: 0.5 })).toContain("Saturn");
  });
});

describe("the fallback stays inert", () => {
  it("only applies where role currently reads nothing", () => {
    // Non-inceptions fall back to the old heuristic, which is fine precisely
    // because nothing consults role for them. If that changes, they need
    // assigning deliberately rather than inheriting a number.
    for (const a of ACTIVITIES) {
      if (modeOf(a.key) === "inception") continue;
      const primary = primarySignificatorsOf(a.key, a.planets);
      const byWeight = Object.entries(a.planets).filter(([, w]) => (w as number) >= 0.8).map(([p]) => p);
      expect(primary.sort(), a.key).toEqual(byWeight.sort());
    }
  });
});

describe("only traditional significators can trigger the rule", () => {
  it("never lets an outer planet reach the cap, whatever its role", () => {
    const src = readFileSync("artifacts/api-server/src/lib/electionEngine.ts", "utf-8");
    // The cap filters on TRADITIONAL_PLANETS before anything else.
    expect(src).toMatch(/TRADITIONAL_PLANETS\.has\(p\)/);
    for (const p of ["Uranus", "Neptune", "Pluto"]) {
      expect(TRADITIONAL_PLANETS.has(p), p).toBe(false);
    }
  });
});
