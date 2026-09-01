// The synastry page: two birth forms, two natal fields, and the shared field
// their cross-aspects draw. A enters left, B enters right, the meeting rises
// between them.

import type { ChromaticModel } from "../engine/types";
import { buildSynastryModel, renderSynastryInterpretation, type SynastryModel } from "../engine/synastry";
import { renderArtwork } from "../engine/render";
import {
  ASPECT_CARD_LINES, ASPECT_GLYPHS, CARD_DIMENSIONS, PLANET_GLYPHS,
  renderSocialCard, type CardFormat, type CardMeta,
} from "../engine/social";
import { attachPlaceSearch, resolveOffset } from "./geocode";
import type { BirthInput } from "./natal-adapter";
import { esc } from "./esc";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;


let current: { syn: SynastryModel; prose: string; meta: CardMeta } | null = null;

function readBirth(prefix: "a" | "b"): { birth: BirthInput; dstNote: string | null } {
  const date = $<HTMLInputElement>(`${prefix}-date`).value;
  const time = $<HTMLInputElement>(`${prefix}-time`).value;
  const { offsetHours, dstNote } = resolveOffset(prefix, date, time);
  return {
    birth: {
      date, time,
      lat: parseFloat($<HTMLInputElement>(`${prefix}-lat`).value),
      lon: parseFloat($<HTMLInputElement>(`${prefix}-lon`).value),
      utcOffset: offsetHours,
    },
    dstNote,
  };
}

const nameOf = (prefix: "a" | "b", fallback: string) =>
  $<HTMLInputElement>(`${prefix}-name`).value.trim() || fallback;

async function compute(): Promise<void> {
  const errorEl = $("error");
  errorEl.hidden = true;
  try {
    const { computeChart } = await import("./natal-adapter");
    const a = readBirth("a");
    const b = readBirth("b");
    const syn = buildSynastryModel(computeChart(a.birth), computeChart(b.birth));
    const nameA = nameOf("a", "Person A");
    const nameB = nameOf("b", "Person B");
    const prose = renderSynastryInterpretation(syn, nameA, nameB);
    current = { syn, prose, meta: cardMeta(syn, nameA, nameB) };
    show(current.syn, prose, nameA, nameB);
    const notes = [
      a.dstNote ? `${nameA}: ${a.dstNote}` : null,
      b.dstNote ? `${nameB}: ${b.dstNote}` : null,
    ].filter(Boolean) as string[];
    const noteEl = $("dst-note");
    noteEl.textContent = notes.join(" ");
    noteEl.hidden = notes.length === 0;
    writeHash(a.birth, b.birth);
  } catch {
    errorEl.textContent = "One of the charts didn't compute. Check both dates, times, and places.";
    errorEl.hidden = false;
  }
}

function cardMeta(syn: SynastryModel, nameA: string, nameB: string): CardMeta {
  const label = `${nameA} × ${nameB}`;
  if (!syn.defining) {
    return { glyphs: "○", title: "Parallel fields", subtitle: "No major aspect crosses these charts.", label };
  }
  const d = syn.defining;
  return {
    glyphs: `${PLANET_GLYPHS[d.aPlanet]} ${ASPECT_GLYPHS[d.aspect]} ${PLANET_GLYPHS[d.bPlanet]}`,
    title: `${d.aPlanet} ${d.aspect} ${d.bPlanet}`,
    subtitle: ASPECT_CARD_LINES[d.aspect],
    label,
  };
}

