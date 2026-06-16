/**
 * Seeds timing rules on existing cultivations based on their domain and element.
 *
 * Run ONCE (or re-run safely — it only updates rows where timing fields are NULL):
 *   cd scripts && npx tsx src/seed-timing-rules.ts
 *
 * Also adds the timing columns if they don't yet exist (safe to run before drizzle-kit push).
 */
import { db, cultivations } from "@workspace/db";
import { isNull, sql } from "drizzle-orm";

// ── Default timing rules by element ──────────────────────────────────────────

const ELEMENT_RULES: Record<string, {
  favoredPlanets: string[];
  cautionPlanets: string[];
  favoredPhases: string[];
  minimumViable: string;
}> = {
  fire: {
    favoredPlanets: ["Mars", "Sun"],
    cautionPlanets: ["Saturn", "Neptune"],
    favoredPhases: ["waxing", "full"],
    minimumViable: "5 minutes of intentional movement or breath work",
  },
  earth: {
    favoredPlanets: ["Saturn", "Venus"],
    cautionPlanets: ["Uranus"],
    favoredPhases: ["waxing", "waning", "new", "full"],
    minimumViable: "maintain one grounding routine (meal, sleep, body care)",
  },
  air: {
    favoredPlanets: ["Mercury", "Jupiter"],
    cautionPlanets: ["Neptune", "Saturn"],
    favoredPhases: ["waxing", "full"],
    minimumViable: "10 minutes of reading, writing, or structured thinking",
  },
  water: {
    favoredPlanets: ["Moon", "Venus", "Neptune"],
    cautionPlanets: ["Mars", "Saturn"],
    favoredPhases: ["waning", "new", "full"],
    minimumViable: "5 minutes of journaling or sitting with what is present",
  },
  spirit: {
    favoredPlanets: ["Moon", "Saturn", "Neptune"],
    cautionPlanets: ["Mars"],
    favoredPhases: ["new", "waning", "full"],
    minimumViable: "2 minutes of silence, stillness, or intention",
  },
};

// ── Domain overrides (take precedence over element defaults) ──────────────────

