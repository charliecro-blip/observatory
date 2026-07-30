# Competitive UX study — 2026-07-29

**Question:** what have the productivity/scheduling apps already solved that Compass
is re-solving badly or not at all — and which of those solutions can Compass import
without becoming them?

**Method.** Part 1 is web research on Motion, Sunsama, Reclaim.ai, Akiflow, Amie,
Notion Calendar, Structured, Tweek, Todoist and Fantastical (onboarding, daily loop,
signature interaction, pricing, sentiment). Part 2 grounds every claim about Compass
in the code, read first-hand on 2026-07-29 at commit `e0b6cff` (branch
`feat/tides-app`). Where a competitor resisted research, it says so.

**Research caveat.** Sentiment below is drawn from review-aggregator and comparison
sites (Efficient App, Capterra/G2 summaries, Morgen's competitor blog series, Saner.ai,
ProductHunt) rather than primary forum threads. Morgen and Saner.ai are themselves
competitors publishing comparison content, so their negative framing of Motion/Sunsama
is discounted accordingly. Amie in particular resisted research — most available
writing about it is design-adjacent commentary, not usage sentiment, so its entry is
thinner than the rest and should be treated as impressionistic.

---

## Part 1 — What the field has actually solved

### The four archetypes

Everything in this space is a position on one axis — **who decides when a thing
happens.**

| Archetype | Who decides | Exemplars | The bet |
|---|---|---|---|
| **The autoscheduler** | the machine | Motion, Reclaim | you don't want to decide |
| **The ritual** | you, guided, daily | Sunsama, Akiflow's Daily Rituals | deciding *is* the product |
| **The instrument** | you, fast | Akiflow, Notion Calendar, Amie, Fantastical | just don't make it slow |
| **The surface** | you, casually | Structured, Tweek | most people aren't power users |

Compass is currently a **ritual** wearing an **autoscheduler's** clothes (the Planner)
with none of the **instrument's** speed. That mismatch is most of what follows.

---

### Motion (usemotion.com) — the autoscheduler

**Onboarding.** Heavyweight and front-loaded: connect a calendar, import/enter your
existing tasks, set working hours, then let the AI build a first day. Reviewers
describe onboarding as difficult and note it takes hours before the schedule feels
useful — the product cannot demonstrate value until you have given it your whole life.

**Core daily loop.** There isn't much of one, by design. You add tasks with a
duration, deadline and priority; Motion places them. If a meeting overruns or a new
one lands, the AI silently pushes tasks into the next available slots. The daily
"loop" is: open calendar, do the top thing, repeat.

**Signature interaction.** The **Auto-schedule toggle** on a task, and the
rebalancing that follows. The whole product is one promise: *you will never place a
task by hand again.*

**Pricing.** Pro AI $19/mo ($12.73 annual), Business AI $29/seat/mo ($19.43 annual);
historically higher and raised more than once. No meaningful free tier.

**Sentiment.** Praise: tasks never fall off the calendar — an incomplete task keeps
rolling forward until it's done. Complaints, consistently: it **packs the day too
tightly**, leaving no slack for the unplanned work that always shows up; the UI is
called clunky and has been for years; the mobile app is weak; onboarding is hard;
price keeps rising.

**The lesson that matters for Compass.** Motion's failure mode is a *trust* failure,
not an algorithm failure. When the machine moves your work without asking, and it is
wrong once, you stop believing the calendar. Every autoscheduler eventually has to
buy trust back with a review step — which is what Compass's Planner already has and
Motion does not.

---

### Sunsama — the ritual

**Onboarding.** Guided, philosophical, low learning curve. It walks you through
connecting task sources and *explains the planning philosophy while you set up*.
Onboarding teaches a practice rather than configuring a system.

**Core daily loop.** The clearest daily loop in the category, and the closest thing
to Compass's ethos:
- **Morning:** a guided planning ritual (~10–15 min). Review yesterday, pull tasks
  from the backlog and from connected tools, **estimate time for each**, drag them
  onto today, and — crucially — the app tells you when you have **planned more than
  the day holds**.
- **Evening:** a **guided shutdown** — review what you did, consciously move what you
  didn't to tomorrow or a specific future date, and close the day.

**Signature interaction.** **Drag from the backlog channel into a day column, with a
time estimate attached** — and the running total that says "you have planned 9h into
a 6h day." Second signature: the shutdown's *deliberate deferral* — you don't leave
tasks undone, you re-home them.

**Pricing.** The expensive end: $20/mo, raised in 2026 to **$25/mo monthly, $20/mo
annual**. Sunsama publishes a "pricing manifesto" defending it.

