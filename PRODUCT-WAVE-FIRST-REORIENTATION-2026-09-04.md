# Wave-first product reorientation

2026-09-04 · Product thesis ratified; scope revised after owner review · Specification revision only

## 1. Thesis and decision status

**Positioning:** Compass helps you find astrological openings for things you want to do, choose a time, and hear when a relevant opening is approaching.

The core promise is that someone can bring one real intention, get an intelligible activity-specific reading of possible times, and leave with a decision. They do not need to adopt a planner, supply a natal chart, or return every day. The central interaction is:

**Something I want to do → time horizon → relevant openings → choose, save, or watch.**

Find a time is the product. Now is the same search over the next few hours; Look ahead is a temporal visualization of its results; Watch repeats an unresolved search until expiry; Saved is memory. These are variations of one interaction, not separate products.

The shared primitive is **Intent → search horizon or supplied candidate times → candidate intervals → inspect / choose / watch**. Search and comparison both lead to a timing decision.

**A person should be able to receive the first meaningful timing result before encountering any concept unique to Compass's internal ontology.** The first answer presents times and a plain explanation. Support level, convergence, suitability, establishing families, Stars, Bearings, rhythm, and tide character must not become concepts someone has to learn first. Evidence belongs beneath **Why this?**, while material qualifications remain visible in ordinary language.

The proposed core is not a comprehensive life-management system, an astrology encyclopedia, a universal good-day score, or a guarantee that an activity will go well. Guiding Stars, habits, tasks, projects, Bearings, and Log remain available as an optional workspace. The timing instrument should earn someone's interest before asking to hold more of their life.

The owner has ratified this reorientation and narrowed its implementation sequence to Phase 0 → A → A.5 → B → C. This revision records that decision; it does not implement the redesign or ratify a new name, price, or scoring rule. Earlier owner decisions explain how the current product developed. They do not override the owner's present request to reconsider it.

In particular, “timing is secondary to doing the thing” remains a useful behavioral commitment: a timing result must not become permission to live. It does not require the product's default interface to be a task manager. Likewise, wanting a personal home base and wanting newcomers to start with a single timing query are compatible at different depths of use.

## 2. Current-state diagnosis and evidence

Repository inspected at HEAD `180b9bc`, following the feature batch through `8056de4`. This is source and document inspection, not a fresh runtime rehearsal. Historical beta results below are dated evidence, not claims that every issue remains open today.

The app has substantial timing capability, but its entry points split the same user's question across Home, Plan, Calendar, activity pickers, and the Almanac. The default shell exposes Home, Calendar, Stars, and Plan, with Log optional. Home's `lines-up` route reads held inventory. That helps someone already using Compass as a workspace, but a new visitor asking about Saturday has no inventory to contribute.

The recent work strengthens the proposed direction in several places:

| Evidence | Implication |
| --- | --- |
| `6438a39`, “Find a good time reads real evidence now, not a curve one lens removed” | Preserve canonical evidence in the new presentation. |
| `626a72e`, “best-times stops claiming activity authority; Planner loses its brain” | Do not revive secondary scoring through a new wave graph. |
| `8056de4`, custom activities | The catalogue can expand without demanding a task or Star. Custom-rule coverage still differs by route. |
| `eb9a81b`, Almanac/location work; `725c4b2`, Day and draggable blocks | Useful downstream components, not reasons to make Calendar the entrance. |
| `c82e5e6` and `0183b42`, first-run simplification | The repo has repeatedly found that questions before value become onboarding friction. |
| `BETA-REHEARSAL-2026-08-24.md` | Fresh-account rehearsal passed 14/21 steps, with real calendar and cross-device gaps. Its loop primarily measured workspace adoption. |

The prior agent report's conclusion that scheduling was “rejected as the center every time” overstates the evidence. Several documents are proposals by assistants; several owner statements address productivity friction or holism rather than a veto on timing. The useful historical finding is that forward timing repeatedly proved interesting while the default experience kept expanding around daily organization.

The month simulation in `USER-SIMULATIONS-2026-07-29-MONTH.md` is hypothesis-generating material. Its fictional users and conversion counts must not be presented as measured customer demand.

### What exists, and what does not

* Ordinary activity windows: `routes/elections.ts`, `computeElections`, and `evaluateActivityInterval` in `lib/electionEngine.ts`.
* Strict inception elections: separate `routes/election.ts` and `lib/inceptionElection.ts`.
* Long-session candidates: `lib/longSession.ts`, `dayTimeline.ts`, and `sessionNarration.ts`.
* Activity browsing and matching: `activityCorrespondences.ts`, `/elections/activities`, `/elections/match`, and custom activities.
* Saved scheduled blocks: `planning_windows`, which permits null goal/project references.
* Calendar availability: Google integration and `calendarCommitments.ts`; ordinary `/elections/times` does not itself check busy time.
* Push transport: `routes/push.ts`, `push_subscriptions`, `lib/notifier.ts`, and `public/sw.js`.
* No activity-specific persisted Watch model was found in the inspected schemas/routes. Existing “watch planets” preferences are different.
* The notifier has an in-memory deduplication set and a periodic tick. This is insufficient as a durable Watch delivery ledger across restarts or multiple workers.
* Existing `intentions` are New Moon cycle intentions. Reusing that name/table for arbitrary timing requests would combine different lifecycles.
* No native widget implementation was established by this review. Widgets are a future surface, not a capability this spec assumes exists.

