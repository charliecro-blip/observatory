/**
 * Synthesis — brick 2 of the synthesis engine (spec: SYNTHESIS-ENGINE-SPEC.md).
 *
 * Turns the day's factors into a woven READING instead of a list. Each voice
 * (planetary hour, day ruler, Moon sign, applying Moon aspects, phase, VoC)
 * becomes a Testimony weighted by DIGNITY (lib/dignity.ts) and by SALIENCE
 * (how loud it is right now). We then find the convergence (the flavour), the
 * counterpoint (the honest "but…"), and rank salience ("what to watch"). v1:
 * a taste, wired to the sky we already compute; the named-pattern library and
 * natal-angle salience are later bricks.
 */
import { getPlanetPositions, getPlanetaryHour, getMajorAspects, moonPhase, voidOfCourse, julianDay } from "./astro.js";
import { dignity } from "./dignity.js";
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
const BENEFIC = new Set(["Venus", "Jupiter"]);
const MALEFIC = new Set(["Mars", "Saturn"]);

export interface Testimony {
  source: string;              // "hour" | "dayRuler" | "moonSign" | "moonAspect:Venus" | "phase" | "voc"
  element?: Element;
  activities: string[];
  weight: number;              // dignity-driven
  salience: number;            // loudness now
  polarity: 1 | -1;
  note: string;                // plain-language, for the drill-down
  score: number;               // weight × salience × polarity (signed)
}

export interface NamedPattern { name: string; reading: string }

export interface DayReading {
  flavour: string;             // the woven whole, one sentence
  foci: string[];              // concrete things it favours
  watch: { note: string; salience: number }[];  // top salience — "focus on this"
  counterpoint?: string;       // the honest "but…"
  patterns: NamedPattern[];
  testimonies: Testimony[];    // the parts, for the drill-down
}

// Rough sect: day if the Sun is above the horizon. Proxied by local hour until
// we thread sunrise/sunset (fine for triplicity weighting).
function isDaytime(localHour: number): boolean { return localHour >= 6 && localHour < 18; }

export function collectTestimonies(date: Date, lat: number, lon: number): Testimony[] {
  const jd = julianDay(date);
  const planets = getPlanetPositions(jd);
  const lonOf = (name: string) => planets.find(p => p.planet === name)?.longitude ?? 0;
  const retroOf = (name: string) => planets.find(p => p.planet === name)?.retrograde ?? false;
  const sunLon = lonOf("Sun");
  const localHour = date.getHours();
  const isDay = isDaytime(localHour);
  const dig = (name: string) => dignity(name, lonOf(name), { retrograde: retroOf(name), sunLongitude: sunLon, isDay }).weight;

  const hour = getPlanetaryHour(date, lat, lon);
  const dayRuler = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"][new Date(date).getUTCDay()];
  const { name: phaseName } = moonPhase(jd);
  const { voc } = voidOfCourse(jd);
  const moonSign = planets.find(p => p.planet === "Moon")!.sign;
  const moonAspects = getMajorAspects(jd).filter(a => a.planet1 === "Moon" || a.planet2 === "Moon");

  const T: Testimony[] = [];
  const push = (t: Omit<Testimony, "score">) => T.push({ ...t, score: t.weight * t.salience * t.polarity });

  // Planetary hour — the rotating sub-mood, weighted by the hour ruler's dignity.
  const hw = dig(hour.ruler), ht = PLANET_THEME[hour.ruler];
  if (ht) push({ source: "hour", element: PLANET_ELEMENT[hour.ruler], activities: ht.activities, weight: hw, salience: 0.6, polarity: 1,
    note: `the ${hour.ruler} hour (${hw >= 1.2 ? "dignified — trust it" : hw <= 0.6 ? "weak — a faint voice" : "middling"}) leans toward ${ht.verb}` });

  // The planetary day — a whole day has one keynote.
  const dw = dig(dayRuler), dt = PLANET_THEME[dayRuler];
  if (dt) push({ source: "dayRuler", element: PLANET_ELEMENT[dayRuler], activities: dt.activities, weight: dw, salience: 0.5, polarity: 1,
    note: `${dayRuler}'s day — ${dt.verb}` });

  // The Moon's sign — the day's felt character (weighted by the Moon's dignity).
  const sg = SIGN_GUIDE[moonSign];
  if (sg) push({ source: "moonSign", element: sg.element as Element, activities: sg.favors.slice(0, 3), weight: dig("Moon"), salience: 0.45, polarity: 1,
    note: `a ${moonSign} Moon — ${sg.feel}` });

  // Applying Moon aspects — the day's engine. Salience scales with exactness;
  // polarity from the aspect's nature; weight from the partner's dignity.
  for (const a of moonAspects.filter(a => a.applying).slice(0, 3)) {
    const other = a.planet1 === "Moon" ? a.planet2 : a.planet1;
    const th = PLANET_THEME[other]; if (!th) continue;
    const exact = Math.max(0, 1 - a.orb / 8);
    const hard = a.aspect === "square" || a.aspect === "opposition";
    const supportive = BENEFIC.has(other) || (!hard && !MALEFIC.has(other));
    push({ source: `moonAspect:${other}`, element: PLANET_ELEMENT[other], activities: th.activities, weight: dig(other), salience: 0.9 * (0.4 + 0.6 * exact),
      polarity: supportive ? 1 : -1,
      note: `Moon ${a.aspect} ${other} (${a.orb.toFixed(1)}°${a.applying ? " applying" : ""}) — ${hard ? "friction around" : "flow toward"} ${th.verb}` });
  }

  // Phase — where in the cycle.
  const waxing = !/wan|last quarter|balsamic/i.test(phaseName);
  push({ source: "phase", activities: waxing ? ["begin", "build"] : ["finish", "release"], weight: 1, salience: 0.5, polarity: 1,
    note: `${phaseName} — ${waxing ? "waxing: build and begin" : "waning: finish and release"}` });

  // Void of course — a cautionary gate.
  if (voc) push({ source: "voc", activities: ["finish", "rest", "tidy"], weight: 1.3, salience: 0.7, polarity: -1,
    note: "the Moon is void of course — slack water; begin nothing you want to last" });

  return T;
}

