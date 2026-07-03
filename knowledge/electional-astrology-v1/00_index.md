# Electional Astrology v1 — "Launch"

**Status:** draft for user review. Nothing here is wired into the app yet — this is
the knowledge base the "Launch" feature's scoring engine will read from, in the
same spirit as `knowledge/medical-astrology-v1/` (documented tradition, explicit
sourcing, explicit limitations, a safety floor of its own).

**What electional astrology is:** the discipline of choosing a good *moment* to
begin something, on the premise that a beginning's chart describes the shape the
undertaking will tend to take. It is the mirror image of natal astrology — instead
of reading a birth you already had, you're picking one on purpose.

**Scope of this v1:** Western tropical, whole-sign-adjacent reasoning (the app's
Currents already supports multiple house systems; electional rules below use
house *meaning*, not a specific system's cusps, so they travel across systems).
Covers: universal cautions/supports that apply to any election, a category→house
mapping for the ventures people actually ask about, the planetary-hour overlay
(already computed by the app), and worked examples. Does **not** cover horary
(answering a question from the moment it's asked), fixed stars, or non-Western
systems.

**Files:**
- `01_universal_rules.md` — cautions and supports that apply to every election, regardless of category
- `02_categories.md` — venture → relevant house(s), planet(s), and category-specific cautions
- `03_planetary_hours.md` — the hour-ruler overlay (already computed in `astro.ts::getPlanetaryHour`) and how it layers onto the above
- `04_worked_examples.md` — three full elections walked through
- `05_safety_and_limits.md` — what this inherits from the medical KB's safety floor, and where electional astrology's own honest limits are

**Relationship to the existing engine:** every rule below is checkable against
primitives that already exist — `voidOfCourse`, `getMajorAspects` (applying/
separating + orb), `moonPhase`, `getPlanetaryHour`, `getLocalAngles`,
`getNextAngularCrossings`. The v1 "Launch" feature is a *scoring function* over a
date range using `findPeakWindows`'s existing scan pattern (see `dayarc.ts`) —
not a new astronomical subsystem. Building it is described in `05_safety_and_limits.md`'s closing note and left for a separate implementation pass.
