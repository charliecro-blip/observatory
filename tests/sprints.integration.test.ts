/**
 * Sprints against a real database — same TEST_DATABASE_URL contract as the
 * other integration files: skipped unless that variable (never DATABASE_URL)
 * is set, so this can never point at production by ambient inheritance.
 *
 * Pins the tally join (wins.sprintId), and that a sprint's status is the
 * person's statement — taps never flip it.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

const TEST_DB = process.env["TEST_DATABASE_URL"];
const TESTER = "obs_sprints_test";

let pool: any;

describe.skipIf(!TEST_DB)("sprints (integration)", () => {
  beforeAll(async () => {
    process.env["DATABASE_URL"] = TEST_DB;
    const S: any = await import("@workspace/db");
    pool = S.pool;
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM wins WHERE tester_id = $1`, [TESTER]);
    await pool.query(`DELETE FROM sprints WHERE tester_id = $1`, [TESTER]);
  });

  it("tallies taps through the wins ledger, and taps never finish a sprint", async () => {
    const s = (await pool.query(
      `INSERT INTO sprints (tester_id, title, start_date, end_date, source, target_count)
       VALUES ($1, 'No sugar', '2026-08-18', '2026-08-24', 'chosen', 5) RETURNING *`,
      [TESTER])).rows[0];
    expect(s.status).toBe("active");

    await pool.query(
      `INSERT INTO wins (tester_id, date, sprint_id, text) VALUES
        ($1, '2026-08-18', $2, 'sprint: No sugar'),
        ($1, '2026-08-18', $2, 'sprint: No sugar'),
        ($1, '2026-08-19', $2, 'sprint: No sugar')`,
      [TESTER, s.id]);

    const tally = (await pool.query(
      `SELECT COUNT(*) AS count, COUNT(DISTINCT date) AS days
         FROM wins WHERE tester_id = $1 AND sprint_id = $2`, [TESTER, s.id])).rows[0];
    expect(Number(tally.count)).toBe(3);
    expect(Number(tally.days)).toBe(2);

    // Meeting (or passing) the target changes NOTHING by itself — finishing
    // is the person's own statement, written by the PATCH, never inferred.
    const after = (await pool.query(`SELECT status FROM sprints WHERE id = $1`, [s.id])).rows[0];
    expect(after.status).toBe("active");
  });

  it("a habit-linked sprint tallies from the habit's own log — one act, one record", async () => {
    const h = (await pool.query(
      `INSERT INTO habits (tester_id, name, cadence) VALUES ($1, 'Wind down', 'daily') RETURNING *`,
      [TESTER])).rows[0];
    const s = (await pool.query(
      `INSERT INTO sprints (tester_id, title, start_date, end_date, source, habit_id)
       VALUES ($1, 'Wind down', '2026-08-18', '2026-08-24', 'chosen', $2) RETURNING *`,
      [TESTER, h.id])).rows[0];
    // Two kept days inside the window, one before it.
    await pool.query(
      `INSERT INTO habit_logs (tester_id, habit_id, date) VALUES
        ($1, $2, '2026-08-17'), ($1, $2, '2026-08-18'), ($1, $2, '2026-08-19')`,
      [TESTER, h.id]);
    // The tally the route derives: kept days INSIDE the window only.
    const tally = (await pool.query(
      `SELECT COUNT(*) AS n FROM habit_logs
        WHERE tester_id = $1 AND habit_id = $2 AND date >= $3 AND date <= $4`,
      [TESTER, h.id, s.start_date, s.end_date])).rows[0];
    expect(Number(tally.n)).toBe(2);
    // And no win rows exist for it — the habit log IS the record.
    const winRows = (await pool.query(
      `SELECT COUNT(*) AS n FROM wins WHERE tester_id = $1 AND sprint_id = $2`, [TESTER, s.id])).rows[0];
    expect(Number(winRows.n)).toBe(0);
    await pool.query(`DELETE FROM habit_logs WHERE tester_id = $1`, [TESTER]);
    await pool.query(`DELETE FROM habits WHERE tester_id = $1`, [TESTER]);
  });

  it("a transit-born sprint keeps its label after the sky moves on", async () => {
    const s = (await pool.query(
      `INSERT INTO sprints (tester_id, title, start_date, end_date, source, transit_key, transit_label)
       VALUES ($1, 'Ten cold calls', '2026-08-18', '2026-08-25', 'transit',
               'mars-trine-jupiter-2026-08-21', 'Mars trine Jupiter') RETURNING *`,
      [TESTER])).rows[0];
    expect(s.transit_label).toBe("Mars trine Jupiter");
    expect(s.transit_key).toBe("mars-trine-jupiter-2026-08-21");
  });
});
