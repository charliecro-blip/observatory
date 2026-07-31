# Compass — the master backlog
> **New session? Read `HANDOFF.md` first**, then this file.
*Consolidated 2026-07-30. Every actionable item from the four studies and three
audits of 2026-07-29, in one place, deduplicated, with its source.*

**Sources.** `USER-SIMULATIONS-2026-07-29-MONTH.md` (12 personas × a full lunation) ·
`PAYING-PERSONAS-2026-07-29.md` (willingness-to-pay) · `COMPETITIVE-UX-2026-07-29.md`
+ `COMPETITIVE-UX-APPENDIX-onboarding-and-capture.md` · `PRICING-AND-MARKETING-2026-07-29.md` ·
plus three code audits run 2026-07-29 (structural, election-engine, second-pass).

**Status key:** ☐ open · ☑ done 2026-07-29/30 · ⏸ deliberately parked · 👤 owner action

---

## 0. Owner actions — nothing here is code

| | Item | Why it's blocking | Source |
|---|---|---|---|
| 👤 | **Set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` on Railway** | **UNBLOCKED 2026-07-30** — the longitude-as-timezone bug that would have delivered every ping at the wrong hour is fixed (it was 2h off for Austin). Push is built, wired, and now times correctly. | month §1 |
| 👤 | **Set `RESEND_API_KEY` + `EMAIL_FROM` on Railway** | Same for email reports. Composer, cron, opt-in all shipped. | month §1 |
| 👤 | **Set `ADMIN_TOKEN` on Railway** (`openssl rand -hex 24`) | Guards `/api/events/summary` and `/api/events/errors`. **Until it's set, both 404 in production** — deliberately closed, because they return crash messages and stack traces which can quote whatever was on the user's screen. Read them with `-H "x-admin-token: …"`. | 2026-07-30 |
| 👤 | **Confirm `GOOGLE_CAL_REDIRECT_URI` = `https://compass.day/api/integrations/google-cal/callback`** | Only ONE redirect URI is live at a time — registering both in Google Cloud doesn't make both work. | GCAL-SETUP |
| 👤 | **Decide: publish the Google OAuth app (unverified) vs keep in Testing** | Testing = 7-day token expiry, silent weekly disconnects. Console reportedly says "In production" — verify under Google Auth Platform → Audience. | month §9 |
| 👤 | Google OAuth **verification** (days–weeks) | Removes the "unverified app" wall. Only worth it before a wider launch — corporate Workspace blocks it outright, which caps the highest-paying personas. | paying §A1 |

---

## 1. Shipped 2026-07-29/30

