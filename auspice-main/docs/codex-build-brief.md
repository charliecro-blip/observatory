# Codex Build Brief — Auspice Static Prototype

## Objective

Build the first static clickable prototype of **Auspice** inside `/prototype`.

Auspice is a rhythm-aware astrological planning assistant. It helps users understand the quality of the current time, capture what is asking for attention, choose what fits now, and orient their week without turning life into a productivity machine.

Core product question:

> Given the quality of time and the shape of my life, what belongs here?

Core phrase:

> Move with time, instead of forcing yourself through it.

## Important Product Guardrails

Auspice is **not** a productivity optimizer.

Do not make the prototype feel like Asana, Todoist, Motion, Reclaim, or a hustle dashboard.

The app should not:

- fill every open slot
- pressure the user to do more
- use productivity scores
- frame rest as failure
- make astrology deterministic
- create fear around imperfect timing
- imply every task needs a perfect election
- turn capture into heavy data entry
- imply users must abandon Notion, Notes, calendars, or other organizing systems

The app should:

- suggest rather than command
- orient rather than optimize
- offer 2–4 fitting options
- always include a gentler version
- make rest, cleanup, incubation, and home care feel legitimate
- treat timing as symbolic support, not fate
- feel like a living almanac, not a task grinder
- let users dump messy tasks now and sort later
- act like a timing layer that can eventually run alongside existing systems

## Repository Context

Use these files as source context:

- `README.md`
- `docs/product-spec.md`
- `docs/ui-wireframe-spec.md`
- `docs/capture-dump-feature-spec.md`
- `docs/integrations-strategy.md`
- `docs/source-audit.md`
- `docs/source-library.md`
- `research/robson-electional-extraction.md`
- `rules/auspice-seed-rules-v1.json`

The seed rules file is the canonical source for:

- product language
- planetary families
- election levels
- event categories
- symbolic start types
- Moon condition meanings
- planetary hour meanings
- sample tasks

## Build Location

Build inside:

```text
/prototype
```

Do not modify root-level docs unless absolutely necessary.

## Tech Stack

Create a simple React app.

Preferred:

- Vite
- React
- TypeScript if easy, otherwise JavaScript is acceptable
- CSS modules, plain CSS, or Tailwind if already configured by the scaffold

Do not add a backend.
Do not add authentication.
Do not add database persistence.
Do not call astrology APIs.
Do not integrate Google Calendar yet.
Do not integrate Notion or Notes yet.

Use static/mock data.

## Prototype Scope

Build a single-page app with tab navigation:

1. **Today**
2. **Capture**
3. **Week**
4. **Tasks**
5. **Find a Time**

The prototype should feel complete enough to click around, but it does not need real calculations.

## Data Requirements

Import or copy relevant data from:

```text
../rules/auspice-seed-rules-v1.json
```

If importing from outside `/prototype` is awkward, copy a trimmed version into:

```text
/prototype/src/data/seedRules.json
```

Also create mock astrology data in something like:

```text
/prototype/src/data/mockTimeWeather.ts
```

Mock current moment:

```json
{
  "date": "Friday, May 22",
  "location": "Austin, TX",
  "time": "11:18am",
  "dayPhrase": "A day for sorting before visibility.",
  "currentPlanetaryHour": "Mercury",
  "moonSign": "Virgo",
  "moonPhase": "Waxing",
  "moonCondition": "Moon applying to Jupiter",
  "voidOfCourse": false,
  "localAngularity": "Mercury near the Midheaven at 11:42am",
  "tone": "clarify, write, sort, prepare to be seen"
}
```

Mock next windows:

```json
[
  {
    "time": "11:40am–12:25pm",
    "title": "Mercury near MC",
    "bestFor": ["recording", "writing", "teaching", "calls"],
    "caution": "Keep the message clear rather than trying to cover everything."
  },
  {
    "time": "1:10pm–2:05pm",
    "title": "Moon begins a void period",
    "bestFor": ["review", "cleanup", "rest", "loose ends"],
    "caution": "Not the cleanest window for major beginnings."
  },
  {
    "time": "4:20pm–5:15pm",
    "title": "Venus hour",
    "bestFor": ["design", "soft outreach", "relational repair"],
    "caution": "Better for softening than forcing a hard boundary."
  }
]
```

