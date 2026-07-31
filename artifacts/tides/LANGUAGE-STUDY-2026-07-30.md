# The voice study — 2026-07-30

*Owner's thinking, captured from the plane, plus analysis. Complements
`LANGUAGE-WORKSHOP.md` (which settled **what to call the thing** — tide/weather)
and `EMAIL-REPORTS.md` (which set the voice rules for one surface). This one is
about **who is speaking, and how that changes.***

Marked throughout: **[owner]** is Charlie's, **[analysis]** is mine, **[open]**
needs a decision.

---

## 1. The target register

**[owner]** *"Co-Star's quintessential permissive snark. A mix of that and,
like, genuine striving — a bit starry-eyed, but also precise, specific,
measured. Eloquence."*

**[analysis] Why this is harder than it sounds, and where it breaks.**

Co-Star's snark works *because the app does not care about you*. "Your ego is
writing cheques your Saturn can't cash" lands as a joke precisely because
there's no relationship behind it — it's a fortune cookie with an attitude, and
the reader knows it. The distance is the license.

Compass has spent every design decision destroying that distance. It refuses to
schedule things. It asks how the day felt and remembers the answer. It tells you
when the month isn't built for your aim. **You cannot borrow the snark of an app
that doesn't care while being an app that demonstrably does** — the same
sentence that reads as wit from a stranger reads as contempt from a friend who
knows you're struggling.

The resolution is not to drop the snark. It's to **aim it**:

> **Snark at the situation. Never at the reader.**

- ✅ *"Mercury turns retrograde Thursday. Everyone will have opinions about
  this. Most of them will be about their own week."*
- ✅ *"The Moon goes void at 2. Nothing you start in that window will mean what
  you meant by it."*
- ❌ *"You've moved this task four times. At some point that's an answer."*
  — true, observed, and cruel. This is the line Co-Star crosses happily and we
  cannot.

The second half of the brief is the harder discipline and the one that keeps us
honest: **precise, specific, measured**. Co-Star is none of those — it's
gnomic, and gnomic is cheap because it can't be wrong. Every line Compass writes
should be falsifiable. *"A slow, compelling pressure to transform"* is Co-Star
register. *"Uranus sits on your natal Mercury Wednesday — restlessness in how
you think and speak"* is ours: it names the body, the date, and the domain, and
you can tell us it was wrong.

**The register, stated as a rule:**

> Specific enough to be wrong. Warm enough to be trusted. Dry enough not to
> flatter. Never at the reader's expense.

**[analysis] "Eloquence" deserves its own note.** The one place the app should
be allowed to be beautiful is where it is describing *conditions* — the sky,
the season, the shape of a month. The one place it must never be beautiful is
where it is telling you something you have to act on. Lyric in the weather,
plain in the instruction. That split also happens to be the honest one: we can
be evocative about the thing we actually know (the sky) and must be plain about
the thing we're inferring (what you should do).

---

## 2. Tone that moves with the sky

**[owner]** *"A tone that might shift according to the astrological seasons —
where Jupiter and Saturn are, Mars and the Sun, for example. Or maybe Mercury
and Venus."*

**[analysis] Yes — but only the slow ones, and this distinction is the whole
design.**

A voice that changes daily is not a voice. It's noise, and it reads as
instability rather than responsiveness. The reader needs to recognise who is
talking to them; that recognition is most of what trust is made of.

So: **the slow planets set the register, the fast planets set the content.**

| Signal | Speed | What it may touch |
|---|---|---|
| **Jupiter by sign** | ~1 year | The season's *expansiveness*. Jupiter in Gemini: more asides, more possibility, longer sentences. Jupiter in Virgo: more useful, more specific, less flourish. |
| **Saturn by sign** | ~2.5 years | The season's *spareness*. Saturn in Pisces: fewer promises, more acknowledgement of limits. Saturn in Aries: blunter about cost. |
| **Mercury retrograde** | ~3×/year, 3wk | **The one fast signal that legitimately changes how we say things** — be more literal, less clever, more explicit about what we mean. It is already tracked (`mercuryRx` in `DaySky`). A period where the app is measurably plainer is both a good joke and good practice. |
| **Mars, Sun, Venus** | days–weeks | **Content, not voice.** These already drive what the app says is favoured. Letting them also move the register would mean the tone changed every few days. |

