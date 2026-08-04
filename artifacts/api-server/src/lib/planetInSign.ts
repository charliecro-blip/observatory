/**
 * What a planet can and cannot do from the sign it is actually in.
 *
 * The rail named the planet and named the sign and then said nothing about the
 * combination — so "Mars in Cancer" rendered as generic Mars copy sitting next
 * to the word Cancer, which is the one thing it does not mean. `PLANET_ROADS`
 * is per-planet, `SIGN_MYTHOS` is per-sign, and there was no product of the
 * two. This file is that product.
 *
 * ONLY THE CLASSICAL SEVEN.
 * ---------------------------------------------------------------------------
 * Uranus, Neptune and Pluto sit in a sign for seven, fourteen and twenty years.
 * "Neptune in Pisces" is a fact about everyone born across a decade and a half,
 * not about your Tuesday, and writing thirty-six daily-register lines for them
 * would dress a generational placement up as personal news. Their entry says so
 * and points at the thing that IS personal — what they are currently touching
 * in your own chart. That is a deliberate refusal, not a gap to fill later.
 *
 * PROVENANCE.
 * ---------------------------------------------------------------------------
 * The DIGNITY is inherited doctrine — domicile, exaltation, detriment and fall
 * are the classical rulership scheme, and it is computed by lib/dignity.ts, not
 * restated here. Duplicating those tables would create a second source of truth
 * for a fact the engine already weights testimony by, and the two would drift.
 *
 * The SENTENCES are Compass synthesis. No source says "Mercury in Sagittarius
 * is confident about details it never checked" — that is this app's reading of
 * a peregrine, detrimented Mercury in a mutable fire sign, and it must never be
 * presented as Lilly or Bonatti.
 *
 * SHAPE: each entry is `does` (what the placement is good for) and `misses`
 * (how it goes wrong). Two clauses, because that is what fits the rail and
 * because a placement with only an upside is a horoscope, not a reading.
 */

import { essentialDignity, signName } from "./dignity.js";

export interface PlanetInSign {
  does: string;
  misses: string;
}

/** Generational planets: one honest line instead of twelve invented ones. */
export const GENERATIONAL = new Set(["Uranus", "Neptune", "Pluto"]);

