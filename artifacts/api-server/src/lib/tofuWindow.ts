/**
 * The instant trust-on-first-use stops being trusted.
 *
 * Its own module, with no database import, for one reason: this is the policy
 * the whole session close turns on, and a policy that cannot be tested without
 * provisioning postgres is a policy that does not get tested. The rest of the
 * model genuinely needs rows and skips without TEST_DATABASE_URL; this is
 * arithmetic on a clock and runs in CI (tests/tofuWindow.test.ts).
 *
 * After it, an unclaimed profile is refused rather than waved through, and
 * /account/claim stops handing out sessions — both halves, because the claim
 * route is EXEMPT from the gate, so closing only the gate would leave the
 * front door open and label it a wall.
 *
 * The way back in is unchanged and deliberately untouched by this: the
 * recovery code is the account's real secret, /account/recover carries no
 * identity and is exempt, and minting from recovery claims the account. Every
 * device that ever created a profile was handed its code and saved it
 * (client lib/tester.ts saveRecoveryCode, shipped 2026-07-03 with the account
 * system itself), so a dormant tester returning after the deadline gets a
 * silent restore, not a wall — the claim 410s and the client's existing
 * self-heal falls straight through to the code it already holds.
 *
 * COMPASS_TOFU_DEADLINE overrides it, so the window can be shut on Railway
 * without waiting on a deploy. A value that does not parse shuts the window
 * NOW rather than reverting to the default: a typo in a security control must
 * not quietly restore the thing the control exists to remove, and the cost of
 * being wrong in this direction is a restore the recovery path already does.
 */
const TOFU_DEADLINE_DEFAULT = "2026-08-23T00:00:00Z";

export function tofuDeadline(): number {
  const override = process.env["COMPASS_TOFU_DEADLINE"]?.trim();
  if (!override) return Date.parse(TOFU_DEADLINE_DEFAULT);
  const parsed = Date.parse(override);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Whether a bare tester id is still accepted for accounts that never claimed. */
export function tofuWindowOpen(now: number = Date.now()): boolean {
  return now < tofuDeadline();
}
