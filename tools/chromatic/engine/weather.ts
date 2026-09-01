// Color Weather: the natal chart is the persistent chromatic field, and
// transits are temporary modifications of it. The natal model is built first,
// today's sky is scored against it, and the strongest few transits push the
// profile, tint the palette with one arriving pigment, and enter the artwork
// from outside the frame. Same determinism rules as everything else: the same
// natal chart and the same sky always draw the same weather.
//
// Pure module — transit positions come in as plain longitudes; the ephemeris
// stays in the adapter.

import {
  ASPECTS,
  type AspectName, type ChromaticModel, type Influence, type PaletteColor,
  type Planet, type ProfileAxis, type Sign, type VisualProfile, PROFILE_AXES,
} from "./types";
import { buildChartModel, type ChromaticChart, type NatalInput } from "./chart";
import { combineInfluences } from "./combine";
import { PLANET_PROFILES } from "./config/planets";
import { ASPECT_PROFILES, TRANSIT_MAX_ORBS } from "./config/aspects";
import { DEFAULT_WEIGHTS, type EmphasisWeights } from "./config/weights";
import { generatePalette, labelFor, resolvePigment } from "./palette";
import { deriveComposition } from "./composition";
import { clampToGamut, hueDelta, mixHue, normHue, oklchToHex, oklchToRgb } from "./color";
import { hashString, makeRng } from "./seed";

export interface TransitPosition {
  planet: Planet;
  sign: Sign;
  longitude: number;
}

export interface TransitAspect {
  transiting: Planet;
  transitingSign: Sign;
  natal: Planet;
  natalSign: Sign;
  aspect: AspectName;
  orb: number;
  strength: number; // 1 - orb/transitMaxOrb
  score: number;    // strength × transiting-planet weight × natal effective weight
}

export interface ProfileShift {
  axis: ProfileAxis;
  from: number;
  to: number;
}

export interface ColorWeather {
  base: ChromaticChart;
  transits: TransitAspect[]; // everything in orb, ranked
  active: TransitAspect[];   // the few that actually modify the field
  model: ChromaticModel;     // the modified model
  shifts: ProfileShift[];    // largest profile moves vs the natal baseline
  lines: string[];           // one interpretation line per active transit
}

function separation(lonA: number, lonB: number): number {
  const d = Math.abs(lonA - lonB) % 360;
  return d > 180 ? 360 - d : d;
}

export function findTransitAspects(
  natal: NatalInput, positions: TransitPosition[],
): Array<Omit<TransitAspect, "score">> {
  const out: Array<Omit<TransitAspect, "score">> = [];
  for (const t of positions) {
    for (const n of natal.planets) {
      const sep = separation(t.longitude, n.longitude);
      for (const name of ASPECTS) {
        const maxOrb = TRANSIT_MAX_ORBS[name];
        const orb = Math.abs(sep - ASPECT_PROFILES[name].angle);
        if (orb <= maxOrb) {
          out.push({
            transiting: t.planet, transitingSign: t.sign,
            natal: n.planet, natalSign: n.sign,
            aspect: name, orb, strength: 1 - orb / maxOrb,
          });
          break;
        }
      }
    }
  }
  return out;
}

// Copy pieces for the weather lines: how the transit meets the natal tone.
const ASPECT_VERBS: Record<AspectName, string> = {
  conjunction: "sits on",
  opposition: "faces",
  square: "squares",
  trine: "trines",
  sextile: "sextiles",
  quincunx: "sits at odds with",
};

const ASPECT_MEETS: Record<AspectName, string> = {
  conjunction: "poured straight into",
  opposition: "facing",
  square: "cutting across",
  trine: "flowing with",
  sextile: "answering",
  quincunx: "unresolved against",
};

