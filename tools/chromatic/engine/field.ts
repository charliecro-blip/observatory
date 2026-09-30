// Chromatic Field — the share-image renderer (2026-09-01 direction change).
//
// The prior renderer (render.ts) draped every result in the same blur/grain
// atmosphere, so results read as "pretty abstract palette" and nothing more.
// This one inverts the priority: structure first, surface second. The
// boundary grammar — how two colored territories meet — comes from the
// aspect itself, not from one of seven interchangeable abstract-art
// templates; area comes from real per-color weight, not fixed shape sizes;
// texture is optional and astrology-derived, applied only at the "material"
// treatment and above.
//
// Placement mass is conserved by an explicit color-affinity allocation.
// See FIELD-NOTES.md for its limits and the deferred surface parameters.

import type {
  AspectName, ChromaticModel, Oklch, PaletteColor, PaletteRole, Planet, Sign, VisualProfile,
} from "./types";
import { buildPlacementModel } from "./placement";
import type { ChromaticChart } from "./chart";
import { SIGN_ELEMENT } from "./config/signs";

// ── Field model ──────────────────────────────────────────────────────────────

export interface ChromaticFieldToken {
  role: PaletteRole;
  color: Oklch;
  hex: string;
  weight: number; // normalized 0..1, sums to 1 across all tokens
  sources: string[];
  contributions: { source: string; mass: number }[];
}

export interface FieldRelationship {
  aspect: AspectName | null; // null when no aspect organizes the field (rare)
  strength: number;          // 0..1
  geometry: string;          // the grammar function that ran
}

export interface FieldSurface {
  edgeSoftness: number;  // 0..1 — 0 = crisp, 1 = fully feathered
  grain: number;         // 0..1 — materiality-driven pigment texture
  transparency: number;  // 0..1 — layers show through each other
  depth: number;          // 0..1 — vignette / tonal recession
  tilt: number;           // degrees — dynamism-driven composition angle
  complexity: number;     // 0..1 — variation-driven secondary-mark count
}

export interface ChromaticField {
  tokens: ChromaticFieldToken[];
  relationship: FieldRelationship;
  surface: FieldSurface;
  flavor: { saturnBound: boolean; uranusInterrupt: boolean; plutoDeep: boolean; element: "fire" | "earth" | "air" | "water" | null };
  seed: number;
}

export type Treatment = "pure" | "material" | "editorial";

export interface FieldMeta {
  title?: string;      // "CHARLIE CROSS"
  subtitle?: string;   // "CHROMATIC SIGNATURE"
  factors?: string;    // "SATURN · VENUS · MARS"
  date?: string;       // "03 JAN 1992"
  notation?: string;   // "♀ ☍ ♅ · 1°12′"
}

// ── Area allocation ──────────────────────────────────────────────────────────
//
// Area allocation v1: each placement distributes its emphasis across the
// generated palette using inverse squared OKLab distance from its solo pigment.
// This is an explicit renderer mapping, not a pre-existing palette percentage.
// Every placement conserves its mass; no role receives a preset percentage.
function buildTokens(palette: PaletteColor[], placements: { planet: Planet; sign: Sign; weight: number }[]): ChromaticFieldToken[] {
  const lab = (c: Oklch) => [c.l, c.c * Math.cos(c.h * Math.PI / 180), c.c * Math.sin(c.h * Math.PI / 180)];
  const ledger = palette.map(() => [] as { source: string; mass: number }[]);
  for (const p of placements) {
    if (!Number.isFinite(p.weight) || p.weight < 0) throw new Error("Placement weight must be finite and nonnegative");
    const pigment = buildPlacementModel(p).palette.find(c => c.role === "dominant")!;
    const native = lab(pigment.oklch);
    const affinities = palette.map(c => 1 / (0.01 + lab(c.oklch).reduce((sum, v, i) => sum + (v - native[i]) ** 2, 0)));
    const sum = affinities.reduce((a, b) => a + b, 0);
    affinities.forEach((v, i) => ledger[i].push({ source: `${p.planet} in ${p.sign}`, mass: p.weight * v / sum }));
  }
  const total = placements.reduce((sum, p) => sum + p.weight, 0);
  if (!(total > 0)) throw new Error("A field requires positive placement weight");
  return palette.map((c, i) => ({ role: c.role, color: c.oklch, hex: c.hex,
    weight: ledger[i].reduce((sum, r) => sum + r.mass, 0) / total,
    sources: c.sources, contributions: ledger[i],
  })).sort((a, b) => b.weight - a.weight);
}

