// Modalities shape composition: how color is organized in space and how it
// moves, more than which color appears.

import type { Modality, ProfileDelta } from "../types";

export interface ModalityVisualProfile {
  deltas: ProfileDelta;
  effects: string[];
  keywords: string[];
}

export const MODALITY_PROFILES: Record<Modality, ModalityVisualProfile> = {
  cardinal: {
    deltas: { dynamism: 0.5, structure: 0.3, contrast: 0.2, variation: -0.1 },
    effects: ["organizes the image into decisive directional blocks"],
    keywords: ["directional", "decisive", "blocked"],
  },
  fixed: {
    deltas: { saturation: 0.3, structure: 0.4, opacity: 0.3, dynamism: -0.3, variation: -0.3 },
    effects: ["consolidates color into large stable fields that hold their ground"],
    keywords: ["concentrated", "stable", "coherent"],
  },
  mutable: {
    deltas: { variation: 0.5, diffusion: 0.4, dynamism: 0.2, harmony: 0.1, structure: -0.3 },
    effects: ["dissolves boundaries into gradients and shifting transitions"],
    keywords: ["transitional", "blended", "shifting"],
  },
};
