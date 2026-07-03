# The Planetary-Hour Overlay

This is the one piece of electional practice the app **already computes and
already has content for.** `astro.ts::getPlanetaryHour` divides sunrise-to-
sunset and sunset-to-sunrise into 12 unequal "hours" each, ruled in the
Chaldean order. `tides.ts::PLANETARY_HOUR_RULES` already assigns each hour a
prompt and a list of supported activities:

| Hour ruler | Already-supported activities (verbatim from the app) |
|---|---|
| Moon | body care, home, rest, emotional processing, food, care, domestic rhythms |
| Mercury | writing, calls, email, scheduling, study, editing, sorting, commerce |
| Venus | art, design, relational care, pleasure, invitations, aesthetic refinement, dates |
| Mars | movement, action, exercise, boundary work, errands, hard edits, decisive problem-solving |
| Jupiter | teaching, publishing, big-picture planning, outreach, generosity, study, launches |
| Saturn | structure, discipline, planning, accounting, cleanup, commitments, maintenance, finishing |
| Sun | visibility, presenting, leadership, self-expression, creative confidence, direction |

**How this layers onto an election:** the day-level rules in
`01_universal_rules.md` and `02_categories.md` narrow a *day*; the planetary
hour narrows the *hour within that day*. A business launch (10th house, Sun/
Saturn) on a day that already clears the universal cautions is strongest in a
Sun or Jupiter hour specifically — the day says "this is a good week to
launch," the hour says "launch it at 10am, not 4pm." This two-layer scan (good
day × good hour within that day) is exactly the shape `findPeakWindows` +
`getPlanetaryHour` already support — no new primitive needed, just composing
the two that exist.

**One gap worth naming:** the current `PLANETARY_HOUR_RULES` table has no
entry for Uranus, Neptune, or Pluto because classical planetary hours only
use the seven traditional bodies (this is correct and intentional — hour
rulership is a Hellenistic/medieval technique that predates the outer
planets' discovery). Nothing to fix here; noting it so it isn't mistaken for
an oversight later.
