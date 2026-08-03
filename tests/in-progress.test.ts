import { describe, it, expect } from "vitest";
import {
  currentlyInProgress, elapsedLabel, IN_PROGRESS_CEILING_MIN, type StartedTask,
} from "../artifacts/tides/src/lib/in-progress";

/**
 * Flow protection.
 *
 * The engine recomputes from the sky on every render, which is why readings
 * are reproducible — and also why, without a start stamp, it will propose
 * switching you off work already underway. For an app opened several times a
 * day that is the most expensive mistake available to it.
 *
 * These tests mostly guard the EXPIRY rules, because the app cannot observe
 * that you stopped. Erring short is correct: failing to say "keep going" costs
 * a nudge, whereas wrongly insisting you are mid-flow contradicts what the
 * user can plainly see.
 */

const at = new Date(2026, 7, 3, 14, 0, 0);
const ago = (min: number) => new Date(at.getTime() - min * 60000).toISOString();
const t = (o: Partial<StartedTask> & { id: number }): StartedTask =>
  ({ title: `task ${o.id}`, done: "false", ...o });

describe("what counts as underway", () => {
  it("finds a task started a few minutes ago", () => {
    const r = currentlyInProgress([t({ id: 1, startedAt: ago(22) })], at);
    expect(r?.task.id).toBe(1);
    expect(r?.minutes).toBe(22);
  });

  it("ignores tasks that were never started", () => {
    expect(currentlyInProgress([t({ id: 1 }), t({ id: 2, startedAt: null })], at)).toBeNull();
  });

  it("does not call a finished task in progress", () => {
    // Completing clears the stamp server-side, but a stale client cache can
    // still hold both — and a done task must never claim the keep-going slot.
    expect(currentlyInProgress([t({ id: 1, startedAt: ago(10), done: "true" })], at)).toBeNull();
  });

  it("prefers the most recent start when several qualify", () => {
    // You started two things and finished neither. The later one is the better
    // guess at what is actually in front of you.
    const r = currentlyInProgress([
      t({ id: 1, startedAt: ago(90) }),
      t({ id: 2, startedAt: ago(5) }),
      t({ id: 3, startedAt: ago(45) }),
    ], at);
    expect(r?.task.id).toBe(2);
  });
});

describe("a start stamp expires, because nobody marks when they gave up", () => {
  it("holds right up to the ceiling and drops just past it", () => {
    expect(currentlyInProgress([t({ id: 1, startedAt: ago(IN_PROGRESS_CEILING_MIN) })], at)).not.toBeNull();
    expect(currentlyInProgress([t({ id: 1, startedAt: ago(IN_PROGRESS_CEILING_MIN + 1) })], at)).toBeNull();
  });

  it("outlasts a planetary hour, so one sitting is never cut in half", () => {
    // A planetary hour is roughly 60 minutes. The ceiling must clear it, or
    // the app would stop recognising work it suggested one hour earlier.
    expect(IN_PROGRESS_CEILING_MIN).toBeGreaterThan(60);
  });

  it("never reads an overnight gap as continuous work", () => {
    // The bound that clock arithmetic alone would miss: 00:30, started 23:00
    // the night before, is 90 minutes — inside the ceiling, and obviously not
    // someone still working.
    const midnight = new Date(2026, 7, 4, 0, 30, 0);
    const lastNight = new Date(2026, 7, 3, 23, 0, 0).toISOString();
    expect(Math.floor((midnight.getTime() - new Date(lastNight).getTime()) / 60000))
      .toBeLessThan(IN_PROGRESS_CEILING_MIN);   // the ceiling would have allowed it
    expect(currentlyInProgress([t({ id: 1, startedAt: lastNight })], midnight)).toBeNull();
  });

  it("treats a start in the future as not underway", () => {
    // Clock skew between device and server should cost this row, not produce
    // a negative elapsed time rendered as "-3 min in".
    expect(currentlyInProgress([t({ id: 1, startedAt: ago(-3) })], at)).toBeNull();
  });

  it("survives unparseable data by dropping the row, not the feature", () => {
    const r = currentlyInProgress([
      t({ id: 1, startedAt: "not-a-date" }),
      t({ id: 2, startedAt: ago(8) }),
    ], at);
    expect(r?.task.id).toBe(2);
  });

  it("handles an empty or absent list", () => {
    expect(currentlyInProgress([], at)).toBeNull();
    expect(currentlyInProgress(undefined, at)).toBeNull();
  });
});

describe("the elapsed phrase says what is true", () => {
  it("never rounds up into a claim", () => {
    expect(elapsedLabel(0)).toBe("just started");
    expect(elapsedLabel(1)).toBe("1 min in");
    expect(elapsedLabel(59)).toBe("59 min in");
    expect(elapsedLabel(60)).toBe("1h in");
    expect(elapsedLabel(65)).toBe("1h 5m in");
  });
});