Use prototype tasks from `rules/auspice-seed-rules-v1.json`.

## UI Requirements

### Overall Feel

The app should feel:

- quiet
- spacious
- elegant
- celestial but practical
- soft but not vague
- more almanac than dashboard
- more ritual planner than productivity app

Use muted colors, generous spacing, rounded cards, subtle gradients, and clear hierarchy.

Avoid red error-like warnings. Cautions should feel gentle.

### App Shell

Include:

- app name: Auspice
- short tagline: “Move with time, instead of forcing yourself through it.”
- tab navigation
- main content area

## Screen 1: Today

The Today screen should include:

### 1. Header

Example:

```text
Friday, May 22
Austin, TX · 11:18am
A day for sorting before visibility.
```

### 2. Current Time Weather Card

Show:

- Mercury Hour
- Moon applying to Jupiter
- Moon in Virgo, waxing
- Mercury near the Midheaven soon
- short interpretation
- best-for chips
- gentle caution

Example copy:

```text
This is a good window for language, planning, study, and messages with a little more confidence behind them.

Best for: writing, email, study, outlining, teaching prep
Move gently around: overcommitting, making the task too big
```

### 3. What Now Card

Include a prominent button or section called:

```text
What now?
```

When clicked, show 2–4 recommendations from the mock task list and care/home options.

Example:

```text
Best fits right now:

1. Draft Venus in Cancer post
This fits the Mercury/Jupiter tone. Keep it to a rough outline or first section.

2. Send client follow-up email
Good for correspondence and clear, warm language.

3. Study acupuncture notes
This window supports sorting and retention, especially if you focus on one section.

4. Take a 20-minute walk
Use this as nervous system regulation, not a workout.

Gentler version:
Open the draft and make a 10-line note list.
```

This does not need a sophisticated scoring engine yet. A static or simple category-based match is fine.

### 4. Next Windows

Show the three mock next windows.

Each window card should include:

- time range
- timing factor title
- best-for chips
- caution

### 5. Today’s Task Matches

Group sample tasks into:

- Fits now
- Better later
- Good for low-traction time

Suggested grouping:

Fits now:

- Draft Venus in Cancer post
- Send client follow-up email
- Study acupuncture notes
- Ask for testimonial

Better later:

- Record reel
- Review website homepage

Good for low-traction time:

- Clean kitchen
- Go for walk / regulate nervous system

## Screen 2: Capture

This is a core screen, not a later add-on.

The Capture screen should include:

### 1. Main Dump Box

Prompt:

```text
What’s asking for attention?
```

Subcopy:

```text
Dump it here. You do not have to organize it yet.
```

Textarea placeholder:

```text
write Venus post
email client back
clean kitchen
study points
walk
ask for testimonial
schedule dentist
record reel if energy
```

### 2. Metadata Encouragement

Show optional chips users could attach to captured items:

Timeframe chips:

- now
- today
- this week
- next week
- someday / incubating
- deadline-bound

Energy chips:

- low energy
- deep focus
- creative
- social
- physical
- emotional
- logistical
- restorative

Context chips:

- home
- office
- out and about
- computer
- phone
- errands
- outside
- waiting on someone

Task-type chips:

- ask/request
- cleanup
- writing
- admin
- care
- movement
- publish

These can be visual chips only or simple selectable state.

### 3. Add to Unplaced

Button:

```text
Add to Unplaced
```

When clicked, parse each line into a preview list and show:

```text
Added to Unplaced
Auspice can sort these later by time, energy, context, and current sky.
```

### 4. Parsed Preview

Show captured items as cards with light inferred categories and source badges.

Example:

