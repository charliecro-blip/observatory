# Working Rhythm — adaptive organizational grammar, and the larger project around it

2026-08-21. Owner exercise: "how might we customize/reorient/best serve
different people using this app… use astrology to think through different
design systems." Synthesized from a three-way pass (owner ↔ Claude ↔ GPT);
this doc records the settled frame, the disagreements worth keeping, the
build order, and the full expansion scope (book / sky calendar / research
/ content engine).

Candidate UI strings in this doc are SKETCHES. Anything that ships runs
through `no-ai-slop` at write time, per CLAUDE.md.

---

## 1. The settled frame

**Compass as built encodes one temperament — the owner's.** Day as atom,
reflection as engine, invitational tone, one condition at a time, empty
days honored. Roughly water-earth, sustain-and-reflect. A cardinal-fire
user experiences this as being asked to journal when they want to launch.

**Not different design systems for different astrological types. One
design system with an adaptive organizational grammar; astrology proposes
the settings.** (GPT's amendment, adopted. A "type" ships a skin; a
grammar ships defaults.)

**The chart is the prior. Behavior is the posterior.** Compass says "your
chart suggests you may work this way," then the record — accepted vs.
rescheduled windows, sprint completion, streak breaks, return-after-open-
day, which presentation produced action, felt ratings — confirms,
complicates, or contradicts it. The system is falsifiable per person; the
user can prove Compass wrong, and that is a feature. This is also
Barnum-proof by construction: every style claim cashes out as a default
whose fit gets measured.

**Non-astrological anchor** (so the product problem stands even for a
user who holds the astrology lightly): implementation-intention research
(642-test meta-analysis, Eur. Rev. Soc. Psych. 2024) shows structure
choice affects enactment; regulatory-fit research (Higgins) shows goal
pursuit improves when strategy fits orientation. "Fit over one right way"
has legs outside the symbolism.

## 2. The configuration model: dimensions, not planets

Internally the config is ~6–8 behavioral dimensions Compass already knows
how to alter. Astrology FEEDS the dimensions; it is not the schema.
The planets remain the *narrative interface* — the story told about a
proposal ("Mars in Virgo — sessions want small checkable pieces",
literal-first per the 2026-08-21 full-astro rule) — because that language
is what chart-holders came for. Dials inside, placements in the copy.

| Dimension | Product question | Astro inputs | Existing lever |
|---|---|---|---|
| Planning geometry | mission, route, or menu? | modality, Mercury | sprints / habits / ActivityWeek all exist |
| Answer cardinality | one answer ↔ several options | Mercury, element | "one best window" vs. week grid — both exist |
| Plan persistence | re-optimize readily ↔ protect commitments | Saturn, modality | ScheduleSuggest behavior |
| Action cadence | sprint, sustain, alternate, wait for traction | Mars, element | session runner, sprint spans |
| Progress language | wins ↔ accumulation ↔ touches ↔ reflection | Venus, element | wins/tallies/touches all exist |
| Recovery rhythm | what an "off" day means; when the Log lands | Moon | Log shapes (3 live now), sessionQuiet |
| Planning horizon | current move ↔ day ↔ week ↔ arc | Jupiter/Saturn, modality | uiDensity precedent |
| Goal framing | challenge, craft, curiosity, meaning | Sun/Jupiter | Guiding Stars (already planet-tagged) |

## 3. The three-layer interaction

```
interface = base rhythm × current gear × matter at hand
```

- **Base rhythm** — stable hypothesis from natal chart + onboarding
  contrasts. "You tend to plan openly but execute repetitively."
