// The development playground: three views.
//   pair    — manipulate one planetary pair by hand, watch everything update
//   gallery — the design doc's ten comparison pairs, with a blind mode
//   chart   — birth data → live natal chart → whole-chart chromatic model
// This is where the visual language gets argued into shape before the
// user-facing product trusts it.

import {
  ASPECTS, PLANETS, PROFILE_AXES, SIGNS,
  type AspectName, type ChromaticModel, type PairScenario, type Planet, type Sign,
} from "../engine/types";
import { ASPECT_PROFILES } from "../engine/config/aspects";
import { DEFAULT_WEIGHTS } from "../engine/config/weights";
import { buildPairModel } from "../engine/pair";
import { buildChartModel, elementBalance, type ChromaticChart, type NatalInput } from "../engine/chart";
import { buildPlacementModel, renderPlacementInterpretation } from "../engine/placement";
import { renderArtwork } from "../engine/render";
import { renderChartInterpretation, renderInterpretation } from "../engine/explain";
import { attachPlaceSearch, utcOffsetHours } from "./geocode";
import type { BirthInput } from "./natal-adapter";

// ── State ────────────────────────────────────────────────────────────────────

type View = "pair" | "single" | "gallery" | "chart";

/** What the chart view's inspector is currently focused on. */
type ChartInspect =
  | { kind: "placement"; planet: Planet }
  | { kind: "aspect"; index: number }
  | null;

interface State {
  aPlanet: Planet; aSign: Sign; aWeight: number;
  bPlanet: Planet; bSign: Sign; bWeight: number;
  aspect: AspectName; orb: number; variation: number;
  sPlanet: Planet; sSign: Sign; sWeight: number; sVariation: number;
  inspect: ChartInspect;
  view: View;
  blind: boolean;
  birth: BirthInput;
  birthPlace: { label: string; tz: string } | null;
  placeMessage: string | null;
  chartVariation: number;
  natal: NatalInput | null;   // last computed chart
  chartError: string | null;
}

const state: State = {
  aPlanet: "Venus", aSign: "Libra", aWeight: DEFAULT_WEIGHTS.base.Venus,
  bPlanet: "Uranus", bSign: "Capricorn", bWeight: DEFAULT_WEIGHTS.base.Uranus,
  aspect: "square", orb: 1.2, variation: 0,
  sPlanet: "Mars", sSign: "Scorpio", sWeight: DEFAULT_WEIGHTS.base.Mars, sVariation: 0,
  inspect: null,
  view: "pair", blind: false,
  birth: { date: "1990-05-04", time: "10:30", lat: 40.71, lon: -74.01, utcOffset: -4 },
  birthPlace: { label: "New York, New York, United States", tz: "America/New_York" },
  placeMessage: null,
  chartVariation: 0,
  natal: null,
  chartError: null,
};

const SAMPLES: Array<{ label: string; birth: BirthInput; place: { label: string; tz: string } }> = [
  { label: "Sample A — New York, 1990", birth: { date: "1990-05-04", time: "10:30", lat: 40.71, lon: -74.01, utcOffset: -4 }, place: { label: "New York, New York, United States", tz: "America/New_York" } },
  { label: "Sample B — Tokyo, 1984", birth: { date: "1984-11-22", time: "03:15", lat: 35.68, lon: 139.69, utcOffset: 9 }, place: { label: "Tokyo, Japan", tz: "Asia/Tokyo" } },
  { label: "Sample C — Mumbai, 1969 (half-hour zone)", birth: { date: "1969-02-07", time: "18:45", lat: 19.08, lon: 72.88, utcOffset: 5.5 }, place: { label: "Mumbai, Maharashtra, India", tz: "Asia/Kolkata" } },
];

function scenario(): PairScenario {
  return {
    a: { planet: state.aPlanet, sign: state.aSign, weight: state.aWeight },
    b: { planet: state.bPlanet, sign: state.bSign, weight: state.bWeight },
    aspect: state.aspect, orb: state.orb, variationSeed: state.variation,
  };
}

