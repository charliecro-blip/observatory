// The canonical ten: the design doc's success-test pairs, each in signs that
// can actually form the aspect. One definition — the playground gallery, the
// engine tests, the shareable gallery page, and the golden baselines all read
// from here, so the canon cannot drift between its consumers.

import type { PairScenario, Planet, Sign, AspectName } from "./types";
import { DEFAULT_WEIGHTS } from "./config/weights";

export interface CanonicalCase {
  slug: string;
  title: string;
  scenario: PairScenario;
}

const cases: Array<[string, Planet, Sign, Planet, Sign, AspectName, number]> = [
  ["Venus conjunct Jupiter", "Venus", "Pisces", "Jupiter", "Pisces", "conjunction", 1.2],
  ["Venus square Saturn", "Venus", "Libra", "Saturn", "Capricorn", "square", 2.0],
  ["Venus opposite Uranus", "Venus", "Taurus", "Uranus", "Scorpio", "opposition", 1.5],
  ["Mars conjunct Saturn", "Mars", "Capricorn", "Saturn", "Capricorn", "conjunction", 0.8],
  ["Mars trine Neptune", "Mars", "Scorpio", "Neptune", "Pisces", "trine", 2.0],
  ["Moon opposite Pluto", "Moon", "Cancer", "Pluto", "Capricorn", "opposition", 1.0],
  ["Sun trine Jupiter", "Sun", "Leo", "Jupiter", "Sagittarius", "trine", 3.0],
  ["Mercury conjunct Uranus", "Mercury", "Aquarius", "Uranus", "Aquarius", "conjunction", 1.0],
  ["Saturn conjunct Neptune", "Saturn", "Pisces", "Neptune", "Pisces", "conjunction", 1.5],
  ["Jupiter square Pluto", "Jupiter", "Aries", "Pluto", "Capricorn", "square", 2.0],
];

export const CANONICAL_PAIRS: CanonicalCase[] = cases.map(
  ([title, aPlanet, aSign, bPlanet, bSign, aspect, orb]) => ({
    slug: title.toLowerCase().replace(/ /g, "-"),
    title,
    scenario: {
      a: { planet: aPlanet, sign: aSign, weight: DEFAULT_WEIGHTS.base[aPlanet] },
      b: { planet: bPlanet, sign: bSign, weight: DEFAULT_WEIGHTS.base[bPlanet] },
      aspect, orb, variationSeed: 0,
    },
  }),
);
