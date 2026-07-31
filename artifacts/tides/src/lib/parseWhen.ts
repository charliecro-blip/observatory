// Natural-language due dates for Quick Capture.
//
// Capture parsed NO dates at all until now: "draft the report by Fri" was
// stored verbatim as a title, so the one moment a user tells us when something
// is due was the one moment we threw it away.
//
// Deterministic on purpose. The engine's whole claim is that it is ephemeris
// math rather than a model guessing, and a date parser that sometimes returns
// a different answer for the same words would be the one place that isn't
// true. It also means the preview can be shown live on every keystroke with no
// network call, and that every rule below is pinned by a test.
//
// DATES ONLY — never times. `tasks.due_date` is YYYY-MM-DD with no time
// column, so parsing "2pm" would either be silently discarded or, worse,
// rendered back to the user as a precision the row cannot hold. A typed time
// stays in the title where it remains visible. (BACKLOG §10: if a number is
// printed as a clock time, it has to actually be one.)

import { localDateStr, addDaysLocal } from "./dates";

export type ParsedWhen = {
  /** The line with the date phrase (and its preposition) removed. */
  title: string;
  /** YYYY-MM-DD in the viewer's local days, or null if nothing parsed. */
  dueDate: string | null;
  /** The exact substring that produced the date — shown so the strip is auditable. */
  matched: string | null;
};

// Sun=0 … Sat=6, matching Date#getDay.
//
// `sat` and `sun` are deliberately absent as abbreviations: "sat down with the
// numbers" and "sun exposure" are ordinary task text, and in an app that
// mentions the Sun on every screen the second one is not hypothetical. The
// full words carry no such collision. Same reasoning drops bare `mar`/`may`
// below — those only ever parse with a day number attached.
const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, weds: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6,
};

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9,
  november: 10, nov: 10, december: 11, dec: 11,
};

const WEEKDAY_RE = Object.keys(WEEKDAYS).join("|");
const MONTH_RE = Object.keys(MONTHS).join("|");

/** Prepositions swallowed along with the date, so "by Fri" leaves no "by". */
const PREP = String.raw`(?:\b(?:by|on|due|before|for|at)\s+)?`;

type Rule = {
  re: RegExp;
  resolve: (m: RegExpExecArray, today: string) => string | null;
};

/** Days until the next `target` weekday, counting today as 0. */
function untilWeekday(today: string, target: number): number {
  const dow = new Date(today + "T12:00:00").getDay();
  return (target - dow + 7) % 7;
}

/**
 * "next friday" = the Friday of NEXT calendar week (weeks starting Monday) —
 * not merely the next Friday to occur, which on a Wednesday would be two days
 * away and is what people mean by plain "friday".
 */
function nextWeekWeekday(today: string, target: number): string {
  const dow = new Date(today + "T12:00:00").getDay();      // Sun=0
  const isoDow = dow === 0 ? 7 : dow;                       // Mon=1 … Sun=7
  const nextMonday = addDaysLocal(today, 8 - isoDow);
  const offsetFromMonday = (target - 1 + 7) % 7;            // Mon=0 … Sun=6
  return addDaysLocal(nextMonday, offsetFromMonday);
}

/**
 * A bare month/day with no year. Rolls to next year only when the date has
 * already passed — capture is overwhelmingly about things still ahead.
 */
function monthDay(today: string, month: number, day: number): string | null {
  if (day < 1 || day > 31) return null;
  const year = new Date(today + "T12:00:00").getFullYear();
  const build = (y: number) => {
    const d = new Date(y, month, day, 12);
    // Rejects "february 31" instead of silently landing on March 3.
    if (d.getMonth() !== month || d.getDate() !== day) return null;
    return localDateStr(d);
  };
  const thisYear = build(year);
  if (thisYear && thisYear >= today) return thisYear;
  return build(year + 1);
}

