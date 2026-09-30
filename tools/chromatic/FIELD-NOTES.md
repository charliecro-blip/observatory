# Chromatic Field prototype

Open `field-review/field-review.html` for the 13-row Pure / Material / Editorial comparison. Each treatment is rendered at 1080 × 1350; the review page scales that same canvas down. Standalone SVG and PNG files live beside the review page, with a JSON contribution ledger for every scenario.

## Quantitative contract

The earlier presentation mockups used hand-chosen role percentages. Those are not engine-derived weights and are not reused here.

Area allocation v1 conserves actual placement emphasis. For each planet, calculate its existing solo dominant pigment, measure squared Euclidean OKLab distance to each generated palette color, and normalize affinities `1 / (0.01 + distanceSquared)`. Multiply those affinities by the placement weight (pair) or effective emphasis (natal). Sum the contributions and normalize once across the whole field. Each token records its contributors and mass.

This affinity rule and its 0.01 regularizer are new presentation conventions, not discoveries about astrology or pre-existing engine measurements. They avoid arbitrary percentages per palette role, but still need aesthetic calibration. Similar palette colors divide the available mass; adding a near-duplicate color can change allocation. The ledger makes this testable.

Every macro-territory has the declared area. Tests calculate polygon areas independently. Nested frames consist of disjoint rectangles; orthogonal partitions conserve area by construction; flowing boundaries have zero-mean displacement. Material overlays and typography alter visible pixels, so percentages describe underlying territories rather than final pixel-color counts.

## Controls

| Quantity | Visible effect |
| --- | --- |
| Placement weight / effective emphasis | Conserved mass distributed by the affinity rule |
| Generated palette | Territory fills, without invented accent colors |
| Defining aspect geometry | Nesting, parallel division, perpendicular cuts, flowing boundaries, answering cuts, displaced cuts |
| Dynamism | Orientation of parallel/flowing fields |
| Variation | Curvature amplitude in flowing fields |
| Materiality | Fine deterministic grain above the materiality threshold |
| Opacity × diffusion | Restrained same-palette transparent wash |
| Seed | Grain identity; names do not reseed the composition |

Edge feathering and independent luminosity/depth treatment remain deferred. Existing palette colors already carry tonal depth. This draft deliberately avoids global blur and vignettes, which would conceal the territory structure. Pure and Material share identical geometry; Editorial adds factual type to Material.

## Review findings

Pure is the strongest starting point after inspecting the full contact sheet. Material is subtle enough to preserve the macro-boundaries but too subtle to establish its value at thumbnail size. Editorial remains useful as an export option; its text is subordinate, though font embedding remains unfinished. Instrument Sans and IBM Plex Mono are requested font families; current PNG exports use available system fallbacks. The review page's external font stylesheet does not embed fonts inside standalone SVG images.

The ten pairs differ markedly in color character, and the three natal samples are computed through the existing ephemeris adapter rather than assembled from invented longitudes. The conjunctions still share a conspicuous nested-frame template. Opposition needs a better two-pole partition, and sextile/quincunx need more distinct encounters. The current review therefore does not yet meet the twenty-unlabeled-cards milestone.

Next visual pass: refine those boundary relationships while keeping the tested area contract; then embed the requested typefaces and compare Material at print scale. Do not change the symbolic configs to conceal renderer limitations.

## Validation

92 Chromatic tests pass, including placement-mass conservation and visible polygon-area checks for all six aspects. TypeScript check passes. Existing golden baselines remain unchanged. This is a separate experimental renderer; existing app pages and exports are untouched.