**Sentiment.** Praise is remarkably consistent and emotional: the **shutdown ritual**
is repeatedly named the single feature that most improved work-life balance, because
consciously closing the day removes the background hum of unfinished work.
Wirecutter named it best scheduling app in 2025. Complaints: **price** above all
($25/mo against Todoist's $5), plus an ageing UI, weak mobile, and thin project
tracking.

**The lesson.** Sunsama proves people will pay a premium for a *ritual that ends*.
The shutdown works because it is a **guaranteed, bounded, closable** event — not
because it is clever.

---

### Reclaim.ai — habit scheduling, solved commercially

Directly relevant: Compass just shipped habit cadence, and Reclaim has shipped the
commercial answer to the same problem.

**Onboarding.** Calendar-first and fast — connect Google/Outlook, declare working
hours, then create Habits. Value appears within one session because a habit
immediately becomes visible calendar blocks.

**Core daily loop.** Deliberately none. Reclaim is set-and-forget calendar *defense*:
you configure once and it keeps re-placing things around your meetings forever.

**Signature interaction.** The **Habit configuration panel**, which is exactly the
object Compass is missing. A Reclaim habit carries:
- a **frequency** (e.g. daily, N× per week),
- a **target duration** per instance / per week,
- an **ideal time window** ("mornings", "9am–12pm"),
- a **priority level**,
- and a **Time Defense** setting — how aggressively to protect the block against
  meetings, from "hold firm" to "move freely."

The habit then appears as *real calendar events*, and when a meeting collides,
Reclaim re-places the instance elsewhere in the window rather than dropping it.

**Pricing.** Cheap relative to the field. Free tier exists. Starter around **$8–10/mo**
(unlimited habits and tasks, integrations, unlimited calendar sync), Business
**$12–15/mo** (smart meetings, longer scheduling horizon, analytics), Enterprise
**$22/mo** (SSO/SCIM).

**Sentiment.** Broadly positive — automatic scheduling and effortless calendar
management dominate the praise. The counter-theme worth watching (and which I could
not verify in primary sources, so treat as untested) is that auto-placed habit blocks
can visually clutter a shared work calendar.

**The lesson, and the sharpest finding in this study.** Reclaim's insight is that
**a cadence is only meaningful once it occupies time.** "3× per week" is a scoring
rule; "Tuesday 7am, Thursday 7am, Saturday 9am, and it'll move if you get a meeting"
is a practice. Compass has built the scoring rule and stopped one step short.

---

### Akiflow — the keyboard instrument

**Onboarding.** Connect sources (30+: Gmail, Slack, Notion, Todoist, Asana, Jira…),
then learn the command bar. Steeper than Sunsama, aimed at power users.

**Core daily loop.** **Universal Inbox → triage → time-block.** Everything from every
tool lands in one inbox; you process it keyboard-only into either a date or the
calendar; optional **Daily Rituals** add a morning plan and evening shutdown on the
Sunsama model.

**Signature interaction.** The **command bar** — capture, triage and time-block
without touching the mouse. Second: **task list left, calendar right, drag task onto
slot**; the block two-way syncs to Google/Outlook.

**Pricing.** $34/mo standard, from $19/mo annual. **No free tier** — reviewers note
you must be certain scheduling is your actual bottleneck.

**Sentiment.** Power users love the speed and the single inbox. Complaints: price
with no free tier, and the learning curve.

**The lesson.** The command bar is not a power-user luxury; it is the **capture
latency** fix. The gap between "I thought of it" and "it's in the system" determines
whether a system gets used at all.

---

### Amie — the aesthetic instrument

**Onboarding.** Light, calendar-first.

**Signature interaction.** **Drag a todo onto the calendar and it becomes a block** —
todos and events living in one visual surface — plus natural-language entry and quick
capture, all wrapped in a design people describe as colourful, modern and fast.

**Sentiment.** Praise is overwhelmingly about *feel* — it is the app people call
beautiful. Hard usage sentiment was thin in research; this entry is impressionistic.

**The lesson.** Amie is the proof that in this category **delight is a differentiator
on its own**, and it is the competitor whose positioning is closest to Compass's —
selling a mood, not a throughput metric.

---

### Notion Calendar (ex-Cron) — the minimal keyboard calendar

**Onboarding.** Nearly none. Connect Google, and you have a working calendar in under
a minute. Best time-to-first-value in the study.

**Core daily loop.** Just: look at the day. It is a calendar, deliberately.

**Signature interaction.** **Keyboard-first navigation with single-key shortcuts** —
`1`–`9` to set how many days are shown, `D`/`W`/`M` to switch Day/Week/Month, `T` for
today, plus shortcuts for create and search. Combined with a famously minimal, fast,
well-crafted interface.

**Pricing.** Free.

**Sentiment.** Loved for speed, restraint and craft. Criticised for shallow task
integration (its Notion-database tie-in is weaker than the Cron faithful hoped).

**The lesson.** **Single-letter view switching is nearly free to build and reads as
craft.** It is the cheapest possible "this app respects me" signal.

---

### Structured & Tweek — the surfaces for everyone else

**Structured.** A **timeline of the day**: a list view laid over a vertical time
spine, so the day is a shape you can see rather than a list you must interpret.
Minimal, no project management, no dependencies. **$29.99 one-time** or $1.49/mo —
the only non-subscription in this study. Reviewers: "the bare minimum to plan your
day well," praised for clean design and singular focus.

**Tweek.** A **paper weekly planner**: seven columns, drag-and-drop, auto-rollover of
undone items, plus "Someday" columns off to the side. Free tier is genuinely usable
(2 calendars, 3 Someday columns, drag-and-drop, auto-rollover, basic recurrence);
Premium **$4.17/mo annual** adds calendar sync, subtasks, attachments, reminders.
Explicitly for minimalists who *do not want* subtasks and reminders.

**The lesson for Compass.** These are the two apps whose *audience* most overlaps
Compass's non-astro half — rhythm-curious professionals who will never configure a
priority scheme. Both win on one idea: **the plan is a picture, not a list.** And both
make **auto-rollover** table stakes: an undone thing moves itself forward without
guilt or ceremony.

---

### Todoist & Fantastical — natural-language capture

**Todoist Quick Add.** You type `Pick up friend Thursday 8am #Errands p1` and, **as
you type, Todoist highlights in red the fragments it has understood.** That live
highlight is the whole trick: it is a *contract preview*. You can see the parse before
you commit, so you learn the syntax by watching it work and you never wonder what the
app heard. Widely described as the easiest task entry in the category.

**Fantastical.** The same idea for events — type it the way you'd say it, watch it
resolve into a structured event with date, time, duration, location, invitees.

**The lesson.** The magic is not the parser. **The magic is showing the parse before
commit.** Compass's Planner already does this at document scale (parse → editable
cards → weave); it does none of it at single-line scale.

