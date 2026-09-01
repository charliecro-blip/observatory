// Aspects are the relational core of the grammar: they decide how two
// planetary color functions interact — hue spacing, geometry, and the shape
// of the contrast. Orbs are editable here; strength = 1 - orb/maxOrb.
//
// Standing principles from the design doc: an opposition is polarity and
// mutual intensification, never "bad colors"; a square is friction and often
// the most compelling output; a trine can go excessively smooth.

import type { AspectName, DominantGeometry, ProfileDelta } from "../types";

/** How the two planets' hues are positioned relative to each other. */
export type HueStrategy =
  | "fuse"       // conjunction: mix into one pigment
  | "complement" // opposition: pull toward 180° apart, both vivid
  | "clash"      // square: pull toward 90°, hard competing weight
  | "analogous"  // trine: pull toward ~30°, circulate
  | "accent"     // sextile: dominant + coordinated secondary at ~60°
  | "uncanny";   // quincunx: ~150°, deliberately mismatched chroma/lightness

export interface AspectVisualProfile {
  angle: number;
  maxOrb: number;
  deltas: ProfileDelta;
  hueStrategy: HueStrategy;
  /** Hue separation the aspect pulls the pair toward, degrees. */
  targetSeparation: number;
  geometry: DominantGeometry;
  /** One sentence for interpretation copy: the visual relationship. */
  relationship: string;
  keywords: string[];
}

export const ASPECT_PROFILES: Record<AspectName, AspectVisualProfile> = {
  conjunction: {
    angle: 0,
    maxOrb: 8,
    deltas: { harmony: 0.3, opacity: 0.2, depth: 0.2, contrast: -0.2 },
    hueStrategy: "fuse",
    targetSeparation: 0,
    geometry: "central",
    relationship: "Both functions pour into the same region and grind together into a single pigment.",
    keywords: ["fused", "dense", "integrated"],
  },
  opposition: {
    angle: 180,
    maxOrb: 8,
    deltas: { contrast: 0.6, saturation: 0.2, dynamism: 0.2 },
    hueStrategy: "complement",
    targetSeparation: 180,
    geometry: "polar",
    relationship: "Two fields face each other across an axis, and each one makes the other more vivid.",
    keywords: ["polar", "complementary", "intensified"],
  },
  square: {
    angle: 90,
    maxOrb: 7,
    deltas: { contrast: 0.7, structure: 0.4, dynamism: 0.5, harmony: -0.4, saturation: 0.2 },
    hueStrategy: "clash",
    targetSeparation: 90,
    geometry: "crossing",
    relationship: "The two colors cross at hard angles and compete for weight, and that friction is what gives the image its charge.",
    keywords: ["frictional", "crossed", "charged"],
  },
  trine: {
    angle: 120,
    maxOrb: 7,
    deltas: { harmony: 0.6, diffusion: 0.2, variation: 0.1, dynamism: 0.1, contrast: -0.3 },
    hueStrategy: "analogous",
    targetSeparation: 32,
    geometry: "triadic",
    relationship: "The hues sit close on the wheel and circulate, one field flowing into the next with almost no resistance.",
    keywords: ["circulating", "analogous", "fluent"],
  },
  sextile: {
    angle: 60,
    maxOrb: 5,
    deltas: { harmony: 0.3, contrast: 0.2, variation: 0.2, dynamism: 0.2 },
    hueStrategy: "accent",
    targetSeparation: 60,
    geometry: "patterned",
    relationship: "One color leads while the other returns as a deliberate accent that keeps answering it.",
    keywords: ["coordinated", "supportive", "accented"],
  },
  quincunx: {
    angle: 150,
    maxOrb: 3,
    deltas: { harmony: -0.5, variation: 0.4, contrast: 0.3, dynamism: 0.1, structure: -0.1 },
    hueStrategy: "uncanny",
    targetSeparation: 150,
    geometry: "asymmetric",
    relationship: "The two colors come from systems that never agreed on terms, and they share the frame without resolving.",
    keywords: ["uncanny", "displaced", "unresolved"],
  },
};

export function aspectStrength(aspect: AspectName, orb: number): number {
  const max = ASPECT_PROFILES[aspect].maxOrb;
  return Math.max(0, Math.min(1, 1 - orb / max));
}

/**
 * Transit orbs run much tighter than natal orbs: a transit is weather, and
 * weather is only weather while it is close.
 */
export const TRANSIT_MAX_ORBS: Record<AspectName, number> = {
  conjunction: 3,
  opposition: 3,
  square: 2.5,
  trine: 2.5,
  sextile: 2,
  quincunx: 1.5,
};
