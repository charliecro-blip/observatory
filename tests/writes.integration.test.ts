/**
 * The write paths, against a real database.
 *
 * SKIPPED unless TEST_DATABASE_URL is set — deliberately a *different* variable
 * from DATABASE_URL so this can never be pointed at production by inheriting
 * the ambient environment.
 *
 *   createdb compass_writes_test
 *   (cd lib/db && DATABASE_URL=postgres://localhost:5432/compass_writes_test npx drizzle-kit push --force)
 *   TEST_DATABASE_URL=postgres://localhost:5432/compass_writes_test pnpm test
 *
 * WHY THIS EXISTS. BACKLOG §2's verdict was that the risk had shifted from
 * "dangerous integrity bugs" to "shipping clever improvements faster than the
 * trust/testing/authorization architecture can hold them". The scheduling stack
 * added several write paths in a day, all covered by unit tests over pure
 * functions and none by anything that touches a row.
 *
 * The unit tests hold the reasoning; these hold the plumbing. Two different
 * things break, and today one of them broke in a way no pure test could see:
 * the UI asked "what kind of work is this?" and had nowhere to store the
 * answer, because the column did not exist.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

const TEST_DB = process.env["TEST_DATABASE_URL"];
const TESTER = "obs_writes_test";
const OTHER = "obs_writes_other";

// Raw SQL through the pool, the way the deletion integration test does it —
// `drizzle-orm` is not resolvable from the tests root, and going through SQL
// also means these assert what the DATABASE holds rather than what the ORM
// believes it holds, which is the point of an integration test.
let pool: any;

describe.skipIf(!TEST_DB)("write paths (integration)", () => {
  beforeAll(async () => {
    process.env["DATABASE_URL"] = TEST_DB;
    const S: any = await import("@workspace/db");
    pool = S.pool;
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM tasks WHERE tester_id = ANY($1)`, [[TESTER, OTHER]]);
  });

  const insert = async (testerId: string, title: string, extra: Record<string, any> = {}) => {
    const cols = ["tester_id", "title", "sort_order", ...Object.keys(extra)];
    const vals = [testerId, title, 0, ...Object.values(extra)];
    const ph = vals.map((_, i) => `$${i + 1}`).join(", ");
    const r = await pool.query(
      `INSERT INTO tasks (${cols.join(", ")}) VALUES (${ph}) RETURNING *`, vals);
    return r.rows;
  };
  const byId = async (id: number) =>
    (await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id])).rows[0];

  // The column that did not exist this afternoon. A pure test cannot catch a
  // missing column; it only fails where a row is actually written.
  it("persists a confirmed activity key", async () => {
    const [row] = await insert(TESTER, "Call the accountant back");
    expect(row.activity_key).toBeNull();

    await pool.query(`UPDATE tasks SET activity_key = $1 WHERE id = $2`, ["call-family", row.id]);
    expect((await byId(row.id)).activity_key).toBe("call-family");
  });

  it("persists a duration chosen at scheduling time", async () => {
    const [row] = await insert(TESTER, "Renew the domain");
    expect(row.est_minutes).toBeNull();

    await pool.query(`UPDATE tasks SET est_minutes = $1 WHERE id = $2`, [15, row.id]);
    expect((await byId(row.id)).est_minutes).toBe(15);
  });

  // The relation the backfill exists to establish. Nullable by design: unset
  // means "not scheduled", and must never be confused with "predates the
  // column" — which is why the title-join fallback was deleted from the render
  // path rather than kept as a guess.
  it("links a task to a planning window, and leaves it null otherwise", async () => {
    const [loose] = await insert(TESTER, "Reply to Dana");
    const [linked] = await insert(TESTER, "Write the outline", { planning_window_id: 4242 });
    expect(loose.planning_window_id).toBeNull();
    expect(linked.planning_window_id).toBe(4242);
  });

  // Every read in the scheduling stack is tester-scoped. This is the property
  // that a pure test cannot check at all, because it has no rows to leak.
  it("never returns another account's rows", async () => {
    await insert(TESTER, "Mine");
    await insert(OTHER, "Theirs");
    const mine = (await pool.query(`SELECT * FROM tasks WHERE tester_id = $1`, [TESTER])).rows;
    expect(mine.map((r: any) => r.title)).toEqual(["Mine"]);
    expect(mine.every((r: any) => r.tester_id === TESTER)).toBe(true);
  });

  // A write that silently touches two accounts is the worst available bug in a
  // multi-tenant table, and the one least visible in review.
  it("scopes an update to one account", async () => {
    const [mine] = await insert(TESTER, "Same title");
    await insert(OTHER, "Same title");

    await pool.query(
      `UPDATE tasks SET est_minutes = 30 WHERE tester_id = $1 AND title = $2`,
      [TESTER, "Same title"]);

    expect((await byId(mine.id)).est_minutes).toBe(30);
    const theirs = (await pool.query(`SELECT * FROM tasks WHERE tester_id = $1`, [OTHER])).rows[0];
    expect(theirs.est_minutes).toBeNull();
  });

  it("round-trips every field the scheduler reads", async () => {
    const [row] = await insert(TESTER, "Deep work: rewrite the sequence", {
      est_minutes: 240, due_date: "2026-08-07", activity_key: "deep-work", planet: "Mercury",
    });
    const back = await byId(row.id);
    // Everything /shape-day and /shape-week read off a task.
    expect({
      title: back.title, est: back.est_minutes, due: back.due_date, activity: back.activity_key,
    }).toEqual({
      title: "Deep work: rewrite the sequence", est: 240, due: "2026-08-07", activity: "deep-work",
    });
  });
});
