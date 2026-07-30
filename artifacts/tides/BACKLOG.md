# Compass — the master backlog
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
| ⛔ | **~~Set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`~~ — HOLD** | Was "a five-minute owner action." It isn't: the notifier infers the local clock from **longitude**, which is not a timezone (no DST, no half-hour zones, already ~1h wrong in US DST). Turning keys on now means the first thing notifications ever do is arrive at the wrong hour. Blocked on the P0-A timezone fix. | 2026-07-30 review |
| 👤 | **Set `RESEND_API_KEY` + `EMAIL_FROM` on Railway** | Same for email reports. Composer, cron, opt-in all shipped. | month §1 |
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

---

## 2. P0-A — the trust & authorization sprint (freeze feature work)

*Added 2026-07-30 after an external review. Verdict I agree with: the risk has
shifted from "dangerous integrity bugs" to "shipping clever improvements faster
than the trust/testing/authorization architecture can hold them." **Freeze
competitive borrowing until this block closes.***

| | Item | Detail | Status |
|---|---|---|---|
| ☑ | **Calendar feed leaked the account credential** | The webcal URL carried `?testerId=`, which IS the credential — and `middlewares/testerId.ts` accepts it as a **query param**. Verified live: that string alone returns the personal logbook, and `POST /account/sync` returns the **recovery code** = full account takeover. Withdrawn both surfaces 2026-07-30. | **fixed** |
| ☐ | **`testerId` is a bearer token with no ownership check** | The root cause of the above. The middleware trusts any supplied id, header *or query param*. At minimum: drop the query-param fallback (check what actually needs it — comment claims streaming voice endpoints), and stop `/account/sync` returning the recovery code to a bare id. | **P0** |
| ☐ | **Revocable read-only feed token** | Restores the subscribe feed: random secret, stored hashed, scoped to the iCal route only, never usable as `x-tester-id`, with regenerate / revoke / last-accessed. | P0 |
| ☐ | **Notifier infers timezone from longitude** | Longitude is not a timezone: no DST, no half-hour zones, no political boundaries, no travel. Already ~1h wrong in US DST. **Do NOT set the VAPID keys until this is fixed** — otherwise the first thing notifications do is arrive at the wrong hour. Store IANA `timeZone` + real per-device prefs at subscription time. | P0 |
| ☐ | **Google Calendar correctness** | Verified: `Today.tsx:623` sends `2026-07-30T00:00:00` — no offset — while `Calendar.tsx:1292` correctly sends `.toISOString()`. Google requires RFC 3339 *with* offset, so Today's query is malformed. Failure returns HTTP 200 + empty list, indistinguishable from "no events". Also: sign+expire OAuth `state`, validate the `postMessage` origin (currently `*`), make `/status` verify refreshability, add a visible Reconnect state. | P0 |
| ☐ | **Remaining write-status + query-key bugs** | Verified: `Today.tsx:673` keys the visible query `["tasks-today", testerId, today]` but `:691`/`:703` invalidate `["tasks"]` — **not a prefix**, so the invalidation silently misses and the UI waits for the 30s poll. Plus: Today's task-toggle skips `r.ok`; advisor memory-save reports success on any resolved response; GCal disconnect unchecked; the GuidingStars set below. | P0 |
| ☐ | **`jsonArray()` turns outages into false emptiness** | My own fix, correctly criticised: it prevents the app-wide crash but makes a failed load look like "you have no tasks." Needs three distinct states — empty / unavailable / stale — keeping last-good data via React Query rather than substituting `[]`. | P0 |
| ☐ | **No tests, no CI** | The largest omission. Only typecheck+build exist. Given how many real bugs surfaced in 24h, the repo is not learning not to recreate them. Lock in: local dates across UTC midnight + DST, habits/check-ins across local midnight, every write under 400/429/500/offline, election golden cases (conj/opp perfection, VoC across midnight, Tokyo/India/Newfoundland/Australia), notifier delivery in IANA zones, feed-token scope, GCal bounds, mobile pointer + glossary, dark mode, restore + Switch Profile. Plus one Playwright path: onboarding → task/habit → reflection → next local day. | P0 |
| ☐ | **`drizzle-kit push` runs against prod on every build** | Schema can change before the build fails; no versioned history; hard rollback; code and schema can briefly disagree. Move to versioned migrations + backup + two-phase backward-compatible changes. | P0 |
| ☐ | **Privacy policy understates collection** | I wrote it; it omits or understates menstrual-cycle data, chronotype/preferences, usage analytics (auto-sent with the tester id + arbitrary props), notification/email subscriptions, advisor memory, and OAuth tokens. It also says location is "approximate" while exact coordinates may be stored. | P0 |
| ☐ | **`/check-ins` still falls back to server UTC** when a write omits `date` | The local-day fix landed in the callers; the dangerous default remains for the next new caller. Make `date` mandatory for daily writes. | P0 |

## 3. P0-B — product integrity (after the sprint above)

| | Item | Detail |
|---|---|---|
| ☐ | **Felt-pattern must survive a device change** | localStorage-only today, so restore loses the app's core promise — and it's the evidence under our best marketing hook. **Add epistemic safeguards with it**: minimum sample threshold, visible sample count and date range, uncertainty language, comparison against the user's own baseline, and no causal phrasing. Say *"you reported feeling aligned on 7 of 10 Building days, vs 4 of 11 others"* — never *"Building days make you productive."* Early copy should be *"maybe your schedule is fighting your rhythm"*, since the evidence is correlational and self-reported. |
| ☐ | **TideWater scrub is mouse-only** | Use **pointer events** (not parallel mouse/touch paths). Support tap + horizontal drag without hijacking vertical page scroll, and add a textual next/high/low summary so the chart isn't the only way to reach its information. |
| ☐ | **Ritual loop is wall-clock, not chronotype** | Define morning as wake → wake+4h, evening as the last 3h before sleep, wall-clock only as fallback. **Blocks the morning-reflection redesign.** |
| ☐ | **No account-deletion path** | Must remove/revoke *everything*: account tables, Google OAuth tokens, push subscriptions, email subscriptions, advisor memory, analytics association, feed tokens, recovery key — and state backup retention honestly. |
| ☐ | **Dark mode — 15 worst daily-driver surfaces** | Then semantic tokens + a lint/review rule, or every new feature reintroduces hardcoded creams and dark text. |

## 3b. P1 — during the first weeks

| | Item |
|---|---|
| ☐ | **Conversion + outcome instrumentation** — 11 events, none a conversion event. Cheapest high-value item; everything in pricing depends on it. |
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
