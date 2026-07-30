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

/**
 * Is the user typically awake for this window? Uses the chronotype's
 * wake/sleep times; handles wrap-around (a night owl sleeping at 02:00 is
 * awake 11:00→26:00). Permissive when unset — same rule as free windows:
 * optional onboarding data never hides a feature.
 */
export function isAwakeDuring(
  win: { startAt: string; endAt: string },
  chronotype: Chronotype | undefined,
): boolean {
  if (!chronotype?.wakeTime || !chronotype?.sleepTime) return true;
  const midMin = (toMinutesOfDay(win.startAt) + toMinutesOfDay(win.endAt)) / 2;
  const wake = toWindowMinutes(chronotype.wakeTime);
  const sleep = toWindowMinutes(chronotype.sleepTime);
  if (wake === sleep) return true;
  return sleep > wake
    ? midMin >= wake && midMin < sleep            // normal day: awake wake→sleep
    : midMin >= wake || midMin < sleep;           // wraps midnight
}

/**
 * Which half of the daily ritual loop we're in — "Cast off" in the morning,
 * "Log the day" in the evening, nothing in between.
 *
 * This used to read the wall clock (`<12` morning, `>=18` evening), which is
 * only right for someone who keeps office hours. A night owl who wakes at 11
 * and sleeps at 3 got the morning card handed to them at 07:00 while they were
 * asleep, and never saw the evening card at all — their whole evening happens
 * after midnight. So the loop is anchored to the person's own day instead:
 *
 *   morning — the first 4h after waking
 *   evening — the last 3h before sleep
 *
 * plus two grace periods, because a ritual that vanishes the moment you're off
 * schedule is worse than no ritual: an hour *before* the usual wake time still
 * counts as morning (you're up early, the day is starting), and two hours
 * *past* bedtime still counts as evening (you're up late and haven't logged).
 *
 * Both pairs are compressed proportionally rather than allowed to overlap when
 * the day (or the night) is too short to hold them at full length.
 *
 * Wall-clock is the fallback, and only the fallback — unchanged for anyone who
 * skipped the optional chronotype step, so this never withholds the ritual from
 * a user who declined to hand over their sleep schedule.
 */
export type RitualPhase = "morning" | "evening" | null;

const MORNING_SPAN = 240; // 4h from waking
const EVENING_SPAN = 180; // the last 3h before sleep
const EARLY_GRACE = 60;   // up before the alarm — still morning
const LATE_GRACE = 120;   // up past bedtime — still evening

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function ritualPhase(
  chronotype: Chronotype | undefined,
  now: Date = new Date(),
): RitualPhase {
  const wake = chronotype?.wakeTime ? toWindowMinutes(chronotype.wakeTime) : NaN;
  const sleep = chronotype?.sleepTime ? toWindowMinutes(chronotype.sleepTime) : NaN;

  // No usable schedule (unset, malformed, or a degenerate 24h day) → the old
  // wall-clock rule, verbatim.
  if (!Number.isFinite(wake) || !Number.isFinite(sleep) || wake === sleep) {
    const h = now.getHours();
    return h < 12 ? "morning" : h >= 18 ? "evening" : null;
  }

  const awake = mod(sleep - wake, 1440);
  const night = 1440 - awake;
  // Share out proportionally when there isn't room for both at full length,
  // so the two never overlap and a short day still gets both halves.
  const share = (span: number, total: number, of: number) => Math.min(span, (of * span) / total);
  const morningLen = share(MORNING_SPAN, MORNING_SPAN + EVENING_SPAN, awake);
  const eveningLen = share(EVENING_SPAN, MORNING_SPAN + EVENING_SPAN, awake);
  const lateGrace = share(LATE_GRACE, LATE_GRACE + EARLY_GRACE, night);
  const earlyGrace = share(EARLY_GRACE, LATE_GRACE + EARLY_GRACE, night);

  // Minutes since waking, which linearises the wrap past midnight: [0, awake)
  // is the waking day, [awake, 1440) is the night.
  const since = mod(now.getHours() * 60 + now.getMinutes() - wake, 1440);

  if (since < morningLen) return "morning";
  if (since >= awake - eveningLen && since < awake + lateGrace) return "evening";
  if (since >= 1440 - earlyGrace) return "morning";
  return null;
}

/**
 * The user's sleep intervals as [startHour, endHour] pairs within a 0–24 day,
 * for shading the tide chart's personal night. Empty when wake/sleep unset.
 */
export function sleepIntervals(chronotype: Chronotype | undefined): [number, number][] {
  if (!chronotype?.wakeTime || !chronotype?.sleepTime) return [];
  const wake = toWindowMinutes(chronotype.wakeTime) / 60;
  const sleep = toWindowMinutes(chronotype.sleepTime) / 60;
  if (wake === sleep) return [];
  return sleep > wake
    ? [[0, wake], [sleep, 24]]   // asleep before wake and after sleepTime
    : [[sleep, wake]];           // wraps midnight: asleep sleepTime→wake
}
