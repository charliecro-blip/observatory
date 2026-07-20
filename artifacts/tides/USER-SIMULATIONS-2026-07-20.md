# User simulations — 2026-07-20 (Auspice era)

Third pass (after 07-04 and 07-08). **The app is a different product now** than
either prior study saw: rebranded Tides→Auspice, an accurate ephemeris
(astronomy-engine — the outer planets were wrong-sign up to 6% before), the
honest absolute-scale tide chart, the **daily loop** (morning glance → evening
wins harvest → the Wake → weekly/lunation reviews), the **election engine**
(pick any activity → tiered good/great times, natal-personalized), the
correspondence table + sortage, and the Studio content cards. So most prior
friction is moot; this re-runs the 30 personas against what exists today.

Same roster, five clusters. Verdict per persona: **STUCK** (where), **USING**
(what they'd actually return for), **SERVE/MARKET** (how to win them).

---

## Cluster A · Astrology-curious beginners (the growth audience)

The tone and the two new hooks — the daily "favors" read and the election tool
("when should I…") — fit this cluster better than anything we had. The barrier
is the front door.

- **Maya, 27, Co-Star refugee, phone.** USING: the daily Deep/Surge read + the
  shareable day card; the election tool for dates. STUCK: the vocabulary tax —
  Deep/Surge tides, elements-vs-planets, "at the helm" — is charming but it's a
  *lot* to meet at once. SERVE: lead with the plain daily card + the one thing
  it "favors"; let the metaphor reveal itself. The Studio cards are her sharing
  loop — that's the growth engine.
- **Jordan, 22, TikTok, 15-sec attention.** STUCK: **3-step onboarding asks
  birth date/time/location before showing a single reading** → bounce. USING:
  nothing, unless we show value first. SERVE: the day card and the election tool
  need to render on location alone (defer birth data behind "unlock your chart").
  Jordan is a *distributor*, not a retainer — optimize for a shareable he posts.
- **Priya, 34, new mother, 2am fragmented.** USING: the 10-second morning glance
  (one line per star + best window) is perfect for her; the forgiving "days at
  the helm" streak won't punish her missed days. SERVE: this is the daily-loop
  sweet spot for fragmented attention — market the *glance*, not the planner.
- **Dan, 41, HVAC, zero astrology, wife sent it.** STUCK: birth-data wall +
  astrology framing; he needs a concrete reason. USING: possibly the election
  tool if framed as "best time to start the big job" (planetary-hours have a
  folk-practical ring). SERVE: he's a low-probability convert; don't optimize
  for him, but the election tool is the only door that isn't "horoscope."
- **Sofia, 30, yoga teacher, Buenos Aires, Spanish-first.** USING: rest/gentle-
  movement elections, the anti-hustle tone. STUCK: **English-only** (no i18n),
  and her Buenos Aires tz *is* in the fallback table so localization is fine.
  SERVE: Spanish is a real unlock for LATAM growth — flag for later.

## Cluster B · Productivity & self-optimization (THE core fit)

This is now the app's home audience — the daily loop + Guiding Stars → steps →
election times + sortage is a genuine astrology-flavored planner. It's also the
likely paying segment.

- **Marcus, 38, founder, skeptic-curious, Notion native.** USING: the election
  tool for launches, the Guiding-Star breakdown with per-step times. STUCK:
  needs proof it's *real* before he trusts it — **which the accurate-ephemeris +
  classical-electional rigor now delivers** (Mercury-Rx honesty, whole-sign
  houses, "why" lines). SERVE: lead with credibility — "not a horoscope; real
  electional astrology, computed to the arcminute." He converts on rigor.
- **Rachel, 33, PM with ADHD; Tunde, 29, procrastinator.** USING: the morning
  star rows literally answer "what's the ONE next move + when." STUCK: the rest
  of the app *competes* with that one answer — too many surfaces (the #4
  problem). SERVE: for them the app should collapse to *next move + its window +
  a nudge*; everything else is "go deeper." This is the strongest argument for
  the progressive-disclosure front door.
- **Elena, 45, freelance feast/famine; Kenji, 50, sales VP.** USING: the honest
  tide chart (a quiet day *looks* quiet) for energy-budgeting; smart scheduling
  onto good windows. SERVE: "plan with your energy and the sky's timing" — the
  chart's new honesty is the pitch.

## Cluster C · Astro-fluent (the credibility multipliers)

Before the ephemeris fix, this cluster would have caught us out. Now the
astrology is defensible, which turns them from critics into amplifiers.

- **Luna, 36, pro astrologer, 15k followers.** USING: she'll stress-test
  positions first — **now passes** (sub-arcminute) — then the election "why"
  lines, whole-sign houses, VoC/Rx handling. SERVE: she markets *for* us if the
  astrology is right; give her a shareable that credits the method. A
  "practitioner depth" mode (more aspects, house-system control — both partly
  exist) locks her in.
- **Theo, 28, 8-years-deep hobbyist; David, 55, financial astrologer.** USING:
  the election engine is their catnip; David wants electional-for-markets (the
  engine could special-case it). STUCK: they'll want more control/depth than the
  consumer UI shows. SERVE: an "advanced" reveal.
- **Rosa, 68, lifelong horoscope reader, low tech, tablet.** STUCK: the density
  + navigation metaphor overwhelms; she wants a single daily read. SERVE: the
  plain daily card *is* her whole app — the progressive front door should let her
  live there and never see Aims/Plan.
- **Ash, 25, queer astro-meme, tone-sensitive.** USING: the kind, non-punishing
  tone is exactly the Co-Star-refugee draw. SERVE: tone is the moat here.

## Cluster D · Wellness & meaning

The kind tone, the rest elections (VoC = "slack water"), the honest "resting was
reading the water right," and the reflective wins/intentions loop all serve
meaning-seekers — with one landmine.

- **Owen, 44, anti-productivity burnout sabbatical.** STUCK: **the entire daily-
  loop framing — wins, streaks, "progress toward goals" — is the productivity
  culture he's fleeing.** SERVE: the loop must be *dismissable*; for him lead
  with "move with time, not against it," the rest/retreat elections, and hide
  the scoreboard. A "just the weather" mode saves him.
- **Amara, 31, therapist; Bill, 62, widowed, meaning-seeking.** USING: the
  reflective loop, intentions at the New Moon, the gentle framing. SERVE: the
  meaning layer (Currents, the reflective Wake) over the task layer.
- **Jess, 26, spoonie; Nia, 35, cycle tracker.** USING: energy-budgeting via the
  tide chart + chronotype; cycle tracking exists and feeds timing. SERVE: "honor
  your energy" is the message; the honest low-day is the feature.

## Cluster E · Edge cases & stress tests (where it breaks)

- **Wei, 33, Shanghai.** STUCK (**real bug**): the app loads **Geist/Spectral/
  Noto fonts from `fonts.googleapis.com`, which is blocked in mainland China** →
  broken typography and missing glyphs. Self-host the fonts (Baar Sophia already
  is) to serve China at all.
- **Ingrid, 39, Tromsø 69°N.** STUCK: **extreme-latitude daylight isn't handled**
  — tz fallback gives Stockholm (59°N), and there's no polar-day/night logic;
  sunrise/sunset-based planetary hours degrade near the poles. Edge, but real.
- **Sam, 29, night-shift nurse.** SERVED: chronotype shades asleep hours and
  best-times skip them — this works.
- **Alex, 31, no birth records.** SERVED: the "I don't know my birth time" path
  gives a planets-only chart and is honest about what stays locked.
- **Fatima, 27, culturally cautious Muslim.** STUCK: it's still framed as
  astrology; planetary hours have a traditional resonance but positioning is
  delicate. Not a fix, a marketing-honesty note.
- **Gary, 58, hard skeptic.** Won't convert; accuracy blunts his easiest attack.
- **Zoe, 19, broke.** SERVED: free tier is generous (daily tide, elections at
  good-tier, the planner) — the great-tier natal layer is the honest paywall.
- **Hannah & Mike, couple; Deb, 52, schedules for her boss.** STUCK: no shared/
  multi-person mode (though profile-switching exists). Later.
- **Carlos, 47, evening worker.** SERVED: chronotype handles the inverted day.

---

## Synthesis

### Where people get stuck (ranked)
1. **The front door.** Onboarding asks birth data before showing any value, and
   the app presents its full surface at once. This costs the growth audience
   (Jordan, Dan) and confuses the low-tech (Rosa) and the ADHD/procrastinator
   core (Rachel, Tunde) who need *one answer*, not a dashboard. **The single
   highest-leverage fix, and it's the #4 focus question wearing a UX hat.**
2. **Reach/i18n gaps.** Google-hosted fonts break China (Wei); English-only caps
   international growth (Sofia, LATAM).
3. **Tone mismatch for the anti-productivity meaning-seeker** (Owen) — the loop
   reads as hustle unless it's dismissable.
4. **Extreme latitude** (Ingrid) — narrow but real.

### What each segment actually uses → how to do best by them
- **Beginners/growth (A):** the daily card + the election tool + shareable
  Studio cards. Do best: defer birth data; make the daily read and one election
  the free, no-signup hook; the cards are the distribution flywheel.
- **Planners (B) — the core & the wallet:** the daily loop + Guiding Stars →
  timed steps + smart scheduling. Do best: collapse the default view to *next
  move + its window*; sell credibility ("real electional, computed accurately").
  This is where retention and subscription live.
- **Astro-fluent (C) — the amplifiers:** the now-accurate engine + electional
  rigor. Do best: a practitioner-depth reveal; they market for you.
- **Wellness/meaning (D):** the kind tone + rest elections + reflective loop. Do
  best: a "just the weather / move with time" mode that hides the scoreboard.

### The one thing all five clusters share
Every persona — skeptic, planner, astrologer, yoga teacher, night nurse — has a
**"when should I do X" question.** The **election tool is the universal wedge**,
and the best-times content cards are literally its ads. That confirms the
funnel: cards (awareness) → election tool (acquisition, zero-signup, works on
location alone) → the daily loop (retention) → premium (natal great-tier + smart
scheduling). Segment by front door, not by separate apps: a first-run "what
brings you here?" (read the day · find the right time · steer toward a goal ·
just the weather) that *chooses what leads* while everything stays reachable.

### Concrete next actions (prioritized)
1. **Zero-signup value:** render the daily card + a sample election on location
   alone; move birth data to an "unlock your chart" step *after* first value.
2. **Self-host the web fonts** (unblocks China; also faster everywhere).
3. **Progressive front door:** the "what brings you here?" chooser → sets the
   default surface; add a "just the weather" mode (serves Rosa, Owen, Dan).
4. **Ship the usage instrumentation's read** — watch which of the four doors
   actually gets picked before over-investing in any one.
5. Later: i18n (Spanish first), extreme-latitude handling, shared/couple mode.
