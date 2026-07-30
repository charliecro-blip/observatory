# Competitive UX study — 2026-07-29

**Question:** what have the productivity/scheduling apps already solved that Compass
is re-solving badly or not at all — and which of those solutions can Compass import
without becoming them?

**Method.** Part 1 is web research on Motion, Sunsama, Reclaim.ai, Akiflow, Amie,
Notion Calendar, Structured, Tweek, Todoist and Fantastical. Part 2 grounds every
claim about Compass in code read on 2026-07-29 at commit `e0b6cff`, branch
`feat/tides-app`.

**Research caveats.** Direct page fetches were blocked for most vendor domains, so
competitor detail is synthesised from search results across vendor help centres
(help.reclaim.ai, help.sunsama.com, usemotion.com/help), G2/Capterra/Trustpilot
review summaries, and comparison blogs. Several of those blogs (Morgen, Saner.ai,
alfred_, Efficient App) are themselves competitors publishing comparison content;
their negative framing of Motion and Sunsama is discounted accordingly. **Amie
resisted research** — available writing is design commentary rather than usage
sentiment, so its entry is impressionistic and thin. Where sources conflicted
(Motion's exact tier prices, Reclaim's Outlook parity and mobile app) the conflict is
flagged inline rather than smoothed over.

**One correction to prior internal docs, recorded up front.**
`USER-SIMULATIONS-2026-07-29-MONTH.md` Finding 9 states there is "no webcal subscribe
URL surfaced for outbound." **That is now stale.** `pages/Settings.tsx:1183-1237`
(`ExportSection`) surfaces a live `webcal://` subscribe link with a copy button, a
selectable monospace URL, a plain-language how-to, a "keep it to yourself" warning,
*and* a separate one-time `.ics` download — with a code comment correctly explaining
why a snapshot is not a subscription. Compass's outbound calendar story is materially
better than the study believed. (A first pass of this analysis repeated the stale
finding because a grep for `ical` was matching the word *vertical*; the recommendation
below is scoped accordingly.)

---

## Part 1 — What the field has actually solved

### The organising question

Every product here is a position on one axis: **who decides when work happens.**

| | Who plans | Ritual cost | Trust failure mode |
|---|---|---|---|
| **Motion** | the AI, continuously | ~0 min/day | the calendar churns → "AI calendar anxiety" |
| **Reclaim** | the AI, inside human-authored rules | ~0 min/day | calendar clutter → you stop trusting the calendar |
| **Sunsama** | the human, guided | 15–30 min/day | ritual fatigue → you stop opening it |
| **Akiflow / Notion Cal / Amie** | the human, fast | ~0 | none — they just don't decide anything |
| **Structured / Tweek** | the human, casually | ~2 min | none — they don't try |

Compass today is a **ritual** product with an **autoscheduler** bolted on (the
Planner) and none of the **instrument's** speed. Most of what follows falls out of
that mismatch.

---

### Motion — the autoscheduler

**Onboarding.** Marketing says two minutes; reviewers say otherwise. Sign up → email
verify → **calendar connect on the welcome screen** (Google or Outlook; this is what
makes auto-scheduling possible at all) → three personalisation questions → create
"buckets" (projects) → then the real configuration in Settings › Schedules: work
hours set by **dragging across a days × times grid**, break buffers, focus modes.
A hard constraint worth noting: **onboarding must be completed in a desktop browser**
before the desktop or mobile apps will work at all. Time-to-*useful* is hours, because
the AI is only as good as the durations, deadlines and priorities you enter. "Difficult
onboarding" and a steep learning curve are the most consistent structural complaints.

**Core daily loop.** Deliberately none. There is no planning ceremony — you wake and
the calendar is already built. An **AI Agenda** regenerates each morning showing
today's tasks, tomorrow's priorities and overdue items. Through the day Motion
rebalances continuously as meetings land or slip. There is no evening ritual;
unfinished work is silently re-slotted overnight.

**Signature interaction.** The **Auto-schedule toggle on a task**, and the reshuffle
it triggers. You supply duration, deadline, priority, and optionally **chunking rules**
(a 6-hour task split into 3 × 2h blocks). The magic moment is watching the calendar
re-lay itself when one thing changes — and that same animation is the source of the
trust problem below.

**Pricing.** No permanent free plan; 7-day trial, card required. **Pro AI $19/seat/mo
annual, $29 monthly** (7,500 AI credits). **Business AI $29/seat/mo annual, $49
monthly** (15,000 credits; adds dashboards, Gantt, time tracking, capacity planning).
"AI Employees" are a separate add-on. Sources disagree on exact figures — price has
risen more than once. The gating logic: individual scheduling is cheap, **team
visibility is the upsell.**

**Sentiment.** Praise: real time saved, "I don't have to decide what to do next,"
strong for stable predictable workloads. Complaints, and the standout is severe:
- **The trust collapse.** One reviewer reported Motion **rescheduled their task list
  eleven times in one day** and by 3pm they no longer knew what to work on.
  Productivity communities have a name for this — **"AI calendar anxiety."**
- Garbage-in-garbage-out fragility: slightly wrong estimates make the AI's choices
  "feel random."
- It breaks down for reactive workers — the plan disintegrates by mid-morning and you
  spend the day rescheduling instead of working.
- It **packs the day too tightly**, leaving no slack for unplanned work.
- UI "clunky for two years"; mobile "barely works"; desktop buggy; unreliable
  notifications; recurring-event glitches; billing/cancellation complaints on
  Trustpilot.

**The lesson.** Motion's failure is a *trust* failure, not an algorithm failure. When
the machine moves your work without asking and is wrong once, the calendar stops
being believable.

---

### Sunsama — the ritual

**Onboarding.** A **mandatory guided flow** — you cannot reach the workspace until
every step is done, the deliberate opposite of Motion's "two minutes." Name your task
tools → connect calendars → set up **Channels** (categories, so the rituals can report
where your time went) → set up **Objectives** (weekly priorities for work spanning
several days) → then it drops you straight into **your first daily planning session**,
connecting tool accounts in context. The first *plan* is the value, and you get it
inside onboarding. 14-day trial, no card. Reviewers consistently call the learning
curve low.

**Core daily loop.** The clearest in the category, and the closest thing to Compass's
ethos. Two bookends:

**Morning — "Plan your day" (`P`), 10–20 min**, guided in steps:
1. **Review yesterday** — what completed, what carried over, plus a gratitude prompt.
2. **Dump / import** — a panel surfaces tasks from every connected tool, plus emails,
   Slack messages, and already-scheduled events.
3. **Estimate time** — you must say how long each will take. This is the load-bearing
   step.
4. **Order and schedule** — arrange, drag onto the calendar to timebox, defer
   non-essentials by dragging into other day columns.
5. **Obstacles** — it shows the finished plan and asks what's in your way.

Throughout, Sunsama sums planned time against your **workload threshold**, shows a
predicted-workload timeline, and issues a **gentle overcommitment warning** when you
exceed it — plus what time you'd finish if you stuck to the plan.

