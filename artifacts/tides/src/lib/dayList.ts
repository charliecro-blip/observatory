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