const TABLE: Record<string, Record<string, PlanetInSign>> = {
  Sun: {
    Aries:       { does: "starts at full brightness — first, early, loud", misses: "wants the beginning more than the finish" },
    Taurus:      { does: "steady output; the work shows up the same way daily", misses: "digs in long after the plan changed" },
    Gemini:      { does: "shines by explaining — connects things, gets quoted", misses: "visible in six places, finished in none" },
    Cancer:      { does: "warmth turned inward — home, and the few who count", misses: "praise from strangers stops registering" },
    Leo:         { does: "whatever you make, you can stand behind in public", misses: "the audience quietly becomes the point" },
    Virgo:       { does: "pride in the craft itself, seen or not", misses: "nothing ships, because nothing is finished" },
    Libra:       { does: "shines through others — the partner, the collaboration", misses: "your own aim goes missing while you weigh theirs" },
    Scorpio:     { does: "burns narrow and deep; one thing, all the way down", misses: "kept so private that nobody can help" },
    Sagittarius: { does: "purpose looks like distance — the further reach", misses: "the pitch outruns what is actually built" },
    Capricorn:   { does: "recognition earned in public and on the record", misses: "waits for permission nobody formally gives" },
    Aquarius:    { does: "stands out by standing apart", misses: "contrary on reflex, even when the room is right" },
    Pisces:      { does: "purpose felt before it can be argued", misses: "dissolves into whoever else is present" },
  },
  Moon: {
    Aries:       { does: "needs met fast — act on the feeling, examine it after", misses: "the mood arrives already dressed as a decision" },
    Taurus:      { does: "settled by food, warmth, and the same chair", misses: "comfort hardens into refusal to move" },
    Gemini:      { does: "feelings get processed by saying them out loud", misses: "talked about so thoroughly they never land" },
    Cancer:      { does: "you know what you need without having to ask", misses: "the past gets re-felt as though it were now" },
    Leo:         { does: "needs to be delighted in, not merely tolerated", misses: "sulks when the room fails to notice" },
    Virgo:       { does: "care shows up as usefulness — you fix what is wrong", misses: "worry doing an impression of planning" },
    Libra:       { does: "steadied by good company and a pleasant room", misses: "own needs postponed until they surface as grievance" },
    Scorpio:     { does: "feels it at full volume and shows none of it", misses: "holds the grudge long past its cause" },
    Sagittarius: { does: "cheered by motion — a trip, a plan, any horizon", misses: "restless the moment things turn ordinary" },
    Capricorn:   { does: "comfort comes from being on top of it", misses: "feelings deferred until there is time, and there never is" },
    Aquarius:    { does: "needs room — company you choose, at a distance you set", misses: "detached from your own state until it gets loud" },
    Pisces:      { does: "reads the room before anyone has spoken", misses: "someone else's mood, wearing your name" },
  },
  Mercury: {
    Aries:       { does: "fast and blunt; decides mid-sentence", misses: "says it before it is true" },
    Taurus:      { does: "slow, thorough, and it stays learned", misses: "will not reopen a settled opinion" },
    Gemini:      { does: "quick, curious, good in any conversation", misses: "interested in everything, committed to nothing" },
    Cancer:      { does: "thinks in images and memory; explains by story", misses: "the mood decides what counts as true" },
    Leo:         { does: "speaks with conviction — people remember the line", misses: "style outruns the argument underneath" },
    Virgo:       { does: "precise; sorts the real from the noise", misses: "corrects what did not need correcting" },
    Libra:       { does: "states both sides fairly and means it", misses: "never lands on one" },
    Scorpio:     { does: "research mind — finds what was meant to stay buried", misses: "reads motive into ordinary things" },
    Sagittarius: { does: "the shape first, before the parts", misses: "confident about details it never checked" },
    Capricorn:   { does: "plans that survive contact with the week", misses: "dismisses what cannot be proven yet" },
    Aquarius:    { does: "sees the pattern above the individual case", misses: "loyal to the theory over the evidence" },
    Pisces:      { does: "the answer arrives sideways, and it is often right", misses: "cannot reconstruct how it got there" },
  },
  Venus: {
    Aries:       { does: "direct about wanting; makes the first move", misses: "wants it most in the moment before having it" },
    Taurus:      { does: "real pleasure, real comfort, no apology for either", misses: "spends on comfort past what it is worth" },
    Gemini:      { does: "charmed by wit; likes people who are interesting", misses: "interest wanders as soon as someone is known" },
    Cancer:      { does: "loves by feeding people and remembering things", misses: "care with a small hook in it" },
    Leo:         { does: "generous and warm; makes people feel chosen", misses: "needs the gesture returned where others can see" },
    Virgo:       { does: "love shown by doing the useful thing", misses: "affection that arrives shaped like a critique" },
    Libra:       { does: "fairness, grace, and the room made pleasant", misses: "peace kept at the cost of the true thing" },
    Scorpio:     { does: "all or nothing — intensity is the point", misses: "closeness tested rather than trusted" },
    Sagittarius: { does: "warm and easy; likes the adventure of a person", misses: "leaves just as it turns ordinary" },
    Capricorn:   { does: "commitment as the proof; shows up for years", misses: "warmth withheld until it has been earned" },
    Aquarius:    { does: "loves people as they actually are, oddities included", misses: "distance mistaken for freedom" },
    Pisces:      { does: "forgives more than most people can", misses: "loves the version of them you imagined" },
  },
  Mars: {
    Aries:       { does: "acts first, and the nerve holds", misses: "fights the nearest thing rather than the right one" },
    Taurus:      { does: "slow to start, then impossible to stop", misses: "digs in at the moment moving would win" },
    Gemini:      { does: "argues well and quickly", misses: "energy split across too many fronts" },
    Cancer:      { does: "defends people rather than attacking them", misses: "anger goes sideways instead of straight" },
    Leo:         { does: "bold in the open; performs under pressure", misses: "will not back down while anyone is watching" },
    Virgo:       { does: "effort aimed precisely — the exact fix", misses: "picks the fight over the small wrong thing" },
    Libra:       { does: "pushes through persuasion instead of force", misses: "conflict avoided until it becomes a rupture" },
    Scorpio:     { does: "sustained, strategic, does not let go", misses: "waits to strike rather than saying it now" },
    Sagittarius: { does: "energy with a direction; goes far and fast", misses: "overcommits, then resents the load" },
    Capricorn:   { does: "disciplined force, applied for as long as it takes", misses: "drives the body past what it can pay back" },
    Aquarius:    { does: "fights for the principle rather than the person", misses: "cold exactly where heat was needed" },
    Pisces:      { does: "acts on feeling, and best on someone else's behalf", misses: "effort leaks away with no clear target" },
  },
  Jupiter: {
    Aries:       { does: "grows by going first; luck follows the nerve", misses: "bets large on the untested" },
    Taurus:      { does: "growth you can bank — slow, material, real", misses: "comfort inflates into too much of it" },
    Gemini:      { does: "connects fields nobody had joined", misses: "knows a little about far too much" },
    Cancer:      { does: "generous and protective; makes people safe", misses: "takes on more people than you can hold" },
    Leo:         { does: "big-hearted in the open; brings others up with you", misses: "generosity that needs to be witnessed" },
    Virgo:       { does: "growth through craft, better by increments", misses: "shrinks the ambition to fit the checklist" },
    Libra:       { does: "expands through people — the introduction, the alliance", misses: "agrees to more than is possible" },
    Scorpio:     { does: "goes where others will not, and grows there", misses: "mistakes intensity for depth" },
    Sagittarius: { does: "the wider view, and the nerve to act on it", misses: "promises the horizon and skips the ground" },
    Capricorn:   { does: "growth that has to be built, on the record", misses: "talks yourself out of the larger version" },
    Aquarius:    { does: "expands by including who was left out", misses: "loyal to the idea over the person in front of you" },
    Pisces:      { does: "generous without accounting; meaning without argument", misses: "says yes well past your own capacity" },
  },
  Saturn: {
    Aries:       { does: "discipline in hard bursts", misses: "impatient with the slow part, which is the part" },
    Taurus:      { does: "builds what lasts; will do the same thing for years", misses: "will not rebuild what is already standing wrong" },
    Gemini:      { does: "checks the claim before repeating it", misses: "doubt where a decision was what was needed" },
    Cancer:      { does: "duty to your people, kept quietly", misses: "care given as obligation rather than warmth" },
    Leo:         { does: "takes responsibility in public and carries it", misses: "authority held too tightly to share" },
    Virgo:       { does: "standards that hold; the work actually finishes", misses: "good enough never is" },
    Libra:       { does: "fairness made durable — the agreement that holds", misses: "weighed so long that nothing gets decided" },
    Scorpio:     { does: "endures what would break most people", misses: "control mistaken for safety" },
    Sagittarius: { does: "beliefs tested before they are kept", misses: "the frame hardens into dogma" },
    Capricorn:   { does: "builds the structure, then maintains it", misses: "the work becomes the whole life" },
    Aquarius:    { does: "the rule that serves everyone, not just you", misses: "enforced without the exception it needed" },
    Pisces:      { does: "gives form to what was only felt", misses: "boundaries that dissolve the moment they are tested" },
  },
};

