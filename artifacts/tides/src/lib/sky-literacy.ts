import { PLANETS as LEXICON_PLANETS } from "../../../../lib/lexicon/src/planets";
// Sky literacy — the teaching layer. Each planet gets its practical feel
// (day/hour scale), its honest shadow, the weekly rhythm that makes it
// learnable (the Moon contacts every planet roughly once a week), and its
// long arc. Written to be felt-checkable: every claim here is something a
// user can verify against their own logged days within a few weeks.
//
// Voice rules: feeling-language first, jargon second; honest about the hard
// parts without being alarming (a heavy day is normal and has a use); the
// etymology is the proof that people have felt these flavors for centuries —
// "saturnine", "jovial", "mercurial" entered English from exactly this.

export interface PlanetLiteracy {
  adjective: string;   // the flavor word — saturnine, jovial, mercurial…
  undertone: string;   // one-line Today teachable: what today may feel like
  feelsLike: string;   // practical, hour/day scale
  shadow: string;      // the honest downside, normalized
  useIt: string;       // what this flavor is FOR
  weeklyNote: string;  // the rhythm that makes it learnable
  longArc: string;     // transits/returns — the years scale
  etymology?: string;  // the word that proves the feeling is old
}

export const PLANET_LITERACY: Record<string, PlanetLiteracy> = Object.fromEntries(
  Object.values(LEXICON_PLANETS).map(p => [p.key, p.literacy]),
);

// Aspect → how the flavor tends to arrive. Hard aspects are the teachers —
// they're the ones you feel without trying.
export const CONTACT_TONE: Record<string, string> = {
  conjunction: "fused with the day's mood — the flavor is strong and everywhere",
  square: "as friction — the flavor arrives as something to push against",
  opposition: "as a pull — the flavor shows up through other people and demands balance",
  trine: "as ease — the flavor flows without effort",
  sextile: "as an opening — available if you reach for it",
};

// ── The curriculum ladder ────────────────────────────────────────────────────
// Six rungs from feeling-vocabulary to timing craft. Most people live happily
// at rungs 1–3 forever; the ladder's job is to make the next rung visible and
// inviting, never required. Each rung says where in the app to practice it.

export interface CurriculumLevel {
  n: number;
  title: string;
  essence: string;  // one line
  body: string;     // the actual lesson, short
  practice: string; // where in the app to live it
}

export const CURRICULUM: CurriculumLevel[] = [
  {
    n: 1,
    title: "The four tides",
    essence: "Every day has a character: Deep, Surge, Building, or Clear.",
    body: "The day's character is set by which element the Moon is moving through — water (feel), fire (act), earth (build), air (think). Beyond character there's level: high and rising means lean in; low or ebbing means ease off. That's the whole first language — two words a day.",
    practice: "Read the weather card on Today each morning. That's it. A week of glancing builds the instinct.",
  },
  {
    n: 2,
    title: "The Moon's month",
    essence: "The Moon is the app's clock — sign every ~2.5 days, cycle every ~29.",
    body: "New moon plants, first quarter pushes through resistance, full moon shows the results, last quarter releases. And every ~2.5 days the Moon changes sign, which is why the tide's character shifts on that rhythm. Learn the Moon and everything else is detail.",
    practice: "Watch the moon line in the rail (or the phase on the weather card) for one full month, and mark the new and full moons in the Log.",
  },
  {
    n: 3,
    title: "The planetary flavors",
    essence: "About once a week, each planet gets a day with its flavor.",
    body: "When the Moon makes a hard angle to a planet, the day carries that planet's undertone — a saturnine day is heavy but focused, a martial one runs hot, a jovial one feels expansive. These words (saturnine, mercurial, jovial) entered English because people have felt the flavors for centuries. This is the rung where astrology stops being abstract.",
    practice: "When Today names an undertone, notice the day and rate it that evening. Visit each planet in Star Base to see its next flavor day and your own track record.",
  },
  {
    n: 4,
    title: "Your chart",
    essence: "The sky at your birth is your personal weather sensitivity map.",
    body: "Your natal chart says which flavors hit you harder and where each drive lives in your life. Two people share a saturnine sky; only one has it square their natal Moon. This is where the app's readings become about you rather than everyone.",
    practice: "Add your birth details in Settings, then tour your planets in Star Base — each page shows where that drive sits in your chart and what's touching it now.",
  },
  {
    n: 5,
    title: "Houses & seasons",
    essence: "Life has arenas (houses) and long chapters moving through them.",
    body: "The twelve houses are the arenas — money, home, work, partnership. Slow planets spend months or years crossing each one, and your profected year highlights one house per birthday year. This is the layer that explains why a whole season of life has a theme.",
    practice: "Read your long weather at the top of Stars, and visit Houses in Star Base to see which arenas are lit up right now.",
  },
  {
    n: 6,
    title: "Choosing moments",
    essence: "Timing as craft: begin things when the sky agrees.",
    body: "Electional astrology is picking the moment on purpose — launch on a rising tide in a supportive sign, avoid the void Moon for beginnings, put the hard conversation on a day with ease rather than friction. Everything from rungs 1–5 becomes an instrument panel.",
    practice: "Use When to weave your week and to pick a good moment to begin something that matters. Check what the Planner chose and see if you can read why.",
  },
];
