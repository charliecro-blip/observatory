/**
 * Dignity — the WEIGHT scalar for the synthesis engine (spec: SYNTHESIS-ENGINE-SPEC.md).
 *
 * How strong is a planet's voice? A planet in its own sign speaks with
 * authority; a peregrine, combust, cadent planet mutters. Dignity applied to
 * the CURRENT sky is what turns "Mars hour" into "a strong, dignified Mars hour
 * worth trusting" — the difference between a list and a judgment.
 *
 * Scoring per Lilly's Christian Astrology (verified). All essential dignities
 * are implemented in full: domicile (+5), exaltation (+4), triplicity (+3,
 * Dorothean by sect), Egyptian term (+2), face (+1, Chaldean decans),
 * detriment (-5), fall (-4). The Egyptian bounds are the canonical set (Ptolemy/
 * Valens/George Table 17, cross-checked), so peregrine correctly means "no
 * domicile/exaltation/triplicity/term/face" of its own.
 *
 * Modern synthesis (owner 2026-07-23): tropical zodiac; the modern planets
 * (Uranus/Neptune/Pluto) and Chiron/nodes/asteroids sit OUTSIDE the classical
 * essential-dignity scheme — they carry accidental dignity + testimony weight
 * but a neutral essential score, rather than being force-fit to rulerships.
 */

const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"] as const;
type Sign = typeof SIGNS[number];
const CLASSICAL = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"] as const;
type Classical = typeof CLASSICAL[number];

const signOf = (lon: number): Sign => SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)];
const degInSign = (lon: number): number => (((lon % 360) + 360) % 360) % 30;

// ── Domicile (traditional 7-planet rulerships) ──────────────────────────────
const DOMICILE: Record<Sign, Classical> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon", Leo: "Sun",
  Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars", Sagittarius: "Jupiter",
  Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};
const opposite = (s: Sign): Sign => SIGNS[(SIGNS.indexOf(s) + 6) % 12];

// ── Exaltation (planet → sign, exact degree) ────────────────────────────────
const EXALTATION: Partial<Record<Classical, { sign: Sign; deg: number }>> = {
  Sun: { sign: "Aries", deg: 19 }, Moon: { sign: "Taurus", deg: 3 },
  Mercury: { sign: "Virgo", deg: 15 }, Venus: { sign: "Pisces", deg: 27 },
  Mars: { sign: "Capricorn", deg: 28 }, Jupiter: { sign: "Cancer", deg: 15 },
  Saturn: { sign: "Libra", deg: 21 },
};

// ── Triplicity (Dorothean: day ruler / night ruler / participating) ─────────
const TRIPLICITY: Record<"fire"|"earth"|"air"|"water", { day: Classical; night: Classical; part: Classical }> = {
  fire:  { day: "Sun",   night: "Jupiter", part: "Saturn" },
  earth: { day: "Venus", night: "Moon",    part: "Mars"   },
  air:   { day: "Saturn",night: "Mercury", part: "Jupiter"},
  water: { day: "Venus", night: "Mars",    part: "Moon"   },
};
const SIGN_ELEMENT: Record<Sign, "fire"|"earth"|"air"|"water"> = {
  Aries:"fire",Leo:"fire",Sagittarius:"fire", Taurus:"earth",Virgo:"earth",Capricorn:"earth",
  Gemini:"air",Libra:"air",Aquarius:"air", Cancer:"water",Scorpio:"water",Pisces:"water",
};

// ── Faces / decans (Chaldean order, starting Mars at Aries 0°) ──────────────
const FACE_SEQ: Classical[] = ["Mars","Sun","Venus","Mercury","Moon","Saturn","Jupiter"];
const faceRuler = (lon: number): Classical => FACE_SEQ[Math.floor(((lon % 360) + 360) % 360 / 10) % 7];

