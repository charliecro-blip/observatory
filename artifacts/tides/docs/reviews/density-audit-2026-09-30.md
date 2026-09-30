# Density audit: Home and Calendar · September 30, 2026

Status: owner approved all proposals on 2026-09-30 (H9: add Due today; C9:
Week), and asked for aspect perfection times on the Day view. Built the same
day; outcome at the end. The style audit of
September 10 asked whether controls were consistent; this one asks what can
come off the screen.

Method: a scratch account shaped like the owner's (Chicago location, four
practices, four tasks, three chosen times) on the local build at `cf52524`,
measured at 1024px and at 375×812. Heights come from the rendered page, not
estimates.

Each numbered item takes one answer: **keep**, **fold** (one tap away),
**remove**, or a note.

## Home

Desktop: 1,703px, about 2.2 screens. Phone: 2,254px, 2.8 screens, with a 128px
header; the request box starts at 741px, on the bottom edge of the first
screen, and "Times you've chosen" is on the third.

| # | Element | Measured | Proposal |
|---|---|---|---|
| H1 | "YOUR DAY" label above the date | 1 line | **Remove**; the date already says it. |
| H2 | Reading: "The current reading shows high activity, with an emphasis on movement and physical activity." | the whole first paragraph | **Replace** with the Moon: sign, and the next exact aspect with its time. Owner rule 2026-08-22: lunar placement and aspects lead. |
| H3 | Moon line "80% illuminated · Waning" + "Current reading" link | 1 row | **Fold** into H2's line; keep the link. |
| H4 | Today's practices | 150px | **Keep**. |
| H5 | "What are you making time for?" request box | 250px | **Keep**. |
| H6 | Three "Try" example requests | 1 row | **Remove** for anyone who has searched before; keep for a first visit. |
| H7 | Plan a few things (horizon picker, hint, six-line box, button) | 520px, the largest section | **Fold** to one line that opens it. Added today; too heavy as an always-open form. |
| H8 | Times you've chosen | 316px, below the first screen | **Keep**, and move above H7. |
| H9 | Tasks due today | absent (a task due today appears nowhere on Home) | **Owner call:** add a short "Due today" list beside H8, or leave tasks to Calendar. |
| H10 | Phone header on two rows (name, Sky panel, account; then four destinations) | 128px | **Fold** Sky panel and the account name to icons so the header fits one row. |

## Calendar

Desktop, Month view: 13 controls before the first date (‹ › Today, four views,
Find a time on this day, Add event, Sky, Share, Google Cal, Saved choices),
then a 30-day bar strip and a legend line. Phone: the grid starts at 770px of
an 812px screen, so the first screen is entirely controls.

| # | Element | Proposal |
|---|---|---|
| C1 | Two rows of toolbar (13 controls) | **Fold** to one row: ‹ date › · Today · view switch · Add event. Find a time on this day, Share, Google Calendar and Sky go into one "More" menu; Saved choices lives in Home's H8 already. |
| C2 | "The water ahead — next 30 days" colored bars, on every view | **Remove** from Calendar (tide vocabulary, unlabeled colors, repeats the grid's day tint). Almanac can keep it. |
| C3 | Legend line "tint = the day's element (Moon's sign) · VOC = void Moon (rest, don't launch)" | **Remove**; the same facts belong in a tooltip or the Sky panel. The imperative "don't launch" also breaks the conditions-not-commands rule. |
| C4 | Planet glyphs beside every weekday name | **Remove**. |
| C5 | Month's day panel order: moon phase, "Gratitude. Share what you've learned.", VoC note, "Spirit Day · Workable", "Overall: fine for most things", then the Moon's aspects | **Reorder**: Moon's aspects first; drop the two generic lines. |
| C6 | Second "+ Add event" in the day panel | **Remove**; the toolbar has one. |
| C7 | Week view: ASC/MC/DSC crossings for every planet on every day, overlapping; truncated day-header chips ("VOC ☽✶♂ 15:53 ☽✶♀17") | **Fold** crossings behind the Sky toggle, off by default; header chips show one item and a count. |
| C8 | Week view: colored gradient band behind every hour | **Remove**, or show only on the selected day. |
| C9 | Month opens by default | **Owner call:** which view should Calendar open on? |

## Bugs found along the way

These are correctness, not taste, and can be fixed without a markup pass.

| # | What | Evidence |
|---|---|---|
| B1 | Today is labeled "Moon in Taurus" all day; the Moon entered Gemini at 12:26. Sky panel and Home say Gemini, Calendar says Taurus. | `/tides/week` gives 2026-09-30 Taurus; `/tides/now` at 14:24 CDT gives Gemini. A day with an ingress should say both. |
| B2 | Moon ⚹ Mars listed twice in Agenda, at 3:53pm (0.7°) and 5:53pm (1.9°). | Agenda text for 2026-09-30. |
| B3 | Mixed clock formats in one list: "00:00", "12:26" (void-Moon rows) beside "3:53pm". | Agenda, `minutesToTime` vs `fmtTime`. |
| B4 | "No timing data." shown while the 42-day request loads (~10s). A loading state reading as an absence. | Month day panel on first load. |
| B5 | "a slack-water stretch" in the day panel's void note: instrument vocabulary on a plain surface (CLAUDE.md, WORLDBOOK §2). | Month day panel. |
| B6 | Raw ISO dates: "due 2026-09-28". | Agenda "Still open". |
| B7 | The first request after a new account's sync returns 401; the next succeeds. Seen twice today. Affects brand-new accounts. | Scratch API, `/api/habits` POST right after `/account/sync`. |

## Outcome · September 30

Built as approved, measured on the same scratch account.

- Home: desktop 1,703px → 1,328px, phone 2,254px → 1,715px, with Due today
  added. The request box now starts inside the first phone screen (642px).
  H2 reads the Moon: "The Moon is in Gemini, waning and 80% lit, and makes an
  exact sextile to Mars at 3:06pm."
- H10 only partly landed: the header's panel switch and account became icons,
  but at 375px four destinations at 44px touch targets still need their own
  row, so the phone header stays two rows (133px). One row would mean smaller
  targets.
- Calendar opens on Week on desktop; phones keep Agenda, since a week at
  375px shows two and a half columns.
- Day view: aspects are marked at the minute they perfect ("Moon sextile Mars
  · exact 3:06pm"), outer planets included, with an "Exact today" list beside
  the grid. The Month day panel and Agenda read the same source
  (`/api/tides/perfections`, `lib/perfections.ts`).
- B1–B6 fixed. The 90-day feed's Moon aspects now agree with the day search to
  within a second across a checked week (16 of 16), where they had run about
  45 minutes late and doubled.
- B7 was not an app bug: the client's session interceptor replaced the test
  script's explicit token with the previous scratch account's stored one. A
  real sign-up has no stale token.
