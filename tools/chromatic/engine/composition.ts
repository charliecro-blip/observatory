// CompositionModel: how the palette occupies space. Geometry comes from the
// leading aspect; the continuous parameters come from the combined profile.

import type { AspectName, CompositionModel, DominantGeometry, Modality, VisualProfile } from "./types";
import { ASPECT_PROFILES } from "./config/aspects";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The continuous composition parameters every geometry shares. */
function compositionParams(profile: VisualProfile): Omit<CompositionModel, "dominantGeometry"> {
  return {
    fieldCount: Math.round(2 + profile.variation * 4),
    gradientStrength: clamp01(profile.diffusion * 0.8 + (1 - profile.opacity) * 0.3),
    edgeSharpness: clamp01(profile.structure * 0.55 + profile.contrast * 0.45 - profile.diffusion * 0.5 + 0.15),
    symmetry: clamp01(profile.harmony * 0.6 + profile.structure * 0.3 - profile.variation * 0.25),
    movement: clamp01(profile.dynamism),
    transparency: clamp01(1 - profile.opacity),
    texture: clamp01(profile.materiality * 0.6 + profile.variation * 0.35),
  };
}

export function deriveComposition(
  profile: VisualProfile, aspect: AspectName, strength: number,
): CompositionModel {
  return {
    // Below ~30% strength the aspect stops organizing the frame and the
    // fields just distribute.
    dominantGeometry: strength > 0.3 ? ASPECT_PROFILES[aspect].geometry : "distributed",
    ...compositionParams(profile),
  };
}

/**
 * A single placement has no aspect to organize it, so its modality does:
 * cardinal blocks, fixed consolidates, mutable disperses.
 */
const MODALITY_GEOMETRY: Record<Modality, DominantGeometry> = {
  cardinal: "crossing",
  fixed: "central",
  mutable: "distributed",
};

export function derivePlacementComposition(
  profile: VisualProfile, modality: Modality,
): CompositionModel {
  return { dominantGeometry: MODALITY_GEOMETRY[modality], ...compositionParams(profile) };
}
