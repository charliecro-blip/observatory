// Flow protection — the one thing a stateless timing engine cannot do alone.
//
// Compass recomputes from the sky on every render. That is deliberate and it
// is why the readings are reproducible. But it means the engine has no memory
// of what you are doing, so "strongest fit right now" will cheerfully propose
// switching you off work already underway — and for an app opened several
// times a day, interrupting flow is the most expensive mistake available to
// it. Every check-in is a chance to be told to do something else.
//
// One fact fixes it: when you started. Everything here is derived from that.
//
// The hard question is when a start stops counting. The app cannot observe
// that you stopped — nobody marks "I gave up at 3:40" — so an open start
// stamp would otherwise pin the recommendation forever. Two bounds, both
// deliberately conservative:
//
//   1. A hard ceiling, so a task started this morning and abandoned does not
//      claim the slot all evening.
//   2. Same calendar day, so an overnight gap never reads as continuous work
//      even if the clock arithmetic happens to fall inside the ceiling.
//
// Erring short is correct: failing to say "keep going" costs a nudge, while
// wrongly insisting you are mid-flow contradicts what the user can plainly
// see and makes the app look like it is guessing.

export interface StartedTask {
  id: number;
  title: string;
  done?: string;
  /** ISO instant, or null when never started / already finished. */
  startedAt?: string | null;
}

export interface InProgress {
  task: StartedTask;
  /** Whole minutes since it began — the phrase "22 min in" comes from here. */
  minutes: number;
}

/**
 * How long a start stamp keeps counting. Two hours is longer than a planetary
 * hour (~60 min), so a single sitting is never cut off mid-way, and short
 * enough that a forgotten stamp expires within the same part of the day.
 */
export const IN_PROGRESS_CEILING_MIN = 120;

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * The task you are currently inside of, or null.
 *
 * When several qualify — you started two things and finished neither — the
 * MOST RECENT wins. It is the better guess at what is actually on screen in
 * front of you, and it is the one the user most recently chose.
 */
export function currentlyInProgress(
  tasks: StartedTask[] | undefined,
  at: Date = new Date(),
): InProgress | null {
  let best: InProgress | null = null;
  for (const task of tasks ?? []) {
    if (!task.startedAt) continue;
    if (task.done === "true") continue;           // finished is not in progress
    const began = new Date(task.startedAt);
    if (Number.isNaN(began.getTime())) continue;  // bad data costs this row, not the feature
    const minutes = Math.floor((at.getTime() - began.getTime()) / 60000);
    if (minutes < 0) continue;                    // clock skew — a future start is not underway
    if (minutes > IN_PROGRESS_CEILING_MIN) continue;
    if (!sameLocalDay(began, at)) continue;
    if (!best || began > new Date(best.task.startedAt!)) best = { task, minutes };
  }
  return best;
}

/** "just started" / "22 min in" / "1h 5m in" — said plainly, never rounded up. */
export function elapsedLabel(minutes: number): string {
  if (minutes < 1) return "just started";
  if (minutes < 60) return `${minutes} min in`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m === 0 ? `${h}h in` : `${h}h ${m}m in`;
}
