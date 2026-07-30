# Paying personas — 2026-07-29 · THE WILLINGNESS-TO-PAY STUDY

A different question from the four studies before it. `USER-SIMULATIONS-2026-07-04`,
`-07-08-RETEST`, and `-07-20` asked *where do people get stuck*. `-07-29-MONTH`
asked *why is this still on their home screen on day 23*. All four measured
**use**.

This one measures **money**: who pulls out a card, for what exactly, at what
price, in what shape — and what specific missing thing caps or kills the sale.

**Method honesty:** these are simulations, not interviews, and the confidence
here is *lower* than in the retention studies, for a reason worth stating
plainly up front. Retention claims could at least be reasoned from mechanics in
the code. Price claims cannot: **the product has never asked anyone for money,
so there is no signal in this repo to calibrate against.** See Part E, exhibit
1. Treat every number below as a hypothesis to test with a real price page, not
a forecast. What *is* high-confidence is the blocker analysis — every capability
credited or denied below was verified in the build first, with refs.

The owner's named target: **high-functioning spiritual creatives** — coaches,
healers, consultants, wellness entrepreneurs, freelance creatives,
practitioners. People who already think astrologically *and* run a real
business. Personas 4 and 9 test the adjacent secular-but-rhythm-curious
professional who'd buy timing intelligence with the astrology turned down.

---

## Grounding — the commercial state of the build (verified 2026-07-29)

Not repeating the MONTH study's product grounding. This is the part that
determines whether a sale can happen at all.

**There is no way to take money, and no identity to attach money to.**
- Zero billing code in the repo. No Stripe, Paddle, Lemon Squeezy, checkout,
  price, or subscription-as-payment anywhere in source or `package.json`.
- No `users` table. Identity is `testerId`, a plain text string, and it is the
  PK of every table (`lib/db/src/schema/testerProfile.ts:3-25`). No email
  column, no password, no role, **no entitlement/subscription field anywhere in
  the DB or API.**
- Auth is a client-supplied header that is never validated against anything:
  `middlewares/testerId.ts:9-26` reads `x-tester-id` (or `?testerId=`), 400s if
  absent, and checks it against no table. Any caller who knows a `testerId`
  reads and writes that user's full record.
- Premium is a localStorage boolean **defaulting to UNLOCKED**
  (`contexts/premium-context.tsx:3-13`). Only 4 client sites gate on it; no
  server route checks it. Every beta tester is living in the full paid product.
- The only email ever captured is the report-subscription field in Settings
  (`Settings.tsx:163`). There is no waitlist form, no account email. **There is
  no list to sell to.**

**There is no way to see who would pay.** `lib/analytics.ts` is 17 lines; 11
events are instrumented (`view`, `density_toggle`, four onboarding events,
`reading_working_opened`, `win_named`, `election_schedule`, `election_ask`,
`email_subscribe`, `task_add`). **Not one is a conversion event.**
`PremiumGate.tsx`, `premium-context.tsx`, `lib/premium.ts`, and the "Explore
premium" button (`ScheduleSuggest.tsx:139`) contain zero `logEvent` calls. No
`paywall_view`, no `upgrade_click`, no `checkout_start`. Studio exports and Ask
usage — the two highest-value and highest-cost surfaces — are entirely
un-instrumented. `GET /events/summary` exists (`routes/events.ts`) with no auth
and no client consumer; the owner would have to curl it.

**The current free/paid line** (`lib/premium.ts:7-14`): FREE is the universal
tide, the calendar, and stars/tasks/habits as a plain planner. PAID is three
features — `currents` (personal transits + caution windows), `scheduling`
(the ScheduleSuggest reading), `practitioner` (the Chart). Tested in Part B.

**What the paid tier actually is today, surface by surface:**
- `currents` — **`pages/Currents.tsx` has zero imports.** Still orphaned as of
  this writing; `Today.tsx:985` still points users to "Currents (under
  Calendar)", which does not exist. The *data* survives (`useCurrents` is read
  by `Dashboard.tsx:39`, `Tasks.tsx:71`, `Planets.tsx:553`,
  `GuidingStarsHub.tsx:103`), but the flagship paid page has no door.
  Partial repair today: `CautionQuestionnaire` regained an entry point in
  Settings (`Settings.tsx:858-871`, commit `aa00ed9`), without Currents'
  sensitivity-derived pre-suggestions.
- `practitioner` — `ChartView` is fully built and **switched off**:
  `SHOW_ADVANCED_MODES = false` (`Planets.tsx:542`). `mode` initialises to
  `"planets"` and nothing else sets it to `"chart"`, so the premium chart is
  currently unreachable even with the flag conceptually "premium-gated" at
  `Planets.tsx:574-578`.
- `scheduling` — the one gate that works as designed. `ScheduleSuggest.tsx:58`
  disables the `/api/associate` reading when locked; `:131-142` shows a teaser;
  `:43` auto-opens a fully functional free manual picker. Correct shape, small
  feature.

