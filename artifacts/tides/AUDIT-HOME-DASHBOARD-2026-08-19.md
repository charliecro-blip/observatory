# Audit — grouping under the Stars, the Home/Today merge, and a
# configurable dashboard · 2026-08-19

Seven questions from the owner, answered against the code rather than
from memory. Everything below cites what it read.

Sizes that shape every answer here: `pages/Home.tsx` is **1839 lines**,
`pages/Today.tsx` is **3181**. Of Home's ~13 visible modules, only 7 are
components; the rest are inline JSX, and the two biggest inline blocks
are "Your work" (~160 lines) and "What lines up" (~440 lines,
1394–1836). That ratio is the hidden cost in five of the seven answers.

---

## 1 · Grouping habits and tasks under the Guiding Stars

**The data is already there. This is a rendering change, not a schema
change.** That is the good news, and it is worth stating first because
it makes this the cheapest item on the list.

- `habits.starIds` is a CSV of goal ids, with `goalId` mirroring the
  first entry (`lib/db/src/schema/planning.ts:168`). `GET /habits`
  spreads the whole row (`routes/habits.ts:131`), so `starIds` is
  already on the wire and already in the browser.
- `tasks.goalId` exists (`planning.ts:122`), the endpoint already
  accepts `?goalId=` as a filter (`routes/tasks.ts`), and `GET /tasks`
  returns full rows.

One line of real work: Home's LOCAL `Task` interface
([Home.tsx:66](src/pages/Home.tsx:66)) declares eight fields and
`goalId` is not among them. The value arrives and is dropped by the
type. Add it and the grouping is computable client-side from queries
Home already runs — no new endpoint, no new request.

### The two things that make this harder than it looks

