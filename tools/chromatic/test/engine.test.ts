// Engine smoke test over the design doc's ten comparison pairs.
//
// Runs behind the opt-in tools config, never in the deploy gate:
//   npx vitest run --config vitest.tools.config.ts tools/chromatic
//
// Deterministic by construction — no live sky, no clock, no timezone.

import { describe, expect, it } from "vitest";
import type { PairScenario } from "../engine/types";
import { CANONICAL_PAIRS } from "../engine/canon";
import { buildPairModel } from "../engine/pair";
import { renderArtwork } from "../engine/render";
import { renderInterpretation } from "../engine/explain";
import { hueDelta } from "../engine/color";

const TEN: Array<[string, PairScenario]> = CANONICAL_PAIRS.map((c) => [c.title, c.scenario]);

describe("chromatic engine", () => {
  it("is deterministic: same scenario, same palette and artwork", () => {
    const s = TEN[2][1];
    const one = buildPairModel(s);
    const two = buildPairModel(s);
    expect(two.palette.map((c) => c.hex)).toEqual(one.palette.map((c) => c.hex));
    expect(renderArtwork(two)).toEqual(renderArtwork(one));
  });

  it("changes the artwork when only variationSeed changes", () => {
    const s = TEN[2][1];
    const varied = { ...s, variationSeed: 1 };
    expect(renderArtwork(buildPairModel(varied))).not.toEqual(renderArtwork(buildPairModel(s)));
  });

  it("keeps every profile axis in 0..1 and every color a valid hex", () => {
    for (const [, s] of TEN) {
      const m = buildPairModel(s);
      for (const v of Object.values(m.profile)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(m.palette.length).toBeGreaterThanOrEqual(5);
      expect(m.palette.length).toBeLessThanOrEqual(8);
      for (const c of m.palette) {
        expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(c.sources.length).toBeGreaterThan(0);
        expect(c.description.length).toBeGreaterThan(0);
      }
    }
  });

  it("positions hues by aspect: opposition ~complementary, square ~90°, trine analogous", () => {
    const sep = (s: PairScenario) => {
      const m = buildPairModel(s);
      const dom = m.palette.find((c) => c.role === "dominant")!;
      const sec = m.palette.find((c) => c.role === "secondary")!;
      return Math.abs(hueDelta(dom.oklch.h, sec.oklch.h));
    };
    expect(sep(TEN[2][1])).toBeGreaterThan(120); // Venus opposite Uranus
    expect(sep(TEN[5][1])).toBeGreaterThan(120); // Moon opposite Pluto
    const square = sep(TEN[1][1]); // Venus square Saturn
    expect(square).toBeGreaterThan(50);
    expect(square).toBeLessThan(130);
    expect(sep(TEN[4][1])).toBeLessThan(60); // Mars trine Neptune
    expect(sep(TEN[6][1])).toBeLessThan(60); // Sun trine Jupiter
  });

  it("gives hard and soft aspects different characters", () => {
    const venusSaturn = buildPairModel(TEN[1][1]).profile;
    const venusJupiter = buildPairModel(TEN[0][1]).profile;
    expect(venusSaturn.structure).toBeGreaterThan(venusJupiter.structure);
    expect(venusSaturn.harmony).toBeLessThan(venusJupiter.harmony);
    expect(venusSaturn.contrast).toBeGreaterThan(venusJupiter.contrast);

    const marsNeptune = buildPairModel(TEN[4][1]).profile;
    const marsSaturn = buildPairModel(TEN[3][1]).profile;
    expect(marsNeptune.diffusion).toBeGreaterThan(marsSaturn.diffusion);
    expect(marsSaturn.luminosity).toBeLessThan(marsNeptune.luminosity);
  });

  it("renders ten distinct dominant colors and geometries that follow the aspects", () => {
    const models = TEN.map(([, s]) => buildPairModel(s));
    const dominants = models.map((m) => m.palette.find((c) => c.role === "dominant")!.hex);
    expect(new Set(dominants).size).toBeGreaterThanOrEqual(8);
    expect(models[2].composition.dominantGeometry).toBe("polar");
    expect(models[1].composition.dominantGeometry).toBe("crossing");
    expect(models[4].composition.dominantGeometry).toBe("triadic");
    expect(models[3].composition.dominantGeometry).toBe("central");
  });

  it("writes interpretations in the target length band", () => {
    for (const [, s] of TEN) {
      const words = renderInterpretation(buildPairModel(s), s).split(/\s+/).length;
      expect(words).toBeGreaterThan(60);
      expect(words).toBeLessThan(280);
    }
  });

  it("prints the ten palettes for manual review", () => {
    for (const [title, s] of TEN) {
      const m = buildPairModel(s);
      const line = m.palette.map((c) => `${c.role}:${c.hex}`).join(" ");
      // eslint-disable-next-line no-console
      console.log(`${title.padEnd(26)} ${m.composition.dominantGeometry.padEnd(10)} ${line}`);
    }
  });
});
