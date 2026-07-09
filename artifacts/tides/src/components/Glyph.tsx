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
export default function Glyph({ name, size = 20, bg = "var(--color-card)", tint = true, style }: {
  name: string;              // "Saturn", "Pisces", "Trine", …
  size?: number;             // font-size px
  bg?: string;               // surface color behind the glyph (thinning stroke)
  tint?: boolean;            // false = inherit color from context instead of element tint
  style?: React.CSSProperties;
}) {
  const { theme } = useTheme();
  const entry = GLYPH_INDEX[name];
  if (!entry) return null;
  const glyphTheme: GlyphTheme = theme === "dark" ? "observatory" : "tide";
  const s = glyphStyle(name, entry.element, size, bg, glyphTheme, theme === "dark");
  if (!tint) { delete (s as Record<string, unknown>).color; delete (s as Record<string, unknown>).textShadow; }
  return <span style={{ ...s, ...style }}>{glyphChar(entry.cp)}</span>;
}
