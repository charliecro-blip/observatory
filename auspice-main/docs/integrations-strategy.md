# Auspice Integrations Strategy

## Purpose

Auspice should not try to replace every task manager, notes app, calendar, or project system.

Many users already have a home base:

- Notion
- Apple Notes
- Google Calendar
- Apple Calendar
- Google Tasks
- Apple Reminders
- Todoist
- Things
- Obsidian
- plain text notes
- school/work systems

Auspice should run alongside these systems seamlessly.

Its job is not to become the only organizing system. Its job is to add a timing, rhythm, and astrological placement layer on top of what users already use.

Core principle:

> Auspice should be a timing intelligence layer, not another silo.

## Integration Philosophy

### Do not force migration

Users should not have to move their entire life into Auspice.

Auspice should be able to:

- read from existing systems
- interpret tasks and projects
- suggest timing
- write back only when explicitly approved
- preserve source-of-truth relationships

### Keep source of truth clear

For every imported item, Auspice should know:

- where it came from
- whether Auspice owns it
- whether Auspice can edit it
- whether Auspice should only suggest around it

Example source ownership:

```json
{
  "source": "notion",
  "sourceId": "notion-page-id",
  "sourceUrl": "...",
  "syncMode": "read_only",
  "auspiceStatus": "active_this_week"
}
```

### Suggest first, write later

Default behavior should be read + suggest.

Write-back should always be explicit.

Examples:

- “Add this session to Google Calendar?”
- “Update this Notion task with suggested window?”
- “Create a reminder?”
- “Leave this as a suggestion only?”

### Avoid duplicate-task chaos

If Auspice imports an item from Notion or Notes, it should not create a duplicate task unless the user chooses to.

Instead, it should create an Auspice overlay:

- timing metadata
- energy requirement
- suggested window
- election level
- planetary family
- status within Auspice

The original item stays in its original system.

## Integration Layers

### Layer 1: Manual Capture

This is v0.

Users manually dump tasks into Auspice.

No external integration required.

### Layer 2: Paste / Import from Notes

Users paste messy notes or task lists into Capture.

Auspice parses:

- tasks
- projects
- waiting items
- care needs
- possible deadlines
- contexts
- energy requirements

This supports Apple Notes, Obsidian, Google Docs, texts, emails, and plain text without needing official integrations.

### Layer 3: Calendar Read-Only

Auspice reads calendars to understand availability.

Supported first:

- Google Calendar

Later:

- Apple Calendar / iCal feed if feasible
- Outlook Calendar if user base needs it

Read-only features:

- detect open blocks
- detect fragmented days
- detect overpacked days
- avoid suggesting unavailable windows
- recommend care/rest around dense schedule days
- find windows for tasks

### Layer 4: Calendar Write-Back

With explicit approval, Auspice can create events.

Examples:

- Writing — Venus in Cancer draft
- Soft outreach — testimonial ask
- Walk / regulate nervous system
- Low-stakes cleanup
- Weekly rhythm review
- Launch window

Calendar write-back should support:

- title
- start/end time
- description with why the timing fits
- source task reference
- optional reminders
- optional calendar selection

Never auto-populate without permission.

### Layer 5: Notion Read

Auspice reads selected Notion databases/pages.

Possible Notion inputs:

- task database
- project database
- content calendar
- reading notes
- personal dashboard
- school tasks
- business tasks
- CRM/client follow-ups

Auspice should allow users to map Notion properties:

- Name / title
- Status
- Due date
- Project
- Area
- Priority
- Context
- Energy
- Estimated time
- Notes

If properties do not exist, Auspice can infer from title/body.

### Layer 6: Notion Write-Back

Optional later.

Possible write-back actions:

- add suggested window property
- add energy/context classification
- update status
- add Auspice note/comment
- create planning session page
- link to calendar event

This should be explicit and reversible.

### Layer 7: Native Notes / Apple Notes Strategy

Apple Notes is difficult because it may not expose a clean public API for direct third-party integration.

Instead, early support should focus on:

- paste from Notes
- share sheet later if mobile app exists
- import plain text
- parse screenshots only if necessary later
- export Auspice plan to text/Markdown that can be pasted back into Notes

Notes-oriented users may prefer:

- daily plan as Markdown
- week-ahead rhythm map as Markdown
- capture summary
- task grouping
- suggested calendar blocks

### Layer 8: Other Task Systems Later

Potential later integrations:

- Todoist
- Things
- Apple Reminders
- Google Tasks
- Linear
- Trello
- Asana

Do not build these early.

Build the abstraction first so new systems can plug in later.

## Unified Task Object

Auspice should normalize external items into a unified internal task object.

