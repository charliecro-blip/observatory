// Social-card renderer smoke tests: dimensions, content, determinism.

import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "../engine/config/weights";
import { buildPairModel } from "../engine/pair";
import {
  ASPECT_CARD_LINES, ASPECT_GLYPHS, CARD_DIMENSIONS, PLANET_GLYPHS, renderSocialCard,
} from "../engine/social";
import type { CardFormat, CardMeta } from "../engine/social";

const MODEL = buildPairModel({
  a: { planet: "Venus", sign: "Taurus", weight: DEFAULT_WEIGHTS.base.Venus },
  b: { planet: "Uranus", sign: "Scorpio", weight: DEFAULT_WEIGHTS.base.Uranus },
  aspect: "opposition", orb: 1.5, variationSeed: 0,
});

const META: CardMeta = {
  glyphs: `${PLANET_GLYPHS.Venus} ${ASPECT_GLYPHS.opposition} ${PLANET_GLYPHS.Uranus}`,
  title: "Venus opposition Uranus",
  subtitle: ASPECT_CARD_LINES.opposition,
  label: "Sample",
};

describe("social cards", () => {
  it("renders each format at its exact export dimensions", () => {
    for (const format of Object.keys(CARD_DIMENSIONS) as CardFormat[]) {
      const { w, h } = CARD_DIMENSIONS[format];
      const svg = renderSocialCard(MODEL, META, format);
      expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`)).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
    }
  });

  it("carries the title, subtitle, label, glyphs, and full palette strip", () => {
    const svg = renderSocialCard(MODEL, META, "portrait");
    expect(svg).toContain("VENUS OPPOSITION URANUS");
    expect(svg).toContain(ASPECT_CARD_LINES.opposition);
    expect(svg).toContain("SAMPLE");
    expect(svg).toContain(ASPECT_GLYPHS.opposition);
    for (const c of MODEL.palette) expect(svg).toContain(c.hex);
  });

  it("is deterministic and escapes markup in text", () => {
    expect(renderSocialCard(MODEL, META, "story")).toEqual(renderSocialCard(MODEL, META, "story"));
    const svg = renderSocialCard(MODEL, { ...META, title: 'a<b>&"c' }, "square");
    expect(svg).toContain("A&lt;B&gt;&amp;&quot;C");
  });
});
