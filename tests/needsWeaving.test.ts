import { describe, it, expect } from "vitest";
import { needsWeaving } from "../artifacts/api-server/src/lib/linesUp.js";

/**
 * `shape-day` and `shape-week` build their item list from the tasks table
 * directly and never checked `planningWindowId` — the exact field `linesUp`
 * already reads to exclude an already-scheduled task from its own feed. So a
 * task with a reserved block could be handed to the weaver and placed a
 * SECOND time, displacing or duplicating the slot it already holds.
 */
describe("needsWeaving", () => {
  it("excludes a task that already holds a reserved block", () => {
    expect(needsWeaving({ done: "false", planningWindowId: 412 })).toBe(false);
  });

  it("excludes a done task, unchanged from before", () => {
    expect(needsWeaving({ done: "true", planningWindowId: null })).toBe(false);
  });

  it("includes an open task with nothing reserved", () => {
    expect(needsWeaving({ done: "false", planningWindowId: null })).toBe(true);
  });

  it("excludes a done task that also holds a reservation", () => {
    expect(needsWeaving({ done: "true", planningWindowId: 7 })).toBe(false);
  });
});
