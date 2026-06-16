# Observatory — Medical Astrology Reference

A working knowledge base for the Observatory app. Organized by astrological domain, layered for both internal app use and practitioner reading.

This file is the entry point. Every other file in `reference/` is reachable from here.

---

## How to read this document

### Layered entries

Every substantive entry — planet, sign, house — uses the same five-layer structure so the app can address any single layer in isolation and a human can read top-to-bottom:

1. **Tradition** — what the historical and modern sources actually say, in their own terms. Not modernized, not softened.
2. **Mixed testimony** — where sources contradict each other or themselves. Preserved, never resolved.
3. **Observatory translation** — the same material reframed as symbolic timing, pattern-tracking, or constitutional tendency. Uses the fixed `Traditional: / Observatory:` format.
4. **Module feeds** — which app modules draw on this entry, and how.
5. **Safety flags** — anything fatalistic, prescriptive, diagnostic, or fear-inducing. Marked `⚠ SAFETY`.

Planets get two additional layers between *Observatory translation* and *Module feeds*: **When [planet] is a resource** and **Counterbalance — tempering an excess**, plus a **Cross-tradition note** where a TCM (or later, Ayurvedic) correspondence is informative.

### Module tags

Every entry is tagged with the modules it serves, drawn from this set:

- `Framework` — the conceptual scaffolding the whole app rests on
- `Learn` — user-facing articles and educational surfaces
- `Natal Blueprint` — the constitutional engine; what the chart says about the *shape* of a body
- `Body Weather` — the moment-to-moment engine; what current sky says about *today's* weather
- `Workbench` — the practitioner-facing synthesis surface
- `Herbal Compass` — the symbolic plant correspondence surface
- `Decumbiture` — the illness-onset chart surface (symbolic only; never prognostic)

### Citation

Sources are cited inline by short form where a claim is directly traceable (e.g. *Culpeper, Semeiotica Uranica*; *Cornell, Encyclopaedia*; *Ptolemy, Tetrabiblos* III.12). The full source library, with provenance and copyright status, lives in **Appendix A**. The text never pretends to neutral authority — it always names whose doctrine it is reporting.

---

## First principles

These seven principles are the interpretive floor for every entry. They are restated whenever an entry's content is at risk of drifting from them.

1. **Astrology is symbolic timing and pattern language, not medical causation.** The chart does not *cause* anything in the body. It describes resonances, tempo, and shape.
2. **The natal chart describes constitutional tendencies, not fixed pathology.** A placement is a leaning, never a verdict.
3. **Transits describe timing, activation, and emphasis — not inevitable events.** Weather, not forecast.
4. **Check-ins and symptoms are lived evidence.** The chart never overrides the body. When chart and body disagree, the body is right.
5. **Suggestions are supportive practices, not treatment.** Nothing in this reference is a prescription, a dose, or a diagnosis.
6. **Contradiction and mixed testimony are expected and preserved.** Sources disagree; honest sources name where they disagree. So does this one.
7. **The goal is cultivation, not optimization.** Observatory does not promise health, healing, or self-improvement. It offers a vocabulary for paying attention.

---

## The safety floor (in brief)

The Decumbiture module **does not, and will never, assess survival, recovery prognosis, danger, or "signs of life or death."** The fatalistic core of the historical decumbiture tradition is documented in Part VII for completeness and excluded from the engine.

The Herbal Compass surfaces planetary correspondences only. It does not recommend, dose, prescribe, or treat. Toxic and contraindicated plants are explicitly flagged.

Body Weather output never names a transit as causing a condition, never predicts illness, and never claims health outcomes. Saturn weather (and any other "heavy" weather) is described as **demanding**, never **dangerous**.

The full safety doctrine lives in **Part X — Safety Floor & Hard Limits** (`10_safety_floor.md`).

---

## Table of Contents

### Part I — Foundations
**File:** `01_foundations.md`

The conceptual scaffolding — qualities, elements, humors, temperaments, sympathy/antipathy, what "disease" meant in the tradition, and what Observatory tracks instead.

### Part II — The Planets
**Folder:** `02_planets/`

- `00_overview.md` — the planetary system, traditional vs. modern, dignities, sect, condition
- `01_saturn.md` — Saturn
- `02_jupiter.md` — Jupiter
- `03_mars.md` — Mars
- `04_sun.md` — Sun
- `05_venus.md` — Venus
- `06_mercury.md` — Mercury
- `07_moon.md` — Moon
- `08_uranus.md` — Uranus
- `09_neptune.md` — Neptune
- `10_pluto.md` — Pluto
- `11_combinations.md` — planetary pairs and midpoint logic

### Part III — The Zodiac Signs
**Folder:** `03_signs/`

- `00_melothesia.md` — the head-to-toe body, Aries through Pisces
- `01_aries.md` … `12_pisces.md` — one file per sign
- `13_axes.md` — sign polarities and the body axes they describe

### Part IV — The Houses
**Folder:** `04_houses/`

- `00_overview.md` — the medical houses overview
- `01_first.md` — body, vitality, the patient
- `02_second.md` — intake, diet, resources
- `03_third.md` … `12_twelfth.md`
- The six **medical-flagged** houses (1, 2, 6, 7, 8, 10) are treated at full depth; the others are shorter

