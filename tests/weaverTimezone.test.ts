import { describe, it, expect } from "vitest";
import { dayKeyIn, dayBoundsIn } from "../artifacts/api-server/src/lib/localClock.js";
import { weaveDay } from "../artifacts/api-server/src/lib/dayWeaver.js";
import { dayTimeline } from "../artifacts/api-server/src/lib/dayTimeline.js";
import { weaveWeek } from "../artifacts/api-server/src/lib/weekWeaver.js";

/**
 * The weavers compute the day in the USER'S zone, not the server's.
 *
 * They used local `Date` getters — `getFullYear()`, `setHours(0,0,0,0)` — to
 * decide what "today" means and where it starts. On a UTC server that is UTC
 * midnight, so for a Chicago user every evening after 7 PM the weaver was
 * already living in tomorrow: items due today were judged overdue, and the
 * day's container started five hours before the user's actual midnight. The
 * same disease as server-side `toLocale*` formatting, in date arithmetic —
 * where it decides what is overdue rather than how a clock prints.
 *
 * The chosen instant makes the two zones DISAGREE about the date: 04:30 UTC
 * on Dec 1 is 10:30 PM on Nov 30 in Chicago (offset 360). Any regression to
 * server-local arithmetic flips these assertions on a UTC machine — and on a
 * dev machine in America/Chicago they pass either way, which is exactly how
 * the bug survived; CI runs this suite under UTC and Asia/Kolkata.
 */
const EVENING = new Date("2026-12-01T04:30:00Z"); // Nov 30, 10:30 PM in Chicago
const CHI = 360; // getTimezoneOffset for America/Chicago in December (CST)
const PLACE = { lat: 41.88, lon: -87.63 };

describe("day boundaries live in the user's zone", () => {
  it("keys the instant to the user's calendar date, not the server's", () => {
    expect(dayKeyIn(EVENING, CHI)).toBe("2026-11-30");
    expect(dayKeyIn(EVENING, 0)).toBe("2026-12-01");
  });

  it("bounds the day at the user's midnight", () => {
    const [start, end] = dayBoundsIn(EVENING, CHI);
    expect(start.toISOString()).toBe("2026-11-30T06:00:00.000Z"); // 00:00 CST
    expect(end.toISOString()).toBe("2026-12-01T06:00:00.000Z");
  });

  it("puts the waking edges at the user's clock hours", () => {
    const events = dayTimeline({ date: EVENING, ...PLACE, tzOffsetMin: CHI, wakeHour: 7, sleepHour: 23 });
    const wake = events.find(e => e.kind === "waking-start");
    // 7 AM CST = 13:00 UTC. Under the old server-local code on a UTC machine
    // this was 07:00 UTC — 1 AM in Chicago, an hour nobody is awake at.
    expect(wake?.at && new Date(wake.at).toISOString()).toBe("2026-11-30T13:00:00.000Z");
  });
});

describe("what the weaver places stays inside the user's day", () => {
  const item = {
    id: "t1", title: "Deep work sprint", kind: "task" as const,
    estMinutes: 60, dueDate: null, startedAt: null, activityKey: "deep-work",
  };

  it("every placement falls on the user's calendar date", () => {
    const woven = weaveDay({ items: [item], date: EVENING, ...PLACE, tzOffsetMin: CHI });
    // The item may legitimately be unplaced (a real refusal is fine); what may
    // NOT happen is a placement outside the day the user asked about.
    for (const p of woven.placed) {
      expect(dayKeyIn(new Date(p.startAt), CHI), `${p.startAt} must be on the user's Nov 30`).toBe("2026-11-30");
    }
    expect(woven.placed.length + woven.unplaced.length).toBe(1); // never dropped
  });

  it("the week's seven day-keys are the user's seven dates", () => {
    const week = weaveWeek({ items: [], startDate: EVENING, ...PLACE, tzOffsetMin: CHI });
    expect(week.days[0].key).toBe("2026-11-30");
    expect(week.days.length).toBe(7);
    // Consecutive user-zone dates, no skips or repeats at the DST-free end of year.
    expect(week.days[6].key).toBe("2026-12-06");
  });
});
