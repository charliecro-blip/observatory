// The significator layer — what the chart says about the body, computed.
//
// The medical houses with their lords in condition, the melothesic emphasis,
// the demanding and supportive testimony, and — the piece the deleted
// blueprint route could only beg an LLM for — the chart's actual internal
// contradictions, derived rather than requested.

import {
  MEDICAL_HOUSES, FULL_WEIGHT_HOUSES, SIGN_RULER, SIGN_BODY, PLANET_BODY,
  SIGN_QUALITIES, SIGN_ELEMENT, TCM_MAPPING, PLANET_REGISTER,
  CLASSICAL_SEVEN, type Sign, type Classical,
} from "./qualities";
import { strengthLabel } from "./chart";
import type { MateriaChart, PlanetDignity } from "./chart";

// ── Medical houses ───────────────────────────────────────────────────────────
export interface HouseReading {
  number: number;
  field: string;
  bodyByHouse: string;
  sign: Sign;
  bodyBySign: string;
  strength: string;
  weight: string;
  lord: Classical;
  lordPlacement: { sign: Sign; degree: number; house: number; retrograde: boolean };
  lordCondition: string;
  lordTotal: number;
  occupants: Array<{ planet: string; sign: string; degree: number; condition?: string }>;
}

export function readMedicalHouses(chart: MateriaChart, houses = FULL_WEIGHT_HOUSES): HouseReading[] {
  return houses.map((n) => {
    const meta = MEDICAL_HOUSES[n];
    const h = chart.natal.houses[n - 1];
    const sign = h.sign as Sign;
    const lord = SIGN_RULER[sign];
    const d = chart.byPlanet[lord];
    const occupants = chart.natal.planets
      .filter(p => p.houseNumber === n)
      .map(p => ({
        planet: p.planet, sign: p.sign, degree: p.degree,
        condition: chart.byPlanet[p.planet]?.condition,
      }));

    return {
      number: n, field: meta.field, bodyByHouse: meta.body,
      sign, bodyBySign: SIGN_BODY[sign],
      strength: meta.strength, weight: meta.weight,
      lord,
      lordPlacement: { sign: d.sign, degree: d.degree, house: d.house, retrograde: d.retrograde },
      lordCondition: d.condition, lordTotal: d.total,
      occupants,
    };
  });
}

// ── Melothesia ───────────────────────────────────────────────────────────────
// Which body regions the chart actually emphasises. Weighted so that the
// structural placements outrank mere occupancy: the KB is explicit that the
// Ascendant is the constitutional anchor and the 6th the classical house of
// sickness, and equally explicit (sign entries, passim) that a body region is
// a resonance to watch, never an organ to diagnose.
export interface MelothesiaHit {
  sign: Sign;
  region: string;
  score: number;
  reasons: string[];
}

export function readMelothesia(chart: MateriaChart): MelothesiaHit[] {
  const acc = new Map<Sign, { score: number; reasons: string[] }>();
  const add = (sign: Sign, score: number, reason: string) => {
    const e = acc.get(sign) ?? { score: 0, reasons: [] };
    e.score += score; e.reasons.push(reason);
    acc.set(sign, e);
  };

  const ascSign = chart.natal.ascendant.sign as Sign;
  add(ascSign, 5, "the Ascendant — the constitutional anchor and the body as a whole");

  const sixth = chart.natal.houses[5].sign as Sign;
  add(sixth, 4, "on the cusp of the 6th, the classical house of sickness and daily routine");

  const first = chart.natal.houses[0].sign as Sign;
  if (first !== ascSign) add(first, 2, "on the 1st-house cusp");

  for (const p of chart.natal.planets) {
    if (!(CLASSICAL_SEVEN as readonly string[]).includes(p.planet)) continue;
    const sign = p.sign as Sign;
    const d = chart.byPlanet[p.planet];
    const malefic = p.planet === "Mars" || p.planet === "Saturn";
    const debilitated = d.essential.dignities.some(x => ["detriment", "fall"].includes(x));

    // A malefic weights the region it sits in; a debilitated planet of any
    // kind weights it too, since the tradition reads a planet in poor
    // condition as straining the part it occupies.
    let w = 1;
    const why: string[] = [`${p.planet} in ${sign}`];
    if (malefic) { w += 2; why.push("a malefic"); }
    if (debilitated) { w += 1; why.push(`in ${d.essential.dignities.filter(x => ["detriment", "fall"].includes(x)).join(" and ")}`); }
    if (p.houseNumber === 1 || p.houseNumber === 6) { w += 1; why.push(`in the ${p.houseNumber === 1 ? "1st" : "6th"}`); }
    add(sign, w, why.join(", "));
  }

  return [...acc.entries()]
    .map(([sign, e]) => ({ sign, region: SIGN_BODY[sign], score: e.score, reasons: e.reasons }))
    .sort((a, b) => b.score - a.score);
}