---

## Part A — Pattern-by-pattern comparison

Severity: **P0** damages the core loop · **P1** costs real users · **P2** polish.

| # | Pattern | Best in class | What Compass does today (file evidence) | Gap |
|---|---|---|---|---|
| 1 | **Auto-placement of tasks into time** | Motion | **Built, and better.** `components/Planner.tsx` — paste a dump → `POST /api/plan/parse` → editable cards (element/estimate/energy/due) → `POST /api/plan/weave` → day-grouped proposal → `POST /api/plan/commit` (`routes/plan.ts:186,199,366`). Unlike Motion, nothing is written until you say so. | **None — ahead** |
| 2 | **Review-before-commit on an AI schedule** | *nobody* | `Planner.tsx:250-308` shows the proposal with per-item `tier`/`tierNote` and `rationale`, plus an "Couldn't place N" panel with reasons. | **None — ahead** |
| 3 | **Adjusting a proposed block** | Sunsama, Akiflow | **Drop-only.** `Planner.tsx:283` sets `dropped`; there is no move, no "try another window," no re-weave. Backend `PATCH /api/planning/windows/:id` (`routes/planning.ts:389`) exists and is **never called from the frontend**. | **P0** |
| 4 | **Habit cadence** | Reclaim | **Shipped.** `daily / most_days / weekly(N) / occasional` (`routes/habits.ts:36-44`), rolling-7-day window, `windowDone`/`windowTarget`/`cadenceMet`, per-cadence copy (`Habits.tsx:46-77`). The `occasional` tier ("tracked, never scored") is kinder than anything Reclaim ships. | **None — ahead on model** |
| 5 | **Habit occupies calendar time** | Reclaim | **Absent.** A habit stores `favoredElements`, `bestWindowType`, `favoredPlanets`, `solarAnchor` (`Habits.tsx:36-56`) — a complete timing signature — and never produces a single block. Cadence is a scoreboard, not a schedule. | **P0** |
| 6 | **Drag-to-schedule / drag-to-reschedule** | Akiflow, Amie, Tweek, Sunsama | **Zero.** A grep of the whole frontend for `draggable`, `onDragStart`, `onDrop`, `onDragOver`, `onPointerDown` returns **no matches at all.** | **P1** |
| 7 | **Command bar / global capture shortcut** | Akiflow | **Zero.** The *entire* frontend has one keyboard handler: `App.tsx:181`, `Cmd/Ctrl+Enter` and `Escape` inside QuickCapture's textarea. Nothing opens capture from the keyboard. `cmdk@1.1.1` is already in `package.json` and **unused**. | **P1** |
| 8 | **Keyboard view navigation** | Notion Calendar | **Zero.** `Calendar.tsx:1255,1388` has agenda/day/week/month as buttons only. | **P2** |
| 9 | **Natural-language capture** | Todoist, Fantastical | **Partial and misplaced.** QuickCapture (`App.tsx:131-208`) is multi-line, one task per line, with a `bestWindowType` dropdown — **no date parsing at all.** The NL intelligence exists but only behind the Planner's two-step AI (`/api/plan/parse`). Typing "call mom Thursday 3pm" into capture yields a task titled *"call mom Thursday 3pm"* with no date. | **P1** |
| 10 | **Live parse preview (the red-highlight contract)** | Todoist | Absent at line scale; present at document scale (Planner's card step). | **P1** |
| 11 | **Morning planning ritual** | Sunsama | Present but **wall-clock-gated**: RitualCard renders only before noon (`Today.tsx:773-774`), ignoring the chronotype the app collected. | **P1** |
| 12 | **Evening shutdown ritual** | Sunsama | Present but gated from 18:00 (`Today.tsx:773-774`); felt rating + journal render on Today **only in evening mode** (`Today.tsx:940-941`). Backfill lives in Log's ReflectComposer. There is **no deliberate re-homing of undone work** — the defining half of Sunsama's shutdown. | **P0** |
| 13 | **Auto-rollover of undone items** | Motion, Tweek | Absent. An unfinished task or planning window just sits in the past. | **P1** |
| 14 | **Capacity honesty ("you've planned 9h into a 6h day")** | Sunsama | Partial inverse: the weaver reports what it *couldn't* place (`Planner.tsx:290-298`) but never says the day is overfull before you commit. | **P1** |
| 15 | **Calendar write-back / subscribe feed** | all of them | **Read-only** in (`routes/googleCal.ts:139`) — but `GET /api/export/ical` (`routes/exportIcal.ts:30`) already renders tasks + planning windows as valid iCal, and `GET /api/tides/calendar.ics` (`routes/ical.ts:17`) also exists. **Neither is referenced anywhere in the frontend** — grep for `ical`/`.ics`/`webcal` in `src/` returns nothing. | **P0 (surfacing)** |
| 16 | **Click a slot to create** | all | Present — `EventModal` takes a `startHour` and POSTs a planning window (`Calendar.tsx:257-284`). | None |
| 17 | **Timeline-as-picture** | Structured | Present and strong — the 30-day QualityStrip tops Calendar (`Calendar.tsx:1417`), plus TideWater/tide charts. | None — ahead |
| 18 | **Onboarding time-to-value** | Notion Calendar | Good: 6 skippable slides → name → birth (with a true "Show me today →" skip) → chronotype → Today (`App.tsx:307-782`). Real zero-birth-data value. | **P2** |
| 19 | **Refusing a time** | *nobody* | Present and unique — election verdicts `strong/workable/caution/avoid` (`Launch.tsx:119-129`), per-rule receipts with `hard`/`soft`/`support` severity (`Launch.tsx:138-157`), and on `avoid` the "＋ Put it on my calendar" button **is not rendered** (`Launch.tsx:217`). | **None — the moat** |
| 20 | **Free tier that works** | Reclaim, Tweek, Notion Cal | Premium is scaffold that **defaults unlocked** (`lib/premium.ts`, `premium-context.tsx:11-13`); every beta tester has the full product. | **P1 (commercial)** |

**The shape of the gap.** Compass is *ahead* on intelligence (1, 2, 4, 17, 19) and
*behind* on mechanics (3, 5, 6, 7, 9, 13, 15). It has built the hard half. The cheap
half is missing, and the cheap half is what makes a tool feel alive.

---

## Part B — The 10 highest-value borrowings

Ranked by user impact × cheapness given what exists. Items 1–5 are mostly-built and
need surfacing; that is where the leverage is.

---

### 1. Surface the iCal feed as a live subscribe URL — *the calendar write-back you already shipped*
**Effort: 3–4 hours.**

**What it is.** Reclaim, Motion and Akiflow all put their blocks on your real
calendar. Compass can't write to Google — but it doesn't need to. A **subscribe**
feed is one-way sync in the other direction, and it is *already generated.*

**Why Compass.** Finding 9 of the month study: "Calendar integration has a hard
ceiling for exactly the personas who'd pay most" (Kenji, Marcus). OAuth verification
for compass.day is on the critical path to revenue and will take weeks. A webcal URL
takes an afternoon and lands 80% of the value: Compass's windows appear in Google
Calendar, Outlook, and Apple Calendar, refreshed automatically, with zero OAuth.

**Implementation.** `routes/exportIcal.ts:92` currently sets
`Content-Disposition: attachment` — which forces a one-time download. Add a
`?subscribe=1` mode (or a sibling route) that drops that header and adds
`Cache-Control` plus a stable `X-WR-CALNAME`. Then surface it: a "Subscribe in your
calendar" block in Settings and next to Calendar's Google chip
(`Calendar.tsx:381-457`), rendering `webcal://compass.day/api/export/ical?testerId=…`
with a copy button and three one-line how-tos. **Gate on the tester key being treated
as a bearer secret** — the month study already flags query-string credentials as a
pre-GA security issue (Part C #7); at minimum rotate-able, and don't ship this
without deciding that. Also fold in the classic voice: the feed should be named
"Compass — your windows," not "tides-events."

**Why it's #1.** Highest revenue-unblocking per hour in the entire list, and 95% of
the code is written.

---

### 2. Place habits on the calendar — *Reclaim's move, with Compass's reason*
**Effort: 2–3 days.**

**What it is.** Reclaim's core insight: a cadence only becomes a practice when it
occupies time. Turn `daily / most_days / weekly(N) / occasional` from a scoreboard
into placed blocks.

**Why Compass.** This is the single biggest "you already built it" in the codebase.
A habit carries `favoredElements`, `bestWindowType`, `favoredPlanets` and
`solarAnchor` (`Habits.tsx:36-56`) — a *richer* timing signature than any Reclaim
habit. `GET /api/tides/best-times?lens=<element>` already returns ranked windows.
`POST /api/planning/windows` already writes them. `lib/chronotype.ts` already filters
to waking and free hours. Every part exists; nothing connects them.

And the astrological layer makes this **better than Reclaim, not equivalent**:
Reclaim places your run at 7am because the calendar is empty. Compass can place it at
7am on Tuesday because that's a fire window and a run is a fire thing — and *say so*.

**Implementation.** New `POST /api/habits/:id/place` that takes the habit's cadence
target for the coming rolling window, calls the same `best-times` logic
`ScheduleSuggest.tsx:62-89` uses (element lens + `isWaking` + `isWithinFreeWindow`,
soonest-first), and writes N planning windows via the existing `planningWindows`
insert in `routes/planning.ts:369`. On the client, add a "Find its times this week"
action to each habit row in `Habits.tsx` reusing `<ScheduleSuggest kind="habit">`
(`ScheduleSuggest.tsx:27`) but returning N slots instead of one. Blocks flow into
Calendar for free — Calendar already reads
`/api/planning/windows?all=1` (`Calendar.tsx:1293`).

**Guardrail (Part C applies).** Offer, never impose. Placement must be a tap, the
proposal must be reviewable, and a missed instance must *not* auto-reschedule
aggressively — see Part C #1.

---

### 3. Make the Planner's review step movable, not just droppable
**Effort: 1–1.5 days.**

**What it is.** Sunsama and Akiflow both let you grab a proposed block and put it
somewhere else. Compass's review step lets you delete an item or nothing.

**Why Compass.** This is the exact seam where Motion loses trust and Compass could
win it. A user who disagrees with one placement currently has to drop it and re-run
the whole weave, or drop it and schedule it by hand elsewhere. That converts a
delightful proposal into a chore, and it undercuts the app's whole "nothing is
scheduled until you say so" promise — consent without adjustment isn't much consent.

**Implementation.** In `Planner.tsx:261-287`, add a "move" affordance beside the
existing ✕ that opens the *next two or three ranked windows for that item's element*
— data the weaver already computed server-side; return the runners-up from
`/api/plan/weave` in `routes/plan.ts:199` rather than discarding them. Picking one
mutates the local `result.planned[idx]` before commit; no new persistence needed
because nothing is written until `/api/plan/commit`. Bonus half-hour: a "re-weave the
rest around this" button that re-posts with the moved item pinned.

**Why it ranks high.** Pure frontend + one extra field in an existing response, and it
converts the Planner from a take-it-or-leave-it oracle into a collaborator.

---

### 4. A command bar (`Cmd+K`) over the actions that already exist
**Effort: 1–1.5 days.**

**What it is.** Akiflow's signature. One keystroke to capture, navigate or ask.

**Why Compass.** Two reasons specific to this codebase. First, capture latency: today
you must *see and click* a button (`App.tsx:984`) to record a thought — and the month
study's Rachel (ADHD freelancer) churned in week 3 on scheduling friction. Second,
**`cmdk@1.1.1` is already a dependency and completely unused**, so the install cost is
zero and the bundle cost is already paid.

**Implementation.** New `src/components/CommandBar.tsx` using `cmdk`, mounted once in
`App.tsx` beside the existing `{capture && …}` render at `App.tsx:930`. A single
global `keydown` listener (the app currently has **none**) for `Cmd/Ctrl+K`. Commands
map to functions that already exist: `setCapture(true)`, `dumpToPlanner(text)`
(`App.tsx:864`), `setView(...)` over the four `TOP_TABS` (`App.tsx:108-113`) plus
`planets`/`settings`, open Ask, open Plan → Begin. Typing free text with no match
offers "Capture this" and "Send to the Planner."

**Character note.** Keep the placeholder in the app's voice — "what's on your mind?" —
not "Type a command." The command bar should feel like a ship's speaking tube, not an
IDE.

---

### 5. Live natural-language parse in Quick Capture — Todoist's red highlight
**Effort: 1–2 days.**

**What it is.** Type `call mom Thursday 3pm`, watch `Thursday 3pm` light up as you
type, hit enter, get a task dated correctly.

**Why Compass.** Today capture is honest but dumb: one task per line, a
`bestWindowType` dropdown, and **no date parsing whatsoever** (`App.tsx:141-164`).
Meanwhile the app already has the smartest parse in the category behind
`/api/plan/parse` — it's just locked behind a heavyweight two-step flow. The Todoist
lesson is that the parse is worth little unless you can **see it before you commit**,
and Compass's own Planner already proves the team believes this (the editable-card
step is a parse preview at document scale).

**Implementation.** Two halves, ship the first alone if needed.
- *Local, cheap:* a small `src/lib/nlDate.ts` handling the 90% cases — `today`,
  `tomorrow`, weekday names, `next week`, `in 3 days`, `at 3pm`, `~45m`/`2h`.
  `date-fns@3.6.0` is already a dependency (currently used only in `Log.tsx`).
  Highlight the matched substring inside the textarea with an overlay, in the app's
  accent rather than Todoist's red.
- *Server, optional:* debounce a call to `/api/plan/parse` for one line and show the
  element dot + estimate it inferred as a preview chip.

Strip the matched fragment from the title on submit and pass `dueDate` /
`estimatedMinutes` to `POST /api/tasks`.

---

### 6. Sunsama's shutdown: deliberate re-homing of undone work
**Effort: 1.5–2 days.**

**What it is.** The most-praised interaction in the entire competitive set. At day's
end you don't just rate the day — you look at what didn't happen and **decide where
each thing goes**: tomorrow, a named day, or off the list.

**Why Compass.** Compass has the reflective half (felt rating, journal, Log) and none
of the *closing* half. Undone tasks and passed planning windows simply rot. This is
the missing piece that would make Compass's evening loop equal to the best in the
category — and it is philosophically native: deferral-as-choice is the productivity
expression of "not now," which is already the app's signature idea (Part D).

**Implementation.** Extend the evening RitualCard in `Today.tsx:773-774,940-941` with
a "What didn't land" section listing today's incomplete tasks (`GET /api/tasks`) and
un-completed planning windows (`GET /api/planning/windows?date=…`,
`routes/planning.ts:353`). Each row gets three taps: **Tomorrow** ·
**Find it a better time** (reuse `<ScheduleSuggest>`) · **Let it go**. Tomorrow uses
the already-unused `PATCH /api/planning/windows/:id` (`routes/planning.ts:389`);
"Let it go" uses `PATCH /api/tasks/:id`.

**Voice guardrail.** "Let it go" must be a first-class, unpunished option. The month
study's Jess (flare week) and Dan (empty ledger) are the test: this screen must never
read as a debt statement. Copy in the existing register — "three things waited. Where
do they go?"

---

### 7. Auto-rollover, quietly
**Effort: 4–6 hours.**

**What it is.** Tweek's and Motion's shared table stake — an undone thing moves itself
forward rather than accumulating as visible failure.

**Why Compass.** Cheap, and it removes a guilt surface, which is on-brand. Motion's
version is praised even by its critics ("it keeps moving it forward until you do it").
Tweek makes it a headline free-tier feature.

**Implementation.** Server-side, in the `GET /api/tasks` read (`routes/tasks.ts:16`)
or a small daily sweep: a task with a past `dueDate` and `done !== "true"` surfaces
under today with a `rolled` flag and a day count. Client renders it in `Tasks.tsx`
with a soft marker, not a red one. Explicitly **do not** roll planning windows — a
window is a *moment*, and silently moving a moment is exactly the Motion failure
Part C warns against; windows go through #6's deliberate re-homing instead.

---

### 8. Notion Calendar's single-key view switching
**Effort: 2–3 hours.**

**What it is.** `D`/`W`/`M`/`A` to switch view, `T` for today, `←`/`→` to page.

**Why Compass.** The cheapest craft signal available. Calendar already holds
`calView` state and the paging functions (`Calendar.tsx:1255,1345-1351,1388`) — this
is one `useEffect` with a `keydown` listener that no-ops when an input is focused.
Nice-to-have alone; ship it in the same pass as #4 so the app gains a coherent
keyboard story in one release rather than two.

---

### 9. Capacity honesty in the Planner — Sunsama's overcommitment warning
**Effort: 4–6 hours.**

**What it is.** Sunsama tells you you've planned nine hours into a six-hour day
*before* you commit. Compass currently only tells you afterwards, and only about what
it failed to fit ("Couldn't place 3").

**Why Compass.** Motion's #1 complaint across every review site is that it **packs
the day too tightly with no slack for the unplanned**. Compass is about to make the
same mistake with better manners unless it says so out loud. And "this week is
already full — here's what I'd leave out" is the most Compass-flavoured sentence
imaginable: it's the "not now" thesis applied to volume rather than timing.

**Implementation.** In `Planner.tsx`'s step-3 header (`Planner.tsx:252-256`), sum
`estimatedMinutes` per day from `byDay` and compare against the waking window derived
from `profile.chronotype` (`Planner.tsx:46`) minus the `busy` array already fetched
from Google Calendar (`Planner.tsx:77-87`). Render one line per overfull day. Turn
the existing "unplaced" panel from an apology into a judgement: "I left these out on
purpose."

---

### 10. Structured's timeline as the Today spine
**Effort: 2–3 days.**

**What it is.** Structured's whole product: today rendered as a vertical time spine
with your commitments laid on it, so the day is a *shape* rather than a list.

**Why Compass.** This is the borrowing that most flatters what Compass already has.
The app owns something no competitor does — a continuous quality curve across the day
(TideWater, the tide chart, planetary hours). Structured's spine plus Compass's curve
is a picture of the day *with weather on it*: the good stretches literally visible as
shape, your blocks sitting in or out of them. It also directly serves the month
study's Finding 8 (the education layer is unreachable for the modal mobile user) —
the timeline teaches the sky by showing it, requiring no tab.

**Implementation.** A new `components/DaySpine.tsx` composing the existing
`TideWater.tsx` render with today's planning windows
(`GET /api/planning/windows?date=…`) drawn as blocks positioned against the same time
axis. Place it in `Today.tsx` under `uiDensity` control (`lib/preferences.ts:111`) —
and per Part D of the month study, **replace** existing blocks rather than adding a
fifteenth. This is the most speculative item here; prototype before committing.

---

### The ranking, in one glance

| # | Borrowing | Effort |
|---|---|---|
| 1 | Surface the iCal feed as a live webcal subscribe URL | 3–4 h |
| 2 | Place habits on the calendar from their cadence | 2–3 d |
| 3 | Make Planner review items movable, not just droppable | 1–1.5 d |
| 4 | `Cmd+K` command bar over existing actions (cmdk already installed) | 1–1.5 d |
| 5 | Live natural-language parse preview in Quick Capture | 1–2 d |
| 6 | Shutdown ritual: deliberate re-homing of undone work | 1.5–2 d |
| 7 | Quiet auto-rollover for tasks (never windows) | 4–6 h |
| 8 | Single-key calendar view switching | 2–3 h |
| 9 | Capacity honesty before commit in the Planner | 4–6 h |
| 10 | Structured-style day spine with the tide curve on it | 2–3 d |

**Total: roughly 11–15 working days** for the whole list. Items 1, 7, 8 and 9 together
are under two days and cover four separate competitor signatures.

---

## Part C — What NOT to copy

Compass is deliberately not Motion. Three patterns would do real damage.

### 1. Silent rescheduling — Motion's core mechanic
**Never import this.** Motion's defining behaviour is that the AI moves your work
without asking, continuously. It is also the source of its two most durable
complaints: days packed with no slack, and the trust collapse that follows a bad
move you didn't authorise.

For Compass the damage is worse than for Motion, because Compass's placements make a
*claim*. A Motion block that moves is a logistics update. A Compass block that moves
silently is the app saying "actually Thursday 2pm is the right moment for this" and
then, unprompted, "no, Friday 4pm" — the authority evaporates on the second move. The
whole point of `Planner.tsx`'s three-step flow and the "Nothing is scheduled until you
say so" copy (`Planner.tsx:135`) is that placement is a *proposal*. Item B2 (habit
placement) is the live risk here: Reclaim re-places a missed habit automatically, and
Compass must not. It should offer, once, and let a missed instance stay missed —
because `occasional` ("tracked, never scored") already proves the team knows that a
missed thing is sometimes just a missed thing.

