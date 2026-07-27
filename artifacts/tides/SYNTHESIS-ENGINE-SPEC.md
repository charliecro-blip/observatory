# Compass — Synthesis Engine Rule Spec (v1, 2026-07-23)

> The move from a **spice rack** (atomized per-planet suggestions) to a **recipe**
> (a woven reading where the parts make a whole). This is the research pass —
> the scoring model + starter pattern library, grounded in the traditions —
> written *before* we build so the synthesis is anchored, not invented.
>
> Sources verified against Lilly's *Christian Astrology* (dignity tables) and
> standard Jyotisha (yogas). Where traditions diverge, the choice is flagged in
> **§8 Open decisions** — those need your call before build.

---

## 1. The model in one picture

```
   the moment ─┬─▶ TESTIMONIES ──▶ weight × salience ──▶ SYNTHESIS ──▶ reading
               │   (each voice)      (§2)      (§3)         (§4)
               └─▶ NAMED PATTERNS ───────────────────────────────────▶ (§5)
                   (configurations → a name)         gated by (§6)
```

Every factor we already compute (planetary hour, angle crossing, Moon aspect,
ascendant + its ruler, sign, phase, VoC, dignity) becomes a **typed testimony**:

```ts
interface Testimony {
  source: "hour" | "crossing" | "moonAspect" | "ascRuler" | "moonSign"
        | "element" | "phase" | "voc" | "dayRuler" | "dignity" | "sect";
  toward: {                    // what it favours — the vector we synthesize
    activities?: string[];     // keys from activityCorrespondences
    qualities?: Record<string, number>; // e.g. {focus:+2, connection:-1}
    element?: string; planet?: string;
  };
  weight: number;              // intrinsic strength — DIGNITY drives this (§2)
  salience: number;            // how LOUD right now (§3)
  polarity: 1 | -1;            // supportive or cautionary
  note: string;                // plain-language, for the drill-down
}
```

The whole engine is: **produce testimonies → weight them → find the shape.**

---

## 2. The weight scalar — dignity (the missing piece)

Right now every factor speaks at the same volume. It shouldn't. A planet
**in its own sign speaks with authority**; a **peregrine** planet mutters. Dignity
is the scalar we've never used, and it's what makes a reading feel *judged*
rather than listed. We apply it to the **current** positions to weight the day's
voices (the Moon's dignity today, the hour-ruler's dignity today, etc.).

