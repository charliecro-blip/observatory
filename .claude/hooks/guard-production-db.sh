#!/usr/bin/env bash
#
# Refuses any command that BOOTS the api-server without saying which database it
# should talk to.
#
# The root .env holds production Neon, and both the `api` launch config and a
# bare `npx tsx …/index.ts` inherit it — so either one silently attaches a dev
# server to live tester data. CLAUDE.md says start the API only via
# `api-scratch`; this is that sentence made unskippable.
#
# The sanctioned escape is an explicit local DATABASE_URL on the command itself,
# which is exactly what the api-scratch config does.
set -uo pipefail

cmd="$(jq -r '.tool_input.command // ""' 2>/dev/null)" || exit 0
[ -n "$cmd" ] || exit 0

# Only commands that mention the api-server can boot it.
printf '%s' "$cmd" | grep -q 'api-server' || exit 0

# ...and only if they actually START it, rather than grep/edit/typecheck it.
printf '%s' "$cmd" | grep -Eq \
  '(tsx|ts-node|node)[[:space:]]+[^[:space:]]*(index|server|src)|run[[:space:]]+(dev|start)' \
  || exit 0

# An explicit database on the command line is the whole point of api-scratch.
# Accept only ones that are plainly local; a hosted host is the thing we block.
if printf '%s' "$cmd" | grep -q 'DATABASE_URL='; then
  printf '%s' "$cmd" | grep -Eq 'DATABASE_URL=[^[:space:]]*(neon\.tech|amazonaws|render\.com|railway)' \
    || exit 0
fi

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: this boots the api-server against whatever DATABASE_URL the root .env supplies, and the root .env is PRODUCTION Neon (CLAUDE.md > Engineering). Start it with the api-scratch launch config via preview_start, or put an explicit local database on the command: DATABASE_URL=postgres://localhost:5432/compass_scratch pnpm --filter @workspace/api-server run dev"}}
JSON
