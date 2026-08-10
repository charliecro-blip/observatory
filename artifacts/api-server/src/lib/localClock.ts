/**
 * Wall-clock formatting in the VIEWER's timezone, not the server's.
 *
 * `toLocaleTimeString`/`toLocaleDateString` without an explicit `timeZone`
 * format in the process's local zone. That is the developer's machine in dev
 * and UTC in production, so anything formatted this way on the server is
 * correct locally and wrong for every user once deployed — the failure mode
 * that hides best, because it looks right the whole time you are building it.
 *
 * The worst instances were not display strings but PROMPTS. The advisor was
 * told the current moment and the user's own calendar events in UTC, so for an
 * Austin user at 8pm it was reasoning about 1am the following day — advising
 * on the wrong day, confidently.
 *
 * `tzOffsetMin` is what `Date.prototype.getTimezoneOffset()` returns on the
 * client: minutes to ADD to local time to reach UTC, positive west of
 * Greenwich. Shift by it, then format as UTC.
 */

const shifted = (d: Date, tzOffsetMin: number) => new Date(d.getTime() - tzOffsetMin * 60000);

/**
 * Compact "8:30PM" rather than "8:30 PM".
 *
 * Matches the clock style already used across the app, and strips U+202F as
 * well as a plain space: modern ICU emits a NARROW NO-BREAK SPACE before the
 * meridiem, so a `/ /` replace silently leaves it in and string comparisons
 * fail in a way that looks like a whitespace typo.
 */
const compact = (s: string) => s.replace(/[\s\u202f\u00a0]/g, "");

export function clockIn(d: Date, tzOffsetMin: number, opts: Intl.DateTimeFormatOptions = {}): string {
  return compact(shifted(d, tzOffsetMin).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", ...opts, timeZone: "UTC",
  }));
}

export function dateIn(d: Date, tzOffsetMin: number, opts: Intl.DateTimeFormatOptions = {}): string {
  return shifted(d, tzOffsetMin).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", ...opts, timeZone: "UTC",
  });
}

export function stampIn(d: Date, tzOffsetMin: number, opts: Intl.DateTimeFormatOptions = {}): string {
  return shifted(d, tzOffsetMin).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    ...opts, timeZone: "UTC",
  });
}

/**
 * The calendar date `d` falls on IN THE USER'S ZONE, as "YYYY-MM-DD".
 *
 * The weavers were building this string from local `Date` getters — the same
 * disease as the formatting above, but in date ARITHMETIC, where it decides
 * which tasks are overdue. On a UTC server, an Austin user's evening is
 * already "tomorrow": at 7:01 PM local the day weaver started treating
 * everything due today as due yesterday.
 */
export function dayKeyIn(d: Date, tzOffsetMin: number): string {
  const s = shifted(d, tzOffsetMin);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
}

/**
 * [local midnight, next local midnight] for the day `d` falls on in the
 * user's zone — as real instants, usable for interval math against events.
 *
 * The offset is a snapshot, so a boundary that crosses a DST change can be an
 * hour off for that one day. That is the same convention every `*In` helper
 * here already accepts, and it is an hour once a year versus five hours every
 * evening.
 *
 * When an IANA zone is available, prefer `dayBoundsInZone` below — it has no
 * such gap. This stays for callers that only have a numeric offset.
 */
export function dayBoundsIn(d: Date, tzOffsetMin: number): [Date, Date] {
  const s = shifted(d, tzOffsetMin);
  const startShifted = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const start = new Date(startShifted + tzOffsetMin * 60000);
  return [start, new Date(start.getTime() + 86400000)];
}

/**
 * ZONE-AWARE CIVIL TIME. Correct across a DST transition, using only Node's
 * built-in `Intl` — Node ships full IANA tz data, so this needs no new
 * dependency. Everything above this comment takes a numeric `tzOffsetMin`, a
 * SNAPSHOT that is wrong for up to an hour on the day a clock changes and for
 * every day after it in a multi-day scan that started before the transition
 * and runs past it. These recompute the offset for the SPECIFIC day in
 * question, so there is no snapshot to go stale.
 */