// ── Surface derivation ───────────────────────────────────────────────────────

function buildSurface(profile: VisualProfile): FieldSurface {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  return {
    edgeSoftness: clamp01(profile.diffusion * 0.7 - profile.structure * 0.5 + 0.35),
    grain: profile.materiality,
    transparency: clamp01(1 - profile.opacity),
    depth: profile.depth,
    tilt: (profile.dynamism - 0.5) * 14,
    complexity: profile.variation,
  };
}

function buildFlavor(
  planets: Planet[], signs: Sign[],
): ChromaticField["flavor"] {
  const elementCounts: Record<string, number> = {};
  for (const s of signs) elementCounts[SIGN_ELEMENT[s]] = (elementCounts[SIGN_ELEMENT[s]] ?? 0) + 1;
  const topElement = Object.entries(elementCounts).sort((a, b) => b[1] - a[1])[0];
  return {
    saturnBound: planets.includes("Saturn"),
    uranusInterrupt: planets.includes("Uranus"),
    plutoDeep: planets.includes("Pluto"),
    element: (topElement?.[1] ?? 0) > 0 ? (topElement[0] as "fire" | "earth" | "air" | "water") : null,
  };
}

// ── Public builders ──────────────────────────────────────────────────────────

export interface PairFieldInput {
  model: ChromaticModel;
  aspect: AspectName;
  strength: number;
  planets: [Planet, Planet];
  signs: [Sign, Sign];
  seedKey: string;
}

export function buildFieldFromPair(input: PairFieldInput): ChromaticField {
  const tokens = buildTokens(input.model.palette, input.planets.map((planet, i) => ({ planet, sign: input.signs[i],
    weight: input.model.influences.find(v => v.source === `${planet} in ${input.signs[i]}`)?.weight ?? 0,
  })));
  return {
    tokens,
    relationship: { aspect: input.aspect, strength: input.strength, geometry: input.model.composition.dominantGeometry },
    surface: buildSurface(input.model.profile),
    flavor: buildFlavor(input.planets, input.signs),
    seed: input.model.seed,
  };
}

export function buildFieldFromChart(chart: ChromaticChart, seedKey: string): ChromaticField {
  const tokens = buildTokens(chart.model.palette, chart.placements.map(p => ({ planet: p.planet, sign: p.sign, weight: p.effective })));
  const topPlanets = chart.placements.slice(0, 4).map((p) => p.planet);
  const topSigns = chart.placements.slice(0, 4).map((p) => p.sign);
  return {
    tokens,
    relationship: {
      aspect: chart.defining?.aspect ?? null,
      strength: chart.model.aspectStrength,
      geometry: chart.model.composition.dominantGeometry,
    },
    surface: buildSurface(chart.model.profile),
    flavor: buildFlavor(topPlanets, topSigns),
    seed: chart.model.seed,
  };
}

// SVG paths use a fixed design canvas at every export size.
const A = (attrs: Record<string, string | number>) => Object.entries(attrs).map(([k,v])=>` ${k}="${v}"`).join("");
const el = (tag: string, attrs: Record<string, string | number>, children = "") => children ? `<${tag}${A(attrs)}>${children}</${tag}>` : `<${tag}${A(attrs)}/>`;
interface Ctx { uid: string; W: number; H: number; defs: string[]; treatment: Treatment; field: ChromaticField }
let defCounter=0;

