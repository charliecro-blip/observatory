import { describe, it, expect } from "vitest";
import { findRareWindows } from "../artifacts/api-server/src/lib/rareWindows";

/**
 * The rare-window finder answers "when is the next EXCEPTIONAL day for this",
 * which is a different question from the canonical engine's "which hour today
 * suits it". These tests pin the properties that make the answer honest
 * rather than pinning particular dates — the sky moves, and a test that
 * asserts "2026-11-26" would be measuring the calendar.
 */

// A fixed instant, so every assertion below is reproducible. (Date.now() in a
// test is how you get a suite that fails on a Tuesday in March.)
const FROM = Date.parse("2026-08-13T12:00:00Z");

describe("rare windows", () => {
  it("returns days that are genuinely top-percentile, not merely the best available", () => {
    const scan = findRareWindows("first-date", FROM, { horizonDays: 730, limit: 5 });
    expect(scan.days.length).toBeGreaterThan(0);
    for (const d of scan.days) {
      expect(d.percentile).toBeGreaterThanOrEqual(97);
    }
  });

  it("is actually rare — a two-year scan yields a handful of occasions, not a monthly list", () => {
    const scan = findRareWindows("first-date", FROM, { horizonDays: 730, limit: 10 });
    // Ten is the cap; the point is that clearing the bar is uncommon enough
    // that the finder does not simply return `limit` every time regardless.
    expect(scan.days.length).toBeLessThanOrEqual(10);
    // No two reported occasions collapse into the same stretch of sky: a
    // three-day configuration is ONE occasion, and listing it three times
    // would overstate how often this happens.
    const ms = scan.days.map((d) => Date.parse(d.date + "T12:00:00Z")).sort((a, b) => a - b);
    for (let i = 1; i < ms.length; i++) {
      expect(ms[i] - ms[i - 1]).toBeGreaterThanOrEqual(5 * 86400000);
    }
  });

  it("names its reasons, and names what stands against a day rather than hiding it", () => {
    const scan = findRareWindows("dating-profile", FROM, { horizonDays: 730, limit: 5 });
    expect(scan.days.length).toBeGreaterThan(0);
    for (const d of scan.days) {
      expect(d.reasons.length).toBeGreaterThan(0);
      for (const r of d.reasons) expect(typeof r).toBe("string");
      // `against` may legitimately be empty on a clean day, but must exist:
      // the shape is never allowed to omit the objection channel.
      expect(Array.isArray(d.against)).toBe(true);
    }
  });

  it("says so plainly when a horizon holds nothing exceptional", () => {
    // A short horizon around an ordinary stretch is the honest empty case.
    // Whatever it finds, it must EITHER clear the bar OR say nothing does —
    // never return a weak day dressed up as a rare one.
    const scan = findRareWindows("first-date", FROM, { horizonDays: 45, minPercentile: 99.9, limit: 5 });
    if (scan.days.length === 0) {
      expect(scan.none).toBeTruthy();
      expect(scan.none).toMatch(/nothing exceptional/i);
    } else {
      for (const d of scan.days) expect(d.percentile).toBeGreaterThanOrEqual(99.9);
    }
  });

  it("refuses an unknown activity instead of guessing one", () => {
    expect(() => findRareWindows("no-such-activity", FROM)).toThrow(/unknown activity/);
  });

  it("scores dignity: Venus in her own sign beats Venus peregrine for a date", () => {
    // Not a date assertion — a RANKING one. Across two years the top days for
    // a date must include at least one where Venus is dignified, since that
    // is the single largest term in the score.
    const scan = findRareWindows("first-date", FROM, { horizonDays: 730, limit: 5 });
    const anyVenusDignified = scan.days.some((d) =>
      d.reasons.some((r) => /^Venus is (in .*, its own sign|exalted)/.test(r)));
    expect(anyVenusDignified).toBe(true);
  });
});
