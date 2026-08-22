/**
 * "Here's how I am" → is anything in the sky shaped like that → what the same
 * energy is good for. Four steps, in this order, and the first one can stop
 * everything (DESIGN-TRANSMUTE-2026-08-21).
 *
 *   GATE    crisis language returns support and no reading, ever
 *   MIRROR  read the words into a planet, deterministically
 *   CHECK   is that planet actually doing anything right now
 *   TURN    if it is, the same energy's gift and the work it can go into
 *
 * THE CLAIM IS NEVER CAUSAL. Not "Mars is making you angry" — "what you named
 * has the shape of Mars, and Mars is live right now." Resonance, stated as
 * resonance. The grammar is fixed and tested.
 *
 * THE REFUSAL IS THE FEATURE. Every horoscope app finds something, because the
 * sky is large and any feeling can be mapped onto any hour by someone who wants
 * to. When the mirrored planet is doing nothing, this says so — the same rule
 * that lets an empty day be a valid answer everywhere else in Compass.
 *
 * No model call anywhere in here. The astrology never needs a key, and neither
 * does the gate.
 */
import { checkCrisis, type CrisisMatch } from "./crisisGate.js";
import { associateDeterministic } from "./associate.js";
import { dayReading, subjectOf, type Testimony, type NatalForReading } from "./synthesis.js";
import { computeQualifiers, type Qualifier } from "./qualifiers.js";
import { julianDay, getPlanetPositions, getPlanetaryHour, getSunriseSunset } from "./astro.js";
import { PLANETS as LEXICON_PLANETS } from "../../../../lib/lexicon/src/planets.js";

/** How the person has capacity right now — the axis lib/alternatives.ts keys on. */
export type Capacity = "depleted" | "restless" | "social";
// Stems, so no TRAILING \b — "exhaust\b" cannot match "exhausted", which is
// the form people actually write.
const CAPACITY_WORDS: Record<Capacity, RegExp> = {
  depleted: /\b(tired|exhaust|drain|empty|flat|numb|spent|wiped|no energy|burnt? out|burned out|deplet|foggy|heavy|listless)/i,
  restless: /\b(restless|agitat|antsy|can'?t settle|can'?t sit|wired|jumpy|irritab|itchy|twitchy|fidget|keyed up|on edge|wound up|angry|angri|furious|rage|frustrat)/i,
  social: /\b(lonely|alone|isolat|disconnect|miss(ing)? (my|them|him|her|people)|left out|unseen|no one)/i,
};

/**
 * How many voices count as "the sky is loud about this", in two pools.
 * Calibrated by measured fire rate over 2026, not by taste — see the note at
 * the ranking below for why there are two pools and not one.
 */
export const LOUD_FAST = Number(process.env.COMPASS_LOUD_FAST ?? 3);
export const LOUD_SOCIAL = Number(process.env.COMPASS_LOUD_SOCIAL ?? 1);
export const LOUD_OUTER = Number(process.env.COMPASS_LOUD_OUTER ?? 2);
/** The three pools are synthesis's own salience tiers (transitSalienceBase:
 *  0.7–0.85 / 0.55 / 0.45), because those tiers are exactly the statement that
 *  these speeds are not comparable. Two pools left the slow one as "Jupiter and
 *  Saturn" — they outranked the outers on every day of 2026. */
const SOCIAL_BODIES = new Set(["Jupiter", "Saturn"]);
const OUTER_BODIES = new Set(["Uranus", "Neptune", "Pluto"]);

export interface FeelingReading {
  blocked: false;
  /** What the words read as, and how confidently. */
  mirror: { planets: string[]; rationale: string; capacity: Capacity | null };
  /** Present only when a mirrored planet is actually doing something now. */
  live: {
    planet: string;
    /** The configuration, literally — an astrologer can check it. */
    literal: string;
    /** In plain words, for the quiet lens. */
    plain: string;
    /** How loud, 0–1ish. Not shown; the floor is calibrated against it. */
    strength: number;
    /** Whether this is a passing condition or a long one. A Mars hour and a
     *  Pluto square are both true and are not the same size of true. */
    tempo: Tempo;
    /** The same energy, three ways. */
    shadow?: string;
    gift?: string;
    work?: string;
  } | null;
  /** Why nothing was found, when nothing was. Never silent. */
  quiet?: string;
}
export type FeelingResult = FeelingReading | (CrisisMatch & { blocked: true });

function capacityOf(text: string): Capacity | null {
  for (const [k, re] of Object.entries(CAPACITY_WORDS)) if (re.test(text)) return k as Capacity;
  return null;
}

