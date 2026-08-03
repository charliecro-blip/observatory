# Dashboard specification — v2, post-critique

*Supersedes DASHBOARD-DRAFT-2026-08-03.md. Merges the external critique, which
was accepted on all eight refinements. Two of them caught errors that would
have shipped.*

---

## The sentence

> Compass summarises the moment as a tide, explains it through a
> duration-ordered stack, turns it into one default move, and keeps the
> complete astrology one tap deeper.

---

## The two corrections that mattered most

**1. Duration orders the stack; it does not decide what leads.** The draft
conflated position with promotion. A long influence can be important but not
actionable; a short one exact but trivial. Two systems:

- **Position** — duration (stable, legible, mirrors the rail)
- **Eligibility to lead** — decision relevance (an editorial rule hierarchy)

**2. The system must be allowed to promote nothing.** "Dominant-row promotion"
as drafted would have quietly violated the standing commitment never to
manufacture significance on a quiet day. Three legitimate states:

| State | Surface |
|---|---|
| One influence leads | *Led by Moon applying square Saturn* |
| Genuine crosscurrents | *Mixed current — Mars supports action; Saturn asks restraint* |
| Nothing dominates | *Quiet sky — no single influence changes the basic recommendation* |

Ranking one row is judgment, which was never forbidden. Multiple simultaneous
*scores* were. Judging that nothing deserves promotion is the same faculty.

There is precedent to build on rather than invent: `isQuiet` and
`QUIET_DAY_GUIDANCE` already exist in the hero.

---

## Zone 1 — READ

Three levels, each doing different work:

```
Building Tide                                    ← orientation + brand
Patient, concrete progress; reduce scope.        ← practical meaning
Led by: Moon applying square Saturn · 4:16 PM    ← checkable provenance

No meaningful change since your last check.
▸ Why this?   ▸ Show slower layers
```

The tide stays the headline. It is useful *because* it can synthesise
multiplicity without claiming one aspect is the whole moment. Letting the
dominant configuration become the headline would ask the user to interpret
astrology before Compass has done its product job — and would let whatever
currently ranks highest rename the whole dashboard.

### Retrospective change belongs here, not in AHEAD

Two different questions, deliberately separated:

- **What changed since I looked?** → READ. Builds stability. *"No meaningful
  change since your last check"* may become one of the most important
  sentences in an app used several times a day.
- **What changes next?** → AHEAD. Supports planning.

### The stack is selective; the rail is complete

> The rail answers *what is there*. READ answers *what matters right now*.

Seven duration bands are the **internal model**. The surface shows four,
default-collapsed to the lead plus two relevant rows:

| Band | Contents |
|---|---|
| Now | planetary hour, angle crossing, immediately perfecting lunar aspect |
| Today | the Moon's principal movement and the day's usable character |
| This stretch | partile/applying non-lunar aspects, stations, ingresses |
| Background | phase, season, era — **only when they materially inform the reading** |

Rendering all seven would make the dashboard a vertical rail.

---

## Zone 2 — MOVE

```
Strongest fit right now
Revise the proposal.
The Saturn emphasis favours improvement over expansion.
This also advances "Launch the consulting offer".

[ Start ]  [ Keep going ]  [ Another fit ]  [ Why this? ]
```

**Alternatives are collapsed and conditional, never coequal.** Three unordered
recommendations would rebuild the indecision Strongest Fit exists to remove.
Opening "another fit" gives:

> If your focus is intact — revise the proposal.
> If your energy is low — organise the supporting notes.
> If you need movement — take the walk and dictate.

This is better than a list because it makes the choice depend on what Compass
*cannot know*, which is also the honest thing to admit.

Guiding Stars appear here as the direction attached to the recommendation —
not as a separate status card.

---

## Zone 3 — YOUR DAY

"PLACED" was wrong: an unscheduled task is definitionally not placed.

```
Now        10:00–11:30 · Revise proposal
Next       1:00 PM · Client call
Still loose  Send invoice · Outline newsletter · Buy groceries
```

An operating console, not a merged list.

---

## Zone 4 — AHEAD

Next material shift, later today, this week. Prospective only.

---

## Modes, not extra cards

Ritual and review **change the mode of the four zones** rather than inserting
blocks above them. Cleaner than "4 zones + 3 conditional cards":

| Mode | READ | MOVE | YOUR DAY | AHEAD |
|---|---|---|---|---|
| Morning | Morning conditions | Choose the first move | Already committed | Shape of the day |
| Ordinary | (as above) | (as above) | (as above) | (as above) |
| Evening | How the day moved | Finish, release, or carry | Done & unfinished | Tomorrow's first shift |
| Review | — | — | — | *REVIEW · what the week left behind* |

