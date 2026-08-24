/**
 * WHICH ONE THING LEADS HOME.
 *
 * Five modules could each claim the top of the page, and until now they simply
 * stacked: an angle crossing, a ritual card, a new-moon check-in, a rare-moment
 * notice and the Sunday review could all render at once, above the rhythm lead,
 * pushing the day's actual work below the fold on the loads where the sky
 * happened to be busy. Every one of them is defensible alone. The stack was the
 * failure.
 *
 * They now compete for ONE slot.
 *
 * THE LOSERS ARE DEFERRED, NOT DROPPED (owner, 2026-08-24). A candidate that
 * loses is not rendered, and because it is not rendered it never marks itself
 * seen — so it is still live on the next load, once whatever outranked it has
 * expired. That is deferral for free, and it is also fragile: it holds only as
 * long as nothing mounts a losing candidate "invisibly" to ask whether it
 * wanted the slot. Ask a candidate with a predicate, never by rendering it.
 *
 * The order is not arbitrary. It runs from the thing that expires soonest to
 * the thing that is always available:
 *
 *   crossing  a window about twenty minutes wide, gone if not read now
 *   ritual    only inside its own hours; outside them, not a candidate at all
 *   newmoon   a turning point that comes round once a cycle
 *   rare      an alignment that will not repeat soon
 *   review    the week's, on its day
 *   lead      the rhythm's own answer — the floor, never absent
 *
 * `newmoon` above `rare` preserves the behaviour that already shipped:
 * RareMomentBanner has been taking `suppressed={turningPointPromptOpen(...)}`
 * since the check-in was built. This file makes that pairwise rule general
 * rather than replacing it.
 */

export const OPENING_ORDER = ["crossing", "ritual", "newmoon", "rare", "review", "lead"] as const;
export type OpeningKind = (typeof OPENING_ORDER)[number];

/** What the page can say about a deferred candidate, in one line. */
export const DEFERRED_LABEL: Record<OpeningKind, string> = {
  crossing: "an angle crossing",
  ritual:   "your ritual",
  newmoon:  "the new moon check-in",
  rare:     "a rare alignment",
  review:   "the week's review",
  lead:     "",
};

export interface OpeningChoice {
  /** The one that renders. Always defined — `lead` is the floor. */
  shown: OpeningKind;
  /** Live candidates that lost, in order. Still live next load. */
  deferred: OpeningKind[];
}

/**
 * Exactly one winner, always.
 *
 * `lead` is treated as live whatever the caller passes, because a page with no
 * opening at all is not a quieter page — it is a page that has lost its answer.
 * RhythmLead renders its own empty state ("Nothing on the list yet"), which is
 * a result rather than a blank.
 */
export function chooseOpening(live: Partial<Record<OpeningKind, boolean>>): OpeningChoice {
  const eligible = OPENING_ORDER.filter(k => (k === "lead" ? true : !!live[k]));
  const [shown, ...rest] = eligible;
  // `lead` never reads as deferred: it did not lose anything, it is the floor.
  return { shown, deferred: rest.filter(k => k !== "lead") };
}
