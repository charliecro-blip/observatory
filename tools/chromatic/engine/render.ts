// The first artwork renderer: deterministic SVG from a ChromaticModel.
// Aesthetic target is color-field painting and quiet geometry — large fields,
// gradients, controlled noise — with the aspect deciding the composition's
// skeleton. No zodiac clip art, no starfields; the palette carries the work.
//
// Everything visual is traceable: geometry ← aspect, edge quality ←
// structure/diffusion, texture ← materiality, vignette ← depth, and so on.

import type { ChromaticModel, PaletteColor, PaletteRole } from "./types";
import { makeRng, range, type Rng } from "./seed";

interface Ctx {
  rng: Rng;
  uid: string;
  W: number;
  H: number;
  defs: string[];
  m: ChromaticModel;
  color: (role: PaletteRole) => PaletteColor | undefined;
}

const A = (attrs: Record<string, string | number>) =>
  Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join("");
const el = (tag: string, attrs: Record<string, string | number>, children = "") =>
  children ? `<${tag}${A(attrs)}>${children}</${tag}>` : `<${tag}${A(attrs)}/>`;

let defCounter = 0;
function radial(ctx: Ctx, hex: string, edgeOpacity = 0): string {
  const id = `${ctx.uid}-r${defCounter++}`;
  ctx.defs.push(el("radialGradient", { id },
    el("stop", { offset: "0%", "stop-color": hex, "stop-opacity": 1 }) +
    el("stop", { offset: "100%", "stop-color": hex, "stop-opacity": edgeOpacity })));
  return `url(#${id})`;
}
function linear(ctx: Ctx, c1: string, c2: string, angleDeg: number, mid = 0.5, spread = 0.3): string {
  const id = `${ctx.uid}-l${defCounter++}`;
  const rad = (angleDeg * Math.PI) / 180;
  const x = Math.cos(rad) / 2, y = Math.sin(rad) / 2;
  const lo = Math.max(0, mid - spread) * 100, hi = Math.min(1, mid + spread) * 100;
  ctx.defs.push(el("linearGradient", {
    id, x1: 0.5 - x, y1: 0.5 - y, x2: 0.5 + x, y2: 0.5 + y,
  },
    el("stop", { offset: "0%", "stop-color": c1 }) +
    el("stop", { offset: `${lo}%`, "stop-color": c1 }) +
    el("stop", { offset: `${hi}%`, "stop-color": c2 }) +
    el("stop", { offset: "100%", "stop-color": c2 })));
  return `url(#${id})`;
}

