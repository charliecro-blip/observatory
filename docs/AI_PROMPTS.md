# Observatory — AI Prompts Reference

> Documents all AI prompt flows as of May 2026. For runtime source of truth, see the referenced route files.

---

## Overview

Observatory uses OpenAI via the Replit AI Integrations proxy (`@workspace/integrations-openai-ai-server`). Three distinct prompt flows exist:

| Feature | Route file | Model | Output |
|---|---|---|---|
| Body Weather | `artifacts/api-server/src/routes/bodyWeather.ts` | `gpt-5.4` | Structured JSON |
| Natal Blueprint | `artifacts/api-server/src/routes/blueprint.ts` | `gpt-4o` | Structured JSON |
| Oracle Chat | `artifacts/api-server/src/routes/openai.ts` | `gpt-5.4` | Streaming text / voice |

---

## 1. Body Weather

**File:** `artifacts/api-server/src/routes/bodyWeather.ts`  
**Model:** `gpt-5.4`  
**Format:** `response_format: { type: "json_object" }`  
**Max tokens:** 1024

### Purpose

Generates a personalized daily health-weather reading by synthesizing:
- Today's structured check-in scores
- Recent check-in history (7 days)
- Current planetary positions and transits
- Natal chart context (if available)
- Active cultivations and their check-in status
- User's support preference categories

### Context assembly pipeline

Each time Body Weather is generated, the server assembles context in this order:

```
1. Fetch today's check-in (required — route returns 400 if missing)
2. Fetch last 7 daily check-ins for trend context
3. getAstroSnapshot(now) → current sky (moon phase/sign, sun sign, all planet positions, active transits)
4. Fetch natal chart from DB
   └── If present: computeNatalChart() → ASC, MC, planets, houses
              computeTransitAspects() → scored transit list
              computeNatalHealthInsights() → summary string
5. Fetch active cultivations (up to 8) + today's cultivation check-ins
   └── Build cultivation section string
6. Fetch support preferences
   └── Build support preferences section string
7. Assemble systemPrompt + userContent
8. Call OpenAI → parse JSON → validate required fields
9. On any failure → buildFallback(checkIn) (deterministic local fallback)
10. Upsert result into daily_insights table
```

### System prompt

```
You are AstroHealth Body Weather generator. Return ONLY a valid JSON object —
no markdown, no extra text, no explanation outside the JSON.

Safety rules (non-negotiable):
- Do not diagnose or prescribe.
- Do not say astrology causes symptoms.
- Use language like "may correspond with," "could reflect," "worth tracking,"
  "based on today's check-in," "can describe a tendency toward."
- Keep tone calm, practical, non-fatalistic, and grounded.
- If support preferences are set (provided in user context), suggest supportive
  practices ONLY from those categories. Do not suggest categories the user
  has not opted into.

Grammar and clarity rules (non-negotiable):
- Every sentence must be grammatically complete and correct.
- Do not write awkward compound sentences where a full clause is embedded
  inside another clause.
- Do not use keyword dumps or vague phrases like "vitality is active,"
  "this is a time of transformation," "pay attention to your body," or
  "balance is needed."
- Write like a thoughtful practitioner, not a horoscope generator.

Specificity rules:
- When referencing a transit, include: the transiting planet, the natal point
  or house involved, and what domain to track.
- Do not write "vitality is active" — instead describe what is happening and
  what to watch.
- The explanation field must weave check-in data (name the specific scores)
  with astrological context (name the specific planet/aspect if relevant),
  then suggest something concrete to track.

bodyWeatherSummary: 2–3 complete sentences describing today's overall body
weather. Reference specific check-in metrics (e.g. "energy at 4/10") and any
relevant sky context. Avoid generic openers like "Today is a day of…"

explanation: 2–4 sentences. Structure as: (1) what the check-in data shows,
naming scores; (2) what astrological context may correspond with this, if any;
(3) one concrete tracking suggestion or supportive action. Do not produce a
vague paragraph.

Choose bestUseTags ONLY from:
  Rest, Deep work, Creative work, Social connection, Admin tasks, Exercise,
  Emotional processing, Planning, Client work

Choose watchForTags ONLY from:
  Overstimulation, Poor sleep, Digestive sensitivity, Irritability, Low focus,
  Emotional heaviness, Inflammation/heat, Social overload

Choose supportTags ONLY from:
  Walk, Rest, Eat simply, Hydrate, Reduce caffeine, Journal,
  Avoid overcommitting, Get sunlight, Gentle movement, Early bedtime

Return this exact JSON structure:
{
  "capacityLevel": "Low" | "Medium" | "High",
  "capacityScore": <integer 1-10>,
  "bodyWeatherSummary": "<2-3 sentences summarizing today>",
  "bestUseTags": ["<tag>", ...],
  "watchForTags": ["<tag>", ...],
  "supportTags": ["<tag>", ...],
  "explanation": "<2-4 sentences: check-in data → astrological context → tracking suggestion>"
}
```