## 3. Primary objects and persistence

| Object | Product meaning | Existing mapping / proposed addition |
| --- | --- | --- |
| Intent | A thing the person wants to time, with optional duration and practical constraints. It can exist for one search only. | Reuse canonical activity keys and a transient structured query in Phase A. Durable Intent persistence starts in Phase B; never create a task or reuse New Moon `intentions` merely to search. |
| Wave | An activity-specific interval supported by the canonical timing engine, with its qualifications and evidence. | Presentation vocabulary for existing `ElectionWindow` / `ActivityAssessment` and assessed session results. No `Wave` domain type or wave table. |
| Watch | Permission to keep checking one unresolved Intent against explicit thresholds until a fixed expiry. | New `timing_watches`, referencing a saved Intent. Requires durable scan and notification state. |
| Chosen window | A particular start/end the user has committed to in Compass. | Reuse `planning_windows` with enough structured provenance to reconstruct the query and evaluated interval; no durable Intent foreign key required in Phase A. |
| Calendar booking | An external calendar action taken for a chosen window. | Track separately from the local block; export offered and external booking confirmed are different states. |
| Personal/life context | Optional location, natal information, availability, and workspace references. | Reuse profiles, charts, Google integration, goals/tasks/habits. Do not copy these inventories into the core model. |

### Persistence by phase

**Implement the semantic object immediately; implement the database object only when persistence requires it.** Phase A keeps the structured query in client state, using URL state only for non-sensitive fields where appropriate. Private wording should not leak into browser history, referrers, or analytics. Chosen windows persist through `planning_windows` with a structured provenance snapshot, including activity, duration, horizon, applied constraints, and evidence. No `timing_intents` table is required for that.

Saved searches are not in Phase A. If an explicit prototype need emerges, a minimal `saved_timing_queries` record is an option to review, not an automatic addition. Phase B introduces the durable Intent → Watch relationship.

### Suggested Phase B records

These are proposed contracts, not a migration ready to execute.

`timing_intents`: id, owner/tester id, user wording, resolved activity key and activity-rule version, query kind (`activity` or `inception`), optional duration, absolute horizon start/end, IANA timezone, allowed weekdays/time ranges, location policy, calendar-check preference, natal-use preference, optional source reference, created/updated timestamps. In Phase B, persist on Save or Watch; a chosen-window provenance snapshot alone does not require this record. Transient searches need no durable personal text.

Source references may identify a task, habit, or Star. The Intent remains usable if that source is later removed, with its source link cleared. Editing the source does not silently change the saved Watch's meaning: offer an explicit update.

`timing_watches`: id, intent id, owner, status (`active`, `paused`, `fulfilled`, `expired`, `cancelled`), minimum support, accepted suitability, notification lead time, quiet hours, channel consent, next scan due, last successful scan, last scan outcome, expiry, version. A matched Watch remains active until a choice fulfills it, expiry occurs, or the person stops it.

`timing_watch_deliveries`: watch id/version, candidate fingerprint, delivery purpose, scheduled time, attempt state, sent time, provider outcome. Enforce uniqueness on the logical delivery. Persist scan claims/leases so two workers cannot independently process the same job. Push networks cannot promise exactly-once display, but server retries must not knowingly generate duplicate logical alerts.

A choice provenance record holds the planning-window id, structured query snapshot, engine/rule version, evaluated bounds, evidence snapshot, and context freshness. An optional durable intent id can be added in Phase B. Keep calendar state (`not_requested`, `export_offered`, `confirmed`, `failed`) separate. A downloaded file cannot prove that the user imported an event.

New owner-scoped tables must participate in account deletion and export. The existing deletion code discovers schema tables with `tester_id` at runtime; schema changes must reach scratch, auth-test, and deletion-test databases before the push gate. Production migration remains a separate authorized operation.

## 4. Wave semantics and authority

“Wave” is presentation vocabulary, not a new domain type. The engine keeps `ElectionWindow` / `ActivityAssessment`; the product says opening or wave; the visualization draws intervals. Prefer **opening** in first-layer copy so a later vocabulary change does not require a data-model rewrite.

A wave is a returned opening for a resolved activity within a requested horizon. It is not a sine curve drawn to suggest continuous energy. Its bounds and evidence come from existing calculations. “Supported opening” and “convergent opening” are useful internal distinctions; plain labels must be checked with users before they become permanent vocabulary.

Preserve two independent axes:

* `supportLevel`: `supported` or `convergent`, describing independent agreement.
* `suitability`: `clear`, `qualified`, or `defer`, describing the engine's objections for the matter being considered.

Convergence does not erase a qualification. `clear` does not mean safe, certain, or free of every possible objection. The narrower `noObjections` field means the engine recorded none among the reasons it checks.

`supportLevelFrom` currently establishes convergence from at least two establishing families, or one establishing family plus at least two reinforcing families. Call the canonical function; do not reproduce that logic in clients or the Watch worker. Preserve the distinction between `establishingFamilies`, `reinforcingFamilies`, and `stackedHourMoon`. A matching hour sharpening a lunar window does not automatically constitute convergence.

The return value `supported` alone is not proof that an arbitrary interval has positive support: the helper's fallback is `supported`. For newly adapted session intervals, carry actual testimony and eligibility from the engine, rather than manufacturing a wave from the enum. Empty evidence cannot earn a promotional label.

### Result envelope

Every result should identify:

