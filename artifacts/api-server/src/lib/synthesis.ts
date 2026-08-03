/**
 * Synthesis — bricks 2+3 of the synthesis engine (spec: SYNTHESIS-ENGINE-SPEC.md).
 *
 * Turns the day's factors into a woven READING instead of a list. Each voice
 * (sect, planetary hour, day ruler, Moon sign, applying Moon aspects, phase,
 * VoC) becomes a Testimony weighted by DIGNITY (lib/dignity.ts) and by SALIENCE
 * (how loud it is now). We find the convergence (the flavour), the counterpoint
 * (the honest "but…"), rank salience ("what to watch"), and fold in the named
 * PATTERNS (lib/patterns.ts). Grounded in the book library (SYNTHESIS-BOOK-NOTES):
 *   • Sect is the baseline scalar — a day/night chart has one best-behaved voice
 *     (dayHero) and one loudest caution (the out-of-sect malefic).           [George]
 *   • Aspect NATURE, not just orb, sets polarity + strength: a trine softens
 *     even a malefic, a square harms even a benefic, a sextile is real-but-weak;
 *     aversions (30°/150°) give no testimony at all.                         [George]
 *   • Every voice carries two roads — a GIFT to spend and a SHADOW to watch;
 *     the counterpoint and caution-windows draw on the shadow.        [Arroyo/Forrest]
 */
import { getPlanetPositions, getPlanetaryHour, getMajorAspects, moonPhase, voidOfCourse, julianDay, getSunriseSunset } from "./astro.js";
import type { PlanetAspect } from "./astro.js";
import { dignity } from "./dignity.js";
import { matchPatterns, type NamedPattern } from "./patterns.js";
import { SIGN_GUIDE } from "./interpretation.js";

type Element = "fire" | "earth" | "air" | "water";
const PLANET_ELEMENT: Record<string, Element> = {
  Sun: "fire", Moon: "water", Mercury: "air", Venus: "earth", Mars: "fire", Jupiter: "fire", Saturn: "earth",
};
const PLANET_THEME: Record<string, { verb: string; activities: string[] }> = {
  Sun:     { verb: "vitality and wholehearted action", activities: ["decide", "creative work", "the essential task"] },
  Moon:    { verb: "tending and feeling", activities: ["rest", "tend home", "care for someone"] },
  Mercury: { verb: "thinking and exchanging", activities: ["write", "sort", "learn", "run errands"] },
  Venus:   { verb: "relating and refining", activities: ["connect", "make something beautiful", "money"] },
  Mars:    { verb: "effort and the decisive cut", activities: ["train", "push", "the hard task"] },
  Jupiter: { verb: "growth and the bigger frame", activities: ["teach", "the big ask", "reach wider"] },
  Saturn:  { verb: "structure and the unglamorous right thing", activities: ["finish", "commit", "prune"] },
};

// Two roads — the gift to spend and the shadow to watch (same neutral energy,
// high road / low road). Arroyo's positive-negative table + Forrest's elements.
const PLANET_ROADS: Record<string, { gift: string; shadow: string }> = {
  Sun:     { gift: "vitality and warmth", shadow: "pride, needing to be the center" },
  Moon:    { gift: "care and attunement", shadow: "moodiness, clinging" },
  Mercury: { gift: "clarity and curiosity", shadow: "overthinking, scattered nerves" },
  Venus:   { gift: "warmth and ease", shadow: "indulgence, avoiding the hard word" },
  Mars:    { gift: "courage and decisive effort", shadow: "impatience, a short fuse" },
  Jupiter: { gift: "faith and generosity", shadow: "overreach, glossing the detail" },
  Saturn:  { gift: "discipline and endurance", shadow: "rigidity, fear, gloom" },
};
const ELEMENT_ROADS: Record<Element, { gift: string; shadow: string }> = {
  fire:  { gift: "courage and initiative", shadow: "burnout, recklessness" },
  earth: { gift: "groundedness and follow-through", shadow: "rigidity, drudgery, perfectionism" },
  air:   { gift: "perception and perspective", shadow: "overthinking, all talk and no move" },
  water: { gift: "empathy and renewal", shadow: "overwhelm, escapism, withdrawal" },
};

// Valence of a body in the reading (lights + Mercury are neutral).
const VALENCE: Record<string, number> = { Venus: 1, Jupiter: 1, Mars: -1, Saturn: -1, Sun: 0, Moon: 0, Mercury: 0 };
// Aspect nature: harmony sign + a strength multiplier. Sextile is real-but-weak
// (×0.5); a square outweighs a benefic, a trine softens a malefic. Aversions
// (semisextile/quincunx) never reach here — getMajorAspects omits them — but the
// synthesis skips them defensively.
// Mean daily motion in degrees — used only to estimate how long a non-lunar
// aspect stays within orb, which is what files it under the right duration
// band on the dashboard. Approximate by design: the difference between a
// two-week and a six-month configuration is the point, not the exact day.
const MEAN_MOTION: Record<string, number> = {
  Sun: 0.986, Mercury: 1.383, Venus: 1.602, Mars: 0.524,
  Jupiter: 0.083, Saturn: 0.034, Uranus: 0.012, Neptune: 0.006, Pluto: 0.004,
};