**[analysis]** The payoff is that the app's voice has a *long* rhythm the way a
person's does — recognisably itself, but different in a hard winter than in an
easy summer. That is a much better fit for the product's thesis than a voice
that performs a mood swing every Tuesday.

**[open]** How visible should this be? Two options: silent (the voice just
drifts and nobody is told), or named (a line in Settings: *"Compass is speaking
in its Saturn-in-Pisces register — spare, and careful about promises"*). Naming
it makes it a feature and teaches sky-literacy; leaving it silent avoids the
reader second-guessing every sentence. My lean is **named, but only once** —
discoverable in Settings, never announced in the daily.

---

## 3. Mercury sign as a tone preference — the strongest idea here

**[owner]** *"Even personalizing it according to what a user might want/need
(especially their Mercury sign!!)"*

**[analysis] This is the best idea in the batch, and it is the most defensible
thing astrology can do in a productivity app.**

Everything else the chart drives is a claim about *the world* — this day suits
that work. Mercury-as-register is a claim about **the reader's own preference
for how information arrives**, which is (a) exactly what Mercury has always
signified, (b) immediately checkable by the person themselves, and (c) not a
prediction at all. It is the rare astrological personalisation that cannot be
wrong in a way that costs the user anything — if the register is off, they
change it.

That last point is the design requirement: **the chart proposes, the user
disposes.** Mercury sign should *pre-select* a register during onboarding, shown
plainly ("Mercury in Virgo — we'll keep it precise and specific. Change any
time"), with a picker that overrides it. A chartless user picks directly. This
also serves the "chartless users CAN convert" line in BACKLOG §3b: tone
preference is behaviour-personalisation, not chart-personalisation.

**A first pass at the twelve registers.** These are *dials on the same voice*,
not twelve different personalities — the rules in §1 hold for all of them.

| Mercury in | Register | Same fact, in that register |
|---|---|---|
| Aries | Blunt, imperative, short. No preamble. | "Start it now. The window shuts at 2." |
| Taurus | Concrete, sensory, unhurried. | "There's a good long stretch this morning — enough to actually settle into it." |
| Gemini | Quick, plural, a little playful. | "Two decent windows today — 9ish, or after 3 if the morning gets away from you." |
| Cancer | Gentle, indirect, allows for feeling. | "This morning would hold it kindly, if you're up for it." |
| Leo | Warm, declarative, a touch of theatre. | "The morning is yours. Take the big swing before noon." |
| Virgo | Precise, caveated, useful. | "Best window 9:10–11:40. After that Mercury's hour ends and it thins out." |
| Libra | Balanced, weighs both, aesthetic. | "The morning suits it better than the afternoon — though the afternoon is calmer, if you'd rather that." |
| Scorpio | Spare, penetrating, names the hidden thing. | "The morning's the real window. You've been avoiding this one for six days." *(careful — this is the register nearest the line in §1)* |
| Sagittarius | Expansive, big-picture, cheerful about risk. | "Wide open morning. Go further with it than you planned." |
| Capricorn | Dry, structural, no ornament. | "Morning window: 9–11:40. Nothing else today comes close." |
| Aquarius | Systemic, odd angle, detached. | "Odd shape to the day — the good hours are early and then it's flat. Worth working against your usual order." |
| Pisces | Lyrical, associative, image-led. | "The morning has depth in it; the afternoon goes shallow. Work while the water's high." |

**[analysis] The build.** This wants to be **one function applied to composed
output**, not twelve copies of every composer. Concretely: the composers keep
producing structured facts (they already do — `Block[]` with typed lines), and a
`voice(register)` layer renders them. That is the only version of this that
doesn't multiply the maintenance cost of every future email by twelve.

**[open]** Does the register go through the LLM or stay deterministic? A lookup
of phrasings stays cheap, testable, and offline — but twelve registers × every
line is a lot of writing, and it will read as templated. An LLM pass reads
better and costs money and determinism. **My lean: deterministic for the daily
(it must be reliable and it's read fastest), LLM for the weekly and lunation
letters (lower volume, higher tolerance for variation, and the place "eloquence"
actually pays).** That also keeps the moat honest — the *engine* stays
deterministic ephemeris math; only the phrasing is generated.

---

## 4. Rhythm as the brand line

**[owner]** *"Branding about rhythm — finding your rhythm — which need not be
linear."*

**[analysis] This is the strongest line in the batch and I'd argue it's the
brand.**

It does four things at once that the current marketing material does separately
and worse:

1. **It dodges "productivity"** — which `PRICING-AND-MARKETING` says we must
   never put in a headline, and which "enchanted productivity" is only safe as
   an internal shape-name.
2. **It states the thesis without astrology.** "Your rhythm need not be linear"
   is the entire argument against fit-optimising calendars, and a reader who
   doesn't believe in astrology can still agree with it. That is a much wider
   door than "a weather report for time".
3. **It is the honest promise.** We don't promise better days. We promise you'll
   find the shape you already have. That is what the felt-rating loop actually
   delivers.
4. **It resolves the open Wake/streak question** (BACKLOG §3b). The don't-copy
   rule says no streaks; Momentum ships them anyway. Rhythm is the way out:
   **a rhythm has a beat you can miss and return to. A streak has a number that
   resets.** Same data, opposite meaning. "You've returned four times this week"
   is rhythm; "4-day streak" is a ledger. Rebuild the Wake on the rhythm frame
   and the contradiction goes away without losing the record.

**Candidate lines** (untested):
- *Find your rhythm. It was never a straight line.*
- *Not every day is the same day.*
- *For work that doesn't run on a straight line.* ← already in the backlog's
  hook list; the rhythm framing is its natural home.

**[open]** Does "rhythm" replace or sit above the tide/weather vocabulary?
My read: **above.** Rhythm is the promise (marketing, landing page, the thing
you tell a friend); tide/weather stays the in-app instrument. They don't
compete — one is why you'd use it, the other is what you read once you do.

---

## 5. AstroLyrica

**[owner]** *"Something to weave in with AstroLyrica?"*

**[analysis]** AstroLyrica already consumes the Compass engine over the API
(`ENGINE-API-SPEC.md`, `routes/engine.ts`) — ephemeris, dignity, synthesis,
elections. If the voice layer is built as §3 describes — **a renderer over
structured output, not phrasing baked into the composers** — then it is
shareable the same way the engine is, and AstroLyrica gets the register system
for free rather than reimplementing a house voice.

That argues for one concrete thing: **keep `Block[]` structural.** The moment a
composer emits a finished English sentence with tone in it, that sentence can
only ever be Compass's. Facts in the composer, voice in the renderer.

**[open]** Whether the voice layer ships as part of the engine API surface or
stays Compass-side is a product-boundary question, not a technical one.

---

## What to do with this

Nothing here is scheduled. In rough order of (value ÷ cost):

1. **The §1 register rule** — costs nothing, applies immediately to every line
   written from here. "Snark at the situation, never the reader. Lyric in the
   weather, plain in the instruction."
2. **Rhythm as the brand line** — a copy decision, not a build. Also unblocks
   the Wake redesign.
3. **Mercury-sign register** — real work. Wants the `voice()` layer first, which
   wants `Block[]` to stay structural. Start by *not* baking tone into any new
   composer.
4. **Seasonal register drift** — cheap once §3 exists (it's the same dial, moved
   by a different input). Meaningless before it.
