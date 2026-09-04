/**
 * THE SIGN LEXICON — one record per sign, one source for every surface.
 *
 * Before this (AUDIT-EXPLAINERS-2026-08-21 §2a) Leo was described in four
 * voices across three files and two authorities: mythos (client), inflection
 * (client), SIGN_GUIDE (server), SIGN_FAVORS (server). They agreed by luck.
 * Now the client's SIGN_MYTHOS and SIGN_INFLECTION and the server's
 * SIGN_GUIDE and the share card's favors are all built from this file.
 *
 * Fields, by register:
 *   approach   HOW work wants doing under the sign — the base line the rail
 *              composes with the moment's qualifiers (quality register, one
 *              clause with a hinge, no full stop; the composer adds it).
 *   image      the sign's picture in one line ("The heart on stage…") —
 *              kept for the dossier, the reference and the share card.
 *   inflection the manner as adjectives, for "Moon in Leo: warm, expressive…"
 *   favors     examples, never the sentence; surfaces show ONE
 *   watch      the tendency to watch for
 *   tideFeel   the tide instrument's own water image — tide vocabulary, and
 *              so never shown outside the tide (WORLDBOOK §2)
 *
 * Plain TypeScript with no imports, so both artifacts can import it by path.
 * Copy here has been through the no-ai-slop pass (2026-08-21).
 */
export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "cardinal" | "fixed" | "mutable";

export interface SignEntry {
  key: string;
  element: Element;
  modality: Modality;
  glyph: string;
  approach: string;
  image: string;
  inflection: string;
  favors: string[];
  watch: string;
  tideFeel: string;
}

