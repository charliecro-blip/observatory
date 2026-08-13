import { describe, it, expect } from "vitest";
import { linesUp, type HeldItem } from "../artifacts/api-server/src/lib/linesUp";

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

  it("distinguishes an empty list from a fully scheduled one", () => {
    const empty = linesUp({ ...base, held: [] });
    expect(empty.quiet).toBe("thin-inventory");

    const allPlaced = linesUp({ ...base, held: [task(1, "Mix track 3", { scheduledFor: "9" })] });
    expect(allPlaced.quiet).toBe("all-placed");
  });
});
