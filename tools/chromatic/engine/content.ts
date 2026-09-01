// Educational-content generator: one astrological factor in, a structured
// bundle of social copy out — hook, thesis, visual instructions, reel script,
// carousel outline, caption. Everything is assembled from the same config
// phrases and computed palette the engine renders with, so the copy can never
// drift from what the artwork actually shows. An optional LLM pass may polish
// this language later; it must not invent the symbolism.

import type { ChromaticModel, PairScenario, Placement } from "./types";
import { PLANET_PROFILES } from "./config/planets";
import { ASPECT_PROFILES } from "./config/aspects";
import { ELEMENT_PROFILES } from "./config/elements";
import { MODALITY_PROFILES } from "./config/modalities";
import { SIGN_ELEMENT, SIGN_MODALITY, SIGN_MODIFIERS } from "./config/signs";
import { ASPECT_CARD_LINES, ASPECT_GLYPHS, PLANET_GLYPHS, type CardMeta } from "./social";

export interface CarouselSlide {
  heading: string;
  body: string;
}

export interface ContentBundle {
  hook: string;
  thesis: string;
  visualInstructions: string;
  reelScript: Array<{ at: string; line: string }>;
  carousel: CarouselSlide[];
  caption: string;
  cardMeta: CardMeta;
}

/** Lowercase a config effect clause for mid-sentence use. */
const clause = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function generatePairContent(scenario: PairScenario, model: ChromaticModel): ContentBundle {
  const { a, b, aspect } = scenario;
  const aCfg = PLANET_PROFILES[a.planet];
  const bCfg = PLANET_PROFILES[b.planet];
  const aspectCfg = ASPECT_PROFILES[aspect];
  const pairName = `${a.planet} ${aspect} ${b.planet}`;

  const bg = model.palette.find((c) => c.role === "background");
  const dom = model.palette.find((c) => c.role === "dominant");
  const sec = model.palette.find((c) => c.role === "secondary");
  const accent = model.palette.find((c) => c.role === "accent");
  const disruptive = model.palette.find((c) => c.role === "disruptive");

  const hook = `What does ${pairName} look like?`;

  const thesis =
    `${a.planet} ${clause(aCfg.effects[0])}, and ${b.planet} ${clause(bCfg.effects[0])}. ` +
    `${aspectCfg.relationship}`;

  const visualInstructions = [
    bg && dom ? `Ground the frame in ${bg.label.toLowerCase()} (${bg.hex}) and let ${dom.label.toLowerCase()} (${dom.hex}) lead.` : "",
    sec ? `${sec.label} (${sec.hex}) answers as ${sec.description}.` : "",
    accent ? `The ${accent.label.toLowerCase()} accent (${accent.hex}) is ${accent.description}.` : "",
    disruptive ? `${disruptive.label} (${disruptive.hex}) interrupts on purpose; keep it small and unmissable.` : "",
    `Composition follows the ${aspect}: ${model.explanation.compositionStory[0].toLowerCase()}`,
  ].filter(Boolean).join(" ");

  const reelScript = [
    { at: "0–3s", line: `${hook} Hold on the artwork.` },
    { at: "3–10s", line: `${a.planet} first: it ${clause(aCfg.effects[0])}.` },
    { at: "10–17s", line: `${b.planet} answers: it ${clause(bCfg.effects[0])}.` },
    { at: "17–30s", line: `The ${aspect} decides how they meet. ${aspectCfg.relationship}` },
    { at: "30–42s", line: dom && sec ? `Watch the palette carry it: ${dom.label.toLowerCase()} against ${sec.label.toLowerCase()}${disruptive ? `, with ${disruptive.label.toLowerCase()} as the interruption` : ""}.` : `Watch the palette carry it.` },
    { at: "42–50s", line: "Every chart draws this relationship differently. This is one of them." },
  ];

  const carousel: CarouselSlide[] = [
    { heading: `${PLANET_GLYPHS[a.planet]} ${ASPECT_GLYPHS[aspect]} ${PLANET_GLYPHS[b.planet]}`, body: hook },
    { heading: a.planet, body: `${aCfg.effects[0].charAt(0).toUpperCase()}${aCfg.effects[0].slice(1)}.` },
    { heading: b.planet, body: `${bCfg.effects[0].charAt(0).toUpperCase()}${bCfg.effects[0].slice(1)}.` },
    { heading: `The ${aspect}`, body: aspectCfg.relationship },
    { heading: "The palette", body: model.palette.slice(0, 5).map((c) => `${c.label} ${c.hex}`).join(" · ") },
    { heading: "The composition", body: model.explanation.compositionStory[0] },
    { heading: "Your version", body: "The same relationship in your chart draws with your signs, your weights, your orb." },
  ];

  const caption =
    `${hook}\n\n${thesis} In ${a.sign}, ${a.planet}'s pigment is ${SIGN_MODIFIERS[a.sign].phrase}; ` +
    `${b.sign} leaves ${b.planet}'s pigment ${SIGN_MODIFIERS[b.sign].phrase}. ` +
    `${dom && sec ? `Here that lands as ${dom.label.toLowerCase()} against ${sec.label.toLowerCase()}${accent ? ` with a ${accent.label.toLowerCase()} accent` : ""}. ` : ""}` +
    `The image is drawn by rule, so the same inputs always draw the same image; ` +
    `what changes between charts is the signs, the weights, and how tight the orb runs.`;

  return {
    hook,
    thesis,
    visualInstructions,
    reelScript,
    carousel,
    caption,
    cardMeta: {
      glyphs: `${PLANET_GLYPHS[a.planet]} ${ASPECT_GLYPHS[aspect]} ${PLANET_GLYPHS[b.planet]}`,
      title: pairName,
      subtitle: ASPECT_CARD_LINES[aspect],
    },
  };
}

