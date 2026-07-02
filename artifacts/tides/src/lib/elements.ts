// Single source of truth for elemental framework across the entire app.
// Layer 1 (primary): Element of the moment
// Layer 2 (secondary): Planetary archetype emphasis
// Layer 3 (tertiary): Module application

export type Element = "fire" | "earth" | "air" | "water";

export const ELEMENT_COLORS: Record<Element, string> = {
  fire:  "#b84020",
  earth: "#4a7040",
  air:   "#5040a0",
  water: "#2a5a80",
};

export const ELEMENT_BG: Record<Element, string> = {
  fire:  "#fff0ec",
  earth: "#f0f5ee",
  air:   "#f0eef8",
  water: "#eaf0f8",
};

export const ELEMENT_GLYPH: Record<Element, string> = {
  fire:  "△",
  earth: "▽",
  air:   "△",   // upward air = mind rising
  water: "▽",
};

export const ELEMENT_LABEL: Record<Element, string> = {
  fire:  "Fire",
  earth: "Earth",
  air:   "Air",
  water: "Water",
};

export const ELEMENT_TAGLINE: Record<Element, string> = {
  fire:  "Bold action · initiative · courage · visibility",
  earth: "Patient building · grounding · practical craft · structure",
  air:   "Clear thinking · communication · connection · ideas",
  water: "Deep feeling · intuition · rest · emotional intelligence",
};

export const ELEMENT_TODAY_GUIDANCE: Record<Element, { morning: string; work: string; evening: string }> = {
  fire: {
    morning: "Start with what energizes you — exercise, bold decisions, anything that requires nerve.",
    work:    "Lead, pitch, create, assert. Fire days reward initiative and visible action.",
    evening: "Wind down actively — stretch, move, let the day's energy discharge before sleep.",
  },
  earth: {
    morning: "Ground yourself first — body, food, environment. Attend to the physical before the digital.",
    work:    "Build, refine, complete. Earth days reward patience and methodical effort.",
    evening: "Settle into comfort. Good food, familiar routines, early rest.",
  },
  air: {
    morning: "Read, write, connect. Air days start well with language and thought.",
    work:    "Communicate, collaborate, plan. Air days favor meetings and intellectual exchange.",
    evening: "Review the day's ideas in writing. Air can stay mental — consciously come back to the body.",
  },
  water: {
    morning: "Move slowly. Water days need a gentler start — journal, meditate, don't rush.",
    work:    "Deep work, emotional labor, creative intuition. Avoid high-pressure performance if possible.",
    evening: "Rest fully. Water days restore — honor that with early, gentle evenings.",
  },
};

// Planet primary element(s) — first is dominant, second is secondary when sign activates it
export const PLANET_ELEMENTS: Record<string, Element[]> = {
  Sun:     ["fire"],
  Moon:    ["water"],
  Mercury: ["air", "earth"],   // Gemini/Aquarius = air; Virgo = earth
  Venus:   ["earth", "air"],   // Taurus = earth; Libra = air
  Mars:    ["fire"],
  Jupiter: ["fire", "air"],    // Sagittarius = fire; Pisces = water; Gemini = air
  Saturn:  ["earth", "air"],   // Capricorn = earth; Aquarius = air
  Uranus:  ["air"],
  Neptune: ["water"],
  Pluto:   ["water"],
};

// Sign → element
export const SIGN_ELEMENTS: Record<string, Element> = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

// Module → best elements (for recommendation)
export const MODULE_ELEMENTS: Record<string, Element[]> = {
  content:       ["air", "earth"],
  creative:      ["fire", "air"],
  financial:     ["earth"],
  relationships: ["air", "water"],
  health:        ["fire", "earth"],
  spiritual:     ["water", "air"],
  home:          ["earth", "water"],
};

// ── Tide model (Character × Level) ───────────────────────────────────────────
// Character = element. These four are the app's primary vocabulary.

export type TideCharacter = "deep" | "surge" | "building" | "clear";

export const CHARACTER_ELEMENT: Record<TideCharacter, Element> = {
  deep: "water", surge: "fire", building: "earth", clear: "air",
};

export const CHARACTER_LABEL: Record<TideCharacter, string> = {
  deep: "Deep", surge: "Surge", building: "Building", clear: "Clear",
};