### User content structure

```
Today's check-in:
{ date, energy, mood, stress, focus, digestion, sleepQuality, pain, regulation,
  symptomTags, behaviorTags, notes }

Recent check-ins (last 7 days):
[ { date, energy, mood, stress, sleepQuality }, ... ]

Today's sky:
Moon: <phase> in <sign> · Sun in <sign>
Active transits: <semicolon-separated list>

<natalSection>
[If natal chart saved:]
Natal chart: ASC <sign> <deg>°, <top 5 planets with sign/house>.
Health blueprint: <summary>. Active transits (sorted by weight): <top 5 transits>.
[If no natal chart:]
No natal chart on file.

<cultivationSection>
[If active cultivations exist:]
Active cultivations (practices the user is intentionally tending):
- <domain>: "<title>" — practice: <targetPractice>. Frequency: <freq>. Today: tended/not tended.

<supportPrefsSection>
[If preferences set:]
Support preferences — the user has opted into these categories only:
<comma-separated readable labels>
[If herbal-research is enabled:]
Herbal note: phrase as "herbal categories to research with a qualified practitioner"
— never name specific herbs or dosages.
[If no preferences set:]
Support preferences: not configured. Suggest from any appropriate supportive category.

Generate the Body Weather JSON now.
```

### Deterministic fallback

If the AI call fails (network error, parse error, invalid JSON structure), `buildFallback(checkIn)` runs synchronously:

```
capacityLevel:
  Low   → energy ≤ 4 OR sleepQuality ≤ 4 OR stress ≥ 8
  High  → energy ≥ 8 AND stress ≤ 5 AND sleepQuality ≥ 6
  Medium → otherwise

capacityScore = round((energy + (10-stress) + sleepQuality + focus) / 4), clamped 1–10

watchForTags: rule-based from symptom_tags and behavior_tags
supportTags:  rule-based from scores and tags
bestUseTags:  derived from capacityLevel

bodyWeatherSummary: one of three hardcoded template strings (Low/Medium/High)
explanation: template string referencing actual scores from check-in
```

The fallback produces deterministic, grammatically complete output and is indistinguishable in format from AI output. It does not reference astrology.

### Caching

Generated readings are stored in `daily_insights` (unique per `tester_id + date`). The GET route returns the cached reading if one exists. The POST `/regenerate` route forces a fresh generation and overwrites the cache.

---

## 2. Natal Blueprint

**File:** `artifacts/api-server/src/routes/blueprint.ts`  
**Model:** `gpt-4o`  
**Format:** Standard completion (JSON extracted via regex from fenced or raw response)  
**Max tokens:** 4096

### Purpose

Generates a one-time medical astrology analysis of the user's natal chart. Cached per tester. Regenerated only on explicit request or when `PROMPT_VERSION` changes.

### Cache invalidation

The `PROMPT_VERSION` constant (`"v1"`) is checked against the stored blueprint's `prompt_version` field. If the version matches and a blueprint exists, the cached version is returned without calling the AI. To force regeneration of all blueprints (e.g. after a prompt improvement), bump `PROMPT_VERSION` in the route file.

Users can force regeneration by sending `{ force: true }` in the POST body.

### Context assembly

```
1. Fetch natal chart from DB
2. computeNatalChart() → full chart with houses and planets
3. Identify chart ruler (ASC sign ruler from SIGN_RULERS lookup)
4. Identify sect (day/night — Sun in house 7–12 = day chart)
5. Compute natal moon phase (separation between natal Sun and Moon)
6. Build health-relevant house analysis for houses 1, 2, 6, 8, 10
   (sign + ruler planet + ruler placement)
7. Assemble full prompt (one large user message, no system message)
8. Call OpenAI
9. Extract JSON (regex: fenced block → raw { } extraction)
10. Parse and store in natal_blueprints table
```

