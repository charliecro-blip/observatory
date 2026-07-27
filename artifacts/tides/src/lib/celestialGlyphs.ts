/**
 * Tides — Celestial Glyph System (ported from the design handoff,
 * design_handoff_celestial_glyphs/glyphs.js — keep in sync with that spec).
 *
 * The glyphs are REAL TYPE (Unicode code points rendered with a symbol face),
 * NOT hand-drawn SVG. Do not substitute drawn paths — that was tried ~6 rounds
 * and always read as "kid-drawn".
 *
 * Two things make them look right:
 *   1. The text-presentation selector U+FE0E after every code point, or the
 *      browser renders color emoji instead of the line glyph.
 *   2. Per-glyph optical thinning: heavier glyphs get a `-webkit-text-stroke`
 *      painted in the CARD/BACKGROUND colour behind them, which eats the edges
 *      and lightens the weight. The stroke width scales with font-size so the
 *      weight stays even from a 74px hero down to a 20px transit row.
 */

import type React from "react";

// U+FE0E = text-presentation selector. Required.
export const glyphChar = (cp: number): string => String.fromCodePoint(cp) + "\uFE0E";

// ── Code points ────────────────────────────────────────────────────────────
// [name, codePoint, element]
export const SIGNS: [string, number, GlyphElement][] = [
  ["Aries", 0x2648, "fire"], ["Taurus", 0x2649, "earth"], ["Gemini", 0x264a, "air"],
  ["Cancer", 0x264b, "water"], ["Leo", 0x264c, "fire"], ["Virgo", 0x264d, "earth"],
  ["Libra", 0x264e, "air"], ["Scorpio", 0x264f, "water"], ["Sagittarius", 0x2650, "fire"],
  ["Capricorn", 0x2651, "earth"], ["Aquarius", 0x2652, "air"], ["Pisces", 0x2653, "water"],
];

export const PLANETS: [string, number, GlyphElement][] = [
  ["Sun", 0x2609, "fire"], ["Moon", 0x263d, "water"], ["Mercury", 0x263f, "air"],
  ["Venus", 0x2640, "water"], ["Mars", 0x2642, "fire"], ["Jupiter", 0x2643, "earth"],
  ["Saturn", 0x2644, "earth"], ["Uranus", 0x2645, "air"], ["Neptune", 0x2646, "water"],
  // NB: Pluto is U+2BD3 (circle-in-crescent over cross), NOT U+2647 (the "PL" monogram).
  ["Pluto", 0x2bd3, "earth"],
  ["Chiron", 0x26b7, "water"], // ⚷ — the wounded healer; element by convention
  ["North Node", 0x260a, "air"], ["South Node", 0x260b, "air"], // ☊ ☋ — nodes; neutral tint
  ["Ceres", 0x26b3, "earth"], ["Pallas", 0x26b4, "air"], ["Juno", 0x26b5, "water"], ["Vesta", 0x26b6, "fire"],
];

export const ASPECTS: [string, number, GlyphElement][] = [
  ["Conjunction", 0x260c, "earth"], ["Sextile", 0x26b9, "air"], ["Square", 0x25a1, "fire"],
  ["Trine", 0x25b3, "water"], ["Opposition", 0x260d, "fire"],
];

export type GlyphElement = "fire" | "earth" | "air" | "water";

// Fast lookups: name → { cp, element }
export const GLYPH_INDEX: Record<string, { cp: number; element: GlyphElement }> = Object.fromEntries(
  [...SIGNS, ...PLANETS, ...ASPECTS].map(([name, cp, element]) => [name, { cp, element }]),
);

// ── Faces ──────────────────────────────────────────────────────────────────
// Both loaded from Google Fonts in index.html. Venus is the ONE glyph pulled
// from Symbols 1 (its crossbar is proportioned; Symbols 2's is stubby).
export const FACE = {
  default: "'Noto Sans Symbols 2', sans-serif",
  venus: "'Noto Sans Symbols', sans-serif",
};
export const fontFor = (name: string): string => (name === "Venus" ? FACE.venus : FACE.default);

// ── Optical thinning ─────────────────────────────────────────────────────────
// Fraction of the em painted back as a background-coloured stroke. 0 = untouched.
// strokePx = thin * fontSizePx.  Tuned by eye — nudge these, don't recompute.
export const THIN: Record<string, number> = {
  Sun: 0.011, Moon: 0, Mercury: 0.019, Venus: 0.010, Mars: 0.010,
  Jupiter: 0.015, Saturn: 0.023, Uranus: 0.012, Neptune: 0.019, Pluto: 0.012,
  Virgo: 0.011, Libra: 0.011, Scorpio: 0.011, // only the naturally heavy signs
  Conjunction: 0.017, Opposition: 0.014,
};
export const thinFor = (name: string): number => THIN[name] || 0;

// ── Element colours per theme ────────────────────────────────────────────────
// fire = red-orange · earth = green · air = yellow · water = blue.
// App mapping: light theme → "tide", dark theme → "observatory" (glow on).
export type GlyphTheme = "tide" | "almanac" | "observatory" | "minimal";
export const GLYPH_ELEMENT_COLORS: Record<GlyphTheme, Record<GlyphElement, string>> = {
  tide: { fire: "#C2613E", earth: "#5E9A52", air: "#CBA13C", water: "#3F8493" },
  almanac: { fire: "#A2503A", earth: "#6E7355", air: "#B28A2E", water: "#3E6C82" },
  observatory: { fire: "#FF7A59", earth: "#5FC98A", air: "#F2C94C", water: "#46C2E6" },
  minimal: { fire: "#111111", earth: "#111111", air: "#111111", water: "#111111" },
};

/**
 * Inline style for one glyph.
 * @param bgColor  the colour BEHIND the glyph (card/cell bg) — the thinning
 *                 stroke is painted in this colour, so it MUST match or the
 *                 edges show as a halo. CSS variables are fine.
 */
export function glyphStyle(
  name: string,
  element: GlyphElement,
  fontSizePx: number,
  bgColor: string,
  theme: GlyphTheme = "tide",
  glow = false,
): React.CSSProperties {
  const color = GLYPH_ELEMENT_COLORS[theme][element];
  const thin = thinFor(name);
  const strokePx = thin > 0 ? (thin * fontSizePx).toFixed(2) : "0";
  return {
    fontFamily: fontFor(name),
    fontSize: `${fontSizePx}px`,
    lineHeight: 1,
    color,
    WebkitTextStroke: Number(strokePx) > 0 ? `${strokePx}px ${bgColor}` : "0px transparent",
    textShadow: glow ? "0 0 15px currentColor, 0 0 5px currentColor" : "none",
  };
}
