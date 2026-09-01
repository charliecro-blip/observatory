// Emit a standalone HTML page with the ten comparison pairs — artwork,
// palette strip, and label — for sharing outside the playground.
//
//   EB=$(ls -d node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild | sort -V | tail -1)
//   "$EB" tools/chromatic/test/render-gallery.ts --bundle --platform=node --format=esm --outfile=/tmp/gallery.mjs
//   node /tmp/gallery.mjs > gallery.html

import type { AspectName, PairScenario, Planet, Sign } from "../engine/types";
import { DEFAULT_WEIGHTS } from "../engine/config/weights";
import { buildPairModel } from "../engine/pair";
import { renderArtwork } from "../engine/render";

function pair(ap: Planet, as_: Sign, bp: Planet, bs: Sign, aspect: AspectName, orb: number): PairScenario {
  return {
    a: { planet: ap, sign: as_, weight: DEFAULT_WEIGHTS.base[ap] },
    b: { planet: bp, sign: bs, weight: DEFAULT_WEIGHTS.base[bp] },
    aspect, orb, variationSeed: 0,
  };
}

const TEN: Array<[string, PairScenario]> = [
  ["Venus conjunct Jupiter", pair("Venus", "Pisces", "Jupiter", "Pisces", "conjunction", 1.2)],
  ["Venus square Saturn", pair("Venus", "Libra", "Saturn", "Capricorn", "square", 2.0)],
  ["Venus opposite Uranus", pair("Venus", "Taurus", "Uranus", "Scorpio", "opposition", 1.5)],
  ["Mars conjunct Saturn", pair("Mars", "Capricorn", "Saturn", "Capricorn", "conjunction", 0.8)],
  ["Mars trine Neptune", pair("Mars", "Scorpio", "Neptune", "Pisces", "trine", 2.0)],
  ["Moon opposite Pluto", pair("Moon", "Cancer", "Pluto", "Capricorn", "opposition", 1.0)],
  ["Sun trine Jupiter", pair("Sun", "Leo", "Jupiter", "Sagittarius", "trine", 3.0)],
  ["Mercury conjunct Uranus", pair("Mercury", "Aquarius", "Uranus", "Aquarius", "conjunction", 1.0)],
  ["Saturn conjunct Neptune", pair("Saturn", "Pisces", "Neptune", "Pisces", "conjunction", 1.5)],
  ["Jupiter square Pluto", pair("Jupiter", "Aries", "Pluto", "Capricorn", "square", 2.0)],
];

const cards = TEN.map(([title, s]) => {
  const m = buildPairModel(s);
  const strip = m.palette.map((c) => `<i style="background:${c.hex}" title="${c.role} ${c.hex}"></i>`).join("");
  const keywords = m.explanation.visualKeywords.join(" · ");
  return `<div class="card">${renderArtwork(m, 1000, 800)}<div class="t">${title}</div><div class="strip">${strip}</div><div class="k">${keywords}</div></div>`;
}).join("\n");

process.stdout.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chromatic — the ten test pairs</title>
<style>
  body { background:#101013; color:#e6e4de; font:14px/1.5 ui-sans-serif,system-ui,sans-serif; margin:0; padding:28px; }
  h1 { font-size:16px; letter-spacing:0.02em; } p { color:#8f8d86; max-width:640px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:18px; margin-top:20px; }
  .card { background:#17171c; border:1px solid #2a2a33; border-radius:10px; overflow:hidden; }
  .card svg { display:block; width:100%; height:auto; }
  .t { padding:8px 12px 0; font-weight:600; font-size:13px; }
  .strip { display:flex; height:20px; margin:8px 12px 4px; border-radius:5px; overflow:hidden; } .strip i { flex:1; }
  .k { padding:0 12px 12px; color:#8f8d86; font-size:11px; }
</style></head><body>
<h1>Chromatic — the ten test pairs</h1>
<p>One aspect pair per card, rendered deterministically by the engine. The test: without reading the labels, the compositions should feel meaningfully different — restrained, expansive, electric, dreamy, tense, heavy, radiant.</p>
<div class="grid">
${cards}
</div>
</body></html>
`);
