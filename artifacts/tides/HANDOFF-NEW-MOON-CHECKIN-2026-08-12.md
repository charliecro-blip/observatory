# New Moon / Turning-Point Check-In — owner brief, 2026-08-12

> Captured verbatim-in-spirit from the owner's own dictated notes, organized for
> a future session (mine or another agent's) to design and scope.
>
> **STATUS 2026-08-12 (same day):** v1 is BUILT and verified locally —
> `src/components/NewMoonCheckIn.tsx`, rendered at the top of Home. Prompt
> banner during the cycle window → one-pager (release line, stars still-true
> pass, one shot) → kept card on Home until ≈ the next new moon. The `CYCLE`
> constant in that file is the owner-curation seam (§5); storage is
> localStorage inside the `compass-` namespace so account deletion wipes it.
> Deferred, still open: DB persistence, automated trigger detection (§2's
> station-approach logic), Studio sharing (§6), per-moment graphics (§7).

## 0. Why now

Today (2026-08-12) is a new moon **and** a solar eclipse, near the Moon's south
node, in Leo — per the owner's own read of the sky. That coincidence is what
prompted the idea: turning points like this are naturally-occurring moments
where a "pause and reset" feature would land with real weight, not as an
invented occasion.

## 1. The core idea

A repeatable **check-in / reset ritual**, tied to real astrological turning
points, that:

- Checks in on the user's **Guiding Stars** (North Stars)
- Helps delineate the **important habits, rhythms, and moments coming up** in
  the period ahead (the month, for a new moon; the season, for a
  solstice/equinox; the retrograde's span, for a station)
- Draws on **three inputs at once**: (a) what the user has actually been doing
  in the app — real engagement history, not assumed — (b) the astrology of the
  moment itself, and (c) how that moment's astrology lands on the user's own
  natal chart specifically.

Explicitly requested reference point: **research how well-designed
journals/planners structure a reset ritual** (the owner named this directly —
think along the lines of *The Five-Minute Journal*, *Full Focus Planner*,
similar one-page reset formats) and bring that discipline to the design. The
target feel is **"a one-pager"** — not a wizard, not a multi-screen flow.

## 2. Trigger taxonomy (increasing rarity / significance)

| Trigger | Cadence | Notes |
|---|---|---|
| **New moon** | ~monthly | The baseline, repeatable case — this is the framework that has to work every month without the owner hand-tuning each one. |
| **Eclipse** | Rare (new/full moon coinciding with a node crossing) | Gets **special significance** over an ordinary new/full moon — e.g. today's south-node solar eclipse in Leo. Worth naming what makes *this* eclipse specific (node, sign, tightness) rather than treating all eclipses identically. |
| **Solstice / equinox** | Quarterly | A seasonal-scale check-in, longer horizon than a lunar one. |
| **Retrograde stations** — Mercury, Venus, Mars | Several times/year, per planet | **Not triggered at the exact station** — triggered a **few days ahead**, once the planet is within roughly **2–3° of its station degree** (i.e. visibly slowing down). This is a real timing detail the owner was specific about — don't build this off the exact-station date alone. |

## 3. Personalization axes (retrograde case, but the pattern generalizes)

The owner wants retrograde check-ins customized along several axes at once —
explicitly flagged as **"should be integrated, but manageable and doable"**,
i.e. don't let this balloon into unshippable complexity:

- **Which planet** (Mercury / Venus / Mars each get their own framing — a
  Mercury retrograde is not a Venus retrograde)
- **The sign it's retrograding in** → elemental focus / thematic color
- **The natal house that sign/degree falls in for this user** → which part of
  their actual life this touches
- **Whether other planets are involved** — a retrograde stationing in aspect
  to (or "in tandem with") another planet should be able to fold that into the
  read, not treat the retrograde in isolation

This same "moment astrology × natal chart" personalization is the same
principle already used elsewhere in the app (Currents' transit-by-house,
Today's personal-modifier line) — this feature should lean on that existing
capability rather than invent a new personalization mechanism.

## 4. Interaction model

- The **homepage/dashboard** surfaces a **prompt** when a trigger moment is
  active/approaching — a suggestion, not an obligation.
- Clicking in reveals **more specific suggestions** for that moment (the
  actual check-in content).
- **If the user completes/submits it** → the result gets **prominently
  featured on the homepage for a while** (a temporary highlighted state, not
  permanent).
- **If they don't** → **no consequence, no guilt, nothing lost** — the
  homepage just continues showing whatever else it would show. This matches
  the app's existing anti-fatalism stance (nothing in Compass should read as
  a demand). No streak-breaking, no "you missed it" language.

## 5. Owner's curation workflow (important — this is not meant to be 100%

automated)

The owner explicitly wants a **hybrid model**: an automated baseline that
works every month without hand-holding, PLUS the ability for **the owner
himself to manually curate an overarching framework for a given new
moon/eclipse ahead of time**, working directly with Claude to write/tune it —
especially for higher-significance moments (eclipses, in particular). Design
for that seam: whatever the automated version generates should be able to be
overridden or enriched by owner-authored content per-cycle, not replaced
wholesale by a from-scratch manual process each time.

**Beta testing is explicitly named as the right way to flesh this out** — the
owner sees this as something to iterate on with real beta-tester reactions,
not fully spec it up front.

## 6. Content / sharing angle

Significant astrological turning points (eclipses especially, retrograde
stations) are **share-worthy moments** — the owner wants this to plug into
the existing Studio content engine (see [[content-engine-and-beta-hardening]]
memory / the day/week/lunation IG cards already shipped). Two related but
distinct ideas here, worth separating when this gets designed:
1. **The check-in itself as an invitation** — shareable as "this is happening
   right now, pause with me" — a growth/acquisition hook.
2. **The completed check-in's content** as material Studio can turn into a
   card, same pattern as existing day/week/lunation cards.

## 7. Aesthetic notes (owner's own words)

- Should feel **elegantly designed**, genuinely "one page," not a form.
- Wants **specific graphics per planet**, or **color variations**, to make it
  visually legible at a glance which kind of moment is active (a Mercury
  retrograde check-in should not look like a Venus retrograde check-in, which
  should not look like an eclipse reset).

## 8a. The curation calendar (computed 2026-08-12, `tools/turning-points-scan.ts`)

From the app's own ephemeris, not from memory — the engine independently
confirms today's moment (new moon 2026-08-12, Leo 20°, solar eclipse). The
next eight months of trigger moments:

| When | Moment | Notes |
|---|---|---|
| **2026-08-28** | **Full moon, Pisces 5° — LUNAR ECLIPSE** | **The next check-in is 16 days out and is eclipse-tier again.** Curate it with the owner this month. |
| 2026-09-11 | New moon, Virgo 18° | First *ordinary* baseline cycle — the repeatability test. |
| ~2026-09-22 | Venus enters her station approach (≤2.5°) | Collides with the equinox the next day — first overlap case. |
| 2026-09-23 | Fall equinox | |
| 2026-10-03 | Venus stations retrograde, Scorpio 8° | Direct 2026-11-14 in Libra. |
| ~2026-10-18 | Mercury enters approach | |
| 2026-10-24 | Mercury stations retrograde, Scorpio 21° | Direct 2026-11-13 — Venus and Mercury retrograde **concurrently** Oct 24–Nov 13. |
| 2026-12-21 | Winter solstice | Mars's approach begins ~Dec 22 — another overlap. |
| 2027-01-10 | Mars stations retrograde, Virgo 10° | Direct 2027-04-01 in Leo — a season-long span. |
| 2027-02-06 | New moon, Aquarius 17° — SOLAR ECLIPSE | |

Measured approach lead-times (2.5° from the station degree): **Mercury ~6
days, Venus ~11, Mars ~19** — the owner's "a few days ahead" intuition,
now with real per-planet numbers to trigger on.

Two structural findings the calendar forces:
- **Collisions are normal, not edge cases** (equinox+Venus in September,
  double retrograde in November, solstice+Mars in December). The Home banner
  queue needs a rarity-priority rule; policy OPEN.
- Every trigger type occurs within the beta window — the whole taxonomy gets
  a live rehearsal by spring.

## 8b. Per-trigger one-pager frameworks (PROPOSED, sketched 2026-08-12)

Shared anatomy stays what v1 shipped: **a curated read (two short
paragraphs) → two or three prompts → a kept card on Home for the trigger's
own span.** What varies is the verbs:

- **New moon** (the monthly baseline, shipped): release · stars still-true ·
  one shot. Kept until the next new moon.
- **Full moon** — the harvest. Engagement-aware per §1: pull the wake/wins
  ledger since the last new moon as material. Prompts: *what came through?*
  · *what's now visible that wasn't?* · optional adjustment of the standing
  one-shot. Short span (~3 days); keeps a named win, not a new intention.
- **Eclipse** — the amplified case of whichever lunation it rides, weighted
  by node: south node leans release, north node leans commitment. Always
  owner-curated (§5 seam).
- **Equinox / solstice** — the season page, quarter horizon: name the
  season's one theme · choose which star leads the quarter · adjust rhythm
  to the changing light (chronotype tie-in). Kept ~90 days as a quiet season
  line, not a second hero.
- **Stations** — a brace-list, not intentions. Opens at the measured
  approach date, and the verbs differ by planet: **Mercury** = finish, send,
  back up, sign-before-the-turn; **Venus** = re-appraise (relationships,
  values, purchases), commit to nothing new; **Mars** = finish rather than
  launch, pace the drive. During the retrograde the kept card shows the turn
  date ("direct Nov 13"). Personalized per §3: sign, natal house, aspects at
  the station degree.

Marks, same construction grammar as the eclipse mark: full-moon disc,
station loop, solstice/equinox sun-angle.

## 8. Explicitly open / unresolved

- No UI has been designed. No data model has been proposed. This doc is
  intake, not a spec.
- Whether the "featured on homepage for a while" duration is fixed or scales
  with the trigger's own duration (a retrograde's span vs. a single eclipse
  day) is unresolved.
- The automated-baseline-vs-owner-curated-override mechanism (§5) needs an
  actual design — e.g. does the owner edit a markdown file per cycle, a CMS
  row, something else?
- Journal/planner research (§1) has **not** been done yet — flagged as a
  concrete next step before designing the one-pager's structure.
- Interaction with the ongoing Home/Today reorg (see conversation
  2026-08-12) is untouched — this is a new surface, not part of that pass.