| Field | Meaning |
| --- | --- |
| Intent interpretation | Activity, duration, mode, horizon, timezone, and constraints as applied. |
| Source and version | Canonical engine path, activity-rule version, computed timestamp. |
| Window bounds | UTC instants plus display timezone; broad all-day conditions remain labeled broad. |
| Support | Canonical support level, family roles, structured evidence. |
| Suitability | Canonical verdict and named reasons, visible beside support. |
| Session structure | Requested/actual duration, anchor, transitions, arc, and any shortfall. |
| Availability | `unchecked`, `clear`, `conflict`, or `unavailable`, with consulted sources and freshness. |
| Personal reinforcement | Chart available, chart actually used, per-window personal evidence, birth-time limitations. |
| Coverage | Requested span versus successfully scanned span; partial/error is distinct from no match. |

Do not copy a one-hour peak's convergence onto an entire three-hour session. The long-session route currently returns suitability and structure but does not expose the full ordinary-window evidence envelope. Extend that output by passing through canonical interval assessment and any anchor-specific evidence, explicitly scoped to the interval it describes. Do not add a new long-session support formula.

Practical availability filters viable choices; it does not change astrology. If clipping a wave around a meeting changes the proposed interval, reassess that interval through the canonical evaluator. Never advertise an interrupted period as three hours free. If calendar retrieval fails, report availability as unavailable, not clear.

Use the existing engine's ordering and session tradeoffs. Present a few distinct alternatives such as earliest workable and best uninterrupted. Do not invent a blended score combining support, availability, and natal testimony. Explain a qualification directly; show deferred results only as explained excluded candidates or user-requested inspection, never as recommended windows.

### Ordinary activity and inception

The default question concerns an activity: training, writing, a conversation, or spending time together. The separate strict inception path asks about beginning something with an enduring identity and retains its own rules, verdicts, and provenance. An activity's existing `modeOf` can already be inception-sensitive; that does not mean every such activity should invoke `/election/scan`.

The parser must preserve this distinction. Before the Phase A beta, add a reviewed ordinary relationship correspondence such as `romantic-time` alongside inception-sensitive `first-date`; the final key and its rules need explicit catalogue review. Do not copy or weaken first-date rules to fill this gap. Wording such as ‘date night with my wife’ should resolve directly to ordinary relationship time, while ‘first date with someone Saturday’ resolves to `first-date`. Clarify only genuinely ambiguous requests. An unmatched request must not be forced into strict election because it sounds important.

## 5. Default information architecture

The Phase A homepage contains the timing input and quick examples, with almost no product navigation. It has no separate Now, Ahead, or Saved destinations. After submission, **List · Week** changes the presentation of the same results; Month can follow later. No separate Look ahead button appears on the empty screen.

The header keeps Compass and a small account/settings menu with a **Workspace** door. Workspace users may keep their existing default landing experience. Desktop follows the same hierarchy without restoring the astrology rail.

Now is an activity query with the horizon starting now. A contextual shortcut can use the current activity; without one, it asks what the person wants to time. It must not open a generic recommendation feed in Phase A.

In Phase B, active Watches may appear beneath the query for returning users. Saved then holds unresolved searches and chosen windows, with clear status. Saving does not activate monitoring; Watching does not book a time; choosing does not confirm external calendar creation. Do not display a Watching section before a real Watch worker exists.

Stable links to individual Watches/choices become necessary for Phase B notifications. The existing state-based navigation needs a small addressable entry path that survives sign-in and reload; this does not require rewriting every legacy route or adding top-level navigation in Phase A.

## 6. Thinnest homepage and activity input

Draft interface copy, subject to review:

* Main prompt: **What are you trying to time?**
* Input example: **A three-hour writing session this weekend**
* Quick examples: **Workout**, **Date**, **Deep work**, **Conversation**.
* Optional contextual shortcut: **Is now good for this?**, using the supplied activity. No generic discovery, Look ahead, or Saved button on the empty Phase A screen.

Examples are invitations, not claims that those activities are favored today. Selecting one supplies an Intent. No natal chart, task import, working-rhythm questionnaire, or Star creation precedes the first answer.

Natural language is the primary input. Resolve “a 3-hour deep work session sometime this weekend” into `deep-work`, 180 minutes, the local weekend's absolute bounds, and any supplied time restrictions. Show those as editable interpretation controls above the results. Resolve relative dates in the user's IANA timezone; store absolute dates when saved. An existing Watch for “this weekend” must not roll forward next Monday.

Use `matchActivity`/`rankActivities` as grounding and `parseWhen.ts` as date-parsing precedent. Neither is a complete duration-and-horizon parser. Add a validated parser/orchestrator that can use language understanding to propose structured fields but cannot generate timing claims or new correspondences. Do not turn its matching score into an invented statistical confidence percentage.

Ask only when a missing or ambiguous fact materially changes the answer: activity correspondence, first versus recurring date, an unclear date range, or duration before reserving a precise session. Otherwise offer explicit editable defaults, such as the coming seven days. Never infer the location from a timezone and claim it is known.

A saved arbitrary activity requires a supported correspondence. Custom activity creation already exists, but `/elections/match` only calls the built-in matcher and the inspected long-session route does not load custom activity rules. The adapter must propagate supported custom rules consistently or explicitly say that duration search for that activity is not yet available. Do not silently substitute another activity.

## 7. Core journeys

### Find a time: first value

