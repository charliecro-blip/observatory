# Handoff — Compass, as of 2026-08-02 (late)

*For the next session. The owner is Charlie, in Austin. A long day: the beta
pass finished, then the owner ran their own first-run pass, then an external
power-user audit arrived. All three are closed and deployed — **`main` is live
at compass.day**, verified five times by fetching the served bundle and
grepping for strings that can only exist in the new build, never by health
check alone.*

**Start here:** `POWER-USER-AUDIT-2026-08-02.md` — all ten P0s shipped, what
each actually turned out to be, and the P1 list nobody has started.
`FIRST-RUN-PASS-2026-08-02.md` holds the owner's own pass.

**The one live thread:** a background session is removing dead components from
`Today.tsx` and had uncommitted work in that file *and* in
`tests/honest-claims.test.ts` at handoff. Check it landed before editing
either. A small conflict in that test is expected and trivial — both sides are
fixing the same thing (see "the dead-code trap" below).

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

## The follow-up pass — also DONE, also deployed

Same session, after the beta pass closed. The owner said "do everything";
this is what "everything" turned out to mean, checked one item at a time
rather than assumed:

- ✅ **§B5 hover-only interactions** (`8016cc6`) — the HelpBadge glossary (11
  terms) and Calendar's aspect-crossing explainer were mouse-only with no
  click fallback; on a phone (no hover) both were simply unreachable, not
  degraded. `Tooltip.tsx` gained a `pinned` state — tap toggles it, a
  full-screen catcher dismisses on tap-elsewhere. Calendar needed a SEPARATE
  `pinnedCross` state rather than reusing `hoverCross`: on desktop, clicking a
  crossing line happens after hover already set `hoverCross`, so toggling
  that same state on click would hide it the instant it's clicked.
- ✅ **§B1 list-block redundancy** (`b1ff717`) — "Moments ahead" turned out to
  already be a sub-section of Waves, not a separate card. The real defect was
  one level in: Waves' own "Goals" row fetched `/api/planning/goals` with
  **no status filter** and rendered up to four of them under "what to ride
  today" — a paused or completed star looked exactly as ridable as an active
  one, duplicating the Dashboard's Guiding Stars card (which correctly
  filters to active + shows weekly progress). Removed the query and the row;
  On Deck stays separate since it's a genuinely different question (scheduled
  windows vs. unscheduled tasks).
- ✅ **AUDIT-GPT §13 acceptance-criteria audit** (`500856e`) — checked every
  criterion against the actual shipped state rather than assuming the beta
  pass covered it. All but one already held (Plan's two top-level modes,
  restore-account on every slide, the chartless→rhythm path, the mobile/
  desktop nav-tabs anchors being mutually exclusive so the tour's last step
  never silently drops on phones, `tour_*` vs `next_move_*`/`task_add`
  analytics already distinguishing completion from activation). The one gap:
  Planets.tsx told users to "rate the day **on Today**" — twice — but the
  daily felt-rating nudge was removed from Today on 2026-07-31 (write-only,
  confounded by its own advice) while the rating mechanism itself stayed
  alive in Log's evening reflection composer. Nobody had updated the copy
  pointing at the old location.

**`main` is now at `500856e`, deployed twice this session.** Both deploys
verified past the health check — `curl`'d the actual served JS bundle by its
hash and grepped for strings that could only exist in the new build (first
"Best next move" / "Adjust timing signature" / "The Moon's mood"; then
"log how the day went" / "log a few days"). A green healthz proves the OLD
build didn't crash; it doesn't prove the NEW one is what's serving —
fetching the bundle by hash is the check that actually distinguishes them.

---

## What's actually next

Nothing is queued or half-finished. Candidates for a genuinely fresh pick:

1. BETA-PASS's remaining open owner decision: friends-beta with an
   un-lawyered privacy policy — yes/no, still unanswered.
2. Owner actions from BACKLOG §0: VAPID, RESEND, ADMIN_TOKEN, ENGINE_TOKENS,
   Google OAuth publish decision, Neon staging branch (§9b).
3. AUDIT-GPT §12 Phase 5 — first-session validation with five real people who
   haven't seen the product (this is qualitative, can't be automated).
4. Whatever the STRATEGY-CONVERSATION eight-week cycle calls for next —
   re-read it fresh rather than assume where "week 3" left off.

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
- **A green `/api/healthz` only proves the OLD build didn't crash.** After
  pushing to `main`, fetch `https://compass.day/` for the `index-*.js` bundle
  hash and confirm it changed, then `curl` that bundle and grep for a string
  that could only exist in the new code. Two deploys this session were
  confirmed this way; healthz alone would have looked identical either way.
- **"Removed" doesn't always mean removed — check where it MOVED.**
  Planets.tsx's stale "rate the day on Today" copy survived because the
  daily felt-rating *nudge* was retired from Today, but the felt-rating
  *mechanism* is still alive in Log's evening reflection. Grepping for the
  retired feature's name isn't enough; check whether the capability
  relocated before assuming the reference is simply dead.

## State of play

`feat/tides-app` and `main` both at `500856e`, pushed, and `main` is the
build actually serving compass.day (verified by bundle hash + content, not
just health check). 245 tests + slop guard green; api-server/tides/
typecheck:libs all 0 errors. Nothing outstanding from this session.

**Owner actions unchanged** (BACKLOG §0): VAPID, RESEND, ADMIN_TOKEN,
ENGINE_TOKENS (AstroLyrica is built and 503ing without it), Google OAuth
publish decision, Neon staging branch (§9b — `main`'s advance no longer
needs this as an excuse; it's just still good practice). New from game plan:
write the one-page Constitution + contrarian truth (founder work; fragments
ready in STRATEGY-CONVERSATION).

## Decided — don't relitigate

Everything in the 2026-08-01 handoff stands (LLM-rendered register, `note` as
fallback, renderer-above-vs-inside still open, email work parked in §3c).
Added: **nav order/labels are ratified** (Today·Plan·Stars·Calendar); **Plan
is two questions**; **tour replaces the guide strip** (Guide = reference in
Settings); **activation = acting on a recommendation tied to real work**, not
tour completion; the three gates (product beta / technical beta / public
paid) stay separate; postponed list in STRATEGY-CONVERSATION Part 2 holds.
