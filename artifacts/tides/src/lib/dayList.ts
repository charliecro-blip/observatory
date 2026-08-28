// The day's own list — what a person put on a given date, separate from what
// the sky is doing on it.
//
// Agenda used to show every sky moment and every scheduled block and nothing
// the person had written down, so it answered "what is the sky doing today"
// when the question a day view gets asked is "what am I doing today" (owner,
// 2026-08-25). This is the filter that answers the second one.

export interface DayListTask {
  id: number;
  title: string;
  dueDate?: string | null;
  done?: string;
  /** Set once the task has been given an hour. */
  planningWindowId?: number | null;
}

/**
 * Tasks that belong at the head of `dateStr`'s list.
 *
 * Two rules, both product decisions rather than conveniences:
 *
 * 1. Due on this exact date. Not "due by" — a task due Friday is Friday's
 *    business, and rolling it forward into every day between now and then is
 *    how a list turns into a backlog that reads as urgent every morning. It
 *    also means the day never invents work for itself.
 * 2. Not already holding a block. A task with an hour is already in the timed
 *    list further down; counting it twice makes the day look fuller than it is.
 *
 * Done tasks are the caller's business to exclude — this does not filter them,
 * because a "completed today" view wants exactly the ones this would drop.
 */
export function dueOnDay<T extends DayListTask>(tasks: T[], dateStr: string): T[] {
  return tasks.filter(t => t.dueDate === dateStr && !t.planningWindowId);
}

/**
 * The rest of the list, for the day you are actually standing in.
 *
 * `dueOnDay` deliberately refuses to roll a task forward, which keeps a day
 * from inventing work for itself. The cost is that a to-do with no date, or one
 * whose date has gone by, appears on no day at all — so the Agenda showed one
 * item and the other nine were nowhere (owner, 2026-08-28: "we might also add
 * things beyond the day or unsorted to a day").
 *
 * Kept as a SEPARATE list rather than merged into the day's own. What is due
 * today and what is merely outstanding are different claims, and a reader who
 * cannot tell them apart has a backlog wearing a due date.
 *
 * Only ever for today. On a past or future date these would be facts about now
 * filed under then, which is the error the Log's check-off already had to have
 * removed from it.
 */
export function alsoOpen<T extends DayListTask>(tasks: T[], dateStr: string, today: string): {
  overdue: T[];
  undated: T[];
} {
  if (dateStr !== today) return { overdue: [], undated: [] };
  const free = tasks.filter(t => !t.planningWindowId);
  return {
    overdue: free.filter(t => !!t.dueDate && t.dueDate < today),
    undated: free.filter(t => !t.dueDate),
  };
}
