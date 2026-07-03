# Categories — Venture → House, Planet, Category-Specific Rules

The classical method: identify the house that governs the matter, treat that
house's ruler as the venture's own significator, and read the Moon (and that
ruler) exactly as in `01_universal_rules.md`, plus whatever is specific to the
category below. House numbers use whole-sign reasoning (works across the
house systems Currents already supports — `houses.ts`).

Categories are ordered by stakes, lightest first — the tradition's
high-scrutiny elections (contracts, marriage) come last, and the UI mirrors
this ordering.

| Category | House | Co-significator planet(s) | Notes |
|---|---|---|---|
| New habit / practice | 6th (routine/practice) | — | Low-stakes; universal rules applied lightly. **Inherits the medical KB's safety floor in full** (`05_safety_and_limits.md`) — a wellness *habit* is fair game; a *medical procedure* is not, ever. |
| Scheduling a date | 5th (pleasure, romance) | Venus | A Venus hour sharpens it; Moon applying to Venus is the classic signature. |
| Travel (short) | 3rd | Mercury | |
| An important conversation | 3rd (the exchange) + 7th (the other party) | Mercury | Mercury retrograde is a soft caution — fine for revisiting old ground or clearing the air, poor for brand-new proposals. |
| Starting a writing project | 3rd (the writing itself) | Mercury | **Mercury retrograde is favorable here, not a caution** — drafting, revising, and returning to old material classically suit the retrograde. Only the *release* is avoided under it (see Publishing). |
| Creative work / performance launch | 5th | Venus, Sun | Sun well-placed favors visibility; Venus well-placed favors reception/likability. |
| Submitting a job application | 10th (the role) + 6th (the daily work) | Mercury (the document), Sun | Mercury retrograde: soft caution — expect follow-ups, resubmissions, or delays in hearing back. |
| Job start / new role | 6th (daily work) or 10th (if it's a significant career step) | Sun (10th) or Mercury/Mars (6th, depending on the work's nature) | |
| Travel (long) / relocation | 9th (long journeys) or 4th (if it's about the new home) | Jupiter (long travel), Moon (home) | |
| Publishing / releasing | 9th (public life of the work) + 3rd (the work itself) | Mercury, Jupiter | Mercury retrograde is a **hard** caution — releasing into the world is exactly what the retrograde disrupts. Split from "writing" deliberately: the two have opposite retrograde readings. |
| Business / product launch | 10th (public role) + 1st (the thing's own identity) | Sun, Saturn (structure), Mercury (if trade/commerce-heavy) | Prefer the 10th's ruler angular and unafflicted. Mercury retrograde: soft caution — launchable, but messaging/logistics tend to need a second pass once direct. |
| Home purchase / lease signing | 4th | Moon, Saturn (the structure/commitment) | |
| Financial venture / investment | 2nd (own resources) + 8th (others' resources, if raising capital) | Venus (2nd), the 8th's ruler | Mercury retrograde is a **hard** caution — financial commitments are document- and agreement-bound by nature. |
| Signing a contract / important agreement | 7th (the other party) + 3rd (the document itself) | Mercury | Mercury retrograde is a **hard** caution here — this category blocks, not just penalizes. |
| Marriage / long-term partnership | 7th | Venus (harmony), the Moon (the relationship's own weather) | Classically the most scrutinized election in the tradition — Lilly gives it extended treatment; it closes the list for that reason. Avoid Venus retrograde. Avoid the 7th ruler in hard aspect to Mars/Saturn. |

## A note on "Launch" as the app already uses the word

The app's Guiding Stars / Goals language already uses "launch" informally (see
`PLANET_ACTIVITIES.Jupiter` and `PLANETARY_HOUR_RULES.Sun/Jupiter` in the
existing code — "launch," "publish," "declare" all already appear as
Fire/Sun/Jupiter-flavored activity verbs). The electional feature should be
positioned as the natural extension of that existing vocabulary — "you've been
told this hour favors launching; here's exactly when to actually do it" — not
a new, disconnected concept.
