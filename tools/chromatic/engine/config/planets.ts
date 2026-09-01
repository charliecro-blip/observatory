// Planetary visual profiles. Planets are chromatic FUNCTIONS, not fixed
// colors: each one carries profile deltas (how it bends the visual field) and
// hue candidates (where its pigment tends to live when it does contribute
// hue). Palette generation modulates both by sign, aspect, and weight, so no
// planet ever maps to a single hex.
//
// Everything here is meant to be argued with and edited. Deltas sit in
// roughly -1..+1 and are squashed downstream, so a value of 0.8 reads as
// "this is most of what the planet does visually," 0.2 as a side effect.

import type { Planet, ProfileDelta } from "../types";

export interface HueCandidate {
  name: string;  // "scarlet", "pearl" — used in color labels
  h: number;     // OKLCH hue, degrees
  c: number;     // chroma tendency (0..~0.3), before profile modulation
  l: number;     // lightness tendency (0..1), before profile modulation
  w: number;     // relative weight among this planet's candidates
}

export interface PlanetVisualProfile {
  deltas: ProfileDelta;
  hues: HueCandidate[];
  /** Short present-tense clauses describing what the planet does to the image. */
  effects: string[];
  keywords: string[];
}

export const PLANET_PROFILES: Record<Planet, PlanetVisualProfile> = {
  Sun: {
    deltas: { luminosity: 0.8, warmth: 0.6, harmony: 0.2, contrast: 0.2, opacity: 0.1 },
    hues: [
      { name: "gold", h: 88, c: 0.15, l: 0.78, w: 3 },
      { name: "warm white", h: 90, c: 0.05, l: 0.94, w: 1.5 },
      { name: "amber", h: 72, c: 0.16, l: 0.72, w: 1 },
    ],
    effects: [
      "raises the light level of the whole field",
      "warms whatever it touches toward gold",
      "pulls the composition toward a single center",
    ],
    keywords: ["radiant", "central", "warm"],
  },
  Moon: {
    deltas: { luminosity: 0.4, diffusion: 0.4, saturation: -0.4, opacity: -0.3, variation: 0.2, harmony: 0.2, warmth: -0.2 },
    hues: [
      { name: "pearl", h: 240, c: 0.02, l: 0.9, w: 3 },
      { name: "cream", h: 90, c: 0.045, l: 0.92, w: 2 },
      { name: "silver", h: 250, c: 0.015, l: 0.78, w: 1.5 },
    ],
    effects: [
      "lowers saturation toward pearl and silver",
      "makes surfaces read as reflective rather than pigmented",
      "softens the edges of neighboring fields",
    ],
    keywords: ["reflective", "soft", "changeable"],
  },
  Mercury: {
    deltas: { variation: 0.9, contrast: 0.3, dynamism: 0.4, luminosity: 0.2, materiality: -0.2 },
    hues: [
      { name: "chartreuse", h: 125, c: 0.12, l: 0.76, w: 2 },
      { name: "sky", h: 205, c: 0.1, l: 0.76, w: 2 },
      { name: "ochre", h: 72, c: 0.1, l: 0.72, w: 1.5 },
    ],
    effects: [
      "multiplies small contrasts instead of committing to one hue",
      "introduces pattern and quick transitions",
    ],
    keywords: ["variegated", "quick", "patterned"],
  },
  Venus: {
    deltas: { harmony: 0.9, diffusion: 0.2, luminosity: 0.2, saturation: 0.1, warmth: 0.1 },
    hues: [
      { name: "rose", h: 356, c: 0.09, l: 0.78, w: 3 },
      { name: "soft green", h: 145, c: 0.07, l: 0.8, w: 2 },
      { name: "blush", h: 20, c: 0.06, l: 0.85, w: 1 },
    ],
    effects: [
      "coordinates the palette so neighboring hues agree",
      "smooths the transitions between fields",
    ],
    keywords: ["harmonious", "proportioned", "blended"],
  },
  Mars: {
    deltas: { warmth: 0.7, saturation: 0.8, contrast: 0.3, dynamism: 0.7, opacity: 0.2, structure: 0.1 },
    hues: [
      { name: "scarlet", h: 28, c: 0.2, l: 0.55, w: 3 },
      { name: "crimson", h: 16, c: 0.19, l: 0.48, w: 2 },
      { name: "rust", h: 48, c: 0.13, l: 0.5, w: 1.5 },
    ],
    effects: [
      "drives saturation up and the temperature with it",
      "sharpens boundaries into cuts",
    ],
    keywords: ["hot", "saturated", "penetrating"],
  },
  Jupiter: {
    deltas: { saturation: 0.5, depth: 0.3, harmony: 0.3, luminosity: 0.2, variation: 0.2, warmth: 0.1 },
    hues: [
      { name: "royal blue", h: 262, c: 0.16, l: 0.5, w: 3 },
      { name: "violet", h: 300, c: 0.14, l: 0.5, w: 2 },
      { name: "emerald", h: 155, c: 0.13, l: 0.55, w: 1 },
    ],
    effects: [
      "widens the palette toward saturated jewel tones",
      "expands whatever field it lands in",
    ],
    keywords: ["abundant", "rich", "expansive"],
  },
  Saturn: {
    deltas: { luminosity: -0.5, saturation: -0.25, structure: 0.9, depth: 0.5, materiality: 0.4, opacity: 0.4, warmth: -0.3, dynamism: -0.4 },
    hues: [
      { name: "charcoal", h: 270, c: 0.015, l: 0.3, w: 3 },
      { name: "indigo", h: 278, c: 0.06, l: 0.35, w: 2 },
      { name: "umber", h: 60, c: 0.045, l: 0.35, w: 1.5 },
      { name: "lead", h: 250, c: 0.012, l: 0.52, w: 1 },
    ],
    effects: [
      "darkens and desaturates the field",
      "draws firm boundaries and holds them",
      "gives surfaces mineral weight",
    ],
    keywords: ["restrained", "bounded", "heavy"],
  },
  Uranus: {
    deltas: { contrast: 0.8, variation: 0.5, dynamism: 0.5, saturation: 0.4, harmony: -0.5, warmth: -0.4, structure: -0.2 },
    hues: [
      { name: "cyan", h: 205, c: 0.15, l: 0.74, w: 3 },
      { name: "electric blue", h: 240, c: 0.2, l: 0.62, w: 2 },
      { name: "fluorescent green", h: 132, c: 0.21, l: 0.84, w: 1 },
    ],
    effects: [
      "interrupts the palette with an electric accent",
      "forces contrast exactly where blending was about to happen",
    ],
    keywords: ["electric", "disruptive", "sudden"],
  },
  Neptune: {
    deltas: { diffusion: 0.9, opacity: -0.6, structure: -0.4, variation: 0.3, harmony: 0.2, luminosity: 0.2, depth: 0.2, saturation: -0.2 },
    hues: [
      { name: "sea green", h: 180, c: 0.07, l: 0.74, w: 3 },
      { name: "violet mist", h: 295, c: 0.07, l: 0.76, w: 2 },
      { name: "pale blue", h: 230, c: 0.05, l: 0.85, w: 1.5 },
    ],
    effects: [
      "dissolves edges into gradient",
      "thins the pigment toward transparency and iridescence",
    ],
    keywords: ["diffuse", "translucent", "dissolving"],
  },
  Pluto: {
    deltas: { depth: 0.8, luminosity: -0.6, saturation: 0.4, contrast: 0.4, opacity: 0.4, structure: 0.2, warmth: 0.1, diffusion: -0.2 },
    hues: [
      { name: "black-red", h: 20, c: 0.1, l: 0.26, w: 3 },
      { name: "burgundy", h: 5, c: 0.12, l: 0.32, w: 2 },
      { name: "black-violet", h: 310, c: 0.09, l: 0.25, w: 1.5 },
    ],
    effects: [
      "concentrates color until it approaches black without losing saturation",
      "deepens the darkest fields past where Saturn would stop",
    ],
    keywords: ["concentrated", "extreme", "deep"],
  },
};