### Prompt structure

The blueprint uses a single `user` message (no separate `system` message). The prompt is built by `buildBlueprintPrompt(storedNatalChart)` and includes:

**Preamble:**
```
You are a medical astrology analyst. Generate a comprehensive natal health
blueprint for the following chart. This is a self-tracking and educational tool
— not medical advice, not a diagnosis, not a prescription.
```

**Chart data block:**
```
NATAL CHART DATA:
Ascendant: <sign> <deg>°
Chart Ruler: <planet> in <sign> <deg>° House <N> [retrograde?]
Midheaven: <sign> <deg>°
Sect: Day/Night chart (Sun in House <N>)
Natal Moon Phase: <phase>

All Planetary Positions:
  <planet>: <sign> <deg>°, House <N> [retrograde?]  (× 10 planets)

All Houses:
  House <N>: <sign> [contains: <planets>]  (× 12 houses)

Health-Relevant House Analysis:
  - 1st (Body/Constitution): <sign>, Ruler → <planet placement>
  - 2nd (Intake/Nourishment): ...
  - 6th (Health/Illness/Routine): ...
  - 8th (Chronicity/Hidden Processes): ...
  - 10th (Therapy/Direction/MC): ...
```

**Quality rules (mandatory, stated in prompt):**
1. Every prose field must contain grammatically complete sentences
2. Always name the exact planet, sign, degree, and house — never "this planet"
3. Forbidden phrases: "pay attention," "balance is needed," "this is significant," "transformation is possible," "you are sensitive," "interesting placement"
4. Do not diagnose, prescribe, or name specific supplements or herbs
5. Use qualified language: "may correspond with," "can describe a tendency toward," "worth tracking," "the placement suggests"
6. `contradictionsMixedTestimony` must identify actual contradictions in this specific chart — not generic statements
7. `whatToTrack` items must be complete phrases with what to watch and why
8. `supportivePrinciples` must be grounded in a named chart placement
9. `safetyNote` must be a single calm paragraph

**Required JSON output schema:**
```json
{
  "constitutionOverview": "3–5 sentences",
  "ascendantBodyVitality": "3–5 sentences",
  "moonBodyRhythm": "3–5 sentences",
  "sixthHousePatterns": "3–5 sentences",
  "secondHouseIntake": "2–4 sentences",
  "eighthHouseProcesses": "2–4 sentences",
  "tenthHouseTherapies": "2–4 sentences",
  "marsSaturnStress": "3–5 sentences",
  "venusJupiterSupport": "2–4 sentences",
  "contradictionsMixedTestimony": "3–6 sentences",
  "whatToTrack": ["phrase 1", "...(5–8 total)"],
  "supportivePrinciples": ["named-placement principle 1", "...(5–8 total)"],
  "safetyNote": "Single paragraph"
}
```

### Error handling

Two distinct error states:
- **AI unavailable** (`ai_unavailable`): OpenAI call throws → returns 500. User is told to try again.
- **Parse failure** (`parse_failed`): AI returns non-parseable JSON → returns 500. User is told to try again.

There is no fallback for the blueprint — unlike Body Weather, a deterministic fallback is not feasible for a multi-section qualitative analysis.

---

## 3. Oracle Chat

**File:** `artifacts/api-server/src/routes/openai.ts`  
**Model:** `gpt-5.4`  
**Format:** Streaming SSE (`stream: true`)  
**Max tokens:** 8192

### Purpose

A persistent conversational companion. The Oracle has access to astrological context but not to the user's stored health data — it relies on what users share in conversation.

### Context assembly

```
1. Load conversation + full message history from DB
2. getAstroSnapshot(now) → current sky
3. Fetch natal chart from DB (if saved)
   └── computeNatalChart() → full computed chart
       computeNatalHealthInsights() → blueprint summary
       computeTransitAspects() → top 5 transits by score
4. buildSystemPrompt(astro, natal, natalInsights, natalTransits)
5. Compose message array: [system, ...all history messages]
6. Stream completion → write SSE chunks → store full response in DB
```

### System prompt

Built by `buildSystemPrompt()`:

**Identity block:**
```
You are AstroHealth Oracle, a warm and perceptive personal wellness guide
with deep knowledge of medical astrology.
```