☑ Privacy policy finished + served at `/privacy`, linked from Settings
☑ Onboarding copy corrected — claimed birth data was "private to your device" while posting it to the server
☑ **UTC day-rollover** fixed app-wide (`lib/dates.ts`) — habits un-checking at 8pm ET, journal emptying, felt rating resetting, reflections filing on the wrong day
☑ **False-success writes** — onboarding chart save, Settings chart edit (×2 forms), cycle tracking, task reflections, felt rating, journal, quick task adds, GuidingStars linked items
☑ **OpenAI client no longer crashes the whole server** at boot when unconfigured
☑ **Unguarded array queries** — `lib/jsonArray.ts`, 8 sites; any transient 429 was blanking the entire app via the single top-level ErrorBoundary
☑ **AI error messages** — `lib/aiError.ts`; a 429 was being reported as a connectivity failure, telling users to retry immediately
☑ Dark mode: `color-scheme` declared (fixes every native input at once)
☑ Three mobile-broken modals (Quick Capture, Calendar event, Momentum win/intention rows)
☑ "Switch profile" one-tap unrecoverable account wipe → confirm + shows recovery key
☑ `trust proxy`, `/account/recover` rate limit, 6 uncapped AI routes capped
☑ TodayHabits hardcoded to NYC → real viewer location
☑ **Election engine ×4**: Moon conjunction/opposition never detected · void-of-course blind across midnight · planetary hours wrong east of ~UTC+7 (Tokyo scans returned 2025 dates) · eclipse/retrograde gates frozen at scan start · (+ classical ruler check read only the primary house)
☑ Caution-planet questionnaire re-doored (was orphaned when Currents died)
☑ Push opt-in checks server config *before* asking for OS permission; banner self-hides when unconfigured
☑ **Habit cadence** — daily / most_days / weekly-N / occasional, rolling-7-day window, solar anchors on dailies, "N of M dailies today", cadence-aware morning chips + evening card
☑ **iCal export had never worked** (`push()` returns a number; `.filter` on it threw — route 500'd on every request since forever) → fixed, plus a live `webcal://` subscribe feed
☑ **Daily email rewritten around the reader** — the composer never imported `tasks`, so 0/30 simulated emails named a task or due date. Now: task named 23/30, median 229w→54w, unique subjects 12/30→30/30, consecutive dupes 16→0, discouraging star line 23/30→0, element self-contradiction 21/30→0. Plus the first email instrumentation (sent/open/click) and server-side `astroDetail` gating.

---

## 2. P0-A — the trust & authorization sprint (freeze feature work)

*Added 2026-07-30 after an external review. Verdict I agree with: the risk has
shifted from "dangerous integrity bugs" to "shipping clever improvements faster
than the trust/testing/authorization architecture can hold them." **Freeze
competitive borrowing until this block closes.***

| | Item | Detail | Status |
|---|---|---|---|
| ☑ | **Calendar feed leaked the account credential** | The webcal URL carried `?testerId=`, which IS the credential — and `middlewares/testerId.ts` accepts it as a **query param**. Verified live: that string alone returns the personal logbook, and `POST /account/sync` returns the **recovery code** = full account takeover. Withdrawn both surfaces 2026-07-30. | **fixed** |
| ◐ | **`testerId` as a bearer token** | ☑ The two exploitable paths are closed: the query-param fallback is gone, and `/account/sync` no longer re-issues the recovery code. ☐ The middleware still trusts any id presented in the header — closing that properly IS "real accounts" (§5), so it stays there rather than pretending to be a small fix. | P1 |
| ☑ | **Revocable read-only feed token** | Calendar subscriptions are back. A distinct 32-byte secret, stored SHA-256 hashed (indexed), accepted **only** by the iCal route, never readable as `x-tester-id`, with create / reset / revoke / last-fetched in Settings. Verified: works as a feed · grants nothing as an identity · the old `?testerId=` vector 400s · reset kills the previous link · revoke 404s a live subscription. | **done** |
| ☑ | **Notifier timezone fixed** | Real IANA zones now stored per email-subscription AND per push-device, captured from the browser and validated before storage; longitude remains the fallback for old rows. Measured error of the old method at 2026-07-30: **Austin +2h**, New York +1h, Kolkata +0.5h, Adelaide +0.5h, St John's +1.5h, Tokyo correct. **VAPID keys are no longer blocked.** | **done** |
| ☑ | **Google Calendar correctness** | ☑ Today's bounds now send real RFC 3339 instants. ☑ OAuth `state` is HMAC-signed and expires in 10min (was unsigned base64 — anyone could forge which profile a Google account attached to). ☑ `postMessage` targets our own origin and the listener verifies `e.origin` (was `'*'`). ☑ `/status` now VERIFIES refreshability instead of a row's existence, and reports a third state — `needsReconnect` — with a one-tap Reconnect in **both** Settings and the Calendar toolbar (where the emptiness is actually noticed). This is the state every tester hits weekly while OAuth is in Testing mode: the token dies, the row survives, and the app used to keep saying "Connected" over an empty calendar. Costs no extra Google round trip — the refresh short-circuits on an unexpired token. Verified across all four states against a scratch DB. | P0 |
| ☑ | **Write-status + query-key bugs** | Query-key mismatch fixed (`["tasks"]` didn't match `["tasks-today", …]`). All remaining silent writes now check `r.ok`: Today's task-toggle, advisor memory-save (no more false ✓), GCal disconnect, and the seven GuidingStarsHub mutations (toggleTask, toggleHabitToday, cycleStep, clearAnchor, deleteStar, setStarElement, logSession). | **done** |
| ☑ | **`jsonArray()` no longer fakes emptiness** | It now THROWS on a failed response, so React Query keeps the last good list and flags the error; `listState()` returns **ok / empty / stale / unavailable** as four distinct things. Tasks shows "offline — showing last known" vs "couldn't load your tasks" instead of a silent empty page. A 200 that isn't a list also throws — a server bug is not an empty list. | **done** |
| ◐ | **Regression suite + CI landed** | ☑ 77 tests, one per bug that ACTUALLY SHIPPED, each verified to fail when its bug is reintroduced; GH Actions runs them under America/Chicago, Asia/Kolkata and UTC; **Railway now refuses to deploy if they fail**. ☑ The first **integration** test (`tests/deletion.integration.test.ts`, real DB, real deletes) — skipped unless `TEST_DATABASE_URL` is set, a deliberately *different* variable from `DATABASE_URL` so it can never inherit production. ☐ Still wanted: the Playwright path, integration coverage for the remaining write paths, and the root `pnpm typecheck` is red on legacy libs (health-tracker only — both Compass apps typecheck clean in their own builds). | P1 |
| ◐ | **Deploy no longer mutates prod before it builds** | ☑ `railway.toml` reordered: install → **tests** → build both apps → *then* the schema push. A failing build or a broken invariant can no longer leave production's schema changed. ☐ Still `drizzle-kit push` (no versioned history, no rollback) — moving to generated migrations needs a **supervised baseline** against the live DB (tables exist, so migration 0 must be marked applied, not run). Not to be attempted unattended. | P0 |
| ☑ | **Privacy policy rewritten** | Now names **Cross Astrology LLC** (TX, filed 2026-07-29) and discloses what was missing: cycle data, chronotype, usage analytics tied to the account id, email + push subscriptions, advisor conversations, Google OAuth tokens, exact coordinates (was "approximate"), the new email open/click tracking, every sub-processor (Neon/Railway/OpenAI/Resend/Geoapify), a concrete deletion promise, and a children's clause. **Still needs a lawyer before public/paid launch.** | **done** |
| ☑ | **`/check-ins` UTC fallback removed** | A daily record now REQUIRES the writer's local date — the fallback is what filed US-evening reflections under tomorrow, and left the trap armed for the next new caller. Verified all four client callers already send one. | **done** |

## 3. P0-B — product integrity (after the sprint above)

| | Item | Detail |
|---|---|---|
| ☑ | **Felt-pattern survives a device change** | New `GET /check-ins/felt-pattern` reads it from the server rows that already held it (behaviorTags), so a restore keeps the evidence. **Epistemic safeguards shipped with it**: silent below 10 rated days and 4 per character, always shows counts + date range, and always gives the comparison ("aligned on 5 of 6 Building days — against 2 of 8 other days"). Copy states what was *reported*, never what a day *causes*; a test bans the causal words. Also shows progress toward the threshold so rating feels like it accrues. | **done** |
| ☑ | **Tide chart scrub works on touch** | Moved to pointer events (one path for mouse/touch/pen). A touch drag is only captured once clearly horizontal, so it never eats vertical page scroll; `touchAction: pan-y` backs that up. Tap reads a moment; on touch the readout persists rather than vanishing with the finger. | **done** |
| ☑ | **Ritual loop is wall-clock, not chronotype** | `ritualPhase()` in `lib/chronotype.ts` — morning = wake → wake+4h, evening = the last 3h before sleep, with an hour's grace before the usual wake time and two hours past bedtime (a ritual that vanishes the moment you're off schedule is worse than none). Both pairs compress proportionally rather than overlap on a short day/night. Wall-clock survives *only* as the fallback for users who skipped the optional chronotype step. Verified live at 17:37: a night owl (wake 17:00) gets "Cast off" and an early bird (sleep 19:00) gets "Log the day" at the same minute — the old rule showed **neither**. 7 tests, all confirmed to fail when the wall-clock gate is reintroduced. **Morning-reflection redesign is unblocked.** ☐ Follow-up: the *push* side still fires at a hardcoded 8am/8pm local (`notifier.ts` `MORNING_HOUR`/`EVENING_HOUR`) — `push_devices` carries a timezone but no wake/sleep, so aligning it needs a schema column and belongs with a supervised migration. | **done** |
| ☑ | **No account-deletion path** | `DELETE /api/account` + Settings → Delete account. The target list is **derived from the drizzle schema** (every table with a `tester_id`), not hand-written — a hand list is a promise that decays the next time someone adds a table. Advisor `messages` key on `conversation_id`, so they're deleted explicitly rather than trusting a cascade we can't see. Google's grant is revoked **before** the token row is dropped, and the result is reported as a tri-state (null = none connected · false = we couldn't confirm, revoke it yourself) instead of assumed. One transaction — a half-deleted account is the worst available outcome. Typed-phrase confirmation, 5/hr limiter (method-scoped, so `/account/sync` is unaffected). Client purges localStorage by namespace. Privacy policy rewritten: self-serve and immediate, no longer "email us". Verified against a local scratch DB: 13 rows/13 tables erased, a second account untouched, messages gone, Google-failure branch returns false, full UI pass ends in first-run onboarding. **Found and fixed in the act of verifying**: `compass_rollover_*` survived the local purge because the namespace list had `compass-` but not `compass_`; the test now derives every key from the client source. | **done** |
| ◐ | **Dark mode — daily-driver surfaces** | ☑ Measured, not eyeballed: a WCAG contrast pass over every rendered text node on Today · Calendar · Aims · Plan. **Dark 146 → 15 failures** (95 of the 146 were below 3:1, i.e. genuinely unreadable; the worst was Calendar's day numbers at 1.37 and the "Guiding Stars" heading at 1.23). **Light 386 → 387 — unchanged**, confirmed by re-measuring the baseline from a stash rather than assuming. Semantic `--text-1/2/3` ramp added to `index.css` and to all four palettes; 883 hardcoded `color:` values and 55 light backgrounds swept; element hues and the six duplicated planet-hue maps (which had already drifted — Venus was two different colours) consolidated into `lib/elements.ts` + the new `lib/planetColors.ts`, staying **hex** because 134 sites concatenate an alpha suffix and `var(--x)22` fails silently to transparent. Guard tests in `regressions.test.ts` fail the build on a new raw grey or a re-frozen hue. ☐ Remaining: 15 dark failures, all marginal (3.0–4.4, no longer invisible); light mode's own 386 are pre-existing and mostly brand hues on cream — a separate palette question, not a dark-mode one. |

## 3b. P1 — during the first weeks

| | Item |
|---|---|
| ☐ | **Conversion + outcome instrumentation** — 11 events, none a conversion event. Cheapest high-value item; everything in pricing depends on it. **Deferred by owner 2026-07-30** — focus is getting beta underway, not measuring conversion before there's anything to convert. |
| ☑ | **Client crash reporting** — `lib/errorReport.ts` + `componentDidCatch` + window/promise handlers, reusing `/api/events` (no new table, no SDK, no key to configure). Deduped per source+message, 10/session ceiling — a render loop was otherwise hundreds of DB writes a second on a compute-billed database. Read it at **`GET /api/events/errors?days=7`**, grouped and sorted by *people affected* before raw volume. Verified end to end on all three paths. |
| ☐ | **A staging environment** — see §9. The single highest-leverage thing for shipping *while* beta users are on the app. |
| ☐ | **Preference sync, scoped by ownership** — *account*: house system, astro detail, density, timing defaults, caution planets · *device*: theme, text size, reduced motion · *subscription*: quiet hours, schedule, event filters. A single blob would push a phone preference onto the desktop. |
| ☐ | **One "no hover-only interactions" pass** — HelpBadge glossary (dismissible popover/bottom sheet + keyboard focus), Calendar's `onMouseEnter` "+ add" reveal, TideWater. |
| ☐ | **Reviews available, not compulsory** — keep a completed period's review for several days, show a subtle pending item in Next/Log, allow dismissal, preserve access in the Log afterwards. |
| ☐ | **Ask history is in-memory**; Planner drafts die on refresh; the journal claims "will retry" with **no retry queue** — statuses should be *Saved on this device / Syncing / Synced / Couldn't sync — Retry*. |
| ☐ | **GuidingStarsHub mutations skip `r.ok`** (toggleTask, toggleHabitToday, cycleStep, clearAnchor, deleteStar, setStarElement, logSession). |
| ☐ | **Chartless users CAN convert** — reclassified. Two legitimate personalization paths: *chart-personalized* (transits, houses, profections) and **behaviour-personalized** (chronotype, free windows, felt history, completed work, calendar constraints). A user with no birth time can still pay for electional timing, chronotype-aware scheduling, rhythm reports, and Ask. Promise: *"personalized by your chart, your lived patterns, or both."* |
| ☐ | **The Wake needs a decision now** — the don't-copy rule says no streaks, but Momentum *already* ships streaks in the morning card, evening card, Wake, and weekly review. It is already a streak product. Keep the record, change the framing: "9 days recorded this cycle", "you returned 4 times this week" — never "streak broken", never reset to zero, no tallest-bar-is-best-day. Reveal patterns, don't score obedience. |

---

## 4. Competitive borrowings — ranked by (impact × cheapness)

Effort estimates from the competitive study. Items marked ★ are mostly-already-built.

| # | Item | Effort | Note |
|---|---|---|---|
| ☑ | Live `webcal://` subscribe feed | 3–4h | **done** — and the export it depends on had never worked |
| ☑ | ★ **Capacity honesty before commit** (Sunsama) | 4–6h | **done** — names an overcommitted day before anything is written; a statement, not a blocker |
| ☑ | ★ **Quiet auto-rollover — tasks only, never windows** (Tweek) | 4–6h | **done** — `original_due_date` preserved, row reads "↻ carried from Mon"; windows structurally untouchable |
| ☑ | ★ **Single-key calendar view switching** (Notion Cal) | 2–3h | **done** — D/W/M/A + T + ←/→, guarded against typing, keys named in tooltips |
| ☑ | ★ **Surface the feed at the point of need** | 2–3h | **done** — the "Google Cal · coming soon" dead end now offers the feed |
| ☐ | **Place habits on the calendar from their cadence** (Reclaim) | 2–3d | **DEMOTED 2026-07-30** — was ranked highest-value; placing habits automatically *before* the Planner can move/compress/skip/re-home them would manufacture exactly the calendar anxiety this product rejects. Build the verbs first (move → reject/skip → compress → explain-why-here), *then* this. |
| ☐ | **Planner review: move, not just drop** (Sunsama/Akiflow) | 1–1.5d | The weaver already computes runner-up windows and discards them; nothing persists until commit. |
| ☐ | **`Cmd+K` command bar** (Akiflow) | 1–1.5d | **DEMOTED** — useful for power users but doesn't test the thesis or the retention loop, and a command bar can paper over unresolved information architecture. Ranks below felt-pattern persistence, morning reflection, review availability, keepable artifacts, and conversion instrumentation. |
| ☐ | **Deliberate re-homing of undone work** in the evening ritual (Sunsama shutdown) | 1.5–2d | Finally uses the built-but-never-called `PATCH /planning/windows/:id`. |
| ☐ | **Live NL parse preview in Quick Capture** (Todoist/Fantastical) | 1–2d | `date-fns` already a dep; capture currently parses no dates at all. **Design the rejection affordance with it** — Todoist ships Backspace-immediately-after, Fantastical ships a quoting escape. |
| ☐ | **Graceful degradation: compress · skip-today · log-past-work** (Reclaim) | 1d | `POST /planning/windows/:id/complete` exists, never called. |
| ☐ | ★ **Pre-seed two dailies on first run** (Structured) | ~4h | "Rise and Shine" / "Wind Down" anchored to *real sunrise/sunset*. First interaction is editing, not creating; teaches cadence + solar anchors wordlessly. Best onboarding move in the study. |
| ☐ | **Consent-based cascade** — open lane | 2–3d | Nobody has it. Structured refuses to ripple (loudest unmet request, users asking for *lockable anchors*); Motion ripples silently. "Your 2pm ran long — shift the next three? [yes / just this one / no]". |

### Do NOT copy
- ⏸ **Silent continuous rescheduling** (Motion) — one reviewer's list reshuffled 11× in a day; the community calls it "AI calendar anxiety". A Compass block that moves silently retracts a *claim*, not a slot.
- ⏸ **Streaks, scores, guilt ledgers** — a streak assumes linear time, the exact premise the product denies. **The queued "wake behind" strip is the live risk here.**
- ⏸ **Full-capacity "fit everything in"** — refusal is the converting moment. `Launch.tsx:217` withholding the schedule button on an `avoid` verdict *is* the product.

---

## 5. Revenue-blocking capability gaps

| | Item | Blocks | Source |
|---|---|---|---|
| ☐ | **Real accounts + entitlement + billing** | All 10 paying personas. No users table; identity is an unvalidated `x-tester-id` header; zero payment code. Precondition for everything below. | paying §A0 |
| ☐ | **Conversion instrumentation** — 11 analytics events exist and **none is a conversion event**. `premium_feature_used {feature}`. | Everything — we currently cannot learn what people value. **Cheapest high-value item on this page.** | paying, pricing §2 |
| ☐ | **Two-way calendar** (write to GCal, not just read) | Tomas outright; caps 4 others. The Planner already *reads* busy times and cannot write — the worse half of a half-integration. | paying §A1 |
| ☐ | **Client mode / multi-chart** | Vela 5× ($9 → $39–59/mo). Closer than it looks: `natal_charts.tester_id` isn't unique, blueprints are already chart-scoped, `ChartWheel`/`TransitTake` are pure, `engine.ts:57` already computes from ad-hoc birth data. Hard precondition: accounts. | paying §A2 |
| ☐ | **A branded, keepable, sendable artifact** | Best build-to-value ratio in the study. `/api/studio/best.png` already renders the election card with **no door to it**; `reports.ts:385` renders a full HTML report with no LLM cost. Print stylesheet + tokenized link = Vela's handout, Owen's Slack paste, Nadia's printed year. Unlocks the **$49 one-time SKU**. | paying §A3 |
| ☐ | **Long horizon + non-monthly shape** | No view past the 30-day strip. `composeMonth` exists but isn't an offerable cadence. Unlocks seasonal/one-time buyers we currently can't accept money from. | paying §A5 |
| ☐ | **Studio: custom branding, batch, 1:1** | Sable ($19–25/mo) — the highest-confidence payer *and* the distribution channel, same person. | paying |

### Pricing decisions (recommendation, not settled)
**"Free gives you today. Paid gives you the rhythm."**
- **Free** — full daily reading incl. personal layer, planner, calendar, habits+cadence, Log; 1 election/wk, 3 Ask/mo
- **Compass $9/mo · $79/yr** — unlimited elections+Ask, push+email, calendar feed, Currents, long horizon
- **Professional $59/mo · $540/yr** — multi-chart, per-client elections, client handout, **plus** branding/batch/1:1 (Studio folds in as a feature bundle, not a separate customer identity, until demand proves otherwise — the two tiers overlapped). Benchmark SimplePractice/Practice Better $69–99, *not* astrology apps
- **"Elect a date" $49 one-time** — the episodic SKU nobody else sells. **Deliver it manually first** (existing engine + a polished report) to validate willingness to pay before threading billing through the app

⚠️ **Morning notifications probably belong in free/beta** — they *are* the daily habit; paid reports can be deeper, personalized, longer-horizon.
⚠️ **Habit cadence must never move behind the wall** — recurrence-behind-paywall is the #1 one-star generator for both Structured and Tweek.
⚠️ **Don't split the beta cohort** into free/paid arms (n=6 proves nothing, friends compare notes, confounded with plain disengagement). Instead mark paid surfaces **"✦ included for you — beta"** — a gift received, not a bill arriving. Fantastical grandfathered generously and was review-bombed anyway because the UI only showed locks.

---

## 6. Marketing — hooks and what each demands

| Hook | Demands | Status |
|---|---|---|
| **"You're not lazy. You're on the wrong schedule."** | The felt-pattern surviving a device — otherwise it's a horoscope | ☐ P0 above |
| **"The app that tells you not to."** | Protect the "Avoid" verdict; never soften it for engagement. Requires the engine be *right* — hence yesterday's four fixes | ☑ engine fixed |
| **"Pick the day. Know why."** | A keepable/sendable election artifact | ☐ §5 |
| **"Some days you're a hammer. Some days you're a sponge."** | Nothing — already shipped | ☑ |
| **"For work that doesn't run on a straight line."** | `astroDetail: minimal` must actually hold across a first session (currently gates only 3 surfaces) | ☐ |

### The voice — LANGUAGE-STUDY-2026-07-30.md

Owner's thinking 2026-07-30, written up with analysis. Four threads:
- **The register** — Co-Star's snark *aimed at the situation, never the reader*
  (their distance is what licenses their wit; we deliberately destroyed that
  distance), plus precise/specific/measured. **Lyric in the weather, plain in
  the instruction.** Costs nothing, applies to every line from here.
- **☐ Rhythm as the brand line** — *"find your rhythm; it need not be linear."*
  Dodges "productivity", states the thesis without astrology, and **resolves the
  Wake/streak contradiction**: a rhythm has a beat you can miss and return to,
  a streak has a number that resets. Same data, opposite meaning.
- **☐ Mercury-sign register** — the strongest idea, and the most defensible
  thing astrology can do here: it's a claim about how the *reader* likes
  information to arrive, not a prediction. Chart proposes, user overrides.
  Wants a `voice()` renderer over structured `Block[]` — so **don't bake tone
  into any new composer.**
- **☐ Seasonal drift** — Jupiter/Saturn set the register (slow); Mercury Rx is
  the one fast signal that may change it; Mars/Sun/Venus stay content-only. A
  voice that changes daily isn't a voice.

**Never say:** "productivity" (they left those tools deliberately — great internal shape-name, wrong headline), "astrology app" (pre-sorts us into a low-ceiling category), "AI-powered" (commodity, and our moat is the *deterministic* engine — the weave is pure ephemeris math; only the list parse is AI).

**Biggest lateral idea:** ☐ a public no-signup **"When should I ___?"** page — landing page, SEO surface, demo, and funnel in one object. The election engine already runs chartless, so most of it exists. 11/12 personas used Begin for a real decision; 4 changed real dates.

**Other channels:** the daily card as organic distribution (Studio ships them; needs unbranded/1:1/batch) · the refusal as a content series ("Don't launch this week — here's why") · lunation letters as a subscribe-able artifact (`composeNewMoon` exists).

---

## 7. Parked (deliberate, revisit later)

- ⏸ **Teams / multi-user** — the whole architecture is single-`testerId`. Needs real auth, workspaces, permissions, and a design answer to *whose chart* feeds a team reading. Prove individual conversion first; let users pull their teams in.
- ⏸ **Health/medical timing** — deliberately out of scope (`Launch.tsx:411`). A liability trap, not a gap.
- ⏸ **Vocabulary unification** — merge only the six *favorability* scales into FIT. Keep tide character/level separate (identity, not grade) and keep the felt scale deliberately different-worded **forever** — shared vocabulary would anchor-contaminate the calibration loop, which is the product's epistemic spine.
- ⏸ **Collapse the duplicate Settings natal-chart editor** — two forms write the same endpoint; both now correct, but merging is a UI decision worth making deliberately.

---

## 8. The thesis, for reference

> Every competitor answers **"when can this fit?"** — and their objective function is
> *emptiness*. A calendar's only input is other calendar entries, so Motion, Reclaim and
> Sunsama have no opinion on whether Thursday beats Tuesday. Compass has a second input,
> so it can rank two equally-empty days for a *specific* thing — and uniquely, **it can
> refuse**, because refusal requires an external standard a fit-optimiser structurally
> lacks.

The journey to own: **"is this the moment?"** → *now* / *better on Thursday* / *against
the current* / *not this month*, with per-rule receipts. Nobody else can render the
fourth answer and most can't render the third.

---

## 9. Shipping while beta users are on the app

*Added 2026-07-30. Three structural facts about this setup decide what is safe
to do once real people have data in it.*

### 9a. `drizzle-kit push` is the sharp edge

The schema lives as TypeScript in `lib/db/src/schema/*.ts`. On every deploy,
`drizzle-kit push` compares that to the live database and applies the
difference **directly** — no migration files, no history, no down step.

It also has to *infer intent*. Rename `title` → `name` and it cannot tell a
rename from "drop `title`, add an empty `name`". It will usually do the latter,
and every row's data in that column is gone, silently, on production.

**The rule while beta is live: additive only.**

| Safe | Not safe without a supervised migration |
|---|---|
| Add a nullable column | Rename a column |
| Add a table | Drop a column or table |
| Add an index | Change a column's type |
| Widen a type (text stays text) | Add a NOT NULL column to a populated table |

The real fix is generated, versioned migrations. Getting there needs a
**baseline**: the tables already exist, so migration 0 must be *marked applied*
rather than run — otherwise it tries to create what's there. Supervised, with a
fresh backup, never as part of a normal deploy.

### 9b. There is no staging — and there should be

Everything already points at a two-branch flow (`feat/tides-app` → `main`, CI
builds both). The missing half is somewhere for the first branch to land.

**Owner steps (~20 min, ~$5/mo):**
1. **Neon** → branch the production database, name it `staging`. Branching is
   copy-on-write and instant; it costs almost nothing and it is throwaway.
2. **Railway** → new service from the same repo, watching **`feat/tides-app`**,
   with `DATABASE_URL` pointing at the Neon `staging` branch and its own
   `PUBLIC_BASE_URL`. Give it the Railway-provided domain or `staging.compass.day`.
3. Leave production watching `main`.

**What that buys, specifically:** a schema change hits a throwaway Neon branch
*first*. If `drizzle-kit push` is about to drop a column, you find out on a copy
instead of on a tester's journal. That is the single mitigation for 9a that
doesn't require the migration work.

Until then, the poor-man's version already works and needs nothing:
```
createdb compass_staging
(cd lib/db && DATABASE_URL=postgres://localhost:5432/compass_staging npx drizzle-kit push --force)
TEST_DATABASE_URL=postgres://localhost:5432/compass_staging pnpm test
```

### 9c. One service, no feature flags

A single Railway process serves both the API and the built frontend, so a
deploy replaces it: everyone gets the new version at once, with a few seconds
where requests fail. Fine at beta scale — but it means risky work wants to land
in the morning, not at 9pm while people are logging their day.

No feature flags means code either reaches everyone or nobody. Consequences
worth knowing rather than fixing right now:
- A half-finished feature cannot sit merged-but-off. Keep it on a branch.
- Nothing can be turned off without a deploy. **Rolling back is
  `git revert` + push**, and that path is ~5 minutes end to end — which is
  acceptable precisely because tests gate the build.

The one real protection already in place: `railway.toml` runs install → tests →
build → *then* the schema push. A broken invariant cannot reach the database.
