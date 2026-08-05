# Scheduling a long session, and the day/week suggester

**Rev 2, after GPT's critique.** Rev 1's central idea survives — *a long session
is not a large moment; it is an interval with an internal arc, and it should be
a reusable primitive built before the day or week suggester.* Four of its rules
were too hard and three claims were wrong. Corrections first, since two of them
were errors of a kind worth naming.

---

## Corrections to rev 1

### C1. "Similar planetary hours are astronomically impossible" — wrong

I proved the wrong proposition. My test enumerated 168 positions in the Chaldean
cycle and found no run of 3–4 *consecutive planetary hours* repeating a ruler.
That is true and uninteresting: the cycle has period 7, so of course it is.

The question was about a 3–4 **civil**-hour session. Planetary hours are
*temporal* — daylight divided into twelve, night into twelve — so their civil
length changes with latitude and season, and the two units do not correspond.

Computed: for a 4-hour block to span 8 planetary hours (enough to wrap the
7-cycle and repeat a ruler), each hour must be ≤ 30 min, i.e. daylight ≤ 6h.

| Latitude (winter solstice) | Daylight | Day-hour | Repeats? |
|---|---|---|---|
| 40°N | 9.2h | 46 min | no |
| 50°N | 7.9h | 39 min | no |
| 55°N | 6.9h | 34 min | no |
| **60°N** | **5.5h** | **28 min** | **yes** |
| 63°N | 4.2h | 21 min | yes |

60°N is Oslo, Stockholm, Helsinki, Anchorage. Not exotic.

**Revised finding:** at ordinary mid-latitudes a 3–4 hour session will usually
span several different rulers, so the engine should assume an *arc* rather than
seek homogeneity — but it must **compute the actual local sequence**, never
infer hour count from duration.

**And it needs a high-latitude policy.** Planetary hours derive from sunrise and
sunset; on polar-day and polar-night dates there is no sunrise to divide from.
That needs an explicit `unavailable` state, not an accidental result. This is
the same class as the existing rule that hours are withheld when location is
only a guess.

*The generalisation step is what failed — a combinatorial fact about one unit
asserted as a fact about a different unit. The measurement was fine; the
inference from it was not.*

### C2. "Perfection can flip polarity" — wrong

A square stays a square; a trine stays a trine. What changes at exactitude is
**applying → separating**: anticipation becomes aftermath, intensity crests and
recedes. That is a real internal arc and it is not a change of sign.

### C3. Cutting at every lunar event imports inception logic into execution

Rev 1 said a void starting mid-block means "the second half will not deliver
what the first half promised." That is an *inceptional* judgment, and
`MODE_BY_KEY` in `activityCorrespondences.ts` already classifies
`"deep-work": "execution"`. The app's own settled position is that a void is
thin for *starting* something you want to last and fine for finishing and
refining. Rev 1 contradicted a module written three days ago.

---

## 1. Containers are practical; astrology is texture inside them

The segmentation insight was right in shape and wrong in scope. Two categories:

**Hard boundaries** — genuinely end a block:
calendar commitments · waking-availability edges · a user-required break ·
end of the scheduling horizon · location/timezone uncertainty affecting local
timing.

**Typed transitions** — change the *description*, not the container:

| Event | Default role |
|---|---|
| Moon ingress | internal texture change |
| Void begins | suitability qualification, **scaled by activity mode** |
| Aspect perfects | anchor or crest |
| Planetary hour changes | internal chapter |

Activity policy may occasionally *upgrade* a transition to a hard cut — four
hours culminating in a public release deserves stricter treatment than four
hours of editing. That is an exception with a stated reason, not the default.

## 2. The four inputs, corrected

| Input | Scale | Role — **revised** |
|---|---|---|
| Moon sign | ~2.5 days | **Background prior** (`aligned` / `neutral` / `contrary`), not a veto. A hard filter could make a long session unavailable for days while the person has the time today, a strong contact, and a deadline tomorrow. State the tradeoff instead. |
| Void / ingress / perfection | instantaneous | **Typed transitions** (§1), not automatic cuts |
| Moon aspect to a relevant planet | ~hours | **Anchor** — keep this, it was rev 1's best idea. But placement is activity-specific, not "never at an edge" |
| Planetary hours | temporal | **Preferred, not required**; internal structure |

**Anchor placement** becomes a policy, not a rule:

```ts
type AnchorPlacement = "opening" | "middle" | "culminating" | "any";
```

Hard training may want the Mars contact cresting mid-effort; a finishing pass
may want it in the final third; a difficult conversation should probably not
have exactitude land in its last five minutes.

