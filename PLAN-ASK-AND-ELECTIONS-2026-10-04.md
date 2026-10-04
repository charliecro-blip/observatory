# Plan: elections, the one box, sorting what you hold, and the day's light · October 4, 2026

Status: plan, owner asked for it 2026-10-04 and asked for Parts B and C the same day. Built so far (all 2026-10-04): Phase 0, Part C, Phase 2 and the plumbing for T1/T4/T5. Items
marked **owner call** need a ruling before the phase that uses them.

## Where this came from

The owner asked for "a thorough breakdown" of times for a haircut in the next
couple of weeks, with their chart and calendar. Compass could not give it; the
answer was assembled by hand from the engine plus separate computation. What
that exposed, each measured on 2026-10-04:

| # | Gap | Evidence |
|---|---|---|
| G1 | "In the next couple of weeks" asks instead of searching, and Find a time stops at seven days. | `timingRequest.ts` asks on "in N weeks"; `timingSearch.ts:208` returns `horizon_exceeds_seven_civil_days`. |
| G2 | The chart contributed nothing. All 12 haircut windows Oct 4–18 came back `personal: false`. | Personal testimony for haircut fires only when Venus or the Moon is in natal house 1, or Venus touches natal Venus (`electionEngine.ts:818–849`). Neither happened. The chart ruler (Moon, for Cancer rising), the lunar return on Oct 16, and transiting Venus square natal Saturn (exact Oct 13) were all invisible to it. |
| G3 | A void Moon doesn't stop an all-day window. Tue Oct 6 was rated "good, 7 AM–11 PM" while the Moon was void from 5:30 AM to 10 PM. | `electionEngine.ts:1018` skips the void check when `c.allDay`. |
| G4 | No breakdown. Find a time shows picks; the request wanted a ranking with reasons for and against, and the days to avoid with their reasons. | `presentTiming` returns candidates only. |
| G5 | The significator's state for the whole span never leads. Venus is retrograde Oct 3–Nov 13, which the engine reports as a caution string on each day. The first question a person would ask is "can it wait?" | `cautions` per day result. |
| G6 | Ask can't do any of this. It is GPT-4o with a fixed context snapshot, no tools, `max_tokens: 400`, told to answer in 2–4 sentences. | `routes/advise.ts`. |

