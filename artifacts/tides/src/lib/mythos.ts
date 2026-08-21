import { SIGNS as LEXICON_SIGNS } from "../../../../lib/lexicon/src/signs";
// Element hues follow the active palette — see lib/elements.ts for why they
// stay hex rather than var().
import { ELEMENT_COLORS } from "@/lib/elements";
// The mythic heart — canonical content for the four elements and seven classical
// planets. Per the vocabulary treaty (DESIGN.md §16): elements are the domains of
// a life (yours), planets are the voices of the moment (the sky's), and the tide
// is where they meet. Everything the app says about an element or planet should
// draw from here, so the myth stays coherent across surfaces.

export interface ElementMythos {
  key: string;
  name: string;
  essence: string;       // one line — shown at selection moments
  myth: string;          // 2–3 sentences — the deeper read
  domains: string[];     // life areas this element governs
  practices: string[];   // ongoing disciplines that feed it
  activities: string[];  // concrete things to plan/log under this element
  color: string;
}

export const ELEMENT_MYTHOS: Record<string, ElementMythos> = {
  fire: {
    key: "fire", name: "Fire", get color() { return ELEMENT_COLORS.fire; },
    essence: "The will to begin — courage, desire, and the spark that moves first.",
    myth: "Fire is the element of initiation: the part of a life that wants to exist louder tomorrow than today. It doesn't ask permission and it doesn't keep — it must be spent to stay alive. A fire Guiding Star is a place you've chosen to be brave.",
    domains: ["ambition & launch", "the body in motion", "leadership", "creative ignition", "visibility"],
    practices: ["train the body", "make the bold ask", "start before ready", "perform, publish, show up"],
    activities: ["workout", "launch", "pitch", "perform", "compete", "declare", "begin the thing"],
  },
  earth: {
    key: "earth", name: "Earth", get color() { return ELEMENT_COLORS.earth; },
    essence: "The will to endure — craft, patience, and what remains when the season turns.",
    myth: "Earth is the element of manifestation: nothing is real until it has weight, and earth is where intentions take on weight. It works slowly and doesn't care about moods. An earth Guiding Star is a place you've chosen to build something that outlasts enthusiasm.",
    domains: ["money & resources", "home & land", "craft & skill", "health routines", "long works"],
    practices: ["tend daily", "finish what's started", "keep the ledger", "maintain before it breaks"],
    activities: ["build", "save & budget", "cook & tend", "practice the craft", "organize", "complete", "repair"],
  },
  air: {
    key: "air", name: "Air", get color() { return ELEMENT_COLORS.air; },
    essence: "The will to understand — language, connection, and the space between minds.",
    myth: "Air is the element of relation: ideas only become knowledge when they move between people, and air is the moving. It doubts, compares, translates, connects. An air Guiding Star is a place you've chosen to think in public — to write, teach, converse, and be changed by the exchange.",
    domains: ["writing & speech", "study & ideas", "friendship & network", "trade & negotiation", "teaching"],
    practices: ["write daily", "read widely", "keep correspondence", "explain it to someone"],
    activities: ["write", "study", "call & connect", "negotiate", "teach", "brainstorm", "edit"],
  },
  water: {
    key: "water", name: "Water", get color() { return ELEMENT_COLORS.water; },
    essence: "The will to feel — depth, memory, and the life that moves beneath the surface.",
    myth: "Water is the element of meaning: it holds what happened and turns it into who you are. It cannot be forced, only invited. A water Guiding Star is a place you've chosen to go deep — into feeling, healing, intimacy, dream, or art that comes from the underside.",
    domains: ["emotional life", "intimacy & family", "healing & rest", "dream & spirit", "deep art"],
    practices: ["keep the journal", "protect rest", "sit with what surfaces", "return to the well"],
    activities: ["journal", "rest deliberately", "deep conversation", "meditate", "make from feeling", "grieve & release", "swim in it"],
  },
};

export interface PlanetMythos {
  key: string;
  name: string;
  glyph: string;
  archetype: string;     // the voice's name
  essence: string;       // one line
  myth: string;          // 2–3 sentences
  speaksFor: string[];   // what this voice governs when it's loud
  whenLoud: string;      // what to do when this planet is emphasized
  color: string;
}

