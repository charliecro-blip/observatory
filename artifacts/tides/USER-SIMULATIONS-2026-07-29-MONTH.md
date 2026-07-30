# User simulations — 2026-07-29 · THE MONTH STUDY

Fourth pass, and a different instrument than the three before it
(`USER-SIMULATIONS-2026-07-04.md`, `-07-08-RETEST.md`, `-07-20.md`). Those were
walkthroughs — first-session structural friction. This one simulates **a full
month of real-life use** for 12 personas from the established roster, each with
a real stake the app must earn its place against. The question is not "where do
they get stuck" but "on day 23, why is this app still on their home screen —
or why isn't it?"

**Method honesty (unchanged):** simulations, not people. High confidence on
structural claims (every feature credited or blamed below was verified in the
current build first — refs throughout). Medium confidence on retention curves.
The felt-texture of month-long habit is the thing a simulation is worst at;
treat D14/D30 numbers as directional.

## Grounding — the build as it exists today (verified 2026-07-29)

- **Nav is the loop:** Today · Calendar · Aims · Plan (`App.tsx:107-112`); no
  "⋯" menu anymore (`App.tsx:793-795`). Planets has no tab — reachable only via
  Today's teachable-moment door, Log flavor stamps, or the desktop Rail
  (`App.tsx:104-107`). Almanac is retired; its 30-day wave strip
  (`QualityStrip`) now tops Calendar (`Calendar.tsx:1417`), its reference moved
  to Planets. **The Log is a sub-tab inside Calendar** (`App.tsx:977`).
- **Onboarding:** 6 intro slides (skippable) → name → birth (with a true
  "Show me today →" skip and an honest unknown-birth-time checkbox) →
  chronotype → lands on Today (`App.tsx:307-782`). Zero-birth-data value is
  real now.
- **uiDensity defaults `essential`** (`lib/preferences.ts:111`), which hides:
  the teachable-moment planet door, BigSky, TodayHabits strip, UnifiedTideChart,
  ModulePulse, Standing Conditions, and the premium discovery banner
  (`Today.tsx:1127,1186,1195,1198`). astroDetail defaults `medium`.
- **The ritual loop:** RitualCard renders only before noon ("⛵ Cast off") or
  from 18:00 ("🌙 Log the day") — **wall clock, not chronotype**
  (`Today.tsx:773-774`). Felt rating (Aligned/Mixed/Off) + journal render on
  Today **only in evening mode** (`Today.tsx:940-941`); any-day backfill lives
  in Log's ReflectComposer. Morning card offers a "Yesterday felt…" backfill
  row (`Today.tsx:2126-2138`).
- **Reviews are ambush-gated:** Sunday review renders only on Sundays; New Moon
  review only days 0–2 after the New Moon; miss the window, nothing queues
  (`Momentum.tsx:260-266`).
- **Felt calibration reads localStorage only** — the "Your pattern (last 30
  days)" tally scans `obs_felt_*` keys (`Today.tsx:1537-1556`); the server
  mirror (behaviorTags via `/api/check-ins`) exists but is *not* read back for
  the pattern. Account-key restore therefore does **not** restore the pattern.
- **Nothing adapts to a contradicting felt rating** — an "Off" day only fails
  to increment a ratio. No acknowledgment, no reweighting, by design
  ("reflect-don't-predict", `TideCard.tsx:127`).
- **Beta conditions verified:** push defaults off; with `VAPID_PUBLIC_KEY`
  unset the server 503s the key request and the client shows "Push isn't
  configured on the server yet" **after** the user has granted browser
  permission (`pushSubscribe.ts:23`, `routes/push.ts:21-23`). Email reports
  section exists in Settings but tests answer "Saved, but the server has no
  email key yet (RESEND_API_KEY)" (`Settings.tsx:132`, `lib/email.ts:26`).
  GCal: unconfigured server → dead "📅 Google Cal · coming soon" chip
  (`Calendar.tsx:381-457`); configured → readonly scope with the "Google hasn't
  verified this app" interstitial (`GCAL-SETUP.md:38-44`). No accounts; account
  key is the only restore path (`App.tsx:322-335`, `TESTER-NOTES.md`).
- **Plan tab:** Schedule / Break down / **Begin** (`Launch.tsx:291-330`). Begin
  returns election windows with verdicts strong/workable/caution/avoid rendered
  as "A great time / This time will do / Against the current / Avoid"
  (`Launch.tsx:127-129`), per-rule receipts, and a free "＋ Put it on my
  calendar" (`Launch.tsx:165-224`). Engine gates verified: Mercury-Rx
  hard/soft/favor per activity, retrograde significator caps the tier, VoC
  drops windows for void-averse activities (`electionEngine.ts:109-132,229`).
- **Premium is scaffold only — and defaults to UNLOCKED.** No billing infra
  (`lib/premium.ts:1-5`); the entitlement check is a localStorage dev override
  that defaults open (`premium-context.tsx:11-13`). Only 4 client sites gate on
  it, no server route checks it, and Ask/elections/Planner are entirely free.
  Every beta tester is living the full paid product; future gating will read
  as *taking away*.
- **Notification sub-preferences are theater.** Quiet hours, per-planet hour
  shifts, and crossing toggles in Settings never reach the server; the
  notifier hardcodes morning=8:00 / evening=20:00 and quiet 22:00–08:00
  (`notifier.ts:73-74,138`), gates hour-shifts on env `PUSH_HOUR_SHIFTS`, and
  computes the hour ladder from the *first subscriber's* lat/lon for everyone
  (`notifier.ts:118-120`). Moot while pushes are dead; a trust bug the moment
  keys are set.
- **Built-but-hidden depth:** HousesView and the premium ChartView are fully
  implemented behind `SHOW_ADVANCED_MODES = false` (`Planets.tsx:541`), while
  the curriculum's rungs 4–5 tell users to "visit Houses in Star Base" —
  which no one can. A server-side best-times share card (`/api/studio/best.png`)
  exists but no UI surfaces it.
