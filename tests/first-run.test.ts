import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE FIRST RUN ASKS THREE THINGS.
 *
 * It used to ask ten — intro, name, how-much-astrology, working rhythm, birth
 * date, birth time, birth place, a DST question, chronotype, free windows —
 * before anyone had seen Compass do anything. The two that cost most were the
 * chart and the chronotype, because each only makes sense once you want the
 * thing it improves.
 *
 * This is a source test, which is a weak instrument, and it guards the one
 * thing that actually decays: a question creeping back into the first run
 * because adding it there is always the easiest place to put it.
 */
const APP = readFileSync(join(process.cwd(), "artifacts/tides/src/App.tsx"), "utf-8");

describe("the first run", () => {
  it("goes name → meet → hold, and nowhere else", () => {
    // The name step hands off to the rhythm question, not to a birth form.
    expect(APP).toMatch(/localStorage\.setItem\("obs_display_name", n\);\s*\n\s*setStep\("meet"\)/);
    // And the rhythm question hands off to the capture.
    expect(APP).toMatch(/setStep\("hold"\)/);
  });

  it("never walks into the chart or the chronotype", () => {
    // Both remain as steps — they are the contextual asks — but nothing in the
    // first-run path may advance INTO them.
    expect(APP, "something advances into the birth step").not.toMatch(/setStep\("birth"\)/);
    expect(APP, "something advances into the chronotype step").not.toMatch(/setStep\("chronotype"\)/);
  });

  it("keeps both contextual asks reachable", () => {
    // Removing a question from the first run is only an improvement if the
    // question can still be answered when it starts to matter.
    expect(APP, "the chart can no longer be added").toMatch(/startAt="birth"/);
    expect(APP, "waking hours can no longer be given").toMatch(/startAt="chronotype"/);
  });

  it("records the deferral, so a removed question does not re-arm next load", () => {
    // The shell re-prompts for a chart whenever there is no natal row AND no
    // record of declining. Without this the chart question simply moves from
    // the end of onboarding to the first load after it.
    expect(APP).toMatch(/finishFirstRun[\s\S]{0,600}obs_birth_skipped/);
    expect(APP).toMatch(/obs_chronotype_asked/);
  });

  it("reads dates out of the three lines, as the screen promises", () => {
    // The capture screen says "the date is read from your words". The first
    // version POSTed raw titles, which shipped "…grant application Friday" as
    // a title on the one screen whose job is to make the next screen feel
    // like it knows you.
    expect(APP).toMatch(/for \(const raw of holding[\s\S]{0,400}parseWhen\(raw/);
  });

  it("has retired the legacy chart copy", () => {
    expect(APP, 'the "great" times copy is back').not.toMatch(/“great”|"great" times/);
  });
});
