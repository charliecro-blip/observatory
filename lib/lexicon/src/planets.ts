/**
 * THE PLANET LEXICON — one record per planet, one source for every surface
 * (AUDIT-EXPLAINERS-2026-08-21 §6.1, the planets' half).
 *
 * Built from the tables that used to live in five files: the client's
 * PLANET_MYTHOS / PLANET_ACTIVITIES (mythos), PLANET_CORE (sky-readings),
 * PLANET_LITERACY (sky-literacy), the rail's signification and meaning
 * lines, and the server's PLANET_THEME / PLANET_ROADS (synthesis). Those
 * names still exist where they are imported; they are views of this.
 *
 * `approach` is new: HOW work wants doing in this planet's hour — the rail's
 * base line for THIS HOUR, composed with the dignity line (condition) and
 * the moment's qualifiers. Quality register, one clause with a hinge, no
 * full stop. Through the copy pass 2026-08-21.
 *
 * Plain TypeScript with no imports, so both artifacts can import it by path.
 */
export interface PlanetEntry {
  key: string;
  glyph: string;
  /** The seven classical planets carry a voice, a hour, a theme and roads; the three outer carry literacy and meaning only. */
  classical: boolean;
  approach: string;
  meaning: string;
  literacy: { adjective: string; undertone: string; feelsLike: string; shadow: string; useIt: string; weeklyNote: string; longArc: string; etymology?: string };
  core: { name: string; is: string; short: string; use: string };
  voice?: { archetype: string; color: string; essence: string; myth: string; speaksFor: string[]; whenLoud: string };
  activities?: string[];
  signification?: string;
  theme?: { verb: string; activities: string[] };
  roads?: { gift: string; shadow: string; work: string };
}

