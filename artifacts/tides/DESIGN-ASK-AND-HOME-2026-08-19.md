# Design — the Ask, and Home's top of page · 2026-08-19

For the final pre-beta sprint. Six changes, thought through against the build
at `fbf8547`. Where something is already broken rather than merely absent, it
says so with a ref.

---

## 1 · The Ask — the chief function, redesigned

### What's wrong now

The Ask panel opens with **eleven-plus tappable prompts at once**: one row per
active Guiding Star, four "Right now" rows, four timing chips, and a free-text
field. Every one is well written and the set as a whole is unreadable. A menu
that long is not a menu; it is a wall that asks you to read it before you may
speak.

### The structure that's already there

The three groups it already renders — *Your guiding stars* / *Right now* /
*Ask about timing* — are not arbitrary. They are **three relationships to
time**, and they mirror the product's own ladder:

| Door | Horizon | The app's surface | The question |
|---|---|---|---|
| **Orient** ✦ | the long | Stars | "am I still pointed somewhere?" |
| **This moment** ◉ | now | Today | "what's actually in front of me?" |
| **Timing** ◷ | ahead | Plan | "when should this happen?" |

So the redesign is not an invention. It is the grouping the panel already has,
with the groups **closed by default**.

### The design

**Resting state — three doors, nothing else.** Three icons in a row, each with
a short label and a one-line sub. No prompts visible. This is what "Ask" looks
like everywhere it appears.

**Opening one expands it in place** into 3–4 specific prompts, and the free
text field re-scopes to that door ("Ask about this moment…"). The other two
collapse to their icons. **Maximum four choices on screen at any time**, down
from eleven.

**What lives behind each door:**

- **Orient ✦** — one row per active Guiding Star ("Make progress on *Get
  fit*"). With no stars, the single row is "Help me name one" — which makes
  this the cold-start door too, at no extra cost.
- **This moment ◉** — "Why this suggestion?" (the receipt), "What can't
  Compass see?", "Is this a moment to rest?"
- **Timing ◷** — "Is now a good time to…", "When should I…", "Compare two
  options…"

**Why three and not four or six:** three is the largest number a person reads
as a *shape* rather than a list, the groups already exist, and each maps to a
tab they can go to next. A fourth door would have to be invented, and every
candidate ("about the sky", "about my chart") is a topic rather than a
horizon — which is how the eleven-row wall got built the first time.

### Where it lives

**Two placements, one component.**

1. **Top bar** — the existing `✦ Ask` button opens the three doors as a
   popover rather than the full-page panel. Reachable from every surface,
   which it already is; it just stops being a wall.
2. **Home, in the "What lines up" slot** — the doors render inline, always
   visible, no modal needed to begin. This is the owner's call and it is the
   right one: the slot's current occupant is a *receipt* for an answer given
   three hundred pixels above it, and a receipt does not deserve the second
   most valuable card on the page.

**What happens to the receipt.** It moves behind *This moment → "Why this
suggestion?"*, which is precisely the question it answers. Nothing is lost;
the evidence table, the badges and the alternatives all live one tap inside
the door whose name is the question they answer.

### The guard that must not slip

**Ask never answers "what should I do."** The loop does, deterministically,
and two answers to one question is the failure this codebase has fixed three
times. Every prompt behind *This moment* is framed as thinking ABOUT the
existing pick — why it, what's missing from it, is rest the better call.
*Orient* is the one door that may propose, and it is safe: a Guiding Star is
not a now-question, so there is no rival answer to collide with.

---

## 2 · Home's top banner — progress, not the last turning point

Today the top of Home is the kept turning-point card: whatever you wrote at
the last new moon. That is a *souvenir*, and it holds the most valuable strip
on the page for up to a month after it stops being news.

**Replace it with "Where you are"** — a single report on the two things that
actually accrue:

- **habits**: today's tally with the check-off dots (the tap survives — a
  check is a tally mark, not a workflow), plus the week's count
- **stars**: one line each, what moved this week

**This absorbs two existing cards** rather than adding a third voice: the
`RhythmProgress` card and the Guiding Stars card in the context column both
fold into it. Home's module count goes DOWN by one while gaining the report.
One voice per fact, which is the rule those two were already straining.

**The cycle line goes underneath, small** — one line, not a card: *"New moon
in Leo · you named: finish the album"* with a door into the full one-pager.
It stops being the page's headline and becomes what it is: context.

---

## 3 · Your Day — bring in the calendar

`DayAhead` renders scheduled windows and today's tasks and stops. The person's
actual meetings are absent from the one card whose whole promise is "what is
on today, in order, with now marked."

The plumbing exists: `/api/integrations/google-cal/events` (the Planner uses
it) and `fetchGcalBusy` server-side. Merge gcal events into the same
chronological list, visually distinct (they are commitments, not choices), and
keep the honest failure: a calendar that could not be read says so rather than
rendering an empty day as a free one.

---

## 4 · Sprint suggestions — two real defects

The owner's instinct ("make sure it's not just the same habits, and that
they're appropriate") is correct on both counts, and both are mechanical.

**Defect A — the theme ignores the aspect.** `themeFor()` concatenates two
lookups: `PUSH[transiting] + DOMAIN[target]`. Nothing reads the aspect, so
**Venus trine Saturn and Venus square Saturn produce identical copy** — "a
connection or beauty push, with structure in the air". For the opposition the
owner just saw, that reading is not merely bland, it is arguably wrong: an
opposition to Saturn is a test of what you have built, not a beauty push.

The fix is a third dimension. The aspect sets the **mode**, the pair sets the
**domain**:

| Aspect | Mode | A sprint in that mode |
|---|---|---|
| conjunction | begin | start the thing while the fuse is lit |
| sextile | offer | a light, low-friction run at it |
| square | friction | the effortful version — the one that needs teeth |
| trine | ease | the pleasant, repeatable version |
| opposition | face | the one that needs the other person, or a reckoning |

**Defect B — the same habit, every time.** `/transits/spans` builds
`habitsByPlanet` with `if (!habitsByPlanet.has(p))` — first match wins,
permanently. The same habit is proposed for the same planet forever, which is
exactly what the owner noticed. Three rules fix it:

1. **Prefer a habit that is BEHIND its cadence.** A sprint is a push for
   something slipping, not a victory lap for something already thriving.
2. **Exclude anything sprinted in the last 30 days.** Novelty is the whole
   point of the cadence.
3. **Rotate** among the remaining candidates rather than taking the first.

**The mapping itself goes to Astrolyrica.** §5 below is the paste-ready brief.

---

## 5 · Cropping Up — the non-lunar aspects

Keep the card (it answers Home's second question, "what's coming?"), and add
what it has always been missing: **planet-to-planet aspects that are not the
Moon's.** The engine already exists — `transitSpans` computes exactly these
windows for sprints, so the horizon card and the sprint suggester read one
source rather than two that can disagree.

Rules that keep it panoramic: name the window and stop (no interpretation —
the almanac holds that), exclude the Moon entirely (hours-scale), and keep the
four-row cap so a busy fortnight cannot push the eclipse off the card.

---

## 6 · What this does to Home's shape

Before: 16 possible modules. After:

1. **Where you are** — habits + stars (absorbs two cards)
2. the cycle line — small
3. **CompassNow** — the loop, the answer
4. **Ask** — three doors (replaces the receipt card)
5. Your work · Your day (+ calendar) · This week · Sprints
6. Cropping up (+ aspects) · the water reveal

Net: two fewer modules, and the two most valuable strips on the page now hold
a progress report and the app's chief function, rather than a souvenir and a
receipt.
