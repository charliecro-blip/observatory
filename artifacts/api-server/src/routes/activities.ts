import { Router, type IRouter } from "express";
import { db, activities } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  CreateActivityBody,
  UpdateActivityParams,
  UpdateActivityBody,
  DeleteActivityParams,
} from "@workspace/api-zod";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

router.get("/activities", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.testerId, testerId))
    .orderBy(activities.createdAt);
  res.json(rows);
});

router.post("/activities", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const body = CreateActivityBody.parse(req.body);
  const [row] = await db
    .insert(activities)
    .values({ ...body, testerId, active: body.active ?? true })
    .returning();
  res.status(201).json(row);
});

router.patch("/activities/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = UpdateActivityParams.parse(req.params);
  const body = UpdateActivityBody.parse(req.body);
  const [row] = await db
    .update(activities)
    .set(body)
    .where(and(eq(activities.id, id), eq(activities.testerId, testerId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }
  res.json(row);
});

router.delete("/activities/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = DeleteActivityParams.parse(req.params);
  await db
    .delete(activities)
    .where(and(eq(activities.id, id), eq(activities.testerId, testerId)));
  res.status(204).end();
});

export default router;
