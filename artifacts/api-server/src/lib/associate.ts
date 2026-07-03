/**
 * Association layer — maps a plain phrase (a Guiding Star, a task, a habit) to
 * a planetary + elemental + window-type signature, so a person who knows no
 * astrology still gets their aim placed in the right timing lane.
 *
 * "Aligned spine" → Saturn (structure, discipline) + Sun (vitality, the
 * backbone) → an earth-leaning aim, best in focused deliberate blocks.
 *
 * The deterministic keyword mapper below is the primary path: free, offline,
 * good enough for most phrases, and the honest fallback whenever the optional
 * AI enrichment isn't available. AI (routes/associate.ts) only sharpens it.
 */

export type WindowType =
  | "deep_work" | "creative" | "planning" | "admin" | "social"
  | "relationship" | "recovery" | "study" | "launch" | "retreat";

export interface Association {
  element: "fire" | "earth" | "air" | "water";
  planets: string[];       // strongest first, up to 2
  windowType: WindowType;
  rationale: string;       // one plain sentence, no jargon required to read
  source: "keywords" | "ai";
}

interface PlanetProfile {
  element: Association["element"];
  windowType: WindowType;
  short: string;           // plain gloss used in the rationale
  keywords: string[];
}

// Planet → its natural element (domicile leaning), a default window type, and
// the words that evoke it. Kept deliberately human — "spine", "money", "reach
// out" — since the whole point is that a non-astrologer's phrasing maps cleanly.
const PLANETS: Record<string, PlanetProfile> = {
  Sun: {
    element: "fire", windowType: "deep_work", short: "vitality and visible purpose",
    keywords: ["shine", "vitality", "energy", "confidence", "confident", "lead", "leader", "leadership", "visible", "visibility", "present", "presence", "express", "expression", "identity", "purpose", "spine", "backbone", "posture", "vital", "alive", "radiate", "self", "courageous", "stage", "perform", "spotlight", "authentic"],
  },
  Moon: {
    element: "water", windowType: "recovery", short: "care and rest",
    keywords: ["rest", "sleep", "nap", "care", "nourish", "nourishment", "nurture", "home", "feel", "feeling", "emotional", "emotion", "comfort", "cozy", "family", "heal", "healing", "soothe", "gentle", "mother", "belly", "digest", "hydrate", "cry", "soft", "receptive", "womb", "cook", "meal", "bath"],
  },
  Mercury: {
    element: "air", windowType: "planning", short: "thinking and communicating",
    keywords: ["write", "writing", "read", "reading", "learn", "learning", "study", "think", "thinking", "plan", "planning", "organize", "organise", "sort", "communicate", "communication", "talk", "email", "message", "call", "connect", "idea", "ideas", "notes", "journal", "language", "words", "schedule", "admin", "errand", "errands", "research", "code", "coding"],
  },
  Venus: {
    element: "earth", windowType: "social", short: "beauty, pleasure, and relating",
    keywords: ["love", "beauty", "beautiful", "art", "aesthetic", "pleasure", "enjoy", "relationship", "relate", "harmony", "harmonize", "date", "romance", "money", "finances", "budget", "value", "values", "worth", "craft", "design", "decorate", "style", "taste", "gift", "kindness", "friend", "friendship", "connection", "sensual", "garden", "flowers", "music"],
  },
  Mars: {
    element: "fire", windowType: "deep_work", short: "drive and physical effort",
    keywords: ["train", "training", "exercise", "workout", "run", "running", "lift", "gym", "strength", "strong", "fight", "push", "drive", "action", "act", "assert", "boundary", "boundaries", "courage", "brave", "compete", "sprint", "sweat", "physical", "body", "move", "movement", "muscle", "discipline", "hard", "cut", "decisive", "attack", "protect", "defend"],
  },
  Jupiter: {
    element: "fire", windowType: "study", short: "growth and the bigger frame",
    keywords: ["grow", "growth", "expand", "expansion", "teach", "teaching", "publish", "publishing", "learn", "study", "travel", "adventure", "explore", "philosophy", "meaning", "faith", "believe", "vision", "big", "abundance", "generous", "generosity", "optimism", "wisdom", "mentor", "share", "scale", "reach", "opportunity"],
  },
  Saturn: {
    element: "earth", windowType: "deep_work", short: "structure and discipline",
    keywords: ["structure", "discipline", "disciplined", "commit", "commitment", "routine", "habit", "consistent", "consistency", "foundation", "build", "building", "master", "mastery", "patience", "patient", "boundary", "limit", "focus", "focused", "finish", "complete", "responsible", "responsibility", "career", "work", "long-term", "goal", "plan", "spine", "bones", "posture", "align", "aligned", "alignment", "stability", "stable", "solid", "ground", "grounded", "maintain", "steady", "save", "savings", "accountable"],
  },
  Uranus: {
    element: "air", windowType: "creative", short: "change and experiment",
    keywords: ["change", "break", "disrupt", "experiment", "innovate", "innovation", "freedom", "free", "different", "unconventional", "rebel", "reinvent", "invent", "tech", "technology", "sudden", "shift", "future", "radical", "original", "quit", "reset"],
  },
  Neptune: {
    element: "water", windowType: "creative", short: "imagination and the inner life",
    keywords: ["dream", "dreams", "imagine", "imagination", "art", "music", "poetry", "spiritual", "spirit", "meditate", "meditation", "intuition", "intuitive", "compassion", "surrender", "flow", "creative", "vision", "mystical", "escape", "film", "photography", "paint", "painting", "float", "pray", "prayer"],
  },
  Pluto: {
    element: "water", windowType: "deep_work", short: "depth and transformation",
    keywords: ["transform", "transformation", "deep", "depth", "power", "intense", "intensity", "release", "let go", "shadow", "psyche", "therapy", "heal deep", "rebirth", "purge", "confront", "truth", "obsession", "control", "regenerate", "root", "excavate", "process"],
  },
};

