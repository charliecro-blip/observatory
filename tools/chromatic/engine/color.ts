// OKLCH → sRGB by hand, so the engine carries no color dependency.
//
// Palette work happens in OKLCH because the handoff's grammar modifies
// perceptual parameters (hue, chroma, lightness) rather than looking up hex
// values. Conversion goes oklch → oklab → LMS → linear sRGB → sRGB, with
// chroma reduced until the color fits the sRGB gamut.

import type { Oklch } from "./types";

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function inGamut(rgb: [number, number, number]): boolean {
  const eps = 1e-5;
  return rgb.every((v) => v >= -eps && v <= 1 + eps);
}

function oklchToLinear(color: Oklch): [number, number, number] {
  const hr = (color.h * Math.PI) / 180;
  return oklabToLinearSrgb(color.l, color.c * Math.cos(hr), color.c * Math.sin(hr));
}

/**
 * Bring a color into the sRGB gamut by walking chroma down (lightness and hue
 * are the perceptual identity of the color; chroma is what we can spare).
 */
export function clampToGamut(color: Oklch): Oklch {
  const l = Math.min(0.999, Math.max(0.001, color.l));
  let lo = 0;
  let hi = Math.max(0, color.c);
  if (inGamut(oklchToLinear({ l, c: hi, h: color.h }))) return { l, c: hi, h: color.h };
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear({ l, c: mid, h: color.h }))) lo = mid;
    else hi = mid;
  }
  return { l, c: lo, h: color.h };
}

export function oklchToRgb(color: Oklch): { r: number; g: number; b: number } {
  const clamped = clampToGamut(color);
  const [lr, lg, lb] = oklchToLinear(clamped);
  const to255 = (v: number) => Math.round(255 * Math.min(1, Math.max(0, linearToSrgb(v))));
  return { r: to255(lr), g: to255(lg), b: to255(lb) };
}

export function oklchToHex(color: Oklch): string {
  const { r, g, b } = oklchToRgb(color);
  const p = (v: number) => v.toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** Shortest-path interpolation between two hue angles, t in 0..1. */
export function mixHue(h1: number, h2: number, t: number): number {
  let d = ((h2 - h1) % 360 + 540) % 360 - 180;
  return ((h1 + d * t) % 360 + 360) % 360;
}

/** Signed shortest angular distance from h1 to h2, in -180..180. */
export function hueDelta(h1: number, h2: number): number {
  return ((h2 - h1) % 360 + 540) % 360 - 180;
}

export function normHue(h: number): number {
  return ((h % 360) + 360) % 360;
}
