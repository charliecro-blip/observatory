// Aspect-band invariant (2026-09-01 audit): the detectors break on the first
// matching band, which is only sound while no two bands overlap. This proves
// it from the live config, so an orb edit that makes ordering matter fails
// loudly instead of silently changing which aspect wins.

import { describe, expect, it } from "vitest";
import { ASPECTS } from "../engine/types";
import { ASPECT_PROFILES, TRANSIT_MAX_ORBS } from "../engine/config/aspects";

function assertDisjoint(orbs: Record<string, number>, label: string): void {
  const bands = ASPECTS.map((name) => ({
    name,
    lo: ASPECT_PROFILES[name].angle - orbs[name],
    hi: ASPECT_PROFILES[name].angle + orbs[name],
  }));
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      const a = bands[i];
      const b = bands[j];
      const overlap = a.lo <= b.hi && b.lo <= a.hi;
      expect(overlap, `${label}: ${a.name} [${a.lo},${a.hi}] overlaps ${b.name} [${b.lo},${b.hi}]`).toBe(false);
    }
  }
  // Separations fold to 0..180, so the only bands allowed to spill past the
  // domain edges are the two anchored on them.
  for (const band of bands) {
    expect(band.hi - band.lo, `${label}: ${band.name} has no width`).toBeGreaterThan(0);
    if (band.name !== "conjunction") expect(band.lo, `${label}: ${band.name} underflows 0°`).toBeGreaterThanOrEqual(0);
    if (band.name !== "opposition") expect(band.hi, `${label}: ${band.name} overflows 180°`).toBeLessThanOrEqual(180);
  }
}

describe("aspect bands never overlap", () => {
  it("natal orbs", () => {
    const orbs = Object.fromEntries(ASPECTS.map((a) => [a, ASPECT_PROFILES[a].maxOrb]));
    assertDisjoint(orbs, "natal");
  });

  it("transit orbs", () => {
    assertDisjoint(TRANSIT_MAX_ORBS, "transit");
  });
});