### 2. The streak, the score, and the guilt ledger
Motion's completion analytics, Reclaim's productivity stats and every habit tracker's
unbroken chain all run on the same engine: make the user feel the debt. Compass has
already refused this deliberately — the `occasional` cadence exists precisely so a
practice can be tracked without being scored (`Habits.tsx:50`), and `cadenceLabel`
reports "3 of 5 this week," not "you're behind" (`Habits.tsx:61-77`).

The pressure point is real and near: the queued "wake behind" progress strip is one
naive implementation away from being a guilt surface, and the month study says so
explicitly — for a persona in a flare week or a skeptic with an empty ledger, a bare
progress strip is the exact thing the app has refused to be. Any borrowed
progress-visualisation must ship with its quiet state designed **first**.

More fundamentally: the streak assumes linear time. Compass's entire thesis is that
time is not uniform — that a bad week is sometimes the sky's fault and not a moral
failure. A streak counter re-imports the flat-time assumption the product exists to
deny.

### 3. Full-capacity optimisation — "fit everything in"
Every autoscheduler's implicit goal is throughput: find a home for all N tasks. That
is why Motion overpacks. Compass's Planner already resists this — it reports what it
*couldn't* place and suggests a longer horizon (`Planner.tsx:290-298`) — and that
restraint should be strengthened (item B9), never traded away.

