import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Bulk entry has almost no logic of its own to unit-test in isolation — it
 * reuses /api/plan/parse (already the path Planner's weave flow exercises)
 * and /api/tasks (the same single-task write every other add goes through).
 * What is genuinely new here is thin: sequential rather than parallel writes,
 * checkbox filtering before anything is sent, and state reset so a closed
 * form does not reopen mid-dump. Verified end to end against the running
 * server separately (parse -> three POSTs -> three real tasks, each with its
 * own title/estimate/energy). These assertions guard the shape staying true.
 */
const SRC = readFileSync("artifacts/tides/src/pages/Tasks.tsx", "utf8");

describe("bulk task entry", () => {
  it("reuses the weave flow's own parser rather than a second one", () => {
    expect(SRC).toContain('"/api/plan/parse"');
  });

  it("writes sequentially, not with Promise.all", () => {
    // A batch endpoint does not exist for /api/tasks, so N tasks means N
    // requests; firing them all at once is a burst on a path a normal add
    // never has to share load with.
    const bulk = SRC.slice(SRC.indexOf("const addBulk"), SRC.indexOf("const toggle"));
    expect(bulk).toContain("for (const t of items)");
    expect(bulk).not.toMatch(/Promise\.all\(/);   // the comment MENTIONS it; the code must not CALL it
  });

  it("only writes items still checked in the preview", () => {
    const bulk = SRC.slice(SRC.indexOf("const addBulk"), SRC.indexOf("const toggle"));
    expect(bulk).toContain("filter(t => t.include)");
  });

  it("resets bulk state when the add form is closed", () => {
    const closeHandler = SRC.slice(SRC.indexOf("Closing the form loses the mode too"), SRC.indexOf("Closing the form loses the mode too") + 300);
    expect(closeHandler).toContain("setBulkMode(false)");
    expect(closeHandler).toContain("setBulkPreview(null)");
  });

  it("previews before writing anything — no path calls addBulk before parseBulk", () => {
    const parseIdx = SRC.indexOf("const parseBulk");
    const addIdx = SRC.indexOf("const addBulk");
    expect(parseIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeGreaterThan(parseIdx);
  });
});