/** The dignity word a reader can act on, or null when there is nothing to say. */
function dignityWord(planet: string, longitude: number, isDay: boolean): string | null {
  const d = essentialDignity(planet, longitude, isDay);
  // Only the four MAJOR dignities. `essentialDignity` also reports triplicity
  // and term — minor dignities that a planet holds far more often than not, and
  // that a reader cannot act on the way they can act on "Mars is in fall here".
  // Ranking the raw list by indexOf silently promoted them: "triplicity" is not
  // in the rank array, indexOf returned -1, and it sorted ahead of domicile. So
  // a Sun in Leo would have been labelled "triplicity" instead of "domicile",
  // and 53 of 84 placements carried a word. Filter first, rank second.
  const MAJOR = ["domicile", "exaltation", "detriment", "fall"];
  const major = d.dignities.filter((x) => MAJOR.includes(x));
  if (!major.length) return null;
  return major.slice().sort((a, b) => MAJOR.indexOf(a) - MAJOR.indexOf(b))[0];
}

export interface PlanetReading {
  does: string;
  misses: string;
  /** "domicile" | "exaltation" | "detriment" | "fall", or null when peregrine. */
  dignity: string | null;
  /** True when this is a years-long placement and the line says so. */
  generational: boolean;
}

/**
 * The reading for a planet at a longitude. Returns null when there is nothing
 * honest to say — an unknown planet, or a point like the Nodes that has no
 * business being described as though it acted.
 */
export function planetInSign(planet: string, longitude: number, isDay: boolean): PlanetReading | null {
  const sign = signName(longitude);

  if (GENERATIONAL.has(planet)) {
    return {
      does: `a placement shared by everyone born across these years — it says little about today`,
      misses: `what is personal is where ${planet} is landing in your own chart`,
      dignity: null,
      generational: true,
    };
  }

  const entry = TABLE[planet]?.[sign];
  if (!entry) return null;
  return { ...entry, dignity: dignityWord(planet, longitude, isDay), generational: false };
}
