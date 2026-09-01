// The user-facing results page: birth data → whole-chart chromatic model →
// hero artwork, signature palette, profile, interpretation, influences, and
// PNG export in the three social formats.

import { PROFILE_AXES, type ChromaticModel } from "../engine/types";
import { buildChartModel, type ChromaticChart, type NatalInput } from "../engine/chart";
import { buildColorWeather, type ColorWeather } from "../engine/weather";
import { renderArtwork } from "../engine/render";
import { renderChartInterpretation } from "../engine/explain";
import {
  ASPECT_CARD_LINES, ASPECT_GLYPHS, CARD_DIMENSIONS, PLANET_GLYPHS,
  renderSocialCard, type CardFormat, type CardMeta,
} from "../engine/social";
import { PLANET_PROFILES } from "../engine/config/planets";
import { attachPlaceSearch, resolveOffset } from "./geocode";
import type { BirthInput } from "./natal-adapter";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let current: { natal: NatalInput; chart: ChromaticChart; prose: string; meta: CardMeta } | null = null;
let currentWeather: ColorWeather | null = null;

/** Today as YYYY-MM-DD in the viewer's own timezone. */
const localToday = () => new Date().toLocaleDateString("sv");

// ── Compute ──────────────────────────────────────────────────────────────────

function readBirth(): BirthInput {
  const date = $<HTMLInputElement>("f-date").value;
  const time = $<HTMLInputElement>("f-time").value;
  return {
    date, time,
    lat: parseFloat($<HTMLInputElement>("f-lat").value),
    lon: parseFloat($<HTMLInputElement>("f-lon").value),
    // A picked birthplace resolves the offset from its timezone at the birth
    // moment (DST and fractional zones included); manual entry is the fallback.
    utcOffset: resolveOffset("f", date, time),
  };
}

async function compute(): Promise<void> {
  const errorEl = $("error");
  errorEl.hidden = true;
  try {
    const { computeChart } = await import("./natal-adapter");
    const birth = readBirth();
    const natal = computeChart(birth);
    const chart = buildChartModel(natal);
    const prose = renderChartInterpretation(chart);
    current = { natal, chart, prose, meta: cardMeta(chart) };
    show(current.chart, current.prose, current.meta);
    writeHash(birth);
    $<HTMLInputElement>("wx-date").value = localToday();
    await runWeather();
  } catch {
    errorEl.textContent = "That birth data didn't compute. Check the date, time, and coordinates.";
    errorEl.hidden = false;
  }
}

// ── Color weather ────────────────────────────────────────────────────────────

async function runWeather(): Promise<void> {
  if (!current) return;
  const dateStr = $<HTMLInputElement>("wx-date").value || localToday();
  // Today reads the sky as it stands right now; any other day reads noon UTC.
  const moment = dateStr === localToday() ? new Date() : new Date(`${dateStr}T12:00:00Z`);
  const { computeTransits } = await import("./natal-adapter");
  currentWeather = buildColorWeather(current.natal, computeTransits(moment));
  const wx = currentWeather;

  const empty = wx.active.length === 0;
  $("wx-content").hidden = empty;
  $("wx-empty").hidden = !empty;
  if (empty) return;

  $("wx-hero").innerHTML = renderArtwork(wx.model, 1000, 1000);
  $("wx-strip").innerHTML = wx.model.palette.map((c) =>
    `<i style="background:${c.hex}" title="${esc(c.role)} ${c.hex}"></i>`).join("");
  $("wx-lines").innerHTML = wx.active.map((t, i) => `
    <div class="inf"><span class="g">${PLANET_GLYPHS[t.transiting]} ${ASPECT_GLYPHS[t.aspect]} ${PLANET_GLYPHS[t.natal]}</span>
      <span><b>Transiting ${t.transiting} ${t.aspect} natal ${t.natal}</b>
      <small>${esc(wx.lines[i].split(": ").slice(1).join(": "))}</small></span>
    </div>`).join("");
  $("wx-shifts").innerHTML = wx.shifts.map((s) => {
    const d = Math.round((s.to - s.from) * 100);
    return `<span class="shift"><b>${s.axis}</b> ${d > 0 ? "↑" : "↓"} ${Math.abs(d)}</span>`;
  }).join("");
}

