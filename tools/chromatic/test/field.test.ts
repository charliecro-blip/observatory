// Chromatic Field smoke tests — determinism, area-honesty, aspect→grammar
// mapping, and that the three treatments actually differ from each other.

import { describe, expect, it } from "vitest";
import type { PairScenario } from "../engine/types";
import { DEFAULT_WEIGHTS } from "../engine/config/weights";
import { buildPairModel } from "../engine/pair";
import { buildChartModel, type NatalInput } from "../engine/chart";
import { fieldRegions, regionArea, buildFieldFromChart, buildFieldFromPair, renderChromaticField, type Treatment } from "../engine/field";

function pairField(scenario: PairScenario) {
  const model = buildPairModel(scenario);
  return buildFieldFromPair({
    model, aspect: scenario.aspect, strength: model.aspectStrength,
    planets: [scenario.a.planet, scenario.b.planet],
    signs: [scenario.a.sign, scenario.b.sign],
    seedKey: `${scenario.a.planet}|${scenario.a.sign}|${scenario.b.planet}|${scenario.b.sign}|${scenario.aspect}`,
  });
}

const VENUS_URANUS: PairScenario = {
  a: { planet: "Venus", sign: "Taurus", weight: DEFAULT_WEIGHTS.base.Venus },
  b: { planet: "Uranus", sign: "Scorpio", weight: DEFAULT_WEIGHTS.base.Uranus },
  aspect: "opposition", orb: 1.5, variationSeed: 0,
};

describe("field area honesty", () => {
  it("normalizes token weights to sum to 1", () => {
    const field = pairField(VENUS_URANUS);
    const total = field.tokens.reduce((s, t) => s + t.weight, 0);
    expect(total).toBeCloseTo(1, 10);
    for (const t of field.tokens) {
      expect(t.weight).toBeGreaterThan(0);
      expect(t.weight).toBeLessThan(1);
    }
  });

  it("conserves every placement contribution", () => {
    const field=pairField(VENUS_URANUS);
    for (const p of [VENUS_URANUS.a,VENUS_URANUS.b]) {
      const mass=field.tokens.flatMap(t=>t.contributions).filter(c=>c.source===`${p.planet} in ${p.sign}`).reduce((s,c)=>s+c.mass,0);
      expect(mass).toBeCloseTo(p.weight,10);
    }
  });
  for (const aspect of ["conjunction","opposition","square","trine","sextile","quincunx"] as const) {
    it(`preserves visible territory area for ${aspect}`,()=> {
      const f=pairField({...VENUS_URANUS,aspect});
      const regions=fieldRegions(f);
      for(const t of f.tokens) expect(regions.filter(r=>r.token===t).reduce((s,r)=>s+regionArea(r),0)).toBeCloseTo(t.weight,9);
      for(const r of regions) for(const p of r.points) for(const v of p) {expect(v).toBeGreaterThanOrEqual(-1e-9);expect(v).toBeLessThanOrEqual(1+1e-9);}
    });
  }

});

describe("aspect to boundary grammar", () => {
  const cases: Array<[PairScenario["aspect"], string]> = [
    ["conjunction", "central"], ["opposition", "polar"], ["square", "crossing"],
    ["trine", "triadic"], ["sextile", "patterned"], ["quincunx", "asymmetric"],
  ];
  for (const [aspect, geometry] of cases) {
    it(`${aspect} runs the ${geometry} grammar`, () => {
      const field = pairField({ ...VENUS_URANUS, aspect, orb: 0.5 });
      expect(field.relationship.geometry).toBe(geometry);
      const svg = renderChromaticField(field, "pure");
      expect(svg).toContain("<svg");
      expect(svg.length).toBeGreaterThan(200);
    });
  }
});

describe("rendering", () => {
  it("is deterministic per scenario", () => {
    const one = renderChromaticField(pairField(VENUS_URANUS), "material", { title: "Test" });
    const two = renderChromaticField(pairField(VENUS_URANUS), "material", { title: "Test" });
    expect(two).toEqual(one);
  });

  it("renders at the canonical 1080x1350 canvas by default", () => {
    const svg = renderChromaticField(pairField(VENUS_URANUS), "pure");
    expect(svg).toContain('viewBox="0 0 1080 1350"');
    expect(svg).toContain('width="1080" height="1350"');
  });

  it("gives the three treatments genuinely different markup", () => {
    const field = pairField(VENUS_URANUS);
    const outputs = (["pure", "material", "editorial"] as Treatment[]).map((t) => renderChromaticField(field, t, { title: "Reading" }));
    expect(new Set(outputs).size).toBe(3);
    // Pure never emits a blur filter or grain turbulence.
    expect(outputs[0]).not.toContain("feGaussianBlur");
    expect(outputs[0]).not.toContain("feTurbulence");
    // Editorial is the only one carrying the typographic lockup.
    expect(outputs[2]).toContain("READING");
    expect(outputs[0]).not.toContain("READING");
    expect(outputs[1]).not.toContain("READING");
  });

  it("keeps Pure and Material geometrically identical apart from surface", () => {
    // Same field, same grammar — Material adds grain/blur/vignette layers on
    // top but must not move or resize the underlying territories.
    const field = pairField({ ...VENUS_URANUS, aspect: "square", orb: 1 });
    const pure = renderChromaticField(field, "pure");
    const material = renderChromaticField(field, "material");
    const stripPath = (svg: string) => svg.match(/<path d="[^"]+"/)?.[0];
    expect(stripPath(material)).toEqual(stripPath(pure));
  });
});

describe("whole-chart field", () => {
  const FIXTURE: NatalInput = {
    ascendant: { sign: "Scorpio", longitude: 220 },
    midheaven: { sign: "Leo", longitude: 130 },
    planets: [
      { planet: "Sun", sign: "Leo", longitude: 130, houseNumber: 10 },
      { planet: "Moon", sign: "Pisces", longitude: 345, houseNumber: 5 },
      { planet: "Mercury", sign: "Virgo", longitude: 155, houseNumber: 11 },
      { planet: "Venus", sign: "Taurus", longitude: 45, houseNumber: 7 },
      { planet: "Mars", sign: "Capricorn", longitude: 282, houseNumber: 3 },
      { planet: "Jupiter", sign: "Sagittarius", longitude: 255, houseNumber: 2 },
      { planet: "Saturn", sign: "Leo", longitude: 134, houseNumber: 10 },
      { planet: "Uranus", sign: "Scorpio", longitude: 226, houseNumber: 1 },
      { planet: "Neptune", sign: "Sagittarius", longitude: 263, houseNumber: 2 },
      { planet: "Pluto", sign: "Libra", longitude: 195, houseNumber: 12 },
    ],
  };

  it("builds and renders without ever labeling all ten planets", () => {
    const chart = buildChartModel(FIXTURE);
    const field = buildFieldFromChart(chart, "fixture-chart");
    const svg = renderChromaticField(field, "editorial", { title: "Sample Chart", factors: "SUN · VENUS · SATURN" });
    for (const p of ["Mercury", "Jupiter", "Neptune"]) expect(svg).not.toContain(p);
    expect(svg).toContain("SAMPLE CHART");
  });

  it("is deterministic across rebuilds of the same chart", () => {
    const a = renderChromaticField(buildFieldFromChart(buildChartModel(FIXTURE), "k"), "material");
    const b = renderChromaticField(buildFieldFromChart(buildChartModel(FIXTURE), "k"), "material");
    expect(a).toEqual(b);
  });
});
