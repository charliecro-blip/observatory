import { describe, it, expect } from "vitest";
import { linesUp, duePhrase, freePhrase, type HeldItem } from "../artifacts/api-server/src/lib/linesUp";

/**
 * THE LOOP, and the one-authority claim underneath it.
 *
 * "What should I do right now" was answered by three surfaces that did not
 * consult each other: Home's hero (this engine), Today's Strongest-fit card
 * (next-move.ts, which held flow protection), and the Ask advisor. So Home
 * could propose switching you off work Today knew you were inside of.
 *
 * Flow protection now lives HERE, where the answer is composed, and both
 * surfaces read it. These tests pin the properties that make that true —
 * not particular titles or times, which move with the sky.
 */

const base = {
  lat: 30.27, lon: -97.74, tzOffsetMin: 300,
  natal: null, timeKnown: true, locationKnown: true,
} as const;

const task = (id: number, title: string, extra: Partial<HeldItem> = {}): HeldItem => ({
  id: `task-${id}`, title, kind: "task", ...extra,
});

describe("the loop", () => {
  it("is present on every answer, even an empty one", () => {
    const r = linesUp({ ...base, held: [] });
    expect(r.loop).toBeTruthy();
    expect(r.loop.now).toBeNull();
    expect(r.loop.then).toBeNull();
  });

  it("says keep going when something is underway, and offers nothing else", () => {
    const startedMinutesAgo = new Date(Date.now() - 20 * 60000).toISOString();
    const r = linesUp({ ...base, held: [
      task(1, "Mix track 3", { startedAt: startedMinutesAgo }),
      task(2, "Reply to the landlord"),
    ] });
    expect(r.loop.now?.inFlow).toBe(true);
    expect(r.loop.now?.title).toBe("Mix track 3");
    expect(r.loop.now?.elapsedMin).toBeGreaterThanOrEqual(19);
    // A queue shown mid-task is a second thing to think about — which is the
    // interruption flow protection exists to prevent.
    expect(r.loop.then).toBeNull();
  });

  it("keeps flow across the SERVER's midnight — the boundary is the viewer's", () => {
    // The defect that broke deploy 6ab47f4's build: sameLocalDay compared the
    // server's calendar (UTC on Railway), so a Los Angeles user mid-task at
    // 4:50 PM lost "keep going" at 5:00 PM sharp — UTC midnight — and the CI
    // suite failed whenever Railway happened to build in the twenty minutes
    // after 00:00 UTC. Anchored to that exact moment, both sides of it.
    const utcMidnightPlus10 = new Date("2026-08-16T00:10:00Z");
    const startedBefore = new Date("2026-08-15T23:50:00Z").toISOString();
    const r = linesUp({ ...base, now: utcMidnightPlus10, held: [
      task(1, "Mix track 3", { startedAt: startedBefore }),
    ] });
    // tzOffsetMin 300 → the viewer's clock reads 19:10, same local day.
    expect(r.loop.now?.inFlow).toBe(true);

    // And the guard still guards: across the VIEWER's midnight (05:10 UTC is
    // 00:10 in Chicago), yesterday evening's stamp must not claim flow.
    const viewerMidnightPlus10 = new Date("2026-08-16T05:10:00Z");
    const lastNight = new Date("2026-08-16T04:50:00Z").toISOString();
    const r2 = linesUp({ ...base, now: viewerMidnightPlus10, held: [
      task(1, "Mix track 3", { startedAt: lastNight }),
    ] });
    expect(r2.loop.now?.inFlow ?? false).toBe(false);
  });

  it("ignores a start stamp that is too old to still be true", () => {
    // Past the two-hour ceiling: a forgotten stamp must not claim the slot
    // all day. Erring short is deliberate.
    const stale = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    const r = linesUp({ ...base, held: [task(1, "Mix track 3", { startedAt: stale })] });
    expect(r.loop.now?.inFlow ?? false).toBe(false);
  });

  it("never names the same thing as now and then", () => {
    // Two held items can carry identical words — a star and the task named
    // after it. "now: X / then: X" reads as a bug even when both rows are
    // real.
    const r = linesUp({ ...base, held: [
      task(1, "Finish the album"),
      task(2, "Finish the album"),
      task(3, "Call mom"),
    ] });
    if (r.loop.now && r.loop.then) {
      expect(r.loop.then.title.toLowerCase()).not.toBe(r.loop.now.title.toLowerCase());
    }
  });

  it("carries a reason with the act, never a bare window", () => {
    const r = linesUp({ ...base, held: [task(1, "Deep work on the proposal"), task(2, "Call mom")] });
    if (r.loop.now) {
      expect(typeof r.loop.now.why).toBe("string");
      expect(r.loop.now.why.length).toBeGreaterThan(0);
    }
  });

  it("always carries a plain why beside the astro one", () => {
    // The astro-quiet lens picks whyPlain; a payload without it would silently
    // fall back to sky vocabulary at exactly the lens meant to hide it.
    const r = linesUp({ ...base, held: [task(1, "Deep work on the proposal"), task(2, "Call mom")] });
    if (r.loop.now) {
      expect(typeof r.loop.now.whyPlain).toBe("string");
      expect(r.loop.now.whyPlain.length).toBeGreaterThan(0);
      // Sky vocabulary must not leak into the plain line.
      expect(r.loop.now.whyPlain).not.toMatch(/hour|chart|line[s]? up/i);
    }
  });

  it("keeps the flow why identical at both lenses", () => {
    const startedMinutesAgo = new Date(Date.now() - 20 * 60000).toISOString();
    const r = linesUp({ ...base, held: [task(1, "Mix track 3", { startedAt: startedMinutesAgo })] });
    expect(r.loop.now?.whyPlain).toBe(r.loop.now?.why);
  });

  it("distinguishes an empty list from a fully scheduled one", () => {
    const empty = linesUp({ ...base, held: [] });
    expect(empty.quiet).toBe("thin-inventory");

    const allPlaced = linesUp({ ...base, held: [task(1, "Mix track 3", { scheduledFor: "9" })] });
    expect(allPlaced.quiet).toBe("all-placed");
  });
});