**Evening — "Daily shutdown" (`O`), 5–10 min:**
1. Planned-vs-done review; each incomplete task is **carried to tomorrow, rescheduled
   to a specific date, or deleted**.
2. A **daily note** — one or two sentences, explicitly framed as building the
   work/life boundary.
3. A day review: work vs personal hours, tasks completed, events attended, measured
   against weekly Objectives.
4. Close the app. Stop working.

**Signature interaction.** Day columns in a Kanban, calendar on the right. **Drag a
task out of the Backlog into a day column and attach a time estimate** — and watch the
workload bar tell you the truth. The emotional payload is not the drag; it is the
**estimate forcing honesty**.

**Pricing.** **No free plan at all.** 14-day trial, no card. Raised prices in 2026 —
first increase in five years — from $16→**$20/mo annual** and $20→**$25/mo monthly**.
One individual plan plus enterprise; no team plan. Nothing is gated by tier: the gate
is simply the paywall. That is an unusual and confident bet — the ritual is worth $20
a month or you shouldn't be a customer.

**Sentiment.** Praise, and it is unusually emotional: the rituals themselves ("calm,"
"intentional," "deliberate"); **time-boxing makes people honest** — the most-repeated
line is that before Sunsama they built unrealistic lists and ended each day
disappointed; the **gentle** overcommitment warning is loved rather than resented
(tone matters); the shutdown ritual specifically credited with ending the workday for
remote workers. Complaints: **price, universally** ("$20/month for a to-do list"), the
absent free tier, the 2026 increase, a **planning horizon capped at ~2 weeks** when
users want monthly and quarterly containers, a dated UI, weak mobile, thin project
tracking, and the ~20 min/day manual tax that fans call the point.

**The lesson.** People pay a premium for **a ritual that ends**. The shutdown works
because it is guaranteed, bounded and closable — not because it is clever.

---

### Reclaim.ai — habit scheduling, solved commercially

The most directly relevant competitor: Compass just shipped habit cadence, and Reclaim
sells the commercial answer to the same problem.

**Onboarding.** Connect Google/Outlook (Reclaim *runs on* your calendar rather than
replacing it) → define **working hours** as hard boundaries → choose a **scheduling
mode: Proactive or Reactive** (an explicit aggressiveness dial at setup time — a
genuinely good idea) → add first Habits from **130+ templates**, with guidance to start
with 2–3. About 15 minutes; reviewers note the **P1–P4 priority system takes about a
week to internalise**.

**Core daily loop.** None, deliberately. Reclaim commits to full set-and-forget **with
no user sign-off** — a notable contrast with competitors that require approval before
changes take effect. When you do engage it's via the **Planner** (drag to reschedule,
lock, skip, log past work), the Google Calendar add-on, or Slack.

**Signature interaction — the Habit config form.** The canonical example from
Reclaim's own docs is the single best sentence in this study:

> "I want to eat lunch Monday–Friday, anytime between 11:30am and 2pm, for no less
> than 30m and no more than 1h, and ideally I'd like to do it at 12pm."

Five constraints in one plain-English rule.

**Habit cadence in detail** — the part Compass most needs to read:

- **Frequency:** daily · specific weekdays · weekly · monthly · **custom** (since
  Habits 2.0, "anything you can do in Google Calendar" — *2nd Friday of each month*).
  Separately, **"ideal days"** as a soft preference distinct from the hard rule.
- **Ideal window, in three layers:**
  1. **Scheduling window (hard)** — "anytime between 11:30 and 2." It will not go
     outside.
  2. **Ideal time (soft)** — one preferred point inside the window; it schedules as
     close as it can, else the next closest available time. Must overlap the window.
  3. **Duration min/max** — "no less than X, no more than Y." This lets a habit
     **compress rather than fail**: a 1h workout becomes 30m instead of vanishing.
     **This is the single most transferable idea in the entire study.**
- **Missed instances.** Auto-reschedules within seconds of being overbooked, unless
  locked. **Deleting the event from your native calendar = skip *that day only*** and
  try another day — deletion means "not now," not "never." Explicit Skip from Slack,
  the Calendar add-on, or the Planner. **Log past work** retroactively if you did it at
  a time Reclaim didn't schedule — it never accuses you of missing something you
  actually did.
- **Locks.** Manually dragging a habit locks it and stops auto-rescheduling.
  **Auto-lock** can run **between 1–2 AM** at the start of each day or week, freezing
  events so nothing shuffles underneath you. This is Reclaim's direct answer to
  Motion's trust problem: *if a system moves things automatically, it needs a moment
  where it publicly stops moving them.*
- **Priority:** P1 Critical → P4 Low, driving which item wins a contested slot.
- **Time Defense — a gradient, not a boolean.** Habits are written as **Free** so you
  stay bookable, then flip to **Busy** as the start time nears *or* the day fills.
  Reclaim weighs two variables: slack remaining in the scheduling window, and time
  remaining before start. Less slack on either → flips sooner. Per-habit setting, plus
  **"Always Free"** and **"Always Busy"** escape hatches and `#reclaim_free` /
  `#reclaim_busy` hashtags on any event.

**Pricing.** **Lite: free forever** — but capped at **1 habit**, 1 scheduling link, 2
calendars, and a **1-week scheduling range**. **Starter $10/seat/mo annual**
(unlimited habits and tasks). **Business $15**. **Enterprise ~$22**. The free tier is a
masterclass in demonstrate-then-frustrate: one habit proves the mechanic and is
simultaneously useless for restructuring a week, and the one-week horizon means you
can never see the benefit compound.

