# Tides — 30 Simulated User Journeys · July 4, 2026

Overnight thought-experiment study, run against the app **as it exists tonight**
(post instrument-rail, Simple-calendar, caution-redesign, smart-scheduling,
account-key builds). Every "stuck" moment below is grounded in verified current
behavior, not an imagined UI.

**Honest method note:** these are simulations, not people. They're good at
finding *structural* friction (flows that can't work for a class of user) and
bad at predicting *taste* (what feels delightful vs. cloying). Treat the
friction list as high-confidence, the stickiness list as medium, and the
conversion psychology as hypotheses for the real beta to confirm.

Grounding facts verified in code before writing:
- FREE includes: universal tide/Now, Big Sky, Ahead calendar + manual
  scheduling, Almanac reference, plain Guiding Stars/tasks/habits — and
  (unintentionally?) the **Compass AI advisor, which is ungated**.
- PAID (`lib/premium.ts`): Currents + caution periods (`currents`), smart
  scheduling suggestions (`scheduling`).
- **No birth chart** → Currents shows a clean "no chart" state; anchors hidden;
  universal features all work.
- **Unknown birth time** → silently saved as **12:00** → Ascendant/houses
  computed and presented with full confidence (integrity problem).
- **Phone** → the left rail — the entire Season→Moon→Day→Hour instrument
  ladder, VoC badge, sign chips — **does not render on mobile.**
- Sunrise math: fine to ±60° latitude; polar latitudes fall back to noon±6h.

---

## Part I — The thirty

### Cluster A · Astrology-curious beginners (the growth audience)

**1. Maya, 27 — marketing coordinator, Chicago. Phone-only. Co-Star refugee.**
Knows her big three, downloads anything with a moon. Onboarding is smooth (2
min, likes "no password, here's your key"). Lands on Today: Big Sky cards read
like the personalized-but-kind tone she left Co-Star for. **Stuck:** nothing
fatal, but on her phone she never sees the Season/Moon chips or VoC badge (rail
is desktop-only) — the "levels of signification" live on a device she doesn't
use. **Sticky:** Big Sky "another take ↻"; the calm tide chart. **Verdict:**
free user, daily-ish for 2 weeks — then quietly lapses *because nothing ever
pings her.* Would pay $4-5/mo once personal transits name her actual life.

**2. Jordan, 22 — college senior, TikTok astrology, 15-second attention.**
Skips birth time (doesn't know it — dorm-room energy). Gets a confident
"Ascendant Libra" anyway (12:00 default) and posts it; a fluent friend corrects
them; trust damaged. **Stuck:** the silent-noon problem, plus no shareable
artifact ("this app is pretty, where's the share button?" — share card exists
but is buried in the hero modal). **Sticky:** aesthetics, moon disc.
**Verdict:** bounce in 3 days unless share cards + notifications exist. Never
pays; matters anyway — they're distribution.

**3. Priya, 34 — new mother on leave, London. 2am feeds, fragmented attention.**
Phone-only, uses it during night feeds. UK timezone handled fine (tz-fallback).
**Stuck:** Today page is long on a phone held one-handed; what she wants is
exactly the collapsed instrument strip — which doesn't exist on mobile. The
"night hours" of the app are actually good for her (planetary hours continue
through the night). **Sticky:** the honest quiet-day copy; gentle tone; habit
chips (tiny wins). **Verdict:** free, retained IF the morning glance takes
<10 seconds on phone. Would pay for caution windows once one matches a hard
day ("Moon square your Uranus" on the day the baby didn't sleep = converted).

**4. Dan, 41 — HVAC contractor, zero astrology, wife sent the link.**
Expects to hate it. The weather metaphor works on him — "high water 4pm" reads
like a fishing report. **Stuck:** the word *Helm* means nothing; *Launch*
sounds like a rocket; he doesn't know what a "square" is until he taps (the
explainer is there — he does find it). Never sets a Guiding Star (the star/
astro language on the Helm page feels "not for him"). **Sticky:** planetary
hours as "good hours for paperwork vs. crew work"; the day view of the
calendar. **Verdict:** surprising free retention as a *rhythms app*; will
never use natal features. He's the argument for the roadmap's solar/lunar
non-natal layer. Pays only if his wife shares a family plan.

**5. Sofia, 30 — yoga teacher, Buenos Aires. Southern hemisphere, Spanish-first.**
Moon rituals are her practice; she's the archetypal fit. **Stuck #1:** English-
only copy is dense poetic English — the mythos language that delights native
speakers is work for her. **Stuck #2:** southern hemisphere — the engine's
day-length math is hemisphere-aware (verified), but *cultural* copy like
"Cancer season" carrying summer connotations reads odd in winter; not a bug,
worth one line of copy awareness. Moon's lit side appears mirrored in her sky
(the disc doesn't flip for hemisphere — minor, astronomers notice).
**Sticky:** moon phase + sign front and center; habit resonance ✦.
**Verdict:** devoted free user; pays when localized or when the guidebook
content ships in Spanish (content roadmap intersection).

### Cluster B · Productivity & self-optimization (the planner audience)

**6. Marcus, 38 — startup founder, SF. Notion/Linear native. Skeptic-curious.**
Desktop user (finally, someone who sees the rail). Toggles compact instrument
mode immediately and likes it ("this is a dashboard"). **Stuck:** GCal shows
"Not configured" — for him that's disqualifying; his calendar IS his life.
Smart-scheduling suggests times that collide with meetings the app can't see.
**Sticky:** Launch (he checks it before a product announcement "as a bit, then
not as a bit"); Big Sky as a daily standup read. **Verdict:** trial-pays
immediately (low price sensitivity), churns in month 2 **unless GCal lands.**
The single clearest "one feature = retention" persona.

**7. Elena, 45 — freelance designer. Feast/famine energy, self-employed.**
Wants pacing permission. **Sticky (deepest in study):** the tide as
*permission structure* — "low water day" legitimizes a slow day the way
nothing in hustle culture does. Caution windows read as self-compassion, not
fear. Guiding Stars with season anchors = the first goal system that doesn't
feel like a boss. **Stuck:** week view still assumes 9-5-ish free windows;
her chronotype windows are all over. **Verdict:** the ideal paid subscriber —
converts on Currents ("Saturn crossing your 6th until 2028" lands as a
chapter of her actual life), retained by the weekly rhythm. Design center for
the paid tier.

**8. Tunde, 29 — PhD candidate, chronic procrastinator, skeptic-but-desperate.**
Will try anything with structure. **Sticky:** "best hours for deep work
today" — he uses planetary hours as arbitrary-but-external commitment devices,
which genuinely works for him (the psychology is sound regardless of
astrology). **Stuck:** the deep-work windows aren't exported anywhere — he
wants them in his calendar app (ICS export exists for tasks, not for daily
hour recommendations). **Verdict:** free power-user; pays for smart
scheduling in dissertation crunch; writes the HN comment that's 60% skeptical
and 100% retained.

**9. Rachel, 33 — PM with ADHD. Time-blindness, needs external structure.**
**Sticky:** one-tap smart scheduling is *the* feature — decision-paralysis
removal ("don't make me choose a time"). Habit chips on Now with the resonant
✦. **Stuck (severe):** NO NOTIFICATIONS. A scheduled block that never
reminds her does not exist for her brain. The app's whole loop breaks at the
last step. **Verdict:** pays instantly for scheduling intelligence, churns in
3 weeks without notifications. She is the retention argument for transition
alerts, stated as sharply as possible.

**10. Kenji, 50 — sales VP. Schedules everything, superstitious-pragmatic.**
Uses Launch like his golf-day rituals: edge-seeking. Checks "important
conversation" timing before big client calls. **Stuck:** Launch results give
day-windows but he wants them pushed into the calendar with one tap (Launch →
Ahead is not wired). **Sticky:** Launch categories, the honest "wait —
Mercury clears on the 23rd" copy (he respects a tool that says no).
**Verdict:** pays annually without blinking if Launch→calendar closes.

### Cluster C · Astro-fluent (the credibility audience)

**11. Luna, 36 — professional astrologer, 15k followers.**
Audits the engine in the first hour. Whole-sign Currents ✓, profections ✓,
VoC correct (both recent bug fixes hold) ✓, planetary hours location-correct
✓. Notices: no minor aspects, no declinations, orbs generous, Chiron absent.
**Stuck:** nothing functional — but she needs an "advanced" density (exact
degrees everywhere, an ephemeris table view). The Almanac gets close.
**Sticky:** *Launch* — a usable electional tool is genuinely rare; she'd use
it for client work. **Verdict:** pays for Launch alone; becomes evangelist IF
the engine keeps passing her spot-checks; one public correction from her
account is also the biggest single reputational risk. An "engine methodology"
page (what we compute, what orbs, what house systems) would convert her fully.

**12. Theo, 28 — hobbyist, 8 years deep, desktop.**
Wants his transits precise. Finds Your Transits in the rail, expands all 12,
lives in Currents. **Stuck:** transit list gives orbs but not exact *dates*
("Saturn square natal Jupiter — when exactly does it perfect? all three
passes?"). **Sticky:** Currents chapters with leaves-house dates; Big Sky
takes (he screenshots the "the workout" square framing). **Verdict:** pays
year one; needs transit-timeline depth to stay year two.

**13. Rosa, 68 — lifelong horoscope reader, low tech, tablet.**
**Stuck:** font sizes — the 9-10px instrument text is genuinely unreadable
for her; no text-size setting exists. The account key concept confuses her
("is this my password?"). **Sticky:** the daily read itself; moon phases
(she's tracked them for 50 years). **Verdict:** would be a loyal paid user —
if there were a text-size control and simpler words. Accessibility is not a
nice-to-have; it's this whole demographic.

**14. Ash, 25 — queer astro-meme community. Tone-sensitive Co-Star refugee.**
Auditioning the app's *voice* more than its features. The kind, non-fatalistic
copy passes ("this current runs hot" vs. Co-Star's "you will be betrayed").
**Sticky:** "another take ↻" — the multi-reading philosophy is exactly their
community's ethos (astrology as conversation, not verdict). **Stuck:** wants
to send a specific take to a friend — no share on Big Sky cards. **Verdict:**
free evangelist; converts on relationship features ("our tides", roadmap) the
moment they exist.

**15. David, 55 — semi-pro financial astrologer.**
Tries Launch → financial venture. Gets the hard Mercury-rx block and
timing windows. **Stuck:** wants intraday precision and planetary stations;
also notes the app (correctly) won't advise trades themselves. **Verdict:**
niche paid user for Launch; not a design target, but proof the electional
engine has professional headroom.

### Cluster D · Wellness & meaning

**16. Amara, 31 — therapist.**
Evaluates for herself AND as something clients might use. Scrutinizes the
caution language hard — the redesigned gentle framing ("move big commitments
gently, then it passes") passes her bar; the old always-on version would not
have. **Sticky:** felt-rating retro concept (reflect don't predict) — but she
has to hunt for it. **Stuck:** wants to know what happens to a vulnerable
user on a bad day — the app never claims causation, good; but there's no
crisis-adjacent copy anywhere if someone reads doom into a transit.
**Verdict:** pays; recommends selectively; the "reflect, don't predict"
positioning is exactly what makes it recommendable by a clinician.

**17. Jess, 26 — chronic illness, energy budgeting ("spoonie").**
The tide-as-energy-forecast maps perfectly onto pacing culture. **Sticky:**
low-water days as planned rest; caution windows as flare-planning; the
minimum-viable field on habits. **Stuck:** she needs to *log* how the day
actually went vs. forecast (the felt-rating exists but is localStorage-only
and buried — for her it's the core feature, not an extra). **Verdict:** paid
and vocal in chronic-illness communities IF the reflect-loop is promoted to a
first-class feature. A retention insight: her use is weekly-planning-first,
not daily-glance-first.

**18. Bill, 62 — recently retired, recently widowed. Meaning-seeking.**
Slow, careful desktop user. Reads everything — the only persona who reads
every explainer. **Sticky:** the Almanac reference (Elements/Planets/Signs) —
he treats it like a book; Currents chapters give shape to a shapeless year
("Jupiter in your 11th — a year of community" made him join a walking club).
**Stuck:** none technical; the app just doesn't know how much this matters to
him. **Verdict:** annual sub, highest LTV in the study, and the guidebook
(content roadmap) is *for him*.

**19. Nia, 35 — cycle tracker.**
Finds cycle tracking in Settings (it exists!) and is delighted — until she
sees it surfaces only lightly in timing. **Stuck:** cycle phase isn't a
visible lens next to the four elements; she wants "inner season + sky season"
side by side. **Sticky:** the concept; moon phase adjacency. **Verdict:**
pays if cycle becomes a first-class layer; churns if it stays a settings
curio. (Big differentiator vs. every competitor if done well.)

**20. Owen, 44 — burnout sabbatical. Anti-productivity.**
Wary the app is another optimization machine. The Helm's goals language
initially repels him ("chief aims" = LinkedIn energy). **Sticky:** the tide
itself, VoC as *rest with permission*, the honest quiet-day copy. He uses
Tides as a *not-doing* app — the study's most counterintuitive retention.
**Stuck:** star hint banner nags him to set a Guiding Star he doesn't want;
no "I'm not here for goals" dismissal that sticks. **Verdict:** free,
long-retained, converts eventually for Currents (meaning, not productivity).
Lesson: the goal layer must stay optional-feeling, which mostly it is.

### Cluster E · Edge cases & stress tests

**21. Sam, 29 — night-shift ER nurse. Sleeps 11am-7pm.**
Chronotype form takes her hours fine. **Stuck (needs QA):** her "day" spans
midnight — do free-window rankings and sleep-shading handle a sleep interval
that crosses noon and wake at 19:00? The chronotype helpers were built
day-normal; her case inverts them. Planetary night-hours are actually her
work hours — the app handles the astronomy, but all the *copy* assumes
daytime living ("this morning", "tonight"). **Verdict:** underserved by every
app; even 80%-right here earns fierce loyalty. Needs a QA pass with an
inverted chronotype.

**22. Ingrid, 39 — Tromsø, Norway (69°N).**
Polar day right now: no sunset. The engine falls back to noon±6h synthetic
sunrise/sunset — planetary hours become fiction and high-latitude sun-arc
display breaks down. **Stuck:** no acknowledgment; confident-looking wrong
data. **Verdict:** bounce — acceptable to lose, unacceptable to lie to. One
line of honest copy ("above the Arctic Circle, planetary hours are
approximations") preserves integrity cheaply.

**23. Wei, 33 — Shanghai. UTC+8, VPN-less.**
tz-fallback table covers Asia/Shanghai ✓; hours correct without location
permission ✓. **Stuck:** OpenAI-backed features (Compass, smart-schedule
enrichment) may be slow/blocked; deterministic fallback saves scheduling but
Compass just spins. Needs a timeout+message. **Verdict:** free user; proof
the deterministic-fallback architecture was right.

**24. Alex, 31 — adopted, no birth records.**
Enters date only, honestly skips time and place is a guess. Gets: a confident
Ascendant, houses, profected year — all fabricated off 12:00. Alex knows
enough to know they can't know their rising sign, so **the app claiming one
destroys trust immediately.** **Stuck:** the study's clearest integrity
failure. Needs an explicit "birth time unknown" path: sun-sign+planets-only
chart, houses/ASC/profections suppressed with honest copy ("these need a birth
time"). **Verdict:** bounce today; retained free user with the honest mode.

**25. Fatima, 27 — practicing Muslim, culturally cautious about astrology.**
Interested in *rhythms*, uncomfortable with divination framing. **Sticky:**
planetary hours as structure, moon phases as (real!) Islamic-calendar
adjacency, the weather-not-fate framing throughout. **Stuck:** the app
constantly says "astrology"; a rhythms-first framing (solar/lunar layer from
the roadmap) would let her use 70% of the app comfortably. **Verdict:**
bounce today; the solar/lunar non-natal layer is her (large, global) segment.

**26. Gary, 58 — data scientist, hard skeptic, spouse's request.**
Pokes for falsifiability. Finds the felt-rating retro concept and — to his own
surprise — respects it ("they're at least *logging* prediction vs. outcome").
**Stuck:** the retro is thin (localStorage, 30-day, buried); he'd actually
engage with a real "how right was the tide for you" personal-calibration
view. **Verdict:** never pays, stops mocking. The reflect-loop is the app's
only credible answer to him, and today it's whispered.

**27. Zoe, 19 — broke student.**
Will never pay; wants beauty + share. **Stuck:** share card is buried; no
watermark/branding loop on screenshots people take anyway. **Verdict:** free
forever, and that's fine — she's the top of the funnel. Make screenshots
gorgeous and self-attributing.

**28. Hannah & Mike, 34/36 — couple.**
Want "our tides" — compare charts, plan a hard conversation on a good day.
**Stuck:** doesn't exist (roadmap 5b). They use Launch's "important
conversation" as a stand-in — nice discovery, half the value. **Verdict:**
would pay for a couples feature — the classic viral+paid combo (one paying
account, two retained humans).

**29. Carlos, 47 — restaurant owner. Evenings are his workday.**
Low patience; skipped everything skippable in onboarding. Uses exactly two
things: today's day-view hours and Launch (checked it for a soft-opening
date — the wedding/launch/conversation categories read as "for real life").
**Stuck:** Launch windows don't push to the calendar (same as Kenji).
**Verdict:** utility free user; pays the week he plans the second location's
opening. Launch is a *conversion event* feature, not a daily one.

**30. Deb, 52 — executive assistant, schedules for her boss.**
The wildcard: wants timing intelligence for *someone else's* calendar.
**Stuck:** single-profile assumption everywhere; GCal absent. **Verdict:**
bounce — but she reveals a future B2B-ish wedge (assistants, coaches,
producers timing on behalf of others) worth remembering, not building.

---

## Part II — Friction, ranked by (severity × how many hit it)

1. **No notifications** — breaks the loop for ~24/30 at retention stage;
   *fatal* for ADHD/structure personas (9). The single biggest lever.
2. **Unknown-birth-time silent 12:00 default** — integrity failure; fabricated
   Ascendant/houses presented confidently (2, 24, and any of the ~40% of real
   users who don't know their time). Trust, once lost here, doesn't return.
3. **Phone users never see the instrument rail** — Season/Moon/VoC/sign-chip
   ladder is desktop-only; ~24/30 are phone-primary. The nesting principle
   currently ships only to desktops.
4. **Google Calendar not configured** — disqualifying for calendar-centric
   payers (6, 30; partially 9, 10).
5. **Launch results don't write to the calendar** — three personas convert on
   Launch, then hit a dead end (10, 29, 15).
6. **Nav vocabulary** — *Helm* opaque to non-sailors (4, 20, 29); *Launch*
   ambiguous until opened. (Owner already flagged; personas confirm.)
7. **Reflect/felt-rating loop buried + localStorage-only** — it's the trust
   engine for skeptics (16, 17, 26) and the calibration data moat, currently
   whispered and device-bound.
8. **Compass advisor ungated on free** — cost leak + no conversion pressure;
   also undiscoverable (a 🧭 emoji button named for a metaphor).
9. **Accessibility** — no text-size control (13); tiny 9px instrument text has
   a real demographic cost beyond her.
10. **Inverted chronotypes / polar latitudes / hemisphere copy** — small
    segments, cheap honesty fixes (21, 22, 5).

## Part III — What's sticky (confidence: medium)

1. **Smart scheduling one-tap** — the "magic moment" across planner personas.
2. **Big Sky cards + "another take ↻"** — the daily read AND the tone/ethos
   signal that differentiates from Co-Star-style fatalism.
3. **The tide as permission structure** — low water legitimizes rest (7, 17,
   20). Nobody else in productivity does this. It's a positioning weapon.
4. **Launch** — rare, real, and a conversion *event* (weddings, openings,
   negotiations) rather than daily habit.
5. **Currents chapters** — where paid conversion actually happens: the moment
   the app names *their* year.
6. **Planetary hours as commitment device** — works even for non-believers (8).
7. **Habit chips with resonance ✦** on Now.
8. **The Almanac-as-book** for readers (18) — validates the content roadmap.

## Part IV — Conversion & retention (hypotheses to verify in beta)

**What converts:** (a) a personal transit/caution that lands true once —
"named my week" is the moment; (b) the first smart-schedule suggestion that
fits perfectly; (c) a Launch decision that matters (event conversion); (d)
Currents reading their year back to them. Feature lists don't convert;
*recognition* converts.

**What retains paid:** the daily loop closing (needs notifications), the
weekly report artifact, goals visibly riding seasons, content drip
(guidebook chapters as paid perk), and the retro loop proving its keep.

**Churn signature to watch:** paid users who never granted notifications and
never set a Guiding Star — they bought recognition, then nothing called them
back.

**Pricing sense from personas:** $4-6/mo or ~$50/yr sits fine for 7, 9, 11,
18; students/casuals never pay regardless — don't chase them with discounts,
harvest them as distribution (share cards).

## Part V — Drafted changes (prioritized)

**P0 — integrity & the biggest lever (pre/at beta):**
1. **Unknown-birth-time mode**: an explicit "I don't know my birth time"
   choice → compute planets-only; suppress ASC/houses/profections with honest
   copy; badge the chart "timeless." (Fixes #2; protects trust with ~40% of
   real users.)
2. **Transition notifications v1**: morning tide summary + VoC start + caution-
   day morning + scheduled-block reminders. Push scaffolding exists; this is
   the retention lever (#1).
3. **Mobile instrument strip**: render the compact rail as a horizontal
   glyph strip under the phone top bar (Sun ☉♋ · ☽ 86% ♒ · ◒ · ♀ day · ♄ hr)
   → tap = that section's sheet. Ships the nesting ladder to the device
   people actually use (#3).
4. **Gate or meter Compass** on free (e.g. 3 questions/week free) — cost +
   conversion (#8).

**P1 — conversion path:**
5. **Launch → "put it on my calendar"** one-tap (writes planningWindow) (#5).
6. **Google Calendar OAuth config** on Railway + basic busy-overlay in
   suggestions (#4).
7. **Promote the reflect loop**: felt-rating on the Now page bottom + a
   "your tide accuracy" 30-day view; sync to DB (trust engine for skeptics,
   core feature for spoonie/therapist personas) (#7).
8. **Share cards v2**: Big Sky card share + auto-branded screenshots (Zoe/Ash
   distribution).

**P2 — segment unlocks:**
9. Text-size setting (Rosa) + a contrast pass on 9px text.
10. Solar/lunar non-natal rhythm layer (Fatima, Dan) — already roadmapped;
    personas say it's a *segment*, not a feature.
11. Cycle tracking → first-class lens beside elements (Nia).
12. Inverted-chronotype QA (Sam); polar honesty copy (Ingrid); hemisphere
    moon-disc mirror (Sofia).
13. "Our tides" couples feature (28, 14) — the viral+paid combo, own session.
14. Engine methodology page (Luna) — orbs, house systems, what's computed;
    cheap credibility with the fluent tier.

**Naming note (not a change yet):** personas 4/20/29 confirm *Helm* doesn't
land for non-fluent users. Candidates to test against comprehension: "Steer,"
"Plans," "Stars & Plans." Don't rename in code until tested on humans.

## Part VI — What I learned (themes)

1. **It's two products sharing one body** — a sky-weather app (glance,
   meaning, permission) and a timing planner (schedule, execute). Personas
   cleanly split on which they came for. Onboarding could ask one question —
   "more weather or more planner?" — and weight the first-week surfaces
   accordingly, without forking the app.
2. **Recognition, not features, converts.** Every paid conversion in the study
   was a moment of being *named* — a transit, a caution, a chapter. The
   funnel's job is to engineer one honest recognition moment in week one:
   which argues for showing one personal-transit teaser to free users.
3. **Honesty is the moat.** The reflect-don't-predict stance, the "wait —
   Mercury clears the 23rd" refusals, gentle cautions, and (once built) the
   unknown-birth-time degradation — the trust posture converts the skeptic-
   adjacent majority no competitor touches. Every silent fabrication (noon
   default, polar hours) spends this down.
4. **Rest is a feature.** The anti-productivity personas (7, 17, 20) may be
   the strongest paid cohort: nothing else gives *permission*. Market the low
   tide as hard as the high.
5. **The phone is the product.** The best recent work (instrument rail,
   nesting ladder) is desktop-only. Beta testers will judge the phone.
6. **Free tier's job is distribution, not conversion** — make it genuinely
   good (it is) and shareable (it isn't yet).

## Part VII — Further tests & thought experiments

1. **Real 5-user hallway test** of onboarding + first 5 minutes on phones —
   specifically: do they find the day view? do they understand Helm?
2. **The "week two" simulation** — this study covered first sessions; run the
   same personas at day 10 (what brings them back Tuesday? what's stale?).
3. **Notification content design** — draft the exact morning-summary copy for
   5 personas; the same alert must serve Elena (permission) and Rachel
   (structure).
4. **Unknown-birth-time UX** — prototype the "timeless chart" and test that
   suppressing houses doesn't feel like a broken app.
5. **Price test** — landing page with $4.99/mo vs $49/yr vs $69/yr-with-
   guidebook; measure intent clicks, not opinions.
6. **Comprehension test on names** — show 10 non-users the five tab labels,
   ask what they expect behind each; rename what fails.
7. **Adversarial astrologer review** — pay 2 professionals to break the
   engine before a public one does it for free.
8. **Accessibility audit** — text-size, contrast on 9-10px grays, colorblind
   check on the four element hues (the palette brief already requires it).
9. **A "bad week" simulation** — user hits 3 caution days + a VoC streak +
   a hard transit while depressed: read every word the app would show them in
   sequence; edit anything that compounds.
10. **Cost model** — Compass + smart-schedule enrichment token costs per free
    user at 1k/10k users; decides the metering urgency.
