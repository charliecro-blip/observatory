import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { wakingSegments, isAwakeAt } from "../artifacts/api-server/src/lib/waking";

/**
 * Availability wraps, so the model has to.
 *
 * The Planner handled an overnight rhythm by discarding it:
 *
 *     if (sleep <= wake) sleep = DEFAULT_SLEEP;
 *
 * turning a stated 11:00–03:00 into 11:00–21:00. That silently contradicted
 * the dead-of-night work, which exists precisely to respect someone who says
 * they are up late — one part of the app taking them at their word while
 * another overruled it six hours early.
 */

describe("an ordinary day is one segment", () => {
  it("returns the plain interval when the day does not wrap", () => {
    expect(wakingSegments(7, 23)).toEqual([[7, 23]]);
    expect(isAwakeAt(9, 7, 23)).toBe(true);
    expect(isAwakeAt(3, 7, 23)).toBe(false);
    expect(isAwakeAt(23, 7, 23)).toBe(false);   // asleep at the boundary
  });
});

describe("a night owl's day is two segments of one civil day", () => {
  const WAKE = 11, SLEEP = 3;

  it("splits at midnight, in chronological civil-day order", () => {
    // Early morning first, because within a single civil day 00:00 precedes
    // 11:00 — and the placement scan walks segments in order.
    expect(wakingSegments(WAKE, SLEEP)).toEqual([[0, 3], [11, 24]]);
  });

  it("counts 1 AM as awake, which the old model called bedtime", () => {
    expect(isAwakeAt(1, WAKE, SLEEP)).toBe(true);
    expect(isAwakeAt(23, WAKE, SLEEP)).toBe(true);
    expect(isAwakeAt(2.5, WAKE, SLEEP)).toBe(true);
  });

  it("still refuses the hours they said they are asleep", () => {
    for (const h of [3, 5, 8, 10.5]) {
      expect(isAwakeAt(h, WAKE, SLEEP), `${h}:00`).toBe(false);
    }
  });

  it("does not silently become a 9pm bedtime", () => {
    // The specific regression: 11:00–03:00 flattened to 11:00–21:00, so
    // everything from 9pm onward vanished.
    expect(isAwakeAt(22, WAKE, SLEEP)).toBe(true);
    expect(isAwakeAt(21.5, WAKE, SLEEP)).toBe(true);
  });
});

describe("edge shapes", () => {
  it("handles an early riser", () => {
    expect(wakingSegments(5, 21)).toEqual([[5, 21]]);
    expect(isAwakeAt(5, 5, 21)).toBe(true);
  });

  it("handles a very late wake with a very late sleep", () => {
    // 14:00–06:00 — sixteen waking hours, most of them after midnight.
    expect(wakingSegments(14, 6)).toEqual([[0, 6], [14, 24]]);
    expect(isAwakeAt(5, 14, 6)).toBe(true);
    expect(isAwakeAt(7, 14, 6)).toBe(false);
  });

  it("treats equal wake and sleep as wrapping, not as a zero-length day", () => {
    // Degenerate input, but it must not produce an empty schedule silently.
    const segs = wakingSegments(9, 9);
    expect(segs.length).toBe(2);
    expect(isAwakeAt(10, 9, 9)).toBe(true);
  });
});

describe("the discard is gone from the source", () => {
  it("no longer resets an overnight bedtime to the default", () => {
    const src = readFileSync("artifacts/api-server/src/routes/plan.ts", "utf-8");
    expect(src).not.toMatch(/if \(sleep <= wake\) sleep = DEFAULT_SLEEP/);
  });

  it("uses the segments in slot building and in both hour scans", () => {
    const src = readFileSync("artifacts/api-server/src/routes/plan.ts", "utf-8");
    // One definition plus the isAwakeAt helper, then the three call sites.
    expect((src.match(/wakingSegments\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
