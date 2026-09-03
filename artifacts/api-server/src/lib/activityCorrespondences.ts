/**
 * Activity correspondences — the canonical activity → astrology table
 * (owner 2026-07-20). One extensive list, three consumers:
 *
 *   1. The election picker: choose an activity → get day/week/month times,
 *      localized (planetary hours, since this is in-app per-user) and
 *      personalized (natal houses/planets → the GREAT tier).
 *   2. Quality tiers: GOOD = the activity's planetary hour, a Moon aspect to
 *      its significators, its Moon-sign affinity. GREAT = its natal house or
 *      natal significator is activated, or a standing sky aspect between its
 *      significators is in play — or GOOD conditions stacked.
 *   3. Sortage: matching a Guiding Star / step / task title against keywords
 *      gives it a timing signature (element, window type, significators).
 *
 * Intellectual spine: knowledge/electional-astrology-v1 (house governs the
 * matter; the house ruler and co-significators are the venture's planets;
 * the Moon times it) extended to everyday, low-stakes activities. Classical
 * commitments kept: Mercury-Rx readings differ by activity (drafting loves
 * it, releasing hates it); VoC favors rest/clearing and blocks launches;
 * waxing builds, waning releases; hard aspects fuel exertion only.
 */

export type ActivityCategory =
  | "body" | "mind" | "craft" | "love" | "social" | "home" | "money" | "spirit" | "launch";

export const ACTIVITY_CATEGORIES: { key: ActivityCategory; label: string; gloss: string }[] = [
  { key: "body", label: "Body", gloss: "training, rest, the animal you live in" },
  { key: "mind", label: "Mind", gloss: "study, writing, thinking in public" },
  { key: "craft", label: "Craft & work", gloss: "deep work, finishing, the daily trade" },
  { key: "love", label: "Love & intimacy", gloss: "dates, bonds, repair" },
  { key: "social", label: "Social", gloss: "friends, hosting, networks" },
  { key: "home", label: "Home", gloss: "the rooms and rhythms you live inside" },
  { key: "money", label: "Money", gloss: "ledger, purchases, commitments" },
  { key: "spirit", label: "Spirit", gloss: "the inner life and its practices" },
  { key: "launch", label: "Launches & stakes", gloss: "the high-scrutiny elections" },
];

import type { GlossNeed } from "./glossCondition.js";

export interface ActivityCorrespondence {
  key: string;
  label: string;
  category: ActivityCategory;
  keywords: string[];               // free-text sortage (stars, steps, tasks)
  element: "fire" | "earth" | "air" | "water";
  planets: Record<string, number>;  // significators, weighted — Moon-aspect targets
  hourRulers: string[];             // planetary hours that make a GOOD time (classical 7 only)
  aspects: "soft" | "effort";       // geometry palette: soft(+quintile) vs hard-as-fuel
  signs: Record<string, string>;    // Moon-sign affinity → one-word gloss
  houses: number[];                 // governing houses — the natal/GREAT layer
  phase: "waxing" | "waning" | "new" | "full" | null;
  voc: "avoid" | "neutral" | "favor";
  mercuryRx: "hard" | "soft" | "favor" | null;
  windowType: string;               // app WINDOW_TYPES mapping (scheduling)
  gloss: string;
  /**
   * The sky condition this gloss speaks in the definite about, when it does.
   *
   * Most glosses are advice or rules and hold on any day. A handful are written
   * as though the condition were present — "the void is for this", "SUITS the
   * retrograde" — and those become false the moment they are shown as a
   * scheduled block's reason on a day without it. Naming the condition lets a
   * caller that knows the block's instant decide. See lib/glossCondition.
   */
  glossNeeds?: GlossNeed;
}

const A = (a: ActivityCorrespondence) => a;

/**
 * ACTIVITY MODE — what KIND of act this is, which decides how much force the
 * inherited electional rules should carry.
 *
 * The category error this fixes: classical electional doctrine is about
 * BEGINNINGS whose inception chart is expected to describe how the matter
 * unfolds. Applying it with equal weight to every ordinary action performed
 * during a day is not a faithful reading of it. A long run was being barred
 * from the top tier because a secondary Saturn happened to be retrograde;
 * beginning a company under a retrograde primary significator is much closer
 * to what the rule was written to judge.
 *
 *   inception   — a binding or consequential start; the rule applies in force
 *   execution   — doing the work; no generic motion cap
 *   maintenance — recurring upkeep; no cap unless it contains an inception
 *   revision    — editing, repairing, renegotiating, returning to
 *   recovery    — rest, release, retreat, restorative movement
 *
 * `revision` matters twice over: retrograde motion may positively SUIT it,
 * which is the clearest case where a condition treated as a caution is
 * actually a match.
 */
export type ActivityMode = "inception" | "execution" | "maintenance" | "revision" | "recovery";

const MODE_BY_KEY: Record<string, ActivityMode> = {
  // ── inception: a beginning the tradition would actually elect for ────────
  "haircut": "inception",            // the archetypal electional matter
  "start-regimen": "inception",
  "first-date": "inception",
  "apply-job": "inception",
  "big-purchase": "inception",
  "set-intention": "inception",
  "publish": "inception",
  "launch-venture": "inception",
  "sign-contract": "inception",
  "begin-partnership": "inception",
  "move-home": "inception",
  // A profile is published and then lived with — the same shape as any other
  // release, and the reason it sits under love but scores like a launch.
  "dating-profile": "inception",
  // Asking is a real beginning: it happens once, at a moment, and the answer
  // carries from it. Small stakes, but the tradition's logic applies.
  "ask-someone-out": "inception",

  // ── execution: doing the work ────────────────────────────────────────────
  "train-hard": "execution",
  "endurance": "execution",
  "intimacy": "execution",
  "deep-study": "execution",
  "first-draft": "execution",        // a draft is repeatable and low-stakes
  "learn-skill": "execution",
  "strategize": "execution",
  "teach-present": "execution",
  "deep-work": "execution",
  "negotiate": "execution",
  "hard-conversation": "execution",
  "deepen-bond": "execution",
  // Going out to meet people is repeatable and low-stakes — you can do it
  // again next week, so no inception cap belongs on it.
  "meet-someone-new": "execution",
  // The DTR talk is a conversation, filed with hard-conversation rather than
  // with the beginnings: it names something that already exists.
  "define-relationship": "execution",
  "host": "execution",
  "network": "execution",
  "call-family": "execution",
  "cook": "execution",
  "beautify": "execution",
  "garden": "execution",
  "divination": "execution",

  // ── maintenance: upkeep ──────────────────────────────────────────────────
  "organize": "maintenance",
  "admin-errands": "maintenance",
  "deep-clean": "maintenance",
  "budget": "maintenance",
  "settle-debts": "maintenance",

  // ── revision: returning to something ─────────────────────────────────────
  "edit-revise": "revision",
  "investigate": "revision",
  "finish-polish": "revision",
  "repair": "revision",
  "repair-bond": "revision",

  // ── recovery ─────────────────────────────────────────────────────────────
  "gentle-movement": "recovery",
  "deep-rest": "recovery",
  "meditate": "recovery",
  "journal": "recovery",
  "release": "recovery",
  "retreat": "recovery",
};

