# Tides — Content Plan (guidebook + weekly content)

**Status:** draft outline for user/Cowork review. No prose written yet — this
is architecture, not content. The point of drafting this now rather than
writing pages directly: the guidebook and the app should teach the *same
framework*, so a reader who opens the app after chapter 3 finds the exact
vocabulary they just learned, not a second system to decode.

## The organizing principle: cyclical nesting

The app's core architecture (DESIGN.md §2) is a ladder of timescales, each
with its own native language — circadian → planetary hour → Moon sign/
element → lunation → season → personal chapters. The guidebook should be
built on the *same ladder*, because it's already a genuinely good teaching
structure: readers move from the shortest, most concrete cycle (today) to
the longest, most abstract one (their whole natal chart), gaining vocabulary
at each rung that the next rung reuses. Nobody has to learn "houses" before
they can use "the Moon feels different every few days" — the book can be
useful from page one.

## The vocabulary treaty (already ratified, DESIGN.md §16) governs the book too

Three vocabularies, one rule: **elements are yours, planets are the sky's,
the tide is the meeting.** The book should never blur these to say one thing
twice. A chapter on Mars is about "who is speaking right now" (an event);
a chapter on Fire is about "what domains make up your life" (an identity).
Keeping this distinction sharp in prose is what will make the app's UI feel
like a natural continuation rather than a re-explanation.

## Guidebook — proposed table of contents

**Part I — The Weather (short cycles, no chart required)**
1. A weather report for time — the core metaphor, why "tide" not "prediction"
2. Your day has a character — planetary hours, the seven classical voices
3. The Moon changes her mind every few days — Moon sign, the four elements as
   textures of a day (Deep/Surge/Building/Clear — reuses `lib/elements.ts`
   language directly)
4. When the sky goes quiet — void-of-course, why "nothing" is information too
5. The month has a shape — lunation, new Moon to full Moon to dark

**Part II — The Voices (planets, in depth)**
6–12. One chapter per classical planet (Sun through Saturn), each following
   the same template: essence, myth, what it favors when loud, what its
   shadow looks like, a short practice. Directly extends `lib/mythos.ts`'s
   `PLANET_MYTHOS`/`PLANET_ACTIVITIES` — the book chapters are the long-form
   version of what the app already shows in miniature.

**Part III — The Domains (houses, elements, the shape of a life)**
13. The four elements as the rooms of a life (extends `ELEMENT_MYTHOS`)
14. The twelve houses — where in your life a cycle is happening (extends
    `HOUSE_MEANINGS`/`currents-content.ts`)
15. Reading your own chart's shape — a gentle, non-fatalistic intro to natal
    placements, written under the same honesty/hedging discipline as the
    medical KB's safety floor (describes tendencies, never verdicts)

**Part IV — The Long Cycles (personal, needs a chart)**
16. Your profected year — the app's Currents feature, explained
17. Chapters — what it means when a slow planet moves through your chart for
    years at a time
18. Caution periods — the shadow side of the same engine: which archetypes
    tend to catch you, and how to see them coming (extends the app's
    self-report questionnaire concept)

**Part V — Living It**
19. Building your own rhythm — chronotype, free windows, where astrology
    should defer to your actual life
20. A week in the practice — a worked example, start to finish
21. What this isn't — the same honest-limits discipline as
    `knowledge/electional-astrology-v1/05_safety_and_limits.md`, restated for
    a general reader: this describes tempo and texture, not fate

**Appendix:** quick-reference tables (planets, signs, houses, aspects) —
directly exportable from the app's own content files, since they're already
written in the right register.

## Weekly content calendar (first 8 weeks, thematic)

Each week = one Part I/II concept, one concrete "try this" tied to a real app
feature, and one piece of correspondence table content (highly shareable,
low-effort format).

| Week | Theme | "Try this" tie-in | Shareable asset |
|---|---|---|---|
| 1 | What is a tide, really | Check your Tide chart once a day for a week, just notice | The four characters, one card each |
| 2 | The hour has a ruler | Do one task in its "right" hour this week | Planetary hour cheat sheet |
| 3 | The Moon's sign changes the texture | Notice how you feel across a full Moon-sign change | Element/Moon-sign quick guide |
| 4 | Void of course isn't a warning, it's an invitation | Deliberately schedule a "nothing" task during your next void | VOC dos/don'ts card |
| 5 | Meet the planets as voices, not judges | Pick one planet, read its chapter, notice its hour this week | One-planet spotlight |
| 6 | The elements are the rooms of your life | Guiding Stars: set one North Star per element you're missing | Element domains card |
| 7 | Your rhythm isn't the sky's rhythm | Fill out (or revisit) your chronotype — free windows, wake/sleep | "Know your own tide" worksheet |
| 8 | The long cycles (teaser for premium) | Look up your profected year in Currents | "What house year are you in?" quiz |

Weeks 9+ can extend into Part II (one planet per week, 7 weeks) then Part III
(elements/houses), reusing the same "read → try → share" shape.

## Cross-promotion mapping (book ↔ app, both directions)

- Every chapter ends with the exact app surface it maps to (e.g. ch. 4 → Sky/
  Almanac's VOC banner), so a reader becomes a user without a learning gap.
- The app's onboarding and empty states can reference the book by chapter
  number once it exists ("New here? Chapter 2 covers planetary hours in five
  minutes.") — a light, non-pushy upsell path.
- Reuse, don't fork: the book's correspondence tables should be generated
  *from* `lib/mythos.ts`/`currents-content.ts`, not hand-copied — so updates
  to the app's language propagate to the book's appendix automatically if a
  script is worth writing later.

## What's genuinely new writing (not reuse)

Being honest about the gap from the earlier audit: Parts II and III can start
from the app's existing content but need real expansion (a book chapter is
10–20x the length of `PLANET_MYTHOS.Sun.essence`). Part IV (chapters/caution
periods) has almost no existing prose to draw from — that's the thinnest
part of the current knowledge base and the best candidate for Cowork's focus
if splitting the writing work.
