# Handoff, 2026-09-04 — big batch shipped, owner wants to re-orient

Written for a fresh Claude Code instance. The owner ended the previous
session here on purpose — wants to talk direction with a clean head, not one
anchored in the last two days of implementation. This file is state, not a
pitch: read it, then let the owner drive the re-orientation conversation.
Don't assume you know what they want to re-orient toward.

## First thing: it's committed and pushed now

Branch `claude/pluto-glyph-font-fix` (name is stale — that was the smallest
of many things that landed on it), pushed to `origin/claude/pluto-glyph-font-fix`.
Split into five commits along natural feature/file boundaries (not a single
dump), each with a message written the way this repo's own history is
written — what changed and why, not a conventional-commit label:

```
8056de4 Add your own activity, read the same way as the other fifty
eb9a81b The sky itself says where, on request — houses, crossings, a door on the new moon
725c4b2 Day gets its own tab, with a real list on it, and blocks that drag
33ab36e The rail opens quiet, the Log steps back, and a wrong element can be fixed
a7079bd One Move and the Moon's mood read like a person now, not a template
20b7bb2 Apply --font-symbol wherever a raw Pluto glyph is rendered   (background session, already there)
```

`git log -p a7079bd^..8056de4` for the full diff, or `git show <sha>` per
commit for its own message and diff. No PR opened — these went straight to
the branch, which has no protection and wasn't asked to route through one.

Still untracked, deliberately not part of this: `tools/materia/`
(medical-astrology report generator — unrelated work, see memory
`materia-medical-report-generator`) and this handoff file itself.

**Database:** a new table, `custom_activities`, is live on `compass_scratch`,
`compass_auth_test`, and `compass_deletion_test` via `drizzle-kit push` — all
three needed it, not just the one you happen to be developing against. If
this goes anywhere near production, or a DB not listed here, push it there
too: `DATABASE_URL=<target> pnpm --filter @workspace/db run push`. Never
point this at the root `.env`'s production Neon URL; see CLAUDE.md.

**A real lesson from getting this pushed**: `deleteAccount`
(`accountDeletion.ts`) derives its table list from the schema at runtime —
every exported table with a `tester_id` column is in scope automatically,
by design, so nobody has to remember to add a new table to a hand-written
list. The gate's pre-push hook runs the suite against `compass_auth_test`
specifically (not whatever `TEST_DATABASE_URL` you last used by hand), and
`tests/deletion.integration.test.ts` exercises `deleteAccount` for real. So
adding ANY new tester-scoped table and pushing its migration to only your
own dev DB will pass every manual check you run and then fail the push gate
— `deleteAccount` throws on the missing table mid-delete, orphaning rows,
which is exactly what happened here (three push attempts, three different
failure lines, before this was traced back to a missing migration rather
than flakiness). The fix, if it recurs: push the new table's schema to
`compass_auth_test` and `compass_deletion_test` too, not just wherever
you've been testing by hand.

## What shipped this session

Two work sessions, back to back. First: a big batch of the owner's own
punch-list items (screenshots + a running list, "go for them" /
"go ahead with everything else"). Second: the four largest remaining items
from that same list, after the owner picked build order via a direct
question.

**Batch 1 — smaller fixes, all verified live:**
- "One Move" and moon-mood (Gemini) copy rewritten per the owner's picked
  options (`RhythmLead.tsx`, `lib/lexicon/src/signs.ts`).
- Google Calendar "G" badges removed from week/day and month views
  (`Calendar.tsx`) — the source now shows on hover instead.
