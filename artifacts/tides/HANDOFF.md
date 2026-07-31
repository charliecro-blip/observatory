# Handoff — Compass, as of 2026-07-31

*For the next session. The owner is Charlie, in Austin, and was present and
steering throughout — mostly by asking short, sharp questions that turned out to
be right. ("the moon has already moved into pisces" started the audit that found
six defects.)*

---

## Read these first, in this order

1. **`BACKLOG.md`** — the consolidated list. **§9** (shipping while beta users
   are on the app) and **§10** (the timing audit) are new and are the two most
   useful sections in it.
2. This file.
3. `LANGUAGE-STUDY-2026-07-30.md` — new. The voice, Mercury-sign register, and
   "rhythm" as the brand line.
4. `PRICING-AND-MARKETING-2026-07-29.md`, `COMPETITIVE-UX-2026-07-29.md` (+
   appendix), `PAYING-PERSONAS-2026-07-29.md`,
   `USER-SIMULATIONS-2026-07-29-MONTH.md`, `EMAIL-STUDY-2026-07-30.md` — the
   studies. Don't re-run them.

---

## The habit that produced everything valuable here

**Measure it. Don't read it.**

The last handoff said "verify before asserting." This session sharpened that:
*for anything numeric, compute the truth separately and subtract.* Almost
nothing below was findable by reading — and in three cases the code carried a
comment asserting the approximation was fine.

- The **timing audit** found **six defects** across five surfaces. The rail said
  a void lifted at 08:01 when it lifted at 07:13 — a scan stepping in one-HOUR
  jumps, up to **58 minutes** wrong. An aspect perfecting in 32 minutes was
  reported as **6.6 hours** away. A crossing already underway reported orb 2.25°
  against a true 0.002°. Every one produced a *plausible* number.
- Rendering the **election card** and looking at it caught four things — it
  listed "Moon void of course · Via combusta" as the *reasons* to launch a
  business (those are hazards AVOIDED; only `severity: support` rules are
  reasons), and offered 2:29 AM.
- Using the **Planner's new move verb** exposed day headers rendering Friday,
  Monday, Sunday.
- Seeding 42 historical completions rendered **"Today's wins · 42"** — the wake
  ledger dated finished tasks by `updatedAt`, which moves on any edit.

**Two things I got wrong and corrected mid-session.** Both traps are still live:

- I reported timing fixes as accurate "to 0.64 s". They weren't. **The ephemeris
  quantises time to 30 seconds**; those figures measured agreement between two
  searches over the same quantised data. Honest claim: the scan-grid error
  (6–58 min) is gone, a ±30 s floor remains, and no refinement in the callers
  beats it.
- A test sliced between two markers where the second occurs *earlier* in the
  file. The slice was empty and the assertion passed against `""`. It went green
  before I'd written the code it covered — which is the tell.

---

## State of play

**Branches:** `feat/tides-app` and `main` identical and pushed. CI green.
**22 commits this session · 147 tests + 1 opt-in integration test · tree clean.**
**Deploy:** Railway → `compass.day`, verified live after every push.

### Shipped

**P0-B is closed.** Chronotype-relative ritual (morning = wake→+4h, evening =
last 3h before sleep, grace either side, wall-clock only as fallback); account
deletion (targets **derived from the schema**, so a new table can't escape it;
Google grant revoked before the row is dropped); the dark-mode pass (**146 → 15**
contrast failures; light mode unchanged, 386→387, re-measured from a stash).

**The daily loop was rebuilt around behaviour.** Owner asked whether the
aligned/mixed/off rating was worth anything. It wasn't — traced to **zero**
references in electionEngine, election, synthesis, dayarc, interpretation or
plan. It changed no recommendation anywhere, and it was confounded by its own
advice ("a Deep day, rest" → you rest → "did that feel right?"). Removed. The
panel now reads completions per tide character *and per void day*. This required
adding `tasks.completed_at`, which had never existed — so *when* work happened
was unrecordable no matter how much anyone did.