describe("the plain why-line's facts", () => {
  // A Chicago viewer (tz 300): 2026-08-13T20:00Z reads 3 PM, Thursday Aug 13.
  const anchor = new Date("2026-08-13T20:00:00Z");

  it("names the deadline from the viewer's civil day", () => {
    expect(duePhrase("2026-08-13", anchor, 300)).toBe("due today");
    expect(duePhrase("2026-08-14", anchor, 300)).toBe("due tomorrow");
    expect(duePhrase("2026-08-15", anchor, 300)).toBe("due Saturday");
    expect(duePhrase("2026-08-12", anchor, 300)).toBe("past due");
    // Past the weekday horizon a due date is not a reason for acting NOW.
    expect(duePhrase("2026-08-30", anchor, 300)).toBeNull();
  });

  it("uses the viewer's midnight, not the server's", () => {
    // 02:00Z on the 14th is still Thursday evening in Chicago — a UTC server
    // must not call Friday's task "due today" at 9 PM Thursday.
    const lateEvening = new Date("2026-08-14T02:00:00Z");
    expect(duePhrase("2026-08-14", lateEvening, 300)).toBe("due tomorrow");
  });

  it("claims free time only when a calendar actually answered", () => {
    const nowMs = anchor.getTime();
    const ahead = [{ startMs: nowMs + 90 * 60000, endMs: nowMs + 120 * 60000 }];
    // busyKnown=false: no calendar linked or the fetch failed — an empty or
    // unconsulted list is not evidence of a clear day.
    expect(freePhrase(ahead, false, nowMs, 300)).toBeNull();
    expect(freePhrase(ahead, true, nowMs, 300)).toBe("you're free until 4:30 PM");
    expect(freePhrase([], true, nowMs, 300)).toBe("your calendar is clear for the rest of the day");
    // Mid-meeting the phrase stands down; the meeting suffix owns that case.
    const inMeeting = [{ startMs: nowMs - 10 * 60000, endMs: nowMs + 20 * 60000 }];
    expect(freePhrase(inMeeting, true, nowMs, 300)).toBeNull();
  });
});