const ASPECT_NATURE: Record<string, { harmony: -1 | 0 | 1; strength: number; word: string; ing: string }> = {
  conjunction: { harmony: 0, strength: 1.0, word: "meets", ing: "meeting" },
  sextile:     { harmony: 1, strength: 0.5, word: "reaches easily to", ing: "reaching easily to" },
  square:      { harmony: -1, strength: 1.0, word: "grinds against", ing: "grinding against" },
  trine:       { harmony: 1, strength: 1.0, word: "flows to", ing: "flowing to" },
  opposition:  { harmony: -1, strength: 0.9, word: "faces off with", ing: "facing off with" },
};

/**
 * The facts behind a testimony, as data rather than as a sentence.
 *
 * Everything here was already in scope where the testimony is built and was
 * being flattened into `note` — the same disease as the morning email
 * computing a reading and binning it, one layer down. Once prose is the only
 * artifact, the sentence can only ever be Compass's: a different register
 * (LANGUAGE-STUDY §3) or a different consumer over /engine (§5) has nothing to
 * work from but English it would have to parse back.
 *
 * `note` stays exactly as it is. It is not dead once a renderer exists — it is
 * the DEFAULT REGISTER and the fallback when the renderer is unavailable, the
 * same way three AI routes already degrade to a deterministic answer rather
 * than refuse. That is what keeps an LLM voice layer safe to depend on.
 */
export interface TestimonyFacts {
  kind: "sect" | "sectMalefic" | "hour" | "dayRuler" | "moonSign" | "moonAspect" | "aspect" | "phase" | "voc";
  /** The planet whose voice this is, where there is one. */
  planet?: string;
  /** The Moon's partner in an aspect. */
  partner?: string;
  aspect?: string;
  orbDeg?: number;
  applying?: boolean;
  sign?: string;
  /** For non-lunar aspects: roughly how many days this configuration stays
   *  within orb. Lets a client file it under the right duration band without
   *  inferring one from the planets involved. */
  durationDays?: number;
  phaseName?: string;
  waxing?: boolean;
  /** Sect/hour standing, so a renderer can say "strongly placed" its own way. */
  dignity?: number;
  isDay?: boolean;
  /** The domain this voice speaks to — "thinking and exchanging". */
  verb?: string;
}

export interface Testimony {
  source: string;              // "sect" | "sectMalefic" | "hour" | "dayRuler" | "moonSign" | "moonAspect:Venus" | "phase" | "voc"
  /** The same claim as `note`, in fields. See TestimonyFacts. */
  facts?: TestimonyFacts;
  element?: Element;
  activities: string[];
  weight: number;              // dignity-driven
  salience: number;            // loudness now
  polarity: 1 | -1;
  note: string;                // plain-language, for the drill-down
  carriedBy?: string;          // fragment that reads after "carried by …" in the flavour
  gift?: string;               // the high road — what this voice offers
  shadow?: string;             // the low road — what to watch (feeds caution-windows)
  score: number;               // weight × salience × polarity (signed)
}

export interface DayReading {
  flavour: string;             // the woven whole, one sentence
  element: string;             // the convergent element (the flavour's key)
  foci: string[];              // concrete things it favours
  watch: { note: string; salience: number; source?: string }[];  // top salience — "focus on this"
  counterpoint?: string;       // the honest "but…"
  counterpointSource?: string; // which testimony it speaks for, so clients can dedupe
  patterns: NamedPattern[];    // named configurations present
  testimonies: Testimony[];    // the parts, for the drill-down
}

// Sect — the baseline judgment (George): a day chart is the Sun's team, a night
// chart the Moon's. Each has one greater benefic and one out-of-sect ("dangerous")
// malefic. Rough day/night by local hour until sunrise/sunset is threaded — the
// same proxy dignity already uses.
interface Sect { chart: "day" | "night"; luminary: string; team: string[]; benefic: string; malefic: string; }
function sectOf(isDay: boolean): Sect {
  return isDay
    ? { chart: "day",   luminary: "Sun",  team: ["Sun", "Jupiter", "Saturn"], benefic: "Jupiter", malefic: "Mars"  }
    : { chart: "night", luminary: "Moon", team: ["Moon", "Venus", "Mars"],    benefic: "Venus",   malefic: "Saturn" };
}
/** The natal chart, reduced to what the personal testimony layer needs.
 *  asc/mc only when the birth time is known. */
