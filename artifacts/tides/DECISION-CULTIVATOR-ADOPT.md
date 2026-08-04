# Decision: adopt the Cultivator (2026-08-03)

Owner: **"let's adopt."**

Of the three options recorded in CULTIVATOR-FINDINGS-2026-08-03.md — absorb,
adopt, merge — this is *adopt*:

> **The Cultivator is the tending surface. Compass is the timing surface.**
> They meet where a cultivation asks when to practise.

## What that settles

- `cultivations` and `cultivation_check_ins` stay. They are not folded into
  Guiding Stars and not retired.
- The nine existing endpoints in `routes/cultivations.ts` become real product
  surface rather than orphaned code. They have never been exercised by Compass
  and are covered by no tests — that is the first thing to fix.
- **Guiding Stars remain the ambition layer**: a long-term ideal you steer by.
  **Cultivations are the practice layer**: a thing you tend, repeatedly, with
  check-ins that record effort and duration rather than a tick.
- The planetary-facet idea (task #43) belongs to **cultivations**, not Stars —
  `favoredPlanets` and `cautionPlanets` are already plural arrays there. It
  does not need to be built twice, and it does not need Stars to change.

## What it unblocks

`minimumViable` — "the minimum viable version of this practice during adverse
timing" — is the field that answers the owner's other requirement, that the app
be usable when time is *not* clear. Compass currently has no vocabulary for the
reduced form of a practice; the Cultivator has had one all along.

That also gives the suitability axis somewhere to land. Once a window can be
`convergent · qualified` rather than silently demoted, the honest completion is
"…so do the minimum viable version" — which requires that the minimum viable
version be a stored fact about the practice, not something the app invents.

## Sequence

1. Exercise the nine endpoints against a scratch tester and write the tests
   they never had. They were written for a different app's assumptions.
2. Build the Cultivator surface in Compass — the tending space, "portrayed in
   beautiful fashion", focused on the practices themselves.
3. Then the planetary facets (#43), against `favoredPlanets`.
4. Then wire `minimumViable` into the suitability language.

Deliberately NOT part of this: any change to Guiding Stars. The decision keeps
the two models separate on purpose, so neither needs to wait for the other.