**Natal section** (injected only if natal chart exists):
```
User's natal chart (birth data on file):
- Ascendant: <sign> <deg>°
- Midheaven: <sign> <deg>°
- Natal planets: <planet sign deg° H#> × all planets
- Health blueprint: <summary> | 6th house (health): <themes>
- Active transits by weight (higher score = more astrologically significant):
  <transit planet> <aspect> natal <natal planet> [severity, score, orb, domains]
  (top 5 only)
```

**Sky block:**
```
Today's sky:
- Date: <full date string>
- Moon: <phase> in <sign>
- Sun in <sign>
- Planets: <planet in sign deg>° (× all planets)
- Active transits: <semicolon list>
```

**Role and behavior:**
```
Your role:
- Be the user's thoughtful health companion — track supplements, activities,
  symptoms, mood, and energy with them
- Connect what they share to their natal blueprint AND today's sky — be
  specific, not generic
- When they describe something ("I took magnesium", "bad headache today",
  "went for a run"), acknowledge it and suggest how to log it
- Offer wellness guidance grounded in the astrological context — not medical
  advice, but supportive and insightful
- Reference their natal chart placements naturally and specifically
```

**Quality rules (stated in prompt):**
```
Language and quality rules (always follow these):
- Write grammatically complete sentences.
- Never use vague phrases like "vitality is active," "this is a time of
  transformation," "pay attention to your body," or "balance is needed."
- When mentioning a transit, always name: the transiting planet, the natal
  point or house, and what domain to track.
- Do not diagnose. Do not prescribe. Do not say astrology causes symptoms.
- Use language like "may correspond with," "can describe a tendency toward,"
  "is worth tracking," "in your logs, this appears alongside."
- Sound like a thoughtful practitioner — not a horoscope or a clinical report.

Keep responses concise (2–4 sentences unless detail is genuinely needed).
Be warm, direct, and genuinely curious about their experience.
```

### Streaming response format

The Oracle route sends Server-Sent Events:

```
data: {"content": "<delta text>"}\n\n   ← repeated for each chunk
data: {"done": true}\n\n                ← signals completion
data: {"error": "AI unavailable"}\n\n   ← on error
```

The full assembled response is stored in the `messages` table after streaming completes.

### Voice messages

Voice messages are handled by the same route via `/voice-messages` with `multipart/form-data`:

1. Receive audio buffer via multer (max 50MB)
2. `ensureCompatibleFormat(buffer)` — converts to a format OpenAI Whisper accepts if needed
3. `voiceChatStream(buffer, "alloy", format)` — streams:
   - `{ type: "user_transcript", data: "..." }` — transcribed user speech
   - `{ type: "transcript", data: "..." }` — AI spoken response text
   - Other audio stream events
4. Both user transcript and assistant transcript are stored in the `messages` table
5. Events are forwarded as SSE to the client

Voice does not include the full conversation history as context — it is a single-turn voice exchange in the context of the conversation.

---

## Shared Principles Across All Prompts

### Safety rules (enforced in all three prompts)
- No diagnosis
- No prescriptions
- Astrology does not cause symptoms — use qualified language
- Specific herb names are never mentioned; herbal content is phrased as "categories to research with a qualified practitioner"

### Quality rules (enforced in all three prompts)
- Complete grammatical sentences required
- No keyword dumps or vague filler phrases
- Always name specific planets, signs, degrees, and houses
- Every claim must be grounded in actual data (check-in scores or chart placements)

### Forbidden phrases (explicit blocklist in prompts)
- "vitality is active"
- "this is a time of transformation"
- "pay attention to your body"
- "balance is needed"
- "this is significant"
- "interesting placement"
- "you are sensitive"

---

## Prompt Versioning

| Prompt | Version field | Current version | Location |
|---|---|---|---|
| Body Weather | Not versioned | N/A | Route logic |
| Blueprint | `prompt_version` in `natal_blueprints` table | `"v1"` | Hardcoded constant in `blueprint.ts` |
| Oracle | Not versioned | N/A | `buildSystemPrompt()` function |

To invalidate all cached blueprints: change the `PROMPT_VERSION` constant in `blueprint.ts` from `"v1"` to `"v2"` (or any new string). Users will be prompted to regenerate on next visit to the Blueprint page.
