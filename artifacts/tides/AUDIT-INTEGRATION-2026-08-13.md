# Integration audit — do the features talk to each other?

Owner's question, 2026-08-13, after a day in which four separate defects
turned out to have the same shape: one surface writing something another
surface could not see.

Method: inventory every persisted fact (28 tables, ~30 localStorage keys),
then ask of each — **who writes it, who reads it, and who ought to.** A fact
written by one feature and read by nobody is a false affordance; a fact read
by one surface and not its sibling is how two screens end up disagreeing.

Fixed earlier today, all the same class, listed so the pattern is legible:
Today couldn't see tasks the weaver scheduled · the hero said "nothing on
your list" to someone whose list was fully placed · the check-in's intention
was invisible to the ledger that asks for one · three surfaces answered
"what should I do now" independently.

---

## 1. Habits are invisible to every timing engine — the worst of these

**The data:** `habits` carries `favoredElements`, `favoredPhases`,
`favoredPlanets`, `bestWindowType`, `solarAnchor`, `minimumViable`, and
`goalId`. That is a complete timing signature, and the form asks for all of
it.

**The reality:** neither `linesUp` (the "what should I do right now" engine)
nor the weaver (`plan.ts`) reads the habits table at all. Confirmed: zero
references in either. `linesUp` builds its inventory from tasks and goals
only.

**Why it matters most:** the owner spent today filling in exactly these
fields. Everything asked for on that form is currently write-only as far as
timing is concerned — the app collects a preference and then never consults
it. Under WORLDBOOK §1b the fields are correctly optional, but "optional"
was supposed to mean *the suggestion is skipped*, not *the answer is
discarded*.

**The fix, roughly:** habits become held items in `linesUp` (kind:
`"habit"`), gated on being due today per their cadence, with their favored
signature mapped onto the same activity-correspondence shape tasks use. The
Home day-view already surfaces habits; the engine simply needs the same
inventory the display has.

## 2. The reflect-don't-predict loop never closes

**The data:** felt ratings and daily check-ins are written by Log/Today and
read back for display in Log.

**The reality:** no engine reads them. `electionEngine`, `linesUp` and
`rareWindows` contain zero references to felt ratings.

