import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tideGuidance } from "../artifacts/tides/src/lib/elements";

/**
 * The hero card speaks with ONE voice.
 *
 * Found in a live first-run pass 2026-08-02: a high-tide void day rendered
 * "Energy is at its peak — this is the window to fully engage. Lean into what
 * this tide favors — act, publish, lead." directly above a red pill reading
 * "The day's initiations won't take — finish, rest, review; begin nothing you
 * want to last." Two engines, each correct alone, arguing inside one card.
 *
 * The rule these tests hold: when the Moon is void, the guidance itself must
 * account for it, and the card must not then say it twice more.
 */
describe("the hero's guidance reconciles the void", () => {
  it("does not tell you to launch into a void at high tide", () => {
    const g = tideGuidance("surge", "high", true);
    // The old copy's exact instruction — the thing the void contradicts.
    expect(g).not.toMatch(/window to fully engage/i);
    expect(g).toMatch(/void/i);
  });

  it("still names the energy rather than pretending the day is flat", () => {
    // The failure mode in the other direction: suppressing the charge entirely
    // would misreport a genuinely high-energy day as a quiet one.
    const g = tideGuidance("surge", "high", true);
    // Matched loosely on purpose. Pinned to the exact phrase "energy is high",
    // this failed the moment the voice pass contracted it to "energy's high" —
    // which names the charge every bit as plainly. The invariant is that the
    // charge is NAMED, not that it is named in one particular set of words.
    expect(g).toMatch(/energy(?:'s| is)\s+high/i);
    expect(g).toMatch(/already moving|underway/i);
  });

  it("leaves the non-void reading untouched", () => {
    const g = tideGuidance("surge", "high", false);
    expect(g).toMatch(/window to fully engage/i);
    expect(g).not.toMatch(/void/i);
  });

  it("treats a void at low tide as agreement, not contradiction", () => {
    // Low tide and a void point the same way; the void adds a reason, and
    // must NOT trigger the "but…" framing that high tide needs.
    const g = tideGuidance("deep", "low", true);
    expect(g).toMatch(/points the same way/i);
    expect(g).not.toMatch(/but the Moon is void/i);
  });

  it("covers every character at high tide without dropping the void", () => {
    for (const c of ["deep", "surge", "building", "clear"] as const) {
      expect(tideGuidance(c, "high", true), c).toMatch(/void/i);
      expect(tideGuidance(c, "rising", true), c).toMatch(/void/i);
    }
  });
});

describe("the hero says the void once, not three times", () => {
  const woven = readFileSync(
    join(process.cwd(), "artifacts/tides/src/components/WovenReading.tsx"), "utf-8");
  const today = readFileSync(
    join(process.cwd(), "artifacts/tides/src/pages/Today.tsx"), "utf-8");

  it("WovenReading can be told what the card already said", () => {
    expect(woven).toMatch(/saidAlready/);
    // The void reaches this card through THREE channels. Suppressing any two
    // still leaves the reader told the same thing twice, which is how the
    // original bug survived its first fix.
    expect(woven, "pattern chips not deduped").toMatch(/patterns\s*=\s*\(reading\.patterns[^\n]*filter/);
    expect(woven, "counterpoint not deduped").toMatch(/counterpoint && !said\.has/);
    expect(woven, "watch line not deduped").toMatch(/topWatch\s*=\s*\(reading\.watch[^\n]*find/);
  });

  it("the server tags every watch line with its source", () => {
    // Without this the client can only dedupe the watch list by matching
    // prose, which breaks the moment the copy is reworded.
    const synth = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/synthesis.ts"), "utf-8");
    expect(synth).toMatch(/salience: t\.salience, source: t\.source/);
    expect(synth).toMatch(/salience: p\.salience, source: p\.name/);
  });

  it("Today passes both the testimony source and the pattern name", () => {
    // They differ ("voc" vs "Void of course"); passing one silently leaves the
    // other rendering, which is the bug this whole rule exists to stop.
    expect(today).toMatch(/saidAlready=\{[^}]*voc[^}]*Void of course/s);
  });

  it("the server names the counterpoint's source so dedupe isn't prose-matching", () => {
    const synth = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/synthesis.ts"), "utf-8");
    expect(synth).toMatch(/counterpointSource/);
  });
});
