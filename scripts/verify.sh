#!/usr/bin/env sh
# Everything Railway runs, in Railway's order, with a verdict that cannot be
# mistaken for success.
#
# Written after a deploy failed on a test that had been "passing" locally for
# several commits. The habit was `npx vitest run 2>&1 | tail -3` — and the last
# three lines of vitest output are a blank, "Start at", and "Duration". The
# pass/fail counts sit ABOVE them. So the check reported nothing at all, and
# every commit that used it claimed a green suite it had not seen.
#
# A verification step that cannot show a failure is worse than no verification,
# because it is reported as though it were one.
set -e
cd "$(dirname "$0")/.."

# NOT the root `pnpm run typecheck`. Railway deliberately omits it — the
# legacy health-tracker has pre-existing errors and nothing in Compass imports
# it, so including it here would fail on code this deploy never touches. Each
# Compass app typechecks as part of its own build, which is what Railway runs.
echo "── typecheck (the two Compass apps) ──"
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/tides run typecheck

echo "── tests ──"
pnpm test 2>&1 | tee /tmp/verify-tests.log | tail -60
# `set -e` misses this: the exit status of a pipeline is the LAST command, and
# `tail` always succeeds. Read vitest's own summary instead.
if grep -qE "Tests +[0-9]+ failed|Test Files +[0-9]+ failed" /tmp/verify-tests.log; then
  echo "VERIFY FAILED — tests" >&2
  exit 1
fi
grep -E "Tests +[0-9]|Test Files" /tmp/verify-tests.log | tail -2

echo "── builds ──"
pnpm --filter @workspace/tides run build >/dev/null
pnpm --filter @workspace/api-server run build >/dev/null

echo "VERIFY OK — safe to push"
