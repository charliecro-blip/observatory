# Compass style audit · September 10, 2026

Status: changes recommended; application code unchanged by this audit.

The current interface does not meet the project's own standards for plain language, consistent controls, or a coherent almanac/observatory identity. The new Home and shell were connected to the old instruments before their presentation was reconciled. That is the main source of the mismatch the owner is seeing.

## Evidence and limits

Reviewed the owner's three screenshots and the live Home, Calendar Agenda, and Almanac in the in-app browser at its current approximately 406-pixel-wide viewport. Inspected the corresponding components, shell CSS, palette definitions, lunar components, and design documents. Calculated contrast from declared token pairs; these are source-based calculations, not a complete rendered contrast scan.

Desktop, every palette, Workspace, search results, modal states, keyboard traversal, and device/browser combinations were not visually verified in this audit. Findings in those areas are identified as source findings. This is enough evidence to require a correction pass, but not a site-wide accessibility certification.

## Which guidelines govern

| Source | What remains useful | How to treat it |
| --- | --- | --- |
| AGENTS.md | Plain language at first contact; no-ai-slop review at authoring; conditions rather than promised outcomes | Standing requirement |
| Ratified wave-first specification, opening sections | A meaningful answer before internal ontology; timing is the central interaction | Product constraint, with subsequent owner requests restoring Home, Calendar, and Almanac |
| WORLDBOOK.md §§2, 4 | Instrument vocabulary stays in its instrument; Almanac and Observatory belong to one identity | Language containment is explicit; distinguish ratified identity from proposed details such as retiring palettes |
| DESIGN-HANDOFF-COMPASS-BRAND.md | Celestial navigation, legibility, element semantics, typography roles, both light and dark | A design request containing open questions and older palette values, not a complete approved UI kit |
| DESIGN-ASK-AND-HOME-2026-08-19.md | Reuse existing capabilities, reduce simultaneous choices, keep lunar context subordinate | Historical product arrangement; do not restore its entire dashboard hierarchy |
| src/index.css and src/lib/themes.ts | Existing font families, semantic colors, text ramps, focus and layer tokens | Actual implementation sources; they currently disagree in places and are not an adequate component specification |

There is no single executable standard for button variants, sizing, text roles, panel treatment, or responsive page structure. Prose guidelines cannot prevent drift while each component makes those decisions independently. Some skill notes also describe the older inline-only codebase; the new FindTime.css means those descriptions are now incomplete.

## Findings, ordered by priority

| Priority | Evidence and location | User impact | Concrete correction |
| --- | --- | --- | --- |
| P1 | `src/lib/elements.ts:215`, `:246`, `:310`; `src/components/TideStrip.tsx:56` | The supposedly plain reading says “The tide is out” and “Let the fire bank.” It mixes nautical and fire metaphors, contains “seeds” without a clear referent, and tells the person not to start. The regex translator does not remove these phrases. | Author a plain presentation directly from the existing structured conditions, preserving material qualifications. Keep instrument prose available in its instrument. Review all character/level/void/quiet combinations; do not add more phrase replacement patches. |
| P1 | `src/pages/FindTime.css:101`; `src/pages/Calendar.tsx:1876`, `:1890`, `:1898`, `:1899` | Broad shell styling combines with inline legacy rules. The same page has 12px padded shell actions, 10px compressed calendar actions, a navy Event button, and an indigo search action elsewhere. Related actions look unrelated. | Introduce a shared action component/style with explicit primary, secondary, text, and icon variants and documented sizes. Migrate controls explicitly and remove the descendant-wide button skin. Keep view selection a separate segmented-control pattern. |
| P1 | `src/pages/CompassHome.tsx:81`; `src/pages/FindTime.css:785` | The new lunar graphic looks like an unlabeled progress control. “New Moon” wraps into two lines; the repeated endpoints do not explain the approaching event. It occupies space without providing a useful next fact. | Remove this one-off graphic. Evaluate the existing `LunationArc` used by Almanac for a compact shared variant. Pair a moon depiction with a short factual phase/event label derived from canonical data. Keep the fuller cycle visualization in Almanac. |
| P1 | `src/components/TideStrip.tsx:85`; `src/lib/themes.ts:32`; `src/pages/FindTime.css:82`, primary-action rules | The main reading is assigned the muted color. In Tide, #8E8A7E on white is approximately 3.45:1. Small metadata #9A968A on #F4F2EC is 2.64:1. White primary-action text on dark-theme Meridian #7A80E6 is 3.47:1. | Give reading text a readable body token; define and verify an explicit on-action color for each theme; repair metadata contrast. Measure all supported palettes and states. Do not treat using a token as proof of contrast. |
| P1 | `src/pages/FindTime.css:741`, `:751`, `:778`; live Home | The narrow header spans three rows, with Workspace alone on the last. Date, a large Almanac navigation button, reading, lunar line, and another navigation action precede search. At the inspected viewport even the search input is below the visible area. | Make a deliberate compact navigation layout and collapse the orientation area. Place search immediately after a concise current reading. Give destination links consistent secondary emphasis. |
| P2 | `src/pages/FindTime.tsx:1114`; `src/pages/Calendar.tsx:1878`; live Almanac | Calendar navigation is duplicated inside the Almanac destination. Find a time appears in both an outer action row and the inner toolbar. Navigation and action layers compete before the content begins. | Let the shared shell own destinations. Let Calendar own Agenda/Day/Week/Month and date navigation. Give Almanac only its relevant local controls. Reuse the instruments without embedding all their former navigation. |
| P2 | `src/pages/FindTime.css:86`, `:108`, `:754`; `src/pages/Calendar.tsx:1891`; `src/components/TideStrip.tsx:85` | The 25px display section title is followed by a 12px reading, while interactive calendar labels shrink to 10px. Size changes follow component history rather than information importance. | Define semantic type roles and map components to them. Keep the existing fonts; increase reading and control legibility before adding display treatments. |
| P2 | `src/pages/FindTime.css:757` and `:785`; `:19` and `:741`; `:1` and `:750` | Later rules reverse earlier layout and decoration decisions. The lunar flex layout is overwritten by grid; the shell background and header are similarly overridden. This makes further responsive fixes fragile. | Consolidate each component's base and responsive rules, removing superseded declarations rather than appending another override block. |
| P2 | `src/components/TideStrip.tsx:110`; `src/pages/FindTime.css:758`; live Home | The reading is enclosed in a rounded white panel with a colored stripe; its related action sits outside as bold text; the neighboring Almanac action is boxed. These treatments do not communicate a stable hierarchy. | Use one reading treatment with readable editorial text, modest spacing, and a consistent detail action. Reserve panel boundaries for grouped interactive content rather than every paragraph. |
| P2 | `src/lib/themes.ts:23`; `src/index.css:51`; `src/components/LunarCycle.tsx:48` | Theme definitions and historical comments tell different stories. The old lunar component still contains white translucent marks. Simply restoring old visuals would also restore defects. | Retain semantic element colors and symbol fonts, reconcile tokens, and check reused graphics against both light and dark surfaces before adopting them. |