// Exact-area partition in normalized coordinates. All territories are
// disjoint; their union is the canvas. Treatments reuse these same paths.
export interface FieldRegion { token: ChromaticFieldToken; points: [number, number][] }
export function fieldRegions(field: ChromaticField): FieldRegion[] {
  const out: FieldRegion[] = [];
  const rect = (t: ChromaticFieldToken, x: number, y: number, w: number, h: number) => {
    if (w > 1e-12 && h > 1e-12) out.push({ token: t, points: [[x,y],[x+w,y],[x+w,y+h],[x,y+h]] });
  };
  const tokens = field.tokens;
  const geometry = field.relationship.geometry;
  if (geometry === "central") {
    // Shared center: nested territories, represented by disjoint frames.
    let x=0, y=0, w=1, h=1, remaining=1;
    for (const t of [...tokens].reverse()) {
      const inner = Math.sqrt(Math.max(0, (remaining-t.weight)/remaining));
      const nw=w*inner, nh=h*inner, dx=(w-nw)/2, dy=(h-nh)/2;
      rect(t,x,y,w,dy); rect(t,x,y+h-dy,w,dy);
      rect(t,x,y+dy,dx,nh); rect(t,x+w-dx,y+dy,dx,nh);
      x+=dx; y+=dy; w=nw; h=nh; remaining-=t.weight;
    }
  } else if (geometry === "crossing" || geometry === "patterned" || geometry === "asymmetric") {
    // Orthogonal cuts, alternating answers, or deliberately displaced cuts.
    let x=0,y=0,w=1,h=1;
    tokens.forEach((t,i) => {
      if (i===tokens.length-1) { rect(t,x,y,w,h); return; }
      const vertical = geometry === "crossing" ? i%2===0 : i%3===1;
      const reverse = geometry === "asymmetric" ? i%2===0 : i%3===2;
      if (vertical) {
        const cut=t.weight/h;
        rect(t, reverse?x+w-cut:x,y,cut,h);
        if (!reverse) x+=cut;
        w-=cut;
      } else {
        const cut=t.weight/w;
        rect(t,x,reverse?y+h-cut:y,w,cut);
        if (!reverse) y+=cut;
        h-=cut;
      }
    });
  } else {
    // Parallel boundaries can bend without changing area: the sampled wave
    // has zero mean, and every boundary uses the same displacement.
    const minWeight=Math.min(...tokens.map(t=>t.weight));
    const amplitude=geometry === "triadic" ? minWeight*0.7*field.surface.complexity : 0;
    const horizontal=field.surface.tilt<0;
    let start=0;
    const line=(level:number):[number,number][] => Array.from({length:65},(_,i)=> {
      const u=i/64;
      const bend=level===0 || Math.abs(level-1)<1e-10 ? 0 : amplitude*Math.sin(2*Math.PI*u);
      return horizontal ? [u,level+bend] : [level+bend,u];
    });
    for (const t of tokens) { const end=start+t.weight; out.push({token:t,points:[...line(start),...line(end).reverse()]}); start=end; }
  }
  return out;
}
export function regionArea(region: FieldRegion): number {
  return Math.abs(region.points.reduce((a,p,i) => { const q=region.points[(i+1)%region.points.length]; return a+p[0]*q[1]-q[0]*p[1]; },0))/2;
}
function territories(ctx: Ctx): string {
  return fieldRegions(ctx.field).map(r => {
    const d=r.points.map((p,i)=>`${i?'L':'M'}${(p[0]*ctx.W).toFixed(5)},${(p[1]*ctx.H).toFixed(5)}`).join(' ')+' Z';
    return `<path data-role="${r.token.role}" d="${d}" fill="${r.token.hex}"/>`;
  }).join('');
}

// ── Surface layer (material treatment and above) ────────────────────────────

