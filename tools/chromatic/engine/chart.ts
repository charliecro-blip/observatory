// Whole-chart phase: reduce a natal chart to weighted placements and ranked
// aspects, then reuse the pair machinery. The strongest aspect becomes the
// chart's defining chromatic relationship — it supplies the two lead pigments
// and the composition geometry — while EVERY placement and the top aspects
// feed the visual profile, so the whole chart tempers what the leading pair
// declares.
//
// This module is pure: it takes chart data as plain numbers and never touches
// the ephemeris. Chart calculation lives in the playground adapter (browser)
// or a CLI, both of which borrow the api-server's natal engine.

import {
  ASPECTS, PLANETS,
  type AspectName, type ChromaticModel, type Element, type Influence, type Planet, type Sign,
} from "./types";
import { combineInfluences } from "./combine";
import { PLANET_PROFILES } from "./config/planets";
import { ASPECT_PROFILES } from "./config/aspects";
import { SIGN_ELEMENT, SIGN_RULER_MODERN, signDeltas } from "./config/signs";
import { DEFAULT_WEIGHTS, type EmphasisWeights } from "./config/weights";
import { generatePalette } from "./palette";
import { deriveComposition } from "./composition";
import { buildExplanation } from "./explain";
import { hashString, makeRng } from "./seed";

export interface NatalPlanetInput {
  planet: Planet;
  sign: Sign;
  longitude: number;   // ecliptic degrees 0..360
  houseNumber: number; // 1..12
}

export interface NatalInput {
  planets: NatalPlanetInput[]; // the ten, Sun..Pluto
  ascendant: { sign: Sign; longitude: number };
  midheaven: { sign: Sign; longitude: number };
}

export interface WeightedPlacement {
  planet: Planet;
  sign: Sign;
  houseNumber: number;
  weight: number;    // raw emphasis weight
  effective: number; // after sharpening — what actually feeds the profile
  reasons: string[]; // "luminary", "angular (10th)", "chart ruler", "3 aspects"
}

export interface NatalAspect {
  a: Planet;
  b: Planet;
  aspect: AspectName;
  orb: number;
  strength: number; // 1 - orb/maxOrb
  score: number;    // strength × mean effective weight — the ranking key
}

export interface ChromaticChart {
  model: ChromaticModel;
  placements: WeightedPlacement[]; // sorted, heaviest first
  aspects: NatalAspect[];          // sorted, strongest score first
  defining: NatalAspect | null;
}

/** Angular separation of two longitudes, folded to 0..180. */
function separation(lonA: number, lonB: number): number {
  const d = Math.abs(lonA - lonB) % 360;
  return d > 180 ? 360 - d : d;
}

/** Find every major aspect among the given planets, using the config orbs. */
export function findNatalAspects(planets: NatalPlanetInput[]): Array<Omit<NatalAspect, "score">> {
  const out: Array<Omit<NatalAspect, "score">> = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const sep = separation(planets[i].longitude, planets[j].longitude);
      for (const name of ASPECTS) {
        const spec = ASPECT_PROFILES[name];
        const orb = Math.abs(sep - spec.angle);
        if (orb <= spec.maxOrb) {
          out.push({
            a: planets[i].planet, b: planets[j].planet,
            aspect: name, orb, strength: 1 - orb / spec.maxOrb,
          });
          break; // aspect bands don't overlap at these orbs
        }
      }
    }
  }
  return out;
}

export function weighPlacements(
  natal: NatalInput,
  aspects: Array<Omit<NatalAspect, "score">>,
  weights: EmphasisWeights = DEFAULT_WEIGHTS,
): WeightedPlacement[] {
  const ascRuler = SIGN_RULER_MODERN[natal.ascendant.sign];
  const aspectCounts = new Map<Planet, number>();
  for (const a of aspects) {
    aspectCounts.set(a.a, (aspectCounts.get(a.a) ?? 0) + 1);
    aspectCounts.set(a.b, (aspectCounts.get(a.b) ?? 0) + 1);
  }

  const placements = natal.planets.map((p) => {
    const reasons: string[] = [];
    let w = weights.base[p.planet];
    if (p.planet === "Sun" || p.planet === "Moon") reasons.push("luminary");
    if (weights.angularHouses.includes(p.houseNumber)) {
      w += weights.angularBonus;
      reasons.push(`angular (house ${p.houseNumber})`);
    }
    if (p.planet === ascRuler) {
      w += weights.ascRulerBonus;
      reasons.push(`chart ruler (${natal.ascendant.sign} rising)`);
    }
    const count = aspectCounts.get(p.planet) ?? 0;
    if (count > 0) {
      w += Math.min(weights.aspectCountBonusMax, count * weights.aspectCountBonus);
      reasons.push(`${count} aspect${count === 1 ? "" : "s"}`);
    }
    return { planet: p.planet, sign: p.sign, houseNumber: p.houseNumber, weight: w, effective: 0, reasons };
  });

  const max = Math.max(...placements.map((p) => p.weight));
  for (const p of placements) {
    p.effective = Math.pow(p.weight / max, weights.emphasisSharpness) * p.weight;
  }
  return placements.sort((x, y) => y.weight - x.weight);
}

