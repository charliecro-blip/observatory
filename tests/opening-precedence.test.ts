import { describe, it, expect } from "vitest";
import { chooseOpening, OPENING_ORDER, DEFERRED_LABEL, type OpeningKind } from "../artifacts/tides/src/lib/opening.js";

const all = (v: boolean) => Object.fromEntries(OPENING_ORDER.map(k => [k, v])) as Record<OpeningKind, boolean>;

describe("exactly one thing leads Home", () => {
  // The invariant the page has never had. Home's own comments named a
  // hierarchy — LEVEL 1 · THE ANSWER — while rendering Level 1 below Level 2
  // with no code under it. A rule nothing checks is a comment.
  it("never renders two openings, whatever is live", () => {
    // Every subset of the five contenders, exhaustively.
    const contenders = OPENING_ORDER.filter(k => k !== "lead");
    for (let mask = 0; mask < (1 << contenders.length); mask++) {
      const live: Partial<Record<OpeningKind, boolean>> = {};
      contenders.forEach((k, i) => { if (mask & (1 << i)) live[k] = true; });
      const { shown, deferred } = chooseOpening(live);
      expect(shown).toBeTruthy();
      expect(deferred).not.toContain(shown);
      // shown + deferred accounts for every live contender, exactly once.
      const claimed = [shown, ...deferred].filter(k => k !== "lead");
      expect(new Set(claimed).size).toBe(claimed.length);
      expect(claimed.sort()).toEqual(contenders.filter(k => live[k]).sort());
    }
  });

  it("never renders zero — the lead is the floor", () => {
    expect(chooseOpening({}).shown).toBe("lead");
    expect(chooseOpening(all(false)).shown).toBe("lead");
  });

  it("takes the one that expires soonest when everything is live", () => {
    const { shown, deferred } = chooseOpening(all(true));
    expect(shown).toBe("crossing");
    expect(deferred).toEqual(["ritual", "newmoon", "rare", "review"]);
  });
});

describe("the order says what it means", () => {
  it("puts a twenty-minute window above a whole ritual window", () => {
    expect(chooseOpening({ crossing: true, ritual: true }).shown).toBe("crossing");
  });

  it("keeps the shipped new-moon over rare-moment rule", () => {
    // RareMomentBanner has taken suppressed={turningPointPromptOpen(...)}
    // since the check-in was built; the ladder generalises that, not replaces it.
    expect(chooseOpening({ newmoon: true, rare: true }).shown).toBe("newmoon");
  });

  it("lets the Sunday review through only when nothing rarer is live", () => {
    expect(chooseOpening({ review: true }).shown).toBe("review");
    expect(chooseOpening({ review: true, rare: true }).shown).toBe("rare");
  });

  it("falls to the lead when the sky is quiet", () => {
    expect(chooseOpening({ crossing: false, rare: false }).shown).toBe("lead");
  });
});

describe("a loser is deferred, not dropped", () => {
  it("reports every live candidate that lost, so the page can still name it", () => {
    const { deferred } = chooseOpening({ ritual: true, rare: true, review: true });
    expect(deferred).toEqual(["rare", "review"]);
  });

  it("has a sayable label for every kind that can be deferred", () => {
    for (const k of OPENING_ORDER) {
      if (k === "lead") continue;
      expect(DEFERRED_LABEL[k].length).toBeGreaterThan(3);
    }
  });

  it("does not report the lead as deferred — it did not lose", () => {
    expect(chooseOpening({ crossing: true }).deferred).not.toContain("lead");
  });
});
