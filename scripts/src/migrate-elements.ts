import { fileURLToPath } from "url";
import { dirname } from "path";
import { db, cultivations } from "@workspace/db";
import type { CultivationElement } from "@workspace/db";
import { eq } from "drizzle-orm";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);
void _dirname;

// ── Domain → multi-element mapping (source of truth) ─────────────────────────

const DOMAIN_ELEMENTS_MAP: Record<string, CultivationElement[]> = {
  "spiritual-practice": ["spirit"],
  movement:             ["fire", "earth"],
  energy:               ["fire"],
  "creative-practice":  ["water", "spirit"],
  digestion:            ["earth"],
  "food-rhythm":        ["earth"],
  recovery:             ["earth", "water"],
  "pain-tension":       ["earth"],
  "nervous-system":     ["air"],
  "study-learning":     ["air"],
  "social-rhythm":      ["air", "water"],
  boundaries:           ["air"],
  sleep:                ["water"],
  mood:                 ["water"],
};

const ALL_ELEMENTS = ["fire", "earth", "air", "water", "spirit"] as const;

function deriveElementsForRow(domain: string, existingElement: string | null): CultivationElement[] {
  // spiritual-practice always becomes spirit (overrides old "fire" mapping)
  if (domain === "spiritual-practice") return ["spirit"];
  const mapped = DOMAIN_ELEMENTS_MAP[domain];
  if (mapped) return mapped;
  // Fall back to existing single element if valid
  if (existingElement && (ALL_ELEMENTS as readonly string[]).includes(existingElement)) {
    return [existingElement as CultivationElement];
  }
  return ["earth"];
}

async function main() {
  const force = process.argv.includes("--force");
  const allRows = await db.select().from(cultivations);

  console.log(`\n🌱  Element migration — ${allRows.length} cultivation(s)${force ? " (--force: re-migrating all)" : ""}\n`);
  console.log("─".repeat(80));
  console.log(
    `${"  Title".padEnd(32)} ${"Domain".padEnd(22)} ${"Old element".padEnd(14)} New elements`,
  );
  console.log("─".repeat(80));

  let migrated = 0;
  let skipped = 0;

  for (const row of allRows) {
    const existingElements = row.elements as CultivationElement[] | null;

    if (existingElements && existingElements.length > 0 && !force) {
      console.log(
        `${"  (skip) " + row.title.slice(0, 24).padEnd(32)} ${row.domain.padEnd(22)} ${(row.element ?? "—").padEnd(14)} ${existingElements.join(", ")}`,
      );
      skipped++;
      continue;
    }

    const newElements = deriveElementsForRow(row.domain, row.element);
    const primaryElement = newElements[0];

    await db
      .update(cultivations)
      .set({ elements: newElements, element: primaryElement })
      .where(eq(cultivations.id, row.id));

    console.log(
      `${"  " + row.title.slice(0, 30).padEnd(32)} ${row.domain.padEnd(22)} ${(row.element ?? "—").padEnd(14)} ${newElements.join(", ")}`,
    );
    migrated++;
  }

  console.log("─".repeat(80));
  console.log(`\n✅  Migrated: ${migrated}   Skipped (already set): ${skipped}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
