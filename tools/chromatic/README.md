# Chromatic — an astrological color engine

Translates astrological factors into a coherent visual system: palette,
abstract SVG artwork, normalized visual profile, and a traceable explanation.
The premise is that astrology describes a visual grammar — planets are
chromatic functions, signs are modes of expression, aspects are relationships
between colors — so the output is generative art whose structure can be
explained astrologically, factor by factor.

Standalone like `tools/materia`: outside the pnpm workspace, outside Railway's
watch patterns, zero dependencies of its own. The engine (`engine/`) is pure
TypeScript with no DOM or framework imports, so it can later move into tides
or become its own package unchanged.

## Run the playground

    ./tools/chromatic/serve          # http://127.0.0.1:8317

or the `chromatic` launch config. esbuild's serve mode rebuilds on every
request; refresh the browser to pick up engine edits.

Three pages ship from the same vite root:
- `/` — the dev playground (three views, below)
- `/color.html` — the user-facing results page: birth data → hero artwork,
  signature palette, profile, interpretation, key influences, and PNG export
  in the three social formats (square 1080×1080, portrait 1080×1350, story
  1080×1920) rasterized client-side from the deterministic SVG. Below the
  influences sits **Color Weather**: today's sky (or any picked day) scored
  against the natal field, the top transits pushing the profile, one arriving
  pigment entering the artwork from the frame's edge, shift chips against the
  baseline, and a story-format export. A quiet sky is reported as exactly
  that — the field runs at its natal baseline, nothing invented. Share links
  carry the birth data in the URL hash, so arriving on one computes the chart
  with no form step.
- `/meet.html` — synastry: two birth forms, each person's own field beside
  the shared field their cross-aspects draw (A enters left, B right, the
  meeting rises between them), ranked crossings with the defining one
  highlighted, interpretation naming both people, and card export labeled
  "A × B". Charts that never cross are reported as parallel fields.
- `/admin.html` — the content generator: pick a factor (planet pair + aspect
  + orb), get hook, core thesis, visual instructions, reel script, carousel
  outline, and caption, each assembled from the engine's own config phrases
  and the generated palette, with the share card previewed beside them

Birth forms everywhere take a **birthplace, not coordinates**: place search
runs against Open-Meteo's public geocoding API (no key; only the typed place
name leaves the browser), and the UTC offset resolves automatically from the
result's IANA timezone at the birth moment via Intl — DST, fractional zones,
and historical rules included (a 1969 Kathmandu birth correctly gets +5:30,
not today's +5:45). Manual coordinates stay available under a collapsed
fallback per form for offline use or places the search can't find.

Playground views (Pair · Planet · Gallery · Chart):
- **Planet** — a single placement drawn alone: the planet's own two pigments
  carry the image, and the sign's modality organizes the frame (cardinal
  blocks, fixed consolidates, mutable disperses). The unit under everything
  else, viewable on its own.
- **Chart inspector** — in the Chart view, every emphasis row and aspect row
  is clickable: any placement or any aspect from the chart renders alone in
  an inspector panel, with its own palette and interpretation. The chart also
  shows its weighted element balance.

More playground views:
- **Pair editor** — pick two placements, an aspect, an orb, and weights;
  profile, palette, composition, and interpretation update live.
- **Gallery** — the design doc's ten comparison pairs (Venus conjunct Jupiter
  through Jupiter square Pluto) with a blind mode for the "do these feel
  different without labels?" test.
- **Chart** — birth data (or a sample) → live natal chart → whole-chart
  chromatic model, with the emphasis table (weight, effective weight, why)
  and ranked aspects shown under the artwork. Calculation runs in the
  browser against the api-server's natal engine; `vite.config.ts` supplies
  the two aliases that make that resolve (`.js` → `.ts` specifiers, and
  `astronomy-engine` out of the root pnpm store).

## Golden gallery

The canonical ten are pinned as full baselines — profile, palette,
composition, SVG — in `golden/baselines.json`. `test/golden.test.ts` fails
on any drift, and `/golden.html` shows approved baseline beside current
render with the concrete diffs named. Accepting a visual change is a
deliberate act:

    ./tools/chromatic/golden/update    # then review /golden.html + git diff, commit

