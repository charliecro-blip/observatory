// The qualitative lattice — Hot/Wet/Cold/Dry lookups for every factor the
// composite temperament method scores.
//
// Every table here is transcribed from the repo's own knowledge base
// (knowledge/medical-astrology-v1/appendices/C_tables.md, tables 1, 2 and 5)
// rather than from general doctrine, so the engine and the reference cannot
// drift apart. Where the KB is silent or self-contradicting, the choice is
// marked CHOICE with its reasoning and surfaced in the report's method notes.

export type Quality = "hot" | "wet" | "cold" | "dry";

/** A factor contributes its full weight to one thermal and one humidal quality. */
export interface QualityPair {
  thermal: "hot" | "cold";
  humidal: "wet" | "dry";
}

export type Tally = Record<Quality, number>;

export const emptyTally = (): Tally => ({ hot: 0, wet: 0, cold: 0, dry: 0 });

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;
export type Sign = (typeof SIGNS)[number];

export const CLASSICAL_SEVEN = [
  "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
] as const;
export type Classical = (typeof CLASSICAL_SEVEN)[number];

// ── Sign qualities (C_tables §2, "Sign by qualities (for temperament calculation)")
// Fire → Hot+Dry · Earth → Cold+Dry · Air → Hot+Moist · Water → Cold+Moist
export const SIGN_QUALITIES: Record<Sign, QualityPair> = {
  Aries:       { thermal: "hot",  humidal: "dry" },
  Leo:         { thermal: "hot",  humidal: "dry" },
  Sagittarius: { thermal: "hot",  humidal: "dry" },
  Taurus:      { thermal: "cold", humidal: "dry" },
  Virgo:       { thermal: "cold", humidal: "dry" },
  Capricorn:   { thermal: "cold", humidal: "dry" },
  Gemini:      { thermal: "hot",  humidal: "wet" },
  Libra:       { thermal: "hot",  humidal: "wet" },
  Aquarius:    { thermal: "hot",  humidal: "wet" },
  Cancer:      { thermal: "cold", humidal: "wet" },
  Scorpio:     { thermal: "cold", humidal: "wet" },
  Pisces:      { thermal: "cold", humidal: "wet" },
};

export const SIGN_ELEMENT: Record<Sign, "fire" | "earth" | "air" | "water"> = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

export const SIGN_MODALITY: Record<Sign, "cardinal" | "fixed" | "mutable"> = {
  Aries: "cardinal", Cancer: "cardinal", Libra: "cardinal", Capricorn: "cardinal",
  Taurus: "fixed", Leo: "fixed", Scorpio: "fixed", Aquarius: "fixed",
  Gemini: "mutable", Virgo: "mutable", Sagittarius: "mutable", Pisces: "mutable",
};

// ── Planet qualities (C_tables §1, "Classical seven") ────────────────────────
// Mercury is listed "Convertible (takes on aspecting planet's qualities)" and
// so is deliberately absent here — resolveMercury() below does that work.
export const PLANET_QUALITIES: Record<Exclude<Classical, "Mercury">, QualityPair> = {
  Saturn:  { thermal: "cold", humidal: "dry" },
  Jupiter: { thermal: "hot",  humidal: "wet" },
  Mars:    { thermal: "hot",  humidal: "dry" },
  Sun:     { thermal: "hot",  humidal: "dry" },
  Venus:   { thermal: "cold", humidal: "wet" },
  Moon:    { thermal: "cold", humidal: "wet" },
};

// The modern outers, from C_tables §1 "Modern outers (adjunct overlay only)".
// The KB is explicit that these are an interpretive overlay and carry no
// dignity. They are NOT scored in the temperament composite — appendix D
// question 2 leaves their prominence open, and letting an unratified overlay
// move a constitutional reading is exactly the drift the KB warns against.
// Kept here because the melothesia and significator layers do cite them.
export const OUTER_QUALITIES: Record<string, QualityPair> = {
  Uranus:  { thermal: "cold", humidal: "dry" },
  Neptune: { thermal: "cold", humidal: "wet" },
  Pluto:   { thermal: "hot",  humidal: "dry" },
};

/**
 * Mercury's qualities, resolved from the planet it is most closely joined to.
 *
 * C_tables §1 calls Mercury "Convertible (takes on aspecting planet's
 * qualities)". C_tables §5 lists Mercury under Melancholic as "(dry mercury)",
 * which is the fallback when nothing configures it.
 *
 * `contacts` is the aspecting planets in ascending orb order; the closest one
 * that has fixed qualities of its own wins.
 */
