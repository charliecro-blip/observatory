import { Router, type IRouter } from "express";
import { db, supplements } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  CreateSupplementBody,
  UpdateSupplementParams,
  UpdateSupplementBody,
  DeleteSupplementParams,
} from "@workspace/api-zod";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

router.get("/supplements", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const rows = await db
    .select()
    .from(supplements)
    .where(eq(supplements.testerId, testerId))
    .orderBy(supplements.createdAt);
  res.json(rows);
});

router.post("/supplements", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const body = CreateSupplementBody.parse(req.body);
  const [row] = await db
    .insert(supplements)
    .values({ ...body, testerId, active: body.active ?? true })
    .returning();
  res.status(201).json(row);
});

router.patch("/supplements/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = UpdateSupplementParams.parse(req.params);
  const body = UpdateSupplementBody.parse(req.body);
  const [row] = await db
    .update(supplements)
    .set(body)
    .where(and(eq(supplements.id, id), eq(supplements.testerId, testerId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Supplement not found" });
    return;
  }
  res.json(row);
});

router.delete("/supplements/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = DeleteSupplementParams.parse(req.params);
  await db
    .delete(supplements)
    .where(and(eq(supplements.id, id), eq(supplements.testerId, testerId)));
  res.status(204).end();
});

export default router;
