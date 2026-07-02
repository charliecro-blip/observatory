import { Router } from "express";
import { db } from "@workspace/db";
import { cycleTracking } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

function tid(req: any, res: any): string | null {
  const id = req.headers["x-tester-id"] as string | undefined;
  if (!id) { res.status(400).json({ error: "Missing x-tester-id" }); return null; }
  return id;
}

// GET /api/cycle — get current cycle settings
router.get("/cycle", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const [row] = await db.select().from(cycleTracking).where(eq(cycleTracking.testerId, testerId));
  res.json(row ?? null);
});

// POST /api/cycle — create or replace
router.post("/cycle", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const { cycleStartDate, cycleLength = 28, lutealLength = 14 } = req.body;
  if (!cycleStartDate) { res.status(400).json({ error: "cycleStartDate required" }); return; }
  await db.delete(cycleTracking).where(eq(cycleTracking.testerId, testerId));
  const [row] = await db.insert(cycleTracking).values({ testerId, cycleStartDate, cycleLength, lutealLength }).returning();
  res.status(201).json(row);
});

// PATCH /api/cycle — update
router.patch("/cycle", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  const { cycleStartDate, cycleLength, lutealLength } = req.body;
  const update: Record<string, any> = {};
  if (cycleStartDate != null) update.cycleStartDate = cycleStartDate;
  if (cycleLength != null) update.cycleLength = cycleLength;
  if (lutealLength != null) update.lutealLength = lutealLength;
  update.updatedAt = new Date();
  const [row] = await db.update(cycleTracking).set(update).where(eq(cycleTracking.testerId, testerId)).returning();
  if (!row) { res.status(404).json({ error: "No cycle record found" }); return; }
  res.json(row);
});

// DELETE /api/cycle — remove
router.delete("/cycle", async (req, res) => {
  const testerId = tid(req, res); if (!testerId) return;
  await db.delete(cycleTracking).where(eq(cycleTracking.testerId, testerId));
  res.json({ ok: true });
});

export default router;
