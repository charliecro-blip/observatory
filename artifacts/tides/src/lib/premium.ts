/**
 * WHAT PAID BUYS — the teaser copy, and only the teaser copy.
 *
 * The line itself lives on the server (api-server/src/lib/entitlements.ts)
 * and is read through useEntitlements(). This file exists so the explore
 * modal has words for it, and nothing here decides anything.
 *
 * IT DESCRIBED A DIFFERENT PRODUCT UNTIL 2026-08-19. The old list sold
 * Currents, Caution Periods and The Chart — natal personalization, which the
 * pricing decision turned down as the paid axis. Left alone it would have
 * told a free user to upgrade for three things they already have, which is
 * worse than saying nothing.
 */

export type PremiumFeature = "orchestration";

export interface PremiumFeatureMeta {
  key: PremiumFeature;
  title: string;
  teaser: string;
  icon: string;
}

/** Named for what the person gets, in the order they would meet it. */
export const PREMIUM_FEATURES: PremiumFeatureMeta[] = [
  {
    key: "orchestration",
    title: "Shape the week",
    teaser: "Hand Compass a list and it finds windows across the week, working around your calendar and your waking hours.",
    icon: "◷",
  },
  {
    key: "orchestration",
    title: "Long sessions",
    teaser: "Find where a week actually has hours free in a row.",
    icon: "▭",
  },
  {
    key: "orchestration",
    title: "What actually worked",
    teaser: "Your own record of the kinds of day you get things done on, built from what you finished.",
    icon: "◔",
  },
  {
    key: "orchestration",
    title: "Timing, in Ask",
    teaser: "Ask when something should happen, and across which days.",
    icon: "✦",
  },
];

/**
 * What free keeps — stated because a page that only lists what you lack
 * reads as a hostage note. Every one of these is deliberate: the day's read
 * and its full evidence, the plain planner, and the star cap and cadence
 * forgiveness that the pricing decision refused to make levers.
 */
export const FREE_KEEPS: string[] = [
  "Today's read, and the reasons behind every suggestion",
  "Your tasks, habits and Guiding Stars as a plain planner",
  "The sky as it stands, and good times for one thing at a time",
  "Everything you have written, and you can export it whenever you want",
];
