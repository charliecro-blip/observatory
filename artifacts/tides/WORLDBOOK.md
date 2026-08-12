# The Navigator's Desk — Compass's imaginal universe

> Ratified in conversation 2026-08-12 (owner): weather becomes the layer-1
> language, the almanac becomes the page form, Almanac/Observatory become the
> committed identity, texture is in. Everything marked PROPOSED below is
> still the thing to argue with, per DESIGN.md house rules.

## 1. The thesis

Compass's world is not "an astrology app with nautical labels." It is **a
navigator's desk**. On the desk: the almanac (tables and best days), the
compass (a bearing on demand), the tide table (one instrument among several),
the ship's log (the record), and the window above it all — the weather.
You steer (Helm) by stars (Guiding Stars) through weather (Today), consulting
the almanac (Calendar), keeping the log (Log).

The nav ratification of 2026-07-02 already built this world; this book names
it and finishes the language. The 2026-08-12 correction that produced it:
the owner found the tide *language* unintuitive as the product's main voice
("Deep Ebb" needs initiation; "clearing by evening" doesn't), while the tide
*function* stays loved. So: weather speaks first, and the tide goes back to
being an instrument — which is where tides live in a real almanac anyway.

## 2. The three registers (extends DESIGN.md §16's treaty)

| Register | Job | Where |
|---|---|---|
| **Weather** | Layer-1 forecast language everyone already reads | headlines, forecast sentences, advisories |
| **Instrument** | Each instrument keeps its own native jargon | tide words in the Tide instrument, nav words on the nav, log words in the Log |
| **Astrology** | The evidence — planets always with their signs | evidence panels, Almanac, expanded density |

The containment rule: **instrument jargon never leaks upward into layer 1.**
"Slack water" belongs inside the tide instrument; it reached a layer-1
evidence line and broke CI on 2026-08-12 (a middot-joined testimony the
linesUp contract forbade — the fix is in `electionEngine.ts`). That failure
is this rule's proof, not just its example.

## 3. The weather vocabulary — dynamics, never valence (PROPOSED)

The fire-bias lesson (DESIGN.md §3) applies to weather words too. Weather
offers two vocabularies: **dynamics** (still, building, full, clearing) and
**valence** (fair, foul, good weather, bad weather). Compass adopts the
dynamics and refuses the valence — "fair" is favorability wearing a raincoat,
and no element or day is inherently "good."

The §5 axes map cleanly, one axis one word-family:

| Engine axis | Weather family | Words (PROPOSED) |
|---|---|---|
| Energy (height) | stillness → fullness | still · stirring · full |
| Trend (direction) | motion | building · holding · clearing |
| Coherence (agreement) | settledness | settled · mixed · unsettled |
| Conditions (standing) | advisories | "Mercury advisory through Sep 14" |
| Personal (yours) | local sky | "…and gusty where you are" |

A day's forecast composes from these: *"Full and building, settled — a
Mercury advisory stands. Gusty where you are."* Each word carries exactly
one axis; none of them says "good."

What happens to existing vocabulary:
- **Elements stay** — they're identity vocabulary (treaty: elements are
  yours). As layer-1 *atmosphere* (tint, mark, texture), rarely as copy.
- **The four tide characters (Deep/Surge/Building/Clear) demote** to the
  Tide instrument. They were the headline; now they're the instrument's
  native dialect. (OPEN: the Today hero currently leads with them — see §6.)
- **Suitability/support language already converted** (2026-08-12 copy pass):
  "Useful, with a catch," "Several things line up," "Your chart agrees."

## 4. The identity: one desk, two lights

**Almanac** (day): the parchment register — warm paper, ink, engraved
hairlines. **Observatory** (night): the same desk after dark — charcoal,
brass, lamplight. Not two themes; one identity at two hours.

Consequences (PROPOSED):
- The palette picker consolidates: **Tide merges into Almanac** (its hues are
  near-duplicates), **Minimal retires** or becomes an accessibility mode.
- **Texture ships**: paper grain on Almanac, plate grain on Observatory,
  at whisper intensity (the 3–8% rule), pilot on the check-in one-pager.
- **Moment-marks are the illustration system** — engraved-register inline
  SVGs on a 24px grid, one accent + surface-occlusion construction (the
  eclipse mark is the prototype). Next: retrograde loop, solstice/equinox,
  full moon, then the seven planets.

## 5. The almanac page form

A real almanac day-page: the date set large · a facts column (sun, moon,
phase) · one forecast sentence · the **Best Days table** · advisories.
Home already is this page in embryo. The Best Days framing matters beyond
aesthetics: the electional engine is a personalized, computed Best Days
table — the most beloved feature of the best-selling almanac in American
history, done with real ephemeris math and the user's own chart. That is
also the natural form for Studio share cards: every share is an almanac page.

## 6. Open decisions (argue here)

1. **The Today hero's voice.** It currently leads with tide characters
   ("Deep Tide, Rising"). Under this book it would lead with the weather
   sentence, tide one tap below. Owner hasn't ratified the hero switch.
2. **The tide chart → tide table.** The continuous chart underwhelmed the
   owner; the instrument-native form is a table (times and swells, like the
   printed artifact). Redesign when Today is next opened up.
3. **Default light: auto day/night?** Almanac by day, Observatory after
   sunset — the app knows sunset to the minute. Charming or annoying; needs
   a real decision (and an override either way).
4. **Advisory copy shape** for retrogrades/eclipses in the conditions strip
   ("advisory" vs "watch" vs plain "standing"), and whether VOC joins the
   advisories or stays a moon-line.
5. **Weather words themselves** (§3 table) — proposals, not scripture; each
   must pass the stranger test before it ships.