export function resolveMercury(
  contacts: Array<{ planet: string; orb: number }>,
): { pair: QualityPair; source: string } {
  for (const c of [...contacts].sort((a, b) => a.orb - b.orb)) {
    const pair = PLANET_QUALITIES[c.planet as Exclude<Classical, "Mercury">];
    if (pair) return { pair, source: `converted by ${c.planet} (${c.orb.toFixed(1)}° orb)` };
  }
  return {
    pair: { thermal: "cold", humidal: "dry" },
    source: "unconverted — no classical planet in aspect, so the melancholic default",
  };
}

/** Qualities for any body, with Mercury resolved by its contacts. */
export function planetQualities(
  planet: string,
  mercuryContacts: Array<{ planet: string; orb: number }> = [],
): { pair: QualityPair; note?: string } | null {
  if (planet === "Mercury") {
    const { pair, source } = resolveMercury(mercuryContacts);
    return { pair, note: source };
  }
  const pair = PLANET_QUALITIES[planet as Exclude<Classical, "Mercury">];
  return pair ? { pair } : null;
}

// ── Moon phase (factor 7) ────────────────────────────────────────────────────
// CHOICE. Part V of the KB describes this factor loosely and contradicts
// itself inside one sentence ("Waxing Moon → Hot+Wet; waning → Cold+Dry; New →
// Hot+Wet; Full → Hot+Wet (with variants by source)") — three of the four
// quarters land on Hot+Wet, which cannot be a scoring scheme. Appendix D
// question 36 leaves four-phase vs. eight-phase open.
//
// Implemented here is the Ptolemaic quartering (Tetrabiblos I.8), which is the
// scheme Greenbaum's method actually uses and the one the KB's own "Greenbaum-
// derived defaults" line points at: each quarter takes the qualities of the
// matching season, running the humoral year in miniature.
export type MoonQuarter = "waxing crescent" | "waxing gibbous" | "waning gibbous" | "waning crescent";

export function moonQuarter(elongationDeg: number): MoonQuarter {
  const e = ((elongationDeg % 360) + 360) % 360;
  if (e < 90) return "waxing crescent";
  if (e < 180) return "waxing gibbous";
  if (e < 270) return "waning gibbous";
  return "waning crescent";
}

export const MOON_QUARTER_QUALITIES: Record<MoonQuarter, QualityPair> = {
  "waxing crescent": { thermal: "hot",  humidal: "wet" },  // spring register
  "waxing gibbous":  { thermal: "hot",  humidal: "dry" },  // summer register
  "waning gibbous":  { thermal: "cold", humidal: "dry" },  // autumn register
  "waning crescent": { thermal: "cold", humidal: "wet" },  // winter register
};

// ── Season of birth (factor 9) ───────────────────────────────────────────────
// Part V, factor 9: "Spring → Hot+Wet; Summer → Hot+Dry; Autumn → Cold+Dry;
// Winter → Cold+Wet. Northern hemisphere bias acknowledged." The KB states the
// engine inverts for southern-hemisphere births; it does, below.
export type Season = "spring" | "summer" | "autumn" | "winter";

export const SEASON_QUALITIES: Record<Season, QualityPair> = {
  spring: { thermal: "hot",  humidal: "wet" },
  summer: { thermal: "hot",  humidal: "dry" },
  autumn: { thermal: "cold", humidal: "dry" },
  winter: { thermal: "cold", humidal: "wet" },
};

/** Season from the Sun's tropical longitude, inverted below the equator. */
export function seasonOfBirth(sunLongitude: number, latitude: number): Season {
  const lon = ((sunLongitude % 360) + 360) % 360;
  const northern: Season =
    lon < 90 ? "spring" : lon < 180 ? "summer" : lon < 270 ? "autumn" : "winter";
  if (latitude >= 0) return northern;
  const flip: Record<Season, Season> = {
    spring: "autumn", summer: "winter", autumn: "spring", winter: "summer",
  };
  return flip[northern];
}

// ── Ascendant-ruler phase (factor 4) ─────────────────────────────────────────
// CHOICE. Part V names this factor "Ascendant ruler — modality/phase" and
// glosses it "(cardinal/fixed/mutable, or angular/succedent/cadent)". Neither
// gloss has a traditional mapping onto Hot/Wet/Cold/Dry — modality and house
// strength are not qualitative doctrines — so scoring either would be
// invention at the weight the KB assigns.
//
// "Phase" in a temperament context is the classical oriental/occidental
// doctrine (Ptolemy, Tetrabiblos III.11), which IS qualitative and IS
// computable: a planet risen before the Sun is in its hot, dry, increasing
// phase; one that sets after the Sun is in its cold, wet, declining phase.
// That is what this factor scores. Weight 1 — the smallest in the method — so
// the reading barely moves if the owner later rules otherwise. Surfaced in the
// report's method notes for ratification.
export type SolarPhase = "oriental" | "occidental";

