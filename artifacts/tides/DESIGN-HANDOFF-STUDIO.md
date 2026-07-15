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
