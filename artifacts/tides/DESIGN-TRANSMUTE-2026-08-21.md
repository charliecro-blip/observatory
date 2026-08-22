# Saying how you feel, and turning it — a design

2026-08-21. Owner: "a compass element where people might explain a bit of
how they're feeling, and then the app could relate that to something going
on in the sky and offer suggestions for transmuting it."

Thinking, not a build. Copy here is draft and goes through `no-ai-slop`
when it ships.

---

## 1. Two findings that change the shape of this

**Half of it is already written and rendered nowhere.**
`artifacts/tides/src/lib/alternatives.ts` holds a complete table: seven
planets × three capacities (`depleted` / `restless` / `social`) × two
registers (day, wind-down), plus a void-of-course variant — "if you're
running on empty · the smallest dull task, done properly", "if you need to
move · decisive tidying, movement, no adrenaline". It has a 120-line test
file and **no consumer in any component**. The "how are you feeling → what
suits" mapping exists; nothing asks the question.

`PLANET_ROADS` in synthesis.ts is the other half, and it is already the
alchemical triple:

    gift    ease, and warmth toward people
    shadow  smoothing it over instead of saying the hard thing
    work    have the pleasant thing, then say the true thing — in that order

`work` is the transmutation, written for all seven planets, and it reaches
the interface today in exactly one place (the out-of-sect malefic line).

**There is no crisis-language handling anywhere in the app.** Grepped: zero
matches for self-harm, suicide, crisis, hotline, 988. Every other feature
takes tasks and dates as input, so it has never mattered. A feature whose
whole premise is "tell me how you feel" is where it starts mattering, and
it is the first thing to build, not the last.

## 2. What the thing actually is

Someone types *"irritable, can't settle, snapping at people."* The app
does four things in order:

1. **Mirror** — read the words into a planet, using the deterministic
   keyword table (`associateDeterministic`), no model required.
2. **Check** — ask whether that planet is *doing anything right now*: a
   live transit to the natal chart, a hard aspect, the hour, the sect
   malefic, one of the qualifiers. This is the step that makes it honest.
3. **Name** — if it is live, say the configuration literally, and say that
   its shadow is what was just described. If it is not live, say so.
4. **Turn** — offer `work`, the same energy pointed somewhere it can go,
   plus one or two concrete fits from `alternatives.ts` for the capacity.

The claim is never causal. Not "Mars is making you angry" — **"what you
named has the shape of Mars, and Mars is live right now."** Resonance,
stated as resonance. That grammar is the whole safety of the feature and
it should be enforced by a test, the way the rhythm copy is.

## 3. The refusal is the feature

The obvious version of this always finds something, because the sky is
large and a determined reader can map any feeling onto any hour. Every
horoscope app works this way and it is why none of them can be trusted.

Compass already refuses elsewhere — an empty day is a valid answer, gaps
are output with reasons — and this is the same move:

> You said: flat, nothing much matters.
>
> That has the shape of Saturn, or of Neptune.
> Neither is touching your chart today, and the sky is quiet.
>
> Nothing up there matches what you named, which doesn't make it less
> real. The Log will hold it if you want the record.

A person who gets that answer twice and a true answer once will trust the
true one. A person who always gets an answer learns the app is a mirror
that only flatters.

Rough shape of how often it should fire: a feeling maps to one or two
planets; a planet is "live" if it appears in the moment's testimonies or
qualifiers. On a typical day that is four or five bodies out of ten, so
roughly half of entries should find something — and that ratio is worth
measuring the way the subject threshold was, rather than assumed.

## 4. The answer, drafted

    You said  irritable, can't settle, snapping at people

    That has the shape of Mars.
    Mars is live: square your Moon, 1.2°, applying.

    what it is      the short fuse, the rush
    what it's made of   nerve, and the will to finish
    how to turn it  spend the edge on something physical with an end,
                    before it finds a person

    → a hard 30 minutes  · the task you've been avoiding  · say the true
      thing kindly, then leave it

    Was that close?   yes · not quite · no

Three notes on that shape:

- **"what it is / what it's made of / how to turn it"** is the alchemical
  reading of gift/shadow/work, and it says the shadow and the gift are the
  same material. That is the actual claim of transmutation, and the data
  already encodes it.
- **The examples come from the capacity table**, keyed to the person's own
  wake/sleep clock — so it will not propose a hard 30 minutes at 11pm.
  That bug is already fixed in `alternatives.ts`; it just needs a caller.
- **"Was that close?"** makes it falsifiable, and feeds §6.

## 5. Where it lives

Ask already has three doors — Orient (the long), This moment (now), Timing
(ahead). This is a fourth: **how I'm feeling**. It belongs there because
Ask is the surface a person opens when they want help rather than a
report, and because the three existing doors are all about work.

The record belongs in the Log, beside the felt rating and the diary — and
a diary entry is the natural place for "I felt X, the sky said Y, here is
what I did." The two features are one loop.

## 6. What the record buys

Each entry stores: the words, the planet proposed, whether it was live,
and the person's yes / not quite / no. After a few dozen:

> When you write "scattered", it has read Mercury seven times out of nine,
> and you agreed six of those.

That is a **personal correspondence table**, built from the person's own
language rather than from a book — and it is the same prior/posterior
architecture as the working rhythm: the app proposes, the record decides.
It is also the most defensible research the app could produce, because
every claim is one the person has already graded.

## 7. Risks, and what each one costs

