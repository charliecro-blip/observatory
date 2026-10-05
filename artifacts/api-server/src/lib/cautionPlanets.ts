import { db, testerProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";

const PLANETS = new Set(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);

/**
 * The person's self-reported caution planets (Settings, synced to their
 * profile), validated to planet names. Empty when none are set or the row
 * can't be read: an objection is never invented from a failed lookup.
 */
export async function cautionPlanetsFor(testerId: string): Promise<string[]> {
  try {
    const row = (await db.select({ c: testerProfiles.cautionPlanets }).from(testerProfiles).where(eq(testerProfiles.testerId, testerId)).limit(1))[0];
    return Array.isArray(row?.c) ? [...new Set((row!.c as unknown[]).filter((p): p is string => typeof p === "string" && PLANETS.has(p)))] : [];
  } catch {
    return [];
  }
}
