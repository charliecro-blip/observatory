import type { ActivityCorrespondence } from "./activityCorrespondences.js";

/** Owner-approved catalogue addition (2026-09-04), kept separate from first-date rules. */
export const ROMANTIC_TIME: ActivityCorrespondence = {
  key: "romantic-time",
  label: "Time with your partner",
  category: "love",
  keywords: [
    "date night",
    "romantic evening",
    "romantic time",
    "date with my wife",
    "date with my husband",
    "date with my partner",
  ],
  element: "water",
  planets: { Venus: 1.0, Moon: 0.8 },
  hourRulers: ["Venus", "Moon"],
  aspects: "soft",
  signs: {
    Cancer: "familiar company",
    Taurus: "shared comfort",
    Libra: "time together",
  },
  houses: [5, 7],
  phase: null,
  voc: "neutral",
  mercuryRx: null,
  windowType: "relationship",
  gloss:
    "Venus and the Moon describe time together in an existing relationship.",
};

/** Explicit relationship wording takes precedence over generic keyword matches. */
export function relationshipActivityKey(
  text: string,
): "first-date" | "romantic-time" | null {
  if (/\bfirst[ -]date\b/i.test(text)) return "first-date";
  if (
    /\b(date night|romantic (evening|time)|date with my (wife|husband|partner))\b/i.test(
      text,
    )
  )
    return "romantic-time";
  return null;
}
