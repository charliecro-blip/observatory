import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

/**
 * Claims the app is not allowed to make.
 *
 * From the power-user audit, 2026-08-02. Each of these was a place where
 * Compass asserted more than it knew — the failure mode that costs a serious
 * user their trust in everything else the app says.
 */

describe("no invented obligations", () => {
  const FILES = [
    "artifacts/tides/src/components/Dashboard.tsx",
    "artifacts/tides/src/components/Rail.tsx",
    "artifacts/tides/src/pages/Today.tsx",
    "artifacts/tides/src/pages/GuidingStarsHub.tsx",
  ];

  it("never fabricates a weekly session target", () => {
    // `Math.max(scheduledCount, 2)` invented a denominator the user never set,
    // so a brand-new Guiding Star rendered "0/2 this week" — a goal the app
    // made up, already being failed. Movement can be reflected; quotas cannot
    // be assumed.
    for (const f of FILES) {
      const src = read(f);
      expect(src, `${f} still invents a session target`)
        .not.toMatch(/Math\.max\(\s*g?\.?scheduledCount[^)]*,\s*2\s*\)/);
    }
  });

  it("shows a progress bar only when a real denominator exists", () => {
    // A ratio needs something the user actually scheduled; otherwise there is
    // nothing to be a fraction OF.
    //
    // The Hub is where the bar actually lives, so it is asserted outright —
    // without that, this test would pass vacuously the day the last bar is
    // deleted.
    //
    // Today.tsx used to be on the unconditional list too, and that was wrong:
    // its only matching guard sat inside `NorthStarsCard`, a component never
    // rendered (proven by its strings being absent from the production
    // bundle, and deleted outright on 2026-08-03). Demanding the guard from a
    // file that draws no bar tests nothing, and would have FAILED the moment
    // someone removed the dead component — a test defending something
    // worthless.
    //
    // The rest are checked CONDITIONALLY: a file owes the guard only if it
    // computes a scheduled ratio in the first place. That keeps the
    // protection alive for files that grow one later, without pinning dead
    // code in files that don't.
    const hub = "artifacts/tides/src/pages/GuidingStarsHub.tsx";
    expect(read(hub), `${hub} draws a bar without checking scheduled > 0`)
      .toMatch(/scheduled > 0 &&/);

    for (const f of FILES) {
      const src = read(f);
      if (!/Math\.round\(\(done \/ scheduled\)/.test(src)) continue;
      expect(src, `${f} computes a scheduled ratio without checking scheduled > 0`)
        .toMatch(/scheduled > 0 &&/);
    }
  });

  it("Dashboard reports movement without a denominator at all", () => {
    // The live Today surface for star progress is Dashboard's card, which now
    // states what happened rather than drawing a ratio.
    const d = read("artifacts/tides/src/components/Dashboard.tsx");
    expect(d).toMatch(/done > 0 \? `\$\{done\} this week`/);
  });
});

describe("unavailable data never looks like empty data", () => {
  const planner = read("artifacts/tides/src/components/Planner.tsx");

  it("distinguishes a failed calendar fetch from a free week", () => {
    // Returning [] for both meant the weaver planned straight over real
    // meetings and the schedule looked equally confident either way.
    expect(planner).toMatch(/ok:\s*false/);
    expect(planner).toMatch(/calendarUnverified/);
  });

  it("says so in the UI rather than swallowing it", () => {
    expect(planner).toMatch(/couldn't check your calendar/i);
    // And offers a retry — a warning with no action is just guilt.
    expect(planner).toMatch(/Try again/);
  });

  it("still treats 'not connected' as a genuine empty", () => {
    // Not-connected is a true empty and must not raise a false alarm.
    expect(planner).toMatch(/404|409/);
  });
});

describe("claims match the evidence", () => {
  it("does not call the recommendation 'best'", () => {
    const today = read("artifacts/tides/src/pages/Today.tsx");
    expect(today).toMatch(/Strongest fit right now/);
    // The heading itself must not say "Best next move" (the explanatory
    // comment about why it doesn't is allowed to mention the old name).
    expect(today).not.toMatch(/>\s*Best next move\s*</);
  });

  it("does not claim the sky read the user's text", () => {
    // Star diagnosis is Compass classifying wording through its own
    // correspondence system — nothing celestial observed anything.
    const hub = read("artifacts/tides/src/pages/GuidingStarsHub.tsx");
    expect(hub).not.toMatch(/The sky reads this as/);
    expect(hub).toMatch(/Compass reads your wording as/);
  });

  it("labels the hero curve as a phase indicator, not a forecast", () => {
    // It is a fixed sine — only the marker carries data — and it renders
    // beside real percentages, so it must say what it is.
    const today = read("artifacts/tides/src/pages/Today.tsx");
    expect(today).toMatch(/not a graph of the day/);
  });

  it("defines energy and downgrades 'confidence' to signal agreement", () => {
    const today = read("artifacts/tides/src/pages/Today.tsx");
    expect(today).toMatch(/signal agreement/);
    // Energy must be described as activation, not favourability — the
    // likeliest misreading of a bare percentage.
    expect(today).toMatch(/ACTIVATION[^"]*not how favourable/);
  });
});
