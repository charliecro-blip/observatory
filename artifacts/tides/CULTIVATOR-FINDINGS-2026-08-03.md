# The Cultivator is already built, and Compass cannot see it

Investigated 2026-08-03 at the owner's request: *"look through the Cultivator
code to see if there's something there we have discarded/forgotten."*

**Finding: it is not discarded. It is live, wired, and unreachable.**

## What exists

`lib/db/src/schema/cultivation.ts` and `cultivationCheckIn.ts` are real tables.
`artifacts/api-server/src/routes/cultivations.ts` is imported and mounted in
`routes/index.ts` — **nine endpoints, serving in production right now.** The
Compass client (`artifacts/tides/src`) contains **zero** references to any of
it. Production row count: 0. Nobody has ever been able to put anything in.

The only UI that ever consumed it is `artifacts/health-tracker/src/pages/
cultivator.tsx` — the legacy app.

## What the model already does that Compass wants

The owner's ask — *"help each guiding star be broken down into each different
planet or several of them"* — is already the schema:

```ts
favoredPlanets:  jsonb().$type<string[]>()   // PLURAL. ["Mars", "Sun"]
cautionPlanets:  jsonb().$type<string[]>()   // planets that call for softening
favoredPhases:   jsonb().$type<string[]>()   // new | waxing | full | waning
elements:        jsonb().$type<CultivationElement[]>()  // also plural
minimumViable:   text()                      // see below
relatedPlanet / relatedHouse / relatedBodyWeatherTags
domain:          one of 14 — including creative-practice, boundaries,
                 spiritual-practice, social-rhythm, study-learning, recovery
```

Three things stand out.

**1. `favoredPlanets` is already an array.** Guiding Stars carry ONE planet;
cultivations carry several plus a caution set. The multi-planet decomposition
the owner described as a new idea is the shape this table was built in.

**2. `minimumViable` — "the minimum viable version of this practice during
adverse timing".** This is the answer to the owner's other point, that the app
should be usable when time is *not* clear. It does not say don't; it says here
is the smaller version. Nothing in Compass currently has this concept, and the
whole caution/VOC vocabulary would be better for it.

**3. The check-in model is richer than task completion.** `effortLevel`,
`durationMinutes`, `practicesCompleted[]`, `note` — per day, per cultivation.
That is the substrate for "track progress, portrayed beautifully", and it is
already there. The `/cultivations/element-balance` and `/element-report`
endpoints already aggregate tended-vs-total by element over 7 or 30 days.

## The decision this forces

Cultivations and Guiding Stars are two models of the same intent — a thing you
are tending over time — and only one is reachable. Options:

- **Absorb.** Give Guiding Stars the fields cultivations already have
  (favoredPlanets[], cautionPlanets[], minimumViable, richer check-ins) and
  retire the cultivation tables.
- **Adopt.** Build the Cultivator surface in Compass against the existing
  endpoints, and let Stars be the ambition layer while cultivations are the
  practice layer.
- **Merge.** One object with a `kind`.

The owner's framing — *"a space to track complex tasks, habits, and make
progress... and that's a somewhat separate thing from Compass"* — points at
**adopt**: the Cultivator is the tending surface, Compass is the timing
surface, and they meet where a cultivation asks when to practise.

That is a product decision, not a refactor, so it is recorded rather than
taken. But it should be made before any more work goes into either model,
because right now the app has two answers to "what am I tending" and shows
neither well.

## Cheapest possible next step

The endpoints exist and are tested by nothing. Before building UI, run the
nine routes against a scratch tester and confirm they behave — the element
balance in particular, since it was written for a different app's assumptions
and has never been exercised by Compass.
