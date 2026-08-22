/**
 * THE CRISIS GATE.
 *
 * Compass takes tasks and dates as input everywhere else, so until now it has
 * never been handed a sentence about how someone is. The "how are you feeling"
 * door changes that, and this runs before anything else in it: before the
 * mirror, before any planet is looked up, before a single word of astrology is
 * composed.
 *
 * THE RULE IS ABSOLUTE. Matched language returns support and NO READING. Not a
 * reading with a note attached, not a softened reading, not a reading behind a
 * confirmation. The house rule that a disclaimer means the design is wrong
 * applies here more than anywhere: an astrological interpretation of "I want to
 * die" is wrong at any size, with any caveat.
 *
 * DELIBERATELY DETERMINISTIC. No model call, no network, no key. A safety check
 * that depends on a configured API is a safety check that is off in exactly the
 * deployments least likely to notice.
 *
 * ── On the two ways this can fail ──────────────────────────────────────────
 *
 * A false negative shows an astrology reading to someone in crisis. A false
 * positive shows a support card to someone who wrote "this deadline is killing
 * me". Those are not symmetric, and the design does not treat them as such —
 * but a gate that fires on ordinary venting is its own harm: it is patronising,
 * and it teaches people to use smaller words for how they feel, which defeats
 * the entire feature.
 *
 * So the patterns are SPECIFIC rather than keyword-broad. Nothing matches on a
 * bare "kill", "die" or "dead". The discriminator that does most of the work is
 * the reflexive: "killing myself" is caught, "killing me" is not, and English
 * idiom almost never puts the reflexive in the figurative sense.
 *
 * The box asks how a person feels, not what happened to their body, which is
 * why "cut myself" and "hurt myself" are in: in this input the serious reading
 * is the likely one. That is a judgment, recorded here so it can be revisited
 * rather than rediscovered.
 */

export type CrisisKind = "self-harm" | "harm-to-others";

export interface CrisisMatch {
  blocked: true;
  kind: CrisisKind;
  /** Support text. Deliberately short, plain, and not clinical. */
  message: string;
  resources: { label: string; detail: string }[];
}
export type CrisisResult = CrisisMatch | { blocked: false };

/**
 * Self-harm and suicidality. Every pattern is anchored to a first-person
 * reflexive, to "my life", or to a word that has no idiomatic sense.
 */
const SELF_HARM: RegExp[] = [
  // Explicit, no idiomatic reading exists.
  /\bsuicid(e|al)\b/i,
  // The reflexive is the discriminator: "killing myself" vs "killing me".
  /\b(kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+my\s?self\b/i,
  /\b(end|ending|take|taking)\s+(my|my own)\s+life\b/i,
  /\bend(ing)?\s+it\s+all\b/i,
  // Wanting not to be alive, in the forms people actually write. Split from
  // one pattern into three because "wish I was dead" puts a subject and a
  // verb between the wanting and the wanted, and a single regex that stretched
  // to cover it was loose enough to catch idiom.
  /\b(want|wanna|wanting)\s+to\s+(die|be\s+dead)\b/i,
  /\bwish(ing|ed)?\s+(i\s+(was|were|wasn'?t|weren'?t)\s+)?dead\b/i,
  /\bwish(ing|ed)?\s+i\s+(was|were)n'?t\s+(here|alive|around)\b/i,
  /\bwish(ing|ed)?\s+i\s*('d|\s+had)?\s*(never\s+)(been\s+)?born\b/i,
  /\b(better|be\s+better)\s+off\s+dead\b/i,
  /\b(don'?t|do\s+not|didn'?t)\s+want\s+to\s+(be\s+(here|alive)|live|exist|wake\s+up)\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living|being\s+here)\b/i,
  /\bnothing\s+to\s+live\s+for\b/i,
  /\bnot\s+worth\s+living\b/i,
  // Method language, which is never figurative in a sentence about feeling.
  /\boverdos(e|ing)\b/i,
  /\b(slit|slitting)\s+my\b/i,
];

/**
 * Violent ideation toward another person. A different problem with the same
 * answer here: this door does not give it a reading either.
 */
const HARM_OTHERS: RegExp[] = [
  /\b(want|wanna|going|plan(ning)?)\s+to\s+(kill|hurt|stab|shoot)\s+(him|her|them|someone|somebody|my|his|their)\b/i,
  /\bhurt\s+(someone|somebody|people)\s+(badly|for\s+real)\b/i,
];

/**
 * Figurative uses that must never trip the gate. Checked only to document the
 * intent and to guard the patterns above in the test suite — the patterns are
 * written so these do not match in the first place, and this list is what
 * proves it stays that way.
 */
export const KNOWN_FIGURATIVE = [
  "this project is killing me",
  "my back is killing me",
  "i'm dying to finish this",
  "dying for a coffee",
  "dead tired",
  "dead on my feet",
  "i'm killing it at work",
  "that meeting was murder",
  "this deadline is the death of me",
  "i could kill for a nap",
  "a look to die for",
  "i hurt my knee running",
  "i cut my finger cooking",
  "dead inside after that meeting",
  "i'm so dead",
  "work is soul destroying",
];

const SUPPORT = {
  message:
    "This is more than a reading can meet, and it isn't the kind of thing the sky should get a say in. "
    + "Talking to a person helps, and it can be right now.",
  resources: [
    { label: "988", detail: "Call or text, any time — the Suicide & Crisis Lifeline in the US and Canada." },
    { label: "Text HOME to 741741", detail: "Crisis Text Line, if writing is easier than talking." },
    { label: "findahelpline.com", detail: "Free, confidential lines in over 100 countries." },
  ],
};

/**
 * Check a person's own words before anything reads them.
 *
 * Returns `{ blocked: false }` for ordinary feeling, however dark — sadness,
 * dread, exhaustion and rage are exactly what this door is for, and none of
 * them trips it.
 */
export function checkCrisis(text: string): CrisisResult {
  const t = String(text ?? "");
  if (!t.trim()) return { blocked: false };
  for (const re of SELF_HARM) {
    if (re.test(t)) return { blocked: true, kind: "self-harm", ...SUPPORT };
  }
  for (const re of HARM_OTHERS) {
    if (re.test(t)) return { blocked: true, kind: "harm-to-others", ...SUPPORT };
  }
  return { blocked: false };
}
