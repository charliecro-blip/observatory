/**
 * Sessions against a real database — the DB-coupled half of BACKLOG §2's
 * bearer-token closure. tests/sessionToken.test.ts holds the pure primitives;
 * these hold the invariants that only exist as rows:
 *
 *   · claim is trust-on-FIRST-use — exactly once, ever
 *   · a claimed account rejects a bare id and a wrong token, accepts its own
 *   · an unclaimed account still passes (the no-lockout rollout)
 *   · and stops passing once the TOFU deadline is behind us
 *   · but the recovery code still works after it — the guarantee that the
 *     close is a close and not a lockout
 *   · recovery mints a session AND claims, so the second device path works
 *   · sessions die with the account (via the deletion sweep's discovery)
 *
 * SKIPPED unless TEST_DATABASE_URL is set — deliberately a *different*
 * variable from DATABASE_URL so this can never inherit production.
 *
 *   createdb compass_auth_test
 *   (cd lib/db && DATABASE_URL=postgres://localhost:5432/compass_auth_test npx drizzle-kit push --force)
 *   TEST_DATABASE_URL=postgres://localhost:5432/compass_auth_test pnpm test
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

const TEST_DB = process.env["TEST_DATABASE_URL"];
const TESTER = "obs_auth_test";

describe.skipIf(!TEST_DB)("account sessions (integration)", () => {
  let A: any;      // accountAuth
  let sql: (q: string, params?: unknown[]) => Promise<any>;

  beforeAll(async () => {
    // Set before importing @workspace/db, which reads DATABASE_URL at module load.
    process.env["DATABASE_URL"] = TEST_DB;
    A = await import("../artifacts/api-server/src/lib/accountAuth.js");
    // The pool @workspace/db already opened against TEST_DB — the same way
    // the deletion integration test reaches postgres.
    const S: any = await import("@workspace/db");
    sql = (q, params) => S.pool.query(q, params);
  });

  beforeEach(async () => {
    await sql(`DELETE FROM account_sessions WHERE tester_id = $1`, [TESTER]);
    await sql(`DELETE FROM tester_profiles WHERE tester_id = $1`, [TESTER]);
    await sql(
      `INSERT INTO tester_profiles (tester_id, recovery_code) VALUES ($1, $2)`,
      [TESTER, "TIDE-TEST-AUTH"],
    );
    A.clearSessionCache();
  });

  it("an unclaimed account passes on the bare id — the rollout guarantee", async () => {
    expect((await A.verifySession(TESTER, null)).state).toBe("unclaimed");
    expect((await A.verifySession(TESTER, "sess_anything")).state).toBe("unclaimed");
  });

  it("an account that never synced passes as unknown — onboarding is not 401s", async () => {
    expect((await A.verifySession("obs_never_synced", null)).state).toBe("unknown-account");
  });

  it("claim works exactly once, and the winner's token verifies", async () => {
    const first = await A.claimAccount(TESTER);
    expect(first.ok).toBe(true);

    const second = await A.claimAccount(TESTER);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("already-claimed");

    expect((await A.verifySession(TESTER, first.token)).state).toBe("valid");
  });

  it("once claimed, a bare id and a wrong token are both refused", async () => {
    await A.claimAccount(TESTER);
    A.clearSessionCache();
    expect((await A.verifySession(TESTER, null)).state).toBe("invalid");
    expect((await A.verifySession(TESTER, "sess_forged")).state).toBe("invalid");
  });

  it("a session cannot be replayed against a different account", async () => {
    // The lookup is by token hash alone; the tester binding is what stops a
    // valid token for account A authorising requests that claim to be B.
    const mine = await A.claimAccount(TESTER);
    await sql(
      `INSERT INTO tester_profiles (tester_id, recovery_code, claimed_at) VALUES ($1, $2, now())`,
      ["obs_auth_other", "TIDE-TEST-OTHR"],
    );
    A.clearSessionCache();
    expect((await A.verifySession("obs_auth_other", mine.token)).state).toBe("invalid");
    await sql(`DELETE FROM tester_profiles WHERE tester_id = $1`, ["obs_auth_other"]);
  });

  it("recovery mints a second session without killing the first — multi-device", async () => {
    const device1 = await A.claimAccount(TESTER);
    const device2 = await A.mintSessionFor(TESTER, "recovery");
    A.clearSessionCache();
    expect((await A.verifySession(TESTER, device1.token)).state).toBe("valid");
    expect((await A.verifySession(TESTER, device2)).state).toBe("valid");
    const rows = await sql(`SELECT origin FROM account_sessions WHERE tester_id = $1 ORDER BY id`, [TESTER]);
    expect(rows.rows.map((r: any) => r.origin)).toEqual(["claim", "recovery"]);
  });

  it("minting on an unclaimed account claims it — recovery is proof of ownership", async () => {
    await A.mintSessionFor(TESTER, "recovery");
    const claimed = await sql(`SELECT claimed_at FROM tester_profiles WHERE tester_id = $1`, [TESTER]);
    expect(claimed.rows[0].claimed_at).not.toBeNull();
  });

  it("the token is stored only as a hash — a dump holds no credentials", async () => {
    const { token } = await A.claimAccount(TESTER);
    const rows = await sql(`SELECT token_hash FROM account_sessions WHERE tester_id = $1`, [TESTER]);
    expect(rows.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows.rows[0].token_hash).not.toContain(token.slice(5, 20));
  });

  it("a revoked session stops verifying once the cache clears", async () => {
    const { token } = await A.claimAccount(TESTER);
    A.clearSessionCache();
    expect((await A.verifySession(TESTER, token)).state).toBe("valid");
    // Revoke the way the route does: delete the row, clear the cache.
    await sql(`DELETE FROM account_sessions WHERE tester_id = $1`, [TESTER]);
    A.clearSessionCache();
    expect((await A.verifySession(TESTER, token)).state).toBe("invalid");
  });

  describe("past the TOFU deadline", () => {
    // The deadline is read at call time, so moving it is how a test reaches a
    // future the wall clock has not arrived at yet.
    beforeEach(() => { process.env["COMPASS_TOFU_DEADLINE"] = "2020-01-01T00:00:00Z"; });
    afterEach(() => { delete process.env["COMPASS_TOFU_DEADLINE"]; });

    it("an unclaimed account stops passing on the bare id", async () => {
      const verdict = await A.verifySession(TESTER, null);
      expect(verdict.state).toBe("invalid");
      expect(verdict.reason).toBe("window-closed");
    });

    it("claiming stops issuing sessions — the exempt route is the other half", async () => {
      // The gate refusing unclaimed ids while /account/claim still mints for
      // them would move the hole, not fill it: that route is EXEMPT.
      const result = await A.claimAccount(TESTER);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("window-closed");
      const rows = await sql(`SELECT count(*) FROM account_sessions WHERE tester_id = $1`, [TESTER]);
      expect(Number(rows.rows[0].count)).toBe(0);
    });

    it("the recovery code still gets a dormant tester back in", async () => {
      // THE guarantee. Someone who has not opened Compass since the rollout
      // meets a closed window on their next boot; the code their device has
      // held since it first synced is what makes that a silent restore rather
      // than a lockout.
      const token = await A.mintSessionFor(TESTER, "recovery");
      A.clearSessionCache();
      expect((await A.verifySession(TESTER, token)).state).toBe("valid");
      const claimed = await sql(`SELECT claimed_at FROM tester_profiles WHERE tester_id = $1`, [TESTER]);
      expect(claimed.rows[0].claimed_at).not.toBeNull();
    });

    it("an account that already claimed is untouched by the deadline", async () => {
      // The close is about accounts that never claimed. A device holding a
      // good token must not be signed out by a date passing.
      delete process.env["COMPASS_TOFU_DEADLINE"];
      const { token } = await A.claimAccount(TESTER);
      process.env["COMPASS_TOFU_DEADLINE"] = "2020-01-01T00:00:00Z";
      A.clearSessionCache();
      expect((await A.verifySession(TESTER, token)).state).toBe("valid");
    });

    it("an unsynced id still passes — a closed window must not break signup", async () => {
      // No profile row means nothing to protect yet, and a 401 here would 401
      // the first boot of every new account.
      expect((await A.verifySession("obs_never_synced", null)).state).toBe("unknown-account");
    });
  });

  it("sessions are inside the deletion sweep's discovery", async () => {
    // The sweep finds every table with a tester_id column, so this asserts the
    // new table is discoverable rather than trusting a list someone updates.
    const del: any = await import("../artifacts/api-server/src/lib/accountDeletion.js");
    const names = del.testerScopedTables().map((t: any) => t.name);
    expect(names).toContain("account_sessions");
  });
});
