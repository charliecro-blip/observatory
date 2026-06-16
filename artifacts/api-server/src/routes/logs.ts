import { Router, type IRouter } from "express";
import { db, healthLogs } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListLogsQueryParams,
  CreateLogBody,
  GetLogParams,
  UpdateLogParams,
  UpdateLogBody,
  DeleteLogParams,
} from "@workspace/api-zod";
import { getAstroSnapshot } from "../lib/astro.js";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

router.get("/logs", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { limit, offset } = ListLogsQueryParams.parse(req.query);
  const rows = await db
    .select()
    .from(healthLogs)
    .where(eq(healthLogs.testerId, testerId))
    .orderBy(desc(healthLogs.loggedAt))
    .limit(limit ?? 50)
    .offset(offset ?? 0);
  res.json(rows);
});

router.post("/logs", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const body = CreateLogBody.parse(req.body);
  const astroSnapshot = JSON.stringify(getAstroSnapshot(new Date()));
  // logDate comes from the client (user's local YYYY-MM-DD) — not part of the Zod schema.
  const logDate: string | null = (typeof req.body?.logDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.logDate))
    ? req.body.logDate
    : null;
  const loggedAt = body.loggedAt ? new Date(body.loggedAt) : new Date();
  const baseValues = { ...body, testerId, loggedAt, astroSnapshot };

  let row;
  try {
    // logDate column requires migration: ALTER TABLE health_logs ADD COLUMN log_date text;
    [row] = await db.insert(healthLogs).values({ ...baseValues, logDate }).returning();
  } catch (err: any) {
    if (err?.message?.includes("log_date") || err?.code === "42703") {
      // Column doesn't exist yet — insert without it
      [row] = await db.insert(healthLogs).values(baseValues).returning();
    } else {
      throw err;
    }
  }
  res.status(201).json(row);
});

router.get("/logs/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = GetLogParams.parse(req.params);
  const [row] = await db
    .select()
    .from(healthLogs)
    .where(and(eq(healthLogs.id, id), eq(healthLogs.testerId, testerId)));
  if (!row) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  res.json(row);
});

router.patch("/logs/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = UpdateLogParams.parse(req.params);
  const body = UpdateLogBody.parse(req.body);
  const [row] = await db
    .update(healthLogs)
    .set(body)
    .where(and(eq(healthLogs.id, id), eq(healthLogs.testerId, testerId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  res.json(row);
});

router.delete("/logs/:id", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { id } = DeleteLogParams.parse(req.params);
  await db
    .delete(healthLogs)
    .where(and(eq(healthLogs.id, id), eq(healthLogs.testerId, testerId)));
  res.status(204).end();
});

export default router;