const DOMAIN_RULES: Record<string, Partial<typeof ELEMENT_RULES[string]>> = {
  movement: {
    favoredPlanets: ["Mars", "Sun"],
    cautionPlanets: ["Saturn", "Neptune"],
    favoredPhases: ["waxing", "full"],
    minimumViable: "10 minutes of movement — walk, stretch, or bodyweight work",
  },
  sleep: {
    favoredPlanets: ["Moon", "Saturn"],
    cautionPlanets: ["Mars", "Uranus"],
    favoredPhases: ["waning", "new"],
    minimumViable: "consistent sleep and wake time, no screens 30 min before bed",
  },
  energy: {
    favoredPlanets: ["Sun", "Mars", "Jupiter"],
    cautionPlanets: ["Saturn", "Neptune"],
    favoredPhases: ["waxing", "full"],
    minimumViable: "address the one thing that most depletes energy today",
  },
  digestion: {
    favoredPlanets: ["Mercury", "Saturn"],
    cautionPlanets: ["Mars", "Neptune"],
    favoredPhases: ["waxing", "waning"],
    minimumViable: "regular meal rhythm, no skipping",
  },
  "food-rhythm": {
    favoredPlanets: ["Mercury", "Moon", "Saturn"],
    cautionPlanets: ["Neptune"],
    favoredPhases: ["waxing", "waning"],
    minimumViable: "one prepared meal today",
  },
  "nervous-system": {
    favoredPlanets: ["Moon", "Saturn", "Mercury"],
    cautionPlanets: ["Uranus", "Mars"],
    favoredPhases: ["waning", "new"],
    minimumViable: "5 minutes of breath or somatic regulation",
  },
  mood: {
    favoredPlanets: ["Venus", "Moon", "Jupiter"],
    cautionPlanets: ["Saturn", "Mars"],
    favoredPhases: ["waxing", "full"],
    minimumViable: "acknowledge what is present without forcing a shift",
  },
  recovery: {
    favoredPlanets: ["Moon", "Venus", "Neptune"],
    cautionPlanets: ["Mars", "Uranus"],
    favoredPhases: ["waning", "new"],
    minimumViable: "rest — passive recovery counts",
  },
  "creative-practice": {
    favoredPlanets: ["Venus", "Moon", "Mercury", "Neptune"],
    cautionPlanets: ["Saturn"],
    favoredPhases: ["waxing", "full", "waning"],
    minimumViable: "5 minutes of free creative expression — no output required",
  },
  "spiritual-practice": {
    favoredPlanets: ["Moon", "Saturn", "Neptune", "Sun"],
    cautionPlanets: ["Mars"],
    favoredPhases: ["new", "full", "waning"],
    minimumViable: "2 minutes of stillness or prayer",
  },
  "study-learning": {
    favoredPlanets: ["Mercury", "Jupiter", "Saturn"],
    cautionPlanets: ["Neptune", "Uranus"],
    favoredPhases: ["waxing", "full"],
    minimumViable: "15 minutes of focused reading or review",
  },
  boundaries: {
    favoredPlanets: ["Mars", "Saturn"],
    cautionPlanets: ["Neptune", "Moon"],
    favoredPhases: ["waxing", "waning"],
    minimumViable: "name one thing that is a yes and one that is a no today",
  },
  "social-rhythm": {
    favoredPlanets: ["Venus", "Jupiter", "Mercury"],
    cautionPlanets: ["Saturn", "Mars"],
    favoredPhases: ["waxing", "full"],
    minimumViable: "one genuine connection — text, call, or presence",
  },
  "pain-tension": {
    favoredPlanets: ["Moon", "Saturn", "Venus"],
    cautionPlanets: ["Mars", "Uranus"],
    favoredPhases: ["waning", "new"],
    minimumViable: "10 minutes of gentle movement or heat",
  },
};

async function main() {
  // Add columns if missing
  await db.execute(sql`
    ALTER TABLE cultivations
      ADD COLUMN IF NOT EXISTS favored_planets  jsonb,
      ADD COLUMN IF NOT EXISTS caution_planets  jsonb,
      ADD COLUMN IF NOT EXISTS favored_phases   jsonb,
      ADD COLUMN IF NOT EXISTS minimum_viable   text
  `);
  console.log("✓ Columns ensured");

  // Fetch all cultivations with no timing rules yet
  const rows = await db
    .select()
    .from(cultivations)
    .where(isNull(cultivations.favoredPlanets));

  console.log(`Seeding timing rules for ${rows.length} cultivations...`);
  let updated = 0;

  for (const c of rows) {
    const el = c.elements?.[0] ?? c.element ?? "earth";
    const domainRule = DOMAIN_RULES[c.domain];
    const elementRule = ELEMENT_RULES[el] ?? ELEMENT_RULES.earth;

    const rule = {
      favoredPlanets: domainRule?.favoredPlanets  ?? elementRule.favoredPlanets,
      cautionPlanets: domainRule?.cautionPlanets  ?? elementRule.cautionPlanets,
      favoredPhases:  domainRule?.favoredPhases   ?? elementRule.favoredPhases,
      minimumViable:  domainRule?.minimumViable   ?? elementRule.minimumViable,
    };

    await db
      .update(cultivations)
      .set({
        favoredPlanets: rule.favoredPlanets,
        cautionPlanets: rule.cautionPlanets,
        favoredPhases:  rule.favoredPhases,
        minimumViable:  rule.minimumViable,
      })
      .where(sql`id = ${c.id}`);

    updated++;
    console.log(`  ✓ ${c.title} (${c.domain} / ${el}) → favors ${rule.favoredPlanets.join(", ")}`);
  }

  console.log(`\nDone. ${updated} cultivations updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
