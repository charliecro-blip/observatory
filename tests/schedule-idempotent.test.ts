import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The route needs a live database, so this pins the guard's shape. The
// behaviour itself was verified against the running server on 2026-08-31:
// three POSTs for one task returned 201, 200, 200 and left a single window,
// and a fourth with a new time moved that same window's id rather than adding
// a second.
const SRC = readFileSync("artifacts/api-server/src/routes/planning.ts", "utf8");

// Scoped to the one handler. `const [inserted]` appears four times in this
// file and the first is in a different route entirely, so a whole-file
// indexOf compares positions in unrelated code and quietly passes.
const START = SRC.indexOf('router.post("/planning/windows"');
const HANDLER = SRC.slice(START, SRC.indexOf("router.", START + 10));

describe("scheduling a task twice moves it, it does not clone it", () => {
  it("is looking at the right handler", () => {
    expect(START).toBeGreaterThan(-1);
    expect(HANDLER).toContain("A TASK HAS ONE TIME");
    expect(HANDLER.length).toBeGreaterThan(500);
  });

  it("checks for an existing window before inserting", () => {
    const guard = HANDLER.indexOf("owned?.planningWindowId");
    const insert = HANDLER.indexOf("db.insert(planningWindows)");
    expect(guard).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(guard, "the guard has to run BEFORE the insert").toBeLessThan(insert);
  });

  it("updates that window rather than making another", () => {
    expect(HANDLER).toContain("db.update(planningWindows)");
    expect(HANDLER).toMatch(/eq\(planningWindows\.id, owned\.planningWindowId\)/);
  });

  it("scopes both lookups to the caller", () => {
    // A taskId belonging to somebody else must match nothing and move nothing.
    expect(HANDLER).toContain("eq(tasks.testerId, testerId)");
    expect(HANDLER).toContain("eq(planningWindows.testerId, testerId)");
  });

  it("still inserts when the link points at a window that no longer exists", () => {
    // A deleted window leaves a dangling planningWindowId; answering with an
    // empty body there would be worse than the bug being fixed.
    expect(HANDLER).toContain("if (moved)");
  });

  it("leaves ad-hoc sessions alone — they are logged, not scheduled", () => {
    const guard = HANDLER.slice(HANDLER.indexOf("A TASK HAS ONE TIME"), HANDLER.indexOf("db.insert(planningWindows)"));
    expect(guard).toContain("!adHoc");
  });
});
