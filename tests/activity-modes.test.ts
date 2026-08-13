import { describe, it, expect } from "vitest";
import { ACTIVITIES, modeOf, type ActivityMode } from "../artifacts/api-server/src/lib/activityCorrespondences";
import { TRADITIONAL_PLANETS, MODERN_PLANETS } from "../artifacts/api-server/src/lib/motion";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";

/**
 * Activity mode, and the narrowing of the retrograde cap.
 *
 * The rule capped the top tier whenever any non-luminary significator was
 * retrograde, including a 0.3-weight outer planet. Measured: the median
 * activity was barred from `great` for 38% of the year, because Pluto is
 * retrograde 45% of it. Two category errors — an inherited rule applied to
 * planets discovered centuries after it was written, and a rule about
 * BEGINNINGS applied to every ordinary act.
 */

describe("every activity has a mode chosen for it", () => {
  it("assigns one explicitly — no silent defaults", () => {
    // The default is `execution`, which carries NO cap. That is the safe
    // direction to fail, but it must never be reached by accident: an
    // unassigned activity would quietly opt out of a rule someone may have
    // wanted. This asserts the map is exhaustive.
    const missing = ACTIVITIES.filter((a) => {
      const src = String(modeOf(a.key));
      return src === "execution" && !EXPLICIT_EXECUTION.has(a.key);
    });
    expect(missing.map((a) => a.key), "activities with no explicit mode").toEqual([]);
  });

  it("puts the binding beginnings in inception", () => {
    for (const k of ["launch-venture", "sign-contract", "begin-partnership", "publish", "move-home",
      // A published profile and a sent ask both happen once and carry their
      // moment with them — the same shape the rule was written for.
      "dating-profile", "ask-someone-out"]) {
      expect(modeOf(k), k).toBe("inception");
    }
  });

  it("does not call ordinary work a beginning", () => {
    // The failure that motivated this: a long run demoted because a secondary
    // Saturn was retrograde.
    for (const k of ["endurance", "train-hard", "deep-work", "cook"]) {
      expect(modeOf(k), k).not.toBe("inception");
    }
  });

  it("marks the returning-to activities as revision", () => {
    for (const k of ["edit-revise", "repair", "repair-bond", "investigate"]) {
      expect(modeOf(k), k).toBe("revision");
    }
  });

  it("marks rest and release as recovery", () => {
    for (const k of ["deep-rest", "release", "retreat", "meditate"]) {
      expect(modeOf(k), k).toBe("recovery");
    }
  });
});

// Keys deliberately assigned "execution" — so the exhaustiveness check above
// can tell a real assignment from an unassigned fallthrough.
const EXPLICIT_EXECUTION = new Set([
  "train-hard", "endurance", "intimacy", "deep-study", "first-draft", "learn-skill",
  "strategize", "teach-present", "deep-work", "negotiate", "hard-conversation",
  "deepen-bond", "host", "network", "call-family", "cook", "beautify", "garden",
  "divination",
  // Added with the dating activities (2026-08-13). Both are repeatable and
  // carry no binding start: going out to meet people can be done again next
  // week, and the where-is-this-going talk names a thing that already exists
  // rather than beginning one. (dating-profile and ask-someone-out ARE
  // beginnings and are asserted as inception below.)
  "meet-someone-new", "define-relationship",
]);

describe("the cap no longer reaches where the doctrine never went", () => {
  it("keeps the outers out of the traditional set", () => {
    for (const p of ["Uranus", "Neptune", "Pluto"]) {
      expect(TRADITIONAL_PLANETS.has(p), p).toBe(false);
      expect(MODERN_PLANETS.has(p), p).toBe(true);
    }
  });

  it("stops demoting non-inceptions for a retrograde significator", () => {
    // October 2026: Saturn, Uranus, Neptune and Pluto are all retrograde, so
    // under the old rule almost every activity carrying one was capped.
    const AT = new Date(Date.UTC(2026, 9, 15, 12));
    const PLACE = { lat: 29.4246, lon: -98.49514, tzOffsetMin: 300 };
    // A SAMPLE, not the whole table. Looping all 46 took 25s, and this file
    // runs on every deploy via `pnpm test` — the full sweep belongs in tools/
    // where a slow diagnostic cannot hold up a build. These six each carry a
    // significator that is retrograde in October 2026.
    const SAMPLE = ["endurance", "deep-work", "edit-revise", "deep-clean", "deep-rest", "cook"];
    let greatOnNonInception = 0;
    for (const key of SAMPLE) {
      expect(modeOf(key), `${key} should not be an inception`).not.toBe("inception");
      const r = computeElections({ activityKey: key, span: "week", ...PLACE, startAt: AT } as any);
      if (r) greatOnNonInception += r.windows.filter((w) => w.tier === "great").length;
    }
    // The point is only that the gate is no longer categorical. Before the
    // narrowing this was reachable but heavily suppressed by outer-planet
    // retrogradation that had nothing to do with the activity.
    expect(greatOnNonInception).toBeGreaterThan(0);
  }, 30_000);
});