const ELEMENT_DEFAULT_WINDOW: Record<Association["element"], WindowType> = {
  fire: "deep_work", earth: "deep_work", air: "planning", water: "recovery",
};

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
}

/** Deterministic keyword association — the free, offline, always-available path. */
export function associateDeterministic(text: string): Association {
  const tokens = tokenize(text);
  const joined = ` ${tokens.join(" ")} `;
  const scores: Record<string, number> = {};

  for (const [planet, profile] of Object.entries(PLANETS)) {
    let score = 0;
    for (const kw of profile.keywords) {
      // Multi-word keywords ("let go", "long-term") match as substrings; single
      // words match as whole tokens so "art" doesn't fire on "start".
      if (kw.includes(" ") || kw.includes("-")) {
        if (joined.includes(` ${kw} `) || text.toLowerCase().includes(kw)) score += 1;
      } else if (tokens.includes(kw)) {
        score += 1;
      }
    }
    if (score > 0) scores[planet] = score;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    // Nothing matched — a neutral, honest default rather than a forced reading.
    return {
      element: "earth", planets: [], windowType: "deep_work", source: "keywords",
      rationale: "No strong planetary signature — treat this as a steady, do-it-in-a-focused-block aim.",
    };
  }

  const topPlanet = ranked[0][0];
  const secondPlanet = ranked.length > 1 && ranked[1][1] >= ranked[0][1] - 1 ? ranked[1][0] : null;
  const top = PLANETS[topPlanet];
  const planets = secondPlanet ? [topPlanet, secondPlanet] : [topPlanet];

  const art = /^[aeiou]/.test(top.element) ? "an" : "a";
  const rationale = secondPlanet
    ? `Reads as ${topPlanet} (${top.short}) with a note of ${secondPlanet} (${PLANETS[secondPlanet].short}) — ${art} ${top.element}-leaning aim.`
    : `Reads as ${topPlanet} (${top.short}) — ${art} ${top.element}-leaning aim.`;

  return {
    element: top.element,
    planets,
    windowType: top.windowType ?? ELEMENT_DEFAULT_WINDOW[top.element],
    rationale,
    source: "keywords",
  };
}

export const PLANET_NAMES = Object.keys(PLANETS);
export const WINDOW_TYPES: WindowType[] = ["deep_work", "creative", "planning", "admin", "social", "relationship", "recovery", "study", "launch", "retreat"];
