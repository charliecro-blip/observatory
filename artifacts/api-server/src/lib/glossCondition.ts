/**
 * WHEN AN ACTIVITY'S GLOSS IS ACTUALLY TRUE.
 *
 * A gloss is timeless doctrine about a kind of work. Most are safe to show on
 * any day because they are advice or rules — "sow waxing, weed and prune
 * waning" tells you what to do with a moon phase without claiming today has
 * one, and "not while Mercury is retrograde" is a constraint, not a report.
 *
 * A few are written in the definite, and those read as claims about right now:
 *
 *   "Drafting classically SUITS the retrograde — only the release doesn't."
 *   "Slack water is real rest — the void is for this."
 *   "The waning moon cuts; Virgo's water shows every pebble."
 *
 * plan.ts hands the gloss through as a scheduled block's `rationale`, and
 * Planner renders it as that block's explanation. So on 2026-08-31, with
 * Mercury direct, a woven task said drafting suits the retrograde (owner: "i
 * also am bugged by inserting retrograde language here in mercury - mercury
 * isn't retrograde!"). The app was not computing anything wrong; it was
 * quoting a book at a day the book was not about.
 *
 * These predicates let the caller — which knows the block's instant — drop a
 * gloss whose condition is absent, and keep it when it holds, where it is
 * genuinely the best thing that could be said.
 */

import { isRetrograde, voidOfCourse, moonPhase, julianDay } from "./astro.js";

export type GlossNeed = "mercury-retrograde" | "void-moon" | "waning-moon" | "waxing-moon";

/**
 * Does the condition a gloss presupposes actually hold at this moment?
 *
 * Unknown conditions return false rather than true: a gloss whose gate cannot
 * be evaluated is exactly the case that produced the complaint, and silence is
 * the safe direction.
 */
export function glossHolds(need: GlossNeed | undefined, at: Date): boolean {
  if (!need) return true;                     // ungated glosses always stand
  const jd = julianDay(at);
  switch (need) {
    case "mercury-retrograde": return isRetrograde("Mercury", jd);
    case "void-moon":          return voidOfCourse(jd).voc;
    // `moonPhase` gives the illuminated fraction and the phase name; waxing and
    // waning are read off the name rather than re-derived, so this cannot
    // disagree with what the rest of the app calls the same day.
    case "waning-moon":        return /waning|last quarter|balsamic|disseminating/i.test(moonPhase(jd).name);
    case "waxing-moon":        return /waxing|first quarter|crescent|gibbous/i.test(moonPhase(jd).name)
                                      && !/waning/i.test(moonPhase(jd).name);
    default:                   return false;
  }
}