export const PLANET_MYTHOS: Record<string, PlanetMythos> = {
  Sun: {
    key: "Sun", name: "Sun", glyph: "☉︎", archetype: "The Sovereign", color: "#c08020",
    essence: "Identity, vitality, and the center that everything else orbits.",
    myth: "The Sun is the voice of coherence — the part of the day that asks whether your actions still orbit your actual center. When it speaks, questions of purpose, visibility, and self-respect come forward.",
    speaksFor: ["purpose", "visibility", "vitality", "authority", "self-expression"],
    whenLoud: "Step into the light on purpose: lead, present, decide as yourself. Vitality is available — spend it on what's actually yours.",
  },
  Moon: {
    key: "Moon", name: "Moon", glyph: "☽︎", archetype: "The Nurturer", color: "#7080a0",
    essence: "Feeling, habit, memory — the daily inner weather.",
    myth: "The Moon is the fastest voice and the closest: the mood of the body, the pull of habit, the tide itself. When it speaks, the question is what needs tending — in you, in your home, in the people you keep.",
    speaksFor: ["mood & instinct", "home", "nourishment", "habit", "the past"],
    whenLoud: "Tend rather than push. Feed what keeps you alive — body, home, sleep, the people who are your ground.",
  },
  Mercury: {
    key: "Mercury", name: "Mercury", glyph: "☿︎", archetype: "The Messenger", color: "#608060",
    essence: "Language, exchange, and the paths between things.",
    myth: "Mercury is the voice of connection-in-motion: words, messages, routes, trades, jokes. When it speaks, information wants to move — and the quality of your day depends on how cleanly it does.",
    speaksFor: ["writing & speech", "learning", "commerce", "travel & errands", "wit"],
    whenLoud: "Move the words: write, send, ask, sort, name the thing precisely. Friction in communication is the day's real work.",
  },
  Venus: {
    key: "Venus", name: "Venus", glyph: "♀︎", archetype: "The Connector", color: "#c06090",
    essence: "Attraction, beauty, and what makes life worth arranging.",
    myth: "Venus is the voice of value — what you're drawn to, what you find beautiful, who you want near. When it speaks, harmony becomes available: in rooms, in relationships, in work made pleasing.",
    speaksFor: ["love & friendship", "beauty & art", "pleasure", "diplomacy", "worth"],
    whenLoud: "Arrange, beautify, reconcile, enjoy. Reach toward people and things you value — grace is doing half the work today.",
  },
  Mars: {
    key: "Mars", name: "Mars", glyph: "♂︎", archetype: "The Warrior", color: "#c04040",
    essence: "Drive, edge, and the courage to cut.",
    myth: "Mars is the voice of force — the part of you that acts, defends, competes, and separates what must be separated. When it speaks, energy demands a worthy target; unaimed, it turns to friction.",
    speaksFor: ["action & effort", "the body's power", "boundaries", "conflict", "decisiveness"],
    whenLoud: "Give the force a job: train hard, make the cut, have the direct conversation. Aim it or it will aim itself.",
  },
  Jupiter: {
    key: "Jupiter", name: "Jupiter", glyph: "♃︎", archetype: "The Sage", color: "#6040a0",
    essence: "Growth, meaning, and the larger frame.",
    myth: "Jupiter is the voice of more — more scope, more meaning, more generosity. When it speaks, doors are looser on their hinges and the question is which larger story you're willing to step into.",
    speaksFor: ["opportunity", "teaching & belief", "travel & horizon", "generosity", "luck you position for"],
    whenLoud: "Say yes bigger: publish, apply, invite, teach, expand the plan one honest size up.",
  },
  Saturn: {
    key: "Saturn", name: "Saturn", glyph: "♄︎", archetype: "The Builder", color: "#807060",
    essence: "Structure, time, and the dignity of limits.",
    myth: "Saturn is the slowest classical voice and the most honest: it speaks for what holds when enthusiasm doesn't. When it's loud, the day rewards discipline, pruning, and promises kept — and quietly taxes everything else.",
    speaksFor: ["commitment", "structure", "boundaries in time", "mastery", "consequence"],
    whenLoud: "Do the unglamorous right thing: keep the commitment, cut the excess, build the part no one sees. It compounds.",
  },
};

