// The composite temperament method — the eleven-factor weighted calculation
// documented in knowledge/medical-astrology-v1/05_temperament_and_constitution.md
// and tabulated in appendices/C_tables.md §6.
//
// The KB calls this file's subject "the engine room" of the Natal Blueprint.
// It was never built. The deleted blueprint route asked gpt-4o for a
// "constitutional type from Ascendant, chart ruler, and sect" and let the model
// decide — which is the one thing the method exists to prevent, since its whole
// premise is that no single factor determines temperament.
//
// Scoring model: each factor contributes its full weight to one thermal
// quality (hot or cold) and one humidal quality (wet or dry). The four
// accumulators therefore sum to twice the total weight — matching both the
// KB's "approximately 56 points" and its Haley worked example, which totals
// Hot 16 + Wet 20 + Cold 12 + Dry 8 = 56.

import {
  emptyTally, planetQualities, SIGN_QUALITIES, MOON_QUARTER_QUALITIES,
  SEASON_QUALITIES, PHASE_QUALITIES, TEMPERAMENT_PROFILE,
  type Tally, type Quality, type QualityPair, type Sign, type Temperament,
} from "./qualities";
import type { MateriaChart } from "./chart";

export interface Factor {
  n: number;
  name: string;
  weight: number;
  detail: string;              // what in the chart produced this
  pair: QualityPair | null;    // null = the factor could not be scored
  note?: string;               // interpretation flag, shown in method notes
}

export interface CombinationTotals {
  sanguine: number;     // hot + wet
  choleric: number;     // hot + dry
  melancholic: number;  // cold + dry
  phlegmatic: number;   // cold + wet
}

export interface Clarity {
  combinationGap: number;        // absolute
  combinationThreshold: number;  // 20% of the highest
  combinationClear: boolean;
  thermalGap: number;            // as a fraction of the dominant
  thermalClear: boolean;
  humidalGap: number;
  humidalClear: boolean;
  resolved: boolean;             // both checks cleared → name a temperament
}

export interface TemperamentReading {
  factors: Factor[];
  tally: Tally;
  totalWeight: number;
  combinations: CombinationTotals;
  ranked: Array<{ temperament: Temperament; score: number }>;
  dominantThermal: "hot" | "cold";
  dominantHumidal: "wet" | "dry";
  clarity: Clarity;
  /** Named only when clarity gating passes. */
  named: Temperament | null;
  secondary: Temperament;
  /** The one-line verdict, phrased for whichever gate outcome applies. */
  verdict: string;
  methodNotes: string[];
}

const COMBO_THRESHOLD = 0.20;   // C_tables §6
const AXIS_THRESHOLD = 0.30;

