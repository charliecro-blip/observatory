# Home, the Plan tab, and the rhythm underneath them — 2026-08-13

Owner: *"execute compass on home … think through what belongs on the
homepage. Generally think through the daily/weekly/monthly user flow —
maybe run the tester profiles through the app."*

## 1. There are no personas, and that is the useful finding

`tester_profiles` stores chronotype, caution planets, location and a chart —
data, not archetypes. So "run the profiles through" cannot mean four invented
people. What it can mean, and what actually decides what Home owes someone,
is the **state** they are in. Two axes, both already modelled:

**What they have given** (DESIGN.md §6, the personalization gradient):
nothing → location → birth date → full chart. Home must be worth opening at
every step, and must never imply the lower steps are broken.

**What they are holding** (the inventory, which today's audit connected):
nothing → a few loose things → a full woven week. This axis changes Home far
more than the astrological one, and until today it was the axis Home read
worst — it said "nothing on your list" to someone whose list was fully
scheduled.

The cross-product is what Home has to answer, and every cell has a different
right answer:

| Holding ↓ / Given → | Just landed | Location | Full chart |
|---|---|---|---|
| **Nothing** | Three doors. No astrology performance. | Same, plus the hour is real | Same — a chart with nothing to time is still nothing to time |
| **A few things** | *What to do now*, from the list | + real hours | + "your chart agrees" |
| **A woven week** | *What to do now* + the day's spine | + the day's spine is accurate | + personal reinforcement |

The rule that falls out: **Home leads with the loop whenever there is
anything to loop over, and with the doors when there is not.** Everything
else is context underneath.

## 2. The rhythm — daily, weekly, monthly

Compass already has three natural cadences, and each has a home:

- **Daily** — the loop (*now → then*), the day's spine, habits due. Belongs
  on Home, above everything.
- **Weekly** — the woven plan and how the week sits. Belongs in **Plan**.
  Home shows only the one-line "this week" answer.
- **Monthly** — the turning-point check-in and its kept card. Belongs on
  Home, but as a *banner*, because it is rare: roughly twelve appearances a
  year against ~365 for the loop.

The failure mode to avoid is putting all three at equal weight, which is how
Today became "super busy and a little overwhelming" and got demoted from the
landing slot in the first place (App.tsx, 2026-08-04).

## 3. Compass on Home — what "executing" means

The loop already exists (`linesUp.loop`, shipped earlier today) and is
rendered *inside* the "What lines up" card, below its badges. That is the
right content in the wrong position: it sits under a section title, a badge
row, and a display-serif item title, so the first thing the eye lands on is
still a card header rather than the answer.

**The change:** the loop is lifted out to be the first thing on Home, in its
own right, above the reading it came from. The card beneath keeps the
evidence, the badges, the alternatives and the horizon — everything that
answers "why", "what else", and "when next" — but stops being the thing you
read first.

Order becomes:

```
1. Compass          the loop — now → then, or the doors when nothing is held
2. Right now        VOC / conditions, only when one is gating
3. Turning point    the check-in, ~12 days a year
4. A rare one       ~14 days a year
5. What lines up    the reading, evidence, alternatives  ← was #1
6. Your work        capture + inventory
7. Your day         the spine (windows + habits)
8. This week        one line
9. Guiding Stars / Today's log
```

Note 2–4 stay *below* the answer rather than above it: a condition qualifies
an answer, and reading the qualification before the thing it qualifies is
backwards.

## 4. The Plan tab

Owner: *"after I have input a list, it should not show in the place where I
input things — I should have the option to add more. And see what I've
already woven in."*

Three fixes, all in the intake:

1. **The dump box collapses once its list is parsed.** It currently stays
   full of the text you already submitted, so the page reads as though
   nothing happened and re-reading it would duplicate the lot.
2. **"Add more" reopens it, empty**, and appends rather than replacing —
   which is what a second thought actually is.
3. **What is already woven is shown**, so the tab answers "what did I
   commit?" without a trip to Calendar. This is the same gap the audit found
   on Home: the app knew, and the surface did not say.

Almanac-type calendar functions in Plan are noted as wanted but deliberately
NOT specified here — Plan's job is the week's work, and the Almanac's is
reference. Merging them needs its own pass or Plan becomes the next Today.