// ── Egyptian terms (bounds) — the canonical Egyptian set (Ptolemy / Valens /
// George Table 17, cross-checked verbatim). Each row: [upToDegree, ruler]
// cumulative within the sign. Complete for all 12 signs, so peregrine now
// accounts for terms too. ───────────────────────────────────────────────────
const EGYPTIAN_TERMS: Record<Sign, Array<[number, Classical]>> = {
  Aries:       [[6, "Jupiter"], [12, "Venus"],   [20, "Mercury"], [25, "Mars"],    [30, "Saturn"]],
  Taurus:      [[8, "Venus"],   [14, "Mercury"], [22, "Jupiter"], [27, "Saturn"],  [30, "Mars"]],
  Gemini:      [[6, "Mercury"], [12, "Jupiter"], [17, "Venus"],   [24, "Mars"],    [30, "Saturn"]],
  Cancer:      [[7, "Mars"],    [13, "Venus"],   [19, "Mercury"], [26, "Jupiter"], [30, "Saturn"]],
  Leo:         [[6, "Jupiter"], [11, "Venus"],   [18, "Saturn"],  [24, "Mercury"], [30, "Mars"]],
  Virgo:       [[7, "Mercury"], [17, "Venus"],   [21, "Jupiter"], [28, "Mars"],    [30, "Saturn"]],
  Libra:       [[6, "Saturn"],  [14, "Mercury"], [21, "Jupiter"], [28, "Venus"],   [30, "Mars"]],
  Scorpio:     [[7, "Mars"],    [11, "Venus"],   [19, "Mercury"], [24, "Jupiter"], [30, "Saturn"]],
  Sagittarius: [[12, "Jupiter"],[17, "Venus"],   [21, "Mercury"], [26, "Saturn"],  [30, "Mars"]],
  Capricorn:   [[7, "Mercury"], [14, "Jupiter"], [22, "Venus"],   [26, "Saturn"],  [30, "Mars"]],
  Aquarius:    [[7, "Mercury"], [13, "Venus"],   [20, "Jupiter"], [25, "Mars"],    [30, "Saturn"]],
  Pisces:      [[12, "Venus"],  [16, "Jupiter"], [19, "Mercury"], [28, "Mars"],    [30, "Saturn"]],
};
function termRuler(lon: number): Classical | null {
  const rows = EGYPTIAN_TERMS[signOf(lon)];
  const d = degInSign(lon);
  for (const [upTo, ruler] of rows) if (d < upTo) return ruler;
  return null;
}

// ── Small lookups shared with the pattern library (patterns.ts) ─────────────
/** The traditional (7-planet) domicile lord of the sign a longitude falls in. */
export function domicileLord(longitude: number): string { return DOMICILE[signOf(longitude)]; }
/** The sign name a longitude falls in. */
export function signName(longitude: number): string { return signOf(longitude); }
/** The element of the sign a longitude falls in. */
export function signElement(longitude: number): "fire"|"earth"|"air"|"water" { return SIGN_ELEMENT[signOf(longitude)]; }

export interface EssentialDignity {
  score: number;
  dignities: string[];   // e.g. ["domicile"] or ["fall"]
  peregrine: boolean;
}

/** Essential dignity of a classical planet at a longitude, for the sect. */
export function essentialDignity(planet: string, longitude: number, isDay: boolean): EssentialDignity {
  if (!CLASSICAL.includes(planet as Classical)) {
    // Modern planets / points sit outside the classical scheme.
    return { score: 0, dignities: [], peregrine: false };
  }
  const p = planet as Classical;
  const sign = signOf(longitude);
  const dignities: string[] = [];
  let score = 0;

  if (DOMICILE[sign] === p) { score += 5; dignities.push("domicile"); }
  const ex = EXALTATION[p];
  if (ex && ex.sign === sign) { score += 4; dignities.push("exaltation"); }
  // Only the SECT triplicity ruler (day or night) scores +3 — Lilly's table.
  // The Dorothean participating ruler is real but conventionally unscored here;
  // exposing it is a future practitioner option.
  const tri = TRIPLICITY[SIGN_ELEMENT[sign]];
  if ((isDay ? tri.day : tri.night) === p) { score += 3; dignities.push("triplicity"); }
  if (termRuler(longitude) === p) { score += 2; dignities.push("term"); }
  if (faceRuler(longitude) === p) { score += 1; dignities.push("face"); }

  // Debilities (mutually exclusive with the positive dignity of the same sign).
  const domicileSigns = (Object.keys(DOMICILE) as Sign[]).filter(s => DOMICILE[s] === p);
  if (domicileSigns.some(s => opposite(s) === sign)) { score -= 5; dignities.push("detriment"); }
  if (ex && opposite(ex.sign) === sign) { score -= 4; dignities.push("fall"); }

  // Peregrine: NO essential dignity of its own AND not in detriment/fall (a
  // debilitated planet is debilitated, not peregrine — never double-penalize).
  const hasDignity = dignities.some(d => ["domicile","exaltation","triplicity","term","face"].includes(d));
  const debilitated = dignities.includes("detriment") || dignities.includes("fall");
  const peregrine = !hasDignity && !debilitated;
  if (peregrine) { score -= 5; dignities.push("peregrine"); }

  return { score, dignities, peregrine };
}

