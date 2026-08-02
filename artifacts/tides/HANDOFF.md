# Handoff — Compass, as of 2026-08-02

*For the next session. The owner is Charlie, in Austin. Earlier today: the
morning-email fix rippled into strategy (two GPT documents arrived and were
adopted), then a beta product pass ran. **The pass is now COMPLETE** — all five
tasks shipped and verified in the browser. The next session picks a new
frontier; see "What's actually next" below.*

---

## Read these first, in this order

1. **`BETA-PASS-2026-08-01.md`** — the pass being executed right now.
2. **`STRATEGY-CONVERSATION-2026-08-01.md`** — the adopted game plan
   (core loop, activation ladder, eight-week cycle, three gates). The rule in
   force: *no new feature unless it strengthens the core loop, resolves
   observed friction, or removes a beta risk.*
3. `AUDIT-GPT-BETA-PASS-2026-08-01.md` — GPT's product audit (converges with
   BETA-PASS; its §12 phases are the execution order).
4. `BACKLOG.md` — §0 owner actions, §3c (email parked — do NOT reopen), §9, §10.

---

## The beta pass — DONE

All five tasks shipped. The last two landed 2026-08-02 afternoon:

- ✅ **#1 Intro rework** — six slides → three (one per job, mini product
  mocks). Stale felt-rating claim removed. Restore-account link on every
  slide. "Show me today" now flows through the rhythm step — and MUST set
  `obs_birth_skipped`, or onboarding loops back to the birth form (caught live).
- ✅ **#2 Spotlight tour** — five stops over the live dashboard
  (`lib/tour.ts` = copy + versioned tester-scoped persistence,
  `components/SpotlightTour.tsx` = overlay). Replaces the "New here?" strip;
  Guide + "Replay the walkthrough" live in Settings. `tour_*` analytics.
- ✅ **#4 Nav + Plan** (owner-ratified): **Today · Plan · Stars · Calendar**;
  "Aims"→"Stars"; Plan = **Schedule / Pick a day**; Break down removed
  (parity confirmed: `runBreakdown`/`commitBreakdown` in GuidingStarsHub).
- ✅ **#3 Quiet the first session** (`a0ebaf9`) — `firstRun` in App.tsx
  (`tourArmed || tourPending`) holds back Today's three self-promoting banners
  (push opt-in, premium discovery, first-star nudge) until the walkthrough is
  answered. Rail now reads `uiDensity`: at essential it's season + moon + this
  hour, two upcoming hours not five, with a tail button to the full panel
  (Today's density toggle only exists on Today; the rail is on every view).
  §B2 closed by making ONE voice own the element word — SignChip no longer
  spells "Pisces · water", the rail's tide chip (a restatement of the hero's
  headline) is gone, and the Moon's line is labelled "The Moon's mood · next
  2½ days" so it reads as a layer, not a rival verdict. Terminology swept.
- ✅ **#5 First-Star fast path + Best next move** (`c165c5a`) — planet/element
  pickers moved behind "Adjust timing signature" (which SHOWS the reading's
  pick, e.g. "now ♃ Jupiter, fire"), so a first star costs a title and a tap.
  Creating one now asks "what's one next move?" in the spot the form
  occupied → linked task → ScheduleSuggest. **Best next move** is a new
  deterministic module (`lib/next-move.ts`, 13 tests) under the hero: six
  priority rules, each naming the sky fact it used so the claim is checkable
  against the rail; VOC is a caveat, never a veto; checking it off advances
  the pick in place.

**Verified live**, not just typechecked: fresh-account first screen (tour up,
zero banners), skip → banners return, rail collapse round-trips through the
density toggle, and the whole star → next move → ScheduleSuggest chain.

**Environment:** `.claude/launch.json` gained an **`api-scratch`** entry —
use it, not `api`. The root `.env` points `DATABASE_URL` at **production
Neon**, so the plain `api` config would run the dev server against real beta
data; `api-scratch` pins `compass_scratch` on localhost. Recreate that DB per
§9b if it's gone. Test account is in the browser profile.

