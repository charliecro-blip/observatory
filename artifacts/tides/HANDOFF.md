# Handoff — Compass, as of 2026-07-30

*For the next session. Written at the end of a long two days; the owner is
Charlie, working from Austin, and was present and responsive throughout.*

---

## Read these first, in this order

1. **`BACKLOG.md`** — the single consolidated list. Every open item, with its
   source and status. If you read one file, read that one.
2. This file — what just happened and what to be careful about.
3. `PRICING-AND-MARKETING-2026-07-29.md` — the free/paid line and the
   marketing-backward analysis. Owner has read it and broadly agreed.
4. `COMPETITIVE-UX-2026-07-29.md` (+ its appendix) and
   `PAYING-PERSONAS-2026-07-29.md`, `USER-SIMULATIONS-2026-07-29-MONTH.md`,
   `EMAIL-STUDY-2026-07-30.md` — the four studies. Don't re-run them.

---

## The one habit that mattered most

**Verify before asserting, and verify before believing a claim about the
code — including your own.** Nearly everything valuable in the last two days
came from checking something that "was probably fine":

- A **typecheck baseline of ~20 errors** had been dismissed as noise for weeks.
  Reading it found **four live bugs**: the iCal export 500'd on *every* request
  (so the download button had never once produced a file), the Studio card
  never applied its before-sunrise day ruler, every server-rendered share card
  rendered in **Helvetica instead of the brand serif**, and an empty planet
  string fed `""` to a curve picker. See `typecheck-baseline-lesson` in memory.
- An external review claimed the calendar feed leaked the account credential.
  **It was worse than reported** — verified live, the URL alone returned the
  personal logbook *and* the recovery code, i.e. full account takeover. It was
  code I had shipped hours earlier.
- I nearly added `pnpm run typecheck` to the Railway build. **Dry-running it
  first** showed it fails on legacy libs — it would have broken every deploy.