function weatherCardMeta(wx: ColorWeather, dateStr: string): CardMeta {
  const t = wx.active[0];
  const date = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  if (!t) {
    return { glyphs: "○", title: "Quiet sky", subtitle: `No transit in orb · ${date}`, label: "Color weather" };
  }
  return {
    glyphs: `${PLANET_GLYPHS[t.transiting]} ${ASPECT_GLYPHS[t.aspect]} ${PLANET_GLYPHS[t.natal]}`,
    title: `${t.transiting} ${t.aspect} natal ${t.natal}`,
    subtitle: date,
    label: "Color weather",
  };
}

// ── Share link ───────────────────────────────────────────────────────────────

function writeHash(b: BirthInput): void {
  const name = $<HTMLInputElement>("f-name").value.trim();
  const params = new URLSearchParams({
    d: b.date, t: b.time, lat: String(b.lat), lon: String(b.lon), o: String(b.utcOffset),
  });
  if (name) params.set("n", name);
  const place = $<HTMLInputElement>("f-place");
  if (place.value.trim()) params.set("p", place.value.trim());
  if (place.dataset.tz) params.set("tz", place.dataset.tz);
  history.replaceState(null, "", `#${params.toString()}`);
}

function readHash(): boolean {
  if (!location.hash.slice(1)) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.get("d") || !params.get("t")) return false;
  $<HTMLInputElement>("f-date").value = params.get("d")!;
  $<HTMLInputElement>("f-time").value = params.get("t")!;
  $<HTMLInputElement>("f-lat").value = params.get("lat") ?? "";
  $<HTMLInputElement>("f-lon").value = params.get("lon") ?? "";
  $<HTMLInputElement>("f-offset").value = params.get("o") ?? "0";
  $<HTMLInputElement>("f-name").value = params.get("n") ?? "";
  const place = $<HTMLInputElement>("f-place");
  place.value = params.get("p") ?? "";
  if (params.get("tz")) place.dataset.tz = params.get("tz")!;
  return true;
}

function cardMeta(chart: ChromaticChart): CardMeta {
  const name = $<HTMLInputElement>("f-name").value.trim();
  if (chart.defining) {
    const d = chart.defining;
    return {
      glyphs: `${PLANET_GLYPHS[d.a]} ${ASPECT_GLYPHS[d.aspect]} ${PLANET_GLYPHS[d.b]}`,
      title: `${d.a} ${d.aspect} ${d.b}`,
      subtitle: ASPECT_CARD_LINES[d.aspect],
      label: name || undefined,
    };
  }
  const [first] = chart.placements;
  return {
    glyphs: PLANET_GLYPHS[first.planet],
    title: `${first.planet} in ${first.sign}`,
    subtitle: "No aspect organizes this chart; the emphasis alone carries it.",
    label: name || undefined,
  };
}

// ── Render ───────────────────────────────────────────────────────────────────