**A habit can serve several stars; a task serves one.** This asymmetry
was deliberate (owner, 2026-08-16: "one walk can serve 'get fit' and
'clear head' both"), and it means a star-grouped list cannot be a
partition. A habit under two stars either appears twice — and then the
page's counts stop summing to the truth, and a tap in one place
silently ticks the other — or appears once with a marker saying it also
serves the other. Appearing twice is the wrong choice: the whole reason
`starIds` exists is that a kept habit stays ONE ledger item counted by
each of its stars, and a UI that renders it as two things contradicts
the model underneath it.

**The date axis already owns the task list.** Home's work column groups
tasks by `overdue / today / no date / later / scheduled`
([Home.tsx:1217](src/pages/Home.tsx:1217)). Star-grouping is a second,
incompatible axis over the same objects. Two groupings of one list in
one card is how a dashboard becomes unreadable, so this has to be a
choice rather than an addition — either a toggle on that card, or
star-grouping lives in "Where you are" (direction) while the date
grouping stays in "Your work" (execution), which is roughly the split
the two cards already have.

### The unassigned bucket is the honest part

The owner's phrasing — "and then other habits/tasks if they aren't
assigned" — is right, and it should be a NAMED bucket rather than a
silent remainder. Compass's standing rule is that gaps are output with
reasons. "Not tied to a star (3)" is a true statement about the
person's setup and a working door into the retro-tie flow that already
exists; an untitled leftover pile at the bottom is the same data
saying nothing.

The star rows should also stay honest about targets: `WhereYouAre`
currently prints `"nothing yet"` for a star with no sessions
([WhereYouAre.tsx:180](src/components/WhereYouAre.tsx:180)) rather than
inventing a denominator, and grouping must not become an excuse to
print "0 of 4" where nobody set a 4.

### Cost

Small — half a day. `WhereYouAre.tsx` is 192 lines and the grid it
draws (two columns, habits | stars) becomes a list of star blocks plus
an unassigned block. The screenshot's layout is what makes the current
version feel wrong: habits and stars sit side by side as two unrelated
inventories, when one is the means and the other the end.

### One thing to fix while in there

`GET /planning/north-stars` runs **one query per star** in a `for` loop
([routes/planning.ts:368](../api-server/src/routes/planning.ts:368)) —
five queries for four stars today. If grouping later needs per-star
habit and task counts server-side, do not extend that loop; fetch the
sets once and group in memory. This is the `getMajorAspects`-in-a-loop
shape, caught early.

---

## 2 · Reuniting Home and Today

**Verdict: possible, and much bigger than it looks. Do it last, and do
it as a deletion rather than a merge.**

The split was deliberate and recent (2026-08-04, recorded at
[App.tsx:190](src/App.tsx:190)): Home became the dashboard centred on
the Compass and the to-do dump because Today had grown "super busy and
a little overwhelming". A merge is a reversal of that call, and the
thing that made Today overwhelming — eight stacked banners — is
precisely what would come back.

### What each page actually holds

| Home | Today |
|---|---|
| Where you are | Hero / tide banner |
| Compass · right now | Strongest fit right now |
| VOC strip · New Moon check-in · Rare-day banner · Review card | Angle crossings · Ritual card · Notification opt-in · First-star hint · Deeper-currents banner · VOC banner · Cycle-phase banner · Rhythm-risk banner |
| Your work (tasks by date) | Dashboard (incl. Guiding stars) |
| Day ahead · Committed week · Today's log | Today's habits · Resonant now · The tide chart · Standing conditions · Logbook |
| Cropping up · Water ahead | Waves · Planet-to-planet aspects |
| Ask · What lines up · Election picker | Moment advisor · Evening harvest · Block check |

Genuinely duplicated today: habits check-off (both), Guiding Stars
(both), the VOC condition (both, with different copy and different
gating), the day's log (both), and the "what should I do now" answer
(`CompassNow` on Home, "strongest fit" on Today, computed by different
paths). That is five duplications — real, and a real argument for the
merge.

### The four things that block it

1. **The two pages read tasks through different cache entries.** Home
   uses `["tasks", "all"]` against `/api/tasks`; Today uses
   `["tasks-today", testerId, today, tzOffset]` against the date-filtered
   route. Merging means one of those questions wins, and "all tasks" vs
   "today's tasks" is a product decision, not a refactor — Home's own
   comment argues hard for all ([Home.tsx:340](src/pages/Home.tsx:340)).
2. **The banner queue would have to be rebuilt, not concatenated.**
   Home's notice queue is ordered by rarity with mutual suppression, and
   the reasoning is written into the code
   ([Home.tsx:1014](src/pages/Home.tsx:1014)): turning points outrank
   exceptional days outrank the Sunday review, and the VOC strip is
   deliberately excluded from the contest because it is a condition
   rather than an offer. Today's eight banners have no such queue. Merge
   them naively and you get eleven candidates stacking.
3. **Seven test files regex these two source files** (`hero-voice`,
   `honest-claims`, `one-vocabulary`, `moon-cycle`, `regressions`,
   `fetch-json`, `tasks-scheduled-today`). Per the house lesson,
   source-text tests pin dead code — moving a block between files breaks
   assertions that have nothing to do with behaviour. Budget for it.
4. **`Today` is a nav tab with `zoom: true`** — the zoom row treats
   Today and Calendar as one time-scale ladder
   ([App.tsx:197](src/App.tsx:197)). Removing Today removes a rung.

### The order that makes it safe

Do not merge the files. Instead, over several passes, move each
duplicated fact to the page that should own it and DELETE the other
copy — habits to Home (already done), the VOC condition to one page,
the log to one page, the "what now" answer to `CompassNow` alone. When
Today has nothing left that Home lacks, deleting Today is a one-line
nav change instead of a 5000-line merge. Items 3, 4 and 5 below are
each one step of exactly this.

---

## 3 · Waves on Home

**Verdict: yes, and it is the strongest of the four Today→Home moves —
but what should move is only half of what "Waves" currently is.**

Waves ([Today.tsx:1738](src/pages/Today.tsx:1738)) is two things in one
card:

- **Top half:** today's unscheduled tasks as `WaveRow`s. Home already
  renders this list, grouped by date, in "Your work". Moving it would
  create a sixth duplication rather than removing one.
- **Bottom half — the actual feature:** "moments ahead". Upcoming
  planetary hours and applying lunar aspects, each matched to the task
  or star that runs on that planet. This is genuinely absent from Home,
  and it is the thing worth moving. It answers "when today", which no
  Home module answers — `DayAhead` shows what is placed, `CompassNow`
  shows one pick, and neither shows the shape of the hours you have
  left.

The matching logic is sound and already justified in place: lunar
contacts lead because they are rarer and name a specific meeting
(39% frequency vs planetary hours at 99%), and only applying aspects
that perfect before the day is out are shown.

**Cost: medium.** The block is ~110 lines of inline IIFE inside Today
and depends on `now.upcomingHours`, `now.moonAspects`, `northStars`,
`todayTasks`, `testerProfile.chronotype` and `suggestApproach`. Home
already has `now` (`useTidesNow`) and `northStars`; it would need the
chronotype read and the tasks-with-planet field. Extract it as
`components/MomentsAhead.tsx` with an explicit prop list — that
extraction is worth doing regardless, since it is currently untestable
where it sits.

**One caveat:** it is sky-language end to end, so it must be gated on
`!skyQuiet` like `CroppingUp` is. At the quiet lens it renders nothing,
and that is correct rather than a gap to fill.

---

## 4 · A smaller tide banner on Home

**Verdict: yes, but build a new small component; do not shrink the
existing one.**

The tide banner is the top ~60 lines of Today's hero
([Today.tsx:1247](src/pages/Today.tsx:1247)): a full-bleed element
gradient, 44px headline, moon sign / planetary hour / moon phase in the
corner, and a Share button into the Studio. It is not parameterised for
size, its type scale is absolute, and it already carries a second job
(the lunar-cycle position beneath it).

Home's own header comment records the reason it has no tide hero
([Home.tsx:30](src/pages/Home.tsx:30)): the owner's call that the tide
is "a widget right now" and that "there can be different heroes". A
small tide strip is consistent with that — it is the widget, at widget
size — but it should be authored as one, not extracted by deletion.

What a Home-sized version should carry, in one line: the element color
as a left rule or a thin gradient, the character word, and the day's
one-sentence guidance. What it should NOT carry: the Share button
(Studio is a Today/Calendar affordance), the confidence note, or the
moon-sign corner block — those are the parts that make the full hero a
hero.

**It must obey the lens.** The full hero learned this the hard way
(AUDIT-JOURNEY J2: the loudest sky surface in the app was still
speaking tide levels to someone who had asked for none of it) and the
fix is right there in the code — at `minimal` it prints the weekday and
the date, and keeps the guidance line, which was always the part for
everyone. A Home strip should be written that way from the first
commit.

**Cost: small.** ~80 lines, reusing `ELEMENT_COLORS`,
`CHARACTER_ELEMENT`, `tideGuidance` and `QUIET_DAY_GUIDANCE`, all
already exported.

**The real tide chart (`UnifiedTideChart`, 867 lines) should stay on
Today.** It is an instrument with drag interaction, chronotype shading
and sun-clock gradients; it is not a dashboard widget at any size.

---

## 5 · Which dynamic banners can be integrated

Eleven banner-shaped things exist across the two pages. Verdicts:

| Banner | Where | Verdict |
|---|---|---|
| VOC | both, twice | **Merge — pick Home's.** Home's version carries the reading, the scope and the Lilly provenance; Today's is a two-line strip. Delete Today's. |
| Angle crossings | Today | **Move.** Rare, live, sky-gated; slots into Home's rarity queue above the rare-day banner. |
| Rhythm-risk | Today | **Move.** Behavioural rather than astrological, so it survives the quiet lens — a rare item for the free tier. |
| Cycle phase | Today | **Move, gated.** Only renders when `cycleTracking` is set up; costs nothing for everyone else. |
| Ritual card | Today | **Leave.** Time-of-day anchored and tied to Today's own morning/evening flow; moving it means moving the flow. |
| Notification opt-in | Today | **Move.** It is a once-ever ask that self-hides, and Home is where people land — on Today it is shown to whoever happens to visit. |
| First-star hint | Today | **Move and merge** with Home's cold-start doors, which make the same offer better. Do not run both. |
| Deeper-currents / premium | Today | **Rewrite, then move.** It sells "Currents under Calendar", which the pricing decision no longer describes. Hold it until the free/paid line is built. |
| New Moon check-in | Home | Stays. |
| Rare-day | Home | Stays. |
| Sunday review | Home | Stays. |

**The constraint that governs all of it:** Home's queue shows ONE
notice at a time, ordered by rarity, and the code says why — "the whole
value of an interruption is how seldom it comes". Anything moved in
must join that queue with a stated rank, never be appended above or
below it. Adding four banners without ranking them recreates Today's
eight-banner stack on the new landing page, which is the exact failure
the 2026-08-04 split was meant to fix.

Ranking for the movers, rarest first: angle crossing → turning point →
rare day → cycle phase → rhythm risk → Sunday review. VOC stays outside
the contest as a condition, as it is now.

---

## 6 · Compass before Cropping Up

Checked, and the answer depends on which surface "the compass feature"
means, because Home has three.

- `CompassNow` — "Compass · right now" — is at
  [Home.tsx:949](src/pages/Home.tsx:949), **already second on the page,
  well above** `CroppingUp` at 1295. If this is the one meant, it is
  done; the likely reason it looks absent is that it renders nothing
  when the loop has no pick.
- **"What lines up"** — the loop's full module — is at 1394, **below**
  Cropping Up.
- **The activity picker** (`ElectionPicker`, the pick-an-activity-get-times
  Compass) is at **1833**, at the very bottom of the page, inside a
  collapsed `<details>` labelled "Find a time for something else".

So two of the three are below Cropping Up, and the third is buried
about as deep as a feature can be on a page.

**Recommendation, which satisfies every reading:** move `CroppingUp`
and the water-ahead reveal down below Ask and What-lines-up. Cropping
Up is a horizon module by its own description — "breadth at low
resolution", answering Home's SECOND question — and it currently
interrupts the page between the answer and the receipt for that answer.
This is a ~6-line move with no logic change.

Separately worth doing: raise the activity picker out of the `<details>`
at the bottom. Its own commit describes it as the Compass, and it is
the free tier's one "ask about a thing I care about" affordance.

---

## 7 · A drag-and-drop, minimize/expand dashboard

**Verdict: minimize/expand — yes, worth building. Free drag-and-drop —
no, not for these modules, and not on this page structure.** The
distinction matters, so here is the reasoning rather than the
conclusion alone.

### What already exists

More than expected. `DisplayPrefs` ([lib/preferences.ts:18](src/lib/preferences.ts:18))
already carries per-module booleans — `todayShowVOC`, `todayShowWave`,
`todayShow14Day`, `todayShowJournal`, `compactRail`, `todayShowCrossings`
— plus `uiDensity: essential | expanded`, all with Settings toggles.
The pattern is built, and the load/merge/save cycle handles unknown keys.

### What is missing, and it is the important part

**Preferences are `localStorage` only.** `const KEY = "tides-preferences"`
— there is no `prefs` column on `tester_profiles` (which has `chronotype`
and `cautionPlanets` as `jsonb`, so the pattern is established). Given
the per-device session-token auth model, a layout someone arranges on
their laptop does not exist on their phone. Shipping a dashboard people
arrange, that then silently resets on their other device, is worse than
not shipping one. **A `prefs jsonb` column is the prerequisite for any
version of this**, and it is additive and cheap.

Second gap: **`uiDensity` barely reaches Home.** `essential` gates
exactly one thing there — the Today's-log card at
[Home.tsx:1263](src/pages/Home.tsx:1263). The existing lever does not
actually control Home's modules.

### Why free drag-and-drop is the wrong tool here

1. **Most of Home's modules are not components.** Six of ~13 are inline
   JSX inside a 1839-line file, including the two largest. A draggable
   dashboard needs each module to be a component with a stable id and no
   positional dependencies. That extraction is 2–3 days on its own — and
   it is worth doing anyway, which is the useful part of this answer.
2. **Some ordering is load-bearing, not preference.** The notice queue's
   rarity ranking and mutual suppression are a correctness property, not
   a layout. So are "answer before evidence" (`CompassNow` above the
   receipt, argued at [Home.tsx:939](src/pages/Home.tsx:939)) and
   "answer before the reading it came from". A user who drags the receipt
   above the answer has not customised the page, they have broken an
   argument the page is making. Any reorder UI has to hold some modules
   fixed, and a drag surface where a third of the targets refuse to move
   feels broken rather than principled.
3. **Mobile.** `isMobile` collapses Home to one column, and drag-to-reorder
   on touch fights the scroll gesture — the two retention-risk personas
   from the HOME study both live on phones.
4. **No library, and the bundle is not free.** No dnd dependency is
   installed. `framer-motion` IS declared and currently **unused in
   `src`**, so it is tree-shaken out today; its `Reorder` component would
   do this with no new dependency, but it would newly pull the library
   into the bundle.

### What to build instead, in order

1. **`prefs jsonb` on `tester_profiles`,** and move `DisplayPrefs` behind
   it with localStorage as the offline cache. Prerequisite for everything
   else, additive, ~half a day.
2. **Minimize/expand per module.** A collapsed module keeps its header and
   its one-line summary — "Cropping up · 3 ahead" — so collapsing is a
   density choice rather than a disappearance, and nothing the person
   chose to hide can silently become a gap they were not told about. This
   is the feature that actually answers the complaint behind the request,
   and it does not require the component extraction.
3. **Extract Home's inline blocks into components** with stable ids. Do
   this because the file needs it, and let reordering become possible as a
   side effect rather than a goal.
4. **Then, if still wanted: reorder within zones.** Three fixed zones —
   the notice slot (never reorderable), the answer zone, the context zone
   — with a list-based "move up / move down" reorder, or `Reorder` from
   framer-motion, inside a zone only. Everything the person can move is
   something where order is genuinely taste; everything where order is an
   argument stays put.

That gives a real dashboard without letting anyone rearrange the page
into saying something untrue.

---

## Suggested order of work

| # | Item | Size | Note |
|---|---|---|---|
| 1 | Cropping Up moves below Ask / What-lines-up | XS | §6, ~6 lines |
| 2 | Star-grouping in "Where you are" + named unassigned bucket | S | §1, no schema change |
| 3 | Small tide strip on Home, lens-aware from commit one | S | §4 |
| 4 | `prefs jsonb` on `tester_profiles` | S | §7, unblocks the dashboard |
| 5 | Extract "moments ahead" → `MomentsAhead` on Home | M | §3 |
| 6 | Banner consolidation into Home's rarity queue | M | §5, deletes duplicates |
| 7 | Minimize/expand per module | M | §7 |
| 8 | Extract Home's inline blocks to components | L | §7, prerequisite for reorder |
| 9 | Retire Today by emptying it | L | §2, last |

Items 5, 6 and 3 are each one step of §2, so the merge gets closer
without ever being attempted as a merge.
