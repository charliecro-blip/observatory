# Handoff to GPT — the scheduling stack

Self-contained. You do not need the codebase.

This is a **design** review, not a correctness audit. What exists is tested (609
tests) and today's real defects were found by reading output, not by reasoning
about it. The question is whether the stack should exist in this shape.

## The product in five lines

Compass is an astrology-based timing app in closed beta at compass.day. A
deterministic engine — own ephemeris, planetary hours, dignity, classical
electional rules — computes when the sky supports a given activity. No LLM
touches timing. The audience is astro-literate. The stated centre of the product
is **moments of convergence for particular activities, globally and personally**.

## What was built today

Six modules, in a chain, following a design you reviewed and corrected in an
earlier round (that review is why lunar events are *typed transitions* rather
than hard cuts, why Moon sign is a background prior rather than a veto, why
`hourRulers` is used instead of `PRIMARY_SIGNIFICATORS`, and why sessions return
tradeoffs instead of one winner).

| Module | Lines | Does | Called by |
|---|---|---|---|
| `dayTimeline` | 288 | Ordered day events, each with a ROLE (hard-boundary / qualification / anchor / chapter). Only hard boundaries cut. | longSession, dayWeaver |
| `longSession` | 278 | Enumerates 3–4h blocks inside containers; returns best-uninterrupted / best-anchored / earliest, ranked lexicographically | sessionNarration, dayWeaver |
| `sessionNarration` | 164 | The pre-session arc, rendered once. Explicitly not a per-hour instruction list. | route |
| `linesUp` | 310 | Home's primary module: timing for what the person already holds | route |
| `dayWeaver` | 287 | Places held items into today's free time. Gaps and refusals are output. | weekWeaver, route |
| `weekWeaver` | 269 | Assigns items to days under attention/recovery constraints, then calls dayWeaver | route |

New routes: `/elections/lines-up`, `/elections/long-session`,
`/elections/shape-day`, `/elections/shape-week`.

## The inventory that worries me

Counting only server modules that decide *when something should happen*:

- `electionEngine.ts` (715) — the canonical engine; two-axis output
  (`supportLevel`: supported/convergent, `suitability`: clear/qualified/defer)
- `election.ts` (515) — **a second, older election implementation**, still live,
  used by `routes/election.ts` and `routes/studio.ts`
- `dayarc.ts` (535) — used by `electionEngine`, `timingTier`, `rehome`, `studioCard`
- the six new modules above

Plus route-level authorities: `/tides/best-times`, `/plan/weave` and
`/planning/windows` (the Planner), and Calendar's own client-side hour maths.

An earlier audit of this codebase flagged "**Planner as a separate timing
authority**" as a P0 defect when there were roughly three such surfaces. There
are now closer to ten, and I added four of them today. Each is defensible in
isolation. Nobody has looked at the whole.

## Constraints that are settled — do not reopen

- **Only place what the person actually holds.** If there is a good Venus window
  at 4pm and nothing in their life wants one, the honest output is an empty 4pm.
- **Occupancy is never the target.** An open day is a correct answer and must
  render as deliberate.
- **Gaps and refusals are output**, with reasons, never silent drops.
- **A disclaimer means the design is wrong.** If a surface needs a caption
  explaining what it isn't, rebuild the surface.
- **Astrology chooses among viable placements**; it never decides how much work
  someone should have.
- Customisability is deferred. One fixed order, not "let the user choose".

## Q1 — One pipeline, or four authorities?

The four new modules chain cleanly (timeline → session → day → week), and each
is also independently callable with its own route. Each makes its own
suitability judgments: `longSession` decides defer/qualified from the activity's
`voc` policy and mode; `dayWeaver` decides again when it picks among session
options; `weekWeaver` decides a third time when it assigns days.

Is that good layering — each level answering a question the level below cannot —
or is it the P0.8 defect committed four more times, with the same fact judged in
three places that can disagree?

If they should collapse, what is the right seam?

## Q2 — What happens to Planner and `/tides/best-times`?

`dayWeaver` does what the Planner does, deterministically and with better
refusals. `/tides/best-times` answers a question `/elections/times` also
answers. Two surfaces that answer "when should this work go" is a trust problem
before it is a duplication problem — a user who gets different answers from Plan
and from Home has no way to know which to believe.

Retire, merge, or keep with a stated division of labour? And does `election.ts`
(the older engine, still serving two routes) survive?

## Q3 — The feature is gated on data that does not exist

`dayWeaver` refuses to invent a duration. If it can neither read
`tasks.est_minutes` nor recognise the activity from the title, the item comes
back unplaced: *"no estimate, and the title does not clearly name a kind of work
— add a rough duration to schedule it."*

That refusal is deliberate and I think correct: the alternative gave "Renew the
domain" — a two-minute chore — a 45-minute block.

But **the fast capture paths never set an estimate.** Home's one-line dump and
QuickCapture both create tasks with `est_minutes` null; only the deeper Tasks
page exposes the field. So a real beta user opens "Shape today" and sees most of
their list under a refusal message.

Three options, none obviously right:

1. **Ask at capture.** Contradicts the owner's explicit requirement that capture
   stay one line with no ceremony.
2. **Infer harder.** Widen activity recognition so more titles classify and
   inherit a window-type default. Improves coverage; risks confident-and-wrong
   classifications, which is the failure the current threshold exists to prevent.
3. **Place unestimated items anyway**, at a short default, flagged as assumed.
   Restores the slot-stuffing the refusal was written to stop.

Which, and why? This shapes the capture flow, so it is not a small call.

## What would be most useful back

A ruling on Q1 — the layering question is the one I cannot see from inside,
having written all six modules today. Then Q3, because it decides whether any of
this is usable by a beta tester next week.

Concrete disagreement beats synthesis. If the stack is right as built, say so
and say why.