export function buildChartModel(
  natal: NatalInput,
  variationSeed = 0,
  weights: EmphasisWeights = DEFAULT_WEIGHTS,
): ChromaticChart {
  const found = findNatalAspects(natal.planets);
  const placements = weighPlacements(natal, found, weights);
  const byPlanet = new Map(placements.map((p) => [p.planet, p]));

  const aspects: NatalAspect[] = found
    .map((a) => ({
      ...a,
      score: a.strength * ((byPlanet.get(a.a)!.effective + byPlanet.get(a.b)!.effective) / 2),
    }))
    .sort((x, y) => y.score - x.score);
  const defining = aspects[0] ?? null;

  // Profile: every placement plus the top-ranked aspects. Placement mass is
  // normalized to chartProfileMass so ten planets don't rail every axis —
  // emphasis decides who gets the mass, not how much mass there is.
  const totalEffective = placements.reduce((s, p) => s + p.effective, 0);
  const massScale = totalEffective > 0 ? weights.chartProfileMass / totalEffective : 0;
  const influences: Influence[] = [];
  for (const p of placements) {
    influences.push({
      source: `${p.planet} in ${p.sign}`,
      weight: p.effective * massScale,
      deltas: PLANET_PROFILES[p.planet].deltas,
    });
    influences.push({
      source: `${p.sign} (sign of ${p.planet})`,
      weight: p.effective * massScale * weights.signInfluence,
      deltas: signDeltas(p.sign),
    });
  }
  for (const a of aspects.slice(0, weights.chartAspectCount)) {
    influences.push({
      source: `${a.a} ${a.aspect} ${a.b}`,
      weight: a.strength * weights.chartAspectInfluence,
      deltas: ASPECT_PROFILES[a.aspect].deltas,
    });
  }
  const profile = combineInfluences(influences);

  // Palette and composition: driven by the defining relationship, tempered by
  // the whole-chart profile. With no aspect in orb anywhere (vanishingly
  // rare), fall back to the two heaviest placements at zero strength — the
  // hues barely relate and the geometry distributes, which is the honest
  // answer for such a chart.
  const [first, second] = placements;
  const scenario = defining
    ? {
        a: toPlacement(byPlanet.get(defining.a)!),
        b: toPlacement(byPlanet.get(defining.b)!),
        aspect: defining.aspect,
        orb: defining.orb,
        variationSeed,
      }
    : {
        a: toPlacement(first),
        b: toPlacement(second),
        aspect: "conjunction" as AspectName,
        orb: ASPECT_PROFILES.conjunction.maxOrb,
        variationSeed,
      };
  const strength = defining ? defining.strength : 0;

  const seed = hashString(
    natal.planets.map((p) => `${p.planet}:${p.longitude.toFixed(2)}:${p.houseNumber}`).join("|") +
    `|asc:${natal.ascendant.longitude.toFixed(2)}|v:${variationSeed}`,
  );
  const palette = generatePalette(scenario, profile, strength, makeRng(seed ^ 0x9e3779b9));
  const composition = deriveComposition(profile, scenario.aspect, strength);
  const explanation = buildExplanation(scenario, strength, palette, composition.dominantGeometry);

  // Whole-chart context on top of the pair-level explanation.
  explanation.dominantFactors = placements.slice(0, 4).map((p) => ({
    factor: `${p.planet} in ${p.sign}${p.reasons.length ? ` — ${p.reasons.join(", ")}` : ""}`,
    strength: p.weight,
    visualEffects: PLANET_PROFILES[p.planet].effects.slice(0, 2),
  })).concat(defining ? [{
    factor: `${defining.a} ${defining.aspect} ${defining.b} — the defining relationship`,
    strength: defining.strength,
    visualEffects: [ASPECT_PROFILES[defining.aspect].relationship],
  }] : []);

  const model: ChromaticModel = {
    profile, palette, composition, explanation, influences,
    aspectStrength: strength, seed,
  };
  return { model, placements, aspects, defining };
}

function toPlacement(p: WeightedPlacement): { planet: Planet; sign: Sign; weight: number } {
  return { planet: p.planet, sign: p.sign, weight: p.weight };
}

/** Guard for adapter code: keep only the ten planets the engine models. */
export function isEnginePlanet(name: string): name is Planet {
  return (PLANETS as readonly string[]).includes(name);
}

/**
 * The chart's element balance: each placement's weight credited to its
 * sign's element, normalized to shares that sum to 1.
 */
export function elementBalance(placements: WeightedPlacement[]): Record<Element, number> {
  const sums: Record<Element, number> = { fire: 0, earth: 0, air: 0, water: 0 };
  let total = 0;
  for (const p of placements) {
    sums[SIGN_ELEMENT[p.sign]] += p.weight;
    total += p.weight;
  }
  if (total > 0) {
    for (const el of Object.keys(sums) as Element[]) sums[el] /= total;
  }
  return sums;
}
