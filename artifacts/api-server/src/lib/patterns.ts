/**
 * Patterns — brick 4 of the synthesis engine (spec: SYNTHESIS-ENGINE-SPEC.md).
 *
 * The purest "parts → whole": a geometric CONFIGURATION fires a NAMED reading.
 * This is where horary, Hellenistic, and Vedic all contribute. Each pattern is
 * a matcher over a PatternContext (the transiting sky ± an optional chart) that
 * returns a NamedPattern when it fires, or null. Seeded from the book library
 * (SYNTHESIS-BOOK-NOTES.md) — George's bonification/maltreatment conditions,
 * Hampar's Moon-elector rules, the horary doublings.
 *
 * Rendering rule (Arroyo): the `reading` speaks the BLENDED MEANING in plain
 * language — "wisdom and heart aligned," not "Gaja-Kesari present." The jargon
 * `name` only surfaces at full astro-detail.
 */
import type { PlanetAspect } from "./astro.js";
import { domicileLord } from "./dignity.js";

export interface NamedPattern {
  name: string;            // the jargon handle (full-detail only)
  reading: string;         // the blended meaning, plain language
  polarity: 1 | -1 | 0;    // supportive / cautionary / neutral
  salience: number;        // how loud this pattern is right now (~0..1)
}

export interface PatternContext {
  positions: Array<{ planet: string; longitude: number; sign: string; retrograde: boolean }>;
  aspects: PlanetAspect[];   // major aspects among planets (getMajorAspects)
  sunLongitude: number;
  voc: boolean;
  hourRuler?: string;        // when known
  ascRuler?: string;         // only when a chart exists
}

const BENEFIC = new Set(["Venus", "Jupiter"]);
const MALEFIC = new Set(["Mars", "Saturn"]);
const SOFT = new Set(["sextile", "trine"]);
const HARD = new Set(["square", "opposition"]);

const lonOf = (ctx: PatternContext, name: string): number | null =>
  ctx.positions.find(p => p.planet === name)?.longitude ?? null;

/** Shortest angular separation between two longitudes, 0..180. */
function sep(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return 180 - d;
}

/** The applying/closest major aspect between two named bodies, if any. */
function aspectBetween(ctx: PatternContext, a: string, b: string): PlanetAspect | undefined {
  return ctx.aspects.find(x =>
    (x.planet1 === a && x.planet2 === b) || (x.planet1 === b && x.planet2 === a));
}

// ── The library. Each entry: a matcher returning a fired NamedPattern | null. ─
type Matcher = (ctx: PatternContext) => NamedPattern | null;

