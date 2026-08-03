# Dashboard, redrawn — draft for review

*Owner: "the left hand panel is much more straightforward in its sequence.
this dashboard is incredibly busy and we need to simplify it."*

---

## Why the rail works and the dashboard doesn't

The rail has a **spine**: season → moon → this hour. Slow to fast, big to
small. You always know where you are in it, and a new block has an obvious
place to go.

The dashboard has no spine. It has ~20 blocks in roughly the order they were
built, and at least **six separate mentions of "an influence"** spread across
four of them:

| Where | What it says |
|---|---|
| Hero flavour | "a fire day — carried by the Jupiter hour" |
| Hero WATCH | a testimony line |
| Hero counterpoint | "— though Venus grinds against your drive" |
| Hero pattern chips | up to three named configurations |
| Teachable moment | "Today has a neptunian undertone" |
| Standing conditions | "Today's edge · the era · Saturn ℞ in Aries…" |

Each is defensible alone. Together the reader cannot tell which is the
headline, which is a footnote, or which two are the same fact in different
clothes. (Two of them literally were — fixed yesterday, twice.)

---

## The organising idea: influences have DURATION

The rail's insight, applied properly. Every influence the app knows has a
timescale, and that is what should sort them:

```
this hour        ~1 hour        planetary hour
today            hours          Moon's aspects as they perfect
this stretch     days–weeks     NON-LUNAR aspects now partile or applying
these days       ~2½ days       Moon by sign
this month       ~29 days       lunation phase
this season      ~1 month       Sun by sign
this era         months–years   outer-planet stations & ingresses
```

**Non-lunar aspects belong in this stack** (owner). They are the layer the app
currently computes and then almost discards — `standing` carries weight 0.05
in the height formula while climbing to 1.00 exactly as the tide bars shrink
to nothing. They are also the answer to "why does this week feel like
something when the Moon says it's empty."

### Two rules for how rows are written

**1. Convergence gets emphasis.** When several testimonies point the same way,
say so — that is the app at its most useful and it is rare. A row backed by
three agreeing voices should read differently from one backed by one. This is
the honest version of "confidence": not a percentage, but *how many independent
things agree*.

**2. A named dynamic must be explicated.** Naming the planet is not enough —
"Saturn hour" says almost nothing on its own. The row should carry the
specific configuration doing the work: **planet in sign**, or **the aspect and
its state** (applying/separating, orb, when exact).

> Saturn hour · Saturn ℞ in Aries — structure under revision, not construction
> Moon □ Saturn · applying, exact 4:16pm — weight arriving, not yet landed

Same length, vastly more information, and it is checkable against the rail.

**One stack, sorted by duration, with the dominant one promoted to the top and
named.** Not six blocks in six voices — one instrument with a scale, exactly
like the rail.

This also delivers the multiplicity reframe without a scoreboard: what leads
the stack is *which quality is front and centre right now*, and it changes
through the day as the fast layers move.

---

## The four zones

Nothing may outrank these, and they always appear in this order.

### 1 — READ · what kind of moment is this
The dominant quality, named, with the approach it favours. Supporting: the
influence stack above, collapsed to its top two rows by default.

*Replaces:* hero headline, flavour, WATCH, counterpoint, pattern chips,
teachable moment, standing conditions — all of which become rows in the stack.

### 2 — MOVE · what should I do with it
"Strongest fit right now", unchanged — it is the best thing on the page.
Gains an **"or…"** for the ordinary case where nothing converges: two or three
different approaches rather than a manufactured winner.

### 3 — PLACED · what I've already committed to
On Deck (scheduled windows) + today's open tasks. One card, not two lists in
different places.

*Replaces:* On Deck card, Waves, Moments ahead.

### 4 — AHEAD · what's coming and what's changing
Moments ahead (with lunar aspects included — currently missing), the week
strip, and "what changed since your last check".

Everything else — BigSky, the tide chart, the element lenses, habits, the
full instrument panel — lives **below the fold** behind the density toggle, or
moves to the rail where sequence already exists.

---

## What happens to each current block

| Block | Fate |
|---|---|
| Angle-crossing banner | → row in the influence stack (it's an hour-scale influence) |
| Ritual card | Keep, above zone 1, ritual hours only |
| Review card | Keep, already self-gating |
| Notification / premium banners | Keep suppressed; move to Settings entirely |
| First-star hint | → zone 2's empty state, where it's already better handled |
| **Hero** | Becomes zone 1. Loses: the fake cycle graph, the duplicate lines, the energy/trend/agreement chip row (→ receipt) |
| **Strongest fit** | Becomes zone 2, gains "or…" |
| Teachable moment | → row in the stack |
| Guiding stars card | → zone 2 (it's direction, not status) |
| On deck | → zone 3 |
| Waves + Moments ahead | → zone 3 and 4 respectively |
| Standing conditions | → the stack's slowest rows |
| VOC / cycle / rhythm-risk banners | → stack rows, with VOC also gating the language |
| BigSky, tide chart, habits, pulse | Below the fold, unchanged |

Net: **~20 blocks → 4 zones + 3 conditional cards.**

---

## The receipt

Everything cut from the surface goes somewhere, not away. One **"why this?"**
per zone opens the evidence: the testimonies, orbs, applying/separating, the
weights, and which rule outranked which. That is also where energy %,
signal agreement, and the working table belong — they are inspection, not
headline.

This is the audit's Layer 1 / Layer 2 / Layer 3 split, made real: navigation on
the surface, receipt one tap in, instrumentation in the rail and below the fold.

---

## Two decisions I need from you

**1. What leads zone 1?** Three candidates:

- **(a) The dominant influence, named** — "Moon–Saturn under tension · weight
  and friction" — most honest, most multiplicity-native, but loses the tide
  vocabulary you built the brand on.
- **(b) The tide, with the dominant influence as its subtitle** — keeps "Surge
  Tide" as the headline and names what's actually driving it underneath.
  Safest.
- **(c) The approach** — "Today favours the unglamorous task" — most
  immediately useful, least astrological.

I lean **(b)**: it keeps legibility and the brand, and the subtitle is where
the multiplicity actually lives.

**2. Does the tide scalar survive at all?** The reframe implies the day's
"height" stops being a headline number. If it survives as *one row of the
stack* rather than the hero's identity, that resolves the week-bars problem
too — a waning week reads "consolidating" rather than "empty". But it is a
real change to what Compass is, and it is your call, not mine.

---

## What this does NOT solve

- **The astro-detail levels.** You chose medium and wanted more. That's a
  separate control problem — the audit argued density and explanation-depth
  should be two dials, not one, and your experience supports that.
- **Load time.** Structural; needs an aggregate endpoint or deferred queries.
- **The weight rebalance.** Phase at 0.50 vs standing at 0.05 still wants your
  judgment as practitioner before any visual depends on it.
