import { describe, it, expect } from "vitest";
import { scoreHabitTiming, elementsFromWindowTypes } from "../artifacts/api-server/src/lib/habitTiming.js";
import { WINDOW_ELEMENT } from "../artifacts/api-server/src/lib/timingTier.js";

/**
 * A habit's KIND OF WORK, and the fact that it now counts.
 *
 * `bestWindowType` was collected by the habit form and stored for months
 * without a single reader: the creation sheet offered it under a "Timing"
 * heading beside three fields that did drive timing, so choosing "deep work"
 * looked like telling Compass when to want the habit and told it nothing.
 * Wired 2026-08-14.
 */

// A neutral sky — nothing agrees with anything unless the habit says so.
const sky = (over: Partial<Parameters<typeof scoreHabitTiming>[1]> = {}) => ({
  element: "earth",
  hourRuler: "Saturn",
  phase: "waxing",
  voc: false,
  moonApplyingTo: new Set<string>(),
  retro: new Set<string>(),
  ...over,
});

const habit = (over: Partial<Parameters<typeof scoreHabitTiming>[0]> = {}) => ({
  favoredElements: null,
  favoredPhases: null,
  favoredPlanets: null,
  bestWindowType: null,
  minimumViable: null,
  ...over,
});

describe("kind of work feeds habit timing", () => {
  it("lifts a habit whose kind of work suits the day's element", () => {
    // deep_work reads as earth (timingTier.WINDOW_ELEMENT), and today is earth.
    const bare = scoreHabitTiming(habit(), sky());
    const kinded = scoreHabitTiming(habit({ bestWindowType: "deep_work" }), sky());
    expect(bare.match).toBe("neutral");
    expect(kinded.match).toBe("supported");
  });

  it("says why in the person's own terms, not the day's", () => {
    // "it's an earth day" would explain the verdict with a fact the user never
    // supplied — they chose a kind of work, not an element.
    const { note } = scoreHabitTiming(habit({ bestWindowType: "deep_work" }), sky());
    expect(note).toMatch(/this kind of work suits an? earth day/i);
  });

  it("stays silent when the kind of work does not match the day", () => {
    // launch → fire, and today is earth.
    const r = scoreHabitTiming(habit({ bestWindowType: "launch" }), sky());
    expect(r.match).toBe("neutral");
  });

  /**
   * THE ONE THAT MATTERS. A stated element and a kind of work that maps to the
   * same element are ONE claim arriving by two routes. Scoring both would let a
   * single fact carry a habit from neutral to resonant on its own, which is the
   * "one fact, one source" rule in scoring form.
   */
  it("does not pay the same element twice", () => {
    const stated = scoreHabitTiming(habit({ favoredElements: "earth" }), sky());
    const both = scoreHabitTiming(
      habit({ favoredElements: "earth", bestWindowType: "deep_work" }), sky());
    expect(both.match).toBe(stated.match);
    // And the doubled version must not have quietly reached the top band.
    expect(both.match).toBe("supported");
  });

  it("prefers a stated element over a derived one", () => {
    // Both land on "supported" here, so the ordering is asserted where it is
    // actually visible: adding a second weak signal tips the stated version
    // into resonant and the derived version only as far as supported.
    const withHour = { hourRuler: "Mars" };
    const stated = scoreHabitTiming(
      habit({ favoredElements: "earth", favoredPlanets: "Mars" }), sky(withHour));
    const derived = scoreHabitTiming(
      habit({ bestWindowType: "deep_work", favoredPlanets: "Mars" }), sky(withHour));
    expect(stated.match).toBe("resonant");
    expect(derived.match).toBe("supported");
  });

  it("reads every window type the form can offer", () => {
    // A window type with no element would be collected by the UI and silently
    // ignored by the scorer — the exact defect this wiring fixes, reappearing
    // one row at a time.
    const FORM_TYPES = [
      "deep_work", "creative", "planning", "admin", "social",
      "relationship", "recovery", "study", "launch", "retreat",
    ];
    const unmapped = FORM_TYPES.filter((t) => !WINDOW_ELEMENT[t]);
    expect(unmapped).toEqual([]);
  });

  it("takes several kinds at once and ignores junk", () => {
    expect(elementsFromWindowTypes("deep_work,launch").sort()).toEqual(["earth", "fire"]);
    expect(elementsFromWindowTypes("deep_work,admin")).toEqual(["earth"]); // both earth, deduped
    expect(elementsFromWindowTypes("not_a_window_type")).toEqual([]);
    expect(elementsFromWindowTypes(null)).toEqual([]);
  });
});
