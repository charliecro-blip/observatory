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
import { PLANETS as LEXICON_PLANETS } from "../../../../lib/lexicon/src/planets.js";
import { getPlanetPositions, getPlanetaryHour, getMajorAspects, moonPhase, voidOfCourse, julianDay, getSunriseSunset } from "./astro.js";
import type { PlanetAspect } from "./astro.js";
import { computeQualifiers } from "./qualifiers.js";
import { dignity } from "./dignity.js";
import { an } from "./article.js";
import { voidReading } from "./voidOfCourse.js";
import { matchPatterns, type NamedPattern } from "./patterns.js";
import { SIGN_GUIDE } from "./interpretation.js";

type Element = "fire" | "earth" | "air" | "water";
const PLANET_ELEMENT: Record<string, Element> = {
  Sun: "fire", Moon: "water", Mercury: "air", Venus: "earth", Mars: "fire", Jupiter: "fire", Saturn: "earth",
  // By modern rulership (Aquarius, Pisces, Scorpio). Their absence meant every
  // Moon-to-outer testimony would have carried element: undefined.
  Uranus: "air", Neptune: "water", Pluto: "water",
};
const PLANET_THEME: Record<string, { verb: string; activities: string[] }> = Object.fromEntries(
  Object.values(LEXICON_PLANETS).filter(p => p.theme).map(p => [p.key, p.theme!]),
);

// Two roads — the gift to spend and the shadow to watch (same neutral energy,
// high road / low road). Arroyo's positive-negative table + Forrest's elements.
// gift / shadow / WORK. The third field was missing and its absence showed:
// the day's edge named a hazard and stopped there ("the sharpest caution is
// impatience, a short fuse"), which tells a reader to brace without telling
// them what to do. Naming a difficulty without an outlet is just a warning
// label. `work` is the outlet — where the same energy can legitimately go,
// concrete enough to act on within the hour.
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const PLANET_ROADS: Record<string, { gift: string; shadow: string; work: string }> = Object.fromEntries(
  Object.values(LEXICON_PLANETS).filter(p => p.roads).map(p => [p.key, p.roads!]),
);
const ELEMENT_ROADS: Record<Element, { gift: string; shadow: string; work: string }> = {
  fire:  { gift: "nerve, and a fast start", shadow: "burning out, or through people",
           work: "spend it on the first hard thing, then let it bank" },
  earth: { gift: "steadiness, and follow-through", shadow: "the rut, the grind, never good-enough",
           work: "finish one real piece; call good-enough enough" },
  air:   { gift: "perspective, and quick connection", shadow: "all talk and no move, the overthink",
           work: "say it to one person, or write it — then act on the smallest bit" },
  water: { gift: "feeling, and renewal", shadow: "the overwhelm, the retreat",
           work: "let the feeling move — water, rest, one person — without deciding in it" },
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

/**
 * WHAT THE DAY IS ABOUT — the owner's ordering, 2026-08-22:
 *
 *   "planetary hours and days are very much secondary to lunar placement and
 *    aspects and other planetary aspects… that rule can be applied pretty much
 *    throughout the app. VoC is also very useful"
 *
 * The engine had it close to backwards. Measured over 2026, the day led with an
 * AMBIENT fact — sect, the hour, the out-of-sect malefic — on 45% of days.
 * Those are not events: sect is fixed all day, the hour rotates every sixty
 * minutes, and the out-of-sect malefic is the same planet every daytime of the
 * year. Meanwhile a Venus–Saturn opposition at 0.2° ranked NINTH of eleven, and
 * a Moon 0.18° off Pluto ranked fourth.
 *
 * Salience is now assigned by that hierarchy rather than by feel, and the lead
 * rates it produces are in the commit message. Env overrides exist so the next
 * person can re-sweep instead of guessing.
 */
const SAL = {
  // Primary: the Moon, and real aspects between planets.
  moonAspect: Number(process.env.COMPASS_SAL_MOONASPECT ?? 0.90),
  aspect:     Number(process.env.COMPASS_SAL_ASPECT ?? 0.78),
  moonSign:   Number(process.env.COMPASS_SAL_MOONSIGN ?? 0.55),
  phase:      Number(process.env.COMPASS_SAL_PHASE ?? 0.50),
  // Exactness is rarity. A partile aspect is the headline, whatever it joins.
  partileBoost: Number(process.env.COMPASS_PARTILE_BOOST ?? 1.45),
  // Secondary: ambient conditions, true most days by construction.
  sect:        Number(process.env.COMPASS_SAL_SECT ?? 0.34),
  sectMalefic: Number(process.env.COMPASS_SAL_SECTMALEFIC ?? 0.30),
  hour:        Number(process.env.COMPASS_SAL_HOUR ?? 0.26),
  dayRuler:    Number(process.env.COMPASS_SAL_DAYRULER ?? 0.22),
  // The Sun meets a node about twice a year; the Moon about twice a month.
  nodeSun:     Number(process.env.COMPASS_SAL_NODESUN ?? 0.92),
  nodeMoon:    Number(process.env.COMPASS_SAL_NODEMOON ?? 0.62),
  // AN ERA IS AMBIENT TOO. Rarity is salience, and a configuration that has
  // been in orb for two years is not what today is about. Uranus–Pluto sits in
  // orb for ~750 days and led 34 days of 2026 once these aspects were given a
  // voice; Saturn–Neptune (~214 days) led 24. They belong in the reading — they
  // had none at all before — but as the weather the day happens inside, which
  // is what this collector's own comment always said they were. durationDays
  // was already computed and filed in the facts; nothing read it.
  eraAnchor:   Number(process.env.COMPASS_ERA_ANCHOR ?? 45),
  eraExp:      Number(process.env.COMPASS_ERA_EXP ?? 0.5),
};
/** 1.0 for a configuration that passes within a few weeks, falling away for one
 *  that stands for years. */
const eraFactor = (durationDays: number) =>
  Math.min(1, Math.pow(SAL.eraAnchor / Math.max(1, durationDays), SAL.eraExp));

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
  kind: "sect" | "sectMalefic" | "hour" | "dayRuler" | "moonSign" | "moonAspect" | "aspect" | "phase" | "voc" | "node";
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
  carriedBy?: string;          // fragment that reads after "with …" in the flavour —
                               // a standing condition, never a rival to the READ lead
  gift?: string;               // the high road — what this voice offers
  shadow?: string;             // the low road — what to watch (feeds caution-windows)
  /** Where the same energy can legitimately go. A shadow named without an
   *  outlet is a warning label, not guidance — this is the outlet. */
  work?: string;
  score: number;               // weight × salience × polarity (signed)
}

