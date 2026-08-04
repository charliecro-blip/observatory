/**
 * Civil days, in a real timezone.
 *
 * Two habits in the timing code assume things that are not true:
 *
 *   Date.parse("2026-08-04")        // UTC midnight, not the user's midnight
 *   start.getTime() + d * 86400000  // every civil day is 24 hours
 *
 * The first is a plain bug: a deadline of "end of Tuesday" for someone at
 * UTC-5 resolved five hours early, so a task due today could not be scheduled
 * for this evening. The second is only wrong twice a year, which is worse —
 * it survives every test written on an ordinary week.
 *
 * A numeric UTC offset cannot fix either properly, because the offset itself
 * changes at a DST boundary. These take an IANA zone name and ask the runtime
 * what the offset actually was on that date.
 */

/** The zone's UTC offset in minutes, EAST of UTC, at a given instant. */
export function offsetMinutesAt(instant: Date, timeZone: string): number {
  // Format the instant in the zone, read it back as if it were UTC, and the
  // difference is the offset. Uses the runtime's own tz database, so historical
  // and DST rules come for free.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const { type, value } of dtf.formatToParts(instant)) p[type] = value;
  // `hour` can come back as "24" at midnight in some ICU versions.
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day),
                         hour, Number(p.minute), Number(p.second));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** True if the runtime recognises this zone name. */
export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; }
  catch { return false; }
}

/**
 * The instant a local calendar date begins in the given zone.
 *
 * Solved rather than assumed: guess with a nominal offset, then re-read the
 * offset actually in force at that guess and correct. One correction is enough
 * for every real zone, because offsets change by at most a couple of hours.
 */
export function startOfLocalDay(dateISO: string, timeZone: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const nominal = Date.UTC(y, m - 1, d, 0, 0, 0);
  let guess = nominal - offsetMinutesAt(new Date(nominal), timeZone) * 60000;
  const corrected = nominal - offsetMinutesAt(new Date(guess), timeZone) * 60000;
  if (corrected !== guess) guess = corrected;
  return guess;
}

/**
 * The instant a local calendar date ENDS — i.e. the next local midnight.
 *
 * Computed from the next calendar date rather than by adding 24 hours, so a
 * spring-forward day is 23 hours long and a fall-back day is 25, as they are.
 */
export function endOfLocalDay(dateISO: string, timeZone: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextISO = next.toISOString().slice(0, 10);
  return startOfLocalDay(nextISO, timeZone);
}

/** Successive local midnights — never `+ n * 86400000`. */
export function localDayStarts(fromISO: string, days: number, timeZone: string): number[] {
  const [y, m, d] = fromISO.split("-").map(Number);
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const iso = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    out.push(startOfLocalDay(iso, timeZone));
  }
  return out;
}
