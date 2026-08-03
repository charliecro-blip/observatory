# Question for critique: is the retrograde-significator cap too broad?

Short version: **the median activity in our table is barred from the top tier
for 38% of the year**, and the reason is that a rule about the significator of
*the matter* is being applied to generationally-retrograde outer planets. We
want a doctrinal read before we change it, because it is the largest single
suppressor of convergence in an ordinary month.

## The rule as implemented

`electionEngine.ts`, in the tier assignment:

```ts
const dayRxSigs = sigPlanets.filter(p => p !== "Sun" && p !== "Moon" && isRetrograde(p, jdNoon));
...
if (tier === "great" && dayRxSigs.length > 0) { tier = "good"; cappedBy = "retrograde-significator"; }
```

`sigPlanets` are the activity's significators from the correspondence table.
Any one of them retrograde caps the window. There is no distinction by planet,
by whether the retrogradation is meaningful to the matter, or by how central
that significator is to the activity — the weights in `act.planets` are used
for scoring but not here.

## Measured exposure (2026, computed from our own ephemeris)

Percentage of the year each planet is retrograde:

| Mercury | Venus | Mars | Jupiter | Saturn | Uranus | Neptune | Pluto |
|---|---|---|---|---|---|---|---|
| 18% | 12% | 0% | 24% | 38% | 40% | 43% | 45% |

Across the 45 activities carrying a non-luminary significator:

- **median activity is capped 38% of the year**
- 6 activities are capped **more than half** the year
- none exceed 75%

And in a 30-day ordinary-month scan across all activities, this gate demoted
**141** windows — by far the largest suppressor once the eclipse gate is out of
the picture. (Our first calibration ran over an eclipse season, where the
eclipse gate demoted 266 and masked this entirely.)

## Why we think it may be wrong

1. **Outer-planet retrogradation is a background condition, not an event.**
   Pluto is retrograde 45% of every year. Treating that as a reason to withhold
   "this timing is unusually good" reads as a category error: it is closer to a
   standing condition than to a timing signal about a chosen moment.
2. **The rule's traditional force is about the significator of the matter.**
   Hampar's caution concerns the planet signifying *the thing being begun* —
   classically the seven visible planets, in a system that had no outers. Our
   correspondence table gives many activities an outer as a secondary
   significator (creative work gets Neptune, transformation gets Pluto), and
   those inherit a caution that was never written about them.
3. **It does not distinguish weight.** An activity whose primary significator
   is Mercury and whose 0.3-weight secondary is Neptune is capped by Neptune
   for 43% of the year.
4. **It is invisible.** The user sees a `good` window with no indication that
   it was demoted, so the cap is neither explicable nor arguable. (We have just
   added a `cappedBy` field, so this part is now fixable regardless.)

## Why we are not simply removing it

- Mercury retrograde genuinely *is* the tradition's most-cited timing caution,
  and the table already has a per-activity `mercuryRx` stance, so a blanket
  rule may be double-counting what that field already handles.
- A retrograde significator is a real electional consideration for beginnings.
  The distinction we are unsure of is whether it should cap the TIER (a claim
  about how well the moment converges) or appear as a caution ALONGSIDE the
  tier (a claim about a risk in the matter).
- We do not want to loosen a gate merely because loosening it produces more
  content. That is exactly the failure mode we are trying to avoid elsewhere.

## The specific questions

1. **Should the cap apply to outer planets at all**, given they are retrograde
   ~40% of the time and were not part of the tradition the rule comes from?
2. **Should it scale with the significator's weight** — capping only when a
   *primary* significator is retrograde, and perhaps only softening the score
   for a secondary?
3. **Should it cap the tier, or sit beside it as a caution?** Our instinct is
   the latter: convergence is a claim about how many independent testimonies
   agree, and a retrograde significator does not reduce that agreement — it
   qualifies what the agreement is worth. That would make it a caution the UI
   states plainly ("strong timing, but Saturn is retrograde — better for
   revisiting than for launching") rather than a silent demotion.
4. **Does the distinction between activity KINDS matter here?** A retrograde
   significator arguably matters enormously for "launch a venture" and very
   little for "long run" or "rest". The table already knows each activity's
   category — should the cap only apply to inceptions?
5. If we adopt (3), **what replaces it as a hard cap** — should anything?
   Eclipse windows and the malefic final aspect would remain the only hard
   demotions, which may leave `great` too easy to reach in an ordinary month.
   We would rather ask than assume.

## Constraint on the answer

Whatever we adopt must be **measurable before it ships**. We now have a
calibration harness (`tools/convergence-calibration.test.ts`) that scans all
activities across chosen months with and without a chart, and reports tier
counts, distinct source families, and cap reasons. Any proposed rule change
will be run through it on both an eclipse and an ordinary month before it
lands, and we would rather hear a rule stated precisely enough to implement
and measure than a principle we then have to interpret.