The reason is commercial as much as philosophical. Compass's converting moment,
per the month study's Finding 10, is **refusal**: 11 of 12 personas used Begin for a
real decision, four changed real-world dates, and the paths that converted were the
Mercury-retrograde hard block, the tier cap, and "no clean window in this span" — not
the great-tier windows. `Launch.tsx:217` withholds the "put it on my calendar" button
entirely on an `avoid` verdict. **That withheld button is the product.** An
optimiser's instinct is to always offer *something*; the moment Compass does that, it
becomes a worse Motion with astrology skinned on top.

**Two smaller don'ts.** (a) Don't import Akiflow's 30-source universal inbox — it
turns a rhythm instrument into middleware and imports every integration's maintenance
burden. (b) Don't copy Sunsama's mandatory guided ritual as a *gate*; the month study
already found Compass's wall-clock ritual gating locks out night-shift, toddler-evening
and late-rising users (Finding 3). Rituals should be available, not enforced.

---

## Part D — The one journey Compass should own

### Thesis

Every tool in this study answers **"when can this fit?"** Compass is the only one that
can answer **"when is this actually right — and should it happen at all?"** Nobody
else in the category can decline.

### The argument

**All of them optimise for fit, and fit is a solved, commoditised problem.** Motion
finds the next open slot. Reclaim finds an open slot inside your ideal window.
Sunsama makes *you* find the slot, thoughtfully. Akiflow makes finding it fast. They
differ on who does the searching and how nice it feels; they agree completely on the
objective function, which is *emptiness*. Ask any of them "is Thursday a good day to
send this proposal?" and the honest answer is: **they have no opinion.** Thursday is
good if Thursday is free. They cannot distinguish a Thursday from a Tuesday except by
what is already on it, because a calendar's only input is other calendar entries.

