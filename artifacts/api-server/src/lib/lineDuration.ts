/**
 * The duration a person wrote into a to-do line, when they wrote one.
 *
 * The Planner's parse falls back to a plain line split when the model call
 * fails, and that fallback gave every line 45 minutes, so "study for herbs,
 * 90 min" was placed as a 45-minute block with the 90 still sitting in its
 * title. People do write durations inline (the owner's own list had "make dr's
 * appt (20 min)"), and reading them needs no model.
 *
 * Returns null when the line names no duration, or names a range ("1-2h"),
 * which is a question about the estimate rather than an answer to it.
 */
const UNIT = String.raw`(hours?|hrs?|h|minutes?|mins?|m)`;

export function minutesInLine(line: string): number | null {
  const s = line.toLowerCase();
  if (new RegExp(String.raw`\d\s*(?:-|–|to)\s*\d+(?:\.\d+)?\s*${UNIT}\b`).test(s)) return null;
  if (/\b(?:an?|one) hour and a half\b/.test(s)) return 90;
  if (/\bhalf an hour\b/.test(s)) return 30;
  // "1h30", "1h 30m", "2 hr 15 min"
  const hm = /\b(\d+)\s*(?:h|hrs?|hours?)\s*(\d{1,2})\s*(?:m|mins?|minutes?)?\b/.exec(s);
  if (hm) return clamp(parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10));
  const one = new RegExp(String.raw`(?:^|[^\d.])(\d+(?:\.\d+)?)\s*${UNIT}\b`).exec(s);
  if (!one) return null;
  const n = parseFloat(one[1]);
  const minutes = one[2].startsWith("h") ? n * 60 : n;
  return clamp(minutes);
}

function clamp(n: number): number | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.min(480, Math.round(n)));
}