/**
 * Defaults to `execution`, the mode that carries NO inherited cap — so a
 * newly added activity is never silently subjected to a rule nobody chose for
 * it. tests/activity-modes.test.ts asserts the map is exhaustive, so the
 * default should be unreachable in practice.
 */
export function modeOf(key: string): ActivityMode {
  return MODE_BY_KEY[key] ?? "execution";
}

/**
 * MERCURY TEMPO — a pilot, and Compass synthesis rather than inherited doctrine.
 *
 * PROVENANCE, stated plainly because it would be easy to dress this as
 * classical and it is not: Lilly's scoring treats swift motion as fortifying
 * and slow motion as weakening, full stop. The idea that a SLOW planet
 * positively suits deliberate work — that different velocities match different
 * kinds of task rather than simply being better or worse — is ours. It must
 * always be labelled as Compass's reading, never as Bonatti's or Lilly's.
 *
 * Mercury only, deliberately. Many activities here are unmistakably Mercurial,
 * its speed varies visibly and often, and users already grasp the difference
 * between quick correspondence and careful revision. Inventing slow-Jupiter or
 * fast-Saturn correspondences would be building a system nobody inherited and
 * nobody has calibrated.
 *
 *   quick      — errands, short exchanges, rapid processing, live facilitation
 *   deliberate — editing, investigation, detailed review, returning to material
 *   either     — Mercury's tempo is not a material condition for this
 */
export type TempoPreference = "quick" | "deliberate" | "either";

const TEMPO_BY_KEY: Record<string, TempoPreference> = {
  // Deliberate: the work is careful, or it is a return to something.
  "edit-revise": "deliberate",
  "investigate": "deliberate",
  "deep-study": "deliberate",
  "finish-polish": "deliberate",
  "repair": "deliberate",
  "strategize": "deliberate",
  "budget": "deliberate",
  "settle-debts": "deliberate",
  "journal": "deliberate",
  "divination": "deliberate",
  "retreat": "deliberate",

  // Quick: short, live, or processed in volume.
  "admin-errands": "quick",
  "network": "quick",
  "call-family": "quick",
  "teach-present": "quick",
  "host": "quick",
  "organize": "quick",

  // Explicitly neither — Mercurial, but tempo is not the material condition.
  "first-draft": "either",
  "learn-skill": "either",
  "negotiate": "either",
  "hard-conversation": "either",
  "apply-job": "either",
  "repair-bond": "either",
  "big-purchase": "either",
  "set-intention": "either",
  "publish": "either",
  "launch-venture": "either",
  "sign-contract": "either",
  "move-home": "either",
  "begin-partnership": "either",
  "deep-work": "either",
};

export function tempoOf(key: string): TempoPreference {
  return TEMPO_BY_KEY[key] ?? "either";
}

/**
 * FORMAL SIGNIFICATORS — which planet actually carries the matter.
 *
 * The engine derived this from weight: `Object.entries(act.planets).filter(w
 * >= 0.8)`. That is the substitution the doctrinal review specifically warned
 * against, because weight and role answer different questions.
 *
 *   weight — how strongly does this planet CORRESPOND to the activity?
 *   role   — is this planet carrying the matter, such that its debility
 *            compromises the undertaking?
 *
 * A 0.8 planet can be secondary; a 0.6 planet can be the one the tradition
 * would judge. And any numeric cutoff stays arbitrary and gets hard to
 * explain — `>= 0.8` was never defended anywhere, it was just a number.
 *
 * Assigned ONLY for inceptions. Role currently changes nothing anywhere else,
 * and hand-annotating 46 activities where 35 of the annotations would be
 * unused is how a table acquires unexamined entries that later get trusted.
 * When role starts mattering elsewhere, it gets assigned there, deliberately.
 *
 * The luminaries appear here where they genuinely signify — they simply never
 * trigger the retrograde rule, having no retrogradation.
 */
const PRIMARY_SIGNIFICATORS: Record<string, string[]> = {
  "haircut": ["Venus"],
  "start-regimen": ["Saturn"],          // the discipline is the matter
  "apply-job": ["Mercury"],             // the act is sending the application
  "first-date": ["Venus"],
  "big-purchase": ["Venus"],            // value and possession
  "set-intention": ["Sun", "Moon"],
  "publish": ["Mercury"],               // publishing is communication
  "launch-venture": ["Sun", "Jupiter"], // identity, and its increase
  "sign-contract": ["Mercury"],         // the document itself
  "move-home": ["Moon", "Saturn"],      // the home, and the land under it
  "begin-partnership": ["Venus"],
};

/**
 * Formal significators of the matter. Falls back to the old weight heuristic
 * for anything unassigned — which is every non-inception, where nothing reads
 * this — so the fallback is inert rather than quietly authoritative.
 */
export function primarySignificatorsOf(key: string, planets: Record<string, number>): string[] {
  const explicit = PRIMARY_SIGNIFICATORS[key];
  if (explicit) return explicit;
  return Object.entries(planets).filter(([, w]) => w >= 0.8).map(([p]) => p);
}

/**
 * MINIMUM VIABLE — the reduced form of a practice when the timing is against it.
 *
 * Taken from the Cultivator schema, which had this field and a surface nobody
 * could reach. It is the sentence a `qualified` window needs in order to
 * finish itself: "several factors agree, but Mercury is retrograde" is only
 * half a thought — the other half is what to do instead of nothing.
 *
 * A property of the KIND of activity rather than of one person's instance:
 * the reduced form of hard training is roughly the same reduced form for
 * everyone, which is why it lives here and not on a user's row.
 *
 * Deliberately sparse. Only written where a genuinely smaller version exists —
 * an activity with no meaningful reduced form gets nothing, rather than a
 * filler sentence invented to fill the column. The app saying nothing is
 * better than the app padding.
 */
