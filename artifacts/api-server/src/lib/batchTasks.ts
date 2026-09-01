/**
 * SMALL THINGS, GATHERED.
 *
 * Owner, 2026-08-31: "we also might encourage grouping similar tasks - that way
 * people can also input in like, 5 minute tasks."
 *
 * The weaver places one task per window, which quietly sets a floor on what is
 * worth entering. A five-minute errand costs a whole calendar block, so nobody
 * types it, so the list only ever holds the big things and the small ones stay
 * in your head — which is the opposite of what a planner is for.
 *
 * Batching removes the floor: several short tasks become one block, and the
 * block says what is inside it.
 *
 * WHY THIS IS MERCURIAL. A run of small movements — messages, errands, the four
 * things that each take a minute — is Mercury's own signature, and the shape
 * reader already calls anything under a quarter hour Mercurial for the same
 * reason. So a batch is not a compromise between its members' natures; it has
 * one of its own.
 *
 * WHAT IT REFUSES TO DO
 *   · Batch across elemental lanes. A block of "deep feeling work and two
 *     errands" is not a thing, and the weaver would have no lane to place it in.
 *   · Batch anything long. The point is the tasks too small to be worth a block.
 *   · Batch across deadlines it cannot honour — the batch inherits the EARLIEST
 *     due date of its members, so a Friday errand joining a Tuesday batch is
 *     scheduled by Tuesday rather than dragging the urgent one to Friday.
 *   · Make a batch of one. That is just a task.
 */

export interface BatchableTask {
  title: string;
  estimatedMinutes: number;
  dueDate?: string | null;
  energy?: string | null;
  assoc: { element: string | null; windowType: string; planets: string[] };
}

/** Tasks at or under this are the ones a block is too big for. */
export const SHORT_MINUTES = 20;
/** Beyond this a "batch" is just a long block with a vague name. */
export const MAX_BATCH_MINUTES = 90;
/** Beyond this the card stops being readable as a list of what you'll do. */
export const MAX_BATCH_SIZE = 6;

export interface Batch<T> {
  members: T[];
  title: string;
  estimatedMinutes: number;
  dueDate: string | null;
}

/** The lane a task batches within. Null-element tasks group together, since
 *  "nothing pointed anywhere" is itself a shared answer, not four different
 *  ones. */
const laneOf = (t: BatchableTask) => t.assoc.element ?? "unassigned";

/**
 * Gather the short tasks into batches, and hand back everything else untouched.
 *
 * Order within a lane is preserved, so a batch reads in the order the person
 * wrote its members rather than in whatever order the grouping happened to
 * visit them.
 */
export function batchShortTasks<T extends BatchableTask>(tasks: T[]): {
  batches: Batch<T>[];
  loose: T[];
} {
  const short = tasks.filter(t => t.estimatedMinutes > 0 && t.estimatedMinutes <= SHORT_MINUTES);
  const loose = tasks.filter(t => !(t.estimatedMinutes > 0 && t.estimatedMinutes <= SHORT_MINUTES));

  const byLane = new Map<string, T[]>();
  for (const t of short) {
    const k = laneOf(t);
    byLane.set(k, [...(byLane.get(k) ?? []), t]);
  }

  const batches: Batch<T>[] = [];
  for (const group of byLane.values()) {
    let current: T[] = [];
    let minutes = 0;
    const flush = () => {
      // A batch of one is a task. Hand it back rather than wrapping it in a
      // container that claims to hold several things.
      if (current.length >= 2) batches.push(makeBatch(current, minutes));
      else loose.push(...current);
      current = [];
      minutes = 0;
    };
    for (const t of group) {
      if (current.length >= MAX_BATCH_SIZE || minutes + t.estimatedMinutes > MAX_BATCH_MINUTES) flush();
      current.push(t);
      minutes += t.estimatedMinutes;
    }
    flush();
  }
  return { batches, loose };
}

function makeBatch<T extends BatchableTask>(members: T[], minutes: number): Batch<T> {
  // The tightest deadline any member carries. A batch that outran one of its
  // own members' due dates would have made the grouping cost something.
  const due = members
    .map(m => m.dueDate)
    .filter((d): d is string => !!d)
    .sort()[0] ?? null;
  return {
    members,
    title: `${members.length} small things`,
    estimatedMinutes: minutes,
    dueDate: due,
  };
}