export interface NatalForReading {
  planets: { planet: string; longitude: number }[];
  asc?: number;
  mc?: number;
}

/** Options threaded from the caller (route): viewer timezone for the day-of-week
 *  ruler, the natal ascendant ruler for chart-aware patterns, scope —
 *  "moment" includes the rotating planetary hour; "day" (reports, spanning the
 *  whole day) drops hour-bound voices — and the natal chart, which unlocks the
 *  personal testimony layer (transits-to-natal join the convergence). */
export interface ReadingOptions { tzOffsetMin?: number; ascRuler?: string; scope?: "moment" | "day"; natal?: NatalForReading; }

// ── Personal testimony layer — transits to the natal chart ───────────────────
// The mundane sky speaks to everyone; these voices speak to YOU. Each
// transiting planet within orb of a natal planet/angle becomes a Testimony,
// so personal weather joins the same convergence/counterpoint/salience
// machinery instead of living in a side list. Grounded in the book digests:
//   • Hand's pair table — difficulty/ease is the PLANET PAIR, aspect-scoped;
//     conjunctions resolve their polarity FROM the pair, not from the aspect.
//   • Ebertin — outer transits set the THEME (strong, slow → high weight, low
//     day-salience); fast bodies TIME it (fleeting → high salience). Personal
//     points (natal Sun/Moon/Asc/MC) outrank generic hits. Natal orbs: 5°
//     personal points · 4° Mercury/Venus/Mars · 3° Jupiter→Pluto.

// Hand, Planets in Transit pp.11-13 (verbatim-transcribed). Scope limits when
// the pair's polarity applies; outside its scope a pair is neutral.
type PairScope = "all" | "hardOnly" | "softOnly";
const pairKey = (a: string, b: string) => [a, b].sort().join("-");
const HAND_DIFFICULT = new Map<string, PairScope>([
  [pairKey("Sun", "Saturn"), "all"], [pairKey("Sun", "Uranus"), "hardOnly"], [pairKey("Sun", "Neptune"), "all"],
  [pairKey("Moon", "Mars"), "all"], [pairKey("Moon", "Saturn"), "all"], [pairKey("Moon", "Uranus"), "all"],
  [pairKey("Moon", "Neptune"), "all"], [pairKey("Moon", "Pluto"), "all"],
  [pairKey("Mercury", "Neptune"), "all"], [pairKey("Venus", "Neptune"), "hardOnly"],
  [pairKey("Mars", "Saturn"), "all"], [pairKey("Mars", "Uranus"), "all"], [pairKey("Mars", "Neptune"), "all"], [pairKey("Mars", "Pluto"), "all"],
  [pairKey("Jupiter", "Saturn"), "hardOnly"], [pairKey("Saturn", "Uranus"), "all"], [pairKey("Saturn", "Neptune"), "all"], [pairKey("Saturn", "Pluto"), "all"],
  [pairKey("Uranus", "Neptune"), "hardOnly"],
]);
const HAND_EASY = new Map<string, PairScope>([
  [pairKey("Sun", "Moon"), "softOnly"], [pairKey("Sun", "Mercury"), "softOnly"],
  [pairKey("Sun", "Venus"), "all"], [pairKey("Sun", "Jupiter"), "all"],
  [pairKey("Moon", "Venus"), "all"], [pairKey("Moon", "Jupiter"), "all"],
  [pairKey("Venus", "Mars"), "softOnly"], [pairKey("Venus", "Jupiter"), "all"], [pairKey("Mars", "Jupiter"), "softOnly"],
]);

// Themes for transiting bodies the mundane collectors don't cover.
const OUTER_THEME: Record<string, { verb: string; gift: string; shadow: string }> = {
  Uranus:  { verb: "breaking the old pattern", gift: "fresh air and honest change", shadow: "restlessness, rupture for its own sake" },
  Neptune: { verb: "dissolving and imagining", gift: "imagination and compassion", shadow: "fog, drift, self-deception" },
  Pluto:   { verb: "deep renovation", gift: "depth and renewal", shadow: "control, obsession" },
};
// What a natal point MEANS when something lands on it.
const NATAL_POINT_WORD: Record<string, string> = {
  Sun: "your core self", Moon: "your inner life", Mercury: "your thinking", Venus: "your relating",
  Mars: "your drive", Jupiter: "your growth", Saturn: "your foundations",
  Uranus: "your independence", Neptune: "your imagination", Pluto: "your depths",
  ASC: "how you meet the world", MC: "your work in the world",
  Fortune: "your fortune", // the Lot — body, resources, ease
};
const PERSONAL_POINTS = new Set(["Sun", "Moon", "ASC", "MC"]);
// Ebertin's natal orb ladder, by the NATAL target.
function natalOrb(target: string): number {
  if (PERSONAL_POINTS.has(target)) return 5;
  if (["Mercury", "Venus", "Mars"].includes(target)) return 4;
  return 3;
}
// Day-salience by transiting speed class: fast = today's spike, slow = the
// chapter you're in (still a voice, but a background one on a DAY card).
function transitSalienceBase(p: string): number {
  if (p === "Moon") return 0.85;
  if (["Sun", "Mercury", "Venus", "Mars"].includes(p)) return 0.7;
  if (["Jupiter", "Saturn"].includes(p)) return 0.55;
  return 0.45; // Uranus/Neptune/Pluto — theme, not event
}
const ASPECT_ANGLES: [string, number][] = [["conjunction", 0], ["sextile", 60], ["square", 90], ["trine", 120], ["opposition", 180]];
function sepDeg(a: number, b: number): number { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; }

