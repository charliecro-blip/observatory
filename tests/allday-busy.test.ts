import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROUTE = readFileSync("artifacts/api-server/src/routes/googleCal.ts", "utf8");
const PLANNER = readFileSync("artifacts/tides/src/components/Planner.tsx", "utf8");

describe("a day blocked off in Google is a day the weaver leaves alone", () => {
  it("asks the calendar whether an event occupies time", () => {
    // Google's own flag, rather than guessing from the title: an out-of-office
    // day and a friend's birthday are both all-day events.
    expect(ROUTE).toContain('busy: item.transparency !== "transparent"');
  });

  it("no longer drops every all-day event before it reaches the weaver", () => {
    expect(PLANNER).not.toContain("!e.allDay && e.start && e.end");
    expect(PLANNER).toContain("e.busy !== false");
  });

  it("treats a missing flag as busy, which is Google's own default", () => {
    // `!== false` rather than `=== true`: an event from a path that never set
    // the field must not silently become free time.
    expect(PLANNER).toContain("e.busy !== false");
    expect(PLANNER).not.toContain("e.busy === true");
  });

  it("reads a date-only bound as a local day, not a UTC instant", () => {
    // "2026-09-02" parsed directly is UTC midnight — the afternoon of the 1st
    // in Los Angeles — so the block would start seven hours early and clear
    // before the day it was meant to protect had ended.
    expect(PLANNER).toContain('new Date(`${d}T00:00:00`).toISOString()');
  });
});

describe("the local-day conversion itself", () => {
  const local = (d: string) => new Date(`${d}T00:00:00`).toISOString();

  it("spans midnight to midnight in the runner's own zone", () => {
    const startMs = Date.parse(local("2026-09-02"));
    const endMs = Date.parse(local("2026-09-03"));   // Google's end is exclusive
    expect(endMs - startMs).toBe(24 * 3600000);
  });

  it("covers every hour of the local day it names", () => {
    const startMs = Date.parse(local("2026-09-02"));
    const endMs = Date.parse(local("2026-09-03"));
    for (const hour of [0, 9, 13, 17, 23]) {
      const t = new Date(2026, 8, 2, hour, 30).getTime();
      expect(t >= startMs && t < endMs, `${hour}:30 local should be inside the block`).toBe(true);
    }
  });

  it("does not bleed into the day before", () => {
    const startMs = Date.parse(local("2026-09-02"));
    const evening = new Date(2026, 8, 1, 17, 0).getTime();
    expect(evening).toBeLessThan(startMs);
  });
});
