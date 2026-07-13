// The intellectual spine of Tides — the nested ladder of rhythms, from the
// fastest beat at the surface to the slowest current at the seabed. This is
// the mental map the whole app hangs on: every reading it gives you is located
// somewhere on this ladder.
//
// OWNER: this is meant to be edited. The prose is a first draft — the structure
// (eight rungs, lunar aspects between hour and day, planetary aspects between
// day and month) is the settled shape. Rewrite the `line` and `feel` freely.
//
// Rendered by SpineGauge.tsx as a vertical "depth gauge" — water lightening at
// the surface, deepening below — and usable as an intro slide or reference page.

export interface SpineRung {
  key: string;
  name: string;
  period: string;   // human scale
  line: string;     // one sentence — what it is
  feel: string;     // how you meet it in the app
  kind: "cycle" | "aspect"; // aspects are the moments between the cycles
}

// Surface (fastest) → seabed (slowest).
export const SPINE: SpineRung[] = [
  {
    key: "hour", name: "The hour", period: "~1 hour", kind: "cycle",
    line: "The planetary hour — the sky's fastest beat, a new ruler every hour of the day.",
    feel: "The rail's hour instrument, and the 'this hour…' suggestion.",
  },
  {
    key: "lunar-aspect", name: "Lunar aspects", period: "a few hours", kind: "aspect",
    line: "The Moon touching a planet in passing — the day's shifting moods, arriving and clearing within hours.",
    feel: "Moon aspects in the rail; the teachable-moment line on Today.",
  },
  {
    key: "day", name: "The day", period: "~1 day", kind: "cycle",
    line: "The Moon's sign sets the day's whole character — Deep, Surge, Building, or Clear.",
    feel: "The tide on Today: the one word for what kind of day it is.",
  },
  {
    key: "planetary-day", name: "The planetary day", period: "1 of 7 days", kind: "cycle",
    line: "Each weekday has its own planetary ruler — Sun's day, Moon's day, Mars' day — cycling through the seven in Chaldean order.",
    feel: "The rail's 'This day' instrument: whose day it is and what it's good for.",
  },
  {
    key: "planet-aspect", name: "Planetary aspects", period: "days to weeks", kind: "aspect",
    line: "Two planets meeting each other — the sky's weather fronts, holding for days rather than hours.",
    feel: "The Big Sky cards; the practitioner Chart's aspect lines.",
  },
  {
    key: "month", name: "The lunar month", period: "~29 days", kind: "cycle",
    line: "The Moon's whole cycle — new to full to dark — the rhythm of building and releasing.",
    feel: "The moon phase; the month's-water strip; your monthly body rhythm.",
  },
  {
    key: "season", name: "The season", period: "~1–3 months", kind: "cycle",
    line: "The Sun's sign — the quarter of the year, its mood and its work.",
    feel: "The Season instrument; 'Cancer season' and what it favors.",
  },
  {
    key: "year", name: "The solar year", period: "~1 year", kind: "cycle",
    line: "Light waxing and waning across the year — your longest natural wave of energy.",
    feel: "The daylight line; your yearly high-light and deep-dark stretches.",
  },
  {
    key: "chapter", name: "The chapter", period: "years", kind: "cycle",
    line: "A slow planet crossing one of your houses — a whole season of a life, years long.",
    feel: "Currents and your Guiding Stars: the chapters your aims ride.",
  },
];

// The through-line, for the intro-slide caption.
export const SPINE_INTRO =
  "Everything in the sky is a rhythm, and the rhythms nest inside each other — " +
  "the hour inside the day, the day inside the month, the month inside the year. " +
  "Tides reads all of them at once and tells you where you are. Learn this ladder " +
  "and the whole app makes sense: each reading is just one rung, spoken plainly.";
