# Compass redesign review

The working preview is http://localhost:5175/. This is a local beta candidate for owner review, not a production release or a claim that every phase is complete.

## Implemented

- A timing-first shell using the original Tides typography, chart background, indigo, and brass palette.
- One interpretation endpoint now returns activity, local dates, absolute horizon, duration, assumptions, and unresolved constraints. The page no longer independently parses the same request's dates.
- Local calendar arithmetic uses the requested IANA timezone. Fixed tests cover Chicago, India, Sunday weekend behavior, and the 49-hour autumn DST weekend.
- Painting and other creative activities have a new explicit creative-practice catalogue entry. Household painting is distinguished from making art, gentle workouts from hard training, and preparing a presentation from delivering one.
- Negation and several recognized activities produce clarification instead of first-match automatic search. Unsupported clock/range restrictions stop automatic search and expose correction fields.
- Search interpretation is visible above results, including defaults, dates, duration, timezone, and unknown location.
- Choosing an opening without a duration asks the user to review a session duration and reruns the canonical search before saving.
- Saved times reads the existing planning-window records. Upcoming and past blocks remain accessible with one-event calendar export and honest export status.
- An optional Workspace introduction explains Calendar, tasks/habits, Stars/projects, and reflection. Selected existing tasks and habits can prefill the timing request for review.
- Appearance controls and an About page are available from the account menu.
- Entering Workspace no longer changes the stored landing preference as a side effect.
- App description and social metadata describe the timing purpose. Compass remains the name.
- Removed first-result visual emphasis that could imply an unsupported winner. Fixed the week-card layout to stay within narrow day columns.

## Verification

Full type check passed. API build and client production builds passed.

Full tests passed sequentially in America/Chicago, Asia/Kolkata, and UTC: **1,349 passed, 33 skipped in each timezone**. Running all three suites simultaneously first caused CPU-contention timeouts in the same existing astronomy test; the sequential runs passed without increasing its timeout or weakening assertions.

Browser verification covered the exact painting request, a one-hour painting request tomorrow evening, visible interpretation, canonical results, choosing a session, and finding the saved session in the new library. The optional workspace loads correctly with an honest empty state for this scratch account. The saved library was visually inspected at a narrow browser width.

The existing scratch review account contains prior test blocks and the additional painting block saved during this check. No production data was migrated or deployed.

## Language engine: progress and limits

The parser is still deterministic, with reviewed phrases and catalogue matching. It is **not a general semantic language engine**. No configured model-backed interpreter was connected in this pass.

The new endpoint is a stable place for semantic extraction to be added later: a model may propose validated request fields, but cannot invent activity rules, make astrological judgments, or replace the canonical timing service. Current raw keyword scores are not probabilities.

The acceptance corpus contains 42 everyday requests plus counterexamples and fixed-time request fixtures. These are developer-authored regression examples, not evidence of measured user accuracy. New paraphrases, negation, multiple activities, unusual dates, and combinations need a held-out evaluation set before describing parsing as excellent.

Clock restrictions such as “after 3pm,” multi-day day-parts, named month/day dates, and several supplied dates require explicit correction at present. Numeric and common spoken durations work; unimplemented syntax is not a promise of complete language coverage. The search service still supports a maximum of seven calendar days.

## Remaining phases

| Phase | Status |
| --- | --- |
| 0: canonical timing adapter | Existing implementation retained; regression tests pass. |
| A: search, interpretation, results, choice | Redesigned and extended. Owner rehearsal still needed. |
| A.5: compare supplied intervals | Existing manual comparison retained; natural-language multi-date extraction remains incomplete. |
| B: saved choices | Implemented using existing planning windows. |
| B: saved unresolved searches and Watches | Not implemented. No monitoring or notification CTA is exposed. |
| C: workspace connection | Selected task/habit wording can feed search. Star-step references, source provenance, and Watch linkage remain. |

Durable Watches still need owner-scoped persistence, expiry, scan leases, retry and delivery deduplication, explicit thresholds and channel consent, final revalidation, account deletion/export coverage, and exact return links. The existing generic notifier cannot supply those guarantees by itself.

## Before inviting outside beta users

1. Review the new creative-practice correspondence. It includes new Venus/Moon/Mercury, house, phase, and void-of-course choices and is a catalogue rule addition, not merely a synonym fix. First-date rules were not weakened.
2. Rehearse a fresh authenticated account and a real connected Google Calendar, including unavailable calendar and conflict cases. Earlier tests and the local scratch session do not establish that external integration is ready.
3. Agree on the initial beta language coverage and report unsupported requests alongside successful searches. Avoid collecting private request wording without explicit research consent.
4. Review whether Saved times and the visible Workspace entry are the desired next-stage navigation. These extend the deliberately minimal Phase A shell under the later instruction to continue the redesign.
5. Confirm production migration/deployment separately. This session leaves a local preview and source changes.

The catalogue and activity-mode test retain formatter churn from the preceding turn. A proposed destructive restore was rejected by automatic approval review; it was not retried or worked around. The actual semantic changes remain intact for review, and unrelated dirty files remain untouched. The redesign changes are uncommitted: automatic approval review rejected the commit attempt because its usage limit had been reached.

## September 5 follow-up

- Duration ranges and delayed starts require clarification; compact durations and common compound minute phrases have regression coverage.
- Selecting an activity cannot bypass a pending time-range clarification. The browser rehearsal confirmed that no result appears until the range is reviewed.
- Selecting an activity with an unresolved range moves keyboard focus to the start field, which is associated with the clarification text.
- Progress and error messages appear above the request controls.
- The page derives its draft type from the server interpreter contract rather than the obsolete browser parser.

Focused request, language, and Phase A tests: 77 passed in each of America/Chicago, Asia/Kolkata, and UTC. These are subsequent targeted checks, not another full-suite run. The latest duration additions are verified in source tests; the running API still needs a controlled scratch restart to serve them.

The package-manager launcher could not fetch and verify its requested release in this environment. Checks used the already-installed local test and TypeScript binaries without changing package-manager verification settings.
