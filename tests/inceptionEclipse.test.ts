import { describe, it, expect } from "vitest";
import { scoreElection } from "../artifacts/api-server/src/lib/inceptionElection.js";

/**
 * `inceptionElection`'s eclipse rule used to consult a small hardcoded date
 * list — "Small rolling table... Source: NASA eclipse canon" — covering
 * exactly 2026-2027 and silently WRONG the day the calendar runs past it
 * (reads as "no eclipse within 3 days" rather than refusing to answer,
 * because the loop's `best` just stays large for a nearest-match that no
 * longer exists). "One authority" ruling, 2026-08-10: it now calls the same
 * `eclipseWindow()` geometry `electionEngine.ts` already uses. This is the
 * one behavior-preserving check on that swap — inception itself is
 * deliberately not otherwise touched or given a full test suite here.
 *
 * 2026-08-12 was itself one of the OLD table's own dates, chosen so a reader
 * can see the swap didn't silently change what "near an eclipse" means for a
 * moment the old table was confident about.
 */
describe("inception's eclipse rule, after the canonical swap", () => {
  it("still flags a launch inside the 3-day window of a real eclipse", () => {
    const r = scoreElection(new Date("2026-08-12T18:00:00Z"), 30.27, -97.74, "contract");
    const rule = r.rules.find(x => x.key === "eclipse_proximity");
    expect(rule?.passed, "a moment inside a real eclipse window must fail this rule").toBe(false);
    expect(rule?.detail).toMatch(/eclipse/i);
  });

  it("does not flag an ordinary date with no eclipse nearby", () => {
    const r = scoreElection(new Date("2026-05-15T18:00:00Z"), 30.27, -97.74, "contract");
    const rule = r.rules.find(x => x.key === "eclipse_proximity");
    expect(rule?.passed, "a quiet date must not be flagged as near an eclipse").toBe(true);
  });

  it("still answers correctly PAST the old table's last hardcoded date (2027-08-02)", () => {
    // The exact failure the hardcoded list was one calendar year away from:
    // a date after its last entry used to fall back to "no eclipse" no
    // matter how close the real sky actually was. eclipseWindow() has no
    // such edge — it computes from lunar node geometry, not a list.
    const r = scoreElection(new Date("2028-01-15T18:00:00Z"), 30.27, -97.74, "contract");
    const rule = r.rules.find(x => x.key === "eclipse_proximity");
    expect(rule, "the rule must still be evaluated, not silently absent").toBeTruthy();
  });
});
