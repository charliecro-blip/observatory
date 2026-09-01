// Synastry tests — two fixture charts with pinned cross-aspects.

import { describe, expect, it } from "vitest";
import { SIGNS, type Planet, type Sign } from "../engine/types";
import type { NatalInput } from "../engine/chart";
import { buildSynastryModel, findCrossAspects, renderSynastryInterpretation } from "../engine/synastry";
import { renderArtwork } from "../engine/render";

const signOf = (lon: number): Sign => SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)];

function chart(asc: number, lons: number[]): NatalInput {
  const planets: Planet[] = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
  return {
    ascendant: { sign: signOf(asc), longitude: asc },
    midheaven: { sign: signOf(asc + 270), longitude: (asc + 270) % 360 },
    planets: lons.map((lon, i) => ({
      planet: planets[i], sign: signOf(lon), longitude: lon, houseNumber: (i % 12) + 1,
    })),
  };
}

// A is the familiar fixture; B pins two cross-aspects: B's Venus at 165
// trines A's Venus at 45 (orb 0), and B's Mars at 135 conjoins A's Saturn at
// 134 (orb 1).
const A = chart(220, [130, 345, 155, 45, 282, 255, 134, 226, 263, 195]);
const B = chart(10, [100, 200, 88, 165, 135, 20, 310, 60, 240, 170]);

describe("synastry", () => {
  it("finds the pinned cross-aspects", () => {
    const found = findCrossAspects(A, B);
    const venusVenus = found.find((x) => x.aPlanet === "Venus" && x.bPlanet === "Venus");
    expect(venusVenus?.aspect).toBe("trine");
    expect(venusVenus?.orb).toBeCloseTo(0, 5);
    const saturnMars = found.find((x) => x.aPlanet === "Saturn" && x.bPlanet === "Mars");
    expect(saturnMars?.aspect).toBe("conjunction");
    expect(saturnMars?.orb).toBeCloseTo(1, 5);
  });

  it("builds a deterministic shared field led by the top cross-aspect", () => {
    const one = buildSynastryModel(A, B);
    const two = buildSynastryModel(A, B);
    expect(one.defining).not.toBeNull();
    expect(one.defining).toBe(one.crossAspects[0]);
    for (let i = 1; i < one.crossAspects.length; i++) {
      expect(one.crossAspects[i - 1].score).toBeGreaterThanOrEqual(one.crossAspects[i].score);
    }
    expect(two.model.palette.map((c) => c.hex)).toEqual(one.model.palette.map((c) => c.hex));
    expect(renderArtwork(two.model)).toEqual(renderArtwork(one.model));
    expect(one.model.palette.length).toBeGreaterThanOrEqual(5);
    expect(one.model.palette.length).toBeLessThanOrEqual(8);
    for (const v of Object.values(one.model.profile)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    for (const line of one.lines) expect(line).toContain("orb");
  });

  it("interprets the meeting with both names and the defining aspect", () => {
    const syn = buildSynastryModel(A, B);
    const prose = renderSynastryInterpretation(syn, "Ada", "Grace");
    expect(prose).toContain("Ada");
    expect(prose).toContain("Grace");
    expect(prose).toContain(syn.defining!.aspect);
    const words = prose.split(/\s+/).length;
    expect(words).toBeGreaterThan(50);
    expect(words).toBeLessThan(300);
  });

  it("reports charts that never cross honestly", () => {
    // Four longitudes verified mutually unaspected (see chart.test.ts); two
    // planets per chart, so every cross-pair misses every band.
    const sparseA = chart(220, [214.9, 107.7]);
    const sparseB = chart(10, [242.0, 313.2]);
    expect(findCrossAspects(sparseA, sparseB)).toHaveLength(0);
    const syn = buildSynastryModel(sparseA, sparseB);
    expect(syn.defining).toBeNull();
    expect(syn.model.composition.dominantGeometry).toBe("distributed");
    expect(syn.lines).toHaveLength(0);
  });
});
