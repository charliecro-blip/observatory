/**
 * Shared element and domain constants for all Cultivator views.
 * Single source of truth — import from here, never redefine locally.
 */
import { Flame, Leaf, Wind, Droplets, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ElementKey = "fire" | "earth" | "air" | "water" | "spirit";

export const ELEMENT_ORDER: ElementKey[] = ["fire", "earth", "air", "water", "spirit"];

export const ELEMENT_LABELS: Record<ElementKey, string> = {
  fire:   "Fire",
  earth:  "Earth",
  air:    "Air",
  water:  "Water",
  spirit: "Spirit",
};

export const ELEMENT_SYMBOLS: Record<ElementKey, string> = {
  fire:   "🔥",
  earth:  "🌿",
  air:    "💨",
  water:  "💧",
  spirit: "✨",
};

export const ELEMENT_ICONS: Record<ElementKey, LucideIcon> = {
  fire:   Flame,
  earth:  Leaf,
  air:    Wind,
  water:  Droplets,
  spirit: Sparkles,
};

// CSS class maps are typed as Record<string, string> so they're safe to index
// with runtime string keys from the database.

/** Badge: subtle tinted pill used across all views */
export const ELEMENT_BADGE_CLS: Record<string, string> = {
  fire:   "bg-orange-500/15 text-orange-300 border-orange-500/25",
  earth:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  air:    "bg-sky-500/15 text-sky-300 border-sky-500/25",
  water:  "bg-blue-500/15 text-blue-300 border-blue-500/25",
  spirit: "bg-violet-500/15 text-violet-300 border-violet-500/25",
};

/** Dot: solid color circle for timeline/calendar dots */
export const ELEMENT_DOT_CLS: Record<string, string> = {
  fire:   "bg-orange-400",
  earth:  "bg-emerald-400",
  air:    "bg-sky-400",
  water:  "bg-blue-400",
  spirit: "bg-violet-400",
};

/** Text color for element labels */
export const ELEMENT_COLOR_CLS: Record<string, string> = {
  fire:   "text-orange-300",
  earth:  "text-emerald-300",
  air:    "text-sky-300",
  water:  "text-blue-300",
  spirit: "text-violet-300",
};

/** Ring for focus/selected states */
export const ELEMENT_RING_CLS: Record<string, string> = {
  fire:   "ring-orange-500/30",
  earth:  "ring-emerald-500/30",
  air:    "ring-sky-500/30",
  water:  "ring-blue-500/30",
  spirit: "ring-violet-500/30",
};

/** Card border + subtle bg for element cards */
export const ELEMENT_CARD_CLS: Record<string, string> = {
  fire:   "border-orange-500/25 bg-orange-500/5",
  earth:  "border-emerald-500/25 bg-emerald-500/5",
  air:    "border-sky-500/25 bg-sky-500/5",
  water:  "border-blue-500/25 bg-blue-500/5",
  spirit: "border-violet-500/25 bg-violet-500/5",
};

/** Domain → badge CSS for the 14 cultivation domains */
export const DOMAIN_COLORS: Record<string, string> = {
  sleep:               "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  energy:              "bg-blue-500/15 text-blue-300 border-blue-500/25",
  digestion:           "bg-green-500/15 text-green-300 border-green-500/25",
  "nervous-system":    "bg-purple-500/15 text-purple-300 border-purple-500/25",
  mood:                "bg-violet-500/15 text-violet-300 border-violet-500/25",
  movement:            "bg-orange-500/15 text-orange-300 border-orange-500/25",
  "pain-tension":      "bg-red-500/15 text-red-400 border-red-500/25",
  "creative-practice": "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  boundaries:          "bg-pink-500/15 text-pink-300 border-pink-500/25",
  "food-rhythm":       "bg-lime-500/15 text-lime-300 border-lime-500/25",
  "social-rhythm":     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "spiritual-practice":"bg-teal-500/15 text-teal-300 border-teal-500/25",
  "study-learning":    "bg-amber-500/15 text-amber-300 border-amber-500/25",
  recovery:            "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
};

/** The 14 cultivation domains (value + label pairs). */
export const CULTIVATION_DOMAINS = [
  { value: "sleep",               label: "Sleep" },
  { value: "energy",              label: "Energy" },
  { value: "digestion",           label: "Digestion" },
  { value: "nervous-system",      label: "Nervous System" },
  { value: "mood",                label: "Mood" },
  { value: "movement",            label: "Movement" },
  { value: "pain-tension",        label: "Pain / Tension" },
  { value: "creative-practice",   label: "Creative Practice" },
  { value: "boundaries",          label: "Boundaries" },
  { value: "food-rhythm",         label: "Food Rhythm" },
  { value: "social-rhythm",       label: "Social Rhythm" },
  { value: "spiritual-practice",  label: "Spiritual Practice" },
  { value: "study-learning",      label: "Study / Learning" },
  { value: "recovery",            label: "Recovery" },
] as const;

/** Today as YYYY-MM-DD in UTC (matches API date keys). */
export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

/** Yesterday as YYYY-MM-DD in UTC. */
export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

/** Resolve element key from a cultivation row (elements[] preferred, element fallback). */
export function resolveElement(row: {
  element?: string | null;
  elements?: string[] | null;
}): ElementKey {
  const key = (row.elements?.[0] ?? row.element ?? "earth") as string;
  return (ELEMENT_ORDER as string[]).includes(key) ? (key as ElementKey) : "earth";
}