export interface AccidentalContext {
  house?: number;          // 1-12, if a chart is available
  retrograde?: boolean;
  slow?: boolean;          // below mean motion
  sunLongitude?: number;   // for combustion / cazimi / under-beams
  longitude?: number;      // the planet's own longitude (for sun distance)
  isDay?: boolean;
}
export interface AccidentalDignity { score: number; factors: string[]; }

/** Accidental dignity — condition by circumstance (Lilly's table, the parts we
 *  can know from the transiting sky ± an optional chart). */
export function accidentalDignity(planet: string, ctx: AccidentalContext): AccidentalDignity {
  const factors: string[] = [];
  let score = 0;

  // House (needs a chart)
  if (ctx.house != null) {
    const h = ctx.house;
    if (h === 1 || h === 10) { score += 5; factors.push("angular(1/10)"); }
    else if (h === 7 || h === 4 || h === 11) { score += 4; factors.push("angular/succedent(7/4/11)"); }
    else if (h === 2 || h === 5) { score += 3; factors.push("succedent(2/5)"); }
    else if (h === 9) { score += 2; factors.push("cadent(9)"); }
    else if (h === 3) { score += 1; factors.push("cadent(3)"); }
    else if (h === 12) { score -= 5; factors.push("cadent(12)"); }
    else if (h === 6 || h === 8) { score -= 2; factors.push("cadent(6/8)"); }
  }

  // Motion
  if (ctx.retrograde) { score -= 5; factors.push("retrograde"); }
  else { score += 4; factors.push("direct"); }
  if (ctx.slow) { score -= 2; factors.push("slow"); }

  // Combustion / cazimi / under the beams (Sun-relative)
  if (ctx.sunLongitude != null && ctx.longitude != null && planet !== "Sun") {
    // Shortest angular separation from the Sun, 0..180, 0 = conjunct. This is
    // the standard wrap-safe formula; it must NOT be flipped with `180 − d` —
    // that inversion once awarded cazimi at opposition and "free of the beams"
    // at exact conjunction (tests/dignity.test.ts pins both directions).
    const sep = Math.abs((((ctx.longitude - ctx.sunLongitude) % 360) + 540) % 360 - 180);
    if (sep <= 0.283) { score += 5; factors.push("cazimi"); }            // 0°17′
    else if (sep <= 8.5) { score -= 5; factors.push("combust"); }        // 8°30′
    else if (sep <= 17) { score -= 4; factors.push("under the beams"); }
    else { score += 5; factors.push("free of the Sun's beams"); }
  }

  return { score, factors };
}

export interface Dignity {
  essential: EssentialDignity;
  accidental: AccidentalDignity;
  net: number;      // essential + accidental
  weight: number;   // normalized ~[0.2 … 2.0] — the testimony multiplier
}

/** Full dignity → the weight a testimony from this planet carries right now. */
export function dignity(planet: string, longitude: number, ctx: AccidentalContext = {}): Dignity {
  const isDay = ctx.isDay ?? true;
  const essential = essentialDignity(planet, longitude, isDay);
  const accidental = accidentalDignity(planet, { ...ctx, longitude });
  const net = essential.score + accidental.score;
  // Map net (~ -15 … +20 in practice) onto a gentle multiplier. 0 net → ~1.0.
  const weight = Math.max(0.2, Math.min(2.0, 1 + net / 20));
  return { essential, accidental, net, weight };
}
