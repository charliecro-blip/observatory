// Synastry: what happens when two chromatic fields meet. Each person keeps
// their own natal model; the aspects that cross between the charts decide how
// the shared field behaves — trines circulate the two palettes, oppositions
// intensify them against each other, squares hold hard boundaries,
// conjunctions fuse pigment, quincunxes leave the mixture strange. The
// strongest cross-aspect supplies the shared field's two lead pigments and
// its geometry; both charts' full influence sets, at half mass each, temper
// the rest.
//
// Pure module, same rules as everything else: same two charts, same shared
// field, every time.

import {
  ASPECTS,
  type AspectName, type ChromaticModel, type Influence, type Planet, type Sign,
} from "./types";
import { buildChartModel, type ChromaticChart, type NatalInput } from "./chart";
import { combineInfluences } from "./combine";
import { ASPECT_PROFILES } from "./config/aspects";
import { PLANET_PROFILES } from "./config/planets";
import { SIGN_MODIFIERS } from "./config/signs";
import { DEFAULT_WEIGHTS, type EmphasisWeights } from "./config/weights";
import { generatePalette } from "./palette";
import { deriveComposition } from "./composition";
import { hashString, makeRng } from "./seed";

export interface CrossAspect {
  aPlanet: Planet;
  aSign: Sign;
  bPlanet: Planet;
  bSign: Sign;
  aspect: AspectName;
  orb: number;
  strength: number;
  score: number; // strength × mean of the two placements' effective weights
}

export interface SynastryModel {
  a: ChromaticChart;
  b: ChromaticChart;
  crossAspects: CrossAspect[]; // ranked
  defining: CrossAspect | null;
  model: ChromaticModel;       // the shared field
  lines: string[];             // one line per active cross-aspect
}

function separation(lonA: number, lonB: number): number {
  const d = Math.abs(lonA - lonB) % 360;
  return d > 180 ? 360 - d : d;
}

export function findCrossAspects(a: NatalInput, b: NatalInput): Array<Omit<CrossAspect, "score">> {
  const out: Array<Omit<CrossAspect, "score">> = [];
  for (const pa of a.planets) {
    for (const pb of b.planets) {
      const sep = separation(pa.longitude, pb.longitude);
      for (const name of ASPECTS) {
        const spec = ASPECT_PROFILES[name];
        const orb = Math.abs(sep - spec.angle);
        if (orb <= spec.maxOrb) {
          out.push({
            aPlanet: pa.planet, aSign: pa.sign,
            bPlanet: pb.planet, bSign: pb.sign,
            aspect: name, orb, strength: 1 - orb / spec.maxOrb,
          });
          break;
        }
      }
    }
  }
  return out;
}

// How each aspect lets the two palettes meet — copy for lines and cards.
const MEETING_LINES: Record<AspectName, string> = {
  conjunction: "the two pigments fuse where they touch",
  opposition: "the two palettes face each other and intensify",
  square: "the two palettes hold hard boundaries against each other",
  trine: "the two palettes circulate into each other",
  sextile: "one palette keeps answering the other",
  quincunx: "the mixture stays strange, never quite resolving",
};

