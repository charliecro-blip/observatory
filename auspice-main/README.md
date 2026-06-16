# Auspice

**Auspice** is a rhythm-aware astrological planning assistant.

Core question:

> Given the quality of time and the shape of my life, what belongs here?

Core phrase:

> Move with time, instead of forcing yourself through it.

Auspice combines astrological timing, daily rhythm, tasks, calendar awareness, and light electional astrology to help users orient their day and week without turning life into a productivity machine.

## MVP Thesis

The first prototype should answer three questions beautifully:

1. **What kind of time is this?**
2. **What should I do now?**
3. **How should I move through this week?**

## Initial Scope

The first version should be a static clickable prototype with mock data. It should not yet implement real ephemeris calculations, Google Calendar integration, authentication, database persistence, or advanced electional chart logic.

MVP surfaces:

- Today view
- What Now assistant card
- Week-ahead rhythm map
- Manual task list
- Seed rule data

## Repository Structure

```text
/docs
  product-spec.md
  ui-wireframe-spec.md
  source-library.md
  source-audit.md

/rules
  auspice-seed-rules-v1.json

/research
  robson-electional-extraction.md

/prototype
  README.md
```

## Product Guardrails

Auspice should not:

- fill every empty calendar space
- tell the user they are behind
- score productivity harshly
- treat rest as failure
- make astrology sound deterministic
- create fear around imperfect timing

Auspice should:

- suggest
- orient
- soften
- clarify
- protect space
- help users choose
- make time feel alive
- help tasks find their proper moment

## Build Direction

Start with a single-page React prototype using static astrology data and `rules/auspice-seed-rules-v1.json` as the rule source.
