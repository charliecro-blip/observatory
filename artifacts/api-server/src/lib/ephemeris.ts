/**
 * Ephemeris — accurate geocentric positions via astronomy-engine (pure-JS,
 * JPL-validated to sub-arcminute). Replaces the hand-rolled Keplerian model
 * whose outer planets were wrong-sign up to ~6% of the time (see
 * scripts/ephemeris-audit.ts — the audit that prompted this swap, 2026-07-20).
 *
 * astro.ts delegates its longitude/retrograde core here; everything downstream
 * (aspects, houses, hours, the tide curve, elections) keeps working, now on
 * real positions. Chiron is NOT covered by astronomy-engine, so it stays on the
 * calibrated Kepler model in astro.ts — this module handles Sun..Pluto.
 */

import { Body, GeoVector, Ecliptic } from "astronomy-engine";

const BODY: Record<string, Body> = {
  Sun: Body.Sun, Moon: Body.Moon, Mercury: Body.Mercury, Venus: Body.Venus,
  Mars: Body.Mars, Jupiter: Body.Jupiter, Saturn: Body.Saturn,
  Uranus: Body.Uranus, Neptune: Body.Neptune, Pluto: Body.Pluto,
};

export const HAS_ACCURATE = (name: string) => name in BODY;

const norm360 = (d: number) => ((d % 360) + 360) % 360;
// JD → Date (JD 2440587.5 == unix epoch).
const jdToDate = (jd: number) => new Date((jd - 2440587.5) * 86400000);

// The position scanners (moon-perfection at 10-min steps × many planets × many
// days) call this thousands of times per election, so memoize on body + jd
// rounded to ~1 minute. Bounded so the map can't grow without limit.
const cache = new Map<string, number>();
function memo(key: string, compute: () => number): number {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const v = compute();
  if (cache.size > 20000) cache.clear();
  cache.set(key, v);
  return v;
}

/** Geocentric apparent ecliptic longitude of date (tropical), degrees 0..360. */
export function accurateLongitude(name: string, jd: number): number {
  const body = BODY[name];
  if (!body) return NaN; // caller (astro.ts) falls back to Kepler for Chiron
  const key = `${name}|${Math.round(jd * 1440)}`;
  return memo(key, () => norm360(Ecliptic(GeoVector(body, jdToDate(jd), true)).elon));
}

/** Retrograde = geocentric longitude decreasing over a day. Sun/Moon never. */
export function accurateRetrograde(name: string, jd: number): boolean {
  if (name === "Sun" || name === "Moon" || !BODY[name]) return false;
  const a = accurateLongitude(name, jd);
  const b = accurateLongitude(name, jd + 1);
  return norm360(b - a) > 180;
}
