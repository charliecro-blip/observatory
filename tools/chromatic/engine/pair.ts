// Assemble one PairScenario into a full ChromaticModel. This is the unit the
// playground studies; whole-chart generation later reduces a chart to a
// weighted set of these plus unaspected placements, then merges.

import type { ChromaticModel, Influence, PairScenario, Placement } from "./types";
import { combineInfluences, scaleDeltas } from "./combine";
import { PLANET_PROFILES } from "./config/planets";
import { ASPECT_PROFILES, aspectStrength } from "./config/aspects";
import { signDeltas } from "./config/signs";
import { DEFAULT_WEIGHTS, type EmphasisWeights } from "./config/weights";
import { generatePalette } from "./palette";
import { deriveComposition } from "./composition";
import { buildExplanation } from "./explain";
import { hashString, makeRng } from "./seed";

function placementInfluences(p: Placement, weights: EmphasisWeights): Influence[] {
  return [
    {
      source: `${p.planet} in ${p.sign}`,
      weight: p.weight,
      deltas: PLANET_PROFILES[p.planet].deltas,
    },
    {
      source: `${p.sign} (sign of ${p.planet})`,
      weight: p.weight * weights.signInfluence,
      deltas: signDeltas(p.sign),
    },
  ];
}

export function buildPairModel(
  scenario: PairScenario, weights: EmphasisWeights = DEFAULT_WEIGHTS,
): ChromaticModel {
  const strength = aspectStrength(scenario.aspect, scenario.orb);

  const influences: Influence[] = [
    ...placementInfluences(scenario.a, weights),
    ...placementInfluences(scenario.b, weights),
    {
      source: `${scenario.a.planet} ${scenario.aspect} ${scenario.b.planet}`,
      weight: strength * weights.aspectInfluence,
      deltas: scaleDeltas(ASPECT_PROFILES[scenario.aspect].deltas, 1),
    },
  ];

  const profile = combineInfluences(influences);
  // The seed is the pair's IDENTITY — planets, signs, aspect, variation.
  // Orb and weights deliberately stay out: they modulate the drawing
  // continuously (strength, chroma, pull), and putting them in the seed made
  // every slider nudge re-roll the whole layout.
  const seed = hashString(
    [
      scenario.a.planet, scenario.a.sign,
      scenario.b.planet, scenario.b.sign,
      scenario.aspect, scenario.variationSeed,
    ].join("|"),
  );
  const palette = generatePalette(scenario, profile, strength, makeRng(seed ^ 0x9e3779b9));
  const composition = deriveComposition(profile, scenario.aspect, strength);
  const explanation = buildExplanation(scenario, strength, palette, composition.dominantGeometry);

  return { profile, palette, composition, explanation, influences, aspectStrength: strength, seed };
}
