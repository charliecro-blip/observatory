import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseClock, minutesOf, layoutLanes, spanLabel, durationLabel } from "../artifacts/tides/src/lib/activityWeek";

describe("parseClock", () => {
  it("reads both shapes the engine emits", () => {
    // Live payload 2026-08-25: "6 AM", "6:24 AM", "1:44 PM", "10 PM".
    expect(parseClock("6 AM")).toBe(360);
    expect(parseClock("6:24 AM")).toBe(384);
    expect(parseClock("1:44 PM")).toBe(824);
    expect(parseClock("10 PM")).toBe(1320);
  });

  it("gets both noon and midnight right", () => {
    expect(parseClock("12 AM")).toBe(0);
    expect(parseClock("12:30 AM")).toBe(30);
    expect(parseClock("12 PM")).toBe(720);
    expect(parseClock("12:30 PM")).toBe(750);
  });

  it("also reads 24-hour clocks", () => {
    expect(parseClock("06:24")).toBe(384);
    expect(parseClock("23:59")).toBe(1439);
  });

  it("returns null instead of midnight for anything it cannot read", () => {
    // A window drawn at 00:00 because the string failed looks like a fact.
    for (const s of ["", "  ", "later", "25:00", "13 PM", "6:75 AM", null, undefined]) {
      expect(parseClock(s as any), String(s)).toBeNull();
    }
  });
});

describe("minutesOf", () => {
  it("keeps a normal window as given", () => {
    expect(minutesOf({ startClock: "8:44 AM", endClock: "1:44 PM" })).toEqual({ startMin: 524, endMin: 824 });
  });

  it("runs a past-midnight window to the end of the day rather than backwards", () => {
    const m = minutesOf({ startClock: "10 PM", endClock: "1 AM" })!;
    expect(m.startMin).toBe(1320);
    expect(m.endMin).toBe(1440);
    expect(m.endMin).toBeGreaterThan(m.startMin);
  });

  it("returns null when the start cannot be read", () => {
    expect(minutesOf({ startClock: "nope", endClock: "1 PM" })).toBeNull();
  });
});

describe("layoutLanes", () => {
  it("keeps non-overlapping windows on one lane", () => {
    const { placed, lanes } = layoutLanes([
      { startClock: "6 AM", endClock: "8 AM" },
      { startClock: "1 PM", endClock: "3 PM" },
    ]);
    expect(lanes).toBe(1);
    expect(placed.map(p => p.lane)).toEqual([0, 0]);
  });

  it("stacks the real overlapping Friday instead of hiding two windows", () => {
    // Live payload: 8:44–1:44 contains 10:50–11:57 and 11:57–1:03. Drawn on
    // one line the two short ones vanish under the long one.
    const { placed, lanes } = layoutLanes([
      { startClock: "10:50 AM", endClock: "11:57 AM" },
      { startClock: "8:44 AM",  endClock: "1:44 PM"  },
      { startClock: "11:57 AM", endClock: "1:03 PM"  },
    ]);
    expect(lanes).toBe(2);
    expect(placed).toHaveLength(3);
    // The container takes the top lane; the two inside it share the one below.
    const byStart = Object.fromEntries(placed.map(p => [p.win.startClock, p.lane]));
    expect(byStart["8:44 AM"]).toBe(0);
    expect(byStart["10:50 AM"]).toBe(1);
    expect(byStart["11:57 AM"]).toBe(1);
  });

  it("never overlaps two windows within one lane", () => {
    const { placed } = layoutLanes([
      { startClock: "6 AM", endClock: "9 AM" }, { startClock: "7 AM", endClock: "10 AM" },
      { startClock: "8 AM", endClock: "11 AM" }, { startClock: "8:30 AM", endClock: "9:30 AM" },
    ]);
    for (const a of placed) for (const b of placed) {
      if (a === b || a.lane !== b.lane) continue;
      expect(a.startMin >= b.endMin || b.startMin >= a.endMin,
        `lane ${a.lane}: ${a.win.startClock} vs ${b.win.startClock}`).toBe(true);
    }
  });

  it("drops an unreadable window rather than drawing it at a guessed time", () => {
    const { placed } = layoutLanes([
      { startClock: "6 AM", endClock: "8 AM" },
      { startClock: "???", endClock: "8 AM" },
    ]);
    expect(placed).toHaveLength(1);
  });

  it("reports one lane for an empty day, so the row still has height", () => {
    expect(layoutLanes([])).toEqual({ placed: [], lanes: 1 });
  });
});

describe("spanLabel", () => {
  it("says the meridiem once when both ends share it", () => {
    expect(spanLabel("6:24 AM", "7:31 AM")).toBe("6:24–7:31 AM");
    expect(spanLabel("6 AM", "7:59 AM")).toBe("6–7:59 AM");
  });

  it("keeps both when the span crosses noon", () => {
    expect(spanLabel("8:44 AM", "1:44 PM")).toBe("8:44 AM–1:44 PM");
  });

  it("passes 24-hour clocks through unchanged", () => {
    expect(spanLabel("08:44", "13:44")).toBe("08:44–13:44");
  });
});

describe("durationLabel", () => {
  it("says the length in units a person uses", () => {
    expect(durationLabel({ startClock: "6:24 AM", endClock: "7:31 AM" })).toBe("1h 7m");
    expect(durationLabel({ startClock: "8:44 AM", endClock: "1:44 PM" })).toBe("5h");
    expect(durationLabel({ startClock: "6 AM", endClock: "6:45 AM" })).toBe("45 min");
  });

  it("is empty rather than wrong when the clock cannot be read", () => {
    expect(durationLabel({ startClock: "nope", endClock: "1 PM" })).toBe("");
  });
});

describe("the window and its core are drawn differently", () => {
  const SRC = readFileSync("artifacts/tides/src/components/ActivityWeek.tsx", "utf8");

  it("reads stackedHourMoon, which marks the hour inside the swell", () => {
    // A Friday reads 11:30–4:30 from a Moon swell with 3:04–4:09 inside it.
    // Drawn identically, the picture said "two windows".
    expect(SRC).toContain("const core = !!w.stackedHourMoon");
  });

  it("draws the core deeper than the window, not the window lighter", () => {
    // The other way round was tried and looked at: most activities have no
    // stacked hour most days, so outlining the plain window turned an ordinary
    // week into a grid of faint ghosts.
    expect(SRC).toContain("background: core ? t.core : t.fill");
    expect(SRC).not.toContain('background: core ? t.fill : "transparent"');
  });

  it("gives every tier a core as well as a fill", () => {
    for (const tier of ["great", "good", "fair"]) {
      const line = SRC.split("\n").find(l => l.trim().startsWith(`${tier}:`))!;
      expect(line, tier).toContain("core:");
      expect(line, tier).toContain("fill:");
      expect(line, tier).toContain("coreInk:");
    }
  });

  it("marks chart-derived windows with the same violet as the badge", () => {
    expect(SRC).toContain('const MINE = "#6f6a90"');
    expect(SRC).toContain("borderLeft: mine ? `3px solid ${MINE}`");
    // The badge above the grid already uses it, so the two agree.
    expect(SRC).toContain("#6f6a90");
  });

  it("explains the violet only when a violet edge is on screen", () => {
    // An outline containing a fill speaks for itself; an edge colour cannot.
    expect(SRC).toContain("(data?.windows ?? []).some(w => w.personal)");
    expect(SRC).toContain("A violet edge marks the ones read against your own chart.");
  });
});