export function renderArtwork(m: ChromaticModel, width = 1000, height = 1000): string {
  defCounter = 0;
  const rng = makeRng(m.seed);
  const uid = `ch${(m.seed >>> 0).toString(36)}`;
  const byRole = new Map(m.palette.map((c) => [c.role, c]));
  const ctx: Ctx = {
    rng, uid, W: width, H: height, defs: [], m,
    color: (role) => byRole.get(role),
  };
  const comp = m.composition;

  const bg = ctx.color("background")!;
  const parts: string[] = [];

  // Ground: a near-flat gradient so the field never reads as dead paper.
  const bgAngle = range(rng, 60, 120);
  parts.push(el("rect", {
    x: 0, y: 0, width, height,
    fill: linear(ctx, shade(bg.hex, 6), shade(bg.hex, -6), bgAngle, 0.5, 0.5),
  }));

  // Fields, arranged by the aspect's geometry.
  const geometryFns: Record<string, (c: Ctx) => string> = {
    central: renderCentral,
    polar: renderPolar,
    crossing: renderCrossing,
    triadic: renderTriadic,
    patterned: renderPatterned,
    asymmetric: renderAsymmetric,
    distributed: renderDistributed,
  };
  let fields = geometryFns[comp.dominantGeometry](ctx);

  // Diffusion softens the whole field group; movement tilts it.
  const filters: string[] = [];
  if (comp.gradientStrength > 0.45) {
    const id = `${uid}-blur`;
    const std = (comp.gradientStrength - 0.45) * 70;
    ctx.defs.push(el("filter", { id, x: "-20%", y: "-20%", width: "140%", height: "140%" },
      el("feGaussianBlur", { stdDeviation: std.toFixed(1) })));
    filters.push(`filter="url(#${id})"`);
  }
  const tilt = (comp.movement - 0.5) * 12;
  const groupOpacity = 1 - 0.3 * comp.transparency;
  parts.push(`<g transform="rotate(${tilt.toFixed(1)} ${width / 2} ${height / 2})" opacity="${groupOpacity.toFixed(2)}" ${filters.join(" ")}>${fields}</g>`);

  // Structural strokes: firm boundaries earn actual drawn lines.
  const structural = ctx.color("structural");
  if (structural && m.profile.structure > 0.62) {
    parts.push(renderStructureLines(ctx, structural.hex));
  }

  // Texture: pigment grain when materiality carries weight.
  if (comp.texture > 0.52) {
    parts.push(renderGrain(ctx, structural?.hex ?? shade(bg.hex, -30)));
  }

  // Highlight: the field breaking to light.
  const highlight = ctx.color("highlight");
  if (highlight) {
    const hx = range(rng, 0.3, 0.7) * width, hy = range(rng, 0.18, 0.42) * height;
    parts.push(el("ellipse", {
      cx: hx.toFixed(0), cy: hy.toFixed(0), rx: (width * 0.24).toFixed(0), ry: (height * 0.2).toFixed(0),
      fill: radial(ctx, highlight.hex), opacity: (0.35 + 0.4 * m.profile.luminosity).toFixed(2),
    }));
  }

  // Disruptive accent: one element the composition cannot absorb.
  const disruptive = ctx.color("disruptive");
  if (disruptive) {
    parts.push(renderDisruption(ctx, disruptive.hex));
  }

  // Weather: a transit's pigment arriving from outside the frame.
  const weather = ctx.color("weather");
  if (weather) {
    parts.push(renderWeather(ctx, weather.hex));
  }

  // Depth vignette: dark closing in from the edges.
  if (m.profile.depth > 0.58) {
    const id = `${uid}-vig`;
    ctx.defs.push(el("radialGradient", { id },
      el("stop", { offset: "55%", "stop-color": "#000", "stop-opacity": 0 }) +
      el("stop", { offset: "100%", "stop-color": "#000008", "stop-opacity": ((m.profile.depth - 0.58) * 1.4).toFixed(2) })));
    parts.push(el("rect", { x: 0, y: 0, width, height, fill: `url(#${id})` }));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
    `<defs>${ctx.defs.join("")}</defs>${parts.join("")}</svg>`;
}

// ── Geometry renderers ───────────────────────────────────────────────────────

function renderCentral(ctx: Ctx): string {
  const { W, H, rng } = ctx;
  const dom = ctx.color("dominant")!, sec = ctx.color("secondary")!;
  const acc = ctx.color("accent"), mid = ctx.color("intermediary");
  const cx = W * range(rng, 0.44, 0.56), cy = H * range(rng, 0.42, 0.54);
  const off = W * 0.07;
  const out: string[] = [];
  if (mid) out.push(el("circle", { cx: cx.toFixed(0), cy: cy.toFixed(0), r: (W * 0.46).toFixed(0), fill: radial(ctx, mid.hex), opacity: 0.8 }));
  out.push(el("circle", { cx: (cx - off).toFixed(0), cy: (cy + off * 0.4).toFixed(0), r: (W * 0.36).toFixed(0), fill: radial(ctx, dom.hex, 0.15), opacity: 0.95 }));
  out.push(el("circle", { cx: (cx + off).toFixed(0), cy: (cy - off * 0.5).toFixed(0), r: (W * 0.3).toFixed(0), fill: radial(ctx, sec.hex, 0.1), opacity: 0.85, style: "mix-blend-mode:multiply" }));
  if (acc) out.push(el("circle", { cx: cx.toFixed(0), cy: cy.toFixed(0), r: (W * 0.11).toFixed(0), fill: radial(ctx, acc.hex, 0.4) }));
  return out.join("");
}

function renderPolar(ctx: Ctx): string {
  const { W, H, rng, m } = ctx;
  const dom = ctx.color("dominant")!, sec = ctx.color("secondary")!, acc = ctx.color("accent");
  const angle = range(rng, -30, 30) + (rng() > 0.5 ? 0 : 90);
  const spread = 0.03 + 0.3 * (1 - m.composition.edgeSharpness);
  const out: string[] = [];
  out.push(el("rect", { x: 0, y: 0, width: W, height: H, fill: linear(ctx, dom.hex, sec.hex, angle, 0.5, spread), opacity: 0.92 }));
  // A core deep in each half, so each pole reads as a body rather than a wash.
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  for (const [color, t] of [[dom, 0.26], [sec, 0.74]] as const) {
    const cx = W / 2 + dx * W * (t - 0.5) * 1.15, cy = H / 2 + dy * H * (t - 0.5) * 1.15;
    out.push(el("ellipse", {
      cx: cx.toFixed(0), cy: cy.toFixed(0), rx: (W * 0.22).toFixed(0), ry: (H * 0.28).toFixed(0),
      fill: radial(ctx, shade(color.hex, color === dom ? -8 : 8)), opacity: 0.85,
    }));
  }
  if (acc) {
    // The complement sits at the boundary, where the poles meet.
    const px = W / 2 - dy * W * range(rng, -0.18, 0.18);
    const py = H / 2 + dx * H * range(rng, -0.18, 0.18);
    out.push(el("circle", { cx: px.toFixed(0), cy: py.toFixed(0), r: (W * 0.055).toFixed(0), fill: acc.hex, opacity: 0.95 }));
  }
  return out.join("");
}

function renderCrossing(ctx: Ctx): string {
  const { W, H, rng } = ctx;
  const dom = ctx.color("dominant")!, sec = ctx.color("secondary")!, acc = ctx.color("accent");
  const vx = W * range(rng, 0.3, 0.46), vw = W * range(rng, 0.24, 0.34);
  const hy = H * range(rng, 0.46, 0.62), hh = H * range(rng, 0.2, 0.28);
  const out: string[] = [];
  out.push(el("rect", { x: vx.toFixed(0), y: 0, width: vw.toFixed(0), height: H, fill: dom.hex, opacity: 0.96 }));
  out.push(el("rect", { x: 0, y: hy.toFixed(0), width: W, height: hh.toFixed(0), fill: sec.hex, opacity: 0.9, style: "mix-blend-mode:multiply" }));
  if (acc) out.push(el("rect", { x: vx.toFixed(0), y: hy.toFixed(0), width: vw.toFixed(0), height: hh.toFixed(0), fill: acc.hex, opacity: 0.9 }));
  // Off-quadrant tints keep the crossing from floating in emptiness.
  out.push(el("rect", { x: 0, y: 0, width: (vx * 0.9).toFixed(0), height: (hy * 0.85).toFixed(0), fill: shade(sec.hex, 18), opacity: 0.3 }));
  out.push(el("rect", { x: (vx + vw * 1.05).toFixed(0), y: (hy + hh * 1.1).toFixed(0), width: W, height: H, fill: shade(dom.hex, -14), opacity: 0.32 }));
  return out.join("");
}

function renderTriadic(ctx: Ctx): string {
  const { W, H, rng } = ctx;
  const dom = ctx.color("dominant")!, sec = ctx.color("secondary")!;
  const third = ctx.color("intermediary") ?? ctx.color("accent") ?? sec;
  const base = range(rng, 0, 120);
  const cx = W / 2, cy = H / 2, orbit = W * 0.21;
  const out: string[] = [];
  const colors = [dom, sec, third];
  for (let i = 0; i < 3; i++) {
    const a = ((base + i * 120) * Math.PI) / 180;
    out.push(el("ellipse", {
      cx: (cx + Math.cos(a) * orbit).toFixed(0), cy: (cy + Math.sin(a) * orbit).toFixed(0),
      rx: (W * 0.3).toFixed(0), ry: (H * 0.27).toFixed(0),
      fill: radial(ctx, colors[i].hex, 0.06), opacity: 0.88,
    }));
  }
  // Circulation: thin arcs carrying the eye around the triad.
  const acc = ctx.color("accent");
  if (acc) {
    const r = orbit * 1.9;
    for (let i = 0; i < 2; i++) {
      const a0 = base + 30 + i * 170, a1 = a0 + 120;
      out.push(el("path", {
        d: arcPath(cx, cy, r + i * 26, a0, a1),
        fill: "none", stroke: acc.hex, "stroke-width": 3, opacity: 0.5, "stroke-linecap": "round",
      }));
    }
  }
  return out.join("");
}

function renderPatterned(ctx: Ctx): string {
  const { W, H, rng, m } = ctx;
  const dom = ctx.color("dominant")!, sec = ctx.color("secondary")!, acc = ctx.color("accent");
  const out: string[] = [];
  out.push(el("ellipse", {
    cx: (W * range(rng, 0.3, 0.45)).toFixed(0), cy: (H * range(rng, 0.35, 0.55)).toFixed(0),
    rx: (W * 0.42).toFixed(0), ry: (H * 0.4).toFixed(0), fill: radial(ctx, dom.hex, 0.1), opacity: 0.92,
  }));
  const cols = 9, rows = 11, r = W * 0.014;
  const accentEvery = Math.floor(range(rng, 5, 9));
  const useSquares = m.profile.structure > 0.55;
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = W * (0.08 + (col + (row % 2) * 0.5) * 0.85 / cols);
      const y = H * (0.08 + row * 0.85 / rows);
      const isAccent = acc && i % accentEvery === accentEvery - 1;
      const fill = isAccent ? acc.hex : sec.hex;
      const size = isAccent ? r * 1.7 : r;
      out.push(useSquares
        ? el("rect", { x: (x - size).toFixed(0), y: (y - size).toFixed(0), width: (size * 2).toFixed(0), height: (size * 2).toFixed(0), fill, opacity: isAccent ? 0.95 : 0.6, transform: `rotate(45 ${x.toFixed(0)} ${y.toFixed(0)})` })
        : el("circle", { cx: x.toFixed(0), cy: y.toFixed(0), r: size.toFixed(1), fill, opacity: isAccent ? 0.95 : 0.6 }));
      i++;
    }
  }
  return out.join("");
}