**Use `hourRulers`, not `PRIMARY_SIGNIFICATORS`.** `hourRulers` already exists on
every activity ("planetary hours that make a GOOD time — classical 7 only").
`PRIMARY_SIGNIFICATORS` is deliberately scoped to the 11 *inceptions* and carries
a precise meaning: the formal planet signifying an inceptional matter. Extending
it to deep work, cooking and rest would collapse the distinction that narrows
the retrograde cap. Containing a preferred hour **raises rank**; containing none
stays eligible and is described honestly.

## 3. Assess as a vector; rank lexicographically

Rev 1 rejected average and peak. Do not replace them with a third blended score.

```ts
interface SessionAssessment {
  feasibility: "fits" | "conflict";
  durationMinutes: number;
  uninterrupted: boolean;
  backgroundFit: "aligned" | "neutral" | "contrary";
  supportLevel: "ordinary" | "supported" | "convergent";   // existing axis
  suitability: "clear" | "qualified" | "defer";            // existing axis
  anchor?: { eventId: string; exactAt: string; placement: AnchorPlacement };
  preferredHourCoverage: { minutes: number; rulers: string[] };
  transitions: SessionTransition[];
  practicalCosts: string[];
}
```

Rank in order: no practical conflict → requested duration → clear before
qualified before defer → unbroken → anchor → preferred-hour coverage →
background fit → ergonomics.

Lexicographic, so a large sign bonus can never outweigh a calendar collision and
one excellent hour can never erase a disruptive middle. It reuses the
`supportLevel` / `suitability` split the election engine already has.

## 4. Return tradeoffs, not a winner

> **Best uninterrupted** · 12:40–4:40pm — four hours, no calendar or major transition.
> **Best anchored** · 1:15–5:15pm — Moon–Mercury perfects near the midpoint; crosses a sign ingress at 4:50.
> **Earliest workable** · 9:00am–12:00pm — three hours, supported rather than convergent, available now.

Duration, exactitude and availability are genuinely different desiderata and
collapsing them into one opaque answer throws information away.

When no block of the requested length exists, do **not** jump to "try another
day." Offer the longest intact block today, the next full-duration block, a
split session if the user allows splitting — and the activity's minimum viable
form only as a last resort. A four-hour request must never silently become
deep-work's `MINIMUM_VIABLE`, which is *"twenty minutes on the hardest part,
then stop."*

## 5. The arc is a map, not a notification schedule

Rev 1's per-hour narration read as an instruction sequence, which would push
someone to change cognitive mode every time the ruler changes — including at the
moment they finally reach flow. Astrology-driven interruption is a failure.

Render it once, before the session:

> **Arc: Sun → Venus → Mercury → Moon.** Opens broadly, moves through coherence
> and detail, ends more reflectively. Mercury rules the middle hour, so the
> strongest technical work will likely sit there. You don't need to switch tasks
> at each boundary.

Neutral narration must be allowed — *"the Venus hour doesn't materially change
this session; hold course."* Do not manufacture an instruction for every
planet × position because the matrix has an empty cell. Suggest a break only
where one is genuinely indicated: the user asked, a boundary coincides with the
midpoint, a real transition occurs, or the duration makes it ergonomic.

## 6. Day and week

Only ever place what the person actually holds: tasks, commitments, habits with
real cadence, active Guiding Star steps, pinned recurring activities.

**Do not call it "fill my day."** "Full but holistic" contains a dangerous
optimisation target — a scheduler asked for a full day will produce one. *Shape
my day* / *Place what matters*.

Priority is practical, and astrology only selects *among viable placements* — it
never decides how much work someone ought to have:

1. fixed commitments → 2. work already started → 3. hard deadlines →
4. requested long sessions → 5. cadence-bound habits → 6. timing fit →
7. buffers → 8. slack.

Output must carry its own gaps and refusals:

```ts
{ placed: [...], unplaced: [{ item, reason: "no uninterrupted block before the deadline" }],
  openTime: [...], warnings: [...] }
```

> 3:30–6:00pm remains open. Compass didn't find anything you hold that needed placing there.

At **week** scale the scarce resource is attention, not windows: cap demanding
blocks per day, require recovery between demanding days, distribute across
Stars, protect unscheduled time. A good week may hold one major placement and
several mostly open days. Never suggest a Venus activity because Thursday has a
Venus window — suggest Thursday only when something they hold benefits from it.

## 7. Build order

1. Canonical ordered day timeline with **event roles**
2. Long-session candidate generator
3. Assessment + tradeoff ranking
4. Optional arc narration
5. Day weaver, using long sessions as first-class intervals
6. Week weaver with attention and recovery constraints
7. Home integration

