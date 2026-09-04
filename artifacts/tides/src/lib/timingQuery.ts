import { parseWhen } from "./parseWhen";
import { addDaysLocal, localDateStr } from "./dates";

/** Browser-local civil input. The resulting request always carries its IANA zone. */
export function interpretTimingRange(text: string, now: Date) {
  const today = localDateStr(now);
  const parsed = parseWhen(text, today);
  let first = parsed.dueDate ?? today;
  let last = parsed.dueDate ?? addDaysLocal(today, 6);
  if (/\bthis weekend\b/i.test(text)) {
    const dow = now.getDay();
    first = addDaysLocal(today, dow === 0 ? 0 : (6 - dow + 7) % 7);
    last = dow === 0 ? first : addDaysLocal(first, 1);
  }
  const duration =
    /\b(\d+(?:\.\d+)?|one|two|three|four)[ -]*(hours?|hrs?|minutes?|mins?)\b/i.exec(
      text,
    );
  const number = duration
    ? ({ one: 1, two: 2, three: 3, four: 4 }[duration[1].toLowerCase()] ??
      Number(duration[1]))
    : null;
  const minutes =
    duration && number ? number * (/^(h)/i.test(duration[2]) ? 60 : 1) : null;
  const from = new Date(`${first}T00:00:00`);
  const to = new Date(`${addDaysLocal(last, 1)}T00:00:00`);
  let start = new Date(Math.max(+from, +now));
  let end = to;
  if (/\b(now|next few hours)\b/i.test(text)) {
    start = now;
    end = new Date(+now + 4 * 3600000);
  }
  if (/\btonight\b/i.test(text))
    start = new Date(Math.max(+now, +new Date(`${today}T18:00:00`)));
  // An explicitly named evening is not a morning search. Bounds remain editable.
  const evening = /\b(date night|romantic evening|tonight)\b/i.test(text);
  if (evening && first === last)
    start = new Date(Math.max(+now, +new Date(`${first}T18:00:00`)));
  return {
    start: inputTime(start),
    end: inputTime(end),
    duration: minutes ? String(minutes) : "",
    needsRangeReview:
      /\b(month|two weeks|next week|after|before|between)\b/i.test(text) ||
      (evening && first !== last),
  };
}
export function inputTime(d: Date) {
  return `${localDateStr(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function timingIcal(
  id: number,
  title: string,
  start: string,
  end: string,
  now: Date,
) {
  const instant = (s: string) =>
    new Date(s).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const esc = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const fold = (line: string) => {
    const chunks: string[] = [];
    let current = "",
      size = 0;
    for (const char of line) {
      const n = new TextEncoder().encode(char).length;
      if (size + n > 75) {
        chunks.push(current);
        current = " ";
        size = 1;
      }
      current += char;
      size += n;
    }
    chunks.push(current);
    return chunks.join("\r\n");
  };
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Compass//Timing//EN",
    "BEGIN:VEVENT",
    `UID:window-${id}@tides.app`,
    `DTSTAMP:${instant(now.toISOString())}`,
    `DTSTART:${instant(start)}`,
    `DTEND:${instant(end)}`,
    `SUMMARY:${esc(title)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