function renderAsymmetric(ctx: Ctx): string {
  const { W, H, rng } = ctx;
  const dom = ctx.color("dominant")!, sec = ctx.color("secondary")!, acc = ctx.color("accent");
  const out: string[] = [];
  out.push(el("ellipse", {
    cx: (W * 0.36).toFixed(0), cy: (H * range(rng, 0.3, 0.42)).toFixed(0),
    rx: (W * 0.4).toFixed(0), ry: (H * 0.36).toFixed(0),
    fill: radial(ctx, dom.hex, 0.12), opacity: 0.94,
  }));
  // The second field refuses the first one's axis: sharper, tilted, low and right.
  out.push(el("ellipse", {
    cx: (W * range(rng, 0.72, 0.82)).toFixed(0), cy: (H * range(rng, 0.68, 0.8)).toFixed(0),
    rx: (W * 0.16).toFixed(0), ry: (H * 0.11).toFixed(0),
    fill: sec.hex, opacity: 0.95,
    transform: `rotate(${range(rng, 12, 24).toFixed(0)} ${(W * 0.77).toFixed(0)} ${(H * 0.74).toFixed(0)})`,
  }));
  // A reaching line that stops short of connecting the two.
  out.push(el("path", {
    d: `M ${(W * 0.5).toFixed(0)} ${(H * 0.5).toFixed(0)} Q ${(W * 0.62).toFixed(0)} ${(H * 0.56).toFixed(0)} ${(W * 0.66).toFixed(0)} ${(H * 0.64).toFixed(0)}`,
    fill: "none", stroke: shade(dom.hex, -20), "stroke-width": 2.5, opacity: 0.6,
  }));
  if (acc) {
    out.push(el("circle", {
      cx: (W * range(rng, 0.12, 0.2)).toFixed(0), cy: (H * range(rng, 0.75, 0.85)).toFixed(0),
      r: (W * 0.04).toFixed(0), fill: acc.hex, opacity: 0.9,
    }));
  }
  return out.join("");
}