function collectPersonal(m: Moment, natal: NatalForReading): Testimony[] {
  const out: Testimony[] = [];
  // Natal Lot of Fortune (George Ch.33, sect-reversed: day Asc+Moon−Sun,
  // night Asc+Sun−Moon). Needs the Ascendant, so birth time must be known.
  // Day birth = natal Sun above the horizon = in the Desc→MC→Asc semicircle.
  let fortune: number | null = null;
  if (natal.asc != null) {
    const nSun = natal.planets.find(p => p.planet === "Sun")?.longitude;
    const nMoon = natal.planets.find(p => p.planet === "Moon")?.longitude;
    if (nSun != null && nMoon != null) {
      const dayBirth = (((nSun - natal.asc) % 360) + 360) % 360 > 180;
      fortune = (((dayBirth ? natal.asc + nMoon - nSun : natal.asc + nSun - nMoon) % 360) + 360) % 360;
    }
  }
  const targets: { name: string; lon: number }[] = [
    ...natal.planets
      .filter(p => Object.prototype.hasOwnProperty.call(NATAL_POINT_WORD, p.planet))
      .map(p => ({ name: p.planet, lon: p.longitude })),
    ...(natal.asc != null ? [{ name: "ASC", lon: natal.asc }] : []),
    ...(natal.mc != null ? [{ name: "MC", lon: natal.mc }] : []),
    ...(fortune != null ? [{ name: "Fortune", lon: fortune }] : []),
  ];
  for (const t of m.positions) {
    for (const target of targets) {
      // A planet transiting its own natal place (returns) is real but reads
      // oddly as "Sun grinds against your Sun" — keep conjunction-returns only.
      const sep = sepDeg(t.longitude, target.lon);
      let best: { name: string; orb: number } | null = null;
      for (const [name, angle] of ASPECT_ANGLES) {
        const orb = Math.abs(sep - angle);
        if (orb <= natalOrb(target.name) && (best == null || orb < best.orb)) best = { name, orb };
      }
      if (!best) continue;
      if (t.planet === target.name && best.name !== "conjunction") continue;

      const nat = ASPECT_NATURE[best.name];
      // Polarity — the PAIR first (Hand), then the aspect's nature.
      const key = pairKey(t.planet, target.name === "ASC" || target.name === "MC" ? t.planet : target.name);
      const hardAspect = best.name === "square" || best.name === "opposition";
      const softAspect = best.name === "sextile" || best.name === "trine";
      const diffScope = target.name === "ASC" || target.name === "MC" ? undefined : HAND_DIFFICULT.get(key);
      const easyScope = target.name === "ASC" || target.name === "MC" ? undefined : HAND_EASY.get(key);
      let polarity: 1 | -1;
      if (diffScope && (diffScope === "all" || (diffScope === "hardOnly" && (hardAspect || best.name === "conjunction")))) polarity = -1;
      else if (easyScope && (easyScope === "all" || (easyScope === "softOnly" && softAspect))) polarity = 1;
      else if (hardAspect) polarity = -1;
      else if (softAspect) polarity = 1;
      else polarity = (VALENCE[t.planet] ?? 0) < 0 ? -1 : 1; // neutral conjunction leans with the transiting planet

      // Verb register follows the judged polarity: a square between a friendly
      // pair (Hand: e.g. Moon-Venus, easy in ALL aspects) is energizing
      // friction, not harm — and a trine in a difficult pair still drags.
      const word = polarity > 0
        ? (hardAspect ? "strikes sparks with" : nat.word)
        : (softAspect ? "tugs at" : nat.word);
      const wordIng = polarity > 0
        ? (hardAspect ? "striking sparks with" : nat.ing)
        : (softAspect ? "tugging at" : nat.ing);
      const exact = Math.max(0, 1 - best.orb / natalOrb(target.name));
      const salience = transitSalienceBase(t.planet) * (0.4 + 0.6 * exact) * nat.strength
        * (PERSONAL_POINTS.has(target.name) ? 1.25 : 1);
      const theme = PLANET_THEME[t.planet] ?? null;
      const outer = OUTER_THEME[t.planet];
      const verb = theme?.verb ?? outer?.verb ?? "its work";
      const roads = PLANET_ROADS[t.planet] ?? (outer ? { gift: outer.gift, shadow: outer.shadow } : undefined);
      const isReturn = t.planet === target.name;
      const targetWord = NATAL_POINT_WORD[target.name] ?? `your ${target.name}`;
      out.push({
        source: `transit:${t.planet}→${target.name}`,
        element: PLANET_ELEMENT[t.planet],
        // The ACTIVATED area is the natal point — its themes are what the day favours.
        activities: polarity > 0 ? (PLANET_THEME[target.name]?.activities ?? theme?.activities ?? []) : [],
        weight: m.dig(t.planet),
        salience,
        polarity,
        gift: roads?.gift, shadow: roads?.shadow,
        carriedBy: isReturn
          ? `your ${t.planet} return — a cycle begins again`
          : `${t.planet} ${wordIng} ${targetWord}`,
        note: isReturn
          ? `your ${t.planet} return (${best.orb.toFixed(1)}°) — its cycle starts a new lap; ${verb} is renewed`
          : `${t.planet} ${word} ${targetWord} (${best.orb.toFixed(1)}°) — ${polarity > 0 ? "support for" : "pressure on"} ${targetWord}${polarity < 0 && roads ? `; watch ${roads.shadow}` : ""}`,
        score: 0, // filled by caller
      });
    }
  }
  // The loudest few join the reading — enrich the convergence, don't drown the sky.
  return out
    .sort((a, b) => b.salience * b.weight - a.salience * a.weight)
    .slice(0, 4)
    .map(t => ({ ...t, score: t.weight * t.salience * t.polarity }));
}

