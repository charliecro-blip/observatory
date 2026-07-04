# Home-as-Dashboard + the Weather Metaphor — direction brief

**Status:** agreed direction (2026-07-04), not yet built. Supersedes the old
"calendar/tides-view design brief" line item. Pairs with `MARKETING-HANDOFF.md`
and the settled framework in `DESIGN.md`.

---

## The core decision

**Weather is the master metaphor and the interface language. "Tide" is demoted
to one instrument — the daily energy curve.** The product name stays **Tides**
(brand name above a plain-spoken interface, à la Apple "Weather"); no rebrand.

Rationale: weather is natively multi-instrument (so it maps to a dashboard),
it's inherently *described/forecast* not commanded (reinforcing the app's
anti-fortune-telling ethic), and it needs zero onboarding. "Tide" is a single
phenomenon and can't carry a whole dashboard — but it's perfect for the one
thing it already does: read the rise/fall of the day's energy.

## The home becomes a dashboard

A bento board of **instruments**, giving equal weight to **direction** (Guiding
Stars) and **conditions** (today's weather) — the two halves of navigating a day.
Recommended card set:

- **Guiding stars** — where you're steering (element-dotted, progress this week)
- **Today's weather** — the hero; the **tide curve lives *inside* this card** as the energy read, with the conditions headline
- **On deck** — today's tasks as woven by the Planner (see Planner feature)
- **The big sky / fronts** — the strongest transiting aspects right now
- **Currents** — the slow personal season underneath

(See the concept mockup rendered in-session 2026-07-04 for the layout intent —
structural, not final skin; the real thing wears the Tide/Almanac palette + the
Baar Sophia display face.)

## Customization — stage it, don't over-build

1. **Now:** a fixed, beautiful dashboard home. This is the real win — it reframes
   the app. (Today's page today is weather-only; stars are stranded in Aims.)
2. **Next:** show/hide + reorder cards via a settings list (NOT a drag grid).
   ~90% of the value for a fraction of the effort.
3. **Later, only if asked:** true drag/resize grid layout.

## Weather vocabulary map (how far to extend the metaphor)

Weather is the translation layer; keep the real astrology legible beneath it.

| Surface | Weather word | Under the hood |
| --- | --- | --- |
| Home | **Today's weather** | the whole daily read |
| Daily energy instrument | **Tide** | lunar energy curve (rise/fall) |
| Aspects now | **Fronts** / the big sky | transiting aspects |
| Slow transits | **Currents** *(already live)* | outer-planet cycles |
| Sun-sign period | **Season** *(already live)* | solar ingress |
| Caution windows | **Advisories** *(new — replaces alarmy "caution")* | hard aspects to sensitivity planets |
| The Planner | stays **Plan** | task-weaver |

"Advisories" is the highest-value copy change here — the right weather register
for "move carefully for a day," and it defuses the alarmy tone flagged earlier.

## Open decisions for the owner

1. **Home = dashboard, or keep Today as-is and add a dashboard tab?** (Recommend:
   the dashboard *becomes* Today/home — one strong surface, not two.)
2. **Rename "Today" tab → "Weather"?** (Leans into the metaphor; small nav change.)
3. **Adopt "Advisories"** for caution windows app-wide? (Recommend yes.)
4. How much of the **weather vocabulary** to roll out at once vs. incrementally.
5. Where **Guiding Stars** then lives — surfaced on the dashboard *and* still a
   full Aims tab, or does the dashboard card become its primary home?

## Suggested build order (once decisions land)

1. Fixed dashboard home (cards pull from existing endpoints — tide, stars,
   planner windows, big-sky aspects, currents; all already exist).
2. "Advisories" rename pass (copy-only, low risk).
3. Weather-vocabulary copy pass across surfaces.
4. Show/hide + reorder cards (persist a simple layout array in the profile).
