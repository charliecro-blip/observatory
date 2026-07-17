# Design request: Auspice Studio — Instagram card system

**For:** Claude Design
**From:** Auspice (formerly Tides) — astrological timing app
**Deliverable:** a high-fidelity design reference (HTML prototype + spec, like the celestial-glyphs handoff) for a family of Instagram-shareable cards. We will port it into the existing React/SVG Studio.

## What the Studio is

An in-app export tool that renders shareable readings of the sky as 1080-px PNGs. A **working v1 exists** (`src/components/Studio.tsx`) — functional but engineer-designed. Your job is the aesthetic system: composition, typography, texture, and series identity that makes these feel like a publication, not a screenshot.

Three subjects × two formats:

1. **The Day** (story 1080×1920, post 1080×1350) — daily. Moon phase disc, moon-sign glyph, "Moon in Leo," phase + % lit, planetary day ("Mercury's day"), up to 3 timed moments ("4:40 PM · Moon trine Saturn"), a *favors* line, footer.
2. **The Week** (post, Sundays) — 7 element-colored columns with moon-sign glyphs, void-of-course marks, a 2–3 line "week's tone" sentence.
3. **The Lunation** (story/carousel, each New Moon) — 30 true-geometry phase discs in a grid, element tick per day, NEW/FULL markers, VoC dots. Should become a **multi-slide carousel system** (cover slide + the grid + a "key dates" slide) — design the carousel, we'll build it.

## Non-negotiable constraints

- **Content stance:** cards publish only *primary sky facts* — moon sign, phase, planetary day/hours, timed aspects, sign meanings. Never the app's synthetic "tide energy" index or any score. This is a brand-honesty rule, not a layout preference.
- **Glyphs are real type**, rendered exactly per the celestial-glyphs handoff you produced (Noto Sans Symbols 2 + Symbols-1 Venus, U+FE0E, per-glyph optical thinning, element tinting). Do not introduce drawn glyph art.
- **Four themes** (existing tokens): Tide `#F2EFE9` paper, Almanac `#F3E9D6` warm, Observatory `#0E1420` night (glyphs may glow), Minimal white/mono. Element colors per theme are already fixed (see `lib/celestialGlyphs.ts` `GLYPH_ELEMENT_COLORS`).
- **Renderable as flat SVG** → PNG: no CSS filters beyond blur/glow, no external images; gradients, strokes, opacity, and font glyphs only. Fonts available in export: Noto symbol faces (embedded), **Baar Sophia** (self-hosted display face — the wordmark font; we can embed it), and system serifs (Georgia). If you want another display face for hero numerals/titles, name it and we'll self-host.
- **Wordmark:** AUSPICE (the app just renamed from Tides). Tagline in use: *"move with time."*
- Must hold up at feed thumbnail size (~300px) *and* full-screen story.

## What we're asking you to design

1. **Series identity** — what makes any Auspice card recognizable in 0.5s in a feed (a consistent frame device? header band? the phase disc as recurring anchor?). The current v1 is centered-column and safe; push composition.
2. **Typography system** — hero/secondary/caption scale for each format; how "Moon in Leo" (the headline), times, and the favors line relate. Baar Sophia's role vs the serif body.
3. **Texture/background treatment per theme** — the current cards are flat fills. Consider: paper grain, subtle radial night-sky vignette for Observatory, a horizon line, tide-line motifs — anything SVG-expressible.
4. **The lunation carousel** — cover + grid + key-dates slides as a system.
5. **Edge cases** — a day with zero aspects (quiet card shouldn't feel empty); very long aspect labels; 1-line vs 3-line favors.

## Reference files in the repo

- `src/components/Studio.tsx` — the working v1 (layout numbers show current information hierarchy).
- `src/lib/celestialGlyphs.ts` — the ported glyph system (your handoff, live).
- `src/components/TideCard.tsx` — the older single share card (dark night style) that the Studio replaced; its moon-disc + Georgia look is the aesthetic seed people liked.
- `CONTENT_PLAN.md` — the content curriculum these cards distribute.

## Deliverable format

Same as the glyphs handoff: a `.dc.html` visual reference showing every card × theme at final proportions, plus a README with exact tokens (spacing scale, type sizes, any new colors) and a note on which parts are per-theme vs shared. High fidelity; we port directly.

---

## Addendum (2026-07-15): the Best-Times series — design this FIRST

Owner direction after seeing the v1 mocks: generic day posters are fine but not amazing; **focused utility cards are the priority.** "The week's best times" / "The month's best days" for four everyday activities:

**Every window is anchored to a real timed sky event, electional-style.** The window is the aspect's swell — exact ± 2.5h, clamped to waking hours 7:00–23:00 — and the *why* IS the anchor: "Moon trine Mercury · exact 5:10 PM · Mercury's day". Times are universal instants; the card stamps its timezone in the kicker ("times in ET"). Planetary hours and angle crossings are location-bound and stay OFF shareable cards.

The signal vocabulary (v3, owner 2026-07-17) is wide — majors AND minors, sign-days, VoC, and a week-headline planet aspect:

| Activity | Glyph | Signals |
|---|---|---|
| **Effort & training** (up to 4 rows) | Mars ♂ | Moon–**Mars/Sun**: conj/trine/sextile + **squares & minor-hards as "raw fuel"** (hard aspects are high-charge when the job is exertion) · Moon in Aries/Leo/Sag/Cap as all-day entries |
| **Deep rest** | Moon ☽ | Moon–**Neptune** softs · **VoC stretches as windows** ("slack water", ≤4h) · Moon in Cancer/Pisces/Taurus · waning half |
| **Connection & pleasure** | Venus ♀ | Moon–**Venus/Jupiter** softs + quintiles · Moon in Libra/Leo/Taurus/Pisces · evenings · waxing half · standing Venus–Jupiter aspects lift the day |
| **Deep study** | Mercury ☿ | Moon–**Mercury/Saturn** softs + quintiles · Moon in Gemini/Virgo/Aquarius/Cap |

Row kinds design must handle: **timed window** ("Fri · 3:50–8:50 PM"), **all-day sign entry** ("Sun · all day — Moon in Libra · partnered air", max one per section), and the week-headline line under the title ("the week's sky: Mars sextile Saturn (1.3°)"). Minor aspects appear by name (quintile, semi-sextile…) — they're teaching moments.

Selection is a global greedy by score (a shared window goes to whichever activity values it more, never duplicated) with a height budget that trims the weakest rows to fit. **Sections legitimately vary 1–4 rows — scarcity is the credibility. Design for variable density; never pad.** Render endpoints take `?start=YYYY-MM-DD` so a month of weekly cards can be batched ahead.

**Working reference renders** (the template to elevate): `GET /api/studio/best.png?span=week|month&theme=&format=` — live data, so design can pull a real current week anytime. Layout in `api-server/src/lib/studioCard.ts` (`buildBestTimesCardSvg`).

**Data contract per card:** 4 activities × (week: 3 windows, each `{dow, date, startClock, endClock, why}` · month: 5 day-chips + one lead-day line).

**Design asks specific to this series:**
- The week card is a *reference object* people screenshot and keep — design for glanceability pinned to a lock screen, not just feed scroll.
- Distinguish the four activities instantly (accent + glyph is v1; consider iconographic or spatial identity).
- Month card: the date chips want a calendar-adjacent visual logic (mini month strip? phase-marked chips?).
- Keep the *why* visible — it's the credibility layer and the teaching layer. Never reduce rows to bare times.
- Same constraints as above: SVG-flat, four themes, real-type glyphs, primary facts only.