// One-line essence of each character (subtitle-length)
export const CHARACTER_ESSENCE: Record<TideCharacter, string> = {
  deep:     "Feeling, intuition, and slow creative depth.",
  surge:    "Initiative, courage, and visible action.",
  building: "Patient craft, structure, and finishing.",
  clear:    "Thought, communication, and connection.",
};

// What the character is good for — used in the "what to do" line
export const CHARACTER_GRAIN: Record<TideCharacter, string> = {
  deep:     "feel, dream, heal, create, listen, rest",
  surge:    "act, publish, lead, initiate, move the body",
  building: "build, organize, finish, stabilize, tend",
  clear:    "write, connect, message, brainstorm, exchange",
};

// Level phrasing → what it means for pace (independent of character)
export const LEVEL_GUIDANCE: Record<string, string> = {
  high:    "Energy is at its peak — this is the window to fully engage.",
  rising:  "Energy is building — start now and let it carry you.",
  tide:    "A steady middle — do what you like; the sky isn't pushing.",
  ebb:     "Energy is releasing — wind down, refine, don't start anything big.",
  low:     "The tide is out — rest, seed intentions, restore.",
};

// Character × level → the actionable "what to do" line.
// Composed skeleton; the on-tap "why" can be LLM-enriched later.
export function tideGuidance(character: TideCharacter, level: string): string {
  const grain = CHARACTER_GRAIN[character];
  const pace = LEVEL_GUIDANCE[level] ?? LEVEL_GUIDANCE.tide;
  const verbs = grain.split(", ");
  if (level === "high" || level === "rising") {
    return `${pace} Lean into what this tide favors — ${verbs.slice(0, 3).join(", ")}.`;
  }
  if (level === "ebb" || level === "low") {
    // On low/ebb, favor the receptive end of the character
    const gentle = character === "surge" ? "let the fire bank — stretch, move gently, don't force a launch"
      : character === "building" ? "tidy, close loops, tend what's already built"
      : character === "clear" ? "review notes, read, let ideas settle rather than broadcast"
      : "rest fully, journal, let feeling move without acting on it";
    return `${pace} ${gentle.charAt(0).toUpperCase() + gentle.slice(1)}.`;
  }
  return `${pace} Good for ${verbs.slice(0, 3).join(", ")}.`;
}

// Honest reading for a genuinely undramatic day — most days. Never manufacture
// intensity; a calm sky is reported as calm, character-tinted but unforced.
export const QUIET_DAY_GUIDANCE: Record<TideCharacter, string> = {
  deep:     "A quiet, still day — nothing pulling hard. Follow what feeling asks for; your rhythm is your own.",
  surge:    "A quiet, open day — no strong current. Move if you want to, but nothing's pushing. Your rhythm is your own.",
  building: "A quiet, steady day — nothing demanding. Good for ordinary, unhurried work. Your rhythm is your own.",
  clear:    "A quiet, open day — the sky is calm. Think, drift, or do nothing in particular. Your rhythm is your own.",
};

// Confidence → how the app should hedge its voice
export const CONFIDENCE_NOTE: Record<string, string> = {
  high:   "",
  medium: "",
  low:    "Signals are mixed today — hold this lightly.",
};

// Resolve the dominant element of a planetary hour, accounting for Moon's sign
export function resolveHourElement(planet: string, moonSign: string): Element {
  const moonEl = SIGN_ELEMENTS[moonSign];
  const planetEls = PLANET_ELEMENTS[planet] ?? ["air"];
  // If Moon's element matches a secondary planet element, elevate it
  if (moonEl && planetEls.includes(moonEl)) return moonEl;
  return planetEls[0];
}

// Score module resonance for current conditions (0–1)
export function moduleResonance(moduleId: string, currentElement: Element, emphasizedPlanets: string[]): number {
  const modEls = MODULE_ELEMENTS[moduleId] ?? [];
  const elMatch = modEls.includes(currentElement) ? 0.6 : 0;
  const planetMatch = emphasizedPlanets.some(p => {
    const pEls = PLANET_ELEMENTS[p] ?? [];
    return modEls.some(e => pEls.includes(e));
  }) ? 0.4 : 0;
  return elMatch + planetMatch;
}
