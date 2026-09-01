// Chart-emphasis weights. Nothing here is metaphysically final — it is an
// experimental scoring system meant to be tuned from the playground and,
// later, from whole-chart results.

import type { Planet } from "../types";

export interface EmphasisWeights {
  base: Record<Planet, number>;
  ascRulerBonus: number;
  angularBonus: number;
  /** Houses whose occupants count as angular. */
  angularHouses: number[];
  /** Per qualifying natal aspect a planet participates in, and the cap. */
  aspectCountBonus: number;
  aspectCountBonusMax: number;
  /**
   * How hard chart emphasis concentrates on the top-weighted planets when a
   * whole chart feeds the profile. 1 = raw weights; higher values let the
   * leaders drown out the chorus. Effective weight = (w / max)^sharpness × w.
   */
  emphasisSharpness: number;
  /**
   * Total placement-influence mass a whole chart is normalized to before it
   * feeds the profile. Ten placements summed raw would rail every axis
   * through the tanh squash; normalizing to roughly a pair's mass (two
   * planets at ~1.3) keeps chart profiles on the same scale the pair
   * playground was tuned on.
   */
  chartProfileMass: number;
  /** How many ranked natal aspects feed the whole-chart profile. */
  chartAspectCount: number;
  /** Scale on those chart aspects' profile deltas. */
  chartAspectInfluence: number;
  /** How much the sign contributes relative to its planet (0..1). */
  signInfluence: number;
  /** How much the aspect's profile deltas count at full strength. */
  aspectInfluence: number;
  /**
   * Transiting-planet weights for Color Weather. Slow movers matter more:
   * a Moon transit is hours, a Pluto transit is a season.
   */
  transitPlanet: Record<Planet, number>;
  /** How many ranked transits actively modify the field. */
  transitCount: number;
  /** Scale on an active transit's profile influence. */
  transitInfluence: number;
  /** How many ranked cross-aspects feed a shared synastry field. */
  synastryAspectCount: number;
  /** Scale on a cross-aspect's profile influence in the shared field. */
  synastryInfluence: number;
}

export const DEFAULT_WEIGHTS: EmphasisWeights = {
  base: {
    Sun: 1.3,
    Moon: 1.3,
    Mercury: 1.15,
    Venus: 1.15,
    Mars: 1.15,
    Jupiter: 1.0,
    Saturn: 1.0,
    Uranus: 0.8,
    Neptune: 0.8,
    Pluto: 0.8,
  },
  ascRulerBonus: 0.4,
  angularBonus: 0.4,
  angularHouses: [1, 4, 7, 10],
  aspectCountBonus: 0.05,
  aspectCountBonusMax: 0.2,
  emphasisSharpness: 1.5,
  chartProfileMass: 2.6,
  chartAspectCount: 5,
  chartAspectInfluence: 0.6,
  signInfluence: 0.6,
  aspectInfluence: 1.0,
  transitPlanet: {
    Sun: 0.9,
    Moon: 0.5,
    Mercury: 0.7,
    Venus: 0.8,
    Mars: 1.0,
    Jupiter: 1.2,
    Saturn: 1.3,
    Uranus: 1.4,
    Neptune: 1.4,
    Pluto: 1.5,
  },
  transitCount: 3,
  transitInfluence: 0.5,
  synastryAspectCount: 4,
  synastryInfluence: 0.7,
};
