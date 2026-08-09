// Single source of truth for elemental framework across the entire app.
// Layer 1 (primary): Element of the moment
// Layer 2 (secondary): Planetary archetype emphasis
// Layer 3 (tertiary): Module application

export type Element = "fire" | "earth" | "air" | "water";

// Element hues resolve from the active palette instead of being frozen at the
// light-mode values. They must stay HEX, not `var(--color-fire)`: the app
// concatenates an alpha suffix onto them in ~134 places (`${col}22`), and
// `var(--x)22` is not a colour — it fails silently to transparent, which is
// the worst kind of bug because the layout still looks plausible.
//
// So: one table per mode, handed back as a plain hex.
//
// Light keeps the app's OWN hues rather than the palette's `--color-*` values.
// That was measured, not assumed: routing light mode through the palette put
// air at #CBA13C and fire at #C2613E — both lighter than the inks they
// replaced — and pushed light-mode contrast failures from 386 to 404 across
// the four tabs. The palette hues are tuned to look right, not to carry small
// text on paper. Dark genuinely needs the lift, so only dark takes it.
const LIGHT: Record<Element, string> = {
  fire: "#b84020", earth: "#4a7040", air: "#c19a3a", water: "#2a5a80",
};
const DARK: Record<Element, string> = {
  fire: "#ff8a66", earth: "#6fd095", air: "#f2c94c", water: "#5cc8e8",
};

function elementsForMode(): Record<Element, string> {
  return typeof document !== "undefined"
    && document.documentElement.getAttribute("data-theme") === "dark" ? DARK : LIGHT;
}

export const ELEMENT_COLORS: Record<Element, string> = {
  get fire() { return elementsForMode().fire; },
  get earth() { return elementsForMode().earth; },
  get air() { return elementsForMode().air; },
  get water() { return elementsForMode().water; },
};

/**
 * The same elements as a FILLED SURFACE that carries white text — the Today
 * hero, and anything else painted rather than written.
 *
 * This exists because the two uses pull in opposite directions and a single
 * value cannot serve both: text on a near-black card wants a light hue, a
 * panel under white text wants a deep one. Lifting `ELEMENT_COLORS` for dark
 * mode fixed the text and broke the hero — white on a bright green — which is
 * why these are separate rather than one table with a compromise in it.
 *
 * Deep in both modes, so it never needs a compromise.
 */
// A COPY, not an alias. `= LIGHT` was the same object reference, so a future
// mutation of either table would silently change both — the opposite of the
// "separate rather than one table with a compromise in it" the comment above
// promises. The spread makes the separation structural.
export const ELEMENT_SURFACE: Record<Element, string> = { ...LIGHT };

/**
 * Same hue, for callers that hold an element as a plain `string` (a value off
 * an API response, a form field) rather than the `Element` union. Four files
 * kept their own loosely-typed copy of the table purely to allow this.
 */
export function elementColor(el: string, fallback = "var(--color-muted)"): string {
  return el in LIGHT ? ELEMENT_COLORS[el as Element] : fallback;
}

// Element tint backgrounds. The light values are near-white washes that stay
// near-white on a dark palette, so they're derived from the hue at low alpha
// instead — one expression that reads correctly under every palette.
const TINT_FALLBACK: Record<Element, string> = {
  fire: "#fff0ec", earth: "#f0f5ee", air: "#f4efdd", water: "#eaf0f8",
};

export const ELEMENT_BG: Record<Element, string> = {
  get fire() { return elementTint("fire"); },
  get earth() { return elementTint("earth"); },
  get air() { return elementTint("air"); },
  get water() { return elementTint("water"); },
};

function elementTint(el: Element): string {
  if (typeof document === "undefined") return TINT_FALLBACK[el];
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  // 8-digit hex, so it composites over whatever card it lands on and needs no
  // separate light/dark value. Still a hex string, so concatenation is safe.
  return dark ? `${ELEMENT_COLORS[el]}26` : TINT_FALLBACK[el];
}

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
  deep:     "Feeling, intuition, slow creative depth.",
  surge:    "Initiative, courage, visible action.",
  building: "Patient craft, structure, finishing.",
  clear:    "Thought, communication, connection.",
};

