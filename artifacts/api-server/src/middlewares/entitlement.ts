/**
 * THE PAID-FEATURE GATE.
 *
 * Enforced HERE and not in the browser. The gate this replaces was a
 * localStorage boolean on the client that defaulted to unlocked; nothing
 * server-side ever asked. Anything worth charging for has to be refused by
 * the thing that computes it.
 *
 * It refuses with 402 and a NAMED feature, so the client can say which door
 * is closed rather than rendering a generic wall — and so a bug that gates
 * the wrong endpoint is legible in a log line instead of a support email.
 *
 * WHAT IT NEVER GUARDS: reading or keeping anything already committed.
 * A person whose trial ends keeps every window Compass placed on their
 * calendar; only the ability to compute NEW ones stops. The guards therefore
 * sit on the compute routes and never on storage or retrieval — get that
 * backwards and the graceful downgrade becomes the hostage-taking the whole
 * pricing model exists to avoid.
 */

import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { testerProfiles } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { can, effectivePlan, type Feature } from "../lib/entitlements.js";

export async function planForTester(testerId: string) {
  const row = (await db
    .select({ plan: testerProfiles.plan, trialEndsAt: testerProfiles.trialEndsAt })
    .from(testerProfiles).where(eq(testerProfiles.testerId, testerId)).limit(1))[0] ?? null;
  return effectivePlan(row);
}

export function requireFeature(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const raw = req.headers["x-tester-id"];
    const testerId = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    // No identity is not this middleware's business — the route's own
    // requireTesterId owns that answer, and answering it twice in two voices
    // is how a 401 starts arriving as a 402.
    if (!testerId) { next(); return; }
    try {
      const plan = await planForTester(testerId);
      if (can(plan, feature)) { next(); return; }
      res.status(402).json({ error: "upgrade_required", feature, plan });
    } catch (err) {
      // Failing OPEN here would hand out paid compute on a database blip;
      // failing closed turns a blip into a visible outage, which the client
      // already has honest words for. Closed, same as the session gate.
      (req as any).log?.error({ err }, "entitlement check failed");
      res.status(503).json({ error: "entitlement_unavailable" });
    }
  };
}