// ── Testimony: demanding and supportive ──────────────────────────────────────
export interface Testimony {
  planet: Classical;
  role: "demanding" | "supportive";
  inSect: boolean | null;
  placement: string;
  condition: string;
  total: number;
  bodyRegion: string;
  aspectsToLuminaries: string[];
  reading: string;
}

export function readTestimony(chart: MateriaChart): Testimony[] {
  const build = (planet: Classical, role: "demanding" | "supportive"): Testimony => {
    const d = chart.byPlanet[planet];
    const inSect =
      role === "demanding" ? planet === chart.sect.malefic
      : planet === chart.sect.benefic;

    const aspects = chart.aspects
      .filter(a => (a.a === planet || a.b === planet))
      .filter(a => ["Sun", "Moon"].includes(a.a) || ["Sun", "Moon"].includes(a.b))
      .map(a => `${a.name} ${a.a === planet ? a.b : a.a} (${a.orb.toFixed(1)}°)`);

    // Judged on both registers. A net total alone calls a peregrine planet
    // with an ordinary house and direct motion "well-placed" purely on the
    // accidental points every such planet collects.
    const strength = strengthLabel(d.essential, d.accidental);
    const sectNote = role === "demanding"
      ? (inSect ? "in sect, the more tractable of the two" : "out of sect, traditionally the harder of the two to accommodate")
      : (inSect ? "in sect, which the tradition reads as the stronger of the two supports" : "out of sect");

    return {
      planet, role, inSect,
      placement: `${d.sign} ${d.degree.toFixed(1)}°, house ${d.house}${d.retrograde ? ", retrograde" : ""}`,
      condition: d.condition, total: d.total,
      bodyRegion: PLANET_BODY[planet].region,
      aspectsToLuminaries: aspects,
      reading: `It is ${strength} — essential ${d.essential.score >= 0 ? "+" : ""}${d.essential.score}, accidental ${d.accidental.score >= 0 ? "+" : ""}${d.accidental.score} — and ${sectNote}.`,
    };
  };

  return [
    build("Mars", "demanding"), build("Saturn", "demanding"),
    build("Venus", "supportive"), build("Jupiter", "supportive"),
  ];
}

// ── Contradictions and mixed testimony ───────────────────────────────────────
// Derived, not requested. The KB's first principles keep contradiction rather
// than resolving it (principle 6), and the deleted blueprint prompt spent nine
// lines instructing a model to find contradictions it had no data to find —
// it was sent no aspects and no dignities. These are computable.
export interface Contradiction {
  kind: string;
  statement: string;
  weight: "strong" | "moderate";
}

