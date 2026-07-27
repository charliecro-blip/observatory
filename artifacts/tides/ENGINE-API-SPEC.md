# Compass Engine — Public API Spec (v0 draft, 2026-07-27)

> Compass-as-engine for the ecosystem (see Notion → Ecosystem Build Plan →
> "Corrected capability map"). These endpoints expose the judgment stack —
> ephemeris + dignity + synthesis + elections — to AstroLyrica, Starweather,
> and the Hub, over plain HTTP. Everything here exists as internal code today;
> this spec is the public wrapper, not new logic.

## Principles

- **Judged data over raw data.** Consumers get readings and ranked windows,
  not just longitudes — that's the ecosystem's edge. Raw positions are still
  available for consumers that want to do their own thing.
- **Additive only.** New `/engine/*` namespace; nothing in the app's existing
  `/api/*` surface changes.
- **Stateless + chart-optional.** Every endpoint works without a birth
  profile; passing one unlocks the personal layer. No accounts required —
  auth is a static bearer token per consumer app (upgrade path: the Hub's
  entitlements service issues tokens).
- **One canonical birth profile** (ecosystem schema + Compass's amendment):

```json
{
  "name": "optional",
  "birthDate": "1990-02-03",
  "birthTime": "14:30",
  "timeKnown": true,
  "lat": 30.2672, "lon": -97.7431,
  "utcOffset": -6
}
```
`timeKnown: false` ⇒ no Ascendant, houses, angles, or angle transits — the
engine degrades honestly rather than fabricating a rising sign.

## Endpoints

### `GET /engine/positions?at=ISO`
Raw layer. Every body (Sun→Pluto, Chiron, nodes, asteroid goddesses):
longitude, sign, degree, retrograde. The escape hatch for consumers that
want to compute their own things.

### `GET /engine/moon-condition?at=ISO`
`{ sign, phaseName, illumination, voidOfCourse, nextIngressAt,
finalAspectInSign: { planet, aspect, atISO } }` — the daily-tier election
primitives (Hampar's two data points) in one call.

### `GET /engine/planetary-hour?at=ISO&lat&lon`
`{ ruler, began, ends, isDayHour, hourNumber, upcoming: [...next 4] }`.

### `GET /engine/angularity?at=ISO&lat&lon`
Local angles (ASC/MC/DSC/IC longitudes) + planets currently angular +
next crossings (planet, angle, time, duration).

### `POST /engine/transits`
Body: birth profile. Returns transits-to-natal with the engine's weighting
(pair polarity, orb ladder, personal-point boost, severity) — not bare hits.

### `POST /engine/reading?scope=moment|day&at=ISO&lat&lon`
Body: optional birth profile. Returns the full `DayReading`:
`{ flavour, element, foci, watch[], counterpoint, patterns[], testimonies[] }`.
**This is the endpoint Starweather and AstroLyrica should consume** — the
woven judgment, with the testimony table available for drill-down or poetic
re-rendering. `scope=day` for anything published once per day.

### `POST /engine/find-time`
Body: `{ activityKey, span: "day"|"week"|"month", lat, lon, tzOffsetMin,
birthProfile? }`. Returns `computeElections` output: ranked windows with
tier (good/great), why-strings, and cautions (eclipse window, retrograde
significators, Moon's final aspect). First consumer: the Hub's Electional /
Due Diligence reading booking — "interpret these pre-ranked windows" is the
session product. The activity vocabulary is `activityCorrespondences.ts`
(~40 keys); the Hub maps its reading types onto them.

### `GET /engine/activities`
The activity vocabulary (key, label, gloss, category) so consumers don't
hardcode it.

## Non-goals (v0)
- Synastry/composite — Constellation's turf; the Hub calls it directly.
- Webhooks/streaming — consumers poll; everything is cheap to recompute.
- Rate limiting beyond a per-token daily cap.

## Implementation notes
- One new route file (`routes/engine.ts`), thin wrappers over existing libs
  (`astro.ts`, `synthesis.ts`, `electionEngine.ts`, `natal.ts`). ~a day.
- Version with a response header (`X-Engine-Version`) not URL paths, until
  there's a reason.
- The Symbolic Data Package export (guidance layer → YAML/JSON) is a separate
  task; `/engine/reading` already embeds the guidance strings, so consumers
  can ship before that lands.
