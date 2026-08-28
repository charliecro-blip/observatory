import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_PREFS, mergePreferences, HELP_TIMING_OPTIONS } from "../artifacts/tides/src/lib/preferences";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";

const APP = readFileSync("artifacts/tides/src/App.tsx", "utf8");
const WEEK = readFileSync("artifacts/tides/src/components/ActivityWeek.tsx", "utf8");
const SETTINGS = readFileSync("artifacts/tides/src/pages/Settings.tsx", "utf8");

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

describe("first run does not ask it", () => {
  it("keeps onboarding to the steps it had before the question existed", () => {
    // The rehearsal doc already flagged five screens before any value against
    // a target of three; adding a sixth made a known problem worse. The
    // question is worth asking and Settings is where it goes.
    expect(APP).toContain('type OnboardStep = "name" | "meet" | "hold" | "birth" | "chronotype" | "done"');
    expect(APP).not.toContain('setStep("timing")');
    expect(APP).not.toContain("wantTimed");
  });

  it("leaves no dead scaffolding behind in App", () => {
    expect(APP).not.toContain("HELP_TIMING_OPTIONS");
    expect(APP).not.toContain("updateTiming");
  });

  it("leads with rest and play rather than work", () => {
    // Put deep work first and everyone picks deep work.
    const keys = HELP_TIMING_OPTIONS.map(o => o.key);
    expect(keys.indexOf("deep-rest")).toBeLessThan(keys.indexOf("deep-work"));
    expect(keys.indexOf("intimacy")).toBeLessThan(keys.indexOf("deep-work"));
  });

  it("offers pleasure and play, which the old shortlist barely did", () => {
    const keys = HELP_TIMING_OPTIONS.map(o => o.key);
    for (const k of ["deep-rest", "intimacy", "cook", "garden", "host", "gentle-movement"]) {
      expect(keys, k).toContain(k);
    }
  });

  it("still treats never-answered as a real state", () => {
    // helpTiming stays [] until someone opens Settings and says otherwise,
    // and the Almanac's curated shortlist covers that case.
    expect(DEFAULT_PREFS.timing.helpTiming).toEqual([]);
    expect(SETTINGS).toContain("Nothing chosen, so the Almanac shows a general shortlist.");
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

describe("the list lives in one place", () => {
  it("Settings reads the shared table, never its own copy", () => {
    // Two copies of a suggestion table is how the app came to contradict
    // itself about planets once already.
    expect(SETTINGS).toContain("HELP_TIMING_OPTIONS");
    // And must not re-declare it.
    expect(SETTINGS).not.toContain('{ key: "deep-rest", label:');
  });

  it("lets an existing account answer a question only new accounts were asked", () => {
    expect(SETTINGS).toContain("What you want help timing");
    expect(SETTINGS).toContain("updateTiming({ helpTiming:");
  });

  it("says what an empty choice means rather than leaving it to be guessed", () => {
    expect(SETTINGS).toContain("Nothing chosen, so the Almanac shows a general shortlist.");
  });

  it("every offered key is one the election engine actually knows", () => {
    // A label pointing at a key the engine does not serve would be a chip
    // that silently filters the whole week away.
    const known = new Set(ACTIVITIES.map(a => a.key));
    for (const o of HELP_TIMING_OPTIONS) {
      expect(known.has(o.key), `${o.key} (${o.label}) is not an activity the engine knows`).toBe(true);
    }
  });
});
