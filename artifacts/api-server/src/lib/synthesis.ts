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
  Sun:     { verb: "being seen and leading", activities: ["present", "decide", "put yourself forward"] },
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
const ASPECT_NATURE: Record<string, { harmony: -1 | 0 | 1; strength: number; word: string }> = {
  conjunction: { harmony: 0, strength: 1.0, word: "meets" },
  sextile:     { harmony: 1, strength: 0.5, word: "reaches easily to" },
  square:      { harmony: -1, strength: 1.0, word: "grinds against" },
  trine:       { harmony: 1, strength: 1.0, word: "flows to" },
  opposition:  { harmony: -1, strength: 0.9, word: "faces off with" },
};

export interface Testimony {
  source: string;              // "sect" | "sectMalefic" | "hour" | "dayRuler" | "moonSign" | "moonAspect:Venus" | "phase" | "voc"
  element?: Element;
  activities: string[];
  weight: number;              // dignity-driven
  salience: number;            // loudness now
  polarity: 1 | -1;
  note: string;                // plain-language, for the drill-down
  gift?: string;               // the high road — what this voice offers
  shadow?: string;             // the low road — what to watch (feeds caution-windows)
  score: number;               // weight × salience × polarity (signed)
}

export interface DayReading {
  flavour: string;             // the woven whole, one sentence
  foci: string[];              // concrete things it favours
  watch: { note: string; salience: number }[];  // top salience — "focus on this"
  counterpoint?: string;       // the honest "but…"
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
/** Options threaded from the caller (route): viewer timezone for the day-of-week
 *  ruler, the natal ascendant ruler for chart-aware patterns, and scope —
 *  "moment" includes the rotating planetary hour; "day" (reports, spanning the
 *  whole day) drops hour-bound voices so the reading stays true till evening. */
export interface ReadingOptions { tzOffsetMin?: number; ascRuler?: string; scope?: "moment" | "day"; }

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
  const sect = sectOf(m.isDay);
  const hero = sect.team.slice().sort((a, b) => dig(b) - dig(a))[0];
  const hw = dig(hero), hTheme = PLANET_THEME[hero];
  push({ source: "sect", element: PLANET_ELEMENT[hero], activities: hTheme.activities, weight: hw, salience: 0.55, polarity: 1,
    gift: PLANET_ROADS[hero].gift, shadow: PLANET_ROADS[hero].shadow,
    note: `a ${sect.chart} chart led by ${hero}${hw >= 1.2 ? ", well-conditioned" : hw <= 0.7 ? ", though weakly placed" : ""} — ${hTheme.verb} carries best through it` });
  const mw = dig(sect.malefic);
  push({ source: "sectMalefic", activities: [], weight: mw, salience: 0.6, polarity: -1,
    shadow: PLANET_ROADS[sect.malefic].shadow,
    note: `${sect.malefic} is out of sect in a ${sect.chart} chart — its edge runs unchecked; the day's sharpest caution is ${PLANET_ROADS[sect.malefic].shadow}` });

  // Planetary hour — the rotating sub-mood, weighted by the hour ruler's dignity.
  // Skipped at day scope: an hour-bound voice would go stale over a whole day.
  const hourW = dig(m.hour.ruler), ht = PLANET_THEME[m.hour.ruler];
  if (ht && opts.scope !== "day") push({ source: "hour", element: PLANET_ELEMENT[m.hour.ruler], activities: ht.activities, weight: hourW, salience: 0.6, polarity: 1,
    gift: PLANET_ROADS[m.hour.ruler].gift, shadow: PLANET_ROADS[m.hour.ruler].shadow,
    note: `the ${m.hour.ruler} hour (${hourW >= 1.2 ? "dignified — trust it" : hourW <= 0.6 ? "weak — a faint voice" : "middling"}) leans toward ${ht.verb}` });

  // The planetary day — a whole day has one keynote.
  const dw = dig(m.dayRuler), dt = PLANET_THEME[m.dayRuler];
  if (dt) push({ source: "dayRuler", element: PLANET_ELEMENT[m.dayRuler], activities: dt.activities, weight: dw, salience: 0.5, polarity: 1,
    gift: PLANET_ROADS[m.dayRuler].gift, shadow: PLANET_ROADS[m.dayRuler].shadow,
    note: `${m.dayRuler}'s day — ${dt.verb}` });

  // The Moon's sign — the day's felt character (weighted by the Moon's dignity).
  const sg = SIGN_GUIDE[m.moonSign];
  if (sg) push({ source: "moonSign", element: sg.element as Element, activities: sg.favors.slice(0, 3), weight: dig("Moon"), salience: 0.45, polarity: 1,
    gift: ELEMENT_ROADS[sg.element as Element].gift, shadow: ELEMENT_ROADS[sg.element as Element].shadow,
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
      gift: PLANET_ROADS[other].gift, shadow: PLANET_ROADS[other].shadow,
      note: `Moon ${nat.word} ${other} (${a.orb.toFixed(1)}° applying) — ${polarity > 0 ? "flow toward" : "friction around"} ${th.verb}` });
  }

  // Phase — where in the cycle.
  const waxing = !/wan|last quarter|balsamic/i.test(m.phaseName);
  push({ source: "phase", activities: waxing ? ["begin", "build"] : ["finish", "release"], weight: 1, salience: 0.5, polarity: 1,
    note: `${m.phaseName} — ${waxing ? "waxing: build and begin" : "waning: finish and release"}` });

  // Void of course — a cautionary gate.
  if (m.voc) push({ source: "voc", activities: ["finish", "rest", "tidy"], weight: 1.3, salience: 0.7, polarity: -1,
    shadow: "beginning something you want to last",
    note: "the Moon is void of course — slack water; begin nothing you want to last" });

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

  // Salience ranking — "what to watch now" — merging the loudest testimonies and
  // the loudest named patterns into one list.
  const watch = [
    ...T.map(t => ({ note: t.note, salience: t.salience })),
    ...patterns.map(p => ({ note: p.reading, salience: p.salience })),
  ].sort((a, b) => b.salience - a.salience).slice(0, 3);

  // Convergence: the loudest supportive testimony carrying the top element. The
  // flavour names the element as a resource to spend (Forrest's "treasure"), then
  // the voice that carries it.
  const bySalience = [...T].sort((a, b) => b.salience - a.salience);
  const lead = bySalience.find(t => t.polarity > 0 && t.element === topElement[0]) ?? bySalience.find(t => t.polarity > 0) ?? T[0];
  const ELEMENT_WORD: Record<Element, string> = {
    fire: "a fire day", earth: "an earth day", air: "an air day", water: "a water day",
  };
  const gift = ELEMENT_ROADS[topElement[0]]?.gift;
  const flavour = `${ELEMENT_WORD[topElement[0]] ?? "a mixed day"}${gift ? ` — ${gift} to spend` : ""}${lead ? `, carried by ${lead.note}` : ""}.`;

  // Counterpoint: the strongest testimony that cuts against the grain (opposite
  // polarity, or a strong voice in a different element) — named with its shadow.
  const counter = [...T].filter(t => t.polarity < 0 || (t.element && t.element !== topElement[0]))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  const addShadow = counter?.shadow && !counter.note.includes(counter.shadow);
  const counterpoint = counter && counter.weight * counter.salience > 0.5
    ? `— though ${counter.note}${addShadow ? ` (watch ${counter.shadow})` : ""}. Hold the day's shape loosely there.`
    : undefined;

  return { flavour, foci, watch, counterpoint, patterns, testimonies: T.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)) };
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
