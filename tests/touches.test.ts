import { describe, it, expect } from "vitest";
import { touchLine } from "../artifacts/tides/src/lib/touches";
import { localToday } from "../artifacts/tides/src/lib/dates";

/**
 * Touches, not gauges (home-base build 2026-08-16, ask 4).
 *
 * Partial progress on a task is the dated record of having worked on it —
 * never a percentage, and never a done-mark. These pin the trail's words so
 * the failure mode (touches quietly becoming a progress gauge, or reading as
 * completion) cannot ship silently.
 */

describe("the touch trail", () => {
  it("says nothing when there is nothing to say", () => {
    expect(touchLine(undefined)).toBeNull();
    expect(touchLine(null)).toBeNull();
    expect(touchLine({ dates: [], minutes: 0 })).toBeNull();
  });

  it("names up to three days by weekday", () => {
    // 2026-08-11 was a Tuesday, 2026-08-13 a Thursday.
    const line = touchLine({ dates: ["2026-08-11", "2026-08-13"], minutes: 55 })!;
    expect(line).toBe("worked on · Tue · Thu");
  });

  it("calls today today", () => {
    const line = touchLine({ dates: [localToday()], minutes: 20 })!;
    expect(line).toBe("worked on · today");
  });

  it("collapses a long trail to a count", () => {
    const line = touchLine({ dates: ["2026-08-04", "2026-08-06", "2026-08-08", "2026-08-11"], minutes: 0 })!;
    expect(line).toBe("worked on · 4 days recently");
  });

  it("is never a gauge and never a done-mark", () => {
    const trails = [
      { dates: ["2026-08-11"], minutes: 30 },
      { dates: ["2026-08-04", "2026-08-06", "2026-08-08", "2026-08-11", "2026-08-12"], minutes: 300 },
    ];
    for (const t of trails) {
      const line = touchLine(t)!;
      expect(line).not.toMatch(/%/);
      expect(line.toLowerCase()).not.toMatch(/\bdone\b|\bfinished\b|\bcomplete/);
    }
  });
});