// One gather of the sky, shared by the testimony collectors and the pattern matcher.
interface Moment {
  positions: ReturnType<typeof getPlanetPositions>;
  aspects: PlanetAspect[];
  sunLon: number; isDay: boolean;
  hour: ReturnType<typeof getPlanetaryHour>; dayRuler: string;
  phaseName: string; voc: boolean;
  moonSign: string; moonAspects: PlanetAspect[];
  dig: (name: string) => number;
}
function gather(date: Date, lat: number, lon: number, opts: ReadingOptions = {}): Moment {
  const jd = julianDay(date);
  const positions = getPlanetPositions(jd);
  const lonOf = (name: string) => positions.find(p => p.planet === name)?.longitude ?? 0;
  const retroOf = (name: string) => positions.find(p => p.planet === name)?.retrograde ?? false;
  const sunLon = lonOf("Sun");
  // Sect from the REAL horizon — day iff the Sun is between sunrise and sunset
  // at this place. (The classical definition, not a clock proxy.)
  const { sunrise, sunset } = getSunriseSunset(jd, lat, lon);
  const isDay = date >= sunrise && date < sunset;
  const dig = (name: string) => dignity(name, lonOf(name), { retrograde: retroOf(name), sunLongitude: sunLon, isDay }).weight;
  const aspects = getMajorAspects(jd);
  // Day-of-week ruler in the VIEWER's calendar (matches the /tides/now convention).
  const tz = opts.tzOffsetMin ?? 0;
  return {
    positions, aspects, sunLon, isDay,
    hour: getPlanetaryHour(date, lat, lon),
    dayRuler: ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"][new Date(date.getTime() - tz * 60000).getUTCDay()],
    phaseName: moonPhase(jd).name,
    voc: voidOfCourse(jd).voc,
    moonSign: positions.find(p => p.planet === "Moon")!.sign,
    moonAspects: aspects.filter(a => a.planet1 === "Moon" || a.planet2 === "Moon"),
    dig,
  };
}

export function collectTestimonies(date: Date, lat: number, lon: number, opts: ReadingOptions = {}): Testimony[] {
  return collectFrom(gather(date, lat, lon, opts), opts);
}

