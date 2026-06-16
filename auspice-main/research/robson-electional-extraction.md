# Robson Electional Extraction

Source: Vivian E. Robson, *Electional Astrology* (1937)

## Purpose

This document extracts practical electional principles from Robson and translates them into Auspice app logic.

The goal is not to reproduce Robson wholesale. The goal is to identify rules that can become:

- timing factors
- scoring logic
- event-category rules
- caution language
- user-facing interpretation
- MVP constraints

## Why Robson Matters

Robson is useful because the book is organized in a product-friendly way:

- general principles
- Moon in electional astrology
- lunar mansions and aspects
- planetary hours
- event categories such as business, journeys, messages, domestic matters, friendship, commerce, marriage, property, medical, etc.

## Core Robson Principle

Electional astrology chooses propitious times for the commencement of undertakings.

Auspice translation:

> Beginnings carry a pattern. Auspice helps you choose moments whose pattern better fits the thing you are beginning.

## Electional Astrology Is Not Omnipotent

Robson emphasizes that an election cannot override the natal chart or larger conditions.

Auspice translation:

> Timing helps, but it does not replace circumstance, capacity, or deeper life conditions.

App rule:

- Do not promise that a good window guarantees success.
- Do not frame a difficult window as certain failure.
- Interpret timing as support, friction, or fit.

## Ideal Elections Are Rare

Robson notes that perfect elections are usually impossible.

Auspice translation:

> Most real-life timing is imperfect. Auspice should help users choose the best available window, not chase impossible purity.

App rule:

- Rank available windows relatively.
- Explain tradeoffs.
- Use labels like Excellent, Good, Workable, Mixed, Avoid if possible.

## Fortifying the Significator

Robson's general method is to identify the planets, signs, and houses ruling the matter, then make them strong and unafflicted.

Auspice translation:

> Identify the planet/task family of the action, then choose a window where that planet or symbolic function is supported.

Examples:

- Writing: Mercury
- Study: Mercury/Jupiter/Saturn
- Client reading: Mercury/Jupiter/Moon/Venus
- Launch: Sun/Jupiter/Mercury
- Relationship: Venus/Moon/Mercury
- Exercise: Mars/Sun
- Admin: Saturn/Mercury
- Home care: Moon/Saturn

## The Moon Is the Most Important General Significator

Robson gives the Moon major importance in electional astrology.

Auspice translation:

> The Moon describes the flow and traction of the moment. It should be the first astrological filter after practical constraints.

MVP Moon fields:

- Moon sign
- Moon phase
- Moon void-of-course?
- Moon next aspect
- Moon applying to benefic?
- Moon applying to malefic?
- Moon sign matches task type?

## Ascendant, Midheaven, and Relevant House

Robson emphasizes the Ascendant, Midheaven, their rulers, and the house ruling the matter.

Auspice MVP simplification:

- For daily task suggestions, do not calculate full house-based electional quality.
- For later electional finder, include Ascendant ruler, Midheaven ruler, relevant house ruler, and outcome house.

## Natural Significators

Auspice should assign tasks to planetary families.

- Mercury: writing, messages, study, commerce, scheduling
- Venus: love, relationship, design, beauty, harmony
- Mars: action, exercise, confrontation, cutting, courage
- Jupiter: growth, money, teaching, publishing, opportunity
- Saturn: responsibility, structure, boundaries, discipline, cleanup
- Sun: public presence, visibility, leadership, direction
- Moon: home, body, care, family, food, mood

## Signs and Task Fit

Use sign element and modality lightly.

- Cardinal: starting, initiating, decisive first steps
- Fixed: stability, deep work, maintenance, consistency
- Mutable: adaptation, editing, learning, conversation
- Fire: action, inspiration, visibility, courage
- Earth: admin, practical work, body, money, cleaning
- Air: writing, study, conversation, planning
- Water: emotional work, care, rest, home, ritual, relationship attunement

## Benefics and Malefics Are Contextual

Auspice should not use simplistic good/bad labels.

- Mars is useful when a task needs action, movement, cutting, boundary, or courage.
- Saturn is useful when a task needs structure, discipline, maintenance, or finishing.
- Venus can be insufficient when a task needs hard boundaries.
- Jupiter can overextend if not grounded.

## Local Angularity Translation

For MVP, use angularity as a tone factor:

- Mars rising: good for action/exercise/boundary; caution for delicate conversation.
- Saturn rising: good for structure/discipline; caution for ease/social/romance.
- Venus rising: good for social/aesthetic/relationship.
- Mercury rising: good for writing/communication/study.
- Jupiter rising: good for teaching/publishing/growth.
- Moon rising: good for body/home/care; emotionally reactive.
- Sun rising: good for visibility/leadership; possibly overexposed.

## Immediate Rules Derived from Robson

### Rule R1: Classify the task

Every suggestion starts by asking:

- What kind of action is this?
- What planetary family rules it?
- Is this a beginning, continuation, completion, or maintenance task?

### Rule R2: Weight Moon condition strongly

For beginnings, Moon condition can strongly raise or lower the rating.

### Rule R3: Match task to planetary family

A Mercury task in Mercury hour or with Mercury angular gets support. Similar for Venus, Mars, Jupiter, Saturn, Sun, and Moon.

### Rule R4: Contextualize Mars and Saturn

Mars/Saturn are cautionary only when mismatched. They are supportive when the task needs their qualities.

### Rule R5: Use best-available logic

Do not require perfect elections.

### Rule R6: Hide advanced doctrine at first

Ascendant ruler, house ruler, dignity, reception, and outcome ruler belong in advanced electional finder, not the first Today screen.

## Modernization Notes

Robson is useful but often severe and traditional in tone.

Auspice should modernize by:

- softening fatalistic language
- respecting practical constraints
- avoiding fear around imperfect charts
- using Mars/Saturn constructively
- ranking windows relatively
- not overwhelming users with doctrine
- keeping rest and maintenance as legitimate uses of time

## First Implementation Version

Implement only:

1. task planetary family
2. Moon VOC
3. Moon applying to Venus/Jupiter/Mars/Saturn
4. planetary hour match
5. local angularity by planet and angle
6. Moon sign element/modality
7. best-available ranking

Do not yet implement:

- full Ascendant ruler condition
- dignities
- receptions
- lunar mansions
- Part of Fortune
- nodes
- fourth-house outcome
- radical chart compatibility
