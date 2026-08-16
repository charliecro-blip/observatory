# Audit — Compass as a home base, astrology aside · 2026-08-16

The owner's brief, in their words: *"I want to be able to use this as my home
base aside from all the astrology scheduling stuff — and I want it to be that
the astrology doesn't have to be included when I'm in a flow. I want to be
able to track progress on things that I didn't plan, and to say that I'm
making progress toward tasks that I don't complete."*

Four asks: **(1)** a daily-driver productivity core that stands without the
sky, **(2)** a flow state where astrology steps back, **(3)** logging
progress on unplanned work, **(4)** partial progress on tasks that aren't
done. This audit measures each against the build as deployed today
(`d1b510c`), then walks the persona roster and a set of invented
productivity-native perspectives through the app with the astrology dialed
to zero in their heads.

**Method honesty:** the grounding is verified against source with refs; the
persona texture is simulation. The one-line headline is worth stating first:
**three of the four asks are generalizations of primitives that already
exist** — the build's problem is scoping and placement, not absence.

---

## Part A — Grounding: the productivity core as built

### What exists and stands WITHOUT astrology

| Capability | Where | Notes |
|---|---|---|
| Tasks: title, notes, due date, duration, energy, links to goal/project/step, sort order | `lib/db/schema/planning.ts` tasks table | Full CRUD, honest write-status |
| **Manual plain-time scheduling** | Calendar's block creator (`Calendar.tsx:195`) | Start/end typed by hand, zero sky involved — many readers of this audit will be surprised it exists |
| Habits with cadence (daily / most-days / n-per-week / occasional-never-scored) | habits table + `lib/habitTiming` | The app's best non-astro loop; the anti-guilt cadence design is genuinely differentiated |
| Goals → projects → milestones → tasks, with a server-computed progress rollup | goals/projects/milestones + `/planning/star-progress` | A real PM spine hiding under the "Guiding Stars" name |
| The wins ledger: auto wins derived from completions + **named wins (free text, any date, optional goal link)** | wins table, `/planning/wins` | Derived-not-stored design means it cannot drift |
| In-flight state: startedAt, flow protection, "keep going" | tasks.startedAt + linesUp loop | Binary but real |
| Reflection: felt rating + journal per day, any-day backfill | dailyCheckIns, Log's ReflectComposer | |
| Capture: one-line add, multi-line dump sheet | Home input, QuickCapture | |
| Google Calendar read + busy-aware loop; iCal export with scoped token | googleCal, exportIcal | Write-back is BACKLOG §5 |
| Sessions timer (now wall-clock-true), per-device auth, devices UI | SessionTimer, accountAuth | |

### Where astrology is load-bearing today (the flow-mode gap)

- **`astroDetail: "minimal" | "medium" | "full"` already exists as a stored
  preference** (`lib/preferences.ts:46`) — and is consumed by exactly two
  files: Today and Settings. Home, Plan, the rail, CompassNow, task rows,
  and Calendar never read it. The dial exists; the wiring stops at one page.
- CompassNow's why-lines are astro-phrased at the engine
  (`linesUp.composeLoop`: "This is what the hour suits").
- Task rows on Home carry timing states from the elections engine; Plan's
  scheduling language is entirely weave/sky; the left rail IS the sky.
- The weaver has no sky-free placement mode: "spread my tasks across free
  time by deadline and energy" without consulting elections is not offered,
  though `estMinutes`/`energy`/`dueDate`/gcal-busy — every input a plain
  scheduler needs — are all collected.

### Ask 3 (unplanned progress) — the primitives already exist, mis-scoped

- **Named wins** are exactly "I did a thing nobody planned": free text, any
  date, optional goal link. But the ONLY writing surface is EveningHarvest,
  which renders in evening ritual hours on Today. Unplanned work done at
  11am has no door until 18:00.
- **Ad-hoc sessions** (`planningWindows.adHoc: true`, logged as already
  done) are exactly "count what just happened" — and the only UI is a
  star-scoped "Logged session" button in GuidingStarsHub (`:444`). No
  title, no task link, no retroactive time range.

### Ask 4 (partial progress) — the one true gap

- `tasks.done` is binary text. No progress field, no "worked on it" record.
- `startedAt` marks NOW-in-flight only; released or expired, it leaves no trace.
- The wins ledger cannot reference a task (`wins` has goalId, no taskId) —
  so "moved the proposal forward" can be SAID but never attached to the
  proposal, and the task row can never show it.
- The star-progress rollup proves the appetite exists — but only
  project-shaped work gets it.

---

## Part B — The roster, astrology set aside

Condensed to the productivity question only: *would this person run their
work life here if the sky said nothing?*

- **Dan (zero astrology)** — closest to the owner's brief. He'd use: tasks,
  the committed week, manual calendar blocks, done-checking. He'd be blocked
  by: every task row muttering about hours and windows; Plan's only
  automatic scheduling being astrological; **no recurring tasks** ("change
  furnace filter monthly" has no home — habits are identity-flavored, not
  chore-flavored). Verdict: 70% of a daily driver, with astro noise he can't
  turn off.