function collectFrom(m: Moment, opts: ReadingOptions = {}): Testimony[] {
  const { dig } = m;
  const T: Testimony[] = [];
  const push = (t: Omit<Testimony, "score">) => T.push({ ...t, score: t.weight * t.salience * t.polarity });

  // Sect — the day's baseline. The best-conditioned in-sect planet is the voice
  // to trust; the out-of-sect malefic is the loudest caution.
  // Plain-language notes — "sect" stays under the hood (owner 2026-07-23: no
  // sect jargon on the card); the source key still names the mechanic for the
  // full-detail working table.
  const sect = sectOf(m.isDay);
  const hero = sect.team.slice().sort((a, b) => dig(b) - dig(a))[0];
  const hw = dig(hero), hTheme = PLANET_THEME[hero];
  push({ source: "sect", element: PLANET_ELEMENT[hero], activities: hTheme.activities, weight: hw, salience: 0.55, polarity: 1,
    facts: { kind: "sect", planet: hero, dignity: hw, isDay: m.isDay, verb: hTheme.verb },
    gift: PLANET_ROADS[hero].gift, shadow: PLANET_ROADS[hero].shadow,
    carriedBy: `${hero}, the ${m.isDay ? "day" : "night"}'s steadiest voice — ${hTheme.verb}`,
    note: `${hero} is the ${m.isDay ? "day" : "night"}'s steadiest voice${hw >= 1.2 ? ", strongly placed" : hw <= 0.7 ? ", though faintly placed" : ""} — ${hTheme.verb} carries best` });
  const mw = dig(sect.malefic);
  push({ source: "sectMalefic", activities: [], weight: mw, salience: 0.6, polarity: -1,
    facts: { kind: "sectMalefic", planet: sect.malefic, dignity: mw, isDay: m.isDay },
    shadow: PLANET_ROADS[sect.malefic].shadow,
    note: `${sect.malefic} runs with a rougher edge ${m.isDay ? "by day" : "at night"} — the sharpest caution is ${PLANET_ROADS[sect.malefic].shadow}` });

  // Planetary hour — the rotating sub-mood, weighted by the hour ruler's dignity.
  // Skipped at day scope: an hour-bound voice would go stale over a whole day.
  const hourW = dig(m.hour.ruler), ht = PLANET_THEME[m.hour.ruler];
  if (ht && opts.scope !== "day") push({ source: "hour", element: PLANET_ELEMENT[m.hour.ruler], activities: ht.activities, weight: hourW, salience: 0.6, polarity: 1,
    facts: { kind: "hour", planet: m.hour.ruler, dignity: hourW, verb: ht.verb },
    gift: PLANET_ROADS[m.hour.ruler].gift, shadow: PLANET_ROADS[m.hour.ruler].shadow,
    carriedBy: `the ${m.hour.ruler} hour, leaning toward ${ht.verb}`,
    note: `the ${m.hour.ruler} hour (${hourW >= 1.2 ? "dignified — trust it" : hourW <= 0.6 ? "weak — a faint voice" : "middling"}) leans toward ${ht.verb}` });

  // The planetary day — a whole day has one keynote.
  const dw = dig(m.dayRuler), dt = PLANET_THEME[m.dayRuler];
  if (dt) push({ source: "dayRuler", element: PLANET_ELEMENT[m.dayRuler], activities: dt.activities, weight: dw, salience: 0.5, polarity: 1,
    facts: { kind: "dayRuler", planet: m.dayRuler, dignity: dw, verb: dt.verb },
    gift: PLANET_ROADS[m.dayRuler].gift, shadow: PLANET_ROADS[m.dayRuler].shadow,
    carriedBy: `${m.dayRuler}'s day — ${dt.verb}`,
    note: `${m.dayRuler}'s day — ${dt.verb}` });

  // The Moon's sign — the day's felt character (weighted by the Moon's dignity).
  const sg = SIGN_GUIDE[m.moonSign];
  if (sg) push({ source: "moonSign", element: sg.element as Element, activities: sg.favors.slice(0, 3), weight: dig("Moon"), salience: 0.45, polarity: 1,
    facts: { kind: "moonSign", planet: "Moon", sign: m.moonSign, dignity: dig("Moon") },
    gift: ELEMENT_ROADS[sg.element as Element].gift, shadow: ELEMENT_ROADS[sg.element as Element].shadow,
    carriedBy: `a ${m.moonSign} Moon — ${sg.feel}`,
    note: `a ${m.moonSign} Moon — ${sg.feel}` });

  // Applying Moon aspects — the day's engine. Nature sets polarity + strength;
  // salience scales with exactness × the aspect's strength; weight from the
  // partner's dignity. Separating aspects are framing-only — skipped here.
  for (const a of m.moonAspects.filter(a => a.applying).slice(0, 3)) {
    const other = a.planet1 === "Moon" ? a.planet2 : a.planet1;
    const th = PLANET_THEME[other]; const nat = ASPECT_NATURE[a.aspect];
    if (!th || !nat) continue;  // no theme, or an aversion — no testimony
    const exact = Math.max(0, 1 - a.orb / 8);
    // Combine aspect harmony with the partner's valence: a trine to a malefic is
    // still mildly supportive; a square to a benefic is still mildly hard.
    const score = nat.harmony !== 0 ? nat.harmony + 0.5 * (VALENCE[other] ?? 0) : (VALENCE[other] || 0.3);
    const polarity: 1 | -1 = score >= 0 ? 1 : -1;
    push({ source: `moonAspect:${other}`, element: PLANET_ELEMENT[other], activities: th.activities,
      weight: dig(other), salience: 0.9 * (0.4 + 0.6 * exact) * nat.strength, polarity,
      // The orb and the aspect name were readable only by parsing `note` back
      // out of English — the one thing a second register could never do.
      facts: { kind: "moonAspect", planet: "Moon", partner: other, aspect: a.aspect,
               orbDeg: a.orb, applying: true, dignity: dig(other), verb: th.verb },
      gift: PLANET_ROADS[other].gift, shadow: PLANET_ROADS[other].shadow,
      carriedBy: `the Moon ${nat.ing} ${other} — ${polarity > 0 ? "flow toward" : "friction around"} ${th.verb}`,
      note: `Moon ${nat.word} ${other} (${a.orb.toFixed(1)}° applying) — ${polarity > 0 ? "flow toward" : "friction around"} ${th.verb}` });
  }

  // ── Non-lunar aspects: the standing weather ────────────────────────────────
  //
  // This family did not exist. Every other layer of the sky produced testimony;
  // planet-to-planet aspects were computed, folded into the day's HEIGHT at
  // weight 0.05, and never spoken. That is why a week could carry a Saturn–
  // Neptune square at 0° and still render as the flattest bars of the month:
  // the loudest slow thing in the sky had no voice in the reading, only a
  // whisper in a scalar.
  //
  // These are deliberately NOT the day's engine — the Moon is. They are the
  // weather the day happens inside, so they carry lower salience than an
  // applying Moon aspect but persist for days or months rather than hours.
  // `durationDays` is what lets the dashboard file them under "this stretch"
  // instead of guessing from the planets involved.
  for (const a of m.aspects.filter(x => x.planet1 !== "Moon" && x.planet2 !== "Moon")) {
    // Tight only. A 6° Jupiter–Saturn is real but it is background to the
    // background; the surface has no room for it and the receipt can show it.
    if (a.orb > 3) continue;
    const nat = ASPECT_NATURE[a.aspect];
    const th1 = PLANET_THEME[a.planet1], th2 = PLANET_THEME[a.planet2];
    if (!nat || !th1 || !th2) continue;
    const exact = Math.max(0, 1 - a.orb / 3);
    // Same harmony+valence blend the Moon aspects use, averaged over the pair.
    const pairValence = ((VALENCE[a.planet1] ?? 0) + (VALENCE[a.planet2] ?? 0)) / 2;
    const score = nat.harmony !== 0 ? nat.harmony + 0.5 * pairValence : (pairValence || 0.3);
    const polarity: 1 | -1 = score >= 0 ? 1 : -1;
    // How long this configuration stays inside orb, from the pair's relative
    // speed. Slow pairs are the ones worth naming as an era; fast pairs pass.
    const rel = Math.abs((MEAN_MOTION[a.planet1] ?? 1) - (MEAN_MOTION[a.planet2] ?? 1));
    const durationDays = rel > 0 ? Math.round(6 / rel) : 999;
    push({
      source: `aspect:${a.planet1}-${a.planet2}`,
      element: PLANET_ELEMENT[a.planet1],
      activities: [...th1.activities.slice(0, 2), ...th2.activities.slice(0, 1)],
      // Weight from both dignities; salience low relative to lunar work but
      // rising sharply as it perfects.
      weight: (dig(a.planet1) + dig(a.planet2)) / 2,
      salience: 0.55 * (0.35 + 0.65 * exact) * nat.strength,
      polarity,
      facts: { kind: "aspect", planet: a.planet1, partner: a.planet2, aspect: a.aspect,
               orbDeg: a.orb, applying: a.applying, durationDays },
      gift: PLANET_ROADS[a.planet1]?.gift, shadow: PLANET_ROADS[a.planet2]?.shadow,
      carriedBy: `${a.planet1} ${nat.ing} ${a.planet2}`,
      note: `${a.planet1} ${nat.word} ${a.planet2} (${a.orb.toFixed(1)}°${a.applying ? " applying" : " separating"}) — ${polarity > 0 ? "supports" : "complicates"} ${th2.verb}`,
    });
  }

  // Phase — where in the cycle.
  const waxing = !/wan|last quarter|balsamic/i.test(m.phaseName);
  push({ source: "phase", activities: waxing ? ["begin", "build"] : ["finish", "release"], weight: 1, salience: 0.5, polarity: 1,
    facts: { kind: "phase", planet: "Moon", phaseName: m.phaseName, waxing },
    note: `${m.phaseName} — ${waxing ? "waxing: build and begin" : "waning: finish and release"}` });

  // Void of course — a cautionary gate.
  if (m.voc) push({ source: "voc", activities: ["finish", "rest", "tidy"], weight: 1.3, salience: 0.7, polarity: -1,
    facts: { kind: "voc", planet: "Moon", sign: m.moonSign },
    shadow: "beginning something you want to last",
    note: "the Moon is void of course — slack water; begin nothing you want to last" });

  // Personal layer — transits to the natal chart, when a chart is present.
  if (opts.natal) T.push(...collectPersonal(m, opts.natal));

  return T;
}

