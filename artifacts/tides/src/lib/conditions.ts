// Standing conditions — the multi-day background weather systems.
// Retrogrades, eclipses, and non-lunar planet-to-planet aspects.
// Eclipses are a hardcoded static table (known years ahead, trivial, accurate).

export interface Eclipse {
  date: string;   // ISO yyyy-mm-dd (peak, UTC-ish)
  kind: "solar" | "lunar";
  type: string;   // total / partial / annular / penumbral
  note: string;
}

// Source: NASA eclipse canon. Kept as a small rolling window.
export const ECLIPSES: Eclipse[] = [
  { date: "2026-02-17", kind: "solar", type: "annular", note: "Annular solar eclipse — a seeded beginning; endings that clear space." },
  { date: "2026-03-03", kind: "lunar", type: "total",   note: "Total lunar eclipse — a culmination; something long-building comes to light." },
  { date: "2026-08-12", kind: "solar", type: "total",   note: "Total solar eclipse — a major reset; new chapters open." },
  { date: "2026-08-28", kind: "lunar", type: "partial", note: "Partial lunar eclipse — release and course-correction." },
  { date: "2027-02-06", kind: "solar", type: "annular", note: "Annular solar eclipse — beginnings around what you value." },
  { date: "2027-07-18", kind: "solar", type: "partial", note: "Partial solar eclipse — a doorway; keep options open." },
  { date: "2027-08-02", kind: "solar", type: "total",   note: "Total solar eclipse — a landmark reset." },
];

// Nearest eclipse within `windowDays` of `today` (past or future).
export function activeEclipse(today: string, windowDays = 5): { eclipse: Eclipse; daysAway: number } | null {
  const t = new Date(today + "T12:00:00").getTime();
  let best: { eclipse: Eclipse; daysAway: number } | null = null;
  for (const e of ECLIPSES) {
    const days = Math.round((new Date(e.date + "T12:00:00").getTime() - t) / 86400000);
    if (Math.abs(days) <= windowDays && (!best || Math.abs(days) < Math.abs(best.daysAway))) {
      best = { eclipse: e, daysAway: days };
    }
  }
  return best;
}

export const RETRO_NOTES: Record<string, string> = {
  Mercury: "Mercury retrograde — review, revise, back up. Double-check communication and plans.",
  Venus:   "Venus retrograde — reassess values, relationships, and what you find beautiful.",
  Mars:    "Mars retrograde — energy turns inward; refine strategy before pushing.",
  Jupiter: "Jupiter retrograde — inner growth over outward expansion.",
  Saturn:  "Saturn retrograde — revisit structures and commitments.",
  Uranus:  "Uranus retrograde — internal shifts before external change.",
  Neptune: "Neptune retrograde — clearer sight through the usual fog.",
  Pluto:   "Pluto retrograde — deep internal transformation.",
};

export const ASPECT_GLYPH: Record<string, string> = {
  conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍",
};

export { PLANET_GLYPH } from "@/lib/glyphs";
