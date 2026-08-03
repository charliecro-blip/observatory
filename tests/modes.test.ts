import { describe, it, expect } from "vitest";
import { framingFor, modeFrom, type DayMode } from "../artifacts/tides/src/lib/modes";
import { ritualPhase } from "../artifacts/tides/src/lib/chronotype";

/**
 * Four zones, three temporal modes.
 *
 * Ritual and review used to be extra cards stacked above the dashboard, so a
 * morning check-in meant reading the ritual block and then reading the same
 * day again underneath it. The mode reframes the existing zones instead.
 *
 * The framing changes; the data does not. That separation is what these tests
 * protect — plus the rule that the mode follows the user's own hours, because
 * telling a night owl at 1am that it is "morning" is worse than not reframing.
 */

const MODES: DayMode[] = ["morning", "ordinary", "evening"];

describe("every mode is fully framed", () => {
  it("gives all four labels in all three modes", () => {
    for (const m of MODES) {
      const f = framingFor(m);
      for (const [k, v] of Object.entries(f)) {
        expect(typeof v, `${m}.${k}`).toBe("string");
        expect(v.length, `${m}.${k} empty`).toBeGreaterThan(3);
      }
    }
  });

  it("actually says something different in each mode", () => {
    // A mode table whose rows are near-identical is decoration. Each zone's
    // label must be distinct across all three.
    for (const key of ["moveLabel", "dayLabel", "aheadLabel"] as const) {
      const seen = MODES.map((m) => framingFor(m)[key]);
      expect(new Set(seen).size, `${key} repeats across modes: ${seen.join(" | ")}`).toBe(3);
    }
  });

  it("offers carrying as a real option in the evening, not a failure", () => {
    // Deciding to continue tomorrow is a decision. An evening frame that only
    // said "finish" would turn an ordinary choice into a missed target.
    expect(framingFor("evening").moveLabel).toMatch(/carry/i);
  });

  it("does not ask the evening where to start", () => {
    expect(framingFor("evening").moveLabel).not.toMatch(/start|begin/i);
  });

  it("distinguishes an empty morning from an empty evening", () => {
    // "Nothing on today" reads as an open day at 8am and as a wasted one at
    // 9pm. Same fact, two different things to say about it.
    expect(framingFor("morning").dayEmpty).not.toBe(framingFor("evening").dayEmpty);
  });
});

describe("the long middle of the day is a mode, not a gap", () => {
  it("treats a null ritual phase as ordinary", () => {
    expect(modeFrom(null)).toBe("ordinary");
    expect(modeFrom(undefined)).toBe("ordinary");
    expect(modeFrom("morning")).toBe("morning");
    expect(modeFrom("evening")).toBe("evening");
  });
});

describe("the mode follows the user's hours, not the clock", () => {
  it("does not call a night owl's 1am 'morning'", () => {
    // The reason this maps from ritualPhase rather than from getHours():
    // a night owl (wake 11:00, sleep 03:00) is mid-evening at 1am, and the
    // wall clock would frame it as the start of their day.
    const owl = { wakeTime: "11:00", sleepTime: "03:00" };
    const at1am = new Date(2026, 7, 3, 1, 0, 0);
    expect(modeFrom(ritualPhase(owl as any, at1am))).not.toBe("morning");
  });

  it("still gives an early bird a morning at 6am", () => {
    const lark = { wakeTime: "05:30", sleepTime: "21:30" };
    expect(modeFrom(ritualPhase(lark as any, new Date(2026, 7, 3, 6, 0, 0)))).toBe("morning");
  });

  it("falls back to wall-clock bands when no rhythm is on record", () => {
    expect(modeFrom(ritualPhase(undefined, new Date(2026, 7, 3, 8, 0, 0)))).toBe("morning");
    expect(modeFrom(ritualPhase(undefined, new Date(2026, 7, 3, 14, 0, 0)))).toBe("ordinary");
    expect(modeFrom(ritualPhase(undefined, new Date(2026, 7, 3, 20, 0, 0)))).toBe("evening");
  });
});