/** Every body doing something right now, with its strongest statement. */
type Tempo = "today" | "season";
const tempoOf = (planet: string): Tempo =>
  SOCIAL_BODIES.has(planet) || OUTER_BODIES.has(planet) ? "season" : "today";
function inPlay(
  testimonies: Testimony[],
  qualifiers: Qualifier[],
  hourRuler: string | null,
): Map<string, { literal: string; plain: string; strength: number; tempo: Tempo }> {
  const out = new Map<string, { literal: string; plain: string; strength: number; tempo: Tempo }>();
  const put = (p: string, literal: string, plain: string, strength: number, tempo: Tempo = "today") => {
    const prev = out.get(p);
    if (!prev || prev.strength < strength) out.set(p, { literal, plain, strength, tempo });
  };
  for (const t of testimonies) {
    const p = subjectOf(t);
    if (!p) continue;
    const kind = (t.facts as { kind?: string } | undefined)?.kind ?? "";
    // PERMANENT CONDITIONS ARE NOT EVIDENCE. The Moon has a sign and the month
    // has a phase every day of the year, and the malefic out of sect is Mars
    // every single daytime — measured over 2026, keeping sectMalefic made "angry
    // and impatient" find Mars on 365 days out of 365. A door that always opens
    // tells you nothing, which is the same failure as one that never does.
    if (kind === "moonSign" || kind === "phase" || kind === "sect" || kind === "sectMalefic") continue;
    // TEMPO IS THE PLANET'S SPEED, not whether the source is a transit. Venus
    // moves about a degree a day, so a 2.3° Venus-to-natal aspect is days, and
    // calling it "has been for a while" was simply false; Pluto at the same orb
    // is months.
    put(p, t.note, t.note, t.weight * t.salience, tempoOf(p));
    // BOTH BODIES, for a Moon aspect. subjectOf answers "Moon" for
    // moonAspect:Uranus — right as grammar, since the Moon is what the sentence
    // is about — but it left the partner invisible here, so the door told
    // someone who wrote "restless, want out" that Uranus wasn't doing anything
    // while the Moon sat a third of a degree off it. A Moon conjunct an outer
    // planet is one of the loudest things a month contains.
    if (t.source.startsWith("moonAspect:")) {
      const partner = t.source.slice("moonAspect:".length);
      // Tempo follows the FASTER body. The Moon conjoins Uranus for a few hours
      // once a month, so "and it's been live for a while" would be wrong here
      // even though Uranus is otherwise a season-length voice.
      put(partner, t.note, t.note, t.weight * t.salience, "today");
    }
  }
  for (const q of qualifiers) {
    for (const b of q.bodies) {
      if (b === "season") continue;
      put(b, q.literal, q.plain, q.salience / 100);
    }
  }
  if (hourRuler) put(hourRuler, `the ${hourRuler} hour`, `it is ${hourRuler}'s hour`, 0.35);
  return out;
}

