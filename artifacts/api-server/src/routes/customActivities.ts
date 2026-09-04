/**
 * CUSTOM ACTIVITIES (owner 2026-09-03: "an option for people to add their
 * own — to put in their own activity, whether singular or recurring, and
 * have that be something we sortage into different astrological energies
 * and create rule sets for").
 *
 * Auto-diagnosed the same way a Guiding Star already is: the title (plus an
 * optional description) goes through the SAME deterministic reader
 * (associateDeterministic) GuidingStarsHub calls at POST /api/associate, no
 * separate model or heuristic invented for this one surface. A correspondence
 * match carries houses/hourRulers already; a bare planet/element read from
 * the keyword table does not, so those get a defensible classical default —
 * a planet's own natural-rulership house(s) — rather than an empty rule set
 * that would silently score every window as "good" and never "great".
 *
 * The row this produces is ActivityCorrespondence-shaped on purpose: once
 * created, it is not a second, lesser kind of activity. computeElections and
 * evaluateActivityInterval (electionEngine.ts) take it as `extraActivities`
 * and score it with the exact same rules as the built-in fifty.
 */
import { Router, type IRouter } from "express";
import { db, customActivities } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { associateDeterministic } from "../lib/associate.js";
import { ACTIVITIES, ACTIVITY_CATEGORIES, type ActivityCorrespondence, type ActivityCategory } from "../lib/activityCorrespondences.js";

const router: IRouter = Router();

// Traditional natural-house rulership — each planet's own domicile sign(s)
// read as a house number (Aries = 1st ... Pisces = 12th). Used only when a
// custom activity's diagnosis carries no correspondence match of its own to
// take houses from, so a freshly invented activity still has SOMETHING for
// the engine's personalized/GREAT tier to check against, grounded in a real
// classical fact rather than an invented one.
const NATURAL_HOUSES: Record<string, number[]> = {
  Sun: [5], Moon: [4], Mercury: [3, 6], Venus: [2, 7], Mars: [1, 8],
  Jupiter: [9, 12], Saturn: [10, 11], Uranus: [11], Neptune: [12], Pluto: [8],
};

/** Turns an Association (POST /api/associate's shape) into the full
 *  ActivityCorrespondence rule set electionEngine.ts actually reads. */
function toCorrespondence(
  key: string, label: string, description: string | undefined, category: ActivityCategory | undefined,
  diag: ReturnType<typeof associateDeterministic>,
): Omit<ActivityCorrespondence, "key"> & { key: string } {
  const planets = diag.planets.length ? diag.planets : ["Moon"]; // never zero significators
  const planetWeights: Record<string, number> = {};
  planets.forEach((p, i) => { planetWeights[p] = i === 0 ? 1.0 : 0.7; });
  const houses = diag.houses?.length ? diag.houses : Array.from(new Set(planets.flatMap(p => NATURAL_HOUSES[p] ?? [])));
  return {
    key, label, category: category ?? "craft",
    keywords: [label.toLowerCase()],
    element: diag.element ?? "earth", // ActivityCorrespondence.element is non-nullable; earth is the shape's own quiet default elsewhere (RhythmLead.tsx)
    planets: planetWeights,
    hourRulers: planets,
    aspects: "soft",
    signs: {},
    houses,
    phase: null,
    voc: "neutral",
    mercuryRx: null,
    windowType: diag.windowType,
    gloss: description?.trim() || diag.rationale,
  };
}

function rowToCorrespondence(row: typeof customActivities.$inferSelect): ActivityCorrespondence {
  return {
    key: row.key, label: row.label, category: (row.category as ActivityCategory) ?? "craft",
    keywords: row.keywords as string[],
    element: (row.element as ActivityCorrespondence["element"]) ?? "earth",
    planets: row.planets as Record<string, number>,
    hourRulers: row.hourRulers as string[],
    aspects: row.aspects as "soft" | "effort",
    signs: row.signs as Record<string, string>,
    houses: row.houses as number[],
    phase: row.phase as ActivityCorrespondence["phase"],
    voc: row.voc as ActivityCorrespondence["voc"],
    mercuryRx: row.mercuryRx as ActivityCorrespondence["mercuryRx"],
    windowType: row.windowType,
    gloss: row.gloss,
  };
}

