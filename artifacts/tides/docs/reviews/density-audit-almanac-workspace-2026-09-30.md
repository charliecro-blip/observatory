# Density audit: Almanac and Workspace · September 30, 2026

Status: proposals for owner markup. Nothing here is built. Same method as the
Home and Calendar audit earlier today: a scratch account shaped like the
owner's (Chicago, four practices, four tasks, three chosen times, two Guiding
Stars, a natal chart) on the local build at `c494816`, measured at 1024px and
375×812.

Each numbered item takes one answer: **keep**, **fold** (one tap away),
**remove**, or a note. Items marked **owner call** have no default.

## Almanac

Desktop: 2,540px, about 3.3 screens, 24 controls. Phone: 3,188px. On a phone
the activity-week section alone is 935px, and the dated sky list starts at
1,739px, on the third screen.

| # | Element | Proposal |
|---|---|---|
| A1 | An empty strip under the title (Calendar's toolbar, rendered with nothing in it: 30px, 0 controls) | **Remove** (bug). |
| A2 | "The week for …" picker: ten activity chips, "all 52", "+ add yours" | **Fold** to the chosen activity with a "change" control that opens the chips. |
| A3 | Explainer under the week ("10 windows this week. Pick one to see what's behind it… A violet edge marks… 25 matching planetary hours aren't listed on their own.") | **Remove**, or cut to "10 windows this week". |
| A4 | "Electing a beginning → launching, signing, publishing — the stricter rules, in Pick a Day" | **Owner call:** the link leaves the new shell for Workspace › Plan › Pick a Day. Bring Pick a Day into Almanac, or remove the link. |
| A5 | The Sky Itself intro: "Fixed before you get here, and true for everyone. No verdict attached — what to do about these is your call." | **Remove**; a caption saying what the list is not (the disclaimer rule). |
| A6 | Lunation arc and "Day 20 of 30 · 79% lit · new moon in 10 days" | **Keep**. |
| A7 | "The nodes change sign" card at the top: an event 43 days old | **Remove** once it is more than a week past; before that it sits in the list at its date. |
| A8 | Phase rows repeat the same sentence every month ("The cycle turns toward clearing away what is finished." three times by December) | **Fold**: the sentence shows once per kind, behind ▼ after that. |
| A9 | The list runs to Dec 24: about 45 rows over three months | **Owner call:** horizon. Proposal: six weeks, with "show later". |
| A10 | "angle crossings" switch | **Keep**. |
| A11 | Footer: "Aspects are only scanned to Wed, Oct 21 — past that the sky here is unread, not empty." | **Keep**; a gap stated as a gap. |

## Workspace

Two layers. The **Workspace** destination is a landing page (1,770px). Its
"Open workspace" button then replaces the whole app with the old one: its own
navigation (Home, Calendar, Stars, Plan), its own top bar, an always-on Sky
panel, a first-run tour, and a thin "Find a time" bar as the only way back.

### The landing page

| # | Element | Proposal |
|---|---|---|
| W1 | "OPTIONAL WORKSPACE / Room for the rest of your life." and its paragraph | **Remove**. |
| W2 | Four cards (Calendar and plans, Tasks and habits, Stars and projects, Sky and reflection) that look clickable and are not | **Make them the doors** (Tasks, Habits, Stars, Bearings), replacing W3. |
| W3 | "Open workspace" button | **Remove** (W2 replaces it). |
| W4 | "Find a time for something you already keep here": every task and habit, each with "Use in a search" | **Remove**; Tasks already has "Find a time" on every row. |

### Inside

| # | Element | Proposal |
|---|---|---|
| W5 | Entering Workspace swaps the whole app and its navigation | **Owner call** (structural): Workspace renders inside the main shell, keeping the main header, with its own sub-tabs (Tasks · Habits · Stars · Plan · Bearings). The largest item here. |
| W6 | Workspace Home: "Deep Tide · high" reading, your work, your day, this week, the rhythm picker ("how you want to be met"), "0 of 4 practices kept" | **Remove**; each part is on the new Home or in Settings. Workspace opens on Tasks. |
| W7 | Workspace Calendar, a second copy of Calendar | **Remove** from Workspace's navigation. |
| W8 | Top bar: Session, Ask, + task, 📱, ?, ◇, ☾, Settings (ten controls; on a phone it runs off the edge) | **Fold**: theme and Settings are already in the account menu; keep + task. **Owner call** on Session and Ask. |
| W9 | Stars: about a dozen controls on every Star card, even an empty one (+ log, pause, retire, a date, four element chips, + task, + habit, + step, break into steps) | **Fold** into an Edit area; the card shows the Star and what serves it. |
| W10 | Stars: "Where you are" summary (habits and Stars again) | **Remove**; Habits and Home cover it. |
| W11 | Stars: "The four elements" reference text at the bottom | **Fold** into Bearings, or remove. |
| W12 | Habits: 80 controls for four habits (☆ star, "neutral", ◷ schedule, Edit, ✕ on every row) | **Fold** the row actions into Edit; drop the "neutral" label. |
| W13 | Plan › Schedule: "You're holding 4 things. Shall I spread them across this week?" | **Bring to Home**: this places the tasks you already hold, which is how the Aug 14 week worked; Home's "Plan a few things" only takes a new list. |
| W14 | Plan › Pick a Day and The Planets sub-tabs | **Owner call**, with A4. |
| W15 | Your Bearings (year, arc, rhythm, chapters) | **Keep**; this is the chart's depth, and its vocabulary belongs to it. |
| W16 | Stars' long-weather lines name body effects: "nervous system, disrupted rhythms", "fatigue, joint/structural stress" | **Owner call:** rephrase as conditions (CLAUDE.md: describe conditions, never promise outcomes), or keep. |

## Bugs found along the way

| # | What | Evidence |
|---|---|---|
| AB1 | Almanac's empty toolbar strip (A1). | 30px, 0 children. |
| AB2 | Sky panel hour in 24-hour time: "14:38–15:37", beside "3:06pm" everywhere else. | Rail, "HOUR". |
| AB3 | Raw ISO dates in Workspace Tasks: "2026-09-28", "2026-10-01". | Tasks tab. |
| AB4 | Plan asks "how long?" for "make dr's appt (20 min)", whose title already says. | Plan › Schedule; `minutesInLine` could answer it. |
| AB5 | Workspace's phone top bar runs past the screen edge; Settings is cut off. | 375px. |

Not a bug: Almanac and the Sky panel said 79% lit while Home said 80%. The
illumination was 0.794 at the time; Home's reading was fetched twenty minutes
earlier.
