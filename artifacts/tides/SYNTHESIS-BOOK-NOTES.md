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

---

# Appendix — VERIFIED reference tables (transcribed, cross-checked)

Verbatim from the books (George *Ancient Astrology*, Döser), for the engine to
encode exactly. **Shipped:** Egyptian terms → `dignity.ts`; sect teams + aspect
natures → `synthesis.ts`; a simplified besiegement → `patterns.ts`. **Queued:**
the full maltreatment/bonification matcher, the Lots, the overcoming rule.

### Egyptian terms (bounds) — SHIPPED in dignity.ts
Canonical Egyptian set (Ptolemy/Valens/George Table 17), all 12 signs. See
`EGYPTIAN_TERMS` in `artifacts/api-server/src/lib/dignity.ts`. Triplicities
(Dorothean) and Chaldean faces confirmed correct as-was.

### Sect + rejoicing grid (George Ch.7) — teams SHIPPED, rejoicing QUEUED
- **Diurnal chart** (Sun above horizon): in-sect = Sun, Jupiter, Saturn,
  morning-star Mercury. Greater benefic **Jupiter**; dangerous (out-of-sect)
  malefic **Mars**; in-sect malefic Saturn = "less bad."
- **Nocturnal chart:** in-sect = Moon, Venus, Mars, evening-star Mercury. Greater
  benefic **Venus**; dangerous malefic **Saturn**; in-sect malefic Mars = "less bad."
- **Mercury's sect** = its solar phase (morning star → diurnal, evening → nocturnal).
- **Rejoicing (0–3 bonus, QUEUED):** (a) hemisphere — diurnal planet in the Sun's
  hemisphere, nocturnal opposite (boundary = ASC/DSC axis; needs houses); (b) sign —
  diurnal planet in a **masculine** sign (fire+air: Ari/Gem/Leo/Lib/Sag/Aqu),
  nocturnal in a **feminine** sign (earth+water: Tau/Can/Vir/Sco/Cap/Pis) — Mars
  flagged inconsistent, judge case-by-case; (c) solar phase — Saturn/Jupiter rejoice
  as morning stars, Venus/Mars as evening stars (~15°–120° from Sun). **Moon:** waxing
  rejoices by day, waning by night.

### Whole-sign aspect natures (George Chs.38–39) — SHIPPED in synthesis.ts
- **Conjunction** commingling (variable) · **sextile** sympathetic-but-weak/ineffective
  (affinity Venus; weakest) · **square** harsh, harms even a benefic (affinity Mars) ·
  **trine** sympathetic, softens even a malefic (affinity Jupiter; strongest/best) ·
  **opposition** adversarial, worse with a malefic (affinity Saturn).
- **Aversions give NO testimony:** semisextile (30°) + quincunx (150°) — planets "cannot
  see" each other. (getMajorAspects already omits them.)
- **Overcoming (QUEUED):** the planet in the *earlier/right (dexter)* sign is superior and
  imposes its nature on the inferior; strongest at the **superior square** (overcomer in
  the 10th sign from the other). Benefic overcoming by square = eminence; malefic
  overcoming by square (in a bad house) = the maltreatment trigger. No opposition-overcoming.

### Maltreatment ↔ Bonification (George Chs.42–50) — QUEUED for patterns.ts
Orbs: **3° applying (Moon 13°)** for adherence/connection/striking · **7°** for
enclosure intervening-ray · **whole-sign, no orb** for overcoming/opposition/domicile-lord.
Malefics = Mars/Saturn; benefics = Venus/Jupiter. Bad houses = **2,3,6,8,12**;
good houses = 1,4,5,7,9,10,11. (George marks the bonification mirrors as her
extrapolations — encode with lower confidence than the maltreatment side.)
1. **Adherence** — faster planet applies bodily within 3° (Moon 13°) to a malefic → injured
   (benefic → graced). Direct Saturn can't be maltreated; Jupiter only if Rx.
