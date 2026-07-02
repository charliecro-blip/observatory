import { Router } from "express";
import { db } from "@workspace/db";
import { daemonMemory } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function tid(req: any, res: any): string | null {
  const id = req.headers["x-tester-id"] as string | undefined;
  if (!id) { res.status(400).json({ error: "Missing x-tester-id" }); return null; }
  return id;
}

// GET /api/daemon-memory — last 20 entries
router.get("/daemon-memory", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const rows = await db
    .select()
    .from(daemonMemory)
    .where(eq(daemonMemory.testerId, testerId))
    .orderBy(desc(daemonMemory.createdAt))
    .limit(20);
  res.json(rows);
});

// POST /api/daemon-memory
router.post("/daemon-memory", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const { content, source = "advisor" } = req.body ?? {};
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }
  const [row] = await db.insert(daemonMemory).values({ testerId, content: content.trim(), source }).returning();
  res.status(201).json(row);
});

// DELETE /api/daemon-memory/:id
router.delete("/daemon-memory/:id", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const id = parseInt(req.params.id, 10);
  await db.delete(daemonMemory).where(and(eq(daemonMemory.id, id), eq(daemonMemory.testerId, testerId)));
  res.status(204).send();
});

export default router;