**Compass has a second input, and it is the whole business.** It knows something
about the *quality* of a moment that is independent of your availability. Whether you
believe the mechanism or treat it as a well-constructed randomiser with good taste,
the product consequence is identical and unavailable to competitors: Compass can
distinguish two equally-empty Thursdays, and it can rank them for *this particular
thing* — a launch, a hard conversation, a first draft.

**And it can refuse.** This is the part nobody else structurally can. Refusal
requires an external standard: to say "not now" you need a reason that isn't "you're
busy." Motion cannot refuse — it has no grounds. The most a fit-optimiser can say is
"your calendar is full," which is a report about you, not a judgement about the
moment. Compass says "against the current," shows the rule that failed with its
severity (`Launch.tsx:138-157`), and **withholds the scheduling button entirely**
(`Launch.tsx:217`). That is a product taking a position and accepting the cost of it.

**The evidence that this is the wedge is already in-house.** The month study found
that eleven of twelve personas used Begin for a real decision, that four changed
real-world dates because of it, and — the crucial detail — that the *refusal* paths
converted better than the great-tier windows. Users trust a tool that can say no.
Nothing else in the category has ever had to earn that trust because nothing else has
ever been able to say it.

**Concretely, the journey to own — "is this the moment?"** A single flow, reachable
from anywhere (see item B4), that takes a *thing* — send the proposal, have the
conversation, publish, sign, begin — and returns one of four answers with receipts:
**now** · **a better time is Thursday 2pm** · **against the current, here's why** ·
**not this month, ask me again after the 14th.** No competitor can render answer four.
Most cannot render answer three. That flow is 80% built across `Launch.tsx`,
`routes/election.ts` and `lib/electionEngine.ts`; what it lacks is a front door, a
name, and a keepable artifact — the month study notes users wanted to *text* and
*post* the verdict, and `/api/studio/best.png` already exists server-side with no UI.