function show(syn: SynastryModel, prose: string, nameA: string, nameB: string): void {
  $("results").style.display = "block";

  // Re-trigger the entrance animations on recompute.
  for (const id of ["field-a", "field-shared", "field-b"]) {
    const panel = $(id);
    const cls = panel.className;
    panel.className = "";
    void panel.offsetWidth;
    panel.className = cls;
  }
  $("field-a").innerHTML = renderArtwork(syn.a.model, 1000, 1250);
  $("field-b").innerHTML = renderArtwork(syn.b.model, 1000, 1250);
  $("field-shared").innerHTML = renderArtwork(syn.model, 1000, 1000);
  $("label-a").textContent = `${nameA}'s field`;
  $("label-b").textContent = `${nameB}'s field`;

  const meta = cardMeta(syn, nameA, nameB);
  $("defining").innerHTML = `
    <div class="glyphs">${esc(meta.glyphs)}</div>
    <div class="name">${esc(meta.title.toUpperCase())}</div>
    <div class="line">${esc(meta.subtitle)}</div>`;
  $("strip").innerHTML = syn.model.palette.map((c) =>
    `<i style="background:${c.hex}" title="${esc(c.role)} ${c.hex}"></i>`).join("");

  // Names are user input (typed or arriving via the share hash) — they never
  // reach innerHTML unescaped.
  const firstA = esc(nameA.split(" ")[0]);
  const firstB = esc(nameB.split(" ")[0]);
  $("crossings").innerHTML = syn.crossAspects.slice(0, 6).map((x, i) => `
    <div class="inf${i === 0 ? " lead" : ""}">
      <span class="g">${PLANET_GLYPHS[x.aPlanet]} ${ASPECT_GLYPHS[x.aspect]} ${PLANET_GLYPHS[x.bPlanet]}</span>
      <span><b>${firstA}'s ${x.aPlanet} ${x.aspect} ${firstB}'s ${x.bPlanet}</b>
      <small>orb ${x.orb.toFixed(1)}°${i === 0 ? " · the defining meeting" : ""}</small></span>
    </div>`).join("") ||
    `<p class="sub">No major aspect crosses between these charts.</p>`;

  $("prose").innerHTML = prose.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("");
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

async function exportCard(format: CardFormat): Promise<Blob> {
  if (!current) throw new Error("no meeting computed yet");
  const { w, h } = CARD_DIMENSIONS[format];
  return svgToPngBlob(renderSocialCard(current.syn.model as ChromaticModel, current.meta, format), w, h);
}

(window as unknown as Record<string, unknown>).chromaticDebug = { exportCard };

// ── Share link ───────────────────────────────────────────────────────────────

function writeHash(a: BirthInput, b: BirthInput): void {
  const params = new URLSearchParams();
  const put = (prefix: "a" | "b", birth: BirthInput) => {
    params.set(`${prefix}d`, birth.date);
    params.set(`${prefix}t`, birth.time);
    params.set(`${prefix}lat`, String(birth.lat));
    params.set(`${prefix}lon`, String(birth.lon));
    params.set(`${prefix}o`, String(birth.utcOffset));
    const name = $<HTMLInputElement>(`${prefix}-name`).value.trim();
    if (name) params.set(`${prefix}n`, name);
    const place = $<HTMLInputElement>(`${prefix}-place`);
    if (place.value.trim()) params.set(`${prefix}p`, place.value.trim());
    if (place.dataset.tz) params.set(`${prefix}tz`, place.dataset.tz);
  };
  put("a", a);
  put("b", b);
  history.replaceState(null, "", `#${params.toString()}`);
}

function readHash(): boolean {
  if (!location.hash.slice(1)) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.get("ad") || !params.get("bd")) return false;
  for (const prefix of ["a", "b"] as const) {
    $<HTMLInputElement>(`${prefix}-date`).value = params.get(`${prefix}d`)!;
    $<HTMLInputElement>(`${prefix}-time`).value = params.get(`${prefix}t`) ?? "12:00";
    $<HTMLInputElement>(`${prefix}-lat`).value = params.get(`${prefix}lat`) ?? "";
    $<HTMLInputElement>(`${prefix}-lon`).value = params.get(`${prefix}lon`) ?? "";
    $<HTMLInputElement>(`${prefix}-offset`).value = params.get(`${prefix}o`) ?? "0";
    $<HTMLInputElement>(`${prefix}-name`).value = params.get(`${prefix}n`) ?? "";
    const place = $<HTMLInputElement>(`${prefix}-place`);
    place.value = params.get(`${prefix}p`) ?? "";
    if (params.get(`${prefix}tz`)) place.dataset.tz = params.get(`${prefix}tz`)!;
  }
  return true;
}

// ── Wiring ───────────────────────────────────────────────────────────────────

$("meet-form").addEventListener("submit", (e) => {
  e.preventDefault();
  void compute();
});
const onPlaceError = (message: string) => {
  const errorEl = $("error");
  errorEl.textContent = message;
  errorEl.hidden = false;
};
attachPlaceSearch("a", onPlaceError);
attachPlaceSearch("b", onPlaceError);

for (const format of ["square", "portrait", "story"] as const) {
  $(`dl-${format}`).addEventListener("click", () => {
    void exportCard(format).then((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `chromatic-meeting-${format}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    });
  });
}
$("copy-prose").addEventListener("click", async () => {
  if (!current) return;
  await navigator.clipboard.writeText(current.prose);
});
$("copy-link").addEventListener("click", async () => {
  if (!current) return;
  await navigator.clipboard.writeText(location.href);
});

if (readHash()) void compute();
