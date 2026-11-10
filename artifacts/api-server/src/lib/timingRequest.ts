import { DEFAULT_HORIZON_NOTE } from "./askRouting.js";
import { interpretTimingActivity } from "./timingInterpretation.js";
import {
  dayKeyInZone,
  civilDayOffsetIn,
  dayBoundsInZone,
  offsetMinutesFor,
} from "./localClock.js";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  half: 0.5,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  sixty: 60,
  ninety: 90,
};

const SPAN_COUNT: Record<string, number> = {
  "a couple of": 2, "couple of": 2, "a few": 3, few: 3, one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

/**
 * "(in) the next three days", "over the next couple of weeks": a span that
 * starts now. Not "in two weeks", which is a point in time and still asks.
 */
function horizonSpan(text: string): { match: RegExpExecArray; days: number } | null {
  const m = /\b(?:(?:in|within|over|during|for) )?(?:the )?(?:next|coming|following) (a couple of|couple of|a few|few|\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve) (days?|weeks?)\b/.exec(text);
  if (!m) return null;
  const n = SPAN_COUNT[m[1]] ?? Number(m[1]);
  if (!Number.isInteger(n) || n < 1) return null;
  return { match: m, days: n * (m[2].startsWith("week") ? 7 : 1) };
}

/** One request interpretation. All calendar arithmetic uses the supplied zone. */
export function interpretTimingRequest(
  text: string,
  timeZone: string,
  now: Date,
) {
  new Intl.DateTimeFormat("en-US", { timeZone }).format(now);
  const activity = interpretTimingActivity(text);
  const normalized = text
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\bforty[ -]five\b/g, "45")
    .replace(/\btwenty[ -]five\b/g, "25")
    .replace(/\b(?:an?|one) hour and a half\b/g, "90 minutes")
    .replace(/\bhalf an hour\b/g, "30 minutes");
  const unresolved: string[] = [];
  const assumptions: string[] = [];
  if (
    /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six)\s*(?:-|to|or)\s*(?:\d+(?:\.\d+)?|one|two|three|four|five|six)\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/.test(
      normalized,
    )
  )
    unresolved.push("Choose one duration for this session.");
  if (
    /\bin\s+(?:\d+|one|two|three|four|five|six)\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/.test(
      normalized,
    )
  )
    unresolved.push(
      "Please set the start time for that delay in the search fields.",
    );
  const today = dayKeyInZone(now, timeZone);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  // WHAT IS UNDERSTOOD IS CUT FROM `rest` (reset plan step 3, 2026-10-03):
  // the catch-all checks at the end ask only about what is left over, so
  // "first date friday night" resolves instead of asking about the whole
  // request because one word in it was once unparsed.
  let rest = normalized;
  const consume = <T extends { 0: string } | null>(m: T): T => {
    if (m) rest = rest.replace(m[0], " ");
    return m;
  };
  const daysUntil = (key: string) =>
    Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
  let first = 0,
    last = 6,
    explicitDate = false;
  const span = horizonSpan(normalized);
  let report: { days: number } | null = null;
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthDay = consume(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/.exec(normalized),
  );
  if (monthDay) {
    const m = MONTHS.indexOf(monthDay[1].slice(0, 3));
    const d = Number(monthDay[2]);
    const keyFor = (y: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const real = (y: number) => {
      const dt = new Date(`${keyFor(y)}T12:00:00Z`);
      return dt.getUTCMonth() === m && dt.getUTCDate() === d;
    };
    let year = Number(today.slice(0, 4));
    if (!real(year)) unresolved.push("That date doesn't exist. Choose another in the search fields.");
    else {
      if (keyFor(year) < today) year += 1;
      first = last = daysUntil(keyFor(year));
      explicitDate = true;
    }
  } else if (span) {
    // "the next three days" is a range; "the next couple of weeks" is longer
    // than one search covers, so it names a report instead of guessing a week.
    consume(span.match);
    explicitDate = true;
    first = 0;
    if (span.days <= 7) {
      last = span.days - 1;
      assumptions.push(`The next ${span.days} days, starting today.`);
    } else {
      last = 6;
      report = { days: Math.min(span.days, 30) };
      unresolved.push("That covers more than a week, which takes the longer report rather than one search.");
    }
  } else if (consume(/\bthis weekend\b/.exec(normalized))) {
    first = dow === 0 ? 0 : (6 - dow + 7) % 7;
    last = dow === 0 ? 0 : first + 1;
    explicitDate = true;
  } else if (consume(/\bnext weekend\b/.exec(normalized))) {
    first = dow === 0 ? 6 : ((6 - dow + 7) % 7) + 7;
    last = first + 1;
    explicitDate = true;
    assumptions.push(
      "Next weekend means the Saturday and Sunday of next calendar week.",
    );
  } else if (consume(/\bthis week\b/.exec(normalized))) {
    first = 0;
    last = (7 - dow) % 7;
    explicitDate = true;
    assumptions.push("This week runs through Sunday.");
  } else if (consume(/\bnext week\b/.exec(normalized))) {
    first = (8 - dow) % 7 || 7;
    last = first + 6;
    explicitDate = true;
    assumptions.push("Next week means Monday through Sunday.");
  } else if (consume(/\bday after tomorrow\b/.exec(normalized))) {
    first = last = 2;
    explicitDate = true;
  } else if (consume(/\b(?:tomorrow|tmrw|tmr)\b/.exec(normalized))) {
    first = last = 1;
    explicitDate = true;
  } else if (/\b(?:today|tonight|this (?:morning|afternoon|evening))\b/.test(normalized)) {
    consume(/\btoday\b/.exec(normalized));
    first = last = 0;
    explicitDate = true;
  } else {
    // A weekday as a deadline: "before friday" is today through Thursday,
    // "by friday" today through Friday.
    const deadline = consume(new RegExp(
      `\\b(before|by|until|till)\\s+(${WEEKDAYS.join("|")}|mon|tue|wed|thu|fri)\\b`,
    ).exec(normalized));
    const weekday = deadline ? null : consume(new RegExp(
      `\\b(?:(next|this) )?(${WEEKDAYS.join("|")}|mon|tue|wed|thu|fri)\\b`,
    ).exec(normalized));
    if (deadline) {
      const target = WEEKDAYS.findIndex((d) => d.startsWith(deadline[2]));
      const away = (target - dow + 7) % 7 || 7;
      first = 0;
      last = deadline[1] === "before" ? away - 1 : away;
      explicitDate = true;
    } else if (weekday) {
      const target = WEEKDAYS.findIndex((d) => d.startsWith(weekday[2]));
      first =
        weekday[1] === "next"
          ? 8 - (dow || 7) + ((target + 6) % 7)
          : (target - dow + 7) % 7;
      last = first;
      explicitDate = true;
      if (weekday[1] === "next")
        assumptions.push("Next weekday means that day in next calendar week.");
    }
  }
  const immediate = /\b(?:now|next few hours)\b/.test(normalized);
  if (immediate) consume(/\b(?:right now|now|next few hours)\b/.exec(normalized));
  let durationMinutes: number | undefined;
  const durationMatches = [
    ...normalized.matchAll(
      /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|half|ten|fifteen|twenty|thirty|forty|sixty|ninety)[ -]*(hours?|hrs?|h|minutes?|mins?|m)\b/g,
    ),
  ];
  if (durationMatches.length) {
    durationMinutes = durationMatches.reduce(
      (sum, m) =>
        sum + (NUMBERS[m[1]] ?? Number(m[1])) * (/^h/.test(m[2]) ? 60 : 1),
      0,
    );
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 1440
    )
      unresolved.push("Choose a duration from 1 to 1,440 minutes.");
    if (
      /\b(?:or|to)\b/.test(
        normalized.slice(
          durationMatches[0].index!,
          durationMatches.at(-1)!.index!,
        ),
      )
    )
      unresolved.push("How long should the session last?");
    for (const m of durationMatches) rest = rest.replace(m[0], " ");
  }
  if (/\b(?:an hour|a hour)\b/.test(normalized) && !durationMinutes)
    durationMinutes = 60;

  // Parts of a day. "night" and "before bed" are the evening; lunch is its
  // own short window.
  const PART_HOURS: Record<string, [number, number]> = {
    morning: [7, 12], afternoon: [12, 18], evening: [18, 23], lunch: [12, 13.5],
  };
  const partWords = [...normalized.matchAll(/\b(after lunch|morning|afternoon|evening|tonight|night|lunch(?:time)?|before bed|bedtime)\b/g)];
  const dayParts = partWords.map((m) =>
    m[1] === "after lunch" ? "afternoon"
    : /^(?:tonight|night|before bed|bedtime)$/.test(m[1]) ? "evening" : m[1].startsWith("lunch") ? "lunch" : m[1],
  );
  for (const m of partWords) rest = rest.replace(m[0], " ");
  rest = rest.replace(/\bthis\b/g, " ");
  const dayPart = dayParts[0];
  // Never treat the first recognized fragment as the whole constraint.
  const conflictingDayParts = new Set(dayParts).size > 1;
  const excludedDayPart = /\b(?:not|avoid|excluding|except)\b[^,.!?]*\b(?:morning|afternoon|evening|tonight|night)\b/.test(normalized);
  if (conflictingDayParts || excludedDayPart)
    unresolved.push("Choose the time range you want to include in the search fields.");
  if (immediate && (explicitDate || dayPart))
    unresolved.push("Choose whether to search now or during the other period you named.");

  // Wall-clock instants on one civil day, in the request's zone.
  const wallOn = (dayOffset: number) => {
    const date = dayKeyInZone(dayBoundsInZone(civilDayOffsetIn(now, dayOffset, timeZone), timeZone)[0], timeZone);
    return (hour: number) => {
      const minutes = Math.round(hour * 60);
      const guess = new Date(`${date}T${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00Z`);
      const g = minutes >= 1440 ? new Date(+guess + 86400000) : guess;
      const candidate = new Date(+g + offsetMinutesFor(g, timeZone) * 60000);
      return new Date(+g + offsetMinutesFor(candidate, timeZone) * 60000);
    };
  };

  // A part of the day with no day named means the next one still to come.
  if (dayPart && !explicitDate && !immediate && !conflictingDayParts && !excludedDayPart) {
    const ends = wallOn(0)(PART_HOURS[dayPart][1]);
    first = last = +ends > +now ? 0 : 1;
    explicitDate = true;
    assumptions.push(first === 0 ? `Taking this ${dayPart}.` : `Taking tomorrow ${dayPart === "lunch" ? "at lunch" : dayPart}.`);
  }

  let start = dayBoundsInZone(civilDayOffsetIn(now, first, timeZone), timeZone)[0];
  let end = dayBoundsInZone(civilDayOffsetIn(now, last, timeZone), timeZone)[1];
  if (immediate) {
    start = now;
    end = new Date(+now + 4 * 3600000);
    assumptions.push("Looking through the next four hours.");
  } else if (!explicitDate)
    assumptions.push(DEFAULT_HORIZON_NOTE);

  if (dayPart && first === last && !immediate && !conflictingDayParts && !excludedDayPart) {
    const [a, b] = PART_HOURS[dayPart];
    const wall = wallOn(first);
    start = wall(a);
    end = wall(b);
    const clock = (h: number) => `${Math.floor(h)}:${h % 1 ? "30" : "00"}`;
    assumptions.push(
      `${dayPart[0].toUpperCase() + dayPart.slice(1)} means ${clock(a)}–${clock(b)}.`,
    );
  } else if (dayPart && first !== last && !immediate)
    unresolved.push(
      "Choose one day for this time-of-day restriction, or set exact search bounds.",
    );

  // Clock times on a single day: a range ("9am to noon", "2-4pm") becomes the
  // window, and the session's length when none was given; a bound ("before 5",
  // "after 3pm") trims one end. An hour with no am/pm reads as afternoon from
  // 1 to 7, the hours people mean without saying; any other bare hour asks.
  const hourValue = (h: string, mm: string | undefined, mer: string | undefined): number | null => {
    if (h === "noon") return 12;
    if (h === "midnight") return 24;
    let n = Number(h);
    if (n < 1 || n > 12) return null;
    if (mer === "pm" && n < 12) n += 12;
    else if (mer === "am" && n === 12) n = 0;
    else if (!mer) { if (n >= 1 && n <= 7) n += 12; else if (n !== 12) return null; }
    return n + (mm ? Number(mm) / 60 : 0);
  };
  // A clock time with no day named means today while it is still ahead, and
  // tomorrow once it has passed, the same rule as a part of the day.
  const clockAhead = /\b(?:(?:before|by|until|till|after|from)\s+(?:\d{1,2}|noon)|\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:-|to|until|till))/.test(normalized);
  if (clockAhead && !explicitDate && !immediate) {
    const bareHour = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(normalized.slice(normalized.search(/\b(?:before|by|until|till|after|from|\d)/)));
    const h = bareHour ? Number(bareHour[1]) % 12 + ((bareHour[3] === "pm" || (!bareHour[3] && Number(bareHour[1]) <= 7)) ? 12 : 0) : 24;
    first = last = +wallOn(0)(h) > +now ? 0 : 1;
    start = dayBoundsInZone(civilDayOffsetIn(now, first, timeZone), timeZone)[0];
    end = dayBoundsInZone(civilDayOffsetIn(now, last, timeZone), timeZone)[1];
    explicitDate = true;
    const dflt = assumptions.indexOf(DEFAULT_HORIZON_NOTE);
    if (dflt >= 0) assumptions.splice(dflt, 1);
  }
  const singleDay = first === last && !immediate;
  const range = /\b(?:from\s+)?(\d{1,2}|noon)(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to|until|till)\s*(\d{1,2}|noon|midnight)(?::(\d{2}))?\s*(am|pm)?\b/.exec(normalized);
  if (range && singleDay && (range[3] || range[6] || /noon|midnight/.test(range[0]))) {
    let endMer = range[6], startMer = range[3];
    if (!startMer && endMer && range[1] !== "noon") {
      const e = Number(range[4]) % 12 + (endMer === "pm" ? 12 : 0);
      startMer = Number(range[1]) % 12 + (endMer === "pm" ? 12 : 0) <= e ? endMer : "am";
    }
    if (!endMer && startMer && !/noon|midnight/.test(range[4])) endMer = Number(range[4]) <= Number(range[1]) ? "pm" : startMer;
    const a = hourValue(range[1], range[2], startMer ?? "am"), b = hourValue(range[4], range[5], endMer ?? "pm");
    if (a != null && b != null && b > a) {
      const wall = wallOn(first);
      start = wall(a);
      end = wall(b);
      if (!durationMinutes) durationMinutes = Math.round((b - a) * 60);
      consume(range);
    }
  } else {
    const bound = /\b(before|by|until|till|after|from)\s+(\d{1,2}|noon)(?::(\d{2}))?\s*(am|pm)?\b/.exec(normalized);
    const h = bound ? hourValue(bound[2], bound[3], bound[4]) : null;
    if (bound && h != null && singleDay) {
      const wall = wallOn(first);
      if (/^(?:after|from)$/.test(bound[1])) start = new Date(Math.max(+start, +wall(h)));
      else end = new Date(Math.min(+end, +wall(h)));
      consume(bound);
    }
  }

  if (/\b(?:every (?:day|morning|afternoon|evening|night|week|weekday)|daily|each day|weekly)\b/.test(normalized))
    unresolved.push("That repeats, so choose the first session in the search fields.");
  // "By" naming a manner ("by myself", "by hand", "by email") limits nothing.
  const MANNER = /\bby\s+(?:myself|yourself|himself|herself|ourselves|themselves|oneself|hand|email|e-mail|mail|phone|text|car|bike|bus|train|plane|foot)\b/g;
  if (
    /\b(?:after|before|between|until|by|except|weekdays|weeknights|after work|month)\b/.test(
      rest.replace(MANNER, " "),
    )
  )
    unresolved.push(
      "Please set the exact dates and times for that restriction.",
    );
  if (
    /\b(?:overnight|midnight|noon|sunrise|sunset|dawn|dusk|nights)\b/.test(rest) ||
    /\bin\s+(?:\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|a few|a couple of)\s+(?:days?|weeks?)\b/.test(rest)
  )
    unresolved.push("Please set the dates and times for that period in the search fields.");
  if (
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b/.test(
      rest,
    )
  )
    unresolved.push(
      "Please confirm the clock times or date in the search fields.",
    );
  const namedDays =
    normalized.match(
      new RegExp(`\\b(${WEEKDAYS.join("|")}|tomorrow|today)\\b`, "g"),
    ) ?? [];
  if (new Set(namedDays).size > 1)
    unresolved.push(
      "You named several days. Use Compare times or choose one search range.",
    );
  start = new Date(Math.max(+start, +now));
  if (+end <= +start)
    unresolved.push("That period has already ended. Choose a future range.");
  const civil = (date: Date) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  return {
    ...activity,
    ...(report ? { report } : {}),
    version: "1",
    timeZone,
    horizon: { start: start.toISOString(), end: end.toISOString() },
    durationMinutes,
    assumptions,
    unresolved: [...new Set(unresolved)],
    draft: {
      start: civil(start),
      end: civil(end),
      duration: durationMinutes ? String(durationMinutes) : "",
      needsRangeReview: unresolved.length > 0,
    },
  };
}
