/**
 * Sprint ideas — GENERATED, do not edit by hand.
 *
 * Source: knowledge/astrolyrica-sprints/{sprints,sprint_pairs}.yaml
 * Regenerate: python3 scripts/gen-sprint-ideas.py
 *
 * Two layers, written by Astrolyrica against the brief in
 * ASTROLYRICA-COPY-HANDOFF.md. SPRINT_PAIRS is the specific one — transiting
 * planet x aspect x target, so Mars square Saturn (the deferred grind) reads
 * unlike Mars square Neptune (discipline against fog). SPRINT_MODES is the
 * generic fallback by shape alone. Resolve the pair first, then the mode.
 *
 * `avoid` rides along deliberately: it is what the copy must never become,
 * and keeping it next to the ideas is what stops a later edit reintroducing
 * streak framing or an ultimatum from the sky.
 */

export interface SprintIdea { ideas: string[]; avoid: string[] }
export interface SprintMode extends SprintIdea { push: string; register: string }

/** `${TransitingPlanet}|${aspect}` */
export const SPRINT_MODES: Record<string, SprintMode> = {
  "Sun|conjunction": {
    "push": "a showing-up push",
    "register": "a showing-up push — the two fold into one — a fresh start with the fuse lit",
    "ideas": [
      "post one thing you made, daily",
      "put your name on one thing a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "visibility mistaken for the work"
    ]
  },
  "Sun|sextile": {
    "push": "a showing-up push",
    "register": "a showing-up push — an opening, low-friction — a light run at it if you reach",
    "ideas": [
      "share one small win a day",
      "let one person see the work each day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "visibility mistaken for the work"
    ]
  },
  "Sun|square": {
    "push": "a showing-up push",
    "register": "a showing-up push — the effortful version, the one that needs teeth",
    "ideas": [
      "do the visible thing you've been avoiding, daily",
      "speak up once a day where you'd usually stay quiet"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "visibility mistaken for the work"
    ]
  },
  "Sun|trine": {
    "push": "a showing-up push",
    "register": "a showing-up push — the pleasant, repeatable version — it flows",
    "ideas": [
      "ten minutes of your own creative work, daily",
      "one thing a day done purely because it's yours"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "visibility mistaken for the work"
    ]
  },
  "Sun|opposition": {
    "push": "a showing-up push",
    "register": "a showing-up push — the one that needs another person, or a reckoning",
    "ideas": [
      "one honest ask a day for the thing you want",
      "show the work to someone who'll be straight with you, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "visibility mistaken for the work"
    ]
  },
  "Mercury|conjunction": {
    "push": "a writing or outreach push",
    "register": "a writing or outreach push — the two fold into one — a fresh start with the fuse lit",
    "ideas": [
      "morning pages, daily",
      "one new outreach message a day",
      "two hundred words a day on the thing"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "words mistaken for the deed"
    ]
  },
  "Mercury|sextile": {
    "push": "a writing or outreach push",
    "register": "a writing or outreach push — an opening, low-friction — a light run at it if you reach",
    "ideas": [
      "clear one dodged reply a day",
      "one small learning session a day",
      "send one thinking-of-you note a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "words mistaken for the deed"
    ]
  },
  "Mercury|square": {
    "push": "a writing or outreach push",
    "register": "a writing or outreach push — the effortful version, the one that needs teeth",
    "ideas": [
      "draft the hard message and send it, daily until the backlog's gone",
      "the difficult email first, each morning"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "words mistaken for the deed"
    ]
  },
  "Mercury|trine": {
    "push": "a writing or outreach push",
    "register": "a writing or outreach push — the pleasant, repeatable version — it flows",
    "ideas": [
      "read twenty pages a day",
      "one note a day on what you learned",
      "tidy one thread of the inbox a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "words mistaken for the deed"
    ]
  },
  "Mercury|opposition": {
    "push": "a writing or outreach push",
    "register": "a writing or outreach push — the one that needs another person, or a reckoning",
    "ideas": [
      "one hard conversation this week, prepared",
      "return the call you've been avoiding"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "words mistaken for the deed"
    ]
  },
  "Venus|conjunction": {
    "push": "a warmth-and-taste push",
    "register": "a warmth-and-taste push — the two fold into one — a fresh start with the fuse lit",
    "ideas": [
      "reach out to one person a day",
      "make one thing nicer a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "performing warmth instead of offering it"
    ]
  },
  "Venus|sextile": {
    "push": "a warmth-and-taste push",
    "register": "a warmth-and-taste push — an opening, low-friction — a light run at it if you reach",
    "ideas": [
      "one specific compliment a day",
      "tend one friendship a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "performing warmth instead of offering it"
    ]
  },
  "Venus|square": {
    "push": "a warmth-and-taste push",
    "register": "a warmth-and-taste push — the effortful version, the one that needs teeth",
    "ideas": [
      "one repair a day — the reconciliation you've dodged",
      "spend on the thing that lasts, not the quick fix"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "performing warmth instead of offering it"
    ]
  },
  "Venus|trine": {
    "push": "a warmth-and-taste push",
    "register": "a warmth-and-taste push — the pleasant, repeatable version — it flows",
    "ideas": [
      "a shared meal a day",
      "ten minutes a day of something you enjoy",
      "make the space pleasant each morning"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "performing warmth instead of offering it"
    ]
  },
  "Venus|opposition": {
    "push": "a warmth-and-taste push",
    "register": "a warmth-and-taste push — the one that needs another person, or a reckoning",
    "ideas": [
      "the relationship talk you've deferred",
      "say what you actually want from someone, once"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "performing warmth instead of offering it"
    ]
  },
  "Mars|conjunction": {
    "push": "a training or courage push",
    "register": "a training or courage push — the two fold into one — a fresh start with the fuse lit",
    "ideas": [
      "a workout a day",
      "the brave first move each morning",
      "thirty minutes a day on the hard project"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "overexertion worn as virtue"
    ]
  },
  "Mars|sextile": {
    "push": "a training or courage push",
    "register": "a training or courage push — an opening, low-friction — a light run at it if you reach",
    "ideas": [
      "one small bold thing a day",
      "the direct no, once a day",
      "clear one blocked item a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "overexertion worn as virtue"
    ]
  },
  "Mars|square": {
    "push": "a training or courage push",
    "register": "a training or courage push — the effortful version, the one that needs teeth",
    "ideas": [
      "the workout you've been avoiding",
      "one hard conversation, prepared",
      "the task at the bottom of the list, daily until it's gone"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "overexertion worn as virtue"
    ]
  },
  "Mars|trine": {
    "push": "a training or courage push",
    "register": "a training or courage push — the pleasant, repeatable version — it flows",
    "ideas": [
      "a daily walk or run you enjoy",
      "move the body twenty minutes a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "overexertion worn as virtue"
    ]
  },
  "Mars|opposition": {
    "push": "a training or courage push",
    "register": "a training or courage push — the one that needs another person, or a reckoning",
    "ideas": [
      "the confrontation you've been dodging",
      "set one boundary out loud a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "overexertion worn as virtue"
    ]
  },
  "Jupiter|conjunction": {
    "push": "a reach-wider push",
    "register": "a reach-wider push — the two fold into one — a fresh start with the fuse lit",
    "ideas": [
      "apply for one bigger thing a day",
      "one generous offer a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Jupiter|sextile": {
    "push": "a reach-wider push",
    "register": "a reach-wider push — an opening, low-friction — a light run at it if you reach",
    "ideas": [
      "make one introduction a day",
      "teach one thing you know, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Jupiter|square": {
    "push": "a reach-wider push",
    "register": "a reach-wider push — the effortful version, the one that needs teeth",
    "ideas": [
      "make one bigger-than-comfortable ask a day",
      "an hour a day on the growth thing that needs discipline"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Jupiter|trine": {
    "push": "a reach-wider push",
    "register": "a reach-wider push — the pleasant, repeatable version — it flows",
    "ideas": [
      "read something that widens the frame, daily",
      "name one thing you're glad about, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Jupiter|opposition": {
    "push": "a reach-wider push",
    "register": "a reach-wider push — the one that needs another person, or a reckoning",
    "ideas": [
      "the big ask to one person this week",
      "back someone else's bigger idea, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  }
};

/** `${TransitingPlanet}|${aspect}|${TargetPlanet}` */
export const SPRINT_PAIRS: Record<string, SprintIdea> = {
  "Mars|conjunction|Saturn": {
    "ideas": [
      "start the disciplined push — one bounded block a day on the hard structural task"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mars|sextile|Saturn": {
    "ideas": [
      "one unglamorous task cleared a day, if you reach for it"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mars|square|Saturn": {
    "ideas": [
      "the grind you've deferred — one hard bounded hour a day until it's done",
      "the workout on a strict schedule, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mars|trine|Saturn": {
    "ideas": [
      "a steady, repeatable discipline — same time each day, low drama"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mars|opposition|Saturn": {
    "ideas": [
      "meet the wall head-on — the deadline or the authority you've been avoiding",
      "the boundary you've dodged, set once"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mars|conjunction|Pluto": {
    "ideas": [
      "start the deep purge — clear one buried thing a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "intensity mistaken for progress"
    ]
  },
  "Mars|sextile|Pluto": {
    "ideas": [
      "one small act of letting-go a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "intensity mistaken for progress"
    ]
  },
  "Mars|square|Pluto": {
    "ideas": [
      "the hard elimination — cut one thing loose a day, no negotiation",
      "the buried task dragged into daylight, an hour a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "intensity mistaken for progress"
    ]
  },
  "Mars|trine|Pluto": {
    "ideas": [
      "a deep, steady practice — the same descent each day, sustainably"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "intensity mistaken for progress"
    ]
  },
  "Mars|opposition|Pluto": {
    "ideas": [
      "the power struggle named and faced",
      "the thing you've been gripping, loosened once"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "intensity mistaken for progress"
    ]
  },
  "Venus|conjunction|Saturn": {
    "ideas": [
      "start the commitment — one act of steady devotion a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Venus|sextile|Saturn": {
    "ideas": [
      "one small act of loyal care a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Venus|square|Saturn": {
    "ideas": [
      "the repair that takes discipline — show up for the hard relational work daily",
      "the pleasure earned by structure, not indulgence"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Venus|trine|Saturn": {
    "ideas": [
      "a steady, low-key devotion — the same small care each day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Venus|opposition|Saturn": {
    "ideas": [
      "the commitment conversation you've deferred",
      "say the loving hard thing to the person, once"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Venus|conjunction|Jupiter": {
    "ideas": [
      "start the generosity — one open-handed gift a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Venus|sextile|Jupiter": {
    "ideas": [
      "one small generous gesture a day",
      "invite one person in a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Venus|square|Jupiter": {
    "ideas": [
      "give from surplus not vanity — one considered generosity a day",
      "one pleasure chosen well, not five grabbed"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Venus|trine|Jupiter": {
    "ideas": [
      "the abundant, easy warmth — a shared delight a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Venus|opposition|Jupiter": {
    "ideas": [
      "the big-hearted ask to one person this week",
      "give to someone's actual need, not your image of it"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Mercury|conjunction|Saturn": {
    "ideas": [
      "start the disciplined writing — a fixed word-count a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mercury|sextile|Saturn": {
    "ideas": [
      "one careful, exact message a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mercury|square|Saturn": {
    "ideas": [
      "draft the hard exact thing daily, expecting it slow",
      "the admin backlog, one bounded session a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mercury|trine|Saturn": {
    "ideas": [
      "a steady practice — the same page each morning, no pressure"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mercury|opposition|Saturn": {
    "ideas": [
      "the hard exact conversation, prepared and written first",
      "check the work against the standard, once"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Mercury|conjunction|Neptune": {
    "ideas": [
      "start the imaginative writing — a page of unedited flow a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the vague thing left vague"
    ]
  },
  "Mercury|sextile|Neptune": {
    "ideas": [
      "let one idea wander without deciding, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the vague thing left vague"
    ]
  },
  "Mercury|square|Neptune": {
    "ideas": [
      "pull one clear sentence from the fog a day",
      "translate the vague thing into one concrete step, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the vague thing left vague"
    ]
  },
  "Mercury|trine|Neptune": {
    "ideas": [
      "the daily imaginative practice — morning pages, the dream journal"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the vague thing left vague"
    ]
  },
  "Mercury|opposition|Neptune": {
    "ideas": [
      "name the thing you've been vague about, to one person",
      "the honest sentence where you've been telling yourself a story"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the vague thing left vague"
    ]
  },
  "Sun|conjunction|Saturn": {
    "ideas": [
      "start the disciplined showing-up — the visible unglamorous work, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Sun|sextile|Saturn": {
    "ideas": [
      "show up for the thing without needing applause, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Sun|square|Saturn": {
    "ideas": [
      "do the hard visible thing you've been avoiding, daily",
      "hold the standard even when unseen, each day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Sun|trine|Saturn": {
    "ideas": [
      "a steady daily anchor — the same central act, no drama"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Sun|opposition|Saturn": {
    "ideas": [
      "the honest look at whether the work holds up",
      "the reckoning with what you're actually delivering"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Sun|conjunction|Jupiter": {
    "ideas": [
      "start the bigger visible thing — one confident move a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Sun|sextile|Jupiter": {
    "ideas": [
      "share one thing you're proud of a day",
      "back someone publicly, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Sun|square|Jupiter": {
    "ideas": [
      "make one confident ask a day, the one you've been shrinking",
      "aim a notch past comfortable, and be seen doing it"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Sun|trine|Jupiter": {
    "ideas": [
      "create and share freely, daily — the warm abundant showing-up"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Sun|opposition|Jupiter": {
    "ideas": [
      "the big visible ask to one person this week",
      "step into the larger role and let it be seen"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "reach mistaken for follow-through"
    ]
  },
  "Jupiter|conjunction|Saturn": {
    "ideas": [
      "start the structured expansion — one foundational piece of the big plan a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Jupiter|sextile|Saturn": {
    "ideas": [
      "widen the plan, then lay one brick, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Jupiter|square|Saturn": {
    "ideas": [
      "the unglamorous hour on the big thing, daily",
      "check the vision against the budget, once a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Jupiter|trine|Saturn": {
    "ideas": [
      "the steady build — the big plan advanced a little each day, sustainably"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Jupiter|opposition|Saturn": {
    "ideas": [
      "the plan meets the deadline — the honest reckoning of scope",
      "make the big commitment real with one structural promise"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "the discipline turned into self-punishment"
    ]
  },
  "Jupiter|conjunction|Uranus": {
    "ideas": [
      "start the bold experiment — try one new bigger thing a day"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "novelty for its own sake"
    ]
  },
  "Jupiter|sextile|Uranus": {
    "ideas": [
      "let the odd bigger idea have a step, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "novelty for its own sake"
    ]
  },
  "Jupiter|square|Uranus": {
    "ideas": [
      "alter one real thing on purpose a day",
      "the growth that breaks the old pattern, daily"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "novelty for its own sake"
    ]
  },
  "Jupiter|trine|Uranus": {
    "ideas": [
      "follow the new opening, daily — the exciting easy expansion"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "novelty for its own sake"
    ]
  },
  "Jupiter|opposition|Uranus": {
    "ideas": [
      "the leap you've been circling — the reckoning with the safe version",
      "name the bold change to someone who'll hold you to it"
    ],
    "avoid": [
      "streak or challenge framing (day 3 of 7, don't break it)",
      "treating the window as a command from the sky",
      "novelty for its own sake"
    ]
  }
};

/** The specific pairing when there is one, else the shape's generic ideas. */
export function sprintIdeasFor(transiting: string, aspect: string, target: string): SprintIdea | null {
  return SPRINT_PAIRS[`${transiting}|${aspect}|${target}`]
    ?? SPRINT_MODES[`${transiting}|${aspect}`]
    ?? null;
}

/** The register line for a shape — Astrolyrica's phrasing of the mode. */
export function sprintRegisterFor(transiting: string, aspect: string): string | null {
  return SPRINT_MODES[`${transiting}|${aspect}`]?.register ?? null;
}
