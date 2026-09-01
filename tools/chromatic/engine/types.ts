// Shared types for the chromatic engine.
//
// The engine is deliberately framework-free and dependency-free: chart math
// stays in the api-server ephemeris (imported the way materia does it), and
// everything here works from plain data so it can later move into tides or
// become its own package without dragging a UI along.

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;
export type Sign = (typeof SIGNS)[number];

export const PLANETS = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
] as const;
export type Planet = (typeof PLANETS)[number];

export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "cardinal" | "fixed" | "mutable";

export const ASPECTS = [
  "conjunction", "opposition", "square", "trine", "sextile", "quincunx",
] as const;
export type AspectName = (typeof ASPECTS)[number];

// ── Visual profile ───────────────────────────────────────────────────────────

export const PROFILE_AXES = [
  "warmth", "saturation", "luminosity", "contrast", "diffusion", "opacity",
  "materiality", "harmony", "dynamism", "structure", "variation", "depth",
] as const;
export type ProfileAxis = (typeof PROFILE_AXES)[number];

/** All axes normalized to 0..1. 0.5 is the neutral resting value. */
export type VisualProfile = Record<ProfileAxis, number>;

/** A contribution to the profile: signed deltas in roughly -1..+1 per axis. */
export type ProfileDelta = Partial<Record<ProfileAxis, number>>;

/** One weighted symbolic factor feeding the combination engine. */
export interface Influence {
  source: string;       // "Mars in Scorpio", "Venus square Uranus", "fixed emphasis"
  weight: number;       // chart-emphasis weight × aspect strength etc.
  deltas: ProfileDelta;
}

// ── Color ────────────────────────────────────────────────────────────────────

/** A color in OKLCH: l 0..1, c 0..~0.37, h degrees 0..360. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export type PaletteRole =
  | "background"
  | "dominant"
  | "secondary"
  | "structural"
  | "accent"
  | "highlight"
  | "disruptive"
  | "intermediary"
  | "weather"; // a transit's temporary pigment, entering the natal field

export interface PaletteColor {
  hex: string;
  oklch: Oklch;
  rgb: { r: number; g: number; b: number };
  role: PaletteRole;
  label: string;        // "Deep garnet"
  sources: string[];    // ["Mars angular", "Pluto square Venus"]
  description: string;  // "concentrated warm depth"
}

// ── Composition ──────────────────────────────────────────────────────────────

export type DominantGeometry =
  | "central"      // conjunction: overlap, fusion
  | "polar"        // opposition: two fields across an axis
  | "crossing"     // square: perpendicular boundaries, quadrants
  | "triadic"      // trine: three-part circulation
  | "patterned"    // sextile: repeating supportive motif
  | "asymmetric"   // quincunx: displaced regions
  | "distributed"; // fallback when no aspect leads

export interface CompositionModel {
  dominantGeometry: DominantGeometry;
  fieldCount: number;
  gradientStrength: number; // 0..1
  edgeSharpness: number;    // 0..1
  symmetry: number;         // 0..1
  movement: number;         // 0..1
  transparency: number;     // 0..1
  texture: number;          // 0..1
}

// ── Explanation ──────────────────────────────────────────────────────────────

export interface ChromaticExplanation {
  dominantFactors: {
    factor: string;
    strength: number;
    visualEffects: string[];
  }[];
  strongestAspect?: {
    planets: string[];
    aspect: AspectName;
    visualRelationship: string;
  };
  paletteStory: string[];
  compositionStory: string[];
  visualKeywords: string[];
}

// ── Scenario input (playground) ──────────────────────────────────────────────

/** A planet placed in a sign, with an explicit emphasis weight. */
export interface Placement {
  planet: Planet;
  sign: Sign;
  weight: number; // 1 = baseline; chart emphasis raises or lowers it
}

/**
 * The playground's unit of study: two placements in one aspect. Whole-chart
 * models later reduce to a weighted set of these plus unaspected placements.
 */
export interface PairScenario {
  a: Placement;
  b: Placement;
  aspect: AspectName;
  orb: number;          // degrees from exact
  variationSeed: number; // 0 = canonical rendering; bump to cycle variations
}

/** Everything the UI needs to show one scenario. */
export interface ChromaticModel {
  profile: VisualProfile;
  palette: PaletteColor[];
  composition: CompositionModel;
  explanation: ChromaticExplanation;
  influences: Influence[];
  aspectStrength: number; // 1 - orb/maxOrb, clamped to 0..1
  seed: number;
}
