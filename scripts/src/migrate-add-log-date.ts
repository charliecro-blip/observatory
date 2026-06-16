/**
 * Migration: add log_date column to health_logs and backfill from logged_at.
 *
 * Run ONCE after deploying the logDate schema change:
 *   cd scripts && npx tsx src/migrate-add-log-date.ts
 *
 * The column stores the user's local calendar date (YYYY-MM-DD) so that
 * calendar bucketing works correctly across timezones. After this migration,
 * new inserts from the client will populate log_date directly.
 *
 * The backfill uses UTC dates from logged_at — imperfect for users outside UTC,
 * but correct for the majority of historical logs. New logs will be accurate.
 */
import { db, healthLogs } from "@workspace/db";
import { isNull, sql } from "drizzle-orm";

const client = (db as any).$client ?? (db as any).session?.client;

async function main() {
  // Step 1: Add the column if it doesn't exist
  try {
    await db.execute(
      sql`ALTER TABLE health_logs ADD COLUMN IF NOT EXISTS log_date text`
    );
    console.log("✓ Column log_date ensured");
  } catch (err: any) {
    console.error("Failed to add column:", err.message);
    process.exit(1);
  }

  // Step 2: Backfill from logged_at (UTC date string) for rows where log_date is NULL
  const result = await db.execute(
    sql`UPDATE health_logs
        SET log_date = to_char(logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        WHERE log_date IS NULL`
  );
  const count = (result as any).rowCount ?? "?";
  console.log(`✓ Backfilled ${count} rows`);

  console.log("Migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
