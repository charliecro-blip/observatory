# Handoff — Compass, as of 2026-08-01

*For the next session. The owner is Charlie, in Austin. This session ran on very
short prompts — "keep going", "go ahead and fix" — plus one observation about a
morning email that turned out to be the most valuable thing in it.*

---

## Read these first, in this order

1. **`BACKLOG.md`** — §0 (owner actions; one is NEW and blocks an entire
   integration), then §9 and §10.
2. This file.
3. `LANGUAGE-STUDY-2026-07-30.md` — §3 (Mercury register) and §5 (AstroLyrica)
   are now settled decisions, not open questions. See "Decided".
4. `ENGINE-API-SPEC.md` — the AstroLyrica surface. Built, mounted, and 503ing.
5. The 2026-07-29/30 studies. Don't re-run them.

---

## The habit that produced everything valuable here

**Measure it. Don't read it.** Third session running, and it keeps paying — but
this time the lesson sharpened again: *measure your own fix before you ship it.*

- The morning email felt thin. It was not a wording problem: `composeDay` was
  **computing the entire synthesis reading and never referencing it**, printing
  a static table entry instead. Found by grepping for the variable, not by
  reading the copy.
- **My first fix for that was wrong, and only measurement caught it.** Leading
  with the engine's own headline flavour printed one verbatim sentence on 6 of 8
  days — the same failure, in nicer prose. I also switched the headline to the
  weave's element and had to revert it: unique 3 times in 14 days.
- The typecheck was **not a noisy baseline, it was a disabled check**. Stale
  project references meant cross-package imports weren't validated at all. An
  import of a symbol that did not exist passed typecheck AND build, then threw
  `ReferenceError` on every request.
- An em-dash slop guard I wrote **failed on four strings, none of them the thing
  it was aimed at**. Deleted rather than shipped — a guard that is mostly false
  positives teaches people to ignore it.

**The recurring shape, and it is worth internalising:** values get computed,
flattened into a sentence, and the sentence becomes the only artifact. It
happened in the email (reading → static blurb), in the engine (facts → `note`),
and in `associate` (structured result → prose). **Wherever you find prose where
data should be, look upstream for what was thrown away.**

---

## State of play

**Branch:** `feat/tides-app` at `817e24a`, pushed. **19 commits ahead of
`origin/main`.**
**`main` has NOT been advanced — production is unchanged.** Deploying is a
fast-forward of `main` + push; that is the owner's call, not a default.
**Local `main` is stale** (23 behind `origin/main`) — fetch before touching it.
**231 tests + 1 skipped, green under America/Chicago · Asia/Kolkata · UTC.**
**api-server, tides and `typecheck:libs` all at 0 errors** — see below, this is new.

### Shipped

**Quick Capture parses dates** (`lib/parseWhen.ts`) — deterministic, no AI, no
network. Dates only, never times: `due_date` has no time column, so rendering
"2:00 PM" would print a precision the row cannot hold. Numeric `8/7` deliberately
unparsed. Rejection is keyed on the line's TEXT, not its index — indices shift as
you type above a line.

**The consent-based cascade.** "Your 2pm ran long — shift the next three?" It
always asks, and always names the cost *per block, before you agree*, in the
weaver's own grading (`Tier`/`TIER_NOTE` moved to `lib/timingTier.ts` and shared,
so there is no second vocabulary). The against/workable line is **measured**: the
median made half of every day "against"; energy is now normalised within each
element's own daily range at 0.10, marking 6–18% of a day across three skies.

**Evening re-homing.** `POST /planning/rehome/suggest` + "→ move it" on past-due
blocks, scored for tomorrow rather than "same time tomorrow". Finally calls
`PATCH /planning/windows/:id`, which no client had ever called.

**The morning email uses the reading it pays for.** Three sentences ordered by
what actually varies (Moon's applying aspect, 11 unique/14 → day ruler → the
honest but). 14/14 unique blocks over a fortnight, median 37 words.

**Testimony facts.** Every testimony carries `facts: {kind, planet, partner,
aspect, orbDeg, applying, sign, phaseName, dignity, verb}` beside `note`.
Additive; `note` is byte-identical. Foundation for the LLM voice layer and for
AstroLyrica.

**Also:** an outbox that makes the journal's "will retry" true; Planner drafts
survive a refresh (the list returns, a stale schedule does not); an AI-slop
ratchet over 6,655 user-facing strings.