export function computeTemperament(chart: MateriaChart): TemperamentReading {
  const { natal, ascRuler, ascRulerPlacement } = chart;
  const factors: Factor[] = [];
  const methodNotes: string[] = [];

  // Mercury is "convertible" (C_tables §1): it takes the qualities of what it
  // is joined to. Gather its classical contacts once so every factor that
  // might score Mercury resolves it the same way.
  const mercuryContacts = chart.aspects
    .filter(a => a.a === "Mercury" || a.b === "Mercury")
    .map(a => ({ planet: a.a === "Mercury" ? a.b : a.a, orb: a.orb }));

  const qualitiesFor = (planet: string) => planetQualities(planet, mercuryContacts);

  // ── 1. Ascendant sign — weight 4 ───────────────────────────────────────────
  const ascSign = natal.ascendant.sign as Sign;
  factors.push({
    n: 1, name: "Ascendant sign", weight: 4,
    detail: `${ascSign} rising at ${natal.ascendant.degree.toFixed(1)}°`,
    pair: SIGN_QUALITIES[ascSign],
  });

  // ── 2. Other planets in the 1st house — 2 each ─────────────────────────────
  if (chart.planetsInFirst.length === 0) {
    factors.push({
      n: 2, name: "Planets in the 1st house", weight: 0,
      detail: "none of the classical seven occupy the 1st house",
      pair: null,
    });
  } else {
    for (const p of chart.planetsInFirst) {
      const q = qualitiesFor(p.planet);
      factors.push({
        n: 2, name: `${p.planet} in the 1st house`, weight: 2,
        detail: `${p.planet} in ${p.sign} ${p.degree.toFixed(1)}°`,
        pair: q?.pair ?? null, note: q?.note,
      });
    }
  }

  // ── 3. Ascendant ruler — sign quality — weight 3 ────────────────────────────
  factors.push({
    n: 3, name: "Ascendant ruler by sign", weight: 3,
    detail: `${ascRuler} (lord of ${ascSign}) in ${ascRulerPlacement.sign} ${ascRulerPlacement.degree.toFixed(1)}°, house ${ascRulerPlacement.houseNumber}`,
    pair: SIGN_QUALITIES[ascRulerPlacement.sign as Sign],
  });

  // ── 4. Ascendant ruler — phase — weight 1 ──────────────────────────────────
  factors.push({
    n: 4, name: "Ascendant ruler by solar phase", weight: 1,
    detail: `${ascRuler} is ${chart.ascRulerPhase} — ${chart.ascRulerPhase === "oriental" ? "risen before the Sun, its increasing phase" : "setting after the Sun, its declining phase"}`,
    pair: PHASE_QUALITIES[chart.ascRulerPhase],
    note: "phase read as oriental/occidental — see method notes",
  });
  methodNotes.push(
    "**Factor 4 (weight 1) is an interpretation.** Part V names it \"Ascendant ruler — modality/phase\" and glosses it \"(cardinal/fixed/mutable, or angular/succedent/cadent)\". Neither gloss maps onto Hot/Wet/Cold/Dry in any traditional source — modality and house strength are not qualitative doctrines — so scoring either would be invention. This engine reads \"phase\" as the classical oriental/occidental distinction (Ptolemy III.11), which is qualitative and computable. It is the smallest weight in the method, so the reading barely moves either way. Appendix D question 30 is the place to rule on it.",
  );

  // ── 5. Planets aspecting the Ascendant — 1 each ────────────────────────────
  if (chart.aspectsToAsc.length === 0) {
    factors.push({ n: 5, name: "Planets aspecting the Ascendant", weight: 0, detail: "none within orb", pair: null });
  } else {
    for (const a of chart.aspectsToAsc) {
      const q = qualitiesFor(a.planet);
      factors.push({
        n: 5, name: `${a.planet} ${a.name} Ascendant`, weight: 1,
        detail: `${a.orb.toFixed(1)}° orb`,
        pair: q?.pair ?? null, note: q?.note,
      });
    }
  }

  // ── 6. Moon sign — weight 3 ────────────────────────────────────────────────
  const moon = natal.planets.find(p => p.planet === "Moon")!;
  factors.push({
    n: 6, name: "Moon by sign", weight: 3,
    detail: `Moon in ${moon.sign} ${moon.degree.toFixed(1)}°, house ${moon.houseNumber}`,
    pair: SIGN_QUALITIES[moon.sign as Sign],
  });

  // ── 7. Moon phase — weight 2 ───────────────────────────────────────────────
  factors.push({
    n: 7, name: "Moon phase", weight: 2,
    detail: `${chart.moonQuarter} — ${chart.moonElongation.toFixed(1)}° from the Sun`,
    pair: MOON_QUARTER_QUALITIES[chart.moonQuarter],
    note: "Ptolemaic quartering — see method notes",
  });
  methodNotes.push(
    "**Factor 7 uses the Ptolemaic quartering.** Part V describes this factor in a sentence that contradicts itself — \"Waxing Moon → Hot+Wet; waning → Cold+Dry; New → Hot+Wet; Full → Hot+Wet\" puts three of four quarters on the same qualities, which cannot be a scoring scheme. Implemented instead is Tetrabiblos I.8, where each quarter takes the qualities of the matching season: waxing crescent hot-wet, waxing gibbous hot-dry, waning gibbous cold-dry, waning crescent cold-wet. This is the scheme Greenbaum uses, which is what Part V says it is deriving from. Appendix D question 36 (four-phase vs. eight-phase) is still open.",
  );

  // ── 8. Planets aspecting the Moon — 1 each ─────────────────────────────────
  if (chart.aspectsToMoon.length === 0) {
    factors.push({ n: 8, name: "Planets aspecting the Moon", weight: 0, detail: "none within orb", pair: null });
  } else {
    for (const a of chart.aspectsToMoon) {
      const q = qualitiesFor(a.planet);
      factors.push({
        n: 8, name: `${a.planet} ${a.name} Moon`, weight: 1,
        detail: `${a.orb.toFixed(1)}° orb`,
        pair: q?.pair ?? null, note: q?.note,
      });
    }
  }

  // ── 9. Season of birth — weight 2 ──────────────────────────────────────────
  factors.push({
    n: 9, name: "Season of birth", weight: 2,
    detail: `${chart.season}${chart.birth.lat < 0 ? " (southern hemisphere — season inverted from the northern convention)" : ""}`,
    pair: SEASON_QUALITIES[chart.season],
  });

  // ── 10. Lord of the Geniture — weight 2 ────────────────────────────────────
  const lordQ = qualitiesFor(chart.lord.planet);
  factors.push({
    n: 10, name: "Lord of the Geniture", weight: 2,
    detail: `${chart.lord.planet} at ${chart.lord.total} dignity points${chart.lord.clear ? "" : ` — narrowly over ${chart.lord.runnerUp.planet} at ${chart.lord.runnerUp.total}`}`,
    pair: lordQ?.pair ?? null, note: lordQ?.note,
  });
  if (!chart.lord.clear) {
    methodNotes.push(
      `**The Lord of the Geniture is not clear-cut.** ${chart.lord.planet} (${chart.lord.total}) leads ${chart.lord.runnerUp.planet} (${chart.lord.runnerUp.total}) by ${chart.lord.total - chart.lord.runnerUp.total} point${chart.lord.total - chart.lord.runnerUp.total === 1 ? "" : "s"}. Lilly's full procedure weighs testimonies this engine cannot honestly reproduce, so treat factor 10 as the weaker of the two dignity factors in this chart.`,
    );
  }

  // ── 11. Almuten of the Ascendant — weight 2 ────────────────────────────────
  if (chart.almuten.tied) {
    // A tie is real testimony, not a defect. Split the weight rather than
    // picking a winner the degree does not actually name.
    const share = 2 / chart.almuten.winners.length;
    for (const w of chart.almuten.winners) {
      const q = qualitiesFor(w);
      factors.push({
        n: 11, name: `Almuten of the Ascendant (${w}, tied)`, weight: share,
        detail: `${w} ties at ${chart.almuten.scores[0].score} points on the Ascendant degree`,
        pair: q?.pair ?? null, note: q?.note,
      });
    }
    methodNotes.push(
      `**The almuten of the Ascendant is tied** between ${chart.almuten.winners.join(" and ")} at ${chart.almuten.scores[0].score} points each. Factor 11's weight of 2 is split evenly rather than resolved by tiebreak — the Ascendant degree genuinely does not name one lord.`,
    );
  } else {
    const w = chart.almuten.winners[0];
    const q = qualitiesFor(w);
    factors.push({
      n: 11, name: "Almuten of the Ascendant", weight: 2,
      detail: `${w} at ${chart.almuten.scores[0].score} points on the Ascendant degree (${chart.almuten.scores[0].dignities.join(", ") || "no dignity — weakest possible almuten"})`,
      pair: q?.pair ?? null, note: q?.note,
    });
  }

  // ── Tally ──────────────────────────────────────────────────────────────────
  const tally: Tally = emptyTally();
  let totalWeight = 0;
  for (const f of factors) {
    if (!f.pair || f.weight === 0) continue;
    tally[f.pair.thermal] += f.weight;
    tally[f.pair.humidal] += f.weight;
    totalWeight += f.weight;
  }

  const combinations: CombinationTotals = {
    sanguine: tally.hot + tally.wet,
    choleric: tally.hot + tally.dry,
    melancholic: tally.cold + tally.dry,
    phlegmatic: tally.cold + tally.wet,
  };

  const ranked = (Object.entries(combinations) as Array<[Temperament, number]>)
    .map(([temperament, score]) => ({ temperament, score }))
    .sort((a, b) => b.score - a.score);

  const dominantThermal = tally.hot >= tally.cold ? "hot" : "cold";
  const dominantHumidal = tally.wet >= tally.dry ? "wet" : "dry";

  const gapFraction = (dom: number, opp: number) => (dom === 0 ? 0 : (dom - opp) / dom);
  const thermalGap = gapFraction(Math.max(tally.hot, tally.cold), Math.min(tally.hot, tally.cold));
  const humidalGap = gapFraction(Math.max(tally.wet, tally.dry), Math.min(tally.wet, tally.dry));
  const combinationGap = ranked[0].score - ranked[1].score;
  const combinationThreshold = ranked[0].score * COMBO_THRESHOLD;

  const clarity: Clarity = {
    combinationGap,
    combinationThreshold,
    combinationClear: combinationGap >= combinationThreshold,
    thermalGap, thermalClear: thermalGap >= AXIS_THRESHOLD,
    humidalGap, humidalClear: humidalGap >= AXIS_THRESHOLD,
    resolved: false,
  };
  // Part V: "When both thresholds are cleared, the temperament is named."
  clarity.resolved = clarity.combinationClear && clarity.thermalClear && clarity.humidalClear;

  const named = clarity.resolved ? ranked[0].temperament : null;
  const secondary = ranked[1].temperament;

  const verdict = buildVerdict(clarity, ranked, tally, dominantThermal, dominantHumidal);

  return {
    factors, tally, totalWeight, combinations, ranked,
    dominantThermal, dominantHumidal, clarity, named, secondary, verdict, methodNotes,
  };
}