- **Rachel (ADHD)** — the strongest case FOR flow mode and touch-based
  progress. Binary done is her enemy: a 4-hour portfolio task "not done" for
  nine days reads as nine failures; three real work sessions on it counted
  as nothing. She also captures constantly — capture is good — but
  half her real day was never planned, and the evening-only wins door means
  the unplanned half evaporates.
- **Kenji (PM)** — wants: plain agenda, manual blocks (exists), two-way
  gcal (missing), progress rollup (exists, but named "Guiding Stars" — he
  will never click that word for a work project). Naming is a real adoption
  barrier for the secular half of the roster.
- **Jess (spoonie)** — partial progress IS her model of a good day. "I did
  ten minutes of the application" must be sayable and visible. The cadence
  model already respects her; the task model doesn't.
- **Priya / Maya (phone, thin attention)** — flow mode is a tap, not a
  Settings dial, or it doesn't exist for them.
- **Luna / Amara / Ash / Alex / Sam / Marcus** — mostly orthogonal to this
  audit; none are HARMED by an astro-quiet lens, which matters: flow mode
  loses nobody.

## Part C — Invented perspectives (the productivity natives)

- **The Todoist refugee** — first three questions: recurring tasks?
  (no) · quick-entry with natural dates? (partial — the AI parse does it in
  Plan, not in the one-line add) · reorder my list? (sortOrder exists in
  schema, no UI on Home). Notices in week two that the *refusal* culture —
  honest empty states, no fake urgency — is why it feels calmer than
  Todoist. Stays only if recurring lands.
- **The GTD purist** — capture: yes. Clarify: the "kind of work / duration"
  resolution flow is genuinely GTD-shaped. Missing: someday/maybe (parked
  state), contexts beyond energy, and a weekly review that isn't
  Sunday-ambush-gated. Would rate the bones B+.
- **The bullet journaler** — the Log + wins ledger + felt rating is
  two-thirds of a BuJo; what's missing is exactly ask 3: writing "what
  happened" at the moment it happens, unprompted, unplanned.
- **The athlete/training log** — lives in ad-hoc sessions with durations
  ("ran 40 min, easy"). The primitive exists behind one star-scoped button.
  With a general "log it" door plus habit linkage, Compass covers a use
  case whole apps are built for.
- **The burnout minimalist** — wants the smallest true thing: a list, a
  day, done-marks, and *credit for partial effort so quitting at 80% doesn't
  read as zero*. Ask 4 is for them as much as for Rachel.
- **The maker-schedule dev** — flow mode tied to the session timer is the
  feature: start a session, the sky goes quiet, the timer keeps honest
  wall-clock time (it does, since `da20de0`), and on stop, the session logs
  itself as a touch on whatever it was for. That loop — start → work →
  auto-logged progress — is the single highest-leverage composition in this
  audit: it wires asks 2, 3 and 4 together with parts that all exist.

---

## Part D — Findings ledger

Graded like the HOME study: **[copy]** · **[small]** · **[design]**.

| # | Finding | Direction | Grade |
|---|---|---|---|
| F1 | astroDetail dial reaches 2 files; "minimal" is not a lens | Wire it app-wide; "minimal" = astro-quiet everywhere | design |
| F2 | Flow mode needs a one-tap door, not a Settings dial | Session timer auto-engages astro-quiet while running | design |
| F3 | Loop why-lines are astro-only at the engine | Plain variants beside them, chosen by lens | small |
| F4 | Named wins writable only in evening ritual | "Log something done" from capture + Home, any hour, any date | small |
| F5 | Ad-hoc sessions are star-scoped, untitled, now-only | Generalize: title, any link (task/habit/star/none), retroactive range | design |
| F6 | Nothing records "worked on it" on a task | Touch-based progress: wins gain nullable taskId; task rows show touches; done stays binary | design |
| F7 | No recurring tasks | Decide: extend tasks (recurrence rule) vs. reframe habits with a "chore" flavor | design + owner |
| F8 | The weaver cannot place sky-free | "Plain weave": deadline + duration + energy + gcal-busy only | design |
| F9 | "Guiding Stars"/"Stars" naming blocks secular adoption of the PM spine | Owner call — possibly lens-dependent labels | owner |
| F10 | Sunday/weekly review ambush-gated; GTD wants it summonable | A "review now" door in Log | small |
| F11 | No reorder UI though sortOrder exists | Drag or move-up/down on Home's list | small |
| F12 | One-line add lacks natural-date parse (the AI parse lives in Plan only) | Reuse the parser on the quick-add | small |

**What NOT to do**, recorded with the same weight: don't fork the app into
"astrology mode / todo mode." The weave is the moat
(enchanted-productivity thesis); flow mode is a *lens over one product*,
reversible per-moment, not a second product. And partial progress must never
become percent-complete micromanagement — touches, not gauges.

The build plan lives in `HANDOFF-HOME-BASE-2026-08-16.md`.
