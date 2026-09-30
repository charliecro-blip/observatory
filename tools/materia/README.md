# Materia — natal medical astrology reports

A standalone report generator built on the medical astrology knowledge base in
`knowledge/medical-astrology-v1/` and the app's own ephemeris and dignity
engine. It has no database, no auth, no server, and no dependency on Compass.

```bash
./tools/materia/materia birth.json > report.md
./tools/materia/materia birth.json --house-system=regiomontanus --out=chart.md
```

`birth.json`:

```json
{
  "name": "A. Person",
  "date": "1988-03-14",
  "time": "07:42",
  "lat": 37.7749,
  "lon": -122.4194,
  "utcOffset": -8,
  "place": "San Francisco, CA",
  "timeAccuracy": "exact"
}
```

Date and time are local to the birthplace; `utcOffset` is the offset in effect
at that moment (so −8 for PST, −7 for PDT, 5.5 for India). Latitude is north
positive, longitude east positive. `timeAccuracy` is `exact`, `approximate`, or
`unknown`, and anything but `exact` puts a note at the top of the report saying
which findings move with the birth time.

Lives in `tools/` deliberately: that directory is outside the pnpm workspace and
outside Railway's `watchPatterns`, so nothing here can hold up a Compass deploy
or fail its build.

## What it computes

Everything in the report is derived. There is no generated prose and no model
call — the report is the calculation, written out.

| Layer | File | What it does |
|---|---|---|
| Qualities | `qualities.ts` | The Hot/Wet/Cold/Dry lattice, melothesia, medical houses, cultivation registers — all transcribed from Appendix C rather than from general doctrine |
| Chart | `chart.ts` | Chart geometry, sect, dignities, natal aspects, almuten, Lord of the Geniture, planetary day and hour |
| Temperament | `temperament.ts` | The eleven-factor composite of Part V, with clarity gating |
| Significators | `significators.ts` | Medical houses through their lords, melothesic emphasis, demanding/supportive testimony, and the chart's internal contradictions |
| Reference | `kb.ts` | Pulls the knowledge-base sections this chart's own placements call for |
| Report | `report.ts` | Assembly and Markdown |

Three things the deleted `blueprint.ts` route got wrong, fixed here:

- **Sect** came from the Sun's house number (`houseNumber >= 7`). Under
  whole-sign houses a Sun risen a few degrees above the Ascendant sits in the
  12th and would read as a night chart. Sect selects the triplicity ruler, so
  that error silently re-scores every essential dignity in the chart. Sect is
  now computed from the Sun's true altitude.
- **Dignity** was never computed at all, in either register, despite
  `lib/dignity.ts` shipping a full Lilly implementation. Traditional medical
  astrology runs on the condition of the significators; without it the report
  can name placements but cannot weigh them.
- **Temperament** was a prompt instruction ("constitutional type from
  Ascendant, chart ruler, and sect") handed to gpt-4o, which is the one thing
  the composite method exists to prevent — its premise is that no single factor
  decides a temperament. It is now the eleven-factor calculation, printed factor
  by factor so any line can be disputed.

The prompt also asked the model for `contradictionsMixedTestimony` across nine
lines of instruction while sending it no aspects and no dignities, so it had no
data with which to find a contradiction. Those are now derived: shared
rulerships across the full-weight houses, benefics lording difficult ground,
dignified malefics, essential debility, prominence without dignity, a poorly
supported Ascendant lord, and disagreement between the three claimants on the
chart.

## Four things needing a ruling

Each is surfaced in the report's own Method section rather than being decided
silently.

**1. Factor 4 has no usable specification.** Part V names it "Ascendant ruler —
modality/phase" and glosses it "(cardinal/fixed/mutable, or
angular/succedent/cadent)". Neither gloss maps onto Hot/Wet/Cold/Dry in any
traditional source; modality and house strength are not qualitative doctrines.
Implemented as the classical oriental/occidental distinction (Ptolemy III.11),
which is qualitative and computable. Weight 1 of ~28, so the reading barely
moves either way. → Appendix D, Q30.

**2. Factor 7's specification contradicts itself.** Part V gives "Waxing Moon →
Hot+Wet; waning → Cold+Dry; New → Hot+Wet; Full → Hot+Wet", which puts three of
the four quarters on the same qualities. Implemented as the Ptolemaic
quartering (Tetrabiblos I.8) — each quarter takes the qualities of the matching
season — which is what Greenbaum uses, and Part V says it derives its defaults
from Greenbaum. → Appendix D, Q36.

**3. The 30% axis gate is inert.** Measured over 2,280 charts across 1950–2005
and five latitudes, the two gates together name a temperament in **16.3%** of
charts. They are not independent: every factor adds its weight to one quality
per axis, so both axes always sum to the same total, and the combination gate
then works out strictly tighter. It requires the dominant quality to lead by
0.250 of the total weight; the 30% axis check requires only 0.176. Across a
further 2,240 charts the axis check rejected nothing the combination check had
passed. The axis threshold would have to exceed **40%** before it bound on
anything. Either raise it or record that the 20% combination gap is the whole
gate. → Appendix D, Q29.

**4. Whole-sign is the default here, per Appendix D Q22 ("confirmed
Whole-Sign").** Note that `computeNatalChart` in the app defaults to
Regiomontanus, so the app and the reference currently disagree. `--house-system`
switches between whole-sign, equal, porphyry, placidus, and regiomontanus.

## What it refuses

- **No prescriptions.** Cultivation names registers — warm-moist, cool-dry —
  and never a food, herb, dose, or treatment. That is the reference's line and
  the generator keeps it.
- **No named temperament past the clarity gate.** A chart that does not resolve
  gets its quality totals and no label.
- **No planetary hour above the polar circles.** The app's sunrise routine
  reports `polar` instead of inventing a twelve-hour day; where it does, the
  hour is withheld and the report says why. Sect still resolves, because it
  reads the Sun's altitude rather than a sunrise.
- **No disclaimer paragraph.** The old route ended every blueprint with a
  `safetyNote` field. A disclaimer means the design is wrong: the conditional
  language belongs in every line, not in a footer that excuses the rest.
- **No modern outers in the temperament composite.** The reference calls them an
  interpretive overlay carrying no dignity and Appendix D Q2 leaves their
  prominence open. They appear in the melothesic and significator layers, where
  the reference does cite them.

## Verifying a change

`tools/` is not in `vitest.config.ts` (which includes only `tests/**`), so a
test file here would never run. Measure instead — bundle and print real values:

```bash
EB=$(ls -d node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild | sort -V | tail -1)
$EB tools/materia/report.ts --bundle --platform=node --format=esm --outfile=/tmp/m.mjs && node /tmp/m.mjs birth.json
```

Charts worth keeping in a check set: a polar birth (Tromsø, winter solstice —
exercises the withheld hour), a southern-hemisphere birth (season inversion), a
half-hour timezone (India — `computeNatalChart` floors the offset to whole
hours, which is why this tool builds the UTC instant itself and passes zero),
and one chart that clears the clarity gate against one that does not.
