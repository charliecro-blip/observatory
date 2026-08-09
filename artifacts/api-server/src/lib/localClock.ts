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
 */
export function dayBoundsIn(d: Date, tzOffsetMin: number): [Date, Date] {
  const s = shifted(d, tzOffsetMin);
  const startShifted = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const start = new Date(startShifted + tzOffsetMin * 60000);
  return [start, new Date(start.getTime() + 86400000)];
}
