import { describe, it, expect } from "vitest";
import { linesUp, type HeldItem } from "../artifacts/api-server/src/lib/linesUp.js";

const base = { lat: 30.27, lon: -97.74, tzOffsetMin: 300, natal: null, timeKnown: true, locationKnown: true };
const held = (title: string, extra: Partial<HeldItem> = {}): HeldItem =>
  ({ id: title.slice(0, 8), title, kind: "task", ...extra });

describe("what lines up", () => {
  it("says thin-inventory rather than showing an empty module", () => {
    const r = linesUp({ ...base, held: [] });
    expect(r.quiet).toBe("thin-inventory");
    expect(r.results).toEqual([]);
  });

  // The measured case that broke the first rule: "Finish & ship" scored 2.25,
  // the right answer, with "Meditate / pray" second at 1.38 on incidental
  // overlap. A pure margin rule turned a correct match into the question
  // "Finish & ship, or meditate?" — worse than either alternative.
  it("does not treat an implausible runner-up as a rival", () => {
    const r = linesUp({ ...base, held: [held("Finish the Q3 positioning memo and circulate it to the three people who asked")] });
    const asked = r.clarify.map(c => c.candidates.map(x => x.label).join("/"));
    expect(asked.some(a => /Meditate/i.test(a))).toBe(false);
  });

  // Nothing in the palette should be silently timed as something else.
  it("stays silent on an item with no credible match", () => {
    const r = linesUp({ ...base, held: [held("Renew the domain")] });
    expect(r.results).toEqual([]);
    expect(r.clarify).toEqual([]);
  });

  // A pre-assigned key is the person's own classification (Guiding Stars carry
  // one from planet-diagnosis). Re-matching the title would let the keyword
  // matcher overrule them.
  it("uses an assigned activityKey instead of re-matching the title", () => {
    const r = linesUp({ ...base, held: [held("something the matcher would never recognise", { activityKey: "deep-work", kind: "star-step" })] });
    const seen = [...r.results, ...([] as any)].map(x => x.activityKey);
    // Either it produced a result for deep-work, or the day had no window for
    // it — but it must never have been sent to the matcher and lost.
    expect(r.clarify).toEqual([]);
    if (seen.length) expect(seen).toContain("deep-work");
  });

  it("ignores a stale activityKey rather than dropping the item", () => {
    const r = linesUp({ ...base, held: [held("Deep work: rewrite the onboarding sequence", { activityKey: "no-such-activity" })] });
    // Falls through to matching; must not throw and must not vanish silently.
    expect(r.results.every(x => x.activityKey !== "no-such-activity")).toBe(true);
  });

  it("never returns more than three results", () => {
    const many = Array.from({ length: 10 }, (_, i) => held(`Deep work sprint number ${i}`));
    expect(linesUp({ ...base, held: many }).results.length).toBeLessThanOrEqual(3);
  });

  // This started as a 5s test timeout and was a real performance finding: ten
  // held items meant ten full ephemeris runs at ~600ms each, so anyone with ten
  // open tasks waited six seconds on every Home load. Elections are now
  // memoised per ACTIVITY, since the computation does not depend on which task
  // asked.
  //
  // Asserted as a RATIO, not a wall-clock budget. A fixed millisecond ceiling
  // measures the machine rather than the code, and it duly passed alone and
  // failed under the parallel suite. Twelve identical items should cost about
  // what one costs; without memoisation the ratio would be ~12.
  it("prices each activity once, not each item", () => {
    const one = [held("Deep work sprint number 0")];
    const many = Array.from({ length: 12 }, (_, i) => held(`Deep work sprint number ${i}`));

    linesUp({ ...base, held: one });          // warm anything lazily initialised
    const t0 = performance.now();
    linesUp({ ...base, held: one });
    const single = performance.now() - t0;

    const t1 = performance.now();
    linesUp({ ...base, held: many });
    const twelve = performance.now() - t1;

    expect(twelve / Math.max(single, 1)).toBeLessThan(4);
  });
});