export const PLANETS: Record<string, PlanetEntry> = {
  Sun: {
    key: "Sun", glyph: "☉︎", classical: true,
    approach: "a visible center and a decision made as yourself; the hour is for standing behind something",
    meaning: "Core identity, vitality, authority, creative expression",
    literacy: {"adjective": "solar", "undertone": "a solar undertone — visibility, vitality, the pull to be seen", "feelsLike": "Solar time feels like standing in good light: clearer sense of self, easier decisions, a wish to be witnessed. Confidence sits closer to the surface than usual.", "shadow": "Its edge is ego-friction — taking things personally, needing credit, glare. If you feel prickly about recognition today, that's the same current.", "useIt": "Lead, present, decide, be seen, and put your name on something.", "weeklyNote": "About once a week the Moon makes a hard angle to the Sun — those are the quarter moons, the little tension points of every month. Notice them: they're decision days.", "longArc": "Long solar arcs are about identity and direction — each birthday (your solar return) opens a new personal year. When slow planets aspect your natal Sun for months, the question is 'who am I becoming?'"},
    core: {"name": "Sun", "is": "your center of gravity — identity, vitality, what the day organizes around", "short": "the will to shine", "use": "visibility, leading, putting your name on it"},
    voice: {"archetype": "The Sovereign", "color": "#c08020", "essence": "Identity, vitality, and the center that everything else orbits.", "myth": "The Sun is the voice of coherence — the part of the day that asks whether your actions still orbit your actual center. When it speaks, questions of purpose, visibility, and self-respect come forward.", "speaksFor": ["purpose", "visibility", "vitality", "authority", "self-expression"], "whenLoud": "Step into the light on purpose: lead, present, decide as yourself. Vitality is available — spend it on what's actually yours."},
    activities: ["lead the meeting", "make the decision as yourself", "be seen — present, publish", "tend vitality: light, movement", "claim credit honestly", "set the week's direction"],
    signification: "Visibility, leadership, vitality: presenting yourself, making decisions, creative assertion.",
    theme: {"verb": "vitality and wholehearted action", "activities": ["decide", "creative work", "the essential task"]},
    roads: {"gift": "warmth, and the nerve to be seen", "shadow": "needing to be the centre of it", "work": "put the wanting-to-be-seen into making one thing worth seeing"},
  },
  Moon: {
    key: "Moon", glyph: "☽︎", classical: true,
    approach: "mood and care set the pace; tending comes before pushing",
    meaning: "Emotions, intuition, instinct, the body's wisdom",
    literacy: {"adjective": "lunar", "undertone": "a lunar undertone — feelings near the surface, the body asking to be tended", "feelsLike": "Lunar time is tidal: moods that move with no obvious cause, hunger for comfort and familiarity, sensitivity dialed up. The body speaks louder than the head.", "shadow": "Its edge is moodiness and clinging to the familiar — reactive feelings that feel truer than they are. Wait a few hours before believing a 3pm despair.", "useIt": "Tend, rest, cook, feel, remember: care for the body and the home.", "weeklyNote": "The Moon is the fastest teacher in the sky — it changes sign every ~2.5 days, which is why the day's whole character (Deep, Surge, Building, Clear) follows it. Learn the Moon and you've learned the app.", "longArc": "The Moon's long lessons come as the monthly cycle — new moon intentions to full moon visibility to dark moon rest. Track one full month in the Log and the shape becomes obvious."},
    core: {"name": "Moon", "is": "the feeling body — moods, needs, the inner weather", "short": "the need to feel safe", "use": "tending, resting, listening inward"},
    voice: {"archetype": "The Nurturer", "color": "#7080a0", "essence": "Feeling, habit, memory — the daily inner weather.", "myth": "The Moon is the fastest voice and the closest: the mood of the body, the pull of habit, the tide itself. When it speaks, the question is what needs tending — in you, in your home, in the people you keep.", "speaksFor": ["mood & instinct", "home", "nourishment", "habit", "the past"], "whenLoud": "Tend rather than push. Feed what keeps you alive — body, home, sleep, the people who are your ground."},
    activities: ["tend home & body", "cook for someone", "nap without guilt", "journal the mood", "call your people", "water rituals — bathe, swim"],
    signification: "Nourishment, care, routine: tending home, body, and emotional space.",
    theme: {"verb": "tending and feeling", "activities": ["rest", "tend home", "care for someone"]},
    roads: {"gift": "care, and reading the room", "shadow": "the mood running the day sideways", "work": "feel it on purpose for ten minutes, so it doesn't leak into everything"},
  },
  Mercury: {
    key: "Mercury", glyph: "☿︎", classical: true,
    approach: "things move in words and short exchanges; sorting and sending go easily",
    meaning: "Mind, communication, movement, craft, perception",
    literacy: {"adjective": "mercurial", "undertone": "a mercurial undertone — a quick, talkative, slightly scattered current", "feelsLike": "Mercurial time is fast and bright: words come easily, errands chain together, curiosity jumps between tabs. Great for anything involving language, lists, or logistics.", "shadow": "Its edge is scatter and nerves — too many threads, saying the clever thing instead of the true one, doom-scrolling as fake thinking. If your attention feels like a startled bird, that's it.", "useIt": "Write, call, sort, schedule, negotiate, learn: move information.", "weeklyNote": "Roughly once a week the Moon contacts Mercury and the day takes on this chatty, quicksilver feel. That's the day to clear the inbox and make the calls.", "longArc": "Mercury's famous long lesson is the retrograde, three weeks a few times a year: revise, resume, reread — the re- words. It's not a curse; it's an editing pass.", "etymology": "'Mercurial' — quick, changeable, animated — entered English from exactly this flavor."},
    core: {"name": "Mercury", "is": "the mind in motion — words, plans, connections", "short": "the urge to connect ideas", "use": "writing, sorting, conversation"},
    voice: {"archetype": "The Messenger", "color": "#608060", "essence": "Language, exchange, and the paths between things.", "myth": "Mercury is the voice of connection-in-motion: words, messages, routes, trades, jokes. When it speaks, information wants to move — and the quality of your day depends on how cleanly it does.", "speaksFor": ["writing & speech", "learning", "commerce", "travel & errands", "wit"], "whenLoud": "Move the words: write, send, ask, sort, name the thing precisely. Friction in communication is the day's real work."},
    activities: ["write & send", "sort & name things", "learn the skill", "run the errands", "negotiate the detail", "fix the words"],
    signification: "Communication, ideas, movement: write, pitch, learn, travel.",
    theme: {"verb": "thinking and exchanging", "activities": ["write", "sort", "learn", "run errands"]},
    roads: {"gift": "quickness, and real curiosity", "shadow": "the thought that keeps circling", "work": "write the loop down — it stops circling once it's on paper"},
  },
  Venus: {
    key: "Venus", glyph: "♀︎", classical: true,
    approach: "ease and company carry it, and the pleasant part of the work is where to start",
    meaning: "Beauty, values, pleasure, relationship, aesthetics",
    literacy: {"adjective": "venusian", "undertone": "a venusian undertone — warmth, ease, an appetite for beauty and company", "feelsLike": "Venusian time softens things: people are easier to like, food tastes better, aesthetics matter. Friction in relationships loosens; invitations land well.", "shadow": "Its edge is indulgence and conflict-avoidance — choosing pleasant over honest, buying the thing instead of feeling the feeling.", "useIt": "Connect, host, beautify, reconcile, enjoy: make the date, send the invitation, fix the room.", "weeklyNote": "About once a week the Moon touches Venus and the day carries this sweetness. Notice it — it's the natural day for the relational and aesthetic items on your list.", "longArc": "Venus retrograde (every ~18 months) famously reopens old relationships and re-questions what you value. Long Venus transits ask: what do you actually want, versus what you were told to want?"},
    core: {"name": "Venus", "is": "what draws you — pleasure, relating, worth", "short": "the pull toward beauty", "use": "relating, refining, enjoying"},
    voice: {"archetype": "The Connector", "color": "#c06090", "essence": "Attraction, beauty, and what makes life worth arranging.", "myth": "Venus is the voice of value — what you're drawn to, what you find beautiful, who you want near. When it speaks, harmony becomes available: in rooms, in relationships, in work made pleasing.", "speaksFor": ["love & friendship", "beauty & art", "pleasure", "diplomacy", "worth"], "whenLoud": "Arrange, beautify, reconcile, enjoy. Reach toward people and things you value — grace is doing half the work today."},
    activities: ["reconcile & connect", "beautify the space", "enjoy something on purpose", "tend love & friendship", "choose the pleasing option", "make it beautiful"],
    signification: "Beauty, pleasure, connection: relationship, art, sensory enjoyment.",
    theme: {"verb": "relating and refining", "activities": ["connect", "make something beautiful", "money"]},
    roads: {"gift": "ease, and warmth toward people", "shadow": "smoothing it over instead of saying the hard thing", "work": "have the pleasant thing, then say the true thing — in that order"},
  },
  Mars: {
    key: "Mars", glyph: "♂︎", classical: true,
    approach: "a clear target and a hard edge; one decisive cut, and then the stop",
    meaning: "Drive, assertion, courage, desire, physical force",
    literacy: {"adjective": "martial", "undertone": "a martial undertone — heat, drive, a shorter fuse", "feelsLike": "Martial time runs hot: more energy than patience, a push to act, cut, finish, confront. Workouts feel great; waiting rooms feel unbearable.", "shadow": "Its edge is irritability and haste — the snapped reply, the forced decision, the injury from rushing. If everyone seems annoying today, the heat is probably yours.", "useIt": "Move the body, do the hard physical task, have the direct conversation, make the clean cut you've been avoiding.", "weeklyNote": "Once a week or so the Moon makes a hard angle to Mars — a day with extra heat in it. Point it at something (exercise, decisive work) or it points itself at people.", "longArc": "Mars returns to its natal place every ~2 years — cycles of how you fight and pursue. Long Mars transits mark seasons where anger and drive both run closer to the skin.", "etymology": "'Martial' — of combat and drive — is Mars's name in English."},
    core: {"name": "Mars", "is": "the engine — drive, courage, the cutting edge", "short": "the drive to act", "use": "physical effort, decisive cuts, brave starts"},
    voice: {"archetype": "The Warrior", "color": "#c04040", "essence": "Drive, edge, and the courage to cut.", "myth": "Mars is the voice of force — the part of you that acts, defends, competes, and separates what must be separated. When it speaks, energy demands a worthy target; unaimed, it turns to friction.", "speaksFor": ["action & effort", "the body's power", "boundaries", "conflict", "decisiveness"], "whenLoud": "Give the force a job: train hard, make the cut, have the direct conversation. Aim it or it will aim itself."},
    activities: ["train hard", "make the cut", "have the direct conversation", "compete at something", "do the brave errand", "finish by force if needed"],
    signification: "Action, ignition, assertion: physical work, bold starts, decisive moves.",
    theme: {"verb": "effort and the decisive cut", "activities": ["train", "push", "the hard task"]},
    roads: {"gift": "nerve, and the will to finish", "shadow": "the short fuse, the rush", "work": "spend the edge on something physical with an end, before it finds a person"},
  },
  Jupiter: {
    key: "Jupiter", glyph: "♃︎", classical: true,
    approach: "the wider frame is available; the bigger ask and the thing you can teach both suit the hour",
    meaning: "Expansion, meaning, abundance, generosity, philosophy",
    literacy: {"adjective": "jovial", "undertone": "a jovial undertone — optimism, appetite, the sense that more is possible", "feelsLike": "Jovial time feels expansive: bigger thinking, easier generosity, luck that's mostly just increased willingness to say yes. Good for asking, launching, teaching, celebrating.", "shadow": "Its edge is excess and overpromise — the yes you can't deliver, the plan that assumes the best case everywhere. Enthusiasm is not a schedule.", "useIt": "Ask for the bigger thing, publish, pitch, teach, celebrate, zoom out to the year view.", "weeklyNote": "The Moon meets Jupiter about weekly — a day that feels lighter and more open-handed than it strictly should. A natural day for asks and launches.", "longArc": "Jupiter takes ~12 years to circle your chart — one house per year, a slow tour of where growth wants to happen. Your Jupiter return (~ages 12, 24, 36…) opens a fresh 12-year chapter of growth.", "etymology": "'Jovial' — from Jove, Jupiter — has meant good-humored abundance for five hundred years."},
    core: {"name": "Jupiter", "is": "the expander — growth, faith, the bigger frame", "short": "the urge to grow", "use": "teaching, publishing, saying yes bigger"},
    voice: {"archetype": "The Sage", "color": "#6040a0", "essence": "Growth, meaning, and the larger frame.", "myth": "Jupiter is the voice of more — more scope, more meaning, more generosity. When it speaks, doors are looser on their hinges and the question is which larger story you're willing to step into.", "speaksFor": ["opportunity", "teaching & belief", "travel & horizon", "generosity", "luck you position for"], "whenLoud": "Say yes bigger: publish, apply, invite, teach, expand the plan one honest size up."},
    activities: ["say yes bigger", "apply & publish", "teach what you know", "plan the expansion", "be generous first", "zoom out to the larger story"],
    signification: "Expansion, abundance, generosity: think big, share widely, grow.",
    theme: {"verb": "growth and the bigger frame", "activities": ["teach", "the big ask", "reach wider"]},
    roads: {"gift": "generosity, and the wider view", "shadow": "saying yes too big, skipping the detail", "work": "say yes to the size, then check the one detail you'd rather skip"},
  },
  Saturn: {
    key: "Saturn", glyph: "♄︎", classical: true,
    approach: "structure and the unglamorous step; committing, pruning and finishing are what the hour is for",
    meaning: "Structure, discipline, time, responsibility, limits",
    literacy: {"adjective": "saturnine", "undertone": "a saturnine undertone — gravity, focus, maybe a little heaviness", "feelsLike": "Saturnine time has weight: fewer illusions, more clarity about what's actually required. Quiet, structured, unglamorous work goes unusually well. Solitude feels right rather than lonely.", "shadow": "Its edge is heaviness — pessimism, self-criticism, the sense that everything is a test you're failing. A saturnine day can genuinely feel depressive. That's the flavor, not the truth; it passes within a day.", "useIt": "Do the disciplined thing: the budget, the edit, the maintenance, the boundary. Saturn days convert effort into structure better than any other.", "weeklyNote": "Most weeks have one saturnine day — when the Moon makes a hard angle to Saturn. Learn to spot yours: heavy morning, good focus, low small-talk tolerance. Check the Log after a few weeks and you'll see the pattern.", "longArc": "Saturn is the great teacher of the long game: ~29 years to circle your chart. Its return (~29, ~58) is the famous growing-up threshold. Multi-month Saturn transits are seasons of pruning and consolidation — heavy while they last, and usually what you're proudest of afterward.", "etymology": "'Saturnine' — grave, gloomy, serious — is centuries of people feeling exactly this day."},
    core: {"name": "Saturn", "is": "the builder — limits, time, what must be earned", "short": "the need for structure", "use": "committing, pruning, doing the unglamorous work"},
    voice: {"archetype": "The Builder", "color": "#807060", "essence": "Structure, time, and the dignity of limits.", "myth": "Saturn is the slowest classical voice and the most honest: it speaks for what holds when enthusiasm doesn't. When it's loud, the day rewards discipline, pruning, and promises kept — and quietly taxes everything else.", "speaksFor": ["commitment", "structure", "boundaries in time", "mastery", "consequence"], "whenLoud": "Do the unglamorous right thing: keep the commitment, cut the excess, build the part no one sees. It compounds."},
    activities: ["keep the commitment", "prune & cancel", "do the boring foundation", "review the long game", "pay the debt", "build the part no one sees"],
    signification: "Structure, focus, consolidation: slow down, commit, build foundations.",
    theme: {"verb": "structure and the unglamorous right thing", "activities": ["finish", "commit", "prune"]},
    roads: {"gift": "patience, and the long haul", "shadow": "the gloom, the stiffening, the fear", "work": "do the smallest real piece — it lifts by moving, not by solving"},
  },
  Uranus: {
    key: "Uranus", glyph: "♅︎", classical: false,
    approach: "the stuck thing wants unsticking; an experiment suits it better than a plan",
    meaning: "Liberation, disruption, innovation, awakening",
    literacy: {"adjective": "uranian", "undertone": "a uranian undertone — restlessness, static, the urge to break pattern", "feelsLike": "Uranian time is electric: sudden insights, itchiness inside routines, surprises in the schedule. Genuinely good for experiments and unsticking stuck things.", "shadow": "Its edge is disruption for its own sake — the impulsive quit, the 2am reinvention, anxiety wearing the costume of excitement.", "useIt": "Experiment, automate, rearrange, question a default, and give the restlessness a sandbox.", "weeklyNote": "When the Moon contacts Uranus (about weekly), days go a little static-charged — plans wobble, insights arrive sideways. Loosen the schedule that day rather than gripping it.", "longArc": "Uranus takes 84 years to circle the chart — its transits mark the awakening seasons, a year or more where one area of life refuses to stay in its old container. The mid-life 'Uranus opposition' (~age 42) is the classic one."},
    core: {"name": "Uranus", "is": "the awakener — disruption, freedom, the sudden turn", "short": "the urge to break free", "use": "experiments, reversals, updating what's stale"},
  },
  Neptune: {
    key: "Neptune", glyph: "♆︎", classical: false,
    approach: "edges soften and estimates blur; the creative and the restful suit it, the contract does not",
    meaning: "Imagination, dissolution, spirituality, the subtle",
    literacy: {"adjective": "neptunian", "undertone": "a neptunian undertone — fog, porousness, imagination running high", "feelsLike": "Neptunian time blurs edges: daydreams are vivid, empathy is high, music and images land deeper than words. Wonderful for creative and spiritual work; unreliable for contracts and estimates.", "shadow": "Its edge is fog — idealizing people, losing hours, escapism, being lied to easily (mostly by yourself). Don't sign anything important in the fog.", "useIt": "Create, meditate, listen to music, rest without a goal, let the imagination off-leash.", "weeklyNote": "The Moon's weekly touch on Neptune makes a soft-focus day — dreamy, permeable, a bit unmoored. Schedule the creative work there and the spreadsheets elsewhere.", "longArc": "Neptune's transits run for years and dissolve rather than build — a long season where an old certainty quietly stops being true. Confusing in the middle, and usually a genuine refinement of what you believe by the end."},
    core: {"name": "Neptune", "is": "the dissolver — imagination, longing, the soft focus", "short": "the pull toward the ideal", "use": "art, compassion, letting edges blur"},
  },
  Pluto: {
    key: "Pluto", glyph: "⯓︎", classical: false,
    approach: "one thing, taken to the root; the real conversation suits it and the small talk does not",
    meaning: "Transformation, power, depth, endings, regeneration",
    literacy: {"adjective": "plutonian", "undertone": "a plutonian undertone — intensity, depth, an all-or-nothing pull", "feelsLike": "Plutonian time runs deep and slightly obsessive: surface conversation feels unbearable, real conversation feels urgent. Power dynamics get visible. Good for research, therapy-grade honesty, and finishing what needs to die.", "shadow": "Its edge is obsession and control — the grudge replayed, the power struggle nobody wins, intensity aimed at people instead of projects.", "useIt": "Go deep on one thing: purge, investigate, compost, have the real conversation.", "weeklyNote": "The Moon's weekly contact with Pluto makes a day with undertow — feelings pull harder and older than the situation deserves. Knowing that is most of the protection.", "longArc": "Pluto moves so slowly its transits define eras — multi-year transformations where something structural in a life is dismantled and rebuilt. You don't schedule Pluto; you cooperate with it."},
    core: {"name": "Pluto", "is": "the transformer — power, depth, what must die to grow", "short": "the pressure to transform", "use": "deep work, endings, telling the whole truth"},
  },
};

export const PLANET_ORDER = Object.keys(PLANETS);
export const CLASSICAL = PLANET_ORDER.filter(k => PLANETS[k].classical);
