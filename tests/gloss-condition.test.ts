import { describe, it, expect } from "vitest";
import { glossHolds } from "../artifacts/api-server/src/lib/glossCondition";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";
import { associateDeterministic } from "../artifacts/api-server/src/lib/associate";
import { isRetrograde, julianDay } from "../artifacts/api-server/src/lib/astro";

// 2026-08-31: Mercury DIRECT. Retrogrades that day were Saturn, Neptune,
// Pluto and Chiron — measured from the running server, and the day the owner
// was shown "Drafting classically SUITS the retrograde".
const MERCURY_DIRECT = new Date("2026-08-31T20:00:00Z");

describe("glossHolds", () => {
  it("lets an ungated gloss through on any day", () => {
    // Most glosses are advice or rules: "sow waxing, weed and prune waning"
    // tells you what to do with a phase without claiming today has one.
    expect(glossHolds(undefined, MERCURY_DIRECT)).toBe(true);
  });

  it("refuses the retrograde gloss on a day Mercury is direct", () => {
    expect(isRetrograde("Mercury", julianDay(MERCURY_DIRECT))).toBe(false);
    expect(glossHolds("mercury-retrograde", MERCURY_DIRECT)).toBe(false);
  });

  it("agrees with the ephemeris rather than keeping its own opinion", () => {
    // Sampled across a season: the gate must track isRetrograde exactly, or it
    // becomes a second source of truth about Mercury's motion.
    for (let d = 0; d < 120; d += 7) {
      const at = new Date(MERCURY_DIRECT.getTime() + d * 86400000);
      expect(glossHolds("mercury-retrograde", at), at.toISOString())
        .toBe(isRetrograde("Mercury", julianDay(at)));
    }
  });

  it("treats waxing and waning as exclusive", () => {
    let both = 0;
    for (let d = 0; d < 30; d++) {
      const at = new Date(MERCURY_DIRECT.getTime() + d * 86400000);
      if (glossHolds("waxing-moon", at) && glossHolds("waning-moon", at)) both++;
    }
    expect(both).toBe(0);
  });

  it("says no to a condition it cannot evaluate, rather than yes", () => {
    // Silence is the safe direction: an unevaluable gate is exactly the case
    // that produced the complaint.
    expect(glossHolds("not-a-real-condition" as any, MERCURY_DIRECT)).toBe(false);
  });
});

describe("which glosses are gated", () => {
  const gated = ACTIVITIES.filter(a => (a as any).glossNeeds);

  it("gates the ones written in the definite", () => {
    const keys = gated.map(a => a.key).sort();
    expect(keys).toEqual(["deep-rest", "edit-revise", "first-draft", "meditate"]);
  });

  it("leaves advice and rules ungated, because they hold on any day", () => {
    // "not while Mercury is retrograde" is a constraint, not a report.
    const contract = ACTIVITIES.find(a => a.key === "sign-contract")!;
    expect(contract.gloss).toMatch(/retrograde/);
    expect((contract as any).glossNeeds).toBeUndefined();
    const garden = ACTIVITIES.find(a => a.key === "garden")!;
    expect(garden.gloss).toMatch(/waxing|waning/);
    expect((garden as any).glossNeeds).toBeUndefined();
  });

  it("carries the condition out of the association for the caller to check", () => {
    // associateDeterministic is pure text in, association out — no date, no
    // sky — so it may only pass the condition along, never evaluate it.
    const a = associateDeterministic("write a first draft of the report");
    expect(a.activityKey).toBe("first-draft");
    expect(a.rationaleNeeds).toBe("mercury-retrograde");
    expect(a.rationale).toMatch(/retrograde/);
  });
});
