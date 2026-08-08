# Design handoff — Home elements to explore

A design reference for Compass Home arrived (`design_handoff_compass_home/`).
The owner's call: **keep our existing shell — the top nav and the left sky rail
stay as they are.** What we want from that direction is the *content* design,
explored as elements we can integrate one at a time.

This document says what to explore, what is already settled, and — most
importantly — **where the design asks for data the engine does not currently
produce.** Three of its best ideas are not skinnable; they need the engine to
say something new, and one of them is a genuine epistemic commitment we have so
far refused to make.

---

## What we are NOT changing

- **The top bar and the left rail.** The reference replaces both (a 208px rail
  with four ephemeris rows, a header with date + place). Ours stay. The rail
  was narrowed to 186px and the top-bar utilities were quieted this week; that
  is the extent of it.
- **Nav structure.** The reference nav is Home · Today · Calendar · Activities ·
  Guiding Stars · Log. Ours is Home · Today · Plan · Stars · Calendar, and the
  ordering is a settled decision (the loop, ratified 2026-08-01).
- **Customisability.** Deferred. One fixed order, not a configurable dashboard.

## What is already in place

Built this week, so design should treat these as existing rather than new:
three-level hierarchy (answer / work / context), the hero with badges and a
26px title, tasks carrying their own timing state, `Shape today` folded into
`Your work`, the week card naming its days, and moment-aware phrasing
("Open now, until 6:10" · "Tonight, 8:12–9:19 PM").

---

## Elements worth exploring, in order

### 1. The cross-highlight — the best idea in the reference

Clicking the ✦ verdict on a task row opens the hero's evidence panel *and*
highlights that row; clicking the hero title highlights the row for 2400ms.

> "This is the key affordance: the list and the hero card are two views of the
> same object."

That is exactly the relationship our page is missing, and it is the honest
answer to the duplication problem — the hero and the row stop being two
statements of the same fact and become one object seen twice. **Explore this
first.** It needs no new engine data.

Open questions for design: what the highlight does on mobile where the two are
never on screen together, and whether the reverse direction (hero → row) is
worth a timed highlight or should simply scroll.

### 2. Verdict vocabulary on task rows

The reference gives every row a third line with a colour-coded verdict:

| Verdict | Colour | We have it? |
|---|---|---|
| `✦ Convergent window today, 5:19–6:10 PM` | green `#3D6B4E` | yes |
| `Supported Friday morning` | muted | yes |
| `Already scheduled at 3:00 PM` | muted | **no — see gap 3** |
| `Needs a rough duration before placement` | amber `#8A6A2F` | yes |
| `No particular timing today` | faint | yes |

The colour discipline is right and matches ours: green reserved for actual
convergence, amber for needs-input. Worth adopting the vocabulary wholesale.

### 3. The hero's right-hand time block

The reference puts the window at 34px on the right, with a `TODAY` label above
and the **duration** below ("51 minutes"). Ours renders the time as a 15px line
under the title.

The duration is a real omission on our side — we have both instants and never
show the length, and "51 minutes" changes what someone does with the window.

Design question: our phrasing is now moment-relative ("Open now, until 6:10 PM",
"Tonight, 8:12–9:19 PM"), which does not always fit a big fixed time block. How
should the large treatment handle *"In 20 min"* or *"that window has passed"*?

### 4. Cold start

The reference has a third top state we do not: **"Compass can only point toward
things you actually hold"**, with three doors — paste a list, choose recurring
activities, find a time for one activity.

We have `thin-inventory` in the engine and a one-line message. The three-door
version is better and matches the earlier ruling that cold start should be a
distinct *module state*, not a re-ordered page.

### 5. Typography

The reference uses **Newsreader** (serif) for display and IBM Plex Sans for UI.
We have neither. This is the largest visual difference and the one most likely
to make the page feel designed rather than assembled — but it is also a
whole-app decision, not a Home decision. Worth a separate exploration showing
the same page in our current type versus a serif display face.

### 6. Smaller adoptions

- The gradient hairline across the top of the hero card (3px, green → tint).
- Dashed empty day cells in the week strip — "open" as a drawn state rather
  than an absence.
- Evidence as an inset panel (`#F6F2EA`) rather than plain disclosed text.
- Hover surfaces on task rows that bleed past the card padding (`margin: 0 -10px`).

---

## THE THREE GAPS — where the design outruns the engine

These are not styling. Each needs an engine change, and they should be decided
before design invests in the surface that displays them.

### Gap 1 — evidence is one string, the design wants several

The reference shows a structured panel:

> The Moon is applying to Mercury and reaches exactitude at 7:49 PM, after the
> window closes but while the aspect is still gathering.
> Saturn's hour runs 5:02–6:02 PM and contains most of the window — steadying
> for study rather than for starting something outward.
> Your 10th house is personally reinforced: transiting Mercury sits within 2° of
> your natal Midheaven.

`LinesUpResult.why` is a **single string** — today it reads
`"Moon–Mercury quintile, applying toward exactitude at 7:49 PM · Saturn hour"`.
Every testimony is already computed separately and then joined; the join is what
loses the structure.

*Worth noting: the designer independently arrived at the same correction I made
to that line this week — the aspect perfects after the window closes, and saying
"exact 7:49 PM" under a window ending at 6:10 read as a contradiction. Their
phrasing is better than mine and worth taking.*

**Ask:** should `why` become `Evidence[]` with `{ family, text }` per testimony?
That is a small engine change and it unlocks the whole panel.

### Gap 2 — "nothing is contradicted" is a claim we have never made

> "Nothing in the window is contradicted. No malefic angle within orb."

This is an assertion about **absence**, and the engine does not currently make
one. Everything it says is positive testimony: what supports, what qualifies,
what defers. Saying "nothing contradicts this" requires knowing the search was
exhaustive — and a false negative here is worse than a missing line, because it
reads as a guarantee.

**This is a product decision, not a design one.** The line is reassuring and it
is exactly the kind of sentence that becomes indefensible if the orb table
changes. Recommend we either (a) don't say it, or (b) say the narrower true
thing: "no qualifying objections were recorded" — which is a statement about our
own reasons list rather than about the sky.

### Gap 3 — "Already scheduled at 3:00 PM" has no source

The reference shows a task whose verdict is that it is *already placed*. We have
`tasks.planning_window_id` for exactly this, and it is now correctly backfilled
— but neither `linesUp` nor `dayWeaver` reads it. So a task the person has
already scheduled currently shows up as though it still needs timing.

**Ask:** small engine change, clear win, and it removes a real wrongness —
Compass currently offers to time something you have already committed to.

---

## Constraints design must not propose around

These are settled and were expensive to settle:

- **Compass never invents work.** Only what the person holds. If a good Venus
  window has nothing wanting it, the honest output is an empty slot.
- **Occupancy is never the target.** An open day is a correct answer and must
  render as deliberate. The reference gets this right ("six days deliberately
  open") — keep it.
- **Gaps and refusals are output**, with reasons, never silent drops.
- **A disclaimer means the design is wrong.** If a surface needs a caption
  explaining what it isn't, rebuild the surface.
- **An outage is not a quiet day.** The three states are active / quiet / cold
  start — plus a fourth the reference does not have and we need: *couldn't
  read the sky*. Design should include it; it is a real state and it looked
  exactly like "quiet" until this week.
- **Green means convergence.** Never decorative. The reference honours this.

## What would be most useful back

Element explorations, not a full page — we integrate incrementally and the shell
is fixed. In priority order: the cross-highlight, the hero time block under
moment-relative phrasing, and the cold-start module. Plus a position on Gap 2,
which is the one that decides what Compass is willing to claim.