This is aesthetic calibration infrastructure, not a deploy gate (the whole
tools suite is opt-in). The renderer emits bounded-precision numbers so SVG
comparisons hold across JS engines — tanh and cos differ by an ulp between
node and the browser.

## Tests

    npx vitest run --config vitest.tools.config.ts tools/chromatic

Behind the opt-in tools config, so it never gates a deploy. Covers
determinism, gamut/range invariants, aspect hue relationships (opposition
complementary, square ~90°, trine analogous), and profile differences between
hard and soft aspects.

## Architecture

    engine/
      types.ts          VisualProfile (12 axes), PaletteColor, CompositionModel,
                        ChromaticExplanation, PairScenario
      color.ts          OKLCH → sRGB by hand, gamut clamping, hue arithmetic
      seed.ts           string hash + mulberry32; determinism + variationSeed
      config/           THE EDITABLE CORRESPONDENCE SYSTEM — argue with these
        planets.ts      profile deltas + hue candidates + effect phrases
        elements.ts     optical/material behavior + hue pull
        modalities.ts   compositional behavior
        signs.ts        sign = element + modality + small modifier (computed)
        aspects.ts      hue strategy, target separation, geometry, orbs
        weights.ts      chart-emphasis defaults (experimental, not doctrine)
      combine.ts        weighted influences → tanh-squashed VisualProfile
      palette.ts        pigment resolution, aspect hue strategies, role assembly
      composition.ts    profile + aspect geometry → CompositionModel
      render.ts         deterministic SVG: one renderer per geometry + overlays
      explain.ts        structured explanation + prose (pair and whole-chart)
      social.ts         share cards: glyphs, three export formats, card copy
      content.ts        content bundles: hook/thesis/reel/carousel/caption
      weather.ts        Color Weather: transit aspects (tight orbs), ranked by
                        strength × transiting-planet weight × natal emphasis;
                        natal influences + active transits → modified profile,
                        plus the arriving weather pigment
      synastry.ts       cross-aspects between two charts, ranked by strength ×
                        mean emphasis; both charts at half mass + the meetings
                        → the shared field, led by the top crossing
      pair.ts           PairScenario → ChromaticModel (seed = identity only:
                        planets/signs/aspect/variation — orb and weights
                        modulate continuously, never re-roll the layout)
      placement.ts      a single placement drawn alone; modality → geometry
      canon.ts          the canonical ten, defined once for every consumer
      chart.ts          NatalInput → ChromaticChart: aspect finding, emphasis
                        weighting (continuous angularity via degree distance
                        to ASC/MC/DSC/IC, chart ruler by rulershipMode
                        modern/traditional/none, luminaries, strength-weighted
                        aspect connectivity), defining-relationship selection
    playground/         vanilla-TS dev UI (no framework) + natal adapter
    test/               engine + chart smoke tests

The whole-chart reduction: the strongest aspect (strength × mean effective
weight) becomes the defining chromatic relationship — its two planets supply
the lead pigments and the geometry — while every placement plus the top five
aspects feed the profile. Placement influence mass is normalized to
`chartProfileMass` so ten planets don't rail every axis through the tanh
squash; emphasis decides who gets the mass, not how much mass there is.

Design commitments carried from the handoff: no single-color essentialism
(everything modifies a field), aspects are relational (opposition = mutual
intensification, square = productive friction), every visual decision is
traceable to a rule, and the correspondence configs are meant to evolve.

## Chart calculation

`playground/natal-adapter.ts` wraps the api-server's `computeNatalChart`
(Sun–Pluto, ASC, MC, five house systems; regiomontanus by default here) and
carries materia's UTC-instant workaround — `computeNatalChart` floors
utcOffset to whole hours, so the adapter builds the UTC moment itself and
passes zero. Fractional zones (Mumbai +5.5) are covered by Sample C.

## Next

Remaining from the handoff: an optional LLM copy layer (polish the template
language; never invent symbolism) and the Phase 4 research layer (A/B "which
feels more like Venus square Uranus?"). Swap the geocoder for the api-server's
/api/location-search (Geoapify) if this integrates into Compass. All
generated copy gets a voice pass before anything publishes.