/** Every custom activity a tester holds, as ActivityCorrespondence rows —
 *  what electionEngine.ts's `extraActivities` and the picker list both want.
 *  Exported so routes/elections.ts can pull it in without a second query
 *  shape to keep in sync. */
export async function customActivitiesFor(testerId: string): Promise<ActivityCorrespondence[]> {
  const rows = await db.select().from(customActivities).where(eq(customActivities.testerId, testerId));
  return rows.map(rowToCorrespondence);
}

router.get("/activities/custom", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const rows = await db.select().from(customActivities).where(eq(customActivities.testerId, testerId));
  res.json({ activities: rows.map(r => ({ ...rowToCorrespondence(r), id: r.id, createdAt: r.createdAt, source: r.source })) });
});

router.post("/activities/custom", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const title = (req.body?.title as string)?.trim();
  const description = (req.body?.description as string)?.trim() || undefined;
  const category = req.body?.category as ActivityCategory | undefined;
  if (!title) { res.status(400).json({ error: "title is required" }); return; }
  if (category && !ACTIVITY_CATEGORIES.some(c => c.key === category)) {
    res.status(400).json({ error: "unknown_category" }); return;
  }

  // A built-in activity's own name ("write a first draft") should not spawn
  // a shadow copy with a worse rule set — the correspondence table already
  // has one, richer than anything this route can synthesize. Point there
  // instead of creating a duplicate.
  const diag = associateDeterministic(`${title} ${description ?? ""}`.trim());
  if (diag.activityKey && ACTIVITIES.some(a => a.key === diag.activityKey)) {
    const existing = ACTIVITIES.find(a => a.key === diag.activityKey)!;
    res.status(409).json({
      error: "matches_builtin", key: existing.key, label: existing.label,
      message: `That reads as "${existing.label}", already in the timing engine — use it directly rather than a copy.`,
    });
    return;
  }

  // `key` is unique-not-null and depends on the row's own id, which does not
  // exist until after insert — a placeholder that must itself be unique
  // (never a literal like "pending", which two concurrent creates would
  // collide on) holds the row until it's updated to "custom-<id>" below.
  const placeholder = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [inserted] = await db.insert(customActivities).values({
    testerId, key: placeholder, label: title, description: description ?? null,
    category: category ?? null,
  }).returning();
  const key = `custom-${inserted.id}`;
  const built = toCorrespondence(key, title, description, category, diag);
  const [row] = await db.update(customActivities).set({
    key, keywords: built.keywords, element: built.element, planets: built.planets,
    hourRulers: built.hourRulers, aspects: built.aspects, signs: built.signs, houses: built.houses,
    phase: built.phase, voc: built.voc, mercuryRx: built.mercuryRx, windowType: built.windowType,
    gloss: built.gloss, source: diag.source,
  }).where(eq(customActivities.id, inserted.id)).returning();

  res.status(201).json({ ...rowToCorrespondence(row), id: row.id, createdAt: row.createdAt, source: row.source });
});

router.delete("/activities/custom/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  await db.delete(customActivities).where(and(eq(customActivities.id, id), eq(customActivities.testerId, testerId)));
  res.status(204).end();
});

// By key rather than numeric id: the picker/week views only ever hold the
// ActivityCorrespondence-shaped key ("custom-14"), same as every built-in
// activity — making them look up a raw row id just to delete one would be
// the one place they'd need to know this table exists at all.
router.delete("/activities/custom/by-key/:key", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const key = String(req.params.key);
  await db.delete(customActivities).where(and(eq(customActivities.key, key), eq(customActivities.testerId, testerId)));
  res.status(204).end();
});

export default router;