```text
write Venus post
Source: Manual · Inferred: Writing / creative · Mercury/Venus · this week?

ask for testimonial
Source: Notes paste · Inferred: Ask / Request / Pitch · Mercury/Venus/Jupiter · send message

clean kitchen
Source: Manual · Inferred: Home / Cleaning · Moon/Saturn/Mars · low-stakes cleanup
```

### 5. Sort Later Actions

Buttons can be mocked:

- Sort by timing
- Sort by energy
- Sort by context
- Move to this week
- Move to incubating

### 6. Future Sources Card

Include a small non-functional card:

```text
Sources coming later
Google Calendar · Notion · Notes · Reminders

Auspice will read from your existing systems instead of replacing them.
For now, paste or type anything here.
```

## Screen 3: Week

The Week screen should include:

### 1. Week Tone Card

Example:

```text
This week favors preparation before public action. Early week is better for sorting, drafting, and catching up. Midweek has stronger visibility and communication windows. The end of the week asks for simplification and recovery rather than another major push.
```

### 2. Best Uses / Use Care With

Best uses:

- Writing / drafting
- Website refinement
- Client follow-up
- Study consolidation
- Home maintenance

Use care with:

- Overcommitting
- High-stakes launches during void Moon windows
- Delicate relational texts during Mars-heavy periods

### 3. Seven-Day Rhythm Map

Create seven day cards.

Each day should show:

- day name
- tone
- best for
- avoid forcing
- strongest window

Example days:

```text
Monday
Mercury / Saturn tone
Best for: planning, admin, study, cleanup
Avoid forcing: social ease
Strong window: 9:30–11:00am writing/admin

Tuesday
Venus / Moon tone
Best for: client care, design, relationship, home
Avoid forcing: hard confrontation
Strong window: 2:00–3:30pm design/social outreach

Wednesday
Sun / Jupiter tone
Best for: recording, publishing, teaching, visibility
Avoid forcing: too much scope
Strong window: 10:45am–12:15pm content/launch prep
```

Add four more days in the same spirit.

### 4. Suggested Sessions

Show 3–5 session suggestions:

- Writing
- Admin / logistics
- Visibility
- Home / body
- Rest / integration

Each session should include:

- suggested window
- matching tasks
- why it fits
- gentler version
- optional mocked action: “Place on calendar”

The “Place on calendar” button does not need real integration yet; it can show a mock confirmation.

### 5. Not This Week

Include a distinct but gentle card:

```text
Not this week

These may matter, but they do not need to be active right now:

- Rebuild entire website
- Design full course outline
- Make final decision on long-term app architecture

Suggested posture:
Keep them incubating. Choose one small tending step only if there is real space.
```

This is a key philosophical feature.

## Screen 4: Tasks

The Tasks screen should include:

### 1. Capture Bar

Display:

```text
What’s asking for attention?
```

This can link visually to the Capture screen.

### 2. Source / Integration Awareness

Include a small card or filter row:

```text
Sources
Manual · Notes paste · Notion later · Calendar later
```

This is visual only for the prototype.

### 3. Task Sections

Group tasks into:

- Unplaced
- Active this week
- Incubating
- Waiting
- Released / not this week

Use sample tasks from seed rules plus any mock captured items.

### 4. Task Cards

Each task card should show:

- title
- source badge: Manual, Notes paste, Notion later, or Calendar later
- category display name
- planetary families
- energy types
- election level
- symbolic start type, if relevant
- context, if mocked
- timeframe, if mocked
- gentler version

Actions can be visual buttons only:

- Place this
- Ask when
- Make gentler
- Move to incubating
- Mock place on calendar

Buttons do not need full functionality yet, though simple state changes would be nice.

## Screen 5: Find a Time

This can be simple for now.

Include:

- category selector using event categories from seed rules
- date range selector with static options: Today, This week, Next week
- duration selector: 15 min, 30 min, 60 min, 90 min, 2 hr
- mock results for one selected category

Example result for Ask / Request / Pitch:

