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
  let first = 0,
    last = 6,
    explicitDate = false;
  if (/\bthis weekend\b/.test(normalized)) {
    first = dow === 0 ? 0 : (6 - dow + 7) % 7;
    last = dow === 0 ? 0 : first + 1;
    explicitDate = true;
  } else if (/\bnext weekend\b/.test(normalized)) {
    first = dow === 0 ? 6 : ((6 - dow + 7) % 7) + 7;
    last = first + 1;
    explicitDate = true;
    assumptions.push(
      "Next weekend means the Saturday and Sunday of next calendar week.",
    );
  } else if (/\bday after tomorrow\b/.test(normalized)) {
    first = last = 2;
    explicitDate = true;
  } else if (/\b(?:tomorrow|tmrw|tmr)\b/.test(normalized)) {
    first = last = 1;
    explicitDate = true;
  } else if (/\b(?:today|tonight)\b/.test(normalized)) {
    first = last = 0;
    explicitDate = true;
  } else {
    const weekday = new RegExp(
      `\\b(?:(next|this) )?(${WEEKDAYS.join("|")}|mon|tue|wed|thu|fri)\\b`,
    ).exec(normalized);
    if (weekday) {
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
  let start = dayBoundsInZone(
    civilDayOffsetIn(now, first, timeZone),
    timeZone,
  )[0];
  let end = dayBoundsInZone(civilDayOffsetIn(now, last, timeZone), timeZone)[1];
  const immediate = /\b(?:now|next few hours)\b/.test(normalized);
  if (immediate) {
    start = now;
    end = new Date(+now + 4 * 3600000);
    assumptions.push("Looking through the next four hours.");
  } else if (!explicitDate)
    assumptions.push("Looking from now through the next seven calendar days.");
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
  }
  if (/\b(?:an hour|a hour)\b/.test(normalized) && !durationMinutes)
    durationMinutes = 60;
  const dayParts = normalized.match(/\b(?:morning|afternoon|evening|tonight)\b/g) ?? [];
  const dayPart = dayParts[0];
  // Never treat the first recognized fragment as the whole constraint.
  const conflictingDayParts = new Set(dayParts.map((part) => part === "tonight" ? "evening" : part)).size > 1;
  const excludedDayPart = /\b(?:not|avoid|excluding|except)\b[^,.!?]*\b(?:morning|afternoon|evening|tonight)\b/.test(normalized);
  if (conflictingDayParts || excludedDayPart)
    unresolved.push("Choose the time range you want to include in the search fields.");
  if (immediate && (explicitDate || dayPart))
    unresolved.push("Choose whether to search now or during the other period you named.");
  if (dayPart && first === last && !immediate && !conflictingDayParts && !excludedDayPart) {
    const [a, b] =
      dayPart === "morning"
        ? [7, 12]
        : dayPart === "afternoon"
          ? [12, 18]
          : [18, 23];
    const date = dayKeyInZone(start, timeZone);
    const wall = (hour: number) => {
      const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
      const candidate = new Date(
        +guess + offsetMinutesFor(guess, timeZone) * 60000,
      );
      return new Date(+guess + offsetMinutesFor(candidate, timeZone) * 60000);
    };
    start = wall(a);
    end = wall(b);
    assumptions.push(
      `${dayPart === "tonight" ? "Evening" : dayPart[0].toUpperCase() + dayPart.slice(1)} means ${a}:00–${b}:00.`,
    );
  } else if (dayPart && first !== last && !immediate)
    unresolved.push(
      "Choose one day for this time-of-day restriction, or set exact search bounds.",
    );
  if (
    /\b(?:after|before|between|until|by|except|weekdays|weeknights|after work|lunch|month|next week)\b/.test(
      normalized.replace("day after tomorrow", ""),
    )
  )
    unresolved.push(
      "Please set the exact dates and times for that restriction.",
    );
  if (
    /\b(?:overnight|midnight|noon|sunrise|sunset|dawn|dusk|night|nights|this week)\b/.test(normalized) ||
    /\bin\s+(?:\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|a few|a couple of)\s+(?:days?|weeks?)\b/.test(normalized)
  )
    unresolved.push("Please set the dates and times for that period in the search fields.");
  if (
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b/.test(
      normalized,
    )
  )
    unresolved.push(
      "Please confirm the clock times or date in the search fields.",
    );
  if (
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|sep|oct|nov|dec)\s+\d/.test(
      normalized,
    )
  )
    unresolved.push("Please enter that calendar date in the search fields.");
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