// Ordered by specificity only for readability — selection is by position in
// the line (see `parseWhen`), so "next friday" beats "friday" because it
// starts earlier, not because it is listed first.
const RULES: Rule[] = [
  {
    re: new RegExp(PREP + String.raw`\b(?:the\s+)?day\s+after\s+tomorrow\b`, "i"),
    resolve: (_m, today) => addDaysLocal(today, 2),
  },
  {
    re: new RegExp(PREP + String.raw`\b(?:tomorrow|tmrw|tmr)\b`, "i"),
    resolve: (_m, today) => addDaysLocal(today, 1),
  },
  {
    // "tonight" is today: the app has no evening-specific due slot, and
    // pretending otherwise would invent one.
    re: new RegExp(PREP + String.raw`\b(?:today|tonight)\b`, "i"),
    resolve: (_m, today) => today,
  },
  {
    re: new RegExp(PREP + String.raw`\bthis\s+weekend\b`, "i"),
    resolve: (_m, today) => addDaysLocal(today, untilWeekday(today, 6)),
  },
  {
    re: new RegExp(PREP + String.raw`\bnext\s+week\b`, "i"),
    resolve: (_m, today) => nextWeekWeekday(today, 1),
  },
  {
    re: new RegExp(PREP + String.raw`\bnext\s+(` + WEEKDAY_RE + String.raw`)\b`, "i"),
    resolve: (m, today) => nextWeekWeekday(today, WEEKDAYS[m[1].toLowerCase()]),
  },
  {
    // Plain "friday" includes today when today IS Friday — someone typing it
    // on the day means the day they are standing in.
    re: new RegExp(PREP + String.raw`\b(?:this\s+)?(` + WEEKDAY_RE + String.raw`)\b`, "i"),
    resolve: (m, today) => addDaysLocal(today, untilWeekday(today, WEEKDAYS[m[1].toLowerCase()])),
  },
  {
    re: new RegExp(PREP + String.raw`\bin\s+(\d{1,3})\s+(day|days|week|weeks)\b`, "i"),
    resolve: (m, today) => {
      const n = parseInt(m[1], 10);
      return addDaysLocal(today, /^week/i.test(m[2]) ? n * 7 : n);
    },
  },
  {
    re: new RegExp(PREP + String.raw`\b(` + MONTH_RE + String.raw`)\s+(\d{1,2})(?:st|nd|rd|th)?\b`, "i"),
    resolve: (m, today) => monthDay(today, MONTHS[m[1].toLowerCase()], parseInt(m[2], 10)),
  },
  {
    re: new RegExp(PREP + String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(` + MONTH_RE + String.raw`)\b`, "i"),
    resolve: (m, today) => monthDay(today, MONTHS[m[2].toLowerCase()], parseInt(m[1], 10)),
  },
];

// Numeric dates ("8/7") are deliberately NOT parsed. 8/7 is August 7th to half
// the world and the 8th of July to the other half, and there is no way to ask
// which was meant from inside a text field. A wrong date that looks right is
// worse than no date at all.

/** Spans protected by double quotes — Fantastical's escape hatch. */
function quotedSpans(line: string): [number, number][] {
  const spans: [number, number][] = [];
  const re = /"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

function tidy(s: string): string {
  return s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[\s,;:-]+$/, "")
    .replace(/^[\s,;:-]+/, "")
    .trim();
}

/**
 * Pull a due date out of one captured line.
 *
 * `today` is passed in rather than read from the clock so that every test
 * computes its own expectation, and so the caller can hand us the viewer's
 * local day instead of the server's.
 */
export function parseWhen(line: string, today: string = localDateStr()): ParsedWhen {
  const protectedSpans = quotedSpans(line);
  const inQuotes = (i: number) => protectedSpans.some(([a, b]) => i >= a && i < b);

  let best: { start: number; end: number; date: string } | null = null;

  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      if (inQuotes(m.index)) continue;
      const date = rule.resolve(m, today);
      if (!date) continue;
      // Leftmost wins; on a tie the longer match wins, so "next friday" is
      // never shortened to "friday" by a rule that happens to start level.
      const better =
        !best || m.index < best.start ||
        (m.index === best.start && m.index + m[0].length > best.end);
      if (better) best = { start: m.index, end: m.index + m[0].length, date };
      break; // one match per rule is enough to compete on position
    }
  }

  if (!best) return { title: stripProtectiveQuotes(line, false), dueDate: null, matched: null };

  const matched = line.slice(best.start, best.end);
  const title = tidy(line.slice(0, best.start) + " " + line.slice(best.end));
  return {
    title: stripProtectiveQuotes(title, protectedSpans.length > 0),
    dueDate: best.date,
    matched: matched.trim(),
  };
}

/**
 * Quotes are removed only when they actually suppressed a date — otherwise a
 * user writing `call the "big fish" client` would find their punctuation
 * silently rewritten by a feature they never invoked.
 */
function stripProtectiveQuotes(line: string, force: boolean): string {
  return line.replace(/"([^"]*)"/g, (whole, inner: string) => {
    if (force) return inner;
    const wouldMatch = RULES.some(r => {
      const m = new RegExp(r.re.source, "i").exec(inner);
      return !!m && !!r.resolve(m, localDateStr());
    });
    return wouldMatch ? inner : whole;
  });
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * How the parsed date is shown back. Always names the actual day — a chip
 * reading only "tomorrow" is unverifiable at a glance, and the whole point of
 * the preview is that the user can catch us being wrong.
 */
export function formatDueChip(dateStr: string, today: string = localDateStr()): string {
  const d = new Date(dateStr + "T12:00:00");
  const stamp = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  const delta = Math.round(
    (new Date(dateStr + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000,
  );
  if (delta === 0) return `today · ${stamp}`;
  if (delta === 1) return `tomorrow · ${stamp}`;
  if (delta > 1 && delta < 7) return `${DAY_NAMES[d.getDay()]} · ${stamp}`;
  return `${DAY_NAMES[d.getDay()].slice(0, 3)} ${stamp}`;
}