### Part V — Temperament & Constitution
**File:** `05_temperament_and_constitution.md`

The composite temperament method (eleven weighted factors, Hot/Wet/Cold/Dry). The clarity-gating rule (name a temperament only when the chart is being clear). Cultivation strategies — humoral, planetary day/hour of birth.

### Part VI — Body Weather: Timing & Activation
**File:** `06_body_weather.md`

Transits as weather, not forecast. The lunar cycle. Planetary days and hours. How natal + transit combine into "today's weather."

### Part VII — Decumbiture & Onset Charts
**File:** `07_decumbiture.md`

The decumbiture tradition, what it can and cannot symbolize, the Moon's motion during an illness — and the hard exclusion of life/death assessment.

### Part VIII — Materia Medica & the Herbal Compass
**File:** `08_materia_medica.md`

Planetary rulership of plants, qualities and degrees, sympathy vs. antipathy in treatment, the Compass scope limit, plants requiring caution.

### Part IX — The Workbench (practitioner synthesis)
**File:** `09_workbench.md`

Dignities and debilities, house analysis for the practitioner, constitution work, decumbiture work, the Herbal Compass in practice, report generation.

### Part X — Safety Floor & Hard Limits
**File:** `10_safety_floor.md`

The consolidated safety doctrine. What Observatory never does. The translation protocol (`Traditional → Observatory`). Handling fatalistic source material. Escalation and deferral.

### Part XI — Cross-Tradition Correspondences
**File:** `11_cross_tradition.md`

Observatory's stance on holding multiple traditions. Yin/Yang as a meta-frame. The five elements (*wuxing*) and the planet correspondences. Channels and signs. Convergences and tensions. Future expansion (Ayurveda, etc.).

### Appendices
**Folder:** `appendices/`

- `A_sources.md` — source library and provenance
- `B_glossary.md` — technical terms
- `C_tables.md` — quick-reference correspondence tables
- `D_open_questions.md` — collected doctrinal questions pending Charlie's decision

---

## Build status

| File | Status |
|---|---|
| `00_index.md` | Drafted |
| `01_foundations.md` | Drafted |
| `02_planets/00_overview.md` | Drafted |
| `02_planets/01_saturn.md` | Drafted |
| `02_planets/02_jupiter.md` | Drafted |
| `02_planets/03_mars.md` | Drafted |
| `02_planets/04_sun.md` | Drafted |
| `02_planets/05_venus.md` | Drafted |
| `02_planets/06_mercury.md` | Drafted |
| `02_planets/07_moon.md` | Drafted |
| `02_planets/08_uranus.md` | Drafted |
| `02_planets/09_neptune.md` | Drafted |
| `02_planets/10_pluto.md` | Drafted |
| `02_planets/11_combinations.md` | Drafted |
| **Part II complete** | |
| `03_signs/00_melothesia.md` | Drafted |
| `03_signs/01_aries.md` | Drafted |
| `03_signs/02_taurus.md` | Drafted |
| `03_signs/03_gemini.md` | Drafted |
| `03_signs/04_cancer.md` | Drafted |
| `03_signs/05_leo.md` | Drafted |
| `03_signs/06_virgo.md` | Drafted |
| `03_signs/07_libra.md` | Drafted |
| `03_signs/08_scorpio.md` | Drafted |
| `03_signs/09_sagittarius.md` | Drafted |
| `03_signs/10_capricorn.md` | Drafted |
| `03_signs/11_aquarius.md` | Drafted |
| `03_signs/12_pisces.md` | Drafted |
| `03_signs/13_axes.md` | Drafted |
| **Part III complete** | |
| `04_houses/00_overview.md` | Drafted |
| `04_houses/01_first.md` | Drafted |
| `04_houses/02_second.md` | Drafted |
| `04_houses/03_third.md` | Drafted |
| `04_houses/04_fourth.md` | Drafted |
| `04_houses/05_fifth.md` | Drafted |
| `04_houses/06_sixth.md` | Drafted |
| `04_houses/07_seventh.md` | Drafted |
| `04_houses/08_eighth.md` | Drafted |
| `04_houses/09_ninth.md` | Drafted |
| `04_houses/10_tenth.md` | Drafted |
| `04_houses/11_eleventh.md` | Drafted |
| `04_houses/12_twelfth.md` | Drafted |
| **Part IV complete** | |
| `05_temperament_and_constitution.md` | Drafted |
| `06_body_weather.md` | Drafted |
| `07_decumbiture.md` | Drafted |
| `08_materia_medica.md` | Drafted |
| `09_workbench.md` | Drafted |
| `10_safety_floor.md` | Drafted |
| `11_cross_tradition.md` | Drafted |
| **Parts V–XI complete** | |
| `appendices/A_sources.md` | Drafted |
| `appendices/B_glossary.md` | Drafted |
| `appendices/C_tables.md` | Drafted |
| `appendices/D_open_questions.md` | Drafted |
| **Appendices complete** | |
| **REFERENCE COMPLETE** | All parts and appendices drafted |

Status is updated as files are added.
