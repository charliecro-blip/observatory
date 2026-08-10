import { describe, it, expect } from "vitest";
import {
  offsetMinutesFor, dayKeyInZone, dayBoundsInZone, civilDayOffsetIn,
} from "../artifacts/api-server/src/lib/localClock.js";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine.js";

/**
 * Civil-time correctness across a REAL DST transition.
 *
 * Everything in `localClock.ts` before this addition took a numeric
 * `tzOffsetMin` — a snapshot. Correct for an ordinary day, wrong by up to an
 * hour on the day a clock changes, and wrong for every day after it in a
 * multi-day scan that started before the transition and runs past it. These
 * fixtures pin the zone-aware replacement against America/Chicago's actual
 * 2026 transitions (spring forward Mar 8, fall back Nov 1) rather than a
 * synthetic offset, because the bug this closes is specifically about the
 * rule, not about arithmetic in the abstract.
 */
const CHI = "America/Chicago";

describe("offsetMinutesFor reads the offset AT the given instant", () => {
  // Positive west of Greenwich — matching `getTimezoneOffset()` and this
  // file's existing `tzOffsetMin` convention, not the "UTC-6" convention.
  // Caught by this exact test: the first draft had the sign backwards.
  it("is +300 (CDT) in summer and +360 (CST) in winter", () => {
    expect(offsetMinutesFor(new Date("2026-07-01T18:00:00Z"), CHI)).toBe(300);
    expect(offsetMinutesFor(new Date("2026-01-15T18:00:00Z"), CHI)).toBe(360);
  });

  it("flips exactly at the spring-forward instant (2026-03-08, 2am→3am local)", () => {
    // 08:00 UTC = 2:00 AM CST (the instant clocks jump to 3:00 AM CDT).
    expect(offsetMinutesFor(new Date("2026-03-08T07:59:00Z"), CHI)).toBe(360);
    expect(offsetMinutesFor(new Date("2026-03-08T08:01:00Z"), CHI)).toBe(300);
  });

  it("flips exactly at the fall-back instant (2026-11-01, 2am CDT→1am CST)", () => {
    expect(offsetMinutesFor(new Date("2026-11-01T06:59:00Z"), CHI)).toBe(300);
    expect(offsetMinutesFor(new Date("2026-11-01T07:01:00Z"), CHI)).toBe(360);
  });
});

describe("dayBoundsInZone handles a transition day's honest length", () => {
  it("spring-forward day is 23 hours, not 24", () => {
    const [start, end] = dayBoundsInZone(new Date("2026-03-08T18:00:00Z"), CHI);
    expect(dayKeyInZone(start, CHI)).toBe("2026-03-08");
    expect((end.getTime() - start.getTime()) / 3600000).toBe(23);
    // Start is midnight CST (still standard time — the jump is at 2am).
    expect(start.toISOString()).toBe("2026-03-08T06:00:00.000Z");
    // End is midnight the 9th, now CDT.
    expect(end.toISOString()).toBe("2026-03-09T05:00:00.000Z");
  });

  it("fall-back day is 25 hours, not 24", () => {
    const [start, end] = dayBoundsInZone(new Date("2026-11-01T18:00:00Z"), CHI);
    expect((end.getTime() - start.getTime()) / 3600000).toBe(25);
    expect(start.toISOString()).toBe("2026-11-01T05:00:00.000Z"); // midnight CDT
    expect(end.toISOString()).toBe("2026-11-02T06:00:00.000Z");   // midnight CST
  });

  it("an ordinary day away from any transition is still exactly 24 hours", () => {
    const [start, end] = dayBoundsInZone(new Date("2026-07-15T18:00:00Z"), CHI);
    expect((end.getTime() - start.getTime()) / 3600000).toBe(24);
  });
});