### 2a. Essential dignity — condition by sign (Lilly / Ptolemaic)
[Verified — Lilly's scoring.](https://astrogrammar.com/wp-content/uploads/2019/07/190723_Lillys_Scoring_System.pdf)

| Condition | Score |
|---|---|
| Domicile (own sign) | **+5** |
| Exaltation | **+4** |
| Triplicity ruler | **+3** |
| Term / bound | **+2** |
| Face / decan | **+1** |
| Peregrine (no dignity at all) | **−5** |
| Detriment (opposite domicile) | **−5** |
| Fall (opposite exaltation) | **−4** |

The domicile/exaltation/detriment/fall tables are fixed and canonical. Triplicity
uses the **Dorothean** rulers by sect (day/night), terms the **Egyptian** set,
faces the **Chaldean** order — all standard lookups (implement from a canonical
table, don't hand-transcribe; that's how the asteroid errors happened).

### 2b. Accidental dignity — condition by circumstance (Lilly)
[Verified — Lilly's table, *Christian Astrology* p.115.](https://www.astro.com/astrowiki/en/Accidental_Dignities)

| Fortitude | + | Debility | − |
|---|---|---|---|
| In 1st or 10th | +5 | In 12th | −5 |
| In 7th, 4th, 11th | +4 | In 6th or 8th | −2 |
| In 2nd or 5th | +3 | Retrograde | −5 |
| In 9th | +2 | Slow in motion | −2 |
| In 3rd | +1 | Combust (within 8°30′ of Sun) | −5 |
| Direct | +4 | Under the Sun's beams (within 17°) | −4 |
| Swift in motion | +2 | Besieged by Saturn/Mars | −5 |
| Oriental (Sat/Jup/Mars) or Occidental (Merc/Ven) | +2 | Conjunct Saturn/Mars | −5/−4 |
| Free of combustion & beams | +5 | Conjunct Caput Algol etc. | −5 |
| **Cazimi** (within 0°17′ of Sun — heart of the Sun) | +5 | | |
| Conjunct Jupiter/Venus, or Regulus/Spica | +5/+4 | | |

**Net dignity = essential + accidental**, normalized to a **weight in ~[0.2 … 2.0]**
(a peregrine, combust, cadent planet ≈ 0.2; a domicile, angular, direct planet ≈ 2.0).
That weight multiplies the testimony. *This one addition changes everything —
it's the difference between "Mars hour" and "a strong, dignified Mars hour, and
therefore worth trusting."*

> Hellenistic refinement worth adopting: **sect.** By day the Sun's team
> (Sun/Jupiter/Saturn) is better-behaved; by night the Moon's (Moon/Venus/Mars).
> A malefic **contrary to sect** is the loudest cautionary testimony there is.

---

## 3. Salience — "what needs to be focused on"

Your exact question: *the planetary hour, the angle crossing, or the ascendant
and its ruler?* Salience answers it. A factor's loudness is a product of:

- **Exactness** — an applying aspect/crossing at 0°10′ is a peak; at 5° it's ambient. `exact = 1 − orb/maxOrb`.
- **Rarity / fleetingness** — an **angle crossing** is a ~20-min event → high, urgent, short. A **sign** is a multi-day backdrop → low, framing.
- **Structural role** — the **ascendant + its ruler** is the *spine*: never the loudest event, but always the frame the day is read *through* (constant medium salience). The **applying Moon aspect** is the day's *engine* (high when tight). The **planetary hour** is the rotating *sub-mood* (low–medium).

```
salience(t) = STRUCTURAL_BASE[t.source] × (0.4 + 0.6·exactness) × rarityFactor
```

Suggested `STRUCTURAL_BASE`: crossing 1.0 · applying Moon aspect 0.9 · asc-ruler
condition 0.8 · dignified hour 0.6 · phase 0.5 · sign 0.4 · VoC 0.7 (when in it).

**The output of §3 is a ranked list.** The top 1–2 = **"what to watch now."** That
*is* the discernment, made computable — and it's exactly what you said you'd track.

---

## 4. Synthesis — how the parts make the whole

Aggregate every testimony's `toward` vector, each scaled by `weight × salience × polarity`:

- **Convergence.** Cluster the vectors. Where several agree above a threshold →
  **the overarching flavour + its foci** (the main dish). Output form: *"Today is
  fundamentally about consolidating — Saturn's dignified hour, an earth Moon, and
  the 10th-house crossing all pull the same way."* (We name the agreement, not the list.)
- **Counterpoint.** A **high-weight testimony that dissents** from the convergence →
  the *"but…"*. A lone strong voice against the grain is what makes a reading ring
  true instead of bland. *"…though a tight Moon–Uranus square wants to break routine —
  hold the structure loosely."*
- **Quiet days honestly.** If nothing converges and nothing is salient → say so
  ("an open, unmarked day") rather than manufacturing drama. (We already do this
  for the tide; the synthesis inherits it.)

Output object:

```ts
interface DayReading {
  flavour: string;            // the woven whole, one sentence
  foci: string[];             // 1–3 concrete things it favours
  watch: Testimony[];         // top salience — "focus on this"
  counterpoint?: string;      // the honest "but…"
  patterns: NamedPattern[];   // §5 — the named shapes present
  testimonies: Testimony[];   // the parts, for the drill-down
}
```

---

## 5. Named patterns — the "yoga" library (starter set)

The purest "parts → whole": a **configuration** fires a **named** reading. This is
where horary, Hellenistic, and Vedic all contribute. Each pattern:
`{ name, trigger, reading, weight, polarity }`. A v1 set of ~18:

**Traditional / horary**
1. **Ruler of the hour = ruler of the ascendant** → a *doubled, focused* day; the hour's theme is the day's spine. (high)
2. **Benefic angular** (Venus/Jupiter in 1/4/7/10, in good condition) → a *graced* window.
3. **Malefic angular, contrary to sect** → a *pressured* day; move gently.
4. **Moon applying to its dispositor** → *things coming home*; follow-through favoured.
5. **Moon void of course** → *nothing new takes*; finish, rest, don't launch. (gate — see §6)
6. **Cazimi** (a planet in the heart of the Sun) → that planet's matters are *exalted, protected* for the day.
7. **Besiegement** (a planet hemmed by Saturn & Mars) → *squeezed*; that theme is under strain.
8. **Mutual reception** (two planets in each other's dignity) → *cooperation*; a stuck thing eases.
9. **Translation / collection of light** (a third planet carrying two together) → *a broker appears*; introductions, deals.

**Hellenistic**
10. **Benefic of sect angular** → the day's *best hours* are genuinely trustworthy.
11. **Lot of Fortune well-placed & aspected** → *ease around resources/body*.
12. **Sun–Moon in phase-of-strength** (e.g. waxing, applying) → *momentum with the tide*.

**Vedic (yogas)** — sidereal-native; see §8 for the zodiac decision
13–17. **Pancha Mahapurusha** ([verified](https://blog.cosmicinsights.net/pancha-mahapurusha-yogas/)): Mars/Mercury/Jupiter/Venus/Saturn **in own sign or exaltation, in a kendra (1/4/7/10)** → **Ruchaka / Bhadra / Hamsa / Malavya / Sasa** — a day with that planet's *greatness* available. (Broken by combustion/retrogradation — note.)
18. **Gaja-Kesari** — Jupiter in a kendra *from the Moon* → *wisdom + heart aligned*; good counsel, teaching, generosity land.
19. **Chandra-Mangala** — Moon + Mars conjunct/aspecting → *drive fused with feeling*; potent for effortful care (training, decisive tending), watch for reactivity.
20. **Kemadruma** — Moon with no planets in the 2nd/12th from it or in kendra → *isolation*; a flat, unsupported day (a true "low tide" testimony).

*Applied to a day*, "kendra from the Moon" and "own sign" are read against the
**transiting** sky (and, when a chart exists, against the natal angles). The library
is a data file — easy to extend, easy to audit, each entry independently testable.

---

## 6. Considerations before judgment — reliability gates

Lilly's "considerations before judgment" become **reliability flags** on the whole
reading, not extra testimonies:

- **Moon void of course** → the day's initiations are unreliable; the reading leans
  toward *finish/rest*, and GREAT-tier election windows are suppressed (we already do this).
- **Late/early degrees on an angle**, **Moon in Via Combusta** (15° Libra–15° Scorpio),
  **Saturn in the 1st/7th** → lower the *confidence* of the reading (we already show a
  confidence chip — this feeds it).
- These don't add flavour; they tell the user *how much to trust today's reading* —
  which is itself a mark of a good astrologer, and of an honest engine.

---

## 7. How it lands in simplicity (the payoff)

This plugs straight into the astro-detail levels already shipped:

- **Minimal** = `flavour` + the single top `watch`. One woven sentence, one thing to
  focus on. *This is why the synthesis matters — it's what makes "minimal" honest
  rather than dumbed-down.*
- **Medium** = flavour + foci + counterpoint + the named patterns present.
- **Full** = the whole testimony table, dignities, salience scores — the reading's working.

The daily/weekly reports and the tide hero all consume `DayReading` instead of
assembling ad-hoc lists. One synthesis, many surfaces.

---

## 8. Decisions — RESOLVED (owner, 2026-07-23)

1. **Zodiac / tradition weighting → MODERN SYNTHESIS.** Tropical throughout; run
   the yoga *geometry* (kendra-from-Moon, own-sign, exaltation) on our tropical
   positions. Respect the tradition, but **include the modern planets**
   (Uranus/Neptune/Pluto, + Chiron/nodes/asteroids) and a **psychological**
   register, not a fatalistic one. (Precedent: Surya-Siddhanta runs a *solar/tropical*
   calendar while keeping sidereal nakshatras — tropical-frame + traditional-content
   is a real lineage.) **Nakshatras deferred** — a future build.
2. **Houses → FLEXIBLE.** Honor the existing pluggable house system (whole-sign
   default; quadrant available). Angularity/accidental-dignity house scores read
   from whatever system is selected.
3. **Dignity → YES**, it's the foundation.
4. **Terms / triplicity → builder's call, with practitioner-level OPTIONALITY.**
   v1 default: Dorothean triplicities + Chaldean faces (both implemented);
   **Egyptian terms pluggable, filled from a verified source** (owner is gathering
   books). A future setting exposes system choice (Egyptian vs Ptolemaic terms,
   etc.) for deeper practitioners.

### Original open questions (for the record)

1. **Zodiac for the yogas.** The Vedic patterns are **sidereal**-native; the rest of
   Compass is **tropical**. Options: (a) compute yogas in sidereal (a ~24° ayanamsa
   shift) and keep everything else tropical — most traditionally correct, slightly
   schizophrenic; (b) run the yoga *geometry* (kendra-from-Moon, own-sign) on our
   tropical positions — pragmatic, purists will wince; (c) drop the sidereal-specific
   yogas for v1 and keep only the ones that are zodiac-agnostic. **My lean: (b) for
   v1, flagged, then revisit** — but this is yours.
2. **House system for angularity** — we default whole-sign for Currents; horary
   assumes quadrant (Regiomontanus). Which for the accidental-dignity house scores?
3. **Tradition weighting.** How heavily does the synthesis lean **horary/Hellenistic
   (dignity-and-testimony)** vs **Vedic (yoga-pattern)**? A dial, or a firm stance?
4. **Term & triplicity system** — Egyptian terms + Dorothean triplicities (my default),
   or Ptolemaic throughout?

---

## 9. Build order (once §8 is settled)

1. **Dignity module** (`lib/dignity.ts`) — essential + accidental → a `weight` for any
   planet at any moment. Independently testable against known charts.
2. **Testimony collectors** — wrap the factors we already compute as `Testimony`s.
3. **Synthesis** — convergence / counterpoint / salience → `DayReading`.
4. **Pattern library** (`lib/patterns.ts`) — the §5 set as data + matchers.
5. **Wire `DayReading`** into the tide hero + daily report; gate by astro-detail.

Dignity first because it's the scalar everything else multiplies by — and because
it's verifiable on its own before any synthesis rides on top.
