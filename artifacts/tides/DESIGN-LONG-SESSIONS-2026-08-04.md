# Scheduling a long session, and the day/week suggester

Owner's questions, 2026-08-04: *"how would someone schedule a 3-4 hour deep work
session? how might our engine select for that? similar planetary hours? moon
aspects to an appropriate planet? moon sign? all of the above? could also
suggest different approaches for each planetary hour of the deep work session.
beyond that — a function that could just suggest a full but holistic day's
activities, or even a week."*

---

## 1. One option is astronomically impossible, and that is useful

**"Similar planetary hours" cannot happen.** Planetary hours run in Chaldean
order — Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon — and repeat with a
period of exactly 7. The same ruler recurs every 7th hour and never sooner.
Checked across all 168 possible starting positions: **zero** 3-or-4-hour blocks
contain a repeated ruler. A 4-hour block always spans 4 *different* rulers.

So the engine cannot select for hour homogeneity, and should stop implying it
could. What it can do is the owner's *other* idea, which the constraint turns
from a nice-to-have into the correct design: **narrate the arc.** A block that
runs Sun → Venus → Mercury → Moon has a shape, and naming it is more useful than
a single verdict over four hours.

## 2. The real mistake would be scoring a span like a moment

The engine currently scores **moments**. A 3-4 hour block is a **span**, and
neither obvious reduction works:

- **Average** hides discontinuities. A block containing a Moon–Mars square
  averaged with two calm hours scores "fine", and the person hits a wall at
  2:40 with no warning.
- **Peak** oversells. One excellent hour does not make four good ones.

**Long-session selection is a segmentation problem before it is a scoring
problem.** Certain events do not lower a block's quality — they *end* it,
because after them the block is no longer the same block:

| Boundary | Why it cuts rather than scores |
|---|---|
| Moon goes void mid-block | The second half will not deliver what the first half promised |
| Moon changes sign mid-block | The texture of the whole span changes underneath you |
| An applying aspect perfects mid-block | Polarity can flip; before and after are different conditions |
| Waking-hours edge | Already handled, and the same kind of fact |

Cut candidate blocks at these, *then* score the intact segments. This also gives
an honest answer to "why is the longest block only 2h10m today?" — because the
Moon goes void at 3:15, and pretending otherwise would be the lie.

## 3. The four inputs work at four different scales

The owner asked "all of the above?" — they are all relevant, but treating them
as four scoring terms to sum would be wrong. They operate at different scales
and should enter the algorithm in different roles:

| Input | Scale | Role |
|---|---|---|
| **Moon sign** | ~2.5 days | **Filter.** Constant across any 4h block, so it cannot discriminate *within* a day — it qualifies whether the day suits the activity at all |
| **Void / ingress / perfection** | instantaneous | **Boundary.** Segments the day into candidate containers (§2) |
| **Moon aspect to the significator** | ~hours | **Anchor.** It has a *time*, so it should position the block, not merely score it — "start at 1:15 so the Mercury trine lands mid-session" |
| **Planetary hours** | ~1 hour | **Internal structure.** Names the arc (§1); one hour of the activity's significator inside the block is a requirement, not a bonus |

The anchor role is the one most easily missed. An aspect is not a static quality
of an afternoon; it is an event with a clock time, and a long block should be
*placed around* it.

## 4. Proposed shape

```
longSession(activityKey, hours, day) →
  1. filter   — does the Moon's sign qualify the day for this activity at all?
                (no → say so, and offer the next day that does)
  2. segment  — cut the waking day at every boundary in §2
  3. keep     — segments >= requested length
  4. anchor   — if the Moon perfects an aspect to the significator, slide the
                block so that moment sits inside it, not at an edge
  5. require  — the block must contain >= 1 hour of the significator
  6. narrate  — per-hour arc from the Chaldean sequence it actually spans
```

Step 6 output, for a 4h writing session running Sun → Venus → Mercury → Moon:

> **1:15–5:15pm, four hours, unbroken.**
> Sun hour — open it. Get the shape on the page while you can still see it whole.
> Venus hour — the easy pass. Read it back, make it pleasant to read.
> Mercury hour — the detail work. Mercury rules this one, and it's the hour the
> session is built around.
> Moon hour — stop cleanly. Note where to pick up.

That is real, deterministic, and derived from facts the engine already has.

### What this needs that does not exist yet

- `motion.ts` and `electionEngine.ts` have the events; nothing currently emits
  them as an ordered **boundary list** for a day.
- `PRIMARY_SIGNIFICATORS` (in `activityCorrespondences.ts`) covers 11 inceptions
  — the significator requirement needs it extended, or an explicit fallback.
- The per-hour arc needs a verb per (planet × position-in-session). `railVerbs`
  and `lib/alternatives.ts` are close but are written for a standalone hour,
  not for "hour 3 of 4".

---

## 5. The day/week suggester — where the real risk is

A function that fills a day is **one design decision away from becoming a
horoscope generator**, which is the thing this product exists not to be.

The failure mode is specific: given a day with open slots, a naive suggester
fills them, because filling is what it was built to do. The result reads as
authority and is actually just slot-stuffing.

**The discipline that avoids it: only ever place what the person actually
holds.** Tasks, Guiding Stars, habits, practices. If there is a good Venus
window at 4pm and nothing in their life wants a Venus window, the honest output
is an empty 4pm, not "connect with a loved one."

Two rules follow:

1. **Gaps are output.** A day laid out with three placed items and a lot of
   white space is a *correct* answer, and it must not look like a failure state.
2. **Say what was left out and why.** "Two of your open tasks had no good window
   today" is information. Silently dropping them is the same defect as a
   product-ranking limit standing in for a scientific conclusion.

For the **week**, one thing changes: at week scale the scarce resource is not
good windows, it is *the user's attention across seven days*. A week suggester
that puts something in every day has failed differently — it should be willing
to say "Thursday is the day for this; the rest of the week, protect it."

Recommend building **day first, and only after the long-session engine in §4
exists** — a day suggester without it will place 30-minute stubs where a
3-hour block was the point.

---

## 6. Home design — what is a bug and what is a question

Fixed already (they were defects, not design): the Compass clipped by
`overflow: hidden`, doubled title/subtitle, a box inside a box, full-width rows
with a stranded checkbox, and Home ignoring a void Moon while the rail showed it.

**The open question, worth a second opinion:** Home currently orders itself
Compass → dump → Stars → log, and that order is an argument — you decide, then
you see what you hold. The alternative argument is dump → Compass: you see what
you hold, *then* you ask when to do it. The first treats Compass as the reason
to open the app; the second treats it as a tool you reach for once you know what
you need.

Both are defensible and the choice is not derivable from the code. That is the
one genuinely worth handing to GPT — with the constraint that **customisability
is deferred**, so it has to be a single fixed order, not "let the user choose."