export function readContradictions(chart: MateriaChart): Contradiction[] {
  const out: Contradiction[] = [];
  const houses = readMedicalHouses(chart);
  const lordOf = new Map<Classical, number[]>();
  for (const h of houses) {
    lordOf.set(h.lord, [...(lordOf.get(h.lord) ?? []), h.number]);
  }

  // A single planet lording two or more full-weight medical houses.
  for (const [planet, nums] of lordOf) {
    if (nums.length < 2) continue;
    const d = chart.byPlanet[planet];
    out.push({
      kind: "Shared rulership",
      weight: "strong",
      statement: `${planet} rules ${NUMERAL[nums.length]} of the six full-weight medical houses — the ${nums.map(ordinal).join(" and the ")} — from ${d.sign} ${d.degree.toFixed(1)}° in house ${d.house}, ${d.condition}. That puts ${listOf(nums.map(n => SHORT_FIELD[n]))} on a single significator in a single condition. Whatever ${planet}'s condition says, it says about all of them at once, so these areas tend to move together rather than one at a time.`,
    });
  }

  // A benefic lording a house the tradition reads as difficult.
  for (const h of houses) {
    if (!["Venus", "Jupiter"].includes(h.lord)) continue;
    if (![6, 8, 12].includes(h.number)) continue;
    const d = chart.byPlanet[h.lord];
    out.push({
      kind: "A benefic on difficult ground",
      weight: "moderate",
      statement: `${h.lord}, one of the two supports, lords the ${ordinal(h.number)} — ${h.field} — from ${d.sign} ${d.degree.toFixed(1)}°, ${d.condition}. The ${ordinal(h.number)} is demanding ground in the tradition and its lord here is one of the two supports, which leaves the testimony split. Both halves hold — the difficulty is real, and so is the support.`,
    });
  }

  // A malefic in good essential condition.
  for (const planet of ["Mars", "Saturn"] as const) {
    const d = chart.byPlanet[planet];
    const strong = d.essential.dignities.filter(x => ["domicile", "exaltation", "triplicity"].includes(x));
    if (!strong.length) continue;
    out.push({
      kind: "A dignified malefic",
      weight: "strong",
      statement: `${planet} holds ${listOf(strong)} in ${d.sign}, which puts a demanding planet in good essential condition. Dignity organises a malefic rather than softening it, so ${planet} here works competently and on schedule. In the body's register that reads as ${planet === "Mars" ? "heat and drive that arrive on purpose rather than at random" : "constraint that holds a real structure rather than only limiting one"}. It is a placement to work with, and it still asks for more than an easy one would.`,
    });
  }

  // Essential dignity contradicted by circumstance.
  for (const d of chart.dignities) {
    const ess = d.essential.score, acc = d.accidental.score;
    if (ess >= 3 && acc <= -4) {
      out.push({
        kind: "Dignity against circumstance",
        weight: "moderate",
        statement: `${d.planet} is strong by sign — ${listOf(d.essential.dignities.filter(x => x !== "peregrine"))}, ${ess >= 0 ? "+" : ""}${ess} — and weak by circumstance at ${acc}, ${d.condition}. It holds the authority without the position, which the tradition reads as capacity waiting on an occasion to show itself.`,
      });
    }
  }

  // Essentially weak, accidentally prominent. Consolidated: peregrine is the
  // ordinary state of several planets in most charts, and direct motion clear
  // of the Sun's beams is worth +9 to any of them, so scored one at a time
  // this fires three or four times a chart and reads as four findings when it
  // is one pattern. Detriment and fall are reported separately below, since
  // those are a real debility rather than an absence of one.
  const loud = chart.dignities.filter(d =>
    d.essential.peregrine && d.accidental.score >= 10,
  );
  if (loud.length) {
    out.push({
      kind: loud.length > 1 ? "Prominence without dignity" : "Prominent without dignity",
      weight: "moderate",
      statement: `${listOf(loud.map(d => `${d.planet} (${d.sign}, house ${d.house}, accidental +${d.accidental.score})`))} ${loud.length > 1 ? "hold" : "holds"} no domicile, exaltation, triplicity, term or face, while sitting well by house and motion. Essential and accidental dignity are scored separately so that exactly this case can be read: ${loud.length > 1 ? "these planets speak" : "this planet speaks"} loudly in the chart from a weak foundation. Expect ${loud.length > 1 ? "their" : "its"} themes to come up often and behave inconsistently.`,
    });
  }

  const debilitated = chart.dignities.filter(d =>
    d.essential.dignities.some(x => x === "detriment" || x === "fall"),
  );
  for (const d of debilitated) {
    out.push({
      kind: "Essential debility",
      weight: "strong",
      statement: `${d.planet} is ${listOf(d.essential.dignities.filter(x => x === "detriment" || x === "fall").map(x => `in ${x}`))} in ${d.sign} at ${d.degree.toFixed(1)}°, essential ${d.essential.score}. The sign works against what the planet is for, which is a stronger claim than merely holding no dignity there. ${d.planet}'s themes in this chart tend to arrive through effort.`,
    });
  }

  // The Ascendant lord — the body's own significator — in poor condition.
  const ascLord = chart.byPlanet[chart.ascRuler];
  if (ascLord.total <= -5) {
    out.push({
      kind: "The body's own lord is poorly supported",
      weight: "strong",
      statement: `${chart.ascRuler}, lord of the Ascendant and so the significator of the body itself, totals ${ascLord.total} dignity points from ${ascLord.sign} ${ascLord.degree.toFixed(1)}° in house ${ascLord.house} — ${ascLord.condition}. The constitutional reading leans on this placement harder than on any other, and here it does not bear much weight. Where this chart and the lived body disagree, the body is the better witness.`,
    });
  }

  // The almuten and the Ascendant lord disagreeing about who runs the chart.
  const almutenWinner = chart.almuten.tied ? null : chart.almuten.winners[0];
  const claimants = new Set([chart.ascRuler, ...(almutenWinner ? [almutenWinner] : []), chart.lord.planet]);
  if (claimants.size > 1) {
    out.push({
      kind: "Three claims on the chart",
      weight: "moderate",
      statement: `The lord of the Ascendant is ${chart.ascRuler}; the almuten of the rising degree is ${chart.almuten.winners.join(" and ")}${chart.almuten.tied ? ", tied" : ""}; the Lord of the Geniture is ${chart.lord.planet}. These three need not agree and here they do not. Read ${chart.ascRuler} as the body's own significator, ${chart.almuten.winners.join(" and ")} as what holds the strongest claim on the rising degree itself, and ${chart.lord.planet} as the loudest voice in the chart taken whole.`,
    });
  }

  return out;
}