**What is free and shouldn't necessarily be:** the entire election stack
(`ElectionPicker`, Launch's Begin, `/api/elections/*`), the Planner's AI weave
(`plan.ts`), Ask (`advise.ts`), Guiding Stars' AI diagnosis (`/api/associate`),
breakdowns (`planning.ts`), Studio. The MONTH study found elections to be the
universal conversion event (11/12 personas used Begin for a real decision, 4
changed real-world dates). **The best-converting surface in the product is
free, uncapped, and the most expensive per use.**

**Unit economics are unmeasured.** Eight LLM call sites: `gpt-5.4` (oracle chat
`routes/openai.ts:136`, body weather `bodyWeather.ts:290`), `gpt-4o` (blueprint
`blueprint.ts:232`, advise `advise.ts:222` with `max_tokens: 400` on a very
large system prompt), `gpt-4o-mini` (chart explicate, associate, plan parse,
planning breakdown). The only control is `aiLimiter` — 30 req/hour, in-memory,
keyed on the **forgeable, unvalidated** `x-tester-id` header
(`app.ts:44-54, 85-97`). Resets on deploy, doesn't hold across instances. No
token accounting, no spend table; `usage_events` records `event`/`props` only
(`lib/db/src/schema/usageEvents.ts:9-15`). **Gross margin at any price is
currently unprovable.**

**What could become a practitioner product, already built:**
- `routes/engine.ts:57-70` — `parseBirthProfile(body)` computes a natal chart
  from **ad-hoc birth data in the request body**, fully decoupled from
  `testerId` and the DB. Powers `POST /engine/transits`, `/engine/reading`,
  `/engine/find-time` behind static bearer tokens (`ENGINE_TOKENS`, off by
  default). The compute layer for "someone else's chart" exists today.
- `natal_charts.tester_id` is **not unique** (serial PK; `drizzle/0000:60-71`).
  The schema already permits N charts per user. What enforces one-per-user is
  14 query sites all shaped `.where(eq(natalCharts.testerId, id)).limit(1)`
  (`natal.ts:11-18`, `chart.ts:20-22`, `currents.ts:25`, `reports.ts:67`,
  `elections.ts:50`, `advise.ts:92`, `blueprint.ts:156,184`, and 7 others).
- `natal_blueprints` is already chart-scoped, not tester-scoped
  (`natalBlueprint.ts:6`; cache key `(testerId, natalChartId, promptVersion)`
  at `blueprint.ts:191-196`).
- `ChartWheel` (`components/ChartWheel.tsx:25-35`) and `TransitTake`
  (`TransitTake.tsx:15-25`) are **pure and identity-free** — props in, wheel
  out. They don't know whose chart they're drawing.
- `GET /api/reports/preview?span=day|week|month|newmoon&format=html`
  (`reports.ts:385-404`) renders a complete written report in HTML from the
  deterministic `lib/interpretation.ts` layer — **no LLM**. This is 80% of a
  client handout.
- **No PDF path anywhere.** No `jspdf`, no `puppeteer`, no `window.print`, no
  `@media print`, no print stylesheet in any file. No `/share/` route, no
  tokenized public read.
- **No synastry, no second-person code**, and it's a declared non-goal
  (`ENGINE-API-SPEC.md:79`).

**Studio, precisely** (`components/Studio.tsx`): 3 subjects (day / week /
lunation, `:23`), 2 formats (story 1080×1920, post 1080×1350, `:340` — **no 1:1
square**), 4 themes (`:26-31`). Real PNG download at full res via canvas
(`:295-322`), not a screenshot. Branding is **hardcoded and uneditable**: the
`Chrome()` function stamps `COMPASS` + "move with time" on every card
(`:106-110`); no handle field, no logo, no custom text. No batch, no scheduling.
Meanwhile the server has `/api/studio/best.svg|.png` with `?span=week|month`,
`?activity=effort|rest|connection|study`, and `?start=` for batching a month of
cards ahead (`routes/studio.ts:53-86`; documented `DESIGN-HANDOFF-STUDIO.md:66`)
— **built, working, and surfaced nowhere in the client.**

**The "turn the astrology down" toggle is partial.** `astroDetail`
minimal/medium/full (`lib/preferences.ts:37-42`) has a central gate function,
`astroReveal()` (`:59-71`), and it is consumed at exactly **three** sites:
`Rail.tsx:417`, `Today.tsx:520`, `WovenReading.tsx:40`. The Planner's
planet-derived rationale, ElectionPicker's hour rulers, Guiding Stars'
planet diagnosis, Calendar, and Planets are all ungated by it. A secular user
on "minimal" still meets planets three taps in.

**Comparable pricing used below is from memory and approximate** — Co-Star Plus
~$8/mo, The Pattern Plus ~$8-15/mo, CHANI ~$12/mo or ~$100/yr, Astro Gold ~$40
one-time, Solar Fire ~$350 one-time, Sunsama ~$20/mo, Motion ~$34/mo, Reclaim
~$10-18/mo, Canva Pro ~$15/mo, Later ~$25/mo, Acuity ~$20-49/mo,
SimplePractice / Practice Better ~$69-99/mo, Kajabi ~$150/mo. **Verify current
prices before building a pricing page on them.**

---

# Part 0 — Ten people who might pay

Format: business → what they pay for now → monthly software budget → the job →
honest reservation → **the card moment** → **price & shape** → **the blocking
capability (grounded)** → **3-month churn risk**.

---

## 1 · Vela, 38 — professional astrologer, consulting practice

**Business:** ~40 client consultations/year at $250, a $400 self-paced course,
a small Substack. Roughly $18k/yr from astrology, supplemented by editing work.
**Currently pays:** Solar Fire (~$350, bought once in 2019), Astro Gold on her
phone (~$40 one-time), Acuity ~$20/mo, Kajabi ~$150/mo for the course, ChatGPT
Plus $20/mo, Notion free. **Software budget:** ~$250/mo, of which $170 is
Kajabi and she resents it.

**The job:** two of them, and they price very differently.
(a) *For herself*, $10-ish of professional curiosity — she wants to see whether
someone finally built an honest one. (b) *For her practice*, she hand-scans an
ephemeris to elect dates for clients — weddings, business filings, surgeries she
declines — and it takes her 40 minutes a pop, unbillable. Compass's engine does
in three seconds what costs her an hour a week.

**Honest reservation:** she'd be putting her professional name on Compass's
synthesis, and the synthesis is a box she cannot open, override, or footnote.
She can see the testimony table but not change a weight. If the app calls a day
"great" and she disagrees on classical grounds, she has no way to say so in the
output she hands a client.

**The card moment:** the first time she runs an election **for a client's
chart** instead of her own and it saves her the 40 minutes. That moment cannot
currently happen. `routes/elections.ts:46-56` loads the natal chart by
`testerId` and only `testerId`; there is no subject parameter on that or any of
the other 13 chart reads. Today the only way to do it is to log out of herself,
create a new tester, and re-enter a client's birth data — destroying her own
data every time. So today she pays the *curiosity* price, not the *practice*
price.

**Price & shape:** **$9/mo personal today; $39-59/mo the day client charts
exist.** Annual preferred — she runs her business on annual renewals in January.
Justification: she will not compare this to Co-Star, she'll compare it to Solar
Fire ($350 once, does no timing automation and no client delivery) and to Acuity
($20/mo, which she pays without thinking because it saves her scheduling
emails). A tool that saves an hour a week of unbillable ephemeris work at
$250/hr rates is trivially worth $59/mo. **The 4-6× price delta between her two
prices is the single largest pricing fact in this study.**

**Blocking capability:** multi-chart / client mode. **It genuinely doesn't
exist** — no clients table, no subject param, no second-person concept
anywhere. But it is much closer than it looks: the schema already permits N
charts per tester, `natal_blueprints` is already chart-scoped, `ChartWheel` and
`TransitTake` are pure, and `engine.ts:57` already computes charts from ad-hoc
birth data. What's missing is persistence, a param, a roster UI, and — the real
precondition — a real account to hang ownership on.

**Secondary cap:** no client-facing artifact. She'd want to email a client "here
are your three windows and why." `reports.ts:385` renders exactly that shape of
document in HTML but only for the logged-in tester, and email sends only to the
tester's own stored address (`reports.ts:437-444`, one address per tester,
`emailSubscriptions.ts:12` unique).