**Why this is defensible.** Motion could add astrology in a sprint and it would be
absurd, because refusal is not a feature you bolt on — it is a stance the rest of the
product must be built to support. Compass has spent the whole build supporting it:
the four-verdict scale, the per-rule receipts with hard/soft/support severity, the
retrograde caps, the honest "no clean window in this span." The competitors' pricing
pages all promise *more done*. Compass is the only one that can promise **the right
moment, or none** — and the month study says that is exactly what people paid
attention to.

---

## Part E — Onboarding

### How the field does it

| App | First-run | Time to value | Requires up front |
|---|---|---|---|
| Notion Calendar | connect Google | **< 1 min** | a Google account |
| Structured | drop in a few items | ~2 min | nothing |
| Tweek | type into a column | ~1 min | nothing |
| Reclaim | connect calendar → hours → first habit | ~10 min | calendar |
| Amie | connect calendar | ~2 min | calendar |
| Sunsama | **guided ritual walkthrough** + integrations | ~15 min, and it feels worth it | calendar + a task source |
| Akiflow | connect 30+ sources, learn the command bar | ~30 min | sources + patience |
| Motion | calendar + import tasks + working hours + first AI schedule | **hours** | your whole working life |

The pattern is unambiguous: **time-to-first-value tracks retention, with exactly one
exception.** Sunsama's onboarding is long and its users love it — because it is not
configuration, it is *teaching a practice*. Motion's is long and its users resent it —
because it is pure setup with no payoff until the end.

**The rule this yields: a long onboarding is only forgiven when each step delivers
meaning rather than collecting data.**

### What Compass does today

Six skippable intro slides → name → birth details (with a genuine "Show me today →"
skip and an honest unknown-birth-time checkbox) → chronotype → Today
(`App.tsx:307-782`). Zero-birth-data value is real. `uiDensity` defaults to
`essential` (`lib/preferences.ts:111`), so the first Today is decluttered.

**This is already better than most of the field**, and materially better than Motion.
The dual-path problem — "just show me today" versus the full personal layer — is
already solved structurally. Four refinements, not a rebuild.

### Recommendations

