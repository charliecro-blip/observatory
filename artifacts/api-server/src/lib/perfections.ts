/**
 * WHEN AN ASPECT PERFECTS, TO THE MINUTE.
 *
 * The owner asked to see, on the Day view, when lunar and planetary aspects
 * perfect (2026-09-30). The 90-day events feed could not answer that: it
 * scanned hourly, printed the sample after the minimum (Moon ⚹ Mars at 3:53pm
 * when it was exact at 3:06pm), fired a second time two hours later, and gave
 * planet-to-planet aspects a date with no time at all.
 *
 * Two searches, one per kind of motion:
 *
 *  - The Moon outruns every planet, so her signed separation from a planet
 *    only increases, and every aspect is a clean crossing. `scanMoonPerfections`
 *    already does this at 10-minute steps with a bisection to the second; the
 *    day view reuses it, restricted to the five major aspects the rest of the
 *    app speaks in.
 *  - Planet pairs can station, so their separation is not monotonic. Sample the
 *    orb every two hours, take each local minimum that comes within a degree,
 *    and narrow it by ternary search. Only a minimum that actually reaches the
 *    angle counts: a pair that stations short of exact never perfects, and
 *    saying it did would be the "never perfected" error astro.ts already guards
 *    against elsewhere.
 */

import {
  ASPECT_DEFS, geocentricLongitude, julianDay, moonLongitude,
  scanMoonPerfections, sunLongitude,
} from "./astro.js";

export interface Perfection {
  /** ISO instant of exactness. */
  at: string;
  body1: string;
  body2: string;
  aspect: (typeof ASPECT_DEFS)[number]["name"];
  /** Moon aspects move in hours; planet pairs in days. Callers weigh them differently. */
  lunar: boolean;
}

const MAJOR = new Set<string>(ASPECT_DEFS.map((d) => d.name));
const PLANETS = ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron"];
/** How close a refined minimum must come to count as perfecting. The search is
 *  good to well under an arcminute; a station that turns back short of exact
 *  stays degrees wide of this. */
const PERFECTS_WITHIN_DEG = 0.02;

const norm360 = (d: number) => ((d % 360) + 360) % 360;

export function longitudeOf(body: string, jd: number): number {
  if (body === "Sun") return sunLongitude(jd);
  if (body === "Moon") return moonLongitude(jd);
  return geocentricLongitude(body, jd);
}

/** Distance from the nearest major aspect angle, with the aspect's name. */
function pairOrb(a: string, b: string, jd: number): { orb: number; aspect: string } {
  const raw = norm360(longitudeOf(a, jd) - longitudeOf(b, jd));
  const sep = raw > 180 ? 360 - raw : raw;
  let best = { orb: Infinity, aspect: "" };
  for (const def of ASPECT_DEFS) {
    const orb = Math.abs(sep - def.angle);
    if (orb < best.orb) best = { orb, aspect: def.name };
  }
  return best;
}

const jdAt = (ms: number) => julianDay(new Date(ms));

/**
 * The instant within [loMs, hiMs] where the pair's orb to `aspect` is least,
 * and that orb. Orb is unimodal across a bracket this short, so ternary search
 * converges. Each round keeps two thirds of the bracket, so 22 rounds narrow a
 * two-hour bracket to about a second and a two-day one to under a minute,
 * which is past what a clock display can show.
 */
export function refinePerfection(a: string, b: string, aspect: string, loMs: number, hiMs: number): { ms: number; orb: number } {
  const angle = ASPECT_DEFS.find((d) => d.name === aspect)!.angle;
  const orbAt = (ms: number) => {
    const jd = jdAt(ms);
    const raw = norm360(longitudeOf(a, jd) - longitudeOf(b, jd));
    return Math.abs((raw > 180 ? 360 - raw : raw) - angle);
  };
  let lo = loMs, hi = hiMs;
  for (let i = 0; i < 22; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (orbAt(m1) < orbAt(m2)) hi = m2; else lo = m1;
  }
  const ms = Math.round((lo + hi) / 2 / 1000) * 1000;
  return { ms, orb: orbAt(ms) };
}

/** Every major aspect that perfects in [startMs, endMs), sorted by time. */
export function dayPerfections(startMs: number, endMs: number): Perfection[] {
  const out: Perfection[] = [];

  // The Moon: the engine's own scan, from each local day start it covers.
  for (let dayStart = startMs; dayStart < endMs; dayStart += 24 * 3600000) {
    for (const p of scanMoonPerfections(dayStart)) {
      if (!MAJOR.has(p.aspect) || p.timeMs < startMs || p.timeMs >= endMs) continue;
      out.push({ at: new Date(p.timeMs).toISOString(), body1: "Moon", body2: p.planet, aspect: p.aspect as Perfection["aspect"], lunar: true });
    }
  }

  // Planet pairs: two-hour samples, from one step before the window to one
  // after, so a minimum on either edge still has a neighbour on each side.
  const STEP = 2 * 3600000;
  const times: number[] = [];
  for (let t = startMs - STEP; t <= endMs + STEP; t += STEP) times.push(t);
  for (let i = 0; i < PLANETS.length; i++) {
    for (let j = i + 1; j < PLANETS.length; j++) {
      const a = PLANETS[i], b = PLANETS[j];
      const samples = times.map((t) => pairOrb(a, b, jdAt(t)));
      for (let k = 1; k < samples.length - 1; k++) {
        const s = samples[k];
        if (s.orb > 1 || s.orb > samples[k - 1].orb || s.orb > samples[k + 1].orb) continue;
        const { ms, orb } = refinePerfection(a, b, s.aspect, times[k - 1], times[k + 1]);
        if (orb > PERFECTS_WITHIN_DEG || ms < startMs || ms >= endMs) continue;
        out.push({ at: new Date(ms).toISOString(), body1: a, body2: b, aspect: s.aspect as Perfection["aspect"], lunar: false });
      }
    }
  }

  return out.sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
}
