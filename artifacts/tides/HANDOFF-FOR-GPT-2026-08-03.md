# Compass — dashboard redesign, for external critique

*Written for a reviewer with no prior context. Everything needed to argue with
the proposal is here. Please be adversarial: the last external audit was
extremely useful precisely because it was unsparing, and every one of its ten
P0 claims turned out to be real.*

---

## 1. What Compass is

A timing app. It reads the current astrological moment and turns it into a
plain suggestion about what to do, when to do it, and when to wait. Three
jobs:

1. **Know what fits now** — read the moment, get one usable move.
2. **Steer by Guiding Stars** — a few long-term directions; days that suit one
   get flagged.
3. **Plan with the current** — paste a to-do list and it weaves tasks into
   windows that suit the work; or pick a day to begin something (electional).

It is in closed beta at compass.day. Real users, real data.

**Stack:** React + TypeScript SPA, Express API, Postgres. Deterministic
astrology engine (own ephemeris/aspect/planetary-hour code); an LLM is used
only for the advisor ("Ask") and a few text-classification endpoints — never
for timing judgments.

---

## 2. Design commitments already settled — please critique, but know they were deliberate

These are not accidents; arguing against them is welcome but should engage the
reasoning.

- **Tide level means coherence/available energy, NOT favourability.** A "high"
  day is not a good day.
- **The app may decline.** "Against the current" and "avoid" are real outputs.
- **Nothing is scheduled without explicit consent.** The planner proposes; the
  user commits.
- **No manufactured significance.** A quiet sky is reported as quiet. The
  recommendation engine says "nothing in the sky singles this out" when true.
- **One voice per fact.** Recently enforced after the hero was caught stating
  the same thing three ways.