**1. Make the first screen a reading, not a slide.** Six slides before any value is
Motion's mistake in miniature. Compass can compute a real reading for today from
nothing but IP-derived location — no name, no birth data, no chronotype. **Lead with
it.** Show today's actual weather first, with the intro material collapsed to a single
"what am I looking at?" affordance. Sunsama's lesson is that teaching is welcome *while
value is already on screen*, not as a toll gate before it.
*Effort: 3–4 hours, mostly re-ordering `App.tsx:307-782`.*

**2. Keep the skip, but make the second path an earned upgrade rather than a fork.**
Right now birth data is a fork in onboarding. It should be a *door that opens later*,
prompted at the moment its absence is felt — when the user first taps something
personal (a Guiding Star, Currents, a transit), the prompt reads: "this one needs your
birth details — two minutes." Reclaim does exactly this with permissions. It converts
better than an up-front ask, and it means the no-birth-data user (the month study's
Alex) is never carrying a hole they can see.
*Effort: 4–6 hours.*

**3. Ask for one intention, and use it immediately.** Sunsama's onboarding works
because it ends in a *plan*, not a settings object. Compass collects name and
chronotype and lands on a generic Today. Instead, close onboarding with one question —
*"what's one thing you're trying to time well right now?"* — pipe the free text
straight into `/api/associate` (which already reads text into an element and window
type, `routes/associate.ts`), and land the user on a **first reading about their own
thing**. That is the shortest path from install to the moment the product is *for*
them.
*Effort: 1 day. Highest-leverage onboarding change here.*

**4. Defer chronotype, but actually honour it.** Chronotype is a good question asked
too early — it is configuration before the user knows why it matters. Worse, the month
study found the app collects it and then **ignores it**: the ritual loop gates on wall
clock (`Today.tsx:773-774`), which locks out night-shift and late-rising users at
exactly the hours they'd close the loop. Either move it to first-evening ("when does
your day usually end?" asked *when* the day is ending) or wire it into `ritualMode`
first. Collecting a preference and disregarding it is worse than not asking.
*Effort: 2–3 hours to move; the wiring is a separately-tracked P0.*

**5. Don't add an onboarding tour for the keyboard layer.** When items B4/B5/B8 ship,
the temptation will be a shortcuts tour. Notion Calendar teaches its shortcuts by
hinting them in place — a small `⌘K` glyph on the capture button. Discovery in
context; nothing added to first run.

### The onboarding Compass should have

> **Screen 1** — today's actual reading, computed from location alone. One line:
> "this is today's weather. Want it to know you?"
> **Screen 2 (skippable, real skip)** — birth details, with the honest unknown-time
> checkbox.
> **Screen 3** — "what are you trying to time well right now?" → a real reading about
> that thing.
> **Then** — Today. Chronotype at first evening. Everything else on demand.

Three screens, value on the first, personal value by the third.

---

## Appendix — Sources

- Motion: [Efficient App review](https://efficient.app/apps/motion) · [Saner.ai review](https://www.saner.ai/blogs/motion-reviews) · [Capterra](https://www.capterra.com/p/214264/Motion/reviews/) · [Morgen pricing breakdown](https://www.morgen.so/blog-posts/motion-pricing) · [alfred_ pricing](https://get-alfred.ai/blog/motion-pricing)
- Sunsama: [Daily planning & shutdown](https://www.sunsama.com/features/daily-planning-and-shutdown) · [User manual — daily planning](https://help.sunsama.com/docs/daily-planning) · [Pricing](https://www.sunsama.com/pricing) · [Pricing manifesto](https://help.sunsama.com/docs/billing/pricing-manifesto/) · [Price-rise analysis](https://www.usecarly.com/blog/did-sunsama-raise-prices/) · [Calmevo review](https://calmevo.com/sunsama-review/)
- Reclaim.ai: [reclaim.ai](https://reclaim.ai/) · [G2 pricing](https://www.g2.com/products/reclaim-ai/pricing) · [Morgen pricing breakdown](https://www.morgen.so/blog-posts/reclaim-pricing) · [Efficient App review](https://efficient.app/apps/reclaim) · [ClickUp review](https://clickup.com/learn/topic/productivity/tools/reclaim/)
- Akiflow: [Efficient App review](https://efficient.app/apps/akiflow) · [Saner.ai review](https://blog.saner.ai/akiflow-reviews/) · [alfred_ pricing](https://get-alfred.ai/blog/akiflow-pricing)
- Amie / Notion Calendar: [Efficient App comparison](https://efficient.app/compare/amie-vs-notion-calendar) · [Notion Calendar review](https://efficient.app/apps/notion-calendar) · [Matthias Frank tutorial](https://matthiasfrank.de/en/notion-calendar/)
- Structured: [structured.app](https://structured.app/) · [AppleInsider review](https://appleinsider.com/articles/23/01/09/structured-301-review-no-frills-attractive-daily-planner) · [Dave Swift review](https://daveswift.com/structured/)
- Tweek: [tweek.so](https://tweek.so/calendar) · [Morgen — Tweek vs TeuxDeux](https://www.morgen.so/blog-posts/tweek-vs-teuxdeux)
- Todoist / Fantastical: [The Sweet Setup — Todoist NL](https://thesweetsetup.com/using-natural-language-with-todoist/) · [Calmevo NL guide](https://calmevo.com/todoist-natural-language-input-guide/) · [The Sweet Setup — Fantastical NL](https://thesweetsetup.com/natural-language-guide-for-fantastical/) · [Flexibits help](https://flexibits.com/fantastical/help/adding-events-and-tasks)

**Internal cross-references:** `USER-SIMULATIONS-2026-07-29-MONTH.md` (Findings 3, 8,
9, 10; Part C P0s; Part D on the queued changes), `DESIGN.md` §1 anti-goals,
`PAYING-PERSONAS-2026-07-29.md` Part A ranks 1 and 3, `DESIGN-BRIEF-2026-07-27.md`.
