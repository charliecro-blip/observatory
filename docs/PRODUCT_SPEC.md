# Observatory — Product Specification

> AstroHealth / Observatory MVP. Last updated: May 2026.

---

## Vision

Observatory is an **astrology-informed health pattern journal** for self-aware people who want to track how their body feels over time and explore whether planetary cycles, natal chart patterns, and daily rhythms correlate with how they feel.

It is **not a medical app**. It does not diagnose, prescribe, or treat. It is a reflective tool — a structured journal that adds astrological context to daily body awareness.

The core loop is:
1. Do a short daily check-in (energy, mood, stress, sleep, etc.)
2. Receive a Body Weather reading — a personalized AI synthesis of how the check-in data intersects with the sky
3. Track practices, supplements, activities, and symptoms over time
4. See patterns emerge across logs, cultivations, and astrological context

---

## Language Principles

Observatory uses careful, non-prescriptive language throughout:

**Use:** tend, cultivate, nourish, observe, support, practice, track, explore, notice, tend  
**Avoid:** optimize, hack, maximize, fix yourself, heal, treat, cure

AI-generated content must never:
- Diagnose conditions
- Prescribe substances or doses
- Say astrology *causes* symptoms
- Use deterministic language ("this will happen")

AI-generated content must always:
- Use qualified language: "may correspond with," "can describe a tendency toward," "worth tracking"
- Reference specific data (scores, planet names, degrees)
- Sound like a thoughtful practitioner, not a horoscope

---

## Tester Profiles (MVP Multi-User)

Observatory uses a lightweight tester system in place of real authentication.

- Each participant creates a profile with a display name → receives a unique tester ID
- Tester IDs are stored in `localStorage` and sent with every API request
- Data is fully isolated per tester ID at the application layer
- The "Charlie" profile (`obs_default_charlie`) is the original dev profile and always available

This system is appropriate for closed MVP testing. It must be replaced with real authentication before any public launch.

---

## Feature Modules

### 1. Dashboard (`/`)

The home screen. Shows:
- Today's Body Weather reading (capacity level badge, summary, tags)
- "Generate Body Weather" button if no reading exists for today
- Regenerate button to force a new AI reading
- Inner Garden widget (appears when active cultivations exist): X/Y tended today with progress bar
- Recent health logs (last 8, compact list)
- Weekly summary: log counts, averages for mood and energy
- Current sky context: moon phase, dominant planet
- Quick-entry log form

**State logic:**
- If no check-in exists for today → shows a prompt to complete check-in before generating Body Weather
- If check-in exists but no body weather → shows "Generate" button
- If body weather exists → shows reading; shows "Regenerate" button

### 2. Daily Check-in (`/track`)

A structured form for capturing today's body state. All fields are 1–10 numeric scales except tags and notes.

**Fields:**
- Energy, Mood, Stress, Focus, Digestion, Sleep Quality, Pain, Nervous System Regulation (each 1–10)
- Symptom tags (multi-select): Fatigue, Headache, Anxiety, Bloating, Insomnia, Brain fog, Restlessness, Low mood, Joint pain, Skin flare, Nausea, Heart palpitations
- Behavior tags (multi-select): Alcohol, Coffee, Late night, Overwork, Conflict, Travel, High social, Meditation, Exercise, Good sleep
- Notes (free text)

The form is an **upsert** — submitting again on the same day overwrites the previous check-in. Body Weather readings for that day become stale (the user can regenerate).

### 3. Body Weather (`/` — embedded in Dashboard)

The central AI feature. A daily synthesis of:
- Today's check-in scores and tags
- The last 7 days of check-in history
- Current sky: moon phase and sign, sun sign, active transit list
- Natal chart context (if birth data saved): ASC, top planets, health blueprint summary, top 5 transit aspects by score
- Active cultivations and their today check-in status
- Support preferences (the AI restricts suggestions to enabled categories)

