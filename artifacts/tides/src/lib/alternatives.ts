// "Another fit" — the same quality, spent differently.
//
// Three unordered recommendations would rebuild the indecision that Strongest
// Fit exists to remove, so the alternatives are collapsed, conditional, and
// never coequal with the default. What makes them conditional rather than a
// list is that each one is keyed to something COMPASS CANNOT KNOW:
//
//     If your focus is intact  — revise the proposal.
//     If you're running empty  — organise the supporting notes.
//     If you need to move      — take the walk and dictate.
//
// The user picks by consulting themselves, which is both more useful than a
// ranked list and the honest admission: the engine knows the sky, not the
// body. It has no reading of your energy, your focus, or whether you have been
// alone all day.
//
// The capacities are deliberately not all productivity registers. The owner's
// direction was to invite "not just fire/air ambition, but also self care and
// social" into the app's vocabulary — so being depleted and wanting company
// are first-class ways to spend an hour here, not consolation prizes.
//
// Conditions filter the same way lib/approach.ts does, in the same order:
// VOC first, then wind-down, then day part. Nothing high-arousal survives into
// the last stretch before sleep, whichever capacity is asked for.

import { dayPartFor, type ApproachContext, type DayPart } from "./approach";

/** What the engine cannot observe about you. */
export type Capacity = "depleted" | "restless" | "social";

export interface Alternative {
  /** The user-facing condition — "if you're running on empty". */
  condition: string;
  /** What to do under it, in this planet's voice. */
  suggestion: string;
  capacity: Capacity;
  /** Which rule chose the wording, so the UI can explain and tests can assert. */
  basis: "voc" | "winddown" | "daypart";
}

const CONDITION: Record<Capacity, string> = {
  depleted: "if you're running on empty",
  restless: "if you need to move",
  social: "if you'd rather not be alone",
};

/**
 * Each planet's voice in three capacities.
 *
 * `quiet` is used for wind-down and night. It is not a softened version of the
 * same instruction — it is what that planet legitimately looks like when the
 * day is closing, which is the whole reason the Mars-at-21:20 case was wrong.
 */
type Forms = { day: string[]; quiet: string[] };

const REGISTER: Record<string, Record<Capacity, Forms>> = {
  Sun: {
    depleted: { day: ["do the one visible thing, then stop", "let a small win count"],
                quiet: ["name one thing that went right"] },
    restless: { day: ["walk where you can be seen", "move the body toward the goal"],
                quiet: ["a slow walk, nothing strenuous"] },
    social:   { day: ["say it in front of someone", "let a friend see the work"],
                quiet: ["tell one person how the day went"] },
  },
  Moon: {
    depleted: { day: ["eat, rest, drop the bar on purpose", "tend the body first"],
                quiet: ["rest without earning it"] },
    restless: { day: ["walk, swim, move water", "cook something with your hands"],
                quiet: ["stretch, then stop"] },
    social:   { day: ["call the first person you think of", "be domestic with someone"],
                quiet: ["sit with someone, no agenda"] },
  },
  Mercury: {
    depleted: { day: ["sort, file, tidy — low stakes", "one small message, not the hard one"],
                quiet: ["note tomorrow's first task and shut the laptop"] },
    restless: { day: ["walk and dictate", "run the errands that need legs"],
                quiet: ["walk without the phone"] },
    social:   { day: ["talk it through with someone", "teach the thing you just learned"],
                quiet: ["a light conversation, nothing decided"] },
  },
  Venus: {
    depleted: { day: ["make one thing nicer, cheaply", "choose comfort on purpose"],
                quiet: ["something soft — music, a bath"] },
    restless: { day: ["move somewhere pleasant", "dance, garden, arrange"],
                quiet: ["move slowly through a nice room"] },
    social:   { day: ["share a meal", "mend the thing left unsaid"],
                quiet: ["easy company, low effort"] },
  },
  Mars: {
    depleted: { day: ["one decisive small thing, then stop", "clear the smallest blocked item"],
                quiet: ["cut one thing loose, then rest"] },
    // The reported failure: "train hard" proposed at 21:20 against a 23:00
    // bedtime. Restless is exactly the capacity that would reach for it, so
    // this is the entry the quiet register most has to catch.
    restless: { day: ["train hard", "physical work with a visible end"],
                quiet: ["decisive tidying — movement, no adrenaline"] },
    social:   { day: ["have the direct conversation", "something competitive with people"],
                quiet: ["say the honest thing kindly, then leave it"] },
  },
  Jupiter: {
    depleted: { day: ["read something that widens the frame", "be generous in one cheap way"],
                quiet: ["let the plan stay big and unwritten"] },
    restless: { day: ["go further than usual", "move toward the bigger version"],
                quiet: ["a wandering walk, no destination"] },
    social:   { day: ["make the bigger ask of someone", "host, teach, introduce two people"],
                quiet: ["a long talk with no outcome"] },
  },
  Saturn: {
    depleted: { day: ["the smallest dull task, done properly", "lower the commitment honestly"],
                quiet: ["stillness counts as the work"] },
    restless: { day: ["physical order — clear, sort, repair", "the maintenance you keep deferring"],
                quiet: ["put one thing in order, slowly"] },
    social:   { day: ["set the boundary out loud", "keep the promise you made someone"],
                quiet: ["say no, kindly and early"] },
  },
};

/**
 * Void of course forms. The Moon makes no further aspects before changing
 * sign, and the counsel is finish-don't-begin — so every one of these is a
 * re-verb regardless of capacity. VOC outranks capacity for the same reason it
 * outranks day part in lib/approach.ts: it is the most specific thing known
 * about the window, and it forbids exactly the verbs these lists are full of.
 */
const VOC_BY_CAPACITY: Record<Capacity, string> = {
  depleted: "return to something already going — open nothing",
  restless: "walk, tidy, move — but open no new front",
  social: "get back to someone you've been meaning to",
};

const isQuiet = (part: DayPart) => part === "winddown" || part === "night";

/**
 * The alternatives to the default fit, best first.
 *
 * Returns [] rather than a filler suggestion when the planet has no register —
 * an empty result collapses the disclosure, which is better than inventing an
 * option to fill a row.
 */
export function conditionalFits(ctx: ApproachContext): Alternative[] {
  const part = dayPartFor(ctx.at, ctx.wakeTime, ctx.sleepTime);
  const quiet = isQuiet(part);
  const order: Capacity[] = quiet
    // Late on, "you're running on empty" is the likeliest true one, and
    // "you need to move" the least useful. Order by plausibility, not by taste.
    ? ["depleted", "social", "restless"]
    : ["depleted", "restless", "social"];

  const table = REGISTER[ctx.planet];
  if (!table) return [];

  return order.map((capacity) => {
    if (ctx.voc) {
      return { condition: CONDITION[capacity], suggestion: VOC_BY_CAPACITY[capacity], capacity, basis: "voc" as const };
    }
    const forms = table[capacity];
    const list = quiet ? forms.quiet : forms.day;
    // Stable rotation, no randomness — the same conditions give the same
    // answer, which is what lets someone check twice without feeling gaslit.
    const text = list[(ctx.at.getHours() + ctx.at.getDate()) % list.length];
    return { condition: CONDITION[capacity], suggestion: text, capacity, basis: quiet ? ("winddown" as const) : ("daypart" as const) };
  });
}
