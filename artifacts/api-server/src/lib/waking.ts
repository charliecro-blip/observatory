/**
 * Waking availability, modelled as intervals that may cross midnight.
 *
 * The Planner used to handle an overnight rhythm by discarding it:
 *
 *     if (sleep <= wake) sleep = DEFAULT_SLEEP;
 *
 * which turned a stated 11:00–03:00 into 11:00–21:00. That silently
 * contradicted the dead-of-night work, which exists precisely to respect
 * someone who says they are up late — one part of the app taking them at
 * their word while another overruled it six hours early.
 *
 * A night owl's waking day is two segments of one civil day, not one
 * ascending pair of hours.
 *
 * Lives in lib/ rather than in the route because it is pure arithmetic and
 * should be testable without provisioning a database — importing the route to
 * reach it pulled in the db module and failed on a missing DATABASE_URL.
 */

/** Waking hours of one civil day, in chronological order within that day. */
export function wakingSegments(wake: number, sleep: number): [number, number][] {
  return sleep <= wake
    ? [[0, sleep], [wake, 24]]   // early morning, then evening onward
    : [[wake, sleep]];
}

/** Is this local hour inside the waking span, wrap included? */
export function isAwakeAt(h: number, wake: number, sleep: number): boolean {
  return wakingSegments(wake, sleep).some(([lo, hi]) => h >= lo && h < hi);
}