The visitor enters a request, sees its interpretation, and receives a short list with duration, support, qualifications, and evidence. They can change the horizon or inspect the timeline without restarting. The eventual public flow requests identity only when saving or monitoring needs it, retaining the query through that transition. Phase A may use existing beta accounts; anonymous access is not a prerequisite.

| Request | Flow and necessary distinctions |
| --- | --- |
| A workout tomorrow | Match the intended workout; hard training and gentle movement are different correspondences. Return timed openings without requiring a fitness habit. Ask duration when a specific session is chosen if absent. |
| A date in the next two weeks | Use the reviewed ordinary relationship correspondence for explicit partner/date-night wording and `first-date` for explicit first meetings; clarify only ambiguous wording. Show alternatives across the horizon, with practical evening constraints editable. No partner chart required. |
| Three hours of deep work this weekend | Scan local Saturday/Sunday with the existing long-session finder. Show full-duration options and internal structure; if only two hours fit, label the shortfall and ask before shortening. |
| A difficult conversation | Resolve `hard-conversation`; explain relevant qualifications without suggesting a good outcome is assured. The person can choose a workable interval or Watch without creating a relationship project. |
| A psychedelic journey this month | No dedicated built-in correspondence was found by the targeted catalogue search. Do not substitute meditation, travel, or a generic intense activity. The Phase A prototype retains this as an unsupported-mapping test case rather than making a new psychedelic correspondence a release requirement. A later supported path needs duration and the person's own practical constraints, and must describe astrological conditions without calling them safe or assessing medical suitability. |

These journeys are intended product coverage. The unsupported journey is an explicit prototype limitation and a beta finding to collect, not a fabricated result to make the demo look complete.

### Now

Phase A supports **Is now good for X?** through the same activity search, with a horizon from now through the next few hours. The user supplies the activity. Phase B may also answer whether any activity they are watching has an opening now.

Generic “What is now good for?” discovery is deferred. Scanning a catalogue, ranking unlike activities, and choosing which suggestions deserve attention introduce decisions unnecessary to the first experiment. Neither `/elections/rare-today` nor a prominent planet should supply unsolicited activities in Phase A.

### Compare times (Phase A.5)

A person may already have candidates: Saturday or Sunday, tonight or tomorrow, Thursday afternoon versus Friday morning, or three particular dates. Accept one activity plus those intervals and assess each through the same canonical path. Preserve duration, timezone, location, and availability assumptions across candidates; clarify underspecified periods only when needed.

Present the candidates side by side with reasons and qualifications, then Choose. Do not force a winner when evidence is equivalent or mixed. Whole days remain broad readings unless the person asks for a session within them. No separate comparison score or generic ranking of dates is allowed. Comparison is a core product capability, sequenced after Phase A so its interface does not delay testing search.

### Look ahead

The user continues their query and switches from List to Week in Phase A, with Month deferred. Tapping an opening reveals the same evidence and Choose/Watch actions as the list. Changing activity recomputes the view and retains practical constraints where applicable.

### Watch and return (Phase B)

After results, a person can ask Compass to keep checking the unresolved Intent. The confirmation shows the exact period, duration, accepted strength, availability policy, and notification timing. On returning, Home shows relevant active Watches and their next matches beneath the query. Paused, expired, and failed scans remain legible in Saved.

### Choose and calendar

Choose fixes a start/end and saves a standalone `planning_window`. Revalidate the selected interval and practical availability before saving; if it changed, show the change for a fresh choice. Add a request idempotency key because taskless saves currently insert a new row each time.

Offer calendar export after local save. Existing iCal export/feed is useful infrastructure; a one-event export may need a small extension. The inspected Google routes read events/busy time and OAuth state, but do not expose event creation. Do not label a local save “booked in Google.” Direct Google writing, if desired later, needs a separate reviewed integration, scopes, provider event identifiers, and retry handling.

Neither a new better window nor a Watch automatically moves an already chosen block. A calendar conflict discovered later can be surfaced without rescheduling it.

## 8. Honest look-ahead visualization

Use an activity-specific interval timeline before a continuous curve. In week view, each day has a time axis with bounded openings; month view compresses each day's openings into small interval marks and expands on selection. Labels and patterns carry meaning without relying on color.

* Mark supported versus convergent openings with distinct intensity or symbols and text.
* Add a separate qualification marker; do not conceal it in a blended color.
* Show calendar conflicts as a separate overlay. Unchecked availability is visibly different from confirmed free time.
* Render broad all-day background separately from exact windows. Do not turn an all-day Moon-sign prior into an exact peak.
* Show a long session as its whole duration with anchor and internal transitions; identify where support is concentrated.
* Empty days stay empty. Distinguish no qualifying opening, not scanned, and failed scan.

Overlapping windows may be grouped visually, but retain evidence boundaries when reasons change. No interpolation through unsampled time, no universal quality-of-day curve, and no summing unrelated activities into one “best day.” If “wave” needs a graphic crest to be understandable, test that as visual language only after its plotted quantity has a defensible definition.

Reuse interaction and data-handling patterns from `ActivityWeek.tsx` and `ElectionPicker.tsx`; do not inherit generic `QualityStrip` values as activity judgments.

## 9. Watch behavior, first version

Example: **Keep an eye out for a three-hour writing window in the next ten days.**

