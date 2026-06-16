# Codex Handoff — Auspice Static Prototype

## Assignment

Build the first static clickable prototype for **Auspice** in the `/prototype` folder.

Start from GitHub Issue #1:

- https://github.com/charliecro-blip/auspice/issues/1

Use `docs/codex-build-brief.md` as the primary source of truth.

## Project Summary

Auspice is a rhythm-aware astrological planning assistant.

It helps users:

- understand the quality of the current time
- dump everything asking for attention
- sort tasks by time, energy, context, and astrological fit
- ask “what should I do now?”
- see a week-ahead rhythm map
- eventually place tasks/sessions onto a calendar with explicit approval

Core product question:

> Given the quality of time and the shape of my life, what belongs here?

Core phrase:

> Move with time, instead of forcing yourself through it.

## What Auspice Is Not

Auspice is not a productivity optimizer.

Do not make it feel like:

- Asana
- Todoist
- Motion
- Reclaim
- a hustle dashboard
- a productivity scoring app

The product should not pressure the user to do more, fill every open slot, or imply that every task needs perfect electional timing.

It should feel like a living almanac, not a task grinder.

## What To Build Now

Build a frontend-only static React prototype inside `/prototype`.

Use mock data. Do not build real astrology calculations or integrations yet.

The prototype should include five tabs:

1. Today
2. Capture
3. Week
4. Tasks
5. Find a Time

## Required Source Files

Read these before building:

- `docs/codex-build-brief.md`
- `docs/product-spec.md`
- `docs/ui-wireframe-spec.md`
- `docs/capture-dump-feature-spec.md`
- `docs/integrations-strategy.md`
- `rules/auspice-seed-rules-v1.json`

The seed rules JSON is the canonical implementation reference for:

- product language
- planetary families
- task/event categories
- election levels
- symbolic start types
- Moon condition meanings
- planetary hour meanings
- sample prototype tasks

## Tech Stack

Use:

- React
- Vite
- TypeScript if easy, otherwise JavaScript is acceptable
- Plain CSS, CSS modules, or Tailwind if preferred

Do not add:

- backend
- auth
- database
- ephemeris library
- real Google Calendar integration
- real Notion integration
- real Notes integration
- payment/subscription logic

## Design Feel

The app should feel:

- calm
- spacious
- elegant
- celestial but practical
- soft but not vague
- more almanac than dashboard
- more ritual planner than productivity app

Use:

- generous spacing
- rounded cards
- muted colors
- soft gradients
- clear hierarchy
- gentle caution language

Avoid:

- red warning language
- harsh productivity framing
- dense dashboards
- streaks/scores
- fear-based astrology language

## Screen Requirements

### 1. Today

The Today screen should orient the user to the current moment.

Include:

- date/location/time header
- current time weather card
- planetary hour
- Moon condition
- local angularity highlight
- best-for chips
- gentle caution
- What Now card
- Next Windows
- Today’s Task Matches

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

The What Now card should reveal 2–4 suggestions, including at least one care/home/body option.

Example:

- Draft Venus in Cancer post
- Send client follow-up email
- Study acupuncture notes
- Take a 20-minute walk as nervous system regulation

Always include a gentler version.

### 2. Capture

This is a core screen.

The Capture screen should let users dump everything asking for attention without organizing it immediately.

Include:

- freeform textarea
- prompt: “What’s asking for attention?”
- subcopy: “Dump it here. You do not have to organize it yet.”
- optional metadata chips
- Add to Unplaced button
- parsed preview cards
- mocked Sort Later actions
- future sources card

Example placeholder:

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

Metadata chips should include examples like:

- today
- this week
- low energy
- deep focus
- home
- computer
- out and about
- ask/request
- cleanup
- writing
- movement
- admin

When the user clicks Add to Unplaced, parse each line into preview items and infer rough categories.

Simple keyword inference is enough:

- write, draft, study → Writing / Study
- email, ask, testimonial, pitch → Ask / Request / Pitch or Client Call
- clean, kitchen, laundry → Home / Cleaning
- walk, workout, gym → Movement or Rest / Recovery
- record, reel, post → Content Recording
- schedule, dentist, bill → Admin / Logistics

Include a small future sources card:

```text
Sources coming later
Google Calendar · Notion · Notes · Reminders

Auspice will read from your existing systems instead of replacing them.
For now, paste or type anything here.
```

### 3. Week

The Week screen should show a week-ahead rhythm map.

Include:

- week tone card
- best uses / use care with
- seven-day rhythm map
- suggested sessions
- Not This Week card

The Not This Week card is important. It should communicate that some tasks matter but do not need to be active now.

Include mocked “Place on calendar” buttons for suggested sessions, but do not integrate a real calendar.

### 4. Tasks

The Tasks screen should show tasks grouped by state.

Include:

- Unplaced
- Active this week
- Incubating
- Waiting
- Released / not this week

Task cards should show:

- title
- source badge: Manual, Notes paste, Notion later, Calendar later
- category
- planetary families
- energy/context metadata
- election level
- symbolic start type if relevant
- gentler version

Actions can be mocked:

- Place this
- Ask when
- Make gentler
- Move to incubating
- Place on calendar

### 5. Find a Time

This can be simple and mocked.

Include:

- event category selector
- date range selector
- duration selector
- mocked results

Include Ask / Request / Pitch as a category.

Example result:

```text
Best windows for Ask / Request / Pitch

1. Tuesday 2:00–3:30pm — Good
Venus support helps warmth and receptivity. Good for testimonials, social asks, or soft outreach.

2. Wednesday 10:45am–12:15pm — Excellent
Mercury and Jupiter support clear language, confidence, and opportunity. Good for proposals, applications, and important emails.

3. Friday 9:15–10:15am — Workable
Clean practical window, but less symbolic support. Keep the request simple and specific.
```

Include this note:

> This does not need a perfect election. A supportive window is enough unless the stakes are truly high.

## Integration Positioning

Do not build real integrations yet.

But visually acknowledge future sources:

- Google Calendar
- Notion
- Notes
- Reminders

Auspice should eventually run alongside these systems, not replace them.

Core integration principle:

> Auspice should be a timing intelligence layer, not another silo.

Include mock source badges and mock calendar actions, but do not implement OAuth or external APIs.

## Suggested File Structure

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

Use fewer files if speed matters, but keep the code readable.

## Acceptance Criteria

The prototype is successful if:

- it runs locally
- Today / Capture / Week / Tasks / Find a Time are clickable
- Capture has a freeform dump box, metadata chips, parsed preview, and Unplaced concept
- Capture acknowledges future Notion, Notes, and Calendar sources without implementing them
- What Now reveals specific suggestions including tasks and care/home options
- Week view shows a clear rhythm map
- Tasks show category/timing/context/source metadata
- Find a Time has mocked results
- visual design feels spacious and calm
- copy avoids productivity pressure
- rest and “Not This Week” are treated as first-class
- calendar placement appears as a future/mocked pathway without real integration

## Do Not Build Yet

Do not implement:

- real ephemeris calculations
- real planetary hour calculations
- real Moon calculations
- Google Calendar integration
- Notion integration
- Notes integration
- auth
- persistence
- payments
- subscriptions
- backend

## Final Instruction

Favor a working, elegant, static prototype over a complex unfinished architecture.

The goal of this phase is not to prove the astrology engine. The goal is to prove the feeling:

> I can dump what is asking for attention, understand the quality of time, and choose a fitting next step without pressure.
