# Project handoff — 2026-08-10, end of session

For a fresh Claude instance picking this up cold. Read this before anything
else; the persistent memory system (`~/.claude/projects/.../memory/MEMORY.md`)
has the deep history — this is "what's true right now and what to do next."

---

## 0. DO THIS FIRST — an open infrastructure question

**Two consecutive pushes to `main` have passed CI cleanly and NOT resulted in
a new Railway deploy landing, over an hour later.**

- `f55fe0d` — CI passed 2026-08-10 14:17 UTC
- `5045e56` — CI passed 2026-08-10 15:59 UTC
- The live asset at `compass.day` still carries `last-modified: 00:55:35 GMT`
  — from BEFORE either of those commits, and before several others today.

Earlier the same day, a genuinely stuck push turned out to be a real CI
failure (see §3) — but these two are confirmed green on GitHub Actions
(`gh run list --branch main`), so this is a **different** problem: either
Railway's auto-deploy trigger from GitHub isn't firing, or its own build is
stuck/queued/failing for a reason CI can't see (Railway runs its own
`pnpm test` inside `railway.toml`'s build command, separately from GitHub
Actions).

**I cannot diagnose this further from here** — this sandbox cannot reach
Railway's own API (`backboard.railway.com` times out; `compass.day` and
general internet are fine, so it's not a general network problem). Charlie
needs to open the Railway dashboard (`tides-api` service → Deployments) and
look directly. If you're a fresh instance and Charlie hasn't mentioned this,
**ask him to check it before doing anything else** — otherwise you may spend
an hour verifying more work that also won't reach production.

How to check for yourself once you're up to speed:
```bash
curl -sI "https://compass.day/$(curl -s https://compass.day/ | grep -oE '/assets/index-[^"]+\.js' | head -1)" | grep -i last-modified
```
Compare against `git log -1 --format=%ci` on `main`. If they're far apart,
the deploy pipeline needs Charlie's eyes, not another push.

---

## 1. What Compass is, in one paragraph

A closed-beta astrology-based timing app (compass.day). Deterministic engine
— own ephemeris, planetary hours, dignity, classical electional rules — with
an LLM only for the conversational "Ask" advisor. Monorepo: `artifacts/tides`
(React+TS+Vite frontend), `artifacts/api-server` (Express), `lib/db`
(Drizzle/Neon), pnpm workspaces. The product's whole differentiator is
refusing to fabricate: it never invents work, treats an empty day as a valid
answer, and a caption apologizing for a chart's limits is treated as proof
the chart is wrong, not a fix.

## 2. Standing rules — violate none of these

- **Root `.env` is PRODUCTION Neon.** Never run a bare `npx tsx .../index.ts`
  or start the API any way except the `api-scratch` launch config (a
  `.claude/launch.json` entry pointing at a scratch DB). This has bitten
  before.
- **`TEST_DATABASE_URL` is a deliberately different variable from
  `DATABASE_URL`** so integration tests can never inherit production by
  accident.
- **Production deploys/pushes to `main` need a real go-ahead** — Charlie has
  been generous with standing authorization this session ("work thru the
  things from GPT that make sense," "you can merge") but that's contextual
  trust built over a long session, not a blanket rule. When picking this up
  fresh, confirm before pushing to `main`.
- **Compass never invents work. Occupancy is never the target. Gaps and
  refusals are output, with reasons, never silent drops. A disclaimer means
  the design is wrong.** These are load-bearing product values, not style
  preferences — they've driven real engineering decisions all session (see
  §5, the `heldBack` refusal-with-reason work, the outage-state work).
- **CI runs the full suite three times** — `America/Chicago`, `Asia/Kolkata`,
  `UTC` (`.github/workflows/ci.yml`). A change that touches anything
  date/time-related MUST be run under all three locally before pushing.
  `TZ=Asia/Kolkata npx vitest run` etc. This burned a full cycle today (§3) —
  don't repeat it.
- **Verify before claiming a deploy landed.** `healthz` returning "ok" only
  proves *some* instance is up — it can be the OLD one. Check the actual
  asset `last-modified` timestamp, or better, ask for the specific commit CI
  ran against.

## 3. What actually shipped today (2026-08-10), verified

All on `main`, pushed, CI-green (deploy status: see §0).

1. **The full audit response** (from `AUDIT-2026-08-08.md`, three parallel
   sweeps done 2 days prior): credential rotation (Neon password — **done,
   confirmed by Charlie**), the leaked `ical.ts` route deleted, rate limiting
   fixed to key on IP alone (a first attempt at `ip·testerId` composite keys
   was measured to still be bypassable — always measure, don't assume a fix
   works), CORS restricted from wildcard to `compass.day`+localhost, body
   limit 50mb→2mb, security headers restored (died silently when the app
   moved from Vercel to Railway).
2. **Civil-time / DST overhaul** — the biggest single piece. `localClock.ts`
   gained zone-aware functions (`offsetMinutesFor`, `dayBoundsInZone`,
   `civilDayOffsetIn`) using only Node's built-in `Intl` (no new dependency —
   full IANA tz data ships with Node). Threaded as an *optional* `timeZone`
   parameter alongside the existing numeric `tzOffsetMin` through
   `computeDayArc`, `computeElections`, `dayTimeline`, `weaveDay`,
   `weaveWeek`, `findLongSessions` — every existing caller that doesn't pass
   it keeps exact old behavior. **Caught a real sign-inversion bug in my own
   new code** via the tests written to prove it correct (Chicago winter
   computed as -360 instead of +360) — write the test, then trust what it
   says, even about your own fresh code.
