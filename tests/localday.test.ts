import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  offsetMinutesAt, startOfLocalDay, endOfLocalDay, localDayStarts, isValidTimeZone,
} from "../artifacts/api-server/src/lib/localday";

/**
 * Civil days are not 24 hours, and a bare date is not UTC midnight.
 *
 * Two habits in the timing code assumed otherwise. `Date.parse("2026-08-04")`
 * is UTC midnight, so "end of the due day" resolved five hours early for a US
 * user — a task due today could not be scheduled for this evening. And
 * `+ d * 86400000` is only wrong twice a year, which is worse: it survives
 * every test written on an ordinary week.
 */

const CHI = "America/Chicago";
const UTC = "UTC";
const KTM = "Asia/Kathmandu";       // UTC+5:45 — a non-hour offset
const PHX = "America/Phoenix";      // no DST at all

const HOURS = (ms: number) => ms / 3600000;

describe("the plain bug: a bare date is not the user's midnight", () => {
  it("puts local midnight where the user is, not at UTC", () => {
    // Date.parse("2026-08-04") === Date.UTC(2026,7,4). Chicago is UTC-5 in
    // August, so their midnight is five hours LATER as an instant.
    const naive = Date.UTC(2026, 7, 4);
    const real = startOfLocalDay("2026-08-04", CHI);
    expect(HOURS(real - naive)).toBe(5);
  });

  it("ends a due day at the next local midnight", () => {
    const end = endOfLocalDay("2026-08-04", CHI);
    expect(end).toBe(startOfLocalDay("2026-08-05", CHI));
    // And that is 24 hours on an ordinary day.
    expect(HOURS(end - startOfLocalDay("2026-08-04", CHI))).toBe(24);
  });

  it("is a no-op in UTC, so the fix cannot be masking a sign error", () => {
    expect(startOfLocalDay("2026-08-04", UTC)).toBe(Date.UTC(2026, 7, 4));
  });
});

describe("DST days are not 24 hours long", () => {
  it("makes the spring-forward day 23 hours", () => {
    // US DST begins 2026-03-08.
    const start = startOfLocalDay("2026-03-08", CHI);
    const end = endOfLocalDay("2026-03-08", CHI);
    expect(HOURS(end - start)).toBe(23);
  });

  it("makes the fall-back day 25 hours", () => {
    // US DST ends 2026-11-01.
    const start = startOfLocalDay("2026-11-01", CHI);
    const end = endOfLocalDay("2026-11-01", CHI);
    expect(HOURS(end - start)).toBe(25);
  });

  it("keeps successive midnights at real midnight across the boundary", () => {
    // The failure mode of `+ 86400000`: after the transition every subsequent
    // day is off by an hour, so "9am" drifts to 8am or 10am.
    const starts = localDayStarts("2026-03-06", 5, CHI);
    for (let i = 0; i < starts.length; i++) {
      expect(offsetMinutesAt(new Date(starts[i]), CHI)).toBe(
        // Each start must itself BE a local midnight: formatting it in the
        // zone gives 00:00.
        offsetMinutesAt(new Date(starts[i]), CHI));
      const local = new Intl.DateTimeFormat("en-US", {
        timeZone: CHI, hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date(starts[i]));
      expect(local, `day ${i}`).toMatch(/^(00|24):00$/);
    }
    // And the naive stepping would NOT have done that.
    const naive = starts[0] + 4 * 86400000;
    expect(naive).not.toBe(starts[4]);
    expect(HOURS(Math.abs(naive - starts[4]))).toBe(1);
  });

  it("leaves a no-DST zone alone", () => {
    // Phoenix never shifts, so both boundary days stay 24 hours.
    for (const d of ["2026-03-08", "2026-11-01"]) {
      expect(HOURS(endOfLocalDay(d, PHX) - startOfLocalDay(d, PHX)), d).toBe(24);
    }
  });
});

describe("non-hour offsets", () => {
  it("handles a 45-minute zone", () => {
    const naive = Date.UTC(2026, 7, 4);
    const real = startOfLocalDay("2026-08-04", KTM);
    expect((naive - real) / 60000).toBe(345);   // UTC+5:45
  });
});

describe("zone validation", () => {
  it("accepts real zones and rejects nonsense", () => {
    expect(isValidTimeZone(CHI)).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("wired into the deadline that was wrong", () => {
  const src = readFileSync("artifacts/api-server/src/routes/plan.ts", "utf-8");

  it("no longer treats a bare due date as UTC midnight plus a day", () => {
    expect(src).not.toMatch(/Date\.parse\(t\.dueDate\) \+ 86400000 : Infinity/);
  });

  it("uses the zone name when the client sends one", () => {
    expect(src).toMatch(/endOfLocalDay\(t\.dueDate, tzName\)/);
  });

  it("still corrects by the numeric offset when it does not", () => {
    // The fallback is wrong only on the two transition days, which is better
    // than being wrong by five hours every day.
    expect(src).toMatch(/Date\.parse\(t\.dueDate\) \+ 86400000 \+ tz \* 60000/);
  });

  it("validates the zone rather than trusting the body", () => {
    expect(src).toMatch(/isValidTimeZone\(req\.body\.tzName\)/);
  });

  it("is sent by the Planner", () => {
    const planner = readFileSync("artifacts/tides/src/components/Planner.tsx", "utf-8");
    expect(planner).toMatch(/tzName: Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  });
});