function show(chart: ChromaticChart, prose: string, meta: CardMeta): void {
  const model = chart.model;
  $("results").style.display = "block";

  $("hero").innerHTML = renderArtwork(model, 1000, 1000);
  $("defining").innerHTML = `
    <div class="glyphs">${esc(meta.glyphs)}</div>
    <div class="name">${esc(meta.title.toUpperCase())}</div>
    <div class="line">${esc(meta.subtitle)}</div>`;

  $("chips").innerHTML = model.palette.map((c) => `
    <div class="chip">
      <div class="swatch" style="background:${c.hex}"></div>
      <div class="meta"><b>${esc(c.label)}</b><code>${c.hex}</code>
      <div class="src">${esc(c.sources[0] ?? "")}</div></div>
    </div>`).join("");

  $("bars").innerHTML = PROFILE_AXES.map((axis) => {
    const v = model.profile[axis];
    return `<div class="bar"><span>${axis}</span><div class="track"><div class="fill" style="width:${(v * 100).toFixed(0)}%"></div></div><output>${(v * 100).toFixed(0)}</output></div>`;
  }).join("");

  $("prose").innerHTML = prose.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("");

  const influences: string[] = chart.placements.slice(0, 3).map((p) => `
    <div class="inf"><span class="g">${PLANET_GLYPHS[p.planet]}</span>
      <span><b>${p.planet} in ${p.sign}</b>
      <small>${esc(PLANET_PROFILES[p.planet].effects[0])}${p.reasons.length ? ` · ${esc(p.reasons.join(", "))}` : ""}</small></span>
    </div>`);
  if (chart.defining) {
    const d = chart.defining;
    influences.unshift(`
    <div class="inf"><span class="g">${PLANET_GLYPHS[d.a]} ${ASPECT_GLYPHS[d.aspect]} ${PLANET_GLYPHS[d.b]}</span>
      <span><b>${d.a} ${d.aspect} ${d.b}</b>
      <small>${esc(ASPECT_CARD_LINES[d.aspect])} Orb ${d.orb.toFixed(1)}°.</small></span>
    </div>`);
  }
  $("influences").innerHTML = influences.join("");

  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Export ───────────────────────────────────────────────────────────────────

async function svgToPngBlob(svg: string, w: number, h: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function exportModelCard(model: ChromaticModel, meta: CardMeta, format: CardFormat): Promise<Blob> {
  const { w, h } = CARD_DIMENSIONS[format];
  return svgToPngBlob(renderSocialCard(model, meta, format), w, h);
}

async function exportCard(format: CardFormat): Promise<Blob> {
  if (!current) throw new Error("no chart computed yet");
  return exportModelCard(current.chart.model, current.meta, format);
}

async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

async function downloadCard(format: CardFormat): Promise<void> {
  await downloadBlob(await exportCard(format), `chromatic-${format}.png`);
}

// Debug handle so exports can be exercised without clicking download.
async function exportWeatherCard(): Promise<Blob> {
  if (!currentWeather) throw new Error("no weather computed yet");
  const dateStr = $<HTMLInputElement>("wx-date").value || localToday();
  return exportModelCard(currentWeather.model, weatherCardMeta(currentWeather, dateStr), "story");
}
(window as unknown as Record<string, unknown>).chromaticDebug = { exportCard, exportWeatherCard };

// ── Wiring ───────────────────────────────────────────────────────────────────

$("birth-form").addEventListener("submit", (e) => {
  e.preventDefault();
  void compute();
});
$("sample").addEventListener("click", () => {
  $<HTMLInputElement>("f-date").value = "1969-02-07";
  $<HTMLInputElement>("f-time").value = "18:45";
  $<HTMLInputElement>("f-lat").value = "19.08";
  $<HTMLInputElement>("f-lon").value = "72.88";
  $<HTMLInputElement>("f-offset").value = "5.5";
  const place = $<HTMLInputElement>("f-place");
  place.value = "Mumbai, Maharashtra, India";
  place.dataset.tz = "Asia/Kolkata";
  void compute();
});
attachPlaceSearch("f", (message) => {
  const errorEl = $("error");
  errorEl.textContent = message;
  errorEl.hidden = false;
});
for (const format of ["square", "portrait", "story"] as const) {
  $(`dl-${format}`).addEventListener("click", () => void downloadCard(format));
}
$("copy-prose").addEventListener("click", async () => {
  if (!current) return;
  await navigator.clipboard.writeText(current.prose);
  const btn = $("copy-prose");
  const prior = btn.textContent;
  btn.textContent = "Copied.";
  setTimeout(() => { btn.textContent = prior; }, 1500);
});
$("copy-link").addEventListener("click", async () => {
  if (!current) return;
  await navigator.clipboard.writeText(location.href);
  const btn = $("copy-link");
  const prior = btn.textContent;
  btn.textContent = "Copied.";
  setTimeout(() => { btn.textContent = prior; }, 1500);
});
$("wx-read").addEventListener("click", () => void runWeather());
$("wx-story").addEventListener("click", () => {
  if (!currentWeather) return;
  const dateStr = $<HTMLInputElement>("wx-date").value || localToday();
  void exportModelCard(currentWeather.model, weatherCardMeta(currentWeather, dateStr), "story")
    .then((blob) => downloadBlob(blob, `chromatic-weather-${dateStr}.png`));
});

// A shared link carries the birth data in the hash; arriving on one computes
// the chart without another form step.
if (readHash()) void compute();
