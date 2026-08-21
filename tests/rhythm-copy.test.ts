import { describe, it, expect } from "vitest";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal.js";
import { proposeRhythm, currentGear } from "../artifacts/api-server/src/lib/rhythmProposal.js";

/**
 * The gear invitation and the chart proposal speak to the person, in the
 * person's words. Two things leaked on 2026-08-21 and the owner saw both:
 * the internal preset name ("Route") where the interface says "Protect my
 * routines", and the app naming itself in the third person ("Compass pairs
 * that with…"). Anchored to a fixed chart and instant.
 */
const natal = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.4951, -6, "whole-sign");
const AT = new Date("2026-08-21T18:30:00Z");

describe("rhythm copy", () => {
  it("never names a preset by its internal word, and never names the app", () => {
    const gear = currentGear(natal, AT);
    const lines = [...(gear?.detail ?? []), gear?.reading ?? "", gear?.literal ?? ""];
    const proposal = proposeRhythm(natal);
    for (const f of proposal?.functions ?? []) lines.push(f.reading, f.literal);
    expect(lines.length).toBeGreaterThan(3);
    for (const l of lines) {
      expect(l, l).not.toMatch(/\bCompass\b/);
      expect(l, l).not.toMatch(/\b(Route|Campaign|Field|Tide)\b/);
    }
  });
});
