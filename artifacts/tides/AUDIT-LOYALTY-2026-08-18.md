# Audit — loyalty and the way in · 2026-08-18

The question, from the owner: what would keep people invested, what would
bring them on board, where would they be confused, what does the product
need to emphasize or simplify?

**Method honesty:** the grounding is the build as of `58bea18` (quiet lens,
log-it doors, touches, plain weave, chores, sprints — all shipped this
week), read against the standing strategy docs. The persona texture leans on
the existing roster rather than inventing a new one. Where a claim is a
hypothesis rather than a mechanism, it says so. One structural fact colors
everything: `MARKETING-HANDOFF.md` is dated 2026-07-04 — before the Compass
rename, before astro-optional, before sprints. The marketing kit describes a
product that no longer exists. That is finding zero.

---

## Part A — What keeps people invested (the loyalty engines as built)

**A1 · The Wake is the only asset that appreciates.** Everything else in the
app answers today; the ledger accrues. A person with six weeks of kept
habits, touched tasks, named wins and finished sprints has something they
cannot get by switching apps — their own record. This is the same gravity
that holds people to a journal or a training log. Two catches: the wake is
empty on day one (the Did-mode capture now makes a day-one wake possible —
the first session should route people through it), and nothing currently
lets a person SEE the accrual at month scale except the cycle card. The
record needs a yearly face eventually; the subscription's "why" lives there
("free = today, paid = the rhythm" — the rhythm IS the record).

**A2 · The comeback moment is the retention cliff, and Compass wins it.**
Streak apps churn people at the first missed week: the user returns, sees
red, and deletes the app rather than face it. Compass's return experience is
deliberately kind — cadence scored against the person's own choice, "carried
from Tue" instead of overdue-shaming, touches instead of a zeroed gauge,
"set it down" as an honest verb. This is a real, mechanical differentiator
and it is INVISIBLE until the user fails. It must be said out loud — in
marketing, and once in-product at the comeback itself (a returning user
after 5+ quiet days should be greeted, not audited).

**A3 · The loop answers in five seconds.** "What should I do right now" with
a reason — plain reason at the quiet lens — is the habit-forming core. It is
already good. The risk is upstream: the loop needs an inventory, and a
person who stalls before pasting a list never feels it.

**A4 · Sprints are the novelty cadence.** A weekly-ish fresh invitation
("Mars runs with Jupiter through Friday…") gives a reason to reopen that
duty never will, and the discipline built around it (one at a time,
dismissals remembered, cooldown) protects it from becoming noise. A
finished sprint is also the product's most naturally SHAREABLE unit — "I
did a 7-day dopamine fast" travels in a way "I use a scheduling app" never
will. No share surface exists for it yet; that is the growth-loop gap.

**A5 · Sky literacy is a mastery curve.** Plain → bilingual, planet
dossiers, the rail's takes — people stay for identity progression ("I can
read this now"). This engine only runs at medium/full; it is the paid-tier
audience's engine, not the secular one's.

**A6 · Trust compounds through refusals.** "No window today", "held back —",
honest outages, the empty day as a valid answer. Over months this is the
moat (no other astrology product refuses). Over the first three days it
reads as thinness if nothing explains it. The refusal culture needs its one
introductory sentence early — the tour touches it; the empty states carry
it; keep it explicit in marketing ("an app that tells you when NOT to").

## Part B — What brings people on board

**B1 · The intake's three doors are the funnel, and the funnel is real
now.** "Just the guidance / A little sky / The full chart" used to be a
display setting; since the quiet lens it is three genuinely different
products from one build. Marketing should run three pitches that mirror
them:
- secular: *a calm daily driver that schedules honestly and never shames
  you* (Dan, Kenji — reachable for the first time);
- curious: *your day, read like weather* (the existing voice);
- fluent: *a real instrument, not a horoscope* (the rail, the receipts,
  the evidence panels).
"Astrology optional" is now TRUE and is the single biggest new message the
kit doesn't carry.

**B2 · The first felt win arrives too late.** The current first-run teaches
surfaces (tour) before it delivers the moment that converts: the loop
naming THEIR item with a reason. The shortest path to "it read my day" is:
intake → paste three real things → the loop answers one of them by name.
Consider letting the cold-start doors run BEFORE the tour offers itself,
and letting the tour anchor to the person's own named answer rather than to
empty furniture. (Hypothesis, but consistent with every first-run study in
the repo.)

**B3 · The share loops that exist are astro-shaped only.** Tide share card
and Studio IG cards serve the curious/fluent doors. The secular door has no
shareable object until sprints get one. A finished-sprint card (title, days
kept, window — no sky vocabulary at the quiet lens) would be the first
share surface that works at every lens.

**B4 · The waitlist-era kit needs a rebuild, not a touch-up.** Names (Tides,
Aims, When), the pitch, and the screenshots are all pre-rename. The voice
and guardrails sections still hold word-for-word and should be carried
forward unchanged — they are the brand.

