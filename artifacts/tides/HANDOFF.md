# Handoff — Compass, as of 2026-08-02

*For the next session. The owner is Charlie, in Austin. This session: the
morning-email fix rippled into strategy (two GPT documents arrived and were
adopted), then a beta product pass began mid-day and is HALF DONE. Pick up the
task list, not a new idea.*

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

## The beta pass — exactly where it stands

Task list (in the session task tracker, and mirrored here):

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
- ⏳ **#3 Quiet the first session** — suppress notification/premium banners
  until tour done; collapse the rail at essential density (it currently shows
  the full instrument panel at astroDetail=medium); hero owns element
  language + Moon chip gets a "Moon's mood" micro-label (the in-app
  fire/water contradiction, BETA-PASS §B2). Fold in the terminology sweep:
  grep user-facing strings for stray "Aims" / "North Star".
- ⏳ **#5 First-Star fast path + Best next move** — PROMOTED by the game plan
  (its Week 3 centerpiece and the activation event). Star creation: title +
  optional why, auto-diagnose, overrides behind "Adjust timing signature",
  then "what's one next move?" Best next move: deterministic, under the hero,
  scoped as the top Waves pick + why + window remaining.

**Environment:** dev server + `compass_scratch` DB may still be running from
this session; recreate per §9b if not. Test account in the browser profile.

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

## State of play

`feat/tides-app` at `f2573cb`, pushed. **`main` still not advanced — nothing
from 2026-08-01/02 is deployed**, including the email fix (owner saw the old
flat email and thought the fix failed; it was never live). 231 tests + slop
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