- Missing Pluto glyph: root cause was `Calendar.tsx` rendering raw glyph
  characters without the symbol font (`--font-symbol` is deliberately kept
  out of the global font chain, see `index.css`'s own comment on why).
  Fixed at every render site in this file.
- Angle-crossings list removed from the Calendar page's month-view sidebar
  (kept elsewhere — the in-context markers on the week/day grid and the
  Almanac's own crossings toggle, see below).
- Log tab off by default (`showLog` preference already existed with its own
  Settings toggle — just flipped the default, nothing deleted).
- Left rail (`Rail.tsx`) opens compact by default now; "Waves" and "Your
  transits" start closed.
- Guiding Stars: a wrongly-diagnosed element (e.g. Earth on something that
  isn't) can now be corrected in place — the picker reopens on click instead
  of only showing once, at creation.
- Home's "N tasks not tied to a star" is now a real disclosure — click to
  see the actual titles.
- Found and fixed a genuine copy bug along the way: the Almanac's aspect
  rows said "Mercury opposition Neptune / Mercury opposes Neptune" — same
  word twice. Every other aspect's plain-language gloss actually translates
  the term (square → "grinds against"); only "opposition → opposes" was a
  no-op. Fixed in both copies of that table (client `AlmanacView.tsx` +
  server `almanac.ts`) — this repo has a known "two copy tables drift"
  failure mode, see memory `two-copy-tables`.

**Batch 2 — the four big items, owner-ordered (day view first):**

1. **Day view is a real top-level tab now** (Calendar switcher: Agenda,
   Day, Week, Month, Almanac). It reverses a documented, deliberate design
   call — Day used to be reachable only by zooming in from Week, on
   purpose, with a comment explaining why. The owner explicitly asked to
   reverse it and picked this as the first thing to build. New:
   `DayListPanel` (tasks due + habits, both with **working** checkboxes —
   caught and fixed a real bug here, the first checkbox implementation
   always sent `done: false` regardless of state).

2. **Almanac → schedule wiring.** `ActivityWeek.tsx`'s click-to-reveal
   panel now has a real "Schedule this →" button (reuses the existing
   `POST /api/planning/windows` pattern from `ScheduleSuggest.tsx`).

3. **Sky Itself reversed its "no location" stance without crossing into a
   verdict.** The file's own doctrine ("a fixed date has no verdict and a
   verdict has no fixed date") is still true — what changed is *where*, not
   *whether*:
   - House context: with a chart on file, every entry says which whole-sign
     house it falls in. New optional `personal` param on `buildAlmanac`
     (backward compatible — every existing caller and test still passes no
     4th argument and stays green).
   - New Moon rows get a plain "Start something here →" link into Guiding
     Stars — a door, not a grade.
   - Angle crossings are now an opt-in toggle on the Almanac page itself
     (off by default — they run roughly one a day, capped to a 14-day
     horizon). Reuses the *exact* `getNextAngularCrossings` call
     `/tides/week` already proves safe across 42 days — deliberately did
     NOT touch the election engine's own hour-only-window suppression
     doctrine, which is a separate, carefully-tuned, well-commented piece
     of logic that a "toggle planetary hours" request could easily have
     been misread as wanting changed.
   - Caught a second real bug in verification: the crossing note said "a
     brief window, about 324 minutes" — that's the WIDE 40° detection orb's
     duration, not the ~26-minute window every other surface in the app
     quotes for a crossing. Fixed to match.

4. **Custom activities** — the owner's biggest ask: "an option for people
   to add their own [activity]... sortage into different astrological
   energies and create rule sets for." New `custom_activities` table,
   shaped identically to `ActivityCorrespondence` (the built-in 50-activity
   table) on purpose — a custom activity isn't a second-class kind of
   activity, it's a per-tester row the SAME election engine reads via a new
   optional `extraActivities` param threaded through `computeElections` and
   `evaluateActivityInterval`. Auto-diagnosed the same way a Guiding Star
   already is (`associateDeterministic`, no AI call, matching
   `GuidingStarsHub`'s own behavior exactly). Missing rule-set fields
   (houses, hourRulers) get a defensible classical default — a planet's own
   natural-rulership house(s) — rather than an empty rule set. New UI lives
   directly in `ActivityWeek`'s picker ("+ add yours"), not a separate
   settings page, since making one and immediately seeing its week is the
   point. Has a dedup guard: creating "Practice guitar" correctly refuses
   and points at the built-in "Learn a new skill" instead of shadowing it.

5. **Drag-and-drop on the week grid.** No backend work needed —
   `PATCH /planning/windows/:id` already took `startTime`/`endTime`. Native
   HTML5 DnD; drop targets are the same hour-cells "click to add" already
   uses. Deliberately does NOT touch the existing cascade/ripple endpoint —
   a drag moves only the one block, matching the codebase's own stated
   philosophy that a window is a claim about a moment, not a slot. Browser
   automation can't simulate a real OS drag gesture, so this was verified
   by dispatching genuine `DragEvent`s through the actual handlers and
   confirming the PATCH landed with correct new day/hour and preserved
   duration.

## Verification status

- `pnpm run typecheck` (full workspace): clean.
- Full suite: **1269/1269 passing**, in America/Chicago, Asia/Kolkata, and
  UTC for everything date/sky-adjacent.
- Every item above was also checked live against the running app (mint a
  scratch session per CLAUDE.md's recipe, not the sign-in UI), not just
  via tests — including a synthetic natal chart via direct API call to
  verify house-context math end to end (Leo ascendant → "Autumn equinox,
  Sun enters Libra" correctly reads as house 3).

## One item from the owner's original list is still open

**"Read Your Week" (`CalendarAudit.tsx`) — "doesn't look helpful in its
current form, what is that for?"** Traced but not fixed: it *does* have a
real payoff (pick a kind → the same panel immediately reclassifies that
event with a verdict), the payoff is just easy to miss. Nothing done here
yet — flagged, not started.

## For the re-orientation conversation

The owner said they want "a pretty big re-orientation" and asked for a
fresh instance on purpose. No guess is recorded here about what that means
— don't lead with one. What's true as of this handoff:

- The last ~19-item punch list is fully closed except Read Your Week (above).
- A large amount of genuinely new surface area landed in one push: a new
  DB table, a new opt-in personalization path on a previously-strictly-
  impersonal endpoint, a reversal of one documented "not a tab, on purpose"
  design decision, and a first drag-and-drop interaction in an app that had
  none. It's committed and pushed to this branch now (not main, not
  deployed). If the re-orientation changes direction in a way that makes
  some of this the wrong shape, it's still just a branch — revert, rebase,
  or cherry-pick around it rather than treating it as locked in.
- Relevant background for the conversation, not to be assumed as settled:
  the app's names have moved before (Tides → Auspice → Compass), the nav
  shape has been rebuilt more than once, and Log was just set aside "to
  explore some other time" — see memory `auspice-rebrand-and-studio` and
  the git log around 2026-08-19 to 2026-08-20 for that pattern if it's
  relevant to whatever the owner raises.

## Orientation notes for whoever picks this up

- CLAUDE.md at repo root is load-bearing — read it before doing anything
  that touches the database, pushes, or deploys.
- Local sign-in: don't use the UI (trust-on-first-use window is shut). Mint
  a session directly — see CLAUDE.md's exact recipe (`/api/account/sync`
  with a fresh tester id, then the right five localStorage keys, display
  name included — it's easy to end up with a valid token and a blank
  sign-in screen if you skip `obs_display_name`).
- Start the API only via the `api-scratch` launch config. The root `.env`
  is production Neon.
- From a worktree, the `tides` launch config silently serves `main`, not
  the worktree — see CLAUDE.md, this has bitten a session before.
- Memory files under this session's memory directory have a lot of
  standing context (design history, house rules the owner has stated more
  than once, prior audits) — worth a skim before assuming something is
  undecided.