- **Provenance matters.** Distinguish astronomy (calculated) from tradition
  (a ruleset's judgment, sometimes contested) from Compass synthesis from LLM
  inference. Election verdicts now name the ruleset and carry dispute notes
  where practitioners genuinely differ.
- **Determinism where it counts.** The "what should I do now" engine is a fixed
  rule hierarchy, not a model call, so the user can reconstruct the answer.

---

## 3. The problem being solved

The owner, reviewing their own app: *"the left hand panel is much more
straightforward in its sequence. this dashboard is incredibly busy and we need
to simplify it."*

**The rail** (left panel) works because it has a spine: season → moon → this
hour. Slow to fast, big to small. Every new block has an obvious home.

**The dashboard** has ~20 blocks in roughly the order they were built, and at
least six separate mentions of "an influence" across four of them:

| Where | Example |
|---|---|
| Hero flavour | "a fire day — carried by the Jupiter hour" |
| Hero WATCH | "Moon rules both this hour and your ascendant…" |
| Hero counterpoint | "— though Venus grinds against your drive (0.6°)" |
| Hero pattern chips | up to three named configurations |
| Teachable moment | "Today has a neptunian undertone" |
| Standing conditions | "the era · Saturn ℞ in Aries…" |

Two of those were literally the same sentence rendered twice (named patterns
are pushed into the watch list server-side *and* rendered as chips). That bug
was fixed three separate times before the general case was caught — which is
the symptom of a surface with no organising principle.

---

## 4. A parallel reframe the owner arrived at independently

> "rather than speaking about what the overarching quality is, how active it
> is, this app is more about matching different qualities of energies of any
> given moment to different activities — or ways of going about activities
> (approaches, rather than changing the task itself)."

Clarified, importantly, as **not** a scoreboard:

> "showing which one is front and centre at any given moment, rather than
> showing multiple scores"

And:

> "the dominant quality is also connected to the prevailing non-lunar aspects,
> too, which aren't necessarily elemental"

> "finding multiple testimonies that show a great convergence for something is
> awesome — but that isn't often going to be the case, and showing multiple
> different options for different activities/approaches at different moments
> can be great"

**Supporting measurement.** The day's "height" is
`0.15 + 0.50·illumination + 0.13·daylight + 0.05·standing`. Measured over the
current lunation at 40.7N:

| | Aug 2 | Aug 7 | Aug 12 |
|---|---|---|---|
| height | 0.68 | 0.43 | **0.28** |
| moon phase | 0.85 | 0.34 | **0.00** |
| standing aspects | 0.63 | 0.62 | **1.00** |

So the week-ahead chart draws its **smallest bars during the month's busiest
aspect period**, because phase is ~60% of the usable range and standing
aspects are 5%. A waning week reads "empty" when it is arguably
"consolidating".

---

## 5. The proposal

### Organising idea: influences have DURATION

```
this hour        ~1 hour        planetary hour
today            hours          Moon's aspects as they perfect
this stretch     days–weeks     non-lunar aspects, partile or applying
these days       ~2½ days       Moon by sign
this month       ~29 days       lunation phase
this season      ~1 month       Sun by sign
this era         months–years   outer-planet stations & ingresses
```

One stack, sorted by duration, **dominant row promoted and named**, the rest
dimmed beneath it. Six blocks in six voices become one instrument with a
scale — the rail's logic applied to the dashboard.

This delivers "which quality is front and centre" without a scoreboard: what
leads the stack changes through the day as the fast layers move.

### Two rules for row copy

1. **Convergence gets emphasis.** When several testimonies agree, say so. This
   is the honest version of "confidence" — not a percentage but *how many
   independent things point the same way*.
2. **A named dynamic must be explicated.** "Saturn hour" alone says little.
   Carry the configuration doing the work — planet in sign, or the aspect with
   its state:
   > Saturn hour · Saturn ℞ in Aries — structure under revision, not construction
   > Moon □ Saturn · applying, exact 4:16pm — weight arriving, not yet landed

### Four zones, in fixed order

1. **READ** — what kind of moment is this (headline + the duration stack)
2. **MOVE** — the deterministic "strongest fit", gaining an "or…" when nothing
   converges
3. **PLACED** — scheduled windows + open tasks, one card
4. **AHEAD** — what's coming, and "what changed since your last check"

Everything else moves below the fold or into a per-zone **receipt** ("why
this?") holding testimonies, orbs, applying/separating, and which rule
outranked which. Net: ~20 blocks → 4 zones + 3 conditional cards.

---

## 6. Open questions — the two that matter most

**Q1. What leads zone 1?**
- (a) the dominant influence named — "Moon–Saturn under tension" — most honest
  to the reframe, but discards the tide vocabulary the brand is built on
- (b) the tide headline with the dominant influence as subtitle — keeps
  legibility; current recommendation
- (c) the approach — "Today favours the unglamorous task" — most useful, least
  astrological

**Q2. Does the tide scalar survive as the hero's identity, or demote to one row
of the stack?** Demoting resolves the week-bars problem but changes what
Compass *is*.

---

## 7. What we specifically want critiqued

1. **Is duration the right sort key?** Alternatives considered and not chosen:
   by strength, by domain (work/body/relationship), by actionability. Duration
   was picked because it mirrors the rail and is objectively orderable. Is
   there a better axis?
2. **Does the dominant-row promotion actually avoid becoming a scoreboard?**
   The owner explicitly ruled out multiple scores. Does "promote one, dim the
   rest" hold that line, or does it smuggle ranking back in?
3. **Zone 2's "or…".** Offering 2–3 approaches when nothing converges — does
   that help, or does it reintroduce the decision fatigue the single pick was
   designed to remove?
4. **Is four zones too rigid?** Fixed order is the point, but conditional cards
   (ritual, review) still float above. Where should they go?
5. **The weight rebalance.** Phase 0.50 / standing 0.05 is defensible as a
   *lunar* app but produces the misleading week chart. What should the weights
   be, and what evidence would justify a specific number rather than taste?
6. **Q1 and Q2 above.**

---

## 8. Constraints — please don't propose these

- **No new scoreboard.** Multiple simultaneous scores are ruled out by the
  owner.
- **No LLM in the timing judgment.** Ask is an explanation layer over
  deterministic output; it was recently reworked *away* from being a parallel
  oracle and must not drift back.
- **No auto-scheduling.** Consent is a product commitment.
- **No fabricated targets.** The app recently removed invented "0/2 sessions
  this week" denominators; don't reintroduce implicit goals.
- **No precision theatre.** Exposing internal scoring decimals (`+0.72 · w
  0.85`) was judged to show the arithmetic rather than the astrology.
- Mobile matters — beta users are largely on phones.

---

## 9. Current state, for accuracy

**Shipped this week:** first-run quieting; walkthrough; deterministic
"strongest fit"; hover→tap for touch; election ruleset provenance + dispute
notes; Ask reframed as explanation layer; a condition-aware "approach" layer
(same planet, different suggestion by time-of-day, rhythm and void state);
rhythm intake reduced to four groups; dead-of-night floor (no 3am suggestions
unless the user said they're up); calendar-failure honesty in the planner.

**Known and unfixed:** dashboard busyness (this document); load time (~27 API
requests per cold load, ~0.5s TTFB each — needs an aggregate endpoint or
deferred queries); astro-detail levels conflate "how much on screen" with "how
much explanation"; several dead components still in the codebase.

**Not started:** the reframe itself beyond the approach layer and the Guiding
Star intake breadth.
