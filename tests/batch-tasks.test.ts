import { describe, it, expect } from "vitest";
import { batchShortTasks, SHORT_MINUTES, MAX_BATCH_SIZE, MAX_BATCH_MINUTES } from "../artifacts/api-server/src/lib/batchTasks";

const T = (title: string, estimatedMinutes: number, element: string | null = "air", dueDate: string | null = null) =>
  ({ title, estimatedMinutes, dueDate, assoc: { element, windowType: "admin", planets: [] } });

describe("gathering the small things", () => {
  it("puts several short tasks in one batch", () => {
    const { batches, loose } = batchShortTasks([T("a", 5), T("b", 5), T("c", 10)]);
    expect(batches).toHaveLength(1);
    expect(batches[0].members.map(m => m.title)).toEqual(["a", "b", "c"]);
    expect(batches[0].estimatedMinutes).toBe(20);
    expect(loose).toEqual([]);
  });

  it("leaves long work alone", () => {
    const { batches, loose } = batchShortTasks([T("write the report", 120), T("a", 5), T("b", 5)]);
    expect(loose.map(t => t.title)).toEqual(["write the report"]);
    expect(batches[0].members).toHaveLength(2);
  });

  it("never makes a batch of one — that is just a task", () => {
    const { batches, loose } = batchShortTasks([T("only short thing", 5), T("long", 90)]);
    expect(batches).toEqual([]);
    expect(loose.map(t => t.title).sort()).toEqual(["long", "only short thing"]);
  });

  it("does not mix elemental lanes", () => {
    // "deep feeling work and two errands" is not a block, and the weaver would
    // have no lane to place it in.
    const { batches } = batchShortTasks([T("errand", 5, "air"), T("call mum", 5, "water"), T("email", 5, "air")]);
    expect(batches).toHaveLength(1);
    expect(batches[0].members.map(m => m.title)).toEqual(["errand", "email"]);
  });

  it("groups the unassigned together, because that is one answer and not four", () => {
    const { batches } = batchShortTasks([T("x", 5, null), T("y", 5, null)]);
    expect(batches).toHaveLength(1);
    expect(batches[0].members).toHaveLength(2);
  });

  it("takes the earliest deadline any member carries", () => {
    // A batch that outran one of its own members' due dates would make the
    // grouping cost something.
    const { batches } = batchShortTasks([T("a", 5, "air", "2026-09-10"), T("b", 5, "air", "2026-09-02")]);
    expect(batches[0].dueDate).toBe("2026-09-02");
  });

  it("keeps an undated batch undated", () => {
    expect(batchShortTasks([T("a", 5), T("b", 5)]).batches[0].dueDate).toBeNull();
  });

  it("splits at the size cap rather than making one unreadable card", () => {
    const many = Array.from({ length: MAX_BATCH_SIZE + 2 }, (_, i) => T(`t${i}`, 5));
    const { batches, loose } = batchShortTasks(many);
    expect(batches[0].members).toHaveLength(MAX_BATCH_SIZE);
    // The remaining two are still enough for a second batch.
    expect(batches[1].members).toHaveLength(2);
    expect(loose).toEqual([]);
  });

  it("splits at the duration cap", () => {
    const many = Array.from({ length: 6 }, (_, i) => T(`t${i}`, 20));
    const { batches } = batchShortTasks(many);
    for (const b of batches) expect(b.estimatedMinutes).toBeLessThanOrEqual(MAX_BATCH_MINUTES);
  });

  it("preserves the order the person wrote them in", () => {
    const { batches } = batchShortTasks([T("first", 5), T("second", 5), T("third", 5)]);
    expect(batches[0].members.map(m => m.title)).toEqual(["first", "second", "third"]);
  });

  it("loses nothing — every task comes back somewhere", () => {
    const input = [T("a", 5), T("b", 5), T("c", 200), T("d", 5, "fire"), T("e", 0)];
    const { batches, loose } = batchShortTasks(input);
    const out = [...batches.flatMap(b => b.members), ...loose].map(t => t.title).sort();
    expect(out).toEqual(input.map(t => t.title).sort());
  });

  it("treats a zero or missing estimate as not short, rather than as five minutes", () => {
    const { batches, loose } = batchShortTasks([T("unknown", 0), T("a", 5), T("b", 5)]);
    expect(loose.map(t => t.title)).toContain("unknown");
    expect(batches[0].members.map(m => m.title)).toEqual(["a", "b"]);
  });

  it("uses the threshold it documents", () => {
    const { batches } = batchShortTasks([T("at", SHORT_MINUTES), T("over", SHORT_MINUTES + 1), T("also at", SHORT_MINUTES)]);
    expect(batches[0].members.map(m => m.title)).toEqual(["at", "also at"]);
  });
});
