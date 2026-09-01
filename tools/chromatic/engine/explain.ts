// Structured explanation plus the prose interpretation. Everything stated
// here is read back out of the configs and the computed model — the copy layer
// arranges facts the engine already committed to, and invents nothing.

import type {
  ChromaticExplanation, ChromaticModel, DominantGeometry, PairScenario, PaletteColor,
} from "./types";
import type { ChromaticChart } from "./chart";
import { PLANET_PROFILES } from "./config/planets";
import { ASPECT_PROFILES } from "./config/aspects";
import { ELEMENT_PROFILES } from "./config/elements";
import { SIGN_ELEMENT, SIGN_MODIFIERS } from "./config/signs";

export function buildExplanation(
  scenario: PairScenario, strength: number,
  palette: PaletteColor[], geometry: DominantGeometry,
): ChromaticExplanation {
  const aspect = ASPECT_PROFILES[scenario.aspect];
  const placements = [scenario.a, scenario.b].sort((x, y) => y.weight - x.weight);

  const dominantFactors = placements.map((p) => ({
    factor: `${p.planet} in ${p.sign}`,
    strength: p.weight,
    visualEffects: [
      ...PLANET_PROFILES[p.planet].effects,
      ELEMENT_PROFILES[SIGN_ELEMENT[p.sign]].effects[0],
    ],
  }));
  dominantFactors.push({
    factor: `${scenario.a.planet} ${scenario.aspect} ${scenario.b.planet}`,
    strength,
    visualEffects: [aspect.relationship],
  });

  const keywords = new Set<string>();
  for (const p of placements) {
    for (const k of PLANET_PROFILES[p.planet].keywords.slice(0, 2)) keywords.add(k);
    keywords.add(ELEMENT_PROFILES[SIGN_ELEMENT[p.sign]].keywords[0]);
  }
  for (const k of aspect.keywords) keywords.add(k);

  return {
    dominantFactors,
    strongestAspect: {
      planets: [scenario.a.planet, scenario.b.planet],
      aspect: scenario.aspect,
      visualRelationship: aspect.relationship,
    },
    paletteStory: palette.map((c) => `${c.label} ${c.hex} (${c.role}): ${c.description}.`),
    compositionStory: compositionLines(geometry),
    visualKeywords: [...keywords].slice(0, 8),
  };
}

const GEOMETRY_LINES: Record<DominantGeometry, string[]> = {
  central: ["The composition gathers into one fused mass near the center."],
  polar: ["The frame splits into two facing fields, each holding its own pole."],
  crossing: ["Perpendicular bands cross the frame and fight over the overlap."],
  triadic: ["Three related fields circulate around the center."],
  patterned: ["A repeating motif carries the second color across the main field."],
  asymmetric: ["The second field sits displaced from the first, and the line between them never quite lands."],
  distributed: ["The aspect is too loose to organize the frame, so the fields distribute on their own."],
};

function compositionLines(geometry: DominantGeometry): string[] {
  return [...GEOMETRY_LINES[geometry]];
}

/**
 * The ~100–250 word interpretation for one pair. Assembled from the same
 * config phrases the engine computed with, so every claim is traceable.
 */
export function renderInterpretation(model: ChromaticModel, scenario: PairScenario): string {
  const lead = scenario.a.weight >= scenario.b.weight ? scenario.a : scenario.b;
  const other = lead === scenario.a ? scenario.b : scenario.a;
  const leadCfg = PLANET_PROFILES[lead.planet];
  const otherCfg = PLANET_PROFILES[other.planet];
  const aspectCfg = ASPECT_PROFILES[scenario.aspect];
  const strength = model.aspectStrength;

  const p1 = `${lead.planet} carries the most weight here: it ${leadCfg.effects[0]}. In ${lead.sign}, its pigment is ${SIGN_MODIFIERS[lead.sign].phrase}.`;

  let orbLine: string;
  if (strength > 0.8) {
    orbLine = `At ${scenario.orb.toFixed(1)}° the aspect is close to exact, so this relationship runs at nearly full strength.`;
  } else if (strength > 0.4) {
    orbLine = `At ${scenario.orb.toFixed(1)}° of an allowed ${aspectCfg.maxOrb}°, the relationship is clearly present without dominating.`;
  } else {
    orbLine = `At ${scenario.orb.toFixed(1)}° of an allowed ${aspectCfg.maxOrb}°, the tie is loose, and the two colors mostly keep to themselves.`;
  }
  const p2 = `The ${scenario.aspect} to ${other.planet} decides how the two colors meet. ${aspectCfg.relationship} ${other.planet}, for its part, ${otherCfg.effects[0]}, and ${other.sign} leaves that pigment ${SIGN_MODIFIERS[other.sign].phrase}. ${orbLine}`;

  const p3 = paletteParagraph(model);

  return [p1, p2, p3].join("\n\n");
}

function paletteParagraph(model: ChromaticModel): string {
  const dominant = model.palette.find((c) => c.role === "dominant");
  const accent = model.palette.find((c) => c.role === "accent");
  const disruptive = model.palette.find((c) => c.role === "disruptive");
  const bits: string[] = [...model.explanation.compositionStory];
  if (dominant) bits.push(`${dominant.label} (${dominant.hex}) leads the palette as ${dominant.description}.`);
  if (accent) bits.push(`The ${accent.label.toLowerCase()} accent is ${accent.description}.`);
  if (disruptive) bits.push(`${disruptive.label} arrives as ${disruptive.description}.`);
  return bits.join(" ");
}

/**
 * The whole-chart interpretation: emphasis first, then the defining
 * relationship, then what the palette and composition did about it.
 */
export function renderChartInterpretation(chart: ChromaticChart): string {
  const [first, second] = chart.placements;
  const firstCfg = PLANET_PROFILES[first.planet];
  const why = first.reasons.length ? ` (${first.reasons.join(", ")})` : "";
  const p1 = `The chart's visual weight settles on ${first.planet} in ${first.sign}${why}: it ${firstCfg.effects[0]}, and the sign leaves its pigment ${SIGN_MODIFIERS[first.sign].phrase}. ${second.planet} in ${second.sign} carries the next most weight, so it ${PLANET_PROFILES[second.planet].effects[0]}.`;

  let p2: string;
  if (chart.defining) {
    const d = chart.defining;
    const aspectCfg = ASPECT_PROFILES[d.aspect];
    const closeness = d.strength > 0.8
      ? `At ${d.orb.toFixed(1)}° it is close to exact and shapes most of what you see.`
      : d.strength > 0.4
        ? `At ${d.orb.toFixed(1)}° of an allowed ${aspectCfg.maxOrb}°, it organizes the image without dictating it.`
        : `At ${d.orb.toFixed(1)}° of an allowed ${aspectCfg.maxOrb}°, its influence is a murmur under the rest of the chart.`;
    p2 = `${d.a} ${d.aspect} ${d.b} is the defining chromatic relationship. ${aspectCfg.relationship} ${closeness}` +
      (chart.aspects.length > 1
        ? ` ${chart.aspects.length - 1} other aspect${chart.aspects.length === 2 ? "" : "s"} feed the overall profile without steering the composition.`
        : "");
  } else {
    p2 = "No two planets sit within orb of a major aspect, so no single relationship organizes the frame; the fields distribute, and the palette holds together on chart emphasis alone.";
  }

  return [p1, p2, paletteParagraph(chart.model)].join("\n\n");
}