export function synthesize(T: Testimony[], patterns: NamedPattern[] = []): DayReading {
  // Aggregate element pull (signed by polarity), and gather favoured activities.
  const elementScore: Record<string, number> = { fire: 0, earth: 0, air: 0, water: 0 };
  const activityScore = new Map<string, number>();
  for (const t of T) {
    if (t.element) elementScore[t.element] += t.score;
    const mag = t.weight * t.salience;
    for (const a of t.activities) if (t.polarity > 0) activityScore.set(a, (activityScore.get(a) ?? 0) + mag);
  }
  const topElement = (Object.entries(elementScore).sort((a, b) => b[1] - a[1])[0] ?? ["water", 0]) as [Element, number];
  const foci = [...activityScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a);

  // Counterpoint first (computed below from the strongest dissenting voice) so
  // the watch list can avoid repeating the same sentence on the card.

  // Convergence: the loudest supportive testimony carrying the top element. The
  // flavour names the element as a resource to spend (Forrest's "treasure"), then
  // the voice that carries it.
  const bySalience = [...T].sort((a, b) => b.salience - a.salience);
  const lead = bySalience.find(t => t.polarity > 0 && t.element === topElement[0]) ?? bySalience.find(t => t.polarity > 0) ?? T[0];
  const ELEMENT_WORD: Record<Element, string> = {
    fire: "a fire day", earth: "an earth day", air: "an air day", water: "a water day",
  };
  const gift = ELEMENT_ROADS[topElement[0]]?.gift;
  const flavour = `${ELEMENT_WORD[topElement[0]] ?? "a mixed day"}${gift ? ` — ${gift} to spend` : ""}${lead ? `, carried by ${lead.carriedBy ?? lead.note}` : ""}.`;

  // Counterpoint: the strongest testimony that cuts against the grain (opposite
  // polarity, or a strong voice in a different element) — named with its shadow.
  const counter = [...T].filter(t => t.polarity < 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  const addShadow = counter?.shadow && !counter.note.includes(counter.shadow);
  const counterpoint = counter && counter.weight * counter.salience > 0.5
    ? `— though ${counter.note}${addShadow ? ` (watch ${counter.shadow})` : ""}. Hold the day's shape loosely there.`
    : undefined;

  // Salience ranking — "what to watch now" — the loudest testimonies + named
  // patterns, minus whatever the counterpoint already says (no repeating the
  // same sentence twice on one card).
  // `source` rides along so the CLIENT can drop a line it has already spoken in
  // its own words — the hero's guidance now reconciles a void directly, and
  // without this the same instruction arrived again as "what to watch".
  const watch = [
    ...T.filter(t => !(counterpoint && t === counter)).map(t => ({ note: t.note, salience: t.salience, source: t.source })),
    ...patterns.map(p => ({ note: p.reading, salience: p.salience, source: p.name })),
  ].sort((a, b) => b.salience - a.salience).slice(0, 3);

  return {
    flavour, element: topElement[0], foci, watch, counterpoint,
    // Which testimony the counterpoint speaks for. The client's hero card may
    // already have said this in its own voice (the guidance line reconciles a
    // void directly), and a card that states one fact three ways stops sounding
    // like it knows what it thinks. Naming the source lets the client dedupe on
    // identity rather than by matching prose.
    counterpointSource: counterpoint ? counter?.source : undefined,
    patterns, testimonies: T.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)),
  };
}

/** Convenience: the woven reading for a moment. */
export function dayReading(date: Date, lat: number, lon: number, opts: ReadingOptions = {}): DayReading {
  const m = gather(date, lat, lon, opts);
  const T = collectFrom(m, opts);
  const patterns = matchPatterns({
    positions: m.positions.map(p => ({ planet: p.planet, longitude: p.longitude, sign: p.sign, retrograde: p.retrograde })),
    aspects: m.aspects, sunLongitude: m.sunLon, voc: m.voc,
    // The hour-bound pattern (doubled day) only makes sense at moment scope.
    hourRuler: opts.scope === "day" ? undefined : m.hour.ruler,
    ascRuler: opts.ascRuler,
  });
  return synthesize(T, patterns);
}
