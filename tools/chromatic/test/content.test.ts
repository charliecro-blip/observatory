// Content-generator smoke tests: structure, grounding, determinism.

import { describe, expect, it } from "vitest";
import { ASPECTS, type PairScenario } from "../engine/types";
import { DEFAULT_WEIGHTS } from "../engine/config/weights";
import { buildPairModel } from "../engine/pair";
import { generatePairContent } from "../engine/content";

const SCENARIO: PairScenario = {
  a: { planet: "Venus", sign: "Libra", weight: DEFAULT_WEIGHTS.base.Venus },
  b: { planet: "Uranus", sign: "Capricorn", weight: DEFAULT_WEIGHTS.base.Uranus },
  aspect: "square", orb: 1.2, variationSeed: 0,
};

describe("content generator", () => {
  it("assembles every section, grounded in the generated palette", () => {
    const model = buildPairModel(SCENARIO);
    const bundle = generatePairContent(SCENARIO, model);
    expect(bundle.hook).toBe("What does Venus square Uranus look like?");
    expect(bundle.thesis).toContain("Venus");
    expect(bundle.thesis).toContain("Uranus");
    expect(bundle.reelScript).toHaveLength(6);
    expect(bundle.carousel).toHaveLength(7);
    const words = bundle.caption.split(/\s+/).length;
    expect(words).toBeGreaterThan(50);
    expect(words).toBeLessThan(300);
    // Visual instructions must cite real hexes from this model's palette.
    const cited = bundle.visualInstructions.match(/#[0-9a-f]{6}/g) ?? [];
    expect(cited.length).toBeGreaterThanOrEqual(3);
    const hexes = new Set(model.palette.map((c) => c.hex));
    for (const hex of cited) expect(hexes.has(hex)).toBe(true);
  });

  it("never leaks 'undefined' into any section, for any aspect", () => {
    for (const aspect of ASPECTS) {
      const s = { ...SCENARIO, aspect, orb: 0.5 };
      const bundle = generatePairContent(s, buildPairModel(s));
      const all = JSON.stringify(bundle);
      expect(all).not.toContain("undefined");
    }
  });

  it("is deterministic", () => {
    const one = generatePairContent(SCENARIO, buildPairModel(SCENARIO));
    const two = generatePairContent(SCENARIO, buildPairModel(SCENARIO));
    expect(two).toEqual(one);
  });
});
