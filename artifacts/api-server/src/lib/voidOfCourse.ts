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
 * SHAPE: `feel` (what the stretch is like), `instead` (what it is actually good
 * for), and `provenance` (the tradition's reason this sign differs, where there
 * is one). Every void has an `instead` — the counsel is finish-don't-begin,
 * never do-nothing, and a card that only forbids is a card people learn to
 * scroll past.
 *
 * THE FRAME QUESTION, ANSWERED (2026-08-14).
 * ---------------------------------------------------------------------------
 * ASTROLYRICA-COPY-HANDOFF.md asked whether `feel` should name a lack at all,
 * given that VOID_SCOPE below already carries the limiting. The Virgo entry had
 * been rewritten three times, which suggested the wording was not the problem.
 *
 * The axis turned out to be wrong. It is not positive against negative — it is
 * SPECIFIC against ATMOSPHERIC. Libra was singled out as the most useful entry,
 * and the reason is not that it cautions: it is that "agreements made now tend
 * not to hold" names one particular act that particularly fails, which a person
 * can act on. Aquarius's old "ideas with nobody to bring them to" is just as
 * negative and much less useful, because nothing follows from it. Virgo failed
 * for the same reason in the other direction: it described a mood, not an act.
 *
 * So the table is deliberately NOT uniform. Where a sign gives us a specific
 * thing that will not take, `feel` names it. Where it does not, `feel` says
 * what the attention is good for and lets VOID_SCOPE do the limiting. The
 * twelve are allowed to differ because the signs differ.
 *
 * WHY `provenance` EXISTS.
 * ---------------------------------------------------------------------------
 * Four entries used to OPEN with list membership — "this is one of the four
 * Lilly exempts", "the last of Lilly's four". That is bookkeeping, not a
 * feeling, and it was the first thing the reader met in exactly the four signs
 * where the news is good. Worse, it gives the reader the list rather than the
 * reason: a sign is exempt because the Moon is exalted there, or because the
 * sign is Jupiter's, and that is the part worth knowing.
 *
 * The citation moved into its own field, properly attributed, alongside the
 * dignity facts (Scorpio's fall, Capricorn's detriment) that were doing the
 * same job in the same sentence. `feel` gets its lead back, the technical
 * vocabulary leaves the layer-1 line, and the claim keeps its source.
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
  /**
   * The tradition's reason this sign is not like the others, where there is
   * one — a dignity, or Lilly's exemption. Absent for the six signs that have
   * no such claim on them, because inventing symmetry here would mean
   * manufacturing doctrine to fill a field.
   */
  provenance?: string;
  /** True for Lilly's four. Changes the counsel from "wait it out" to "use it". */
  benign: boolean;
}

const BY_SIGN: Record<string, { feel: string; instead: string; provenance?: string }> = {
  Aries: {
    feel: "The appetite to start is sharp, and nothing started will take hold.",
    instead: "Spend it physically: train, walk fast, clear something out of the way.",
  },
  Taurus: {
    feel: "Nothing is moving, and in Taurus that is rest rather than drift.",
    instead: "Eat properly, sit somewhere comfortable, do the slow familiar thing.",
    provenance: "Lilly holds the void Moon less malevolent here, where she is exalted.",
  },
  Gemini: {
    feel: "Conversations circle without landing, however many of them you have.",
    instead: "Answer the easy messages, take notes, clear the inbox; save the conversation that has to reach a decision.",
  },
  Cancer: {
    feel: "Empty, but she is in her own house, so the quiet is comfortable.",
    instead: "Cook, tend, be with the people you don't have to perform for.",
    provenance: "Lilly holds the void Moon less malevolent here, her own sign.",
  },
  Leo: {
    feel: "The wish to be seen meets a room that isn't watching, and gestures go unanswered.",
    instead: "Make the thing; the announcement will carry further on another day.",
  },
  Virgo: {
    // "Real work with nothing riding on it" barred more than the doctrine
    // does — it reads as "do only trivia today", when a void is thin for
    // BEGINNINGS and neutral-to-good for everything already underway
    // (VOID_SCOPE, right below). The owner planning a full day's work read
    // this as a veto over the lot (2026-08-13).
    // Flagged three times, and the first two passes both missed the actual
    // problem. They rewrote the phrasing while keeping the FRAME, which was
    // a deficit one: "already fine", "no new problem to solve", "save the
    // launch" all tell the reader their attention is surplus to requirements.
    // A void in Virgo is not a shortage of anything. Discernment is running
    // high and lands best on what already exists, which is a description of
    // something available rather than something missing (owner 2026-08-14:
    // "it should be framed positively").
    //
    // The void still means beginnings do not take root — VOID_SCOPE below
    // carries that, and it does not need saying twice in the reader's face.
    feel: "Virgo's precision is running high, and it settles most naturally on work that already exists.",
    instead: "A strong stretch for editing, admin, and the careful second pass — the kind of work that gets better the more attention it gets.",
  },
  Libra: {
    // The entry the copy handoff singled out as the most useful of the twelve,
    // and the model for the rest: it names one act that specifically fails.
    feel: "Nothing settles the scale, and agreements made now tend not to hold.",
    instead: "Be sociable and don't sign; repair something rather than negotiate something.",
  },
  Scorpio: {
    feel: "Feeling turns inward and finds nothing to resolve itself against.",
    instead: "Research rather than confrontation; whatever surfaces, look at it and leave acting on it for later.",
    provenance: "The Moon is in fall in Scorpio, her least resourced placement in the tradition.",
  },
  Sagittarius: {
    feel: "The aimlessness here is the pleasant kind.",
    instead: "Wander: read something wide, go somewhere, plan loosely without booking it.",
    provenance: "Lilly holds the void Moon less malevolent here, in Jupiter's sign.",
  },
  Capricorn: {
    feel: "Effort finds no purchase, so work costs more than it returns.",
    instead: "Do the maintenance already on the list; it needs no traction to be worth doing.",
    provenance: "The Moon is in detriment in Capricorn, and void on top of it.",
  },
  Aquarius: {
    feel: "Detachment goes further out than usual, and ideas find nobody to bring them to.",
    instead: "Solitary, abstract work: think, sketch, read, and rejoin people when she does.",
  },
  Pisces: {
    feel: "Dissolving is what this sign does anyway, so the emptiness suits it better than any other.",
    instead: "Rest, music, making things that need no outcome; sleep counts.",
    provenance: "Lilly holds the void Moon less malevolent here, Jupiter's other sign.",
  },
};

export function voidReading(sign: string): VoidReading | null {
  const e = BY_SIGN[sign];
  if (!e) return null;
  return { ...e, benign: LILLY_EXEMPT.has(sign) };
}
