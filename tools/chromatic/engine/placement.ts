// A single placement, rendered alone: the planet's portrait in a sign.
// No aspect exists here, so nothing relates hues — the planet's own two
// leading pigments carry the image, the sign tints and behaves through them,
// and the MODALITY organizes the frame (cardinal blocks, fixed consolidates,
// mutable disperses). This is the unit under all the pair and chart work, and
// being able to stare at it alone is how the planet configs get argued with.

import type { ChromaticModel, Influence, Oklch, PaletteColor, Placement } from "./types";
import { combineInfluences } from "./combine";
import { PLANET_PROFILES } from "./config/planets";
import { ELEMENT_PROFILES } from "./config/elements";
import { MODALITY_PROFILES } from "./config/modalities";
import { SIGN_ELEMENT, SIGN_MODALITY, SIGN_MODIFIERS, signDeltas } from "./config/signs";
import { DEFAULT_WEIGHTS, type EmphasisWeights } from "./config/weights";
import { labelFor, pigmentFromCandidate, profileModulation } from "./palette";
import { derivePlacementComposition } from "./composition";
import { clampToGamut, mixHue, normHue, oklchToHex, oklchToRgb } from "./color";
import { hashString } from "./seed";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function make(role: PaletteColor["role"], color: Oklch, sources: string[], description: string): PaletteColor {
  const clamped = clampToGamut(color);
  return {
    role, oklch: clamped,
    hex: oklchToHex(clamped), rgb: oklchToRgb(clamped),
    label: labelFor(clamped), sources, description,
  };
}

const MODALITY_STORY = {
  cardinal: "The pigment organizes into decisive directional blocks.",
  fixed: "The pigment consolidates into one held mass.",
  mutable: "The pigment disperses into shifting fields.",
} as const;

export function buildPlacementModel(
  placement: Placement, variationSeed = 0, weights: EmphasisWeights = DEFAULT_WEIGHTS,
): ChromaticModel {
  const { planet, sign } = placement;
  const planetCfg = PLANET_PROFILES[planet];
  const element = SIGN_ELEMENT[sign];
  const modality = SIGN_MODALITY[sign];

  const influences: Influence[] = [
    { source: `${planet} in ${sign}`, weight: placement.weight, deltas: planetCfg.deltas },
    { source: `${sign} (sign of ${planet})`, weight: placement.weight * weights.signInfluence, deltas: signDeltas(sign) },
  ];
  const profile = combineInfluences(influences);
  const seed = hashString([planet, sign, "solo", variationSeed].join("|"));

  // The planet's two leading faces, sign-tinted; everything else derives.
  const primary = pigmentFromCandidate(placement, planetCfg.hues[0]);
  const counter = pigmentFromCandidate(placement, planetCfg.hues[Math.min(1, planetCfg.hues.length - 1)]);
  const { cScale, lShift } = profileModulation(profile);
  const source = `${planet} in ${sign}`;

  const palette: PaletteColor[] = [];
  const bgL = clamp01(0.55 + (profile.luminosity - 0.5) * 0.95 - (profile.depth - 0.5) * 0.85);
  palette.push(make(
    "background",
    { l: bgL, c: 0.015 + 0.035 * profile.saturation, h: primary.h },
    [source],
    "the ground the planet's field sits on",
  ));
  palette.push(make(
    "dominant",
    { l: clamp01(primary.l + lShift), c: primary.c * cScale, h: primary.h },
    [source],
    `${planet}'s ${primary.name}, the leading pigment`,
  ));
  palette.push(make(
    "secondary",
    { l: clamp01(counter.l + lShift * 0.8), c: counter.c * cScale, h: counter.h },
    [source],
    `${planet}'s ${counter.name}, the counter-tone from the same planet`,
  ));
  if (profile.structure > 0.45 || profile.depth > 0.6) {
    palette.push(make(
      "structural",
      { l: clamp01(0.27 - (profile.depth - 0.5) * 0.2), c: 0.015 + 0.05 * profile.structure, h: normHue(primary.h + 20) },
      [profile.structure > 0.45 ? "structural emphasis" : "depth emphasis"],
      "the framing dark that holds the boundaries",
    ));
  }
  palette.push(make(
    "accent",
    { l: 0.6, c: Math.min(0.24, primary.c * cScale * 1.3), h: primary.h },
    [source],
    "the leading pigment at full concentration",
  ));
  if (profile.luminosity > 0.62) {
    palette.push(make(
      "highlight",
      { l: 0.95, c: 0.035, h: profile.warmth >= 0.5 ? 88 : 235 },
      ["luminosity emphasis"],
      "the point where the field goes to light",
    ));
  }
  if (profile.harmony > 0.58) {
    palette.push(make(
      "intermediary",
      { l: clamp01((primary.l + counter.l) / 2 + lShift), c: ((primary.c + counter.c) / 2) * cScale * 0.85, h: mixHue(primary.h, counter.h, 0.5) },
      [source],
      "the tone the two faces make between them",
    ));
  }

  const composition = derivePlacementComposition(profile, modality);
  const keywords = new Set<string>([
    ...planetCfg.keywords,
    ELEMENT_PROFILES[element].keywords[0],
    MODALITY_PROFILES[modality].keywords[0],
  ]);

  return {
    profile,
    palette,
    composition,
    explanation: {
      dominantFactors: [{
        factor: `${planet} in ${sign}`,
        strength: placement.weight,
        visualEffects: [...planetCfg.effects, ELEMENT_PROFILES[element].effects[0]],
      }],
      paletteStory: palette.map((c) => `${c.label} ${c.hex} (${c.role}): ${c.description}.`),
      compositionStory: [MODALITY_STORY[modality]],
      visualKeywords: [...keywords].slice(0, 8),
    },
    influences,
    aspectStrength: 0,
    seed,
  };
}

const clause = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The single-placement interpretation: planet, sign behavior, palette. */
export function renderPlacementInterpretation(model: ChromaticModel, placement: Placement): string {
  const { planet, sign } = placement;
  const planetCfg = PLANET_PROFILES[planet];
  const element = SIGN_ELEMENT[sign];
  const modality = SIGN_MODALITY[sign];

  const p1 = `On its own, ${planet} ${clause(planetCfg.effects[0])}, and it ${clause(planetCfg.effects[1] ?? planetCfg.effects[0])}. In ${sign}, its pigment is ${SIGN_MODIFIERS[sign].phrase}.`;
  const p2 = `The sign behaves through its element and mode: ${element} ${clause(ELEMENT_PROFILES[element].effects[0])}, and the ${modality} mode ${clause(MODALITY_PROFILES[modality].effects[0])}.`;

  const dom = model.palette.find((c) => c.role === "dominant");
  const sec = model.palette.find((c) => c.role === "secondary");
  const bits = [model.explanation.compositionStory[0]];
  if (dom) bits.push(`${dom.label} (${dom.hex}) leads as ${dom.description}.`);
  if (sec) bits.push(`${sec.label} (${sec.hex}) is ${sec.description}.`);
  return [p1, p2, bits.join(" ")].join("\n\n");
}
