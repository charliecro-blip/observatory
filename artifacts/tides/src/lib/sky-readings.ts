import { SIGNS as LEXICON_SIGNS } from "../../../../lib/lexicon/src/signs";
import { PLANETS as LEXICON_PLANETS } from "../../../../lib/lexicon/src/planets";
// Composable readings for the sky's big moments.
//
// Design principles this file exists to serve:
//  1. Simple first — every reading opens with one plain sentence.
//  2. Depth on demand — fuller takes are available, never forced.
//  3. Multiple takes — the same aspect read from genuinely different angles,
//     because "Moon in Aquarius" means many things and the user should get to
//     turn the gem and see other facets.
//  4. Planets always carry their sign — "Saturn square Sun" hides half the
//     story; "Saturn in Aries square Sun in Cancer" is the actual weather.

export type AspectName = "conjunction" | "sextile" | "square" | "trine" | "opposition";

// ── How a sign colors any planet standing in it ──────────────────────────────

// From the lexicon — one voice for the sign everywhere.
export const SIGN_INFLECTION: Record<string, string> = Object.fromEntries(
  Object.values(LEXICON_SIGNS).map(e => [e.key, e.inflection]),
);

// ── What each planet fundamentally is ────────────────────────────────────────

export const PLANET_CORE: Record<string, { name: string; is: string; short: string; use: string }> = Object.fromEntries(
  Object.values(LEXICON_PLANETS).map(p => [p.key, p.core]),
);

// ── Aspect geometry, explained plainly (the concept layer) ───────────────────

export const ASPECT_GEOMETRY: Record<AspectName, { angle: string; symbol: string; word: string; explain: string }> = {
  conjunction: { angle: "0°",   symbol: "☌", word: "conjunction", explain: "The two planets stand at the same degree — their voices fuse into one. You don't observe this blend from outside; you feel it from inside, amplified." },
  sextile:     { angle: "60°",  symbol: "⚹", word: "sextile",     explain: "An open door between the two planets. The energies cooperate willingly — but only if you take the first step. Ignored, it passes quietly." },
  square:      { angle: "90°",  symbol: "□", word: "square",      explain: "The planets sit at right angles — each demanding exactly what the other blocks. Real tension that won't dissolve by waiting; channelled, it's the friction that builds things." },
  trine:       { angle: "120°", symbol: "△", word: "trine",       explain: "The planets flow in the same element — energy moves between them with no resistance. The gift is ease; the catch is that what comes easily can go unused." },
  opposition:  { angle: "180°", symbol: "☍", word: "opposition",  explain: "The planets face each other across the sky, each holding half of one whole. It's felt first as outer tension — a person, a circumstance — until you own both ends." },
};

// ── Three genuinely different framings per aspect type ───────────────────────
// These are the "takes" a user can cycle through. Each function receives both
// planets (with signs) and weaves a distinct lens: (1) the dynamic itself,
// (2) how the signs color it, (3) what to do about it.

interface AspectParty { planet: string; sign: string }

function core(p: string) { return PLANET_CORE[p] ?? { name: p, is: "its own drive", short: "its drive", use: "its own work" }; }
function inflect(s: string) { return SIGN_INFLECTION[s] ?? "in its own style"; }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function composeTakes(a: AspectParty, b: AspectParty, aspect: AspectName): { label: string; text: string }[] {
  const A = core(a.planet), B = core(b.planet);
  const styleA = inflect(a.sign), styleB = inflect(b.sign);

  switch (aspect) {
    case "square": return [
      { label: "The tension", text: `${cap(A.short)} and ${B.short} are pulling at right angles — each wants exactly what the other resists. In ${a.sign}, ${A.name} runs ${styleA}; in ${b.sign}, ${B.name} runs ${styleB}. Neither is wrong, and neither will simply yield. The friction is real and it's the point.` },
      { label: "The workout", text: `A square is the sky's gym: the resistance is the training. Right now the muscle being built is the one that can hold ${A.short} and ${B.short} at once without dropping either. People with this aspect natally tend to become formidable at exactly this — the transit gives everyone a short course in it.` },
      { label: "What to do", text: `Channel it into one concrete decision rather than letting it leak as irritation. ${B.name} in ${b.sign} favors ${B.use}; ${A.name} in ${a.sign} favors ${A.use}. Pick a task that honors both and the pressure converts to momentum. Left unnamed, it tends to find a target — usually the nearest person.` },
    ];
    case "conjunction": return [
      { label: "The fusion", text: `${A.name} and ${B.name} stand at the same degree in ${a.sign} — ${A.short} and ${B.short} speak with one amplified voice, colored ${styleA}. You don't watch this blend from outside; it feels like your own mood, only more so.` },
      { label: "The charge", text: `Conjunctions are potency without perspective. Whatever these two planets govern is turned up — which is genuinely powerful and genuinely hard to be objective about. If today feels unusually charged in this direction, that's not your imagination; it's the weather.` },
      { label: "What to do", text: `Point it deliberately. This blend rewards ${A.use} fused with ${B.use} — aimed at something chosen, it's a gift. Unaimed, the same voltage tends to discharge as restlessness or overreach. Choose the target before the energy chooses one for you.` },
    ];
    case "opposition": return [
      { label: "The seesaw", text: `${A.name} in ${a.sign} and ${B.name} in ${b.sign} face each other across the whole sky — ${A.short} on one end, ${B.short} on the other. Lean fully into either and the other end rises to meet you, often wearing someone else's face.` },
      { label: "The mirror", text: `Oppositions tend to be felt as other people: someone in your day is carrying one pole of this for you. The classical move is to notice which end you've disowned — the tug-of-war usually relaxes the moment you admit you're holding both ropes.` },
      { label: "What to do", text: `Don't pick a winner; schedule both. Give ${A.use} its hours and ${B.use} its hours, and the day stops feeling like a contradiction. Integration here isn't a compromise — it's alternation done honestly.` },
    ];
    case "trine": return [
      { label: "The flow", text: `${A.name} in ${a.sign} and ${B.name} in ${b.sign} share an element — ${A.short} and ${B.short} feed each other without friction. Things in this lane simply work better today than they have any right to.` },
      { label: "The catch", text: `Trines are talent-weather: easy, graceful, and easy to sleep through. What flows without resistance also fails to demand attention, so the day's real gift can pass unused while you wrestle with louder things.` },
      { label: "What to do", text: `Spend it on purpose. Put real work into the channel while it's open — ${A.use}, ${B.use}, or anything that joins them. Effort placed in a trine goes unusually far; that's the whole trade.` },
    ];
    case "sextile": return [
      { label: "The opening", text: `${A.name} in ${a.sign} and ${B.name} in ${b.sign} are within reach of each other — a working alliance between ${A.short} and ${B.short} is on offer.` },
      { label: "The invitation", text: `Sextiles reward initiative and punish nothing. If you make the call, send the draft, take the first step in this direction, the door opens easily. If you don't, nothing happens — which is the quiet cost.` },
      { label: "What to do", text: `One deliberate move in this lane today: something joining ${A.use} with ${B.use}. Sextiles are the aspects most shaped by what you choose to do with them.` },
    ];
  }
}

