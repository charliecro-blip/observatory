// Zone 3 — YOUR DAY. An operating console, not a merged list.
//
// The old card was titled "On deck · today" and listed only scheduled windows,
// which quietly made unscheduled work invisible: if you had six things to do
// and none of them had a time on them, the card said "Nothing scheduled" and
// the day looked empty. Meanwhile "PLACED" — the label considered for the
// merged version — was wrong in the other direction, because an unscheduled
// task is definitionally not placed.
//
// Three rows, each answering a different question:
//
//   Now          what you are inside of right now
//   Next         what is coming, and when
//   Still loose  what has no time on it yet — named, not hidden
//
// "Still loose" is the row that makes the console honest. It is also
// deliberately not a nag: it reports what is true, and the count is the whole
// judgement. Nothing here schedules anything or implies it should be
// scheduled.

export interface DayWindow {
  id?: number;
  title: string;
  /** ISO instant, or "HH:MM" for a plain local time. */
  startTime: string;
  endTime?: string;
}

export interface DayTask {
  id: number;
  title: string;
  /** The API returns this as a string. */
  done?: string;
  /** ISO instant when it was picked up, if it has been. */
  startedAt?: string | null;
  /** The window this task was scheduled into. The real relation — see the
   *  note on the title join below. */
  planningWindowId?: number | null;
}

export interface YourDay {
  now: { title: string; when: string } | null;
  next: { title: string; when: string } | null;
  loose: DayTask[];
  /** True when there is genuinely nothing to show — lets the UI say so once. */
  empty: boolean;
}

/**
 * Windows arrive either as ISO instants or as bare "HH:MM" clock strings
 * depending on which surface produced them. Resolving both against the
 * reference day keeps the caller from having to know which it got.
 */
function toMs(value: string, ref: Date): number | null {
  if (!value) return null;
  const hhmm = /^(\d{1,2}):(\d{2})/.exec(value);
  if (hhmm && !value.includes("T")) {
    const d = new Date(ref);
    d.setHours(Number(hhmm[1]), Number(hhmm[2]), 0, 0);
    return d.getTime();
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

const fmt = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Loose comparison for the task↔window join. See the note in `yourDay`. */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function yourDay(
  windows: DayWindow[] | undefined,
  tasks: DayTask[] | undefined,
  at: Date = new Date(),
  /** The task currently underway, from lib/in-progress. Passed in rather than
   *  recomputed so both cards read one answer instead of two. */
  inProgress?: { id: number; title: string } | null,
): YourDay {
  const nowMs = at.getTime();

  const timed = (windows ?? [])
    .map((w) => ({ w, start: toMs(w.startTime, at), end: w.endTime ? toMs(w.endTime, at) : null }))
    .filter((x): x is { w: DayWindow; start: number; end: number | null } => x.start !== null)
    .sort((a, b) => a.start - b.start);

  // Now — the window containing this instant. A window with no end time is
  // treated as a point in time rather than as running forever, which is what
  // an open-ended end would otherwise imply.
  const current = timed.find((x) => x.start <= nowMs && x.end !== null && x.end > nowMs) ?? null;

  // Next — the earliest window still ahead. Explicitly not the current one, so
  // a long block does not occupy both rows and read as two commitments.
  const upcoming = timed.find((x) => x.start > nowMs && x !== current) ?? null;

  // A task you are actively working on is NOT loose, and it is not "next" —
  // it is what you are doing now.
  //
  // Caught on screen: the Keep-going card said "you're already in this" while
  // this card, six inches below, filed the same task under "still loose". Two
  // surfaces contradicting each other about the same fact is the exact failure
  // the week caption had, so it gets the same fix — one source, checked once.
  //
  // A real scheduled window still wins the Now row: that is a commitment made
  // in advance, whereas a start stamp is a note about what you picked up.
  const started = inProgress ?? null;

  // Still loose — open tasks not scheduled into any of today's windows.
  //
  // BY ID ONLY. This was a title join, because a task carried no reference to
  // the window scheduled from it. Title equality is not an identity relation:
  // two tasks called "Send invoice" collapsed into one, so a genuinely loose
  // task vanished from this list.
  //
  // The title comparison is GONE rather than kept as a fallback. A fallback
  // could not tell "explicitly not scheduled" from "predates the column" —
  // both read as null — so it went on swallowing the unscheduled twin. Rows
  // created before the column were backfilled once, by title, where the match
  // was unambiguous; that is a migration, not a lookup, and it does not run
  // every render.
  const windowIds = new Set(timed.map((x) => x.w.id).filter((id): id is number => id != null));
  const loose = (tasks ?? [])
    .filter((t) => t.done !== "true")
    .filter((t) => t.planningWindowId == null || !windowIds.has(t.planningWindowId))
    .filter((t) => t.id !== started?.id);

  const now = current
    ? { title: current.w.title, when: `${fmt(current.start)}–${fmt(current.end!)}` }
    : started
      ? { title: started.title, when: "in progress" }
      : null;

  return {
    now,
    next: upcoming ? { title: upcoming.w.title, when: fmt(upcoming.start) } : null,
    loose,
    empty: !now && !upcoming && loose.length === 0,
  };
}