/**
 * THE SUBJECT — the body running this moment, when one genuinely is.
 *
 * Measured after the owner read a panel in which five of the eight strongest
 * testimonies were Venus and the interface said so nowhere, splitting her
 * across three duration bands in three grammars (2026-08-21). When one body
 * carries a large enough share of the moment's weight, that IS the finding,
 * and the ways it pulls are the detail. Absent on an ordinary day, which is
 * most days — see SUBJECT_SHARE.
 */
export interface ReadingSubject {
  planet: string;
  /** Share of the moment's total weight (salience × weight) carried by this body. */
  share: number;
  /** How many of the strongest `ofTop` testimonies are this body's. */
  count: number;
  ofTop: number;
  /** Where it helps, where it presses, what it argues with — its own words. */
  supports: string[];
  presses: string[];
  against: string[];
  gift?: string;
  shadow?: string;
}

export interface DayReading {
  flavour: string;             // the woven whole, one sentence
  subject?: ReadingSubject;    // the body running the moment, when one is
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
export interface ReadingOptions {
  /** How many transit-to-natal testimonies survive. 4 (the default) keeps a day
   *  card about today; the feeling door raises it so slow transits can speak. */
  personalLimit?: number; tzOffsetMin?: number; ascRuler?: string; scope?: "moment" | "day"; natal?: NatalForReading; }

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
// The outers' verbs. Their gift/shadow/work come from the lexicon, which is the
// one record per planet — they were duplicated here and the copies had already
// started to matter, since anything reading PLANET_ROADS got undefined.
const OUTER_VERB: Record<string, string> = {
  Uranus: "breaking the old pattern", Neptune: "dissolving and imagining", Pluto: "deep renovation",
};
const OUTER_THEME: Record<string, { verb: string; gift: string; shadow: string; work: string }> =
  Object.fromEntries(Object.entries(OUTER_VERB).map(([k, verb]) => {
    const r = LEXICON_PLANETS[k]?.roads;
    return [k, { verb, gift: r?.gift ?? "", shadow: r?.shadow ?? "", work: r?.work ?? "" }];
  }));
// What a natal point MEANS when something lands on it.
const NATAL_POINT_WORD: Record<string, string> = {
  Sun: "your sense of yourself", Moon: "your inner life", Mercury: "your thinking", Venus: "the way you relate",
  Mars: "your drive", Jupiter: "your sense of possibility", Saturn: "what holds you up",
  Uranus: "your need for room", Neptune: "your imagination", Pluto: "your depths",
  ASC: "how you meet the world", MC: "your work in the world",
  Fortune: "your body and what sustains it",
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

function collectPersonal(m: Moment, natal: NatalForReading, limit = 4): Testimony[] {
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
      const roads = PLANET_ROADS[t.planet] ?? (outer ? { gift: outer.gift, shadow: outer.shadow, work: outer.work } : undefined);
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
          // THE SECOND HALF SAYS SOMETHING NEW. It used to read "— support for
          // {targetWord}" after naming {targetWord}, so the line stated its own
          // subject twice and added one valence word ("Venus strikes sparks
          // with your sense of yourself — support for your sense of yourself",
          // owner 2026-08-21). The transiting planet's own gift or shadow is
          // the information the reader did not already have.
          : `${t.planet} ${word} ${targetWord} (${best.orb.toFixed(1)}°)${
              roads ? (polarity > 0 ? ` — ${roads.gift}` : ` — watch ${roads.shadow}`) : ""}`,
        score: 0, // filled by caller
      });
    }
  }
  // The loudest few join the reading — enrich the convergence, don't drown the sky.
  //
  // The cut is by salience × dignity, and outer-planet transits carry salience
  // 0.45 against 0.7–0.85 for the fast ones, so they never survive four slots.
  // That is right for a day card, where a Pluto square is the chapter and not
  // the news. It is wrong for a reader who has just typed "obsessive, can't let
  // it go", which is a question ABOUT the chapter — measured across 2026, the
  // feeling door found Uranus and Pluto live on 0 days out of 365 because of
  // this line. Callers who want the slow voices raise the limit.
  return out
    .sort((a, b) => b.salience * b.weight - a.salience * a.weight)
    .slice(0, limit)
    .map(t => ({ ...t, score: t.weight * t.salience * t.polarity }));
}