// One plain sentence — the simple layer that leads every card.
export function composeEssence(a: AspectParty, b: AspectParty, aspect: AspectName): string {
  const A = core(a.planet), B = core(b.planet);
  switch (aspect) {
    case "square":      return `${A.short[0].toUpperCase()}${A.short.slice(1)} and ${B.short} are pulling against each other today — usable pressure, if you aim it.`;
    case "conjunction": return `${A.short[0].toUpperCase()}${A.short.slice(1)} and ${B.short} are fused and amplified right now — strong weather, worth pointing somewhere.`;
    case "opposition":  return `${A.short[0].toUpperCase()}${A.short.slice(1)} and ${B.short} sit at opposite ends of the day — the work is honoring both.`;
    case "trine":       return `${A.short[0].toUpperCase()}${A.short.slice(1)} and ${B.short} are flowing together — this lane is open and easy today.`;
    case "sextile":     return `${A.short[0].toUpperCase()}${A.short.slice(1)} and ${B.short} are within easy reach of each other — an opening, if you take a step.`;
  }
}

// Favors / watch-for, per aspect nature + the two planets' uses.
export function composeGuidance(a: AspectParty, b: AspectParty, aspect: AspectName): { favors: string; watch: string } {
  const A = core(a.planet), B = core(b.planet);
  const hard = aspect === "square" || aspect === "opposition";
  const fused = aspect === "conjunction";
  return {
    favors: hard
      ? `deliberate, physical, single-focus work — anything that gives the tension one honest outlet (${A.use}; ${B.use})`
      : fused
        ? `bold moves in this exact lane — ${A.use} fused with ${B.use}`
        : `initiative in this lane — ${A.use}, ${B.use}, or work that joins them`,
    watch: hard
      ? `irritation looking for a target, forcing a winner between two things you actually need both of`
      : fused
        ? `overreach and tunnel vision — potency without perspective`
        : `letting the window pass unused — ease doesn't announce itself`,
  };
}

// ── Planet-in-sign one-liner, for anywhere a planet is named ─────────────────

export function planetInSignNote(planet: string, sign: string): string {
  const A = core(planet);
  return `${A.name} is ${A.is}. In ${sign} it runs ${inflect(sign)}.`;
}

// ── Ranking: which aspects are the moment's headline ─────────────────────────

const RANK_PLANET_WEIGHT: Record<string, number> = {
  Sun: 3, Moon: 1, Mercury: 2, Venus: 2, Mars: 3,
  Jupiter: 3, Saturn: 4, Uranus: 4, Neptune: 4, Pluto: 4,
};
const RANK_ASPECT_WEIGHT: Record<string, number> = {
  conjunction: 4, opposition: 3.5, square: 3.5, trine: 2, sextile: 1.5,
};

export interface RankableAspect {
  planet1: string; planet2: string; aspect: string; orb: number;
  applying?: boolean; hoursToExact?: number | null; hoursSinceExact?: number | null;
}

/** Scores a (non-lunar) aspect's claim to being the moment's headline. */
export function aspectSignificance(a: RankableAspect): number {
  const pw = (RANK_PLANET_WEIGHT[a.planet1] ?? 1) + (RANK_PLANET_WEIGHT[a.planet2] ?? 1);
  const aw = RANK_ASPECT_WEIGHT[a.aspect] ?? 1;
  const orbFactor = Math.max(0.15, 1 - a.orb / 8);          // tighter = louder
  const applyingBonus = a.applying ? 1.15 : 1;               // building > fading
  return pw * aw * orbFactor * applyingBonus;
}
