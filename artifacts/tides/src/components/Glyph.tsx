import React from "react";
import { useTheme } from "@/contexts/theme-context";
import { GLYPH_INDEX, glyphChar, glyphStyle, type GlyphTheme } from "@/lib/celestialGlyphs";

/**
 * One celestial glyph, rendered per the design handoff: real type from the
 * Noto symbol faces, element-tinted, optically thinned against the surface
 * behind it. App theme → glyph theme: light = "tide", dark = "observatory"
 * (dark glyphs glow).
 *
 * `bg` must be the color of the surface directly behind the glyph — the
 * thinning stroke is painted in it (CSS variables are fine). Defaults to the
 * card color, which is where most glyphs live.
 */
export default function Glyph({ name, size = 20, bg = "var(--color-card)", tint = true, label, style }: {
  name: string;              // "Saturn", "Pisces", "Trine", …
  size?: number;             // font-size px
  bg?: string;               // surface color behind the glyph (thinning stroke)
  tint?: boolean;            // false = inherit color from context instead of element tint
  /**
   * Set this ONLY where the glyph is the sole carrier of the meaning — a chip
   * reading "♄ day", an aspect row drawn entirely in symbols. A screen reader
   * then announces it as an image by this name.
   *
   * Left unset the glyph is decorative and hidden from assistive tech, which
   * is right wherever the word is already written beside it: without that,
   * "♄ Saturn" was read out as a raw symbol followed by the name it repeats.
   */
  label?: string;
  style?: React.CSSProperties;
}) {
  const { theme } = useTheme();
  const entry = GLYPH_INDEX[name];
  if (!entry) return null;
  const glyphTheme: GlyphTheme = theme === "dark" ? "observatory" : "tide";
  const s = glyphStyle(name, entry.element, size, bg, glyphTheme, theme === "dark");
  if (!tint) { delete (s as Record<string, unknown>).color; delete (s as Record<string, unknown>).textShadow; }
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true };
  return <span {...a11y} style={{ ...s, ...style }}>{glyphChar(entry.cp)}</span>;
}