function renderDistributed(ctx: Ctx): string {
  const { W, H, rng, m } = ctx;
  const roles: PaletteRole[] = ["dominant", "secondary", "intermediary", "accent"];
  const out: string[] = [];
  for (let i = 0; i < m.composition.fieldCount; i++) {
    const color = ctx.color(roles[i % roles.length]) ?? ctx.color("dominant")!;
    out.push(el("ellipse", {
      cx: (W * range(rng, 0.15, 0.85)).toFixed(0), cy: (H * range(rng, 0.15, 0.85)).toFixed(0),
      rx: (W * range(rng, 0.14, 0.3)).toFixed(0), ry: (H * range(rng, 0.12, 0.28)).toFixed(0),
      fill: radial(ctx, color.hex, 0.08), opacity: 0.85,
    }));
  }
  return out.join("");
}

// ── Overlays ─────────────────────────────────────────────────────────────────

function renderStructureLines(ctx: Ctx, hex: string): string {
  const { W, H, rng, m } = ctx;
  const n = 2 + Math.round(m.profile.structure * 2);
  const vertical = rng() > 0.5;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = range(rng, 0.12, 0.88);
    const wdt = range(rng, 1.5, 4.5);
    out.push(vertical
      ? el("line", { x1: (W * t).toFixed(0), y1: 0, x2: (W * t).toFixed(0), y2: H, stroke: hex, "stroke-width": wdt.toFixed(1), opacity: 0.5 })
      : el("line", { x1: 0, y1: (H * t).toFixed(0), x2: W, y2: (H * t).toFixed(0), stroke: hex, "stroke-width": wdt.toFixed(1), opacity: 0.5 }));
  }
  return out.join("");
}