**Also:** client crash reporting (`/api/events/errors`, deduped, admin-gated);
the Google Calendar **reconnect** state (Testing mode drops tokens weekly and the
app used to keep saying "Connected" over an empty calendar); two starter dailies
on first run; the in-app **guide**; the Planner's "move, not just drop"; the
**election card** (`/studio/election.png`); weekly + New Moon email fixes; and
`POST /planning/windows/:id/complete` finally wired — it had shipped with the
Planner and was never called, so a third of the new pattern's evidence was
structurally empty.

---

## Careful — these will bite you

- **The ephemeris is quantised to 30 seconds.** Don't chase sub-minute precision;
  replace the ephemeris if it's genuinely needed. Test 33 pins this.
- **`drizzle-kit push` runs on every deploy.** Additive-only while beta is live —
  BACKLOG §9a has the safe/unsafe table. A rename reads as drop-and-add and takes
  the data with it. Migrations need a *supervised* baseline.
- **`pnpm run typecheck` (root) is RED** and always has been — legacy
  health-tracker libs. Both Compass apps typecheck clean in their own builds.
- **`cd` inside a compound Bash command persists.** I lost minutes twice to
  commands silently running from `artifacts/api-server`. `cd` to the repo root
  explicitly at the start of anything that matters.
- **The preview server cannot read `.env`** (sandboxed). Run the API through Bash
  with the incantation. The `api` entry in `.claude/launch.json` cannot work as
  written; I reverted my attempt rather than leave it broken.
- **There are TWO election systems.** `lib/election.ts` (`ELECTION_CATEGORIES`:
  business_launch, date, conversation…) is what the Begin screen and the new card
  use. `lib/electionEngine.ts` has its own `ACTIVITIES` (endurance, haircut,
  negotiate…). Building against the wrong one gives a beautiful picture of a
  different question.
- **Cloudflare caches `compass.day`.** Two "not deployed yet" readings of mine
  were wrong because of it — check the JS bundle, not just a page.
- **`git add -A` swept an unrelated feature into a commit** while I was pivoting.
  It shipped unverified under a message that didn't mention it. Stage
  deliberately when you're mid-pivot.

---

## What I'd do next

1. **Live NL parse preview in Quick Capture** — capture parses no dates at all
   today, so "report by Fri" is just text.
2. **Consent-based cascade** — *"your 2pm ran long — shift the next three?"*
   Nobody has it. Structured refuses to ripple (its loudest unmet request),
   Motion ripples silently.
3. **Deliberate re-homing of undone work** in the evening — the other half of the
   shutdown ritual, and it finally has a verb to build on.
4. **Conversion instrumentation** — deferred by the owner (beta first), still the
   cheapest high-value item once there's something to convert.

**Needs the owner present:** real accounts (closing `testerId`-as-bearer) and the
drizzle→migrations baseline. Neither unattended.

**Owner actions outstanding:** four Railway variables — `VAPID_*`,
`RESEND_API_KEY` + `EMAIL_FROM`, and **`ADMIN_TOKEN`** (new: until it's set,
`/api/events/errors` and `/events/summary` 404 in production, deliberately) —
plus the Google OAuth publish-vs-Testing decision.

---

## Decided — don't relitigate

Everything in the previous handoff stands: nav is the loop; never "productivity"
in a headline; habit cadence stays free; don't split the beta cohort; don't copy
silent rescheduling, streaks, or fit-everything-in. Added this session:

- **The felt rating is gone.** Measure what people finish, not what they report.
  The pattern is passive — it accrues from work they were doing anyway.
- **Snark at the situation, never at the reader.** Co-Star's wit is licensed by
  not caring about you; this app spent every design decision destroying that
  distance. Lyric in the weather, plain in the instruction.
- **"Find your rhythm — it need not be linear"** is the brand line. It also
  resolves the Wake/streak contradiction: a rhythm has a beat you can miss and
  return to; a streak has a number that resets.
- **Don't bake tone into any composer.** The Mercury-sign register wants a
  `voice()` renderer over structured `Block[]`.