The day suggester must **not** be built as a greedy slot filler later taught
about long sessions — that reproduces the Planner's existing architecture
problem (tracked as P0.8: Planner as a separate timing authority).

## 8. Home order — settled

**Compass · Your Work · Today's Shape · Guiding Stars · Log · Tide.**

Compass before the dump, on a reason better than either of the ones I weighed:
**Home is a returning-user dashboard, not an onboarding form.** The person
should not have to restate what they hold before Compass becomes useful. It
should already be reading their tasks, habits, Star steps and commitments — so
its first module is an answer (*what lines up*) rather than an empty picker
(*what would you like to search?*).

This resolves rev 1's two open questions without a special layout:

- **Cold start** — do not reorder the dashboard. Change the *module state*:
  *"Compass needs something to time. Add what you're holding today."* One
  architecture, and the empty state leads into capture.
- **The empty day** — the same mechanism. The module reports honestly rather
  than the page going blank.

The condition on all of this: **Compass must be derived from the user's actual
inventory.** A generic "good Venus window" sitting above someone's tasks would
not have earned first position. Dump-first would open the product as a task
manager with astrology downstream; a *contextual* Compass first states the
distinguishing promise immediately.


---

# Rev 3 — the architecture ruling (2026-08-05)

A design review of the built stack returned a verdict I am recording here
because it governs everything above.

## The rule

> **Astrological judgment happens once per candidate interval. Every higher
> layer receives that judgment as immutable evidence and adds only practical
> constraints.**

The six-module chain is *structurally* right — a timeline, a session finder, a
day planner, a week planner and a Home selector are genuinely different
transformations and should not collapse into one scheduling function. It was
*semantically* wrong at one seam: three modules each interpreted the same sky.

## It was not theoretical

Measured before fixing: for the same activity on the same day, `electionEngine`
and `longSession` returned different suitability on **25 of 125** comparisons
(20%). The engine said `clear`; the session finder said `qualified`. A user
would have seen both — "clear" on Home, "qualified" in the session finder, for
deep work on the same afternoon.

One rule caused all of it. `longSession` let `backgroundFit === "contrary"`
push a suitability reason, and the engine has no such rule: Moon sign is a
background **prior** in this design, deliberately not a veto, because a hard
filter on a placement lasting two and a half days makes an activity
unschedulable for days. Removing it took the disagreement to **0 of 125**.

`tests/oneAuthority.test.ts` now pins the invariant across the engine, the
session finder, the day weaver and the week weaver.

## The target layering

```
  ephemeris + local time
        ↓
  canonical sky timeline          facts only, no activity-relative roles
        ↓
  canonical activity evaluator    support · convergence · suitability · evidence
        ↓                         ← THE ONLY astrological authority
  candidate generators            short windows · long sessions
        ↓
  scheduling orchestrators        day · week
        ↓
  views                           Home · Compass · Plan · Today · Calendar
        ↓
  approval + persistence
```

Information may be added at each step down. **No step may reinterpret an
upstream astrological judgment.**

## Still outstanding

- `dayTimeline` assigns event roles (`anchor`, `qualification`, `chapter`)
  universally, but those are activity-relative: a void beginning is a serious
  qualification for an inception, a useful shift for finishing, and close to
  irrelevant to an established deep-work session. Roles belong in the evaluator.
- `electionEngine` should be generalised to judge an arbitrary **interval**, not
  only its own candidate windows. That is what lets `longSession` stop deriving
  anything.
- `election.ts` (the older engine, still serving `routes/election.ts` and
  `studio.ts`) either retires or is narrowed to strict inception only and
  renamed. It cannot remain an ambiguously older answer to the same question.
- Planner keeps its workflow and loses its brain: `/plan/weave` should call the
  day and week weavers.
- `/tides/best-times` retires as activity advice, or is renamed to something
  descriptive and kept away from scheduling.
- `/planning/windows` stays persistence only. Storing a result does not make a
  route a timing authority.
- Calendar's client-side planetary hours retire in favour of the canonical
  timeline.

## And the duration question

Capture stays one line. Duration is resolved **when the user asks Compass to
place the task**, in one compact batch of chips, not per-task and not at
capture. Two readiness levels:

- **ready for timing** — activity known; can receive guidance without a block
- **ready for placement** — activity *and* duration known; can reserve an interval

A suggested duration may preselect a chip but must not commit a block, and
`duration` carries its own provenance (`user` / `learned` / `suggested`).
Activity kind is never a duration: "send one email" and "write a chapter" are
both Mercury.

The governing sentence:

> **Capture records what exists. Compass judges when it fits. Scheduling asks
> how much space it needs.**
