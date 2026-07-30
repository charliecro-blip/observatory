// Local-day helpers — THE fix for the 8pm-ET day rollover (audit P0 #1).
//
// `new Date().toISOString().slice(0,10)` is the UTC date: for any US-evening
// user it flips to "tomorrow" at 00:00 UTC (8pm EDT), which un-checked habits
// mid-evening, emptied the journal, reset the felt rating, and stamped
// reflections on the wrong day. Every "which day is it for the user" question
// must go through these instead. UTC slicing remains correct only for
// wire-format timestamps, never for day identity.

/** The local calendar date of `d` (default: now) as YYYY-MM-DD. */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today, as the user's wall clock sees it. */
export function localToday(): string {
  return localDateStr();
}

/** Date-string arithmetic that never leaves local-day space. */
export function addDaysLocal(dateStr: string, n: number): string {
  // Noon-anchored so DST transitions can't shift the calendar day.
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}