const MINIMUM_VIABLE: Record<string, string> = {
  "train-hard": "move for ten minutes at any intensity — the streak matters more than the session",
  "endurance": "go half the distance, slowly",
  "gentle-movement": "stretch once, standing where you are",
  "deep-study": "read one page properly rather than five badly",
  "first-draft": "write three sentences and stop",
  "edit-revise": "fix one paragraph",
  "learn-skill": "do the smallest drill once",
  "strategize": "write down the question you are actually trying to answer",
  "investigate": "note what you already know and what is missing",
  "deep-work": "twenty minutes on the hardest part, then stop",
  "finish-polish": "close one loose end",
  "organize": "clear one surface",
  "repair": "diagnose it, even if you do not fix it today",
  "admin-errands": "do the single one that is blocking something else",
  "cook": "make one component you can build on tomorrow",
  "deep-clean": "one room, or one drawer",
  "budget": "record what you spent, without deciding anything",
  "journal": "one line about today",
  "meditate": "three breaths, counted",
  "deep-rest": "lie down for ten minutes without your phone",
  "retreat": "take one hour off the grid instead of the day",
  "call-family": "send a message saying you will call",
  "deepen-bond": "ask one real question",
  "network": "reply to the message you have been leaving",
  "garden": "water what is already planted",
  "beautify": "put one thing back where it belongs",
};

/** The reduced form, or null where none was written. Never invented. */
export function minimumViableOf(key: string): string | null {
  return MINIMUM_VIABLE[key] ?? null;
}

