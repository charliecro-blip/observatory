import { describe, it, expect } from "vitest";
import { conditionalFits, type Capacity } from "../artifacts/tides/src/lib/alternatives";

/**
 * "Another fit" — the same quality, spent differently.
 *
 * The invariant that matters is the one that produced this module's sibling:
 * a Mars hour suggested "train hard" at 21:20 against a stated 23:00 bedtime.
 * "If you need to move" is precisely the capacity that reaches for that verb,
 * so wind-down has to catch it for every planet, not just the obvious one.
 */

const at = (h: number, d = 14) => new Date(2026, 7, d, h, 0, 0);
const PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const rhythm = { wakeTime: "07:00", sleepTime: "23:00" };

/** Verbs that should never appear inside the last stretch before sleep. */
const HIGH_AROUSAL = /\b(train hard|compete|sprint|strenuous|publish|launch|perform|pitch)\b/i;

/**
 * Strip negated constructions before keyword-matching.
 *
 * The first version of this test failed three times against correct copy:
 * "a slow walk, nothing strenuous" and "return to something already underway —
 * start nothing" both contain a forbidden word and both mean its opposite. A
 * keyword scan that cannot see negation reads the safest lines in the module
 * as the most dangerous.
 */
const denegate = (s: string) => s.replace(/\b(?:nothing|no|not|without|never)\s+\w+|\b\w+\s+nothing\b/gi, " ");
const arousing = (s: string) => HIGH_AROUSAL.test(denegate(s));

describe("the guard used by these tests actually guards", () => {
  it("still catches a genuinely high-arousal line", () => {
    // Without this, a denegate() that stripped too much would make every
    // wind-down assertion below pass by erasing its own evidence.
    expect(arousing("train hard before bed")).toBe(true);
    expect(arousing("go compete with someone")).toBe(true);
    // And still clears the negated forms that caused the false failures.
    expect(arousing("a slow walk, nothing strenuous")).toBe(false);
  });
});

describe("every planet offers all three capacities", () => {
  it("returns one suggestion per capacity, no duplicates", () => {
    for (const planet of PLANETS) {
      const fits = conditionalFits({ planet, at: at(10), ...rhythm });
      expect(fits.length, planet).toBe(3);
      const caps = fits.map((f) => f.capacity);
      expect(new Set(caps).size, `${planet} repeated a capacity`).toBe(3);
      for (const f of fits) {
        expect(f.suggestion.length, `${planet}/${f.capacity} empty`).toBeGreaterThan(3);
        expect(f.condition).toMatch(/^if /);
      }
    }
  });

  it("declines rather than inventing an option for an unknown planet", () => {
    // An empty result collapses the disclosure. Filling the row with something
    // generic would be the manufactured-significance failure in miniature.
    expect(conditionalFits({ planet: "Chiron", at: at(10), ...rhythm })).toEqual([]);
  });
});

describe("wind-down catches every capacity, not just the obvious one", () => {
  it("proposes nothing high-arousal in the last stretch before sleep", () => {
    // 21:20 against a 23:00 bedtime — the exact reported case.
    for (const planet of PLANETS) {
      for (const h of [21, 22]) {
        for (const f of conditionalFits({ planet, at: at(h), ...rhythm })) {
          expect(arousing(f.suggestion),
            `${planet} @${h}:00 ${f.capacity}: "${f.suggestion}"`).toBe(false);
          expect(f.basis).toBe("winddown");
        }
      }
    }
  });

  it("still offers 'train hard' to a restless Mars in the morning", () => {
    // The guard must not have flattened the vocabulary — Mars in the morning
    // is exactly when that suggestion is right.
    const days = [10, 11, 12, 13, 14, 15, 16].map((d) =>
      conditionalFits({ planet: "Mars", at: at(9, d), ...rhythm })
        .find((f) => f.capacity === "restless")!.suggestion);
    expect(days.some((s) => /train hard/i.test(s)), days.join(" | ")).toBe(true);
  });

  it("reorders by plausibility once the day is closing", () => {
    // "You need to move" is the least useful thing to lead with at 10pm.
    const late = conditionalFits({ planet: "Saturn", at: at(22), ...rhythm }).map((f) => f.capacity);
    expect(late[0]).toBe("depleted");
    expect(late[2]).toBe("restless");
    const day = conditionalFits({ planet: "Saturn", at: at(10), ...rhythm }).map((f) => f.capacity);
    expect(day[1]).toBe("restless");
  });

  it("treats the small hours as quiet even with no rhythm on record", () => {
    for (const planet of PLANETS) {
      for (const f of conditionalFits({ planet, at: at(2) })) {
        expect(arousing(f.suggestion), `${planet} @2am: "${f.suggestion}"`).toBe(false);
      }
    }
  });
});

describe("void of course forbids beginnings in every capacity", () => {
  it("returns re-verbs regardless of which capacity is asked for", () => {
    for (const planet of PLANETS) {
      const fits = conditionalFits({ planet, at: at(10), voc: true, ...rhythm });
      expect(fits.length).toBe(3);
      for (const f of fits) {
        expect(f.basis, `${planet}/${f.capacity}`).toBe("voc");
        // The tradition's counsel is finish-don't-begin. A capacity-specific
        // list that quietly reintroduced "start" would defeat the gate.
        expect(denegate(f.suggestion)).not.toMatch(/\b(start|begin|launch|open a new)\b/i);
      }
    }
  });

  it("outranks wind-down, and stays quiet-safe while doing it", () => {
    for (const planet of PLANETS) {
      for (const f of conditionalFits({ planet, at: at(22), voc: true, ...rhythm })) {
        expect(f.basis).toBe("voc");
        expect(arousing(f.suggestion), `${planet}: "${f.suggestion}"`).toBe(false);
      }
    }
  });
});

describe("the same conditions give the same answer", () => {
  it("is stable across repeated calls — no rotating takes", () => {
    // An app checked several times a day must not appear to change its mind
    // between two looks at the same hour.
    for (const planet of PLANETS) {
      const a = conditionalFits({ planet, at: at(14), ...rhythm });
      const b = conditionalFits({ planet, at: at(14), ...rhythm });
      expect(a).toEqual(b);
    }
  });

  it("varies across the day, so the vocabulary is not one frozen line", () => {
    const seen = new Set<string>();
    for (const h of [8, 10, 13, 16, 19]) {
      for (const f of conditionalFits({ planet: "Mercury", at: at(h), ...rhythm })) seen.add(f.suggestion);
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe("the capacities are not all productivity", () => {
  it("includes rest and company as first-class ways to spend the hour", () => {
    // The owner's direction: invite "not just fire/air ambition, but also self
    // care and social" into the vocabulary. If every capacity resolved to a
    // task, the reframe would be cosmetic.
    const caps: Capacity[] = ["depleted", "restless", "social"];
    for (const c of caps) {
      const any = PLANETS.map((planet) =>
        conditionalFits({ planet, at: at(10), ...rhythm }).find((f) => f.capacity === c)!.suggestion);
      expect(any.length).toBe(PLANETS.length);
    }
    // Rest must be sayable without being earned.
    const moonLow = conditionalFits({ planet: "Moon", at: at(10), ...rhythm })
      .find((f) => f.capacity === "depleted")!.suggestion;
    expect(moonLow).toMatch(/rest|eat|tend|body/i);
  });
});
