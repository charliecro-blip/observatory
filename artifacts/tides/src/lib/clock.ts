/**
 * Parsing the clock strings the election engine emits.
 *
 * `clockOf` drops the minutes when they are zero:
 *
 *     m === 0 ? `${h} ${ampm}` : `${h}:${mm} ${ampm}`
 *
 * so an on-the-hour window arrives as "9 AM", not "9:00 AM". The consumer's
 * regex required `(\d+):\d+`, so every on-the-hour window failed to parse —
 * and the failure branch returned "afternoon", silently. Planetary hours
 * frequently begin on the hour, and part-of-day gates the availability filter,
 * so a 9 AM window was being filtered as though it were mid-afternoon.
 *
 * Two rules follow from that:
 *   1. accept every shape the system can produce, including 24-hour, in case a
 *      locale or a future formatter emits one;
 *   2. return null when genuinely unparseable, rather than guessing. A wrong
 *      part of day is worse than an absent one, because the caller can decide
 *      what to do with absence and cannot detect a confident wrong answer.
 */

export type PartOfDay = "morning" | "afternoon" | "evening";

/** 24-hour hour-of-day, or null if the string cannot be read. */
export function parseClockHour(clock: string): number | null {
  if (!clock) return null;
  const t = clock.trim();

  // 12-hour, with or without minutes: "9 AM", "9:05 PM", "12 AM".
  const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    const raw = parseInt(ampm[1], 10);
    if (raw < 1 || raw > 12) return null;
    const h = raw % 12;
    return /PM/i.test(ampm[3]) ? h + 12 : h;
  }

  // 24-hour: "09:00", "21:30".
  const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    return h >= 0 && h <= 23 ? h : null;
  }

  return null;
}

/** Null when the clock cannot be read — the caller decides, we do not guess. */
export function partOfDay(clock: string): PartOfDay | null {
  const h = parseClockHour(clock);
  if (h == null) return null;
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