- Two of my own "fixes" were wrong on the first pass: a subject-line change
  made duplicates *worse* (12→8 unique), and `jsonArray` traded a crash for
  false emptiness ("you have no tasks" when we couldn't load them).

When you fix a bug, **re-run the exploit / re-render the artifact / diff the
before-and-after**. Several fixes here were only confirmed correct by doing so.

---

## State of play

**Branches:** `feat/tides-app` and `main` are identical and pushed. CI is green
on both. 59 regression tests. Working tree clean.

**Deploy:** Railway, `compass.day`. `railway.toml` now runs
install → tests → build both apps → *then* the schema push, so a failing build
can no longer mutate production's schema.

**Company:** Cross Astrology LLC (Texas, filed 2026-07-29, file 806721384).
The privacy policy names it and is served at `/privacy`.

### Shipped in this stretch (all verified, not just written)

Security: the calendar-feed credential leak (found, withdrawn, then rebuilt
properly behind a hashed revocable token); `testerId` no longer accepted from a
query param; `/account/sync` no longer re-issues the recovery code; OAuth
`state` HMAC-signed + expiring; `postMessage` no longer `'*'`; `/account/recover`
rate-limited; `trust proxy`; six uncapped AI routes capped.

Correctness: the UTC day-rollover (habits un-checking at 8pm ET, journals
emptying); ~15 false-success writes; four election-engine bugs (Moon
conjunctions/oppositions never detected, void-of-course blind across midnight,
planetary hours wrong east of ~UTC+7, eclipse gates frozen at scan start); the
notifier's longitude-as-timezone (**2h wrong for Austin**); GCal date bounds;
a React Query key mismatch; `/check-ins` UTC fallback.

Product: habit cadence (daily / most_days / weekly-N / occasional, rolling
7-day window, solar anchors); auto-rollover with "carried from Mon";
capacity honesty in the Planner; single-key calendar views; the daily email
rewritten around the reader; the felt pattern now server-side with epistemic
safeguards; the tide chart scrub working on touch.

Infrastructure: the **first tests in the repo** (59, one per bug that actually
shipped, each verified to fail when its bug is reintroduced) and CI running
them under three timezones.

---

## Careful — these will bite you

- **Do not attempt versioned DB migrations unattended.** `drizzle-kit push`
  still runs against production. Moving to migrations needs a *supervised*
  baseline: the tables already exist, so migration 0 must be marked applied
  rather than run. Getting it wrong can take the database down.
- **`pnpm run typecheck` (root) is RED** and always has been — legacy
  `integrations-openai-ai-*` libs and `api-zod` export ambiguity, used only by
  the old health-tracker app. api-server's *own* source is now clean; what
  remains there is 16 `TS6305` project-reference complaints. Don't add the root
  typecheck to any build until that chain is untangled.
- **The env-loading incantation** for running the API locally:
  `(set -a && . ./.env && set +a && PORT=3000 NODE_ENV=development node artifacts/api-server/dist/index.mjs &)`
  — must be run from the repo root, and the api-server is a **built bundle with
  no watcher**, so `pnpm run build` after every server-side edit.
- **The subscribed profile is `orrery-demo`**, not `obs_default_charlie`. I
  wasted a simulation run on the wrong one. Check
  `/api/reports/email-subscription` before assuming.
- **`pnpm add` needs the proxy cleared**: `HTTP_PROXY= HTTPS_PROXY= pnpm add …`.
- **Chrome (`mcp__claude-in-chrome__*`) was never connected** this session. The
  in-app Browser pane (`mcp__Claude_Browser__*`) works fine.
- The browser's `type` action does **not** emit real keydown events, and React
  batches state — so verifying keyboard handlers needs dispatched events and a
  second call to read the result. My first attempt produced a false PASS.

---

## What I'd do next, in order

1. **Finish P0-B** (product integrity) — the two remaining are
   **chronotype-relative ritual** (currently gated on wall-clock `<12`/`>=18`
   while the app *collects* wake/sleep; this blocks the morning-reflection
   redesign) and **account deletion** (a privacy-policy promise, must revoke
   OAuth tokens, push/email subscriptions, advisor memory, feed tokens).
   Then the **dark-mode pass** on ~15 daily-driver surfaces.
2. **Conversion instrumentation** — there are ~13 analytics events and *none*
   is a conversion event. Everything in the pricing plan depends on knowing
   what people reach for. Cheapest high-value item on the list.
3. **Rebuild the weekly + New Moon emails** the way the daily was rebuilt. The
   daily now leads with the reader's own tasks; the other two still lead with
   the sky, and `composeWeek` additionally contradicts the daily for the same
   date (it samples local noon without natal data while the daily samples send
   time). `EMAIL-STUDY-2026-07-30.md` has the full brief.
4. **The keepable election artifact** — `/api/studio/best.png` already renders
   it and has no door. Best build-to-value ratio in the paying-personas study,
   and it unlocks the "$49 elect a date" SKU.

**Owner actions still outstanding:** VAPID keys on Railway (now *unblocked* —
the timezone bug that would have mis-timed every ping is fixed); decide whether
to publish the Google OAuth app; delete the retired Vercel project.

---

## Things the owner has decided — don't relitigate

- **Nav is the loop**: Today · Calendar · Aims · Plan. Planets and Almanac are
  in-context doors, not tabs.
- **"Enchanted productivity"** is the internal shape-name. **Never put
  "productivity" in a headline** — the audience left those tools deliberately.
  Also avoid "astrology app" and "AI-powered" (the weave is deterministic
  ephemeris math; only the list parse is an LLM).
- **Habit cadence stays free.** Recurrence-behind-a-paywall is the #1 one-star
  generator for both Structured and Tweek.
- **Don't split the beta cohort** into free/paid arms. Mark paid surfaces
  "✦ included for you — beta" instead — a gift received, not a bill arriving.
- **Don't copy**: Motion's silent rescheduling, streak/guilt ledgers, or
  full-capacity "fit everything in". The refusal — an actual "Avoid" verdict —
  is the product's most distinctive behaviour and its best converter.
- **Teams are parked**, deliberately, until individual conversion is proven.

## The thesis, for grounding

> Every competitor answers *"when can this fit?"* — their objective function is
> emptiness, and a calendar's only input is other calendar entries, so they
> cannot tell Thursday from Tuesday except by what's already on it. Compass has
> a second input, so it can rank two equally-empty days for a *specific* thing —
> and uniquely, **it can refuse**.
