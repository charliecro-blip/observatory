// The hue-pull invariant (2026-09-01 audit): strength 0 imposes no aspect
// relationship — pigments stay native — strength 1 imposes the full one, and
// everything between moves monotonically. This is what makes the orb slider
// morph one image instead of the aspect grammar overpowering loose ties.

import { describe, expect, it } from "vitest";
import type { AspectName, PairScenario, Placement } from "../engine/types";
import { ASPECT_PROFILES } from "../engine/config/aspects";
import { DEFAULT_WEIGHTS } from "../engine/config/weights";
import { buildPairModel } from "../engine/pair";
import { buildChartModel, type NatalInput } from "../engine/chart";
import { easeAspectPull, resolvePigment } from "../engine/palette";
import { hueDelta } from "../engine/color";
import { makeRng } from "../engine/seed";

function pair(aspect: AspectName, orb: number): PairScenario {
  return {
    a: { planet: "Mars", sign: "Capricorn", weight: DEFAULT_WEIGHTS.base.Mars },
    b: { planet: "Neptune", sign: "Pisces", weight: DEFAULT_WEIGHTS.base.Neptune },
    aspect, orb, variationSeed: 0,
  };
}

function domSecSeparation(s: PairScenario): number {
  const m = buildPairModel(s);
  const dom = m.palette.find((c) => c.role === "dominant")!;
  const sec = m.palette.find((c) => c.role === "secondary")!;
  return Math.abs(hueDelta(dom.oklch.h, sec.oklch.h));
}

/** The pigment generatePalette would resolve first, replayed from the model's own seed. */
function nativeHue(s: PairScenario, which: "a" | "b"): number {
  const rng = makeRng(buildPairModel(s).seed ^ 0x9e3779b9);
  const first = resolvePigment(s.a, rng);
  const second = resolvePigment(s.b, rng);
  return (which === "a" ? first : second).h;
}

describe("easeAspectPull", () => {
  it("holds the endpoints and stays monotone", () => {
    expect(easeAspectPull(0)).toBe(0);
    expect(easeAspectPull(1)).toBe(1);
    let prev = 0;
    for (let s = 0; s <= 1.001; s += 0.05) {
      const p = easeAspectPull(s);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe("aspect hue pull vs orb", () => {
  const targets: Record<string, number> = { conjunction: 0, opposition: 180, square: 90, trine: 32 };

  for (const aspect of ["conjunction", "opposition", "square", "trine"] as const) {
    it(`${aspect}: exact orb hits the target, max orb leaves pigments native, distance is monotone`, () => {
      const maxOrb = ASPECT_PROFILES[aspect].maxOrb;
      const target = targets[aspect];
      const miss = (orb: number) => Math.abs(domSecSeparation(pair(aspect, orb)) - target);

      // Exact aspect: the relationship lands on its target separation.
      expect(miss(0)).toBeLessThan(1e-6);
      // Monotone: the further from exact, the further from the target.
      expect(miss(0)).toBeLessThanOrEqual(miss(maxOrb / 2) + 1e-9);
      expect(miss(maxOrb / 2)).toBeLessThanOrEqual(miss(maxOrb) + 1e-9);
      // Zero strength: no imposed relationship at all — the heavier planet's
      // pigment sits at its native hue, untouched by the aspect.
      const zero = buildPairModel(pair(aspect, maxOrb));
      const dom = zero.palette.find((c) => c.role === "dominant")!;
      expect(Math.abs(hueDelta(dom.oklch.h, nativeHue(pair(aspect, maxOrb), "a")))).toBeLessThan(1e-6);
    });
  }
});

describe("no-aspect whole-chart fallback", () => {
  it("leaves the two lead pigments native instead of fusing them", () => {
    // Four mutually unaspected placements (longitudes from chart.test.ts).
    const LON = [214.9, 107.7, 242.0, 313.2];
    const planets = (["Sun", "Moon", "Mercury", "Venus"] as const).map((planet, i) => ({
      planet, sign: "Leo" as const, longitude: LON[i], houseNumber: i + 1,
    }));
    const natal: NatalInput = {
      ascendant: { sign: "Scorpio", longitude: 220 },
      midheaven: { sign: "Leo", longitude: 130 },
      planets,
    };
    const chart = buildChartModel(natal);
    expect(chart.defining).toBeNull();

    // Replay the palette's first two pigment draws from the model's own seed:
    // with zero aspect strength, dominant and secondary must equal them.
    const [first, second] = chart.placements;
    const rng = makeRng(chart.model.seed ^ 0x9e3779b9);
    const toPlacement = (p: typeof first): Placement => ({ planet: p.planet, sign: p.sign, weight: p.weight });
    const nativeA = resolvePigment(toPlacement(first), rng);
    const nativeB = resolvePigment(toPlacement(second), rng);
    const dom = chart.model.palette.find((c) => c.role === "dominant")!;
    const sec = chart.model.palette.find((c) => c.role === "secondary")!;
    expect(Math.abs(hueDelta(dom.oklch.h, nativeA.h))).toBeLessThan(1e-6);
    expect(Math.abs(hueDelta(sec.oklch.h, nativeB.h))).toBeLessThan(1e-6);
  });
});
