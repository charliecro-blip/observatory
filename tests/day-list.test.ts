import { describe, it, expect } from "vitest";
import { dueOnDay, type DayListTask } from "../artifacts/tides/src/lib/dayList";

const t = (id: number, title: string, dueDate: string | null, planningWindowId: number | null = null): DayListTask =>
  ({ id, title, dueDate, planningWindowId });

describe("dueOnDay — the day's own list", () => {
  it("takes only tasks due on that exact date", () => {
    const out = dueOnDay([
      t(1, "Send the grant draft", "2026-08-25"),
      t(2, "Dentist", "2026-08-26"),
      t(3, "Taxes", "2026-08-24"),
    ], "2026-08-25");
    expect(out.map(x => x.title)).toEqual(["Send the grant draft"]);
  });

  it("does not roll a later task forward into today", () => {
    // "Due by" would put Friday's task on every morning between now and Friday,
    // which turns a day list into a backlog that always reads as urgent.
    const out = dueOnDay([t(1, "Friday thing", "2026-08-28")], "2026-08-25");
    expect(out).toEqual([]);
  });

  it("does not pull an overdue task into today either", () => {
    const out = dueOnDay([t(1, "Last week's thing", "2026-08-18")], "2026-08-25");
    expect(out).toEqual([]);
  });

  it("drops a task that already holds a block — it is in the timed list below", () => {
    const out = dueOnDay([
      t(1, "Scheduled already", "2026-08-25", 44),
      t(2, "No time yet", "2026-08-25", null),
    ], "2026-08-25");
    expect(out.map(x => x.title)).toEqual(["No time yet"]);
  });

  it("ignores tasks with no due date rather than assuming today", () => {
    // Compass never invents work: an undated task is not this day's business.
    const out = dueOnDay([t(1, "Someday", null), t(2, "Also someday", undefined as any)], "2026-08-25");
    expect(out).toEqual([]);
  });

  it("returns an empty list for an empty day, not a placeholder", () => {
    expect(dueOnDay([], "2026-08-25")).toEqual([]);
  });

  it("leaves done tasks to the caller", () => {
    // A "finished today" view wants exactly the ones a done-filter would drop,
    // so this helper stays out of that decision.
    const done: DayListTask = { id: 1, title: "Finished", dueDate: "2026-08-25", done: "true" };
    expect(dueOnDay([done], "2026-08-25")).toHaveLength(1);
  });

  it("compares date strings, so it cannot drift with the runner's timezone", () => {
    // Same input, no Date construction anywhere in the path.
    const tasks = [t(1, "Edge", "2026-08-25")];
    expect(dueOnDay(tasks, "2026-08-25")).toHaveLength(1);
    expect(dueOnDay(tasks, "2026-08-26")).toHaveLength(0);
  });
});
