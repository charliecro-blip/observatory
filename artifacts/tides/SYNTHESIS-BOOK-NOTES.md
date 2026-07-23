# Synthesis Engine — principles mined from the library (accumulating)

Actionable principles from the Auspice book library to fold into the synthesis
engine (spec: `SYNTHESIS-ENGINE-SPEC.md`) and the app's voice. Sourced by
background reading passes; most-implementable items kept.

## Transits — Robert Hand (*Planets in Transit*) + Reinhold Ebertin (*Transits*)

**Weighting**
- **Slower planet ⇒ stronger, longer transit.** A transit-body weight ladder
  (Pluto/Neptune/Uranus ≫ Saturn/Jupiter ≫ Sun/Mars/Venus/Merc ≫ Moon) — the
  *transit* analog of dignity. Outer = theme/"long chapter"; Moon = day-flavor. (Ebertin)
- **Outer sets the theme, inner sets the timing.** Two-layer model: outer transits
  form the `flavour` vector; a coincident inner/Moon hit is the salience spike.
  Boost an inner hit that *reinforces* an active outer theme. (Hand, Rule 1)
- **Personal points (Asc, MC, Sun, Moon) outrank generic hits** → salience boost.
  Confirms "asc/angles = the spine." (Ebertin)

**Orbs / timing**
- **5° max orb (ambient), ~1° for "exact now."** Use `maxOrb=5` for the salience
  falloff; a tighter ~1° window = the peak. Orbs govern *salience*, not a hard gate. (Ebertin/Hand)
