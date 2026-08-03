import { describe, it, expect } from "vitest";
import { suggestApproach, dayPartFor } from "../artifacts/tides/src/lib/approach";

/**
 * Same quality, different way in.
 *
 * Reported 2026-08-02: "Mars hour — train hard" offered at 21:20, a hundred
 * minutes before the user's own stated 23:00 bedtime. The planet was right and
 * the approach was absurd, because `PLANET_ACTIVITIES` is a flat planet→verbs
 * map with no sense of hour, rhythm, or void state.
 */

const at = (h: number, m = 0) => new Date(2026, 7, 2, h, m, 0);
const RHYTHM = { wakeTime: "07:30", sleepTime: "23:00" };

describe("day part follows the person, not the wall clock", () => {
  it("puts an ordinary evening in the evening", () => {
    expect(dayPartFor(at(19), "07:30", "23:00")).toBe("evening");
  });

  it("treats the last two hours before sleep as wind-down", () => {
    expect(dayPartFor(at(21, 40), "07:30", "23:00")).toBe("winddown");
    expect(dayPartFor(at(22, 30), "07:30", "23:00")).toBe("winddown");
  });

  it("gives a night owl their own evening, past midnight", () => {
    // Wakes 11:00, sleeps 03:00. At 01:00 they are late in their day — but not
    // asleep, and certainly not "early morning".
    const p = dayPartFor(at(1), "11:00", "03:00");
    expect(["evening", "winddown"]).toContain(p);
  });

  it("does not hand a night owl the wind-down vocabulary at 6pm", () => {
    // 18:00 for someone who sleeps at 03:00 is the middle of their day.
    expect(dayPartFor(at(18), "11:00", "03:00")).toBe("midday");
  });

  it("calls the small hours night when no rhythm is known", () => {
    expect(dayPartFor(at(3), null, null)).toBe("night");
  });
});

describe("Mars is still Mars, but not a workout before bed", () => {
  it("offers hard training in the morning", () => {
    // 10:30 rather than 09:00: an hour and a half after a 07:30 wake is still
    // the "early" band, which has its own (also physical) Mars vocabulary.
    const a = suggestApproach({ planet: "Mars", at: at(10, 30), ...RHYTHM })!;
    expect(a.part).toBe("morning");
    expect(a.text).toMatch(/train hard|make the cut/);
  });

  it("still allows exertion just after waking", () => {
    const a = suggestApproach({ planet: "Mars", at: at(9), ...RHYTHM })!;
    expect(a.part).toBe("early");
    expect(a.text).toMatch(/train hard|brave errand/);
  });

  it("does NOT offer hard training at 21:20 — the reported bug", () => {
    const a = suggestApproach({ planet: "Mars", at: at(21, 20), ...RHYTHM })!;
    expect(a.part).toBe("winddown");
    expect(a.text).not.toMatch(/train hard/);
    // Still decisive — Mars doesn't become Venus after dark.
    expect(a.text).toMatch(/cut one thing loose|decisive tidying/);
  });

  it("keeps Mars sharp in the evening without exertion", () => {
    const a = suggestApproach({ planet: "Mars", at: at(18, 30), ...RHYTHM })!;
    expect(a.text).toMatch(/conversation|finish/);
    expect(a.text).not.toMatch(/train hard|compete/);
  });

  it("never proposes exertion in the small hours", () => {
    for (const p of ["Mars", "Sun", "Jupiter"]) {
      const a = suggestApproach({ planet: p, at: at(3), ...RHYTHM })!;
      expect(a.text, p).not.toMatch(/train hard|compete|lead the meeting|publish/);
    }
  });
});

describe("void of course forbids beginnings", () => {
  it("overrides the day part entirely", () => {
    const a = suggestApproach({ planet: "Mars", at: at(9), voc: true, ...RHYTHM })!;
    expect(a.basis).toBe("voc");
    expect(a.text).toMatch(/finish|clear the decks/);
  });

  it("never says begin, launch or start under a void", () => {
    for (const p of ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
      for (const h of [8, 12, 16, 20]) {
        const a = suggestApproach({ planet: p, at: at(h), voc: true, ...RHYTHM })!;
        expect(a.text.toLowerCase(), `${p}@${h}`).not.toMatch(/\b(begin|launch|start)\b/);
      }
    }
  });

  it("leans on re-verbs, which is the whole counsel", () => {
    const a = suggestApproach({ planet: "Mercury", at: at(11), voc: true, ...RHYTHM })!;
    expect(a.text).toMatch(/revise|re-send|backlog/);
  });
});

describe("the same conditions give the same answer", () => {
  it("is stable across repeated calls — checking twice must not reshuffle", () => {
    // A suggestion that changes because you looked again is the slot-machine
    // failure the audit warned about.
    const one = suggestApproach({ planet: "Venus", at: at(14), ...RHYTHM })!;
    const two = suggestApproach({ planet: "Venus", at: at(14), ...RHYTHM })!;
    expect(one.text).toBe(two.text);
  });

  it("covers every classical planet at every day part", () => {
    for (const p of ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
      for (const h of [6, 9, 13, 19, 22, 3]) {
        const a = suggestApproach({ planet: p, at: at(h), ...RHYTHM });
        expect(a, `${p}@${h}`).not.toBeNull();
        expect(a!.text.length, `${p}@${h}`).toBeGreaterThan(3);
      }
    }
  });
});
