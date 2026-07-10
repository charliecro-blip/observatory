/**
 * Migration: add favored_planets column to habits.
 *
 * Run ONCE after deploying the habits+practices merge (2026-07-09):
 *   cd scripts && npx tsx src/migrate-add-favored-planets.ts
 *
 * Habits absorbed the cultivations timing model — favored_planets stores the
 * comma-separated planet(s) a habit is supported by (e.g. "Mars,Sun" for
 * strength work). Nullable; existing rows stay NULL and read as no preference.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.execute(sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS favored_planets text`);
    console.log("✓ Column habits.favored_planets ensured");
  } catch (err: any) {
    console.error("Failed to add column:", err.message);
    process.exit(1);
  }
  console.log("Migration complete.");
  process.exit(0);
}

main();
