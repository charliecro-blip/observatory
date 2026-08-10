import { describe, it, expect } from "vitest";
import { pickBestWindow, type PickableWindow } from "../artifacts/api-server/src/lib/linesUp.js";

/**
 * "What lines up" is a claim about the moment, not just the day — and the
 * picker used to forget that. It sorted on supportLevel/suitability/score
 * alone and only asked "has this already happened?" AFTER a window was
 * chosen. So a convergent window that closed at noon could beat a merely
 * supported window still open at 7 PM, and the noon window — unusable — is
 * what the item carried onto the page. Home's whole promise is "what lines
 * up", not "what would have lined up".
 *
 * Tested against constructed windows rather than the live ephemeris on
 * purpose: the claim under test is entirely about TIME, and the real sky
 * changes what it can prove on every run — the exact fragility this session
 * already hit once with the hand-picked-title linesUp tests.
 */
const NOON = Date.parse("2026-08-09T12:00:00-05:00");
const w = (o: Partial<PickableWindow> & { startAt: string; endAt: string }): PickableWindow =>
  ({ supportLevel: "supported", suitability: "clear", ...o });

describe("pickBestWindow prefers actionable over passed", () => {
  it("picks a weaker future window over a stronger passed one", () => {
    const passedConvergent = w({
      startAt: "2026-08-09T10:00:00-05:00", endAt: "2026-08-09T11:00:00-05:00", // closed an hour ago
      supportLevel: "convergent", suitability: "clear",
    });
    const futureSupported = w({
      startAt: "2026-08-09T19:00:00-05:00", endAt: "2026-08-09T20:00:00-05:00", // this evening
      supportLevel: "supported", suitability: "clear",
    });
    const picked = pickBestWindow([passedConvergent, futureSupported], NOON);
    expect(picked, "the still-usable window must win, not the stronger dead one").toBe(futureSupported);
  });

  it("picks an open-now window over a passed one of any strength", () => {
    const passed = w({
      startAt: "2026-08-09T09:00:00-05:00", endAt: "2026-08-09T10:00:00-05:00",
      supportLevel: "convergent", suitability: "clear",
    });
    const openNow = w({
      startAt: "2026-08-09T11:30:00-05:00", endAt: "2026-08-09T12:30:00-05:00", // spans NOON
      supportLevel: "supported", suitability: "qualified",
    });
    expect(pickBestWindow([passed, openNow], NOON)).toBe(openNow);
  });

  it("falls back to the strongest passed window when nothing is actionable", () => {
    // Every window is dead — the item still needs an answer, and the honest
    // one is "here was your best window, and it's gone", not silence.
    const weakPassed = w({
      startAt: "2026-08-09T08:00:00-05:00", endAt: "2026-08-09T09:00:00-05:00",
      supportLevel: "supported", suitability: "clear",
    });
    const strongPassed = w({
      startAt: "2026-08-09T10:00:00-05:00", endAt: "2026-08-09T11:00:00-05:00",
      supportLevel: "convergent", suitability: "clear",
    });
    expect(pickBestWindow([weakPassed, strongPassed], NOON)).toBe(strongPassed);
  });

  it("still prefers strength once actionability ties", () => {
    const a = w({ startAt: "2026-08-09T14:00:00-05:00", endAt: "2026-08-09T15:00:00-05:00", supportLevel: "supported" });
    const b = w({ startAt: "2026-08-09T16:00:00-05:00", endAt: "2026-08-09T17:00:00-05:00", supportLevel: "convergent" });
    expect(pickBestWindow([a, b], NOON), "both future — convergent should still win").toBe(b);
  });

  it("never treats an all-day window as passed", () => {
    const allDay = w({ startAt: "2026-08-09T07:00:00-05:00", endAt: "2026-08-09T23:00:00-05:00", allDay: true, supportLevel: "supported" });
    const passedBounded = w({ startAt: "2026-08-09T08:00:00-05:00", endAt: "2026-08-09T09:00:00-05:00", supportLevel: "convergent" });
    // The all-day condition still holds right now, so it beats a dead bounded
    // window even though the bounded one was nominally stronger.
    expect(pickBestWindow([allDay, passedBounded], NOON)).toBe(allDay);
  });
});