**Sentiment.** 4.8 on G2. **Habits is the standout feature** by consensus — "so lunch
is never overbooked" is the emblematic line. Also praised: Focus Time, hands-off
operation, and roughly half Motion's price with a real free tier. Complaints:
**calendar clutter is the #1 gripe** — Reclaim always writes to your *main* calendar
and **there is no way to view your schedule without the Reclaim-generated events**;
tasks scheduled at times you can't actually do them; **no real native mobile app**
(sources conflict — some describe a thin app, some none, all agree it's behind);
Outlook parity is disputed across 2026 sources; occasional ghost events.

---

### Akiflow — the keyboard instrument

**Onboarding.** Connect 30+ sources (Gmail, Slack, Notion, Todoist, Asana, ClickUp,
Jira), then learn the command bar. ~30 minutes; steeper than anything except Motion.

**Core daily loop.** **Universal Inbox → triage → time-block.** Everything from every
tool lands in one inbox; you process each item keyboard-only into a date or a calendar
slot. Two-way sync back to the source tool. Optional **Daily Rituals** add a morning
plan and evening shutdown on the Sunsama model.

**Signature interaction.** The **command bar** — capture, triage and time-block without
touching the mouse. Second: task list left, calendar right, **drag a task onto a slot**
and it becomes a block that syncs to Google/Outlook.

**Pricing.** $34/mo standard, from $19/mo annual. **No free tier** — reviewers note you
must be certain scheduling is your actual bottleneck.

**Sentiment.** Power users love the speed and the single inbox. Complaints: price with
no free tier, and the learning curve.

**The lesson.** The command bar is not a power-user luxury — it is the **capture
latency** fix. The gap between thinking of something and having it in the system
determines whether the system gets used.

---

### Amie — the aesthetic instrument

Light calendar-first onboarding. **Signature: drag a todo onto the calendar and it
becomes a block**, with natural-language entry and quick capture, in a design people
call colourful, modern and fast — including a Notion integration for dragging Notion
tasks onto the calendar. Praise is overwhelmingly about *feel*.

**Research quality note:** hard usage sentiment was thin; treat this entry as
impressionistic.

**The lesson.** Amie proves **delight alone is a differentiator** in this category, and
it is the competitor whose positioning is nearest Compass's — selling a mood rather
than a throughput number.

---

### Notion Calendar (ex-Cron) — the minimal keyboard calendar

**Onboarding:** connect Google. Under a minute — the best time-to-first-value here.
**Loop:** look at the day. It is a calendar, deliberately.
**Signature:** **single-key navigation** — `1`–`9` to set how many days are visible,
`D`/`W`/`M` for Day/Week/Month, `T` for today, plus create and search shortcuts —
inside a famously fast, minimal, well-crafted interface. **Free.** Loved for speed and
craft; criticised for shallow task integration.

**The lesson.** **Single-letter view switching is nearly free to build and reads as
craft.** The cheapest available "this app respects me" signal.

---

### Structured & Tweek — the surfaces for everyone else

**Structured.** A **timeline of the day** — a list laid over a vertical time spine, so
the day is a shape you can see rather than a list you must interpret. No project
management. **$29.99 one-time** or $1.49/mo — the only non-subscription here.
Reviewers: "the bare minimum to plan your day well."

**Tweek.** A **paper weekly planner** — seven columns, drag-and-drop, **auto-rollover**
of undone items, and "Someday" columns off to the side. Genuinely usable free tier;
Premium **$4.17/mo annual** adds sync, subtasks, attachments, reminders. Explicitly for
minimalists who *do not want* subtasks and reminders.

**The lesson.** These two serve the audience closest to Compass's non-astro half, and
both win on one idea: **the plan is a picture, not a list.** Both also make
**auto-rollover** table stakes — an undone thing moves itself forward without ceremony
or guilt.

---

### Todoist & Fantastical — natural-language capture

**Todoist Quick Add.** You type `Pick up friend Thursday 8am #Errands p1` and **as you
type, Todoist highlights in red the fragments it has understood.** That live highlight
is the whole trick: a **contract preview**. You see the parse before committing, you
learn the syntax by watching it work, and you never wonder what the app heard. Widely
called the easiest task entry in the category.

**Fantastical.** The same for events — type it as you'd say it, watch it resolve into a
structured event.

**The lesson.** The magic is not the parser. **The magic is showing the parse before
commit.**

---

### Six patterns worth naming

1. **Rules beat decisions.** Reclaim's model — the human authors constraints once, the
   machine solves inside them — is the most transferable idea in the set. Users forgive
   an algorithm that violates a *preference* far more readily than one that violates a
   *rule*, because they wrote the rule and can see why it lost.
2. **Graceful degradation beats binary success.** Min/max duration (compress, don't
   skip), delete-means-skip-today, retroactive logging. A bad day never reads as
   failure.
3. **Defense as a gradient.** Free→Busy hardening as the opportunity narrows is more
   sophisticated than any boolean.
4. **Auto-lock as trust infrastructure.** A system that moves things automatically
   needs a moment where it publicly stops.
5. **Forced honesty is Sunsama's emotional core** — and the *gentleness* of the warning
   matters as much as the warning.
6. **Free tiers are shaped to demonstrate-then-frustrate.** Reclaim's one habit and
   one-week horizon is the model; Sunsama's total absence of one is its most-cited
   weakness.

---

## Part A — Pattern-by-pattern comparison

Severity: **P0** damages the core loop · **P1** costs real users · **P2** polish.

| # | Pattern | Best in class | What Compass does today (file evidence) | Gap |
|---|---|---|---|---|
| 1 | **Auto-placement of tasks into time** | Motion | **Built, and structurally better.** `components/Planner.tsx` → `/api/plan/parse` → editable cards → `/api/plan/weave` → reviewable proposal → `/api/plan/commit` (`routes/plan.ts:186,199,366`). Only the *parse* is AI (one `gpt-4o-mini` call, capped at 30 tasks, with a line-split fallback); **the weave is fully deterministic ephemeris math** — three placement passes over per-day energy arcs, honouring chronotype waking hours, existing windows and GCal busy time. | **None — ahead** |
| 2 | **Review before commit** | *nobody* | `Planner.tsx:250-308` — day-grouped proposal, per-item `tier`/`tierNote` ("a great time for this" / "this time will do" / "swimming against the current — the only open water left"), rationale, and an "Couldn't place N" panel with reasons. Motion and Reclaim both commit without sign-off. | **None — ahead** |
| 3 | **Adjusting a proposed block** | Sunsama, Akiflow, Reclaim | **Drop-only.** `Planner.tsx:283` adds to a `dropped` Set. No move, no nudge, no re-run of one item. Backend `PATCH /api/planning/windows/:id` (`routes/planning.ts:389`) and `POST /api/planning/windows/:id/complete` (`:408`) exist and are **never called from the frontend.** | **P0** |
| 4 | **Habit cadence model** | Reclaim | **Shipped, and kinder.** `daily / most_days / weekly(N) / occasional` (`routes/habits.ts:36-44`), rolling-7-day window deliberately not calendar weeks (no Monday cliff), `windowDone`/`windowTarget`/`cadenceMet`, per-cadence copy that never reports a shortfall for `occasional` (`Habits.tsx:46-77`). Plus server-computed **resonance** scoring against the live sky. | **None — ahead on model** |
| 5 | **Cadence occupies calendar time** | Reclaim | **Absent.** A habit stores `favoredElements`, `favoredPlanets`, `bestWindowType`, `solarAnchor` (sunrise/noon/sunset, with the real solar time computed server-side) — a *richer* timing signature than any Reclaim habit — and generates **zero** blocks. Scheduling is one-off via `ScheduleSuggest` only. `planningWindows` has **no recurrence, no RRULE, no series concept.** | **P0** |
| 6 | **Graceful degradation** (compress, skip-today, log-past-work) | Reclaim | Absent as a scheduling concept. Compass has the *philosophy* (`occasional` = "tracked, never scored") without the mechanics. A window is done or it isn't; there is no "I did it, just later." | **P1** |
| 7 | **Drag-to-schedule / reschedule** | Akiflow, Amie, Tweek, Sunsama | **Zero.** No `draggable`, `onDragStart`, `onDrop`, `onDragOver`, dnd-kit or react-beautiful-dnd anywhere in the frontend. Blocks can be created and deleted, never moved or resized. | **P1** |
| 8 | **Command bar / global capture shortcut** | Akiflow | **Zero.** No global `keydown` listener exists at all. Capture opens only by clicking `+ task` (`App.tsx:984`). `cmdk@1.1.1` is in `package.json` and **never imported** (shadcn scaffold residue; there is no `components/ui/` directory). | **P1** |
| 9 | **Keyboard view navigation** | Notion Calendar | **Zero.** `Calendar.tsx:1255,1388` — four views, buttons only. The complete keyboard inventory app-wide is twelve local `onKeyDown` handlers on focused inputs; there is not even a global `Esc`. | **P2** |
| 10 | **Natural-language capture** | Todoist, Fantastical | **Split badly.** QuickCapture (`App.tsx:131-208`) is multi-line, one task per line, `Cmd+Enter` to save, with only a `bestWindowType` dropdown — **no date, duration or priority parsing.** The NL intelligence exists but only behind the Planner's heavyweight flow via `✦ Dump & schedule →`. | **P1** |
| 11 | **Live parse preview** | Todoist | Absent at line scale; present at document scale (Planner's editable-card step — the team already believes in this pattern). | **P1** |
| 12 | **Morning planning ritual** | Sunsama | Present but **wall-clock-gated** — RitualCard renders only when `localHour < 12` (`Today.tsx:773-774`), ignoring the chronotype the app collected during onboarding. | **P1** |
| 13 | **Evening shutdown** | Sunsama | **Richer than Sunsama on reflection, missing its other half.** `EveningHarvest` gives a real accomplishment summary from live data ("kept 2 of 3 dailies · closed 4 tasks"), tap-to-log chips for unkept habits, auto + named wins, a helm/wins/moon-cycle footer, felt rating and Logbook line, plus a quiet-day fallback. But there is **no deliberate re-homing of undone work** — the defining second half of Sunsama's shutdown. | **P0** |
| 14 | **Auto-rollover of undone items** | Motion, Tweek | Absent. Overdue tasks bucket on the Tasks page; passed windows simply rot. | **P1** |
| 15 | **Capacity honesty before commit** | Sunsama | Partial inverse — the weaver reports what it *couldn't* fit (`Planner.tsx:290-298`) but never warns that a day is overfull *before* you commit. Nothing sums planned minutes against available hours. | **P1** |
| 16 | **Outbound calendar feed** | all of them | **Built and surfaced.** `Settings.tsx:1183-1237` — live `webcal://` subscribe URL with copy button, selectable URL, how-to, and a security note, plus a one-time `.ics` download; backed by `GET /api/export/ical` (`routes/exportIcal.ts:30`). *(Corrects month-study Finding 9.)* The separate `routes/ical.ts` feed is registered but unreferenced — genuinely dead. | **P2 (placement only)** |
| 17 | **Inbound calendar** | all | **Read-only, permanently.** `googleCal.ts:12` — `calendar.readonly` scope. No write-back. | **P1 (needs OAuth verification, not code)** |
| 18 | **Click a slot to create** | all | Present and good — every hour row in `TimeGrid` is a click zone with a hover `＋ add`; past hours inert (`Calendar.tsx`). Opens `EventModal` → `POST /api/planning/windows`. | None |
| 19 | **Timeline-as-picture** | Structured | Present and unique — the 30-day `QualityStrip` tops Calendar (`Calendar.tsx:1417`), plus TideWater and the tide curve. Compass is the only app here whose day has *weather* on it. | None — ahead |
| 20 | **Refusing a time** | *nobody* | Present, and the moat — verdicts `strong/workable/caution/avoid` (`Launch.tsx:119-129`), per-rule receipts with `hard`/`soft`/`support` severity (`:138-157`), and on `avoid` the "＋ Put it on my calendar" button **is not rendered at all** (`:217`). | **None — the moat** |
| 21 | **A free tier that shapes conversion** | Reclaim, Tweek | Premium is scaffold that **defaults unlocked** (`premium-context.tsx:11`); the only lock is a dev toggle. Planner and Ask — the two real per-user AI costs — are **not gated at all.** | **P1 (commercial)** |

**The shape of it.** Compass is *ahead* on intelligence and judgement (1, 2, 4, 19, 20)
and *behind* on mechanics (3, 5, 6, 7, 8, 10, 14, 15). It built the hard half. The
cheap half is what makes a tool feel alive.

---

## Part B — The 10 highest-value borrowings

Ranked by user impact × cheapness given what exists.

---

### 1. Place habits on the calendar from their cadence — Reclaim's move, Compass's reason
**Effort: 2–3 days.**

**What it is.** Reclaim's core insight: **a cadence only becomes a practice when it
occupies time.** Turn `daily / most_days / weekly(N)` from a scoreboard into blocks.

**Why Compass.** The largest "already built, not connected" in the codebase. A habit
carries `favoredElements`, `favoredPlanets`, `bestWindowType` and `solarAnchor` — a
richer timing signature than any Reclaim habit.
`GET /api/tides/best-times?lens=<element>` already returns ranked windows.
`POST /api/planning/windows` already writes them. `lib/chronotype.ts` already filters
to waking and free hours. `ScheduleSuggest` already does all of this for *one* slot.
Nothing new is needed except the loop over N.

And the astrology makes it genuinely better than Reclaim, not merely equivalent:
Reclaim places your run at 7am because the calendar is empty. Compass places it at 7am
Tuesday because that is a fire window and a run is a fire thing — **and says so.**
That is Reclaim's most-praised feature with a reason attached.

**Implementation.** New `POST /api/habits/:id/place` taking the habit's cadence target
for the coming rolling window; reuse the ranking in `ScheduleSuggest.tsx:62-89`
(element lens → `isWaking` filter → free-time-fit → soonest-first) and write N rows via
the existing insert at `routes/planning.ts:369`. Client: a "Find its times this week"
action per habit row in `Habits.tsx` that shows all N proposed slots **as one
reviewable list before writing** — Compass's Planner pattern, not Reclaim's silent
commit. Blocks then appear on Calendar for free (`Calendar.tsx:1293` already reads
`?all=1`).

**Guardrails (Part C applies).** Offer, never impose. Review before write. And a missed
instance must **not** auto-reschedule — see Part C #1.

---

### 2. Make the Planner's review step movable, not just droppable
**Effort: 1–1.5 days.**

**What it is.** Sunsama, Akiflow and Reclaim all let you grab a proposed block and put
it somewhere else. Compass lets you delete it or accept it.

**Why Compass.** This is the exact seam where Motion loses trust and Compass could win
it. A user who disagrees with one placement must drop it and re-run the whole weave, or
drop it and schedule by hand. That turns a delightful proposal into a chore and
undercuts the "nothing is scheduled until you say so" promise at `Planner.tsx:135` —
consent without adjustment is thin consent.

**Implementation.** The weaver already computes ranked candidate windows per element
lane and discards the runners-up. Return the next two or three from
`/api/plan/weave` (`routes/plan.ts:199`) and add a "move" affordance beside the ✕ at
`Planner.tsx:261-287` that offers them, each with its own tier note. Selecting one
mutates `result.planned[idx]` locally — **no persistence changes at all**, because
nothing is written until `/api/plan/commit`. Optional extra half-day: "re-weave the
rest around this," re-posting with the item pinned.

---

### 3. A `Cmd+K` command bar over the actions that already exist
**Effort: 1–1.5 days.**

**What it is.** Akiflow's signature, and the fix for capture latency.

**Why Compass.** Today you must *see and click* a button to record a thought. The month
study's Rachel (ADHD freelancer) churned in week 3 on scheduling friction; capture that
requires aiming at a target is exactly the failure mode. And **`cmdk@1.1.1` is already
a dependency and entirely unused** — zero install cost, bundle cost already paid.

**Implementation.** New `src/components/CommandBar.tsx` using `cmdk`, mounted once
beside the existing capture render at `App.tsx:930`. One global `keydown` listener —
**the app currently has none**, so this also establishes the pattern for item 10.
Commands map to functions that already exist: `setCapture(true)`,
`dumpToPlanner(text)` (`App.tsx:864`), `setView(...)` across the four `TOP_TABS` plus
the two untabbed views `planets` and `settings` (**which currently have no nav entry at
all** — this instantly fixes month-study Finding 8's discoverability problem for
free), open Ask, open Plan › Begin. Free text with no match offers "Capture this" and
"Send to the Planner."

**Voice.** Placeholder in the app's register — "what's on your mind?" — not "Type a
command."

---

### 4. Sunsama's missing half: deliberate re-homing of undone work
**Effort: 1.5–2 days.**

**What it is.** The most-praised interaction in the whole competitive set. At day's end
you don't just reflect — you look at what didn't happen and **decide where each thing
goes**: tomorrow, a named day, or off the list.

**Why Compass.** Compass's evening loop is *already richer than Sunsama's* on
reflection — EveningHarvest's accomplishment summary, tap-to-log chips, named wins, the
felt rating, the Logbook line, the quiet-day fallback. What it lacks is the half that
makes a shutdown *close*: undone tasks and passed windows simply rot. Adding it is
philosophically native, because deliberate deferral is the productivity expression of
"not now" — which is already the app's signature idea (Part D).

**Implementation.** Extend the evening `RitualCard` (`Today.tsx:773-774`) with a "What
didn't land" section over today's incomplete tasks and un-completed windows
(`routes/planning.ts:353`). Three taps per row: **Tomorrow** · **Find it a better
time** (reuse `ScheduleSuggest`) · **Let it go**. Tomorrow finally uses the
already-built `PATCH /api/planning/windows/:id`; "Let it go" uses `PATCH /api/tasks/:id`.

**Voice guardrail.** "Let it go" must be first-class and unpunished. The test cases are
the month study's Jess in a flare week and Dan with an empty ledger: this screen must
never read as a debt statement. Copy in register — *"three things waited. Where do they
go?"*

---

### 5. Live natural-language parse in Quick Capture — Todoist's red highlight
**Effort: 1–2 days.**

**What it is.** Type `call mom Thursday 3pm`, watch `Thursday 3pm` light up, hit enter,
get a correctly-dated task.

**Why Compass.** Capture is currently honest but dumb — no date parsing whatsoever
(`App.tsx:141-164`), so that line becomes a task *titled* "call mom Thursday 3pm."
Meanwhile the app has one of the better parsers in the category locked behind a
two-step flow. Todoist's lesson is that a parse is worth little unless you can **see it
before committing** — and Compass already believes this: the Planner's editable-card
step is a parse preview at document scale.

**Implementation.** Two halves; ship the first alone if needed.
- *Local:* `src/lib/nlDate.ts` for the 90% cases — `today`, `tomorrow`, weekday names,
  `next week`, `in 3 days`, `at 3pm`, `~45m`, `2h`. **`date-fns@3.6.0` is already a
  dependency** (currently used only in `Log.tsx`). Highlight the matched substring via
  an overlay, in the app's accent rather than Todoist's red.
- *Server (optional):* debounce a single-line `/api/plan/parse` call and show the
  inferred element dot and estimate as a preview chip.

Strip the matched fragment from the title on submit; pass `dueDate` and `estMinutes` to
`POST /api/tasks` (both are existing columns).

---

### 6. Reclaim's graceful degradation: compress, skip-today, log-past-work
**Effort: 1 day.**

**What it is.** Three small mechanics that together mean a bad day never reads as
failure: **min/max duration** so a block shrinks rather than vanishing;
**delete = skip today only**, not "never"; and **log past work** so doing the thing at
an unscheduled time still counts.

**Why Compass.** This is the most philosophically aligned borrowing in the list and
nobody would guess it came from a calendar-defense product. Compass already argues that
a missed thing is sometimes just a missed thing — `occasional` is literally labelled
"tracked, never scored." But the *scheduling* layer has none of that grace: a window is
kept or it isn't. "I did the run, just at 6pm not 7am" has nowhere to go, which quietly
teaches users that the app's placements are tests they can fail.

**Implementation.** (a) Add `minMinutes`/`maxMinutes` alongside the existing
`estMinutes` and let the weaver in `routes/plan.ts` compress toward `minMinutes` before
declaring an item unplaced — this directly shrinks the "Couldn't place N" panel.
(b) On a passed window, offer "did it anyway" → `POST /api/planning/windows/:id/complete`
(**already built at `routes/planning.ts:408`, never called**). (c) Make deleting a
placed habit instance mean *skip today*, so item 1's placement can offer another day
rather than treating it as a cancellation.

---

### 7. Capacity honesty before commit — Sunsama's workload threshold
**Effort: 4–6 hours.**

**What it is.** Sunsama sums planned time against a workload threshold and warns —
*gently* — that you've planned nine hours into a six-hour day, before you commit.

**Why Compass.** Motion's most durable complaint across every review site is that it
**packs the day too tightly with no slack for the unplanned**. Compass's weaver is
about to make the same mistake with better manners unless it says so out loud. And
"this week is already full — here's what I'd leave out" is the most Compass-flavoured
sentence imaginable: the "not now" thesis applied to *volume* instead of timing.

**Implementation.** In the step-3 header (`Planner.tsx:252-256`), sum
`estimatedMinutes` per day from the existing `byDay` map and compare against the waking
window from `profile.chronotype` (`Planner.tsx:46`) minus the `busy` array already
fetched from Google Calendar (`Planner.tsx:77-87`). One line per overfull day. Then
reframe the existing unplaced panel from an apology into a judgement: *"I left these
out on purpose."*

**Tone is the feature.** Sunsama's warning is loved precisely because it is gentle;
copy it as encouragement, not as an error state.

---

### 8. Auto-rollover, quietly
**Effort: 4–6 hours.**

**What it is.** Tweek's and Motion's shared table stake — an undone thing moves forward
by itself rather than accumulating as visible failure. Even Motion's critics praise it.

**Implementation.** Server-side in `GET /api/tasks` (`routes/tasks.ts:16`) or a small
daily sweep: a task with a past `dueDate` and `done !== "true"` surfaces under today
with a `rolled` flag and a day count, rendered in `Tasks.tsx` with a soft marker rather
than a red one.

**Explicitly do not roll planning windows.** A window is a *moment*, and silently
moving a moment is precisely the Motion failure Part C warns against. Windows go
through item 4's deliberate re-homing instead. This distinction — tasks roll, moments
don't — is exactly the line that separates Compass from an autoscheduler.

---

### 9. Surface the calendar feed where the need is felt
**Effort: 2–3 hours.**

**What it is.** Not a build — a placement fix. The `webcal://` subscribe feed is fully
built and well-written (`Settings.tsx:1183-1237`), and it is buried in Settings where
nobody looking for calendar integration will find it.

**Why Compass.** Month-study Finding 9 says calendar integration has a hard ceiling for
exactly the personas who'd pay most, and OAuth verification for compass.day is weeks of
process. The one-way outbound feed already lands most of that value **today** and the
affected users don't know it exists. Two of the three highest-value moments to mention
it: beside Calendar's Google chip (`Calendar.tsx:381-457`), where a user is actively
thinking about integration; and in the Planner's post-commit confirmation
(`Planner.tsx:304`), which currently ends at "✓ Woven into your calendar (Ahead)" — the
exact instant a user wonders whether this reaches their real calendar.

**Also worth deciding this pass:** the feed authenticates with the tester id in the
query string. The Settings copy handles this honestly ("Anyone with this link can read
your schedule"), but the month study flags query-string credentials as a pre-GA
security item. Wider promotion raises the stakes — at minimum make the feed token
rotatable before advertising it more loudly.

---

### 10. Notion Calendar's single-key view switching
**Effort: 2–3 hours.**

**What it is.** `D`/`W`/`M`/`A` to switch view, `T` for today, `←`/`→` to page.

**Why Compass.** The cheapest craft signal available. `Calendar.tsx:1255,1345-1351,1388`
already holds `calView` state and the paging functions; this is one `useEffect` with a
`keydown` listener that no-ops when an input is focused. Ship it alongside item 3 so
Compass gains a coherent keyboard story in one release rather than two, and hint the
shortcuts in place (a small `⌘K` glyph on the capture button) rather than adding an
onboarding tour.

---

### The ranking, in one glance

| # | Borrowing | Source | Effort |
|---|---|---|---|
| 1 | Place habits on the calendar from their cadence | Reclaim | 2–3 d |
| 2 | Planner review: move, not just drop | Sunsama / Akiflow | 1–1.5 d |
| 3 | `Cmd+K` command bar (cmdk already installed, unused) | Akiflow | 1–1.5 d |
| 4 | Deliberate re-homing of undone work in the evening ritual | Sunsama | 1.5–2 d |
| 5 | Live natural-language parse preview in Quick Capture | Todoist | 1–2 d |
| 6 | Graceful degradation: compress · skip-today · log-past-work | Reclaim | 1 d |
| 7 | Capacity honesty before commit | Sunsama | 4–6 h |
| 8 | Quiet auto-rollover for tasks (never for windows) | Tweek / Motion | 4–6 h |
| 9 | Surface the existing webcal feed at the point of need | all | 2–3 h |
| 10 | Single-key calendar view switching | Notion Calendar | 2–3 h |

**Total: roughly 9–13 working days.** Items 7–10 together are **under two days** and
cover four separate competitor signatures — that is the pass to ship first.

**Honourable mention (deliberately not in the ten).** *Structured's day spine* — a
vertical time axis for Today with the tide curve behind it and your blocks laid on it,
so the day is a shape with weather on it. It is the borrowing that most flatters what
Compass uniquely has, and it would serve month-study Finding 8 by teaching the sky
without a tab. Excluded at 2–3 days because Today already carries up to ~19 blocks and
the month study is explicit that anything added there must **replace**, not accumulate.
Prototype it against the density work rather than scheduling it blind.

---

## Part C — What NOT to copy

### 1. Silent, continuous rescheduling — Motion's core mechanic
**Never import this.** Motion's defining behaviour is that the AI moves your work
without asking, continuously — and it produced the single most damning data point in
this research: a reviewer whose task list was **rescheduled eleven times in one day**,
who by 3pm no longer knew what to work on. The community coined **"AI calendar
anxiety"** for it. Reclaim, which does the same thing more gently, still had to invent
**auto-lock at 1–2 AM** purely to give users a moment where the calendar publicly stops
moving.

For Compass the damage would be worse than for Motion, because Compass's placements
make a *claim*. A Motion block that moves is a logistics update. A Compass block that
moves silently is the app saying "Thursday 2pm is the right moment for this" and then,
unprompted, "no — Friday 4pm." The authority evaporates on the second move. The whole
architecture of `Planner.tsx`'s three-step flow exists to prevent this.

**The live risk is item B1.** Reclaim re-places a missed habit automatically within
seconds; Compass must not. Offer once, review before writing, and let a missed instance
stay missed. `occasional` — "tracked, never scored" — already proves the team knows
that a missed thing is sometimes just a missed thing.

### 2. The streak, the score, and the guilt ledger
Motion's completion analytics, Reclaim's productivity stats and every habit tracker's
unbroken chain run on one engine: make the user feel the debt. Compass has refused this
deliberately — `occasional` exists so a practice can be tracked without being scored
(`Habits.tsx:50`), `cadenceLabel` reports "2 of 3 this week" rather than "you're
behind," the streak counts *backwards from yesterday* so today is never a failure yet,
and EveningHarvest counts non-daily habits as pure credit with no shortfall.

The pressure point is immediate: the queued "wake behind" progress strip is one naive
implementation away from being a guilt surface, and the month study says so explicitly —
for a persona in a flare week or a skeptic with an empty ledger, a bare progress strip
is the exact thing the app has refused to be. Any borrowed progress visualisation must
have its **quiet state designed first**.

More fundamentally, a streak assumes linear time. Compass's whole thesis is that time
is *not* uniform — that a bad week is sometimes the sky's and not a moral failing. A
streak counter re-imports the flat-time assumption the product exists to deny.

### 3. Full-capacity optimisation — "fit everything in"
Every autoscheduler's implicit objective function is emptiness: find a home for all N
tasks. That is *why* Motion overpacks. Compass's Planner already resists — it reports
what it couldn't place and suggests a longer horizon (`Planner.tsx:290-298`) — and item
B7 should strengthen that, never trade it away.

The reason is commercial as much as philosophical. Per month-study Finding 10, Compass's
converting moment is **refusal**: eleven of twelve personas used Begin for a real
decision, four changed real-world dates, and the paths that converted were the
Mercury-retrograde hard block, the retrograde-significator tier cap, and "no clean
window in this span" — *not* the great-tier windows. `Launch.tsx:217` withholds the
"put it on my calendar" button entirely on an `avoid` verdict. **That withheld button is
the product.** An optimiser's instinct is to always offer something; the moment Compass
does, it becomes a worse Motion with astrology skinned on top.

### Three smaller don'ts
- **Akiflow's 30-source universal inbox.** It turns a rhythm instrument into middleware
  and imports every integration's maintenance burden forever.
- **Sunsama's ritual as a *gate*.** Its onboarding is mandatory and its planning session
  blocks the workspace. Compass already has the milder version of this bug and it
  already bites: wall-clock ritual gating locks out night-shift, toddler-evening and
  late-rising users (Finding 3). Rituals should be **available, not enforced**.
- **Reclaim's write-to-your-main-calendar default.** Its #1 complaint is that
  generated events clutter the primary calendar with no way to hide them. If item B1
  ever reaches a real calendar, it must land on a separate, toggleable Compass
  calendar.

---

## Part D — The one journey Compass should own

### Thesis

Every tool in this study answers **"when can this fit?"** Compass is the only one that
can answer **"when is this actually right — and should it happen at all?"** None of
them can decline.

### The argument

**They all optimise for fit, and fit is commoditised.** Motion finds the next open
slot. Reclaim finds an open slot inside a window you authored. Sunsama makes *you* find
it, thoughtfully. Akiflow makes finding it fast. They differ on who searches and how
pleasant it feels; they agree completely that the objective function is **emptiness**.
Ask any of them whether Thursday is a good day to send a proposal and the honest answer
is that **they have no opinion** — Thursday is good if Thursday is free. They cannot
distinguish two empty Thursdays, because a calendar's only input is other calendar
entries.

**Compass has a second input, and it is the entire business.** It knows something about
the *quality* of a moment that is independent of your availability. Whether you accept
the mechanism or treat it as a well-constructed randomiser with unusually good taste,
the product consequence is identical and structurally unavailable to competitors:
Compass can rank two equally-empty Thursdays *for this specific thing* — a launch, a
hard conversation, a first draft — and it does so from deterministic ephemeris math
(`lib/electionEngine.ts`, `routes/plan.ts`'s weaver), not from a language model's mood.

**And it can refuse — which is the part nobody else can structurally do.** Refusal
requires an external standard. To say "not now" you need a reason that isn't "you're
busy." Motion cannot refuse; it has no grounds. The most a fit-optimiser can ever say
is "your calendar is full," which is a report about you, not a judgement about the
moment. Compass says *"against the current,"* shows the rule that failed and its
severity (`Launch.tsx:138-157`), and **withholds the scheduling button** (`:217`). That
is a product taking a position and paying for it.

**The evidence is already in-house.** Eleven of twelve personas used Begin for a real
decision; four changed real-world dates; and the *refusal* paths converted better than
any great-tier window. Users trust a tool that can say no. Nothing else in the category
has ever had to earn that trust, because nothing else has ever been able to say it.

### The journey, concretely — "is this the moment?"

One flow, reachable from anywhere (item B3), that takes a **thing** — send the proposal,
have the conversation, publish, sign, begin — and returns one of four answers with
receipts:

1. **Now.**
2. **A better time: Thursday 2pm** — here's why.
3. **Against the current** — here's the rule that failed, and its severity.
4. **Not this month. Ask me again after the 14th.**

No competitor can render answer 4. Most cannot render answer 3. Motion and Reclaim
cannot even render answer 2 in the sense that matters, because their "better" means
"emptier."

That flow is ~80% built across `pages/Launch.tsx`, `routes/election.ts` and
`lib/electionEngine.ts`. What it lacks is a front door, a name, and a keepable
artifact — the month study records that users wanted to *text* and *post* the verdict,
and a server-side share card already exists at `/api/studio/best.png` with no UI on it.

### Why it is defensible

Motion could add astrology in a sprint and it would be absurd, because refusal is not a
feature you bolt on — it is a stance the rest of the product must be built to support.
Compass has spent the whole build supporting it: the four-verdict scale, per-rule
receipts with hard/soft/support severity, retrograde caps, the honest "no clean window
in this span," and a weaver that would rather report an unplaced task than jam it in.
Every competitor's pricing page promises **more done**. Compass is the only one that can
promise **the right moment, or none** — and the month study says that is exactly what
made people pay attention.

---

## Part E — Onboarding

### The field

| App | First run | Time to value | Required up front |
|---|---|---|---|
| Notion Calendar | connect Google | **< 1 min** | a Google account |
| Tweek | type into a column | ~1 min | nothing |
| Structured | drop in a few items | ~2 min | nothing |
| Amie | connect calendar | ~2 min | calendar |
| Reclaim | calendar → hours → **Proactive/Reactive** → first habits from 130+ templates | ~15 min | calendar |
| Sunsama | **mandatory guided flow** ending in your first real plan | ~15 min, and it feels worth it | calendar + a task source |
| Akiflow | connect 30+ sources, learn the command bar | ~30 min | sources + patience |
| Motion | calendar + tasks + work-hours grid + first AI schedule; **desktop browser required** | **hours** | your whole working life |

Time-to-first-value tracks retention, with exactly one exception. **Sunsama's
onboarding is long and its users love it**, because it is not configuration — it is
teaching a practice, and it *ends in a plan*. Motion's is long and resented because it
is pure setup with no payoff until the end.

**The rule: a long onboarding is forgiven only when each step delivers meaning rather
than collecting data.**

Two other transferable moves. **Reclaim's Proactive/Reactive fork** is an
aggressiveness dial chosen at setup, which pre-negotiates consent for everything that
follows. **Reclaim's 130+ habit templates** mean the user's first act is a choice, not
a blank field.

### What Compass does today

Six skippable intro slides (`INTRO_SLIDES`, `App.tsx:212-260`) → **name** (defaults to
"Observer"; also the account-key restore path) → **birth** (genuinely optional — "Show
me today →" and "Add my chart" are co-equal buttons, with an honest "I don't know my
birth time" checkbox, debounced place search, and the astro-detail intake) →
**chronotype** (with "Skip for now") → Today, at `uiDensity: essential`.

**This is already better than most of the field and far better than Motion.** The
dual-path problem — "just show me today" versus the full personal layer — is solved
structurally. Four refinements, not a rebuild.

### Recommendations

**1. Make the first screen a reading, not a slide.** *(3–4 h)*
Six slides before any value is Motion's mistake in miniature. Compass can compute a
real reading for today from IP-derived location alone — no name, no birth data, no
chronotype. **Lead with it**, and collapse the intro material into one "what am I
looking at?" affordance. Sunsama's lesson is that teaching is welcome *while value is
on screen*, not as a toll gate before it.

**2. Ask for one intention, and use it immediately.** *(1 day — the highest-leverage
change here)*
Sunsama's onboarding works because it ends in a **plan**, not a settings object.
Compass's ends on a generic Today. Close it with one question — *"what's one thing
you're trying to time well right now?"* — pipe the free text into `/api/associate`
(which already reads text into an element, planets and window type) and land the user
on **a first reading about their own thing**. That is the shortest path from install to
the moment the product is for *them*. Reclaim's template gallery is the same move by
another route: make the first act a choice, not a form.

**3. Turn birth data from a fork into a door.** *(4–6 h)*
Right now it is a branch in onboarding. It should be a door that opens at the moment
its absence is felt — the first tap on something personal (a Guiding Star, a transit,
Currents) prompts "this one needs your birth details — two minutes." The
`showBirthPrompt` re-prompt machinery already exists (`App.tsx`, gated on
`obs_birth_skipped`); this is a retargeting, not a build. It converts better than an
up-front ask, and the no-birth-data user (the month study's Alex) never carries a
visible hole.

**4. Defer chronotype — but only after it is actually honoured.** *(2–3 h to move)*
Chronotype is a good question asked too early: configuration before the user knows why
it matters. Worse, the app collects it and then **ignores it** — the ritual loop gates
on `localHour` (`Today.tsx:773-774`), locking out night-shift and late-rising users at
exactly the hours they'd close the loop, and the notifier hardcodes 08:00/20:00.
Collecting a preference and disregarding it is worse than not asking. Either move the
question to first evening ("when does your day usually end?" asked *when* it is ending)
or wire `ritualMode` to it first — but do not ship the deferral while the disregard
stands.

**5. Don't add a shortcuts tour** when items B3/B5/B10 land. Notion Calendar teaches its
shortcuts by hinting them in place. Put a small `⌘K` glyph on the capture button and
nothing in first run.

### The onboarding Compass should have

> **1** — today's actual reading, computed from location alone. One line beneath:
> *"this is today's weather. Want it to know you?"*
> **2** *(skippable, real skip)* — birth details, with the honest unknown-time checkbox.
> **3** — *"what are you trying to time well right now?"* → a real reading about that
> thing.
> **Then** — Today. Chronotype at first evening. Everything else on demand.

Three screens, value on the first, personal value by the third.

---

## Appendix — Sources

**Motion:** [Onboarding process](https://www.usemotion.com/help/motions-onboarding-process) · [How auto-scheduling works](https://www.usemotion.com/help/time-management/auto-scheduling/reference-auto-scheduling/how-auto-scheduling-works-behind-the-scenes) · [Task scheduling FAQ](https://www.usemotion.com/help/project-management/task/task-scheduling-faq) · [G2 pros and cons](https://www.g2.com/products/motionapp/reviews?qs=pros-and-cons) · [Trustpilot](https://www.trustpilot.com/review/www.usemotion.com) · [Capterra](https://www.capterra.com/p/214264/Motion/reviews/) · [Saner.ai review](https://www.saner.ai/blogs/motion-reviews) · [Efficient App](https://efficient.app/apps/motion) · [alfred_ pricing](https://get-alfred.ai/blog/motion-pricing) · [Morgen pricing](https://www.morgen.so/blog-posts/motion-pricing)

**Sunsama:** [Daily planning & shutdown](https://www.sunsama.com/features/daily-planning-and-shutdown) · [User manual — daily planning](https://help.sunsama.com/docs/daily-planning) · [Setting up your account](https://help.sunsama.com/docs/setting-up-your-sunsama) · [Backlog](https://help.sunsama.com/docs/usage-guides/backlog/) · [Keyboard shortcuts](https://help.sunsama.com/docs/usage-guides/keyboard-driven-actions/keyboard-shortcuts/) · [Channels and contexts](https://help.sunsama.com/docs/usage-guides/channels-and-contexts/) · [Pricing](https://www.sunsama.com/pricing) · [Pricing manifesto](https://help.sunsama.com/docs/billing/pricing-manifesto/) · [Price-rise analysis](https://www.usecarly.com/blog/did-sunsama-raise-prices/) · [Review after 20 months](https://juliety.com/sunsama-review) · [Sweet Setup — startup and shutdown](https://thesweetsetup.com/how-to-startup-and-shutdown-your-day-with-sunsama/)

**Reclaim.ai:** [Habits overview](https://help.reclaim.ai/en/articles/4129152-habits-overview-auto-schedule-flexible-time-for-your-routines) · [Time Defense settings](https://help.reclaim.ai/en/articles/4129290-time-defense-settings-for-habits) · [Prioritizing habits](https://help.reclaim.ai/en/articles/4129286-prioritizing-your-habits) · [Managing habit events](https://help.reclaim.ai/en/articles/8825115-managing-habit-events-on-your-calendar) · [Auto-rescheduling](https://help.reclaim.ai/en/articles/6937489-auto-rescheduling-settings-for-tasks-and-habits) · [Auto-lock](https://help.reclaim.ai/en/articles/6750250-auto-lock-your-focus-time-habits-tasks-and-smart-meetings) · [Locks](https://help.reclaim.ai/en/articles/6473767-how-to-stop-reclaim-events-from-moving-using-locks) · [Always Busy / Always Free](https://updates.reclaim.ai/announcements/always-busy-always-free-time-defense-for-habits) · [Habits 2.0](https://help.reclaim.ai/en/articles/9010022-smart-meetings-habits-2-0-what-s-new) · [Habits vs Tasks](https://reclaim.ai/blog/habits-vs-tasks) · [Pricing](https://reclaim.ai/pricing) · [G2 pros and cons](https://www.g2.com/products/reclaim-ai/reviews?qs=pros-and-cons)

**Akiflow:** [Efficient App](https://efficient.app/apps/akiflow) · [Saner.ai](https://blog.saner.ai/akiflow-reviews/) · [alfred_ pricing](https://get-alfred.ai/blog/akiflow-pricing)

**Amie / Notion Calendar:** [Efficient App comparison](https://efficient.app/compare/amie-vs-notion-calendar) · [Notion Calendar review](https://efficient.app/apps/notion-calendar) · [Matthias Frank tutorial](https://matthiasfrank.de/en/notion-calendar/)

**Structured / Tweek:** [structured.app](https://structured.app/) · [AppleInsider review](https://appleinsider.com/articles/23/01/09/structured-301-review-no-frills-attractive-daily-planner) · [tweek.so](https://tweek.so/calendar) · [Morgen — Tweek vs TeuxDeux](https://www.morgen.so/blog-posts/tweek-vs-teuxdeux)

**Todoist / Fantastical:** [Sweet Setup — Todoist NL](https://thesweetsetup.com/using-natural-language-with-todoist/) · [Calmevo NL guide](https://calmevo.com/todoist-natural-language-input-guide/) · [Sweet Setup — Fantastical NL](https://thesweetsetup.com/natural-language-guide-for-fantastical/) · [Flexibits help](https://flexibits.com/fantastical/help/adding-events-and-tasks)

**Internal cross-references:** `USER-SIMULATIONS-2026-07-29-MONTH.md` (Findings 3, 8, 9,
10; Part C P0s; Part D on the queued changes — **note the Finding 9 correction at the
head of this document**), `DESIGN.md` §1 anti-goals, `PAYING-PERSONAS-2026-07-29.md`
Part A ranks 1 and 3, `DESIGN-BRIEF-2026-07-27.md`.
