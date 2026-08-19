import { describe, it, expect } from "vitest";
import { pickCondition } from "../artifacts/tides/src/components/DayConditions";

/**
 * ONE CONDITION AT A TIME, ranked by rarity (audit 2026-08-19 §5).
 *
 * Three banners — rhythm risk, the void Moon, the cycle phase — were spread
 * across two pages, and the void was drawn twice in two different voices.
 * Folding them onto one page risked recreating the stack that the 2026-08-04
 * Home/Today split existed to fix, so exactly one of them may hold the slot.
 *
 * These pin the ORDER, which is the part a render tree cannot assert about
 * itself. Rarity is the rule: rhythm risk is occasional, a void Moon happens
 * on a large share of days, and a cycle phase is true every single day for
 * anyone tracking one — so the least surprising fact takes the slot only when
 * nothing rarer wants it.
 */

const VOID = { isVOC: true, reading: { feel: "…", instead: "…" } };
const CYCLE = { cycleStartDate: "2026-08-05", cycleLength: 28, lutealLength: 14 };

describe("the condition slot", () => {
  it("shows nothing when nothing is true", () => {
    expect(pickCondition({ now: {}, skyQuiet: false })).toBe(null);
    expect(pickCondition({ now: null, cycle: null, skyQuiet: false })).toBe(null);
  });

  it("renders each condition on its own", () => {
    expect(pickCondition({ now: { rhythmRisk: true }, skyQuiet: false })).toBe("risk");
    expect(pickCondition({ now: { voc: VOID }, skyQuiet: false })).toBe("void");
    expect(pickCondition({ now: {}, cycle: CYCLE, skyQuiet: false })).toBe("cycle");
  });

  it("ranks rhythm risk over everything", () => {
    expect(pickCondition({ now: { rhythmRisk: true, voc: VOID }, cycle: CYCLE, skyQuiet: false })).toBe("risk");
  });

  it("ranks the void over the cycle phase", () => {
    expect(pickCondition({ now: { voc: VOID }, cycle: CYCLE, skyQuiet: false })).toBe("void");
  });

  it("never shows a void without its reading — a bare 'the Moon is void' is a word, not a fact", () => {
    expect(pickCondition({ now: { voc: { isVOC: true } }, cycle: CYCLE, skyQuiet: false })).toBe("cycle");
  });

  it("hides the void at the quiet lens, and lets the next condition have the slot", () => {
    expect(pickCondition({ now: { voc: VOID }, cycle: CYCLE, skyQuiet: true })).toBe("cycle");
    expect(pickCondition({ now: { voc: VOID }, skyQuiet: true })).toBe(null);
  });

  it("honors the void preference the same way, without swallowing the slot", () => {
    // The Settings toggle used to gate Today's copy of this strip. Turning it
    // off must not blank the slot when something else has a claim on it.
    expect(pickCondition({ now: { voc: VOID }, cycle: CYCLE, skyQuiet: false, showVoid: false })).toBe("cycle");
    expect(pickCondition({ now: { rhythmRisk: true, voc: VOID }, skyQuiet: false, showVoid: false })).toBe("risk");
  });

  it("keeps rhythm risk at the quiet lens — nothing in it is astrology", () => {
    expect(pickCondition({ now: { rhythmRisk: true }, skyQuiet: true })).toBe("risk");
  });
});