| Risk | Guard |
|---|---|
| **Crisis language** gets an astrology answer | A hard gate before anything else: matched language returns support resources and no reading, ever. Build first. Never a "reading" with a footnote. |
| Determinism creep ("Mars is making you angry") | The grammar is fixed and tested: "has the shape of", "is live", never "because". |
| Always finds something | The live-check, and a refusal that is a first-class answer with its own design. |
| Becomes a mood tracker | The record is opt-in per entry; nothing is charted unless asked for. The Log already has an on/off. |
| Needs the model to work | The deterministic keyword path is the primary; the model, if used at all, only sharpens the mirror. The astrology never needs a key. |
| Reads as therapy | It offers a *use for the energy*, never an interpretation of the person. The `work` lines are all physical, small and bounded, which is the right register. |

## 8. Naming

The owner's word is **transmute**. The worldbook is navigational rather
than alchemical, so the two vocabularies will meet here for the first
time. Options, in order of how much they commit:

- **"Turn it"** — plain, verb-first, no glossary, sits beside "Orient",
  "This moment", "Timing" without breaking the set.
- **"What's this made of"** — the alchemical question in layer-1 words,
  and the honest one.
- **"The alembic"** — the true name for the vessel; beautiful, and fails
  the stranger test outright.

"Turn it" for the door, and the alchemy in the three row labels, is the
version that adds no glossary and still says what it means.

## 9. Build order, if it goes ahead

1. The crisis gate, with a test, before any of the rest.
2. `feelingReading(text, moment)` on the server: mirror → live-check →
   roads → refusal. Deterministic, no model.
3. Wire `alternatives.ts` to its first consumer in five years of it
   existing.
4. The Ask door and the answer card.
5. The record, and the personal correspondence table once there is enough
   of it to say anything.

Steps 1–4 are a day. Step 5 waits for beta testers, like the rhythm record.

## 10. Open questions for the owner

- Should a "not quite" ask *which* planet it was, and let the person
  correct it? That makes the correspondence table much better, and adds a
  step to a flow whose whole virtue is being quick.
- Does the refusal offer anything else, or is "nothing matches, and that's
  not nothing" the whole answer?
- Does this ever go the other way — the app noticing a live configuration
  and asking "does this match how you feel?" That is a notification, and
  notifications about feelings are a different product with a different
  risk profile.

---

## 11. What shipped, 2026-08-22

Steps 1–4 of §9. Step 5 (the record and the personal correspondence table)
still waits for testers, as planned.

| | |
|---|---|
| `artifacts/api-server/src/lib/crisisGate.ts` | The gate. Deterministic, no model, no key. |
| `artifacts/api-server/src/lib/feelingReading.ts` | gate → mirror → check → turn. |
| `artifacts/api-server/src/routes/feeling.ts` | Its own file so nothing here can be made to write to the db. |
| `lib/lexicon/src/planets.ts` | New `feelings: string[]` per planet. |
| `artifacts/tides/src/components/TurnIt.tsx` | The composer and the three cards. |
| `tests/crisis-gate.test.ts`, `tests/feeling-reading.test.ts` | 77 tests, green under all three CI zones. |

### The mirror needed its own vocabulary

`associate.ts` is built for tasks. Asked what "irritable, can't settle,
snapping at people" is, it answered **Saturn and Pluto** — its keyword tables
have no word for how anything *feels*. Each planet's literacy does, so the
lexicon now carries the words people use for that planet's weather in
themselves, and the same sentence reads as Mars.

### The live-check, and what measuring found

Two defects that reading the code would not have surfaced:

- **Mars fired on 365 days out of 365.** The malefic out of sect is Mars every
  daytime — a permanent condition of the chart of the day, not evidence about
  this afternoon. It joins `moonSign` and `phase` in the exclusion.
- **Uranus and Pluto fired on 0 days out of 365.** `collectPersonal` keeps the
  loudest four transits, and outer planets carry salience 0.45 against the
  Moon's 0.85, so they never survived. Right for a day card; wrong for someone
  asking about the chapter. `personalLimit` now lets a caller raise it.

An absolute strength floor turned out to be the wrong instrument (p25 0.51,
p50 0.65, p75 0.83 — continuous, no natural break). The test is relative
instead: is this planet one of the moment's loud voices. That needed **three
pools**, because one ladder silenced the outers again — they came last on every
day at top-3, top-4 and top-5 alike. The pools are synthesis's own salience
tiers, which already are the claim that these speeds aren't comparable.

At **3 fast / 1 social / 2 outer**:

| | speaks | of those, a season |
|---|---|---|
| with a chart | **52%** | — |
| without one | **35%** | — |
| Moon | 92% | |
| Venus | 65% | |
| Saturn | 65% | 100% |
| Neptune | 89% | 100% |
| Uranus | 35% | 100% |
| Pluto | 11% | 100% |

Pluto is *in play* for this chart on 11% of days and heard on all of it —
each planet's rate now matches how often it actually aspects the chart, which
is the honest answer rather than a tuned one.

**Do not raise this rate.** A door that speaks four times in five is the
horoscope app this was designed not to be.

### Answered from §10

- **Does the refusal offer anything else?** No. It gets a designed card with
  the same weight as an answer, and three reasons depending on why: the planet
  is quiet, the planet is doing nothing, or the words land on nothing.
- **Does it ever run as a notification?** Not built. Still a different product
  with a different risk profile.
- **Does "not quite" let people correct the planet?** Still open — it belongs
  with the record in step 5.

### Two calls made while building

- **Not in the advisor panel.** The other three doors send a question to the
  model; this one never does. Rendered there, its composer stacked directly
  above the advisor's own — two fields, no visual difference, and typing
  "restless" into the wrong one silently got you a different kind of answer.
- **The footer went.** "A resemblance between what you named and what the sky
  is doing, not a cause of it" was a caption saying what the card isn't. The
  headline's grammar already carries it.