```text
Best windows for Ask / Request / Pitch

1. Tuesday 2:00–3:30pm — Good
Venus support helps warmth and receptivity. Good for testimonials, social asks, or soft outreach.

2. Wednesday 10:45am–12:15pm — Excellent
Mercury and Jupiter support clear language, confidence, and opportunity. Good for proposals, applications, and important emails.

3. Friday 9:15–10:15am — Workable
Clean practical window, but less symbolic support. Keep the request simple and specific.
```

Include a note:

```text
This does not need a perfect election. A supportive window is enough unless the stakes are truly high.
```

## Calendar / Notion / Notes Integration Direction for Later

Do not implement real integrations yet, but show where they belong.

The prototype may include non-functional or mocked buttons:

- Place on calendar
- Suggest calendar windows
- Add wellness block
- Protect recovery time
- Pull from Notion later
- Paste from Notes
- Keep as suggestion

Future integration modes:

1. Manual capture
2. Paste/import from notes
3. Google Calendar read-only awareness
4. Calendar write-back with explicit approval
5. Notion read from selected databases/pages
6. Notion write-back with explicit approval
7. Notes export/import or share-sheet support later
8. Other task systems later

Never imply the app will auto-fill the calendar or modify Notion without permission.

## Implementation Notes

### Suggested File Structure

Inside `/prototype`:

```text
package.json
index.html
src/
  main.tsx or main.jsx
  App.tsx or App.jsx
  styles.css
  data/
    seedRules.json
    mockTimeWeather.ts
    mockWeek.ts
    mockCapture.ts
  components/
    AppShell.tsx
    TimeWeatherCard.tsx
    WhatNowCard.tsx
    CaptureDumpView.tsx
    WindowCard.tsx
    TaskCard.tsx
    DayRhythmCard.tsx
    SuggestedSessionCard.tsx
    FindTimeView.tsx
```

Use fewer files if speed matters, but keep the code clear.

### Data / Logic

No real astrological computation required.

A simple helper can map current planetary hour to recommended task families:

- Mercury → writing/study, email, admin, ask/request/pitch
- Venus → design, social/relationship, client care
- Mars → movement, errands, boundaries
- Jupiter → launch/publish, teaching, requests to authority, business development
- Saturn → admin/logistics, cleaning, study discipline, maintenance
- Moon → rest, home, care, food, emotional processing
- Sun → visibility, content recording, leadership

A simple helper can parse capture text by line and infer rough categories using keywords.

Example keyword inference:

- write, draft, study → writing_study
- email, ask, testimonial, pitch → ask_request_pitch or client_call
- clean, kitchen, laundry → home_cleaning
- walk, workout, gym → exercise_movement or rest_recovery
- record, reel, post → content_recording
- schedule, dentist, bill → admin_logistics

Add mock `source` fields to tasks:

- manual
- notes_paste
- notion_later
- calendar_later

### Accessibility

Use readable contrast, semantic headings, and buttons. Do not rely only on glyphs/icons.

## Deliverable

A runnable static React prototype in `/prototype`.

Include a short `/prototype/README.md` update with:

- how to install
- how to run locally
- what is mocked
- what to build next

## Acceptance Criteria

The prototype is successful if:

- it runs locally
- Today / Capture / Week / Tasks / Find a Time are clickable
- Capture has a freeform dump box, metadata chips, parsed preview, and Unplaced concept
- Capture acknowledges future Notion, Notes, and Calendar sources without implementing them
- What Now reveals specific suggestions including tasks and care/home options
- Week view shows a clear rhythm map
- Tasks show category/timing/context/source metadata
- Find a Time exists at least as a simple mocked flow
- visual design feels spacious and calm
- copy avoids productivity pressure
- rest and “Not This Week” are treated as first-class
- calendar placement appears as a future/mocked pathway without real integration

## Do Not Build Yet

Do not implement:

- ephemeris calculations
- planetary hour calculations
- Moon calculations
- Google Calendar integration
- Notion integration
- Notes integration
- auth
- persistence
- payments
- subscriptions
- backend

## Final Note

Favor a working, elegant, static prototype over a complex unfinished architecture. The first goal is to prove the feeling of Auspice: capture what is asking for attention, understand the quality of time, and choose a fitting next step without pressure.
