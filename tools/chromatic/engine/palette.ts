// Palette generation. Hues come from planetary pigment modulated by sign;
// the RELATIONSHIP between hues comes from the aspect (this is the load-
// bearing idea — an opposition must read complementary, a trine analogous, a
// quincunx uncannily mismatched); chroma and lightness come from the combined
// VisualProfile. Every color records where it came from.

import type {
  Oklch, PaletteColor, PaletteRole, PairScenario, Placement, VisualProfile,
} from "./types";
import { clampToGamut, hueDelta, mixHue, normHue, oklchToHex, oklchToRgb } from "./color";
import { PLANET_PROFILES, type HueCandidate } from "./config/planets";
import { ELEMENT_PROFILES } from "./config/elements";
import { ASPECT_PROFILES } from "./config/aspects";
import { SIGN_ELEMENT, SIGN_MODIFIERS } from "./config/signs";
import type { Rng } from "./seed";

interface Pigment {
  h: number;
  c: number;
  l: number;
  name: string;
  source: string;
}

export interface ResolvedPigment {
  h: number;
  c: number;
  l: number;
  name: string;
  source: string;
}

/** One specific hue candidate of a planet, tinted by the sign it sits in. */
export function pigmentFromCandidate(p: Placement, candidate: HueCandidate): ResolvedPigment {
  const sign = SIGN_MODIFIERS[p.sign];
  const el = ELEMENT_PROFILES[SIGN_ELEMENT[p.sign]];
  let h = mixHue(candidate.h, sign.tint.h, sign.tint.amount);
  h = mixHue(h, el.huePull.h, el.huePull.amount);
  return {
    h,
    c: candidate.c,
    l: candidate.l,
    name: candidate.name,
    source: `${p.planet} in ${p.sign}`,
  };
}

/** A placement's pigment: planet hue candidate tinted by its sign. */
export function resolvePigment(p: Placement, rng: Rng): Pigment {
  return pigmentFromCandidate(p, weightedPick(PLANET_PROFILES[p.planet].hues, rng));
}

/** The chroma/lightness modulation the combined profile applies to pigment. */
export function profileModulation(profile: VisualProfile): { cScale: number; lShift: number } {
  let cScale = 0.35 + 1.3 * profile.saturation;
  cScale *= 1 - 0.45 * Math.max(0, profile.materiality - 0.5) * 2; // earth mutes pigment
  cScale *= 1 - 0.2 * Math.max(0, profile.diffusion - 0.5) * 2;   // diffusion thins it
  const lShift = (profile.luminosity - 0.5) * 0.3 - (profile.depth - 0.5) * 0.22;
  return { cScale, lShift };
}

function weightedPick(candidates: HueCandidate[], rng: Rng): HueCandidate {
  const total = candidates.reduce((s, c) => s + c.w, 0);
  let roll = rng() * total;
  for (const c of candidates) {
    roll -= c.w;
    if (roll <= 0) return c;
  }
  return candidates[0];
}

/**
 * Apply the aspect's hue strategy: keep the heavier placement's hue as anchor
 * and pull the other toward the aspect's target separation, proportional to
 * aspect strength. Returns adjusted pigments plus the fused hue when relevant.
 */
