import { describe, it, expect } from "vitest";
import { weaveWeek, weekDates, type WeekItem } from "../artifacts/api-server/src/lib/weekWeaver.js";
import { findLongSessions } from "../artifacts/api-server/src/lib/longSession.js";
import { readCalendar, bucketByDay, spanOf } from "../artifacts/api-server/src/lib/calendarCommitments.js";

const TZ = new Date(2026, 7, 5).getTimezoneOffset();
const AUSTIN = { lat: 30.27, lon: -97.74, tzOffsetMin: TZ };
const startDate = new Date(2026, 7, 5, 12, 0);
const at = (d: number, h: number, m = 0) => new Date(2026, 7, d, h, m);

describe("a failed calendar read is not an empty calendar", () => {
  // The whole point. Two of these three states have no commitments, and only
  // one of them means the time is actually free.
  it("keeps 'no account' apart from 'could not reach it'", () => {
    const none = readCalendar({ ok: true, connected: false, busy: [] });
    expect(none.consulted).toBe(true);
    expect(none.connected).toBe(false);

    const failed = readCalendar({ ok: false, connected: true, busy: [] });
    expect(failed.consulted).toBe(false);

    const threw = readCalendar(null);
    expect(threw.consulted).toBe(false);
  });

  it("reports what a working read found", () => {
    const r = readCalendar({ ok: true, connected: true, busy: [{ startMs: at(6, 13).getTime(), endMs: at(6, 14).getTime() }] });
    expect(r.consulted).toBe(true);
    expect(r.commitments).toHaveLength(1);
  });
});

describe("commitments bucket into the days the weaver actually reads", () => {
  // The silent-failure guard. Keys built any other way produce a map the
  // weaver never looks in, which is indistinguishable from passing nothing.
  it("uses exactly the weaver's own keys", () => {
    const { dates, keys } = weekDates(startDate, 7, TZ);
    const buckets = bucketByDay([{ startAt: at(6, 13), endAt: at(6, 14) }], dates, keys, TZ);
    expect(Object.keys(buckets).sort()).toEqual([...keys].sort());
  });

  it("clips a block that crosses midnight into both days", () => {
    const { dates, keys } = weekDates(startDate, 7, TZ);
    const buckets = bucketByDay([{ startAt: at(6, 23), endAt: at(7, 1) }], dates, keys, TZ);
    const withAny = keys.filter(k => buckets[k].length);
    expect(withAny).toHaveLength(2);
    // Neither day is charged for the other's hours.
    for (const k of withAny) {
      const c = buckets[k][0];
      expect(c.endAt.getTime() - c.startAt.getTime()).toBe(3600000);
    }
  });

  it("covers every day in one query span", () => {
    const { dates } = weekDates(startDate, 7, TZ);
    const { startIso, endIso } = spanOf(dates, TZ);
    expect(new Date(endIso).getTime() - new Date(startIso).getTime()).toBeGreaterThanOrEqual(6 * 86400000);
  });
});

describe("the week does not place work through a commitment", () => {
  const items: WeekItem[] = [
    { id: "1", title: "Deep work: rewrite the onboarding sequence", kind: "task", estMinutes: 240, dueDate: "2026-08-06" },
    { id: "2", title: "Write a first draft of the essay", kind: "task", estMinutes: 180, dueDate: "2026-08-06" },
  ];

  // An ACTUAL collision, as the handoff requires: work due on the one day that
  // is almost entirely spoken for.
  it("keeps off a day-long commitment", () => {
    const { dates, keys } = weekDates(startDate, 7, TZ);
    const offsite = [{ startAt: at(6, 8), endAt: at(6, 18) }];
    const commitmentsByDay = bucketByDay(offsite, dates, keys, TZ);

    const w = weaveWeek({ items, startDate, ...AUSTIN, commitmentsByDay });

    for (const d of w.days) {
      for (const p of d.woven.placed) {
        const s = new Date(p.startAt).getTime(), e = new Date(p.endAt).getTime();
        for (const c of offsite) {
          const overlap = Math.min(e, c.endAt.getTime()) - Math.max(s, c.startAt.getTime());
          expect(overlap, `${p.item.title} overlaps the offsite by ${overlap / 60000}m`).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  it("the same week WOULD have used those hours with no calendar", () => {
    // Proves the test above is testing something: without commitments the
    // weaver is free to use that day, so a passing result means the
    // commitments changed the outcome rather than never mattering.
    const w = weaveWeek({ items, startDate, ...AUSTIN });
    const placed = w.days.flatMap(d => d.woven.placed);
    expect(placed.length).toBeGreaterThan(0);
  });
});

describe("a long session is not uninterrupted if a meeting sits inside it", () => {
  // The handoff's exact scenario: a 4-hour otherwise-good span with a 1-hour
  // meeting in the middle must not come back as four free hours.
  const base = { activityKey: "deep-work", minutes: 240, date: at(5, 12), ...AUSTIN };

  it("does not return a span that a commitment interrupts", () => {
    const free = findLongSessions(base)!;
    expect(free.options.length).toBeGreaterThan(0);

    // Put an hour-long meeting in the middle of the best free option.
    const best = free.options[0].candidate;
    const mid = new Date(best.startAt.getTime() + (best.endAt.getTime() - best.startAt.getTime()) / 2);
    const meeting = { startAt: mid, endAt: new Date(mid.getTime() + 3600000) };

    const withMeeting = findLongSessions({ ...base, commitments: [meeting] })!;
    for (const o of withMeeting.options) {
      const s = o.candidate.startAt.getTime(), e = o.candidate.endAt.getTime();
      const overlap = Math.min(e, meeting.endAt.getTime()) - Math.max(s, meeting.startAt.getTime());
      expect(overlap, `an option still runs through the meeting by ${overlap / 60000}m`).toBeLessThanOrEqual(0);
    }
  });
});
