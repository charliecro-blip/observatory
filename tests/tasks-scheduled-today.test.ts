import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * "Today's tasks" must mean DUE today OR SCHEDULED today.
 *
 * The defect, found by the owner using the app (2026-08-13): a whole list
 * was dumped, woven, and committed — tasks and planning windows both
 * written — and Today still said "nothing is on today's list yet, and with
 * nothing to place, the sky has nothing to time." The tasks existed and
 * were scheduled for that afternoon. They carried no dueDate, because a
 * woven task only has one if the user typed a deadline, and the day filter
 * asked about dueDate alone.
 *
 * Verified against a live database before this test was written: the same
 * committed task returned 0 rows under the old filter and 1 under the new.
 * These assertions pin the SHAPE of the fix so a future refactor cannot
 * quietly narrow the question back to deadlines.
 */

const src = readFileSync(join(process.cwd(), "artifacts/api-server/src/routes/tasks.ts"), "utf-8");

describe("today's tasks include what is scheduled today", () => {
  it("reaches through the planning window, not just the due date", () => {
    expect(src).toMatch(/planning_windows pw/);
    expect(src).toMatch(/pw\.id = \$\{tasks\.planningWindowId\}/);
    // Both halves of the question, in one condition.
    expect(src).toMatch(/\$\{tasks\.dueDate\} = \$\{date\} OR EXISTS/);
  });

  it("bounds the day by the viewer's offset rather than the server's", () => {
    // The recurring bug class in this codebase is server-tz/viewer-tz
    // confusion; a local day is not a UTC day and the server cannot guess.
    expect(src).toMatch(/tzMin/);
    expect(src).toMatch(/tzMin \* 60000/);
    expect(src).toMatch(/startMs \+ 86400000/);
  });

  it("falls back to the due-date-only question when no offset is sent", () => {
    // An older client that sends no tz must not receive a day computed in
    // the server's zone — it gets the narrower, still-true answer instead.
    expect(src).toMatch(/Number\.isFinite\(tzMin\)/);
    expect(src).toMatch(/else \{\s*conds\.push\(eq\(tasks\.dueDate, date\)\);/);
  });

  it("is asked for with a tz by EVERY surface that reads today's tasks", () => {
    // These share one cache key. If one of them omits tz they fetch different
    // sets under the same key and disagree on screen.
    //
    // The readers are FOUND, not listed. This named Today.tsx and the Rail
    // until Today retired and its copy moved into hooks/useHomeData — and a
    // named list is the wrong shape for a test whose whole subject is "every
    // reader of this key agrees", since a new reader would never be noticed.
    const readers: string[] = [];
    for (const dir of ["components", "pages", "hooks"]) {
      for (const f of readdirSync(join(process.cwd(), "artifacts/tides/src", dir))) {
        if (!/\.tsx?$/.test(f)) continue;
        const rel = `artifacts/tides/src/${dir}/${f}`;
        const client = readFileSync(join(process.cwd(), rel), "utf-8");
        if (/queryKey: \["tasks-today"/.test(client)) readers.push(rel);
      }
    }
    expect(readers.length, "nothing reads the tasks-today key any more").toBeGreaterThan(1);
    for (const rel of readers) {
      const client = readFileSync(join(process.cwd(), rel), "utf-8");
      expect(client, `${rel} asks without a tz`).toMatch(/api\/tasks\?date=\$\{today\}&tz=\$\{/);
      // The offset must be IN the key, however the file spells it — a value
      // the response depends on that the key omits serves a stale answer.
      expect(client, `${rel} leaves the offset out of the cache key`)
        .toMatch(/queryKey: \["tasks-today", testerId, today, (?:tz|new Date\(\)\.getTimezoneOffset\(\))\]/);
    }
  });
});