// The ten comparison pairs from the design doc's success test, each in signs
// that can actually form the aspect.
const GALLERY: Array<{ title: string; s: PairScenario }> = [
  ["Venus conjunct Jupiter", "Venus", "Pisces", "Jupiter", "Pisces", "conjunction", 1.2],
  ["Venus square Saturn", "Venus", "Libra", "Saturn", "Capricorn", "square", 2.0],
  ["Venus opposite Uranus", "Venus", "Taurus", "Uranus", "Scorpio", "opposition", 1.5],
  ["Mars conjunct Saturn", "Mars", "Capricorn", "Saturn", "Capricorn", "conjunction", 0.8],
  ["Mars trine Neptune", "Mars", "Scorpio", "Neptune", "Pisces", "trine", 2.0],
  ["Moon opposite Pluto", "Moon", "Cancer", "Pluto", "Capricorn", "opposition", 1.0],
  ["Sun trine Jupiter", "Sun", "Leo", "Jupiter", "Sagittarius", "trine", 3.0],
  ["Mercury conjunct Uranus", "Mercury", "Aquarius", "Uranus", "Aquarius", "conjunction", 1.0],
  ["Saturn conjunct Neptune", "Saturn", "Pisces", "Neptune", "Pisces", "conjunction", 1.5],
  ["Jupiter square Pluto", "Jupiter", "Aries", "Pluto", "Capricorn", "square", 2.0],
].map(([title, ap, as_, bp, bs, aspect, orb]) => ({
  title: title as string,
  s: {
    a: { planet: ap as Planet, sign: as_ as Sign, weight: DEFAULT_WEIGHTS.base[ap as Planet] },
    b: { planet: bp as Planet, sign: bs as Sign, weight: DEFAULT_WEIGHTS.base[bp as Planet] },
    aspect: aspect as AspectName, orb: orb as number, variationSeed: 0,
  },
}));

// ── Rendering ────────────────────────────────────────────────────────────────

const app = document.getElementById("app")!;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function selectHtml(id: string, options: readonly string[], value: string): string {
  return `<select id="${id}">${options.map((o) =>
    `<option value="${o}"${o === value ? " selected" : ""}>${o}</option>`).join("")}</select>`;
}

function navHtml(): string {
  const btn = (view: View, label: string) =>
    `<button id="nav-${view}" class="${state.view === view ? "primary" : ""}">${label}</button>`;
  return btn("pair", "Pair editor") + btn("single", "Planet") + btn("gallery", "Gallery") + btn("chart", "Chart");
}

function controlsHtml(): string {
  let body = "";
  if (state.view === "pair") {
    const maxOrb = ASPECT_PROFILES[state.aspect].maxOrb;
    body = `
    <div class="group">
      <div class="group-title">Planet A</div>
      ${selectHtml("aPlanet", PLANETS, state.aPlanet)}
      ${selectHtml("aSign", SIGNS, state.aSign)}
      <label>weight <output>${state.aWeight.toFixed(2)}</output></label>
      <input type="range" id="aWeight" min="0.3" max="2" step="0.05" value="${state.aWeight}">
    </div>
    <div class="group">
      <div class="group-title">Planet B</div>
      ${selectHtml("bPlanet", PLANETS, state.bPlanet)}
      ${selectHtml("bSign", SIGNS, state.bSign)}
      <label>weight <output>${state.bWeight.toFixed(2)}</output></label>
      <input type="range" id="bWeight" min="0.3" max="2" step="0.05" value="${state.bWeight}">
    </div>
    <div class="group">
      <div class="group-title">Aspect</div>
      ${selectHtml("aspect", ASPECTS, state.aspect)}
      <label>orb <output>${state.orb.toFixed(1)}° / ${maxOrb}°</output></label>
      <input type="range" id="orb" min="0" max="${maxOrb}" step="0.1" value="${Math.min(state.orb, maxOrb)}">
    </div>
    <button id="vary">Another variation (seed ${state.variation})</button>`;
  } else if (state.view === "single") {
    body = `
    <div class="group">
      <div class="group-title">Placement</div>
      ${selectHtml("sPlanet", PLANETS, state.sPlanet)}
      ${selectHtml("sSign", SIGNS, state.sSign)}
      <label>weight <output>${state.sWeight.toFixed(2)}</output></label>
      <input type="range" id="sWeight" min="0.3" max="2" step="0.05" value="${state.sWeight}">
    </div>
    <button id="varySingle">Another variation (seed ${state.sVariation})</button>
    <p class="hint">One planet, no aspect: its own two pigments carry the image, and the sign's modality organizes the frame — cardinal blocks, fixed consolidates, mutable disperses.</p>`;
  } else if (state.view === "gallery") {
    body = `<button id="blind">${state.blind ? "Show labels" : "Hide labels (blind test)"}</button>`;
  } else {
    const b = state.birth;
    body = `
    <div class="group">
      <div class="group-title">Birth data</div>
      <select id="sample">
        <option value="">Samples…</option>
        ${SAMPLES.map((s, i) => `<option value="${i}">${esc(s.label)}</option>`).join("")}
      </select>
      <label>date</label><input type="date" id="c-date" value="${b.date}">
      <label>time</label><input type="time" id="c-time" value="${b.time}">
      <label>birthplace</label>
      <div class="place-row">
        <input type="text" id="c-place" placeholder="City, country" autocomplete="off">
        <button id="c-find">Find</button>
      </div>
      <select id="c-place-results" hidden></select>
      ${state.placeMessage ? `<p class="hint">${esc(state.placeMessage)}</p>` : ""}
      <details>
        <summary>Coordinates and offset (manual)</summary>
        <label>latitude</label><input type="number" id="c-lat" step="any" value="${b.lat}">
        <label>longitude</label><input type="number" id="c-lon" step="any" value="${b.lon}">
        <label>UTC offset (hours)</label><input type="number" id="c-offset" step="any" value="${b.utcOffset}">
      </details>
      <button id="compute" class="primary">Compute chart</button>
    </div>
    <button id="varyChart">Another variation (seed ${state.chartVariation})</button>`;
  }
  return `
  <div class="controls">
    <h1>Chromatic <span>· playground</span></h1>
    <div class="group">${navHtml()}</div>
    ${body}
    <p class="hint">Same inputs always render the same image. The variation button reseeds the drawing while keeping the model.</p>
    <p class="hint"><a href="/color.html" style="color:var(--dim)">Results page</a> · <a href="/admin.html" style="color:var(--dim)">Content generator</a></p>
  </div>`;
}