## Copy review

The header fails the stranger test. “Let the fire bank” requires knowledge of both the metaphor and what the app expects a person to do. “Rest, seeds, and restoring” combines an action, an unexplained noun, and a repeated action. Two em-dash constructions create the rhythmic pattern explicitly prohibited in the writing agreement. “Don't force a start” turns broad conditions into a directive.

“Read this moment and see what fits” also obscures the destination. Its replacement should name the actual content opened, using the same naming across Home and navigation. Do not promise a recommendation if the destination may only have a reading and an empty personal inventory.

No replacement forecast is approved by this audit: that text must preserve the existing evidence and qualifications, and its whole set of variants needs review. Renaming an element or hiding a qualification is not a copy fix.

## Proposed execution standard

These are recommendations for the correction pass, not claims that an earlier document already approved these exact dimensions.

- Preserve Baar Sophia for restrained page titles, Spectral for readings, Geist for controls and ordinary interface text, and Geist Mono for dense astronomical values. Keep the existing celestial glyph faces.
- Establish named type roles: page title 28–36px, section title 20–24px, reading 16px with 1.5–1.6 line height, control 14px, metadata 12–13px. Avoid arbitrary 10px action labels. Mobile text-entry controls should remain at least 16px.
- Use a shared action family: one Meridian primary treatment, a neutral bordered secondary, a clear text action, and an icon-only variant with an accessible name. Share font weight, corner shape, focus, disabled, hover, and pressed behavior. Use 40px standard controls and 44px touch targets; allow a documented compact treatment where a dense instrument needs it.
- Use one spacing scale, initially 4/8/12/16/24/32/48px. Reading surfaces and toolbars should share alignment; the current 14px interior offsets should not accidentally become separate page edges.
- Keep warm light surfaces and Observatory dark surfaces with semantic element accents. Give charts visual detail through meaningful marks, axes, and labels. Avoid adding a decorative curve merely to make the lunar area more attractive.
- Home should show date, a brief readable current context, search, and upcoming commitments. The full cycle and detailed sky instruments belong one step deeper. Reuse their underlying components and data rather than reproducing them in the shell.

## Correction order and review gate

1. Establish a local component specimen containing actions, segmented controls, fields, reading text, metadata, and a compact lunar treatment in light and dark.
2. Fix the plain-language source and contrast tokens, then apply the shared components to Home.
3. Reconcile Calendar and Almanac toolbars and their type/spacing without changing timing judgments or calendar behavior.
4. Apply the same patterns to search results, Saved choices, and Workspace entry points; do not re-skin everything through a global descendant selector.
5. Verify at 390, 768, and 1440 CSS pixels, including keyboard focus, loading/error/empty states, long activity text, both light and dark, and every supported palette's contrast. Confirm the lunar label and displayed event date come from the same source and timezone convention.

