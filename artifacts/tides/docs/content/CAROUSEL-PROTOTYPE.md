# Compass monthly almanac: editorial prototype

Status: proposal and illustrative storyboard; no publishing or recurring automation enabled.

## Purpose
Help a reader choose dates for something they already want to do, understand the astrological reasons, and keep a useful reference. Audience needs are hypotheses to test: quick orientation, practical options, flexibility, readable explanations, and confidence that qualifications have not been concealed.

## Edition
Use a calendar month for the recurring flagship. This September 11–October 10 trial remains explicitly dated. Do not silently change its horizon. If using a lunar-cycle edition instead, name it “New Moon to New Moon.” Keep fixed CST (UTC−6) for this requested prototype; store exact UTC intervals and the display zone so subsequent editions can deliberately choose civil Central Time if desired.

## Carousel order
1. Cover: edition dates and activity-led promise.
2. Month at a glance: four/five phase landmarks, equinox when present, selected ingresses and stations. At most eight date rows; combine same-date events or split into two pages. No generic descriptions of waxing weeks.
3. Move your body.
4. Dates & making out.
5. Get out & about.
6. Make something.
7. Get your head into it.
8. Have the conversation.
9. Leave room to rest.
10. Reading the selections: meaning of broad periods, checked openings, stars, dayparts, and a reference destination when available.

No requirement to fill ten pages or seven entries. Five to seven meaningful options per activity is a ceiling-guided target. Merge a highlighted moment into its parent period so it does not count twice. Drop categories with inadequate evidence rather than manufacture dates.

## Activity-page anatomy
Activity title; one placement paragraph of roughly 25–40 words; five to seven chronological entries with bold date/daypart, practical phrase, and a short evidence line. A starred moment nested beneath a longer period is visibly narrower. Each page carries edition and timezone so screenshots remain interpretable. No minute clocks in the main layout.

Broader theme: Moon-sign affinity or an activity-relevant planetary backdrop. Not a continuously clear election.
Checked opening: existing canonical activity result, with suitability and important conflicts retained.
Star: clear/convergent canonical opening with lunar-contact plus standing-sky evidence. No star solely for a sign, VoC, phase, or multiple Moon contacts. The earlier suggested rest-star expansion is not adopted; describe rest overlap in words.

## Visual direction
Reuse WORLDBOOK’s almanac: warm paper, ink, restrained brass accent, thin rules, serif headings and plain readable body text. Date numerals anchor each row. Use a star consistently and no decorative astrology glyph vocabulary. Color is supplementary. Prototype a portrait 4:5 composition and check every page at ordinary phone size; reduce content instead of shrinking text. No claim about current platform upload limits is needed.

A conventional month grid is a companion reference, not the main carousel page. Thirty cells plus seven activity categories will make a phone image unreadable. In a web companion, show one activity at a time; allow selection of a date for its reason and exact interval. Broad spans and discrete openings must have different marks. Never color a whole day as universally good or bad.

## Reuse from the corpus
- WORLDBOOK: almanac page form, plain first-layer language, planets with signs in the evidence, activity remains optional.
- activityCorrespondences.ts and romanticTime.ts: established category mappings, phase and VoC preferences, clear separation of ordinary intimacy and first-date inception.
- timingSearch.ts / timingPresentation.ts: existing results and preserved evidence; no new content score.
- dayarc.ts / astro.ts: lunar events, ingress boundaries, VoC and astronomical facts.
- motion.ts and dignity.ts: possible nuance about a planet’s condition. Only use where the existing activity rules establish relevance; dignity is not a blanket verdict about exercise, affection, or art.
- longSession.ts: use only when a claim concerns sustained duration. A Moon peak does not establish a three-hour session.
- ASTROLYRICA-COPY-HANDOFF.md: inventory for voice review, not universally paste-ready copy. Some historical language predates current owner corrections.
- DESIGN.md: useful historical architecture, with superseded requirements such as mandatory location. Current chartless, location-independent content instructions govern this edition.

## Semi-automatic workflow
1. Freeze edition range, timezone, included aspects, VoC definition, activity catalogue revision, ephemeris version, and publication status.
2. Compute astronomical facts and canonical activity results separately, retaining exact intervals and coverage. Omit all minor aspects, local hours/crossings, natal and calendar factors.
3. Select eligible events by explicit rules. Prioritize important phase/ingress/station landmarks for the overview; use existing activity eligibility for checked openings. Distribution across weeks is a tie-breaker, never justification to fill a weak week.
4. Form editorial entries. Merge duplicates and overlapping evidence, preserve clipped endpoints, distinguish theme from recommendation, and check adverse conditions before calling a broad stretch favorable.
5. Convert exact boundaries to dates/dayparts without inventing all-day availability. Split long spans when a material condition changes. Produce readable copy from reviewed placement/activity guidance; generative writing cannot add dates, stars, or evidence.
6. Human review: activity fit, astrological nuance, significant conflicts, readable copy, chronology, and page density. Apply no-ai-slop when drafting.
7. Render carousel, caption, accessible text, and exact-time reference from one approved content record. No automatic publishing in the prototype.

Each entry retains: edition ID, entry ID, activity key, kind (landmark/backdrop/theme/opening/rest-period), exact start/end/peak where applicable, display daypart, source IDs, canonical result ID if applicable, support families, qualifications, star eligibility, copy, rule versions, review state. This is an editorial record, not a Wave or durable Intent domain model.

## Gates before unattended draft generation
- Correct station detection: the current retrograde predicate compares longitude over the next day and can move the apparent station approximately half a day early.
- Align the calendar and ordinary-engine VoC definitions (outer planets versus classical planets). They happen to agree for this trial month.
- Resolve ordinary search’s 07:00–23:00 clipping for a genuinely location-independent complete scan; never advertise current results as an exhaustive global best-of list.
- Validate broad-interval qualifications. A sign passage cannot inherit the suitability of one point inside it.
- Separately review the new creative-practice correspondence.
- Cross-check final astronomical events with a trusted independent ephemeris, including timezone date changes.

## What to test
Show the month overview, one activity page, and one dense rest page at phone size to a few intended readers. Ask them to pick an option, explain why it was selected, distinguish a broad period from a star, and locate the meaning of VoC. Observe reading time and errors. After publication, compare saves/shares of activity pages and visits to their references; do not assume engagement proves usefulness. Ask whether the saved page helped someone make an actual plan.

## Positioning
Activity-first timing with visible reasons, practical flexibility, and an inspectable record is the proposed distinction. Key-date calendars and transit interpretation are already common: CHANI explicitly offers key dates, Moon calendars, retrogrades, and weekly astrology (https://chaninicholas.zendesk.com/hc/en-us/articles/8711720295187-A-Tour-of-the-CHANI-App). Avoid claiming that calendars or plain-language interpretation alone are unique.