export function synthesize(T: Testimony[]): DayReading {
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

  // Salience ranking — "what to watch now".
  const bySalience = [...T].sort((a, b) => b.salience - a.salience);
  const watch = bySalience.slice(0, 2).map(t => ({ note: t.note, salience: t.salience }));

  // Convergence: the loudest supportive testimony carrying the top element.
  const lead = bySalience.find(t => t.polarity > 0 && t.element === topElement[0]) ?? bySalience.find(t => t.polarity > 0) ?? T[0];
  const ELEMENT_WORD: Record<string, string> = { fire: "a fire day — appetite for the direct move", earth: "an earth day — steady, practical ground", air: "an air day — words, ideas, exchange", water: "a water day — feeling and depth" };
  const flavour = `${ELEMENT_WORD[topElement[0]] ?? "a mixed day"}${lead ? `, carried by ${lead.note}` : ""}.`;

  // Counterpoint: the strongest testimony that cuts against the grain (opposite
  // polarity, or a strong voice in a different element).
  const counter = [...T].filter(t => t.polarity < 0 || (t.element && t.element !== topElement[0]))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  const counterpoint = counter && counter.weight * counter.salience > 0.5
    ? `— though ${counter.note}. Hold the day's shape loosely there.`
    : undefined;

  // A couple of named patterns inline (the full library is a later brick).
  const patterns: NamedPattern[] = [];
  if (T.some(t => t.source === "voc")) patterns.push({ name: "Void of course", reading: "The day's initiations won't take — finish, rest, review; don't launch." });
  const benefApply = T.find(t => /moonAspect:(Venus|Jupiter)/.test(t.source) && t.polarity > 0 && t.salience > 0.7);
  if (benefApply) patterns.push({ name: "Moon to benefic", reading: "The Moon is gathering a benefic — a graced window for the ask, the reach, the reaching-out." });
  const hardMalefic = T.find(t => /moonAspect:(Mars|Saturn)/.test(t.source) && t.polarity < 0 && t.salience > 0.7);
  if (hardMalefic) patterns.push({ name: "Moon to malefic (hard)", reading: "The Moon meets a malefic under tension — usable pressure for effortful work; watch reactivity." });

  return { flavour, foci, watch, counterpoint, patterns, testimonies: T.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)) };
}

/** Convenience: the woven reading for a moment. */
export function dayReading(date: Date, lat: number, lon: number): DayReading {
  return synthesize(collectTestimonies(date, lat, lon));
}