3. **The CI timezone lesson** — a push failed CI (not Railway) because
   `tests/dayWeaver.test.ts` was the one test file that didn't get the
   "state the process's own offset explicitly" fixture treatment two sibling
   files got earlier. Reproduced locally with `TZ=Asia/Kolkata`, fixed, then
   ran the FULL suite under all three CI zones before pushing again — now
   standard practice for anything date-adjacent.
4. **GPT's "one authority" ruling, executed** — full reasoning in
   `HANDOFF-ONE-AUTHORITY-DECISION-2026-08-10.md`. Four modules besides the
   canonical `electionEngine.ts` independently judge "is this well-timed":
   `inceptionElection.ts` and `synthesis.ts` were ruled **DECLARE
   DIFFERENT** (legitimately different questions — no code changed).
   `timingTier.ts` and `studioCard.ts` were ruled **RECONCILE**. What
   actually got reconciled, after reading the real callers (the ticket's
   framing didn't survive contact with the code): `rehome.ts` now asks the
   canonical engine's `suitability` *before* ranking by the elemental curve,
   excluding real `defer` moments — pinned to a REAL date found by scanning
   (Mercury stationing retrograde, 2026-02-25, `sign-contract`), not a
   synthetic one. The overrun-cascade route can now escalate a verdict to
   "breaks" on a genuine canonical objection. `inceptionElection`'s expiring
   hardcoded eclipse table was replaced with the same `eclipseWindow()`
   geometry the canonical engine uses. The backwards dependency
   (`electionEngine` importing `scanMoonPerfections` FROM `studioCard`, its
   own presentation layer) is closed — moved to `astro.ts` next to
   `eclipseWindow`. **Studio's actual scoring reconciliation (the drifted
   `1.15` vs `1.1` constants) was explicitly NOT touched** — GPT's own
   migration order calls this Pass 4, needing Charlie's manual visual
   comparison of generated cards before/after. Don't start this without him.
5. **Two spun-off background sessions merged clean**: dignity/houses test
   coverage, and a ~1,600-line dead-code sweep.

## 4. Loose threads — pick up in roughly this order

1. **§0, the deploy question.** Blocking everything else in practice, since
   nothing ships until it's resolved.
2. **`ActivityAssessment` completion** — GPT's "Pass 3," the actual
   architectural centerpiece of the one-authority work. Currently
   `evaluateActivityInterval()` returns suitability/backgroundFit/transitions
   but not `supportLevel`/evidence families/personal reinforcement — those
   still live only in `computeElections()`, computed separately. GPT called
   this "the highest-leverage architecture step in the whole handoff" and
   explicitly said it "deserves a focused pass," not a tail-end add-on.
   Needs its own session.
3. **Studio reconciliation (Pass 4)** — needs Charlie generating and
   comparing cards before/after any scoring change. Do not touch
   `studioCard.ts`'s actual weights without him.
4. **Three stale worktrees** in `.claude/worktrees/`:
   - `heuristic-stonebraker-94fb14` — empty, zero commits, safe to remove.
   - `inspiring-liskov-73ff3b` — the accessibility pass, **genuinely
     unfinished**: 12 files touched, nothing committed, still branched off
     `58f6813` (pre-dates most of today's `main`). Either finish it properly
     rebased onto current `main`, or restart it fresh — don't merge it as-is.
   - `xenodochial-jennings-e5c728` — has a real commit, but it re-solves a
     flaky-test problem already fixed differently on `main`. Redundant, safe
     to discard.
5. **Rate-limit key note**: IP-only keying is measured-correct, but means
   users behind one NAT/office share a bucket at 1000/15min. Fine for beta
   scale; revisit if it ever causes real friction.
6. **`notifier.ts:260`** still defaults missing coordinates to New York for
   email sends (flagged in the original audit, not yet fixed — lower
   priority than everything above).

## 5. Where the deeper context lives

- `artifacts/tides/AUDIT-2026-08-08.md` — the original three-sweep audit.
- `artifacts/tides/HANDOFF-ONE-AUTHORITY-DECISION-2026-08-10.md` — the full
  GPT exchange on the four graders, both directions (my handoff out, GPT's
  ruling back).
- `artifacts/tides/BACKLOG.md` — the long-running project backlog, mostly
  predates this session's work but still has real open items.
- The memory system (`~/.claude/projects/.../memory/`) — `MEMORY.md` is the
  index; each linked file is a specific lesson or piece of project history.
  Read it; it's opinionated on purpose (e.g. "measure, don't read," "a
  paused query never errors," "the barrel defeats the guard") and will save
  you from re-learning things the hard way.

## 6. A pattern worth carrying forward

More than once today, a finding described in prose ("X is broken," "Y
duplicates Z") turned out to be *real but not shaped the way the description
implied* once I actually read the callers — `timingTier.ts` never gated
anything, so "delete its judgment authority" would have been the wrong fix
for the actual problem underneath it. Verify against the code before
executing a plan, even a good one from a trusted source. Same discipline
applies to deploy status, CI status, and "is this actually fixed" — measure,
don't assume.