Acceptance: the same action has the same treatment across pages; the first reading requires no internal vocabulary; search is readily visible on a phone; lunar context gives an understandable fact; Calendar and Almanac retain their useful depth; no timing scores, evidence, or saved records change as a side effect of visual work.

Verdict: hold visual beta sign-off until the P1 findings are corrected and the listed responsive/theme checks are complete.

## Implementation follow-through · September 10

Implemented shared `Action.tsx` / `Action.css`, migrated the new shell/Home/search/library/source actions and Calendar toolbar, and added selected-state semantics to Calendar view controls. Calendar retains its full view list in Workspace; the main shell removes the duplicate Almanac destination. Shared Disclosure has an explicit toolbar option. The old instrument interiors keep their existing styling rather than inheriting a blanket button skin.

Home now renders a structured plain reading with its beginnings qualification preserved. Its lunar context reuses `LunationArc` in a compact moon-disc variant, showing illumination and direction without introducing a forecast or event-date estimate. The original Almanac arc remains. The Home search has moved up through compact layout and removal of redundant ornament; navigation stays in one row beneath the brand at narrow widths.

Updated the four palette text ramps and supplied a dark-theme on-action color. Source-calculated minimum contrast across the muted/body/metadata tokens and page/card/card-2 backgrounds: Tide 4.96:1, Almanac 4.52:1, Observatory 5.60:1, Minimal 5.50:1. This does not certify colors inside every legacy instrument.

The local `/style-review.html` specimen renders actual shared components, with palette controls and constrained-width samples. These controls change specimen width, not browser viewport width. The specimen is separate from the production application entry.

Verified client typechecking, production build, and 26 focused plain-reading/legacy-voice/lunation tests in Chicago, Kolkata, and UTC. Visually checked Home, Calendar, Almanac, and the Observatory specimen. The dark specimen exposed an inverted moon depiction, corrected by keeping physical light/shadow colors independent of theme.

Remaining review coverage: exact 390/768/1440 browser viewport rehearsals, full keyboard traversal, search error/empty states in each theme, and the deeper Workspace/instrument controls. The visual beta gate remains open for those checks and any resulting corrections; this is not a claim that every historical component has been migrated.

Further migration: the Almanac activity picker now uses shared compact actions with selected/expanded semantics, its creation inputs have accessible names and 16px text, and event-dialog and Google Calendar actions use the same action component. A live “Write tomorrow” search returned an opening and rendered the updated controls. Legacy chart marks and timetable event blocks retain specialized visual treatment.

The isolated browser rendered the actual style specimen and confirmed the moon-phase shapes, controls, and input styling. Its window-size capture did not establish a reliable 390px layout viewport, so exact device-width certification remains unclaimed. Both local services returned HTTP 200 when checked outside the restricted network sandbox; the initial connection failure was a sandbox limitation rather than a stopped preview.

Event-dialog follow-up: added visible field labels, readable error announcements, and a scrollable, safe-area-aware backdrop in place of fixed 100px top padding. The live rehearsal confirmed initial focus on Event title. Cancel initially lost focus because the input's autoFocus ran before useDialog captured the opener; removing the competing autoFocus fixed it. Rehearsal then confirmed Cancel returns focus to Add event. Search errors are now associated with the request field, and result descriptions and editing inputs have larger text. Client typechecking and production build passed for this follow-up; typechecking also passed after the final focus correction.

## Exact-width and keyboard rehearsal

An isolated Chrome session with a freshly minted scratch-only profile measured actual layout viewports using device-metrics emulation. At widths 390, 768, and 1440, document scroll width equaled viewport width and the Home input was visible within a 900px viewport. Screenshots exposed a clipped long placeholder at 390px; the placeholder now reuses “Write tomorrow”. Removed the redundant Almanac footer link while keeping the main navigation destination.

Actual key events verified the event dialog: initial focus Event title; Shift+Tab wraps to Save; Tab wraps from Save to Event title; Escape closes and restores Add event. Pressing D on the dialog button left Calendar in its prior Month view. Calendar's global shortcut handler now ignores dialog/account-menu targets and leaves the shell's Almanac destination alone. The account disclosure now closes with Escape and restores its summary focus (implemented; not included in this measured rehearsal).

The event form also blocks missing/reversed/equal times and associates the visible correction with End; the mutation itself guards invalid intervals. This preserves the existing same-day event model. Final save against Google Calendar and all theme/state combinations remain outside this rehearsal.

## Search and saved-times follow-through

“Find another time” now clears the prior search, chosen time, error, and calendar scope. Starting from a selected Calendar day also clears stale confirmation/query state. Saved times sort explicitly by start time (upcoming ascending, past descending). The confirmation names the Compass calendar, shows the full interval, and offers an Open calendar action. Google Calendar connection controls distinguish loading and request failure rather than briefly offering Connect before configuration is known. Network and unreadable-response failures use recoverable plain-language messages.

Typechecking passed after these edits; the search/library/calendar transition changes also passed a production build. Automatic approval review rejected the isolated search-to-save browser rehearsal because the account usage limit had been reached. That live verification was not run or bypassed; it remains required before claiming this complete flow verified.
