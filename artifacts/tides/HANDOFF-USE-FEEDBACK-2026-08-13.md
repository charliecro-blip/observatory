# Feedback from real use — 2026-08-13

The owner spent an hour actually using Compass (habits, a to-do dump, the
plan) and reported ~20 things. This is the ledger: what was fixed same-day,
and what is still open with the reasoning that makes each one non-trivial.

## Fixed and shipped (commit adf32f7, plus 625c545 / d6a1cf9)

| Item | What it was |
|---|---|
| Half-filled habit form lost on tab change | Component state; leaving Habits unmounted it. Now a per-keystroke localStorage draft, cleared on save. |
| Woven plan never reached Tasks | It *does* create tasks — but only on commit. Weaving looked like the act itself. Now says "a proposal — nothing is on your calendar or in Tasks until you keep it", and each row has its own **keep**. |
| "14d" | Unnamed abbreviation → "last 14 days", every dot titled with its date and whether it was done. |
| Sprout emoji unadjustable | It was always an editable field, just unlabelled. Now titled/aria-labelled as yours to change. |
| "Hard rule inherited from the KB" | Internal vocabulary in a user-facing gloss (breaks CLAUDE.md's own rule). Rewritten, as was "the KB's flagship election". |
| Timing fields felt mandatory | The block now states once, at the top: **timing is all optional; the habit works the same without it.** |
| "Best time of day" | A mislabel — every option is a *kind of work*. Renamed "Kind of work". |
| New-moon banner inert | Now links through to this cycle's check-in. |
| Minutes not typeable / rounded | Free typing, clamp on blur; server stopped rounding to quarter-hours. |
| One element only | Multi-lane, honoured by the scheduler (see 625c545). |
| Big tasks | "Break into moments" on cards ≥90 min. |

## Still open — and why each is bigger than it looks

### 1. Home is missing the day (HIGH — owner: "that should be essential")
Home shows the reading, the check-in, the rare notice, and a task list —
but **no calendar view of today**, no woven plan, no habits. The owner
expects to land and see the shape of the day.
- Needs: a compact day-timeline on Home (scheduled windows + habits due),
  reading from `planningWindows` and `habits` rather than a new endpoint.
- Watch the banner queue: Home is already dense, and the density dial
  (essential/expanded) should govern whatever is added.

### 2. Today's stale prompts (HIGH, and cheap-ish)
Today says "Name one thing for today" and "Nothing on today yet" *after*
tasks exist and an intention is set. Two separate staleness bugs:
- `pickNextMove` treats "no tasks" as the empty case, but the owner's
  tasks were committed via the Planner (tasks + windows), so the query
  Today reads may not include them, or reads a different day boundary.
- The new-moon intention is stored per-cycle in localStorage
  (`compass-nm-checkin-*`); Today's own intention prompt doesn't know
  about it. One of the two should defer — most likely Today's, since the
  check-in is the rarer, more deliberate surface.

### 3. Multi-select for "kind of work" (MEDIUM)
`bestWindowType` is a single string column on `habits`. Multi-select needs
a schema change (array column or join), the same shape the element
multi-lane change took for tasks. The owner also wondered whether these
should be framed as *energy* rather than kind — worth deciding before
migrating, so the column is named for what it means.

### 4. Explain the astrology inline (MEDIUM — recurring theme)
"Consolidation corridor", "an 11th-house year", "Neptune square your Moon"
appear with no way to ask what they mean. The owner: *"each of these
astrological aspects should have options to explore more — otherwise,
it's too much data."* DESIGN.md §17 rule 3 already requires this
("concepts explained where introduced") — the Bearings card predates it.
- Needs: a tap target per phrase → the existing sky-readings/`composeTakes`
  machinery, which already writes plain-language multi-take explanations.

### 5. Connect tasks/habits/to-dos to Guiding Stars (MEDIUM)
Habits already have a Guiding Star picker in the creation form; tasks
created via the Planner have `goalId` in the schema but no UI to set it,
and the intake cards don't offer it. The owner wants it uniformly.

### 6. Per-item planning + a calendar view of the plan (MEDIUM)
Per-item **keep** shipped today. Still missing: seeing how the kept items
*fit together* — a day/week calendar of the proposal rather than a list
grouped by day. Overlaps with #1; likely the same component.

### 7. VOC is over-applied (MEDIUM, engine)
Owner: *"a lot of these things I'm planning are very doable during VoC."*
The correspondence table already carries `voc: "avoid" | "neutral" |
"favor"` per activity, so the data model is right — but the day-level
copy and the Planner's tiering may be treating the void as a general
caution rather than consulting the activity. Measure which surfaces apply
a blanket VOC penalty before changing anything.

### 8. Philosophy to encode (the frame for all of the above)
> "The timing is secondary to actually doing the thing — being able to set
> goals and track them should almost be independent of the timing; the
> timing can be a parallel suggestion."

This belongs in WORLDBOOK.md as a first-class product commitment, and it
implies a review: anywhere the app *blocks* or *demands* timing input
before a plain productivity action is a defect under this rule. The
"timing — all optional" line shipped today is the first application.