const clause = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function buildColorWeather(
  natal: NatalInput,
  positions: TransitPosition[],
  weights: EmphasisWeights = DEFAULT_WEIGHTS,
): ColorWeather {
  const base = buildChartModel(natal, 0, weights);
  const byPlanet = new Map(base.placements.map((p) => [p.planet, p]));

  const transits: TransitAspect[] = findTransitAspects(natal, positions)
    .map((t) => ({
      ...t,
      score: t.strength * weights.transitPlanet[t.transiting] * byPlanet.get(t.natal)!.effective,
    }))
    .sort((a, b) => b.score - a.score);
  const active = transits.slice(0, weights.transitCount);

  // Modified profile: the natal influence set plus the active transits.
  const influences: Influence[] = [...base.model.influences];
  for (const t of active) {
    const w = t.strength * weights.transitPlanet[t.transiting] * weights.transitInfluence;
    influences.push({
      source: `transiting ${t.transiting} ${t.aspect} natal ${t.natal}`,
      weight: w,
      deltas: PLANET_PROFILES[t.transiting].deltas,
    });
    influences.push({
      source: `transiting ${t.transiting} ${t.aspect} natal ${t.natal} (relation)`,
      weight: w * 0.5,
      deltas: ASPECT_PROFILES[t.aspect].deltas,
    });
  }
  const profile = combineInfluences(influences);

  // Seed folds the sky in, so different days draw different weather while the
  // natal field underneath stays put.
  const skyKey = positions.map((p) => `${p.planet}:${p.longitude.toFixed(1)}`).join("|");
  const seed = hashString(`${base.model.seed}|weather|${skyKey}`);

  // Palette: same natal hue skeleton, re-modulated by today's profile, plus
  // one arriving pigment from the top transit.
  const defining = base.defining;
  const scenario = defining
    ? {
        a: toPlacement(byPlanet.get(defining.a)!),
        b: toPlacement(byPlanet.get(defining.b)!),
        aspect: defining.aspect, orb: defining.orb, variationSeed: 0,
      }
    : {
        a: toPlacement(base.placements[0]),
        b: toPlacement(base.placements[1]),
        aspect: "conjunction" as AspectName, orb: ASPECT_PROFILES.conjunction.maxOrb, variationSeed: 0,
      };
  const strength = defining ? defining.strength : 0;
  const rng = makeRng(seed ^ 0x9e3779b9);
  const palette = generatePalette(scenario, profile, strength, rng);
  const top = active[0];
  if (top) palette.push(weatherColor(top, palette, rng));

  const composition = deriveComposition(profile, scenario.aspect, strength);

  const lines = active.map((t) => {
    const tCfg = PLANET_PROFILES[t.transiting];
    return `Transiting ${t.transiting} ${ASPECT_VERBS[t.aspect]} your natal ${t.natal} ` +
      `(orb ${t.orb.toFixed(1)}°): it ${clause(tCfg.effects[0])}, ${ASPECT_MEETS[t.aspect]} the ${t.natal} tones your field is built on.`;
  });

  const shifts = (PROFILE_AXES as readonly ProfileAxis[])
    .map((axis) => ({ axis, from: base.model.profile[axis], to: profile[axis] }))
    .filter((s) => Math.abs(s.to - s.from) >= 0.02)
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
    .slice(0, 5);

  const model: ChromaticModel = {
    profile,
    palette,
    composition,
    explanation: {
      ...base.model.explanation,
      compositionStory: [
        ...base.model.explanation.compositionStory,
        ...(top ? [`Today's sky enters from the edge of the frame as ${palette[palette.length - 1].label.toLowerCase()}.`] : []),
      ],
    },
    influences,
    aspectStrength: strength,
    seed,
  };

  return { base, transits, active, model, shifts, lines };
}

function toPlacement(p: { planet: Planet; sign: Sign; weight: number }): { planet: Planet; sign: Sign; weight: number } {
  return { planet: p.planet, sign: p.sign, weight: p.weight };
}

/** The arriving pigment: the transiting planet's color, related to the natal dominant by the aspect. */
function weatherColor(t: TransitAspect, palette: PaletteColor[], rng: () => number): PaletteColor {
  const pigment = resolvePigment({ planet: t.transiting, sign: t.transitingSign, weight: 1 }, rng);
  const dom = palette.find((c) => c.role === "dominant") ?? palette[0];
  const spec = ASPECT_PROFILES[t.aspect];
  const side = hueDelta(dom.oklch.h, pigment.h) >= 0 ? 1 : -1;
  const target = normHue(dom.oklch.h + side * spec.targetSeparation);
  const pull = 0.55 + 0.45 * t.strength;
  const color = clampToGamut({
    l: pigment.l,
    c: Math.min(0.22, pigment.c * (1 + 0.3 * t.strength)),
    h: mixHue(pigment.h, target, pull),
  });
  return {
    role: "weather",
    oklch: color,
    hex: oklchToHex(color),
    rgb: oklchToRgb(color),
    label: labelFor(color),
    sources: [`transiting ${t.transiting} ${t.aspect} natal ${t.natal} (orb ${t.orb.toFixed(1)}°)`],
    description: `today's arriving pigment, ${ASPECT_MEETS[t.aspect]} the dominant`,
  };
}
