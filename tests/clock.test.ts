import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseClockHour, partOfDay } from "../artifacts/tides/src/lib/clock";

/**
 * The clock strings the engine actually emits.
 *
 * `clockOf` drops minutes when they are zero, so an on-the-hour window arrives
 * as "9 AM" rather than "9:00 AM". The consumer required `(\d+):\d+` and
 * returned "afternoon" when the match failed — silently. Planetary hours often
 * begin on the hour, and part-of-day gates the availability filter, so a 9 AM
 * window was being treated as mid-afternoon.
 */

describe("every shape the engine can emit parses", () => {
  it("reads on-the-hour strings, which is the case that was broken", () => {
    expect(parseClockHour("9 AM")).toBe(9);
    expect(parseClockHour("9 PM")).toBe(21);
    expect(partOfDay("9 AM")).toBe("morning");
    expect(partOfDay("6 PM")).toBe("evening");
  });

  it("reads strings with minutes", () => {
    expect(parseClockHour("9:05 AM")).toBe(9);
    expect(parseClockHour("6:30 PM")).toBe(18);
  });

  it("gets the two noon/midnight edge cases right", () => {
    expect(parseClockHour("12 AM")).toBe(0);
    expect(parseClockHour("12:00 AM")).toBe(0);
    expect(parseClockHour("12 PM")).toBe(12);
    expect(parseClockHour("12:30 PM")).toBe(12);
    expect(partOfDay("12 AM")).toBe("morning");
    expect(partOfDay("12 PM")).toBe("afternoon");
  });

  it("reads 24-hour clocks too", () => {
    expect(parseClockHour("09:00")).toBe(9);
    expect(parseClockHour("21:30")).toBe(21);
    expect(parseClockHour("00:15")).toBe(0);
  });

  it("tolerates spacing", () => {
    expect(parseClockHour("9AM")).toBe(9);
    expect(parseClockHour(" 9  PM ")).toBe(21);
  });
});

describe("unreadable means null, never a guess", () => {
  it("returns null rather than defaulting to afternoon", () => {
    // The original bug was not only the regex — it was that failing to parse
    // produced a confident wrong answer the caller could not detect.
    for (const bad of ["", "later", "25 AM", "13 PM", "0 AM", "9:5 AM", "noon"]) {
      expect(parseClockHour(bad), bad).toBeNull();
      expect(partOfDay(bad), bad).toBeNull();
    }
  });
});

describe("boundaries land where the labels say", () => {
  it("splits morning/afternoon at noon and afternoon/evening at 5", () => {
    expect(partOfDay("11:59 AM")).toBe("morning");
    expect(partOfDay("12 PM")).toBe("afternoon");
    expect(partOfDay("4:59 PM")).toBe("afternoon");
    expect(partOfDay("5 PM")).toBe("evening");
  });
});

describe("round-trips against the engine's own formatter", () => {
  it("parses every hour the formatter can produce", () => {
    // Mirrors clockOf: minutes dropped when zero.
    const clockOf = (h: number, m: number) => {
      const ampm = h >= 12 ? "PM" : "AM";
      const hh = h % 12 || 12;
      return m === 0 ? `${hh} ${ampm}` : `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
    };
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 7, 30, 59]) {
        const s = clockOf(h, m);
        expect(parseClockHour(s), `${s} (from ${h}:${m})`).toBe(h);
      }
    }
  });
});

describe("computational inputs are in the cache keys", () => {
  // BRITTLE ONCE, AND IT COST A DEPLOY. The first version anchored on
  // `tzOffset]` — the closing bracket — so when locationKnown was correctly
  // added to the key a commit later, the assertion stopped matching working
  // code and failed the build. A test that pins the LAST element of a list is
  // a test that breaks every time the list grows, which is exactly when you
  // least want noise.
  //
  // Now: extract the key array and assert each required input is a MEMBER,
  // order-independent and open to extension.
  const keyOf = (src: string): string | null => {
    const m = src.match(/queryKey: \[("election-times"[^\]]*)\]/);
    return m ? m[1] : null;
  };

  it("keys election times by every input the answer depends on", () => {
    // Without these, changing location left the previous place's windows
    // cached for the full stale period.
    for (const f of ["ElectionPicker", "ActivityTimesHint"]) {
      const src = readFileSync(`artifacts/tides/src/components/${f}.tsx`, "utf-8");
      const key = keyOf(src);
      expect(key, `${f} has no election-times query key`).not.toBeNull();
      for (const input of ["lat.toFixed(2)", "lon.toFixed(2)", "tzOffset", "locationKnown"]) {
        expect(key, `${f} key omits ${input}`).toContain(input);
      }
    }
  });

  it("reads the same timezone the request sends", () => {
    for (const f of ["ElectionPicker", "ActivityTimesHint"]) {
      const src = readFileSync(`artifacts/tides/src/components/${f}.tsx`, "utf-8");
      // A second getTimezoneOffset() call in the URL could disagree with the
      // one in the key.
      expect(src, `${f} tz consistency`).not.toMatch(/tz=\$\{new Date\(\)\.getTimezoneOffset\(\)\}/);
    }
  });
});