2. **Connection (by ray)** — applies within 3°/13° to a **square/opposition** ray of a
   malefic (malefic in any house). Benefic mirror = **sextile/trine** ray of a benefic.
   *(Only hard rays maltreat; only soft rays bonify.)*
3. **Overcoming** — malefic (1) in a bad house (2) in whole-sign **superior square** (3)
   over another planet (4). Benefic mirror: benefic in a good house, superior sextile/trine.
4. **Opposition** — whole-sign opposition from a malefic **while it is in a bad house**.
5. **Striking with a ray** — a malefic in any house hurls a backward ray within 3° (square/opp
   destructive, trine can protect).
6. **Enclosure/besiegement** — **both** malefics hem the planet (body and/or ray) on both
   sides, **no intervening ray within 7°**. Benefic mirror = both benefics. (Single-planet
   flanking rays = "containment.")
7. **Domicile-lord** — planet in a malefic's domicile (Ari/Sco→Mars, Cap/Aqu→Saturn) while
   that lord is in a bad house (Porphyry narrows to 6 & 12 only). No aspect needed.

### Planetary joys by house (George Fig.35) — QUEUED (needs a chart)
Mercury-1 · Moon-3 · Venus-5 · Mars-6 · Sun-9 · Jupiter-11 · Saturn-12. A planet in its
joy gets a weight + salience bonus.

### Hand — planet-pair polarity (Ch.1, pp.11-13) — QUEUED for the transit layer
Difficulty/ease is the PAIR, aspect-scoped (encode with a `scope` field, not flat):
- **Difficult (all aspects):** Sun–Sat/Nep · Moon–Mars/Sat/Ur/Nep/Pl · Merc–Nep ·
  Mars–Sat/Ur/Nep/Pl · Sat–Ur/Nep/Pl. **Difficult (square/opp only):** Sun–Ur ·
  Ven–Nep · Jup–Sat · Ur–Nep.
- **Easy (ALL aspects):** Sun–Ven/Jup · Moon–Ven/Jup · Ven–Jup. **Easy (sextile/trine
  only):** Sun–Moon/Merc · Ven–Mars · Mars–Jup. Everything else = neutral ("either way").
