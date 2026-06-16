# Auspice UI Wireframe Spec

## Purpose

This spec turns Auspice into a first product interface.

The first prototype should answer:

1. What kind of time is this?
2. What should I do now?
3. How should I move through this week?

The UI should feel like a living almanac, not a productivity dashboard.

## Design Principles

### Spacious, not dense

Each screen should have one primary answer, a few supporting details, and optional drill-down.

### Suggestive, not commanding

Prefer language like:

- This window supports...
- A good use of this time might be...
- Consider...
- This may be better for...
- A lighter version...

Avoid productivity imperatives.

### Rhythm over slots

Open time does not mean available capacity. The interface should show time as qualitative rhythm, not merely empty blocks to fill.

### Astrology visible, but not overwhelming

Beginner view should show interpreted meaning first. Advanced details can be expandable.

### Rest is first-class

Rest, home, body, incubation, and cleanup should appear as valid recommendations.

## Primary Navigation

1. Today
2. Week
3. Tasks
4. Projects
5. Find a Time

MVP priority:

1. Today
2. Week
3. Tasks

## Screen: Today

### Header

Example:

```text
Friday, May 22
Austin, TX · 11:18am
A day for sorting before visibility.
```

### Current Time Weather Card

Fields:

- current planetary hour
- Moon condition
- dominant tone
- one-sentence interpretation
- best uses
- caution

Example:

```text
Current Time
Mercury Hour · Moon applying to Jupiter

This is a good window for language, planning, study, and messages with a little more confidence behind them.

Best for: writing, email, study, outlining, teaching prep
Move gently around: overcommitting, making the task too big
```

### What Now Card

CTA:

> What now?

Expanded example:

```text
Best fits right now:

1. Draft the Venus in Cancer opening
   This fits the Mercury/Jupiter tone. Keep it to 30–45 minutes.

2. Send the simple client follow-up
   Good for correspondence, especially if you keep it clear and warm.

3. Study one acupuncture section
   The window supports focused sorting, not total mastery.

Gentler version:
Open the draft and make a 10-line note list.
```

### Next Windows Card

Example:

```text
Coming up

11:40am–12:25pm · Mercury near MC
Good for recording, writing, teaching, calls.

1:10pm–2:05pm · Moon begins void period
Better for review, cleanup, rest, loose ends.

4:20pm–5:15pm · Venus hour
Better for design, soft outreach, relational repair.
```

### Today’s Task Matches

Group tasks by:

- Fits now
- Better later
- Good for cleanup/rest windows

Example:

```text
Fits now
- Draft Venus in Cancer post
- Send client follow-up
- Study acupuncture notes

Better later
- Record reel — stronger around Mercury/MC window
- Relationship text — wait for Venus hour if possible

Good for low-traction time
- Clean kitchen
- Review website notes
```

### Daily Rhythm Summary

Example:

```text
Today’s rhythm
Morning: write / sort / study
Midday: visibility or communication
Afternoon: cleanup / review / low-stakes tasks
Evening: Venusian softening / rest / connection
```

## Screen: Week

### Header

```text
Week of May 25–31
A week for preparation, visibility, and careful pacing.
```

### Week Tone Card

Keep under 100 words.

Example:

```text
This week favors preparation before public action. Early week is better for sorting, drafting, and catching up. Midweek has stronger visibility and communication windows. The end of the week asks for simplification and recovery rather than another major push.
```

### Best Uses of the Week

Example:

```text
Best uses
- Writing / drafting
- Website refinement
- Client follow-up
- Study consolidation
- Home maintenance

Use care with
- Overcommitting
- High-stakes launches during void Moon windows
- Delicate relational texts during Mars-heavy periods
```

### Weekly Rhythm Map

A seven-day layout. Each day includes:

- day tone
- best task families
- caution
- strongest window
- rest/protection note

Example:

```text
Monday
Mercury / Saturn tone
Best for: planning, admin, study, cleanup
Avoid forcing: social ease
Strong window: 9:30–11:00am writing/admin
```

### Suggested Sessions

Example:

```text
Writing
Tuesday 9:00–10:30am or Wednesday 8:30–10:00am
Use for: Substack draft, script outlines

Admin / logistics
Monday 2:00–3:00pm
Use for: invoices, scheduling, homepage review

Visibility
Wednesday 11:00am–12:00pm
Use for: reel recording, publishing, outreach
```

### Not This Week

Example:

```text
These may matter, but they do not need to be active right now:

- Rebuild entire website
- Design full course outline
- Make final decision on long-term app architecture

Suggested posture:
Keep them incubating. Choose one small tending step only if there is real space.
```

## Screen: Tasks

### Capture Bar

```text
What’s asking for attention?
[ Add task... ]
```

### Task Sections

- Unplaced
- Active this week
- Placed
- Incubating
- Waiting
- Complete
- Released

### Task Card Example

```text
Draft Venus in Cancer post
Creative · Mercury/Venus/Moon · 45–90 min
Status: Active this week
Best time: Mercury hour, Venus support, Moon not too heavy
Gentler version: Write 10 rough lines
```

Actions:

- Place this
- Ask when
- Make gentler
- Move to incubating
- Mark complete

## Screen: Projects

Projects are active arcs, not productivity buckets.

Project states:

- Active
- Needs tending
- Waiting
- Incubating
- Dormant
- Complete

Example card:

```text
Auspice Prototype
Status: Active
Needs: one design/build session
Best rhythm: Mercury/Saturn for architecture, Jupiter/Sun for vision
This week: create wireframe + seed rule data
Next tending: make Today screen prototype
```

## Screen: Find a Time

MVP flow:

1. What are you scheduling?
2. Date range
3. Duration
4. Constraints
5. Results

Initial categories:

- Writing / study
- Client call / reading
- Launch / publish
- Social / relationship
- Admin / logistics
- Rest / recovery
- Difficult conversation
- Ask / request / pitch
- Travel / departure
- Exercise / movement
- Home / cleaning

Example result:

```text
Best windows for client reading

1. Wednesday 10:40–11:50am — Excellent
Mercury hour, Moon applying Jupiter, Mercury near MC. Strong for interpretation, teaching, and conversation.

2. Thursday 2:00–3:00pm — Good
Venus support helps rapport, though the Moon is closer to a low-traction period. Better for an existing client than a first session.

3. Friday 9:15–10:15am — Workable
Clean calendar fit, but less astrological support. Keep it simple and grounded.
```

## Component Library

### Time Weather Card

Props:

- title
- planet/hour
- Moon condition
- tone
- best uses
- cautions
- advanced details

### Task Match Card

Props:

- task title
- category
- planetary family
- recommended time
- why it fits
- gentler version
- action buttons

### Window Card

Props:

- start/end time
- timing factor
- supported task families
- caution
- confidence label

### Day Rhythm Card

Props:

- day
- overall tone
- best uses
- caution
- strongest window
- rest/protection note

### Project Arc Card

Props:

- project name
- status
- active need
- next tending
- best rhythm
- suggested session

## Visual Direction

Auspice should feel:

- quiet
- spacious
- intelligent
- celestial but practical
- soft but not vague
- more almanac than dashboard
- more ritual planner than productivity app

Avoid:

- hustle dashboards
- red warning overload
- gamified productivity streaks
- dense astrological chart wheels as the main interface
- too many tabs/cards on the first screen
