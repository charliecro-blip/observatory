// Social-card renderer: wraps the artwork in export-ready compositions.
// Three formats, per the design doc — Instagram square 1080×1080, portrait
// 1080×1350, story 1080×1920. Pure string-building like render.ts, so the
// same card is reproducible anywhere; rasterization to PNG happens in the
// page (canvas), not here.

import type { AspectName, ChromaticModel, Planet } from "./types";
import { renderArtwork } from "./render";

export const PLANET_GLYPHS: Record<Planet, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

export const ASPECT_GLYPHS: Record<AspectName, string> = {
  conjunction: "☌", opposition: "☍", square: "□",
  trine: "△", sextile: "⚹", quincunx: "⚻",
};

/** Short display line for a card, one per aspect. */
export const ASPECT_CARD_LINES: Record<AspectName, string> = {
  conjunction: "Both pour into one pigment.",
  opposition: "Each side makes the other more vivid.",
  square: "The friction carries the image.",
  trine: "The hues circulate.",
  sextile: "One color leads, one answers.",
  quincunx: "They share a frame without resolving.",
};

export type CardFormat = "square" | "portrait" | "story";

export const CARD_DIMENSIONS: Record<CardFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

export interface CardMeta {
  glyphs: string;   // "♀ □ ♅"
  title: string;    // "VENUS SQUARE URANUS" (rendered uppercase regardless)
  subtitle: string; // "The friction carries the image."
  label?: string;   // optional small line above the title (a name, a date)
}

const BAND_BG = "#101013";
const INK = "#e8e6e0";
const DIM = "#9a988f";
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Re-house the artwork's own <svg> as a nested element at the given frame. */
function placeArtwork(model: ChromaticModel, x: number, y: number, w: number, h: number): string {
  return renderArtwork(model, 1000, Math.round((h / w) * 1000)).replace(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox=`,
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox=`,
  );
}

function paletteStrip(model: ChromaticModel, x: number, y: number, w: number, h: number): string {
  const colors = model.palette;
  const each = w / colors.length;
  return colors.map((c, i) =>
    `<rect x="${(x + i * each).toFixed(1)}" y="${y}" width="${each.toFixed(1)}" height="${h}" fill="${c.hex}"/>`,
  ).join("");
}

interface TextSlots {
  label: number;
  glyphs: number;
  title: number;
  subtitle: number;
}

function textBlock(meta: CardMeta, model: ChromaticModel, cx: number, slots: TextSlots): string {
  const accent = model.palette.find((c) => c.role === "accent") ?? model.palette[1];
  const parts: string[] = [];
  if (meta.label) {
    parts.push(`<text x="${cx}" y="${slots.label}" text-anchor="middle" font-family="${FONT}" font-size="21" letter-spacing="4" fill="${DIM}">${escXml(meta.label.toUpperCase())}</text>`);
  }
  parts.push(`<text x="${cx}" y="${slots.glyphs}" text-anchor="middle" font-family="${FONT}" font-size="40" fill="${accent.hex}">${escXml(meta.glyphs)}</text>`);
  parts.push(`<text x="${cx}" y="${slots.title}" text-anchor="middle" font-family="${FONT}" font-size="38" font-weight="650" letter-spacing="8" fill="${INK}">${escXml(meta.title.toUpperCase())}</text>`);
  parts.push(`<text x="${cx}" y="${slots.subtitle}" text-anchor="middle" font-family="${FONT}" font-size="25" fill="${DIM}">${escXml(meta.subtitle)}</text>`);
  return parts.join("");
}

function brandMark(cx: number, y: number): string {
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="19" letter-spacing="6" fill="${DIM}" opacity="0.8">CHROMATIC</text>`;
}

export function renderSocialCard(model: ChromaticModel, meta: CardMeta, format: CardFormat): string {
  const { w, h } = CARD_DIMENSIONS[format];
  const parts: string[] = [`<rect width="${w}" height="${h}" fill="${BAND_BG}"/>`];

  if (format === "square") {
    // Full-bleed artwork, text over a bottom scrim.
    parts.push(placeArtwork(model, 0, 0, w, h));
    parts.push(`<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="55%" stop-color="${BAND_BG}" stop-opacity="0"/><stop offset="100%" stop-color="${BAND_BG}" stop-opacity="0.92"/></linearGradient>`);
    parts.push(`<rect width="${w}" height="${h}" fill="url(#scrim)"/>`);
    parts.push(textBlock(meta, model, w / 2, { label: 810, glyphs: 862, title: 920, subtitle: 960 }));
    parts.push(paletteStrip(model, w / 2 - 180, 998, 360, 9));
    parts.push(brandMark(w / 2, 1044));
  } else if (format === "portrait") {
    parts.push(placeArtwork(model, 0, 0, w, w));
    parts.push(textBlock(meta, model, w / 2, { label: 1122, glyphs: 1170, title: 1226, subtitle: 1263 }));
    parts.push(paletteStrip(model, w / 2 - 180, 1286, 360, 9));
    parts.push(brandMark(w / 2, 1328));
  } else {
    parts.push(placeArtwork(model, 0, 270, w, w));
    parts.push(textBlock(meta, model, w / 2, { label: 1462, glyphs: 1520, title: 1584, subtitle: 1630 }));
    parts.push(paletteStrip(model, w / 2 - 180, 1690, 360, 9));
    parts.push(brandMark(w / 2, 1780));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${parts.join("")}</svg>`;
}
