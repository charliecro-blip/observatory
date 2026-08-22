#!/usr/bin/env bash
#
# Holds `git push` until typecheck passes and the suite is green in all three
# CI timezones.
#
# Two things make a red push expensive here rather than merely untidy: Railway
# runs `pnpm test` inside its build, so a red suite blocks the deploy of
# unrelated work; and the root tsconfig skips artifacts/tides, so `tsc` looking
# clean is not the gate — `pnpm run typecheck` is.
#
# Escape hatch, for when you know and mean it:
#   COMPASS_SKIP_PUSH_GATE=1 git push
set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

deny() { jq -n --arg r "$1" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'; exit 0; }

[ "${COMPASS_SKIP_PUSH_GATE:-}" = "1" ] && exit 0

# Self-gating. settings.json also carries an `if` filter, but a gate that runs
# on the wrong command costs two minutes of someone's attention, so it checks
# for itself rather than trusting the filter.
cmd="$(jq -r '.tool_input.command // ""' 2>/dev/null)" || exit 0
printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+push([[:space:]]|$)' || exit 0

log="$(mktemp)"; trap 'rm -f "$log"' EXIT

# The integration tests skip silently without this, which is how 15 of 20 tests
# can look like a pass. Use the local test DB when it exists.
db=""
if psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw compass_auth_test; then
  db="postgres://localhost:5432/compass_auth_test"
fi

if ! pnpm run typecheck >"$log" 2>&1; then
  deny "Push held: \`pnpm run typecheck\` fails. Railway builds with this, so pushing red blocks unrelated deploys.

$(tail -25 "$log")"
fi

for tz in America/Chicago Asia/Kolkata UTC; do
  if ! TZ="$tz" TEST_DATABASE_URL="$db" npx vitest run >"$log" 2>&1; then
    deny "Push held: the suite fails under TZ=$tz (CI runs all three).

$(grep -E '(FAIL|✕|Tests? +[0-9]+ failed)' "$log" | head -20)

$(tail -12 "$log")"
  fi
done

skipped="$(grep -oE '[0-9]+ skipped' "$log" | head -1)"
jq -n --arg m "Push gate: typecheck clean, suite green in all three timezones${skipped:+ ($skipped)}." \
  '{systemMessage:$m,suppressOutput:true}'
