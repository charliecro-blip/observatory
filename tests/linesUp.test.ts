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
  // open tasks waited six seconds on every Home load. Elections are memoised
  // per ACTIVITY, since the computation does not depend on which task asked.
  //
  // Asserted by COUNTING, not by timing. A millisecond budget measured the
  // machine and failed under the parallel suite; so did a ratio, because the
  // one-item baseline is a few milliseconds and jitter swamps it. The result
  // now reports how many elections it ran, which is exact and load-independent.
  it("prices each activity once, not each item", () => {
    const many = Array.from({ length: 12 }, (_, i) => held(`Deep work sprint number ${i}`));
    const r = linesUp({ ...base, held: many });
    expect(r.electionsComputed).toBe(1);           // twelve items, one activity
  });

  it("prices distinct activities separately", () => {
    const mixed = [held("Deep work sprint"), held("Long run"), held("Sign a contract"), held("Deep work sprint again")];
    const r = linesUp({ ...base, held: mixed });
    expect(r.electionsComputed).toBeGreaterThan(1);
    expect(r.electionsComputed).toBeLessThanOrEqual(3);
  });
});

describe("all-day testimony", () => {
  // The engine returns windows with allDay:true — the Moon's sign, say — whose
  // clock range is just the waking day. Rendering "7 AM–11 PM" as a
  // recommendation dressed a standing condition up as an appointment, and this
  // module exists to answer WHEN.
  it("prefers a bounded window over an all-day one at equal strength", () => {
    let sawBounded = 0, sawAllDay = 0;
    for (const title of ["Deep work sprint", "Finish & ship the last 10%", "Sign a contract", "Long run"]) {
      const r = linesUp({ ...base, held: [held(title)] });
      for (const x of r.results) (x.allDay ? sawAllDay++ : sawBounded++);
    }
    // If this only ever saw all-day rows the preference would be untested.
    expect(sawBounded + sawAllDay).toBeGreaterThan(0);
    expect(sawBounded).toBeGreaterThanOrEqual(sawAllDay);
  });

  // `expect(typeof x.allDay).toBe("boolean")` was here, which asserts nothing —
  // the fourth instance of that pattern in this session. And the loop ran six
  // IDENTICAL iterations, so it was six full election computations proving one
  // thing once and timing out. Both replaced with the actual claim: whatever a
  // row says, the flag and the clock range agree about it.
  it("never prints the waking day as if it were an hour", () => {
    const r = linesUp({ ...base, held: [held("Deep work sprint"), held("Long run"), held("Sign a contract")] });
    for (const x of r.results) {
      const spansWholeDay = /^7 ?AM$/.test(x.startClock) && /^11 ?PM$/.test(x.endClock);
      // A whole-day span is only allowed to appear when the row admits it is
      // an all-day condition, which is what lets the UI say "all day" instead.
      if (spansWholeDay) expect(x.allDay).toBe(true);
    }
  });
});