**Output fields:**
- `capacityLevel`: Low / Medium / High
- `capacityScore`: 1–10
- `bodyWeatherSummary`: 2–3 sentences
- `bestUseTags`: what to use the day for (Rest, Deep work, Creative work, Social connection, Admin tasks, Exercise, Emotional processing, Planning, Client work)
- `watchForTags`: what to watch (Overstimulation, Poor sleep, Digestive sensitivity, Irritability, Low focus, Emotional heaviness, Inflammation/heat, Social overload)
- `supportTags`: supportive actions (Walk, Rest, Eat simply, Hydrate, Reduce caffeine, Journal, Avoid overcommitting, Get sunlight, Gentle movement, Early bedtime)
- `explanation`: 2–4 sentence detailed synthesis

**Fallback:** If the AI call fails (any reason), a deterministic fallback runs locally — it computes capacity level and tags from the check-in scores using rules, and produces templated summary and explanation text. The user experience is identical; only the depth of insight changes.

### 4. Health Logs (`/logs`)

A scrollable log of all event entries. Each log entry captures:
- Type (supplement, activity, symptom, general)
- Linked supplement or activity (with denormalized name)
- Dosage or duration
- Mood and energy scores at log time
- Symptoms and notes
- Astro snapshot at the moment of logging (stored as JSON for pattern analysis)

Supports pagination. Used by the Patterns module for correlation analysis.

### 5. Supplements (`/supplements`)

A list of named supplements the user is tracking. Each has name, dosage, unit, frequency, and active status. Supplements appear as options when creating health log entries.

### 6. Activities (`/activities`)

A list of named activities (e.g. yoga, walking, swimming). Each has name, category, notes, and active status. Activities appear as options in health log entries.

### 7. Patterns (`/patterns`)

Statistical analysis of log history:
- **Mood–Energy correlation**: Pearson correlation coefficient from all logs where both are present
- **Moon phase mood averages**: Groups logs by the moon phase stored in the astro snapshot, shows average mood per phase (requires ≥2 data points)
- **Supplement tracking counts**: Shows how many times each supplement has been logged

Patterns require accumulated data to be meaningful. New testers will see empty or minimal results.

### 8. Natal Chart (`/natal`)

Birth data entry and computed chart display.

**Input:** birth date, birth time, birth place (city autocomplete via Geoapify → lat/lon/UTC offset, or manual entry)

**Computed output:**
- Ascendant (sign and degree)
- Midheaven (sign and degree)
- All planets: sign, degree, house number, retrograde flag
- All 12 houses: sign, cusp degree, contained planets
- Health insights: per-system summary based on house signs and rulers
- Active transit aspects against today's sky

The chart is computed fresh on every request from the stored birth data — no pre-computed positions are stored.

### 9. Natal Blueprint (`/blueprint`)

An AI-generated health-focused analysis of the natal chart. Generated once and cached.

**Sections:**
- Constitution Overview
- Ascendant Body Vitality
- Moon Body Rhythm
- 6th House Patterns (health / illness / routine)
- 2nd House Intake (nourishment patterns)
- 8th House Processes (chronic patterns, elimination)
- 10th House Therapies (what types of intervention may suit this constitution)
- Mars & Saturn Stress Signatures
- Venus & Jupiter Support Themes
- Contradictions & Mixed Testimony
- What to Track (5–8 specific tracking phrases)
- Supportive Principles (5–8 named-placement principles)
- Safety Note

Regeneration is available if birth data changes or the user requests it. Uses `gpt-4o` (not the faster model) to maximize output quality.

### 10. Cultivator (`/cultivator`)

A goal/habit tracking module framed as tending a personal garden.

**Creating a cultivation:**
- Title
- Domain (14 options: sleep, energy, digestion, nervous system, mood, movement, pain/tension, creative practice, boundaries, food rhythm, social rhythm, spiritual practice, study/learning, recovery)
- Frequency (daily, weekly, a few times a week, as needed)
- Target practice (short description of the specific action)
- Context notes

**Daily tending:**
- Circle button to mark as tended
- Expands inline to record effort level (1–5: gentle → full presence) and optional observation note
- Completed cultivations show with struck-through title and filled circle

**Status management:**
- Active (default)
- Paused (hidden from main list; resumable)
- Completed (archived; hidden but browsable)