**Four zones, three temporal modes.**

---

## Convergence: count source families, not renderings

The draft's "how many independent things agree" would have reintroduced the
duplication bug in a more flattering form. These are **one** voice, not three:

- Saturn hour
- Moon square Saturn
- a "Saturn pressure" pattern generated from that same square

Count **families**. The engine's existing `source` values map cleanly:

| Family | Existing sources |
|---|---|
| Planetary hour | `hour`, `dayRuler` |
| Lunar aspect | `moonAspect:*` |
| Lunar sign/phase | `moonSign`, `phase` |
| Chart condition | `sect`, `sectMalefic` |
| Personal | `transit:*` |
| Non-lunar aspect | **does not exist — see below** |

Named patterns enter `watch` with `source: p.name`, so they must be attributed
back to the family they derive from or they will double-count.

Surface copy names the sources rather than a count:

> **Stacked support** — the current hour, today's Moon, and your personal
> timing all favour concentrated revision.

The receipt shows exactly which three.

---

## The week chart: separate the phenomena, don't reweight

The strongest point in the critique, and it changes the plan.

The scalar failure is **not** a bad-weight problem — it is an ontology
problem. Lunar fullness and aspect activity are not alternate measurements of
the same substance, so no weighting reconciles them. Picking phase 0.30 /
standing 0.25 would relocate the edge cases, not remove them.

Three distinct encodings instead of one number:

1. **Lunar tide** — curve or categorical background: waxing, full, waning, renewal
2. **Significant weather** — markers for exact non-lunar aspects, stations,
   ingresses, clusters of applying testimony
3. **Daily approach** — one categorical label: initiate · build · refine ·
   consolidate · release · recover

A waning week with heavy aspects then reads:

> Consolidating lunar tide · high structural pressure Tue–Thu

which is truthful, where arguing whether the bar should be 0.28 or 0.64 is not.

**Consequence: the planned weight rebalance is cancelled.** It was the wrong
fix for the right observation.

### What survives of the tide scalar

Keep: tide **character** (Building, Surge, Clear, Deep), tide **motion**
(rising, cresting, holding, ebbing), and coherence language.
Demote or remove: public numeric height, "Energy 73%", the single master bar,
and week bars derived from it. The scalar may remain an internal input with a
narrow documented meaning — not the master variable.

---

## Row copy: explicate, but don't overclaim

Explication is right — "Saturn hour" alone is too generic. But contextual
detail must not sound causally decisive.

Prefer:
> Saturn hour, with Saturn retrograde in Aries
> Better for revising structure than locking it permanently.

Over:
> Saturn hour · Saturn ℞ in Aries — structure under revision, not construction

The first separates calculated condition / Compass interpretation / practical
implication; the second fuses them into one assertion. Same discipline already
enforced on election rules and the star-diagnosis copy.

Surface prioritises practical consequence; the receipt keeps technical
exactness. *"Pressure is still building; simplify before adding"* beats
*"weight arriving, not yet landed"* — evocative is not operational.

---

## Implementation order — revised by two findings

**A. The non-lunar-aspect testimony family does not exist.** The engine emits
no testimony for non-lunar aspects at all; `standing` is computed straight into
the height formula at weight 0.05 and nowhere else. So "include non-lunar
aspects in the stack" is not a rendering change — the synthesis engine must
start producing that testimony first. **This blocks the stack and should be
built before it.**

**B. "Keep going" needs state the app does not have.** The engine is stateless
and recomputes on every render, so it cannot know you started something. Flow
protection — arguably the highest-value item in the critique for a
several-times-daily app — requires a started-at record on a task or window.
Small schema addition, real value, and the only item here with a migration
cost (see BACKLOG §9a on mid-beta migrations).

**Order:**

1. Non-lunar aspect testimony in the synthesis engine *(unblocks the stack)*
2. Lead-eligibility as a deterministic tested module — same pattern as
   `lib/next-move.ts`, with **no-winner as a first-class return**, not an
   afterthought
3. Zone 1 READ with the four-band selective stack
4. Zone 3 YOUR DAY rename + Now/Next/Still loose
5. Zone 2 conditional alternatives; Zone 4 prospective-only
6. Modes replacing conditional cards
7. Week chart re-encoding
8. `started_at` + "Keep going"

**Constraint throughout:** the stack must assemble from `/api/tides/now`,
which already returns everything needed. Adding endpoints would worsen a
measured problem — 27 API requests per cold load at ~0.5s TTFB each.
