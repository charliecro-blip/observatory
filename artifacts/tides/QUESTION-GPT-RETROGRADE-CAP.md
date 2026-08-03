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

---

# Addendum: speed, not just direction

The owner tracks Mercury's **speed** as well as its direction, and notes that
speed should favour slower or faster activities — which reframes the whole
question. Retrogradation is the *sign* of a velocity we are currently throwing
away.

`isRetrograde()` derives direction from two longitude samples one day apart and
discards the magnitude. The magnitude is therefore free. Measured for Mercury
across 2026 from our own ephemeris, in degrees per day:

| min | p10 | median | p90 | max |
|---|---|---|---|---|
| −1.305 | −0.539 | +1.402 | +1.924 | +2.186 |

- retrograde (v < 0): **18%** of the year
- near-stationary (|v| < 0.2°/day): **6%** of the year, 21 days

Three things follow.

**1. The binary hides the most loaded state.** A station is the moment a planet
is motionless before reversing, and traditionally the strongest expression of
its condition. Our current rule treats a stationary Mercury and a Mercury three
weeks into a smooth retrograde as identical, and both as identical to a Mercury
moving 1.3°/day backwards. Those are three different conditions.

**2. Speed is a correspondence, not only a caution.** The owner's point: a fast
direct Mercury (near +1.9 to +2.2°/day) suits quick correspondence, errands,
short exchanges; a slow or stationary Mercury suits revision, research, careful
detailed work, going back over something. That is not a warning at all — it is
a *match* between the quality of the motion and the quality of the activity.
Our `ACTIVITIES` table has no field for this, and arguably should: something
like a `tempo` preference (`quick` | `slow` | `either`) that the engine can
match against measured speed.

If that existed, "Mercury retrograde" would stop being a blanket caution and
become what it probably always was — a period that genuinely favours re-doing
over doing, and is a *good* time for a large class of activities.

**3. It may dissolve the original question.** If speed is matched as a
correspondence, the retrograde cap may not need to exist at all for Mercury.
The remaining question would be narrower: does a retrograde *outer* significator
mean anything for a chosen moment, given it is a background condition 40% of
the time?

## Revised questions

1. Should the tier cap be replaced by a **speed correspondence** — matching
   measured planetary speed against an activity's tempo preference — with
   retrogradation surfaced as provenance rather than as a demotion?
2. Is **stationary** (|v| < ~0.2°/day) the state that deserves special
   treatment, rather than retrograde? And if so, is it a caution, or is it a
   different kind of favourability (concentrated, fixed, hard to shift)?
3. Should tempo apply beyond Mercury? A slow Saturn versus a fast Jupiter is a
   real distinction, but we do not want to invent a system where none was
   inherited.
4. Where does the existing per-activity `mercuryRx` field fit, if speed is
   modelled properly? It may become redundant, or become the override for the
   handful of matters where the tradition is emphatic.

---

# Note: your untimed-chart prediction was correct, and it was a live defect

You wrote that for someone with a chart but no known birth time, "planet-to-
natal contacts may still be usable, house-based testimony must remain absent."
That was not a hypothetical.

Settings stores `birthTime: form.birthTime || "12:00"` alongside
`timeKnown: false`. The elections route gated on `stored.birthTime != null` —
which is true for the substituted noon — so an untimed chart arrived at the
engine fully populated, with an Ascendant computed from a moment nobody was
born at, and received house cusps from it. Since personal families can decide
the tier, that fabricated Ascendant could promote a window to `great` and have
it labelled personally reinforced.

Nobody has hit it: production holds eight charts, none untimed. Fixed anyway.

Houses are now withheld when the time is unknown; transit-to-natal contacts are
kept, since planetary longitudes barely move across a day — except the Moon,
which travels ~13°/day and would be up to 6.5° out, three times the 2° orb the
rule uses.

This is the third defect of the same shape in one session: a value standing in
for a fact it had not established. `personalized` meant "a chart exists".
`daySources.length` meant "independent signals". `birthTime != null` meant "the
time is known". None had produced a visible failure; all three would have, once
the tier was promoted to the centre of the product. Worth naming as a class,
because the convergence contract you proposed is exactly where this class does
damage — every field it introduces is a claim, and each one needs to be true of
the specific window rather than of the request.