---

## What's actually next

The pass is closed, so nothing is half-finished. Candidates, in the order the
game plan implies — but this is a fresh decision, not a queue:

1. **The owner's `main` advance is still the blocker** — everything from
   2026-08-01/02 (including all of the above) is invisible on compass.day.
   Nothing shipped this week has been seen by anyone but us.
2. BETA-PASS §B5 hover-only interactions (beta users will be on phones) —
   triaged "lean: beta", never executed.
3. BETA-PASS §B1's remaining question: MOMENTS AHEAD vs Waves vs ON DECK are
   still three list-like blocks answering adjacent questions.
4. AUDIT-GPT §12's later phases.

---

## Hard-won this session — do not relearn

- **The app is scaled with `zoom` on `<html>`** (textScale's `--app-zoom`,
  1.2 by default). Anything positioning fixed overlays from
  `getBoundingClientRect` will be off by that factor. SpotlightTour's fix:
  the dialog root carries `zoom: 1/appZoom` so nested zooms cancel and all
  coordinates are true visual px. Any future overlay must do the same.
- **The browser pane's screenshots composite CSS zoom WRONG.** Three
  debugging rounds were spent on a correct overlay because screenshots showed
  phantom dim. Ground truth is hit-testing: `elementFromPoint` with the
  overlay panels temporarily made hittable. Trust the DOM, not the capture.
- Giant box-shadow spotlight holes render unreliably; the dim is four plain
  rectangles. Auto-scroll fights: recenter until the USER first wheels/
  touches, then never again; "mostly visible" not "any pixel visible".
- **Same-tick JS click+read returns stale text** in the pane — click and read
  in separate calls.
- **`innerText` uppercases what CSS uppercases.** Two false "it didn't
  render" diagnoses came from grepping the DOM for "Best next move" and
  "Waves" when `text-transform` had made them "BEST NEXT MOVE" and "WAVES".
  Match case-insensitively, or check `innerHTML`.
- **The browser pane's console buffer survives navigation** and shows old
  entries with stale `?t=` module timestamps. A reload does not clear it — an
  error there may be minutes dead. Confirm against a fresh render instead.
- **Two "pre-existing" test failures were a stale spec, not noise.** The guide
  tests still asserted the "New here?" strip that the tour replaced the day
  before. Rewritten to assert what shipped; the nav-coverage one now reads
  `TOP_TABS` out of App.tsx rather than restating the labels, so the next
  rename fails loudly. (Same lesson as the typecheck-baseline one: triage a
  baseline, don't inherit it.)

## State of play

`feat/tides-app` at `c165c5a`, pushed. **`main` still not advanced — nothing
from 2026-08-01/02 is deployed**, including the email fix (owner saw the old
flat email and thought the fix failed; it was never live). 245 tests + slop
guard green; api-server/tides/typecheck:libs all 0 errors.

**Owner actions unchanged** (BACKLOG §0): advance `main`, VAPID, RESEND,
ADMIN_TOKEN, ENGINE_TOKENS (AstroLyrica is built and 503ing without it),
Google OAuth publish decision, Neon staging branch. New from game plan: write
the one-page Constitution + contrarian truth (founder work; fragments ready
in STRATEGY-CONVERSATION).

## Decided — don't relitigate

Everything in the 2026-08-01 handoff stands (LLM-rendered register, `note` as
fallback, renderer-above-vs-inside still open, email work parked in §3c).
Added: **nav order/labels are ratified** (Today·Plan·Stars·Calendar); **Plan
is two questions**; **tour replaces the guide strip** (Guide = reference in
Settings); **activation = acting on a recommendation tied to real work**, not
tour completion; the three gates (product beta / technical beta / public
paid) stay separate; postponed list in STRATEGY-CONVERSATION Part 2 holds.
