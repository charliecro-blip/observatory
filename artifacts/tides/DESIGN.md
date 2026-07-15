# Auspice (né Tides) — Design & Astrological Architecture

> **Rebrand 2026-07-15:** the product is now **Auspice** (the project's original name).
> "Tide(s)" remains feature vocabulary — the tide reading is one instrument, no longer the title function.

> Working design document. This is the thing to argue with, not the code.
> Status: pre-implementation. Nothing here is committed to until the "Open Decisions"
> section is resolved.

---

## 0. The one-sentence thesis

**Tides is a cosmic weather app, not an astrology encyclopedia — a sophisticated
engine underneath, a weather-simple surface on top.** The user should be able to
open it and know, in one glance, *what kind of moment this is and what to do with
it*, without knowing any astrology. The astrology is there for anyone who taps in.

Everything below serves that thesis.

---

## 1. What Tides is — and deliberately is NOT

### Is
- A **felt-rhythm** instrument: it describes the texture of *now* and helps you
  align action to it.
- A **weather report** for time: legible at a glance, deeper on demand.
- Eventually, a **mirror**: it learns your patterns from how days actually felt.

### Is NOT (anti-goals — these shape copy and scope as much as features)
- **Not a fortune teller.** It never predicts outcomes ("you will succeed"). It
  describes conditions ("good for depth").
- **Not an advice engine** for money, medical, or relationship decisions. It
  describes energy; the user decides.
- **Not a drama manufacturer.** Quiet days are reported honestly as quiet, not
  dressed up. Honesty on calm days makes loud days land harder.
- **Not fatalistic.** Every reading has a floor of agency. The sky *suggests*; you
  decide. (This is an ethical constraint — people open astrology apps at low
  moments. A "Low Tide, don't force anything" must never read as "give up.")
- **Not a single-school ephemeris.** See §10 on syncretism.

---

## 1b. Currents — the long-term layer (built 2026-07-01)

The top of the nesting table (year+). Inherently personal; needs the natal chart.

- **Pluggable house systems** (`lib/houses.ts`): whole-sign, equal, Porphyry,
  Placidus, Regiomontanus — all numerically validated. `computeNatalChart` takes a
  `houseSystem` param (default Regiomontanus for backward-compat with medical
  features; **whole-sign is the default for Currents**, since profections assume it).
  Selectable in Settings → House system. Also fixed a real latent bug: `computeMC`
  used `atan2(tan(ramc), …)` which returned MC±180° for RAMC in (90°,270°) — wrong
  MC for ~half of births.
- **Profections** (`lib/currents.ts`): age→house→time-lord, annual + monthly. The
  cheapest high-value annual frame ("a 10th-house year, ruled by Saturn").
- **Transit-by-house** (`lib/currents.ts`): each slow planet's current natal-house
  tenancy with approximate ingress/egress dates (the multi-year life chapters).
  ~10ms via coarse-scan-then-bisect.
- **Content** (`lib/currents-content.ts`): 12 house domains × 5 planet activation
  modes (Jupiter expands / Saturn tests / Uranus disrupts / Neptune dissolves /
  Pluto transforms) → emphasis + practices. Profection-year guidance per house.
- **UI**: Currents tab — profected year hero, active chapters (planet-in-house with
  emphasis + practice chips), and a "next chapter shifts" timeline.

Whole-sign note: under whole-sign, transit-by-house ≈ transit-by-sign (house = sign),
so chapter boundaries coincide with sign ingresses. Quadrant systems give distinct
house boundaries.

## 2. The core architecture: Cyclical Nesting

The central realization: **the problem was never "which framework wins."** It was
that we kept asking one framework (elements) to describe every timescale. Each
timescale has a natural language. Name them separately; let each do its own job.

| # | Layer | Cycle length | Native language | Source (already computed?) |
|---|-------|-------------|-----------------|---------------------------|
| 1 | **Circadian** | 24h (solar) | morning / work / evening | ✅ `ELEMENT_TODAY_GUIDANCE` splits by time-of-day |
| 2 | **Planetary hour** | ~1h | Planet (Mercury hour, Moon hour) | ✅ real sunrise/sunset computed |
| 3 | **Tide** (day) | ~2.5 days | Element / Moon sign → **Character** | ✅ `elemEmph`, `moonSign` |
| 4 | **Moon phase arc** | ~3–4 days | Phase (Gibbous — refine) | ✅ `moonPhase` |
| 5 | **Lunation** | 29.5 days | New → Full → Dark story | ✅ derivable from phase + fraction |
| 6 | **Standing conditions** | days–weeks | Non-lunar aspects, retrogrades, eclipses | ✅ Conditions strip (`lib/conditions.ts`) |
| 7 | **Seasonal** | ~3 months | Sun sign / ingress | ✅ `sunSign` |
| 8 | **Personal transits** | variable | transit planet × natal planet | ✅ Today hero personal line |
| 9 | **Currents** (long-term) | 1–20 years | Profected year + transit-by-house chapters | ✅ Currents tab (`lib/currents.ts`, `/api/currents`) |

Rows 1–6 are universal (same for everyone at a location); rows 8–9 are **personal**
(need the natal chart) — the strongest expression of personalization-as-moat.

The **circadian** layer (row 1) is new-in-this-doc and important: it's a purely
solar/human rhythm that's *always correct regardless of astrology*. It grounds the
whole system. "Morning Water" ≠ "Evening Water." It's the layer a skeptic still
trusts.

Row 6 (**standing conditions**) is the gap flagged in conversation. Non-lunar
planet-to-planet aspects (Venus□Mars, Mercury☌Saturn) and retrogrades/eclipses are
*multi-day background weather systems*. They don't belong in the hourly timeline
(too slow) or the Sky event stream as one-shot events (they persist). They need
their own "Conditions" surface — a standing strip, like a weather advisory that
sits over the region for a week.

---

## 3. The primary UX language: Tide Level + Character

### The inversion (agreed)
Element is **not** the headline. It's the *texture*. The headline is the **Tide
Level** — because the first question a user has is "what kind of moment is this and
what do I do," and a tide state answers that faster than an element does. This also
finally makes the app's *name* mean something at first glance.

### The Character (from element)
The four elements become four **tide characters**. The character says *what kind*
of energy; it changes every ~2.5 days with the Moon's sign.

| Element | Character (evocative) | Character (plain) | Grain — good for |
|---------|----------------------|-------------------|------------------|
| Fire | **Surge** | Fire | act, publish, lead, initiate, move the body |
| Earth | **Building** | Earth | build, organize, finish, stabilize, tend |
| Air | **Clear** | Air | write, connect, message, brainstorm, exchange |
| Water | **Deep** | Water | feel, dream, heal, create, listen, rest |

### The Level = Energy × Trend (the tide curve — see §5)
The level is **two axes read as one curve**, exactly like a real tide table:

- **Energy / intensity** — how *charged* the moment is, driven heavily by Moon
  phase (Full = High, Dark/New = Low), plus angularity and aspect activity.
  **Element-neutral** — a Full Moon in Pisces is high-energy Water, a Full Moon in
  Aries is high-energy Fire. No element is inherently "higher."
- **Trend** — rising or ebbing: waxing vs. waning, applying vs. separating aspects,
  and **VOC pulls toward Ebb**.

Combined into the 5-point curve: **Low → Rising → High → Ebb → Low.**

| Level | Meaning |
|-------|---------|
| **High** | peak energy, coherent. Ride it. |
| **Rising** | energy climbing / aspects applying. Build momentum. |
| **Tide** (mid) | steady middle — most days. Do what you like. |
| **Ebb** | energy releasing / aspects separating / VOC. Wind down, don't start big. |
| **Low** | trough. New/Dark Moon, scattered. Rest, seed, restore. |

**Why 5 on a curve, not 3 flat bands (RESOLVED):** the curve folds *direction* into
the level, which (a) matches how tide tables actually read, (b) feeds the
transition/notification engine (§8) for free — Rising→High is a pushable edge — and
(c) handles the Full-Moon-VOC case correctly: **high energy + ebbing trend = "High
Ebb,"** not a tanked score. VOC does not floor the tide; it bends the trend.

**Coherence is a SEPARATE dial → Confidence (§4a), not the Level.** How *aligned*
the signals are governs how strong a statement to make, not how high the tide is.
Keeping energy and coherence separate is what finally kills the fire-bias:

**The fire-bias bug (this is a real conceptual fix):** Today `tides.ts:140` gives
fire/air `+1` — "active/mental > receptive/grounded," a productivity bias posing as
neutral astrology. It contradicts "Water High Tide = go deep." Since Energy is now
Moon-driven and element-neutral, and favorability is gone entirely, all four
characters can be High — High means "charged," not "good."

### The resulting hero
```
        DEEP TIDE · Rising                 ← Level + Character (hero)
        Water Moon · Mercury Hour · Waxing Gibbous   ← texture line
        "Refine the message. Follow emotional intelligence,
         but use language carefully. Good for editing,
         intimate writing, clarifying a conversation."   ← the "what to do"
```

### Full hierarchy (agreed, with additions)
- **Hero:** Tide Level + Character
- **Texture line:** Element / Moon sign · Planetary hour · Moon phase
- **Conditions strip:** standing aspects, retrogrades, eclipses (§9)
- **Micro-timing:** the hourly timeline (planetary hours + Moon events)
- **Planning layer:** Moon phase arc / lunation (Calendar)
- **Advanced/personal:** aspects to natal, personal transits

---

## 4. The composition cascade (the hard, unsolved problem)

We have eight layers. The hero is **one string**. How do they deterministically
resolve without turning to mush or contradicting themselves? This cascade IS the
core product logic and must be specified before building. Proposed priority
(first match wins the *headline*; lower layers become the texture/detail):

1. **Personal hard transit** (if natal chart present) — a transiting hard aspect to
   a personal planet overrides the world's tide for *this user*. "The world's tide
   is high; yours is choppy." (This is the moat — see §6.)
2. **Base tide** — Character (element) + Level (Energy × Trend). VOC is **not** an
   override — it bends the Trend toward Ebb but does not floor the Energy. A Full
   Moon VOC reads **"High Ebb,"** not "Low." (Corrected 2026-07-01.)
3. **Standing conditions** — never the headline, always the strip. Retrograde/
   eclipse/aspect never *overrides* the daily tide but colors the copy.

The one thing that *can* still floor the tide to Low is genuinely low Energy
(New/Dark Moon, nothing active) — that's the trough of the curve, not an override.

### 4a. Confidence / signal agreement as a first-class output
Confidence = **coherence**, a dial *separate* from the Level. When the layers
*agree* (watery element, Moon-Neptune trine, Moon hour, Balsamic phase → all say
deep-and-inward) → **high confidence**, make a strong, specific statement. When they
*contradict* (fire element but Moon□Saturn but Venus hour) → **low confidence**, say
*less* and hedge. Note this is distinct from Energy: a moment can be High Energy but
*low* coherence (lots happening, no clear direction) — the app should then say
"a lot is moving, but it's mixed" rather than issue a confident instruction. Most
days are medium-confidence, and that's fine.

---

## 5. The scoring model, redesigned: axes, not a sum

Today the score is one additive number (`let score = 5; if (voc) score -= 2; …`).
It's fragile, it hides the fire-bias, and it conflates independent things. Replace
the single sum with **independent axes**, each a pure function, composed by the
cascade:

- **Character(date, loc)** → `{ element, strength }` — which element dominates and
  how purely (Moon sign + dispositor + hour element agreement). No good/bad.
- **Energy(date, loc)** → 0–1 — how *charged* the moment is. Moon phase/illumination
  (dominant), angularity, aspect activity. **Element-neutral.**
- **Trend(date, loc)** → rising / steady / ebbing — waxing vs. waning, applying vs.
  separating aspects, VOC (→ ebb). Combined with Energy → the 5-point curve.
- **Coherence(date, loc)** → 0–1 — how *aligned* the axes are → drives Confidence
  (§4a). Separate from Energy.
- **Conditions(date)** → `[{ type, planet, note, span }]` — retrogrades, eclipses,
  standing non-lunar aspects. Modifiers, never the headline.
- **Personal(date, natal)** → transit overlay, only when a chart exists.

Benefits: the fire-bias disappears (it lived in the sum), the calendar can render
any date because each axis is a pure `date → state` function (§10), and the copy
layer can compose from clean inputs instead of reverse-engineering a scalar.

Keep the 0–7 `qualityScore` as a *derived* convenience for the "tap for why" view,
but it is no longer the source of truth for the headline.

---

## 6. Personalization gradient — the moat

Everything universal (same tide for everyone at a location) is a **commodity**;
a dozen moon-phase/element apps exist. **A tide that is *yours* is the moat.** But
it shouldn't be a binary "advanced tab" — it's a **gradient that degrades
gracefully** by how much the user has given:

| User has given | Tide personalization |
|----------------|---------------------|
| Nothing | Universal tide (world's weather) |
| Location | Correct planetary hours + accurate tide |
| Birth date only | + Sun-sign seasonal overlay ("your season") |
| Full natal chart | + personal transits override the hero (cascade §4 rule 2) |

Architect the hero so it can *become* personal without a separate surface — same
headline, recomputed against the user. "The world's tide is high; yours is choppy
today" is a sentence no competitor can currently write.

---

## 7. The feedback loop — invert the trust problem

Astrology apps die when they say "act boldly" and the day tanks. Fix it by
**not predicting — reflecting.** Push is already wired (VAPID); a journal already
exists. Close the loop:

1. Let the user log **how the day actually felt** (one tap: aligned / mixed / off).
2. Show them **their own retrospective**: "your highest-rated days this month were
   mostly Building Tides."

This does three things at once:
- **Flips falsifiability from liability to asset** — the user *discovers their
  pattern* instead of the app claiming to know it. Un-falsifiable in the good way.
- **The only empirical calibration data in the category** — eventually tune the
  Level/Character weights against real felt-sense instead of astrological dogma.
  Nobody does closed-loop calibration here.
- **The stickiest possible feature** — self-knowledge, not a widget.

---

## 8. Retention engine: transitions, not state

A weather app you check. A rhythm app tells you when the weather **changes**:
"tide rising — a 3-hour Clear window opening" / "Void of Course starting, ease off."
This means the model must compute **edges**, not just current state, and rank which
transitions justify interrupting someone. Transition detection therefore belongs in
the architecture now (it changes what we compute), even though the notification UX
ships later.

---

## 9. Missing pieces to add

- **Retrogrades** — Mercury retrograde is the single most mainstream astrological
  concept there is (higher recognition than elements or planets). It's in
  `retrogrades[]` and surfaces *nowhere structural*. Put it in the Conditions strip.
  It's also a top acquisition/virality hook.
- **Eclipses** — not computed at all yet. Highest-recognition sky events. Add to
  Conditions.
- **Standing non-lunar aspects** — `aspects[]` exists, unused in the hierarchy.
  These are the multi-day background systems of §2 row 6. Conditions strip.

---

## 10. Correctness & stance (what enthusiasts and reviewers notice)

- **The astrological day starts at sunrise, not midnight.** A 3am check-in is
  astrologically still "yesterday." Decide whether "today" honors the sunrise
  boundary. Small, but it signals whether we know what we're doing.
- **Location is a blocking dependency, not optional.** Planetary hours need real
  sunrise/sunset; the `40.7/-74` default makes everyone's tide subtly wrong until
  set. Location must be an onboarding-*blocking* step.
- **Pure `date → state` functions.** The calendar shows past/future tides; every
  axis (§5) must compute for any date, not just now. Don't build a now-only model.
- **Accuracy tier — stated.** We use approximate sunrise/sunset and moon
  computations. Fine for felt-rhythm; will diverge slightly from pro ephemeris
  software. State it: "Tides is tuned for felt rhythm, not minute-exact ephemeris."
- **Syncretism — take an explicit stance.** We blend Chaldean planetary hours,
  Greek/modern elements, Steiner biodynamics, Ptolemaic aspects. Purists of each
  school will notice they don't fully agree. Pre-empt it: *"Tides draws from several
  traditions to describe felt rhythm; it is not a single-school ephemeris."* A
  stated point of view turns the blend from weakness into voice.
- **Sidereal/lunar mansions** (raised, shelved) — a *config axis*, not a reframe.
  Don't hard-code tropical assumptions in a way that forecloses sidereal later.
- **Metaphor honesty** — real tides are bimodal, twice-daily, purely lunar-
  gravitational; ours are multi-driver and not twice-daily. The metaphor does
  *character* work (high/low/deep/surge), not *mechanism* work. Fine, but don't
  over-literalize it in copy.

---

## 11. Modules as lenses, not mini-apps

Reframe: a module (Health, Creative, Relationships…) is not separate content — it's
a **projection of the current tide onto one life domain.** A Deep High Tide means
different things through Health (rest, restorative movement) vs. Creative (deep
immersive work) vs. Relationships (intimate, vulnerable conversation). Modules are
*views* of the same tide, scored by element resonance for the daily recommendation
(`moduleResonance()` already does this) but speaking each domain's native language
on their own pages.

---

## 12. Onboarding as progressive disclosure, mapped to the nesting

Don't teach astrology. Teach **the app's four words** and let depth unlock along the
timescales:

- **Minute 1:** Tide Level + Character (2 concepts: "High/Low", "Deep/Surge/…").
- **Day 1:** the planetary hour (micro-timing).
- **Week 1:** the Moon phase arc.
- **Month 1:** personal transits (if chart given).

The cyclical-nesting architecture *is* the learning ladder — each timescale is the
next thing to notice. This keeps the front end weather-simple while the encyclopedia
waits underneath.

---

## 13. Decisions (resolved 2026-07-01)

1. **Character naming — RESOLVED: evocative.** `Deep / Surge / Building / Clear`,
   with the element shown as a subtitle so users learn both. Sets vocabulary for
   copy, modules, onboarding, marketing.
2. **Personalization depth — RESOLVED: build it in, exploratory.** Don't defer.
   Wire a personal layer from the start and let the right surface reveal itself
   through use rather than deciding the fork up front. Needs a concrete minimal
   first touchpoint to react to (see §13a).
3. **Copy generation — RESOLVED: hardcoded skeleton + optional LLM enrichment**
   for the on-tap "why." ~80% of what the user experiences is generated text —
   copy is a first-class engineering surface.
4. **Level count — RESOLVED: 5 levels**, mapped to the tide curve (see §13a — this
   opens a naming + trend-vs-coherence question and the VOC/"spirit" knot).
5. **Day boundary — RESOLVED: sunrise (astrological tradition).** "Today" starts at
   sunrise, aligning with how planetary hours already work. Requires a pre-dawn
   treatment and reconciling journal/date keys (see §13a).

## 13a. Follow-on questions (resolved 2026-07-01)

- **5-level definition — RESOLVED: Energy × Trend curve.** `Low → Rising → High →
  Ebb → Low`, where Energy (Moon-driven, element-neutral) sets height and Trend
  (waxing/waning, applying/separating, VOC→ebb) sets direction. Coherence is a
  *separate* dial → Confidence, not the Level. Fully specified in §3 / §4a / §5.
- **VOC / "spirit" knot — RESOLVED: VOC bends Trend toward Ebb, does not floor
  Energy.** Not a 5th element, not an automatic deep-Low. A Full Moon VOC = "High
  Ebb" (still high energy, going out). The backend's latent `spirit` element is
  retired as a *character*; liminality lives in the Trend/Ebb, and only genuine low
  Energy (New/Dark Moon) reaches the Low trough.
- **Sunrise boundary — my discretion.** Plan: "today" = sunrise→next sunrise;
  in the pre-dawn window show the still-current (previous civil date's) tide with a
  small "until sunrise 6:42am" note; keep journal/date localStorage keyed to the
  *civil* date of the sunrise that opened the tide-day (so one tide-day = one key).
- **Personalization first touchpoint — RESOLVED (build & see).** Ship world tide +
  a personal modifier line together ("World: High Surge · You: choppy — Moon squares
  your Saturn"). Cascade rule 1 can promote the personal read to the headline later
  once we've felt how it weaves.
- **Eclipses — RESOLVED: hardcode a static eclipse-date table** for the Conditions
  strip. Accurate, known years ahead, trivial.

---

## 14. Suggested implementation phasing

1. **Rebuild the scoring as axes** (§5) — Character / Level / Conditions / Personal
   as pure `date → state` functions. Removes the fire-bias; unblocks everything.
2. **Compose the cascade** (§4) into a single `resolveTide(date, loc, natal?)` that
   returns `{ character, level, confidence, texture, conditions, headline }`.
3. **Rebuild the Today hero** on `resolveTide` output (level+character headline,
   texture line, "what to do" copy).
4. **Add the Conditions strip** (§9) — retrogrades, eclipses, standing aspects.
5. **Wire the feedback loop** (§7) — one-tap felt-rating + retrospective view.
6. **Transitions + notifications** (§8).
7. **Personal hero override** (§6) if deferred from v1.

Framework recommendation, settled: **architecture = cyclical nesting; primary UX
language = Tide Level (coherence, not favorability); secondary texture = element
character; hourly flavor = planetary hour; planning layer = Moon phase; advanced
layer = aspects / VOC / personal transits.** Make it feel like weather; keep the
encyclopedia underneath.

---

## 15. UI / Journey — proposed restructure (UNDECIDED, 2026-07-01)

Status: analysis captured; **user is sitting with it, not yet committed.** Do not
build until decided.

### Diagnosis
Complexity isn't the feature count — it's that the tabs mix two organizing axes:
some are **timescales** (Today, Calendar, Currents), some are **functions** (Sky,
Work, Modules). No single mental model → "where do I go for X?" has no answer.

### Proposed spine — one axis: time-zoom
Navigation = zoom level in time. Teachable in one sentence ("move right to look
further ahead"). Maps directly onto the §2 nesting table.

| Tab | Timescale | Absorbs |
|-----|-----------|---------|
| **Now** | moment + today | hero, conditions, hourly, today's what-to-do, feedback |
| **Ahead** | days → month | Calendar, week/14-day, lunation, events, planning windows, eclipses/retrogrades |
| **Horizon** | year+ | Currents (profection, chapters) + seasonal solar chapter |
| **Sky** | cross-cutting | depth/"why" layer — positions, aspects, hour detail |
| **Life** | my content | Work (tasks/habits/goals/projects) |

Modules → **dissolve** into (a) a "what do you care about" domain preference that
shapes recommendations, (b) contextual lens content in Now/Ahead. (Per §11.)

### Now decongestion
Now answers ONE question: what is this moment + what to do. Keep hero → guidance →
Waves → hourly → feedback. Collapse elemental-balance + planetary-pulse into the
hero's expandable "why". Move module-pulse + raw aspects to Sky. Merge conditions +
VOC into one expandable line.

### Journey = the spine is the ladder
First run teaches only 4 tide characters + High/Low. Week 1 = Now. Week 2 = Ahead.
Month+ = Horizon (needs chart). Sky always available, never forced. **Enforced rule:
every surface leads with tide language; astrology terms are the second layer** (this
is what "propagate tide language" means in practice).

### Open questions for the user to decide
1. Adopt the time-zoom spine — full restructure, phased, or keep current tabs?
2. Modules — dissolve into lenses/preference, keep-but-simplify, or leave?
3. Is "Life" the right home/name for Work, or keep Work separate?
4. Does Sky-as-depth-layer work, or should depth live inside each timescale instead
   of a dedicated tab?

### §15a. Naming RATIFIED (2026-07-02) — the navigator's kit
Question 3 above is now decided, and the whole nav was renamed as one system:
every tab is an instrument a navigator would own. The one-sentence journey:
*feel the water you're in (Now), read what's coming (Ahead), know the deep
water underneath (Currents), look anything up in the Almanac, and steer from
the Helm — with a Compass whenever you need a bearing.*

| Label (was) | Label (now) | Instrument logic |
|---|---|---|
| Now | **Now** | the water you're in |
| Ahead | **Ahead** | the water in front — your calendar (days→weeks) |
| Horizon | **Currents** | the slow water beneath (months→years) |
| Sky | **Almanac** | the reference book of sky events |
| Life | **Helm** | where you steer (Guiding Stars → Goals → Projects → Tasks → Habits, in altitude order) |
| Advise | **Compass** 🧭 | a bearing on demand |

Rationale: Ahead/Horizon competed for the same "later" slot — renaming the long
layer by *what it is* (Currents) rather than by distance dissolved the pair.
Internal ids/routes unchanged (today/calendar/currents/sky/work) — labels only.
Optional flourishes noted but NOT applied: Session→"Watch" (a sailor's watch),
caution windows→"squalls"/"shoals" (clarity wins until the metaphor is established).

---

## 16. The vocabulary treaty (RATIFIED 2026-07-01)

Three vocabularies coexist in the app. This is not a bug to fix but a structure to
state plainly — each belongs to a different timescale and a different question:

| Vocabulary | Question it answers | Timescale | Where it lives |
|---|---|---|---|
| **Elements** (fire/earth/air/water) | *What domains make up a life?* | Identity — slow, chosen | North Stars (one chief focus per element), practice libraries, elemental balance |
| **Planets** (Sun…Saturn+) | *Who is speaking right now?* | Events — fast, given | Hours, days, aspects, crossings, Currents chapters |
| **Tide** (Deep/Surge/Building/Clear × High/Ebb) | *What kind of moment is this?* | Weather — the summary | The hero, the chart, the share card |

The rule: **elements are yours, planets are the sky's, the tide is the meeting.**
Copy should never use two vocabularies to say one thing. When a surface must bridge
(e.g. a Surge day serving a fire North Star), the tide describes the moment and the
element describes the purpose — "a Surge tide is a gift to your Fire star."

This treaty is also the "mythic heart": the elements and planets each get a full
content page (essence, myth, domains, practices, activities — see `lib/mythos.ts`),
and the advisor routes "help me plan X" requests into this structure.

## 17. The reading principles (RATIFIED 2026-07-03)

How every interpretive surface in the app must behave — drilled in by the
owner ahead of beta, applied first to the "Big Sky" homepage section and the
sign-everywhere pass (commit history: sky-readings.ts):

1. **Simple first.** Every reading opens with one plain-language sentence a
   person with zero astrology can act on. Vocabulary is never required to use
   Layer 1.
2. **Depth on demand.** More is always available — expand, tap, explore — and
   never in the way. A collapsed card must be complete on its own.
3. **Concepts explained where introduced.** The first time a surface uses a
   term (square, void, crossing, profection), the plain explanation is one tap
   away *on that surface*, not in a glossary somewhere else.
4. **Multiple takes.** A placement or aspect means many things; single-sentence
   verdicts are false confidence. Interpretive cards offer "another take ↻" —
   genuinely different framings (the dynamic / the sign-coloring / what to do),
   not paraphrases. `composeTakes()` in `lib/sky-readings.ts` is the pattern.
5. **Planets always carry their sign.** "Saturn square Sun" hides half the
   story; the app writes "Saturn in Aries □ Sun in Cancer" everywhere a planet
   is named — headlines, pulse rows, retro lines, the planetary hour, the
   Almanac. `/tides/now` ships `planets[]` so every client surface can look up
   signs; new surfaces must do the same.
6. **The moment's big transits are central.** The 1–3 strongest planet-planet
   aspects (ranked by `aspectSignificance`: planet weight × aspect weight ×
   orb tightness × applying) lead the homepage as the "Big Sky" section with
   full explorable readings — they are the pronounced qualities of a moment,
   not background conditions.

## 18. The nesting-of-scales principle (RATIFIED 2026-07-03)

Owner's framing: "There are levels of granularity in terms of big → small
astrological cycles — the nesting needs to start with the big, slow, and
simple, and then make its way to the granular."

Every surface that presents "what's in the sky" is ordered and weighted by
timescale — slowest/simplest/most life-shaping first, fastest/most granular
last (and often hidden). A beginner reads only the top and already has
something to act on; the expert detail waits below. The ladder:

1. **Chapters / years** — outer-planet transits through natal houses, the
   profected year (Currents). Slowest.
2. **Season** — the Sun's sign (~1 month). "It's Cancer season."
3. **Lunation** — the Moon's phase (~29.5 days).
4. **Moon sign / element** — the day's character (~2.5 days).
5. **Planetary day** — the day's ruler (24h).
6. **Planetary hour** — the hour's ruler (~1h).
7. **Transient states** — void-of-course, exact aspect perfections (minutes–hours).

Applications:
- **Rail** (done 2026-07-03): Season (Sun sign, element-colored chip) → Moon
  (phase + sign chip + VoC) → This day (planetary ruler) → This hour → granular
  aspects/retro/transits below. Element-colored sign chips ("Sun in Cancer",
  "Moon in Aquarius") are the beginner-legible unit.
- **Calendar**: default presentation should lead with the slow/simple layer
  (element/season/phase/day-ruler) and reveal the granular (aspects, crossings,
  caution windows) on tap — the month grid is currently too dense for an
  absolute beginner; a "simple vs detailed" density control is the open next step.
- **Colors carry meaning-type, not just decoration**: void-of-course is a
  liminal *state* (calm slate-lavender "slack water"), NOT a warning — kept
  visually distinct from the amber/red used for cautions so the two never blur.
- **Caution marks stay rare** (tight orb) and each **explains itself on the
  specific day** (tap → what transit, what to expect) rather than peppering the
  calendar with unexplained flags.