// Concrete activities each planetary voice favors when it's loud (hours, day
// rulers, aspects). Complements PLANET_MYTHOS.whenLoud with pickable items.
export const PLANET_ACTIVITIES: Record<string, string[]> = {
  Sun:     ["lead the meeting", "make the decision as yourself", "be seen — present, publish", "tend vitality: light, movement", "claim credit honestly", "set the week's direction"],
  Moon:    ["tend home & body", "cook for someone", "nap without guilt", "journal the mood", "call your people", "water rituals — bathe, swim"],
  Mercury: ["write & send", "sort & name things", "learn the skill", "run the errands", "negotiate the detail", "fix the words"],
  Venus:   ["reconcile & connect", "beautify the space", "enjoy something on purpose", "tend love & friendship", "choose the pleasing option", "make it beautiful"],
  Mars:    ["train hard", "make the cut", "have the direct conversation", "compete at something", "do the brave errand", "finish by force if needed"],
  Jupiter: ["say yes bigger", "apply & publish", "teach what you know", "plan the expansion", "be generous first", "zoom out to the larger story"],
  Saturn:  ["keep the commitment", "prune & cancel", "do the boring foundation", "review the long game", "pay the debt", "build the part no one sees"],
};

// ── The twelve signs — where the Moon (or any voice) is standing ──────────────
// The Moon changes sign every ~2.5 days; this is the app's answer to "so what
// should I do differently?" when it does. Written for Moon-in-sign first, but
// phrased so any placement can borrow it.

export interface SignMythos {
  key: string;
  name: string;
  element: string;       // fire | earth | air | water
  glyph: string;
  /** HOW work wants doing under this sign — the rail's base line. */
  approach: string;
  /** The sign's picture in one line; kept for the dossier and the share card. */
  essence: string;
  /** Tide vocabulary — shown inside the tide instrument only. */
  feel: string;
  favors: string[];      // examples; surfaces show one
  shadow: string;        // the tendency to watch for
}

// ONE SOURCE. Built from lib/lexicon/src/signs.ts rather than written here,
// so this table, the dossier's inflections, the server's SIGN_GUIDE and the
// share card cannot drift apart again (AUDIT-EXPLAINERS-2026-08-21 §2a).
export const SIGN_MYTHOS: Record<string, SignMythos> = Object.fromEntries(
  Object.values(LEXICON_SIGNS).map(e => [e.key, {
    key: e.key, name: e.key, element: e.element, glyph: e.glyph,
    approach: e.approach, essence: e.image, feel: e.tideFeel, favors: e.favors, shadow: e.watch,
  }]),
);


// Sort a plain-language intention into an element — the cheap, transparent layer
// before the advisor's richer LLM sorting. Returns the best-matching element key
// or null if nothing clears the bar.
const INTENT_KEYWORDS: Record<string, string[]> = {
  fire: ["workout", "gym", "run", "train", "launch", "start", "pitch", "perform", "compete", "bold", "energy", "exercise", "sport", "lead"],
  earth: ["build", "money", "save", "budget", "finance", "home", "garden", "cook", "organize", "finish", "craft", "routine", "habit", "maintain", "clean"],
  air: ["write", "writing", "book", "study", "learn", "read", "teach", "network", "email", "call", "talk", "idea", "plan", "podcast", "content"],
  water: ["feel", "heal", "rest", "sleep", "meditate", "journal", "family", "relationship", "love", "art", "music", "dream", "therapy", "grief"],
};

export function sortIntentToElement(text: string): string | null {
  const t = text.toLowerCase();
  let best: string | null = null, bestScore = 0;
  for (const [el, words] of Object.entries(INTENT_KEYWORDS)) {
    const score = words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { best = el; bestScore = score; }
  }
  return bestScore > 0 ? best : null;
}