**3-month churn:** moderate at $9 (she'll have learned the engine's rules and
gone back to Solar Fire), low at $39 *if* client charts ship (a tool inside a
client workflow doesn't get cancelled). The failure mode is subtler: she'll
churn if she catches the engine being wrong once in front of a client. Note that
four real engine bugs were fixed *today* (commit `1511ff8`) — including the Moon
being unable to detect a conjunction. She is the persona for whom a public
regression suite against known sky dates is worth more than any feature.

---

## 2 · Imani, 34 — somatic coach & breathwork facilitator

**Business:** 12 one-to-one clients on $200/mo retainers, a monthly $65
workshop (~20 seats), a twice-yearly $900 retreat. ~$45k/yr.
**Currently pays:** Acuity ~$20/mo, Squarespace ~$23/mo, Stripe fees, Notion
$10/mo, ConvertKit ~$29/mo, ChatGPT $20/mo. Co-Star free, The Pattern free.
**Software budget:** ~$130/mo and she counts it.

**The job:** two halves that the app currently serves very unequally.
(a) *Pick dates that fill.* She already schedules new-moon circles by the moon;
she's doing this manually with a lunar calendar app. (b) *Don't burn out.* Six
client days a month leave her flat; she wants to know which days to stack and
which to protect. The chronotype + tide + felt-rating loop is genuinely built
for this.

**Honest reservation:** she has been burned by "spiritual SaaS" — pretty apps
that turned out to be a Notion template with a moon graphic. She'll want to see
the app be *specific* and be *wrong sometimes* before she trusts it.

**The card moment:** she schedules an August workshop on a window Compass called
great, and it sells out, when June's — which she picked around her own calendar
— didn't. n=1 and she knows it, and she pays anyway. That is how this segment
buys, and pretending otherwise is the mistake.

**Price & shape:** **$99/year** (~$8/mo equivalent), annual, paid in January
alongside her Squarespace renewal. She will resist $15/mo monthly and accept
$99 annual for the same money — her business runs on annual renewals and she
budgets tools once a year. If a practitioner tier existed with client charts,
she'd go to **$300-540/yr**, because 12 retainer clients × $200 makes a $45/mo
tool a rounding error against a single retained client.

**Blocking capability:** a client-facing, *her-branded* timing artifact. She
wants to post "the next circle is Aug 12 — here's what the sky is doing" and
have it look like her brand, not Compass's. This exists as three separate
half-things: (i) `/api/studio/best.png` renders exactly the best-times card she
wants, with `?span` and `?activity` params, **and has no client UI**
(`studio.ts:68-86`); (ii) `Studio.tsx` has a working PNG export but only
day/week/lunation, and stamps `COMPASS` + "move with time" on every card with no
way to change it (`Studio.tsx:106-110`); (iii) there's no 1:1 square, which is
half her posting. **So: the app does this badly and invisibly, not not-at-all —
which makes it the cheapest of the top-five fixes.**

**3-month churn:** seasonal and real. Her workshop cadence is monthly; between
launches the daily loop is optional, and nothing pulls her back — push is
non-functional pending `VAPID_PUBLIC_KEY`, email pending `RESEND_API_KEY`. An
annual price is the honest hedge against her episodic use; a monthly price
would lose her in the first quiet month.

---

## 3 · Dr. Renata, 45 — functional-medicine practitioner

**Business:** cash-pay integrative practice, ~60 active patients, $280 intake /
$160 follow-up. ~$220k/yr.
**Currently pays:** Practice Better ~$99/mo, Fullscript (free, revenue-share),
a bookkeeper $300/mo, malpractice insurance, an EHR migration she's dreading.
**Software budget:** $600+/mo and she's used to paying real prices without
negotiating.

**The job she'd want:** circadian and lunar pacing protocols for chronic-illness
patients. She already prescribes chronotype-aware routines. The felt-rating
ledger + tide + chronotype stack is, on paper, a beautiful adherence tool.

**Why she is a deliberate non-customer, and why that's correct:** the app
refuses her use case by design. Launch carries a standing disclaimer that
health, surgical, and medical timing are out of scope (`Launch.tsx:411-414`);
the marketing guardrails say the same (`MARKETING-HANDOFF.md:54`). Even if the
product wanted her, she cannot put patient birth data into a service whose
identity is an unvalidated `x-tester-id` header (`middlewares/testerId.ts:9-26`)
with no account-deletion path — her insurer's first two questions, both failed.

**The card moment:** never, for the practice. She might pay $9/mo for herself.
The realistic value here is **referral, not revenue** — she'd recommend it to
patients as a self-pacing tool if there were a patient-facing one-pager, which
there isn't (no PDF, no print stylesheet, no share link).

**Price & shape:** **$0 as a practitioner. ~$9/mo as a consumer, low
enthusiasm.**

**Blocking capability:** none that should be built. She's here to mark the
boundary: **the health-practitioner adjacency looks like the richest segment on
the spreadsheet and is a liability trap.** The product's refusal is a feature.
Do not chase her; do build the patient-facing one-pager, because it's the same
build as Vela's client handout (Part A #3).

**3-month churn:** n/a.

---

## 4 · Tomas, 41 — brand strategist, solo consultant

**Business:** $180/hr, 4-6 retainer clients, ~$210k/yr. Secular. Would describe
himself as "rhythm-curious, astrology-agnostic" and does the Mercury-retrograde
joke about 70% ironically.
**Currently pays:** Notion $10, Superhuman $30, Calendly $15, Descript $24,
Claude + ChatGPT ~$40, Fathom $19, Dropbox. **Software budget:** ~$200/mo, all
expensed, all approved by him.

**The job:** "when do I do deep work and when do I take calls." He is the
Sunsama/Motion buyer who bounced off both — Motion for over-automating, Sunsama
for being a beautiful to-do list he had to feed daily. Compass's Planner is the
first weaver he's seen that has a *theory* about why 10am is different from 3pm.

**Honest reservation:** he will not have planetary glyphs on screen when he
screenshares with a client. Full stop. This is not squeamishness about
astrology — he's happy to believe there's something to circadian and lunar
rhythm — it's a positioning risk in front of people who pay him $180/hr.

**The card moment:** the moment the Planner writes to his **actual Google
Calendar** and he stops maintaining two schedules. That's the entire sale, and
it is precisely the thing the app cannot do.

**Price & shape:** **$20/mo, monthly, expensed.** He pays Superhuman $30
without blinking; $20 for a calendar tool is below his consideration threshold
entirely. He will not pay annually for anything he hasn't used for six months.

**Blocking capability — two, both real:**
1. **Calendar write-back.** "＋ Put it on my calendar" (`Launch.tsx:167-185`,
   `:224`) POSTs to `/api/planning/windows` and inserts a row in the app's own
   `planningWindows` table (`planning.ts:369-388`), surfacing on the in-app
   Ahead view. Google Calendar is **read-only** — `routes/googleCal.ts` exposes
   status/auth/callback/events/disconnect and no insert. ICS exists as a one-shot
   export (`exportIcal.ts:30`) and a feed (`ical.ts:17`), with no subscribe URL
   surfaced in Settings. On top of that, the OAuth app is unverified — on his
   corporate Workspace, admin policy blocks it outright (`GCAL-SETUP.md:38-44`).
   To be clear about the depth of this: the Planner *does* respect GCal busy
   times, read-only, passed client-side (`Planner.tsx:76-86`, consumed
   `plan.ts:248-254`). It reads his calendar and cannot write to it. That is
   the most frustrating possible half-integration.
2. **Vocabulary.** `astroDetail: "minimal"` exists and is honest about intent
   ("a plain weather app: guidance and best times, no glyphs, no aspect/planet
   jargon", `preferences.ts:37-38`), with a clean central gate `astroReveal()`
   at `:59-71` — consumed at **three sites only** (`Rail.tsx:417`,
   `Today.tsx:520`, `WovenReading.tsx:40`). The Planner's rationale is
   planet-derived and ungated; ElectionPicker shows hour rulers; Guiding Stars
   shows the planet diagnosis. He turns the astrology down and meets Saturn
   three taps later. **This one is 60% built and needs finishing, not
   inventing.**

**3-month churn:** high without #1 (he simply never converts), moderate with it.
The specific churn event: a client escalation blows up his week, the Planner's
committed placements go stale, and nothing prompts a re-weave. `plan.ts` has no
re-weave-on-disruption path; commits are one-shot inserts
(`plan.ts:362-388`).

---

## 5 · Sable, 29 — tarot reader & astrologer, 48k Instagram followers

**Business:** $15 quick readings (~40/mo), a $9/mo Patreon with 220 members
(~$2k/mo, her floor), affiliate income, occasional brand deals. ~$45k/yr, most
of it recurring.
**Currently pays:** Canva Pro ~$15/mo, Later ~$25/mo, Descript $24/mo, Patreon
fees, a $40 astrology app she uses for chart screenshots. **Software budget:**
~$150/mo, and every line of it is a content-production cost she can justify.

**The job:** daily content, forever. Her constraint is not ideas, it's
production time. She currently makes 5-7 assets a week in Canva from a template
she built, hand-typing the day's moon sign from another app.

**Honest reservation:** her audience will recognize a template. If 200 other
readers post the same Compass card, her feed looks generic and she's advertising
someone else's brand for free.

**The card moment:** the first Sunday she batches a week of cards in four
minutes instead of ninety, with her handle on them. That is a straightforward,
unsentimental, ROI-obvious purchase — **the highest-confidence sale in this
roster**, because it doesn't require her to believe anything new; it replaces a
workflow she already funds.

**Price & shape:** **$19-25/mo, monthly.** Justified directly against Canva Pro
$15 + Later $25 which she pays today; if Compass takes over the astrology-card
half of her production, it's competing for that $40, not for Co-Star's $8. She
will pay monthly happily — content tools are opex to her.

**Blocking capability:** three specific gaps in one feature, all cheap.
(i) **No custom branding** — `Chrome()` hardcodes the COMPASS wordmark and
tagline on every card (`Studio.tsx:106-110`); there is no handle field, no logo
upload, no editable text. (Note the naming bug while you're in there: the
wordmark says COMPASS and the download filename says `auspice-${subject}`,
`Studio.tsx:347`.)
(ii) **No batch** — one card, one export click. The *server* already supports
batching a month of weekly cards via `?start=YYYY-MM-DD`
(`studio.ts:41`, `DESIGN-HANDOFF-STUDIO.md:66`).
(iii) **No 1:1 square** — only story 9:16 and post 4:5 (`Studio.tsx:340`).
And the card she most wants — the election/best-times card — renders fine at
`/api/studio/best.png` with `?span` and `?activity` (`studio.ts:68-86`) with
zero client entry points. The one server card that *has* a client door is
`cycle.png`, and only as a bare `<a href>` in `Momentum.tsx:188` that opens a
PNG in a tab for the user to right-click-save.

**3-month churn:** low if branding ships; near-total if it doesn't (she'll
screenshot for a month and stop). Worth noting she may be worth more as
**distribution than as revenue**: 48k followers watching Compass-derived cards
is a better acquisition channel than $25/mo. An affiliate or a free
creator-in-residence seat may beat charging her. Decide deliberately rather than
by default.

---

## 6 · Nadia, 36 — Pilates studio owner

**Business:** three instructors, 180 members, ~$240k/yr. Runs a moon-circle
class and a seasonal retreat; astrologically fluent enough to program by it,
not enough to cast a chart.
**Currently pays:** Mindbody ~$200/mo (hates it, can't leave), Mailchimp
~$50/mo, QuickBooks $30/mo, a bookkeeper $350/mo, Canva Pro. **Software
budget:** ~$700/mo and she signs the checks.

**The job:** the **year**. Every December she blocks two days to lay out the
studio's next-year programming calendar — workshops, retreats, seasonal series,
the newsletter themes that hang off them. She would love that calendar to be
sky-aware, and she'd love it on paper on her wall.

**Honest reservation:** she delegates daily operations. A daily-loop app is for
her instructors, not her, and she won't adopt a habit tool at 36 with a studio
to run.

**The card moment:** December, planning session, laptop open, and she buys a
"year ahead" the way she buys a wall planner and a good notebook — as part of
the ritual of planning the year. She'd pay for a **thing**, not a subscription.

**Price & shape:** **$149-199 one-time, annually recurring by habit** (the
seasonal-planning-artifact shape), plus maybe $12/mo she'd cancel by March.
Compare: she pays a designer $400 for the studio's annual print calendar
already.

**Blocking capability:** the long horizon and the artifact, and both are
genuinely absent. The Calendar's furthest view is the 30-day `QualityStrip` at
the top (`Calendar.tsx:1417`); there is no quarter or year view anywhere.
Reports have a `composeMonth` composer reachable at
`/reports/preview?span=month` (`reports.ts:393`) that is **not an offerable
cadence** — not in the UI, not in the validated span list
(`reports.ts:422` allows only `day|week|newmoon`), never sent by cron. And
there is no print path of any kind: no PDF library, no `window.print`, no
`@media print`, no print stylesheet in the repo.

**3-month churn:** irrelevant for the one-time SKU, which is the point. 100% on
a monthly. **She is the evidence that the product needs at least one non-monthly
shape.**

---

## 7 · Kit, 32 — freelance illustrator, ADHD

**Business:** ~$65k/yr, 5-8 clients, editorial and packaging work.
**Currently pays:** Adobe CC $60/mo (resents), Notion $10, FreshBooks $19,
Spotify, iCloud. **Software budget:** ~$120/mo and every renewal email is a
small crisis.

**The job:** external executive function. She is the persona the MONTH study
lost in week 3 (Rachel), and the loss was mechanical, not preferential — the
morning card genuinely worked as a prosthetic while she opened it.

**Honest reservation:** she has cancelled six subscriptions this year. She
subscribes in a good month and cancels in a bad one, and the bad months are
exactly when she needs it.

**The card moment:** the felt-pattern sentence. In the MONTH study, "Your most
aligned days have been Deep Tide (71% aligned, 7 logged)" was the single
highest-value line any persona received. That sentence is the thing she'd pay
for, because it's *evidence about her* that no other app has. It takes ~2 weeks
of ratings to appear.

**Price & shape:** **$5-7/mo, monthly, with two cancellations and one
resubscribe in the first year.** She will not pre-pay a year. Realistic LTV
under current mechanics: 4-5 months.

**Blocking capability:** not a feature — **the return loop and the durability
of her own data.**
(i) The two return mechanics are both non-functional in beta: push is dead
without `VAPID_PUBLIC_KEY` (and worse, the opt-in banner walks her through
granting browser permission *before* discovering the server can't push,
`pushSubscribe.ts:23`), and email dead-ends on `RESEND_API_KEY`
(`lib/email.ts:18-28`, honestly surfaced at `Settings.tsx:132`). Both are one
env var each. An app for time-blindness that requires remembering to open it is
fighting itself.
(ii) The felt pattern — the sentence she's paying for — is computed from
`localStorage` `obs_felt_*` keys only (`Today.tsx:1537-1556`). The ratings
themselves are mirrored server-side as `behaviorTags` and already decoded in
`logs.ts:276`, but nothing recomputes the pattern from them. **Account-key
restore brings back her data and not her evidence.** For a $5/mo subscriber,
losing the one thing that justified the $5 is a guaranteed cancel.

**3-month churn:** high (~60%) under current mechanics; the loop fixes are worth
more to her LTV than any feature. She's the "many but cheap and churny" segment
— important for the pricing math, dangerous to design for.

---

## 8 · Marguerite, 52 — psychotherapist, private practice

**Business:** 22 weekly clients at $180, ~$180k/yr, 18 years in.
**Currently pays:** SimplePractice ~$99/mo, professional insurance, a
consultation group $150/mo, a supervision hour $200/mo, Calm. **Software
budget:** effectively unlimited relative to the prices in question — she does
not comparison-shop a $12 app.

**The job:** entirely for herself. The Log as a sky-stamped structured journal
(better than her actual journaling app because the day's texture is
pre-written), and the lunar review cadence — not daily, not weekly, lunar —
which is the tempo she'd prescribe if she prescribed anything.

**Honest reservation:** she will **not** put this in front of clients. The
reflect-don't-predict architecture passes her ethics screen — felt ratings never
feed prediction, cautions are self-reported and opt-in, copy never blames the
user — and she still won't, because "my therapist recommended an astrology app"
is a sentence she doesn't want said about her.

**The card moment:** week three, with no drama. She's the lowest-friction buyer
in the roster and the highest-retention. She'd pay before she'd evaluate.

**Price & shape:** **$12-15/mo, and she'd take the annual to stop thinking about
it.** She will never expand a seat count and will never be a practitioner
customer.

**Blocking capability:** none — and that's the finding. **She is the ceiling of
the consumer product**: the highest-income, most-retentive, least-friction buyer
pays $12/mo and nothing will move her above it, because the value is private and
doesn't scale with her business. Every dollar above consumer ARPU has to come
from personas 1, 2, 5, and 10.

One safety-adjacent note in her favor: the un-editable caution marks the MONTH
study flagged as disqualifying were partly repaired today —
`CautionPlanetsSection` now gives the questionnaire a Settings door
(`Settings.tsx:858-871`, commit `aa00ed9`). The Currents-derived
pre-suggestions weren't re-plumbed, but a user can now change their mind, which
was the blocking issue.

**3-month churn:** the lowest in the roster, ~10%. Journals compound; she'll
still be logging in 2028.

---

## 9 · Owen, 44 — indie founder, product consultant

**Business:** a bootstrapped B2B SaaS at ~$8k MRR plus $200/hr consulting.
Secular-adjacent; would say "I don't believe in it, but I've stopped shipping on
Fridays too, so who am I."
**Currently pays:** Linear $10, Vercel $20, Superhuman $30, Notion $10,
Claude Max $100, an accountant $250/mo. **Software budget:** ~$500/mo, all
expensed, all decided in under a minute.

**The job:** one date, twice a year. Launch dates, funding announcements, a
pricing change. The MONTH study's clearest positive finding was that elections
convert — and convert specifically on the app's *refusals* ("Mercury is
retrograde — the tradition blocks this outright"). Owen is that finding wearing
a different hat.

**Honest reservation:** he needs to be able to defend the date to a cofounder
without saying "the app told me." The per-rule receipts do exactly this
(`Launch.tsx:228-232`, failed hard rules listed in red; the Mercury-Rx banner
naming the direct-station date, `:388-398`). He needs to *keep* that.

**The card moment:** launch week. He pays once, at a price he wouldn't blink at,
for one decision. Then he's done for six months.

**Price & shape:** **$49 one-time**, "elect a date" — one activity, the full
scan, the receipts, a keepable artifact, 30 days of access. Or $19/mo for a
launch quarter. **A monthly subscription is the wrong instrument for him and
always will be.** The MONTH study named this ("the electional user's natural
shape is episodic, which monthly subscription pricing fights") and no SKU
exists for it.

**Blocking capability:** the keepable, sendable artifact. Verified absent in all
four possible forms: "Put it on my calendar" writes an internal
`planningWindows` row and nothing leaves the app (`planning.ts:369-388`); the
client Studio has no election card (`Studio.tsx:23`, day/week/lunation only)
while `/api/studio/best.png` renders one server-side with no UI
(`studio.ts:68`); there is no PDF or print path anywhere in the repo; and there
is no `/share/` route or tokenized public read of any kind. He wants to paste a
link in Slack and cannot.

**3-month churn:** **100% by design, and that's fine.** He is not a churn
problem, he is a *pricing-shape* problem. Priced monthly he's a $57 customer who
feels ripped off; priced per-event he's a $98/yr customer who feels well served
and recommends it.

---

## 10 · Priyanka, 39 — wellness brand founder (DTC adaptogens)

**Business:** ~$600k/yr revenue, 3 employees (ops, a marketing coordinator, a
part-time CX), a fractional CMO. Launches a seasonal SKU quarterly and drops
limited runs on new moons — this is already her actual marketing calendar.
**Currently pays:** Shopify $79/mo, Klaviyo ~$150/mo, Notion Team ~$60/mo,
Figma, Gorgias, a fractional CMO at $3k/mo. **Software budget:** $1,500+/mo
and rising.

**The job:** the brand's content and launch calendar. New-moon drops, seasonal
programming, the newsletter themes and the IG calendar that hang off them. She
buys on brand-alignment as much as function — she would genuinely enjoy telling
people her launch calendar is elected.

**Honest reservation:** she doesn't do the work; her coordinator does. A tool
she can't hand to an employee is a tool she'll admire and not buy.

**The card moment:** she never has one personally. Her *coordinator* has one —
and then Priyanka approves an invoice without reading it. That's the largest
single revenue line in this study and the furthest from buildable.

**Price & shape:** **$99-149/mo for a 3-seat brand tier**, monthly, expensed
without discussion. Against Klaviyo at $150 this is unremarkable.

**Blocking capability:** **accounts and seats, which don't exist in any form.**
There is no `users` table; identity is a plain unvalidated string in a header
(`middlewares/testerId.ts:9-26`); the client holds exactly one
`obs_tester_id` (`lib/tester-profile.ts:1-9`) with no list, no switcher, no
"active profile" concept (`contexts/tester-context.tsx:18-33`). There is
nothing to attach a second seat to, no permission model, and no shared
workspace. Everything the app does is single-player at the deepest level of its
architecture.

**3-month churn:** fast if it ships single-player — she'll try it, fail to
delegate it, and stop. Low once a second person's work lives in it.

---

# Part A — Top five missing capabilities, ranked by revenue impact

## Rank 0 (precondition, excluded from the ranking) — real accounts, entitlement, and billing

Blocks **10/10 personas at 100% of their price**, which is why ranking it
alongside the others would waste the exercise. Stated once, precisely:
no `users` table, no email on the profile (`testerProfile.ts:8-25`), no
entitlement or subscription column anywhere, no payment code in the repo, and
an identity that is an unvalidated client-supplied header. Plus: **zero
paywall instrumentation** — 11 analytics events, not one of them conversion
(`lib/analytics.ts`, `routes/events.ts`), so even after billing ships the owner
will be blind to where the funnel leaks unless `paywall_view`,
`upgrade_click`, `checkout_start`, and `gate_hit{feature}` land in the same
commit.

One sequencing warning that costs nothing to heed and a lot to ignore:
**premium currently defaults to UNLOCKED** (`premium-context.tsx:11-13`). Every
beta tester is living in the full paid product. The first act of billing will be
experienced as *removal*. Either grandfather the current cohort explicitly and
loudly, or gate before the audience grows — but do not quietly take Ask and
elections away from people who have had them for a month and expect useful
conversion data.

---

## 1. Two-way calendar: write to Google, verified OAuth, a live subscribe feed

**Blocked or capped:** Tomas (blocked outright, $240/yr), Owen (capped —
"calendar" is where he'd keep the artifact), Imani, Nadia, plus the MONTH
study's Kenji and Marcus who both named it as their sole condition.
**Revenue at stake in this roster: ~$240-500/yr, and it is the credibility floor
for every professional buyer.**

**Grounded:** the integration is read-only. `routes/googleCal.ts` exposes
status / auth / callback / events / disconnect — **no insert**. "＋ Put it on my
calendar" (`Launch.tsx:167-185`) POSTs `/api/planning/windows`, inserting a row
in the app's own table (`planning.ts:369-388`). ICS exists as a one-shot export
(`exportIcal.ts:30`) and a feed (`ical.ts:17`) with no `webcal:` subscribe URL
surfaced anywhere in Settings. The OAuth app is unverified, so corporate
Workspace accounts are blocked by admin policy and Testing-mode tokens die
silently after 7 days (`GCAL-SETUP.md:34-44`). The Planner *already reads* GCal
busy times (`Planner.tsx:76-86` → `plan.ts:248-254`) — it knows his calendar and
cannot write to it, which is the worst half of a half-integration.

**Buildable, in order:** (a) **start Google OAuth verification this week** — it
is weeks of external review and it is on the critical path to revenue, so it
should be running in the background while everything else is built;
(b) request `calendar.events` scope and add an insert endpoint — the button and
the window data already exist, so this is one route and one call site;
(c) surface the existing ICS feed as a `webcal://` subscribe URL in Settings,
which is a one-line UI change that partially unblocks Tomas *today*.

**Why rank 1:** it's the only item that blocks a whole adjacent segment
(the secular professional) rather than capping an existing one, and (c) is
nearly free.

---

## 2. Client mode: multiple charts under one owner

**Blocked or capped:** Vela ($108/yr → $540/yr, a **5× delta on one persona**),
Imani ($99 → $300-540 if she goes practitioner), and it's the on-ramp to
Priyanka's $1,200-1,800/yr.
**Revenue at stake: ~$700-1,800/yr from 2-3 people — more than the other seven
combined.**

**Grounded, and much closer than it looks.** What's missing: a clients table, a
subject parameter, a roster UI. What's already true:
- `natal_charts.tester_id` is **not unique** — serial PK, no unique index
  (`drizzle/0000_gigantic_marvex.sql:60-71`). The schema already permits N
  charts per owner; a migration isn't needed to *store* them.
- The constraint is 14 query sites, all identically shaped
  `.where(eq(natalCharts.testerId, id)).limit(1)`, and one upsert-by-tester
  (`natal.ts:70-86`). Threading a `subjectId` through them is mechanical.
- `natal_blueprints` is **already chart-scoped** (`natalBlueprint.ts:6`, cache
  key `(testerId, natalChartId, promptVersion)` at `blueprint.ts:191-196`) — the
  one derived artifact that survives the change unchanged.
- `ChartWheel` and `TransitTake` are **pure and identity-free**
  (`ChartWheel.tsx:25-35`, `TransitTake.tsx:15-25`). The chart view works as-is
  once the data is parameterized. Flip `SHOW_ADVANCED_MODES`
  (`Planets.tsx:542`).
- `engine.ts:57-70` **already computes charts from ad-hoc birth data** in a
  request body, decoupled from the DB, behind its own bearer auth.

**The hard precondition is Rank 0, not the feature.** A client roster on top of
an unvalidated `x-tester-id` header is an IDOR today and a breach the day it
holds client birth data and session notes. Do not ship client mode before real
accounts.

**Why rank 2 and not 1:** the highest revenue per unit of build, but the market
is small (Part E, exhibit 8) and the precondition is heavier.

---

## 3. A branded, keepable, sendable artifact

**Blocked or capped:** Sable ($300/yr, the whole sale), Owen ($49-98/yr, the
whole sale), Imani (client-facing use), Vela (the client handout), Nadia (the
printed year), Dr. Renata (the patient one-pager, the only thing she'd take).
**Revenue at stake: ~$400-700/yr — and it is by a wide margin the cheapest of
the five to build, because most of it exists and is switched off.**

**Grounded, four pieces:**
- **The election card exists server-side and has no door.**
  `/api/studio/best.svg|.png` with `?span=week|month`,
  `?activity=effort|rest|connection|study`, `?start=` for batching, `?tzLabel=`
  (`routes/studio.ts:53-86`). Nothing in the frontend links to it. The MONTH
  study called best-times cards "literally its ads" — they're built and buried.
- **Branding is hardcoded.** `Chrome()` stamps COMPASS + "move with time" on
  every card (`Studio.tsx:106-110`). No handle, no logo, no custom line. Add a
  text field and an optional co-brand slot.
- **No batch and no square.** One card per click; formats are 9:16 and 4:5 only
  (`Studio.tsx:340`). The server already batches with `?start=`.
- **No document and no link.** No PDF library, no `window.print`, no
  `@media print`, no print stylesheet, no `/share/` route, no tokenized read
  anywhere in the repo. But `GET /api/reports/preview?format=html`
  (`reports.ts:385-404`) already renders a complete written report from the
  deterministic `lib/interpretation.ts` layer with no LLM cost. **A print
  stylesheet plus a tokenized share link turns an existing endpoint into
  Vela's client handout, Renata's patient one-pager, Owen's Slack paste, and
  Nadia's printed year.** This is the single best build-to-value ratio in the
  document.

Also: instrument it. Studio exports currently log nothing (`Studio.tsx` has zero
`logEvent` calls), so the growth loop the product is counting on is invisible.

---

## 4. A return loop that works, and evidence that survives a device

**Blocked:** nobody outright. **Capped: everyone's lifetime value.** Kit's LTV
roughly doubles (4-5 months → 9-12); Imani's and Sable's episodic use stops
being terminal; the MONTH study's entire D14→D30 collapse traces here. At seven
payers this is the difference between ~$700/yr and ~$1,300/yr from the same
acquisitions.

**Grounded, two parts, both small:**
- **The keys.** Push is dead without `VAPID_PUBLIC_KEY` and — worse — the opt-in
  banner walks the user through granting browser permission *before* discovering
  the server can't push (`pushSubscribe.ts:23`, `routes/push.ts:21-23`). Email
  is fully wired end-to-end (compose → render → cron → opt-in → test send) and
  no-ops on a missing `RESEND_API_KEY` (`lib/email.ts:18-28`;
  `notifier.ts:217-218`). Two env vars. Until they're set, both opt-ins should
  probe capability and self-hide — a broken promise is worse than no banner.
  Also note the notifier's sub-preferences are currently theater: quiet hours
  and per-planet shifts never reach the server, and the hour ladder is computed
  from the *first subscriber's* lat/lon for everyone (`notifier.ts:73-74,
  118-120, 138`). That's a trust bug the moment the keys are set.
- **The evidence.** The felt-pattern sentence — the app's headline personal
  insight and the thing Kit is actually buying — reads `localStorage`
  `obs_felt_*` keys only (`Today.tsx:1537-1556`). The ratings are already
  mirrored server-side as `behaviorTags` and already decoded in `logs.ts:276`.
  One endpoint and one fallback read makes the product's core promise survive a
  device change. **You cannot charge a subscription for evidence that a browser
  update deletes.**

---

## 5. The long horizon, and a non-monthly shape to sell it in

**Blocked:** Nadia ($149-199/yr), and it caps Priyanka's quarterly planning and
Imani's retreat programming.
**Revenue at stake: ~$150-400/yr — smaller, but it's the only item here that
unlocks a *pricing shape* the business currently cannot accept.**

**Grounded:** the furthest view in the app is the 30-day `QualityStrip` at the
top of Calendar (`Calendar.tsx:1417`). There is no quarter view and no year
view. A `composeMonth` report composer exists and is reachable via
`/reports/preview?span=month` (`reports.ts:393`) but is **not an offerable
cadence** — absent from the UI, absent from the validated span list
(`reports.ts:422` permits only `day|week|newmoon`), never dispatched by cron
(`notifier.ts:230-241`). So a month-scale product exists in the codebase and
has never been shown to a user.

**Buildable:** a quarter/year quality view (the strip generalizes), promote
`month` to a real cadence, and pair it with #3's print path to make the
December planning artifact Nadia buys. This plus the "elect a date" SKU
(Part B) is how the product stops fighting the episodic buyers who are its most
enthusiastic users.

---

**What is deliberately NOT in this list:** better onboarding, more content, a
nicer hero, vocabulary unification, more astrology depth. All of those are real
work from other studies. **None of them is why anyone in this roster doesn't
pay.**

---

# Part B — Pricing recommendation

## Testing the current line

`lib/premium.ts:7-14` draws it as: FREE = the universal weather + a plain
planner; PAID = *personal* (your chart's cycles, your caution windows) and
*intelligent* (the app finding the time).

**The axis is right.** "The app remembers you and computes for you" is a real,
defensible, cost-aligned boundary, and it matches what these personas actually
value.

**Three specific gates are wrong.**

1. **It gates a surface with no door.** `currents` is the flagship paid feature
   and `pages/Currents.tsx` has zero imports. `Today.tsx:985` sends upgraders to
   "Currents (under Calendar)", which doesn't exist. You cannot sell a tier
   whose hero page cannot be opened. `practitioner` is in the same state behind
   `SHOW_ADVANCED_MODES = false` (`Planets.tsx:542`). **Two of the three paid
   features are currently unreachable.** Routing Currents is a prerequisite to
   any price page, not a backlog item.

2. **It leaves the best conversion event free, uncapped, and expensive.**
   Elections converted 11/12 personas in the MONTH study and 4 of them changed
   real-world dates. Ask, the Planner weave, Guiding Stars' diagnosis, and
   breakdowns are all free too — and they are where the marginal cost lives
   (eight LLM endpoints, `gpt-4o` on a large system prompt for Ask,
   `advise.ts:221-226`). Meanwhile `scheduling` — a small modal that fires after
   task creation — carries a whole named tier. **The gate is on the cheapest
   intelligent feature and off the most valuable ones.**

3. **It makes the paid tier structurally unbuyable for a large minority.**
   Currents requires a birth chart *with a birth time* (`Currents.tsx:66-73`);
   `BearingsCard` renders nothing without one (`BearingsCard.tsx:49-52`). The
   MONTH study's Alex is not an edge case — adoptees, people with no records,
   and anyone born outside a birth-certificate regime that records time are
   permanently unsellable under the current line, having already been onboarded
   honestly and told so.

**The reframe:** move the line from *astrology vs. not* to **memory and delivery
vs. the sky**. Free shows you the sky. Paid remembers you, computes for you, and
gives you something to keep or send. That line is chart-optional, cost-aligned,
and puts the paid gate on things this roster demonstrably wants.

## Recommended tiers

### Free — "the weather"
Today's tide, the Calendar and water-ahead strip, the Log and felt ratings, the
30-day felt pattern, tasks/habits/Guiding Stars as a plain planner, manual
scheduling. Metered: **3 Ask messages/month, 1 election scan/week, 1 Studio
export/week.** No birth chart required.
*Rationale:* keep the habit and the hook free — the felt pattern is the
retention engine and gating it would be self-defeating. Meter the *compute*,
which is where the money actually goes. This also gives you the metering
telemetry you currently have none of.

### Compass — **$9/mo or $79/yr** — "your own weather"
Everything personal and intelligent: Currents (once routed), profections,
personal transits, caution windows, **the Chart** (flip `SHOW_ADVANCED_MODES`),
unlimited elections, unlimited Ask, the Planner weave, ScheduleSuggest,
email reports, push.
*Buyers:* Marguerite, Kit, Vela-personal, Imani-personal, Renata, Sable-personal.
*Justification:* Co-Star Plus ~$8, The Pattern Plus ~$8-15, CHANI ~$12/$100yr.
$9 sits at market for a materially deeper product. **Push the annual hard** —
$79 solves the episodic-churn problem for Kit, Imani, and Sable without
discounting the monthly, and four of these ten run annual tool cycles.

### Studio — **$25/mo or $240/yr** — for people who publish
Compass, plus: custom branding and handle on every card, 1:1 / 4:5 / 9:16
formats, **batch export** (a week or a month at once — the server already does
`?start=`), the **election / best-times card**, and scheduled auto-generation.
*Buyers:* Sable, Imani, Priyanka's coordinator.
*Justification:* against Canva Pro ~$15 + Later ~$25 that Sable pays today. This
tier is the cheapest build in the document and prices at 2.8× Compass.

### Practitioner — **$59/mo or $540/yr**
Everything, plus: **client charts (up to 25)**, per-client election runs, a
client-facing report or handout (print + tokenized share link), and a client
roster.
*Buyers:* Vela, Imani-with-clients, and the on-ramp to a team tier.
*Justification:* do not benchmark against astrology apps — benchmark against the
practitioner software floor. SimplePractice and Practice Better sit at
~$69-99/mo; Acuity at $20-49. Solar Fire is $350 once and does no timing
automation and no client delivery, so it isn't a substitute. $59 is comfortably
inside a practitioner's existing software budget and saves Vela an hour a week
of unbillable work at $250/hr. **One practitioner ≈ 6.5 consumers.**

### One-time: "Elect a date" — **$49**
One activity, the full scan across a chosen span, the per-rule receipts, the
honest refusals, a keepable/sendable artifact, and 30 days of app access.
*Buyers:* Owen; anyone with a wedding, a launch, a filing, a move.
*Justification:* the MONTH study identified that the electional user's shape is
episodic and that monthly subscription fights it. **No astrology app sells a
single elected date as a product**, and it's the closest thing here to a
defensible, marketable SKU — one you can advertise, gift, and rank for.
Nadia's **$149 "year ahead"** is its seasonal sibling.

## What this changes about the roadmap

The tiers above require, in order: route Currents; flip `SHOW_ADVANCED_MODES`;
build accounts + billing + gate instrumentation; add metering to the free tier;
finish Studio (branding / batch / square / election card); add the print +
share-link path; then client mode. **Five of those seven are small.** The two
large ones — accounts and client mode — are the two that unlock everything above
$25.

---

# Part C — The practitioner / prosumer opportunity

## Is it bigger than the consumer app?

For this roster, on ARR:

| | Consumer-only pricing | With Studio + Practitioner tiers |
|---|---|---|
| Vela | $79 | $540 |
| Imani | $99 | $540 |
| Renata | $79 | $79 |
| Tomas | $180 (needs calendar) | $180 |
| Sable | $79 | $240 |
| Nadia | $0 (cancels) | $149 one-time |
| Kit | $30 (churns at 4mo) | $60 (loop fixed) |
| Marguerite | $79 | $79 |
| Owen | $57 (feels ripped off) | $98 (two elections) |
| Priyanka | $0 | $1,188 |
| **Total** | **~$680** | **~$3,150** |

**Roughly 4.6× the revenue from the same ten people, with ~70% of it
concentrated in three.** But ARPU is the less interesting half of the argument.

**The better argument is retention and CAC.** A practitioner has a *business
reason* to open the app — a client session is a deadline, and deadlines are the
one retention mechanic the consumer product has never solved (D30 ~5.5/12 in the
MONTH study, every loss mechanical). And practitioners are distribution: Vela's
40 clients a year and Imani's 12 retainer clients see the output. A consumer
subscriber is worth $79/yr; a practitioner is worth $540/yr *plus* a channel.

**The honest counterweight** is in Part E, exhibit 8: the working-astrologer
market is a few thousand people who'd pay for software, and they already own
Solar Fire. Coaches and facilitators are a much bigger pool but a shallower one
— they'll pay $99/yr readily and $540/yr only if it's load-bearing in client
work. So: **practitioner is the higher-margin business, not obviously the bigger
one.** It is unambiguously the better *first* business, because it's a
smaller number of higher-intent people you can reach by hand.

## What "client mode" needs — minimum viable build

In dependency order. Nothing here is speculative; each line names what already
exists.

1. **Real accounts.** Non-negotiable and it comes first. Today identity is an
   unvalidated `x-tester-id` header (`middlewares/testerId.ts:9-26`), which is
   already an IDOR and becomes a breach the moment it holds other people's birth
   data. A client roster on the current auth model is malpractice.
2. **A `clients` table** — owner, name, birth data, notes, archived. New, but
   small, and it's mostly a wrapper: the chart itself already has a home, since
   `natal_charts.tester_id` is non-unique with a serial PK.
3. **A `subjectId` param** threaded through the ~14 `.where(testerId).limit(1)`
   reads and the upsert at `natal.ts:70-86`. Mechanical, identical at every
   site, testable in one pass. `natal_blueprints` is already chart-scoped and
   needs no change (`natalBlueprint.ts:6`).
4. **A subject switcher.** `ChartWheel` and `TransitTake` are pure and
   identity-free, so the whole chart view works unchanged once the data is
   parameterized. Flip `SHOW_ADVANCED_MODES` (`Planets.tsx:542`) and the
   practitioner surface is live.
5. **Per-client elections.** `routes/elections.ts:46-56` loads the natal chart
   by testerId; same parameterization as (3). This is Vela's actual job.
6. **The deliverable.** `GET /api/reports/preview?span=...&format=html`
   (`reports.ts:385-404`) already composes a full written report from the
   deterministic `lib/interpretation.ts` — no LLM, so no marginal cost per
   client. Add `?subjectId=`, a print stylesheet, and a tokenized share link.
   **This one item is Vela's handout, Imani's client email, Renata's patient
   one-pager, and Owen's Slack paste.** It is the highest-leverage practitioner
   feature and it is roughly 80% built.

**Explicitly out of scope for v1:** synastry and composite charts (a declared
non-goal, `ENGINE-API-SPEC.md:79` — "Constellation's turf"); teams and seats
(that's Priyanka's tier, later); white-label; client logins.

**The defensible wedge is not chart calculation.** Chart math is a commodity and
Compass is worse at it than Solar Fire, which Vela already owns. The wedge is
**electional automation plus a client-ready handout** — the two things
practitioners do by hand, badly, unbillably, and that no existing tool does
well. Build the thing Solar Fire refuses to be, not a worse Solar Fire.

**One more asset worth noticing:** `routes/engine.ts` is already a
machine-facing API with bearer-token auth (`ENGINE_TOKENS`) that computes
transits, readings, and find-time from arbitrary birth data with no DB
dependency. If a practitioner-adjacent B2B story ever matters — a scheduling
tool, a coaching platform, a wellness app wanting elected windows — that
surface exists today and is switched off by default. It is not covered by the AI
rate limiter (`app.ts:85-99` lists no `/engine` path); price and meter it before
turning it on.

---

# Part D — Positioning that converts this segment

## What NOT to say

- **Don't say "productivity."** This segment left productivity culture on
  purpose. "Optimize your output" is the thing they're recovering from, and it's
  the exact register of every tool they've quit. *"Enchanted productivity" is a
  superb internal shape-name and a bad headline* — keep it in the strategy doc,
  where it's doing real work.
- **Don't say "astrology app."** It costs you the secular half (Tomas will not
  screenshare it) and wins you nothing with the fluent half (Vela already owns
  Solar Fire and won't recommend a toy). Say what it *does*; let people find the
  method.
- **Don't promise outcomes.** The product's own guardrail
  (`MARKETING-HANDOFF.md:53`) and the engine's honest refusals are the
  conversion event — the MONTH study found the Mercury-Rx *block* converted
  better than any great-tier window. Marketing that promises breaks the exact
  thing that sells.
- **Don't say "AI-powered."** Every persona in this roster already pays
  $20-100/mo for AI. It's a cost line to them, not a benefit.
- **Don't say:** hustle, 10x, crush, unlock your potential, system, framework,
  "your cosmic CEO," "manifest." Also avoid "co-pilot" and "second brain" —
  both are now noise.
- **Don't lead with the birth chart.** It gates the pitch on data a meaningful
  minority doesn't have and makes them feel excluded in the first ten seconds,
  which is also exactly the group the current paid tier can't serve.

## Five candidates

**1. "For work that doesn't run on a straight line."** — *the hero.*
Names the segment's own self-image without naming astrology or productivity. It
converts Tomas and Vela with one sentence, which nothing else here does. It
carries the owner's real insight — non-linear rhythm is native to creatives —
as a statement of fact about the reader rather than a claim about the product.
It's also unfalsifiable in the good way: nobody argues with it, they just decide
whether it's about them.

**2. "Pick the day. Know why."** — *the paid CTA and the $49 SKU.*
Leads with the confirmed conversion event (elections; 11/12 in the MONTH study)
and with the actual differentiator, which is not the astrology — it's that the
app **shows its work**. Per-rule receipts, the testimony table with weights, and
a willingness to say "no window here." "Know why" is a promise this product can
uniquely keep. Use it wherever money is being asked for.

**3. "An almanac for people who work for themselves."** — *the landing page.*
"Almanac" does enormous work in four syllables: astrologically legible,
secularly respectable, historically *about timing labor*, and already the app's
native register (`MARKETING-HANDOFF.md:52`, "Almanac, not horoscope"). The
second half names the buyer — self-employed people are the ones with a software
budget and a scheduling problem, which is precisely this roster.

**4. "The sky, read like weather. Your week, planned around it."** — *the
subhead.*
Two clauses: the differentiator (honest astrology) and the job (planning). Sits
under #1 or #3 and does the explaining they deliberately don't. The first clause
already exists in the handoff; the second half is what's been missing — the
current framing sells the reading and not the planning, which is the half these
personas would actually pay for.

**5. "Know the tide before you row."** — *keep, demote.*
Already in `MARKETING-HANDOFF.md:45` and it's the best of the existing set:
concrete, non-mystical, and it preserves agency (you still row). But it's a
metaphor without a job — it says nothing about what the software does, so it
belongs on merchandise, the app-store subtitle, or the footer, not the hero.

**For the practitioner tier specifically:** *"Elect your clients' dates in the
time it takes to open the ephemeris."* Speaks directly to the unbillable hour,
in Vela's own vocabulary, and makes no claim about the astrology — only about
the labor. Practitioners buy time back; they don't buy insight.

## One structural note on the secular half

Do not hide the astrology from Tomas — **turn it down and say so.** The same
finding that makes the engine's refusals convert applies to the method: honesty
about how it works converts skeptics far better than obscuring it. The line is
something like *"the method is a 2,000-year-old timing system; you can turn the
vocabulary all the way down and just get the hours."* That claim is currently
only 60% true — `astroDetail: "minimal"` has a clean central gate,
`astroReveal()` (`preferences.ts:59-71`), consumed at three sites only
(`Rail.tsx:417`, `Today.tsx:520`, `WovenReading.tsx:40`), while the Planner,
ElectionPicker, and Guiding Stars all show planets regardless. **Finish the
minimal mode before making the promise**, or the first skeptic you convert
churns in ten minutes.

---

# Part E — The honest case against

What a skeptical investor points at, drawn only from the code.

**1. Nobody has ever paid, and nobody currently can.** No billing, no accounts,
no entitlement field, no email list (the only email captured is the report
subscription at `Settings.tsx:163`). And there is **zero paywall
instrumentation**: 11 analytics events, none of them conversion;
`PremiumGate.tsx` and `premium-context.tsx` contain no `logEvent` at all. So
there is no willingness-to-pay evidence in this repo — not even from a warm beta
cohort — because the product has never asked. **Every number in this document is
a simulation, and the investor is right to say so.**

**2. Premium defaults to UNLOCKED.** `premium-context.tsx:11-13`. The entire
beta has been living in the full paid product. The first conversion data the
business ever collects will be contaminated by loss aversion, which is the
worst possible baseline to price from.

**3. The paid tier's flagship page cannot be opened.** `pages/Currents.tsx` has
zero imports; `Today.tsx:985` still directs upgraders to a surface that doesn't
exist; `SHOW_ADVANCED_MODES = false` hides the practitioner Chart
(`Planets.tsx:542`). Two of the three named paid features are unreachable. You
are proposing to sell them.

**4. Retention isn't demonstrated, and subscription businesses are retention
businesses.** MONTH study: D30 ~5.5/12, and every D14→D30 loss was loop
mechanics. Both return mechanics are non-functional pending env vars, and the
app's headline personal insight — the felt pattern that justifies the whole
subscription — is `localStorage`-only (`Today.tsx:1537-1556`) and does not
survive a device change.

**5. The differentiating layer is gated behind data a large minority can't
supply.** No birth time means Currents is closed (`Currents.tsx:66-73`) and
`BearingsCard` renders nothing (`:49-52`). The current paid tier is honestly,
completely, and permanently shut to them — after the app has already onboarded
them and told them so.

**6. Unit economics are unmeasured and currently unprovable.** Eight LLM call
sites including `gpt-5.4` and `gpt-4o` with large system prompts. The only
control is a 30/hour in-memory limiter keyed on a **forgeable, never-validated
client header** (`app.ts:44-54` + `middlewares/testerId.ts:9-26`) that resets on
deploy and doesn't hold across instances. No token accounting, no spend table,
no per-user cost view. At $9/mo you cannot today demonstrate gross margin, and
the free tier as currently drawn gives away the most expensive surfaces
uncapped.

**7. The security posture fails the practitioner story before it starts.**
Identity is an unvalidated header — an IDOR today, a breach the day it holds
client birth data and session notes. The GCal OAuth callback `postMessage`s to
origin `'*'` with the testerId in `state` and no CSRF nonce
(`googleCal.ts:81-83,130`). `/api/studio/cycle.png` accepts the tester id in the
query string as a bearer credential. There is **no account-deletion path** —
"Switch profile" clears localStorage while server rows persist
(`tester-context.tsx:228`) — despite a live privacy policy. A practitioner tier
is a data-processor relationship; that is the first question a coach's insurer
asks and the answer is currently no.

**8. The market is small and the comparables are cheap.** Consumer astrology
ARPU is anchored at $8-12/mo by Co-Star, The Pattern, and CHANI, none of which
Compass can charge a premium over without a story the App Store page can carry.
The working-astrologer market is a few thousand people worldwide who already own
Solar Fire. The productivity market is enormous and doesn't want the astrology;
the de-astrologized version competes with Motion, Reclaim, and Sunsama, which
are venture-funded and do the calendar part properly — a part Compass currently
**cannot do at all** (read-only GCal, no write).

**9. The best feature is free, episodic, and the most expensive to serve.**
Elections convert (11/12), cost the most per use, are uncapped, and are used a
handful of times a year by the people who love them most. That is the worst
possible shape for a monthly subscription, and there is no SKU for it.

**10. Single-maintainer risk on a product whose whole pitch is rigor.** Four
real engine bugs were found and fixed *today* (commit `1511ff8`) — including
that the Moon could not detect a conjunction or opposition at all, because a
folded 0-180° separation only touches those angles without a sign change. Good
that they were found and verified against real sky dates. The bear reading is
that a product marketed on "we show our work" shipped a beta where a
set-an-intention election could never see a New Moon, and there is no regression
suite pinning the engine to known sky dates. **The credibility infrastructure
matters more to Vela than any feature on the roadmap**, because she is the
persona who will notice, in public, on Instagram, in front of 15k people.

## What would change the investor's mind

Not a feature — a number. Ship a price page behind the four gates, instrument
`gate_hit` / `paywall_view` / `upgrade_click` / `checkout_start`, grandfather the
beta cohort loudly, and come back with **thirty real payers and a 60-day
retention curve**. Everything in this document is a hypothesis until then. The
cheapest way to get that number is Part A #3 (the branded, keepable artifact) —
smallest build, clearest value, two personas whose entire purchase it is, and
it's a growth loop while it's a product.
