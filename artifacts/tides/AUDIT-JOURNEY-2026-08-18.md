# Audit — the user journey, education, and the shape of the interface · 2026-08-18

The owner's questions: is the journey well mapped? is their education clear?
is their next step always clear? are they ever overwhelmed? what about the
interface as a whole — what needs reorganization?

**Method honesty:** the grounding is the build at `cbfe21b` with refs, plus
one behaviour observed live in this session (a fresh account created at
17:24, walked from intro to Home). Where a claim is simulation it says so.
The headline: **the first-run walkthrough does not fire for a user who
follows the default path**, and it has been that way since the Home/Today
split. Everything else is smaller.

---

## Part A — The journey as actually built

### A1 · The way in (verified by walking it)

1. **Three intro slides** (`IntroSlides`) — what fits now / a direction /
   put it in time.
2. **Name** → `OnboardingModal` step 1.
3. **"How much astrology do you want to see?"** + birth date/time/place —
   step 2. The three doors: *Just the guidance · A little sky · The full
   chart*.
4. **"Your rhythm"** — chronotype (early riser → night owl), or skip.
5. **Land on Home.**

Five screens before the product, three of them before an account exists.
Defensible: each one earns something the engine actually uses. The
astro-level question at step 3 is now the most load-bearing question in the
app (it selects one of three genuinely different products) and it is asked
before the person has seen anything — worth revisiting, not urgent.

### A2 · THE FINDING: the walkthrough is unreachable on the default path

`App.tsx:1178` — the landing view is `"home"`.
`App.tsx:1197` — the tour arms only when `view === "today"`:

```js
if (!testerId || view !== "today" || tourArmed || !tourPending(testerId)) return;
```

The gate is *correct in isolation*: the first stop anchors to
`[data-tour="today-hero"]`, which exists only on Today, and arming before
the anchor exists would let the missing-anchor auto-advance burn the whole
tour against an empty page. But the consequence is that **a new account
lands on Home and is taught nothing.** The walkthrough waits, silently, for
a tab the person was not sent to. If they never open Today, they never meet
it; the account's "first run" simply never happens.

**Observed, not inferred:** the account created in this session at 17:24
went intro → name → level → rhythm → Home, and no spotlight appeared. It
was a brand-new tester id with no tour record, so `tourPending` was true
the whole time.

This is a Home/Today-split leftover: the tour was written when Today was
the landing surface, and the split moved the landing without moving the
teaching.

### A3 · Day one, after landing

Cold-start Home is good and was designed deliberately: the answer card
becomes three doors ("Paste today's list", "Choose recurring activities",
"Find a time for one thing"), each stating its cost, and two starter
habits are seeded server-side so the rhythm card is not empty. This is the
strongest part of the journey. It is also the part the tour would have
introduced.

### A4 · Week one and after

The loop answers daily; the Wake accrues; sprints offer a fresh invitation
about weekly; the Sunday review appears on Sundays; the new-moon check-in
appears monthly. The cadence of *novelty* is well spaced — nothing else in
the app fires more than weekly. That part is genuinely well mapped.

---

## Part B — Education: what teaches, and where it hides

| Surface | What it teaches | Reachability |
|---|---|---|
| Spotlight tour (5 stops) | the loop, the tabs, where things live | **Broken by default** (A2) |
| The Guide (8 sections, incl. the new "What lives where") | the whole structural model | **Settings only**, below eight other cards |
| HelpBadge `?` chips | individual sky terms | 7 of them, all in the rail — invisible at the quiet lens (the rail is gone) |
| Empty states & refusals | the product's honesty, in context | Everywhere. The best teaching in the app |
| Planet dossiers (`Planets` view) | the sky, in depth | **No nav entry.** Reachable only from a Log flavour chip (`App.tsx:1231`) |
| Studio / cards | nothing — they publish | n/a |