describe("civilDayOffsetIn steps by CALENDAR days, not fixed milliseconds", () => {
  it("a week that crosses fall-back still lands on the correct seventh calendar date", () => {
    // Oct 29 2026 + 7 civil days = Nov 5 2026, crossing the Nov 1 transition.
    // Stepping by raw 7*86400000ms from Oct 29 noon CDT would land an hour
    // short of Nov 5 noon — this must land exactly on it regardless.
    const start = new Date("2026-10-29T17:00:00Z"); // Oct 29, noon CDT
    const day7 = civilDayOffsetIn(start, 7, CHI);
    expect(dayKeyInZone(day7, CHI)).toBe("2026-11-05");
  });

  it("every day in a fall-back-spanning week is a distinct, consecutive calendar date", () => {
    const start = new Date("2026-10-29T17:00:00Z");
    const keys = Array.from({ length: 7 }, (_, i) => dayKeyInZone(civilDayOffsetIn(start, i, CHI), CHI));
    expect(keys).toEqual([
      "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
      "2026-11-02", "2026-11-03", "2026-11-04",
    ]);
  });

  it("handles month rollover the same way (Jan 30 + 3 days = Feb 2)", () => {
    const start = new Date("2026-01-30T18:00:00Z");
    expect(dayKeyInZone(civilDayOffsetIn(start, 3, CHI), CHI)).toBe("2026-02-02");
  });
});

describe("dayKeyInZone and dayBoundsInZone agree with each other", () => {
  it("a bound's own key round-trips to the date that produced it", () => {
    for (const iso of ["2026-03-08T20:00:00Z", "2026-11-01T20:00:00Z", "2026-07-15T04:00:00Z"]) {
      const d = new Date(iso);
      const key = dayKeyInZone(d, CHI);
      const [start] = dayBoundsInZone(d, CHI);
      expect(dayKeyInZone(start, CHI), `bounds for ${iso} must key back to ${key}`).toBe(key);
    }
  });
});

/**
 * The full pipeline, not just the helpers — proving `electionEngine`'s week
 * scan itself no longer drifts. `+ d * 86400000` was the audit's specific
 * finding: a raw-millisecond multi-day scan reads the wrong civil day for
 * everything after a DST transition inside its span. Checked on DATE LABELS
 * only (uniqueness, no skips), never on which activity converges — that part
 * depends on today's real sky and would make this test flaky by the hour.
 */
/**
 * Read as a CORRECTNESS PIN, not a regression guard — and that gap is worth
 * recording rather than hiding. `computeDayArc` derives a civil day's bounds
 * straight from whatever instant it is handed, correctly, for ANY instant —
 * so even with the raw-millisecond stepping this fix replaces, every
 * individual window's date/dow PAIRING still comes out right. What the old
 * code actually broke was DAY COVERAGE: walking `start + d*86400000` for
 * d=0..6 from a near-midnight anchor lands on Nov 1 twice (d=4 and d=5,
 * once on each side of the transition instant) and Nov 3 never once — a
 * wasted iteration re-scanning a day already covered, silently pushing the
 * whole span back by one. That failure is invisible to a test that only
 * checks "is this date/dow pair correct", because it always is; catching
 * the duplication would need the loop's internal d→date mapping, which
 * isn't part of this function's public output. The arithmetic that carries
 * the real risk — `civilDayOffsetIn` itself — IS proven regression-sensitive
 * above (disabled and rerun, three tests went red). This block stays
 * because "the real pipeline hands back factually correct dates for a real
 * transition week" is still worth pinning on its own terms.
 */
describe("electionEngine's week scan crosses a DST transition without drifting", () => {
  it("every date it produces is a real, correctly-labeled day inside the scanned week", () => {
    // Not every day of a scanned week necessarily produces a window for one
    // activity — that is the engine correctly declining to invent a
    // candidate, not a coverage guarantee this test can assume.
    const r = computeElections({
      activityKey: "deep-work", span: "week",
      lat: 41.88, lon: -87.63, tzOffsetMin: 300, timeZone: CHI,
      startAt: new Date("2026-10-28T05:30:00Z"),
    } as any)!;
    expect(r.windows.length, "the week must produce at least one window to test against").toBeGreaterThan(0);

    const EXPECTED_DOW: Record<string, string> = {
      "Oct 28": "Wed", "Oct 29": "Thu", "Oct 30": "Fri", "Oct 31": "Sat",
      "Nov 1": "Sun", "Nov 2": "Mon", "Nov 3": "Tue",
    };
    for (const w of r.windows) {
      expect(Object.keys(EXPECTED_DOW), `${w.date} must fall inside the scanned week`).toContain(w.date);
      expect(w.dow, `${w.date} must be a ${EXPECTED_DOW[w.date]}`).toBe(EXPECTED_DOW[w.date]);
    }
  }, 30_000);
});
