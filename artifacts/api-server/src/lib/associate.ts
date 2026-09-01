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
  /**
   * Every elemental lane this work legitimately belongs in, primary first.
   *
   * Most tasks have one. Some genuinely have several — filming a series is
   * fire (the performance) and water (the making) and air (the writing) at
   * once, and forcing a single lane means the scheduler rejects two thirds
   * of the hours that actually suit it. Absent or empty means `[element]`,
   * so every existing caller keeps its exact behaviour.
   */
  elements?: Array<"fire" | "earth" | "air" | "water">;
  planets: string[];       // strongest first, up to 2
  /** The sky condition `rationale` presupposes, when it presupposes one. */
  rationaleNeeds?: GlossNeed;
  windowType: WindowType;
  rationale: string;       // one plain sentence, no jargon required to read
  source: "keywords" | "ai" | "correspondence";
  // When the activity-correspondence table recognizes the text, its richer
  // signature rides along — the election engine's natal layer needs these.
  activityKey?: string;
  houses?: number[];
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
    keywords: ["shine", "vitality", "energy", "confidence", "confident", "lead", "leader", "leadership", "visible", "visibility", "present", "presence", "express", "expression", "identity", "purpose", "spine", "backbone", "posture", "vital", "alive", "radiate", "self", "courageous", "stage", "perform", "spotlight", "authentic",
      // being seen online IS solar work — posting is visibility, not paperwork
      "post", "posts", "posting", "instagram", "ig", "tiktok", "brand", "branding", "audience", "announce", "announcement", "promote", "promotion", "showcase", "profile", "bio"],
  },
  Moon: {
    element: "water", windowType: "recovery", short: "care and rest",
    keywords: ["rest", "sleep", "nap", "care", "nourish", "nourishment", "nurture", "home", "feel", "feeling", "emotional", "emotion", "comfort", "cozy", "family", "heal", "healing", "soothe", "gentle", "mother", "belly", "digest", "hydrate", "cry", "soft", "receptive", "womb", "cook", "meal", "bath"],
  },
  Mercury: {
    element: "air", windowType: "planning", short: "thinking and communicating",
    keywords: ["write", "writing", "read", "reading", "learn", "learning", "study", "think", "thinking", "plan", "planning", "organize", "organise", "sort", "communicate", "communication", "talk", "email", "message", "call", "connect", "idea", "ideas", "notes", "journal", "language", "words", "schedule", "admin", "errand", "errands", "research", "code", "coding",
      "content", "caption", "captions", "newsletter", "blog", "podcast", "tweet", "thread", "text", "texts", "edit", "editing", "upload", "website", "site", "draft", "outline", "reply", "replies", "dm", "dms", "inbox"],
  },
  Venus: {
    element: "earth", windowType: "social", short: "beauty, pleasure, and relating",
    keywords: ["love", "beauty", "beautiful", "art", "aesthetic", "pleasure", "enjoy", "relationship", "relate", "harmony", "harmonize", "date", "romance", "money", "finances", "budget", "value", "values", "worth", "craft", "design", "decorate", "style", "taste", "gift", "kindness", "friend", "friendship", "connection", "sensual", "garden", "flowers", "music",
      // The person-day phrasings (USER-SIMULATIONS-2026-08-21-REST #16, #18): a
      // dinner with a named person, seeing your people, a drink, a visit —
      // Venus's company, which the table did not recognise as anything.
      "friends", "people", "dinner", "drinks", "lunch", "brunch", "coffee", "visit", "hang", "hangout", "catch up", "see my people", "dinner with", "drinks with", "lunch with", "coffee with", "date night", "night out", "picnic", "hosting", "guests"],
  },
  Mars: {
    element: "fire", windowType: "deep_work", short: "drive and physical effort",
    keywords: ["train", "training", "exercise", "workout", "run", "running", "lift", "gym", "strength", "strong", "fight", "push", "drive", "action", "act", "assert", "boundary", "boundaries", "courage", "brave", "compete", "sprint", "sweat", "physical", "body", "move", "movement", "muscle", "discipline", "hard", "cut", "decisive", "attack", "protect", "defend",
      "start", "begin", "initiate", "ship", "tackle", "chase", "hustle"],
  },
  Jupiter: {
    element: "fire", windowType: "study", short: "growth and the bigger frame",
    keywords: ["grow", "growth", "expand", "expansion", "teach", "teaching", "publish", "publishing", "learn", "study", "travel", "adventure", "explore", "philosophy", "meaning", "faith", "believe", "vision", "big", "abundance", "generous", "generosity", "optimism", "wisdom", "mentor", "share", "scale", "reach", "opportunity",
      "launch", "market", "marketing", "pitch", "sell", "sales", "campaign", "outreach", "apply", "application", "sponsor", "collab", "collaboration"],
  },
  Saturn: {
    element: "earth", windowType: "deep_work", short: "structure and discipline",
    keywords: ["structure", "discipline", "disciplined", "commit", "commitment", "routine", "habit", "consistent", "consistency", "foundation", "build", "building", "master", "mastery", "patience", "patient", "boundary", "limit", "focus", "focused", "finish", "complete", "responsible", "responsibility", "career", "work", "long-term", "goal", "plan", "spine", "bones", "posture", "align", "aligned", "alignment", "stability", "stable", "solid", "ground", "grounded", "maintain", "steady", "save", "savings", "accountable",
      // Saturn as ENOUGH (AUDIT-HOLISM §2): the stop, the boundary, the thing
      // declined. "Leave work at six" read as nothing at all (#19).
      "enough", "stop", "leave work", "leave work at", "log off", "clock off", "stop working", "say no", "no more", "decline", "cut off", "wind down", "shut the laptop", "done by"],
  },
  Uranus: {
    element: "air", windowType: "creative", short: "change and experiment",
    keywords: ["change", "break", "disrupt", "experiment", "innovate", "innovation", "freedom", "free", "different", "unconventional", "rebel", "reinvent", "invent", "tech", "technology", "sudden", "shift", "future", "radical", "original", "quit", "reset"],
  },
  Neptune: {
    element: "water", windowType: "creative", short: "imagination and the inner life",
    keywords: ["dream", "dreams", "imagine", "imagination", "art", "music", "poetry", "spiritual", "spirit", "meditate", "meditation", "intuition", "intuitive", "compassion", "surrender", "flow", "creative", "vision", "mystical", "escape", "film", "photography", "paint", "painting", "float", "pray", "prayer",
      "photo", "photos", "image", "images", "visual", "visuals", "video", "videos", "reel", "reels", "shoot", "footage", "moodboard"],
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

import { matchActivity } from "./activityCorrespondences.js";
import type { GlossNeed } from "./glossCondition.js";

/** Deterministic keyword association — the free, offline, always-available path.
 * First pass is the activity-correspondence table (the canonical activity →
 * astrology list); the older planet-keyword scoring is the fallback beneath it. */
export function associateDeterministic(text: string): Association {
  const hit = matchActivity(text);
  if (hit) {
    const a = hit.activity;
    const planets = Object.entries(a.planets).sort((x, z) => z[1] - x[1]).map(([p]) => p).slice(0, 2);
    return {
      element: a.element, planets, windowType: a.windowType as WindowType,
      rationale: a.gloss,
      // Carried, not evaluated: this function is pure text in, association
      // out, with no date and no sky. The caller that knows WHEN the block
      // lands is the only one that can decide whether a gloss written in the
      // definite is true, and plan.ts does exactly that.
      rationaleNeeds: a.glossNeeds,
      source: "correspondence",
      activityKey: a.key, houses: a.houses,
    };
  }
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
    // Nothing matched — say so honestly. The UI offers element overrides, so
    // a shrug here is an invitation to correct, not a verdict. (This default
    // used to silently paint every unrecognized task "earth" — the owner
    // noticed a whole list coming back identical.)
    return {
      element: "earth", planets: [], windowType: "deep_work", source: "keywords",
      rationale: "No clear signature from the words alone — defaulting to a steady earth block. Tap an element to correct it.",
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
