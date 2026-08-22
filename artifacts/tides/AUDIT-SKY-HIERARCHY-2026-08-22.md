# Audit — the ranking rule, everywhere else

> "planetary hours and days are very much secondary to lunar placement and
> aspects and other planetary aspects… that rule can be applied pretty much
> throughout the app. VoC is also very useful" — owner, 2026-08-22

The synthesis engine was fixed first (commit `36e344d`). This audits the rest:
the election engine, the day arc, the rail, and the surfaces that render a
planetary hour or day. Everything below is measured, not read.

## Summary

| # | Where | Finding | Status |
|---|---|---|---|
| 1 | `electionEngine.ts` | `revision` missing from `SUBSTANTIAL_MODES`; 46% of its windows were the hour alone | **fixed** |
| 2 | `Rail.tsx` | Planet aspects sat below THIS HOUR, collapsed, in scan order | **fixed** |
| 3 | `Rail.tsx` | `ESSENTIAL_RAIL` kept the hour and dropped every aspect | **fixed** |
| 4 | `dayarc.ts` | Standing planetary aspects weighted 0.05 — the hour's own order | **fixed** |
| 5 | `Studio.tsx` | Day ruler ranked above the day's timed events; no planet aspect could reach the card | **fixed** |
| 6 | `Launch.tsx` | Result's only evidence line was the planetary hour | **fixed** |
| 7 | `Tooltip.tsx` | Described the hour as a component of the 1–7 score, which has no hour term | **fixed** |
| 8 | `SkyReadouts.tsx` | "Resonant now" pushed the hour card first | **fixed** |
| 9 | `habitTiming.ts` | Hour ruler +2 against a Moon aspect +1, and its reason shown first | **fixed** |
| 10 | `ElectionPicker.tsx` | "Auspice reads its good and great times…" — third person on a control | **fixed** |
| 11 | `election.ts` | A 14-day scan blocked the event loop for 66 seconds | **memoized** |

## 1. The election engine — the thing you complained about

You flagged this in July: *"it spit out a huge number of times based on
planetary days/hours."* A guard was written for it, and it worked — for the two
modes it named. Across all 50 activities over one week:

```
hour-alone windows, by activity mode        before    after
  execution        0/144    0%              0%        0%
  inception        0/ 81    0%              0%        0%
  revision        23/ 50   46%   ←          46%       0%
  maintenance     27/ 50   54%              54%      54%
  recovery        13/ 60   22%              22%      22%
```

`SUBSTANTIAL_MODES` held `inception` and `execution`. `revision` is
`edit-revise`, `finish-polish`, `repair`, `repair-bond` — redrafting a chapter,
repairing a bond. The guard's own note defends hour-only rows for **upkeep and
recovery** ("a Mercury hour is exactly the right grain for errands"), and
revision is neither. It kept 45 of its 50 windows after the fix, so it lost the
hour-only rows without losing coverage.

**Maintenance and recovery keep theirs deliberately.** That is the note's
argument and it still holds.

## 2–3. The rail

Two separate problems, and I got the first one half wrong before measuring it
properly — the data was never missing.

**Placement.** A "Planetary aspects" section existed, but *below* THIS DAY and
THIS HOUR, collapsed behind a toggle, listed in scan order rather than by orb.
So on 2026-08-21 a Venus opposite Saturn at 0.2° — half of the reading you gave
a client — sat two sections under "Saturn's day" and behind a click, while the
hour had a row of its own. Now: above both, sorted by orb, tightest two visible
without the toggle.

**The essential cut.** `ESSENTIAL_RAIL` was `["season", "moon", "hour"]`. At the
density most people run, the planetary hour was one of only three things kept
and aspects — lunar *and* planetary — were dropped entirely. That is the
ordering exactly inverted. Now `["season", "moon", "aspects"]`; the hour returns
at expanded density, where someone has asked for the whole instrument.

Rail order is now: SEASON → MOON → MOON ASPECTS → PLANETARY ASPECTS → THIS HOUR.

## 4. The day arc

The curve was already close to right — the hour is an explicit "whisper"
(±0.03) and Moon aspects are the crests. But standing planetary aspects fed the
day's floor at `0.05 × standingH`, the same order as the hour's whisper, so a
Venus–Saturn opposition at 0.2° moved the day about as much as "it is the
Mercury hour". Raised to 0.14 — below the phase term (0.50), above the hour.

## 5–8. Left alone, because they are yours to decide

These are presentation calls, not ranking bugs, and each changes something a
person sees rather than what the engine believes:

- **Studio** renders `{dayRuler}'s day` as a 36px headline on a *shareable
  card*. Under the rule that is the weakest fact on the card in the largest
  type. The fix is a copy/design decision about what a card should lead with.
- **Launch** shows `{planetaryHour} hour · matches this venture` as a headline
  result. Its own comment already calls another signal "subtler and more
  advanced than the planetary hour / Moon's aspects", so the ordering is
  acknowledged in the file and not acted on.
