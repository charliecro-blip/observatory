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

export const PLANET_LITERACY: Record<string, PlanetLiteracy> = {
  Sun: {
    adjective: "solar",
    undertone: "a solar undertone — visibility, vitality, the pull to be seen",
    feelsLike: "Solar time feels like standing in good light: clearer sense of self, easier decisions, a wish to be witnessed. Confidence sits closer to the surface than usual.",
    shadow: "Its edge is ego-friction — taking things personally, needing credit, glare. If you feel prickly about recognition today, that's the same current.",
    useIt: "Lead, present, decide, be seen. Put your name on something.",
    weeklyNote: "About once a week the Moon makes a hard angle to the Sun — those are the quarter moons, the little tension points of every month. Notice them: they're decision days.",
    longArc: "Long solar arcs are about identity and direction — each birthday (your solar return) opens a new personal year. When slow planets aspect your natal Sun for months, the question is 'who am I becoming?'",
  },
  Moon: {
    adjective: "lunar",
    undertone: "a lunar undertone — feelings near the surface, the body asking to be tended",
    feelsLike: "Lunar time is tidal: moods that move with no obvious cause, hunger for comfort and familiarity, sensitivity dialed up. The body speaks louder than the head.",
    shadow: "Its edge is moodiness and clinging to the familiar — reactive feelings that feel truer than they are. Wait a few hours before believing a 3pm despair.",
    useIt: "Tend, rest, cook, feel, remember. Care for the body and the home.",
    weeklyNote: "The Moon is the fastest teacher in the sky — it changes sign every ~2.5 days, which is why the day's whole character (Deep, Surge, Building, Clear) follows it. Learn the Moon and you've learned the app.",
    longArc: "The Moon's long lessons come as the monthly cycle — new moon intentions to full moon visibility to dark moon rest. Track one full month in the Log and the shape becomes obvious.",
  },
  Mercury: {
    adjective: "mercurial",
    undertone: "a mercurial undertone — a quick, talkative, slightly scattered current",
    feelsLike: "Mercurial time is fast and bright: words come easily, errands chain together, curiosity jumps between tabs. Great for anything involving language, lists, or logistics.",
    shadow: "Its edge is scatter and nerves — too many threads, saying the clever thing instead of the true one, doom-scrolling as fake thinking. If your attention feels like a startled bird, that's it.",
    useIt: "Write, call, sort, schedule, negotiate, learn. Move information.",
    weeklyNote: "Roughly once a week the Moon contacts Mercury and the day takes on this chatty, quicksilver feel. That's the day to clear the inbox and make the calls.",
    longArc: "Mercury's famous long lesson is the retrograde, three weeks a few times a year: revise, resume, reread — the re- words. It's not a curse; it's an editing pass.",
    etymology: "'Mercurial' — quick, changeable, animated — entered English from exactly this flavor.",
  },
  Venus: {
    adjective: "venusian",
    undertone: "a venusian undertone — warmth, ease, an appetite for beauty and company",
    feelsLike: "Venusian time softens things: people are easier to like, food tastes better, aesthetics matter. Friction in relationships loosens; invitations land well.",
    shadow: "Its edge is indulgence and conflict-avoidance — choosing pleasant over honest, buying the thing instead of feeling the feeling.",
    useIt: "Connect, host, beautify, reconcile, enjoy. Make the date, send the invitation, fix the room.",
    weeklyNote: "About once a week the Moon touches Venus and the day carries this sweetness. Notice it — it's the natural day for the relational and aesthetic items on your list.",
    longArc: "Venus retrograde (every ~18 months) famously reopens old relationships and re-questions what you value. Long Venus transits ask: what do you actually want, versus what you were told to want?",
  },
  Mars: {
    adjective: "martial",
    undertone: "a martial undertone — heat, drive, a shorter fuse",
    feelsLike: "Martial time runs hot: more energy than patience, a push to act, cut, finish, confront. Workouts feel great; waiting rooms feel unbearable.",
    shadow: "Its edge is irritability and haste — the snapped reply, the forced decision, the injury from rushing. If everyone seems annoying today, the heat is probably yours.",
    useIt: "Move the body, do the hard physical task, have the direct conversation, make the clean cut you've been avoiding.",
    weeklyNote: "Once a week or so the Moon makes a hard angle to Mars — a day with extra heat in it. Point it at something (exercise, decisive work) or it points itself at people.",
    longArc: "Mars returns to its natal place every ~2 years — cycles of how you fight and pursue. Long Mars transits mark seasons where anger and drive both run closer to the skin.",
    etymology: "'Martial' — of combat and drive — is Mars's name in English.",
  },
  Jupiter: {
    adjective: "jovial",
    undertone: "a jovial undertone — optimism, appetite, the sense that more is possible",
    feelsLike: "Jovial time feels expansive: bigger thinking, easier generosity, luck that's mostly just increased willingness to say yes. Good for asking, launching, teaching, celebrating.",
    shadow: "Its edge is excess and overpromise — the yes you can't deliver, the plan that assumes the best case everywhere. Enthusiasm is not a schedule.",
    useIt: "Ask for the bigger thing, publish, pitch, teach, celebrate, zoom out to the year view.",
    weeklyNote: "The Moon meets Jupiter about weekly — a day that feels lighter and more open-handed than it strictly should. A natural day for asks and launches.",
    longArc: "Jupiter takes ~12 years to circle your chart — one house per year, a slow tour of where growth wants to happen. Your Jupiter return (~ages 12, 24, 36…) opens a fresh 12-year chapter of growth.",
    etymology: "'Jovial' — from Jove, Jupiter — has meant good-humored abundance for five hundred years.",
  },
  Saturn: {
    adjective: "saturnine",
    undertone: "a saturnine undertone — gravity, focus, maybe a little heaviness",
    feelsLike: "Saturnine time has weight: fewer illusions, more clarity about what's actually required. Quiet, structured, unglamorous work goes unusually well. Solitude feels right rather than lonely.",
    shadow: "Its edge is heaviness — pessimism, self-criticism, the sense that everything is a test you're failing. A saturnine day can genuinely feel depressive. That's the flavor, not the truth; it passes within a day.",
    useIt: "Do the disciplined thing: the budget, the edit, the maintenance, the boundary. Saturn days convert effort into structure better than any other.",
    weeklyNote: "Most weeks have one saturnine day — when the Moon makes a hard angle to Saturn. Learn to spot yours: heavy morning, good focus, low small-talk tolerance. Check the Log after a few weeks and you'll see the pattern.",
    longArc: "Saturn is the great teacher of the long game: ~29 years to circle your chart. Its return (~29, ~58) is the famous growing-up threshold. Multi-month Saturn transits are seasons of pruning and consolidation — heavy while they last, and usually what you're proudest of afterward.",
    etymology: "'Saturnine' — grave, gloomy, serious — is centuries of people feeling exactly this day.",
  },
  Uranus: {
    adjective: "uranian",
    undertone: "a uranian undertone — restlessness, static, the urge to break pattern",
    feelsLike: "Uranian time is electric: sudden insights, itchiness inside routines, surprises in the schedule. Genuinely good for experiments and unsticking stuck things.",
    shadow: "Its edge is disruption for its own sake — the impulsive quit, the 2am reinvention, anxiety wearing the costume of excitement.",
    useIt: "Experiment, automate, rearrange, question a default. Give the restlessness a sandbox.",
    weeklyNote: "When the Moon contacts Uranus (about weekly), days go a little static-charged — plans wobble, insights arrive sideways. Loosen the schedule that day rather than gripping it.",
    longArc: "Uranus takes 84 years to circle the chart — its transits mark the awakening seasons, a year or more where one area of life refuses to stay in its old container. The mid-life 'Uranus opposition' (~age 42) is the classic one.",
  },
  Neptune: {
    adjective: "neptunian",
    undertone: "a neptunian undertone — fog, porousness, imagination running high",
    feelsLike: "Neptunian time blurs edges: daydreams are vivid, empathy is high, music and images land deeper than words. Wonderful for creative and spiritual work; unreliable for contracts and estimates.",
    shadow: "Its edge is fog — idealizing people, losing hours, escapism, being lied to easily (mostly by yourself). Don't sign anything important in the fog.",
    useIt: "Create, meditate, listen to music, rest without a goal, let the imagination off-leash.",
    weeklyNote: "The Moon's weekly touch on Neptune makes a soft-focus day — dreamy, permeable, a bit unmoored. Schedule the creative work there and the spreadsheets elsewhere.",
    longArc: "Neptune's transits run for years and dissolve rather than build — a long season where an old certainty quietly stops being true. Confusing in the middle, and usually a genuine refinement of what you believe by the end.",
  },
  Pluto: {
    adjective: "plutonian",
    undertone: "a plutonian undertone — intensity, depth, an all-or-nothing pull",
    feelsLike: "Plutonian time runs deep and slightly obsessive: surface conversation feels unbearable, real conversation feels urgent. Power dynamics get visible. Good for research, therapy-grade honesty, and finishing what needs to die.",
    shadow: "Its edge is obsession and control — the grudge replayed, the power struggle nobody wins, intensity aimed at people instead of projects.",
    useIt: "Go deep on one thing. Purge, investigate, compost, have the real conversation.",
    weeklyNote: "The Moon's weekly contact with Pluto makes a day with undertow — feelings pull harder and older than the situation deserves. Knowing that is most of the protection.",
    longArc: "Pluto moves so slowly its transits define eras — multi-year transformations where something structural in a life is dismantled and rebuilt. You don't schedule Pluto; you cooperate with it.",
  },
};

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
    practice: "Read your long weather at the top of Aims, and visit Houses in Star Base to see which arenas are lit up right now.",
  },
  {
    n: 6,
    title: "Choosing moments",
    essence: "Timing as craft: begin things when the sky agrees.",
    body: "Electional astrology is picking the moment on purpose — launch on a rising tide in a supportive sign, avoid the void Moon for beginnings, put the hard conversation on a day with ease rather than friction. Everything from rungs 1–5 becomes an instrument panel.",
    practice: "Use When to weave your week and to pick a good moment to begin something that matters. Check what the Planner chose and see if you can read why.",
  },
];
