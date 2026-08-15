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
// days) call this thousands of times per election, so memoize on body + jd.
// Bounded so the map can't grow without limit.
const cache = new Map<string, number>();
function memo(key: string, compute: () => number): number {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const v = compute();
  // 200k, not 20k. A second-resolution key fills sixty times faster than the
  // minute-resolution one this replaced, and the old bound turned that into
  // constant thrashing: measured over 20 getMajorAspects calls, 20k cost
  // 1145ms, 200k cost 873ms, and 400k bought nothing further. Roughly 20MB at
  // full, and only under sustained scanning.
  if (cache.size > 200000) cache.clear();
  cache.set(key, v);
  return v;
}

/**
 * THE KEY AND THE VALUE MUST NAME THE SAME INSTANT.
 *
 * This rounded the cache key to the minute and then computed the value at the
 * caller's FULL-precision `jd`. So a one-minute bucket held whichever answer
 * the first caller to miss the cache happened to produce, and every later
 * caller in that minute got that value back — the position was quantised to a
 * minute, and WHICH value it quantised to depended on call order.
 *
 * Two things fell out of that, and the second is the one that hurts.
 *
 * Measured second-by-second across 2026-08-17T21:44–21:48, the Moon's
 * longitude moved in flat 60-second plateaus. `refineCrossing` bisects a
 * 10-minute bracket twelve times, to ~146ms, against a function that could not
 * resolve better than a minute — so the "exact moment the Moon changes sign"
 * that ends a void window carried up to a minute of error while presenting
 * itself as exact.
 *
 * And because the stored value depended on which sub-minute instant filled the
 * bucket first, the SAME query could return different answers in different
 * runs. The cache is module-level and shared by every caller in the process,
 * so test order changed the result: `regressions.test.ts`'s ingress check
 * passed twelve times out of twelve in isolation and failed about one run in
 * five inside the full suite, with the drift landing on exactly 60s.
 *
 * Both go away by rounding the instant ONCE and using it for the key and the
 * computation alike. A second is the grid, not a minute: the scanners step at
 * ten minutes and still get a distinct key per step, so no useful hit is lost,
 * and the bisection can now converge to the resolution it claims. Nothing here
 * pretends to more precision than astronomy-engine offers — it just stops
 * inventing an ordering dependency on top of it.
 */
export function accurateLongitude(name: string, jd: number): number {
  const body = BODY[name];
  if (!body) return NaN; // caller (astro.ts) falls back to Kepler for Chiron
  const seconds = Math.round(jd * 86400);
  const key = `${name}|${seconds}`;
  return memo(key, () => norm360(Ecliptic(GeoVector(body, jdToDate(seconds / 86400), true)).elon));
}

/** Retrograde = geocentric longitude decreasing over a day. Sun/Moon never. */
export function accurateRetrograde(name: string, jd: number): boolean {
  if (name === "Sun" || name === "Moon" || !BODY[name]) return false;
  const a = accurateLongitude(name, jd);
  const b = accurateLongitude(name, jd + 1);
  return norm360(b - a) > 180;
}