export const PHASE_QUALITIES: Record<SolarPhase, QualityPair> = {
  oriental:   { thermal: "hot",  humidal: "dry" },
  occidental: { thermal: "cold", humidal: "wet" },
};

/** Oriental = rising before the Sun, i.e. 0–180° behind it in zodiacal order. */
export function solarPhase(planetLongitude: number, sunLongitude: number): SolarPhase {
  const sep = ((sunLongitude - planetLongitude) % 360 + 360) % 360;
  return sep > 0 && sep < 180 ? "oriental" : "occidental";
}

// ── The four temperaments ────────────────────────────────────────────────────
export type Temperament = "sanguine" | "choleric" | "melancholic" | "phlegmatic";

export const TEMPERAMENT_OF: Record<string, Temperament> = {
  "hot+wet": "sanguine",
  "hot+dry": "choleric",
  "cold+dry": "melancholic",
  "cold+wet": "phlegmatic",
};

// C_tables §5 — the four temperaments at a glance.
export const TEMPERAMENT_PROFILE: Record<Temperament, {
  qualities: string; element: string; humor: string; season: string;
  planets: string; register: string;
}> = {
  sanguine: {
    qualities: "Hot + Moist", element: "Air", humor: "Blood", season: "Spring",
    planets: "Jupiter, Venus", register: "Warm, sociable, mobile, generous",
  },
  choleric: {
    qualities: "Hot + Dry", element: "Fire", humor: "Yellow bile", season: "Summer",
    planets: "Mars, Sun", register: "Warm, driven, decisive, intense",
  },
  melancholic: {
    qualities: "Cold + Dry", element: "Earth", humor: "Black bile", season: "Autumn",
    planets: "Saturn, Mercury (dry mercury)", register: "Cool, structural, durable, deliberate",
  },
  phlegmatic: {
    qualities: "Cold + Moist", element: "Water", humor: "Phlegm", season: "Winter",
    planets: "Moon, Venus (in moist register)", register: "Cool, receptive, calm, fluid",
  },
};

// ── Melothesia (C_tables §2, "Body region") ──────────────────────────────────
export const SIGN_BODY: Record<Sign, string> = {
  Aries: "head, brain, face",
  Taurus: "throat, neck, thyroid, voice",
  Gemini: "lungs, bronchi, arms, hands, shoulders, nervous register",
  Cancer: "breasts, chest, rib cage, stomach",
  Leo: "heart, upper back, spine",
  Virgo: "intestines, abdomen, digestive assimilation",
  Libra: "kidneys, lumbar, lower back, adrenals",
  Scorpio: "genitourinary, reproductive, bladder, rectum",
  Sagittarius: "hips, thighs, sacrum, sciatic, liver (via Jupiter)",
  Capricorn: "knees, joints, skin, skeletal frame, teeth",
  Aquarius: "lower legs, calves, ankles, peripheral circulation",
  Pisces: "feet, toes, lymphatic, body fluids",
};

export const PLANET_BODY: Record<string, { region: string; system: string }> = {
  Saturn:  { region: "bones, skin, joints, teeth, hair", system: "skeletal frame, spleen" },
  Jupiter: { region: "hips, thighs, liver", system: "liver, blood-fat, generative system" },
  Mars:    { region: "muscles, head (with Aries), genitalia (with Scorpio)", system: "muscular system, blood-iron, gallbladder" },
  Sun:     { region: "heart, upper back, spine", system: "cardiac system, central vitality" },
  Venus:   { region: "throat (with Taurus), kidneys (with Libra), reproductive (with Taurus)", system: "venous system, kidney function, reproductive" },
  Mercury: { region: "lungs, arms, hands, nervous system", system: "nervous system, brain, respiratory" },
  Moon:    { region: "breasts, stomach, fluids generally", system: "digestive intake, lymphatic, fluids" },
  Uranus:  { region: "peripheral nervous-system signaling, circulatory rhythm", system: "modern attribution" },
  Neptune: { region: "lymphatic, immune, fluid-and-boundary register", system: "modern attribution" },
  Pluto:   { region: "cellular renewal, eliminative depth, regenerative tissue", system: "modern attribution" },
};

// ── The medical houses (C_tables §3) ─────────────────────────────────────────
export interface MedicalHouse {
  number: number; field: string; body: string;
  strength: "angular" | "succedent" | "cadent";
  weight: "full" | "significant" | "substantial" | "moderate" | "light";
}