export const SIGNS: Record<string, SignEntry> = {
  Aries: {
    key: "Aries", element: "fire", modality: "cardinal", glyph: "♈︎",
    approach: "the first move carries the day; what isn't started fast tends not to start",
    image: "The spark that acts before it thinks — pure beginning.",
    inflection: "fast, direct, and impatient — acting first and refining later",
    favors: ["start the thing you've been circling", "hard training", "the direct ask", "quick decisive errands", "healthy competition", "first drafts, not final ones"],
    watch: "Starts what nothing finishes; picks fights out of boredom.",
    tideFeel: "Fast chop with a strong pull — bright, impatient water that wants to move.",
  },
  Taurus: {
    key: "Taurus", element: "earth", modality: "fixed", glyph: "♉︎",
    approach: "slow and the same way each time, and the pace does the work",
    image: "The slow field — worth that accrues by staying.",
    inflection: "slow, steady, and sensory — wanting things tangible and lasting",
    favors: ["finish and polish", "cook well & provision", "tend money slowly", "garden, body, pleasure", "one long steady work block", "touch actual ground"],
    watch: "Comfort hardens into rut; stubborn past the point of sense.",
    tideFeel: "Warm shallows over sand — slow, heavy, pleasant water that holds its temperature.",
  },
  Gemini: {
    key: "Gemini", element: "air", modality: "mutable", glyph: "♊︎",
    approach: "run two things at once, and circle back to each before either goes cold",
    image: "The messenger's crossroads — everything wants to be said twice.",
    inflection: "quick, curious, and double-tracked — moving through words and options",
    favors: ["write & edit", "calls, errands, emails", "learn something quick", "pair work & good banter", "gather information widely", "short trips"],
    watch: "Scattered; talks about the thing instead of doing it.",
    tideFeel: "Ruffled, sparkling water under a shifting wind — never the same surface twice.",
  },
  Cancer: {
    key: "Cancer", element: "water", modality: "cardinal", glyph: "♋︎",
    approach: "work goes by feel and by who's near; a half-closed door helps",
    image: "The tide's own house — memory, shelter, the inner shore.",
    inflection: "protective, tidal, and memory-driven — moving by feel, holding close what it loves",
    favors: ["tend home & kitchen", "family and chosen family", "journal from feeling", "rest that actually restores", "care for someone directly", "be in or near water"],
    watch: "Moods steer the ship; retreats into the shell mid-conversation.",
    tideFeel: "The home tide — familiar water rising up a known shore.",
  },
  Leo: {
    key: "Leo", element: "fire", modality: "fixed", glyph: "♌︎",
    approach: "work done where it can be seen gets done; the audience is fuel until it becomes the point",
    image: "The heart on stage — warmth that wants witnesses.",
    inflection: "warm, expressive, and proud — wanting to be seen and to mean it",
    favors: ["perform, present, publish", "creative play without a goal", "host generously", "romance & delight", "praise someone properly", "wear the good thing"],
    watch: "Needs applause to move; pride blocks the apology.",
    tideFeel: "Sunlit surf — bright, generous, theatrical water that lifts what it touches.",
  },
  Virgo: {
    key: "Virgo", element: "earth", modality: "mutable", glyph: "♍︎",
    approach: "small, checkable and in order; a thing is done once it has been checked",
    image: "The craftsman's eye — love expressed as precision.",
    inflection: "precise, useful, and self-correcting — perfecting through detail",
    favors: ["edit & refine", "organize the system", "health routines & checkups", "clean the workshop", "detailed analysis", "repair small broken things"],
    watch: "Polishes forever, ships never; the criticism leaks outward.",
    tideFeel: "Clear, exacting water where every detail on the bottom shows.",
  },
  Libra: {
    key: "Libra", element: "air", modality: "cardinal", glyph: "♎︎",
    approach: "decisions want a second voice, and the weighing is most of the work",
    image: "The balance point — truth found between two people.",
    inflection: "relational, weighing, and diplomatic — leaning toward balance and the other person",
    favors: ["negotiate & mediate", "partner on the work", "aesthetic decisions", "host, match, introduce", "agreements & contracts", "beautify a shared room"],
    watch: "Decides by not deciding; keeps the peace at truth's expense.",
    tideFeel: "Mirror-still water that shows you the other side.",
  },
  Scorpio: {
    key: "Scorpio", element: "water", modality: "fixed", glyph: "♏︎",
    approach: "one thing at a time, taken all the way down, with the door shut",
    image: "The deep dive — nothing survives the descent unchanged.",
    inflection: "intense, private, and all-or-nothing — going straight to the root",
    favors: ["deep, sealed-off focus", "research & investigation", "the honest hard conversation", "end what needs ending", "intimacy over small talk", "shadow work"],
    watch: "Control disguised as depth; grudges compound interest.",
    tideFeel: "Black still water of unknown depth; the surface tells you nothing.",
  },
  Sagittarius: {
    key: "Sagittarius", element: "fire", modality: "mutable", glyph: "♐︎",
    approach: "the far aim pulls the near work along; tie today's piece to the larger story",
    image: "The arrow over the horizon — meaning found in motion.",
    inflection: "expansive, blunt, and meaning-hungry — aiming at the far horizon",
    favors: ["plan the trip", "study the big idea", "teach — and preach a little", "go far on foot", "publish the thesis", "bet on the larger story"],
    watch: "Promises past capacity; truth delivered without aim.",
    tideFeel: "Open ocean under full sail — the far shore matters more than this one.",
  },
  Capricorn: {
    key: "Capricorn", element: "earth", modality: "cardinal", glyph: "♑︎",
    approach: "the work is a long climb taken one measured step at a time, with the record kept",
    image: "The mountain path — ambition with patience for stone.",
    inflection: "structured, patient, and ambitious — building for the long term",
    favors: ["the unglamorous right thing", "long-term structure", "the career move", "duty kept quietly", "prune what wastes time", "build what outlasts you"],
    watch: "Mistakes grimness for seriousness; the work eats the feast.",
    tideFeel: "Cold, disciplined water running exactly in its channel.",
  },
  Aquarius: {
    key: "Aquarius", element: "air", modality: "fixed", glyph: "♒︎",
    approach: "the shape of the system comes before the single case; stepping back is where the fix is",
    image: "The far signal — the pattern only distance reveals.",
    inflection: "systemic, cool, and contrary — thinking in patterns and exceptions",
    favors: ["systems thinking", "the unconventional approach", "community & collective work", "plan for the future self", "tools & technology", "break one useless convention"],
    watch: "Principles over people; detached past reach.",
    tideFeel: "High, thin air over the water — everything visible, nothing close.",
  },
  Pisces: {
    key: "Pisces", element: "water", modality: "mutable", glyph: "♓︎",
    approach: "the work arrives when the edges soften; set the conditions and wait for it",
    image: "The open sea — boundaries dissolve, everything connects.",
    inflection: "porous, imaginative, and dissolving — feeling everything, blurring edges",
    favors: ["make art from feeling", "meditate, pray, drift", "music & poetry", "compassion without a ledger", "sleep and dream generously", "let the plan blur productively"],
    watch: "Escapes instead of rests; boundaries dissolve that shouldn't.",
    tideFeel: "Warm fog on slack water; edges soften, time gets generous and strange.",
  },
};

export const SIGN_ORDER = Object.keys(SIGNS);
