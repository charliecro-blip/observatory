// Regenerate the golden baselines for the canonical ten. Run via the runner:
//
//   ./tools/chromatic/golden/update
//
// Accepting a visual change is a deliberate act: run this, review the diff on
// /golden.html (approved baseline beside current render) and in git, then
// commit the new baselines. golden.test.ts fails until you do — that is the
// point.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CANONICAL_PAIRS } from "../engine/canon";
import { buildPairModel } from "../engine/pair";
import { renderArtwork } from "../engine/render";

// The runner passes the destination — import.meta.url is useless here because
// esbuild bundles this file into a temp path before node runs it.
const OUT = process.argv[2];
if (!OUT) {
  console.error("usage: node update-golden.mjs <path-to-baselines.json>");
  process.exit(1);
}

const cases = CANONICAL_PAIRS.map((c) => {
  const model = buildPairModel(c.scenario);
  return {
    slug: c.slug,
    title: c.title,
    scenario: c.scenario,
    profile: model.profile,
    palette: model.palette,
    composition: model.composition,
    svg: renderArtwork(model),
  };
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ cases }, null, 2) + "\n");
console.log(`wrote ${cases.length} baselines to ${OUT}`);