/** Short field labels for the shared-rulership line, where the full ones read as a run-on. */
const SHORT_FIELD: Record<number, string> = {
  1: "the body itself", 2: "nourishment", 6: "daily routine",
  7: "the practitioner", 8: "elimination", 10: "therapeutic direction",
};

const NUMERAL: Record<number, string> = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" };

function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Element and quality distribution ─────────────────────────────────────────
export interface Distribution {
  elements: Record<"fire" | "earth" | "air" | "water", { count: number; planets: string[] }>;
  dominantElement: string | null;
  lacking: string[];
}

export function readDistribution(chart: MateriaChart): Distribution {
  const elements: Distribution["elements"] = {
    fire: { count: 0, planets: [] }, earth: { count: 0, planets: [] },
    air: { count: 0, planets: [] }, water: { count: 0, planets: [] },
  };
  for (const p of chart.natal.planets) {
    if (!(CLASSICAL_SEVEN as readonly string[]).includes(p.planet)) continue;
    const el = SIGN_ELEMENT[p.sign as Sign];
    elements[el].count++;
    elements[el].planets.push(p.planet);
  }
  const ranked = (Object.entries(elements) as Array<[string, { count: number }]>)
    .sort((a, b) => b[1].count - a[1].count);
  // "Dominant" only when it actually leads — a 2/2/2/1 spread has no dominant.
  const dominantElement = ranked[0][1].count >= ranked[1][1].count + 2 ? ranked[0][0] : null;
  const lacking = ranked.filter(([, v]) => v.count === 0).map(([k]) => k);
  return { elements, dominantElement, lacking };
}

// ── Cross-tradition ──────────────────────────────────────────────────────────
export function readCrossTradition(chart: MateriaChart, planets: string[]): Array<{
  planet: string; element: string; strength: string; note: string;
}> {
  return planets
    .filter(p => TCM_MAPPING[p])
    .map(p => ({ planet: p, ...TCM_MAPPING[p] }));
}

export { PLANET_REGISTER, SIGN_QUALITIES };
