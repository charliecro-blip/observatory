/**
 * Migration: add milestone_id column to tasks.
 *
 * Run ONCE after deploying the PM-facilitation first build (2026-07-09):
 *   cd scripts && npx tsx src/migrate-add-task-milestone.ts
 *
 * The join that turns a Guiding Star into a real project: a task can belong to
 * a step (milestone), so progress rolls up task → step → star. Nullable;
 * existing tasks stay unattached.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestone_id integer`);
    console.log("✓ Column tasks.milestone_id ensured");
  } catch (err: any) {
    console.error("Failed to add column:", err.message);
    process.exit(1);
  }
  console.log("Migration complete.");
  process.exit(0);
}

main();