The Watch saves a fixed ten-day horizon, 180-minute duration, resolved writing activity, timezone, explicit availability policy, and threshold. The v1 default threshold remains unresolved. Test explicit choices: **Only exceptional openings** maps to `convergent + clear`; **Good usable openings too** includes `supported + clear` as well. These labels describe evidence thresholds, not outcome guarantees. Qualified windows require separate explicit inclusion. Do not invent a “strong supported” grade based on an unreviewed evidence-strength rule. The owner's reported roughly 15% convergence frequency is a hypothesis to remeasure by activity, not a fresh finding of this review; sparse or uneven results may make default silence costly. Deferred windows never trigger an opportunity alert. These are product filters on canonical fields, not new astrological grades.

Scan immediately when created. If a qualifying window is already known, show it now rather than withholding it to manufacture a future notification. The value of monitoring is remembering the intention, rechecking practical context, and reminding at an actionable lead time; much of the astronomical forecast is knowable on the first search.

For v1, scan active Watches daily and after user edits or known availability changes, with a final revalidation before notification. Use bounded batches, shared ephemeris work, and backoff on failures. Do not run a month-long election search inside the existing minute notifier tick.

Proposed alert default: one reminder approximately 24 hours before the earliest qualifying candidate, at most one opportunity alert per Watch per day. If created within that lead time, offer a one-time alert now. If quiet hours would delay the message past usefulness, send earlier within permitted hours or skip it; never deliver an expired opportunity as current. Do not notify again for the same candidate unless the user explicitly requests another reminder. After rejection, suppress that candidate and offer the next qualifying alternative.

At expiry, retain the Intent and mark the Watch expired. If scans completed and found nothing, show “No matching window found in this period.” If scanning failed or was partial, report that instead. Offer to extend or change the threshold, but never extend silently or weaken the minimum to guarantee a match. An optional expiry summary can be offered; no-window days do not generate daily pushes.

The worker must check current Watch version, status, consent, expiry, entitlement, and candidate validity at send time. Cancelling, choosing, pausing, or deleting the account cancels pending deliveries. Connection failure produces an availability-unavailable state; it cannot satisfy an availability-required Watch.

## 10. Notifications and widgets

Notifications require explicit channel permission attached to a visible Watch or chosen-window reminder. Enabling Watches must not enroll the user in existing morning/evening rituals, planetary-hour shifts, or generic high-quality alerts. Those remain independent workspace preferences. Audit the current notifier's actual preference enforcement before sharing its transport.

Notify about an identified activity, interval, and canonical reason; never imply that a conversation will resolve, a date will succeed, or a journey will be safe. If a qualified window is allowed, the qualification must remain accessible and the short message must not present it as unconditionally favorable.

Prototype message template: **A window matching your writing Watch starts tomorrow at 3:20 PM.** This is illustrative copy, not a forecast. Default lock-screen text should be generic for private Intent wording: **A window matching your Watch is coming up.** Let the person opt into descriptive previews.

Push opens the exact Watch or chosen window, preserving destination through authentication. On open, distinguish the original notification's evidence from the latest read if conditions or availability changed.

Potential widgets use the same result envelope: current support for a selected activity, or the next saved relevant opening. An end time such as 10:42 must come from an actual computed boundary; “strong” must mean the defined support threshold. Include freshness and expire stale current claims. A widget must not keep saying “Now” after its source interval ends.

Native widget delivery and platform-specific refresh behavior are later feasibility work. Validate them against current platform documentation at implementation time. The first beta can test the content and return path with the web interface and existing push transport; it cannot claim to validate native widget retention.

## 11. Contextual personalization and onboarding

First-use success is a timing result. Obtain timezone from the device with a correction control. Offer location when it can add local planetary hours or angles; without it, retain the universal evidence and make omitted local context visible. Require genuine location for strict/local calculations rather than accepting the strict route's current coordinate defaults as the user's place.

Return the astrological results before requesting Calendar access. Then offer **Check against my calendar**. When enabled, show the check's progress and let conflicts fall away or carry **Busy then**; failed checks remain unavailable, never clear. This is a second stage of the same results view, not a signup prerequisite. Do not promise instant calculations without measuring latency.

After results, ask **Want to rule out times when you're busy?** only when availability matters. Offer chart inclusion through **Want to include your chart in the reading?** Explain what was added after inclusion. No chart is a complete supported state; chart available and personal evidence in this window are separate facts.

Waking/free hours belong at a duration or Watch constraint step when needed. Show assumptions explicitly and let people search outside them. Do not require birth time or working-style choices to answer a query. Preserve unknown-birth-time limitations instead of constructing house testimony from a substituted noon.

A public chartless query before signup is the preferred target, but current app/account guards need an explicit bounded search path and rate limits. Do not weaken existing session protections to imitate anonymous access. If the first controlled prototype needs beta accounts, record account setup as a test constraint and do not call it a validated no-signup journey.

## 12. Relationship to the existing workspace

Workspace remains available from the account menu, with an optional default-landing preference. Do not label it Advanced or imply it is a more intellectually sophisticated Pro interface; it represents additional life context. It keeps Stars, tasks, habits, projects, Log, Bearings, and the full Calendar. Existing data and ordinary tracking continue to work independently of timing.

A Star can contribute a concrete next step to an Intent. An unscheduled task can gain a Watch after activity/duration resolution. A habit can receive an opt-in timing reminder without changing its cadence or marking it done. Whole-inventory monitoring is later advanced functionality and requires explicit scope and an aggregate notification budget; it must not silently create dozens of Watches on activation.