**AI integration:** Active cultivations and their today check-in status (effort level, note) are injected into the Body Weather AI prompt as context.

### 11. Oracle (`/chat`)

A conversational AI wellness companion. Persistent conversations with streaming text responses and optional voice input.

The Oracle has context about:
- Today's sky (moon phase, sun sign, active planets and transits)
- The user's natal chart and transit aspects (if birth data is saved)
- The user's natal health blueprint summary

The Oracle does not have access to the user's log data, check-ins, or cultivations in real-time — it relies on what the user shares in conversation.

**Voice input:** Users can record voice messages that are transcribed via OpenAI Whisper, then a voice response is streamed back via TTS (alloy voice). Voice messages are stored as text transcripts alongside regular messages.

### 12. Settings (`/settings`)

Support Preferences — lets users select which categories of support Observatory may suggest in Body Weather readings.

**Categories:**
- Food Rhythm & Nourishment
- Rest & Sleep Hygiene
- Movement Practices
- Somatic Practices
- Meditation
- Breathwork
- Guided Visualization
- Journaling
- Acupressure
- Aromatherapy
- Herbal Research *(special phrasing: "herbal categories to research with a qualified practitioner" — never specific herbs)*
- Creative Practice
- Social & Boundary Practices

Preferences auto-save on each toggle. If no categories are selected, the AI may suggest from any appropriate area. The server validates category slugs before storing.

---

## Safety Rules (Non-Negotiable)

These apply across all AI features and UI copy:

1. Do not diagnose or imply a diagnosis
2. Do not prescribe substances, doses, or treatments
3. Do not say astrology causes symptoms
4. For herbal research: always phrase as "categories to research with a qualified practitioner" — never name specific herbs or dosages
5. Include a safety disclaimer on any AI-generated health content page
6. The Blueprint page includes: "This is an educational framework for pattern awareness, not a substitute for professional medical care"

---

## Recommended Next Implementation Tickets

The following are ordered by impact for a closed MVP with 5–15 testers:

### High priority

**1. Real authentication**
Replace tester ID localStorage with proper auth (Replit Auth or Clerk). Current system has zero security — any user knowing another's tester ID can read all their data. Required before expanding beyond a closed group.

**2. Body Weather staleness detection**
When a user updates their check-in, the existing body weather for that day becomes stale but there is no UI indicator. Add a "check-in updated — regenerate?" nudge on the dashboard.

**3. Cultivation check-in history**
The cultivator currently only shows today. Add a weekly calendar grid showing which days each cultivation was tended. This makes the module actually useful for pattern reflection.

**4. Oracle context: inject recent check-ins and logs**
The Oracle currently has no access to the user's check-in history or health logs. Injecting the last 7 days of check-in summaries into the system prompt would make it dramatically more useful for reflective conversation.

### Medium priority

**5. Body Weather history view**
Users have no way to see past body weather readings. A simple calendar or list view of past readings (stored in `daily_insights`) would enable the core pattern-awareness use case.

**6. Professional ephemeris integration**
The custom orbital mechanics implementation has ±1–5° error vs. a real ephemeris. For birth chart features (house cusps, exact degrees), integrating VSOP87 or the `astronomia` library would improve accuracy noticeably.

**7. Cultivation × Body Weather correlation**
Show whether days when specific cultivations are tended correlate with higher capacity scores. Requires accumulated check-in history.

**8. Export data**
Allow testers to export their full data (check-ins, logs, cultivations, body weather readings) as JSON or CSV. Important for building trust with health-aware early users.

### Lower priority

**9. Supplement × Body Weather correlation**
Surface whether specific supplements correlate with higher energy or mood averages. Uses existing `health_logs` + `daily_check_ins` data.

**10. Push notifications for daily check-in reminder**
Simple daily nudge via web push or email at a user-configured time.

**11. Versioned blueprint regeneration**
Bump `PROMPT_VERSION` in `blueprint.ts` and surface a "Your blueprint may have improved — regenerate?" prompt on the Blueprint page rather than requiring manual force-regeneration.

**12. Oracle conversation context limit**
Cap the conversation history sent to the model at ~20 messages to prevent context window failures on long conversations.
