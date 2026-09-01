// Timezone-offset resolution tests. The geocoding fetch itself is network
// and stays untested; the offset math is pure Intl and must be exact for the
// zones that broke computeNatalChart's own offset path (India, Nepal), plus
// DST on both sides of a US transition.

import { describe, expect, it } from "vitest";
import { utcOffsetHours } from "../playground/geocode";

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
