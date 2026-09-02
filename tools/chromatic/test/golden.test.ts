// Golden gallery (2026-09-01 audit): the canonical ten are pinned as full
// baselines — profile, palette, composition, SVG — so an engine or config
// change that alters the artwork fails HERE, visibly, instead of drifting
// past tests that only check structure. This is aesthetic calibration
// infrastructure, not a deploy gate (the whole tools suite is opt-in).
//
// When a change is intentional: review it on /golden.html (approved baseline
// beside current render), run ./tools/chromatic/golden/update, check the git
// diff, commit.

import { describe, expect, it } from "vitest";
import baselines from "../golden/baselines.json";
import { CANONICAL_PAIRS } from "../engine/canon";
import { buildPairModel } from "../engine/pair";
import { renderArtwork } from "../engine/render";

const HINT = "intentional change? review /golden.html, then ./tools/chromatic/golden/update";

describe("golden gallery", () => {
  it("covers exactly the canonical ten", () => {
    expect(baselines.cases.map((c) => c.slug)).toEqual(CANONICAL_PAIRS.map((c) => c.slug));
  });

  for (const canon of CANONICAL_PAIRS) {
    it(`${canon.title} matches its approved baseline`, () => {
      const baseline = baselines.cases.find((c) => c.slug === canon.slug)!;
      const model = buildPairModel(canon.scenario);
      expect(model.profile, `profile drifted — ${HINT}`).toEqual(baseline.profile);
      expect(
        model.palette.map((c) => `${c.role}:${c.hex}`),
        `palette drifted — ${HINT}`,
      ).toEqual(baseline.palette.map((c) => `${c.role}:${c.hex}`));
      expect(model.composition, `composition drifted — ${HINT}`).toEqual(baseline.composition);
      expect(renderArtwork(model) === baseline.svg, `artwork drifted — ${HINT}`).toBe(true);
    });
  }
});
