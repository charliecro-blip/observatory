# Auspice Source Audit

## Purpose

This audit checks the current source library to make sure Auspice does not skip past important electional or rhythm material before moving into prototype build prompts.

## Current Source Priority

### Very High Priority

#### Vivian Robson — Electional Astrology

Useful because it is directly electional and product-friendly. It includes general principles, Moon rules, lunar mansions, planetary hours, and event categories.

Use for:

- electional hierarchy
- Moon rules
- planetary hours
- event category logic
- source-backed caution language

#### Astrology Podcast Ep. 190 — Electional Astrology with Chris Brennan and Leisa Schaim

This is one of the strongest bridge sources for Auspice.

Useful concepts:

- electional astrology as inceptional astrology
- anything with a definite beginning has a chart
- major vs minor uses of electional astrology
- avoiding neurotic overuse
- daily-use timing principles
- symbolic beginnings
- using different elections for different phases of a larger project

Product implications:

- add election levels
- add symbolic start type
- add project phase timing
- add anti-neurotic guardrail

#### Astrology Podcast Ep. 292 — Defining the Void-of-Course Moon

Useful for VOC Moon definition policy and softening fear-based interpretation.

Use for:

- VOC Moon rules
- caution language
- differentiating major beginnings from routine work

#### Seven Stars Astrology — Dorotheus on Asking Favors

Useful for modern tasks like:

- asking for a raise
- sending a pitch
- asking for help
- applying for something
- requesting testimonial
- outreach/networking
- asking someone on a date

Product implication:

- add Ask / Request / Pitch category

### Medium Priority

#### William Lilly — Christian Astrology

Useful later for:

- traditional chart judgment
- houses and significators
- reception
- dignity/debility
- aspects
- application/separation
- horary/electional overlap

Not a first prototype dependency.

#### Dorotheus Book I

Useful for foundational traditional concepts:

- triplicity rulers
- dignity/exaltation
- house strength
- angularity
- retrogradation
- planets under the beams

Useful later for advanced scoring.

### Lower Priority for MVP

#### Dorotheus Book II

Mostly marriage/children/natal material. Possible future use for relationship timing, but requires heavy modernization.

#### Dorotheus Book III

Mostly haylaj/kadhkhudah and length-of-life material. Not relevant to Auspice MVP.

## Product Changes from Source Audit

### Election Levels

Auspice should distinguish:

- ordinary task
- useful timing preference
- meaningful beginning
- high-stakes election
- major life/business election

### Symbolic Start Types

Auspice should ask what action actually begins the matter:

- click send
- create document
- publish publicly
- leave home
- sign commitment
- first meeting
- first material action

### Project Phase Timing

Large projects can have multiple timed phases:

- research
- draft
- structure
- build
- beautify
- publish
- follow up
- review/integrate

### Ask / Request / Pitch

Add category for requests, pitches, proposals, applications, testimonials, support, and asks.

### Anti-Neurotic Guardrail

Auspice should explicitly avoid making the user feel they need to elect everything.

Key phrase:

> This does not need a perfect election. A supportive window is enough.

## Recommended Next Extraction Order

1. Brennan/Schaim electional transcript
2. Robson General Principles + Moon + Planetary Hours
3. VOC Moon transcript
4. Seven Stars / Dorotheus on Asking Favors
5. Robson event categories
6. Lilly selected definitions/house significators
7. Dorotheus Book I foundational concepts

## Build Relevance

The source audit has already been incorporated into `rules/auspice-seed-rules-v1.json` through:

- election levels
- symbolic start types
- project phase types
- Ask / Request / Pitch
- Travel / Departure
- anti-neurotic election policy
