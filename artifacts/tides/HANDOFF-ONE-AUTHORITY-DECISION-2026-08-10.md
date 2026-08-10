# Handoff to GPT: does Compass get to have four astrological opinions?

## What I need from you

Four modules besides the canonical election engine independently judge the
same kind of question — "is this activity well-timed right now" — each with
its own vocabulary, its own weights, and no test that checks they agree.
`tests/oneAuthority.test.ts` guards exactly one seam (engine ↔ longSession ↔
dayWeaver ↔ weekWeaver) and says nothing about the four below.

For each of the four, I want a ruling: **RECONCILE** (migrate it onto the
canonical assessment, delete its local duplicate) or **DECLARE DIFFERENT**
(it is legitimately answering a different question — but say what invariant
must still hold across it and the canonical engine, so "different judgment"
never quietly becomes "different facts"). Then, for whatever gets RECONCILE,
a concrete migration order — this touches five files and several live
surfaces, and I'd rather do it once, correctly, than three partial passes.

You (an earlier instance of you, in an unrelated conversation) already ruled
on one of these — inception vs. ordinary timing is a legitimate difference.
I'm asking you to extend that ruling to the other three, which you had not
yet looked at closely.

---

## What's already unified, as the baseline

`electionEngine.ts` exports `evaluateActivityInterval(activityKey, startAt,
endAt) → ActivityAssessment`:

```ts
export interface ActivityAssessment {
  activityKey: string;
  startAt: Date;
  endAt: Date;
  suitability: Suitability;              // clear | qualified | defer
  suitabilityReasons: SuitabilityReason[];
  backgroundFit: "aligned" | "neutral" | "contrary";  // a PRIOR, never a veto
  transitions: { kind: string; at: Date; role: "qualification" | "internal-chapter" | "irrelevant" }[];
}
```

It owns significator motion/stations, Mercury retrograde policy, and
Moon-sign background fit. `longSession.ts` calls it and adds exactly one
thing on top — an interval-specific VOC check — and the way it does that is
the pattern I want you to judge the other three against:

```ts
// electionEngine.ts:225-231 (longSession.ts, actually — see below)
// THE VERDICT IS INHERITED, NOT DERIVED.
// This module used to compute its own suitability from the activity's voc
// policy, mode and Moon-sign fit, and disagreed with the election engine
// on 20% of activity-days — engine `clear`, session finder `qualified`,
// for the same afternoon.
const RANKING: Record<Suitability, number> = { clear: 0, qualified: 1, defer: 2 };
const intervalVerdict: Suitability =
  opensVoid && activity.voc === "avoid" && isInception ? "defer"
  : opensVoid && activity.voc === "avoid" ? "qualified"
  : "clear";
const suitability: Suitability =
  RANKING[intervalVerdict] > RANKING[assessment.suitability] ? intervalVerdict : assessment.suitability;
```

Inherit the base verdict, add ONE interval-specific fact the base evaluator
(day-granularity) cannot know, and the override is monotonic — it can only
make the verdict *stricter*, never override it looser. Measured before this
existed: 25 of 125 same-activity-same-day comparisons disagreed with Home. I
consider this seam closed and well-designed. It's the template.

What `ActivityAssessment` does **not** yet carry — the actual gap — is
everything `computeElections` computes about *agreement*: `supportLevel`
(supported/convergent), the evidence families, personal/natal reinforcement,
the full `Evidence[]` receipt. `computeElections` still derives those
separately, on top of the same `evaluateActivityInterval` internals.

---

## The four

### 1. `inceptionElection.ts` — 543 lines, its own verdict scale entirely

Own hour matching, own significator/combustion rules, own four-point scale:
`strong | workable | caution | avoid` — nothing like the canonical
`supported/convergent` × `clear/qualified/defer`. Reached via
`routes/studio.ts` and `routes/election.ts`; zero tests.

**Already ruled on, by you, in an earlier pass:** *"Different judgments for
strict inception and everyday activity timing are legitimate."* I agree —
"is this the decisive moment to launch something irreversible" is not the
same question as "does this ordinary task have support in this window," and
classical electional astrology treats them as genuinely distinct arts.