**Why it matters:** DESIGN.md §7 calls this "the only empirical calibration
data in the category" and the app's stickiest possible feature — the thing
that turns falsifiability from a liability into an asset. Today it is a
diary the engine cannot read. Note the honest constraint: using ratings to
*tune* the astrology is a research project, but using them to *report a
pattern back to the person* ("your highest-rated days this month were mostly
Building tides") is the shipped promise in §7 and needs no model at all.

## 3. The check-in's answers mostly go nowhere

**The data:** the turning-point check-in collects a release line, a reclaim
line, per-star "still true / needs a look" marks, and the one shot.

**The reality:** only the one shot reaches the server (wired today, into
`intentions`). Release, reclaim and the star marks live in localStorage
under `compass-nm-checkin-*` and no other surface can read them —
`GuidingStarsHub` has no idea which stars you flagged for a look, though
that is precisely the page you would act on it from.

**Consequence:** the marks are lost on another device, and the star page
cannot show the flag the user set an hour earlier. The kept card's own
"N stars marked for a look →" link goes to a page that then shows nothing
about them.

## 4. The rare-moment notice doesn't know what you hold

**The reality:** `rareToday` scores all ~60 activities in the correspondence
table. It has no access to the user's tasks or stars.

**Consequence:** the homepage can announce that today is exceptional for
"haircut / grooming" to someone who has never mentioned a haircut. It is
true, and it is unasked-for — the same complaint that produced the
"Compass never invents work" rule.

**The fix:** rank or filter hits by whether the activity matches something
held (task, star, or habit). Keep the unheld ones behind a "also
exceptional for…" line rather than leading with them.

---

## What is genuinely well connected (so this reads as an audit, not a list of complaints)

- **The schema anticipated most of this.** `wins.goalId`, `intentions.goalId`,
  `habits.goalId`, `tasks.goalId`, `planningWindows.goalId` all exist — the
  links are modelled, the surfaces just have not all been taught to use
  them. Star-linking through the planner was closed today.
- **Tasks ↔ windows ↔ Today ↔ Home** now share one query and one cache key,
  after today's fixes.
- **One authority for the verdict** holds: `evaluateActivityInterval` and
  `computeElections` now share `supportLevelFrom`, and flow protection lives
  in `linesUp` where both Home and Today read it.
- **`usage_events`, `cultivations`, `habit_logs`, `daily_check_ins`** are all
  genuinely wired to routes (an earlier snake_case grep suggested otherwise;
  the code uses camelCase identifiers).

## Executed 2026-08-13 (same day)

| Gap | Status |
|---|---|
| 1 · Habits invisible to timing | **Closed.** Habits enter `linesUp` as held items, gated on cadence (done-today skipped, `occasional` never chased, a weekly habit at target left alone). Verified live: a habit now receives a real verdict. |
| 3 · Check-in answers stranded | **Partly closed.** `lib/checkInState.ts` gives the saved answers one owner, and Guiding Stars now shows a "needs a look" flag on the stars marked at the turning point. Ceiling stated in the file: localStorage is per-device; the durable fix is a `goals` column and a migration. |
| 4 · Rare notice ignores inventory | **Closed.** `/elections/rare-today` gathers activity keys from tasks, stars and habits; held activities lead, unheld ones are marked so the surface can rank them second. Inventory failure degrades to the unranked notice rather than losing it. |
| 2 · Reflection loop | **Open by choice** — see below. |

**Found while closing gap 1, and worth its own line:** `linesUp` dropped
unmatched items with a bare `continue`, so an item the matcher could not
read vanished from every surface — the exact confusion `heldBack` exists to
prevent. It surfaced immediately once habits joined the inventory (a habit
named "Morning run" scores 1.375 against a 2.0 confidence bar). The bar is
right; guessing would be worse. The silence was the defect, and the reason
is actionable: "Compass can't tell what kind of work this is — name it to
get timing."

## Suggested order

1. **Habits into `linesUp`** — largest gap, and it makes an existing form mean
   something.
2. **Check-in star marks to the server** — small, and it closes a link the UI
   already promises.
3. **Rare notice consults inventory** — small, and it is a values fix as much
   as a feature one.
4. **The reflection retrospective** — the §7 promise, biggest product upside,
   deserves its own session.

---

## 5. `/api/tides/events` is pathologically slow — the empty-calendar cause

Found while verifying the felt-pattern card, which never rendered because
nothing on the page did. MEASURED on a cold server, no other load:

| range | result |
|---|---|
| `days=7` | 13.2s |
| `days=30` | 42.2s |
| `days=90` | >90s (client times out) |

**Calendar requests `days=90` on every load.** The route is synchronous, so
Node's single thread is held for the whole duration and every other request
queues behind it — the Log's timeline, the wins ledger, the felt pattern,
`planning/windows`. A calendar holding real committed windows therefore
renders empty, which is exactly what the owner reported ("nothing is
populating on the monthly view … even though i already put a lot in plan").

**The obvious suspect was wrong.** `getNextAngularCrossings` scans hour by
hour across the range (2,160 hours at 90 days), so it looked like the
culprit; gating it behind a flag changed nothing — 99.0s with it off versus
97.7s on. The cost is elsewhere in the route. That change was reverted
rather than shipped as an inert fix with a comment claiming otherwise.

**Next step is a profiling pass**, not another guess: instrument the route's
sections, find what actually costs ~1.4s per requested day, and fix that.
Until then Calendar's `days=90` request is the single most expensive thing
the app does.

**Caveat worth carrying:** these numbers come from the local `api-scratch`
dev server (tsx, unbundled) against a remote database. Production runs
compiled code and may be faster — the FIRST step of the profiling pass
should be reproducing the timings against the built server, so the fix is
aimed at a real cost rather than a dev-mode artifact.