const PATTERNS: Record<string, Matcher> = {
  // Void of course — Hampar's prime gate. Nothing initiated takes.
  voidOfCourse: (ctx) => ctx.voc
    ? { name: "Void of course", polarity: -1, salience: 0.7,
        reading: "The day's initiations won't take — finish, rest, review; begin nothing you want to last." }
    : null,

  // Cazimi — a planet in the heart of the Sun (within 0°17′). Exalted, protected.
  cazimi: (ctx) => {
    for (const p of ctx.positions) {
      if (p.planet === "Sun") continue;
      if (!["Mercury","Venus","Mars","Jupiter","Saturn","Moon"].includes(p.planet)) continue;
      if (sep(p.longitude, ctx.sunLongitude) <= 0.283)
        return { name: `Cazimi (${p.planet})`, polarity: 1, salience: 0.85,
          reading: `${p.planet} sits in the heart of the Sun — its matters are lit and protected today; act through them.` };
    }
    return null;
  },

  // Combustion — a planet buried in the Sun's beams (within 8°30′). Weakened,
  // its significations absorbed (the Sun, though, is strengthened — George).
  combustion: (ctx) => {
    for (const p of ctx.positions) {
      if (p.planet === "Sun") continue;
      if (!["Mercury","Venus","Mars","Jupiter","Saturn"].includes(p.planet)) continue;
      const s = sep(p.longitude, ctx.sunLongitude);
      if (s > 0.283 && s <= 8.5)
        return { name: `Combust (${p.planet})`, polarity: -1, salience: 0.55,
          reading: `${p.planet} is combust — hidden in the Sun's glare; its themes run quietly, easily overlooked. Don't lean on them.` };
    }
    return null;
  },

  // Sun–Moon configured — the two lights in relationship set the day's keynote.
  sunMoon: (ctx) => {
    const a = aspectBetween(ctx, "Sun", "Moon");
    if (!a) return null;
    if (SOFT.has(a.aspect) || a.aspect === "conjunction")
      return { name: "Sun–Moon in accord", polarity: 1, salience: 0.6,
        reading: "The two lights are in accord — will and feeling pull the same way; a day that moves with its own tide." };
    if (HARD.has(a.aspect))
      return { name: "Sun–Moon in tension", polarity: -1, salience: 0.55,
        reading: "The two lights are at odds — what you want and what you feel diverge; hold both rather than forcing one." };
    return null;
  },

  // Moon applying to a benefic — a graced window (Hampar: benefic aspecting the Moon).
  moonToBenefic: (ctx) => {
    for (const a of ctx.aspects) {
      const other = a.planet1 === "Moon" ? a.planet2 : a.planet2 === "Moon" ? a.planet1 : null;
      if (!other || !BENEFIC.has(other) || !a.applying) continue;
      if (SOFT.has(a.aspect) || a.aspect === "conjunction")
        return { name: `Moon to ${other}`, polarity: 1, salience: 0.9 * (0.5 + 0.5 * Math.max(0, 1 - a.orb / 6)),
          reading: `The Moon is gathering ${other === "Venus" ? "Venus — a warm, graced window for connection, beauty, the gentle ask" : "Jupiter — an open, generous window for the reach, the teaching, the bigger ask"}.` };
    }
    return null;
  },

  // Moon under hard aspect to a malefic — usable pressure, watch reactivity.
  moonToMalefic: (ctx) => {
    for (const a of ctx.aspects) {
      const other = a.planet1 === "Moon" ? a.planet2 : a.planet2 === "Moon" ? a.planet1 : null;
      if (!other || !MALEFIC.has(other) || !a.applying) continue;
      if (HARD.has(a.aspect) || a.aspect === "conjunction")
        return { name: `Moon to ${other} (hard)`, polarity: -1, salience: 0.9 * (0.5 + 0.5 * Math.max(0, 1 - a.orb / 6)),
          reading: `The Moon meets ${other} under tension — ${other === "Mars" ? "friction and heat; usable for effortful, decisive work, but watch the short fuse" : "weight and friction; the unglamorous task is favoured, but the mood can go heavy"}.` };
    }
    return null;
  },

  // Mutual reception — two planets each in the other's domicile. Cooperation;
  // a stuck thing eases (works even without an aspect between them).
  mutualReception: (ctx) => {
    const classical = ctx.positions.filter(p =>
      ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"].includes(p.planet));
    for (let i = 0; i < classical.length; i++) {
      for (let j = i + 1; j < classical.length; j++) {
        const A = classical[i], B = classical[j];
        if (domicileLord(A.longitude) === B.planet && domicileLord(B.longitude) === A.planet)
          return { name: `Mutual reception (${A.planet}/${B.planet})`, polarity: 1, salience: 0.5,
            reading: `${A.planet} and ${B.planet} are each hosted in the other's sign — a quiet cooperation; something stuck between their themes can ease if you let them trade.` };
      }
    }
    return null;
  },

  // Besiegement / enclosure — a planet hemmed between Mars and Saturn by degree
  // with no benefic ray between (George's maltreatment condition, simplified to
  // longitudinal enclosure within 15° on each side). That theme is under strain.
  besiegement: (ctx) => {
    const mars = lonOf(ctx, "Mars"), saturn = lonOf(ctx, "Saturn");
    if (mars == null || saturn == null) return null;
    const venus = lonOf(ctx, "Venus"), jupiter = lonOf(ctx, "Jupiter");
    for (const p of ctx.positions) {
      if (!["Sun","Moon","Mercury","Venus","Jupiter"].includes(p.planet)) continue;
      const dM = sep(p.longitude, mars), dS = sep(p.longitude, saturn);
      if (dM <= 15 && dS <= 15) {
        // An intervening benefic ray within 7° breaks the siege (George's condition).
        const relieved = [venus, jupiter].some(bl => bl != null && sep(p.longitude, bl) <= 7);
        if (!relieved)
          return { name: `Besieged (${p.planet})`, polarity: -1, salience: 0.6,
            reading: `${p.planet} is hemmed between Mars and Saturn — that theme feels squeezed from both sides today; move it gently and don't force.` };
      }
    }
    return null;
  },

  // Doubled day — ruler of the hour = ruler of the ascendant (needs a chart).
  // The hour's theme is also the day's spine: a focused, single-pointed day.
  doubledDay: (ctx) => (ctx.hourRuler && ctx.ascRuler && ctx.hourRuler === ctx.ascRuler)
    ? { name: "Doubled day", polarity: 1, salience: 0.7,
        reading: `${ctx.hourRuler} rules both this hour and your ascendant — the day narrows to a single, focused thread; lean into it.` }
    : null,
};

/** Run every matcher against the moment; return the patterns that fired. */
export function matchPatterns(ctx: PatternContext): NamedPattern[] {
  const fired: NamedPattern[] = [];
  for (const key of Object.keys(PATTERNS)) {
    const hit = PATTERNS[key](ctx);
    if (hit) fired.push(hit);
  }
  return fired.sort((a, b) => b.salience - a.salience);
}