- **No account deletion or data-wipe path exists** — "Switch profile" only
  clears localStorage; server rows persist (`tester-context.tsx:228`,
  `routes/account.ts`). The privacy policy is live; the delete path isn't.
- **REGRESSION FOUND WHILE GROUNDING: `pages/Currents.tsx` is orphaned.** Zero
  imports anywhere. The premium tier's flagship surface (Currents + the
  caution-period questionnaire entry point) is unreachable in the current nav,
  while Today's premium banner still sends users to "**Currents (under
  Calendar)**" (`Today.tsx:975`) — Calendar's sub-tabs are Calendar|Log.
  Calendar still renders ⚠ caution marks sourced from a questionnaire no user
  can now open (`Calendar.tsx:1271-1279`). Settings copy still references the
  Currents view in three places.

**Sky assumptions for the simulated month** (declared, not computed): Day 1 =
Wed Jul 29. Sundays fall on days 5, 12, 19, 26. New Moon window days 16–18.
A Mercury retrograde station on day 21 (plausible for mid-Aug 2026; used to
exercise the engine's honest-refusal paths, not asserted as ephemeris).

**Queued-but-unbuilt changes evaluated per persona:**
(a) reflection folded into the morning glance instead of a separate evening log;
(b) a "wake behind" progress strip on the homepage mirroring Calendar's
"water ahead"; (c) one unified grading vocabulary replacing today's nine.

**The nine vocabularies, for the record** (all verified live): ① tide character
Deep/Surge/Building/Clear; ② tide level low/rising/high/ebb (+levelLabel,
band, trend, energy %, confidence); ③ day quality tier
excellent/good/workable/mixed/avoid_if_possible (drives the Calendar strip and
day cells); ④ election verdicts strong/workable/caution/avoid ("A great
time…"); ⑤ election picker tiers ● good / ★ great; ⑥ habit/practice resonance
resonant/supported/neutral/soften/protect; ⑦ felt scale Aligned/Mixed/Off;
⑧ the 1–7 composite score (Tooltip.tsx:103); ⑨ the woven reading's register
(flavour / WATCH / counterpoint / pattern chips ±). Launch.tsx:125 already
declares "One grading language app-wide (the FIT scale)" — the unification is
started but only Launch and habit-resonance share it ("Against the current"
appears in both).

---

# Part 0 — The twelve months

Format per persona: stake → week-by-week → **peak value** / **peak friction**
→ retention → queued-changes impact.

---

## 1 · Luna, 36 — pro astrologer, 15k followers (astro-fluent enthusiast)
**Stake:** launching her paid transit-reading course this month; needs a date,
and is auditioning Compass as something she could publicly recommend.

- **D1:** skips intro by slide 2, sets astroDetail "full" immediately.
  Stress-tests positions against her Solar Fire — passes. Opens the woven
  reading's "the working — every voice, weighted"; the testimony table with
  weights and salience is the first consumer app she's seen show its math.
- **D2–3:** returns *unprompted* — professional curiosity is her notification.
  Runs Plan→Begin for "launch" across the month. The engine refuses windows
  after day 21 ("Mercury is retrograde — the tradition blocks this outright;
  wait for the direct station", `electionEngine.ts:113`) — this single honest
  refusal converts her from auditor to advocate.
- **W1 (Sun d5):** catches the Sunday review; shrugs at wins-counting (not her
  register) but screenshots the tide hero for stories.
- **W2:** finds the vocabulary fight the retest predicted: Calendar's water-
  ahead strip is scored on the ③ quality tier (favorability) while the hero
  speaks ① coherence — she notices her Deep/water days systematically bar
  lower on the strip and drafts, then holds, the correction post.
- **D16–18 New Moon:** sets a cycle intention (course enrollment target). Uses
  Begin → "Put it on my calendar" for day 19, pre-station — **the election
  decision of her month**, made in-app, receipts read in full.
- **W3–4:** visits Planets weekly (desktop Rail door); wants Currents for her
  own Saturn chapter, taps the Today banner → told it's "under Calendar" →
  it isn't → files a bug at us. First public post: warm, one caveat.
- **Peak value:** electional receipts + honest refusal. **Peak friction:**
  the strip-vs-hero scoring contradiction (public-correction risk, still live)
  and the Currents dead pointer.
- **Retention:** D7 ✓ · D14 ✓ · D30 ✓. **Pays:** yes, practitioner tier,
  immediately when billing exists.
- **Queued changes:** (c) matters most — unifying ③ into the FIT scale removes
  her correction-post risk. (a) neutral. (b) neutral. **Warning on (c):** if
  unification softens the election "Avoid" into anything gentler, she reads it
  as the app losing its electional spine — keep the 4th step.

## 2 · Dan, 41 — HVAC contractor, zero astrology; wife re-sent the link
(skeptical partner dragged in)
**Stake:** the biggest commercial bid of his year — site work must start this
month; his wife wants him to "at least pick a good day."

- **D1:** "Show me today →" skip — in the app in 90 seconds with no birth
  data (the 07-20 fix works). Essential density means the page is mercifully
  short. Reads the hero like a fishing report. Fine.
- **D2–4:** does not return. Nothing pings him (notifications: he tapped "Not
  now" reflexively). The app has no hook into his actual tools (paper + wife).
- **D8:** wife opens Plan→Begin on his phone for "begin construction /
  the big job." Verdicts in plain words — "A great time," "Against the
  current" — land for him where glyphs never would. They put the day-10 window
  on the calendar. **He checks the app on day 10.** The day goes well
  (weather, crew, inspector). Correlation does its quiet work.
- **W3:** returns twice for planetary hours ("good hours for paperwork") via
  the agenda view his wife showed him. Never sets a star, never logs a win,
  never rates a day.
- **W4:** month ends with the job started and the app unopened for 6 days.
- **Peak value:** Begin's plain-language verdict for one real decision.
  **Peak friction:** there is no artifact he can *keep* from that decision —
  the election receipt lives in-app; he wanted to text his wife the window
  (Studio shares the day card, not an election card).
- **Retention:** D7 ✗ (wife-mediated) · D14 ~ (2 visits) · D30 ~ (zombie:
  alive only through her). **Pays:** never solo; family plan only.
- **Queued changes:** none change his month. (c) helps at the margin (fewer
  words to decode). Flag: (b) a wake strip is actively bad for him — an empty
  ledger on the one day he visits reads as "this app thinks I'm failing."
  The wake strip needs a zero-state that isn't guilt.

## 3 · Rachel, 33 — freelance product designer, ADHD (ADHD freelancer)
**Stake:** three client deliverables and an overdue portfolio relaunch; rent
depends on invoicing this month.

- **D1:** full onboarding including chronotype (night-leaning). Sets a Guiding
  Star, "Relaunch portfolio" — the live diagnosis reads it as Venus/air and she
  *feels seen* (`GuidingStarsHub.tsx:114-133`).
- **D2–6:** genuinely strong week. Morning "⛵ Cast off" card = her external
  executive function: Today's three, star rows, one window. Quick-capture
  "+ task" → dump list → Planner weaves it (`App.tsx:825-828`). She schedules
  around the day's character instead of fighting it twice.
- **D7 (novelty cliff):** misses a morning. **Nothing pings her** (push server
  dead — she'd actually tapped Enable on day 2, granted the browser prompt,
  and got "Push isn't configured on the server yet." She read that as *the app
  is broken*, not *the beta is early*). The helm streak's one-miss forgiveness
  (`momentum.ts:121-133`) means day 8 doesn't punish her — good — but nothing
  *pulled* her back either; a client fire did.
- **W2:** the contradiction day. Hero: "Surge Tide · high — act, lead,
  initiate." Reality: client emergency, everything collapsed, she shipped
  nothing. Rates the evening **Off**. The app's response: silence — the rating
  disappears into a tally she won't see until enough data accrues. What her
  ADHD brain needed was one line: "Noted — that's 2 of 5 Surge days that
  didn't land for you." The calibration exists (`Today.tsx:1595-1610`) but
  needs ≥2 rated days *per character* to say anything, and says it only under
  the evening rating buttons she now rarely reaches.
- **W3:** usage decays to "mornings when she remembers." Misses both the
  Sunday reviews (works Sundays, opens the app at 14:00 — RitualCard absent
  midday, review card only on the day itself; the app at 14:00 is weirdly
  *empty* of loop surfaces — hero + two dashboard cards).
- **W4:** portfolio ships (client work ate the month). The wins that *did*
  get harvested were real; reading The Wake on day 27 (found it by accident
  inside Calendar→Log) is her best moment of the month — "I did more than I
  thought." Too late to change the habit.
- **Peak value:** morning card as prosthetic executive function; the Wake's
  evidence against her self-narrative. **Peak friction:** the midday dead
  zone + zero external pull = ADHD-hostile retention model. An app for
  time-blindness that requires *remembering to open it* is fighting itself.
- **Retention:** D7 ✓ · D14 ~ (3 opens/wk) · D30 ✗ (2 opens in W4, drifting).
  **Pays:** would have, for smart scheduling, if week-3 retention had held.
- **Queued changes:** **(b) is her fix** — the wake strip on Today front-loads
  the "I did more than I thought" moment she only found on day 27, and gives
  midday visits a reason to exist. (a) helps (she's more reliably present
  mornings than evenings; rating *yesterday* each morning fits her). (c) mild
  positive. **Watch-out on (a):** her morning presence decayed too — folding
  reflection into a card that only renders before noon narrows the aperture;
  reflection needs to be present *whenever she shows up*.

## 4 · Jess, 26 — chronic illness, spoonie (chronic-illness/spoonie)
**Stake:** a flare cycle mid-month while attempting a return to part-time
work; pacing is survival, not productivity.

- **D1–4:** the tide-as-permission-structure thesis (07-04, Elena) holds and
  deepens over a month. Low tide + "resting was reading the water right"
  evening copy (`Today.tsx:2205+`) is the only productivity-adjacent app that
  has ever *praised* her rest.
- **W1:** logs felt ratings nightly — she's the persona the TESTER-NOTES
  promise ("the felt-rating is the point") was written for. Cycle-phase banner
  plus tide gives her two-layer pacing.
- **W2 (flare, days 9–13):** app says "Clear · rising"; body says no. Rates
  **Off** three days running. The non-response is *correct* for her — she does
  not want an app that argues — but the morning backfill row means missed
  evenings don't hole the record. On day 13 the pattern line updates: "Your
  most aligned days have been **Deep Tide** (71% aligned, 7 logged)." **This
  is the single highest-value sentence any persona receives this month** — a
  personalized, evidence-based energy map she starts scheduling PT
  appointments by.
- **W3:** helm streak survives the flare (one-miss forgiveness + felt-rating-
  counts-as-helm-day, `momentum.ts:121-127`). She notices and is grateful —
  compare every other streak app she's rage-deleted.
- **D16–18:** catches the New Moon review (home resting); sets intention
  "two work days a week without payback." The "the wake will answer at the
  next New Moon" line (`Momentum.tsx:333`) is exactly her tempo.
- **W4:** browser storage cleared by an iOS update on day 24. Account key
  restores her data — **but the 30-day felt pattern resets to nothing**
  (localStorage-only tally). The app's most valuable sentence, erased; the
  ratings themselves survive on the server (behaviorTags) but nothing recomputes
  the pattern from them. She assumes *she* broke it.
- **Peak value:** the felt-pattern sentence. **Peak friction:** losing it to a
  storage clear despite doing everything right (saved key, restored).
- **Retention:** D7 ✓ · D14 ✓ · D30 ✓. **Pays:** $4–5/mo, yes — the honest
  low-day is the product.
- **Queued changes:** (a) **helps** — morning reflection matches flare
  reality (evenings are her worst hours). (b) **dangerous for her**: a
  progress strip on the homepage during a flare week is a wall of quiet days;
  needs the "a quiet day in the log is still a day in the log" voice built in,
  or it becomes the guilt surface the app has so far refused to build. (c)
  neutral, provided the felt scale stays *hers* (see Part D).

## 5 · Amara, 31 — therapist, evaluating for clients; fresh breakup
(therapist/coach who might recommend it)
**Stake:** her own recovery month, and a professional question: is this safe
to put in a client's hands?

- **D1–7:** uses it as designed and watches herself use it. The
  reflect-don't-predict architecture passes her ethics screen: felt ratings
  never feed prediction, cautions are self-reported (CautionQuestionnaire
  is opt-in, max 3 planets), copy never blames the user. The forgiving streak
  design gets a note in her recommendation draft.
- **W2:** breakup grief days. Evening card on a Saturn-flavored day: "On a
  saturnine day, that counts double" (`Today.tsx` heavy-contact line). She
  cries, then writes the journal line. The Log's sky-stamped timeline becomes
  her structured journaling tool — better than her actual journaling app
  because the day's *texture* is pre-written.
- **D16–18:** New Moon review lands mid-grief: "Last cycle: 9 wins in the
  wake" + intention field. Sets "be where my feet are." The cycle rhythm —
  not daily, not weekly, lunar — is the cadence she'd prescribe.
- **W3:** professional probe: tries to reach the caution-period setup to
  assess it for an anxious-client scenario — **cannot find it** (Currents
  orphaned; questionnaire unreachable; yet ⚠ marks she set in week 1 still
  render on Calendar with no way to edit them). For a tool she'd hand to
  anxious clients, un-editable warning marks are disqualifying until fixed.
- **W4:** verdict: recommends to 2 of ~20 clients (the two who already speak
  astrology), waits on the rest.
- **Peak value:** Log-as-structured-journal + lunar review cadence. **Peak
  friction:** orphaned caution controls (safety-relevant, not cosmetic).
- **Retention:** D7 ✓ · D14 ✓ · D30 ✓. **Pays:** yes.
- **Queued changes:** (a) she'd amend — morning-only reflection kills the
  *processing* function of evening writing; for her the evening entry IS the
  therapy. Fold the *rating* forward, keep the *writing* wherever the user is.
  (b) positive if quiet-state is kind. (c) positive — she currently has to
  translate five scales for clients.

## 6 · Kenji, 50 — program manager, 6-week platform-migration go-live
(program manager with a big project)
**Stake:** go-live date is day 24; a change-freeze decision is his to make;
lives inside Google Calendar and a Gantt.

- **D1:** desktop, expanded density within the hour, GCal connect attempt in
  the first ten minutes. Two possible worlds, both verified: (i) server creds
  unset → "📅 Google Cal · coming soon" dead chip → **his evaluation ends
  day 1** (the 07-04 Marcus finding, still the sharpest cliff in the app);
  (ii) creds set → the **"Google hasn't verified this app"** interstitial. On
  his *corporate* Workspace account, admin policy blocks unverified apps
  outright — no Advanced link exists for him. He connects his personal Gmail
  instead: half his calendar. (And if the server ran in Testing mode, his
  token dies silently on day 8 — `GCAL-SETUP.md:34-37` — which he reads as
  flakiness.)
- **W1–2 (personal-Gmail world):** Planner + ScheduleSuggest around visible
  busy-times works; he weaves prep tasks into good windows. Uses Begin for the
  go-live: day-24 window "This time will do," day-21+ windows carry the
  Mercury-station caution. He moves an internal comms blitz to day 19 because
  of it — **a real schedule change from electional data**, which he'd never
  admit in a status meeting.
- **W3:** wants the reverse sync — Compass windows *into* GCal. ICS export
  exists but exports tasks+windows as a one-shot file from Settings
  (`Settings.tsx:1129-1149`), no subscribe URL surfaced; he wants webcal. Does
  it once, never again.
- **D24:** go-live succeeds. He screenshots nothing, tells no one, quietly
  keeps checking the water-ahead strip for the hypercare fortnight.
- **Peak value:** Begin as a tiebreaker for dates he was 60/40 on. **Peak
  friction:** calendar integration ceiling (unverified-app wall on corporate
  accounts + no live outbound sync).
- **Retention:** D7 ✓ · D14 ✓ · D30 ~ (project ended; opens 2×/wk). **Pays:**
  only with verified OAuth + two-way calendar. Then yes, at B2B-ish prices.
- **Queued changes:** none address his ceiling. (c) mildly positive
  (verdict language is already the part he likes). (b) irrelevant to him.

## 7 · Ash, 25 — queer astro-meme creator (content creator)
**Stake:** pushing from 6k to 10k followers this month; needs daily material.

- **D1–3:** finds Studio via the hero's ↗ Share (`Today.tsx:905`). Day / week
  / lunation cards, primary-facts-only — screenshots into their template flow.
  The tide hero's tone quotes well; Resonant-now-style multiplicity suits
  their "many readings" ethos.
- **W1–2:** posts 5 Compass-derived cards; two do numbers. Their audience asks
  "what app"; there's no watermark/handle on the card by default they can
  point to beyond the wordmark — fine, they credit manually.
- **W2 low:** wants an *election* card ("best day this week to text your ex —
  jk — to post") — the client Studio has day/week/lunation only. The card they
  want actually exists server-side (`/api/studio/best.png`, four activities)
  but no UI surfaces it; the 07-20 funnel insight ("best-times content cards
  are literally its ads") is built and buried.
- **W3–4:** personal use is sporadic (evening person; morning card unseen
  until they surface at 11:40). Rates days when heartbroken or delighted,
  nothing between. The lunation card at New Moon is their best-performing
  post of the month.
- **Peak value:** Studio as a content pipeline. **Peak friction:** no
  election/best-times shareable — the one card that would convert followers.
- **Retention:** D7 ✓ · D14 ~ · D30 ~ (alive as a *tool*, not a habit).
  **Pays:** no. Worth more than a subscriber anyway (distribution).
- **Queued changes:** none change their month. (c) helps their captions.

## 8 · Priya, 34 — mother of a toddler, return-to-work month (busy parent)
**Stake:** first month back at work; every morning is a 10-second budget.

- **D1:** onboards during a nap (phone). Essential density + mobile bottom nav
  = the compact app the 07-04 study begged for. Mobile instrument strip
  carries moon/hour (`App.tsx:963`).
- **W1:** the morning glance genuinely fits the 10-second budget: hero word +
  Today's-three. Evening card almost never seen (18:00–21:00 is the toddler
  gauntlet; by 21:30 she's asleep). Result: **felt ratings ~0 despite real
  affection for the app** — the loop's evening anchor assumes an evening.
  The morning "Yesterday felt…" backfill row is her only rating surface, and
  she uses it maybe twice a week. (Queued change (a) is literally her.)
- **W2:** work restarts. App opens drop to ~4/wk but stay anchored to the
  commute. Sunday reviews: misses both attempts (Sundays are family days;
  she opens the app Monday and the review is gone — `Momentum.tsx:265` shows
  week review *only* on the day).
- **W3–4:** stabilizes at commute-glance + occasional Plan for weekend
  logistics. Never sees Planets (mobile + essential density = the teachable-
  moment door is hidden, the Rail doesn't exist, Log stamps are her only path
  and she doesn't use Log). The education layer effectively doesn't exist for
  the app's modal user profile.
- **Peak value:** the 10-second glance that survives a toddler. **Peak
  friction:** every loop-closing surface (rating, review, harvest) assumes
  she's free at the wall-clock times she is least free.
- **Retention:** D7 ✓ · D14 ✓ · D30 ~ (glance-only; loop never closed).
  **Pays:** later, maybe — when one caution window matches a hard day.
- **Queued changes:** **(a) flips her month** — morning-folded reflection
  turns her from loop-outsider to participant. (b) mildly nice on the
  commute. (c) neutral. Also exposes (a)'s design constraint: her "morning"
  is 07:10–07:25 *only*; the fold must cost ≤2 taps.

## 9 · Sam, 29 — night-shift nurse, 19:00–07:00 rotation (night-shift /
non-US-timezone class)
**Stake:** a day-clinic job interview on day 18 — her exit from nights.

- **D1:** chronotype intake has no shift-worker profile (four types only:
  early_bird / night_owl / steady / napper — `tester-profile.ts:34-39`), but
  wake/sleep times wrap midnight correctly (`lib/chronotype.ts:50-71`), so she
  enters wake 16:00 / sleep 08:30 and elections + ScheduleSuggest properly
  avoid her sleep ("a sky-perfect 3am slot is a taunt" — for her, 3pm).
- **W1, the structural miss:** **RitualCard is wall-clock** (`Today.tsx:
  773-774`). At her 16:00 "morning" (post-sleep), Today shows *nothing
  ritual*; at her 08:00 "evening" (post-shift, her natural log-the-day
  moment), the app shows "⛵ Cast off." She is permanently phase-shifted 180°
  from the app's loop despite the app *knowing her chronotype*. She rates
  days via the morning backfill row, which for her is semantically right
  ("yesterday" = the shift she just finished) but labeled wrong.
- **W2:** quiet-hours logic in the notifier is also hardcoded 22:00–08:00
  (`notifier.ts:138`) — moot with pushes dead, but the pattern repeats:
  chronotype is honored by the election engine and ignored by the loop.
- **D17:** uses Begin for "interview prep" and the interview morning itself;
  gets a Sun-hour window before the day-18 slot; preps in it; feels steadied.
  Gets the job.
- **W3–4:** with the stake resolved and the loop misaligned, use fades to
  pre-shift glances.
- **Peak value:** election window for the interview (single-event electional
  is the universal wedge, again). **Peak friction:** the ritual loop's clock
  ignoring the chronotype the app collected on day 1.
- **Retention:** D7 ✓ · D14 ~ · D30 ✗. **Pays:** would have, if the loop had
  fit her clock — the demographic that most needs rhythm tools.
- **Queued changes:** (a) as designed (morning-anchored) **makes her worse
  off** — it moves the whole loop to the exact time she's asleep. (a) must be
  chronotype-anchored ("your day-start"), not clock-anchored. (b) neutral.
  (c) neutral.

## 10 · Alex, 31 — adopted, no birth records (no-birth-time user)
**Stake:** a cross-country move; picking the moving date and surviving the
logistics month.

- **D1:** checks "I don't know my birth time" — honest copy tells him exactly
  what stays locked (`App.tsx:597-608`). No fabricated Ascendant anywhere
  (07-08's fix holds across a month of surfaces).
- **W1:** everything universal works: tide, elections, planner, stars. On
  Aims, BearingsCard renders *nothing at all* ("profections would be a guess —
  stay quiet", `BearingsCard.tsx:49-52`) — but it vanishes silently; he saw
  screenshots online with the "THIS YEAR" card and assumes his app is broken.
  Honest ≠ explained: an empty state ("locked without a birth time") exists in
  Settings but not where the absence is felt.
- **W2:** Begin for "move house": day-13 window "A great time" (Moon waxing,
  no void, hour match); books the truck for it. The per-rule receipt list
  makes the decision legible to his skeptical partner.
- **W3 (move week):** the travel detector fires on arrival — device tz ≥2h
  from saved longitude → "📍 In a new place? Tap to update your sky"
  (`Today.tsx:863-877`). One tap re-fixes. Quietly excellent.
- **W4:** post-move, the stake is spent. The personal layer he can't unlock is
  the layer that would have retained him ("what does this move *mean*" is a
  Currents question, doubly locked: no birth time, and no Currents surface).
- **Peak value:** move-date election + travel re-fix. **Peak friction:**
  unexplained absences where personal features would be.
- **Retention:** D7 ✓ · D14 ✓ · D30 ✗. **Pays:** no — the paid layer is
  honestly, but completely, closed to him.
- **Queued changes:** (b) helps mildly (his month *was* a visible pile of
  done-things). (a), (c) neutral.

## 11 · Marcus, 38 — bootstrapped founder, product launch (small-business
owner, electional-heavy)
**Stake:** launching his SaaS on a date he must pick in week 1 and defend to
a cofounder; the month's marketing spend hangs on it.

- **D1–2:** the credibility checks (accurate ephemeris, whole-sign, VoC
  handling) pass as of 07-20; a month adds the deeper test — **does the engine
  contradict itself anywhere?** Mostly no; the one wobble is the ③-vs-①
  vocabulary fight on the Calendar strip (same as Luna).
- **W1, the election:** Begin → "launch." Windows: day 11 ★ great-tier
  (personalized — natal layer), day 19 ● good, everything after day 21 carries
  the Rx block. Picks day 11, "＋ Put it on my calendar," and — the part the
  07-04 study asked for — asks **Ask** about the choice with the election
  context riding along (`App.tsx:810-812`); the advisor answers using the
  engine's windows as given facts, not vibes. This whole chain
  (Begin → receipts → calendar → Ask) is the app's best composed journey and
  it worked start to finish.
- **W2 (launch day 11):** launch goes fine. He knows better than to attribute;
  he notices anyway.
- **W3:** post-launch metrics watching; app use = water-ahead strip + Begin
  for "announce v2 pricing" (blocked by Rx; defers — second real decision).
- **W4:** GCal chip still "coming soon" on the beta server; his calendar
  blindness irritation from 07-04 returns as a slow leak. Monthly verdict to
  cofounder: "weirdly rigorous; I'd pay if it saw my calendar."
- **Peak value:** the Begin→receipts→calendar→Ask chain for a decision with
  real money attached. **Peak friction:** GCal (still; three studies running).
- **Retention:** D7 ✓ · D14 ✓ · D30 ✓ (event-driven, not daily). **Pays:**
  yes at launch-month intensity; churn risk in quiet months — the electional
  user's natural shape is *episodic*, which monthly subscription pricing
  fights.
- **Queued changes:** (c) positive — he quotes verdict labels to his
  cofounder, and one scale quotes better than five. (a)/(b) neutral.

## 12 · Maya, 27 — Co-Star refugee, phone-only (retention-risk casual)
**Stake (soft, which is the point):** new job started this week; wants to feel
less scattered. The app competes with a TikTok scroll, not with a tool.

- **D1:** loveliest onboarding of the roster (2 min, likes the key-not-
  password). Hero card tone lands. Shares the day card to her close-friends
  story.
- **D2–3:** returns twice — residual novelty. Taps "Enable" on the
  notification banner, browser prompt, grants… "Push isn't configured on the
  server yet." Shrugs. (That's her last interaction with the retention
  system, because that *was* the retention system.)
- **D4–9:** two opens. The morning card is nice *when she's in the app*; the
  app has no way to be in her *day*. Her Co-Star habit was push-formed;
  Compass asks her to self-initiate against TikTok's pull.
- **D12 (Sunday):** doesn't open it; never learns reviews exist.
- **D13–30:** one open (day 22, bored on a train; rates the day "Aligned,"
  reads the hero, leaves). App survives on her phone in a folder. D30 it's
  functionally dead.
- **Peak value:** the aesthetic and tone (real, but weightless without a
  loop). **Peak friction:** structural — with pushes dead, email keyless,
  and reviews ambush-gated, **the app's only return mechanic for a casual is
  the user's own discipline**, which is the one thing the casual persona
  doesn't have.
- **Retention:** D7 ~ · D14 ✗ · D30 ✗. **Pays:** no.
- **Queued changes:** none rescue her — (a)(b)(c) all improve the in-app
  experience she isn't in. Her fix is operational (VAPID key + email key on
  the server), not design.

---

# Part A — Top 10 findings (personas hit × severity)

1. **The return loop is dead in beta conditions, and the app knows it.**
   (12/12 personas; existential for 3.) Push defaults off; with VAPID unset
   the opt-in banner *still shows*, walks users through granting browser
   permission, then fails ("Push isn't configured on the server yet" —
   `pushSubscribe.ts:23`); email reports dead-end on RESEND_API_KEY the same
   way. Every persona's week-2 decay traces here. This is one env-var of ops
   work away from being a design non-problem — but until keys are set, the
   opt-in surfaces should self-hide (probe `/api/push/vapid-key` before
   offering), because a broken promise is worse than no banner.
2. **Currents/caution is orphaned — premium's flagship has no door.**
   (Directly hit: Luna, Amara, Alex; undermines the pay story for 6+.)
   `pages/Currents.tsx` has zero imports; Today's banner points to "Currents
   (under Calendar)" which doesn't exist; Calendar renders ⚠ marks from a
   questionnaire nobody can reach or edit (`Calendar.tsx:1271`). New P0.
3. **The loop is wall-clock while the app collects chronotype.** (Sam
   severely; Priya, Rachel, Ash materially.) RitualCard gates on `<12` /
   `>=18` local (`Today.tsx:773-774`); reviews gate on the literal day;
   felt+journal exist on Today only in the evening slot. Night-shift,
   toddler-evening, and late-riser personas are locked out of loop-closing at
   the exact hours they'd close it.
4. **Reviews are ambush-gated — miss the day, miss the ritual.** (7/12 never
   saw a Sunday review; 8/12 never saw the New Moon review.) Nothing queues or
   carries over (`Momentum.tsx:260-266`). The app's best meaning-making
   surfaces have the worst delivery guarantee, and with notifications dead the
   ambush is nearly always missed.
5. **Felt calibration is localStorage-only — the app's core promise doesn't
   survive a device change.** (Jess catastrophically; all 12 latently.)
   TESTER-NOTES: "the felt-rating is the point… after ~2 weeks it starts
   showing which tides genuinely work for you" — that pattern
   (`Today.tsx:1537-1556`) reads only `obs_felt_*` keys; account-key restore
   brings back everything except the evidence. Recompute from the server-side
   behaviorTags (already stored, already decoded in `logs.ts:276`). New P0.
6. **A contradicted day gets zero acknowledgment.** (Rachel, Jess, Maya —
   the study's required contradiction beat, three ways.) "Off" ratings vanish
   into a ratio that only speaks after ≥2 ratings per character, and only
   under the evening buttons. Reflect-don't-predict is right; *mute* isn't.
   One echo line at rating time ("logged — that's 2 of 5 Surge days that
   didn't fit you") turns the app's weakest moment (being wrong) into its
   most trust-building.
7. **The vocabulary fight is now on the flagship Calendar surface.** (Luna,
   Marcus notice; everyone pays comprehension tax.) The water-ahead strip
   scores days on the favorability tier (③, `qualityScore/7`) while the hero
   speaks coherence (①) — the 07-08 F2 finding, relocated to the new
   top-of-Calendar position. Nine live vocabularies confirmed; unification
   (queued change c) is validated — with the amendments in Part D.
8. **The education layer is unreachable for the modal user.** (Priya, Maya,
   Ash — i.e., mobile + default essential density.) Planets has no tab; the
   teachable-moment door is expanded-only (`Today.tsx:1127`); the Rail is
   desktop-only; Log stamps are the last path and casuals don't open Log. The
   sky-literacy layer — a differentiator — is effectively desktop-expanded
   content.
9. **Calendar integration has a hard ceiling for exactly the personas who'd
   pay most.** (Kenji, Marcus.) Unconfigured = dead chip (three studies
   running); configured = "unverified app" interstitial that corporate
   Workspace policies block outright; Testing mode = silent 7-day token death
   (`GCAL-SETUP.md`); no webcal subscribe URL surfaced for outbound. OAuth
   verification for compass.day is now on the critical path to revenue.
10. **Electional is the confirmed universal wedge — and it converts on
    honesty.** (Positive finding; 11/12 used Begin for a real decision; 4
    changed real-world dates because of it.) The refusal paths — Mercury-Rx
    hard block, retrograde-significator tier cap, "No clean window in this
    span" — did more converting than any great-tier window. Protect the 4th
    verdict step through any vocabulary unification, and give the election a
    shareable/keepable artifact (Dan wanted to text it; Ash wanted to post it).

---

# Part B — Retention table

| # | Persona (stake) | D7 | D14 | D30 | Would pay? |
|---|---|---|---|---|---|
| 1 | Luna — astrologer (course launch) | ✓ | ✓ | ✓ | **Yes** — practitioner tier |
| 2 | Dan — skeptical partner (job start) | ✗ | ~ | ~ | No (family plan only) |
| 3 | Rachel — ADHD freelancer (deadlines) | ✓ | ~ | ✗ | Would have (scheduling) — lost in W3 |
| 4 | Jess — spoonie (flare + return to work) | ✓ | ✓ | ✓ | **Yes** — $4–5/mo |
| 5 | Amara — therapist (breakup; eval for clients) | ✓ | ✓ | ✓ | **Yes**; recommends selectively |
| 6 | Kenji — program manager (go-live) | ✓ | ✓ | ~ | Only with verified 2-way GCal |
| 7 | Ash — content creator (10k push) | ✓ | ~ | ~ | No — but is distribution |
| 8 | Priya — busy parent (return to work) | ✓ | ✓ | ~ | Later, maybe |
| 9 | Sam — night nurse (interview d18) | ✓ | ~ | ✗ | Would have, if loop fit her clock |
| 10 | Alex — no birth time (the move) | ✓ | ✓ | ✗ | No — paid layer honestly closed to him |
| 11 | Marcus — founder (launch date) | ✓ | ✓ | ✓ | **Yes**, episodically — churn risk in quiet months |
| 12 | Maya — casual (new job, vibes) | ~ | ✗ | ✗ | No |

**Aggregate: D7 10.5/12 · D14 8/12 · D30 ~5.5/12 (4 firm + 3 zombie).**
Every D14→D30 loss is loop-mechanics (return pull, clock fit, review ambush),
not content quality. The four firm D30s + would-pays are exactly the 07-20
prediction: astro-fluent, spoonie/meaning, therapist, electional founder.
One caveat on every "would pay": premium currently defaults to *unlocked*, so
all twelve experienced the full product this month. The first act of billing
will be perceived as removal, not addition — grandfather the beta cohort or
gate before the audience grows.

---

# Part C — New P0s (not in any prior study)

1. **Currents/caution orphaned.** `pages/Currents.tsx` unrouted; Today banner
   points at a surface that doesn't exist ("Currents (under Calendar)",
   `Today.tsx:975`); caution ⚠ marks render on Calendar from a questionnaire
   with no remaining entry point, and can't be edited or removed. Fix: route
   Currents (a third Calendar sub-tab, or inside Aims' long-weather band),
   correct the banner copy, restore a caution-edit door (Settings at minimum).
2. **Broken-promise opt-ins under unset keys.** NotificationOptIn renders and
   burns a browser-permission grant before discovering the server can't push;
   the email section similarly accepts a full setup then reports the missing
   key. Both should probe capability first and self-hide (or state beta
   status *before* the permission dance). This is new because the banner
   itself is new since 07-20.
3. **Felt-pattern evidence doesn't survive restore.** The account-key system
   restores data but not the app's headline personal insight; server data to
   recompute it already exists (`behaviorTags`, `logs.ts:276-278`). One
   endpoint + one fallback read fixes the app's core-promise integrity.
4. **The ritual loop ignores chronotype.** New since the ritual cards shipped
   (07-08 era) but never tested against a shift-worker across a month:
   morning/evening gates, quiet hours, and reflection surfaces are all
   wall-clock while chronotype sits in prefs. Gate `ritualMode` on the user's
   stated wake/sleep window, not `localHour`.
5. **Un-editable safety marks** (subset of #1 but worth its own line because
   it's safety-adjacent): a user's self-reported sensitivity flags persist on
   Calendar with no UI to change their mind. For the anxious-user cohort the
   caution feature targets, an un-removable warning is worse than none.
6. **No account-deletion path.** Privacy policy is live at /privacy; there is
   no delete/wipe endpoint or UI anywhere ("Switch profile" only clears
   localStorage — server rows persist). For a beta collecting birth data,
   health passthrough, and journals, this is a compliance-grade gap, not a
   nice-to-have.
7. **(Security notes, pre-GA):** the GCal OAuth callback `postMessage`s to
   origin `'*'` and the `state` param carries the testerId with no CSRF nonce
   (`googleCal.ts:81-83,130`); `/api/studio/cycle.png` uses the tester id in
   the query string as a bearer credential. None bit a persona this month;
   all three bite in public.

---

# Part D — Verdict on the three queued changes

**(a) Reflection folded into the morning glance — SHIP, AMENDED.**
The evidence is strong: the morning "Yesterday felt…" backfill row was the
*only* rating surface Priya and Sam actually used, and next-morning rating is
semantically honest (you know how a day felt after it ends). But two
amendments are load-bearing:
- **Anchor it to the user's day-start, not the wall clock** (Sam is worse off
  otherwise — the fold as designed moves the whole loop to when she's asleep).
- **Fold the rating, not the writing, and don't delete the evening.** Amara's
  processing-journal and Jess's night-logging are the evening card's real
  constituency; make reflection *available all day* (the midday dead zone hurt
  Rachel most) with the morning glance as its default prompt, rather than
  swapping one time-lock for another.
Also note (a) slightly degrades data purity: same-evening and next-morning
ratings are different measurements; tag the rating with when it was made
(the check-in row already carries the date — add a `ratedAt`).

**(b) "Wake behind" strip on the homepage — SHIP, AMENDED (and it's the
highest-leverage of the three).**
It attacks the study's #1 retention mechanic gap with the app's own material:
Rachel's best moment (day-27 Wake discovery) moves to day 2; midday opens get
a purpose; the open-loop psychology ("the wake will answer") becomes visible
daily. Amendments:
- **Replace, don't add.** Today already has up to ~14 potential blocks; the
  strip should absorb the Momentum footer lines and the Dashboard's implicit
  progress duties, or the too-many-oracles finding (07-08 F1) worsens — this
  is the one way the queued change makes things WORSE if shipped naively.
- **Design the empty/quiet state first.** For Dan (one visit, empty ledger)
  and Jess (flare week) a bare progress strip is a guilt surface — the exact
  thing the app has refused to be. Ship it with the existing voice built in
  ("a quiet day in the log is still a day in the log") and hide-or-soften
  below a threshold, and it stays a Compass feature rather than a streak app's.

**(c) One unified grading vocabulary — RETHINK THE SCOPE, THEN SHIP.**
"Replace all nine" is the wrong cut. The nine split into three registers that
must NOT merge, and six that must:
- **Merge (the favorability register):** day-quality tier ③, election
  verdicts ④, election tiers ⑤, resonance ⑥, the 1–7 score ⑧ → one FIT scale,
  which `Launch.tsx:125` has already seeded ("Against the current" already
  spans two of them). This directly resolves the Calendar-strip-vs-hero fight
  (Finding 7) — the strip should draw from the woven reading's judgment, per
  the 07-27 design brief's "render this one object."
- **Keep separate — identity register:** tide character/level (①②) is *what
  kind* of time, not *how good*; folding it into a grade would re-import the
  favorability framing the whole coherence thesis exists to avoid.
- **Keep separate — testimony register:** the felt scale ⑦ is the *user's*
  word against the app's. If the app's grade and the user's rating share
  vocabulary, anchoring contaminates the calibration loop (rating a "Fit" day
  "fit" is an echo, not evidence) — and the calibration loop is the product's
  epistemic spine. Different words, on purpose, forever.
- **Constraint from Finding 10:** the unified scale must keep a true refusal
  step ("Avoid") for elections. Luna and Marcus converted on the app's
  willingness to say no; a four-step scale that softens to three loses the
  electional spine that is currently the best conversion event in the funnel.
The woven register ⑨ (WATCH/counterpoint/patterns) isn't a grading scale and
should be left alone.

**Sequencing note:** none of the three queued changes touches the four
operational P0s (VAPID/Resend keys, Currents routing, felt-pattern restore,
GCal verification). Under beta conditions those four determine more of the
D14→D30 curve than all three design changes combined. Ship (b) with the keys,
(a) behind the chronotype fix, (c) as the language pass alongside the hero
redesign already briefed in `DESIGN-BRIEF-2026-07-27.md`.
