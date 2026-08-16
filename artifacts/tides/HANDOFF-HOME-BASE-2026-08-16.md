# Handoff — the home-base build · written 2026-08-16

For the session that builds what `AUDIT-HOME-BASE-2026-08-16.md` found. Read
the audit first; this file is the decisions and the order, not the argument.
Owner's brief, verbatim: home base aside from the astrology · astrology
optional in flow · track progress on unplanned things · progress on tasks
that aren't complete.

The one-line strategy: **three of the four asks generalize primitives that
already exist** (astroDetail, named wins, ad-hoc sessions, startedAt). Build
by widening scopes, not by inventing systems.

---

## 1 · The Quiet lens (asks 1 + 2) — build first

**What:** `astroDetail: "minimal"` becomes a real app-wide lens, and it gets
a one-tap door.

- Wire the existing dial (`lib/preferences.ts:46`, consumed today by only
  Today + Settings) into: Home (VOC strip, CroppingUp, water reveal, the
  What-lines-up receipt → hidden at minimal; CompassNow stays), the left
  rail (collapses to clock/date/day summary), task rows (timing lines
  hidden), Calendar day cells (VOC chips etc.), Plan (see §4).
- CompassNow at minimal keeps the LOOP (it is the productivity answer) with
  plain why-lines. Server: `composeLoop` why strings gain non-astro
  variants — the loop already knows deadline/flow/schedule facts; say those
  ("Due Friday, and you have a free hour", "You started this 40 minutes
  ago"). Add `whyPlain` beside `why` in the payload; client picks by lens.
  Do NOT strip the astro why at medium/full.
- **The tap: a running session engages Quiet automatically.** SessionTimer
  start → lens forced to minimal until stop (preference untouched — it's a
  temporary override in context state). This is the flow-mode door for
  Priya/Maya who will never open Settings. A small "sky is quiet · session"
  note where the rail was, so the state is legible.
- Settings copy for the dial gets rewritten to say what it now really does.
  (Run `no-ai-slop` on every new string — owner rule.)

**Traps:** the HOME study's rules still bind — one voice per fact, no
duplicated modules per lens; don't let Quiet re-introduce layout shift when
cards hide (reserve with conditional render, not visibility). The tour
anchors (`lib/tour.ts`) must survive hidden cards — SpotlightTour advances
past missing anchors silently, so re-check the five stops under minimal.

## 2 · "I did a thing" (ask 3)

**What:** one universal log-it door writing the EXISTING wins primitive.

- `POST /planning/wins` already takes `{text, date, goalId?}`. Add nullable
  `taskId` and `habitId` columns to wins (additive schema), plus optional
  `minutes`.
- Client doors, in priority order: (a) the capture sheet gets a second mode
  — "did" beside "to do" — same free-text multi-line, each line becomes a
  win dated today; (b) Home's task-column header gets "log something done"
  next to the input (it writes a win, NOT a pre-checked task — a task that
  never needed doing is inventory noise, a win is a record); (c) Log's
  day view already shows the Wake — give it a compose box for any date, so
  backfilling yesterday works like the habit dots do.
- Generalize the ad-hoc session: GuidingStarsHub's `adHoc` POST
  (`GuidingStarsHub.tsx:444`) becomes a small shared component — title,
  optional link (task/habit/star/none), optional retroactive start/end or
  just minutes. Surface it in the session timer's DONE state ("log what
  this was for") — which also closes the maker-schedule loop: session ends
  → touch recorded on the thing it was for.

## 3 · Touches, not gauges (ask 4)

**What:** progress on an incomplete task = the dated record of having worked
on it. `done` stays binary forever.

- With `wins.taskId` from §2, a task's touches are queryable. Task rows
  (Home + Tasks page) render a quiet touch trail when present: "worked on ·
  Tue · Thu" or "3 sessions this week" — muted, after the title, no
  percentage anywhere.
- The loop's flow release ("stop on purpose") offers — never demands — a
  one-tap "log the stretch as progress" that writes a win with minutes from
  startedAt. Declining leaves no record, same as today.
- The weaver/linesUp may NOT read touches as a scheduling signal in v1.
  Measure first whether touch data even accumulates before letting it steer
  (calibrate-thresholds-by-fire-rate lesson).
- Guard against the failure mode by test: a task with touches and
  `done:"false"` must never render as done, and the Wake must show the
  touch (it's a win — automatic).

## 4 · The plain weave (ask 1's scheduler)

**What:** Plan gains a sky-free placement path using inputs it already
collects: dueDate, estMinutes, energy, wake/sleep hours, gcal busy blocks.

- At minimal lens, "Weave it in" runs placement WITHOUT elections: sort by
  deadline pressure, place high-energy work early-day (chronotype-aware),
  respect busy blocks, honest unplaced-with-reasons exactly like today.
  The existing `dayWeaver` likely factors — audit it for a
  sky-consultation seam rather than writing a second weaver; two weavers
  that drift is the WeekStrip/AlreadyWoven bug shape again.
- Copy at minimal: placements described as scheduling ("fits before your
  2pm, leaves the evening open"), zero tide vocabulary. The
  describe-conditions-never-promise rule still applies — a plain scheduler
  must not start promising outcomes either.

## 5 · Daily-driver gaps (parallel, independent)

- **Recurring tasks (F7) — needs the owner's call first**: extend tasks
  with a recurrence rule vs. give habits a "chore" flavor (no streak
  framing, surfaced in the task list). The audit leans habit-flavored —
  cadence machinery already exists and never guilt-trips — but the label
  matters ("change furnace filter" is not an identity practice).
- Reorder on Home (F11): sortOrder exists; move-up/down buttons beat drag
  for a first pass (mobile).
- Natural-date quick-add (F12): reuse Plan's parser on the one-line input —
  single line in, `{title, dueDate}` out; fall back to raw title on any
  parse failure, never block the add.
- Summonable review (F10): a "review now" door in Log rendering the Sunday
  card's content on demand; the Sunday auto-appearance stays.
- Naming (F9) — **owner decision**: whether the minimal lens relabels
  Stars/"Guiding Stars" (e.g. "Goals") per-lens, or the name holds
  everywhere. Do not decide this in code.

## Order and discipline

1. §1 Quiet lens (unlocks the owner's daily use immediately)
2. §2 log-it doors (small schema + high daily value)
3. §3 touches (rides §2's schema)
4. §4 plain weave (biggest engine work)
5. §5 as fill-in, F7 and F9 gated on owner answers.

House rules that bit this codebase before and WILL apply here: run the suite
in all three timezones before any push; additive schema only (drizzle-kit
push drops what you remove); probe deploys by response body, never status
(the /api fallback now 404s JSON, keep it that way); every new user-facing
string through `no-ai-slop` at write time; astro-quiet is a LENS, not a
fork — one product, one inventory, one ledger.

Session-model note for whoever builds: all API calls need the session
interceptor (installed in main.tsx) — new fetch call sites inherit it
automatically; don't hand-roll headers with tokens.
