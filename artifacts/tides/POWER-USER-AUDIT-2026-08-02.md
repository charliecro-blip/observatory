# Power-user audit — status, 2026-08-02

*An external audit arrived arguing that Compass's remaining danger is no longer
looking shallow, but sounding certain in several voices at once. Its ten P0s
are all shipped and live. This file records what each turned out to be, what
was verified rather than assumed, and what the P1/P2 lists still hold.*

---

## The audit's central claim held up

Every P0 was checked against the code before anything changed. All ten were
real, and three were materially worse than described. Two things it framed as
"users will notice inconsistency" were outright bugs.

---

## P0 — all shipped

| # | Item | What it actually was |
|---|---|---|
| 1 | Rename Best next move | "Best" claimed a global optimum over facts the engine doesn't hold. Now **Strongest fit right now**. |
| 2 | Ask as explanation layer | Its prompt literally said *"your job is to help the user decide what to do right now"* — the same question the deterministic engine answers behind it. |
| 3 | Hero curve label | A fixed sine wave; only the marker carries data. Its x-axis is the CYCLE, not the clock, so plotting real data there would contradict its own labels — labelled instead. |
| 4 | Define energy/confidence | Bare percentages invited the reader's own definition. "Confidence" → **signal agreement**, which is what it measures. |
| 5 | "The sky reads this as" | Compass classifying wording through its correspondence system. Nothing celestial read anything. |
| 6 | Synthetic Star targets | `Math.max(scheduledCount, 2)` in **five** places — a new star read "0/2 this week" with a 0%-filled bar. |
| 7 | Canonical timing | **Not drift — a bug.** See below. |
| 8 | Unavailable ≠ empty | `gcalBusy()` returned `[]` for both failure and empty, so the weaver planned over real meetings and looked equally confident. |
| 9 | Activity vs. election | Two grading scales on one page with no explanation of why they differ. |
| 10 | Doctrinal rigidity | "…regardless of how the Moon looks" asserts no other testimony can matter. |

### The three that were worse than described

**#7 was a frame-of-reference bug, not drift.** `lstNoon` is a UTC hour-of-day;
the code added it to *local* midnight, so every result carried the viewer's UTC
offset. New York on 2026-08-02 computed as **sunrise 09:53, sunset 00:09 the
next morning**. Every planetary-hour band in Calendar was displaced for
everyone outside UTC. Fixed, with a test holding client and server within six
minutes across four cities and five dates.

**#8 was silent.** The failure produced a schedule indistinguishable from a
correct one — the user only discovers it when a block lands on a meeting.

**#6 was in five places**, including leaking into the element-balance aggregate.

### One deliberate departure

Analytics keys (`next_move_done`) were **not** renamed alongside the label.
The audit's own continuity contract argues against breaking existing history
for a cosmetic rename.

### One place the audit was over-cautious

The eclipse rule gets **no** dispute note. It is near-universal across
traditions, and manufacturing controversy where none exists is its own kind of
dishonesty. Mercury retrograde does get one — many practitioners accept it for
a *return* (relaunch, revision, resuming) and read it as hostile mainly to new
beginnings.

---

## What the audit surfaced indirectly: dead code

Chasing #6 and #2 turned up components that are **never rendered**, proven by
their strings being absent from the production bundle:

- `TideChart` (~430 lines)
- `NorthStarsCard`
- the send-mode `QUICK_INTENTIONS` entries
- and a scan suggests more: `DayTimeline`, `FourteenDays`, `PlanetaryPulse`,
  `ElementalBalance`, `MonthBars`, plus their private helpers

Three of those helpers (`tlApproxSunriseSunset`, `sunriseSunsetApprox`,
`dayPlanetaryHoursSimple`) are **further copies of the same timing math** — and
they carry the same UTC bug that was just fixed in Calendar. They are dead, so
they harm nobody today; they would resurrect the bug the moment anyone revived
them. Deleting them is the real fix for #7.

**A trap worth remembering:** source-grep tests can pass on dead code. One
assertion added for #6 was pinning a guard inside `NorthStarsCard` — verifying
nothing a user reaches, *and* blocking that component's deletion. Corrected to
assert only against surfaces known to render. Expect this on every
dead-component removal.

---

## P1 — not started, in recommended order

1. **A real astrological receipt** — facts, orbs, applying/separating, dignity,
   sect, and *why this outranked that*. The current "working" view exposes
   model arithmetic (`+0.72 · w 0.85 · loud 0.90`), which is precision theater:
   it shows the scoring, not the astrology. Split into an astrological receipt
   and a synthesis receipt; keep decimals behind a research mode.
2. **"What changed since your last check?"** — the single best defence against
   compulsive re-checking. Often the honest answer is *nothing*.
3. **Start / Continue / Another option / Why this** on recommendations, plus
   recommendation persistence and flow protection. Today the only action is a
   checkbox meaning *done*, which skips the event that matters — *I started*.
4. **Calendar presets** (Plan · Timing · Astrologer · Clean) — choose the
   question, not the quantity of layers.
5. **Stable facets instead of rotating takes** — a ↻ that yields another
   phrasing reads as a slot machine to a sensitive user. (Note: I *added* one
   of these to Season earlier today; it should convert with the rest.)
6. **Log: outcome over alignment** — "did the weather fit?" invites confirmation
   bias. Ask what happened and whether the suggestion helped.
7. **Method & assumptions in Settings** — house system, hour method, orbs, VOC
   definition, ruleset, model role, synthesis version. Serious users want to
   know what the system believes before they customise it.
8. Save the original rationale + ruleset with important elections. *(Partly
   done: `ruleset` now rides on every election result.)*
9. Alternative task signatures when classification is ambiguous.

## P2 — later

Electional strictness profiles · two-moment comparison · practitioner
inspector · personal pattern findings with real sample sizes · recommendation
calibration history · exportable decision records · a "quiet Compass" mode.

---

## Standing question for this codebase

**"Does this code actually render?"** Three separate dead surfaces turned up in
one session, one of them holding a duplicate of a live bug. Deployment
verification (fetch the bundle, grep for a string that can only exist in the
new build) caught what typecheck and tests did not.