- **Tooltip** documents the 1–7 score as "lunar aspects, element, void of
  course status, and planetary hour quality" and "resonance" as the hour,
  phase, element and aspect quality agreeing. The docs are accurate about the
  code; they should change when 5–6 do, not before.
- **SkyReadouts** says "RESONANT NOW answers 'what fits right now' from the hour
  and the Moon's sign" — hour first, co-equal. It is full-detail only, on a page
  someone reaches deliberately, which is the weakest case of the four.

## Not found

No other module ranks hours or days above the Moon or above planetary aspects.
`SessionTimer` counts down to the end of the hour, which is a timer and not a
claim. `Planner`, `Tasks` and `Calendar` use planetary hours for lanes, labels
and geometry rather than for ranking.

## Verification

962 tests green. Election rates re-measured per mode; rail order confirmed in
the browser against a live scratch API (Venus ☍ Saturn 1.1° visible without a
click, above THIS HOUR).


---

# Round two — the remaining surfaces, 2026-08-22

## 5. The Studio card

I overstated this in the first pass. The card's headline was already "Moon in
{sign}" at 64px; the defect was narrower. `{dayRuler}'s day` had a divider and
36px type **above** the day's timed events at 31px, so a keynote true for
twenty-four hours outranked the events that actually have a time.

Fixed: the timed events come first, the day ruler last at 28px. And a tight
planet-to-planet aspect can now reach the card at all — dayArc's events are
lunar and angular only, so a Venus opposite Saturn could never appear on a
surface whose stated stance is that it leads with primary sky facts, "moon sign,
phase, planetary day, timed aspects". It is exactly that, and more defensible
than the planetary day.

Verified in both formats: story 9:16 and post 4:5.

## 6. Launch

The line under each window was the planetary hour and nothing else, with every
lunar rule — void, via combusta, her final degree, what she applies to next —
folded behind the disclosure. On the screen where someone decides when to begin
something, the hour was the only evidence they saw.

`ElectionResult` now carries `moonLine`, composed on the server rather than
parsed out of a rule's English: her sign, and what she applies to next, which is
the classical heart of an election. The hour stays, beneath her, smaller.

    A great time   Sat, Aug 22 · 3:07 PM–4:13 PM
                   Moon in Capricorn · next square Neptune
                   ♃ Jupiter hour · suits this venture

## 7. The tooltips — both were describing something that does not exist

`qualityScore` claimed the 1–7 score draws on "planetary hour quality". It does
not: the score starts at 5 and moves with the Moon's applying aspects, her void
state, the day's element, retrogrades and any planet on an angle. There is no
hour term. `resonance` claimed a high-resonance moment is the hour, phase,
element and aspect quality agreeing, then said "all three".

Both were also unreachable — nothing references `term="qualityScore"` or
`term="resonance"`; the live terms are `angleCrossing`, `moonAspects`,
`moonPhase` and `planetaryHour`. Deleted rather than rewritten. Copy nobody can
reach is copy nobody corrects.

## 8. Resonant now

Three cards, pushed hour → Moon sign → Moon aspect, so the opening card was
always the planetary hour. Reordered; the doc comment said so too and now
matches.

## 9. Habit timing — the one the audit nearly missed

Not on the original list, and the clearest inversion in the codebase:

```
hour ruler matches      +2
Moon applying to it     +1
phase matches           +1
void of course          −1
```

The hour was worth double the Moon, in the code that decides when to suggest a
habit — and because its `why` was pushed first, it became the headline reason:
*"Strongly backed right now — Mars's hour is running"*, for something that turns
over every sixty minutes. Now Moon +2, phase +2, hour +1, void −2, and her
reason is the one shown. A test was added for the ordering; the existing test
that broke was asserting an element-precedence claim *through* the hour, and now
asserts it through the Moon.

## 10. Third person on a control

`ElectionPicker` read "Pick an activity — Auspice reads its good and great times
from the sky". The `· Auspice` sub-brand tag is deliberate and stays; the
sentence is second person now.

## 11. The 66-second request

Found while verifying Launch, not part of the ranking rule, but it is the page
this audit touched. A 14-day scan — the UI's default — scores every planetary
hour in the range: 336 `scoreElection` calls, each with its own
`getMajorAspects` (26ms) and `getLastMoonAspect` (16ms). The route is
synchronous, so one person opening Launch stalled every other request for over a
minute. This repo has shipped a 90-second calendar request before, the same way.

Memoized on (category, day, range, place): **cold 42s → warm 3ms**, and a
different latitude correctly misses.

**The memo is not the fix.** The first view still pays the full cost. The real
fix is to stop scoring all 336 hours to show 30 windows — rank days coarsely,
then score hours only inside the best few. That is a change to the scan
strategy, it wants its own measurement, and it is the largest piece of work this
audit turned up.
