/**
 * Touches against a real database — the §3 guard at the data layer.
 *
 * SKIPPED unless TEST_DATABASE_URL is set (same contract as
 * writes.integration.test.ts — a different variable from DATABASE_URL so this
 * can never inherit production from the ambient environment).
 *
 * The failure mode being pinned: a task accumulating touches (wins carrying
 * its taskId) must remain done='false' in the database — worked-on is a
 * record beside the task, never a state change on it.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

const TEST_DB = process.env["TEST_DATABASE_URL"];
const TESTER = "obs_touches_test";

let pool: any;

describe.skipIf(!TEST_DB)("touches (integration)", () => {
  beforeAll(async () => {
    process.env["DATABASE_URL"] = TEST_DB;
    const S: any = await import("@workspace/db");
    pool = S.pool;
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM wins WHERE tester_id = $1`, [TESTER]);
    await pool.query(`DELETE FROM tasks WHERE tester_id = $1`, [TESTER]);
  });

  it("a touched task stays undone, and its touches are queryable", async () => {
    const t = (await pool.query(
      `INSERT INTO tasks (tester_id, title, sort_order) VALUES ($1, $2, 0) RETURNING *`,
      [TESTER, "Portfolio rework"])).rows[0];
    expect(t.done).toBe("false");

    // Three touches over two days, one with minutes.
    await pool.query(
      `INSERT INTO wins (tester_id, date, task_id, minutes, text) VALUES
        ($1, '2026-08-14', $2, 45, 'worked on: Portfolio rework'),
        ($1, '2026-08-14', $2, NULL, 'sketched the case-study order'),
        ($1, '2026-08-15', $2, 30, 'worked on: Portfolio rework')`,
      [TESTER, t.id]);

    // The task itself is untouched by its touches.
    const after = (await pool.query(`SELECT done FROM tasks WHERE id = $1`, [t.id])).rows[0];
    expect(after.done).toBe("false");

    // The trail is queryable the way /planning/touches reads it: distinct
    // dates, summed minutes.
    const trail = (await pool.query(
      `SELECT COUNT(DISTINCT date) AS days, COALESCE(SUM(minutes), 0) AS minutes
         FROM wins WHERE tester_id = $1 AND task_id = $2`,
      [TESTER, t.id])).rows[0];
    expect(Number(trail.days)).toBe(2);
    expect(Number(trail.minutes)).toBe(75);
  });

  it("a task-linked win is a named win — it lands in the ledger's source data", async () => {
    const t = (await pool.query(
      `INSERT INTO tasks (tester_id, title, sort_order) VALUES ($1, $2, 0) RETURNING *`,
      [TESTER, "Long run"])).rows[0];
    await pool.query(
      `INSERT INTO wins (tester_id, date, task_id, minutes, text) VALUES ($1, '2026-08-15', $2, 40, 'ran 40 minutes')`,
      [TESTER, t.id]);
    // The Wake derives named wins straight from this table, so presence here
    // IS presence in the ledger.
    const rows = (await pool.query(
      `SELECT text, task_id FROM wins WHERE tester_id = $1 AND date = '2026-08-15'`, [TESTER])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].task_id).toBe(t.id);
  });
});