function grainLayer(ctx: Ctx): string {
  const { W, H, field } = ctx;
  if (ctx.treatment === "pure" || field.surface.grain < 0.1) return "";
  const id = `${ctx.uid}-grain${defCounter++}`;
  const freq = field.flavor.element === "earth" ? 0.9 : field.flavor.element === "air" ? 1.6 : 1.15;
  ctx.defs.push(
    `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${Math.abs(field.seed) % 999}" stitchTiles="stitch" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0 0 0 0"/></filter>`,
  );
  const opacity = Math.max(0, field.surface.grain - 0.5) * 0.08;
  return el("rect", { x: 0, y: 0, width: W, height: H, filter: `url(#${id})`, opacity: opacity.toFixed(2), style: "mix-blend-mode:overlay" });
}

// ── Typography (editorial treatment only) ────────────────────────────────────

function typography(ctx: Ctx, meta: FieldMeta): string {
  if (ctx.treatment !== "editorial") return "";
  const { W, H } = ctx;
  const scrimId = `${ctx.uid}-scrim${defCounter++}`;
  ctx.defs.push(el("linearGradient", { id: scrimId, x1: 0, y1: 0, x2: 0, y2: 1 },
    el("stop", { offset: "62%", "stop-color": "#0a0a0c", "stop-opacity": 0 }) +
    el("stop", { offset: "100%", "stop-color": "#0a0a0c", "stop-opacity": 0.55 })));
  let out = el("rect", { x: 0, y: H * 0.6, width: W, height: H * 0.4, fill: `url(#${scrimId})` });
  const fam = "font-family=\"'Instrument Sans', ui-sans-serif, sans-serif\"";
  const mono = "font-family=\"'IBM Plex Mono', ui-monospace, monospace\"";
  let y = H - 168;
  if (meta.subtitle) {
    out += `<text x="${W * 0.08}" y="${y}" ${mono} font-size="18" letter-spacing="3" fill="#e8e6e0" opacity="0.75">${esc(meta.subtitle.toUpperCase())}</text>`;
    y += 46;
  }
  if (meta.title) {
    out += `<text x="${W * 0.08}" y="${y}" ${fam} font-size="${Math.min(46, 870 / Math.max(1, meta.title?.length ?? 1) / 0.66).toFixed(1)}" font-weight="600" letter-spacing="0.5" fill="#f5f4ef">${esc(meta.title.toUpperCase())}</text>`;
    y += 40;
  }
  const bits = [meta.factors, meta.date].filter(Boolean).join("   ·   ");
  if (bits) {
    out += `<text x="${W * 0.08}" y="${y}" ${mono} font-size="15" letter-spacing="1.5" fill="#c9c7c0">${esc(bits.toUpperCase())}</text>`;
  }
  if (meta.notation) {
    out += `<text x="${W - 32}" y="${H - 32}" ${mono} font-size="14" letter-spacing="0.5" fill="#c9c7c0" text-anchor="end" opacity="0.85">${esc(meta.notation)}</text>`;
  }
  return out;
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function renderChromaticField(
  field: ChromaticField, treatment: Treatment, meta: FieldMeta = {}, width = 1080, height = 1350,
): string {
  defCounter = 0;
  const uid = `cf${(field.seed >>> 0).toString(36)}`;
  const ctx: Ctx = { uid, W: 1080, H: 1350, defs: [], treatment, field };

  let body = territories(ctx);
  if (treatment !== "pure") {
    // Transparent same-palette wash; these are optical adjustments, not areas.
    const wash=field.tokens[field.tokens.length-1];
    const alpha=field.surface.transparency*field.surface.edgeSoftness*0.12;
    body += el("rect", { x:0, y:0, width:1080, height:1350, fill:wash.hex, opacity:alpha.toFixed(5) });
    body += grainLayer(ctx);
  }
  body += typography(ctx, meta);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="${width}" height="${height}"><defs>${ctx.defs.join("")}</defs>${body}</svg>`;
}

export function buildFieldFromPlacement(planet: Planet, sign: Sign, weight = 1): ChromaticField {
  const model=buildPlacementModel({planet,sign,weight});
  return {tokens:buildTokens(model.palette,[{planet,sign,weight}]),relationship:{aspect:null,strength:0,geometry:model.composition.dominantGeometry},surface:buildSurface(model.profile),flavor:buildFlavor([planet],[sign]),seed:model.seed};
}