Already in place and reused: the election engine, the timing interpreter (with
the request log shipped today), Google Calendar busy-time reading
(`fetchGcalBusy`; the owner's account is connected), the natal chart, Ask's
`electionContext` (windows given as facts), and daemon memory.

## The shape

One box (the one already on Home) and three answers behind it:

1. **A timing request** ("haircut this week") → Find a time, as now.
2. **An election** ("elect a haircut in the next two weeks", "best time to sign
   the lease this month") → an **election report**, computed by the engine and
   rendered without a model, so every claim in it has one source.
3. **Anything else** ("why does this week feel heavy?", "what about Saturday
   instead?") → Ask, which can now call the engine and the calendar as tools and
   must answer from what they return.

The report is deterministic for the reason the timing work has been all along:
a model writing times is how a person ends up with a time no engine produced.
Ask explains and answers follow-ups; it never ranks on its own.

## Part A · Elections and the one box

### Phase 0 · engine correctness · BUILT 2026-10-04
- A day-long window for an activity that avoids the void now keeps only its
  longest stretch clear of a void Moon, rounded inward to the minute, and is no
  longer marked all-day. A stretch under two hours is dropped and counted in
  the new `withheld.voidMoon`.
- Measured on October 2026, all 19 void-avoiding activities, a week at a time,
  the owner's chart, Austin: windows overlapping a void Moon went **62 → 0**;
  all-day windows 106 → 39; 14 dropped and counted. The first run left 11
  overlaps, each a fraction of a second where the clipped start was the
  truncated second of the void's end; rounding to the minute closed them.
- Pinned by `tests/election-void-allday.test.ts` (Tue Oct 6, haircut). It fails
  on the old engine with exactly the reported window, "7 AM–11 PM".
- Uses the current void-of-course definition (the day arc's `vocWindows`);
  the definition question (**D2**) is still open and doesn't block this.

### Phase 1 · the chart counts (the core)

An election for a person is two charts at once: the moment, and the moment
read against the nativity. The engine reads the first well and the second
barely. For a haircut it asks only whether Venus or the Moon is in the natal
1st, or Venus touches natal Venus, so a fortnight in which the Moon returned
to its own place, transiting Venus squared natal Saturn, and Venus (lord of
the year) turned retrograde came back with no personal testimony at all.

What follows is the resonance model, as proposals for the owner to rule on
(**D1**). Every rule names the natal points it reads, so an explanation can
always say which part of the chart answered.

**The natal points an election reads**, per activity:
- **Chart ruler**: the Ascendant's ruler (Moon, for Cancer rising). The self;
  read for every activity in the body/self category and, at half weight,
  for all.
- **The activity's natal significator**: its planet in the nativity (natal
  Venus, for a haircut).
- **The matter's natal house and that house's ruler** (houses already exist on
  each activity).
- **Lord of the year**: the ruler of the profected house. The owner is in an
  11th-house year (age 34, Taurus), so Venus rules the year until Jan 3, 2027.
  What the year's lord does is louder than usual all year.
- **Natal malefics**: Mars and Saturn, the places the chart is already
  touchy, for objections.

**Supports** (raise a window; family `natal-resonance`):

| # | Rule | Scope | Orb / timing | This fortnight |
|---|---|---|---|---|
| R1 | **Planetary day and hour of the chart ruler.** The day alone is weak and ambient; the hour inside that day stacks. (Owner, 2026-10-04: the day should count too.) | day + window | — | Mondays; Moon hours, e.g. Fri Oct 16 4:09–5:06 PM |
| R2 | **Day and hour of the lord of the year**, at the same weights as R1 | day + window | — | Fridays and Venus hours (Venus rules the year) |
| R3 | **Transiting Moon applying by conjunction, sextile or trine to the chart ruler, the natal significator, or the natal Ascendant degree** | window | applying, within 3° (about six hours) | Moon conj natal Venus Oct 14 3:52 AM |
| R4 | **The Moon's return to its natal place**, when the Moon rules the Ascendant or the activity | window | ±6 h | Oct 16 12:24 PM |
| R5 | **Transiting significator in soft aspect to the natal significator, chart ruler, or Ascendant** (today only its own natal place counts) | day | 2° | — |
| R6 | **A benefic (Venus, Jupiter) transiting the natal Ascendant, chart ruler, or significator**: season-level, so it supports every window in the stretch | day | 2° (Venus), 3° (Jupiter) | — |
| R7 | **The election's own angles on natal benefics**: the local Ascendant or Midheaven crossing natal Venus, natal Jupiter, or the chart ruler. `getNatalDegreeAngles` already computes these crossings. | window | the crossing ±30 min | to measure |
| R8 | **The election's Ascendant in the natal Ascendant's sign, or sextile/trine it**, for body/self matters | window | sign-based | to measure |

**Objections** (a new family, `natal-objection`; none exist today):

| # | Rule | Scope | Orb | This fortnight |
|---|---|---|---|---|
| O1 | **Transiting Mars or Saturn in hard aspect to the chart ruler, the natal significator, or the Ascendant** | day | 1.5° | — |
| O2 | **The transiting significator in hard aspect to a natal malefic** | day | 1° | Venus sq natal Saturn, exact Oct 13 9:21 PM |
| O3 | **The Moon applying by hard aspect to a natal malefic** | window | 3° applying | to measure |
| O4 | **The election's angles on natal malefics**: the local Ascendant or Midheaven crossing natal Saturn or Mars | window | ±30 min | to measure |
| O5 | **The self-reported caution planets** (Settings, from the July caution-period work), when one is active by transit | day | as today | — |

**How the families count** (calibration, not doctrine):
- Personal support counts toward convergence as **one** family however many
  rules fire, so a chart-heavy day can't reach GREAT on the chart alone. The
  same reasoning as the hour × Moon stack counting once.
- An objection never drops a window. It caps the window at good, adds a
  caution line naming the contact ("Venus squares your natal Saturn"), and
  sets `suitability: qualified`. Whether any objection should defer a window
  instead is **D1b**.
- Each rule's orb and weight are set by fire rate, not feel (memory:
  calibrate-thresholds-by-fire-rate). Run the October harness across a dozen
  charts and report, per rule, how many days in a year it fires and how many
  tiers it changes, before it ships.
- Birth time unknown: R1, R3 (Ascendant degree), R4, R7, R8 and O4 are
  withheld, as house testimony already is. R2 needs the Ascendant too.
- Every fired rule writes an evidence line in the same literal voice as the
  rest: the fact first, the natal point named.

**Acceptance**: re-run the owner's haircut request. Fri Oct 16 should carry
R1/R2 (Venus's day and the Moon's hour) and R4, and Oct 11–15 should carry
O2. That checks the rules the owner approves; it is not a score to tune toward.

### Phase 2 · the election report · BUILT 2026-10-04 (server, page, interpreter)

Shipped as specified below, except where the notes at the end of this section say otherwise.
- New endpoint (`POST /timing/report`): activity, horizon up to 30 days,
  location, natal, calendar. Runs the engine per day, applies calendar busy
  times, and returns:
  1. **The headline condition**: the significator's state across the span
     (retrograde, combust, in fall), with the date it changes. When that date is
     past the horizon, the report also finds the first good window after it, so
     "can it wait?" has an answer (**owner call D4**).
  2. **Ranked picks** (up to 5), each with: the time, the calendar check, the
     testimony for, the objections, and whether the chart decided it.
  3. **Days to avoid**, each with its reason: void Moon, new moon, a personal
     objection, or the calendar. An empty day is an answer (CLAUDE.md).
  4. **Coverage**: what was scanned, what failed, and what was withheld.
- Interpreter: "in the next couple of weeks", "in two weeks", "this month",
  and "next N weeks" resolve to a horizon instead of asking (G1).
- Rendered as a page under the main header, from the same evidence lines
  Find a time already shows. Copy goes through the no-ai-slop skill as it's
  written.
- Acceptance: the owner's haircut request, re-run, gives a report the owner
  agrees with. This is a check on the rules the owner approves in D1, not a
  target to tune toward; the hand analysis of 2026-10-04 is one reading, not
  ground truth.

**As built, and what differs from the spec above:**
- `lib/electionReport.ts`, `POST /api/timing/report`, `components/ElectionReportView.tsx`
  (a destination inside Find a time, reached when the interpreter returns
  `report`). The interpreter reads "the next three days" as a range and "the
  next couple of weeks" / "over the next 10 days" as a report of that many
  days; "in two weeks" is still a point in time and still asks.
- Picks are one per day, ranked: calendar-confirmed open, then tier, then how
  specific the window is, then the engine's own score. A window of eight hours
  or more counts as "the day".
- Strong times the calendar already holds are listed apart. A calendar that
  could not be read is not a conflict: its times are listed, ranked below
  confirmed ones, with the reason in the footer ("not connected" or
  "couldn't be read"). The first browser run caught the opposite: an unlinked
  calendar had emptied the list.
- "Can it wait?" (D4) searches the 14 days after the station, not seven: the
  week after Venus turns direct is empty for a haircut; the engine's first
  window is Nov 25. An empty answer is printed as one.
- Not built: choosing a pick (the `/timing/choose` flow), the Ask hand-off,
  and the per-pick personal-chart testimony, which is Phase 1.
- Cost, measured locally: 7 days 3.7 s, 14 days 4.8 s, 30 days 9.1 s. A cold
  week of engine search is 1.3 s, a warm one 0.3 s. The report computes each
  day's arc itself as well as inside the engine; sharing that is the obvious
  saving if 9 s proves too long.

### Phase 3 · the box routes, and Ask gets tools
- Routing, deterministic first: the interpreter resolves an activity and a
  horizon ≤ 7 days → Find a time; it resolves an activity and the text asks for
  an election ("elect", "best time", "breakdown", "options") or a longer horizon
  → the report; neither → Ask.
- Ask gains three tools: `election_report`, `calendar_busy`, `chart_summary`.
  Its system prompt keeps the existing rule that engine output is given fact,
  and adds that every time it names must come from a tool result.
- Ask's length limit lifts when it is answering about a report (the 2–4
  sentence rule stays for the moment-advisor case).
- Model (**owner call D3**): Ask runs on GPT-4o today. Tool use works on any
  current model; the choice is cost and voice. No change needed to start.
- The interpreter's request log (shipped 2026-10-04) gains the route chosen, so
  routing mistakes show up the same way activity mistakes do.

### Phase 4 · later, not planned in detail
- Daemon memory (exists) carrying preferences across elections: "I like a
  Venus hour", "never before 9".
- Saving a pick to Google Calendar from the report (the export already exists
  in Find a time).

## Part B · Sorting what you hold (tasks, GTD-shaped)

The owner, 2026-10-04: the to-do and sorting system got lost in the reset;
the app should help break a task down to its simplest next physical step
("open the book"), and sort by time, energy, and the rest of the GTD kit.

### What already exists (built this summer, measured in the code)
- **Capture**: one door with four exits (to do, did, keep, note), and a bulk
  paste that asks the model for minutes and energy per line (`Tasks.tsx`).
- **Clarify fields on every task**: `estMinutes`, `energy` (low/medium/high),
  `planet`, `activityKey`, `dueDate`, links to a Star and to a Star's step
  (`milestoneId`). The August audit rated these bones B+ for a GTD purist.
- **Breakdown, for Stars only**: "break into steps" asks the model for a
  Star's steps (`GuidingStarsHub.tsx`). Tasks can't be broken down.
- **Smallest version, for habits only**: `habits.minimumViable`.
- **Partial progress**: touches (`wins.taskId`) record worked-on without
  marking done; the session timer logs a touch when it stops.
- **Placing**: the week and day weavers, Shape today, Plan a few things, and
  Home's "Spread them across the week".
- **The voice rules** (memory: holistic-not-productivity): keepings sit beside
  doings, never "overdue" ("past its date"), no imperative tails.

What the audit found missing, still missing: someday/maybe, contexts beyond
energy, a weekly review you can open any time, and anything that reduces a
task to a next physical action.

### Built 2026-10-04 (plumbing only, no screen yet)
T1, T4 and T5's storage and API: five nullable columns on `tasks`
(`nextStep`, `context`, `parkedAs`, `waitingOn`, `checkBackOn`), accepted and
validated by POST and PATCH `/api/tasks` (absent leaves a value alone, null
clears it, clearing `parkedAs` clears the waiting details), and
`GET /api/tasks?parked=exclude|only`. Nothing reads them yet; no existing list
changes. The screens, the copy and everything from T2 on are the Opus part of
this plan.

### The proposal

| # | Piece | What it does |
|---|---|---|
| T1 | **Next step** on every task (`tasks.nextStep`, nullable text) | The smallest physical action: "open the herbs book to p. 231". Home and the sorting view show the step under the title when there is one. Ticking the step asks "what's next?" (type one, or mark the task done). |
| T2 | **Clarify, one question at a time** | A task with no next step offers one, suggested by the model from the title and its notes, always editable, never saved without a tap. The 2-minute rule as a fact rather than a lecture: a step under 5 minutes is marked "quick". |
| T3 | **Steps inside a task** (`tasks.parentId`, nullable): a task can hold child tasks | "Break into steps" moves from Stars-only to any task. A parent shows "2 of 5", and its next step is its first open child's. Child tasks are ordinary tasks, so timing, touches and the weaver all work on them unchanged. (**T-D1**: child tasks, or a plain checklist inside the task.) |
| T4 | **Where it can happen** (`tasks.context`): a short fixed set (home, out, at the computer, on the phone, anywhere) plus your own | The GTD context, so "what can I do from here" has an answer. (**T-D2**: the set.) |
| T5 | **States beyond open and done**: waiting on someone (who, since when, a date to check) and someday (parked, out of every list until the review) | Inbox is not a state: a task that hasn't been clarified (no step, no minutes) shows as unclarified. |
| T6 | **What fits now**, the sorting view | Three quick choices: time I have (15 / 30 / 60+), energy (low / medium / high), where I am (T4). Returns next steps that fit, quick ones first, then by the sky (the task's planet and hour) at lenses that show the sky. Keepings are offered alongside doings. This is the "what should I do right now" answer for someone holding a list. (**T-D3**: on Home, inside What to do now, or both.) |
| T7 | **A review you can open any time** (the August F10) | Clarify the unclarified, check what's waiting, look at someday, look at the week in Calendar, choose a next step for each Star. For people on a lunar rhythm it can also open itself at the new moon. |

Data changes are three nullable columns and two state values, additive per
BACKLOG §9a; `deleteAccount` already derives its tables from the schema, and
the new columns need nothing there. Every new string goes through the
no-ai-slop skill as it's written.

## Part C · The day's light: sunrise, solar noon, sunset · BUILT 2026-10-04

Home's quiet line under the Moon line, the Day view's legend row, the Agenda
header and the Sky panel all read `GET /api/tides/daylight`
(`daylightOnLocalDay`); the browser approximation is deleted (it ran 0.8 to
3.3 minutes off). Not built: marks on the Day view's hour grid itself. The
line is hidden at the quiet lens in the Day grid (its legend is), and shows on
Home and the Agenda at every lens.

- **Where it goes**: a quiet line under the date on Home, above the Moon line:
  "Sunrise 7:24 AM · solar noon 1:14 PM · sunset 7:04 PM". Plain words pass the
  stranger test, so it shows at every level of astrological detail. On
  Calendar's Day view the three become marks on the timeline, beside the
  aspect perfections already there.
- **One source**: the Sky panel computes its own approximate sun times in the
  browser (`Rail.tsx:449`) while the server has `getSunriseSunset`. The line,
  the Day view and the Sky panel should all read one server computation, with
  solar noon added to it; the browser approximation goes. Before switching,
  measure how far the two disagree today.
- Polar days already withhold planetary hours (memory:
  fabricated-fallbacks-in-the-ephemeris); the line withholds the same way.

## Owner calls

| # | Question | Default if no ruling |
|---|---|---|
| D1 | Which of R1–R8 and O1–O5 are doctrine you'd sign, at what weights. | Phase 1 waits. |
| D1b | Should any objection defer a window rather than cap it at good? | Cap and caution only. |
| D2 | Void-of-course definition (already open). | Phase 0 uses the current one. |
| D3 | Model for Ask. | Stays GPT-4o. |
| D4 | When the significator is impaired for the whole span, does the report lead with the first window after it clears? | Yes. |
| D5 | Is the report paid? ("free = today, paid = the rhythm".) | Behind the timing cohort flag, so the question waits until the cohort widens. |
| T-D1 | Steps inside a task: child tasks or a checklist? | Child tasks. |
| T-D2 | The fixed set of places. | home, out, at the computer, on the phone, anywhere. |
| T-D3 | Where "What fits now" lives. | Inside What to do now, with a door from Home. |
| T-D4 | Should the model suggest a next step unasked? | Only when you open a task that has none. |

## Order and size

1. **Phase 0**: built and deployed 2026-10-04.
2. **Sun times (C)**: small, no owner call needed.
3. **Next step, places, states (T1, T4, T5)** and **What fits now (T6)**:
   the core of Part B, after T-D1–T-D3.
4. **Election report (Phase 2)**: can start now; it shows whatever testimony
   the engine produces, and gets richer when Phase 1 lands.
5. **Phase 1**: after D1; mostly calibration.
6. **Steps inside a task, clarify, review (T2, T3, T7)**.
7. **Phase 3**: the box routes and Ask gets tools, after the report exists.

Each step ships behind the timing cohort flag and is checked on the owner's
real use before the next one starts.

## Who builds what

The question was whether to switch to Sonnet for execution. Yes for the
parts that are fully specified, and no for the parts that are judgment:

- **Sonnet 5.5 is a good fit**: Sun times (C), the report endpoint and its
  page (Phase 2), the T1/T4/T5 schema and plumbing, the interpreter's horizon
  phrases. The spec is in this file, and the repo's rules (push gate, three
  timezones, measure don't read) hold whichever model runs.
- **Stay on Opus**: Phase 1's rules and calibration (doctrine, fire rates,
  what a tier means), the task UX and copy in T2/T6/T7, and any revision of
  this plan. These are where a confident wrong answer costs most, and where
  this summer's defects hid.
- Either way, "done" means measured: the verifier agent checks a claim before
  it's reported, and a deploy is confirmed by a user-visible string.
