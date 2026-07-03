# Universal Rules

These apply to *any* election, before category-specific rules are layered on.
Classical electional astrology (Lilly, Bonatti, and the tradition Lilly compiles
in *Christian Astrology* III) treats the Moon as the co-significator of nearly
every undertaking — she moves fastest, and her condition at the moment of
beginning is read as the early "weather" the thing will move through. Almost
every universal rule below is really a rule about the Moon.

## Hard cautions — avoid these regardless of category

1. **Void of course Moon.** The Moon perfects no further aspect before leaving
   her sign — classically read as "nothing comes of it." Already computed:
   `voidOfCourse(jd)`. Avoid starting anything you want to *go somewhere* during
   a void; void windows are for finishing, reviewing, resting — not launching.
2. **Via combusta.** The Moon in the last half of Libra through the first half
   of Scorpio (roughly 15° Libra–15° Scorpio) — a classically "burnt" stretch,
   read as unstable/erratic regardless of aspect. A soft caution (checkable
   from `moonLongitude`, not yet exposed as a flag) — worth a mild penalty in
   scoring, not a hard block.
3. **Moon in her final degrees of a sign** ("Moon in the last degree," or the
   final ~1–2°). Read as a thing about to run out of room to develop before it
   changes character — avoid for anything meant to unfold over time.
4. **Moon separating from a hard aspect with nothing supportive following.**
   If the Moon's most recent perfected aspect was a square/opposition and her
   next applying aspect is far off or itself hard, the moment carries friction
   forward with no near relief. Prefer moments where the Moon's *next* aspect
   (her "first applying aspect," see below) is soft.
5. **Mercury retrograde**, specifically for anything involving contracts,
   commitments, or releases (signing, publishing, financial ventures). Not a
   hard rule for every category (see `02_categories.md`), and notably NOT a
   caution for writing itself — drafting, revising, and returning to old
   material classically *suit* the retrograde. The caution is about what goes
   out into the world under it, not what gets worked on privately.
6. **Eclipses within ~3 days** (before or after). Eclipses are traditionally
   read as accelerants that also destabilize — a launch too close to one tends
   to run hot and change shape faster than planned. The app's `activeEclipse`
   (`conditions.ts`) already flags this window.
7. **A malefic (Mars or Saturn) closely afflicting the ascendant or the
   relevant house's ruler** (see categories) by hard aspect and tight orb
   (≤3°). The classical read: whatever governs the venture starts already under
   strain.

## Supports — prefer these when available

1. **Waxing Moon** (increasing in light, first quarter through full) for
   anything meant to *grow* — new ventures, launches, first meetings, planting
   in the literal and figurative sense. **Waning Moon** favors completions,
   reductions, endings, and "let this run down" undertakings — not itself bad,
   just suited to a different kind of beginning (ending something well is
   still a kind of beginning).
2. **The Moon's first applying aspect is to a benefic** (Venus or Jupiter) by
   trine or sextile. This is the strongest single "good omen" signal in the
   tradition — read as the venture's first real test going well.
3. **A well-placed, direct, dignified ruler of the relevant house** (see
   `02_categories.md`) — not retrograde, not combust (too close to the Sun),
   ideally angular (near ASC/MC/DSC/IC — `getLocalAngles`/`getAngularPlanets`
   already compute this).
4. **The relevant planetary hour** (see `03_planetary_hours.md`) matching the
   venture's nature — a business launch in a Sun or Jupiter hour, a wedding in
   a Venus hour, a hard negotiation in a Mars hour used deliberately (not
   avoided — aimed).

## How this becomes a score, not a verdict

Classical electional practice is a *checklist*, not a single number — Lilly
walks through several of these in sequence for a given election and notes
where they conflict. The "Launch" feature should mirror that: surface which
rules are satisfied and which aren't, with the reasoning shown (in keeping
with the app's existing "reflect, don't predict" posture — see DESIGN.md §7),
rather than collapsing everything into a bare 0–100 score. A date can fail one
caution and still be the best available window in a range; the feature should
say so, not silently pick a technically-perfect moment three weeks out when
the user needs to act tomorrow.