- **Mars fires ~1–2 days before exact** → nudge Mars salience earlier. (Ebertin)
- **A station ON a natal point = huge amplifier + fixes timing** (distinct from the
  accidental-dignity "slow −2" for the planet's own condition). Flag near-stationary
  transits on natal points as high weight+salience. (Hand)
- **Triggers:** Sun/Mars release stored charge; an eclipse *arms* a point for weeks,
  the event comes when a fast trigger later hits it. (Ebertin/Hand)

**Aspect nature (drives polarity + salience)**
- **Axial (conj/square/opp) = "something happening" → higher salience/"watch."
  Tripartite (sextile/trine) = "a state/condition" → lower salience/background.** A
  clean rule for ranking `watch[]`. (Ebertin)
- **Hard = a test/clearing, not doom** ("clears the refuse," leaves you renewed;
  destructive only where you're already weak). **Soft = ease, not reward** (can breed
  stagnation — "the curse of the trines"; the sextile still needs initiative). Canonical
  source for the "tension as growth" phrasing. (Hand)
- **Difficulty is the planet-PAIR, not the aspect.** Ready pair table — hard: Sun–Sat/Ur/Nep,
  Moon–Mars/Sat/Ur/Nep/Pl, Mars–Sat/Ur/Nep/Pl, Sat–Ur/Nep/Pl; easy: Sun/Moon–Ven/Jup,
  Ven–Jup, Mars–Jup (all aspects). Modulates `polarity`/`weight` independent of aspect. (Hand)
- **Conjunction = wildcard** — resolve its polarity from the pair table + condition, don't hardcode. (Hand)
- **Hand's 8-stage cycle** — applying square = "crisis in building," separating square =
  "crisis in letting go." A `phase` attribute on cyclic (Saturn) transits. (Hand)

**Convergence (the core thesis, with a formula)**
- **A lone soft/minor transit passes unnoticed; significance = several factors stacking.**
  Hand's Rule 3: the peak is when the **average orb of all transiting factors → zero.**
  A literal *day-intensity* formula for the convergence engine. Never surface an isolated
  wide soft aspect. (Hand)
- **Read the whole before the parts; honest null on quiet days** ("readings where every
  transit has a million possibilities aren't worth much"). Direct support for the
  spice-rack→recipe thesis + the "open, unmarked day" output. (Ebertin/Hand)

**Voice (north-star)**
- **State the tendency "for most people"; the individual's makeup decides.** Hedge +
  lean on the natal chart when present. (Hand)
- **Astrology informs a decision, never makes it.** Every reading ends in agency/optionality. (Hand)

**Two ready data assets**
- **Ebertin planet-character keywords** (tight cores for `toward`/`note` vocab): Sun
  vitality/will/heart · Moon soul/mood/receptivity · Mercury mind/nerves · Venus
  love/harmony/art · Mars drive/effort · Jupiter expansion/ethics/community · Saturn
  restriction/endurance/separation · Uranus suddenness/reform · Neptune dissolution/
  imagination · Pluto power/transformation · Node association/connection.
- **Ebertin activity→transit map** (for `activityCorrespondences`): intellectual →
  Merc/Ur/Sat/Nep · physical → Mars/Sun/Sat · vocation → Jup or Sat to Sun/MC/Asc ·
  relationships → Jup/Ur to Sun/Moon/Ven/Node · separation → Sat · residence → Ur to Asc/MC.

## Traditional foundations — Demetra George (*Ancient Astrology*, *Authentic Self*) + Öner Döser (*Professional* / *Financial Significators*)

_(Brennan's *Hellenistic Astrology* PDF is image-only/no OCR; George covers the same primary sources — Valens, Porphyry, Dorotheus — and cites Brennan, so it's captured.)_

**Sect — the baseline scalar the spec was missing (highest value)**
- **Sect is the FIRST judgment — a multiplier band on the whole day, computed before
  dignity, not one testimony among many.** (George) → new engine step ahead of dignity.
- **Sect teams:** day → Sun/Jupiter/Saturn + morning-Mercury in-sect (Jupiter = greater
  benefic, **Mars = the dangerous malefic**); night → Moon/Venus/Mars + evening-Mercury
  (Venus = greater benefic, **Saturn = the dangerous malefic**). Codeable lookup; drives
  spec pattern #3. (George)
- **Sect-rejoicing = up to 3 independent +1 bonuses** on a planet's weight: (a) hemisphere
  — diurnal planet in Sun's hemisphere / nocturnal opposite; (b) sign — diurnal in
  masculine sign / nocturnal in feminine; (c) solar phase — diurnal a morning star /
  nocturnal an evening star. Moon: waxing rejoices by day, waning by night. A 0–3 count. (George)
- **The sect grade → pick `dayHero` (best-conditioned in-sect planet) + `dayCaution`
  (worst out-of-sect malefic) each day** — the convergence/counterpoint engine in
  miniature. Transcription target: George's sect + rejoicing grid (Ch.7). (George)

**Dignity / victor (confirms + extends brick 1)**
- **5/4/3/2/1 essential-dignity points independently confirmed** (Döser, Bonatti tradition) —
  validates dignity.ts §2a.
- **Almuten/victor = weighted winner over a set of degrees** — sum each candidate's dignity
  points at that degree, highest wins. `almuten(degrees[]) → planet`; one utility serves
  Asc-victor, profession-victor, marriage-victor. (Döser)
- **Combustion is asymmetric:** the beamed planet weakens, **but the Sun strengthens** —
  raise a Sun-testimony's weight, don't just penalize. (George)
- **Retrograde dual register:** trad = weakened/delayed; modern = internalized. Keep the
  −weight, switch the *note* by astro-detail level (our modern-synthesis stance). (George)

**Aspects — by-sign nature + directionality (codeable)**
- **Whole-sign aspect natures are fixed + asymmetric:** trine sympathetic (softens even a
  malefic) · square harsh (harms even with a benefic) · opposition adversarial · **sextile
  real but weak (weight ≈0.5)** · conjunction commingling. Bake into polarity AND weight. (George)
- **Semisextile (30°) + quincunx (150°) are AVERSIONS, not aspects — planets "cannot see"
  each other, emit NO testimony.** If the only link is an aversion, treat factors as
  disconnected (feeds "quiet day"). (George)
- **Graduated orbs = a ready salience ladder:** co-present (same sign) → assembly (≤15°) →
  adherence/kollēsis (≤3° applying; **≤13° for the Moon**) → neighboring (≤3° + same bound).
  The 3° / 13°-Moon band = the peak-event threshold. (George)
- **Overcoming:** the planet in the *earlier* sign (rises first) dominates the one it
  aspects — strongest at the superior square. The dominant planet's nature prevails →
  directional priority: the overcoming factor leads the reading. (George)
- **Applying > separating:** only the faster planet *applying* binds; separating = framing-only,
  low salience. (George — matches Hampar #1.)

**Maltreatment / bonification (rare, high-impact named patterns)**
- **Maltreatment fires only when ALL met** (keeps it a true low-tide): adherence ≤3° to
  Mars/Saturn · overcome by a malefic *itself in a bad house* (2/3/6/8/12) · opposed by a
  malefic in a bad house · **enclosure/besiegement** (hemmed by Mars AND Saturn with no
  benefic ray between). Transcription target: George Table 23 (both polarities symmetric). (George)
- **Bonification = the benefic mirror** (adherence/enclosure/overcoming/opposition by
  well-placed Venus/Jupiter) → the "graced window" patterns.
- **Intervention:** a benefic ray interposed between two malefic rays *shields* — a
  mitigation flag that downgrades a maltreatment. (George)

**Joys / houses / eminence (salience structure)**
- **Planetary joys by house** (small fixed table): Mercury-1, Moon-3, Venus-5, Mars-6,
  Sun-9, Jupiter-11, Saturn-12. A planet in its joy gets a weight + salience bonus. (George)
- **Angular > succedent > cadent = the core salience gradient** — confirms accidental-dignity
  house scores; make angularity the dominant term in `STRUCTURAL_BASE`. (George)
- **"Bad houses" 2/3/6/8/12 = a distinct averse set** used as the maltreatment gate + a
  confidence input. Reusable `isBadHouse()`. (George)
- **Doryphory (bodyguards):** a luminary flanked by well-placed planets of its sect =
  "protected/eminent" → named pattern "the day's luminary is well-attended." (George)

**Lots + significator tables (the "which planet signifies what" the spec wanted)**
- **Lot of Fortune** (Asc + Moon − Sun by day, reversed by night) = body/health/wealth; a
  well-placed benefic-aspected Fortune → spec pattern #11. Its lord combust / Fortune
  afflicted → strain. `computeLot(a,b)` + a data table (Fortune/Spirit/Profession/Assets). (George/Döser)
- **Universal profession significators = Mars (labor), Venus (art/craft), Mercury
  (trade/analysis)** — an `activityKey→planet` table that maps straight onto the
  Guiding-Star planet-diagnosis + `activityCorrespondences`. (Döser)
- **Financial significator stack (ordered):** Lot of Fortune + lord → Lot of Assets + lord →
  Jupiter (natural wealth) → 2nd house → sect-light triplicity lords → Asc-lord–Jupiter
  contact (esp. *with reception*). The "consider in this order" stack = the template for
  topical significator resolution. (Döser)
- **Reception amplifies contacts** — make reception a *bonus multiplier* on any benefic
  contact, not only a standalone pattern. (Döser)

**Voice / order (for the app generally)**
- **Dual-register discipline:** judge the condition honestly (favorable *or* problematic),
  THEN present it constructively — the engine judges, the copy reframes by astro-detail level. (George)
- **The chart-overview checklist = a ready synthesis ORDER:** elements of Asc/Sun/Moon →
  Asc + ruler condition → luminaries → dignities/receptions → lunation phase → nodes/Fortune
  → angular planets → aspect patterns → retro/combust → transits. The Asc-ruler as
  "steersman/spine" validates the structural-salience claim. (George)

## Electional & timing — Joann Hampar (*Electional Astrology*) + Marion March (worked example)

_(Hampar = the codeable core; March = 3 crisp gates. Dykes = predictive not electional;
Bowles = sun-sign money-personality; Phillipson = philosophy — each ≤1 usable rule.)_

**The Moon as prime elector**
- **Only APPLYING Moon aspects count — separating = dead ("the opportunity is over").**
  Enforce zero salience for separating Moon aspects, not merely reduced. (Hampar)
- **First applying aspect = how it begins; LAST aspect before she leaves the sign = the
  outcome** — the final aspect must be positive to end well. → tier gate: benefic last
  aspect eligible for GREAT; malefic last aspect caps at GOOD. Look across the *whole sign
  occupancy*, not a fixed orb. (Hampar)
- **Waxing favors initiation, waning favors completion** — a *directional* filter, not
  blanket good/bad (maps spec #12). (Hampar)
- **Moon aspect polarity (codeable):** conj favorable · sextile favorable · trine very good ·
  **square difficult-but-surmountable (impetus, NOT a disqualifier)** · opposition almost
  always difficult. (Hampar)
- **Moon condition gates (new flags):** never VoC · never **intercepted** · never **0°/29°
  critical degree** · avoid **Via Combusta** (15° Libra–15° Scorpio). (Hampar)
- **VoC refinement:** suppresses GREAT/launch windows but **supports intuition/rest/reflect**
  — don't gate finish/reflective activities. (Hampar/March)
- **Refranation** (Moon applies to a planet that changes sign before the aspect completes) =
  "the deal that doesn't close" — a named negative pattern. (Hampar)
- **Moon's last aspect to a RETROGRADE planet = success-with-revision** — downgrade, don't
  disqualify. (Hampar)

**Ruler + house of the matter**
- **Twofold aim: strengthen the initiator (1st + Moon) AND the matter's house, then LINK
  them by applying aspect** — no link → no action ensues (a soft gate). (Hampar)
- **Natural (universal) ruler of the subject outranks the chart's house ruler** — marriage
  always wants a strong Venus regardless of what rules the 7th. Each activity gets a natural
  significator that must be strong + direct. (Hampar)
- **The matter's ruler must be DIRECT** — retrograde significator "may not function well";
  cap the tier. March voids the whole month if the 3 angle-rulers are retrograde. (Hampar/March)
- **Keep malefics out of houses 1–3 / off the Ascendant** — Saturn→delay, Uranus→disruption,
  Neptune→misinformation, Pluto→something must be eliminated first (ready drill-down strings). (Hampar)
- **At least one benefic (Venus/Jupiter) aspecting the Moon or the matter-ruler** — a
  legitimate GREAT-maker. **Sun–Moon in good aspect enhances any election.** (Hampar)

**Per-activity requirement table — loads directly as `activityCorrespondences`** {house, natural
significator(s), avoid-clauses}:
- **Launch/career/public** → 10th (+11th income); Sun/Saturn/Jupiter direct; Mars-in-10th
  good; **avoid Saturn/Neptune in 10th**; benefic in 11th for cash. Moon in Taurus favored.
- **Contract/signing/announce/short travel** → 3rd; **Mercury** sound + direct.
- **Money/purchase-for-gain/invest** → 2nd (Venus); 8th for other-people's-money.
- **Relationship/marriage/partnership** → 7th; **Venus & Mars** direct; Venus–Jupiter helps;
  **fixed angles** for durability; waxing Moon.
- **Home buy/move** → 4th (place a benefic there); link 1st–7th (buyer/seller), 1st–2nd–4th.
- **Air travel / higher-ed / legal / publishing** → 9th; benefic in 9th trine Asc; weight **Uranus** for air travel.
- **Speculation/romance/creative/children** → 5th; **Sun** strong trine Asc; **keep Saturn out of 2/5/8/11**.
- **Health/exam/regimen** → 6th (+1st body); Mercury + Sun; keep 6th malefic-free; avoid Moon in Scorpio / 1st / 6th.
- **Surgery/hospital/confidential** → 8th + 12th; link 1st–8th–12th.

**New GREAT-tier named patterns**
- **Graced launch** — matter-house angular + its natural significator dignified & direct +
  a benefic aspecting the Moon + Moon applying-then-final-positive within-sign. (Hampar's ideal)
- **Doubled day** — same planet rules Asc + the matter (spec #1). (Hampar)
- **Clean transaction (March)** — seller = Asc-ruler, buyer = Desc-ruler, asset = 4th-ruler;
  want 1st↔7th good aspect + both relating to the 4th; **Moon makes no square before leaving
  its sign, no VoC, none of the 3 angle-rulers retrograde.**

**Eclipses / lunations**
- **Delay elections within ±1 week of any eclipse** (solar effects ~1yr, lunar ~6mo; 5° orb
  to natal) — an "eclipse window" flag that lowers confidence + suppresses GREAT. Solar ≈
  beginnings, lunar ≈ endings (a lunar eclipse can *help* end an unwanted thing). (Hampar)
- **Lunations activating money/5th/11th set the tone for financial wins**; Uranus on the 5th
  = "sudden good fortune." (Hampar)

**Meta**
- **The election instant = the "moment of finality"** (control is lost — the pronouncement,
  the doors opening), not the ceremony's start. Surface this in election guidance. (Hampar)
- **Electional works best when the NATAL chart already shows promise + is activated by
  transits** (3+ transits at a real win) — bridge the election engine to the transit layer:
  fold natal-transit activation into the day's confidence when a chart exists. (Hampar)
- **Explicit priority stack to encode as weights:** Moon (prime) → natural ruler of subject
  AND house of the matter (equal) → aspects between the rulers → signs on planets + angles (last). (Hampar)

## Modern / elements — Stephen Arroyo (*Chart Interpretation Handbook*) + Steven Forrest (*Books of Fire/Earth/Air/Water*)

**The synthesis method (Arroyo — the spine, and it IS what the spec was reaching for)**
- **Elements are "the energy substance of experience," read whole — a day is an energy field
  the user attunes to ("today runs on earth"), never a label or an event-prediction.** Anchors
  the tide metaphor. (Arroyo Ch.3)
- **Repetition principle: a theme is real when several independent factors say the same thing;
  that convergence IS the reading** — weight rises with agreement *count*, not just individual
  strength. This is literally §4 Convergence. (Arroyo)
- **Rank, don't list — "if astrologers focus on trivia they trivialize astrology."** Minimal =
  the one converged theme + one thing to watch; suppress the factor list unless "full" is open.
  Validates §3 salience + §7 minimal tier. (Arroyo)
- **Interpret the planets involved, not the configuration's NAME** (grand trine, yod, yoga) —
  render the blended meaning in plain language ("wisdom + heart aligned," not "Gaja-Kesari").
  Jargon surfaces only at full detail. (Arroyo Ch.9)
- **Every planetary principle has a positive AND negative expression of the same neutral
  energy** (Mars: courage vs impatience; Saturn: discipline vs rigidity). Each testimony
  carries a gift-vector + a shadow-caution; the counterpoint + caution-window copy draw from
  the shadow column. **This is the built-in non-fatalism — same force, two roads.** (Arroyo)
- **Fire/Air = active, self-expressive (get it out); Water/Earth = receptive, self-containing
  (build foundation first)** → score each day on an expressive↔receptive axis from its element
  mix; feeds the qualities vector. (Arroyo Ch.3)
- **Opposition = "stretched between two contrasting tendencies" — hold both, don't resolve.**
  Counterpoint phrasing = both/and tension, never one side winning. (Arroyo)
- **Angular/succedent/cadent = ACTION / SECURITY / LEARNING** — a ready translation of house
  scores into plain activity guidance. (Arroyo)

**Element essences (Forrest — for element-guidance copy + the tide's plain language)**
- **FIRE = the life-force/resilience that makes you want to be alive.** Gifts: courage,
  initiative, faith, play, vitality. Shadows: burnout, recklessness, ego-inflation. Copy:
  initiate, start, risk, perform, lead, play — feed it by *doing*. (Book of Fire)
- **EARTH = making spirit real/visible.** Gifts: competence, reliability, endurance, mastery-
  through-practice. Shadows: rigidity, drudgery ("a lost soul with a full schedule"),
  perfectionism that never ships. Copy: build, finish, tend the body, money/logistics, craft;
  "good enough" over perfect. (Book of Earth)
- **AIR = the linking element / the art of paying attention** (keep the inner map aligned with
  reality). Gifts: perception, curiosity, articulacy, fairness. Shadows: overthinking,
  detachment, all-talk-no-action. Copy: notice, question, learn, write, talk it through, then
  decide — don't mistake the plan for the doing. (Book of Air)
- **WATER = feeling as active healing, not passive mood ("there is nothing weak about
  Water").** Gifts: empathy, intuition, imagination, regeneration. Shadows: overwhelm,
  escapism, enmeshment, withdrawal. Copy: rest, feel, retreat, make art, connect intimately,
  heal, dream — an invitation to renew, never a mood to endure. (Book of Water)
- **A person's Sun-element defines what feels "real" + where vitality recharges** — weight the
  day's element testimonies against the user's dominant element (a water day lands differently
  for a fire native). Feeds the personal-sensitivity premium feature. (Arroyo)

**Voice / agency (the whole register)**
- **Signs/elements are "evolutionary pathways, not immutable traits" — verbs, not nouns; you
  DO the element.** Phrase guidance as invitations to act ("today favors building"), never
  verdicts about who the user is or what will happen. (Forrest)
- **Every placement is a spectrum, "high road or low road, or any pathway between" — pair every
  flavour with its two roads** (gift to spend + shadow to watch). The structural home for
  caution-windows. (Book of Fire)
- **An element is "a treasure to be nourished" — a resource to spend, not a fixed quantity.**
  A "high fire" day = energy to invest; a "low" day = an invitation to a different mode
  (coherence-not-favorability, not "good/bad day"). (Forrest)
- **Astrology "solves nothing… we gaze into that mirror to understand" — a lens, not an
  oracle.** When reliability flags fire, say "trust this lightly today," don't manufacture
  certainty. (Forrest/Arroyo)
- **Relate the reading to the user's actual Aims/decisions — discernment = relevance, not
  completeness.** Surface the testimonies relevant to what they're trying to do. (Arroyo)

_(Arroyo extract cached at scratchpad/arroyo.txt; George/Döser/Hampar extracts at scratchpad/txt/ — transcription targets flagged inline for verbatim tables.)_