**What you flagged as NOT legitimate, same pass:** inceptionElection carries
its own hardcoded eclipse-date table (`inceptionElection.ts:74`, "Source:
NASA eclipse canon," feeding `nearestEclipseDays()`), instead of consuming
`eclipseWindow()` from `astro.js` — which `electionEngine.ts` already uses.
Confirmed still true as of this session. **Ask:** is "different judgment,
shared facts" the complete ruling here, or is there more you'd change?

### 2. `studioCard.ts` — 884 lines, a second scoring table with drifted constants

Builds shareable social-card content (the Studio/IG feature). Has its own
`ACTIVITIES` table with its own weights (`planetW`, `aspectW`, `eveningBias`,
`waxingBias`, `fullMoonBoost`) and re-implements candidate scoring —
Moon-perfection swell, day-ruler multiplier, phase bias — with **different
constants for the same concept**:

```
studioCard.ts:412   if (dayMatch) score *= 1.15;
electionEngine.ts:681  if (dayMatch) { dayBoost *= 1.1; ... }

studioCard.ts:414   if (a.waxingBias) score *= waxing ? 1.12 : 0.9;
electionEngine.ts:677  if (phaseMatch === true) { dayBoost *= 1.1; ... }
```

No principled reason for `1.15` vs `1.1` was ever written down — this reads
like independent tuning that drifted, not a deliberate choice. Worse: the
dependency runs backwards. `electionEngine.ts` **imports**
`scanMoonPerfections` **from** `studioCard.js` — the "second system" is
upstream of the canonical one for at least one piece of shared math.

One real constraint: shareable cards may need to work **without** a
personal chart and possibly without precise lat/lon (a card generated for
public/social consumption, not an in-app per-user reading — there's a
standing comment elsewhere in this codebase: *"needs lat/lon — allowed here,
unlike shareable cards, because this is in-app and per-user"*). So some
difference may be structurally necessary, not just drift.

**Ask:** separate the necessary difference (no-personalization mode) from
the accidental one (duplicated scoring with different numbers). Can
`studioCard` call `computeElections`/`evaluateActivityInterval` in a
location-optional or personalization-optional mode instead of maintaining
parallel math? If yes, what's lost? If genuinely no, what's the minimum
shared surface (at least: matching constants, sourced from one place) to
keep the two from silently diverging further?

### 3. `timingTier.ts` — its own three-point scale, existing specifically to avoid a scale

Grades `great | workable | against` from the `dayarc` energy curve plus its
own `getPlanetaryHour` call. Its own header comment: exists "to avoid a
seventh favorability scale" — which is the tell. It's grading the exact
question the canonical engine grades (is this a good time for this kind of
work), from a narrower input (one energy curve), with no cross-check.
Consumed by `routes/planning.ts` and `rehome.ts`. Untested by name.

I can't find a case for this one being a *different question* — it reads as
`suitability`/`supportLevel` computed a second, cheaper way, for surfaces
that didn't want to pay for a full `computeElections` call.

**Ask:** is there a legitimate reason to keep a cheap/approximate tier
separate from the full computation, e.g. for a hot path that can't afford
the real thing? If yes, what should it be *derived from* (a cached/coarser
read of the same canonical assessment, not an independent computation)? If
no — straight RECONCILE, and I'd want the callers moved onto
`evaluateActivityInterval` directly.

### 4. `synthesis.ts` — the daily reading; a real candidate for "different question"

Powers Today's narrative "weather report" — sect, dignity-weighted hour/
day-ruler/Moon-sign/phase testimony, its own weights and polarity rules.
Reached via `routes/tides.ts`, `reports.ts`, `engine.ts`, `advise.ts`.

This one has the strongest case for being a genuinely different product:
"what is the shape of today, as one holistic narrative" is arguably not the
same question as "does this specific activity have support in this specific
window" — a daily reading synthesizes many things into one voice; an
activity verdict is scoped and binary-ish by design.

But one fact undercuts a clean "different question, ship it" ruling:
**`electionEngine.ts` does not import `dignity` at all** (verified: zero
matches for "dignity" in that file). `synthesis.ts:20` does:
`import { dignity } from "./dignity.js"`. So the canonical activity verdict
and the daily narrative can disagree about the SAME planet's condition on
the SAME day, by construction — not because they're answering different
questions, but because one of them is using information the other one
discards. A debilitated planet's testimony could count for real weight in
one surface and for nothing in the other.

**Ask:** even if `synthesis` stays a separate product (I think it should),
should `electionEngine` start consulting dignity too — at minimum for
`personal`/establishing-family weighting — so the two surfaces can disagree
about *emphasis* without disagreeing about *the underlying facts*? Or is
dignity deliberately out of scope for the activity engine, and if so, why
does the daily reading get to use it and the activity verdict doesn't?

---

## Constraints, so a plan doesn't propose around them

- **Don't touch inception.** Already ruled legitimate; only the eclipse-table
  sourcing is in question there.
- **`oneAuthority.test.ts` is the enforcement mechanism**, not a doc — any
  RECONCILE ruling should come with a concrete test to extend, not just a
  recommendation. It currently guards engine ↔ longSession ↔ dayWeaver ↔
  weekWeaver only.
- **This is closed beta**, not a public launch under load — correctness and
  trust matter more than migration speed, but there's no reason to freeze
  everything else while this is decided. Tell me if any RECONCILE is small
  enough to do alongside other work versus needing its own dedicated pass.
- Studio/social cards are a real, shipped, owner-prioritized feature
  (content-engine work). Don't recommend deleting or degrading it to win the
  architecture argument.

## What to send back

For each of the four: **RECONCILE** or **DECLARE DIFFERENT**, one sentence
of why, and — if DECLARE DIFFERENT — the specific invariant (shared table,
shared weight, shared test) that should hold anyway. Then an order of
operations for whatever gets RECONCILE, sized by risk and effort, not just
severity.
