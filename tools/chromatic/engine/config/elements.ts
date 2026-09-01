// Elements describe the optical and material behavior of color — what the
// pigment is made of and how light moves through it — rather than adding hues
// of their own. Each element also pulls planet hues gently toward a
// temperature anchor.

import type { Element, ProfileDelta } from "../types";

export interface ElementVisualProfile {
  deltas: ProfileDelta;
  /** Hue anchor the element pulls toward, and how hard (0..1). */
  huePull: { h: number; amount: number };
  effects: string[];
  keywords: string[];
}

export const ELEMENT_PROFILES: Record<Element, ElementVisualProfile> = {
  fire: {
    deltas: { warmth: 0.5, luminosity: 0.4, saturation: 0.4, dynamism: 0.3 },
    huePull: { h: 45, amount: 0.2 },
    effects: ["heats and brightens the pigment so it advances toward the eye"],
    keywords: ["radiant", "hot", "vivid"],
  },
  earth: {
    deltas: { opacity: 0.5, materiality: 0.7, saturation: -0.2, luminosity: -0.15, structure: 0.2 },
    huePull: { h: 80, amount: 0.15 },
    effects: ["mutes the pigment toward stone, clay, and moss, and makes it opaque"],
    keywords: ["mineral", "opaque", "grounded"],
  },
  air: {
    deltas: { luminosity: 0.4, contrast: 0.4, opacity: -0.3, variation: 0.2, diffusion: -0.2 },
    huePull: { h: 215, amount: 0.15 },
    effects: ["clarifies and separates, keeping each color crisp against its neighbor"],
    keywords: ["clear", "crisp", "light"],
  },
  water: {
    deltas: { depth: 0.4, diffusion: 0.5, harmony: 0.2, saturation: -0.1, materiality: -0.2 },
    huePull: { h: 220, amount: 0.12 },
    effects: ["deepens and softens, letting colors flow into gradients and reflections"],
    keywords: ["fluid", "reflective", "submerged"],
  },
};