**The pattern:** every *deliberate* teaching surface is either unreachable
(tour), buried (Guide), lens-invisible (HelpBadges), or orphaned
(Planets) — while the *incidental* teaching (empty states, refusal lines,
the wake's plain verbs) is excellent and everywhere. The product teaches
best where it wasn't trying.

**For the secular door this is worse, not better.** A "Just the guidance"
user loses the rail (and its seven `?` badges) entirely, so their only
possible teaching is the tour they never get and the Guide they must find
in Settings.

---

## Part C — Is the next step always clear?

Mostly yes, and by design — the loop exists to answer exactly this. Three
places where it is not:

- **C1 · After the first capture.** A person pastes six things and gets…
  a list. The loop then names one, which is right, but nothing says
  "that's the point — come back tomorrow and it will name the next one."
  The one-time explanation of the daily loop is what the tour would have
  given.
- **C2 · After finishing a sprint.** Now offers a card (shipped today).
  Good. But nothing invites the *next* sprint — and "did it once, would do
  it again" is the whole premise of the feature ("which they might do
  multiple times"). A finished sprint should offer to run it again.
- **C3 · At the quiet lens on Today.** See D3 — the tab is off-message for
  that user, and there is no next step on it that belongs to them.

Everywhere else the next step is either explicit (the loop, cold-start
doors, "Weave it in", "Shape today") or honestly absent ("Nothing stands
out today. Pick by what matters most").

---

## Part D — Overwhelm

### D1 · Home's module count has crept back up

Countable top-level modules on Home at medium/full, on a live Sunday:
comeback greeting · CompassNow · VOC strip · new-moon check-in · rare-moment
banner · Sunday review · the work panel (capture + log-it + resolution chips
+ shaped day + up to five task groups) · DayAhead · This week · Guiding Stars
· **Sprints** · Rhythm · Today's log · CroppingUp · the water reveal · the
answer card (+ secondary rows + clarify rows + the picker).

That is ~16, against the "essential density" study's whole point. Most are
conditional and rarely co-occur — the notice queue already enforces one
banner at a time — but the trend is real: this week added three (sprints,
the comeback line, the log-it door). **The quiet lens is now the de facto
density control**, which is not what it was built for.

### D2 · The noun taxonomy — improved today, not solved

The capture sheet's four exits (to do / did / keep doing / for a stretch)
fixed the *input* side: people no longer choose a noun, they choose a
direction. The *reading* side still shows five kinds of row (task, habit,
chore, sprint, star) across three surfaces. Acceptable — they look
different and behave differently — but the Guide's "What lives where" is
the only place that says so, and it is buried (Part B).

### D3 · Today is not lens-aware — the quiet lens's own gap

`Today.tsx:1270–1293`: the hero renders the tide level, the tide headline,
the character essence, and a corner block of **moon sign / planetary hour /
moon phase** with no `astroDetail` gate anywhere. The quiet lens covers
Home, the rail, Calendar, Plan, the sprint card and the session timer —
**and not the one tab whose entire hero is the sky.**

So a "Just the guidance" user who taps Today (which is also the only way to
get the walkthrough, A2) meets the loudest astrological surface in the
product. This is a gap in this week's own work, and it is the single most
incoherent thing in the interface right now.

---

## Part E — The interface as a whole

**What is right and should not be touched:** the loop as the answer; the
nav-as-the-loop (five tabs, no drawer); refusals as output; one voice per
fact; the wake as one ledger.

**What needs reorganization, in order:**

1. **Teach on the landing surface.** Either the tour anchors its first stop
   to something on Home, or landing sends a first-run account to Today
   once. The former is better — Home is where the person will live.
2. **Lift the Guide out of Settings.** A "?" beside the wordmark, or a
   permanent entry in the top bar's utilities. It is the app's only
   structural explanation and it costs one control.
3. **Make Today lens-aware** (D3), or, at the quiet lens, drop Today from
   the nav entirely and let Home be the whole product. Dropping it is the
   more honest read of what that user bought.
4. **Give Planets a home or retire it.** A dossier surface reachable only
   from a Log chip is either an education feature nobody can find or dead
   weight; both readings argue for a decision.
5. **Offer the repeat.** A finished sprint should offer to run again (C2) —
   it is the cheapest retention mechanic available and the feature's own
   premise.

---

## Part F — Findings ledger

| # | Finding | Direction | Grade |
|---|---|---|---|
| J1 | The walkthrough never fires on the default path (lands Home, arms on Today) | Anchor stop 1 to a Home element; arm on Home | **design, urgent** |
| J2 | Today's hero ignores `astroDetail` — the quiet lens's biggest hole | Gate the hero, or drop Today from the nav at minimal | design |
| J3 | The Guide is buried in Settings | One control in the top bar | small |
| J4 | Planets has no nav entry | Give it one, or retire it (owner) | design + owner |
| J5 | A finished sprint doesn't offer a repeat | "Run it again" beside the card offer | small |
| J6 | Home is back to ~16 possible modules | Watch; the notice queue holds for now | — |
| J7 | The astro-level question is asked before anything is seen | Consider re-offering it after day one | copy + design |
| J8 | HelpBadges live only in the rail, so the quiet lens has none | Accept — the lens's point is fewer sky terms to explain | — |

**What NOT to do:** don't add a second onboarding, don't gamify the tour,
and don't fix J1 by making the tour longer. The teaching that already works
is contextual and one sentence at a time; the fix is to make the existing
five stops reachable, not to build a school.
