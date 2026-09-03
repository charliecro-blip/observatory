import { describe, it, expect } from "vitest";
import {
  normalizeCadence, targetPerDayFor, windowTargetFor, dayMet, normalizeSolarAnchors,
} from "../artifacts/api-server/src/lib/habitCadence";

describe("normalizeCadence", () => {
  it("accepts every real cadence, including the new one", () => {
    for (const c of ["daily", "most_days", "weekly", "several", "occasional"]) {
      expect(normalizeCadence(c)).toBe(c);
    }
  });
  it("falls back to daily for anything else", () => {
    expect(normalizeCadence("nonsense")).toBe("daily");
    expect(normalizeCadence(undefined)).toBe("daily");
  });
});

describe("targetPerDayFor", () => {
  it("defaults to 2, never to 0", () => {
    // A target of zero divides by zero everywhere progress is a fraction.
    expect(targetPerDayFor(null)).toBe(2);
    expect(targetPerDayFor(undefined)).toBe(2);
    expect(targetPerDayFor(0)).toBe(1);
    expect(targetPerDayFor(-3)).toBe(1);
  });
  it("passes a real value through", () => {
    expect(targetPerDayFor(5)).toBe(5);
  });
});

describe("windowTargetFor", () => {
  it("scores the classic four the way it always did", () => {
    expect(windowTargetFor("daily", null, null)).toBe(7);
    expect(windowTargetFor("most_days", null, null)).toBe(5);
    expect(windowTargetFor("weekly", 4, null)).toBe(4);
    expect(windowTargetFor("weekly", null, null)).toBe(3);   // default
    expect(windowTargetFor("occasional", null, null)).toBe(0);
  });

  it("scores several as ticks, not days — targetPerDay times seven", () => {
    // A habit asking for three a day asks for twenty-one a week, not for
    // seven days touched at all.
    expect(windowTargetFor("several", null, 3)).toBe(21);
    expect(windowTargetFor("several", null, null)).toBe(14);  // default 2×7
  });

  it("clamps weekly to a real week", () => {
    expect(windowTargetFor("weekly", 30, null)).toBe(7);
    expect(windowTargetFor("weekly", -5, null)).toBe(1);
  });
});

describe("dayMet — the line this whole feature turns on", () => {
  it("treats any log as enough for every cadence but several", () => {
    for (const c of ["daily", "most_days", "weekly", "occasional"] as const) {
      expect(dayMet(c, 1, null), c).toBe(true);
      expect(dayMet(c, 0, null), c).toBe(false);
    }
  });

  it("makes several ask for its own target, not for one tick", () => {
    // This is the exact bug the feature could have shipped with: one tick out
    // of three read as "kept", which lets a single tap satisfy a habit that
    // asks for three.
    expect(dayMet("several", 1, 3)).toBe(false);
    expect(dayMet("several", 2, 3)).toBe(false);
    expect(dayMet("several", 3, 3)).toBe(true);
    expect(dayMet("several", 4, 3)).toBe(true);   // over target still counts
  });

  it("still needs at least one tick", () => {
    expect(dayMet("several", 0, 3)).toBe(false);
  });
});

describe("normalizeSolarAnchors — one habit, several landmarks", () => {
  it("accepts a single anchor, the old shape", () => {
    expect(normalizeSolarAnchors("sunrise")).toBe("sunrise");
  });

  it("accepts several, the new shape", () => {
    expect(normalizeSolarAnchors(["sunrise", "sunset"])).toBe("sunrise,sunset");
  });

  it("dedupes", () => {
    expect(normalizeSolarAnchors(["sunrise", "sunrise", "noon"])).toBe("sunrise,noon");
  });

  it("drops anything that is not a real anchor rather than storing garbage", () => {
    expect(normalizeSolarAnchors(["sunrise", "midnight", "noon"])).toBe("sunrise,noon");
    expect(normalizeSolarAnchors(["nonsense"])).toBeNull();
  });

  it("returns null for nothing, not an empty string", () => {
    expect(normalizeSolarAnchors([])).toBeNull();
    expect(normalizeSolarAnchors(undefined)).toBeNull();
    expect(normalizeSolarAnchors("")).toBeNull();
  });

  it("keeps bed as a valid anchor", () => {
    expect(normalizeSolarAnchors(["bed"])).toBe("bed");
  });
});
