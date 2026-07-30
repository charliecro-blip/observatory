/**
 * Account deletion, against a real database.
 *
 * SKIPPED unless TEST_DATABASE_URL is set — deliberately a *different* variable
 * from DATABASE_URL so this can never be pointed at production by inheriting
 * the ambient environment. Seeds two accounts, deletes one, and proves the
 * other is untouched.
 *
 *   createdb compass_deletion_test
 *   (cd lib/db && DATABASE_URL=postgres://localhost:5432/compass_deletion_test npx drizzle-kit push --force)
 *   TEST_DATABASE_URL=postgres://localhost:5432/compass_deletion_test pnpm test
 *
 * The unit-level guards in regressions.test.ts hold the *contract* (nothing is
 * missed, the derivation isn't replaced by a hand list). This holds the
 * behaviour: that a delete actually empties every table and stops there.
 */
import { describe, it, expect, beforeAll } from "vitest";

const TEST_DB = process.env["TEST_DATABASE_URL"];

let deleteAccount: any, testerScopedTables: any, pool: any;

const VICTIM = "obs_victim_test";
const BYSTANDER = "obs_bystander_test";

describe.skipIf(!TEST_DB)("account deletion (integration)", () => {
  beforeAll(async () => {
    // Set before importing @workspace/db, which reads DATABASE_URL at module load.
    process.env["DATABASE_URL"] = TEST_DB;
    const S: any = await import("@workspace/db");
    pool = S.pool;
    const del: any = await import("../artifacts/api-server/src/lib/accountDeletion.js");
    deleteAccount = del.deleteAccount;
    testerScopedTables = del.testerScopedTables;
  });

  async function seed(id: string) {
    const q = (s: string, v: any[] = []) => pool.query(s, v);
    await q(`INSERT INTO tester_profiles (tester_id, recovery_code, display_name, feed_token_hash)
             VALUES ($1, $2, 'Test', $3)`, [id, `TIDE-${id.slice(4, 8).toUpperCase()}-ZZZZ`, `hash-${id}`]);
    await q(`INSERT INTO natal_charts (tester_id, birth_date, birth_place, birth_lat, birth_lon)
             VALUES ($1,'1990-01-01','Austin','30.27','-97.74')`, [id]);
    await q(`INSERT INTO tasks (tester_id, title) VALUES ($1,'a task')`, [id]);
    await q(`INSERT INTO habits (tester_id, name) VALUES ($1,'a habit')`, [id]);
    await q(`INSERT INTO google_cal_tokens (tester_id, access_token, refresh_token) VALUES ($1,'at','rt')`, [id]);
    await q(`INSERT INTO email_subscriptions (tester_id, email) VALUES ($1,$2)`, [id, `${id}@example.com`]);
    await q(`INSERT INTO push_subscriptions (tester_id, endpoint, p256dh, auth) VALUES ($1,$2,'k','a')`, [id, `https://x/${id}`]);
    await q(`INSERT INTO daemon_memory (tester_id, content) VALUES ($1,'advisor memory')`, [id]);
    await q(`INSERT INTO usage_events (tester_id, event) VALUES ($1,'opened')`, [id]);
    await q(`INSERT INTO cycle_tracking (tester_id, cycle_start_date) VALUES ($1,'2026-07-01')`, [id]);
    await q(`INSERT INTO daily_check_ins (tester_id, date) VALUES ($1,'2026-07-30')`, [id]);
    const c = await q(`INSERT INTO conversations (tester_id, title) VALUES ($1,'chat') RETURNING id`, [id]);
    await q(`INSERT INTO messages (conversation_id, role, content) VALUES ($1,'user','a private question')`,
      [c.rows[0].id]);
  }

  async function countAll(id: string): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const { name } of testerScopedTables()) {
      const r = await pool.query(`SELECT count(*)::int AS n FROM "${name}" WHERE tester_id = $1`, [id]);
      out[name] = r.rows[0].n;
    }
    return out;
  }
  const totalMessages = async () =>
    (await pool.query(`SELECT count(*)::int AS n FROM messages`)).rows[0].n;

  it("erases the account, and leaves every other account untouched", async () => {
    for (const id of [VICTIM, BYSTANDER]) {
      try { await deleteAccount(id); } catch { /* first run on a fresh database */ }
    }
    await seed(VICTIM);
    await seed(BYSTANDER);

    const before = await countAll(VICTIM);
    const bystanderBefore = await countAll(BYSTANDER);
    const seeded = Object.entries(before).filter(([, n]) => n > 0).map(([t]) => t);
    // Guard against a vacuous pass: if the seed silently failed, "everything is
    // gone afterwards" would be trivially true.
    expect(seeded.length, "seed did not populate enough tables to be a real test").toBeGreaterThanOrEqual(11);
    expect(await totalMessages()).toBe(2);

    const report = await deleteAccount(VICTIM);

    const after = await countAll(VICTIM);
    for (const [table, n] of Object.entries(after)) {
      expect(n, `${table} still holds ${n} rows for the deleted account`).toBe(0);
    }
    expect(report.totalRows).toBeGreaterThanOrEqual(12);

    // Scoped, not a truncate — the failure this catches is a missing WHERE.
    expect(await countAll(BYSTANDER)).toEqual(bystanderBefore);

    // Advisor messages key on conversation_id, so the tester_id rule is blind
    // to them — and they are the most sensitive rows in the database.
    expect(await totalMessages()).toBe(1); // only the bystander's survives

    await deleteAccount(BYSTANDER);
    expect(await totalMessages()).toBe(0);
  }, 60000);
});