---

## Careful — these will bite you

Everything in the previous handoff still stands: **30-second ephemeris
quantisation**, `drizzle-kit push` on every deploy (additive-only, §9a), **`cd`
persisting inside a compound Bash command** (cost me time twice more), the
preview server not reading `.env`, **TWO election systems**, Cloudflare caching
`compass.day`, and staging deliberately rather than `git add -A`. Added:

- **`pnpm run typecheck` at the root now RUNS TO COMPLETION.** It used to die in
  `typecheck:libs` and never reach the apps. It now surfaces **health-tracker's
  own 21 pre-existing errors** (natal.tsx ×12, cultivator.tsx ×4, track/planning
  ×2). Not a regression — they were simply never reached. Compass's packages are
  all at 0.
- **A red baseline can be a disabled check, not noise.** If project references
  reappear, assume cross-package imports are unvalidated and boot the thing.
- **Never re-export an imported binding under its own name.** esbuild emits a
  self-referential binding: clean build, clean typecheck, `ReferenceError` per
  request.
- **Three AI routes degrade to a deterministic answer** — `associate`,
  `chart/explicate`, `planning/breakdown`. Do NOT "fix" them with a 503; I tried,
  and it would have replaced three working features with an error message.
- **Voice messages never record what the user said.** `voiceChatStream` only
  yields the assistant's transcript, so every voice message stores
  `"[voice message]"`. Dead branch removed; the real fix needs `speechToText`.
  health-tracker only.
- **A green run can hide a test file that failed to load.** A stray `*/` took
  `regressions.test.ts` out entirely and the matrix still printed "passed".
  **Check the test COUNT, not the word.**

---

## What I'd do next

1. **The LLM voice renderer.** Foundation is in; the fork below needs deciding
   first.
2. **Ask history is in-memory** — last item of that §3b row, and `lib/outbox.ts`
   is sitting there ready for it.
3. **Conversion instrumentation** — still deferred by the owner, still the
   cheapest high-value item once there is something to convert.
4. **health-tracker's 21 typecheck errors** — now visible, previously unreachable.

**Needs the owner:** real accounts (closing `testerId`-as-bearer), the
drizzle→migrations baseline, and **five** Railway variables — `VAPID_*`,
`RESEND_API_KEY` + `EMAIL_FROM`, `ADMIN_TOKEN`, and **`ENGINE_TOKENS` (new: the
entire AstroLyrica integration is built and mounted, and 503s on every request
until it is set)** — plus the Google OAuth publish-vs-Testing decision.

---

## Decided — don't relitigate

Everything in the previous handoff stands: nav is the loop; never "productivity"
in a headline; habit cadence stays free; don't split the beta cohort; don't copy
silent rescheduling, streaks, or fit-everything-in; the felt rating is gone;
snark at the situation, never the reader; "find your rhythm — it need not be
linear". Added:

- **The Mercury-sign register is LLM-RENDERED** (owner, 2026-08-01), closing
  LANGUAGE-STUDY §3. Three consequences, cheap now and expensive later: the LLM
  **renders, never judges** (the engine picks which testimonies and their
  salience; the renderer only phrases them — this is what keeps "the moat is the
  deterministic engine" literally true); **`note` is the fallback register**, not
  dead code, following the same degrade-don't-refuse rule as the three AI routes;
  and **the slop guard must move to runtime**, since the build-time one cannot
  see generated prose.
- **Still open, decide before building.** Does the LLM call live *inside*
  `dayReading()` — making `/engine/reading` async and handing AstroLyrica your
  latency, cost and voice — or *above* it as `voice(reading, register)`, leaving
  the engine deterministic and letting each consumer choose its own register? §5
  argues for above. Also unresolved: does the register apply to instructions or
  only to the weather (the study's own rule is "lyric in the weather, plain in
  the instruction"), and does the user override the chart?
- **Cache the renderer on `(register, factsHash)`.** A Mercury sign never
  changes and the day's facts are shared, so the morning cron costs ~12 calls
  total rather than one per subscriber.
- **Don't mass-strip em dashes.** One in 10.9% of user-facing strings, two or
  more in 0.4% — the appositive house voice, chosen deliberately. The no-ai-slop
  skill's own first rule is to preserve the writer's voice.
- **"Transformative" stays** where it describes Scorpio/Pluto: the traditional
  signification, not marketing filler.