export const MEDICAL_HOUSES: Record<number, MedicalHouse> = {
  1:  { number: 1,  field: "body, vitality, the patient", body: "head, body as a whole", strength: "angular", weight: "full" },
  2:  { number: 2,  field: "intake, diet, resources", body: "throat", strength: "succedent", weight: "significant" },
  3:  { number: 3,  field: "communication, environment, siblings", body: "shoulders, arms, lungs (light)", strength: "cadent", weight: "light" },
  4:  { number: 4,  field: "home, ancestors, foundation", body: "chest, lungs (light, via Cancer)", strength: "angular", weight: "moderate" },
  5:  { number: 5,  field: "creativity, children, pleasure", body: "heart (via Leo)", strength: "succedent", weight: "moderate" },
  6:  { number: 6,  field: "illness, daily routine, work", body: "intestines", strength: "cadent", weight: "full" },
  7:  { number: 7,  field: "partnership, the practitioner", body: "kidneys, lumbar (via Libra)", strength: "angular", weight: "full" },
  8:  { number: 8,  field: "transformation, shared resources", body: "genitourinary, eliminative (via Scorpio)", strength: "succedent", weight: "full" },
  9:  { number: 9,  field: "long journeys, philosophy", body: "hips, thighs, liver (light)", strength: "cadent", weight: "light" },
  10: { number: 10, field: "career, public role, medicine", body: "knees (via Capricorn)", strength: "angular", weight: "full" },
  11: { number: 11, field: "friends, hopes, networks", body: "lower legs, ankles (light)", strength: "succedent", weight: "light" },
  12: { number: 12, field: "the hidden, confinement, hospitals", body: "feet, lymphatic (via Pisces)", strength: "cadent", weight: "substantial" },
};

/** The six the KB flags at full medical weight, in reading order. */
export const FULL_WEIGHT_HOUSES = [1, 2, 6, 7, 8, 10];

// ── Traditional rulership (the 7-planet scheme the dignity engine uses) ──────
export const SIGN_RULER: Record<Sign, Classical> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

// ── Planetary day rulers (C_tables §7) ───────────────────────────────────────
export const DAY_RULER = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;

export const PLANET_REGISTER: Record<string, string> = {
  Sun: "solar — central vitality, visibility, generosity",
  Moon: "lunar — rhythm, receptivity, cyclic feeling",
  Mars: "martial — activation, drive, heat",
  Mercury: "mercurial — communication, motion, exchange",
  Jupiter: "jovial — expansion, broadening, generosity",
  Venus: "venusian — pleasure, ease, relational warmth",
  Saturn: "saturnian — structure, discipline, gravity",
};

// ── Cross-tradition (C_tables §9) ────────────────────────────────────────────
export const TCM_MAPPING: Record<string, { element: string; strength: string; note: string }> = {
  Saturn:  { element: "Earth (Spleen/Stomach)", strength: "strong", note: "cleanest planet-element convergence" },
  Jupiter: { element: "Wood (Liver/Gallbladder)", strength: "strong", note: "liver organ matches; spring season differs" },
  Mars:    { element: "Fire (Heart functional system)", strength: "strong with tension", note: "Mars-as-energy maps to Fire; Heart-as-organ maps to Sun" },
  Venus:   { element: "Metal (Lung/Large Intestine)", strength: "weak", note: "mapping by elimination; thematic resonance poor" },
  Mercury: { element: "Water (Kidney via jing)", strength: "moderate", note: "subtle connection via constitutional reserve" },
  Sun:     { element: "Yang (Heart-Fire)", strength: "strong", note: "Sun-Leo-Heart-Fire converges cleanly" },
  Moon:    { element: "Yin (fluids, all elements)", strength: "strong", note: "converges on rhythm and fluid; not localized in one element" },
};

// ── Humoral cultivation registers (Part V, "Cultivation strategies") ─────────
export const CULTIVATION: Record<Temperament, { supports: string; tempers: string }> = {
  sanguine: {
    supports: "moderate hot-moist practice — sociable warmth, generous nourishment, mobile activity",
    tempers: "cool-dry counterbalance — rest, structure, drier foods, moderation",
  },
  choleric: {
    supports: "purposeful hot-dry expression — challenging work, decisive action, lean nourishment",
    tempers: "cool-moist counterbalance — rest, ease, juicy foods, the Venus and Moon registers",
  },
  melancholic: {
    supports: "careful structural work — sustained tasks, mineral nourishment, durable rhythm",
    tempers: "warm-moist counterbalance — warmth, company, oily nourishment, sweetness",
  },
  phlegmatic: {
    supports: "gentle steady practice — water, rhythm, receptive work",
    tempers: "warm-dry counterbalance — movement, heat, structure, lighter and warming foods",
  },
};
