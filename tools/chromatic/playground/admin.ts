// Admin content generator: pick a factor, get the structured content bundle
// and the share card, each section one copy-button away.

import { ASPECTS, PLANETS, SIGNS, type AspectName, type PairScenario, type Planet, type Sign } from "../engine/types";
import { ASPECT_PROFILES } from "../engine/config/aspects";
import { DEFAULT_WEIGHTS } from "../engine/config/weights";
import { buildPairModel } from "../engine/pair";
import { buildPlacementModel } from "../engine/placement";
import { generatePairContent, generatePlacementContent, type ContentBundle } from "../engine/content";
import { renderSocialCard } from "../engine/social";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const state = {
  mode: "pair" as "pair" | "placement",
  aPlanet: "Venus" as Planet, aSign: "Libra" as Sign,
  bPlanet: "Uranus" as Planet, bSign: "Capricorn" as Sign,
  aspect: "square" as AspectName, orb: 1.2,
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fillSelect(id: string, options: readonly string[], value: string): void {
  $<HTMLSelectElement>(id).innerHTML = options.map((o) =>
    `<option value="${o}"${o === value ? " selected" : ""}>${o}</option>`).join("");
}

function scenario(): PairScenario {
  return {
    a: { planet: state.aPlanet, sign: state.aSign, weight: DEFAULT_WEIGHTS.base[state.aPlanet] },
    b: { planet: state.bPlanet, sign: state.bSign, weight: DEFAULT_WEIGHTS.base[state.bPlanet] },
    aspect: state.aspect, orb: state.orb, variationSeed: 0,
  };
}

/** Plain-text version of a section, for the copy buttons. */
function sectionText(bundle: ContentBundle, key: string): string {
  switch (key) {
    case "hook": return bundle.hook;
    case "thesis": return bundle.thesis;
    case "visual": return bundle.visualInstructions;
    case "reel": return bundle.reelScript.map((b) => `[${b.at}] ${b.line}`).join("\n");
    case "carousel": return bundle.carousel.map((s, i) => `${i + 1}. ${s.heading} — ${s.body}`).join("\n");
    default: return bundle.caption;
  }
}

function render(): void {
  let model;
  let bundle: ContentBundle;
  if (state.mode === "placement") {
    const placement = { planet: state.aPlanet, sign: state.aSign, weight: DEFAULT_WEIGHTS.base[state.aPlanet] };
    model = buildPlacementModel(placement);
    bundle = generatePlacementContent(placement, model);
  } else {
    const s = scenario();
    model = buildPairModel(s);
    bundle = generatePairContent(s, model);
  }

  $("pair-only").style.display = state.mode === "pair" ? "flex" : "none";
  $("card").innerHTML = renderSocialCard(model, bundle.cardMeta, "portrait");
  $("orbOut").textContent = `${state.orb.toFixed(1)}° / ${ASPECT_PROFILES[state.aspect].maxOrb}°`;

  const block = (key: string, title: string, body: string) => `
    <div class="block">
      <div class="block-head"><h2>${title}</h2><button data-copy="${key}">Copy</button></div>
      ${body}
    </div>`;

  $("blocks").innerHTML = [
    block("hook", "Hook", `<p>${esc(bundle.hook)}</p>`),
    block("thesis", "Core thesis", `<p>${esc(bundle.thesis)}</p>`),
    block("visual", "Visual instructions", `<p>${esc(bundle.visualInstructions)}</p>`),
    block("reel", "Reel script", `<div class="beats">${bundle.reelScript.map((b) =>
      `<div class="beat"><span class="at">${b.at}</span><span>${esc(b.line)}</span></div>`).join("")}</div>`),
    block("carousel", "Carousel", `<div class="slides">${bundle.carousel.map((sl, i) =>
      `<div class="slide"><span class="n">${i + 1}</span><span><b>${esc(sl.heading)}</b><small>${esc(sl.body)}</small></span></div>`).join("")}</div>`),
    block("caption", "Caption", `<p class="caption-text">${esc(bundle.caption)}</p>`),
  ].join("");

  for (const btn of $("blocks").querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(sectionText(bundle, btn.dataset.copy!));
      const prior = btn.textContent;
      btn.textContent = "Copied.";
      setTimeout(() => { btn.textContent = prior; }, 1200);
    });
  }
}

$<HTMLSelectElement>("mode").addEventListener("change", (e) => {
  state.mode = (e.target as HTMLSelectElement).value as "pair" | "placement";
  render();
});
fillSelect("aPlanet", PLANETS, state.aPlanet);
fillSelect("aSign", SIGNS, state.aSign);
fillSelect("bPlanet", PLANETS, state.bPlanet);
fillSelect("bSign", SIGNS, state.bSign);
fillSelect("aspect", ASPECTS, state.aspect);

$<HTMLSelectElement>("aPlanet").addEventListener("change", (e) => { state.aPlanet = (e.target as HTMLSelectElement).value as Planet; render(); });
$<HTMLSelectElement>("aSign").addEventListener("change", (e) => { state.aSign = (e.target as HTMLSelectElement).value as Sign; render(); });
$<HTMLSelectElement>("bPlanet").addEventListener("change", (e) => { state.bPlanet = (e.target as HTMLSelectElement).value as Planet; render(); });
$<HTMLSelectElement>("bSign").addEventListener("change", (e) => { state.bSign = (e.target as HTMLSelectElement).value as Sign; render(); });
$<HTMLSelectElement>("aspect").addEventListener("change", (e) => {
  state.aspect = (e.target as HTMLSelectElement).value as AspectName;
  const max = ASPECT_PROFILES[state.aspect].maxOrb;
  state.orb = Math.min(state.orb, max);
  $<HTMLInputElement>("orb").max = String(max);
  $<HTMLInputElement>("orb").value = String(state.orb);
  render();
});
$<HTMLInputElement>("orb").addEventListener("input", (e) => { state.orb = parseFloat((e.target as HTMLInputElement).value); render(); });

$<HTMLInputElement>("orb").max = String(ASPECT_PROFILES[state.aspect].maxOrb);
render();
