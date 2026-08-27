import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_PREFS, mergePreferences } from "../artifacts/tides/src/lib/preferences";

const APP = readFileSync("artifacts/tides/src/App.tsx", "utf8");
const WEEK = readFileSync("artifacts/tides/src/components/ActivityWeek.tsx", "utf8");

describe("helpTiming preference", () => {
  it("defaults to empty, which means never asked", () => {
    // Not a pre-filled list: an answer nobody gave must not be invented.
    expect(DEFAULT_PREFS.timing.helpTiming).toEqual([]);
  });

  it("is filled in for preference blobs written before it existed", () => {
    const old = mergePreferences({ timing: { watchPlanets: ["Mars"], defaultWindowType: "" } } as any);
    expect(old.timing.helpTiming).toEqual([]);
    expect(old.timing.watchPlanets).toEqual(["Mars"]);   // and does not clobber what was there
  });

  it("round-trips a choice", () => {
    const p = mergePreferences({ timing: { helpTiming: ["deep-rest", "cook"] } } as any);
    expect(p.timing.helpTiming).toEqual(["deep-rest", "cook"]);
  });
});

describe("the intake step", () => {
  it("sits in the flow between how-you-want-to-be-met and what-you-are-holding", () => {
    expect(APP).toContain('type OnboardStep = "name" | "meet" | "timing" | "hold"');
    expect(APP).toContain('setStep("timing")');
    expect(APP).toContain('setStep("hold")');
  });

  it("leads with rest and play rather than work", () => {
    // Put deep work first and everyone picks deep work.
    const block = APP.slice(APP.indexOf('if (step === "timing")'));
    const rest = block.indexOf('"deep-rest"');
    const work = block.indexOf('"deep-work"');
    expect(rest).toBeGreaterThan(-1);
    expect(work).toBeGreaterThan(-1);
    expect(rest).toBeLessThan(work);
  });

  it("offers pleasure and play, which the old shortlist barely did", () => {
    const block = APP.slice(APP.indexOf('if (step === "timing")'), APP.indexOf('if (step === "hold")'));
    for (const k of ["deep-rest", "intimacy", "cook", "garden", "host", "gentle-movement"]) {
      expect(block, k).toContain(`"${k}"`);
    }
  });

  it("only writes the preference when something was chosen", () => {
    const block = APP.slice(APP.indexOf('const save = ()'), APP.indexOf('const save = ()') + 400);
    expect(block).toContain("if (wantTimed.length)");
    expect(block).toContain("updateTiming({ helpTiming: wantTimed })");
  });

  it("lets skipping be a real answer", () => {
    expect(APP).toContain('"Skip for now');
  });
});

describe("the Almanac shortlist follows the answer", () => {
  it("uses the chosen list when there is one, the curated default otherwise", () => {
    expect(WEEK).toContain("const chosen = prefs.timing.helpTiming ?? []");
    expect(WEEK).toContain("const shortlist = chosen.length ? chosen : FEATURED");
    expect(WEEK).toContain("shortlist.includes(a.key)");
  });

  it("keeps all fifty reachable either way", () => {
    expect(WEEK).toContain("showAll ? all :");
  });
});
