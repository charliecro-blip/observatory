import { describe, it, expect } from "vitest";
import { newMoonDates } from "../artifacts/api-server/src/lib/lunarCycle.js";

/**
 * WHICH DAY THE CYCLE STARTS — and the fact that the answer does not depend
 * on what time you ask.
 *
 * `newMoonDates` stamps data as well as reading it: `POST
 * /planning/intentions` files an intention under the cycleStart it returns,
 * and `/momentum` matches with `i.cycleStart === cycleStart`. Any wobble in
 * this function makes an intention written at one hour invisible when read at
 * another, which is how Today came to keep asking for a New-Moon review that
 * had already been done.
 *
 * Anchored to a known lunation rather than the live sky. `now` is injectable
 * precisely so these cannot join the day-flaky set.
 */

// Measured independently by bisecting elongation through 0°:
// the Leo solar-eclipse new moon of August 2026.
const NEW_MOON_UTC = Date.parse("2026-08-12T17:36:30Z");
const LA = 420;       // UTC-7, as Date#getTimezoneOffset reports it
// UTC+13. Kolkata (UTC+5:30) does NOT work for the rollover case — 17:36 UTC
// is 23:06 the same evening there, still the 12th. The offset has to be large
// enough to cross midnight, which is the case worth pinning anyway.
const AUCKLAND = -780;
const H = 3600000;

describe("newMoonDates", () => {
  it("names the day the new moon actually falls on, in local terms", () => {
    // 10:36 local in Los Angeles.
    const { cycleStart } = newMoonDates(LA, NEW_MOON_UTC + 30 * H);
    expect(cycleStart).toBe("2026-08-12");
  });

  /**
   * The regression. The old version stamped the first daily SAMPLE after the
   * crossing, and samples are taken at the current clock time — so asking at
   * 10:20 on Aug 15 put the new moon on Aug 13 (sixteen minutes of sampling
   * error, rounded up to a whole day) while asking at 11:00 put it on Aug 12.
   */
  it("gives the same answer whatever time of day it is asked", () => {
    const answers = new Set<string>();
    // Every hour across the three days after the lunation — the window in
    // which Today's cycle card is deciding whether to show. From h=1: the
    // conjunction instant itself is the boundary, and which side of it counts
    // is pinned separately below rather than smuggled in here.
    for (let h = 1; h <= 72; h++) {
      answers.add(newMoonDates(LA, NEW_MOON_UTC + h * H).cycleStart);
    }
    expect([...answers]).toEqual(["2026-08-12"]);
  });

  it("puts the review window on the right three days", () => {
    // Today's cycle card shows while daysSinceNewMoon is 0..2. With the start
    // a day late that ran Aug 13–15; it should run Aug 12–14.
    const dayOf = (iso: string) => Date.parse(iso + "T12:00:00Z");
    const { cycleStart } = newMoonDates(LA, NEW_MOON_UTC + 30 * H);
    const since = (d: string) => Math.floor((dayOf(d) - dayOf(cycleStart)) / 86400000);
    expect(since("2026-08-12")).toBe(0);
    expect(since("2026-08-14")).toBe(2);
    expect(since("2026-08-15")).toBe(3);   // window closed — this is the day it was still showing
  });

  it("reads the local calendar, not the server's", () => {
    // 17:36 UTC on the 12th is 06:36 on the 13th at UTC+13, so a viewer there
    // should be told their cycle began on the 13th while Los Angeles is told
    // the 12th. Production runs the server in UTC, which is exactly where an
    // ignored offset stops being visible to anyone testing locally.
    expect(newMoonDates(AUCKLAND, NEW_MOON_UTC + 30 * H).cycleStart).toBe("2026-08-13");
    expect(newMoonDates(LA, NEW_MOON_UTC + 30 * H).cycleStart).toBe("2026-08-12");
  });

  it("finds the previous lunation too, and orders the two", () => {
    const { cycleStart, prevCycleStart } = newMoonDates(LA, NEW_MOON_UTC + 30 * H);
    expect(prevCycleStart < cycleStart).toBe(true);
    const gap = (Date.parse(cycleStart) - Date.parse(prevCycleStart)) / 86400000;
    // A synodic month is 29.53 days; day-rounding either side allows 29–30.
    expect(gap).toBeGreaterThanOrEqual(29);
    expect(gap).toBeLessThanOrEqual(30);
  });

  it("is stable across the boundary it is used to define", () => {
    // The minute before and the minute after the conjunction must not
    // disagree about which cycle is current in any way other than the
    // conjunction itself — the moment an intention could be written.
    const before = newMoonDates(LA, NEW_MOON_UTC - 60000).cycleStart;
    const after = newMoonDates(LA, NEW_MOON_UTC + 60000).cycleStart;
    expect(before).toBe("2026-07-14");   // still the previous cycle
    expect(after).toBe("2026-08-12");    // the new one, from its first minute
  });
});
