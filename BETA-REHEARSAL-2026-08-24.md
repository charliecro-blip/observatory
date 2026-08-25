# Clean-account rehearsal — 2026-08-24

Run against `c16c32d` on a genuinely fresh account (localStorage cleared, new
signup) with the **scratch** API and database, not production. Production was
deliberately not used: step 21 deletes an account, and creating then destroying
real records on the live database was not something to do unasked.

**14 of 21 steps pass. 3 are blocked on the owner. 4 are partly covered.**

The handoff asked for this result to be written down. This is that.

## Passed

| # | Step | Result |
|---|------|--------|
| 1 | New signup | Intro carousel, name, account created |
| 2 | Skip chart | "Show me today" works; chart genuinely optional |
| 3 | Minimum onboarding | Completes; session token AND recovery code both arrive at "Enter Compass" |
| 4 | Add three tasks | Capture works; **"…tomorrow" parsed into a due date** — title "Draft the quarterly report", due 2026-08-25 |
| 6 | Add a habit | 201 |
| 7 | Complete habit | 201, `doneToday: true` |
| 8 | Add a Star | 201 |
| 10 | Shape Today | 2 placed, 0 refused |
| 13 | Shape Week | `calendar: {consulted: true, connected: false}`, no false warning |
| 15 | Log the day | 200 |
| 16 | Open historical Log | Loads a past day correctly |
| 19 | Calendar feed | Feed token correctly **inactive** until opted in |
| 20 | Break a request | Bad session → honest 401 `session_required` |
| 21 | Delete account | Refuses without the confirmation phrase; then erases 20 rows across 33 tables |

Also verified in the same run, not in the table because they are not numbered
steps:

- **All four Spotlight Tour steps fire on a cold start**, including step 2 of 4
  (`home-answer`), which had been silently skipping since `825b08e`. This is the
  runtime half the anchor regression test cannot prove.
- **All four Home zones render at 375×812 with zero horizontal overflow.**
- Shape Week's quiet state is honest: "5 days are deliberately open. Nothing you
  hold needed placing there."

## Blocked on the owner

| # | Step | Why |
|---|------|-----|
| 11 | Connect Google Calendar | Needs the owner's Google account |
| 12 | Verify collision avoidance | Depends on 11 |
| 14 | Verify Shape Week avoids every commitment | Depends on 11 |
| 17 | Restore on a second device | Needs a genuinely separate browser profile |

**This is the gap that matters most.** The tests prove `weaveWeek` and
`findLongSessions` avoid *synthetic* commitments. Nothing has yet exercised the
real OAuth path delivering real busy time into them. Until steps 11/12/14 are
done by hand, the calendar-truth work is proven in the weaver and unproven end
to end.

## Partly covered

- **Step 5** (close/reopen the browser) was a reload, not a real relaunch.
- **Step 18** (export) — Settings offers `/api/export/ical`, which answers 200.
  A full data export beyond the calendar feed was not located.
- **Pointer input** was exercised least. The browser pane stopped compositing
  part-way through, so most interaction was driven by focusing elements in
  script and sending real key events. Click-path bugs are the class this run is
  weakest against.
- **Analytics funnel** was not audited against the handoff's event list.

## A 200 that was not a hole

After deleting the account, the old session token still returned 200 on
`/api/tasks` — and so did a made-up token, and no token at all. That reads as a
broken guard.

It is not one. An account that still **has** a profile row returns 401 to both
a wrong token and no token. The 200s were a profile-less id taking the
first-use path and receiving an empty list. No data leaks.

One real residue: a write with the old token after deletion returns 201 and
creates an empty account under the dead id. Untidy, not a leak.

## Findings this run produced that are NOT yet fixed

1. **The `"great" times` copy is still live** on the birth-chart onboarding
   step — one of the exact strings the handoff asked to remove.
2. **Onboarding is five screens before any value**: intro, name, astrology
   detail, working rhythm, birth chart, chronotype. The handoff's target is
   name → how should Compass meet me → three real things → the product.
3. **Historical `DayCheckOff` still lists current open tasks** on past days. The
   shared `localToday()` half was fixed; this half was not.

## Credential rotation — the item Git cannot answer

The handoff correctly notes that a previously committed production database
credential cannot be verified as revoked from the repository, and asks that the
confirmation be recorded somewhere operationally appropriate.

**It was rotated and confirmed on 2026-08-10.** The leaked Neon connection
string, tracked in `.claude/settings.local.json` since `512e68f` in a public
repo, was rotated by the owner in the Neon console, confirmed in session, and
both Railway's `DATABASE_URL` and the local `.env` were updated to the new
password. The old string is dead. See `artifacts/tides/AUDIT-2026-08-08.md`
(commit `a5f4adb`) for the audit that found it.

This file is that record. No secret is written here.
