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
| 5 | `Studio.tsx` | Shareable card headlines "{dayRuler}'s day" at 36px | owner's call |
| 6 | `Launch.tsx` | Result leads with "{hour} hour · matches this venture" | owner's call |
| 7 | `Tooltip.tsx` | Documents hour as co-equal in the 1–7 score and in "resonance" | follows 5–6 |
| 8 | `SkyReadouts.tsx` | "RESONANT NOW … from the hour and the Moon's sign" | owner's call |

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
