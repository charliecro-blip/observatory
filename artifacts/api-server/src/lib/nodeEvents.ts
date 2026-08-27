/**
 * TWO THINGS ABOUT THE NODES THAT WERE NOT BEING SAID.
 *
 * The app already detects the Moon on a node — qualifiers.ts has carried a
 * `moon-north-node` qualifier for months, and on 2026-08-27 it fired correctly
 * at 1.5°. What it could not say was WHEN: a qualifier carries an orb, and an
 * orb is not a time of day. The owner's report was about a morning ("a day, or
 * at least morning, to really aspire"), and a bare "· 1.5°" cannot tell anyone
 * whether that morning is now or already over.
 *
 * So this adds exactness and direction to the fact that already exists, rather
 * than a second detector for it. Two modules answering "is the Moon on the
 * node" would be the approach.ts / lexicon split all over again, where fixing
 * one made the app contradict itself.
 *
 * The second thing is the nodal axis changing sign — roughly every eighteen
 * months, and nowhere in the app at all.
 *
 * NEITHER TOUCHES THE VOID. The owner asked whether a node conjunction cancels
 * void-of-course. It does not: a void ends when the Moon perfects a further
 * aspect to a PLANET before leaving her sign, and the nodes are the two points
 * where the lunar orbit crosses the ecliptic — no body, no light. Neither
 * Lilly nor Bonatti counts them. VOC_PLANETS in astro.ts is the strict
 * traditional list and stays as it is; adding a node would be a doctrinal
 * error wearing the costume of a fix. The two facts coexist, and the app
 * should be able to say both on the same morning.
 */

import { lunarNodes, moonLongitude, jdToDate } from "./astro.js";

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

/** Shortest separation between two ecliptic longitudes, 0–180. */
function sep(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

const signOf = (lon: number) => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)];

function separationAt(jd: number, node: "North" | "South"): number {
  const north = lunarNodes(jd, "true").north.longitude;
  return sep(moonLongitude(jd), node === "North" ? north : (north + 180) % 360);
}

export interface NodeTiming {
  /** ISO instant the meeting is (or was) exact. */
  exactAt: string;
  /** True while the Moon is still closing on the node. */
  applying: boolean;
}

/**
 * When the Moon's meeting with a node is exact, and whether it is still
 * closing.
 *
 * Walked in five-minute steps rather than divided by a mean rate: the Moon's
 * speed varies by more than a tenth across its orbit, so a rate estimate can
 * be most of an hour out — and naming a time of day is the entire point.
 *
 * ±12h of samples covers the 3° orb the qualifier uses at the Moon's ~13.25°/day
 * closing speed, with room either side. Only called when that orb has already
 * matched, which is about two days a month, so the 289 ephemeris reads are not
 * paid on an ordinary request.
 */
export function nodeTiming(jd0: number, node: "North" | "South"): NodeTiming {
  const STEP = 5 / 1440;
  let best = jd0, bestSep = separationAt(jd0, node);
  for (let i = -144; i <= 144; i++) {
    const j = jd0 + i * STEP;
    const s = separationAt(j, node);
    if (s < bestSep) { bestSep = s; best = j; }
  }
  return {
    exactAt: jdToDate(best).toISOString(),
    // Sampled ten minutes on rather than inferred from direction of travel:
    // near exactness the sign of the change is the whole answer, and the
    // node's own retrograde drift toward the Moon is part of it.
    applying: separationAt(jd0 + 10 / 1440, node) < separationAt(jd0, node),
  };
}

export interface NodeIngress {
  from: string;
  to: string;
  /** Negative once it has happened. */
  daysAway: number;
}

/**
 * The nodal axis changing sign — one of the rarest things the app can report.
 *
 * The MEAN node, deliberately. The true node wobbles back and forth across a
 * cusp for weeks before it settles: on 2026-08-27 it had sat within a tenth of
 * a degree of Aquarius 29.9° for a month, while the mean node crossed once,
 * cleanly, about a week earlier. Reporting each wobble would cry rare four
 * times in a season, which is how a rare-event channel stops being read.
 */
export function nodeIngress(jd0: number, windowDays = 45): NodeIngress | null {
  const signAt = (j: number) => signOf(lunarNodes(j, "mean").north.longitude);

  let nearest: NodeIngress | null = null;
  for (let d = -windowDays; d <= windowDays; d++) {
    const a = signAt(jd0 + d), b = signAt(jd0 + d + 1);
    if (a === b) continue;
    const daysAway = d + 1;
    if (!nearest || Math.abs(daysAway) < Math.abs(nearest.daysAway)) {
      nearest = { from: a, to: b, daysAway };
    }
  }
  return nearest;
}
