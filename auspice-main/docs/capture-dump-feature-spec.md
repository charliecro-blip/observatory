# Capture Dump Feature Spec

## Purpose

The Capture Dump is a core Auspice feature.

It gives users a low-friction place to pour out everything asking for attention without needing to organize it immediately.

This is the bridge between:

- GTD-style capture
- calendar planning
- astrological task-to-time matching
- the What Now assistant
- week-ahead rhythm planning

The user should be able to dump tasks, worries, intentions, wellness needs, errands, social obligations, creative ideas, home tasks, admin tasks, and project fragments into one place.

Auspice can later sort those items into fitting moments.

## Core User Need

Users often do not know what to do next because everything is half-held in the mind.

Auspice should help users externalize that pressure without immediately turning it into a rigid schedule.

Core prompt:

> What’s asking for attention?

Secondary prompt:

> Dump it here. You can sort it later.

## Product Philosophy

Capture should feel relieving, not like data entry.

The user should not need to fully classify every item at capture time.

But Auspice should gently encourage useful metadata when available:

- timeframe
- deadline
- energy requirement
- context
- estimated duration
- emotional charge
- project or life area
- whether it is a beginning, continuation, completion, or maintenance task
- whether it needs a specific kind of time

## Capture Modes

### 1. Quick Dump

A freeform text box.

User can type one item or paste a messy list.

Example:

```text
write Venus post
email client back
clean kitchen
study points
walk
ask Sarah for testimonial
figure out Auspice repo
schedule dentist
maybe record reel if energy
```

Auspice parses each line as a possible item and places it in Unplaced.

### 2. Guided Capture

After capture, Auspice asks optional clarifying questions.

Do not ask too many at once.

Possible prompts:

- When does this matter by?
- How much energy does this need?
- Where could this happen?
- Is this a beginning, continuation, cleanup, or decision?
- Is this fixed, flexible, or someday?
- Does this belong this week?

### 3. Voice / Messy Thought Capture Later

Future feature.

The user speaks a messy list and Auspice extracts tasks, projects, waiting items, and care needs.

## Task Metadata

### Required

- title
- status

Default status:

```text
unplaced
```

### Strongly Encouraged

- life area / project
- timeframe
- duration estimate
- energy requirement
- context
- task mode

### Optional

- deadline
- emotional charge
- stakes
- election level
- symbolic start type
- planetary family
- preferred time of day
- avoidance/resistance level
- recurrence
- calendar write preference

## Suggested Metadata Fields

```json
{
  "title": "Ask Sarah for testimonial",
  "status": "unplaced",
  "lifeArea": "business",
  "project": "website testimonials",
  "timeframe": "this week",
  "deadline": null,
  "durationMinutes": 15,
  "energyRequirement": "medium",
  "context": "computer",
  "locationContext": "home_or_office",
  "mode": "send_message",
  "eventCategory": "ask_request_pitch",
  "planetaryFamilies": ["mercury", "venus", "jupiter"],
  "electionLevel": 2,
  "symbolicStartType": "send_message",
  "emotionalCharge": "slightly_avoidant",
  "stakes": "medium",
  "calendarBehavior": "suggest_only"
}
```

## Timeframe Options

- now
- today
- this week
- next week
- this month
- someday / incubating
- deadline-bound
- recurring
- fixed date/time

## Energy Requirement Options

- very low
- low
- medium
- high
- deep focus
- social
- physical
- emotional
- creative
- logistical
- restorative

## Context Options

GTD-inspired, but translated into Auspice language.

### Physical / Location Contexts

- home
- office
- out and about
- car / transit
- clinic / school
- computer
- phone
- errands
- body / movement
- outside

### Cognitive / Energy Contexts

- deep focus
- light admin
- communication
- creative
- relational
- physical
- emotional
- recovery
- low-energy

### Social Contexts

- alone
- with client
- with friend/partner
- requires another person
- waiting on someone

## Capture Sorting States

- unplaced
- clarified
- active this week
- placed
- scheduled
- incubating
- waiting
- recurring rhythm
- released / not this week
- complete

## Calendar Integration Behaviors

Auspice should eventually support several levels of calendar integration.

### 1. Read-only calendar awareness

Auspice reads existing events and avoids suggesting unavailable windows.

Use cases:

- detect open blocks
- detect fragmented days
- detect overpacked days
- suggest lighter tasks on dense days
- protect rest around existing obligations

### 2. Suggest-to-calendar

Auspice suggests where tasks could go, but the user manually approves.

Use cases:

- “Place this writing session.”
- “Find 3 good windows this week.”
- “Schedule this if it fits.”

### 3. Calendar write-back

Auspice can add events to Google Calendar with explicit approval.

Use cases:

- schedule a writing session
- add admin block
- add workout
- add rest/protection window
- add launch/publish time
- add small wellness action

### 4. Rhythmic calendar population

Auspice can suggest or populate small recurring rituals, care blocks, or wellness tasks.

Examples:

- 20-minute walk during Mars/Sun-supportive windows
- cleanup during VOC Moon or Saturn/Moon windows
- writing block during Mercury hour
- relationship outreach during Venus/Jupiter windows
- nervous system reset after high-density calendar days
- weekly review during Saturn/Moon or waning Moon periods

This should always be permission-based.