/**
 * The UTC offset (minutes, `getTimezoneOffset()` sign convention) actually in
 * effect for `date` in `timeZone` — not "now", `date` itself. Two callers a
 * day apart in the same zone can get two different answers on a transition
 * day, which is the whole point.
 */
export function offsetMinutesFor(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).map(p => [p.type, p.value]),
  ) as Record<string, string>;
  const asIfUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  // `date - asIfUTC`, not the reverse: this file's convention (matching
  // `getTimezoneOffset()`, per the module comment) is POSITIVE west of
  // Greenwich — Chicago winter is +360, not -360. Getting this backwards is
  // exactly the kind of bug that only shows up as a wrong civil day, not a
  // crash, which is why the test suite pins the sign against a real zone
  // rather than trusting the arithmetic by inspection.
  return Math.round((date.getTime() - asIfUTC) / 60000);
}

/** The calendar date `d` falls on in `timeZone`, as "YYYY-MM-DD". `en-CA`
 *  formats that shape directly rather than needing to be reassembled. */
export function dayKeyInZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * Midnight of civil date `y-m-day` in `timeZone`, as a real UTC instant.
 *
 * TWO-PASS on purpose. A single naive guess — "midnight as if the zone were
 * UTC, then shift by the zone's offset" — looks up the offset at an instant
 * that can be many hours from the true local midnight (worst case, zones at
 * UTC+14). If a DST transition falls inside that gap, the first lookup reads
 * the WRONG side of it. The second pass re-reads the offset at the corrected
 * candidate, which is now within the size of the offset CHANGE (normally an
 * hour) of true midnight — close enough that no realistic DST rule flips
 * twice in that window. This is the standard fixed-point technique for
 * zone-safe local-midnight without pulling in a full tz-database library.
 */
function civilMidnightUTC(y: number, m: number, day: number, timeZone: string): Date {
  const guessMs = Date.UTC(y, m - 1, day);
  const offset1 = offsetMinutesFor(new Date(guessMs), timeZone);
  const candidateMs = guessMs + offset1 * 60000;
  const offset2 = offsetMinutesFor(new Date(candidateMs), timeZone);
  return new Date(offset2 === offset1 ? candidateMs : guessMs + offset2 * 60000);
}

/**
 * [local midnight, next local midnight] for the day `d` falls on in
 * `timeZone` — correct across a DST transition. A transition day is honestly
 * 23 or 25 hours long here, not a hardcoded 24; the end is the START of the
 * NEXT civil date, derived the same zone-aware way, not `start + 86400000`.
 */
export function dayBoundsInZone(d: Date, timeZone: string): [Date, Date] {
  const key = dayKeyInZone(d, timeZone);
  const [y, m, day] = key.split("-").map(Number);
  const start = civilMidnightUTC(y, m, day, timeZone);
  // The next CALENDAR date, handled by the runtime rather than by hand so
  // month/year rollover (day 31 → next month, Dec 31 → next year) is free.
  const nextCivil = new Date(Date.UTC(y, m - 1, day + 1));
  const end = civilMidnightUTC(nextCivil.getUTCFullYear(), nextCivil.getUTCMonth() + 1, nextCivil.getUTCDate(), timeZone);
  return [start, end];
}

/**
 * Civil date `d`, advanced by `days` CALENDAR days in `timeZone`, returned as
 * that day's civil noon — the anchor multi-day scans use to ask "which day is
 * this". Stepping by `+ days * 86400000` in milliseconds silently drifts by
 * an hour across any DST transition inside the span, which is exactly the
 * `electionEngine` week/month-scan bug this exists to close: a scan that
 * starts before a transition and runs past it was reading the wrong civil
 * day for everything after it.
 */
export function civilDayOffsetIn(d: Date, days: number, timeZone: string): Date {
  const key = dayKeyInZone(d, timeZone);
  const [y, m, day] = key.split("-").map(Number);
  const nextCivil = new Date(Date.UTC(y, m - 1, day + days));
  const midnight = civilMidnightUTC(nextCivil.getUTCFullYear(), nextCivil.getUTCMonth() + 1, nextCivil.getUTCDate(), timeZone);
  return new Date(midnight.getTime() + 12 * 3600000);
}