/** Content for a single placement — the planet's portrait in a sign. */
export function generatePlacementContent(placement: Placement, model: ChromaticModel): ContentBundle {
  const { planet, sign } = placement;
  const planetCfg = PLANET_PROFILES[planet];
  const element = SIGN_ELEMENT[sign];
  const modality = SIGN_MODALITY[sign];
  const elCfg = ELEMENT_PROFILES[element];
  const modCfg = MODALITY_PROFILES[modality];
  const name = `${planet} in ${sign}`;

  const bg = model.palette.find((c) => c.role === "background");
  const dom = model.palette.find((c) => c.role === "dominant");
  const sec = model.palette.find((c) => c.role === "secondary");
  const accent = model.palette.find((c) => c.role === "accent");

  const hook = `What does ${name} look like?`;

  const thesis =
    `${planet} ${clause(planetCfg.effects[0])}. In ${sign}, that pigment is ${SIGN_MODIFIERS[sign].phrase}: ` +
    `${element} ${clause(elCfg.effects[0])}, while the ${modality} mode ${clause(modCfg.effects[0])}.`;

  const visualInstructions = [
    bg && dom ? `Ground the frame in ${bg.label.toLowerCase()} (${bg.hex}) and let ${dom.label.toLowerCase()} (${dom.hex}) lead.` : "",
    sec ? `${sec.label} (${sec.hex}) is ${sec.description}.` : "",
    accent ? `The ${accent.label.toLowerCase()} accent (${accent.hex}) is ${accent.description}.` : "",
    model.explanation.compositionStory[0],
  ].filter(Boolean).join(" ");

  const reelScript = [
    { at: "0–3s", line: `${hook} Hold on the artwork.` },
    { at: "3–12s", line: `${planet} on its own: it ${clause(planetCfg.effects[0])}.` },
    { at: "12–22s", line: `${sign} is ${element} and ${modality}, so the pigment ${clause(elCfg.effects[0])}.` },
    { at: "22–32s", line: model.explanation.compositionStory[0] },
    { at: "32–42s", line: dom && sec ? `The palette runs ${dom.label.toLowerCase()} against ${sec.label.toLowerCase()}, both faces of the same planet.` : "Watch the palette carry it." },
    { at: "42–50s", line: `Every chart places ${planet} somewhere. This is one of twelve rooms it can live in.` },
  ];

  const carousel: CarouselSlide[] = [
    { heading: PLANET_GLYPHS[planet], body: hook },
    { heading: planet, body: `${planetCfg.effects[0].charAt(0).toUpperCase()}${planetCfg.effects[0].slice(1)}.` },
    { heading: sign, body: `${element[0].toUpperCase()}${element.slice(1)} and ${modality}: the pigment is ${SIGN_MODIFIERS[sign].phrase}.` },
    { heading: "The palette", body: model.palette.slice(0, 5).map((c) => `${c.label} ${c.hex}`).join(" · ") },
    { heading: "The composition", body: model.explanation.compositionStory[0] },
    { heading: "In aspect", body: `Aspects change everything here: another planet can fuse with this pigment, face it, or cut across it.` },
    { heading: "Your version", body: `Where ${planet} sits in your chart decides which room this planet draws in.` },
  ];

  const caption =
    `${hook}\n\n${thesis} ` +
    `${dom && sec ? `Here that lands as ${dom.label.toLowerCase()} against ${sec.label.toLowerCase()}${accent ? ` with a ${accent.label.toLowerCase()} accent` : ""}. ` : ""}` +
    `The image is drawn by rule, so the same placement always draws the same image; ` +
    `what changes between charts is the sign, the weight the chart gives the planet, and the aspects that reach it.`;

  return {
    hook,
    thesis,
    visualInstructions,
    reelScript,
    carousel,
    caption,
    cardMeta: {
      glyphs: PLANET_GLYPHS[planet],
      title: name,
      subtitle: `It ${clause(planetCfg.effects[0])}.`,
    },
  };
}