- **Current gear** — temporary; from transits to the working planets,
  profection year (the time lord foregrounds one functional subsystem —
  a Mars year raises the action profile's weight), current sky style vs.
  natal style, recent actual behavior, and manual override. Gear changes
  arrive as INVITATIONS, yes/not-now: "Your action gear is louder this
  week. Keep decisions tighter and favor shorter pushes through Friday?"
  Astrology as an invitation to temporarily alter the relationship with
  the software — not as election-weight arithmetic.
- **Matter at hand** — the activity's own demands. Deep study needs
  continuity even for a mutable person. Compass already has this layer:
  activityKey, per-activity elections.

This product stops personalization from becoming astrology cosplay:
nobody gets "Mutable Mode" tattooed on their account.

Container ≠ process (the Murakami/Angelou lesson): model **container
preference** and **process preference** separately. A rigid schedule can
exist to induce a trance state; a bare hotel room can exist so the
writing can drift. "Earth person = structured" is the flattening this
distinction prevents.

## 4. The four presets (internal name: trims)

Same vessel, adjusted for the wind. "Trim" solves identity capture
linguistically — trim is adjustable by definition. Customer-facing label:
**your working rhythm**; `trim` stays internal until the metaphor is
learned, after which "Compass has adjusted its trim for this week" can
surface. Onboarding never asks "choose your trim."

- **Campaign** (cardinal) — "What are we moving now?" One current
  objective, clear launch/finish, decisive next action, visible
  completions, permission to archive, little backlog exposure.
- **Route** (fixed) — "What are we protecting and continuing?" Recurring
  slots, chains/tallies, minimal replanning, keep-going over what-now.
  KEY CONSEQUENCE: the engine deliberately declines a marginally better
  election when it would disrupt a valuable routine. The astrology
  yields to continuity.
- **Field** (mutable) — "What is available, and what wants choosing?"
  2–3 viable options, loose containers, late binding, easy swapping, low
  penalty for changed plans. Near-inverse of the historical "one
  strongest fit" philosophy — which is exactly why the exercise matters.
- **Tide** (the current app) — "What has pull?" Mood-gated, fallow days
  honored, check-in before commitment. Kept as the reference trim.

Element modulates the PAYOFF language inside any trim (fire: movement/
challenge; earth: accumulation/evidence; air: connection/possibility;
water: resonance/capacity) — invitation grammar shifts, editorial
personality stays singular.

**Adaptive hierarchy, not adaptive branding.** What varies: hierarchy,
option count, horizon, expanded/collapsed defaults, session shape,
streak semantics, review cadence, prompt language, plan-preservation
aggressiveness. What never varies: the voice, the worldbook, the refusal
moat, honesty rules. No Fire theme, no Pisces gradients.

## 5. Onboarding

Run both streams at once — not "questions first, astrology later."
With a chart: "Compass has a first guess about how you work. Help it get
you right." Then concrete behavioral contrasts (people answer
"structure vs. flexibility" aspirationally; they answer situations
honestly):

- A free afternoon appears → one thing worth doing / the route I
  committed to / a few strong options.
- You miss two days of a routine → restart the streak / keep the total,
  nothing broke / reconsider whether it belongs.
- A better window appears tomorrow → move the work / keep today's plan /
  show me both.

Each answer maps directly to a dial. Disagreement is handled plainly:
"Your chart suggested B. You chose C. We'll use C."

## 6. Free / paid

**Basic accommodation is never premium.** If the default app fights one
temperament's brain, charging to fix that is bad architecture. So:

- **Free**: a manual rhythm choice ("How should Compass meet you?" — one
  clear move / protect my routines / keep options open), basic UI
  adaptation, today's sky.
- **Paid — Astrological Rhythm**: natal-derived composite, per-function
  profile, transit gear-changes, profection emphasis, behavior-driven
  refinement, the history of what rhythms actually worked ("how you've
  actually worked this season"). Premium = "Compass learns your rhythm
  and changes with you" — value that compounds, which is real
  subscription territory and a better paid spine than "the record" alone
  (owner was unconvinced by that one, 2026-08-18).

Marketing object: the composite, never a single sign. "You plan like an
Explorer. You work like a Keeper." The shareable card:

    Your Compass Rhythm
    Planning: Open Field · Action: Route
    Recovery: Tide · Commitment: Campaign

The differentiator is demonstrated in the sentence itself: people
contain multiple working styles. Do NOT market "What's your working
sign?" — it moves toward the shallowest version at the exact moment the
product is deepest.

## 7. Build order (falsification first)

1. **Four dials, no astrology**: answer cardinality, plan persistence,
   progress language, planning horizon. Three extreme presets (Campaign
   / Route / Field) + Tide as reference. Same test account, same
   inventory, same sky; render Home + Shape Day under all four. The
   test: does this feel like four meaningfully different ways of being
   helped? If not, the typology is decorative and astrology won't rescue
   it — stop there.
2. Map charts onto the dials (proposal + literal-first explanation).
3. Behavioral confirmation (the record auditing the prior).
4. Gear changes (transits/profections as invitations).

## 8. The expansion scope

The larger claim underneath: most planning software assumes one theory
of the good organizer (break down, schedule, be consistent, clear the
backlog). Compass's position: there are multiple legitimate ways to
organize a life, and the right structure changes with the person, the
work, and the moment. Astrology suits this as symbolic language because
it is already compositional (a person = many functions) and temporal
(time = qualitatively textured). The product doesn't need astrology to
prove a style causes performance; it uses astrology to ask what
structure might serve this person, doing this thing, at this time.

### 8a. The book

Working thesis: productivity culture's monoculture (its canon is
temperamentally fixed-earth: Atomic Habits is a Route book, GTD is
Mercury-earth, Deep Work is fixed; Four Thousand Weeks is the nearest
water) + the geometries as a natural history of real practice + the
composite self + the sky calendar as lived practice + an honest
epistemology chapter (prior/posterior; how to run your own n-of-1,
which the app instruments — the book's method IS the app's mechanism).