- Conjunction polarity resolves FROM this table ("some conjunctions are more like
  trines, others like squares"). Easy transits' hazard: equilibrium → drift ("can do
  even more damage"). Sextile demands initiative; trine permits passivity.
- **Hand's timing rules:** R2 — "strictly speaking there is NO orb"; duration comes
  from the surrounding factors. R3 — event peaks when the **average signed orb of all
  transiting factors → 0** (the day-intensity formula). R1 — outer transit timed by a
  coincident inner trigger (Sun/Mars; Mercury = when it becomes known). R4 — natal
  midpoints of aspected pairs act like conjunctions. R6 — several minor transits ≈ one
  major. Stations on natal points = a month-long major.
- **8-stage cycle labels** (conj=begin · sep-sextile=adjust · sep-square="crisis in
  building" · sep-trine=ease-danger · opposition=culmination-or-collapse · app-trine=
  transform · app-square="crisis in letting go" · app-sextile=fit the new order).

### Ebertin — polarity grid, durations, orbs (verbatim; PDF p.21-22, 72-73) — QUEUED
- **Pair polarity grid decoded** (use primarily for squares/oppositions): benefic
  cross-pairs (Sun/Moon/Merc/Ven × Ven/Jup, Jup×Ur/Node/angles, Mars×Jup, Node×angles)
  = "+"; everything × Sat/Ur/Nep/Pl (except Jup) = "−"; Sun/Moon/Merc/Ven–Node and
  Sun/Moon/Ven–Mars = "?" ambivalent. Full grid in the pass-3 agent digest.
- **Natal orbs:** 5° personal points (MC/Asc/Sun/Moon) · 4° Merc/Ven/Mars · 3°
  Jup→Pluto + Node. **Transit rule: influential only while the mover crosses 1°;
  the due date is the END of the effect, not the middle.**
- **Transit-influence durations:** Moon 2-3h · Sun 1-2d · Merc/Ven 1-3d · Mars 2-3d
  (fires 1-2 days EARLY) · Jup 3-10d (30d stationary) · Sat 8-14d (8w stationary) ·
  Ur 2-10w · Nep 4-8w (3mo stationary) · Pl months. The weight ladder, quantified.
- **Planet keyword cores + per-planet +/− psychological columns** transcribed (agent
  digest) — ready vocab for drill-downs; full 143-entry pair catalog extracted to
  scratchpad/ebertin.txt if ever wanted.

### DeLuce (Horary) — judgment procedure + new gates — QUEUED
- **Radicality pre-flight gates:** Asc in first/last 3° of a sign · Moon in last 3° ·
  Via Combusta · VoC (**exception: Moon in Tau/Can/Sag/Pis with strong significators**
  — the classic Lilly mitigation, new to us) · and the big one: **"contradictory
  indications → set it aside, defer judgment"** — the tradition's explicit sanction for
  our honest-null/low-confidence output. Never force a synthesis.
- **Aspect difficulty ladder (horary):** conj "easily" · trine "easily, satisfying" ·
  sextile "done, more care" · square "diligent labor, lesser result" · opposition
  "mostly denial." Square=achievable-at-cost, opp=denial — matches Hampar.
- **Two-channel AND-gate:** the Moon (desire) and Asc-ruler (capacity) must BOTH be
  non-cadent; either one cadent → the matter fails differently (wants-but-can't vs
  can-but-vacillates). Clean initiator-side gate.
- **Horary orbs:** conj/opp 10° · trine/square 8° · sextile 6° — a per-aspect orb set
  distinct from the transit set. Moon first, Mercury second; the Sun functions as a
  malefic (absorbs); Pluto on a significator = disappointment.
- **Universal Moon election:** "For everyday affairs the Moon can BY ITSELF decide
  whether an election time is fortunate" — Moon applying to Sun/benefics = good for
  ordinary matters. Plus: malefics OK in the matter's house when they RULE its nature
  (Mars for engineering, Saturn for mining) — a codeable exception.
- **Planetary hours = the fallback layer when the Moon offers nothing** (his activity
  strings per hour transcribed in the agent digest — Saturn hour = "finishing what's
  been left uncompleted" etc.).
- **Timing matrix:** degrees-to-perfection × (angular/succedent/cadent × cardinal/
  mutable/fixed) → days/weeks/months/years; cadent = don't judge timing at all.

### Horary mechanics — now precisely codeable (DeLuce + deVore agree)
- **Translation of light:** T separates from A, applies to B, A-B not in aspect, T
  faster than both → a third party carries the matter.
- **Collection of light:** A and B (no aspect) both apply to a SLOWER C that is in an
  essential dignity of BOTH (reception gate — keeps it rare) → a broker collects.
- **Refranation, two triggers, one pattern ("the deal that doesn't close"):**
  by-station (applying planet turns Rx before perfection — DeLuce/deVore) and
  by-sign-exit (Hampar).
- **Frustration/prohibition:** A applies to B, but a swifter C perfects to B first →
  the matter is cut off; the culprit is named by the house C rules.
- **deVore's "Testimony" definition** — "the synthesis of several testimonies
  constitutes a judgment" (Ptolemy) — epigraph for the spec.

### deVore cross-check — every shipped table SURVIVES
Egyptian terms: agree 10/12; the 2 mismatches are deVore's own misprints (Libra
Venus/Mercury swap; Capricorn row duplicated from Aquarius) — our rows are canonical.
Dignity points 5/4/3/2/1 + detriment −5/fall −4/peregrine −5: confirmed. Faces
(Chaldean): confirmed (say "decan" in user copy — "face" is ambiguous). Combust
8°30′/cazimi 0°17′/beams 17°: within his stated bounds (note: ≤3° = core combustion,
could deepen the penalty; **Mars combust intensifies, not weakens** — per-planet
exception; cazimi's +5 is the Lilly choice, some authorities dissent — low confidence).
Triplicity: keep Dorothean (his water variant noted). **Wilson's accidental table adds:
mutual reception +5/+4 (priced like domicile/exaltation!), besieged by benefics +6 /
malefics −6, increasing light +2/decreasing −2, hayz +1.** Plus a Fortuna
dignity-by-sign table for the Lots brick.

### March — marriage / moving-in / property rules (complete, verbatim-condensed) — QUEUED
Deltas beyond Hampar already captured: **never a retrograde Venus in a marriage
chart** · Sun/Moon applying square/opp Uranus = separation risk when exact · rising-
sign mode by goal (fixed=lasting, cardinal=speed; Aries/mutable rising = short-lived
marriage) · Saturn not angular + no applying hard aspects TO Saturn incl. conjunction ·
luminaries+benefics ABOVE the horizon ("elevated") bonus · Pluto joins the
angle-avoid set · quincunx counts for moving-day Moons · **Rx scope split: Merc/Ven Rx
bars BUYING but not MOVING IN** · Moon signs: marriage avoid Scorpio, favor Libra/Leo;
property favor Cancer/Taurus.

### Hampar — per-activity checklists (verbatim, Ch.5) + the daily tier — QUEUED
Full per-activity extraction (audition/surgery/valuables/car/exam/travel/home/move/
gambling/pet/physical/marriage/tax/insurance/legal/air-travel/business/group/rehab)
lives in the pass-3 agent digest — each with houses, significators, Moon rules, and
avoid-clauses; load into activityCorrespondences when that brick lands. Highest-value
deltas: **decreasing Moon lowers price when buying, increasing raises it when
selling** · per-activity Moon signs (Taurus=business, Cancer=food/real-estate,
Leo=audition, Libra=settlement) · "moment of finality" definitions per activity ·
gambling needs 3+ natal activations (hard gate) · Saturn out of 2/5/8/11 for wins ·
**the no-chart daily election (Ch.4): for ordinary daily acts drop houses entirely —
elect on the Moon's next applying aspect (how it starts) + her last in-sign aspect
(how it ends).** That's Compass's operating altitude, sanctioned in print.
NOTE: Hampar's Appendices A/B (alphabetical activity→house tables) are page images —
`brew install poppler` would unlock them for a future pass.

### George (*Authentic Self*) — the natal-report procedure — QUEUED for reports
Session order: lunation phase (jargon-free opener) → Ascendant (persona/motivating
need) → **Asc-ruler as steersman** (who/how/where + 8 condition questions) → Sun
(content of purpose: occupies/rules/filter) → Moon (application in daily life) →
**the 100-word distillation** → topics via house rulers. Everything else enters ONLY
through connection to these majors (anti-spice-rack, stated). Weighting: condition
modulates CAPACITY, never CONTENT. Descriptive→prescriptive ("advise how to use it").
**Dual-register rewording examples** (retrograde, cadent Sun, combust, detriment-with-
dispositor-rescue) transcribed in the agent digest — the template voice for honest+
constructive debility copy, each: name it plainly → reframe psychologically → end with
the rescue/hope clause if the chart gives one.

### Grant Lewi (*Heaven Knows What*) — the voice masterclass + a scoring rubric
- **The aspect-census rubric (¶249-250):** "trines make ease, contentment, happiness,
  luck; squares give energy, drive, success, ambition. Conjunctions bring both… If both
  squares and conjunctions, the top!" Squares-only = "great energy… but little luck."
  **Hard aspects are ENGINES, soft are LUBRICANT; the best chart has both** — ideal
  logic + copy frame for Tide-Level (coherence-not-favorability confirmed by a third
  source). (PDF pp.221-222)
- **The reusable voice pattern** (8 verbatim samples in the agent digest): open with
  the gift → name the shadow mechanism SPECIFICALLY → give the developmental arc
  (youth struggles → maturity integrates) → end with concrete, doable advice. Direct
  "you," aphorisms, zero jargon, zero doom, humor as trust-builder ("IGNORE this. It
  can't happen here!").
- **Method:** trine+sextile collapse to one symbol (harmony), square+opposition to
  another (tension→"conflict or power, depending on the uses"); aspect fidelity beats
  sign fidelity; asterisked majors first = manual salience tiering; every paragraph
  branches on the chart's Sun-Moon temperament (two-register conditional copy) and
  cross-references combinations ("If with 163…") — convergence-as-recipe, 1935.
- Sun△Saturn honesty: "The tendency of this aspect is to smugness… you don't seem to
  get very far" — independent confirmation of the curse-of-the-trines.
- **Acquisition target: Lewi's *Astrology for the Millions*** — the Saturn/Jupiter
  transit "life clock" is THERE, not in HKW.

### Frawley (*Ayurvedic Astrology*) + Raphael (*Medical Astrology*) — bodyWeather base
- **Planet↔dosha:** Vata = Saturn/Mercury/Rahu (Mercury the young healthy Vata, Saturn
  the old) · Pitta = Sun/Mars/Ketu (Sun vitality, Mars the disease-maker) · Kapha =
  Moon/Venus/Jupiter (Jupiter "the planet of positive health"). Rule: "the nature of
  the planets is more important than that of the signs."
- **Daily arc hook (dinacharya skeleton):** Kapha=morning/spring/childhood ·
  Pitta=noon/summer/midlife · Vata=sunset/fall/old-age — a body-weather day-curve.
- **Key disease rule:** *weak* planets (benefic or malefic) cause Vata disorders;
  strong malefics cause their own dosha's issues only when afflicting Asc/lord.
- **Remediation ladder (the MODEL for a remediation feature):** diagnose excess vs
  deficiency → pacify or strengthen via media subtle→gross (color → aroma → taste →
  gem), with each planet having an increase-kit and a counter-kit; precious remedy +
  accessible substitute maps to premium-ritual + free-practice. Tables (tastes, aromas,
  colors, gems) transcribed in the agent digest.
- **Raphael sign→body (threefold: external/internal/structural) + planet→physiology
  tables transcribed verbatim** (agent digest) — cross-checkable against Frawley's
  sign+house→region table (both agree on the classic zodiacal man).
- **Moon-sign body-sensitivity rule (Raphael Ch.VII, echoed by Tobey):** the body part
  ruled by the Moon's current sign is tender today — a ready daily body-note, and the
  basis of the surgery avoid-rule already captured from Hampar/George.
- **Frawley planetary-type diagnosis model (Ch.4):** nine constitutional types with
  explicit placement rules per planet — a structural template for the Guiding-Star
  planet-diagnosis feature.
- Popular four (Niles, de Jersey, Bachelder, Hazen): skip — one idea each (casebook
  story format for Studio; per-sign quotation as daily garnish).

### Lot formulas (George Ch.33; Döser) — QUEUED
- **Fortune** (body/health/wealth): day `Asc + Moon − Sun`, night reversed. **Sect-reversed.**
- **Spirit** (reverse of Fortune): day `Asc + Sun − Moon`, night reversed. **Sect-reversed.**
- **Profession** (Döser, not sect-reversed): Bonatti `Asc + Moon − Saturn` (preferred), or
  Valens `Asc + MC − Sun`.
- **Assets** (2nd-house wealth, not sect-reversed): `Asc + cusp2 − lord-of-2`.
- **Basis** (foundation) — NOT in the verified extracts; transcribe from Valens/Brennan
  before encoding (it's the shorter Fortune–Spirit arc from the Asc).
