# Tides — Design Exploration Brief (for Claude Design)

A handoff for workshopping the aesthetic layer. Take each numbered block below
into Claude Design as its own prompt (they're written to be pasted directly).
Each asks for **several fully-fleshed named options**, not one answer — the goal
is a menu to choose and mix from.

---

## 0. Context to give Claude Design first (paste at the top of any session)

> Tides is an astrology-as-**timing-utility** app (not identity/horoscope). Its
> hero metaphor is the **tide**: the day has a character (one of four elements),
> a level (how charged, which way it's moving), and a set of sky events. The
> core screens are **Today** (the current tide + "Big Sky" aspects + a tide
> chart), **Calendar** (month/week/day grid + an Almanac reference + long-cycle
> "Currents"), **Helm** (goals→tasks/habits), and **Launch** (electional).
>
> Two principles the design must serve:
> 1. **Nesting of scales** — present the big/slow/simple first (season, moon
>    phase), descend to fast/granular (planetary hour, exact aspects). A
>    beginner reads the top and can act; detail waits below.
> 2. **Instrument-dashboard legibility** — a seasoned navigator should read a
>    symbol/number/color at a glance; a new one clicks to expand, then clicks
>    again to learn. Density with progressive disclosure, not clutter.
>
> Current build: React, themed entirely through **CSS variables** (`:root` and
> `:root[data-theme="dark"]`), element colors centralized in one module. So any
> palette you propose should be expressible as a set of CSS variables + four
> element hexes. Light AND dark are both required.
>
> Current element colors (the thing most in need of a fresh eye):
> fire `#b84020`, earth `#4a7040`, air `#5040a0`, water `#2a5a80`,
> plus a liminal "void of course / slack water" slate-lavender `#6f6a90`.
> Current type is the system default (no chosen typeface). Current icons are
> plain Unicode astrology glyphs (☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ ♈–♓ ☌ □ △ ☍ ⚹).

---

## 1. Element color systems — give me 5 palettes

> Tides has four elemental "characters" — Fire (surge/action), Earth (building/
> tending), Air (clarity/connection), Water (depth/feeling) — plus a fifth
> "liminal" color for void-of-course/slack-water states. These colors tint the
> whole app: day backgrounds, chips, the tide chart gradient, the calendar.
>
> Design **5 distinct, named element palettes**, each defining all six colors
> (fire, earth, air, water, liminal, + a neutral accent) in **both light and
> dark** variants, with hexes. Aim for range:
> - **"Natural Almanac"** — earthy, muted, botanical, aged-paper friendly.
> - **"Cosmic"** — deep, luminous, jewel-toned, made for dark mode.
> - **"Coastal"** — soft, watery, sun-washed, airy.
> - **"High-contrast / accessible"** — colorblind-distinguishable, WCAG-AA on
>   both backgrounds (the four elements must be tellable apart by hue AND value).
> - **"Vintage print"** — limited ink palette, риso/letterpress feel.
>
> For each: show the four element swatches as day-cells and as tide-chart
> gradients, and confirm they stay distinct at chip size (~10px text). Provide
> the CSS-variable block for each.

## 2. Typography — give me 4 pairings

> Tides currently uses the system font. Propose **4 named type systems**, each a
> **display face + body face** pairing, with a clear mood, and rules for where
> each is used (page titles, the tide headline, section labels, body copy,
> numerals/times):
> - **"Editorial Almanac"** — a warm serif display + clean humanist body; feels
>   like a beautifully-set reference book.
> - **"Observatory"** — a precise grotesque/mono for numerals + a neutral sans
>   body; instrument-panel feel.
> - **"Literary/mystical"** — an characterful serif that still reads calm.
> - **"Modern minimal"** — one great variable sans doing everything, Swiss.
>
> Requirements: excellent small-size legibility (much of the UI is 9–12px),
> good tabular numerals (lots of times/percentages/degrees), and web-font names
> that are freely available (Google Fonts / open licenses) so they're
> implementable. Show each on the Today page's tide headline + a rail section +
> body paragraph.

## 3. Whole aesthetic schemes (flippable themes) — give me 4 complete looks

> The big one. Design **4 complete, switchable themes** a user picks in Settings
> — each a full identity (palette + type + texture + component styling + how the
> tide chart renders). They should feel genuinely different, like different apps
> that happen to share the same structure:
> - **"Almanac"** — vintage paper, letterpress, muted inks, serif, engraving-
>   style celestial icons. Cozy, literary, analog.
> - **"Observatory"** — dark, cosmic, luminous accents, mono numerals, thin
>   luminous lines, the tide chart as a glowing curve on near-black. Precise,
>   nocturnal.
> - **"Tide"** — coastal, watercolor washes, airy whitespace, soft edges, the
>   chart as real water. Calm, spacious, present-day default.
> - **"Minimal"** — stark monochrome + one accent, Swiss grid, no texture, the
>   chart as a single hairline. Ruthlessly clean.
>
> For each theme, mock up: (a) the **Today** page, (b) the **left rail** in both
> its expanded and its collapsed "instrument" state (see §6), (c) a **calendar
> month cell**, (d) the **tide chart**. Deliver the CSS-variable set + type +
> any texture assets per theme. Note which should be the default.

## 4. The tide chart hero — give me 4 more renderings

> The tide chart is the brand hero: a curve across the day (12a→12a) with a
> character-colored gradient, high/low-water callouts, a "now" marker, and event
> dots. Existing styles: animated water under a sky, a calm muted line, a bare
> minimal line, a flat character bar-strip. Push further — **4 new artful
> renderings**, e.g.: an engraved/etched almanac line, a luminous cosmic ribbon,
> a layered watercolor tide, a topographic/contour reading. Each should still
> answer at a glance: what's the character, when's high water, where's now.
> Show each in light and dark.

## 5. Celestial iconography — give me 3 glyph sets

> Replace plain Unicode with a **consistent custom icon set** for the 10 planets,
> 12 signs, and 5 aspects (conjunction/sextile/square/trine/opposition).
> Propose **3 styles**: (a) fine engraved/almanac line-art, (b) soft rounded
> modern, (c) minimal geometric. Must be legible at 10–14px, work as a single
> color (tinted by element/planet), and feel like one family. Deliver as an SVG
> sprite or icon-font spec.

## 6. Bigger structures & the instrument dashboard — give me layout options

> The organizing UX idea is a **navigational instrument dashboard**: each piece
> of sky data can collapse to a dense glyph row (symbol + number + colored sign)
> that a fluent user reads instantly, and expand in tiers (glance → expand for
> plain-language detail → learn-more for the meaning). We're building the
> collapse mechanic now; help design what the **collapsed "instrument" state**
> and the **expansion tiers** should look and feel like:
> - The **left rail** as a compact instrument strip (Season, Moon, Day, Hour,
>   aspects) — design the glyph rows and the expand affordance.
> - A possible **top "instrument bar"** alternative to the rail for mobile.
> - The **Today page** hierarchy under the nesting principle — what's always
>   visible vs. one tap away.
> - Explore 2–3 **overall layout skeletons** (rail-left, top-bar, card-stack)
>   and where each wins (desktop vs phone).

---

## 7. Deliverable format (ask for this each time)

For every option: a **name**, a one-line **mood/rationale**, a **mockup on real
Tides screens** (Today page + rail at minimum), and the **implementable spec**
(CSS-variable hex block, font names, and/or SVG). Where relevant, show light and
dark. Favor **many rough options over few polished ones** — this is a menu to
choose from, then refine.

## 8. Constraints to respect
- Themeable via CSS variables; light + dark both required.
- Four elements must stay distinguishable by hue *and* value (colorblind-safe).
- Lots of small text (9–12px) and tabular numerals — legibility is non-negotiable.
- Tone is calm and "reflect, don't predict" — never alarmist. (Void-of-course is
  a restful state, not a warning; cautions are gentle.)
- The tide stays the hero; the moon/sun are supporting, not the logo.
