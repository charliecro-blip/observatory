# Observatory — Technical Handoff

> Last updated: May 2026. Reflects the deployed MVP codebase.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Database Schema](#database-schema)
4. [API Routes](#api-routes)
5. [Tester Isolation Pattern](#tester-isolation-pattern)
6. [Natal Chart Calculation Flow](#natal-chart-calculation-flow)
7. [Environment Variables](#environment-variables)
8. [Deployment](#deployment)
9. [Development Commands](#development-commands)
10. [Known Limitations & Tech Debt](#known-limitations--tech-debt)

---

## Architecture Overview

Observatory is a **pnpm monorepo** with two deployed services and a shared library layer:

```
Browser → Replit Reverse Proxy (path-based routing)
          ├── /          → artifacts/health-tracker  (React + Vite, port 24166)
          └── /api       → artifacts/api-server       (Express 5, port 8080)
```

The proxy routes by path prefix, longest-match first. Both services are registered in their respective `artifact.toml` files. There is no separate auth gateway — all user identity is handled via the `x-tester-id` header (see Tester Isolation below).

**External dependencies:**
- **PostgreSQL** — Replit-managed database, accessed via `DATABASE_URL`
- **OpenAI API** — accessed via Replit AI Integrations proxy (`@workspace/integrations-openai-ai-server`), no key required in env
- **Geoapify** — geocoding API for birthplace search, requires `GEOAPIFY_API_KEY`

---

## Monorepo Structure

```
observatory/
├── artifacts/
│   ├── api-server/               # Express 5 API server
│   │   ├── src/
│   │   │   ├── app.ts            # Express app setup, CORS, JSON middleware
│   │   │   ├── index.ts          # Server entry — reads PORT, starts listening
│   │   │   ├── lib/
│   │   │   │   ├── astro.ts      # Ephemeris calculations (heliocentric orbital mechanics)
│   │   │   │   ├── natal.ts      # Natal chart: ASC, MC, houses, transits, health insights
│   │   │   │   └── logger.ts     # Pino logger singleton
│   │   │   ├── middlewares/
│   │   │   │   └── testerId.ts   # requireTesterId middleware
│   │   │   └── routes/           # One file per domain (see API Routes below)
│   │   └── build.mjs             # esbuild CJS bundle script
│   └── health-tracker/           # React + Vite SPA
│       └── src/
│           ├── App.tsx            # SolidRouter routes
│           ├── pages/            # One file per page
│           ├── components/       # Layout, UI components
│           ├── contexts/         # TesterContext
│           └── hooks/            # use-toast, etc.
├── lib/
│   ├── db/                       # @workspace/db — Drizzle ORM + schema
│   │   └── src/schema/           # One file per table
│   ├── api-spec/                 # @workspace/api-spec — OpenAPI YAML + Orval config
│   ├── api-client-react/         # @workspace/api-client-react — generated React Query hooks
│   ├── api-zod/                  # @workspace/api-zod — generated Zod schemas
│   └── integrations-openai-ai-server/  # OpenAI client (Replit-managed)
├── pnpm-workspace.yaml           # Package catalog + workspace discovery
└── tsconfig.base.json            # Shared strict TypeScript defaults
```

### Key conventions

- **Leaf packages** (`artifacts/*`) are typechecked with `tsc --noEmit`. They do not emit declarations.
- **Lib packages** (`lib/*`) are composite and emit declarations via `tsc --build`.
- API hooks and Zod schemas are **generated** — never edit `lib/api-client-react/src/generated/` or `lib/api-zod/src/index.ts` by hand.
- Logging: use `req.log` in route handlers, `logger` singleton elsewhere. Never `console.log` in server code.

---

## Database Schema

All tables use `tester_id text` for multi-tester isolation. The default tester ID is `obs_default_charlie` (the dev/Charlie profile).

### `conversations`
Chat conversation containers for the Oracle module.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| title | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `messages`
Individual messages within a conversation.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| conversation_id | integer | FK → conversations.id |
| role | text | `"user"` or `"assistant"` |
| content | text | |
| created_at | timestamptz | |

### `supplements`
User-tracked supplements.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| name | text | |
| dosage | text | |
| unit | text | |
| frequency | text | |
| notes | text | |
| active | boolean | default true |
| created_at | timestamptz | |

### `activities`
User-defined activity types (e.g. "yoga", "walking").

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| name | text | |
| category | text | |
| notes | text | |
| active | boolean | default true |
| created_at | timestamptz | |

### `health_logs`
Free-form event log entries (supplement doses, activity sessions, symptoms).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| logged_at | timestamptz | |
| type | text | e.g. `"supplement"`, `"activity"`, `"symptom"` |
| supplement_id | integer | nullable FK |
| activity_id | integer | nullable FK |
| supplement_name | text | denormalized for display |
| activity_name | text | denormalized |
| dosage_taken | text | |
| duration_minutes | integer | |
| intensity | integer | 1–10 |
| mood | integer | 1–10 |
| energy_level | integer | 1–10 |
| symptoms | text | comma-separated |
| notes | text | |
| astro_snapshot | text | JSON string of sky snapshot at log time |
| transcribed_from | text | voice transcript source |
| created_at | timestamptz | |

### `natal_charts`
Birth data for natal chart calculation. One row per tester.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| birth_date | text | YYYY-MM-DD |
| birth_time | text | HH:MM (local) |
| birth_place | text | display string |
| birth_lat | real | decimal degrees |
| birth_lon | real | decimal degrees |
| utc_offset | real | hours (standard time) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `natal_blueprints`
Cached AI-generated natal health blueprint. Regenerated on demand or when birth data changes.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| natal_chart_id | integer | FK → natal_charts.id |
| blueprint_json | jsonb | Full structured blueprint |
| generated_text | text | unused / reserved |
| prompt_version | text | `"v1"` — bump to force regeneration |
| chart_updated_at | timestamptz | stamp from natal_chart.updated_at at generation time |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `daily_check_ins`
Structured daily body check-in. Unique per `(tester_id, date)`.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| date | text | YYYY-MM-DD |
| energy | integer | 1–10 |
| mood | integer | 1–10 |
| stress | integer | 1–10 |
| focus | integer | 1–10 |
| digestion | integer | 1–10 |
| sleep_quality | integer | 1–10 |
| pain | integer | 1–10 |
| regulation | integer | 1–10 (nervous system) |
| symptom_tags | json | string[] |
| behavior_tags | json | string[] |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique index: `uq_daily_check_ins_tester_date` on `(tester_id, date)`. Upserts on conflict.

### `daily_insights`
AI-generated Body Weather reading. Unique per `(tester_id, date)`.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| date | text | YYYY-MM-DD |
| check_in_id | integer | FK to check-in that triggered generation |
| check_in_updated_at | text | used to detect staleness |
| capacity_level | text | `"Low"`, `"Medium"`, or `"High"` |
| capacity_score | integer | 1–10 |
| body_weather_summary | text | 2–3 sentence summary |
| best_use_tags | json | string[] |
| watch_for_tags | json | string[] |
| support_tags | json | string[] |
| explanation | text | 2–4 sentence detailed explanation |
| generated_context | json | reserved |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique index: `uq_daily_insights_tester_date` on `(tester_id, date)`.

### `cultivations`
User-defined long-form practices/goals (the "Cultivator" module).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| title | text | |
| domain | text | one of 14 health domains |
| description | text | optional |
| related_planet | text | optional |
| related_house | integer | optional |
| related_body_weather_tags | jsonb | string[] |
| target_practice | text | short description of the practice |
| frequency | text | `"daily"`, `"weekly"`, etc. |
| status | text | `"active"`, `"paused"`, `"completed"` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Valid domains: `sleep`, `energy`, `digestion`, `nervous-system`, `mood`, `movement`, `pain-tension`, `creative-practice`, `boundaries`, `food-rhythm`, `social-rhythm`, `spiritual-practice`, `study-learning`, `recovery`.

### `cultivation_check_ins`
Daily completion record for each cultivation. Upserted per `(tester_id, cultivation_id, date)`.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | |
| cultivation_id | integer | FK → cultivations.id |
| date | text | YYYY-MM-DD |
| completed | boolean | default false |
| effort_level | integer | 1–5 (gentle → full presence) |
| note | text | optional observation |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `support_preferences`
Per-tester support category preferences. One row per tester (unique on `tester_id`).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tester_id | text | UNIQUE |
| categories | jsonb | string[] of enabled category slugs |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Valid category slugs: `food-rhythm`, `rest-sleep`, `movement`, `somatic`, `meditation`, `breathwork`, `guided-visualization`, `journaling`, `acupressure`, `aromatherapy`, `herbal-research`, `creative-practice`, `social-boundary`.

---

## API Routes

All routes are mounted at `/api`. All routes except `/api/healthz`, `/api/insights/astro`, `/api/astro/*`, and `/api/location-search` require the `x-tester-id` header (or `?testerId=` query param for streaming voice endpoints).

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Returns `{ status: "ok" }` |

### Check-ins

| Method | Path | Description |
|---|---|---|
| GET | `/api/check-ins/today` | Today's check-in or 404 |
| POST | `/api/check-ins` | Upsert check-in (idempotent per date) |

### Body Weather

| Method | Path | Description |
|---|---|---|
| GET | `/api/body-weather/today` | Returns cached or generates today's Body Weather reading |
| POST | `/api/body-weather/regenerate` | Force-regenerates today's reading |

### Insights

| Method | Path | Description |
|---|---|---|
| GET | `/api/insights/summary` | Dashboard stats: log counts, averages, top symptoms, moon phase |
| GET | `/api/insights/patterns` | Correlation patterns from recent logs |
| GET | `/api/insights/astro` | Current sky snapshot (no auth required) |

### Health Logs

| Method | Path | Description |
|---|---|---|
| GET | `/api/logs` | List logs (paginated via `?limit=&offset=`) |
| POST | `/api/logs` | Create log entry (auto-snapshots current sky) |
| GET | `/api/logs/:id` | Get single log |
| PATCH | `/api/logs/:id` | Update log |
| DELETE | `/api/logs/:id` | Delete log |

### Supplements

| Method | Path | Description |
|---|---|---|
| GET | `/api/supplements` | List all supplements |
| POST | `/api/supplements` | Create supplement |
| PATCH | `/api/supplements/:id` | Update supplement |
| DELETE | `/api/supplements/:id` | Delete supplement |

### Activities

| Method | Path | Description |
|---|---|---|
| GET | `/api/activities` | List all activities |
| POST | `/api/activities` | Create activity |
| PATCH | `/api/activities/:id` | Update activity |
| DELETE | `/api/activities/:id` | Delete activity |

### Natal Chart

| Method | Path | Description |
|---|---|---|
| GET | `/api/natal-chart` | Get stored chart + computed positions |
| POST | `/api/natal-chart` | Upsert birth data |
| GET | `/api/natal-chart/health-insights` | Computed health insights from chart |
| GET | `/api/natal-chart/transits` | Current transit aspects sorted by score |
| GET | `/api/natal-chart/debug` | Full debug dump of computed chart |

### Natal Blueprint (AI)

| Method | Path | Description |
|---|---|---|
| GET | `/api/natal-chart/blueprint` | Retrieve cached blueprint |
| POST | `/api/natal-chart/blueprint/generate` | Generate (or return cached). Pass `{ force: true }` to regenerate |

### Oracle (AI Chat)

| Method | Path | Description |
|---|---|---|
| GET | `/api/openai/conversations` | List conversations |
| POST | `/api/openai/conversations` | Create conversation |
| GET | `/api/openai/conversations/:id` | Get conversation with messages |
| POST | `/api/openai/conversations/:id/messages` | Send message — **SSE streaming** response |
| POST | `/api/openai/conversations/:id/voice-messages` | Send voice audio — **SSE streaming** response, multipart/form-data |

### Cultivations

| Method | Path | Description |
|---|---|---|
| GET | `/api/cultivations` | List cultivations with today's check-in embedded. Filter: `?status=active` |
| POST | `/api/cultivations` | Create cultivation |
| PATCH | `/api/cultivations/:id` | Update any field including status |
| DELETE | `/api/cultivations/:id` | Delete cultivation and all its check-ins |
| GET | `/api/cultivations/:id/check-ins/today` | Today's check-in for one cultivation |
| POST | `/api/cultivations/:id/check-ins` | Upsert today's check-in |

### Support Preferences

| Method | Path | Description |
|---|---|---|
| GET | `/api/support-preferences` | Get enabled categories for tester |
| PUT | `/api/support-preferences` | Replace categories list (server-side validates slugs) |

### Location Search

| Method | Path | Description |
|---|---|---|
| GET | `/api/location-search?q=TEXT` | Geoapify city autocomplete. No auth required. Min 3 chars. Cached 5 min in-memory |

### Astro Debug

| Method | Path | Description |
|---|---|---|
| GET | `/api/astro/debug` | Raw planetary longitudes for today or `?date=YYYY-MM-DD` |
| GET | `/api/astro/snapshot` | Full sky snapshot used by Body Weather + Oracle |

---

## Tester Isolation Pattern

Observatory uses a lightweight multi-tester system for MVP data separation. There is no authentication layer.

- Every API request that touches personal data requires the `x-tester-id` HTTP header.
- The frontend sends this header automatically via `custom-fetch.ts` in `lib/api-client-react`, which reads the tester ID from `localStorage` (managed by `TesterContext`).
- The `requireTesterId` middleware extracts the header (or `?testerId=` query param for voice streaming), puts it in `res.locals.testerId`, and returns 400 if missing.
- All DB queries filter by `testerId`. There is no row-level security enforcing this — it is an application-level convention.
- The default dev profile ID is `obs_default_charlie`.

**This is not a security system.** Any client that knows another tester's ID can read their data. It is purely for MVP participant separation.

---

## Natal Chart Calculation Flow

All calculations are pure TypeScript with no external ephemeris library.

### `lib/astro.ts` — current sky

1. Compute Julian Day for the given date.
2. For each planet (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto):
   - Use `heliocentricEcliptic(T, orbitalElements)` — computes mean longitude, applies equation of center (3-term series), derives true heliocentric ecliptic longitude and radius vector.
   - Use `geoFromHelio(λP, rP, λEarth, rEarth)` — vector subtraction to convert heliocentric → geocentric ecliptic longitude.
   - Sun and Moon use direct formula (Sun = Earth's heliocentric opposite; Moon uses separate series).
3. Convert ecliptic longitude to zodiac sign and degree.
4. Compute moon phase from Sun–Moon elongation.
5. Identify "active transits" using hardcoded planet–sign associations for display.

### `lib/natal.ts` — natal chart and transits

**Natal chart computation** (given birth date, time, lat, lon, UTC offset):
1. Compute Julian Day for birth moment in UTC.
2. Compute Greenwich Mean Sidereal Time (Meeus Ch. 12 formula).
3. Add birth longitude → Right Ascension of Midheaven (RAMC).
4. Compute obliquity of ecliptic (cubic polynomial in T).
5. Compute Midheaven (MC): `atan2(tan(RAMC), cos(ε))`.
6. Compute Ascendant: `atan2(-cos(RAMC), sin(ε)·tan(φ) + cos(ε)·sin(RAMC)) + 180°`.
7. Compute 12 **Regiomontanus house cusps** by projecting 30° equatorial arcs through the horizon north/south points onto the ecliptic.
8. Place all planets into houses by comparing ecliptic longitude to house cusp sequence.
9. Return: `{ ascendant, midheaven, planets[], houses[] }`.

**Transit aspects** (computed in real-time at each body weather generation):
1. Get current planet positions from `astro.ts`.
2. For each transit planet × natal planet pair:
   - Compute angular separation.
   - Check whether it falls within orb of a major aspect (conjunction 0°, opposition 180°, trine 120°, square 90°, sextile 60°). Orbs: 5–8° depending on luminaries.
   - Score by aspect type, planet pair, and closeness to exact.
   - Assign `likelyDomains` from a lookup table mapping planet pairs to body systems.
3. Return aspects sorted by score descending.

**Natal health insights**:
- Maps ASC sign, 6th house sign, and planet placements to body system tendencies using hardcoded sign–body associations.
- Produces a `summary` string and structured `sixthHouse`, `ascendant`, `chartRuler` objects.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Provided automatically by Replit. |
| `PORT` | Yes | Port for each service. Injected by Replit workflow config (8080 for API, 24166 for web). |
| `SESSION_SECRET` | Yes | Session signing secret. Set via Replit Secrets. Currently unused by active code but reserved. |
| `GEOAPIFY_API_KEY` | Optional | API key for birthplace city autocomplete. Without it, the location search endpoint returns 503 and users must enter lat/lon manually. Set via Replit Secrets. |
| `NODE_ENV` | Yes | `"development"` in dev workflow, `"production"` in deployment. |
| `BASE_PATH` | Yes | Base URL path prefix. `"/"` for both services. Injected by Replit workflow. |

The OpenAI API key is not an env var — it is managed entirely by the Replit AI Integrations proxy (`@workspace/integrations-openai-ai-server`).

---

## Deployment

Observatory deploys to Replit's hosted infrastructure via the publish flow.

### Services in production

**API server** (`artifacts/api-server`):
- Build: `pnpm --filter @workspace/api-server run build` → esbuild CJS bundle at `dist/index.mjs`
- Run: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- Health check: `GET /api/healthz` (must return 2xx for startup to succeed)
- Env: `PORT=8080`, `NODE_ENV=production`

**Web frontend** (`artifacts/health-tracker`):
- Build: `pnpm --filter @workspace/health-tracker run build` → static files at `dist/public/`
- Serve: static file server with `/* → /index.html` rewrite (SPA fallback)
- Env: `PORT=24166`, `BASE_PATH=/`

### Database migrations in production

Drizzle is used in **push mode** for development. There are no migration files.

To apply schema changes to the production database:
1. In development, update `lib/db/src/schema/*.ts`.
2. Run `pnpm --filter @workspace/db run push` in development to verify.
3. Use the Replit database skill to run the equivalent `ALTER TABLE` / `CREATE TABLE` DDL directly against the production database. See `lib/db/src/schema/*.ts` for the column types.

Do not run `drizzle-kit push` against production — there is no push script pointing at the production database URL.

---

## Development Commands

```bash
# Start API server (dev)
pnpm --filter @workspace/api-server run dev

# Full typecheck
pnpm run typecheck

# Typecheck libs only (faster)
pnpm run typecheck:libs

# Typecheck a single artifact
pnpm --filter @workspace/health-tracker run typecheck

# Push DB schema changes (dev only)
pnpm --filter @workspace/db run push

# Regenerate API hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Build API server
pnpm --filter @workspace/api-server run build
```

---

## Known Limitations & Tech Debt

### No real authentication
Tester IDs are stored in `localStorage` and sent as a plain HTTP header. Any client with a known tester ID can access that tester's data. This is intentional for MVP but must be replaced before public launch.

### Ephemeris accuracy
The custom orbital mechanics implementation is accurate to ±1–2° for inner planets and ±3–5° for outer planets. It does not account for nutation, aberration, or perturbation terms. For birth chart work, a professional ephemeris library (e.g. `astronomia` or a VSOP87 implementation) would improve accuracy — especially for exact degrees used in house placement.

### House system limitation
Regiomontanus cusps are computed for intermediate houses, but the Ascendant and MC formulas are standard. Polar birth latitudes (above ~66°N) can produce undefined results. No validation is done on birth latitude.

### No migration system
The database uses `drizzle-kit push` for schema management. There are no versioned migration files. Any schema change must be applied manually to production via DDL.

### Hardcoded supportTags enum
The `supportTags` field returned in Body Weather is constrained to 10 fixed values in the AI prompt. The support preferences system controls what the AI suggests in prose (the `explanation` field) but cannot add new tag types without updating the prompt and potentially the UI.

### Blueprint prompt version is `v1` hardcoded
The string `"v1"` in `artifacts/api-server/src/routes/blueprint.ts` controls blueprint cache invalidation. Updating the prompt requires bumping this string to force regeneration. It is not surfaced as a config value.

### OpenAI model versions are hardcoded in routes
- Body Weather: `"gpt-5.4"`
- Blueprint: `"gpt-4o"`
- Oracle chat: `"gpt-5.4"`

These are set inline in each route file. There is no central model config.

### No conversation context limit
The Oracle chat route sends the full conversation history to the model with no trimming. Long conversations will eventually exceed the model's context window and fail.

### `lib/integrations-openai-ai-server` has pre-existing TypeScript errors
The generated `lib/integrations-openai-ai-server` and `lib/integrations-openai-ai-react` packages have pre-existing TypeScript errors that do not affect runtime. `pnpm run typecheck:libs` will report these — they are expected and should not be investigated.

### No rate limiting or abuse protection
There is no rate limiting on any endpoint. The AI routes make live OpenAI calls on every request.