function chipHtml(c: ChromaticModel["palette"][number]): string {
  return `
  <div class="chip" title="${esc(c.sources.join(" · "))}">
    <div class="swatch" style="background:${c.hex}"></div>
    <div class="meta">
      <span class="role">${c.role}</span>
      <b>${esc(c.label)}</b>
      <code>${c.hex}</code>
      <div class="desc">${esc(c.description)}</div>
      <div class="desc">${esc(c.sources.join(" · "))}</div>
    </div>
  </div>`;
}

function barsHtml(model: ChromaticModel): string {
  return `<div class="bars">${PROFILE_AXES.map((axis) => {
    const v = model.profile[axis];
    return `<div class="bar"><span>${axis}</span><div class="track"><div class="fill" style="width:${(v * 100).toFixed(0)}%"></div></div><output>${(v * 100).toFixed(0)}</output></div>`;
  }).join("")}</div>`;
}

function pc(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

/** The shared output stack: artwork, palette, profile, composition, prose, influences. */
function modelPanelsHtml(model: ChromaticModel, prose: string): string {
  const comp = model.composition;
  const proseHtml = prose.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("");
  return `
    <h2>Artwork</h2>
    <div class="artwork">${renderArtwork(model)}</div>
    <h2>Palette</h2>
    <div class="chips">${model.palette.map(chipHtml).join("")}</div>
    <h2>Visual profile</h2>
    ${barsHtml(model)}
    <h2>Composition</h2>
    <p class="comp-readout">
      geometry <b>${comp.dominantGeometry}</b> ·
      fields ${comp.fieldCount} ·
      gradient ${pc(comp.gradientStrength)} ·
      edges ${pc(comp.edgeSharpness)} ·
      symmetry ${pc(comp.symmetry)} ·
      movement ${pc(comp.movement)} ·
      transparency ${pc(comp.transparency)} ·
      texture ${pc(comp.texture)} ·
      aspect strength ${pc(model.aspectStrength)}
    </p>
    <h2>Why it looks this way</h2>
    <div class="prose">${proseHtml}</div>
    <h2>Key influences</h2>
    <div class="influences">${model.explanation.dominantFactors.map((f) => `
      <div class="inf"><b>${esc(f.factor)}</b> <small>strength ${f.strength.toFixed(2)} — ${esc(f.visualEffects.join("; "))}</small></div>`).join("")}
    </div>
    <h2>Keywords</h2>
    <p class="keywords">${esc(model.explanation.visualKeywords.join(" · "))}</p>`;
}

function pairHtml(): string {
  const s = scenario();
  const model = buildPairModel(s);
  return `<div class="main">${modelPanelsHtml(model, renderInterpretation(model, s))}</div>`;
}

function singleHtml(): string {
  const placement = { planet: state.sPlanet, sign: state.sSign, weight: state.sWeight };
  const model = buildPlacementModel(placement, state.sVariation);
  return `<div class="main">${modelPanelsHtml(model, renderPlacementInterpretation(model, placement))}</div>`;
}

function galleryHtml(): string {
  return `
  <div class="main">
    <h2>The ten test pairs</h2>
    <p class="hint" style="margin-bottom:14px">The success test from the design doc: without labels, these should still feel meaningfully different — restrained, expansive, electric, dreamy, tense, heavy, radiant.</p>
    <div class="gallery">
      ${GALLERY.map(({ title, s }) => {
        const model = buildPairModel(s);
        const strip = model.palette.map((c) => `<i style="background:${c.hex}"></i>`).join("");
        return `<div class="card">${renderArtwork(model, 1000, 800)}${state.blind ? "" : `<div class="title">${esc(title)}</div>`}<div class="strip">${strip}</div></div>`;
      }).join("")}
    </div>
  </div>`;
}

function chartHtml(): string {
  if (state.chartError) {
    return `<div class="main"><h2>Chart</h2><p class="prose">The chart engine failed to load: ${esc(state.chartError)}</p></div>`;
  }
  if (!state.natal) {
    return `<div class="main"><h2>Chart</h2><p class="hint">Enter birth data (or pick a sample) and press Compute chart. Calculation runs locally against the api-server's natal engine.</p></div>`;
  }
  const chart: ChromaticChart = buildChartModel(state.natal, state.chartVariation);
  const placementRows = chart.placements.map((p) => `
    <tr class="row-click" data-inspect-placement="${p.planet}">
      <td>${p.planet}</td><td>${p.sign}</td><td>${p.houseNumber}</td>
      <td>${p.weight.toFixed(2)}</td><td>${p.effective.toFixed(2)}</td>
      <td class="dim">${esc(p.reasons.join(", ") || "—")}</td>
    </tr>`).join("");
  const aspectRows = chart.aspects.slice(0, 10).map((a, i) => `
    <tr class="row-click${i === 0 ? " defining" : ""}" data-inspect-aspect="${i}">
      <td>${a.a} ${a.aspect} ${a.b}</td>
      <td>${a.orb.toFixed(1)}°</td><td>${pc(a.strength)}</td><td>${a.score.toFixed(2)}</td>
      <td class="dim">${i === 0 ? "defining relationship" : ""}</td>
    </tr>`).join("");
  const elements = elementBalance(chart.placements);
  const EL_COLORS = { fire: "#cf7a4e", earth: "#9c8b62", air: "#8fb3c9", water: "#5e7fa6" };
  const elementBars = (Object.keys(elements) as Array<keyof typeof elements>).map((el) => `
    <div class="bar"><span>${el}</span>
      <div class="track"><div class="fill" style="width:${(elements[el] * 100).toFixed(0)}%;background:${EL_COLORS[el]}"></div></div>
      <output>${(elements[el] * 100).toFixed(0)}</output>
    </div>`).join("");
  return `
  <div class="main">
    ${modelPanelsHtml(chart.model, renderChartInterpretation(chart))}
    <h2>Element balance</h2>
    <div class="bars" style="max-width:420px;grid-template-columns:1fr">${elementBars}</div>
    <h2>Chart emphasis</h2>
    <p class="hint" style="margin-bottom:8px">Click a row to see that planet, or that aspect, drawn on its own.</p>
    <table class="data">
      <thead><tr><th>planet</th><th>sign</th><th>house</th><th>weight</th><th>effective</th><th>why</th></tr></thead>
      <tbody>${placementRows}</tbody>
    </table>
    <h2>Aspects (ranked)</h2>
    <table class="data">
      <thead><tr><th>aspect</th><th>orb</th><th>strength</th><th>score</th><th></th></tr></thead>
      <tbody>${aspectRows}</tbody>
    </table>
    <p class="hint">ASC ${state.natal.ascendant.sign} · MC ${state.natal.midheaven.sign} · score = strength × mean effective weight; the top score drives hue relationship and geometry.</p>
    ${inspectorHtml(chart)}
  </div>`;
}

/** The chart inspector: one component of the chart, drawn alone. */
function inspectorHtml(chart: ChromaticChart): string {
  if (!state.inspect) return "";
  const byPlanet = new Map(chart.placements.map((p) => [p.planet, p]));
  let title: string;
  let model: ChromaticModel;
  let prose: string;
  if (state.inspect.kind === "placement") {
    const p = byPlanet.get(state.inspect.planet);
    if (!p) return "";
    const placement = { planet: p.planet, sign: p.sign, weight: p.weight };
    model = buildPlacementModel(placement);
    prose = renderPlacementInterpretation(model, placement);
    title = `${p.planet} in ${p.sign}, alone`;
  } else {
    const a = chart.aspects[state.inspect.index];
    if (!a) return "";
    const pa = byPlanet.get(a.a)!;
    const pb = byPlanet.get(a.b)!;
    const s = {
      a: { planet: pa.planet, sign: pa.sign, weight: pa.weight },
      b: { planet: pb.planet, sign: pb.sign, weight: pb.weight },
      aspect: a.aspect, orb: a.orb, variationSeed: 0,
    };
    model = buildPairModel(s);
    prose = renderInterpretation(model, s);
    title = `${a.a} ${a.aspect} ${a.b}, drawn alone (orb ${a.orb.toFixed(1)}°)`;
  }
  const strip = model.palette.map((c) => `<i style="background:${c.hex}" title="${c.role} ${c.hex}"></i>`).join("");
  return `
    <h2>Inspector — ${esc(title)}</h2>
    <div class="inspect-grid">
      <div>
        <div class="inspect-art">${renderArtwork(model, 1000, 1000)}</div>
        <div class="strip">${strip}</div>
      </div>
      <div class="prose">${prose.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    </div>`;
}

// ── Wiring ───────────────────────────────────────────────────────────────────
//
// Controls and output live in separate roots: slider drags re-render only the
// output panel, so the input element under the pointer survives the update.

const controlsRoot = document.createElement("div");
const mainRoot = document.createElement("div");
mainRoot.style.flex = "1";
app.appendChild(controlsRoot);
app.appendChild(mainRoot);

function renderMain(): void {
  mainRoot.innerHTML =
    state.view === "pair" ? pairHtml() :
    state.view === "single" ? singleHtml() :
    state.view === "gallery" ? galleryHtml() : chartHtml();
  if (state.view === "chart") bindChartRows();
}

function bindChartRows(): void {
  for (const row of mainRoot.querySelectorAll<HTMLElement>("[data-inspect-placement]")) {
    row.addEventListener("click", () => {
      state.inspect = { kind: "placement", planet: row.dataset.inspectPlacement as Planet };
      renderMain();
      mainRoot.querySelector(".inspect-grid")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  for (const row of mainRoot.querySelectorAll<HTMLElement>("[data-inspect-aspect]")) {
    row.addEventListener("click", () => {
      state.inspect = { kind: "aspect", index: parseInt(row.dataset.inspectAspect!, 10) };
      renderMain();
      mainRoot.querySelector(".inspect-grid")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

function render(): void {
  controlsRoot.innerHTML = controlsHtml();
  bindControls();
  renderMain();
}

async function computeChartNow(): Promise<void> {
  try {
    // A picked birthplace resolves the offset from its timezone at the birth
    // moment; the manual offset field is the fallback.
    if (state.birthPlace) {
      state.birth.utcOffset = utcOffsetHours(state.birthPlace.tz, state.birth.date, state.birth.time);
      const offsetInput = document.getElementById("c-offset") as HTMLInputElement | null;
      if (offsetInput) offsetInput.value = String(state.birth.utcOffset);
    }
    // Lazy import: the ephemeris only loads when the chart view asks for it,
    // so a resolution problem can't take down the pair editor or gallery.
    const { computeChart } = await import("./natal-adapter");
    state.natal = computeChart(state.birth);
    state.chartError = null;
  } catch (err) {
    state.natal = null;
    state.chartError = err instanceof Error ? err.message : String(err);
  }
  renderMain();
}

function bindControls(): void {
  const on = <T extends HTMLElement>(id: string, event: string, fn: (el: T) => void) => {
    const node = document.getElementById(id) as T | null;
    if (node) node.addEventListener(event, () => fn(node));
  };
  const setOutput = (input: HTMLInputElement, text: string) => {
    const out = input.previousElementSibling?.querySelector("output");
    if (out) out.textContent = text;
  };

  for (const view of ["pair", "single", "gallery", "chart"] as const) {
    on<HTMLButtonElement>(`nav-${view}`, "click", () => { state.view = view; render(); });
  }

  // Single-placement view
  on<HTMLSelectElement>("sPlanet", "change", (n) => {
    state.sPlanet = n.value as Planet;
    state.sWeight = DEFAULT_WEIGHTS.base[state.sPlanet];
    render();
  });
  on<HTMLSelectElement>("sSign", "change", (n) => { state.sSign = n.value as Sign; render(); });
  on<HTMLInputElement>("sWeight", "input", (n) => {
    state.sWeight = parseFloat(n.value);
    setOutput(n, state.sWeight.toFixed(2));
    renderMain();
  });
  on<HTMLButtonElement>("varySingle", "click", () => { state.sVariation++; render(); });

  // Pair view
  on<HTMLSelectElement>("aPlanet", "change", (n) => {
    state.aPlanet = n.value as Planet;
    state.aWeight = DEFAULT_WEIGHTS.base[state.aPlanet];
    render();
  });
  on<HTMLSelectElement>("bPlanet", "change", (n) => {
    state.bPlanet = n.value as Planet;
    state.bWeight = DEFAULT_WEIGHTS.base[state.bPlanet];
    render();
  });
  on<HTMLSelectElement>("aSign", "change", (n) => { state.aSign = n.value as Sign; render(); });
  on<HTMLSelectElement>("bSign", "change", (n) => { state.bSign = n.value as Sign; render(); });
  on<HTMLSelectElement>("aspect", "change", (n) => {
    state.aspect = n.value as AspectName;
    state.orb = Math.min(state.orb, ASPECT_PROFILES[state.aspect].maxOrb);
    render();
  });
  on<HTMLInputElement>("orb", "input", (n) => {
    state.orb = parseFloat(n.value);
    setOutput(n, `${state.orb.toFixed(1)}° / ${ASPECT_PROFILES[state.aspect].maxOrb}°`);
    renderMain();
  });
  on<HTMLInputElement>("aWeight", "input", (n) => {
    state.aWeight = parseFloat(n.value);
    setOutput(n, state.aWeight.toFixed(2));
    renderMain();
  });
  on<HTMLInputElement>("bWeight", "input", (n) => {
    state.bWeight = parseFloat(n.value);
    setOutput(n, state.bWeight.toFixed(2));
    renderMain();
  });
  on<HTMLButtonElement>("vary", "click", () => { state.variation++; render(); });

  // Gallery view
  on<HTMLButtonElement>("blind", "click", () => { state.blind = !state.blind; render(); });

  // Chart view
  on<HTMLSelectElement>("sample", "change", (n) => {
    const i = parseInt(n.value, 10);
    if (!Number.isNaN(i) && SAMPLES[i]) {
      state.birth = { ...SAMPLES[i].birth };
      state.birthPlace = { ...SAMPLES[i].place };
      state.placeMessage = null;
      render();
      void computeChartNow();
    }
  });
  on<HTMLInputElement>("c-date", "change", (n) => { state.birth.date = n.value; });
  on<HTMLInputElement>("c-time", "change", (n) => { state.birth.time = n.value; });
  on<HTMLInputElement>("c-lat", "change", (n) => { state.birth.lat = parseFloat(n.value); });
  on<HTMLInputElement>("c-lon", "change", (n) => { state.birth.lon = parseFloat(n.value); });
  on<HTMLInputElement>("c-offset", "change", (n) => {
    state.birth.utcOffset = parseFloat(n.value);
    state.birthPlace = null; // manual offset takes over
  });
  on<HTMLButtonElement>("compute", "click", () => { void computeChartNow(); });
  on<HTMLButtonElement>("varyChart", "click", () => { state.chartVariation++; render(); });

  const placeInput = document.getElementById("c-place") as HTMLInputElement | null;
  if (placeInput) {
    if (state.birthPlace) {
      placeInput.value = state.birthPlace.label;
      placeInput.dataset.tz = state.birthPlace.tz;
    }
    attachPlaceSearch(
      "c",
      (message) => { state.placeMessage = message; render(); },
      (r) => {
        state.birthPlace = { label: r.label, tz: r.timezone };
        state.birth.lat = r.lat;
        state.birth.lon = r.lon;
        state.placeMessage = null;
        void computeChartNow();
      },
    );
    placeInput.addEventListener("input", () => { state.birthPlace = null; });
  }
}

render();
