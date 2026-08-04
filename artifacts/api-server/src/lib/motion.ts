import { getPlanetPositions, sunLongitude, moonLongitude, SIGNS } from "./astro.js";

/**
 * PLANETARY MOTION — direction, phase and speed as one measured object.
 *
 * The engine previously asked only `isRetrograde()`, which samples two
 * longitudes a day apart and throws the magnitude away. That binary hides the
 * two things that actually matter:
 *
 *  - a STATION is not the same as a smooth mid-retrograde, and traditionally
 *    carries the most weight of any motion state;
 *  - SPEED is a condition in its own right, and the same planet moving fast or
 *    slow suits different work.
 *
 * A correction worth recording, because this module was nearly built on the
 * opposite assumption: modern interpretive astrology often treats a station as
 * a concentration of power, but the traditional electional sources do not.
 * Bonatti distinguishes the first station (turning retrograde — reversal,
 * obstruction, failure to complete) from the second (turning direct — recovery
 * beginning, but not yet full strength). Neither is celebratory. The phase
 * names below are deliberately neutral so the interpretation layer can say
 * what each one means rather than having "powerful" baked into the data.
 *
 * PROVENANCE MATTERS HERE. `phase` is inherited doctrine — direct, retrograde
 * and the two stations are classical categories. `speedBand` and any matching
 * of speed to an activity's tempo is COMPASS SYNTHESIS: Lilly scores swift
 * motion as fortifying and slow as weakening, full stop. The idea that slow
 * motion positively suits revision is ours, and must never be presented as
 * inherited.
 */

export type MotionPhase =
  | "stationing-retrograde"   // first station: about to turn
  | "retrograde"
  | "stationing-direct"       // second station: about to resume
  | "direct";

export type SpeedBand = "very-slow" | "slow" | "normal" | "fast";

export interface PlanetMotion {
  planet: string;
  /** Signed degrees per day. Negative is retrograde. */
  velocityDegPerDay: number;
  phase: MotionPhase;
  /** Relative to THIS planet's own range — see MEAN_SPEED. */
  speedBand: SpeedBand;
}

/**
 * Mean daily motion, degrees. Used to band speed RELATIVE TO EACH PLANET.
 *
 * A single absolute threshold cannot work across bodies: 0.2°/day is nearly
 * stationary for Mercury and faster than Pluto ever travels. Bands are
 * fractions of the planet's own mean, so "slow" means slow for that planet.
 */
const MEAN_SPEED: Record<string, number> = {
  Mercury: 1.383, Venus: 1.602, Mars: 0.524, Jupiter: 0.083,
  Saturn: 0.034, Uranus: 0.012, Neptune: 0.006, Pluto: 0.004,
  Sun: 0.986, Moon: 13.176,
};

function longitudeOf(planet: string, jd: number): number | null {
  if (planet === "Sun") return sunLongitude(jd);
  if (planet === "Moon") return moonLongitude(jd);
  const row = getPlanetPositions(jd).find((p) => p.planet === planet);
  return row ? SIGNS.indexOf(row.sign) * 30 + row.degree : null;
}

/** Signed daily motion, unwrapped across the 0/360 boundary. */
export function velocityOf(planet: string, jd: number): number | null {
  const a = longitudeOf(planet, jd - 0.5);
  const b = longitudeOf(planet, jd + 0.5);
  if (a == null || b == null) return null;
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * How far the planet is from a station, measured by whether its direction
 * actually changes within the lookahead.
 *
 * Deliberately NOT an absolute speed threshold. "Slow" and "about to turn" are
 * different claims, and a fixed cutoff conflates them — it would call every
 * slow stretch a station and, for the outers, would call almost the entire
 * orbit one. Asking whether the sign of the velocity flips is the definition
 * the word actually carries.
 */
const STATION_LOOKAHEAD_DAYS = 2;

export function motionOf(planet: string, jd: number): PlanetMotion | null {
  const v = velocityOf(planet, jd);
  if (v == null) return null;

  // The luminaries never retrograde; give them a phase rather than a special
  // case at every call site.
  let phase: MotionPhase = v < 0 ? "retrograde" : "direct";
  if (planet !== "Sun" && planet !== "Moon") {
    const soon = velocityOf(planet, jd + STATION_LOOKAHEAD_DAYS);
    const past = velocityOf(planet, jd - STATION_LOOKAHEAD_DAYS);
    if (soon != null) {
      if (v >= 0 && soon < 0) phase = "stationing-retrograde";
      else if (v <= 0 && soon > 0) phase = "stationing-direct";
    }
    // Just turned: the station is as much the days after as the days before.
    if (phase === "direct" && past != null && past < 0) phase = "stationing-direct";
    if (phase === "retrograde" && past != null && past > 0) phase = "stationing-retrograde";
  }

  const mean = MEAN_SPEED[planet] ?? 1;
  const ratio = Math.abs(v) / mean;
  const speedBand: SpeedBand =
    ratio < 0.15 ? "very-slow" : ratio < 0.6 ? "slow" : ratio < 1.15 ? "normal" : "fast";

  return { planet, velocityDegPerDay: parseFloat(v.toFixed(4)), phase, speedBand };
}

/** The seven planets classical electional doctrine was written about. */
export const TRADITIONAL_PLANETS = new Set(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);
/** Discovered centuries after the rules that are now being applied to them. */
export const MODERN_PLANETS = new Set(["Uranus", "Neptune", "Pluto"]);