// Why each is NAMED that — the explication the names need. Each name is meant
// to evoke its element AND what the time is for, so the word does double duty.
export const CHARACTER_WHY: Record<TideCharacter, string> = {
  deep:     "Named for still, deep water — the tide of what's below the surface: feeling, intuition, slow depth. The Moon in a water sign.",
  surge:    "Named for a surge — fire rising, energy breaking forward into action and visibility. The Moon in a fire sign.",
  building: "Named for the work of building — earth's patient making, structuring, finishing what's begun. The Moon in an earth sign.",
  clear:    "Named for clear air and a clear head — thought, words, connection, the open sky. The Moon in an air sign.",
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
//
// `voc` is not decoration. This function used to know nothing about the void,
// while a SEPARATE named-pattern engine independently emitted "the day's
// initiations won't take — begin nothing you want to last." Both rendered in
// the same hero card, so a high-tide void day read as the app arguing with
// itself: "Energy is at its peak — fully engage, act, publish, lead" directly
// above "begin nothing you want to last." Each sentence was true; stacked,
// they cost the reader their trust in both.
//
// The reconciliation is deliberately NOT "hide the void warning." A void is
// the more specific, more actionable fact, so it wins the framing — but it
// qualifies BEGINNINGS only, so the energy still gets named and pointed at
// what it's actually good for now: momentum that already exists.
export function tideGuidance(character: TideCharacter, level: string, voc = false): string {
  const grain = CHARACTER_GRAIN[character];
  const pace = LEVEL_GUIDANCE[level] ?? LEVEL_GUIDANCE.tide;
  const verbs = grain.split(", ");
  if (level === "high" || level === "rising") {
    if (voc) {
      // The energy is real — spend it on what's already moving. Naming the
      // charge and then redirecting it beats pretending the day is flat.
      return `Energy's high, but the Moon's void — spend it on what's already moving, not on a start. Good for ${verbs.slice(0, 3).join(", ")} in service of something underway.`;
    }
    return `${pace} Lean into what this tide favours — ${verbs.slice(0, 3).join(", ")}.`;
  }
  if (level === "ebb" || level === "low") {
    // On low/ebb, favor the receptive end of the character
    const gentle = character === "surge" ? "let the fire bank — stretch, move gently, don't force a start"
      : character === "building" ? "tidy, close loops, tend what's already built"
      : character === "clear" ? "review notes, read, let ideas settle rather than broadcast"
      : "rest fully, write, let feeling move without acting on it";
    // Low tide and a void agree with each other — no contradiction to resolve,
    // so the void only adds the reason.
    return `${pace} ${gentle.charAt(0).toUpperCase() + gentle.slice(1)}.${voc ? " The Moon's void, which points the same way." : ""}`;
  }
  if (voc) {
    return `${pace} With the Moon void, favour finishing over starting — good for ${verbs.slice(0, 3).join(", ")} on work already in hand.`;
  }
  return `${pace} Good for ${verbs.slice(0, 3).join(", ")}.`;
}

// Honest reading for a genuinely undramatic day — most days. Never manufacture
// intensity; a calm sky is reported as calm, character-tinted but unforced.
export const QUIET_DAY_GUIDANCE: Record<TideCharacter, string> = {
  deep:     "A quiet, still day — nothing pulling hard. Follow what feeling asks for; the rhythm's your own.",
  surge:    "A quiet, open day — no strong current. Move if you want to, but nothing's pushing. The rhythm's your own.",
  building: "A quiet, steady day — nothing demanding. Good for ordinary, unhurried work. The rhythm's your own.",
  clear:    "A quiet, open day — the sky's calm. Think, drift, or do nothing in particular. The rhythm's your own.",
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