function relateHues(
  a: Pigment, b: Pigment, scenario: PairScenario, strength: number,
): { a: Pigment; b: Pigment; fused: number } {
  const spec = ASPECT_PROFILES[scenario.aspect];
  const wA = scenario.a.weight;
  const wB = scenario.b.weight;
  const anchorFirst = wA >= wB;
  const anchor = anchorFirst ? a : b;
  const mover = anchorFirst ? b : a;
  const fused = mixHue(a.h, b.h, wB / (wA + wB));

  // The relationship stays legible even when the orb is wide: a loose trine
  // still reads analogous, it just stops being exact. Strength sharpens the
  // pull rather than gating it.
  const pull = 0.55 + 0.45 * strength;
  let moved = { ...mover };
  if (spec.hueStrategy === "fuse") {
    moved.h = mixHue(mover.h, fused, pull);
    const anchored = { ...anchor, h: mixHue(anchor.h, fused, pull) };
    return anchorFirst ? { a: anchored, b: moved, fused } : { a: moved, b: anchored, fused };
  }
  // Pull the mover toward the target separation on whichever side it already
  // leans, so Venus square Uranus lands at 90° without teleporting across the wheel.
  const side = hueDelta(anchor.h, mover.h) >= 0 ? 1 : -1;
  const target = normHue(anchor.h + side * spec.targetSeparation);
  moved.h = mixHue(mover.h, target, pull);
  if (spec.hueStrategy === "uncanny") {
    // Deliberate mismatch: push the mover's lightness away from the anchor's.
    moved.l = clamp01(moved.l + (moved.l >= anchor.l ? 0.16 : -0.16));
    moved.c = Math.max(0.03, moved.c * 0.8);
  }
  if (spec.hueStrategy === "complement" || spec.hueStrategy === "clash") {
    // Mutual intensification: both poles gain chroma as the aspect tightens.
    moved.c *= 1 + 0.25 * strength;
    anchor.c *= 1 + 0.25 * strength;
  }
  return anchorFirst ? { a: anchor, b: moved, fused } : { a: moved, b: anchor, fused };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ── Naming ───────────────────────────────────────────────────────────────────

const HUE_NAMES: Array<[number, string]> = [
  [12, "crimson"], [34, "scarlet"], [55, "rust"], [78, "amber"], [102, "gold"],
  [128, "chartreuse"], [158, "green"], [188, "teal"], [215, "cyan"], [255, "blue"],
  [292, "indigo"], [318, "violet"], [344, "magenta"], [361, "rose"],
];

function hueName(color: Oklch): string {
  if (color.c < 0.025) {
    return color.l < 0.3 ? "charcoal" : color.l > 0.85 ? "chalk" : "gray";
  }
  const h = normHue(color.h);
  for (const [limit, name] of HUE_NAMES) if (h < limit) return name;
  return "rose";
}

function toneWord(color: Oklch): string {
  if (color.c >= 0.025 && color.l < 0.34) return "deep ";
  if (color.l > 0.88) return "pale ";
  if (color.c > 0.16) return "vivid ";
  if (color.c < 0.06 && color.c >= 0.025) return "muted ";
  return "";
}

export function labelFor(color: Oklch): string {
  const raw = `${toneWord(color)}${hueName(color)}`;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ── Palette assembly ─────────────────────────────────────────────────────────

function make(
  role: PaletteRole, color: Oklch, sources: string[], description: string,
): PaletteColor {
  const clamped = clampToGamut(color);
  return {
    role,
    oklch: clamped,
    hex: oklchToHex(clamped),
    rgb: oklchToRgb(clamped),
    label: labelFor(clamped),
    sources,
    description,
  };
}

export function generatePalette(
  scenario: PairScenario, profile: VisualProfile, strength: number, rng: Rng,
): PaletteColor[] {
  const spec = ASPECT_PROFILES[scenario.aspect];
  const rawA = resolvePigment(scenario.a, rng);
  const rawB = resolvePigment(scenario.b, rng);
  const { a, b, fused } = relateHues(rawA, rawB, scenario, strength);

  // Profile-driven modulation shared by every color.
  const sat = profile.saturation;
  const lum = profile.luminosity;
  const dep = profile.depth;
  const { cScale, lShift } = profileModulation(profile);

  const aspectSource = `${scenario.a.planet} ${scenario.aspect} ${scenario.b.planet} (orb ${scenario.orb.toFixed(1)}°)`;
  const colors: PaletteColor[] = [];

  // Background: sets the ground the fields sit on. Depth sinks it, luminosity lifts it.
  const bgL = clamp01(0.55 + (lum - 0.5) * 0.95 - (dep - 0.5) * 0.85);
  const bgHue = spec.hueStrategy === "fuse" ? fused : mixHue(a.h, b.h, 0.5);
  const warmPull = (profile.warmth - 0.5) * 0.3;
  colors.push(make(
    "background",
    { l: bgL, c: 0.015 + 0.035 * sat, h: mixHue(bgHue, profile.warmth >= 0.5 ? 60 : 245, Math.abs(warmPull)) },
    [aspectSource],
    dep > 0.62 ? "a dark ground the fields rise out of" : lum > 0.62 ? "a lit ground that keeps the fields afloat" : "a quiet ground between the two fields",
  ));

  // Dominant and secondary: the two placements themselves.
  const heavier = scenario.a.weight >= scenario.b.weight;
  const domP = heavier ? a : b;
  const secP = heavier ? b : a;
  const domPl = heavier ? scenario.a : scenario.b;
  const secPl = heavier ? scenario.b : scenario.a;
  colors.push(make(
    "dominant",
    { l: clamp01(domP.l + lShift), c: domP.c * cScale, h: domP.h },
    [domP.source, aspectSource],
    `${domPl.planet}'s ${domP.name}, carrying the most weight in the pair`,
  ));
  colors.push(make(
    "secondary",
    { l: clamp01(secP.l + lShift * 0.8), c: secP.c * cScale, h: secP.h },
    [secP.source, aspectSource],
    secondaryDescription(spec.hueStrategy, secPl.planet, secP.name),
  ));

  // Structural: dark, desaturated framing — earned by structure or depth.
  if (profile.structure > 0.45 || dep > 0.6) {
    colors.push(make(
      "structural",
      { l: clamp01(0.27 - (dep - 0.5) * 0.2), c: 0.015 + 0.05 * profile.structure, h: mixHue(domP.h, 270, 0.3) },
      [profile.structure > 0.45 ? "structural emphasis" : "depth emphasis"],
      "the framing dark that holds the boundaries",
    ));
  }

  // Accent: where the aspect concentrates.
  colors.push(make("accent", accentColor(spec.hueStrategy, domP, secP, fused, cScale, strength), [aspectSource], accentDescription(spec.hueStrategy)));

  // Luminous highlight when the field is bright enough to break open.
  if (lum > 0.62) {
    colors.push(make(
      "highlight",
      { l: 0.95, c: 0.035, h: profile.warmth >= 0.5 ? 88 : 235 },
      ["luminosity emphasis"],
      "the point where the field goes to light",
    ));
  }

  // Disruptive accent: Uranus in the pair, or hard-aspect contrast.
  const hasUranus = scenario.a.planet === "Uranus" || scenario.b.planet === "Uranus";
  if (hasUranus || ((scenario.aspect === "square" || scenario.aspect === "quincunx") && profile.contrast > 0.65)) {
    const uHue = hasUranus ? 205 : normHue(domP.h + 180 + 30);
    colors.push(make(
      "disruptive",
      { l: 0.72, c: 0.19, h: uHue },
      [hasUranus ? "Uranus in the pair" : aspectSource],
      "the interruption the rest of the palette has to answer",
    ));
  }

  // Intermediary: only where the relationship actually blends.
  if (profile.harmony > 0.58 || spec.hueStrategy === "analogous" || spec.hueStrategy === "fuse") {
    colors.push(make(
      "intermediary",
      { l: clamp01((domP.l + secP.l) / 2 + lShift), c: ((domP.c + secP.c) / 2) * cScale * 0.85, h: mixHue(domP.h, secP.h, 0.5) },
      [domP.source, secP.source],
      "the tone the two pigments make where they meet",
    ));
  }

  return colors;
}

function secondaryDescription(strategy: string, planet: string, pigmentName: string): string {
  switch (strategy) {
    case "fuse": return `${planet}'s ${pigmentName}, ground into the dominant pigment`;
    case "complement": return `${planet}'s ${pigmentName}, pulled opposite so both poles intensify`;
    case "clash": return `${planet}'s ${pigmentName}, set at cross angles to the dominant`;
    case "analogous": return `${planet}'s ${pigmentName}, drawn alongside so the hues circulate`;
    case "accent": return `${planet}'s ${pigmentName}, coordinated as the answering color`;
    default: return `${planet}'s ${pigmentName}, from a different system than the dominant`;
  }
}

function accentColor(
  strategy: string, dom: Pigment, sec: Pigment, fused: number, cScale: number, strength: number,
): Oklch {
  const c = Math.min(0.24, (Math.max(dom.c, sec.c) * cScale) * (1.15 + 0.3 * strength));
  switch (strategy) {
    case "fuse": return { l: clamp01(dom.l * 0.8), c, h: fused };
    case "complement": return { l: 0.6, c, h: normHue(dom.h + 180) };
    case "clash": return { l: 0.58, c, h: normHue(hueDelta(dom.h, sec.h) >= 0 ? dom.h - 90 : dom.h + 90) };
    case "analogous": return { l: 0.62, c: c * 0.85, h: normHue(dom.h + 2 * hueDelta(dom.h, sec.h)) };
    case "accent": return { l: 0.62, c, h: sec.h };
    default: return { l: clamp01(sec.l - 0.2), c: c * 0.9, h: normHue(sec.h + 20) };
  }
}

function accentDescription(strategy: string): string {
  switch (strategy) {
    case "fuse": return "the fused pigment at its most concentrated";
    case "complement": return "the exact complement, placed to make the dominant ring";
    case "clash": return "a third pressure that keeps the crossing from settling";
    case "analogous": return "the run of hues extended one step further";
    case "accent": return "the supporting color at full strength";
    default: return "a tone that belongs to neither system";
  }
}
