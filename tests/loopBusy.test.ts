import { describe, it, expect } from "vitest";
import { loopCandidateUsable } from "../artifacts/api-server/src/lib/linesUp.js";

/**
 * THE LOOP CONSULTS THE CALENDAR (HOME study 2026-08-15, D6).
 *
 * Home's hero could tell someone to start deep work at 1 PM while their own
 * calendar owned 1 PM — the loop never read Google Calendar, only the weaver
 * did. These pin the two collision rules, which are invisible in the payload:
 * a skipped candidate simply isn't there, so a regression would look like the
 * engine changing its mind rather than like a bug.
 *
 * Pure function, anchored instants — nothing here reads the live sky.
 */

const NOON = Date.parse("2026-08-20T19:00:00Z");   // noon in LA, arbitrary day
const H = 3600000;
const iso = (ms: number) => new Date(ms).toISOString();

const cand = (over: Partial<{ state: string; allDay: boolean; startAt: string; endAt: string }>) => ({
  state: "open-now", allDay: false,
  startAt: iso(NOON - H), endAt: iso(NOON + H),
  ...over,
});

describe("loopCandidateUsable", () => {
  it("consults nothing when there is no calendar", () => {
    expect(loopCandidateUsable(cand({}), [], NOON)).toBe(true);
  });

  it("refuses an open window the current meeting fully consumes", () => {
    // In a meeting until 13:30; the window ends at 13:00. There is no minute
    // of it left to start in, and naming it would be the exact collision the
    // program-manager persona reported.
    const busy = [{ startMs: NOON - 0.5 * H, endMs: NOON + 1.5 * H }];
    expect(loopCandidateUsable(cand({}), busy, NOON)).toBe(false);
  });

  it("keeps an open window that outlives the meeting", () => {
    // Meeting ends 12:30, window runs to 13:00 — "until 1 PM" stays true
    // through the call, and the loop's why says the window outlasts it.
    const busy = [{ startMs: NOON - 0.5 * H, endMs: NOON + 0.5 * H }];
    expect(loopCandidateUsable(cand({}), busy, NOON)).toBe(true);
  });

  it("keeps an open window when the meeting is later, not now", () => {
    // Busy 14:00–15:00; it is noon. The window is startable this minute —
    // a future meeting is the weaver's problem, not the loop's.
    const busy = [{ startMs: NOON + 2 * H, endMs: NOON + 3 * H }];
    expect(loopCandidateUsable(cand({}), busy, NOON)).toBe(true);
  });

  it("refuses an ahead window that sits entirely inside a busy block", () => {
    const busy = [{ startMs: NOON + H, endMs: NOON + 4 * H }];
    const ahead = cand({ state: "ahead", startAt: iso(NOON + 2 * H), endAt: iso(NOON + 3 * H) });
    expect(loopCandidateUsable(ahead, busy, NOON)).toBe(false);
  });

  it("keeps an ahead window that only partly overlaps a meeting", () => {
    // The free part is real; refusing it would let the calendar veto more
    // time than it actually owns.
    const busy = [{ startMs: NOON + H, endMs: NOON + 2.5 * H }];
    const ahead = cand({ state: "ahead", startAt: iso(NOON + 2 * H), endAt: iso(NOON + 4 * H) });
    expect(loopCandidateUsable(ahead, busy, NOON)).toBe(true);
  });

  it("never blocks an all-day answer", () => {
    // "The Moon suits finishing all day" is testimony about the day, not a
    // slot a meeting can occupy.
    const busy = [{ startMs: NOON - 6 * H, endMs: NOON + 6 * H }];
    expect(loopCandidateUsable(cand({ allDay: true }), busy, NOON)).toBe(true);
  });
});