export function feelingReading(opts: {
  text: string;
  at?: Date;
  lat: number;
  lon: number;
  natal?: NatalForReading;
}): FeelingResult {
  // ── GATE ────────────────────────────────────────────────────────────────
  // Before the mirror, before the sky, before anything.
  const gate = checkCrisis(opts.text);
  if (gate.blocked) return gate;

  const at = opts.at ?? new Date();
  const text = String(opts.text ?? "").trim();
  if (!text) {
    return { blocked: false, mirror: { planets: [], rationale: "", capacity: null }, live: null, quiet: "Nothing to read yet." };
  }

  // ── MIRROR ──────────────────────────────────────────────────────────────
  // The FEELING vocabulary first. associate.ts describes doings, and asked
  // what "irritable, can't settle, snapping at people" is, it answers Saturn:
  // its keyword tables have no word for how anything feels. Each planet's own
  // literacy does, so the lexicon carries it.
  const lower = ` ${text.toLowerCase()} `;
  const felt = Object.values(LEXICON_PLANETS)
    .map(pl => ({
      planet: pl.key,
      score: (pl.feelings ?? []).reduce((n, w) => n + (lower.includes(` ${w}`) || lower.includes(`${w} `) ? 1 + w.length / 20 : 0), 0),
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const assoc = associateDeterministic(text);
  const capacity = capacityOf(text);
  // Two at most, and only the second if it is close to the first — a long
  // sentence brushes several planets and naming five of them is noise.
  const planets = felt.length
    ? felt.slice(0, 2).filter((x, i) => i === 0 || x.score >= felt[0].score - 1).map(x => x.planet)
    : assoc.planets;
  const rationale = felt.length
    ? `Those words read as ${planets.join(" with a note of ")}.`
    : assoc.rationale;
  const mirror = { planets, rationale, capacity };
  if (!planets.length) {
    return {
      blocked: false, mirror, live: null,
      quiet: "These words don't land on any one thing in the sky, so there's nothing useful to add here.",
    };
  }

  // ── CHECK ───────────────────────────────────────────────────────────────
  const jd = julianDay(at);
  const positions = getPlanetPositions(jd);
  let hourRuler: string | null = null;
  try {
    if (!getSunriseSunset(jd, opts.lat, opts.lon).polar) hourRuler = getPlanetaryHour(at, opts.lat, opts.lon).ruler;
  } catch { /* no hour without a real horizon */ }
  // personalLimit 12: a slow transit is exactly the right answer to a slow feeling.
  const reading = dayReading(at, opts.lat, opts.lon, opts.natal ? { natal: opts.natal, personalLimit: 12 } : {});
  const qualifiers = computeQualifiers(jd, positions);
  const play = inPlay(reading.testimonies, qualifiers, hourRuler);

  // LOUD, NOT MERELY PRESENT.
  //
  // An absolute strength floor does not work here: with thirteen natal points
  // and five aspects at generous orbs, nearly every planet is within orb of
  // SOMETHING at any moment, and the strengths run continuous with no natural
  // break (p25 0.51, p50 0.65, p75 0.83 over 2026). A floor set high enough to
  // refuse anything cuts the chartless case to nothing while a chart still
  // fires four days in five.
  //
  // So the test is relative: the mirrored planet has to be among the moment's
  // loudest voices, which is also the question an astrologer would actually
  // ask — not "is Venus within orb of anything" but "is Venus a big deal
  // today". It self-calibrates as orbs and collectors change.
  // TWO POOLS, BECAUSE THE SPEEDS ARE NOT COMPARABLE. Ranking every body
  // together reintroduces the exact blind spot the personalLimit fix removed:
  // synthesis deliberately scores outer-planet transits at salience 0.45
  // against the Moon's 0.85, so on a single ladder Pluto came last on every one
  // of 365 days at top-3, top-4 and top-5 alike. The Moon meanwhile was loud on
  // 86–98% of them, which is honest — it is the fastest body and does something
  // new daily — but it means one ladder answers "is this the Moon" and nothing
  // else. Asking instead whether Pluto is loud FOR A SLOW PLANET is both the
  // fair comparison and the one an astrologer makes.
  const ranked = [...play.entries()].sort((a, b) => b[1].strength - a[1].strength);
  const loud = new Set([
    ...ranked.filter(([p]) => !SOCIAL_BODIES.has(p) && !OUTER_BODIES.has(p)).slice(0, LOUD_FAST).map(([p]) => p),
    ...ranked.filter(([p]) => SOCIAL_BODIES.has(p)).slice(0, LOUD_SOCIAL).map(([p]) => p),
    ...ranked.filter(([p]) => OUTER_BODIES.has(p)).slice(0, LOUD_OUTER).map(([p]) => p),
  ]);
  const hit = planets
    .map(p => ({ planet: p, found: play.get(p) }))
    .filter(x => !!x.found && loud.has(x.planet))
    .sort((a, b) => (b.found!.strength) - (a.found!.strength))[0];

  if (!hit) {
    const named = planets.length === 1 ? planets[0] : `${planets[0]} or ${planets[1]}`;
    return {
      blocked: false, mirror, live: null,
      quiet: play.has(planets[0])
        ? `That has the shape of ${named}, and ${named} is in the background today rather than driving anything. Nothing up there is loud enough to be worth reading into how you feel.`
        : `That has the shape of ${named}, and ${planets.length === 1 ? "it isn't" : "neither is"} doing anything in the sky right now. Nothing matches what you named, which doesn't make it less real.`,
    };
  }

  // ── TURN ────────────────────────────────────────────────────────────────
  const roads = LEXICON_PLANETS[hit.planet]?.roads;
  return {
    blocked: false,
    mirror,
    live: {
      planet: hit.planet,
      literal: hit.found!.literal,
      plain: hit.found!.plain,
      tempo: hit.found!.tempo,
      strength: hit.found!.strength,
      shadow: roads?.shadow,
      gift: roads?.gift,
      work: roads?.work,
    },
  };
}
