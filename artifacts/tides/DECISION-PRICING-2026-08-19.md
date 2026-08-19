# Decision — the free/paid line · 2026-08-19

Captured while it is fresh. Not built: there is still no billing, no users
table and no entitlement check. This is the line to build TOWARD, and the
reason it is this line.

## The line

**Free answers "now". Paid answers "when", across a horizon.**

Free is orientation: today's What Lines Up, the loop, capture and check-off,
the live sky rail, basic activity timing for today, Guiding Stars and habits
as a plain planner, a short recent log — and **full inspectable evidence for
every recommendation**.

Paid is orchestration and continuity: week and month horizons, Shape Day and
Shape Week, long-session finding, calendar-aware placement, alerts for
meaningful openings, history and patterns, strict electional tools, and the
timing half of Ask.

## Why this line and not "personal astrology"

Natal personalization was the obvious candidate and is the wrong one. The
engine already treats chartless as a first-class path — `linesUp` returns
`personal` as a per-window boolean beside `chartAvailable`, and "chartless is
fine — GOOD tier only" appears at three separate call sites. Pricing around
natal would mean fighting an architecture deliberately built so personal
evidence is an ADDITIONAL VOICE. Position it as "your chart can join the
read", never "upgrade to unlock the real astrology".

The durable argument is behavioural rather than astrological: a person can
act on one timing insight by hand. Nobody reproduces by hand a seven-day
search across dozens of windows that respects calendar conflicts, capacity,
long sessions, and recomputes when things move. That is where software earns
a subscription, and it needs no scarcity manufactured to be true.

**It also follows seams that already exist.** Shape Day, Shape Week, long
sessions, calendar placement, strict elections and Ask are all built and
shipped. What is missing is billing, entitlements, and the history/patterns
layer. A pricing line that requires almost no new construction is evidence
the seam is real rather than invented.

## Three amendments (these are the decision, not decoration)

1. **The Guiding Star count is never a paywall.** The cap is 5 and exists as
   an anti-overcommitment constraint — the UI says "Only 5 active at a time
   — pause one first". Converting an honest editorial limit into a
   monetization lever is the dark pattern this brand refuses, and it punishes
   people for using the product correctly. Charge for orchestrating ACROSS
   stars, never for having a second one.
2. **Cadence forgiveness is never a paywall.** The forgiving streak, "most
   days", and scoring against the rhythm the person chose are the
   differentiator the loyalty audit found nobody sees until they fail.
   Charge for patterns over time; never for not being shamed.
3. **Ask splits along its own doors.** It is now the most prominent card on
   Home, so a wholly-paid Ask makes a free user's best slot a paywall.
   *This moment* is free — explaining a recommendation already on screen is
   part of the evidence layer, and evidence-in-free is load-bearing for
   trust. *Timing* and multi-star *Orient* are paid, which puts the boundary
   exactly where the expensive computation is.

## Trial

30 days of full Compass, not 60. In 30 days a person meets roughly four
weekly reviews, four sprint suggestions, one complete lunation, and enough
habit cadence to see the forgiving behaviour. Day 31–60 repeats those
categories rather than adding one.

**The mechanic that must be right:** when the trial ends, already-committed
windows SURVIVE. If Compass placed twelve things across next week, those are
on the person's calendar and they stay; only the ability to compute new
placements stops. Data is never locked or deleted and export always works.
Get this wrong and the graceful downgrade becomes the hostage-taking the
whole model exists to avoid.

## Known cost, going in

The free tier is not cheap to serve: `linesUp` prices up to twelve held items
per load, and the next-opening scan runs week-span elections for up to four
distinct activities. Real computation on every free daily visit. Fine — but
price it knowing that.

## Where the scaffolding goes

`tester_profiles.plan` already exists, defaulting to `beta`. That is the
place to put an entitlement without inventing a users table.

---

## Built · 2026-08-19

The line above is now enforced. What exists, and what a provider choice
would still need.

### Enforced, and tested

`api-server/src/lib/entitlements.ts` is the single definition. The
client reads it through `GET /account/entitlements` rather than holding
a second copy, because two copies of a free/paid line drift and the
drift always favors whichever is cheaper to change.

The guards sit on the routes that COMPUTE: `shape-day`, `shape-week`,
`long-session`, and calendar-aware re-homing. They refuse with 402 and
name the feature. They never touch storage or retrieval, which is how
the promise that **committed windows survive** is kept — a free account
still reads its windows, still keeps new ones by hand, still exports.
Verified, not assumed.

Trial expiry is computed on read. A trial that lapsed at midnight is a
free account at 00:01, without waiting for a job. `POST /account/trial`
is idempotent and never restarts one; it asks for no payment method.

The three amendments are in `NEVER_GATED` as data, with a test keeping
that list disjoint from the paid one — so a future feature key cannot
quietly paywall the Guiding Star cap, cadence forgiveness, evidence, or
export.

### The seam, not the integration

The owner's call (2026-08-19): build the port, choose the provider
later. Nothing in the code or the schema says "stripe" — the columns
are `billing_customer_id` / `billing_subscription_id` / `billing_status`,
because a column named after a provider would quietly make a choice
that has tax and legal consequences.

`lib/billing/transitions.ts` is the part worth having correct before a
provider exists, and it is pure and tested twelve ways:

- **Stale events are ignored**, compared on the provider's own
  timestamp. A retried "ended" arriving after a newer "active" would
  otherwise cancel a live subscription.
- **Past due keeps access.** A failed charge is usually an expired card
  and the retry usually works; the provider's dunning window is where
  that decision belongs.
- **An ended subscription lands on `free`, never back on `beta`.**
- **A downgrade writes five fields**, all of them plan or billing. The
  test asserts the exact key set, so the survival of committed work is
  structurally guaranteed rather than remembered.

The webhook route **rejects anything it cannot verify** and returns 200
for events it deliberately ignored, since a 4xx makes providers retry
forever. Confirmed against a live instance: a forged
`subscription.active` POST is refused 400 and the account stays on
beta.

### What choosing a provider still needs

One adapter implementing `BillingAdapter` (four methods), its keys as
environment variables, and the price set in the provider's dashboard —
the UI renders whatever `GET /billing/price` returns and shows no
number when that is null, because a wrong price is worse than none.

The open question is unchanged and is not a code question: **merchant
of record (Paddle, Lemon Squeezy) or raw processor (Stripe)**. VAT on
digital sales to the EU and UK is owed from the first sale; an MoR
becomes the legal seller and handles it, Stripe does not. That is the
decision the naming here is deliberately staying out of.
