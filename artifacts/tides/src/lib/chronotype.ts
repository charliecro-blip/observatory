import type { Chronotype, FreeWindow, Weekday } from "@/lib/tester-profile";

const WEEKDAY_BY_JS_DAY: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function toMinutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function toWindowMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/**
 * Does a timing window (given as absolute ISO instants — startAt/endAt) overlap
 * the user's free time on that day of the week? Uses the browser's own timezone
 * to read wall-clock hours from the ISO instant, since the client running this
 * code IS the viewer — no server/offset math needed here, unlike the backend.
 *
 * Returns true (permissive) when no chronotype is set, so this never hides a
 * feature behind optional onboarding data the user may have skipped.
 */
export function isWithinFreeWindow(
  win: { startAt: string; endAt: string },
  chronotype: Chronotype | undefined,
): boolean {
  if (!chronotype) return true;
  const weekday = WEEKDAY_BY_JS_DAY[new Date(win.startAt).getDay()];
  const fw: FreeWindow | undefined = chronotype.freeWindows?.[weekday];
  if (!fw) return true;
  const s = toMinutesOfDay(win.startAt);
  const e = toMinutesOfDay(win.endAt);
  const fwStart = toWindowMinutes(fw.start);
  const fwEnd = toWindowMinutes(fw.end);
  return s < fwEnd && e > fwStart; // any overlap counts
}
