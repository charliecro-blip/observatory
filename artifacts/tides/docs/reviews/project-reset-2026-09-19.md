# Compass project review — September 19, 2026

Status: assessment and proposed recovery sequence for owner discussion. This does not authorize a new redesign, change the ratified timing thesis, or claim a release is ready. No application code changed during this review.

## Assessment

Compass has substantial existing capability and a promising timing interaction. The owner has lost the continuity of using it while development has changed its entrance, navigation, presentation, and operating environment. Recovering that continuity is the immediate product goal.

The September reorientation remains useful: bring an activity, find relevant openings, inspect the reasons, choose a time. The owner's later requests also make clear that Calendar, Almanac, and the personal workspace are part of what made the app worth opening. Simplification should reduce the number of decisions on arrival while keeping those capabilities connected.

The implementation currently combines a new timing shell, the old Home as a nested Now view, the original Calendar/Almanac, and a separately navigated Workspace. This preserved features but left different page hierarchies and interaction conventions in the same app. The present problem is integration, reliability, and a clear everyday purpose more than a shortage of features.

## Evidence and limits

Reviewed the ratified September 4 specification; original architecture, worldbook, brand/design briefs, August home-base and Ask/Home work; September implementation and style reviews; current source for the shell, Home, Calendar, language interpreter, timing adapter, calendar integration, and workspace bridges; repository state; and the current browser preview.

Fresh observations on September 19:

- The browser is on localhost:5175 with the **Phase A review** scratch profile. It is not evidence of the owner's personal account or production data.
- Home shows a current-reading error alongside retained reading and lunar information. The source permits cached data to render during a refetch error without a visible freshness label.
- The local scratch API on port 3001 was unreachable in a direct check outside sandbox networking. This is a local runtime failure; production was not checked.
- Calendar initially shows an unavailable-sky alert alongside “Nothing is due today” and a quiet-day message. Source inspection confirms several Calendar queries consume data without carrying their loading/error states into those empty-state decisions. An unavailable response must not be interpreted as an empty day.
- The latest commit is September 4, `8a9d62b`. Many subsequent app changes, regression tests, and review records remain uncommitted alongside unrelated work. This is recoverable work, but a poor release boundary.
- Home's “On your calendar” preview reads Compass planning windows only. It does not include Google events. It also says no time has ever been chosen when there are merely no upcoming choices; those are different facts.
- The new interpreter is deterministic phrase matching. Its recent safeguards catch unsupported constraints; they do not provide general language understanding.

Earlier measured evidence, not rerun today:

- September 15–16: 1,377 tests passed and 33 skipped in each of Chicago, Kolkata, and UTC after the station correction.
- The later language pass: 92 focused tests passed in all three zones; API typechecking passed. Ten new constraint cases failed before the correction.
- Scratch browser rehearsals have completed search, duration refinement, choosing a window, and seeing it in the calendar/Home. Responsive and keyboard checks are recorded in the September reviews.

The latest language follow-through was not rebuilt into the running API at the end of that work. There is no new end-to-end success claim today, no verification of the owner's current data, and no production or Google OAuth rehearsal in this review.

## What survives and what remains incomplete

| Capability | Current position |
| --- | --- |
| Canonical timing search | Implemented; orchestrates existing ordinary, session, and supplied-interval assessment paths, preserving evidence/coverage differences. Strict inception remains separate. |
| Find, inspect, choose | Implemented and previously rehearsed locally. Broad conditions can lead to a duration-specific search before saving. |
| Calendar and Almanac | Reused, with agenda/day/week/month, sky events, activity browsing, and search-opening overlays. Their interiors and failure states still need reconciliation. |
| Tasks, habits, Stars/projects, sessions, progress, Log | Existing functionality remains in the repository and Workspace. The new entrance does not yet make the owner's preferred loop continuous. |
| Workspace → timing | Existing bridge transfers task/habit wording and optional duration. It does not yet preserve a complete structured source relationship. |
| Google Calendar | Existing read integration and busy-time checking. Scratch configuration/real authorization were not completed in the recorded rehearsal; direct event writing is not implemented. Export is separate. |
| Language | Common phrases work; unsupported constraints increasingly stop automatic search. No held-out accuracy result or general semantic interpreter exists. |
| Visual identity | Original fonts, Almanac/Observatory direction, shared actions, improved moon depiction and contrast are available. Legacy and new surfaces remain uneven. |
| Watches | Not implemented; transport for generic notifications is not an activity-specific durable Watch system. |
| Public beta | Not ready for an unconditional readiness claim. Fresh-account, real-calendar, runtime continuity, and consolidated release checks remain. |

Phase 0 is implemented. Phase A and manual A.5 exist with limits. Parts of later work, particularly saved choices and workspace entry, are present. Completing B/C numerically is not the next useful milestone.

## Product direction to preserve

Compass helps someone understand the astrological conditions around a real activity and choose when to do it, alongside the commitments and work they already have.

There are three compatible reasons to open it:

