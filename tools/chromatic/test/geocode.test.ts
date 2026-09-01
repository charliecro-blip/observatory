// Timezone-offset resolution tests. The geocoding fetch itself is network
// and stays untested; the offset math is pure Intl and must be exact for the
// zones that broke computeNatalChart's own offset path (India, Nepal), plus
// DST on both sides of a US transition.

import { describe, expect, it } from "vitest";
import { dstNote, resolveWallTime, utcOffsetHours } from "../playground/geocode";

describe("utcOffsetHours", () => {
  it("resolves fractional zones exactly", () => {
    expect(utcOffsetHours("Asia/Kolkata", "1969-02-07", "18:45")).toBe(5.5);
    expect(utcOffsetHours("Asia/Kathmandu", "1990-05-04", "10:30")).toBe(5.75);
  });

  it("resolves US DST on both sides of the transition", () => {
    expect(utcOffsetHours("America/New_York", "1990-05-04", "10:30")).toBe(-4); // EDT
    expect(utcOffsetHours("America/New_York", "1990-01-15", "10:30")).toBe(-5); // EST
  });

  it("handles zones east of UTC without DST", () => {
    expect(utcOffsetHours("Asia/Tokyo", "1984-11-22", "03:15")).toBe(9);
  });

  it("applies historical rules, not today's", () => {
    // The UK ran British Standard Time (UTC+1 year-round) in 1970.
    expect(utcOffsetHours("Europe/London", "1970-01-15", "12:00")).toBe(1);
    expect(utcOffsetHours("Europe/London", "1975-01-15", "12:00")).toBe(0);
  });
});

describe("DST transition wall times", () => {
  it("names a spring-forward gap instead of silently guessing", () => {
    // US clocks jumped 02:00 → 03:00 on 2026-03-08; 02:30 never occurred.
    const r = resolveWallTime("America/New_York", "2026-03-08", "02:30");
    expect(r.kind).toBe("nonexistent");
    if (r.kind === "nonexistent") {
      expect(r.beforeOffsetHours).toBe(-5);
      expect(r.afterOffsetHours).toBe(-4);
    }
    // The scalar convenience picks the documented side: post-change offset.
    expect(utcOffsetHours("America/New_York", "2026-03-08", "02:30")).toBe(-4);
    expect(dstNote("America/New_York", "2026-03-08", "02:30")).toContain("never occurred");
  });

  it("names a fall-back ambiguity with both occurrences, first first", () => {
    // US clocks fell 02:00 → 01:00 on 2026-11-01; 01:30 occurred twice.
    const r = resolveWallTime("America/New_York", "2026-11-01", "01:30");
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") {
      expect(r.candidates).toEqual([-4, -5]); // EDT (earlier instant), then EST
    }
    expect(utcOffsetHours("America/New_York", "2026-11-01", "01:30")).toBe(-4);
    expect(dstNote("America/New_York", "2026-11-01", "01:30")).toContain("occurred twice");
  });

  it("handles the same transitions in Europe/London", () => {
    // UK sprang 01:00 → 02:00 on 2026-03-29 and fell back on 2026-10-25.
    const gap = resolveWallTime("Europe/London", "2026-03-29", "01:30");
    expect(gap.kind).toBe("nonexistent");
    const twice = resolveWallTime("Europe/London", "2026-10-25", "01:30");
    expect(twice.kind).toBe("ambiguous");
    if (twice.kind === "ambiguous") expect(twice.candidates).toEqual([1, 0]);
  });

  it("stays quiet on ordinary times", () => {
    expect(resolveWallTime("America/New_York", "2026-03-08", "12:00").kind).toBe("exact");
    expect(resolveWallTime("Asia/Kolkata", "2026-03-08", "02:30").kind).toBe("exact");
    expect(dstNote("Asia/Tokyo", "1984-11-22", "03:15")).toBeNull();
  });
});
