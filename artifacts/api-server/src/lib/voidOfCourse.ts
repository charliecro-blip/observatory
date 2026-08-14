/**
 * What a void-of-course Moon is like IN THE SIGN IT IS VOID IN.
 *
 * The Moon is void when she will make no further Ptolemaic aspect before
 * leaving her sign. The app already knew that and said one sentence about it —
 * "slack water; begin nothing you want to last" — regardless of whether she was
 * void in Taurus or in Capricorn. Those are not the same afternoon.
 *
 * LILLY'S EXCEPTION IS INHERITED DOCTRINE, NOT OUR OPINION.
 * ---------------------------------------------------------------------------
 * Christian Astrology holds that the Moon void of course is not so malevolent
 * in Taurus, Cancer, Sagittarius or Pisces. That is a real, citable exemption
 * from a named source, and it is the reason `benign` exists as a flag rather
 * than as a tone we chose: it changes what the app should DO — a void stretch
 * in Taurus is worth using, not merely surviving.
 *
 * Note the two independent reasons a sign lands on that list: Taurus is the
 * Moon's exaltation and Cancer her domicile, so she is strong there and the
 * emptiness costs less. Sagittarius and Pisces are Jupiter's, and the
 * tradition's reasoning is his benignity rather than her strength. We do not
 * restate that reasoning as though we had derived it.
 *
 * THE SENTENCES ARE COMPASS SYNTHESIS.
 * ---------------------------------------------------------------------------
 * No source says a void Moon in Gemini is "plenty of talk and no traction".
 * That is this app reading the sign's nature against the void's meaning, and it
 * must never be presented as Lilly. `benign` may be; the prose may not.
 *
 * SHAPE: `feel` (what the stretch is like) and `instead` (what it is actually
 * good for). Every void has an `instead` — the counsel is finish-don't-begin,
 * never do-nothing, and a card that only forbids is a card people learn to
 * scroll past.
 */

/**
 * What a void does and does not govern.
 *
 * Home puts this banner directly above computed timing for the person's own
 * work, so a bare "begin nothing" reads as a veto over everything below it — a
 * user would see "several factors converge for revising the proposal at 2pm"
 * under a line telling them to start nothing. Those are compatible in doctrine
 * (revision is execution; the void is thin for INCEPTIONS meant to establish
 * themselves) but the compatibility has to be legible in the content itself
 * rather than explained by a caption, which would be the disclaimer smell.
 *
 * So the banner states its own scope, and the results below need no defending.
 */
export const VOID_SCOPE =
  "Good for finishing, refining, and work already underway; thin for beginnings meant to last.";

/**
 * Lilly, Christian Astrology: the Moon void of course is not so malevolent in
 * these four. Inherited doctrine — do not add signs to this list on taste.
 */
export const LILLY_EXEMPT = new Set(["Taurus", "Cancer", "Sagittarius", "Pisces"]);

export interface VoidReading {
  /** What this particular void stretch is like. */
  feel: string;
  /** What it is good for. Never empty. */
  instead: string;
  /** True for Lilly's four. Changes the counsel from "wait it out" to "use it". */
  benign: boolean;
}

const BY_SIGN: Record<string, { feel: string; instead: string }> = {
  Aries: {
    feel: "The urge to start, with nothing that will take hold. The itch is real; the launch isn't.",
    instead: "Burn it physically — train, walk fast, clear something out. Start nothing you'd have to defend tomorrow.",
  },
  Taurus: {
    feel: "The Moon is exalted here, and this is one of the four Lilly exempts. Nothing is moving, and in Taurus that reads as rest rather than drift.",
    instead: "Eat properly, sit somewhere comfortable, do the slow familiar thing. This is a void you can enjoy.",
  },
  Gemini: {
    feel: "Plenty of talk and no traction. Conversations circle and land nowhere in particular.",
    instead: "Answer the easy messages, take notes, tidy the inbox. Save the conversation that matters.",
  },
  Cancer: {
    feel: "Her own sign, and another Lilly exempts. Empty, but you're in your own house — the quiet is comfortable rather than stalled.",
    instead: "Domestic things. Cook, tend, be with the people you don't have to perform for.",
  },
  Leo: {
    feel: "The urge to be seen, and no one is watching. Gestures don't land the way they should.",
    instead: "Make the thing instead of announcing it. Keep the launch and the ask for a Moon still making contacts.",
  },
  Virgo: {
    // "Real work with nothing riding on it" barred more than the doctrine
    // does — it reads as "do only trivia today", when a void is thin for
    // BEGINNINGS and neutral-to-good for everything already underway
    // (VOID_SCOPE, right below). The owner planning a full day's work read
    // this as a veto over the lot (2026-08-13).
    // Flagged twice. The first pass fixed the `instead` line and left this
    // one, which was the half that actually stung: it opens by telling you
    // your attention is useless, in the two-short-sentence cadence the copy
    // rules name as the tell. A void in Virgo is a real thing to describe —
    // the pull toward tidying something that is already fine — without
    // opening on a verdict about the reader.
    feel: "The urge to tidy something that's already fine — Virgo's eye for detail with no new problem to solve.",
    instead: "Good hours for the work already in front of you — editing, admin, the careful pass over something that exists. Save the launch, not the effort.",
  },
  Libra: {
    feel: "Weighing, and nothing settles the scale. Agreements made now tend not to hold.",
    instead: "Be sociable and don't sign. Repair something rather than negotiate something.",
  },
  Scorpio: {
    feel: "The Moon is in fall here and making no further contact, so feeling turns inward and finds nothing to resolve against.",
    instead: "Research rather than confrontation. Whatever surfaces, look at it — don't act on it today.",
  },
  Sagittarius: {
    feel: "Jupiter's sign, and one Lilly exempts. Aimless, but pleasantly so.",
    instead: "Wander. Read something wide, go somewhere, plan loosely. Don't book it yet.",
  },
  Capricorn: {
    feel: "Effort with no purchase. She's in detriment here and void on top of it, so work costs more than it returns.",
    instead: "Do the maintenance already on the list. Don't start the ambitious thing — it won't take.",
  },
  Aquarius: {
    feel: "Detached, and further out than usual. Ideas with nobody to bring them to.",
    instead: "Solitary, abstract work. Think, sketch, read. Rejoin people when she does.",
  },
  Pisces: {
    feel: "The last of Lilly's four, and the one it suits best — dissolving is what this sign does anyway.",
    instead: "Rest, music, making things that need no outcome. Sleep counts.",
  },
};

export function voidReading(sign: string): VoidReading | null {
  const e = BY_SIGN[sign];
  if (!e) return null;
  return { ...e, benign: LILLY_EXEMPT.has(sign) };
}
