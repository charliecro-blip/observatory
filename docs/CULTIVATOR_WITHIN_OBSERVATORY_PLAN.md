# Cultivator Expansion Plan — Within Observatory

> Status: Plan only. No code changes. June 2026.

---

## Table of Contents

1. [What Exists Today](#1-what-exists-today)
2. [Guiding Principles](#2-guiding-principles)
3. [Elemental Framework](#3-elemental-framework)
4. [Feature Roadmap](#4-feature-roadmap)
5. [Schema Changes](#5-schema-changes)
6. [API Changes](#6-api-changes)
7. [Frontend Changes](#7-frontend-changes)
8. [AI Integration Changes](#8-ai-integration-changes)
9. [Implementation Order](#9-implementation-order)
10. [What Not to Change](#10-what-not-to-change)

---

## 1. What Exists Today

### Database

**`cultivations` table**
- id, tester_id, title, domain (14 options), description, related_planet, related_house, related_body_weather_tags, target_practice, frequency, status (active/paused/completed), created_at, updated_at
- `related_planet` and `related_house` exist in the schema but are never set in the UI

**`cultivation_check_ins` table**
- id, tester_id, cultivation_id, date (YYYY-MM-DD), completed (boolean), effort_level (integer 1–5), note, created_at, updated_at
- One row per (cultivation_id, date) — upserted
- The API accepts a `date` field, but the frontend always sends today's date — retrospective logging is architecturally present but not exposed

### API routes (7 total)

| Method | Path | What it does |
|---|---|---|
| GET | `/api/cultivations` | List all with today's check-in embedded. Filter: `?status=active` |
| POST | `/api/cultivations` | Create cultivation |
| PATCH | `/api/cultivations/:id` | Update any field including status |
| DELETE | `/api/cultivations/:id` | Deletes cultivation and all check-ins |
| GET | `/api/cultivations/:id/check-ins/today` | Today's check-in for one cultivation |
| POST | `/api/cultivations/:id/check-ins` | Upsert today's (or given date's) check-in |

No history endpoint. No aggregation endpoint. No element-aware endpoint.

### Frontend (`cultivator.tsx`, ~560 lines)

- Single page. Active / paused / completed list.
- Create form: title, domain, target_practice, description, frequency. No element field. No relatedPlanet/relatedHouse UI.
- Tend flow: click circle → inline panel for effort level (1–5) + text note → confirm.
- Untend: click filled circle to toggle off.
- Status actions: pause, mark complete, delete.
- No date picker — always logs today.
- No history view per cultivation.
- No elemental grouping or summary.

### Dashboard widget

Inner Garden widget: shows `X/Y tended today` + progress bar + up to 4 cultivation titles as dots. Links to `/cultivator`.

### Body Weather AI injection

Active cultivations (up to 8) plus today's check-in statuses are injected into the Body Weather system prompt as a text block:

```
Active cultivations (practices the user is intentionally tending):
- <domain>: "<title>" — practice: <targetPractice>. Frequency: <freq>. Today: tended (effort X/5, note "…") / not yet tended.
```

---

## 2. Guiding Principles

The Cultivator is not a habit tracker. It is a **practice garden** — a place to tend intentions over time, with astrological and elemental context. The language and interaction should feel more like a journal than a productivity tool.

- **Tend, not complete.** The language remains: tend, plant, cultivate, observe, nourish. Not: complete, finish, check off, streak.
- **Elements are context, not categories.** Elements inform how the user reflects on their practices — they are not a gamification system with scores to maximize.
- **Retrospective honesty over real-time streaks.** The ability to log a past day acknowledges that life doesn't always allow for same-day reflection. No streak mechanics.
- **The daemon reflects, it does not coach.** The AI reflection voice is curious and observational — it notices patterns and asks questions. It does not give instructions or praise compliance.
- **Do not disturb existing Body Weather behavior.** New Cultivator fields should enrich the AI context gradually, not break the current injection.

---

## 3. Elemental Framework

### Four elements mapped to domains

Each domain maps to one classical element. The mapping is pre-assigned and based on traditional correspondence (Fire = will/action, Earth = structure/nourishment, Air = mind/connection, Water = feeling/depth).

| Element | Symbol | Domains |
|---|---|---|
| **Fire** 🜂 | Will, vitality, action, heat | energy, movement, creative-practice, spiritual-practice |
| **Earth** 🜃 | Structure, nourishment, grounding, slowness | digestion, food-rhythm, recovery, pain-tension |
| **Air** 🜁 | Mind, communication, connection, boundaries | nervous-system, study-learning, social-rhythm, boundaries |
| **Water** 🜄 | Feeling, rhythm, depth, rest | sleep, mood |

Two domains (spiritual-practice, creative-practice) sit at the Fire/Water boundary. The default assignment stands. Users may override the element on any cultivation without constraint.

### What element is used for

1. **Visual grouping on the Cultivator page** — element header bands replace or supplement the current "Active" section heading when viewing all cultivations
2. **Elemental balance dashboard** — a weekly tally showing how many check-ins fell into each element
3. **Body Weather injection** — element is appended to each cultivation line in the AI context string
4. **Daemon reflection** — the weekly reflection notes which elements the tester is spending the most vs. least attention on

### What element is NOT used for

- Element is not a score or a metric to optimize
- Element is not shown in the Inner Garden dashboard widget (too much noise there)
- Element is not required — a cultivation can have `element: null` and it simply won't appear in element-based groupings or the balance chart

---

## 4. Feature Roadmap

### MVP (the minimum version that makes the module meaningfully richer)

**4.1 Elemental mapping on cultivations**
- Add `element` field to `cultivations` table (text, nullable, values: `fire`, `earth`, `air`, `water`)
- Server auto-derives element from domain using the mapping table above
- User can override via a small element selector in the create and edit forms
- Element badge displayed on each cultivation card alongside domain badge

**4.2 Retrospective logging**
- Add a date picker to the tend panel
- Default remains today
- API already supports `date` — this is a pure frontend change
- Range: allow up to 30 days in the past. No future dates.
- Past-logged check-ins shown differently from today's (e.g. a small "logged for [date]" note)

**4.3 Multi-practice logging**
- The current check-in captures one boolean + effort + note
- Add a `practices_completed` JSON array field to `cultivation_check_ins`
- When a cultivation has a multi-line `target_practice` (or when the user wants to split a session), they can add multiple named sub-practices in the tend panel
- Example: a cultivation titled "Morning rhythm" might have sub-practices "5 min breath" / "cold water" / "no phone first 30 min" — the tend panel shows checkboxes for each, and `practices_completed` stores which were done
- The `completed` boolean on the check-in becomes `true` if any sub-practice is checked, not necessarily all
- If a cultivation has no sub-practices defined, the tend panel works exactly as today (no regression)

**4.4 Elemental balance dashboard tab**
- New section or tab on the Cultivator page: "Balance"
- Shows a simple visual breakdown of check-ins by element for the past 7 days and past 30 days
- Display: four element tiles (Fire / Earth / Air / Water), each showing count of tended days in the window
- Does not need to be a fancy chart — four tiles with numbers and a proportional fill bar is sufficient
- A secondary line shows which element has the most untended days

### v1.1 (after MVP is stable and collecting data)

**4.5 Per-cultivation history view**
- Tap/expand a cultivation card to reveal a 30-day calendar grid of dots
- Green dot = tended on that day; empty = not tended; gray dot = paused
- Shows effort level as dot intensity (light/medium/full)
- Does not require new API — fetch from `GET /api/cultivations/:id/check-ins?days=30`

**4.6 Dashboard widget enhancement**
- Add element mini-bars to the Inner Garden widget on the dashboard (tiny Fire/Earth/Air/Water color chips representing which elements have untended cultivations today)
- Keep the widget compact — this is additive color, not text

**4.7 Body Weather: element context in injection**
- Add element to the cultivation line in the Body Weather prompt:
  - Before: `- nervous-system: "Evening wind-down" — practice: …`
  - After: `- Air · nervous-system: "Evening wind-down" — practice: …`
- No change to the prompt structure otherwise

### v1.2 (daemon reflection — requires accumulated data)

**4.8 Daemon reflection**
- A weekly AI-generated reflection on cultivation patterns
- Triggered manually by the user ("Ask the daemon") or optionally auto-generated on Sunday
- The daemon has access to:
  - All check-in history for the past 14 days
  - Elemental balance statistics for the period
  - Any cultivations that were created, paused, or completed in the period
  - The tester's natal chart (if saved) — specifically the ASC sign and 6th house ruler
  - Current active transits
- The daemon does **not** have access to body weather scores, check-in moods, or health logs (it should feel like a separate voice from Body Weather)
- Output: 3–5 paragraphs of reflective prose. No JSON. No bullet lists. No scores.
- Tone: curious, non-prescriptive, slightly poetic. Uses cultivation metaphors (tending, seasons, weather, soil).
- Stored in a new `cultivation_reflections` table. Cached for 7 days unless user requests regeneration.
- Displayed on a new "Reflection" section of the Cultivator page (collapsed by default, expand to read)

---

## 5. Schema Changes

### `cultivations` table — add one column

```sql
ALTER TABLE cultivations ADD COLUMN element text;
```

- Values: `'fire'`, `'earth'`, `'air'`, `'water'`, or NULL
- Server-side: auto-populate on creation via the domain→element mapping. User can override.
- The mapping is a lookup object in the server route — not a DB constraint, so the mapping can be updated without migrations.

### `cultivation_check_ins` table — add two columns

```sql
ALTER TABLE cultivation_check_ins ADD COLUMN practices_completed jsonb;
ALTER TABLE cultivation_check_ins ADD COLUMN duration_minutes integer;
```

- `practices_completed`: string[] of sub-practice labels that were done (e.g. `["5 min breath", "cold water"]`). NULL if not used.
- `duration_minutes`: optional total session duration. NULL if not recorded.
- No changes to existing columns. `completed`, `effort_level`, and `note` continue to work exactly as before.

### New table: `cultivation_reflections` (v1.2 only)

```sql
CREATE TABLE cultivation_reflections (
  id serial PRIMARY KEY,
  tester_id text NOT NULL,
  week_start text NOT NULL,               -- YYYY-MM-DD of the Monday
  reflection_text text,
  prompt_version text NOT NULL DEFAULT 'v1',
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tester_id, week_start)
);
```

Add to `lib/db/src/schema/` as `cultivationReflection.ts` and export from `index.ts`.

### Drizzle ORM additions

Update `lib/db/src/schema/cultivation.ts`:
```ts
element: text("element"),
```

Update `lib/db/src/schema/cultivationCheckIn.ts`:
```ts
practicesCompleted: jsonb("practices_completed").$type<string[]>(),
durationMinutes: integer("duration_minutes"),
```

Run `pnpm --filter @workspace/db run push` to apply to dev. Apply equivalent DDL manually to production.

---

## 6. API Changes

### Modified routes

**POST `/api/cultivations`** — Creation
- Server reads `domain` from request body
- Looks up element from a `DOMAIN_ELEMENT_MAP` constant
- Sets `element` on the insert. If `element` is explicitly provided in the body (user override), use that instead.
- Return value includes `element`.

**PATCH `/api/cultivations/:id`**
- Accept `element` in body (user override).

**POST `/api/cultivations/:id/check-ins`** — Upsert check-in
- Accept `practicesCompleted: string[]` and `durationMinutes: number` in request body.
- Pass through to DB. No validation of sub-practice content (just store what is sent).
- `completed` logic: if the client sends no explicit `completed` value but sends a non-empty `practicesCompleted`, server sets `completed: true` automatically.

### New routes

**GET `/api/cultivations/:id/check-ins`** — check-in history
```
Query params: ?days=30 (default 30, max 90)
Returns: cultivation_check_ins[] ordered by date desc
```
Required for: per-cultivation history view (v1.1), daemon context assembly (v1.2).

**GET `/api/cultivations/element-balance`** — elemental tally
```
Query params: ?days=7 (default 7, accepts 7 or 30)
Returns: {
  fire: { tended: number, total: number },
  earth: { tended: number, total: number },
  air: { tended: number, total: number },
  water: { tended: number, total: number },
  unassigned: { tended: number, total: number }
}
```
"total" = number of active cultivations with that element × days in range.  
"tended" = number of check-ins with `completed: true` for cultivations of that element in the range.  
No new DB table needed — computed from existing tables.

**POST `/api/cultivation-reflections/generate`** (v1.2)
- Fetches last 14 days of check-in history for all cultivations
- Fetches elemental balance for the period
- Fetches natal chart if available
- Fetches top transit aspects
- Builds daemon system prompt + user context
- Calls OpenAI (model TBD — `gpt-4o` preferred for prose quality)
- Stores in `cultivation_reflections` table with `week_start` = current ISO week Monday
- Returns the reflection text
- Respects cache: returns existing reflection if it exists for this week and `?force=true` is not passed

**GET `/api/cultivation-reflections/current`** (v1.2)
- Returns the reflection for the current week, or 404 if none generated yet.

---

## 7. Frontend Changes

### `cultivator.tsx` — changes

**CultivationRow type**: add `element: string | null`.

**Create form**: add element selector (optional override). Default shown is the auto-derived element for the selected domain — update it reactively when domain changes. Display as four small element chips (Fire / Earth / Air / Water) the user can tap to override, or leave as "auto".

**CultivationCard**: add element badge next to domain badge. Element chip uses a small symbol/color:
- Fire → warm orange/amber
- Earth → muted green/brown
- Air → light blue/lavender
- Water → deep blue/teal

**Tend panel**: add two things:
1. **Date picker** (small, defaults to today): renders a minimal date input or a popover calendar. Past 30 days only. Label: "Logging for [date]".
2. **Sub-practices** (only shown if cultivation has a `targetPractice` that can be parsed into multiple lines, OR if `practicesCompleted` is relevant): list of checkbox items. The initial implementation can keep this simple — a text input for "what did you actually do" that maps to `practicesCompleted[0]` — and expand to a structured multi-checkbox in v1.1.

**New section: "Balance" tab or section**
- Add a simple two-tab or two-section structure to the Cultivator page:
  - **Garden** (current view — active/paused/completed list)
  - **Balance** (new — elemental tally)
- Balance view: four element tiles, each showing element name, tended count / active-cultivation-days, and a horizontal fill bar.
- Two time windows: "Past 7 days" / "Past 30 days" toggle.
- Below the tiles: a single sentence observation ("Earth practices have the most untended days this week.") — purely computed from the data, no AI.
- If all elements have 0 cultivations, show an empty state: "Create cultivations to see your elemental balance."

**New section: "Reflection" (v1.2)**
- At the bottom of the Garden view, below the active list.
- Collapsed by default. Header: "Daemon Reflection · Week of [date]".
- Expand to read full reflection text.
- "Ask the daemon" button generates/refreshes.
- Regenerate button (force=true) shown only if a reflection exists already.

### `dashboard.tsx` — Inner Garden widget (v1.1)

- After the progress bar, add a row of four tiny element color chips.
- Each chip is colored if there is at least one active cultivation for that element with `todayCheckIn?.completed === false`.
- This gives a quick "what still needs tending by element" glance without adding text.
- Keep this additive — do not remove existing progress bar or cultivation title list.

---

## 8. AI Integration Changes

### Body Weather — `bodyWeather.ts`

**Immediately (MVP):** Append element to each cultivation line in the injected context.

Before:
```
- nervous-system: "Evening wind-down" — practice: No screens 45 min before sleep. Frequency: daily. Today: tended (effort 3/5).
```

After:
```
- Air · nervous-system: "Evening wind-down" — practice: No screens 45 min before sleep. Frequency: daily. Today: tended (effort 3/5).
- [practices completed: No screens 45 min before sleep, dim lights, journal page]
```

If `practicesCompleted` is non-empty, append a sub-line. This gives Body Weather richer context for what was actually done without changing the prompt structure.

No change to the system prompt copy. No change to the output schema.

### Daemon Reflection — new prompt (v1.2)

**System prompt:**

```
You are the Cultivator Daemon — a reflective witness to the user's practice garden.
Your voice is quiet, curious, and grounded. You speak in the language of seasons,
soil, and slow growth. You do not coach, prescribe, or evaluate productivity.

You notice what is being tended and what is lying fallow. You hold both equally.

Language rules:
- Write in prose paragraphs. No bullet lists. No headers.
- Do not name specific plants or herbs (this is metaphorical gardening).
- Do not say "I noticed that..." — speak directly about what the data shows.
- Do not praise consistency or critique gaps. Observe them without judgment.
- Use language like "appears," "has been resting," "seems to be," "the pattern suggests."
- Do not diagnose, prescribe, or give medical guidance.
- 3–5 paragraphs. No more. Silence is part of the practice.
```

**User context assembled by server:**

```
Cultivation log — past 14 days:

Active cultivations:
[For each: element · domain: "title". Frequency. Days tended in period: X/14. Effort avg: X.X. Any notes logged: yes/no.]

Elemental balance (14 days):
Fire: X tended / Y possible. Earth: X/Y. Air: X/Y. Water: X/Y.

Cultivations planted this period: [list titles if any]
Cultivations paused this period: [list titles if any]
Cultivations completed this period: [list titles if any]

[If natal chart saved:]
Natal context: ASC <sign>, 6th house <sign>. Chart ruler: <planet> in <sign> H<N>.
Active high-weight transits: <top 3>.
[End natal]

Reflect on what you observe in this garden.
```

**Tone guidance (embedded in system prompt):**
The daemon notices the elemental texture of the period. If Air practices are abundant and Earth practices are sparse, it might note that the mind has been busy while the body's rhythm has been quieter. It does not prescribe Fire to balance Water — it simply names what it sees and leaves space.

---

## 9. Implementation Order

The following sequence avoids regressions and builds each phase on a stable base.

### Phase 1 — Schema + element mapping (foundation)

1. Add `element` column to `cultivations` table (nullable)
2. Add `practices_completed` and `duration_minutes` to `cultivation_check_ins`
3. Update Drizzle schema files in `lib/db/src/schema/`
4. Run `pnpm --filter @workspace/db run push`
5. Run `pnpm run typecheck:libs` to verify lib compilation

No frontend or API changes yet.

### Phase 2 — API: element auto-assignment + check-in enrichment

1. Add `DOMAIN_ELEMENT_MAP` constant to `cultivations.ts` route
2. Modify POST `/api/cultivations` to auto-derive and set element
3. Modify PATCH `/api/cultivations/:id` to accept element override
4. Modify POST `/api/cultivations/:id/check-ins` to accept `practicesCompleted` and `durationMinutes`
5. Add GET `/api/cultivations/:id/check-ins` (history endpoint)
6. Add GET `/api/cultivations/element-balance`
7. Update OpenAPI spec with new fields and routes
8. Run `pnpm --filter @workspace/api-spec run codegen`

### Phase 3 — Frontend: element badges + retrospective date picker

1. Update `CultivationRow` type in `cultivator.tsx`
2. Add element badge to `CultivationCard`
3. Add element auto-derive to create form (reactive on domain change)
4. Add date picker to tend panel
5. Pass `practicesCompleted` (minimal: single text field) in tend mutation body

Test: create a cultivation, verify element badge. Tend with a past date. Verify check-in stores correct date.

### Phase 4 — Elemental balance view

1. Add "Balance" section or tab to Cultivator page
2. Fetch from `/api/cultivations/element-balance`
3. Display four element tiles with fill bars
4. Add 7-day / 30-day toggle

### Phase 5 — Body Weather enrichment

1. Update the cultivation injection loop in `bodyWeather.ts` to prepend element
2. Append `practicesCompleted` sub-line where non-empty
3. No prompt structure changes

Test: generate Body Weather with active cultivations that have element set and practices_completed.

### Phase 6 — Daemon reflection (v1.2, after data accumulates)

1. Create `cultivation_reflections` Drizzle schema
2. Add `lib/db/src/schema/cultivationReflection.ts`, export from index
3. Write new route file `cultivationReflections.ts`
4. Build daemon prompt assembly function
5. Add route to `routes/index.ts`
6. Add "Reflection" section to Cultivator frontend (collapsed)
7. Update OpenAPI spec + codegen

---

## 10. What Not to Change

- **Do not rename the module from "Cultivator."** The existing name, route path (`/cultivator`), nav label, and language ("tend," "plant," "inner garden") are established and should remain.
- **Do not change the existing 7 API routes.** All additions are new endpoints or new fields on existing endpoints. No breaking changes.
- **Do not change the existing `cultivation_check_ins` uniqueness behavior.** One check-in per (cultivation, date) per tester. Multi-practice logging is additive fields on the same record, not multiple records per day.
- **Do not remove or change the Body Weather injection.** Only add the element prefix and the practices_completed sub-line. The existing prompt structure and output schema stay the same.
- **Do not touch the other Observatory modules** (Body Weather scores, Blueprint, Oracle, Check-in, Logs, Settings) unless a specific change is listed above.
- **Do not add astrological prescriptions to the daemon.** The daemon observes elemental patterns — it does not tell users to "add more Fire practices" or interpret their natal Saturn as a deficiency. The reflection is contemplative, not prescriptive.
- **Do not surface effort_level or practice quality as a performance metric.** No streaks, no scores, no "longest streak," no gamification.
