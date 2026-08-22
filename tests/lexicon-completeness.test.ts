import { describe, it, expect } from "vitest";
import { PLANETS } from "../lib/lexicon/src/planets.js";

/**
 * EVERY PLANET CARRIES A FULL ENTRY.
 *
 * The three outer planets carried only literacy and meaning until 2026-08-22.
 * That was defensible while they could never lead a reading, and stopped being
 * so the moment they could: on the day the Moon sat 0.3° from Uranus, the
 * reading's loudest voice was "flow toward breaking the old pattern" and the
 * day's foci were "write · sort · write & edit", borrowed from quieter
 * testimony, because Uranus had no activities of its own.
 *
 * The gap was invisible because two collectors silently skipped any body
 * without a theme. Nothing skips them now, so a planet added with a missing
 * field would go quiet instead of erroring — hence this.
 */
const ALL = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

describe("the planet lexicon is complete", () => {
  it("has an entry for every planet the engine reads", () => {
    for (const p of ALL) expect(PLANETS[p], p).toBeTruthy();
  });

  for (const field of ["approach", "meaning", "feelings", "literacy", "core", "voice", "activities", "signification", "theme", "roads"] as const) {
    it(`gives every planet a ${field}`, () => {
      const missing = ALL.filter(p => {
        const v = (PLANETS[p] as Record<string, unknown>)[field];
        return v == null || (Array.isArray(v) && v.length === 0);
      });
      expect(missing, `missing ${field}`).toEqual([]);
    });
  }

  it("gives every planet activities to actually suggest", () => {
    // theme.activities are the day's foci chips; a planet that can lead the
    // reading and offers nothing to do is the defect this file exists for.
    for (const p of ALL) {
      expect(PLANETS[p].theme!.activities.length, `${p} theme.activities`).toBeGreaterThanOrEqual(3);
      expect(PLANETS[p].activities!.length, `${p} activities`).toBeGreaterThanOrEqual(3);
      expect(PLANETS[p].theme!.verb.length, `${p} theme.verb`).toBeGreaterThan(4);
    }
  });

  it("keeps the house rules in the strings people see", () => {
    const seen: string[] = [];
    for (const p of ALL) {
      const e = PLANETS[p];
      seen.push(e.theme!.verb, e.signification!, e.voice!.essence, e.voice!.whenLoud, e.voice!.myth,
        ...e.activities!, ...e.theme!.activities, e.roads!.gift, e.roads!.shadow, e.roads!.work);
    }
    for (const s of seen) {
      expect(s, `"overdue" is banned: ${s}`).not.toMatch(/\boverdue\b/i);
      // British spellings the tree does not use.
      expect(s, `British spelling: ${s}`).not.toMatch(/\b\w+(ise|isation|ised|ising)\b/i);
      expect(s.trim(), "no empty string").not.toBe("");
    }
  });
});