// One gather of the sky, shared by the testimony collectors and the pattern matcher.
interface Moment {
  positions: ReturnType<typeof getPlanetPositions>;
  jd: number;
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
  //
  // Under polar day or night there is no sunrise to compare against, and
  // getSunriseSunset substitutes a symmetric twelve-hour day so callers always
  // get a Date. Comparing to that substitute would put a Tromsø user in
  // December on the wrong side of sect for half of every day — and sect drives
  // dignity, so exaltation and triplicity would be wrong with it.
  //
  // Unlike planetary hours, sect is ANSWERABLE here rather than fictional: in
  // polar night the Sun is below the horizon the whole time, in polar day it is
  // above. So this is corrected, not withheld.
  const { sunrise, sunset, polar } = getSunriseSunset(jd, lat, lon);
  const isDay = polar ? polar === "day" : (date >= sunrise && date < sunset);
  const dig = (name: string) => dignity(name, lonOf(name), { retrograde: retroOf(name), sunLongitude: sunLon, isDay }).weight;
  const aspects = getMajorAspects(jd);
  // Day-of-week ruler in the VIEWER's calendar (matches the /tides/now convention).
  const tz = opts.tzOffsetMin ?? 0;
  return {
    positions, jd, aspects, sunLon, isDay,
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
  push({ source: "sect", element: PLANET_ELEMENT[hero], activities: hTheme.activities, weight: hw, salience: SAL.sect, polarity: 1,
    facts: { kind: "sect", planet: hero, dignity: hw, isDay: m.isDay, verb: hTheme.verb },
    gift: PLANET_ROADS[hero].gift, shadow: PLANET_ROADS[hero].shadow,
    // "STEADIEST", not strongest — and deliberately not "carried by", which
    // collided with the READ zone's "LED BY" a few lines below it. The owner
    // read a hero saying the day was "carried by Sun" directly above "LED BY
    // Venus" and reasonably asked which it was.
    //
    // They answer different questions and both are true: the sect benefic is
    // the day's most RELIABLE voice, a standing condition of the whole day;
    // the lead is the loudest thing happening NOW. Two facts, so the fix is
    // wording that cannot be mistaken for a rival claim to the same throne.
    carriedBy: `${hero} steady underneath — ${hTheme.verb}`,
    note: `${hero} is the ${m.isDay ? "day" : "night"}'s most reliable voice${hw >= 1.2 ? ", strongly placed" : hw <= 0.7 ? ", though faintly placed" : ""} — ${hTheme.verb} carries best all day` });
  const mw = dig(sect.malefic);
  push({ source: "sectMalefic", activities: [], weight: mw, salience: SAL.sectMalefic, polarity: -1,
    facts: { kind: "sectMalefic", planet: sect.malefic, dignity: mw, isDay: m.isDay },
    shadow: PLANET_ROADS[sect.malefic].shadow,
    work: PLANET_ROADS[sect.malefic].work,
    note: `${sect.malefic} runs with a rougher edge ${m.isDay ? "by day" : "at night"} — the sharpest caution is ${PLANET_ROADS[sect.malefic].shadow}. ${cap(PLANET_ROADS[sect.malefic].work)}.` });

  // Planetary hour — the rotating sub-mood, weighted by the hour ruler's dignity.
  // Skipped at day scope: an hour-bound voice would go stale over a whole day.
  const hourW = dig(m.hour.ruler), ht = PLANET_THEME[m.hour.ruler];
  if (ht && opts.scope !== "day") push({ source: "hour", element: PLANET_ELEMENT[m.hour.ruler], activities: ht.activities, weight: hourW, salience: SAL.hour, polarity: 1,
    facts: { kind: "hour", planet: m.hour.ruler, dignity: hourW, verb: ht.verb },
    gift: PLANET_ROADS[m.hour.ruler].gift, shadow: PLANET_ROADS[m.hour.ruler].shadow,
    carriedBy: `the ${m.hour.ruler} hour, leaning toward ${ht.verb}`,
    note: `the ${m.hour.ruler} hour (${hourW >= 1.2 ? "dignified — trust it" : hourW <= 0.6 ? "weak — a faint voice" : "middling"}) leans toward ${ht.verb}` });

  // The planetary day — a whole day has one keynote.
  const dw = dig(m.dayRuler), dt = PLANET_THEME[m.dayRuler];
  if (dt) push({ source: "dayRuler", element: PLANET_ELEMENT[m.dayRuler], activities: dt.activities, weight: dw, salience: SAL.dayRuler, polarity: 1,
    facts: { kind: "dayRuler", planet: m.dayRuler, dignity: dw, verb: dt.verb },
    gift: PLANET_ROADS[m.dayRuler].gift, shadow: PLANET_ROADS[m.dayRuler].shadow,
    carriedBy: `${m.dayRuler}'s day — ${dt.verb}`,
    note: `${m.dayRuler}'s day — ${dt.verb}` });

  // The Moon's sign — the day's felt character (weighted by the Moon's dignity).
  const sg = SIGN_GUIDE[m.moonSign];
  if (sg) push({ source: "moonSign", element: sg.element as Element, activities: sg.favors.slice(0, 3), weight: dig("Moon"), salience: SAL.moonSign, polarity: 1,
    facts: { kind: "moonSign", planet: "Moon", sign: m.moonSign, dignity: dig("Moon") },
    gift: ELEMENT_ROADS[sg.element as Element].gift, shadow: ELEMENT_ROADS[sg.element as Element].shadow,
    carriedBy: `${an(m.moonSign)} Moon — ${sg.feel}`,
    note: `${an(m.moonSign)} Moon — ${sg.feel}` });

  // Applying Moon aspects — the day's engine. Nature sets polarity + strength;
  // salience scales with exactness × the aspect's strength; weight from the
  // partner's dignity. Separating aspects are framing-only — skipped here.
  // THREE BUGS LIVED HERE, and together they threw away the most striking
  // thing a month contains. On 2026-06-13 the Moon sat 0.31° from Uranus and
  // the day led with "the Mercury hour"; on 2026-05-08 it was 0.18° from Pluto
  // and led with Mars-by-sect, which is true every daytime of the year.
  //
  //  1. PLANET_THEME is built from the lexicon entries that carry a `theme`,
  //     and Uranus, Neptune and Pluto carry none — so `if (!th) continue`
  //     silently dropped EVERY Moon-to-outer aspect that has ever occurred.
  //     OUTER_THEME already existed for exactly this and collectPersonal
  //     already falls back to it; this loop never did.
  //  2. `.slice(0, 3)` ran on the array in whatever order the aspect scan
  //     emitted, so a partile conjunction lost its slot to looser aspects
  //     that merely came first. Sorted by orb now.
  //  3. Separating aspects were skipped as framing-only. That is the right
  //     rule for prediction — the event has passed — but this card describes
  //     present conditions, and a Moon a third of a degree past exact is
  //     unmistakably the current weather. Still-partile separations count.
  const PARTILE = 1.5;
  // RARITY IS SALIENCE. Measured over 2026, the day led with an AMBIENT fact on
  // 45% of days — "Jupiter is the day's most reliable voice" (sect, 17%), "the
  // Mercury hour" (13%), "Mars runs with a rougher edge by day" (12%). Sect is
  // fixed all day, the hour rotates every sixty minutes, and the out-of-sect
  // malefic is the same planet every daytime of the year. None of them is what
  // today is ABOUT.
  //
  // Meanwhile a Moon aspect inside 1° — which happens on 34% of days and lasts
  // a couple of hours — led only 40% of the time it occurred, because `weight`
  // is dignity and a dignified Mars (1.80) outscores an undignified Pluto
  // (1.00) by enough to overturn the salience gap. So the Moon 0.18° from Pluto
  // came fourth, under two facts that are true every daytime of the year.
  //
  // The boost is on exactness, not on the aspect or the partner: a partile
  // Moon-Saturn square is a headline for the same reason a Moon-Pluto
  // conjunction is. Calibrated by sweep — see the table in the commit.

  const moonAspects = m.moonAspects
    .filter(a => a.applying || a.orb <= PARTILE)
    .sort((x, y) => x.orb - y.orb)
    .slice(0, 3);
  for (const a of moonAspects) {
    const other = a.planet1 === "Moon" ? a.planet2 : a.planet1;
    const nat = ASPECT_NATURE[a.aspect];
    const outer = OUTER_THEME[other];
    const th = PLANET_THEME[other] ?? (outer ? { verb: outer.verb, activities: [] as string[] } : null);
    const roads = PLANET_ROADS[other] ?? (outer ? { gift: outer.gift, shadow: outer.shadow } : null);
    if (!th || !nat || !roads) continue;  // an aversion, or a body with no voice
    const exact = Math.max(0, 1 - a.orb / 8);
    // Combine aspect harmony with the partner's valence: a trine to a malefic is
    // still mildly supportive; a square to a benefic is still mildly hard.
    const score = nat.harmony !== 0 ? nat.harmony + 0.5 * (VALENCE[other] ?? 0) : (VALENCE[other] || 0.3);
    const polarity: 1 | -1 = score >= 0 ? 1 : -1;
    const motion = a.applying ? "applying" : "separating";
    push({ source: `moonAspect:${other}`, element: PLANET_ELEMENT[other], activities: th.activities,
      weight: dig(other),
      salience: SAL.moonAspect * (0.4 + 0.6 * exact) * nat.strength * (a.orb <= 1 ? SAL.partileBoost : 1),
      polarity,
      // The orb and the aspect name were readable only by parsing `note` back
      // out of English — the one thing a second register could never do.
      facts: { kind: "moonAspect", planet: "Moon", partner: other, aspect: a.aspect,
               orbDeg: a.orb, applying: a.applying, dignity: dig(other), verb: th.verb },
      gift: roads.gift, shadow: roads.shadow,
      carriedBy: `the Moon ${nat.ing} ${other} — ${polarity > 0 ? "flow toward" : "friction around"} ${th.verb}`,
      note: `Moon ${nat.word} ${other} (${a.orb.toFixed(1)}° ${motion}) — ${polarity > 0 ? "flow toward" : "friction around"} ${th.verb}` });
  }

  // ── The nodes ──────────────────────────────────────────────────────────────
  //
  // These produced NO testimony at all — grep for "node" in this file before
  // 2026-08-22 and there was nothing. The owner built a client reading around a
  // Sun–South Node conjunction on 2026-08-21 and the engine had no word for it.
  // The Sun meets a node about twice a year, which makes it one of the rarest
  // things the reading can ever say, and rarity is salience.
  //
  // The copy is lifted from qualifiers.ts rather than rewritten, so the node's
  // voice has one home and the two surfaces cannot drift.
  for (const q of computeQualifiers(m.jd, m.positions)) {
    if (!q.key.endsWith("-node")) continue;
    const planet = q.bodies[0];
    if (!planet) continue;
    const south = q.key.includes("-south-");
    push({ source: `node:${planet}-${south ? "South" : "North"}`, element: PLANET_ELEMENT[planet],
      activities: [], weight: dig(planet),
      salience: planet === "Sun" ? SAL.nodeSun : SAL.nodeMoon,
      polarity: south ? -1 : 1,
      facts: { kind: "node", planet, partner: south ? "South Node" : "North Node" },
      gift: PLANET_ROADS[planet]?.gift, shadow: PLANET_ROADS[planet]?.shadow,
      carriedBy: q.plain,
      note: `${q.literal} — ${q.approach}` });
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
  // CAPPED, like the Moon loop above. This one was unbounded, which never
  // showed while every outer-planet pair was being silently dropped: once they
  // gained a voice the average moment carried 6.2 non-lunar aspects and the
  // worst carried 17. That diluted the shares the reading's SUBJECT and its
  // QUIET state are computed from — the quiet sky fell from 20% of moments to
  // 1.7%, which is the exact bug ("quiet was impossible") those thresholds were
  // set to fix. Three loudest, and the receipt can show the rest.
  const nonLunar: Testimony[] = [];
  for (const a of m.aspects.filter(x => x.planet1 !== "Moon" && x.planet2 !== "Moon")) {
    // Tight only. A 6° Jupiter–Saturn is real but it is background to the
    // background; the surface has no room for it and the receipt can show it.
    if (a.orb > 3) continue;
    const nat = ASPECT_NATURE[a.aspect];
    // THE SAME OUTER-PLANET GAP AS THE MOON LOOP. PLANET_THEME covers only the
    // seven traditional planets, so `!th1 || !th2` silenced every tight aspect
    // involving Uranus, Neptune or Pluto — 66 distinct ones across 2026, the
    // Saturn–Neptune conjunction this collector's own comment was written for
    // among them. OUTER_THEME supplies the verb; activities stay empty, since
    // an outer planet has no list of things to go and do.
    const th1 = PLANET_THEME[a.planet1] ?? (OUTER_THEME[a.planet1] ? { verb: OUTER_THEME[a.planet1].verb, activities: [] as string[] } : null);
    const th2 = PLANET_THEME[a.planet2] ?? (OUTER_THEME[a.planet2] ? { verb: OUTER_THEME[a.planet2].verb, activities: [] as string[] } : null);
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
    nonLunar.push({
      score: 0, source: `aspect:${a.planet1}-${a.planet2}`,
      element: PLANET_ELEMENT[a.planet1],
      activities: [...th1.activities.slice(0, 2), ...th2.activities.slice(0, 1)],
      // Weight from both dignities; salience low relative to lunar work but
      // rising sharply as it perfects.
      weight: (dig(a.planet1) + dig(a.planet2)) / 2,
      // Capped below the Moon's own scalar, deliberately. These persist for
      // days; the Moon moves in hours. If the standing weather could outshout
      // her the read would stop changing between morning and evening, which is
      // the one thing this family must never do — it is the weather the day
      // happens inside, and the Moon is the engine. Raising SAL.aspect to 0.78
      // let a partile Venus–Mars reach 1.13 without this.
      salience: Math.min(
        SAL.moonAspect * 0.95,
        SAL.aspect * (0.35 + 0.65 * exact) * nat.strength * (a.orb <= 1 ? SAL.partileBoost : 1) * eraFactor(durationDays),
      ),
      polarity,
      facts: { kind: "aspect", planet: a.planet1, partner: a.planet2, aspect: a.aspect,
               orbDeg: a.orb, applying: a.applying, durationDays },
      gift: PLANET_ROADS[a.planet1]?.gift ?? OUTER_THEME[a.planet1]?.gift,
      shadow: PLANET_ROADS[a.planet2]?.shadow ?? OUTER_THEME[a.planet2]?.shadow,
      carriedBy: `${a.planet1} ${nat.ing} ${a.planet2}`,
      note: `${a.planet1} ${nat.word} ${a.planet2} (${a.orb.toFixed(1)}°${a.applying ? " applying" : " separating"}) — ${polarity > 0 ? "supports" : "complicates"} ${th2.verb}`,
    });
  }
  nonLunar.sort((x, y) => y.salience * y.weight - x.salience * x.weight);
  for (const t of nonLunar.slice(0, 3)) push(t as Parameters<typeof push>[0]);

  // Phase — where in the cycle.
  const waxing = !/wan|last quarter|balsamic/i.test(m.phaseName);
  push({ source: "phase", activities: waxing ? ["begin", "build"] : ["finish", "release"], weight: 1, salience: 0.5, polarity: 1,
    facts: { kind: "phase", planet: "Moon", phaseName: m.phaseName, waxing },
    note: `${m.phaseName} — ${waxing ? "waxing: build and begin" : "waning: finish and release"}` });

  // Void of course — a cautionary gate.
  if (m.voc) {
    // Sign-specific, because a void in Taurus and a void in Capricorn are not
    // the same afternoon — and because Lilly exempts four signs outright, which
    // changes the counsel from "wait it out" to "use it".
    const vr = voidReading(m.moonSign);
    // Salience above every other testimony (the next highest is 0.9). When the
    // Moon makes no further contact, that fact governs what the rest of the
    // reading MEANS — a "fire day, courage to spend" over a void Moon is not a
    // second opinion, it is advice that will not work.
    push({ source: "voc", activities: vr?.benign ? ["rest", "tend", "finish"] : ["finish", "rest", "tidy"],
      weight: 1.3, salience: 1.0, polarity: -1,
      facts: { kind: "voc", planet: "Moon", sign: m.moonSign },
      shadow: "beginning something you want to last",
      carriedBy: vr ? `the Moon void in ${m.moonSign} — ${vr.instead}` : undefined,
      note: vr
        ? `the Moon is void in ${m.moonSign} — ${vr.feel}`
        : "the Moon is void of course — slack water; begin nothing you want to last" });
  }

  // Personal layer — transits to the natal chart, when a chart is present.
  if (opts.natal) T.push(...collectPersonal(m, opts.natal, opts.personalLimit));

  return T;
}

/**
 * Which body a testimony speaks for. Structural Moon sources (her sign, the
 * phase, the void) are excluded from CANDIDACY below: the Moon is in every
 * reading by construction, so "the Moon runs today" would be a label rather
 * than news. She still has to earn it through aspects and transits.
 */
export function subjectOf(t: Testimony): string | null {
  const src = t.source;
  if (src.startsWith("transit:")) return src.slice(8).split("→")[0];
  if (src.startsWith("moonAspect:")) return "Moon";
  if (src.startsWith("aspect:")) return null;         // a pair, not a subject
  const f = t.facts as { planet?: string } | undefined;
  return f?.planet ?? null;
}
/**
 * Sources that are true of their body EVERY day — the Moon's sign, the phase,
 * the void, the weekday's ruler. They are excluded from the share arithmetic
 * on both sides, so the question the share answers is "of what is specifically
 * true right now, how much is this body's" rather than "who appears most",
 * which the Moon wins by construction.
 */
const STRUCTURAL = new Set(["moonSign", "phase", "voc", "dayRuler"]);
/**
 * The bar, set by measured fire rate rather than taste (memory: calibrate
 * thresholds by fire rate, never by the median). Over 120 days from this
 * build, counting earned testimonies only:
 *
 *   0.34 → 54% of moments   too common to be a finding
 *   0.38 → 33%              Moon 19, Mars 12, Mercury 3, Jupiter 3, Venus 2, Sun 1
 *   0.42 → 20%
 *   0.50 →  8%              nearly always the Moon; a curiosity, not a feature
 *
 * 0.38 fires on about one moment in three and spreads across six bodies,
 * which is what "one body is running this" should mean.
 */
const SUBJECT_SHARE = 0.38;
const SUBJECT_MIN_EARNED = 2;

export function readingSubject(T: Testimony[]): ReadingSubject | undefined {
  const mag = (t: Testimony) => t.weight * t.salience;
  const kindOf = (t: Testimony) => ((t.facts as { kind?: string } | undefined)?.kind) ?? "";
  const earnedAll = T.filter(t => !STRUCTURAL.has(kindOf(t)));
  const total = earnedAll.reduce((n, t) => n + mag(t), 0);
  if (total <= 0) return undefined;

  // A TWO-BODY TESTIMONY BELONGS TO BOTH, HALF EACH.
  //
  // subjectOf answers null for `aspect:` — right, since a pair has no single
  // subject — but the share arithmetic then put those testimonies in the
  // DENOMINATOR and in nobody's numerator. Any planet whose loudest appearance
  // was a planet-to-planet aspect was penalised for it, and once those aspects
  // stopped being silent (2026-08-22) the penalty got much worse: on the
  // evening of 2026-08-21 the day's second-loudest voice was Venus opposite
  // Saturn at 0.2° and Venus lost the subject she had held.
  const by = new Map<string, Testimony[]>();
  const shareBy = new Map<string, number>();
  const credit = (p: string, m: number, t: Testimony) => {
    shareBy.set(p, (shareBy.get(p) ?? 0) + m);
    by.set(p, [...(by.get(p) ?? []), t]);
  };
  for (const t of earnedAll) {
    const m = mag(t);
    if (t.source.startsWith("aspect:")) {
      const [a, b] = t.source.slice(7).split("-");
      if (a && b) { credit(a, m / 2, t); credit(b, m / 2, t); }
      continue;
    }
    if (t.source.startsWith("moonAspect:")) {
      const partner = t.source.slice("moonAspect:".length);
      credit("Moon", m / 2, t);
      if (partner) credit(partner, m / 2, t);
      continue;
    }
    const p = subjectOf(t);
    if (p) credit(p, m, t);
  }
  const ranked = [...T].sort((a, b) => mag(b) - mag(a));
  const ofTop = Math.min(8, ranked.length);
  const targetOf = (t: Testimony) => t.source.split("\u2192")[1] ?? "";
  const word = (k: string) => NATAL_POINT_WORD[k] ?? k;

  let best: ReadingSubject | undefined;
  for (const [planet, ts] of by) {
    if (ts.length < SUBJECT_MIN_EARNED) continue;
    const share = (shareBy.get(planet) ?? 0) / total;
    if (share < SUBJECT_SHARE) continue;
    if (best && best.share >= share) continue;
    const roads = PLANET_ROADS[planet];
    best = {
      planet,
      share: parseFloat(share.toFixed(3)),
      count: ranked.slice(0, ofTop).filter(t => subjectOf(t) === planet).length,
      ofTop,
      supports: ts.filter(t => t.polarity > 0 && t.source.startsWith("transit:")).map(t => word(targetOf(t))),
      presses: ts.filter(t => t.polarity < 0 && t.source.startsWith("transit:")).map(t => word(targetOf(t))),
      against: T.filter(t => t.source.startsWith("aspect:") && t.source.includes(planet) && t.polarity < 0)
        .map(t => t.source.slice(7).split("-").find(x => x !== planet) ?? "").filter(Boolean),
      gift: roads?.gift,
      shadow: roads?.shadow,
    };
  }
  return best;
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
  // A void Moon PRE-EMPTS the lead. The filter below requires polarity > 0, so
  // before this the hero was structurally incapable of headlining the one fact
  // that most changes what to do with the next few hours — the reading would
  // open "a fire day — courage to spend" and mention the void, if at all, down
  // in the counterpoint. Salience alone could not fix that: no amount of it
  // gets a negative-polarity testimony past a positive-polarity filter.
  const voc = T.find(t => t.source === "voc");
  const lead = voc
    ?? bySalience.find(t => t.polarity > 0 && t.element === topElement[0])
    ?? bySalience.find(t => t.polarity > 0)
    ?? T[0];
  const ELEMENT_WORD: Record<Element, string> = {
    fire: "a fire day", earth: "an earth day", air: "an air day", water: "a water day",
  };
  const gift = ELEMENT_ROADS[topElement[0]]?.gift;
  // "with X underneath it" rather than "carried by X". The flavour describes a
  // STANDING condition of the whole day; the READ zone's LED BY names what is
  // loudest right now. Both were reading as the headline claim, so the hero
  // said the day was carried by the Sun immediately above LED BY Venus.
  // A void reads as the day's condition, not as something it is carried with —
  // "a fire day, with the Moon void in Aries" makes the void sound like an
  // accompaniment to the courage. It governs the sentence instead.
  const flavour = voc
    ? `${voc.carriedBy ?? voc.note}.`
    : `${ELEMENT_WORD[topElement[0]] ?? "a mixed day"}${gift ? ` — ${gift} to spend` : ""}${lead ? `, with ${lead.carriedBy ?? lead.note}` : ""}.`;

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
    subject: readingSubject(T),
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
