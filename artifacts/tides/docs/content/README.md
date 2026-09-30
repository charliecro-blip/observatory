# Compass content prototype — parked September 15, 2026

Owner asked to file this work away and return to it later. No further production, publishing, or scheduled follow-up is requested.

## Start here when resuming

1. `DETAILED-CONTENT-PROTOTYPE.md` — latest substantive manuscript, approximately 3,000 words across seven activity categories. This supersedes the sparse initial copy.
2. `CAROUSEL-PROTOTYPE.md` — editorial structure, proposed generation workflow, source records, and validation gates. Its initial single-carousel structure predates the richer manuscript; the latest proposal is a month overview plus separate, detailed activity carousels.
3. `storyboard-prototype.html` — preserved four-page interactive sketch. It predates the detailed manuscript and is a layout exploration, not publication-ready content.

## Owner preferences to preserve

- Practical monthly astrology content organized around activities: workouts; dates/making out; being out and about; stillness/rest; creative practice; study; conversations.
- Five to seven options per activity where justified, with clear selection criteria. Never fill a quota with weak evidence.
- Much more substantial interpretation than a list of aspects: explain placements, the style of approach, practical examples, and material qualifications.
- Include longer Moon-sign periods and relevant non-lunar aspects alongside narrower lunar openings.
- Include void-of-course periods for rest.
- The overall month-ahead view should contain major events: new, first quarter, full, last quarter, next new Moon; relevant planetary aspects, ingresses, stations, and selected activity highlights. Omit generic paragraphs about intervening lunar-phase qualities.
- Remove quintiles and other minor aspects from the revised content.
- No place-dependent factors: planetary hours, crossings, local angles, natal or calendar context.
- Requested clocks are fixed CST (UTC−6), explicitly distinguished from daylight Central Time. Prefer dates and readable dayparts on slides; exact boundaries belong in reference notes.
- Stars mark checked clear/convergent openings with lunar-contact plus independent standing-sky support. Earlier discussion proposed broader rest stars, but the latest brief preserves one consistent rule and describes rest overlaps in words.
- Practical examples illustrate interpretation; they must not silently become new engine-supported activities.
- Reuse the almanac visual identity: paper, ink, restrained brass, serif headings, readable body type. Avoid cluttered calendar grids and tiny text on phone slides.
- Aim for a semi-automatic draft-generation system with human editorial review. No automatic publication authorized.

## Preserved scope and status

The sample edition is September 11–October 10, 2026, with the September 10 New Moon included as opening context. Do not silently reuse these dates for a later month. A future flagship calendar-month edition was proposed, not implemented.

All files here are local drafts and calculations. No production content system, published carousel, recurring automation, or fully validated export was completed. Do not describe the broad sign periods as continuously assessed favorable windows or the selections as exhaustive global best dates.

## Outstanding checks before publication or automation

- Station timing: retrograde detection compares longitude with the following day, potentially flagging a station roughly half a day early. Published station dates were used in later prose; raw `planet-changes-2026-09-11.json` is diagnostic, not a trusted station timetable.
- VoC definitions: calendar scanner includes outer planets while ordinary timing uses classical planets. Both happened to agree for this trial period, but the definitions need aligning.
- Global coverage: ordinary search clips candidates to 07:00–23:00 in its query timezone. Current selection is curated, not exhaustive.
- Review challenging major aspects and other competing conditions before endorsing broad stretches. Prior scans emphasized supportive evidence.
- Independently verify astronomical dates, boundaries, and timezone conversions before publication.
- Separately review the new creative-practice correspondence.
- Typeset and inspect the richer pages at phone size. The four-page storyboard only received a script syntax check, not completed visual QA.
- Apply the repository’s no-ai-slop copy requirement and preserve existing canonical timing authority.

## Supporting files

- `broader-periods-2026-09-11.md`: sign periods and planetary backdrops.
- `lunar-cycle-and-rest-2026-09-11.md`: lunar landmarks, all VoC boundaries, definition notes.
- `activity-slides-2026-09-11.md`: earlier exact-time list; contains superseded minor-aspect selections. Historical reference only.
- `month-ahead-2026-09-11.md`: earliest draft; historical reference only.
- JSON files retain raw scans, exact events, and candidate provenance. TypeScript scripts reproduce the local calculations without starting an API or accessing a database.

## Suggested restart

Read the latest manuscript and this handoff first. Confirm the new edition horizon if producing fresh content. Resolve the factual gates, then typeset one complete activity carousel and the overview for review before implementing a generator. No additional work is scheduled.
