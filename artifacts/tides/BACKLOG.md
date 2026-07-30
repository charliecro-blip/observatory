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
| 👤 | **Set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` on Railway** | Push is built and wired; without keys nothing ever fires. The month study's #1 finding is that the return loop is dead in beta conditions, and this is most of it. | month §1 |
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

## 2. P0 — before the beta widens past friends

| | Item | Detail | Source |
|---|---|---|---|
| ☐ | **Felt-pattern must survive a device change** | It's localStorage-only, so account-key restore loses the app's core promise ("your most aligned days have been…"). The data to recompute it is already server-side in `dailyCheckIns.behaviorTags`. **Also the evidence under our best marketing hook** — without it, "You're not lazy, you're on the wrong schedule" is a claim we can't back. | month §5, pricing §3 |
| ☐ | **TideWater scrub is mouse-only** | `onMouseMove`/`onMouseLeave`, no touch/pointer binding. The hero tide chart's entire inspect interaction is dead on phones — and phones are most of the cohort. | 2nd audit |
| ☐ | **Ritual loop is wall-clock, not chronotype** | RitualCard gates on `<12`/`>=18` local while the app *collects* wake/sleep in onboarding. Night-shift and late-rising users get the morning glance while asleep. Blocks the queued morning-reflection change. | month §3 |
| ☐ | **No account-deletion path** | Only "export or email us". Needed before strangers, and it's a privacy-policy promise. | month Part C |
| ☐ | **Dark mode — the 15 worst daily-driver surfaces** | Calendar month-grid date numbers `#333` (nearly every date unreadable), Rail task titles `#333` on dark rail, Today's 14-day list + task chips, the new-event modal `<select>`, VoC banner at ~1.7:1 contrast, and several fixed cream/pastel blocks that sit as bright slabs on a dark Today. | 2nd audit |

## 3. P1 — during the first weeks

| | Item | Source |
|---|---|---|
| ☐ | **Account restore loses**: uiDensity, astroDetail, all display/notification/timing prefs, `obs_house_system` (readings silently change meaning), text scale, theme/palette, Ask conversation pins. Needs a `/api/preferences` blob. (Felt history + journal *do* survive — they're server-side.) | 2nd audit |
| ☐ | **Tooltip is hover-only** — the whole education layer (HelpBadge glossary) is unreachable on mobile. No click/touch/focus handler anywhere. | 2nd audit |
| ☐ | **Calendar "+ add" reveal is `onMouseEnter`** — tapping the cell *does* work, but the affordance is invisible on touch. | 2nd audit |
| ☐ | **Notification preferences are client-side theater** — quiet hours + per-planet hour shifts live in localStorage; the server notifier ignores them and pings at fixed hours. Either sync them or remove the dead knobs. | 1st audit |
| ☐ | **Reviews are ambush-gated** — Sunday/New Moon cards render only on the day. 7/12 personas never saw a Sunday review; 8/12 never saw the New Moon one. | month §4 |
| ☐ | **Ask history is in-memory** — closing the modal destroys the conversation; pins silently capped at 20. **Planner drafts** (parsed + hand-edited cards) die on refresh. | 1st + 2nd audit |
| ☐ | **GuidingStarsHub mutations skip `r.ok`** (toggleTask, toggleHabitToday, cycleStep, clearAnchor, deleteStar, setStarElement, logSession) — UI self-corrects on refetch so nothing persists a lie, but a failed tap is silent. | 2nd audit |
| ☐ | **Chartless/no-birth-time users**: the paid layer is honestly closed to them, which is correct, but it means they can never convert. Needs a path — even a "timeless chart" premium story. | month, paying |

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
| ☐ | **Place habits on the calendar from their cadence** (Reclaim) | 2–3d | The engine-spread half of the owner's habits idea. Everything needed exists: `best-times`, `POST /planning/windows`, chronotype filtering, and now cadence + solar anchors. **Highest-value unbuilt item.** |
| ☐ | **Planner review: move, not just drop** (Sunsama/Akiflow) | 1–1.5d | The weaver already computes runner-up windows and discards them; nothing persists until commit. |
| ☐ | **`Cmd+K` command bar** (Akiflow) | 1–1.5d | `cmdk@1.1.1` is already a dependency and never imported. Also fixes Planets/Settings having no nav entry. Split like Akiflow: global vs in-app. |
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
- **Practitioner $59/mo · $540/yr** — multi-chart, per-client elections, client handout (benchmark SimplePractice/Practice Better $69–99, *not* astrology apps)
- **Studio $25/mo** — branding, batch, 1:1
- **"Elect a date" $49 one-time** — the episodic SKU nobody else sells

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