| Current surface | Action | Proposed destination / reason |
| --- | --- | --- |
| Home dashboard and held-work lists | Move | Workspace Home; new default Home begins with a timing query. |
| Desktop astrology rail | Hide by default | Workspace or an explicit sky-details view. |
| Plan activity timing | Move / keep | Primary query/results flow; reuse engine and evidence components. |
| Plan strict Pick a Day | Keep, contextual | Explicit inception mode; preserve distinct rule system. |
| Calendar Agenda/Day/Week/Month | Keep | Workspace Calendar and chosen-window review; not mandatory onboarding. |
| Almanac activity timing | Move | Activity-specific Look ahead. |
| Almanac sky/reference content | Keep, contextual | Evidence exploration and Workspace. |
| Universal quality curve | Retire later from core | Never use as an activity-specific wave; retain only where its own meaning is explicit. |
| Guiding Stars, tasks, habits, projects | Keep / hide by default | Optional Workspace; selected items can feed Intents. |
| Bearings, working rhythm | Move | Optional personal/workspace context. |
| Log, daily review, check-ins | Keep / hide by default | Workspace; no default engagement obligation. |
| Ask | Keep, contextual | Explain results or refine Intent; not a competing timing authority. |
| Global task capture | Move | Workspace; core input captures an Intent. |
| Planet reference and Sky Itself | Keep, contextual | Evidence details and voluntary exploration. |
| Generic daily/sky notifications | Hide from core opt-in | Separate existing preferences; Watch consent does not enable them. |
| Competing timing navigation labels | Retire later | Consolidate after proving new flow, without deleting underlying features. |

## 13. Pricing implications

The old “free answers now; paid answers when” line blocks the new core promise if interpreted literally. A newcomer needs to try a real future query to discover the product's value.

Proposed experiment, not a price decision:

| Free experience | Paid possibilities |
| --- | --- |
| Now, a limited number of useful future searches, a meaningful short horizon, full evidence, saved choices, export | Longer horizons, persistent Watches and alerts, repeated calendar-aware scanning, long-session searches, strict inception tools, workspace orchestration |

Allow at least one duration search in Phase A and a Watch trial in Phase B when monitoring exists. Avoid aggressively gating one-off calendar collision checks: they help prove a result is usable. The subscription hypothesis is delegated attention, with Compass repeatedly looking while the person is away. Do not require payment to explain why a recommended time was offered. Personal natal timing is optional enrichment, not the default paywall.

`entitlements.ts` is the authority, with existing keys including `horizon.week`, `sessions.long`, `placement.calendar`, and `elections.strict`. The inspected `/elections/times` and `/election/scan` handlers do not themselves show equivalent guards despite those declared feature keys. Before changing pricing, audit enforcement across the adapter and existing callers; feature declarations are not proof of route coverage.

On downgrade, chosen windows and saved Intents remain readable/exportable. Paid scanning can pause with an explanation and pending alerts cancelled. Do not delete Watches or data. Resolve allowances and trial framing after observing actual search and Watch use; the old trial rationale centered on daily reviews and habit cycles that are no longer prerequisites.

## 14. Beta hypothesis and measurement

Primary question: **Will people bring real things they want to do and use astrological timing to make a concrete timing decision?**

The two primary measures are:

* **Query → decision rate:** among real supported queries with successfully returned results, the fraction leading to a chosen/saved window or export, and in Phase B a Watch. Count each query once; report each action separately so an export is not mistaken for confirmed booking. Report unsupported requests, failures, and no-result searches alongside this denominator rather than hiding them.
* **Repeat-intent rate:** the fraction of people who later return with another distinct real intention, measured over mature 7/30-day cohorts. Editing or rerunning the same query does not count as another Intent. A different activity is a useful signal but not required: a new writing session can be a new real intention. Ask a lightweight research question where distinctness cannot be inferred without collecting private text.

Measure behavior separately from astrological outcome claims. Selecting Thursday proves a timing decision, not that astrology caused a better Thursday.

| Event / measure | What it can teach |
| --- | --- |
| `unsupported_activity_requested` | Count reviewed activity-gap categories, without storing raw private wording by default. Manually review recurring gaps; explicit research consent is needed for wording samples. |
| First query submitted and interpreted | Can a newcomer express the job? Track unresolved matches separately. |
| First valid result and time to result | Does useful evidence arrive before onboarding or latency loses them? |
| Interpretation corrected | Where matching, duration, horizon, or mode misunderstood the user. |
| Wave inspected / evidence opened | Whether people understand the comparison and seek its basis. |
| Wave chosen | Whether a result changes a concrete decision. |
| Calendar export offered / confirmed external booking | Keep these separate; export is not proof of booking. |
| Watch created / first successful scan / match found | Whether unresolved intentions support return use. |
| Push attempted / accepted / opened | Delivery acceptance is not guaranteed display; opens need an attributable link. |
| Second distinct query | Stronger evidence of recurring need than a homepage reload. |
| Repeat query within 7 / 30 days | Cohort measures allowing irregular use; report cohort maturity and sample size. |
| Rejected window and optional reason | Separate practical clash, unsuitable reading, irrelevant activity, and preference. |
| No match / partial scan / error | Distinguish honest scarcity from broken service. |
| Watch cancelled, expired, notification muted | Whether monitoring feels useful or burdensome. |

