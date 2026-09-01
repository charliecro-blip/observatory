// Single-placement portraits, orb continuity, and element balance.

import { describe, expect, it } from "vitest";
import type { PairScenario } from "../engine/types";
import { DEFAULT_WEIGHTS } from "../engine/config/weights";
import { buildPairModel } from "../engine/pair";
import { buildPlacementModel, renderPlacementInterpretation } from "../engine/placement";
import { buildChartModel, elementBalance, findNatalAspects, weighPlacements, type NatalInput } from "../engine/chart";
import { generatePlacementContent } from "../engine/content";
import { renderArtwork } from "../engine/render";

const mars = { planet: "Mars" as const, sign: "Scorpio" as const, weight: DEFAULT_WEIGHTS.base.Mars };

describe("single placements", () => {
  it("draws a deterministic portrait with the planet's own two pigments", () => {
    const one = buildPlacementModel(mars);
    const two = buildPlacementModel(mars);
    expect(two.palette.map((c) => c.hex)).toEqual(one.palette.map((c) => c.hex));
    expect(renderArtwork(two)).toEqual(renderArtwork(one));
    expect(one.palette.length).toBeGreaterThanOrEqual(4);
    const dom = one.palette.find((c) => c.role === "dominant")!;
    const sec = one.palette.find((c) => c.role === "secondary")!;
    expect(dom.description).toContain("Mars");
    expect(sec.description).toContain("counter-tone");
    for (const v of Object.values(one.profile)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("lets the modality organize the frame", () => {
    expect(buildPlacementModel({ ...mars, sign: "Scorpio" }).composition.dominantGeometry).toBe("central");    // fixed
    expect(buildPlacementModel({ ...mars, sign: "Capricorn" }).composition.dominantGeometry).toBe("crossing"); // cardinal
    expect(buildPlacementModel({ ...mars, sign: "Pisces" }).composition.dominantGeometry).toBe("distributed"); // mutable
  });

  it("writes a short interpretation naming planet, sign, element, and mode", () => {
    const model = buildPlacementModel(mars);
    const prose = renderPlacementInterpretation(model, mars);
    expect(prose).toContain("Mars");
    expect(prose).toContain("Scorpio");
    expect(prose).toContain("water");
    expect(prose).toContain("fixed");
  });

  it("generates a grounded content bundle for a placement", () => {
    const model = buildPlacementModel(mars);
    const bundle = generatePlacementContent(mars, model);
    expect(bundle.hook).toBe("What does Mars in Scorpio look like?");
    expect(bundle.reelScript).toHaveLength(6);
    expect(bundle.carousel).toHaveLength(7);
    expect(JSON.stringify(bundle)).not.toContain("undefined");
    const hexes = new Set(model.palette.map((c) => c.hex));
    for (const hex of bundle.visualInstructions.match(/#[0-9a-f]{6}/g) ?? []) {
      expect(hexes.has(hex)).toBe(true);
    }
  });
});

describe("orb continuity", () => {
  it("keeps the layout seed stable while orb and weights slide", () => {
    const base: PairScenario = {
      a: { planet: "Venus", sign: "Libra", weight: 1.15 },
      b: { planet: "Uranus", sign: "Capricorn", weight: 0.8 },
      aspect: "square", orb: 1.2, variationSeed: 0,
    };
    const model = buildPairModel(base);
    expect(buildPairModel({ ...base, orb: 4.0 }).seed).toBe(model.seed);
    expect(buildPairModel({
      ...base,
      a: { ...base.a, weight: 1.6 },
    }).seed).toBe(model.seed);
    // Identity changes DO reseed.
    expect(buildPairModel({ ...base, variationSeed: 1 }).seed).not.toBe(model.seed);
    expect(buildPairModel({ ...base, aspect: "trine" }).seed).not.toBe(model.seed);
    // And the drawing still responds to orb — continuously, not by re-rolling.
    expect(renderArtwork(buildPairModel({ ...base, orb: 4.0 }))).not.toEqual(renderArtwork(model));
  });
});

describe("element balance", () => {
  it("credits weighted shares to sign elements, summing to one", () => {
    const natal: NatalInput = {
      ascendant: { sign: "Scorpio", longitude: 220 },
      midheaven: { sign: "Leo", longitude: 130 },
      planets: [
        { planet: "Sun", sign: "Leo", longitude: 130, houseNumber: 10 },
        { planet: "Moon", sign: "Pisces", longitude: 345, houseNumber: 5 },
        { planet: "Mercury", sign: "Virgo", longitude: 155, houseNumber: 11 },
        { planet: "Venus", sign: "Taurus", longitude: 45, houseNumber: 7 },
      ],
    };
    const placements = weighPlacements(natal, findNatalAspects(natal.planets));
    const balance = elementBalance(placements);
    const total = balance.fire + balance.earth + balance.air + balance.water;
    expect(total).toBeCloseTo(1, 10);
    expect(balance.air).toBe(0);          // nothing in an air sign
    expect(balance.fire).toBeGreaterThan(0);  // Sun in Leo
    expect(balance.earth).toBeGreaterThan(balance.water); // two earth placements to one water
    expect(buildChartModel(natal)).toBeDefined();
  });
});
