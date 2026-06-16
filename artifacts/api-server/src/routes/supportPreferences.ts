import { Router, type IRouter } from "express";
import { db, supportPreferences } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

const VALID_CATEGORIES = new Set([
  "food-rhythm", "rest-sleep", "movement", "somatic", "meditation",
  "breathwork", "guided-visualization", "journaling", "acupressure",
  "aromatherapy", "herbal-research", "creative-practice", "social-boundary",
]);

// GET /api/support-preferences
router.get("/support-preferences", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;

  const row = (await db.select().from(supportPreferences)
    .where(eq(supportPreferences.testerId, testerId))
    .limit(1))[0] ?? null;

  res.json({ testerId, categories: (row?.categories as string[]) ?? [] });
});

// PUT /api/support-preferences
router.put("/support-preferences", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { categories } = req.body;

  if (!Array.isArray(categories)) {
    res.status(400).json({ error: "categories must be an array" });
    return;
  }

  const sanitized = categories.filter((c) => typeof c === "string" && VALID_CATEGORIES.has(c));

  const [row] = await db
    .insert(supportPreferences)
    .values({ testerId, categories: sanitized })
    .onConflictDoUpdate({
      target: supportPreferences.testerId,
      set: { categories: sanitized, updatedAt: new Date() },
    })
    .returning();

  res.json({ testerId, categories: (row.categories as string[]) ?? [] });
});

export default router;
