/**
 * WHERE THE LUNAR CYCLE TURNS — the boundary the ledger counts against.
 *
 * Extracted from routes/momentum.ts on 2026-08-15. That file imports the
 * database at module load, so this could not be exercised without
 * provisioning Postgres and therefore was never tested — and it is not
 * incidental logic: it decides how user data is STAMPED as well as how it is
 * read back, which is the combination that made a wrong answer here erase an
 * intention rather than merely misreport one.
 */
import { julianDay, sunLongitude, moonLongitude } from "./astro.js";

const elongation = (jd: number) => (((moonLongitude(jd) - sunLongitude(jd)) % 360) + 360) % 360;

/**
 * The two most recent New Moons, as dates in the VIEWER's local calendar.
 *
 * The daily walk finds which 24 hours hold the crossing; a bisection inside
 * that window finds the moment. Both halves are load-bearing, and the second
 * one was missing.
 *
 * WHAT THE SAMPLE-STAMPED VERSION GOT WRONG. It recorded the date of the
 * first daily SAMPLE taken after the crossing, and every sample is taken at
 * the current clock time — so the answer depended on what time of day you
 * asked. Measured on 2026-08-15 at 10:20 local: the true new moon was
 * 2026-08-12 10:36:30 local, the 10:20 sample on Aug 12 fell sixteen minutes
 * BEFORE it and still read 359.85°, so the wrap was attributed to the
 * following day and `cycleStart` came back 2026-08-13. Asking an hour later
 * would have returned 2026-08-12. Same user, same day, two answers.
 *
 * That is not cosmetic, because this function stamps data as well as reading
 * it. `POST /planning/intentions` files an intention under the cycleStart it
 * returns, and `/momentum` matches intentions with `i.cycleStart ===
 * cycleStart`. Write a New-Moon intention in the evening and read it back the
 * next morning and the two stamps disagree, so the intention vanishes: Today
 * asks for it again as though nothing had been set, and at the following new
 * moon "you set out to…" has nothing to show (owner, 2026-08-15: the Today
 * page still offering the new-moon review after the review was done).
 *
 * It also moved the review window. Today's cycle card shows on days 0–2 from
 * this date, so a start one day late kept the card up a day after the window
 * should have closed and hid it on the new moon itself.
 *
 * `now` is a parameter rather than a wall-clock read so the tests can anchor
 * to a known lunation instead of asserting against whatever sky the suite
 * happens to run under — the same fix `linesUp` needed for the same reason.
 */
export function newMoonDates(tzOffsetMin: number, now: number = Date.now()): { cycleStart: string; prevCycleStart: string } {
  const found: string[] = [];
  /** An instant, as a date on the viewer's calendar. */
  const localDate = (ms: number) => new Date(ms - tzOffsetMin * 60000).toISOString().slice(0, 10);
  let prev = elongation(julianDay(new Date(now)));
  for (let d = 1; d <= 62 && found.length < 2; d++) {
    const t = now - d * 86400000;
    const e = elongation(julianDay(new Date(t)));
    if (e > prev) {
      // The crossing is bracketed by [t, t + 24h]: elongation is near 360°
      // just before the conjunction and near 0° just after, so "still above
      // 180°" means "still before it".
      let lo = t, hi = t + 86400000;
      for (let i = 0; i < 40 && hi - lo > 1000; i++) {
        const mid = (lo + hi) / 2;
        if (elongation(julianDay(new Date(mid))) > 180) lo = mid; else hi = mid;
      }
      found.push(localDate(hi));
    }
    // After a wrap the values resume decreasing on their own — plain tracking
    // is correct, and anything cleverer invents false crossings.
    prev = e;
  }
  const cycleStart = found[0] ?? localDate(now - 29 * 86400000);
  const prevCycleStart = found[1] ?? localDate(Date.parse(cycleStart) - 30 * 86400000);
  return { cycleStart, prevCycleStart };
}

/**
 * The NEXT new moon, as a date on the viewer's calendar.
 *
 * The mirror of the walk above, forward instead of back: elongation climbs
 * toward 360° and drops through 0°, so a sample LOWER than the one before it
 * means the conjunction fell between them, and the same bisection finds it.
 *
 * This is what a cycle-scoped thing should expire on. The turning-point
 * check-in kept its answers for a flat 29 days from whenever they were
 * written, which is close enough to a synodic month to look right and drifts
 * against the actual cycle every time — a card kept on the 14th outlived the
 * following new moon by two days.
 */
export function nextNewMoonDate(tzOffsetMin: number, now: number = Date.now()): string {
  const localDate = (ms: number) => new Date(ms - tzOffsetMin * 60000).toISOString().slice(0, 10);
  let prev = elongation(julianDay(new Date(now)));
  for (let d = 1; d <= 62; d++) {
    const t = now + d * 86400000;
    const e = elongation(julianDay(new Date(t)));
    if (e < prev) {
      let lo = t - 86400000, hi = t;
      for (let i = 0; i < 40 && hi - lo > 1000; i++) {
        const mid = (lo + hi) / 2;
        if (elongation(julianDay(new Date(mid))) > 180) lo = mid; else hi = mid;
      }
      return localDate(hi);
    }
    prev = e;
  }
  // Unreachable for any real sky — a lunation is 29.5 days and we scan 62.
  return localDate(now + 29.53 * 86400000);
}
