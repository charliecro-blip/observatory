import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

/**
 * Claims the app is not allowed to make.
 *
 * From the power-user audit, 2026-08-02. Each of these was a place where
 * Compass asserted more than it knew — the failure mode that costs a serious
 * user their trust in everything else the app says.
 */

const SRC_DIRS = { components: "artifacts/tides/src/components" };

describe("no invented obligations", () => {
  // Dashboard and Today retired on 2026-08-19; every surface that draws star
  // progress is still on this list, which is the thing the list is for.
  const FILES = [
    "artifacts/tides/src/components/Rail.tsx",
    "artifacts/tides/src/components/WhereYouAre.tsx",
    "artifacts/tides/src/pages/Home.tsx",
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

  it("star progress reports movement without a denominator at all", () => {
    // Asserted against whichever file actually DRAWS star progress, which is
    // the only version of this test worth having. It moved once already: the
    // card lived on Today (Dashboard.tsx) until the Home/Today split on
    // 2026-08-14 sent week-scale figures to Home, and pinning the old path
    // would have failed for the reason the file no longer draws the thing —
    // the exact "source-text test defends dead code" trap this file's other
    // case was rewritten to avoid.
    // It has now moved TWICE — Dashboard → Home (the 2026-08-14 split) →
    // WhereYouAre (the 2026-08-19 top-of-page rework, which absorbed Home's
    // stars card). Rather than chase it a third time, find whichever file
    // actually draws it and assert there. A move now updates nothing; only
    // deleting the safe form, or drawing star progress nowhere at all,
    // fails — which is exactly the pair of things worth failing on.
    const drawers = readdirSync(SRC_DIRS.components)
      .filter(f => f.endsWith(".tsx"))
      .map(f => `artifacts/tides/src/components/${f}`)
      .concat(["artifacts/tides/src/pages/Home.tsx"])
      .filter(f => /scheduledCount/.test(read(f)));

    expect(drawers.length, "nothing draws star progress any more").toBeGreaterThan(0);
    for (const f of drawers) {
      expect(read(f), `${f} draws star progress without the bare-count form`)
        .toMatch(/done > 0 \? `\$\{done\} this week`/);
    }
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
    // "Best" claims a global optimum over facts the engine does not hold —
    // what you are mid-way through, your capacity, whether someone is waiting.
    //
    // This used to require the literal "Strongest fit right now" inside
    // Today.tsx, and so failed when that card was deleted as a duplicate of
    // Home's — a test asserting an ADDRESS rather than a claim. It now checks
    // every page and component: wherever the recommendation is named, it must
    // not be named "best".
    const roots = ["artifacts/tides/src/pages", "artifacts/tides/src/components"];
    const sources = roots.flatMap((dir) =>
      readdirSync(join(process.cwd(), dir))
        .filter((f) => f.endsWith(".tsx"))
        .map((f) => read(`${dir}/${f}`)));

    for (const src of sources) {
      expect(src, "a surface headed its recommendation 'Best next move'")
        .not.toMatch(/>\s*Best next move\s*</);
    }
    // The existence check that used to sit here is gone, and its removal is
    // the point rather than an oversight.
    //
    // It asserted that SOME surface still named a recommendation, guarding
    // against the guard quietly becoming vacuous. On 2026-08-19 every one of
    // them was removed deliberately — "it shouldn't auto-suggest possibilities
    // of what to do, unprompted... let people ask/input context, rather than
    // being told what to do" — so the check was asserting the presence of a
    // thing the product had decided not to have.
    //
    // What survives is the claim worth keeping: wherever a recommendation IS
    // named, in Ask or anywhere later, it must not be named "best".
  });

  it("does not claim the sky read the user's text", () => {
    // Star diagnosis is Compass classifying wording through its own
    // correspondence system — nothing celestial observed anything.
    const hub = read("artifacts/tides/src/pages/GuidingStarsHub.tsx");
    expect(hub).not.toMatch(/The sky reads this as/);
    expect(hub).toMatch(/Compass reads your wording as/);
  });

  // REMOVED 2026-08-19: "labels the hero curve as a phase indicator, not a
  // forecast" required the caption "not a graph of the day".
  //
  // It had been wrong since the curve was replaced. The invented sine went
  // away and a real computed position took its place, so the caption went
  // too — and moon-cycle.test.ts asserts its ABSENCE, on the house rule that
  // a disclaimer means the design is wrong. The two tests demanded opposite
  // things and both passed, because this one was reading the phrase out of a
  // COMMENT explaining why the caption had been deleted. A test kept alive by
  // prose about its own obsolescence.

  it("states charge as a band, never a percentage, and calls confidence agreement", () => {
    // The meta row moved out of Today's hero and under the reading, on Home
    // (2026-08-19). It very nearly went in the bin with the banner it sat on;
    // this test is why it did not.
    const today = read("artifacts/tides/src/components/DayReading.tsx");
    expect(today).toMatch(/signal agreement/);
    // Charge must read as activation, not favorability — the likeliest
    // misreading. Spelling-agnostic on purpose: this pinned "favourable" and
    // so failed the day the copy was corrected to the house's American
    // spellings, which is a test asserting an orthography rather than the
    // claim it was written to protect.
    expect(today).toMatch(/not how favou?rable/);
    // And it must not be a percentage. "Energy 89%" drew exactly the right
    // question from the owner — how does that square with a 74% lit Moon? —
    // and the answer was that energy IS illumination plus up to 0.15 for
    // angular planets and 0.10 for tight aspects. A number that is mostly one
    // input with two bonuses stapled on cannot carry two significant figures.
    expect(today, "the charge percentage is back").not.toMatch(/Energy \{energyPct\}%/);
    expect(today).toMatch(/strongly charged|moderately charged|quietly charged/);
  });
});