Use query ids to deduplicate retries. Collect structured categories and timings rather than raw private Intent text by default. Compare chartless and chart-using journeys, but do not require charts for a successful cohort. Ask a small interview sample what they would have done without the app and whether the choice remained useful.

Do not use DAU or completion streaks as the primary success criterion. A strong early signal is repeated real queries plus chosen windows or voluntarily retained Watches. If users enjoy readings but do not choose, save, or return with another real question, the thesis remains unproven. If they choose quickly but never need monitoring, keep the search product and reconsider Watches as the central retention model.

Do not invent numeric success targets from simulated personas. Establish first-cohort baselines and decide thresholds with the owner before the beta experiment begins.

## 15. Migration and smallest implementation

### Phase 0: timing search service

No new UI, Wave domain model, durable Intent, or Watch. Build one service accepting activity, start/end, IANA timezone, optional duration, location, calendar context, and natal context. Normalize ordinary-window and long-session results into a discriminated envelope that preserves their different evidence and coverage. The service validates, loads context, orchestrates, and passes through judgments; it does not score.

Reuse `computeElections`, `evaluateActivityInterval`, `findLongSessions`, and `calendarCommitments`. Add fixed-time fixtures for range boundaries, duration, missing context, qualifications, and parity with existing canonical callers.

The ordinary HTTP endpoint currently exposes day/week/month without passing a caller-supplied start. The underlying `computeElections` already accepts `startAt`. Use it through shared services to compose bounded ranges and filter exact requested dates. Do not mutate the process clock or silently widen the horizon.

Long-session scanning accepts a specific day, minutes, timezone, waking hours, and commitments. Aggregate per-day assessments with bounded cost and existing tradeoff ordering. Its route does not pass natal/custom context as the ordinary route does; preserve that limitation until compatible canonical support is available. Return applied/omitted context explicitly and never claim personal reinforcement from a chart the calculation did not use.

A thin `/api/timing/search` adapter may expose this service. This is a proposed route, not an existing one. Strict inception remains a distinct result/engine path and need not be integrated into the Phase A interface.

### Phase A: query → interpretation → results → choose

Feature-flag a small shell alongside Workspace. Test with 5–10 people using existing beta access. Public signup, anonymous access, notifications, widgets, Stars, and rebranding are not prerequisites.

| State | Existing foundation | New work |
| --- | --- | --- |
| Query / interpretation | `/api/elections/activities`, matching/ranking functions, `parseWhen.ts` precedent | Validated activity/duration/horizon parsing; editable interpretation; transient client state. |
| Results | Phase 0 service, `ActivityWeek`, `ElectionPicker`, canonical evidence | Compact list/week toggle, Why this?, unsupported state, optional post-result Calendar check. |
| Choose / confirmation | `/api/planning/windows`, existing Calendar/export | Standalone choice with structured query/evidence provenance, retry idempotency, accurate local-save/export status. |

Use the smallest structured provenance storage that can reconstruct the choice; do not create a durable Intent database object merely to save a block. Saved searches and Watches are excluded. Existing saved blocks can remain accessible through Workspace Calendar.

Before the beta, review and implement the ordinary date-night versus first-date correspondence distinction, including matcher examples and tests. Do not require an ontology interview for unambiguous partner wording. Keep psychedelic timing as an explicit unsupported example and instrument correspondence gaps.

Phase A must include an actual duration query and a useful short future horizon, so it tests planning ahead. Its learning question is whether people bring an activity and use the results to choose a time. Implementing optional features because the old app already has them is not part of this scope.

### Phase A.5: compare supplied times

Add candidate-interval input and a compact comparison view using the same service/evaluator. Show tradeoffs, ties, and qualifications without adding a score. Comparison is part of the product thesis but follows the initial search experiment.

### Phase B: Saved + Watches

Proceed after people are selecting windows. Introduce durable Intent storage, Saved, Watch persistence, expiry, bounded repeat scans, durable candidate/delivery deduplication, notifications, and exact return links. Reuse push transport after auditing consent and preference behavior. Let the first cohort explicitly select support thresholds; do not preselect an unvalidated convergence-only default.

Test while the app is closed, including worker restart, cancellation, expiry, quiet hours, and unavailable calendar context. This phase asks whether people want to delegate remembering and rechecking an intention. Phase A provides no evidence about that promise by itself.

### Phase C: Workspace integration

Allow selected tasks, Star steps, and practices to feed the same timing requests and Watches. Preserve the progression from a single query to a saved intention, calendar-aware monitoring, and finally optional whole-inventory context. No automatic inventory import or mass Watch activation.

Broader month visualization, generic Now discovery, and native widgets are separate later decisions; none is an automatic Phase C requirement. Keep Compass on the prototype and test what users think it does before considering a rename.

### Required verification before a beta release

For Phase 0/A, verify a chartless query without workspace setup; corrected natural-language interpretation; ordinary versus first-date correspondence; canonical parity across list/week; honest unsupported, empty, and partial states; long-session shortfalls; calendar failure versus free time; and idempotent taskless choices. Verify strict routing when that entry is added. Phase A.5 adds comparison parity; Phase B adds Watch parity and notification destination restoration after sign-in.

Use fixed-time engine fixtures and run date/time tests in America/Chicago, Asia/Kolkata, and UTC, including DST transitions and unknown location. Measure scan latency and bounded work for concurrent multi-day searches instead of assuming a per-day route is cheap to fan out. Existing expensive strict scans must not block every Watch scan on a minute timer.

