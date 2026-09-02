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
// Self-hosted subsets (index.css). Coverage is split between the two Noto
// faces and the stack falls through PER CHARACTER: Symbols 2 holds the Sun
// (U+2609) and Pluto (U+2BD3); Symbols 1 holds the other planets, the signs
// and the aspect marks. Measured 2026-08-21 against the actual cmaps — the
// stack used to end at Symbols 2 and every other glyph came from the system.
// Venus is pulled from Symbols 1 first (its crossbar is proportioned;
// Symbols 2's is stubby).
export const FACE = {
  default: "'Noto Sans Symbols 2', 'Noto Sans Symbols', sans-serif",
  venus: "'Noto Sans Symbols', 'Noto Sans Symbols 2', sans-serif",
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
// ── Optical centering ───────────────────────────────────────────────────────
// Where each glyph's INK sits against the 1em box it is laid out in, measured
// 2026-08-21 from the faces' own metrics and a canvas ink scan at 100px:
// Symbols 1 puts its baseline at 0.955em (ascent 1480 / descent 570 on a
// 1000 upem), so its marks ride ~0.1em LOW in a line-height-1 box; Symbols 2
// (1069 / 630) puts the baseline at 0.72em and the Sun and Pluto ride
// ~0.13em HIGH. A flex-centred circle centres the box, not the ink, which is
// why nothing sat centred (owner 2026-08-21). Values are em, applied as a
// transform so layout is untouched; negative lifts the glyph.
const NUDGE_EM: Record<string, number> = {
  // Symbols 2
  Sun: 0.146, Pluto: 0.106,
  // Symbols 1 — measured
  Moon: -0.095, Mercury: -0.095, Venus: -0.12, Mars: -0.18, Jupiter: -0.095, Saturn: -0.065,
  Uranus: -0.095, Neptune: -0.125, Aries: -0.085, Leo: -0.205, Scorpio: -0.185, Pisces: -0.07,
  Conjunction: -0.08, Trine: -0.085,
};
const NUDGE_DEFAULT_S1 = -0.09;
export const nudgeFor = (name: string): number =>
  NUDGE_EM[name] ?? (name === "Sun" || name === "Pluto" ? 0.125 : NUDGE_DEFAULT_S1);

export function glyphStyle(
  name: string,
  element: GlyphElement,
  fontSizePx: number,
  bgColor: string,
  theme: GlyphTheme = "tide",
  glow = false,
): React.CSSProperties {
  const color = GLYPH_ELEMENT_COLORS[theme][element];
  /**
   * OPTICAL THINNING IS A LARGE-GLYPH CORRECTION.
   *
   * The stroke is painted in the SURFACE colour to shave weight off a symbol
   * that reads too heavy. At display sizes that is a refinement; at 12px the
   * amounts here come out at two or three tenths of a pixel of background
   * laid over a stroke that is only a pixel or so to begin with, so it stops
   * refining the shape and starts eating it. The rail's aspect rows draw at
   * 12px, and that is where "planetary aspect glyphs are too light to be
   * legible" was looking (owner, 2026-08-31).
   *
   * Below the floor the glyph is simply left alone. The table above is
   * unchanged — it is correctly tuned for the sizes it was tuned at.
   */
  const THIN_FLOOR_PX = 15;
  const thin = fontSizePx >= THIN_FLOOR_PX ? thinFor(name) : 0;
  const strokePx = thin > 0 ? (thin * fontSizePx).toFixed(2) : "0";
  const nudge = nudgeFor(name);
  return {
    fontFamily: fontFor(name),
    fontSize: `${fontSizePx}px`,
    lineHeight: 1,
    display: "inline-block",
    transform: nudge ? `translateY(${nudge.toFixed(3)}em)` : undefined,
    color,
    WebkitTextStroke: Number(strokePx) > 0 ? `${strokePx}px ${bgColor}` : "0px transparent",
    textShadow: glow ? "0 0 15px currentColor, 0 0 5px currentColor" : "none",
  };
}
