# Auspice Product Spec

## Working Name

**Auspice**

## Core Idea

Auspice is a personal time-alignment app that helps users organize tasks, projects, calendar events, creative work, study, rest, and social obligations according to astrological timing and personal rhythm.

It combines:

- personal transits
- Moon sign, phase, aspects, and void-of-course periods
- planetary hours
- daily planetary aspects and placements
- local angularity, such as planets rising, culminating, setting, or anti-culminating in the user's current location
- calendar commitments
- manual tasks
- active projects and life areas
- light electional astrology principles

It is not meant to optimize every minute or cram more into the day. Its purpose is to offer loose, intelligent frameworks for living in time.

## Core Questions

- What kind of time is this?
- What is this moment good for?
- What should I do now?
- Where does this task belong?
- When would this event have the most support?
- What should I protect, delay, or approach gently?

## Product Positioning

Auspice sits between astrology software, calendar tools, project planning, and personal rhythm systems.

It is closer to:

- a daily astrological weather system
- a personal timing oracle
- a soft scheduling assistant
- a practical electional astrology tool
- a calendar-aware rhythm guide
- a gentle project planner
- a week-ahead visualization tool
- a living almanac for goals, tasks, and timing

## Emotional Promise

> Move with time, instead of forcing yourself through it.

## Brand Language

- Plan by rhythm, not pressure.
- Find the right hour for the right kind of effort.
- A personal almanac for your days, weeks, and projects.
- Not productivity. Rhythm.
- Auspice helps you see what kind of time you are in, and what belongs there.

## Primary User

Astrologers, spiritual practitioners, creatives, students, freelancers, and self-employed people who want to organize life around rhythm rather than pure productivity.

They may use Google Calendar, Notion, Apple Notes, astrology apps, Moon calendars, and task apps, but these tools remain fragmented.

## Core Use Cases

### What Now?

The user opens the app and asks:

> What should I do now?

Auspice looks at the current time quality, user tasks, energy/capacity, and eventually calendar commitments. It suggests a few fitting options, plus a gentler version.

### Today View

The user gets a daily dashboard showing:

- current planetary hour
- Moon condition
- void-of-course status
- local angularity highlight
- current tone
- best task families
- caution task families
- next useful windows

### Week-Ahead Rhythm Planner

The user asks:

> How should I move through this week?

Auspice generates a week map for writing, admin, visibility, relationship, body/home, study, rest, and project sessions.

### Task-to-Time Matching

Tasks are classified by planetary family, energy type, mode, stakes, and election level. Auspice suggests moments where tasks fit rather than auto-filling the calendar.

### Find a Time

The user asks for a supportive time to begin or schedule something, such as a client reading, launch, important email, ask/pitch, or travel departure.

## MVP Must-Haves

- Today screen
- What Now assistant card
- Week screen
- Manual task list
- Static/mock astrology data
- Seed rules from `rules/auspice-seed-rules-v1.json`

## MVP Nice-to-Haves

- Basic Find a Time flow with static/mock windows
- Project/life area cards
- Not This Week section

## Later

- real ephemeris calculations
- planetary hour calculation
- Moon sign/aspects/VOC calculation
- local angularity calculation
- basic personal transits
- Google Calendar read-only integration
- Notion integration
- calendar write-back
- advanced electional chart ranking
- tertiary progressions
- source-backed explanation views

## Product Guardrails

Auspice should not:

- fill every empty calendar space
- tell the user they are behind
- score productivity harshly
- treat rest as failure
- make astrology sound deterministic
- create fear around imperfect timing
- make users feel they need to elect every small task

Auspice should:

- suggest rather than command
- orient rather than optimize
- protect empty space
- normalize rest and incompletion
- offer gentler versions
- rank best-available windows rather than chase perfection

## MVP Definition

The first prototype succeeds if it answers three questions beautifully:

1. What kind of time is this?
2. What should I do now?
3. How should I move through this week?
