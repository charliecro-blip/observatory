import { describe, it, expect } from "vitest";
import { rareToday } from "../artifacts/api-server/src/lib/rareWindows";

/**
 * The homepage's across-every-category notice. Nobody opts into this one, so
 * the properties that keep it honest are the ones worth pinning: it must be
 * RARE, it must fire on the crest of an occasion rather than every day of
 * one, and it must be able to return nothing.
 *
 * Measured before these numbers were chosen (the fire-rate lesson): at the
 * p99 bar with the crest rule, ~14 days a year fire, none consecutive. The
 * naive version without the crest rule fired six days running through one
 * stretch of Venus in Libra.
 */

const AUG13 = Date.parse("2026-08-13T12:00:00Z");
const DAY = 86400000;

describe("rare-today (the homepage notice)", () => {
  it("finds today's exceptional activities, with reasons and objections", () => {
    const r = rareToday(AUG13, { horizonDays: 365, minPercentile: 99, limit: 3 });
    expect(r.date).toBe("2026-08-13");
    expect(r.hits.length).toBeGreaterThan(0);
    for (const h of r.hits) {
      expect(h.percentile).toBeGreaterThanOrEqual(99);
      expect(h.reasons.length).toBeGreaterThan(0);
      expect(Array.isArray(h.against)).toBe(true);
      expect(h.activityLabel.length).toBeGreaterThan(0);
    }
  });

  it("stays quiet on ordinary days — silence is the default, not an error", () => {
    // Across a 60-day stretch the notice must be the exception. If this ever
    // fails, the bar has drifted and the banner has become wallpaper.
    let firing = 0;
    for (let d = 0; d < 60; d++) {
      if (rareToday(AUG13 + d * DAY, { horizonDays: 365, minPercentile: 99, limit: 3 }).hits.length) firing++;
    }
    expect(firing).toBeGreaterThan(0);          // it does fire sometimes
    expect(firing).toBeLessThan(12);            // but well under a fifth of days
  });

  it("fires on the crest of an occasion, not on every day of it", () => {
    // The specific defect this rule fixes: a fortnight of Venus in Libra
    // produced a banner every single morning. Assert no two consecutive
    // days both fire for the SAME activity.
    const firedBy = new Map<string, number[]>();
    for (let d = 0; d < 60; d++) {
      for (const h of rareToday(AUG13 + d * DAY, { horizonDays: 365, minPercentile: 99, limit: 3 }).hits) {
        firedBy.set(h.activityKey, [...(firedBy.get(h.activityKey) ?? []), d]);
      }
    }
    for (const [key, days] of firedBy) {
      for (let i = 1; i < days.length; i++) {
        expect(days[i] - days[i - 1], `${key} fired on adjacent days`).toBeGreaterThan(1);
      }
    }
  });

  it("gets tighter as the bar rises", () => {
    const count = (bar: number) => {
      let n = 0;
      for (let d = 0; d < 45; d++) {
        if (rareToday(AUG13 + d * DAY, { horizonDays: 365, minPercentile: bar, limit: 3 }).hits.length) n++;
      }
      return n;
    };
    expect(count(99.5)).toBeLessThanOrEqual(count(98));
  });
});