Comps and the gap: Daily Rituals (case studies, no framework), Four
Thousand Weeks (philosophy, no system), The Four Tendencies (typology
productivity that sold — but one-dimensional; ours is compositional).
Nobody has the serious temperament-plural productivity book with
astrology as the language. Precedent for the funnel: Rubin's book →
quiz → audience. The book legitimizes, the quiz distributes, the app
operationalizes — and once the book owns the vocabulary (working
rhythm, trims, the record), the frame is very hard to copy even where
features are not.

Credibility stance: rigorously non-promissory (the house rule IS the
book's voice) — too astro for productivity purists and too empirical
for sun-sign readers is not a bug; that unoccupied middle is the
readership.

Research method for case studies (GPT's direction-of-inference rule,
adopted): observed working practice → identify behavioral dimensions →
THEN ask whether the chart meaningfully describes the combination.
Never chart → biography-mining for confirmation. Case bank so far:
Angelou (Aries Sun; Mercury Pisces immersion inside a Mars Aquarius
container — the bare hotel room), Murakami (Capricorn container in
service of self-described mesmerism — container ≠ process), Woolf
(Mercury Aquarius 10th, Mars Gemini; the diary as engine; Moon Aries
12th as the inner weather the routine survives), Beyoncé (Mars Virgo
review discipline coexisting with a Libra planning stellium), Franklin
(the 13-virtues tally + weekly rotation + morning/evening question
pair — the glance/harvest loop, 270 years early).

### 8b. The sky calendar as serious framework

A distinct, possibly larger idea: the civil calendar is one
organizational technology among several. The sky offers a structurally
different one — lunation as month, quarters as pivots, planetary
days/hours as texture, retrogrades as review seasons — and it builds in
fallow time (waning, voids) that the civil calendar lacks: the refusal
moat in temporal form. "Live a season by the sky calendar" is
simultaneously a practice, a challenge/content series, a book part, and
an onboarding ramp. The app already runs on it (lunation rhythm, week
cards); the writing makes the frame explicit. Owner can live it and log
it in Compass — the series documents itself.

### 8c. The research program (honestly graded)

- **In-app, with consent**: the only dataset of its kind — natal
  placements × window acceptance/rescheduling × completion shapes ×
  felt ratings. Testable: do chart-proposed defaults get kept/perform
  vs. neutral defaults? Does modality predict which preset people
  settle into? Grade honestly: internal product evidence / whitepaper,
  not journal science. Never claim past what's measured.
- **Interview/case-study research**: structured interviews on practice
  (container vs. process), chart read after — book material.
- **Literature anchoring**: implementation intentions, regulatory fit,
  chronotype, conscientiousness/time-management. The claim "fit beats
  one-right-way" stands partly on non-astro ground.
- **N-of-1 as the public method**: teach readers/users to test their
  own rhythm; the app is the instrument. Intellectually honest AND the
  most differentiated stance available.

### 8d. Content cascade

Studio already exports cards; the rhythm layer multiplies it: per-trim ×
per-week readings ("how a Route week meets this sky"). Essay series =
book chapters in serial (celebrity practice + clearly-labeled reading;
living people get documented practice only). The composite quiz as
top-of-funnel → shareable rhythm card → app. Feeds the drafted content-
business plan (2026-07-03).

### 8e. Sequencing (so this doesn't eat the beta)

- NOW: the §7 step-1 experiment (days, not weeks — presets over
  existing dials) + start the essay series (compounds toward the book
  regardless of product outcome).
- NEXT: chart→dials mapping; sky-calendar season as a lived/logged
  series.
- LATER: record-audit loop, gear changes, quiz funnel.
- The book is a year-plus object; essays de-risk it. Beta hardening
  keeps priority — this frame is also a reason people will forgive beta
  roughness, not a substitute for fixing it.

## 9. Open questions for the owner

1. Naming pass on Campaign/Route/Field/Tide and "working rhythm"
   (worldbook + no-ai-slop).
2. Which underserved temperament do the actual testers skew toward?
   (Picks the first non-Tide preset to polish.)
3. Essay series venue and cadence (existing email machinery is wired;
   Resend key still pending on Railway).
4. Does the free manual rhythm choice land in onboarding now, or after
   the §7 experiment?

---

## 10. Built 2026-08-21 (same day)

Owner answers: names are good to start; framing good; essays later
(Substack/IG); ship the free choice now; build the experiment; and a sixth
ask — read the owner's own chart against these dials.

Shipped in one commit:

- **The free choice** (`display.rhythm`: tide | campaign | route | field,
  default tide). Asked in onboarding on the birth step — "A free afternoon
  opens up. What should Compass lead with?" — and in Settings ("How Compass
  meets you"). Situations, not traits.
- **The experiment** — `components/RhythmLead.tsx` at the top of Home,
  with a live switch so the four can be felt on one account:
  ONE MOVE (the first late/due/held task, "Find it an hour →", backlog
  groups capped at three), STAY THE COURSE (routines with tallies, tick
  in place, blocks held this week), THREE WAYS IN (up to three tasks from
  different groups, "Pick one now and the others stay open"). Tide renders
  only the switch. Verified on a fresh account with five tasks and the two
  starter habits.
- **Found while building**: onboarding wrote astroDetail straight to
  localStorage on the belief the PreferencesProvider mounted later. It
  doesn't — "The full chart" chosen at intake showed as medium until a
  reload, and the new rhythm question failed the same way. Both now go
  through `updateDisplay`.

Step 1 of §7 is therefore live. The step-1 question — do these feel like
four different ways of being helped? — is the owner's to answer next.

## 11. Steps 2–4 and the step-1 leftovers, built the same evening

Owner verdict on step 1: "they feel helpful! elegant. build the rest."

- **Route's one rule** (plan persistence): Shape Day under Route keeps an
  item's usual slot — same title, placed within 45 minutes of the same
  clock at least twice in six weeks — when it fits and no deferred
  session overlaps it, and reports the elected slot it was kept over on
  the placement. The astrology yields to continuity, visibly.
- **Progress language** follows the rhythm in "Where you are": a campaign
  counts wins, a route counts what was kept and for how long, the field
  counts what was touched.
- **Fold defaults** per rhythm, applied once at the moment of choosing.
- **The fourth Log shape**, "The tally": wins only, no prose.
- **Element as payoff language**: one line under the Home card, from the
  chart's Sun element, attributed ("By your chart, …").
- **Step 2 — the chart proposes**: `lib/rhythmProposal.ts` reads Mercury,
  Mars, Moon and Saturn into per-function trims (modality → campaign/
  route/field; water → tide; recovery by element), literal placement
  first. Shown in Settings ("By your chart", with "use it"), in the
  Bearings room, and as a Studio card ("My rhythm"). Gated `rhythm.astro`.
- **Step 3 — the record audits the prior**: `rhythm_days` stamps which
  rhythm Home led with each day; `/account/rhythm-audit` joins it with
  felt ratings and wins; a notice offers the switch when a rival has ≥7
  days, ≥5 rated, and an aligned share ≥20 points higher. Gated
  `history.patterns`. The table is in Settings.
- **Step 4 — gear changes**: `/account/gear` finds the transit lighting
  one style (Mars → campaign, Saturn → route, Neptune → tide, Uranus or
  Mercury retrograde → field) with an `until`, and Home offers it as an
  invitation. Yes sets a dated override; Home says so and offers to end
  it early. Never applied on its own.
- Also: habits can be created serving several stars at once (owner ask).

Read on the owner's chart: Field overall (Planning Field, Action Field,
Recovery Route, Commitment Route), earth payoff; gear offered today:
Saturn square the Ascendant, 2.8°, Route through Oct 20.
