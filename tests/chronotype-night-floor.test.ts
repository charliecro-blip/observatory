import { describe, it, expect } from "vitest";
import { isAwakeDuring } from "../artifacts/tides/src/lib/chronotype";
import type { Chronotype } from "../artifacts/tides/src/lib/tester-profile";

/**
 * The app does not suggest 3am to people who never said they're up at 3am.
 *
 * `isAwakeDuring` was permissive whenever chronotype was unset, on the
 * reasonable principle that optional onboarding data shouldn't hide features.
 * But permissiveness about a 9pm window is a courtesy, and permissiveness
 * about a 3am one is the app not knowing what it's saying — a fresh account
 * was shown "Best this week for bold moves: Sun 12:00 AM–3:45 AM" ranked
 * first, as though they'd be awake for it.
 *
 * Owner ruling 2026-08-02: midnight→4am is not natural unless someone has
 * explicitly said it is.
 */

const win = (startHour: number, endHour: number) => ({
  // Fixed local date; only the wall-clock hours matter to the function.
  startAt: new Date(2026, 7, 2, startHour, 0, 0).toISOString(),
  endAt: new Date(2026, 7, 2, endHour, 0, 0).toISOString(),
});

const chrono = (p: Partial<Chronotype>): Chronotype => ({
  profile: "steady",
  freeWindows: {} as Chronotype["freeWindows"],
  updatedAt: new Date(2026, 7, 2).toISOString(),
  ...p,
});

describe("the dead-of-night floor", () => {
  it("treats midnight–4am as asleep when nothing is known", () => {
    expect(isAwakeDuring(win(0, 3), undefined)).toBe(false);
    expect(isAwakeDuring(win(2, 4), undefined)).toBe(false);
  });

  it("stays permissive outside those hours when nothing is known", () => {
    // The original courtesy is intact — this is a floor, not a lockout.
    expect(isAwakeDuring(win(9, 12), undefined)).toBe(true);
    expect(isAwakeDuring(win(20, 22), undefined)).toBe(true);
  });

  it("lifts the floor for someone who stated they're a night owl", () => {
    const owl = chrono({ profile: "night_owl", wakeTime: "11:00", sleepTime: "03:00" });
    expect(isAwakeDuring(win(0, 2), owl)).toBe(true);
  });

  it("does NOT lift the floor for hours the app merely assumed", () => {
    // Skipping the rhythm step stores defaults flagged `assumed`. Treating our
    // own invention as the user's permission is the exact failure being fixed.
    const guessed = chrono({ wakeTime: "07:00", sleepTime: "23:00", assumed: true });
    expect(isAwakeDuring(win(0, 3), guessed)).toBe(false);
  });

  it("still respects an explicit ordinary schedule", () => {
    const day = chrono({ profile: "early_bird", wakeTime: "06:00", sleepTime: "22:00" });
    expect(isAwakeDuring(win(9, 11), day)).toBe(true);
    // Past their stated bedtime — asleep by their own hours, not by the floor.
    expect(isAwakeDuring(win(22, 23), day)).toBe(false);
    // And their small hours are still asleep.
    expect(isAwakeDuring(win(1, 3), day)).toBe(false);
  });

  it("does not accidentally mark 4am–onward as asleep", () => {
    // The boundary is exclusive: a 4–6am window belongs to the early riser.
    const early = chrono({ profile: "early_bird", wakeTime: "04:00", sleepTime: "20:00" });
    expect(isAwakeDuring(win(4, 6), early)).toBe(true);
  });

  it("uses the window's midpoint, so a window straddling 4am is judged by where it sits", () => {
    // 3–5am has midpoint 4:00 → not in the dead of night (boundary exclusive).
    expect(isAwakeDuring(win(3, 5), undefined)).toBe(true);
    // 2–4am has midpoint 3:00 → dead of night.
    expect(isAwakeDuring(win(2, 4), undefined)).toBe(false);
  });
});