Repeat the relevant real-account/calendar beta rehearsal. Source inspection and the old 14/21 rehearsal do not establish current end-to-end readiness. Production API startup/migration rules in AGENTS.md remain unchanged.

## 16. Branding implications

The repo records Tides as cosmic weather, Auspice as the favorable-moment name, and Compass as orientation. `DESIGN.md` dates the Auspice rebrand to July 15. Commit `ca294a2` explicitly explains the later Compass choice: “what do I do now,” steering by one's stars, daily loop plus advisor, and the navigation metaphor. Auspice then became the timing engine's name and the prior Compass advisor became Ask.

That history matters because the new proposal makes future timing and irregular visits central. Daily orientation is now one job among several. North Stars and Bearings can no longer be assumptions about the user's first session. The name Compass does not force a task manager, but its surrounding vocabulary and brand brief have encouraged a life-navigation architecture. The bias is in the complete system of names, hierarchy, and onboarding, not solely the wordmark.

Keep Compass during prototype testing. It still fits a useful instrument and provides continuity. Test whether users can explain its new purpose after one query before paying the cost of another rename. A future name should:

* Suggest timing or openings without promising favorable outcomes.
* Accommodate Now, future searches, and quiet waiting between visits.
* Make sense without Stars, a chart, or a daily practice.
* Work for pleasure, rest, conversation, and effort equally well.
* Be easy to say, spell, and recognize at app-icon size.
* Support plain language around “find a time” and “watch for this.”
* Avoid forcing watery jargon into labels or implying there is one universal tide for everyone.
* Pass later domain, trademark, app-store, and cross-language checks; no availability claims are made here.

“Waves” is a useful product metaphor to test even if it never becomes the name. Tides risks suggesting a single periodic quantity; Auspice emphasizes favorable moments but needs a comprehension test; Compass carries continuity and orientation but may need a more explicit timing descriptor. These are criteria and tradeoffs, not a naming shortlist or decision.

## 17. Open decisions for review

### Settled in this review

* Find a time is the center; Now and Look ahead are variations of a search.
* Phase A tests only query, interpretation, results, and choice, with list/week, evidence, optional Calendar check, and unsupported handling.
* The homepage has no separate Now/Ahead/Saved navigation; generic discovery is deferred.
* Intent is semantic immediately and durable only when needed, normally Phase B. Wave remains presentation vocabulary.
* Ordinary date-night correspondence must be resolved before the beta; psychedelic timing stays an unsupported test case.
* Compare times is a core capability in Phase A.5. Saved and Watches follow observed window selection in Phase B.
* Workspace remains optional life context. Compass remains the prototype name.

### Still open

1. What exact reviewed rules and canonical key should represent ordinary romantic time? The separation is decided; the correspondence rules still need review.
2. Which explicit Watch threshold do users prefer, and how does match frequency vary by activity? No automatic “strong supported” rule is authorized.
3. What free search allowance and horizon demonstrate value? Avoid making one-off Calendar checks an aggressive paywall.
4. Does local window choice suffice for first value, or do users need export? Measure both without requiring direct Google event writing.
5. When should the public no-signup flow follow the controlled beta? Existing auth must remain intact.
6. For Phase B, fixed planning location is the proposed initial policy; changing it while travelling should be explicit.

Next implementation scope is Phase 0 followed by the narrow Phase A described above. This document revision contains no implementation. Evaluate the search experiment before building Saved, Watches, widgets, or broader integration.

## Revision record

Owner review on 2026-09-04 ratified the thesis and reduced the first experiment to activity → openings → choice. This revision removes saved-query persistence and generic Now discovery from Phase A, moves convergence thresholds back to an explicit unresolved choice, adds comparison, requires ordinary date-night coverage, and separates engine adaptation from interface work. Calendar checking follows results; technical ontology stays out of the first meaningful answer. No product code, schema, or legacy instructions were changed in this revision.

## Source map

Paths are relative to the repository root. These are the principal sources for this proposal, not an assertion that all historical claims were reverified live.

* `artifacts/tides/DESIGN.md`; `DESIGN-HANDOFF-COMPASS-BRAND.md`; `WORLDBOOK.md`; `THE-SPINE.md`.
* `artifacts/tides/STRATEGY-CONVERSATION-2026-08-01.md`; `HANDOFF-ONE-AUTHORITY-DECISION-2026-08-10.md`; `DECISION-PRICING-2026-08-19.md`.
* `BETA-REHEARSAL-2026-08-24.md`; `HANDOFF-2026-09-04-REORIENTATION.md`; commits cited in sections 2 and 16.
* `artifacts/tides/src/App.tsx`; `pages/Home.tsx`; `pages/Calendar.tsx`; `pages/Launch.tsx`; `components/ActivityWeek.tsx`; `components/ElectionPicker.tsx`; `lib/parseWhen.ts`; `public/sw.js`.
* `artifacts/api-server/src/routes/elections.ts`; `election.ts`; `planning.ts`; `googleCal.ts`; `push.ts`; `customActivities.ts`.
* `artifacts/api-server/src/lib/electionEngine.ts`; `inceptionElection.ts`; `activityCorrespondences.ts`; `longSession.ts`; `dayTimeline.ts`; `calendarCommitments.ts`; `notifier.ts`; `entitlements.ts`.
* `lib/db/src/schema/planning.ts`; `customActivities.ts`; `testerProfile.ts`.
