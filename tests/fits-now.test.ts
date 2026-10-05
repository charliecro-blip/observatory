import { describe, it, expect } from "vitest";
import { fitsNow } from "../artifacts/tides/src/components/FitsNow";

// Plan Part B, T6: what fits the time, energy and place you have.
const T = (id: number, title: string, extra: object = {}) => ({ id, title, done: "false", ...extra });
const base = { today: "2026-10-05", place: "anywhere", hourRuler: null } as const;

describe("what fits now", () => {
  const tasks = [
    T(1, "Study herbs", { nextStep: "open the herbs book to p. 231", energy: "medium" }),
    T(2, "Write the essay", { estMinutes: 120, energy: "high" }),
    T(3, "Call the bank", { estMinutes: 15, energy: "low", context: "phone" }),
    T(4, "Sort the garage"),                                       // no step, no length
    T(5, "Renew the license", { estMinutes: 20, dueDate: "2026-10-01", context: "computer" }),
    T(6, "Already done", { done: "true", nextStep: "x" }),
  ];

  it("a next step fits any slot; a length must fit; neither is counted, not guessed", () => {
    const r = fitsNow(tasks, { ...base, slot: 15, energy: "high" });
    expect(r.fit.map(x => x.task.id)).toEqual([1, 3]);
    expect(r.unclarified).toBe(1);
  });

  it("asks no more energy than you have, and doesn't guess an energy nobody set", () => {
    expect(fitsNow(tasks, { ...base, slot: 60, energy: "low" }).fit.map(x => x.task.id)).toEqual([5, 3]);
    expect(fitsNow(tasks, { ...base, slot: 60, energy: "high" }).fit.map(x => x.task.id)).toContain(2);
  });

  it("keeps a task tied to another place out, and an unplaced one in", () => {
    const r = fitsNow(tasks, { ...base, slot: 60, energy: "high", place: "home" });
    expect(r.fit.map(x => x.task.id)).toEqual([1, 2]);
  });

  it("leads with next steps, then what is past its date or due today", () => {
    const r = fitsNow(tasks, { ...base, slot: 60, energy: "high" });
    expect(r.fit.map(x => x.task.id)).toEqual([1, 5, 3, 2]);
    expect(r.fit.find(x => x.task.id === 5)!.why).toContain("past its date");
  });

  it("names the hour only when it is given one", () => {
    const withHour = fitsNow([T(7, "Email Sam", { estMinutes: 10, planet: "Mercury" })], { ...base, slot: 15, energy: "low", hourRuler: "Mercury" });
    expect(withHour.fit[0].why).toContain("the Mercury hour suits it");
    expect(fitsNow([T(7, "Email Sam", { estMinutes: 10, planet: "Mercury" })], { ...base, slot: 15, energy: "low" }).fit[0].why).toEqual(["about 10 min"]);
  });

  it("offers a task with open steps through its steps, under its name", () => {
    const r = fitsNow([
      T(10, "Clean the garage"),
      T(11, "carry one box to the curb", { parentId: 10 }),
      T(12, "sweep the floor", { parentId: 10, done: "true" }),
    ], { ...base, slot: 15, energy: "low" });
    expect(r.fit.map(x => x.task.id)).toEqual([11]);
    expect(r.fit[0]).toMatchObject({ step: "carry one box to the curb", parentTitle: "Clean the garage" });
    expect(r.unclarified).toBe(0);
  });
});