export function buildSynastryModel(
  natalA: NatalInput,
  natalB: NatalInput,
  weights: EmphasisWeights = DEFAULT_WEIGHTS,
): SynastryModel {
  const a = buildChartModel(natalA, 0, weights);
  const b = buildChartModel(natalB, 0, weights);
  const effA = new Map(a.placements.map((p) => [p.planet, p]));
  const effB = new Map(b.placements.map((p) => [p.planet, p]));

  const crossAspects: CrossAspect[] = findCrossAspects(natalA, natalB)
    .map((x) => ({
      ...x,
      score: x.strength * ((effA.get(x.aPlanet)!.effective + effB.get(x.bPlanet)!.effective) / 2),
    }))
    .sort((x, y) => y.score - x.score);
  const defining = crossAspects[0] ?? null;
  const active = crossAspects.slice(0, weights.synastryAspectCount);

  // The shared field's profile: both charts at half mass, plus the meetings.
  const influences: Influence[] = [
    ...a.model.influences.map((i) => ({ ...i, weight: i.weight * 0.5 })),
    ...b.model.influences.map((i) => ({ ...i, weight: i.weight * 0.5 })),
  ];
  for (const x of active) {
    influences.push({
      source: `${x.aPlanet} ${x.aspect} ${x.bPlanet} (cross)`,
      weight: x.strength * weights.synastryInfluence,
      deltas: ASPECT_PROFILES[x.aspect].deltas,
    });
  }
  const profile = combineInfluences(influences);

  const seed = hashString(`${a.model.seed}|meets|${b.model.seed}`);
  const scenario = defining
    ? {
        a: { planet: defining.aPlanet, sign: defining.aSign, weight: effA.get(defining.aPlanet)!.weight },
        b: { planet: defining.bPlanet, sign: defining.bSign, weight: effB.get(defining.bPlanet)!.weight },
        aspect: defining.aspect, orb: defining.orb, variationSeed: 0,
      }
    : {
        // No aspect crosses the charts: the two dominants sit side by side at
        // zero strength and the geometry distributes. An honest non-meeting.
        a: { planet: a.placements[0].planet, sign: a.placements[0].sign, weight: a.placements[0].weight },
        b: { planet: b.placements[0].planet, sign: b.placements[0].sign, weight: b.placements[0].weight },
        aspect: "conjunction" as AspectName, orb: ASPECT_PROFILES.conjunction.maxOrb, variationSeed: 0,
      };
  const strength = defining ? defining.strength : 0;
  const palette = generatePalette(scenario, profile, strength, makeRng(seed ^ 0x9e3779b9));
  const composition = deriveComposition(profile, scenario.aspect, strength);

  const lines = active.map((x) =>
    `${x.aPlanet} in ${x.aSign} ${x.aspect} ${x.bPlanet} in ${x.bSign} (orb ${x.orb.toFixed(1)}°): ${MEETING_LINES[x.aspect]}.`);

  const model: ChromaticModel = {
    profile,
    palette,
    composition,
    explanation: {
      dominantFactors: [],
      strongestAspect: defining
        ? { planets: [defining.aPlanet, defining.bPlanet], aspect: defining.aspect, visualRelationship: ASPECT_PROFILES[defining.aspect].relationship }
        : undefined,
      paletteStory: palette.map((c) => `${c.label} ${c.hex} (${c.role}): ${c.description}.`),
      compositionStory: [MEETING_LINES[scenario.aspect].charAt(0).toUpperCase() + MEETING_LINES[scenario.aspect].slice(1) + "."],
      visualKeywords: ASPECT_PROFILES[scenario.aspect].keywords.slice(),
    },
    influences,
    aspectStrength: strength,
    seed,
  };

  return { a, b, crossAspects, defining, model, lines };
}

/** The meeting's interpretation: each field in brief, then what crosses. */
export function renderSynastryInterpretation(
  syn: SynastryModel, nameA: string, nameB: string,
): string {
  const fieldLine = (chart: ChromaticChart, name: string) => {
    const top = chart.placements[0];
    return `${name}'s field leans on ${top.planet} in ${top.sign}: it ${clause(PLANET_PROFILES[top.planet].effects[0])}, with the pigment ${SIGN_MODIFIERS[top.sign].phrase}.`;
  };
  const p1 = `${fieldLine(syn.a, nameA)} ${fieldLine(syn.b, nameB)}`;

  let p2: string;
  if (syn.defining) {
    const d = syn.defining;
    const closeness = d.strength > 0.8
      ? "Nearly exact, it decides most of what the shared field does."
      : d.strength > 0.4
        ? "It organizes the shared field without dictating it."
        : "It murmurs under the shared field rather than steering it.";
    p2 = `Where the charts cross, ${nameA}'s ${d.aPlanet} ${verbFor(d.aspect)} ${nameB}'s ${d.bPlanet} at ${d.orb.toFixed(1)}°, and ${MEETING_LINES[d.aspect]}. ${closeness}` +
      (syn.crossAspects.length > 1
        ? ` ${syn.crossAspects.length - 1} other cross-aspect${syn.crossAspects.length === 2 ? "" : "s"} color the field around it.`
        : "");
  } else {
    p2 = `No major aspect crosses between these charts, so the two fields sit side by side without a defining meeting; the shared palette blends emphasis alone.`;
  }

  const dom = syn.model.palette.find((c) => c.role === "dominant");
  const sec = syn.model.palette.find((c) => c.role === "secondary");
  const p3 = dom && sec
    ? `In the shared field, ${dom.label.toLowerCase()} (${dom.hex}) meets ${sec.label.toLowerCase()} (${sec.hex}); ${syn.model.explanation.compositionStory[0].charAt(0).toLowerCase()}${syn.model.explanation.compositionStory[0].slice(1)}`
    : syn.model.explanation.compositionStory[0];

  return [p1, p2, p3].join("\n\n");
}

const clause = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function verbFor(aspect: AspectName): string {
  switch (aspect) {
    case "conjunction": return "sits on";
    case "opposition": return "faces";
    case "square": return "squares";
    case "trine": return "trines";
    case "sextile": return "sextiles";
    default: return "sits at odds with";
  }
}
