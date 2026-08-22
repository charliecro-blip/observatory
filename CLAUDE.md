# Working agreements for this repo

Short, and all load-bearing. The long-form reasoning lives in
`artifacts/tides/DESIGN.md` (astrological architecture), `WORLDBOOK.md`
(the imaginal universe and its vocabulary), and `BACKLOG.md`.

## Copy

**Every user-facing string gets run through the `no-ai-slop` skill before it
ships — when it's written, not in a later pass.** This is an owner
requirement (2026-08-13), not a style preference. What triggers it: any new
or edited label, placeholder, headline, empty state, error, notification,
email, or curated read. Invoke the skill, apply it, then ship.

The specific tic the owner flags most often: **the two-short-sentence
cadence** — "A new moon opens a cycle. An eclipse turns it up." — and its
cousins (aphoristic kickers, "not X, but Y", the sentence fragment used for
rhythm). It reads as machine-written. Prefer one sentence that carries its
own weight, and let sentence lengths vary the way a person's do.

Also standing:
- `ASTROLYRICA-COPY-HANDOFF.md` is the paste-ready inventory for an
  external voice pass; keep it current when copy tables change.
- Layer-1 language must pass the stranger test — no glossary required.
  Instrument jargon (tide words, nautical words) stays inside its
  instrument (WORLDBOOK §2). "Slack water" leaking into an evidence line
  broke CI once.
- American spellings (the tree runs ~73:13 favors/favours).

## Product commitments that constrain code

- Compass never invents work. An empty day is a valid answer. Gaps and
  refusals are output, with reasons — never silent drops.
- A disclaimer means the design is wrong. One fact, one source.
- Describe conditions, never promise outcomes.

## Engineering

Two of the rules below are now hooks rather than requests — `.claude/settings.json`
wires them, `.claude/hooks/` holds them. Booting the api-server without naming a
database is refused, and `git push` waits for `pnpm run typecheck` plus a green
suite in all three timezones (`COMPASS_SKIP_PUSH_GATE=1` when you mean it).
`.claude/agents/verifier.md` is the read-only agent that measures a claim
instead of reading the code that makes it.

- **Root `.env` is PRODUCTION Neon.** Start the API only via the
  `api-scratch` launch config. Never a bare `npx tsx …/index.ts`.
- CI runs the full suite three times — `America/Chicago`, `Asia/Kolkata`,
  `UTC`. Anything date/time-adjacent must be run under all three locally
  before pushing (`TZ=Asia/Kolkata npx vitest run …`).
- Railway runs `pnpm test` inside its build, so a red suite blocks the
  deploy of unrelated work.
- Some tests read the LIVE sky and so fail on particular days for reasons
  that are the test's fault. Before blaming your change:
  `git stash && npx vitest run <file> -t "<name>"`. Measure the truth
  separately (bundle with esbuild, print real values) rather than reading
  the code and guessing.
- Verify a deploy by probing a user-visible string in the served bundle,
  not by `healthz` — that can answer from the old instance.
