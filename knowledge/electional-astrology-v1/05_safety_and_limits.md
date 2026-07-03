# Safety, Inherited Limits, and Honest Boundaries

## Inherits the medical KB's safety floor

Any category that touches health, medical procedures, surgery, or treatment
timing is **out of scope**, full stop — same hard exclusion already
documented in `knowledge/medical-astrology-v1/10_safety_floor.md`. Electional
astrology has a long tradition of "surgical elections" (choosing a time for a
procedure); this app will not offer that, for the same reasons the medical KB
already gives: astrology is not medical causation, and life/procedure-outcome
prognosis is excluded everywhere, permanently. A user starting an ordinary
wellness *habit* (meditation, exercise routine) is a normal 6th-house
election; a user asking when to schedule a *surgery* is not something this
feature answers, and the app should say so directly rather than silently
declining.

## Honest limits of electional astrology itself, independent of this app

Worth stating plainly, the way the medical KB states its own tradition's
disagreements rather than papering over them:

1. **Electional astrology cannot promise an outcome.** It describes the shape
   and early tempo of a beginning, not its result. A well-elected business
   can still fail for ordinary business reasons; a poorly-elected one can
   still succeed through sheer execution. This should be explicit in the
   feature's copy, not just implied.
2. **Perfect elections are rare and sometimes impossible within a real
   deadline.** The tradition itself acknowledges this — Lilly repeatedly
   notes "if time permits" and gives fallback guidance when it doesn't. The
   feature should do the same: show the best *available* window honestly,
   flag what it fails, and never manufacture a false "all clear."
3. **Sources disagree on secondary rules** (exact via combusta boundaries,
   how hard a "hard block" Mercury retrograde really is outside contracts,
   whether the Moon's own dignity matters as much as her aspects). This v1
   takes reasonable, commonly-cited positions; it is not the only defensible
   reading, and should be labeled a v1 for exactly that reason.

## Note on building this (left for a separate pass, not done here)

This document set is content only — no code changes were made alongside it.
When implementation starts: the natural home is a new `computeElection()`
function in `astro.ts` or a sibling file, scoring a candidate date/time
against `01_universal_rules.md` + the chosen category from
`02_categories.md`, then a date-range scan reusing `findPeakWindows`'s
pattern from `dayarc.ts` to surface the best windows in a user-given range —
mirroring how `/api/tides/best-times` already scans lens curves across days.
UI-wise, this likely wants its own page rather than folding into an existing
tab, given how different its interaction model is (pick a category and a
date range → get ranked windows) from anything else in the app today.