function renderGrain(ctx: Ctx, hex: string): string {
  const { W, H, rng, m } = ctx;
  const n = Math.round(90 + 220 * m.composition.texture);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(el("circle", {
      cx: (W * rng()).toFixed(0), cy: (H * rng()).toFixed(0),
      r: range(rng, 0.7, 2.2).toFixed(1), fill: hex, opacity: range(rng, 0.04, 0.13).toFixed(2),
    }));
  }
  return out.join("");
}

function renderDisruption(ctx: Ctx, hex: string): string {
  const { W, H, rng } = ctx;
  const x = W * range(rng, 0.6, 0.85), y = H * range(rng, 0.15, 0.4);
  if (rng() > 0.5) {
    return el("circle", { cx: x.toFixed(0), cy: y.toFixed(0), r: (W * 0.045).toFixed(0), fill: hex, opacity: 0.95 });
  }
  const len = W * 0.22, a = range(rng, -70, -20) * (Math.PI / 180);
  return el("line", {
    x1: x.toFixed(0), y1: y.toFixed(0),
    x2: (x + Math.cos(a) * len).toFixed(0), y2: (y + Math.sin(a) * len).toFixed(0),
    stroke: hex, "stroke-width": 7, "stroke-linecap": "round", opacity: 0.95,
  });
}

function renderWeather(ctx: Ctx, hex: string): string {
  const { W, H, rng } = ctx;
  // Pick an edge, put the orb just inside it, and trail back off the frame —
  // the transit is passing through, not native to the field.
  const edge = Math.floor(rng() * 4); // 0 top, 1 right, 2 bottom, 3 left
  const along = range(rng, 0.2, 0.8);
  const inset = 0.12;
  let x: number, y: number, ox: number, oy: number;
  if (edge === 0) { x = W * along; y = H * inset; ox = 0; oy = -1; }
  else if (edge === 1) { x = W * (1 - inset); y = H * along; ox = 1; oy = 0; }
  else if (edge === 2) { x = W * along; y = H * (1 - inset); ox = 0; oy = 1; }
  else { x = W * inset; y = H * along; ox = -1; oy = 0; }
  const r = W * 0.035;
  const trail = W * 0.2;
  const id = `${ctx.uid}-wx${defCounter++}`;
  ctx.defs.push(el("linearGradient", {
    id,
    x1: 0.5 - ox / 2, y1: 0.5 - oy / 2, x2: 0.5 + ox / 2, y2: 0.5 + oy / 2,
  },
    el("stop", { offset: "0%", "stop-color": hex, "stop-opacity": 0.85 }) +
    el("stop", { offset: "100%", "stop-color": hex, "stop-opacity": 0 })));
  const tx = x + ox * trail, ty = y + oy * trail;
  const wdt = r * 1.1;
  const px = -oy * wdt, py = ox * wdt; // perpendicular half-width
  return el("polygon", {
    points: `${(x - px).toFixed(0)},${(y - py).toFixed(0)} ${(x + px).toFixed(0)},${(y + py).toFixed(0)} ${(tx + px * 0.4).toFixed(0)},${(ty + py * 0.4).toFixed(0)} ${(tx - px * 0.4).toFixed(0)},${(ty - py * 0.4).toFixed(0)}`,
    fill: `url(#${id})`,
  }) + el("circle", { cx: x.toFixed(0), cy: y.toFixed(0), r: r.toFixed(0), fill: hex, opacity: 0.95 });
}

// ── Small utilities ──────────────────────────────────────────────────────────

function arcPath(cx: number, cy: number, r: number, a0deg: number, a1deg: number): string {
  const a0 = (a0deg * Math.PI) / 180, a1 = (a1deg * Math.PI) / 180;
  const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
  const large = Math.abs(a1deg - a0deg) > 180 ? 1 : 0;
  return `M ${x0.toFixed(0)} ${y0.toFixed(0)} A ${r.toFixed(0)} ${r.toFixed(0)} 0 ${large} 1 ${x1.toFixed(0)} ${y1.toFixed(0)}`;
}

/** Lighten (positive) or darken (negative) a hex color by a rough percentage. */
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const adj = (v: number) => Math.min(255, Math.max(0, Math.round(v + (pct / 100) * 255)));
  const r = adj((n >> 16) & 255), g = adj((n >> 8) & 255), b = adj(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