## Part C — Where people get confused

Graded like the HOME study: **[copy]** · **[small]** · **[design]**.

| # | Confusion | Direction | Grade |
|---|---|---|---|
| C1 | Eight nouns can hold "meditate": task, habit, chore, sprint, star, win, session, intention. Nobody can hold the taxonomy on day 3. | One capture door, several exits: the sheet already forks to-do/did — grow it to "keep doing" (habit) and "for a stretch" (sprint) so the app files things, people just say them | design |
| C2 | Nav vs content: Calendar contains Log; Stars contains Tasks and Habits; Home vs Today reads as two homes | Don't rename tabs again (churn). Add one "what lives where" card to the Guide, and one tour sentence: "Home steers, Today runs the day" | copy |
| C3 | The session timer quiets the whole sky — on desktop the rail says why; on a phone the note is a thin strip a person can miss, and cards just vanish | A one-time toast on first session-quiet: "The sky steps back while a session runs." | small |
| C4 | The Wake's voices (kept/done/logged/worked on/sprint:) are unexplained | Leave them — they are plain English and self-evident in context. Watch, don't build | — |
| C5 | "Guiding Stars" for the secular door (F9: the name holds everywhere) | Own it in marketing rather than hiding it; the sub-line "your long-term ideals" carries the meaning | copy |
| C6 | Two "find a time" doors at medium/full (the receipt's picker and Plan) | Already parked in BACKLOG; the quiet lens quietly fixed it for one lens | — |
| C7 | Premium toggle in Settings reads as a feature, is actually a dev peek | Fine for beta; label it "beta preview" when billing lands | copy |

## Part D — Emphasize and simplify (the moves, ranked)

**Emphasize:**
1. **"Astrology optional. Honesty always."** — the new lead message; rebuild
   the marketing kit around the three doors (B1, B4).
2. **The comeback promise** — "no streak shame" said explicitly, in the kit
   and once in-product at the return moment (A2).
3. **The record** — the wake as "your year, kept"; this is the pitch that
   justifies the paid rhythm and it needs a month-scale face before billing.
4. **Sprints as campaign beats** — each notable span is a small, honest
   marketing moment ("a short spell for finishing things"), and a finished
   sprint is the shareable unit (A4, B3).
5. **The first named answer** — restructure first-run so the loop speaks
   about the person's own item within two minutes (B2).

**Simplify:**
1. **The capture sheet as the one door** (C1) — the highest-leverage
   simplification available; everything else files itself.
2. **The Guide's "what lives where" card** (C2) — copy, not architecture.
3. **Retire the stale kit** (B4) — deleting wrong words is simplification.

**One open commercial question for the owner, flagged not answered:** the
quiet lens gives the secular door real free value (plain weave included),
but every premium bucket except Ask is astro-flavored. A secular subscriber
currently has little to buy. Either the paid rhythm grows a sky-free spine
(the record's yearly face, review tooling, sprint history) or the secular
door is an acquisition channel for the astro-curious rather than a revenue
tier of its own. Both are defensible; it should be chosen on purpose.

---

## Addendum — the sky-free spine, recommended (2026-08-18, later)

The open question above, answered as a recommendation rather than left
hanging. **Free is the day. Paid is the year.**

Every current premium bucket except Ask is astrological (Currents, personal
advisories, smart scheduling), so a quiet-lens subscriber has nothing to
buy. But the fix is not a second premium ladder for secular users — two
ladders would double the surface and split the story. There is one line that
serves both doors at once, because the astro-fluent user wants it just as
much:

**The record, and what it tells you.**

- **Free** — today and this week. The loop, the list, habits and their
  cadence, sprints, the wake as a running feed, the summoned weekly review.
  Everything needed to run a life, permanently, without paying.
- **Paid** — the accumulated version of the same thing:
  - the record's **month/quarter/year face** (BACKLOG; already the
    pre-billing requirement)
  - **patterns from your own data** — what you actually finish, by weekday,
    by energy, by time of day (`donePattern` exists; a sky-free reading of
    it is a genuinely different product from the felt-vs-tide correlation)
  - **sprint history** and re-running a past sprint
  - **time by star** from touches and session minutes — the training-log
    persona's whole reason to pay
  - **calendar write-back** (BACKLOG §5) — the most conventional paid
    feature in the category and entirely sky-free

Why this line and not another: it is the only asset the app has that
*appreciates*, it cannot be taken to a competitor, it needs no astrology to
explain, and it does not withhold anything a person needs today — which
keeps the free tier honest enough to keep recommending. It also gives the
astro tiers somewhere to sit rather than being the whole ladder: Currents
and advisories become *depth*, not the price of the record.

**What this requires before billing:** the yearly face has to exist. Until
it does, there is nothing to sell at any lens, which is the real reason it
sits in BACKLOG as a requirement rather than a nice-to-have.
