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

  for (const field of ["approach", "meaning", "feelings", "literacy", "core", "voice", "byPart", "signification", "theme", "roads"] as const) {
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
      // The flat `activities` list became `byPart` on 2026-08-23, when the two
      // tables of this vocabulary were merged. The invariant is unchanged and
      // now stronger: a planet must have something to say in EVERY part of the
      // day, because approachOptions falls back to nothing when a day-part is
      // missing — which is exactly how the outer three used to return [].
      const byPart = PLANETS[p].byPart!;
      const lines = Object.values(byPart).flat();
      expect(lines.length, `${p} byPart lines`).toBeGreaterThanOrEqual(3);
      for (const part of ["early", "morning", "midday", "evening", "winddown", "night"] as const) {
        expect(byPart[part]?.length, `${p} byPart.${part}`).toBeGreaterThan(0);
      }
      expect(PLANETS[p].theme!.verb.length, `${p} theme.verb`).toBeGreaterThan(4);
    }
  });

  it("keeps the house rules in the strings people see", () => {
    const seen: string[] = [];
    for (const p of ALL) {
      const e = PLANETS[p];
      seen.push(e.theme!.verb, e.signification!, e.voice!.essence, e.voice!.whenLoud, e.voice!.myth,
        ...Object.values(e.byPart!).flat(), ...e.theme!.activities, e.roads!.gift, e.roads!.shadow, e.roads!.work);
    }
    for (const s of seen) {
      expect(s, `"overdue" is banned: ${s}`).not.toMatch(/\boverdue\b/i);
      // British spellings the tree does not use.
      //
      // Not a bare /\w+ise\b/: that reads "keep the promise" as a Britishism,
      // because the -ise is part of the root rather than the British form of
      // -ize. It also failed on exercise, revise and overpromised. The guard
      // was wrong for as long as it existed and only fired once the merged
      // byPart table brought a string containing "promise" into its scope.
      // The discriminator is that a real Britishism has an -ize counterpart.
      const ROOT_ISE = /^(?:over)?(?:promis|exercis|revis|advis|devis|surpris|comprom|improvis|supervis|televis|disguis|apprais|premis|compris|aris|ris|wis|franchis|merchandis|demis|excis|incis)(?:e|ed|es|ing)$/i;
      for (const m of s.matchAll(/\b\w+(?:ise|isation|ised|ising)\b/gi)) {
        expect(ROOT_ISE.test(m[0]), `British spelling "${m[0]}" in: ${s}`).toBe(true);
      }
      expect(s.trim(), "no empty string").not.toBe("");
    }
  });
});