Never auto-fill a calendar without explicit approval.

## What Now Assistant

The What Now assistant should scan:

- current planetary hour
- current Moon condition
- current local angularity
- current personal transit highlight eventually
- user’s open time
- user’s task list
- task contexts
- energy requirements
- user’s current energy/capacity
- deadlines
- whether the item is active this week or merely unplaced

It then gives 2–4 recommendations.

## What Now Recommendation Types

### Task recommendation

Example:

> Draft the Venus in Cancer opening. This fits the Mercury/Jupiter tone and only needs a rough first pass.

### Care recommendation

Example:

> Take a 20-minute walk. The current Mars/Sun tone is good for moving energy through the body.

### Home/container recommendation

Example:

> Reset the kitchen for 15 minutes. This is a low-stakes task that fits a cleanup window.

### Relationship recommendation

Example:

> Send the simple client follow-up. The current Mercury/Venus support is good for clear, warm communication.

### Preparation instead of action

Example:

> Draft the ask, but wait to send it. The current window helps you clarify, but a softer Venus/Jupiter window may be better for reception.

### Do nothing / rest recommendation

Example:

> Nothing needs to be forced right now. This is a better window for integration, food, rest, or clearing one small loose end.

## Specificity Goals

The more specific the suggestion, the better.

Weak:

> Do some writing.

Better:

> Open the Venus in Cancer draft and write 10 rough lines about sentimental objects.

Weak:

> Exercise.

Better:

> Take a 20-minute walk outside before the next calendar block. Treat it as nervous system regulation, not a workout.

Weak:

> Clean.

Better:

> Do one kitchen reset: dishes, trash, and counters. Stop after 15 minutes.

Weak:

> Work on website.

Better:

> Review only the homepage hero and testimonial placement. Do not redesign the whole site.

## Sorting Logic

Auspice should avoid binary task sorting.

Instead, each task can be matched to several possible windows:

- best fit
- good enough
- preparation window
- cleanup/review window
- avoid if possible

Example:

Task:

```text
Ask Sarah for testimonial
```

Matches:

- Mercury hour: good for drafting the ask
- Venus/Jupiter support: good for sending
- Moon VOC: okay for drafting, not ideal for sending
- Saturn hour: good for deciding the request structure, less good for warmth

## Calendar Population Examples

### Writing

Auspice suggests:

```text
Tuesday 9:00–10:30am
Mercury hour + Moon applying Jupiter
Use for: Venus in Cancer draft
Calendar title: Writing — Venus in Cancer draft
```

### Wellness

Auspice suggests:

```text
Friday 4:30–5:00pm
Mars/Sun movement window after dense calendar day
Calendar title: Walk / regulate nervous system
```

### Cleaning

Auspice suggests:

```text
Void Moon window
Use for: kitchen reset, laundry, inbox clearing
Calendar title: Low-stakes cleanup
```

### Relationship

Auspice suggests:

```text
Venus hour
Use for: warm client follow-up or testimonial ask
Calendar title: Soft outreach
```

## Prototype Requirements

The static prototype should include a simple version of Capture Dump.

### Add to navigation

Rename or adjust navigation to:

1. Today
2. Capture
3. Week
4. Tasks
5. Find a Time

### Capture Screen MVP

Include:

- freeform dump box
- example placeholder list
- optional metadata chips
- button: “Add to Unplaced”
- parsed preview list
- gentle classification examples

### Example placeholder

```text
Dump everything asking for attention...

write Venus post
email client back
clean kitchen
study points
walk
ask for testimonial
schedule dentist
record reel if energy
```

### Metadata chips

- today
- this week
- low energy
- deep focus
- home
- computer
- out and about
- emotional
- physical
- waiting on someone
- ask/request
- cleanup

### After capture

Show:

```text
Added to Unplaced

Auspice can sort these later by time, energy, context, and current sky.
```

### Sort Later Actions

- Sort by timing
- Sort by energy
- Sort by context
- Move to this week
- Move to incubating

These actions can be mocked.

## Future Integrations

### Google Calendar

- read events
- identify availability
- detect density
- suggest windows
- write events with permission

### Notion

- pull tasks/projects from selected databases
- push placed sessions back to Notion later if needed

### Notes / Apple Notes / Plain Text

- import pasted notes
- parse messy lists
- extract tasks and projects

### Reminders / Todoist / Things / Linear Later

Possible later integrations depending on user base.

## Key UX Copy

Capture prompt:

> Dump it here. You do not have to organize it yet.

Clarification prompt:

> Do you know when this matters, where it can happen, or what kind of energy it needs?

Sort later prompt:

> These are unplaced. Auspice can help find their right moments when you are ready.

What Now prompt:

> Based on the current sky, your open time, and what is asking for attention, these are the best fits now.

Calendar prompt:

> Want Auspice to place this on your calendar, or just suggest a window?

Guardrail prompt:

> This does not need a perfect election. A supportive window is enough.

## Summary

The Capture Dump makes Auspice practical.

Without it, Auspice is only a timing dashboard.

With it, Auspice becomes a living system:

1. dump what is asking for attention
2. clarify lightly
3. sort by time, energy, context, and astrology
4. ask “what now?”
5. place important sessions on the calendar when needed
6. protect rest and incubation as real choices
