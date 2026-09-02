// Signs are calculated, never looked up: element behavior + modality behavior
// + a small sign-specific modifier. The modifier is deliberately light — it is
// flavor on top of the element/modality math, so Aries stays "cardinal fire
// with a red lean" rather than becoming a fixed red swatch.

import type { ProfileDelta, Sign, Element, Modality, Planet } from "../types";
import { ELEMENT_PROFILES } from "./elements";
import { MODALITY_PROFILES } from "./modalities";

export const SIGN_ELEMENT: Record<Sign, Element> = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

// Rulership tables — the chart-emphasis ASC-ruler bonus picks one via
// weights.rulershipMode. Modern is the default because the synthesis engine
// elsewhere in this repo is explicitly modern/tropical; traditional is the
// table materia uses for sect. Neither is baked into the ontology.
export const SIGN_RULER_MODERN: Record<Sign, Planet> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Pluto",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Uranus", Pisces: "Neptune",
};

export const SIGN_RULER_TRADITIONAL: Record<Sign, Planet> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

export const SIGN_MODALITY: Record<Sign, Modality> = {
  Aries: "cardinal", Cancer: "cardinal", Libra: "cardinal", Capricorn: "cardinal",
  Taurus: "fixed", Leo: "fixed", Scorpio: "fixed", Aquarius: "fixed",
  Gemini: "mutable", Virgo: "mutable", Sagittarius: "mutable", Pisces: "mutable",
};

export interface SignModifier {
  deltas: ProfileDelta;
  /** Hue the sign tints planet pigment toward, and how hard (0..1). */
  tint: { h: number; amount: number };
  /** One clause for interpretation copy: what the sign does to a planet's color. */
  phrase: string;
}

export const SIGN_MODIFIERS: Record<Sign, SignModifier> = {
  Aries:       { deltas: { contrast: 0.1 },                 tint: { h: 27,  amount: 0.35 }, phrase: "cut into sharp, forward red-leaning blocks" },
  Taurus:      { deltas: { materiality: 0.15 },             tint: { h: 95,  amount: 0.3 },  phrase: "thickened into moss, ochre, and rose pigment" },
  Gemini:      { deltas: { variation: 0.15 },               tint: { h: 200, amount: 0.25 }, phrase: "split into quick small-scale contrasts" },
  Cancer:      { deltas: { diffusion: 0.1, luminosity: 0.1 }, tint: { h: 240, amount: 0.25 }, phrase: "given a pearl surface and tidal gradients" },
  Leo:         { deltas: { luminosity: 0.15 },              tint: { h: 75,  amount: 0.35 }, phrase: "gathered into one radiant gold-orange field" },
  Virgo:       { deltas: { variation: 0.1, saturation: -0.1 }, tint: { h: 115, amount: 0.3 },  phrase: "refined into fine-grained botanical variation" },
  Libra:       { deltas: { harmony: 0.15 },                 tint: { h: 350, amount: 0.2 },  phrase: "balanced into clean, deliberate contrast" },
  Scorpio:     { deltas: { depth: 0.2 },                    tint: { h: 358, amount: 0.3 },  phrase: "darkened toward burgundy and black-violet" },
  Sagittarius: { deltas: { dynamism: 0.15 },                tint: { h: 315, amount: 0.25 }, phrase: "flung outward in vivid purple-orange mixture" },
  Capricorn:   { deltas: { structure: 0.2, saturation: -0.1 }, tint: { h: 270, amount: 0.2 },  phrase: "carved into charcoal, bone, and slate geometry" },
  Aquarius:    { deltas: { contrast: 0.15 },                tint: { h: 220, amount: 0.3 },  phrase: "held in cool, stable optical contrast" },
  Pisces:      { deltas: { diffusion: 0.2, opacity: -0.1 }, tint: { h: 285, amount: 0.25 }, phrase: "dissolved into iridescent, edgeless washes" },
};

/** Full computed profile deltas for a sign: element + modality + modifier. */
export function signDeltas(sign: Sign): ProfileDelta {
  const el = ELEMENT_PROFILES[SIGN_ELEMENT[sign]].deltas;
  const mo = MODALITY_PROFILES[SIGN_MODALITY[sign]].deltas;
  const mod = SIGN_MODIFIERS[sign].deltas;
  const out: ProfileDelta = {};
  for (const d of [el, mo, mod]) {
    for (const [axis, v] of Object.entries(d)) {
      out[axis as keyof ProfileDelta] = (out[axis as keyof ProfileDelta] ?? 0) + (v as number);
    }
  }
  return out;
}
