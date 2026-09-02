// Whole-chart phase tests, on a hand-built fixture so no ephemeris (and no
// live sky) is ever involved. Longitudes are chosen to pin known aspects.

import { describe, expect, it } from "vitest";
import { buildChartModel, findNatalAspects, weighPlacements, type NatalInput } from "../engine/chart";
import { DEFAULT_WEIGHTS } from "../engine/config/weights";
import { renderChartInterpretation } from "../engine/explain";
import { renderArtwork } from "../engine/render";

// Scorpio rising (so Pluto is chart ruler under modern rulership). Venus at
// 15° Taurus opposes Uranus at 16° Scorpio (orb 1°); Sun 10° Leo squares
// nothing tightly; Mars 12° Capricorn trines Venus loosely (63° → sextile
// band, orb 3°); Saturn 14° Leo squares Venus (89° separation → orb 1°).
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

describe("whole-chart phase", () => {
  it("finds the pinned aspects with correct orbs", () => {
    const aspects = findNatalAspects(FIXTURE.planets);
    const find = (a: string, b: string) =>
      aspects.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    const venusUranus = find("Venus", "Uranus");
    expect(venusUranus?.aspect).toBe("opposition");
    expect(venusUranus?.orb).toBeCloseTo(1, 5);
    const venusSaturn = find("Venus", "Saturn");
    expect(venusSaturn?.aspect).toBe("square");
    expect(venusSaturn?.orb).toBeCloseTo(1, 5);
    const sunSaturn = find("Sun", "Saturn");
    expect(sunSaturn?.aspect).toBe("conjunction");
  });

  it("weighs angularity, rulership, luminaries, and connectivity", () => {
    const placements = weighPlacements(FIXTURE, findNatalAspects(FIXTURE.planets));
    const get = (p: string) => placements.find((x) => x.planet === p)!;
    // Sun: luminary base 1.3 + exactly on the MC (130 = 130) + aspects.
    expect(get("Sun").weight).toBeGreaterThan(1.7);
    expect(get("Sun").reasons).toContain("angular (0.0° from MC)");
    // Pluto: chart ruler of Scorpio rising (modern default).
    expect(get("Pluto").reasons.some((r) => r.startsWith("chart ruler"))).toBe(true);
    // Uranus sits 6° from the ASC — angular by proximity, not house.
    expect(get("Uranus").reasons).toContain("angular (6.0° from ASC)");
    // Sorted heaviest first, effective weights sharpen the top.
    expect(placements[0].weight).toBeGreaterThanOrEqual(placements[9].weight);
    expect(placements[0].effective / placements[0].weight)
      .toBeGreaterThan(placements[9].effective / placements[9].weight);
  });

  it("scores angularity continuously along the proximity curve", () => {
    // Jupiter exactly on the MC, Saturn 12° off it, Mars 25° off — same
    // chart, no aspects among them, so the only differences are angular.
    const natal: NatalInput = {
      ascendant: { sign: "Scorpio", longitude: 220 },
      midheaven: { sign: "Leo", longitude: 130 },
      planets: [
        { planet: "Jupiter", sign: "Leo", longitude: 130, houseNumber: 10 },
        { planet: "Saturn", sign: "Leo", longitude: 142, houseNumber: 10 },
        { planet: "Mars", sign: "Virgo", longitude: 155, houseNumber: 11 },
      ],
    };
    const placements = weighPlacements(natal, findNatalAspects(natal.planets));
    const get = (p: string) => placements.find((x) => x.planet === p)!;
    expect(get("Jupiter").weight).toBeCloseTo(1.0 + 0.4, 10);          // full bonus on the angle
    expect(get("Saturn").weight).toBeCloseTo(1.0 + 0.4 * 0.43, 10);    // curve at 12°
    expect(get("Mars").weight).toBeCloseTo(1.15, 10);                  // past the curve: nothing
    expect(get("Mars").reasons.some((r) => r.startsWith("angular"))).toBe(false);
  });

  it("weights connectivity by aspect strength, not count", () => {
    const base = {
      ascendant: { sign: "Scorpio" as const, longitude: 220 },
      midheaven: { sign: "Leo" as const, longitude: 130 },
    };
    const at = (venusLon: number, marsLon: number): NatalInput => ({
      ...base,
      planets: [
        { planet: "Venus", sign: "Aries", longitude: venusLon, houseNumber: 5 },
        { planet: "Mars", sign: "Taurus", longitude: marsLon, houseNumber: 6 },
      ],
    });
    // One sextile each — exact in the first chart, barely in orb in the second.
    const tight = weighPlacements(at(0, 60), findNatalAspects(at(0, 60).planets));
    const loose = weighPlacements(at(0, 64), findNatalAspects(at(0, 64).planets));
    const venus = (ps: typeof tight) => ps.find((p) => p.planet === "Venus")!;
    expect(venus(tight).connectivity).toBeCloseTo(1, 10);
    expect(venus(loose).connectivity).toBeCloseTo(0.2, 10);
    expect(venus(tight).weight).toBeGreaterThan(venus(loose).weight);
    // Both still report the same human-readable count.
    expect(venus(tight).reasons).toContain("1 aspect");
    expect(venus(loose).reasons).toContain("1 aspect");
  });

  it("lets rulership mode pick the chart ruler, or nobody", () => {
    const aspects = findNatalAspects(FIXTURE.planets);
    const rulerOf = (mode: "modern" | "traditional" | "none") =>
      weighPlacements(FIXTURE, aspects, { ...DEFAULT_WEIGHTS, rulershipMode: mode })
        .filter((p) => p.reasons.some((r) => r.startsWith("chart ruler")))
        .map((p) => p.planet);
    expect(rulerOf("modern")).toEqual(["Pluto"]);      // Scorpio rising, modern
    expect(rulerOf("traditional")).toEqual(["Mars"]);  // Scorpio rising, traditional
    expect(rulerOf("none")).toEqual([]);
  });

  it("builds a deterministic chart model with a defining aspect", () => {
    const one = buildChartModel(FIXTURE);
    const two = buildChartModel(FIXTURE);
    expect(one.defining).not.toBeNull();
    expect(two.model.palette.map((c) => c.hex)).toEqual(one.model.palette.map((c) => c.hex));
    expect(renderArtwork(two.model)).toEqual(renderArtwork(one.model));
    // The defining aspect drives geometry.
    const spec = one.defining!;
    expect(one.aspects[0]).toBe(spec);
    expect(one.model.palette.length).toBeGreaterThanOrEqual(5);
    for (const v of Object.values(one.model.profile)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the whole-chart profile off the rails", () => {
    // Ten placements once railed nearly every axis at 1.0 through the tanh
    // squash; chartProfileMass normalization keeps a chart on the same scale
    // as a pair. A couple of extreme axes are fine — a wall of them is not.
    const { model } = buildChartModel(FIXTURE);
    const extreme = Object.values(model.profile).filter((v) => v > 0.95 || v < 0.05);
    expect(extreme.length).toBeLessThanOrEqual(3);
  });

  it("writes a chart interpretation naming the top factor and the defining aspect", () => {
    const chart = buildChartModel(FIXTURE);
    const prose = renderChartInterpretation(chart);
    expect(prose).toContain(chart.placements[0].planet);
    expect(prose).toContain(chart.defining!.aspect);
    const words = prose.split(/\s+/).length;
    expect(words).toBeGreaterThan(60);
    expect(words).toBeLessThan(300);
  });

  it("handles a chart with no aspects in orb", () => {
    // Four planets at longitudes searched offline so every pair separation
    // misses every aspect band. (Ten mutually unaspected planets don't pack
    // into the wheel; a real chart always has aspects, which is why the
    // no-aspect path is a fallback and not a common case.)
    const LON = [214.9, 107.7, 242.0, 313.2];
    const sparse: NatalInput = {
      ...FIXTURE,
      planets: FIXTURE.planets.slice(0, 4).map((p, i) => ({ ...p, longitude: LON[i] })),
    };
    expect(findNatalAspects(sparse.planets)).toHaveLength(0);
    const chart = buildChartModel(sparse);
    expect(chart.defining).toBeNull();
    expect(chart.model.composition.dominantGeometry).toBe("distributed");
    expect(chart.model.palette.length).toBeGreaterThanOrEqual(5);
  });
});