1. **Orient:** understand the current period and see what is already on the day.
2. **Decide:** find or compare a time for an activity, with a plain explanation and visible qualifications.
3. **Continue:** return to a chosen plan, existing task/habit, or voluntary record of what happened.

Search remains the principal timing interaction. Calendar makes it practical. Almanac gives context and supports browsing without requiring a perfectly worded query. The optional Workspace supports deeper personal use without becoming a prerequisite for an answer. Pleasure, connection, creativity, movement, and rest belong alongside work.

The signed-in homepage should be a useful day page: a short current reading with honest freshness, a prominent timing request, and the actual next commitments or plans. People who already use Workspace need a short route to resume their work. New users should not encounter empty productivity modules or be asked to adopt a life-management system.

The public landing page is a later, separate presentation of the same promise. Show one understandable example and what a choice looks like; do not turn the signed-in Home into a marketing hero.

The existing Almanac/Observatory identity is sufficient for this recovery: warm paper or dark ink, readable type, precise lunar graphics, restrained color, consistent controls. Preserve the useful diagrams and specificity. Simplifying terminology should not reduce the reading to generic phrases such as “an emphasis on movement and physical activity.” No rename or additional theme system is needed for this milestone.

## Recovery sequence

### 1. Establish a reliable personal-use release

Review and checkpoint the app-specific changes without sweeping unrelated tools into the same change. Keep development work separate from the version the owner uses. Provide one documented launch path and verify the actual served version, account, and data source. Select a stable personal-use destination that does not depend on an unattended terminal remaining alive; deployment needs its own concrete review before any production change.

Correct the broken-state presentation before adding features: distinguish failed loads, stale readings, and successful empty results. Check timezone/location handling across the entry surfaces. Preserve access to the owner's existing data; do not copy production records into scratch to make a demo look populated.

**Done when:** the owner can open, leave, and return to the same working version and account, recognize the state of their data, and encounter recoverable errors without guessing whether refresh will help.

### 2. Restore the owner's useful loop

Use the owner's account of what they actually did before the redesign to choose the first path. A likely path is current conditions → today's real commitments → one thing to time → inspect a few openings → choose → see it in the calendar → return later.

Reuse the existing calendar, session/progress, and reflection components where that path needs them. Home's agenda should reflect the sources it claims to show. Carry structured task/habit context into timing when present, without forcing every standalone query into a task. Make the same controls behave alike along this path before polishing every historical screen.

**Done when:** several real activities can be planned and revisited across separate visits without recreating context or finding a different mini-app. The owner feels able to use Compass while development continues.

### 3. Make language useful, then invite a small beta

Build a held-out set of ordinary requests and expected structured interpretations, including temporal constraints, negation, ambiguity, unsupported activities, chartless use, and timezone changes. Keep development examples separate from evaluation examples. Record incorrect interpretations, clarification burden, and failed searches separately.

Use deterministic calendar arithmetic and validation for the final request. If a semantic model helps map wording into structured fields, constrain it to interpretation; canonical activity rules and timing calculations remain the judgment authority. Resolve only the uncertain field, preserve everything understood correctly, and offer a small number of relevant alternatives. A refusal followed by a large form is not a successful language experience merely because it avoids a wrong search.

Rehearse account creation/recovery and real Google read/conflict behavior. Complete the necessary rule reviews, including creative-practice correspondence and the inconsistent void-of-course definitions. Check the final build in the supported timezones and on a phone, then offer the frozen version to a few people with real timing questions.

**Done when:** people can express an intention, recognize what Compass understood, choose or reject an opening for a clear reason, and return with another real question. A test count alone does not establish this.

## Working agreement proposed for the next pass

- One bounded milestone at a time, with an observable completion condition.
- Preserve one usable release while improving the next.
- Report separately what changed in source, what was exercised in the browser, and what version the owner can use.
- Finish a complete user path before adding another surface.
- Keep a short active list here; the historical backlog is a reference, not a command to build everything.
- Keep Watches, new branding/pricing work, broad workspace expansion, and the parked content generator out of this recovery milestone.

The owner is needed for the lived-workflow example, eventual Google consent/account access, a few astrological rule decisions, and reactions to actual use. Engineering diagnosis, consolidation, local verification, and preparing a reviewable release are agent work. The owner should not need to supervise server restarts or infer readiness from technical test reports.

## Principal references

- `PRODUCT-WAVE-FIRST-REORIENTATION-2026-09-04.md`
- `artifacts/tides/WORLDBOOK.md`
- `artifacts/tides/AUDIT-HOME-BASE-2026-08-16.md`
- `artifacts/tides/DESIGN-ASK-AND-HOME-2026-08-19.md`
- `HANDOFF-2026-09-04-REORIENTATION.md`
- `BETA-REHEARSAL-2026-08-24.md`
- `artifacts/tides/docs/reviews/redesign-morning-review-2026-09-05.md`
- `artifacts/tides/docs/reviews/connected-home-calendar-2026-09-08.md`
- `artifacts/tides/docs/reviews/style-audit-2026-09-10.md`
- `artifacts/tides/docs/reviews/beta-rehearsal-2026-09-16.md`