export const ACTIVITIES: ActivityCorrespondence[] = [
  // ── BODY ────────────────────────────────────────────────────────────────────
  A({ key: "train-hard", label: "Hard training", category: "body",
    keywords: ["workout", "gym", "lift", "train", "hiit", "sprint", "crossfit"],
    element: "fire", planets: { Mars: 1.0, Sun: 0.8 }, hourRulers: ["Mars", "Sun"],
    aspects: "effort", signs: { Aries: "fast fire", Leo: "proud fire", Scorpio: "grinding depth", Capricorn: "endurance" },
    houses: [1, 6], phase: "waxing", voc: "neutral", mercuryRx: null, windowType: "deep_work",
    gloss: "Mars work — give the force a worthy target." }),
  A({ key: "endurance", label: "Long run / endurance", category: "body",
    keywords: ["run", "cycle", "swim laps", "long ride", "marathon", "hike hard"],
    element: "fire", planets: { Mars: 1.0, Saturn: 0.7 }, hourRulers: ["Mars", "Saturn"],
    aspects: "effort", signs: { Sagittarius: "far-ranging", Capricorn: "the long climb", Aquarius: "steady air" },
    houses: [1, 6], phase: null, voc: "neutral", mercuryRx: null, windowType: "deep_work",
    gloss: "Mars pointed down a long road, Saturn keeping the pace." }),
  A({ key: "gentle-movement", label: "Yoga / stretch / walk", category: "body",
    keywords: ["yoga", "stretch", "walk", "mobility", "tai chi", "pilates"],
    element: "water", planets: { Venus: 1.0, Moon: 0.8 }, hourRulers: ["Venus", "Moon"],
    aspects: "soft", signs: { Taurus: "the body settled", Pisces: "fluid", Libra: "balance" },
    houses: [1, 6], phase: null, voc: "favor", mercuryRx: null, windowType: "recovery",
    gloss: "Venus in the body — ease as a practice, not a reward." }),
  A({ key: "deep-rest", label: "Deep rest / nap", category: "body",
    keywords: ["rest", "nap", "sleep in", "do nothing", "recover", "lie down"],
    element: "water", planets: { Neptune: 1.0, Moon: 0.8, Saturn: 0.5 }, hourRulers: ["Moon", "Saturn"],
    aspects: "soft", signs: { Cancer: "home water", Pisces: "open sea", Taurus: "slow earth" },
    houses: [4, 12], phase: "waning", voc: "favor", mercuryRx: null, windowType: "recovery",
    gloss: "Slack water is real rest — the void is for this.", glossNeeds: "void-moon" }),
  A({ key: "haircut", label: "Haircut / grooming", category: "body",
    keywords: ["haircut", "hair", "barber", "salon", "groom", "beard"],
    element: "earth", planets: { Venus: 1.0 }, hourRulers: ["Venus"],
    aspects: "soft", signs: { Leo: "the mane itself", Libra: "the look", Taurus: "lasting shape" },
    houses: [1], phase: "waxing", voc: "avoid", mercuryRx: null, windowType: "admin",
    gloss: "Classical: cut waxing for growth and body; a Venus hour flatters." }),
  A({ key: "start-regimen", label: "Start a diet / regimen", category: "body",
    keywords: ["diet", "cleanse", "quit", "cut out", "fast", "no alcohol", "detox"],
    element: "earth", planets: { Saturn: 1.0, Moon: 0.6 }, hourRulers: ["Saturn"],
    aspects: "soft", signs: { Virgo: "the regimen", Capricorn: "the discipline" },
    houses: [6], phase: "waning", voc: "neutral", mercuryRx: null, windowType: "admin",
    gloss: "Begin removals on the waning moon — subtraction runs with the tide." }),
  A({ key: "intimacy", label: "Intimacy & sex", category: "body",
    keywords: ["sex", "intimacy", "lover", "sensual", "bedroom"],
    element: "water", planets: { Venus: 1.0, Mars: 0.8 }, hourRulers: ["Venus", "Mars"],
    aspects: "soft", signs: { Scorpio: "depth", Taurus: "the senses", Libra: "the pair", Leo: "play" },
    houses: [5, 8], phase: "waxing", voc: "neutral", mercuryRx: null, windowType: "relationship",
    gloss: "Venus and Mars in the same room — evening tides suit them." }),

  // ── MIND ────────────────────────────────────────────────────────────────────
  A({ key: "deep-study", label: "Deep study", category: "mind",
    keywords: ["study", "learn", "course", "read deeply", "textbook", "research paper"],
    element: "air", planets: { Mercury: 1.0, Saturn: 0.8 }, hourRulers: ["Mercury", "Saturn"],
    aspects: "soft", signs: { Gemini: "quick air", Virgo: "orderly earth", Aquarius: "systems", Capricorn: "the long haul" },
    houses: [3, 9], phase: null, voc: "neutral", mercuryRx: "favor", windowType: "study",
    gloss: "Mercury's matter under Saturn's roof; Rx favors review over new." }),
  A({ key: "first-draft", label: "Write a first draft", category: "mind",
    keywords: ["draft", "write", "freewrite", "begin the essay", "chapter", "blog"],
    element: "air", planets: { Mercury: 1.0, Moon: 0.6 }, hourRulers: ["Mercury", "Moon"],
    aspects: "soft", signs: { Gemini: "the messenger", Pisces: "the image-well", Sagittarius: "the thesis" },
    houses: [3], phase: "waxing", voc: "neutral", mercuryRx: "favor", windowType: "creative",
    gloss: "Drafting classically SUITS the retrograde — only the release doesn't.", glossNeeds: "mercury-retrograde" }),
  A({ key: "edit-revise", label: "Edit & revise", category: "mind",
    keywords: ["edit", "revise", "proofread", "rewrite", "polish the draft"],
    element: "earth", planets: { Mercury: 1.0, Saturn: 0.9 }, hourRulers: ["Mercury", "Saturn"],
    aspects: "soft", signs: { Virgo: "the craftsman's eye", Capricorn: "prune" },
    houses: [3, 6], phase: "waning", voc: "neutral", mercuryRx: "favor", windowType: "study",
    gloss: "The waning moon cuts; Virgo's water shows every pebble.", glossNeeds: "waning-moon" }),
  A({ key: "learn-skill", label: "Learn a new skill", category: "mind",
    keywords: ["practice", "tutorial", "language", "instrument", "new skill"],
    element: "air", planets: { Mercury: 1.0, Jupiter: 0.7 }, hourRulers: ["Mercury", "Jupiter"],
    aspects: "soft", signs: { Gemini: "beginner's mind", Sagittarius: "the horizon", Aquarius: "the system" },
    houses: [3, 9], phase: "waxing", voc: "neutral", mercuryRx: "soft", windowType: "study",
    gloss: "Mercury gathers, Jupiter gives it somewhere to go." }),
  A({ key: "strategize", label: "Plan & strategize", category: "mind",
    keywords: ["plan", "strategy", "roadmap", "quarter", "review goals", "vision"],
    element: "earth", planets: { Saturn: 1.0, Jupiter: 0.8, Mercury: 0.6 }, hourRulers: ["Saturn", "Jupiter"],
    aspects: "soft", signs: { Capricorn: "the mountain path", Sagittarius: "the far shore", Aquarius: "the pattern" },
    houses: [9, 10], phase: "new", voc: "neutral", mercuryRx: "soft", windowType: "planning",
    gloss: "Saturn frames, Jupiter aims — a New-Moon matter by nature." }),
  A({ key: "investigate", label: "Research & investigate", category: "mind",
    keywords: ["investigate", "dig", "audit", "due diligence", "deep dive"],
    element: "water", planets: { Mercury: 1.0, Pluto: 0.7 }, hourRulers: ["Mercury", "Saturn"],
    aspects: "soft", signs: { Scorpio: "the descent", Virgo: "the fine comb", Capricorn: "the ledger" },
    houses: [8, 3], phase: "waning", voc: "neutral", mercuryRx: "favor", windowType: "deep_work",
    gloss: "What's hidden yields to Scorpio water and a patient Mercury." }),
  A({ key: "teach-present", label: "Teach / present", category: "mind",
    keywords: ["teach", "present", "lecture", "workshop", "demo", "talk"],
    element: "fire", planets: { Mercury: 1.0, Sun: 0.8, Jupiter: 0.7 }, hourRulers: ["Sun", "Mercury", "Jupiter"],
    aspects: "soft", signs: { Leo: "the stage", Sagittarius: "the teacher", Gemini: "the words" },
    houses: [9, 10], phase: "waxing", voc: "avoid", mercuryRx: "soft", windowType: "social",
    gloss: "Sun for presence, Mercury for the words, Jupiter for the room." }),

  // ── CRAFT & WORK ────────────────────────────────────────────────────────────
  A({ key: "deep-work", label: "Deep work sprint", category: "craft",
    keywords: ["deep work", "focus", "sprint", "heads down", "build", "code"],
    element: "earth", planets: { Saturn: 1.0, Mercury: 0.8 }, hourRulers: ["Saturn", "Mercury"],
    aspects: "soft", signs: { Capricorn: "the long climb", Virgo: "precision", Aquarius: "the system", Scorpio: "sealed focus" },
    houses: [6, 10], phase: null, voc: "neutral", mercuryRx: null, windowType: "deep_work",
    gloss: "Close the door; Saturn holds it shut." }),
  A({ key: "finish-polish", label: "Finish & ship the last 10%", category: "craft",
    keywords: ["finish", "complete", "ship", "wrap up", "close out", "final touches"],
    element: "earth", planets: { Saturn: 1.0, Venus: 0.6 }, hourRulers: ["Saturn", "Venus"],
    aspects: "soft", signs: { Virgo: "the polish", Taurus: "the finish", Capricorn: "done means done" },
    houses: [6], phase: "waning", voc: "neutral", mercuryRx: "favor", windowType: "deep_work",
    gloss: "Endings belong to the waning half — completion runs with the tide." }),
  A({ key: "organize", label: "Organize / declutter", category: "craft",
    keywords: ["organize", "declutter", "clean up", "sort", "tidy", "inbox zero", "files"],
    element: "earth", planets: { Mercury: 1.0, Saturn: 0.8 }, hourRulers: ["Mercury", "Saturn"],
    aspects: "soft", signs: { Virgo: "everything in place", Capricorn: "prune" },
    houses: [6, 4], phase: "waning", voc: "favor", mercuryRx: "favor", windowType: "admin",
    gloss: "Clearing suits the void and the waning moon — removal, not launch." }),
  A({ key: "repair", label: "Repair & fix", category: "craft",
    keywords: ["repair", "fix", "patch", "maintenance", "debug", "mend"],
    element: "earth", planets: { Mars: 0.8, Saturn: 0.8, Mercury: 0.7 }, hourRulers: ["Mars", "Saturn"],
    aspects: "soft", signs: { Virgo: "the diagnosis", Scorpio: "root cause", Capricorn: "built to last" },
    houses: [6], phase: "waning", voc: "neutral", mercuryRx: "favor", windowType: "admin",
    gloss: "Rx loves re- words: repair, revisit, restore." }),
  A({ key: "admin-errands", label: "Admin & errands", category: "craft",
    // Widened 2026-09-03 (owner: "make dr's appt" returned no signature at
    // all — "i think the language, even tho it's shorthand here, should be
    // able to be deciphered by the app!"). Single-word entries match as whole
    // TOKENS (see associate.ts), so "dr" cannot false-positive inside "drive"
    // or "draft" — the tokenizer already splits "dr's" into "dr" and "s".
    // Real shorthand a person actually types, not a list built from the
    // dictionary: appt/apt, book, confirm, renew, RSVP, the DMV-adjacent
    // world, bills and prescriptions.
    keywords: ["errands", "errand", "admin", "paperwork", "forms", "form",
      "appointments", "appointment", "appt", "apt",
      "doctor", "dr", "dentist", "dmv",
      "book", "reschedule", "confirm", "renew", "rsvp",
      "license", "registration", "insurance",
      "bill", "bills", "pay", "prescription", "refill", "pharmacy",
      "calls", "call"],
    element: "air", planets: { Mercury: 1.0 }, hourRulers: ["Mercury"],
    aspects: "soft", signs: { Gemini: "many small currents", Virgo: "the list" },
    houses: [3, 6], phase: null, voc: "avoid", mercuryRx: "soft", windowType: "admin",
    gloss: "Mercury's hour moves the paperwork; the void loses it." }),
  A({ key: "negotiate", label: "Negotiate / ask for more", category: "craft",
    keywords: ["negotiate", "raise", "salary", "terms", "haggle", "counteroffer"],
    element: "fire", planets: { Sun: 0.9, Jupiter: 0.9, Venus: 0.7 }, hourRulers: ["Sun", "Jupiter", "Venus"],
    aspects: "soft", signs: { Leo: "worth, visibly", Libra: "the deal's balance", Capricorn: "the position" },
    houses: [10, 2, 7], phase: "waxing", voc: "avoid", mercuryRx: "soft", windowType: "social",
    gloss: "Moon applying to Jupiter is the classic signature for asking big." }),
  A({ key: "hard-conversation", label: "The hard conversation", category: "craft",
    keywords: ["confront", "boundary", "difficult talk", "clear the air", "feedback"],
    element: "air", planets: { Mercury: 1.0, Venus: 0.7, Saturn: 0.5 }, hourRulers: ["Mercury", "Venus"],
    aspects: "soft", signs: { Libra: "both sides held", Scorpio: "the honest depth", Gemini: "the words come" },
    houses: [3, 7], phase: null, voc: "avoid", mercuryRx: "favor", windowType: "relationship",
    gloss: "Rx suits clearing OLD air; avoid Moon–Mars hard hours for it." }),
  A({ key: "apply-job", label: "Apply / submit", category: "craft",
    keywords: ["apply", "application", "submit", "proposal", "grant", "cv", "resume"],
    element: "air", planets: { Mercury: 1.0, Sun: 0.8 }, hourRulers: ["Mercury", "Sun"],
    aspects: "soft", signs: { Capricorn: "the role", Leo: "be seen", Virgo: "the flawless document" },
    houses: [10, 6], phase: "waxing", voc: "avoid", mercuryRx: "soft", windowType: "admin",
    gloss: "The document is Mercury's; your visibility is the Sun's." }),

  // ── LOVE & INTIMACY ─────────────────────────────────────────────────────────
  A({ key: "first-date", label: "A date", category: "love",
    keywords: ["date", "date night", "romance", "dinner date", "meet someone"],
    element: "air", planets: { Venus: 1.0, Moon: 0.6 }, hourRulers: ["Venus"],
    aspects: "soft", signs: { Libra: "partnered air", Leo: "warm stage-light", Taurus: "the senses", Pisces: "the glow" },
    houses: [5, 7], phase: "waxing", voc: "avoid", mercuryRx: null, windowType: "relationship",
    gloss: "Moon applying to Venus, evening tide — the oldest election there is." }),
  A({ key: "deepen-bond", label: "Deepen a bond", category: "love",
    keywords: ["quality time", "anniversary", "partner", "connect deeply", "us time", "dinner with", "drinks with", "lunch with", "coffee with", "evening with", "walk with"],
    element: "water", planets: { Venus: 1.0, Moon: 0.8 }, hourRulers: ["Venus", "Moon"],
    aspects: "soft", signs: { Cancer: "the shared shell", Scorpio: "depth", Taurus: "steady warmth" },
    houses: [7, 4], phase: null, voc: "neutral", mercuryRx: null, windowType: "relationship",
    gloss: "The Moon carries the relationship's own weather." }),
  A({ key: "repair-bond", label: "Repair / reconcile", category: "love",
    keywords: ["apologize", "reconcile", "make up", "mend the bond", "forgive"],
    element: "water", planets: { Venus: 1.0, Moon: 0.7, Neptune: 0.5 }, hourRulers: ["Venus", "Moon"],
    aspects: "soft", signs: { Libra: "the balance restored", Cancer: "the soft approach", Pisces: "grace" },
    houses: [7, 4], phase: "waning", voc: "neutral", mercuryRx: "favor", windowType: "relationship",
    gloss: "Rx and the waning moon both favor going back over old ground gently." }),
  // Putting yourself in the market is a LAUNCH wearing Venus's clothes — the
  // profile is a thing you publish and then live with, so it wants a waxing
  // Moon, a clean Venus and Mercury (the words are Mercury's), and none of
  // the void. Filed under love because that is where a person looks for it.
  A({ key: "dating-profile", label: "Start a dating profile", category: "love",
    keywords: ["dating profile", "dating app", "start dating", "put myself out there",
      "online dating", "hinge", "bumble", "tinder", "back on the apps", "photos for my profile"],
    element: "air", planets: { Venus: 1.0, Mercury: 0.8, Sun: 0.6 }, hourRulers: ["Venus", "Mercury"],
    aspects: "soft", signs: { Libra: "the meeting-place", Leo: "warm and seen", Gemini: "the words that land", Taurus: "unforced appeal" },
    houses: [7, 1, 5], phase: "waxing", voc: "avoid", mercuryRx: "hard", windowType: "launch",
    gloss: "A profile is published, not spoken — Venus for the appeal, Mercury for the words, and not under Rx." }),
  A({ key: "ask-someone-out", label: "Ask someone out", category: "love",
    keywords: ["ask out", "make a move", "shoot my shot", "slide into", "first message", "ask her out", "ask him out", "ask them out"],
    element: "fire", planets: { Venus: 1.0, Mars: 0.7, Mercury: 0.6 }, hourRulers: ["Venus", "Mars"],
    aspects: "soft", signs: { Leo: "the nerve", Libra: "the graceful ask", Aries: "first move", Sagittarius: "the open shot" },
    houses: [5, 7], phase: "waxing", voc: "avoid", mercuryRx: "soft", windowType: "relationship",
    gloss: "Venus carries the asking; Mars supplies the nerve to send it." }),
  A({ key: "meet-someone-new", label: "Meet someone new", category: "love",
    keywords: ["meet someone", "singles", "set up", "blind date", "matchmaking", "go out looking"],
    element: "air", planets: { Venus: 1.0, Jupiter: 0.7, Moon: 0.5 }, hourRulers: ["Venus", "Jupiter"],
    aspects: "soft", signs: { Libra: "the introduction", Gemini: "easy talk", Leo: "the room warm", Sagittarius: "the wider net" },
    houses: [5, 11, 7], phase: "waxing", voc: "avoid", mercuryRx: null, windowType: "social",
    gloss: "Jupiter widens the field Venus works in — fifth-house weather with company." }),
  A({ key: "define-relationship", label: "Have the where-is-this-going talk", category: "love",
    keywords: ["dtr", "define the relationship", "exclusive", "where is this going", "the talk", "commit"],
    element: "air", planets: { Venus: 1.0, Mercury: 0.8, Saturn: 0.6 }, hourRulers: ["Venus", "Mercury"],
    aspects: "soft", signs: { Libra: "the honest scales", Capricorn: "what will hold", Taurus: "steady ground" },
    houses: [7], phase: null, voc: "avoid", mercuryRx: "soft", windowType: "relationship",
    gloss: "Saturn is welcome here — it is the conversation that asks a thing to hold shape." }),

  // ── SOCIAL ──────────────────────────────────────────────────────────────────
  A({ key: "host", label: "Host a gathering", category: "social",
    keywords: ["host", "dinner party", "gathering", "have people over", "party", "see my people", "see friends", "friends over", "catch up with friends"],
    element: "fire", planets: { Jupiter: 1.0, Venus: 0.9, Sun: 0.7 }, hourRulers: ["Jupiter", "Venus", "Sun"],
    aspects: "soft", signs: { Leo: "the generous table", Libra: "the room in harmony", Sagittarius: "the feast" },
    houses: [5, 11], phase: "waxing", voc: "neutral", mercuryRx: null, windowType: "social",
    gloss: "Jupiter hosts; Venus arranges the room; the Sun warms it." }),
  A({ key: "network", label: "Meet new people / network", category: "social",
    keywords: ["network", "meetup", "mixer", "conference", "introduce", "community event"],
    element: "air", planets: { Mercury: 0.9, Venus: 0.8, Jupiter: 0.7 }, hourRulers: ["Mercury", "Venus", "Jupiter"],
    aspects: "soft", signs: { Gemini: "the exchange", Aquarius: "the network", Libra: "the introduction" },
    houses: [11, 3], phase: "waxing", voc: "avoid", mercuryRx: "soft", windowType: "social",
    gloss: "Eleventh-house weather: friends you haven't met." }),
  A({ key: "call-family", label: "Family time / call home", category: "social",
    keywords: ["family", "call mom", "call home", "parents", "siblings", "kids time"],
    element: "water", planets: { Moon: 1.0, Venus: 0.5 }, hourRulers: ["Moon", "Venus"],
    aspects: "soft", signs: { Cancer: "the hearth", Taurus: "the meal", Pisces: "the old tie" },
    houses: [4, 3], phase: null, voc: "neutral", mercuryRx: null, windowType: "relationship",
    gloss: "The Moon's own matter — home is wherever it's tended." }),

  // ── HOME ────────────────────────────────────────────────────────────────────
  A({ key: "cook", label: "Cook & provision", category: "home",
    keywords: ["cook", "meal prep", "bake", "groceries", "provision", "kitchen"],
    element: "water", planets: { Moon: 1.0, Venus: 0.7 }, hourRulers: ["Moon", "Venus"],
    aspects: "soft", signs: { Cancer: "the kitchen's house", Taurus: "abundance", Virgo: "the prep" },
    houses: [4, 6], phase: null, voc: "favor", mercuryRx: null, windowType: "recovery",
    gloss: "Nourishment is lunar work — a void afternoon cooks beautifully." }),
  A({ key: "beautify", label: "Beautify the space", category: "home",
    keywords: ["decorate", "beautify", "rearrange", "plants", "art up", "make it nice"],
    element: "earth", planets: { Venus: 1.0 }, hourRulers: ["Venus"],
    aspects: "soft", signs: { Taurus: "Venus at home", Libra: "the eye", Leo: "the flourish" },
    houses: [4], phase: "waxing", voc: "neutral", mercuryRx: null, windowType: "creative",
    gloss: "Venus's hour makes the same room land differently." }),
  A({ key: "garden", label: "Garden / plant", category: "home",
    keywords: ["garden", "plant", "seeds", "repot", "prune", "weed"],
    element: "earth", planets: { Moon: 1.0, Venus: 0.7, Saturn: 0.5 }, hourRulers: ["Moon", "Venus"],
    aspects: "soft", signs: { Taurus: "the fertile field", Cancer: "the watered bed", Capricorn: "the pruning" },
    houses: [4, 6], phase: "waxing", voc: "neutral", mercuryRx: null, windowType: "recovery",
    gloss: "Oldest election of all: sow waxing, weed and prune waning." }),
  A({ key: "deep-clean", label: "Deep clean", category: "home",
    keywords: ["deep clean", "scrub", "purge", "closet", "garage", "spring clean"],
    element: "earth", planets: { Saturn: 0.9, Mars: 0.7 }, hourRulers: ["Saturn", "Mars"],
    aspects: "effort", signs: { Virgo: "the standard", Scorpio: "the purge", Aries: "the blitz" },
    houses: [4, 6], phase: "waning", voc: "favor", mercuryRx: null, windowType: "admin",
    gloss: "Removal work — the waning moon and even the void carry it." }),

  // ── MONEY ───────────────────────────────────────────────────────────────────
  A({ key: "budget", label: "Budget & ledger", category: "money",
    keywords: ["budget", "ledger", "finances", "taxes", "bookkeeping", "expense"],
    element: "earth", planets: { Saturn: 1.0, Mercury: 0.8 }, hourRulers: ["Saturn", "Mercury"],
    aspects: "soft", signs: { Capricorn: "the accounting", Virgo: "the reconciliation", Taurus: "what you have" },
    houses: [2], phase: "waning", voc: "neutral", mercuryRx: "favor", windowType: "admin",
    gloss: "Review money under Rx happily; just don't commit it." }),
  A({ key: "big-purchase", label: "A considered purchase", category: "money",
    keywords: ["buy", "purchase", "order", "upgrade", "new laptop", "furniture"],
    element: "earth", planets: { Venus: 1.0, Jupiter: 0.6 }, hourRulers: ["Venus", "Jupiter"],
    aspects: "soft", signs: { Taurus: "value that lasts", Libra: "the right choice", Capricorn: "the durable" },
    houses: [2], phase: "waxing", voc: "avoid", mercuryRx: "soft", windowType: "admin",
    gloss: "Venus governs worth; the void famously mis-buys." }),
  A({ key: "settle-debts", label: "Settle / restructure debts", category: "money",
    keywords: ["debt", "pay off", "refinance", "settle", "owed"],
    element: "water", planets: { Saturn: 1.0, Pluto: 0.6 }, hourRulers: ["Saturn"],
    aspects: "soft", signs: { Scorpio: "shared ledgers", Capricorn: "the obligation kept" },
    houses: [8, 2], phase: "waning", voc: "neutral", mercuryRx: "soft", windowType: "admin",
    gloss: "Eighth-house work: what's entangled gets patiently unwound." }),

  // ── SPIRIT ──────────────────────────────────────────────────────────────────
  A({ key: "meditate", label: "Meditate / pray", category: "spirit",
    keywords: ["meditate", "pray", "breathwork", "sit", "silence", "contemplate"],
    element: "water", planets: { Neptune: 1.0, Moon: 0.7 }, hourRulers: ["Moon", "Saturn"],
    aspects: "soft", signs: { Pisces: "the open sea", Cancer: "the inner shore", Aquarius: "the witness" },
    houses: [12, 9], phase: null, voc: "favor", mercuryRx: null, windowType: "retreat",
    gloss: "The void's slack water is the tradition's gift to this.", glossNeeds: "void-moon" }),
  A({ key: "journal", label: "Journal from feeling", category: "spirit",
    keywords: ["journal", "diary", "morning pages", "process", "write feelings"],
    element: "water", planets: { Moon: 1.0, Mercury: 0.7 }, hourRulers: ["Moon", "Mercury"],
    aspects: "soft", signs: { Cancer: "memory's house", Pisces: "the underside", Scorpio: "the true entry" },
    houses: [4, 12], phase: null, voc: "favor", mercuryRx: "favor", windowType: "retreat",
    gloss: "Moon writes, Mercury holds the pen." }),
  A({ key: "divination", label: "Reflection / divination", category: "spirit",
    keywords: ["tarot", "reading", "divination", "chart", "astrology study", "runes"],
    element: "water", planets: { Neptune: 0.9, Mercury: 0.8, Moon: 0.7 }, hourRulers: ["Moon", "Mercury", "Saturn"],
    aspects: "soft", signs: { Scorpio: "the veil thin", Pisces: "the image-stream", Aquarius: "the pattern read" },
    houses: [12, 8, 9], phase: "new", voc: "favor", mercuryRx: "favor", windowType: "retreat",
    gloss: "Dark-moon days read deepest; the balsamic hush is the classic window." }),
  A({ key: "set-intention", label: "Set an intention / begin a cycle", category: "spirit",
    keywords: ["intention", "new moon ritual", "vision board", "commit to", "resolve"],
    element: "fire", planets: { Sun: 1.0, Moon: 1.0 }, hourRulers: ["Sun", "Moon"],
    aspects: "soft", signs: { Aries: "the first spark", Cancer: "rooted in feeling", Capricorn: "vow-grade" },
    houses: [1], phase: "new", voc: "avoid", mercuryRx: "soft", windowType: "planning",
    gloss: "Seed at the New Moon; the whole app's cycle rhythm begins here." }),
  A({ key: "release", label: "Grieve & release", category: "spirit",
    keywords: ["release", "let go", "grieve", "closure", "burn the list", "end it"],
    element: "water", planets: { Pluto: 0.8, Moon: 0.8, Neptune: 0.6 }, hourRulers: ["Moon", "Saturn"],
    aspects: "soft", signs: { Scorpio: "the descent", Pisces: "dissolution", Virgo: "the sorting-through" },
    houses: [12, 8], phase: "waning", voc: "favor", mercuryRx: null, windowType: "retreat",
    gloss: "Waning to balsamic — release work rides the emptying tide." }),
  A({ key: "retreat", label: "Solitude / retreat", category: "spirit",
    keywords: ["retreat", "solitude", "alone time", "unplug", "off grid", "silence day"],
    element: "water", planets: { Saturn: 0.9, Neptune: 0.9 }, hourRulers: ["Saturn", "Moon"],
    aspects: "soft", signs: { Capricorn: "the hermitage", Pisces: "the dissolve", Virgo: "the quiet order" },
    houses: [12], phase: "waning", voc: "favor", mercuryRx: "favor", windowType: "retreat",
    gloss: "Saturn's monastic gift — containment as kindness." }),

  // ── LAUNCHES & STAKES (the electional KB's high-scrutiny tier) ──────────────
  A({ key: "publish", label: "Publish / release", category: "launch",
    keywords: ["publish", "release", "post it", "go live", "announce", "drop"],
    element: "fire", planets: { Mercury: 0.9, Jupiter: 0.9, Sun: 0.8 }, hourRulers: ["Sun", "Jupiter", "Mercury"],
    aspects: "soft", signs: { Leo: "seen", Sagittarius: "carried far", Gemini: "the word out" },
    houses: [9, 3, 10], phase: "waxing", voc: "avoid", mercuryRx: "hard", windowType: "launch",
    gloss: "The release is what Rx disrupts — draft under it, ship after it." }),
  A({ key: "launch-venture", label: "Launch a venture / product", category: "launch",
    keywords: ["launch", "open doors", "start business", "ship product", "storefront"],
    element: "fire", planets: { Sun: 1.0, Jupiter: 0.8, Saturn: 0.6 }, hourRulers: ["Sun", "Jupiter"],
    aspects: "soft", signs: { Leo: "the identity lit", Capricorn: "built to hold", Aries: "first out" },
    houses: [10, 1], phase: "waxing", voc: "avoid", mercuryRx: "soft", windowType: "launch",
    gloss: "Wants the part of the chart that governs public standing to be strong and unafflicted." }),
  A({ key: "sign-contract", label: "Sign a contract", category: "launch",
    keywords: ["sign", "contract", "agreement", "lease", "close the deal", "paperwork day"],
    element: "air", planets: { Mercury: 1.0, Saturn: 0.7 }, hourRulers: ["Mercury", "Jupiter"],
    aspects: "soft", signs: { Libra: "the accord", Capricorn: "the binding", Taurus: "what endures" },
    houses: [7, 3], phase: "waxing", voc: "avoid", mercuryRx: "hard", windowType: "launch",
    gloss: "Two firm rules here: not while Mercury is retrograde, and never while the Moon is void." }),
  A({ key: "move-home", label: "Move / sign for a home", category: "launch",
    keywords: ["move", "new apartment", "house", "relocate", "move in"],
    element: "water", planets: { Moon: 1.0, Saturn: 0.7, Venus: 0.5 }, hourRulers: ["Moon", "Venus"],
    aspects: "soft", signs: { Cancer: "the Moon's own house", Taurus: "settled ground", Capricorn: "the foundation" },
    houses: [4], phase: "waxing", voc: "avoid", mercuryRx: "soft", windowType: "launch",
    gloss: "Fourth-house election — the Moon strong and building." }),
  A({ key: "begin-partnership", label: "Begin a partnership", category: "launch",
    keywords: ["partnership", "cofounder", "commit", "move in together", "engagement"],
    element: "air", planets: { Venus: 1.0, Moon: 0.8, Saturn: 0.6 }, hourRulers: ["Venus", "Jupiter"],
    aspects: "soft", signs: { Libra: "the scales' own matter", Taurus: "lasting Venus", Cancer: "the shared shell" },
    houses: [7], phase: "waxing", voc: "avoid", mercuryRx: "soft", windowType: "launch",
    gloss: "The tradition's most scrutinized election — Venus clean, Moon applying soft." }),
];

