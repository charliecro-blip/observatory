# The multiplicity reframe

*Owner, 2026-08-02, arrived at from five directions in one sitting. Written
down before building, because it changes the hero, the week/month charts, the
activity vocabulary, and what a Guiding Star is for. Specced here; only the
Star intake is built so far.*

---

## The claim

Compass is not primarily about **how much** energy a moment has. It is about
**which qualities are present**, and matching those to activities — or, more
often, to *approaches* to activities you were going to do anyway.

> "rather than speaking about what the overarching quality is, how active it
> is, i think this app is more about matching different qualities of energies
> of any given moment to different activities — or ways of going about
> activities (approaches, rather than changing the task itself)."

Crucially, this is **not** a request for a scoreboard:

> "the multiplicity reframe is more about showing which one is front and
> centre at any given moment, rather than showing multiple scores"

One quality named at a time. It changes through the day. That is the shape.

---

## Why this is the diagnosis for five separate complaints

Every one of these was reported independently, and all are the same collapse —
a plural moment squeezed into one scalar:

| Symptom | What the scalar did |
|---|---|
| *"What is the cycle?"* — unanswerable | `level` is band × trend, never a phase angle. A single number needs a wave drawn under it to look like anything. |
| Hero graph needing a disclaimer | If a visual has to be captioned "not a graph of the day", the visual is wrong. |
| *"Does the tide really drop off so dramatically?"* | It does — because height is ~60% lunar illumination. **Measured: Aug 2 h=0.68 / phase=0.85 → Aug 12 h=0.28 / phase=0.00.** |
| The week reading as dead | Over that same stretch `standing` (background aspect activity) climbs **0.63 → 1.00**. The chart shows its smallest bars during the month's busiest aspect period. |
| *"Train hard"* at 21:20 | One quality (Mars) with no sense that Mars-at-night wants a different approach than Mars-at-9am. |

A new moon is not low energy. It is **differently qualified**. The scalar can
only say *less* when the true statement is *other*.

---

## What the dominant quality is made of

Not only elements:

> "the dominant quality is also connected to the prevailing non-lunar aspects,
> too, which aren't necessarily elemental"

So the input is at least:
- the Moon by **sign** (elemental colour) and by **aspect** (what it's touching)
- the **planetary hour**
- **prevailing non-lunar aspects** — the standing configuration, which today is
  computed (`standingH`) and then almost entirely wasted at weight 0.05
- **VOC** state

`standing` already rising to 1.00 while the tide bar shrinks is the clearest
evidence that the current weighting has this backwards.

---

## Convergence is the exception, not the format

> "finding multiple testimonies that show a great convergence for something is
> awesome — but that isn't often going to be the case, and showing multiple
> different options for different activities/approaches at different moments
> can be great."

So the surface should support two modes honestly:

- **Convergence** — several testimonies agree. Rare. Say so loudly when it
  happens; that is the app at its best.
- **Ordinary** — no single answer. Offer a few *different* options for
  different approaches, without ranking them into a false winner.

This resolves the tension with the deterministic "Strongest fit": that stays
for *what to act on now*, but it should be allowed to say "these three suit
this moment differently" rather than always manufacturing a single top pick.

---

## Language must be filtered by condition

> "the language used to present different options could be filtered according
> to voc status and the placement of the moon/planets by sign and aspect"

Concretely: the same underlying activity should be *described differently*
depending on conditions.

- **VOC** → finishing, revising, returning, tidying. Never "begin", "launch",
  "start".
- **Moon by sign** → the register (Aries: direct, brief, physical; Pisces:
  unhurried, imaginative, forgiving).
- **Hard aspect present** → name the friction rather than selling ease.
- **Time of day vs. the user's own rhythm** → Mars at 21:20 is not a workout;
  it is the hard conversation, the decisive tidy, cutting something loose.

This is a vocabulary layer over `PLANET_ACTIVITIES`, which today is a flat
planet→verbs map with no awareness of hour, sign, aspect, or VOC.

---

## What this implies, screen by screen

**Hero.** Retire the fake cycle curve. Lead with the dominant quality *named*,
plus what it favours as an approach. The tide character can remain as
supporting context; it should stop being the headline number.

**Week / month bars.** Stop drawing one height per day. Either colour by the
day's dominant quality with height reserved for genuine convergence, or drop
height entirely in favour of quality bands. A waning week should read
"consolidating", not "empty".

**Strongest fit.** Keep the deterministic pick, but allow an "or" — two or
three approaches suited to the moment when nothing converges.

**Activity vocabulary.** Condition-filtered as above. This is the fix for
"train hard at 21:20".

**Guiding Stars.** ✅ *Done.* Examples now span make / build / body / restore /
people / home, because if every star is fire or air, half the sky has nothing
to land on.

---

## Risks worth holding

1. **Four numbers instead of one.** The owner has already ruled this out —
   dominant quality, not a scoreboard — but it is the obvious failure mode and
   the design should keep refusing it.
2. **Losing legibility.** "Surge Tide, HIGH" is instantly readable. Whatever
   replaces it must be as fast to read, or the reframe costs more than it
   gains.
3. **Weight rebalancing is a real astrological decision.** Lowering phase from
   0.50 and raising `standing` from 0.05 changes every reading the app has ever
   given. It should be done deliberately, measured against real days, and
   probably reviewed by the owner as the practitioner — not tuned until the
   chart looks nicer.

---

## Status

Built: Guiding Star intake breadth.
Specced, not built: everything else above.
Nothing here has been half-implemented — the hero and charts are untouched
pending a decision on where to start.
