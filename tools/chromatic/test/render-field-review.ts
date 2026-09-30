// Chromatic Field prototype review: renders every canonical pair and three
// contrasting whole charts at all three treatments (Pure / Material /
// Editorial), and writes one self-contained HTML review page plus a few
// full-size 1080x1350 exports. Not a test — a design-review artifact
// generator, run once per prototype pass.
//
//   EB=$(ls -d node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild | sort -V | tail -1)
//   "$EB" tools/chromatic/test/render-field-review.ts --bundle --platform=node --format=esm --outfile=/tmp/field-review.mjs
//   node /tmp/field-review.mjs <out-dir>

import { computeChart } from "../playground/natal-adapter";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PairScenario, Planet, Sign } from "../engine/types";
import { CANONICAL_PAIRS } from "../engine/canon";
import { buildPairModel } from "../engine/pair";
import { buildChartModel, type NatalInput } from "../engine/chart";
import { buildFieldFromChart, buildFieldFromPair, renderChromaticField, type ChromaticField, type FieldMeta, type Treatment } from "../engine/field";
import { ASPECT_GLYPHS, PLANET_GLYPHS } from "../engine/social";

const OUT = process.argv[2];
if (!OUT) { console.error("usage: node render-field-review.mjs <out-dir>"); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const TREATMENTS: Treatment[] = ["pure", "material", "editorial"];
const THUMB = { w: 1080, h: 1350 };
const FULL = { w: 1080, h: 1350 };

function formatOrb(orb: number): string {
  const deg = Math.floor(orb);
  const min = Math.round((orb - deg) * 60);
  return `${deg}°${min.toString().padStart(2, "0")}′`;
}

// ── Pairs ────────────────────────────────────────────────────────────────────

interface Scenario {
  slug: string;
  triplet: [string, string, string]; // pure/material/editorial SVGs
  full?: string;
}

const scenarios: Scenario[] = [];
const fullExamples: Array<{ slug: string; svg: string }> = [];

function pairField(scenario: PairScenario, seedKey: string): ChromaticField {
  const model = buildPairModel(scenario);
  return buildFieldFromPair({
    model, aspect: scenario.aspect, strength: model.aspectStrength,
    planets: [scenario.a.planet, scenario.b.planet],
    signs: [scenario.a.sign, scenario.b.sign],
    seedKey,
  });
}

function pairMeta(scenario: PairScenario): FieldMeta {
  return {
    subtitle: "CHROMATIC READING",
    title: `${scenario.a.planet} ${scenario.aspect} ${scenario.b.planet}`,
    factors: `${scenario.a.planet.toUpperCase()} · ${scenario.b.planet.toUpperCase()}`,
    notation: `${PLANET_GLYPHS[scenario.a.planet]} ${ASPECT_GLYPHS[scenario.aspect]} ${PLANET_GLYPHS[scenario.b.planet]}  ·  ${formatOrb(scenario.orb)}`,
  };
}

const FULL_SIZE_PAIRS = new Set(["Mars conjunct Saturn", "Venus opposite Uranus", "Saturn conjunct Neptune"]);

for (const canon of CANONICAL_PAIRS) {
  const field = pairField(canon.scenario, canon.slug);
  const meta = pairMeta(canon.scenario);
  const triplet = TREATMENTS.map((t) => renderChromaticField(field, t, meta, THUMB.w, THUMB.h)) as [string, string, string];
  const entry: Scenario = { slug: canon.title, triplet };
  writeFileSync(join(OUT, `${canon.slug}.json`), JSON.stringify(field,null,2));
  TREATMENTS.forEach((t,i)=>writeFileSync(join(OUT, `${canon.slug}-${t}.svg`),triplet[i]));
  if (FULL_SIZE_PAIRS.has(canon.title)) {
    const full = renderChromaticField(field, "editorial", meta, FULL.w, FULL.h);
    entry.full = full;
    fullExamples.push({ slug: canon.title, svg: full });
  }
  scenarios.push(entry);
}

// ── Whole charts — three genuinely different fixtures ───────────────────────

const CHARTS = [
  { label: "Natal A · New York", date: "04 MAY 1990", natal: computeChart({date:"1990-05-04",time:"10:30",lat:40.71,lon:-74.01,utcOffset:-4}) },
  { label: "Natal B · Mumbai", date: "07 FEB 1969", natal: computeChart({date:"1969-02-07",time:"18:45",lat:19.08,lon:72.88,utcOffset:5.5}) },
  { label: "Natal C · London", date: "21 DEC 2001", natal: computeChart({date:"2001-12-21",time:"04:15",lat:51.507,lon:-0.128,utcOffset:0}) },
];

for (const { label, natal, date } of CHARTS) {
  const chart = buildChartModel(natal);
  const field = buildFieldFromChart(chart, label);
  const top3 = chart.placements.slice(0, 3).map((p) => p.planet.toUpperCase()).join(" · ");
  const notation = chart.defining
    ? `${PLANET_GLYPHS[chart.defining.a as Planet]} ${ASPECT_GLYPHS[chart.defining.aspect]} ${PLANET_GLYPHS[chart.defining.b as Planet]}  ·  ${formatOrb(chart.defining.orb)}`
    : "no defining aspect";
  const meta: FieldMeta = { subtitle: "CHROMATIC SIGNATURE", title: label.split(" — ")[0], factors: top3, date, notation };
  const triplet = TREATMENTS.map((t) => renderChromaticField(field, t, meta, THUMB.w, THUMB.h)) as [string, string, string];
  const full = renderChromaticField(field, "editorial", meta, FULL.w, FULL.h);
  const slug=label.toLowerCase().replace(/[^a-z0-9]+/g,"-");
  writeFileSync(join(OUT, `${slug}.json`), JSON.stringify(field,null,2));
  TREATMENTS.forEach((t,i)=>writeFileSync(join(OUT, `${slug}-${t}.svg`),triplet[i]));
  scenarios.push({ slug: label, triplet, full });
  fullExamples.push({ slug: label, svg: full });
}

// ── Assemble the review page ─────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const embed=(svg:string)=>`<img width="1080" height="1350" style="display:block;width:100%;height:auto" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" alt="Chromatic field"/>`;
const rows = scenarios.map((s) => `
  <div class="row">
    <div class="row-label">${esc(s.slug)}</div>
    <div class="triplet">
      <div class="cell"><div class="cell-tag">PURE</div>${embed(s.triplet[0])}</div>
      <div class="cell"><div class="cell-tag">MATERIAL</div>${embed(s.triplet[1])}</div>
      <div class="cell"><div class="cell-tag">EDITORIAL</div>${embed(s.triplet[2])}</div>
    </div>
  </div>`).join("\n");

const fullSection = fullExamples.map((f) => `
  <div class="full-item">
    <div class="full-label">${esc(f.slug)}</div>
    <div class="full-frame">${embed(f.svg)}</div>
  </div>`).join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chromatic Field — review sheet</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,500&display=swap">
<style>
  :root { --bg:#121113; --surface:#1a191c; --ink:#eeece7; --dim:#9b988f; --line:#2b2a2d; --accent:#c9b458; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:"Instrument Sans", ui-sans-serif, sans-serif; }
  .wrap { max-width: 1400px; margin: 0 auto; padding: 56px 28px 120px; }
  .eyebrow { font-family:"IBM Plex Mono", monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--dim); }
  h1 { font-family:"Fraunces", Georgia, serif; font-weight:500; font-size:38px; margin:8px 0 14px; }
  .lede { max-width: 76ch; color: var(--dim); font-size: 15px; line-height: 1.6; margin-bottom: 16px; }
  .lede b { color: var(--ink); }
  .notes { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 24px 28px; margin: 28px 0 48px; }
  .notes h2 { font-family:"Fraunces", Georgia, serif; font-weight:500; font-size: 18px; margin: 0 0 10px; }
  .notes h2:not(:first-child) { margin-top: 22px; }
  .notes p, .notes li { color: var(--dim); font-size: 13.5px; line-height: 1.65; }
  .notes code { font-family:"IBM Plex Mono", monospace; color: var(--ink); font-size: 12.5px; }
  .notes ul { margin: 6px 0; padding-left: 20px; }
  .row { margin-bottom: 26px; }
  .row-label { font-family:"IBM Plex Mono", monospace; font-size: 12px; letter-spacing: 0.03em; color: var(--dim); margin-bottom: 8px; }
  .triplet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .cell { background: var(--surface); border: 1px solid var(--line); border-radius: 0; overflow: hidden; position: relative; }
  .cell svg { display: block; width: 100%; height: auto; }
  .cell-tag { position: static; font-family:"IBM Plex Mono", monospace; font-size: 9.5px; letter-spacing: 0.08em; color: #fff; background: rgba(0,0,0,0.45); padding: 2px 7px; border-radius: 999px; z-index: 2; }
  .section-title { font-family:"Fraunces", Georgia, serif; font-weight:500; font-size: 22px; margin: 56px 0 22px; }
  .full-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 22px; }
  .full-label { font-family:"IBM Plex Mono", monospace; font-size: 12px; color: var(--dim); margin-bottom: 8px; }
  .full-frame { border-radius: 0; overflow: hidden; border: 1px solid var(--line); }
  .full-frame svg { display: block; width: 100%; height: auto; }
</style></head>
<body><div class="wrap">
  <div class="eyebrow">Chromatic Field · prototype review</div>
  <h1>Chromatic Field studies</h1><p><a href="style-studio.html" style="color:inherit">Open the interactive style studio</a></p>
  <p class="lede">Ten canonical aspect pairs plus three computed sample natal charts, each rendered <b>Pure</b> (geometry and color only, no surface), <b>Material</b> (the same geometry with a restrained pigment surface), and <b>Editorial</b> (Material plus one typographic lockup). Judge these as objects at thumbnail scale first — full-size exports follow below.</p>

  <p class="lede">Area uses normalized placement emphasis distributed across the generated palette by inverse squared OKLab distance from each placement’s solo pigment. This is a new, explicit allocation rule; the older weight-bar percentages were design choices. Downloaded JSON files record each contribution. Macro-regions preserve their allocated area; surface overlays and typography change displayed pixels, not the partition.</p>
  <p class="lede">Aspect selects nested, opposing, orthogonal, flowing, answering, or displaced boundaries. Dynamism controls orientation, variation controls flowing boundaries, materiality controls fine grain, and opacity with diffusion controls a faint same-palette wash. Edge feathering and independent tonal depth are deferred. The three natal samples use computed birth charts for the dates and locations shown.</p>

  <div class="section-title">Review grid — Pure / Material / Editorial</div>
  ${rows}

  <div class="section-title">Full-size examples (1080×1350)</div>
  <div class="full-grid">
    ${fullSection}
  </div>
</div></body></html>`;

writeFileSync(join(OUT, "field-review.html"), html);
for (const f of fullExamples) {
  writeFileSync(join(OUT, `field-${f.slug.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.svg`), f.svg);
}
console.log(`wrote review page + ${fullExamples.length} full-size SVGs to ${OUT}`);