// ── Sortage: match free text (a star, a step, a task) to an activity ─────────
// Deliberately transparent: keyword containment scored by specificity, with
// label words counting too. Returns null below a confidence floor — the AI
// layer can take over from there, grounded by this table's vocabulary.
/**
 * Ranked activity candidates, best first.
 *
 * `matchActivity` returns only the winner, which is fine for a probe and wrong
 * for anything that has to admit doubt: "Prepare keynote" could be drafting,
 * designing slides, rehearsing, or presenting, and a caller that sees one
 * answer cannot tell that from a clean match. Home needs the MARGIN to decide
 * whether to time a task or ask about it.
 */
/** Look up an activity by its key. Null when the key is stale or unknown. */
export function activityByKey(key: string): ActivityCorrespondence | null {
  return ACTIVITIES.find(a => a.key === key) ?? null;
}

/**
 * Whole-word containment.
 *
 * Plain `includes` matched "plan" inside "plants", so "Water the plants" scored
 * 2.00 for "Plan & strategize" — over the confidence bar, and wrong. Substring
 * matching on short common words produces exactly the confident-and-absurd
 * classifications this scorer is supposed to avoid.
 */
function hasWord(haystack: string, word: string): boolean {
  // A trailing plural is allowed, because requiring an exact boundary lost
  // "Water the plants" → "Garden / plant". It does NOT reopen the substring
  // hole: /\bplan(s|es)?\b/ still fails against "plants", since "t" follows
  // "plan" and is neither a plural suffix nor a boundary.
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}(s|es)?\\b`).test(haystack);
}

export function rankActivities(text: string, limit = 3): { activity: ActivityCorrespondence; score: number }[] {
  const t = ` ${text.toLowerCase()} `;
  const scored: { activity: ActivityCorrespondence; score: number }[] = [];
  for (const a of ACTIVITIES) {
    let score = 0;
    for (const k of a.keywords) {
      if (t.includes(k.toLowerCase())) score += Math.min(3, 1 + k.length / 8);
    }
    // Naming the activity should be enough to match it.
    //
    // Two of forty-six activities could not match their OWN LABEL at the
    // confidence bar callers use — "The hard conversation" and "Deepen a bond"
    // both scored 1.00, because their keyword lists happen not to contain any
    // word from their own names. They could therefore never be classified
    // automatically, by any caller, for any phrasing.
    //
    // The per-word bonus alone cannot fix that: it is deliberately small so one
    // incidental word does not carry a match. What is reliable is a whole NAME
    // being present.
    //
    // A slash in these labels separates synonyms rather than making one long
    // name — "Long run / endurance", "Yoga / stretch / walk", "Garden / plant".
    // Requiring every word of the joined string meant "Long run" could not
    // match "Long run / endurance", because "endurance" was missing. Each side
    // is its own name.
    const names = a.label.toLowerCase().split("/")
      .map(part => part.split(/[^a-z]+/).filter(w => w.length >= 4))
      .filter(ws => ws.length > 0);
    const allWords = new Set(names.flat());
    for (const w of allWords) if (hasWord(t, w)) score += 0.5;
    if (names.some(ws => ws.every(w => hasWord(t, w)))) score += 1.5;
    if (score > 0) scored.push({ activity: a, score });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, limit);
}

export function matchActivity(text: string): { activity: ActivityCorrespondence; score: number } | null {
  const t = ` ${text.toLowerCase()} `;
  let best: { activity: ActivityCorrespondence; score: number } | null = null;
  for (const a of ACTIVITIES) {
    let score = 0;
    for (const k of a.keywords) {
      // WORD-BOUNDARY, not substring — the same `hasWord` rankActivities
      // already uses, and the reason this matters is not hypothetical: with
      // raw `.includes()`, the keyword "forms" (already on admin-errands)
      // matches inside "informs", "performs", "platforms", "transforms" —
      // any task mentioning any of those was silently pulled toward admin
      // work. Widening admin-errands' keywords to cover real shorthand
      // ("dr", "book", "bill") would have made the substring hole worse
      // rather than better — "dr" alone matches "address", "hydrate",
      // "bedroom" — so the matcher is the thing that had to change, not just
      // the keyword list riding on top of it.
      if (hasWord(t, k.toLowerCase())) score += Math.min(3, 1 + k.length / 8);
    }
    for (const w of a.label.toLowerCase().split(/[^a-z]+/)) {
      if (w.length >= 4 && hasWord(t, w)) score += 0.5;
    }
    if (score > 0 && (!best || score > best.score)) best = { activity: a, score };
  }
  return best && best.score >= 1 ? best : null;
}