```json
{
  "id": "auspice-generated-id",
  "source": "manual | notion | notes_paste | google_calendar | reminders | todoist",
  "sourceId": "external-id-if-any",
  "sourceUrl": "external-url-if-any",
  "syncMode": "owned | read_only | write_back_allowed | suggestion_only",
  "title": "Ask Sarah for testimonial",
  "rawText": "Ask Sarah for testimonial this week maybe during a Venus hour",
  "status": "unplaced",
  "sourceStatus": "Not started",
  "lifeArea": "business",
  "project": "website testimonials",
  "timeframe": "this week",
  "deadline": null,
  "durationMinutes": 15,
  "energyRequirement": "medium",
  "contexts": ["computer", "phone", "social"],
  "locationContext": "home_or_office",
  "mode": "send_message",
  "eventCategory": "ask_request_pitch",
  "planetaryFamilies": ["mercury", "venus", "jupiter"],
  "electionLevel": 2,
  "symbolicStartType": "send_message",
  "emotionalCharge": "slightly_avoidant",
  "stakes": "medium",
  "calendarBehavior": "suggest_only",
  "suggestedWindows": [],
  "notes": "Imported from Notion task database"
}
```

## Unified Calendar Event Object

```json
{
  "id": "auspice-event-id",
  "source": "google_calendar | apple_calendar | manual",
  "sourceId": "external-id-if-any",
  "title": "Client Reading",
  "start": "2026-05-22T14:00:00-05:00",
  "end": "2026-05-22T15:00:00-05:00",
  "calendarName": "Work",
  "busy": true,
  "eventType": "existing_commitment | auspice_suggested_session | wellness_block | rhythm_review",
  "relatedTaskIds": [],
  "astrologicalRationale": null
}
```

## Integration UX

### Sources Screen Later

A future settings/source screen should show:

```text
Connected Sources

Google Calendar — connected
Notion — not connected
Notes — paste/import only
Apple Calendar — planned
Todoist — planned
```

Each source should have controls:

- connect
- disconnect
- read-only / write-back permissions
- selected databases/calendars
- sync frequency
- import now

### Capture Screen Integration Entry Points

Capture should support:

- paste from notes
- import from Notion later
- import from calendar later
- add manually

### Task Card Source Badge

Task cards should show source badges:

- Manual
- Notion
- Notes paste
- Calendar

Example:

```text
Ask Sarah for testimonial
Source: Notion · Status: Active this week
Auspice: Ask / Request / Pitch · Mercury/Venus/Jupiter
```

### Calendar Placement UX

When a user chooses “Place on calendar,” Auspice should show:

```text
Suggested calendar block
Wednesday 10:45–11:15am
Mercury/Jupiter support for clear, generous outreach.

Title: Soft outreach — testimonial ask
Calendar: Work

[Add to Calendar] [Keep as suggestion]
```

## What Now with Integrations

Eventually, What Now should scan:

- current sky
- planetary hour
- Moon condition
- local angularity
- personal transit highlight
- open calendar availability
- imported Notion tasks
- pasted Notes tasks
- manual Auspice tasks
- deadlines
- contexts
- current location/context
- current energy/capacity

Then it suggests:

- task options
- care options
- home/container tasks
- movement
- rest
- preparation instead of sending/launching
- “nothing needs to be forced” when appropriate

## Sync Strategy

### Initial prototype

No real sync.

Show source badges and mocked integration states only.

### First real integration

Google Calendar read-only.

Reason:

- availability is necessary for What Now and Week Ahead
- calendar density is critical to avoid over-scheduling

### Second real integration

Google Calendar write-back with explicit approval.

Reason:

- lets Auspice become actionable
- supports placing sessions and wellness blocks

### Third real integration

Notion read.

Reason:

- many target users already organize projects/tasks in Notion
- allows Auspice to act as timing layer without replacing Notion

### Fourth real integration

Notion write-back.

Reason:

- useful but higher risk for clutter/duplication
- should come after read-only/import flow is clearly useful

### Notes support

Start with paste/import/export rather than direct API.

## Build Implication

The prototype should visually acknowledge integrations even before implementing them.

Add mocked source badges to task cards:

- Manual
- Notes paste
- Notion later
- Calendar later

Add future integration note in Capture:

```text
Later: pull from Notion, Notes, and calendars. For now, paste or type anything here.
```

Add mocked calendar action buttons:

- Place on calendar
- Keep as suggestion

Add a small future sources card somewhere in Tasks or Capture:

```text
Sources coming later
Google Calendar · Notion · Notes · Reminders
Auspice will read from your existing systems instead of replacing them.
```

## Summary

Auspice should become the timing layer across the user’s existing systems.

It should not demand that users abandon Notion, Notes, calendars, or task apps.

The long-term architecture should support:

1. manual capture
2. paste/import
3. calendar awareness
4. calendar write-back
5. Notion read
6. Notion write-back
7. notes export/import
8. additional task systems later

The guiding principle:

> Auspice organizes time around what already exists, rather than forcing users to organize everything inside Auspice.