const AXIS_WORD: Record<Quality, string> = {
  hot: "warm", cold: "cool", wet: "moist", dry: "dry",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "a, b and c" — an Oxford-less list, since these run inside sentences. */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function buildVerdict(
  clarity: Clarity,
  ranked: Array<{ temperament: Temperament; score: number }>,
  tally: Tally,
  thermal: "hot" | "cold",
  humidal: "wet" | "dry",
): string {
  const [first] = ranked;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  if (clarity.resolved) {
    const p = TEMPERAMENT_PROFILE[first.temperament];
    return `The chart resolves to **${first.temperament}** — ${p.qualities}, the ${p.element.toLowerCase()}-element register. It leads ${ranked[1].temperament} by ${clarity.combinationGap} points where ${clarity.combinationThreshold.toFixed(1)} was needed, and both quality axes clear their gates as well: ${AXIS_WORD[thermal]} over its opposite by ${pct(clarity.thermalGap)}, ${AXIS_WORD[humidal]} by ${pct(clarity.humidalGap)}. Both gates clearing is what the method treats as a chart being clear about its constitution, so the label is reported.`;
  }

  // Everything level with the runner-up is genuinely level. Reporting only the
  // second-ranked name would hide a three-way split behind a two-way one.
  const runnerScore = ranked[1].score;
  const runners = ranked.slice(1).filter(r => r.score === runnerScore).map(r => r.temperament);
  const contenders = [first.temperament, ...runners];

  const comboSentence = clarity.combinationClear
    ? `${cap(first.temperament)} leads the combination totals cleanly, by ${clarity.combinationGap} points over the ${clarity.combinationThreshold.toFixed(1)} needed.`
    : `${cap(list(contenders))} come in at ${list([`${first.score}`, ...runners.map(() => `${runnerScore}`)])} respectively, ${clarity.combinationGap === 0 ? "dead level" : `only ${clarity.combinationGap} apart`} where ${clarity.combinationThreshold.toFixed(1)} points would be needed to separate them.`;

  // Both axes mixed by the same margin is common enough that spelling it out
  // twice reads as a stutter rather than as two findings.
  const bothMixed = !clarity.thermalClear && !clarity.humidalClear;
  const sameGap = Math.abs(clarity.thermalGap - clarity.humidalGap) < 0.005;

  let axisSentence: string;
  if (bothMixed && sameGap) {
    axisSentence = `Both quality axes are as close: heat over cold ${tally.hot} to ${tally.cold}, moisture over dryness ${tally.wet} to ${tally.dry}, each a ${pct(clarity.thermalGap)} gap where 30% was the gate.`;
  } else if (bothMixed) {
    axisSentence = `Neither axis clears its gate either — heat against cold at ${tally.hot} to ${tally.cold} is a ${pct(clarity.thermalGap)} gap, moisture against dryness at ${tally.wet} to ${tally.dry} a ${pct(clarity.humidalGap)} one, both short of the 30% needed.`;
  } else {
    const clearAxis = clarity.thermalClear
      ? `${AXIS_WORD[thermal]} leads its opposite by ${pct(clarity.thermalGap)}, well past the 30% gate`
      : `${AXIS_WORD[humidal]} leads its opposite by ${pct(clarity.humidalGap)}, well past the 30% gate`;
    const mixedAxis = clarity.thermalClear
      ? `moisture and dryness sit at ${tally.wet} to ${tally.dry}, a ${pct(clarity.humidalGap)} gap`
      : `heat and cold sit at ${tally.hot} to ${tally.cold}, a ${pct(clarity.thermalGap)} gap`;
    axisSentence = `On the quality axes ${clearAxis}, while ${mixedAxis}.`;
  }

  const steadiness = clarity.thermalClear || clarity.humidalClear
    ? ` The ${clarity.thermalClear ? "warm/cool" : "moist/dry"} register is the dependable half of this reading; the other half moves.`
    : ` With both axes this close, the qualities themselves are what shift, and which one is forward at a given time is something the body reports rather than something the chart fixes.`;

  return `This chart does not resolve to a single temperament, and the reading names none. ${comboSentence} ${axisSentence} What the chart supports is a **mixed ${contenders.join("-")} constitution**.${steadiness} Read the quality totals below; they carry what the label cannot.`;
}
