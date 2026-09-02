// Color-math reference values (2026-09-01 audit): hue wraparound arithmetic
// and known OKLCH→sRGB anchors, so a future "simplification" of the matrices
// or the mixers fails against fixed points instead of only against taste.

import { describe, expect, it } from "vitest";
import { clampToGamut, hueDelta, mixHue, oklchToHex, oklchToRgb } from "../engine/color";

describe("hue arithmetic", () => {
  it("interpolates across the 0° wrap by the short path", () => {
    expect(Math.abs(mixHue(350, 10, 0.5))).toBeLessThan(1e-9);      // 350→10 midpoint is 0
    expect(Math.abs(mixHue(10, 350, 0.5))).toBeLessThan(1e-9);
    expect(mixHue(80, 100, 0.25)).toBeCloseTo(85, 9);
  });

  it("signs deltas by direction", () => {
    expect(hueDelta(350, 10)).toBeCloseTo(20, 9);
    expect(hueDelta(10, 350)).toBeCloseTo(-20, 9);
    // The antipode folds to one signed edge of the range; magnitude is what matters.
    expect(Math.abs(hueDelta(0, 180))).toBeCloseTo(180, 9);
  });
});

describe("OKLCH → sRGB anchors", () => {
  const near = (hex: string, expected: [number, number, number], tolerance = 2) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    expect(Math.abs(r - expected[0])).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(g - expected[1])).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(b - expected[2])).toBeLessThanOrEqual(tolerance);
  };

  it("hits white, black, and sRGB red", () => {
    near(oklchToHex({ l: 1, c: 0, h: 0 }), [255, 255, 255], 0);
    near(oklchToHex({ l: 0, c: 0, h: 0 }), [0, 0, 0], 0);
    // sRGB pure red is oklch(0.62796, 0.25768, 29.234).
    near(oklchToHex({ l: 0.62796, c: 0.25768, h: 29.234 }), [255, 0, 0]);
  });

  it("gamut-clamps by reducing chroma, preserving lightness and hue", () => {
    const wild = { l: 0.6, c: 0.4, h: 145 };
    const clamped = clampToGamut(wild);
    expect(clamped.c).toBeLessThan(wild.c);
    expect(clamped.l).toBeCloseTo(0.6, 9);
    expect(clamped.h).toBe(145);
    const { r, g, b } = oklchToRgb(clamped);
    for (const v of [r, g, b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});
