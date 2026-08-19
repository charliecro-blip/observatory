/**
 * CHECKOUT AND THE WEBHOOK — the provider-agnostic half.
 *
 * No provider is chosen yet (owner, 2026-08-19: build the seam, not the
 * integration), so the adapter is the unconfigured one and both routes refuse
 * honestly. Choosing later means writing one adapter; nothing in this file
 * changes.
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { testerProfiles } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { billing, applyBillingEvent } from "../lib/billing/index.js";
import { entitlementFor } from "../lib/entitlements.js";

const router: IRouter = Router();

/** What it costs, if a provider will say. Null renders no number — a wrong
 *  price is worse than no price. */
router.get("/billing/price", async (_req, res) => {
  res.json({ configured: billing().configured, price: await billing().price() });
});

router.post("/billing/checkout", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const url = await billing().createCheckout({ testerId, returnUrl: req.body?.returnUrl });
  if (!url) {
    // 503, not 500: nothing is broken, there is simply nothing to sell yet.
    res.status(503).json({ error: "billing_unconfigured", provider: billing().name });
    return;
  }
  res.json(url);
});

/**
 * The provider's webhook.
 *
 * UNVERIFIED IS REJECTED. parseWebhook returning null means the signature did
 * not check out — or, with no provider, that there is no signature to check —
 * and an endpoint that trusted the body anyway would let anyone set any
 * account to paid by posting JSON at it.
 *
 * Answers 200 for anything it decided not to act on. A provider that receives
 * a 4xx retries, and retrying a well-formed event we deliberately ignored
 * (stale, or a kind we do not handle) would repeat forever.
 */
router.post("/billing/webhook", async (req, res) => {
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  const event = await billing().parseWebhook(raw, req.headers);
  if (!event) { res.status(400).json({ error: "unverified_webhook" }); return; }

  const row = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.testerId, event.testerId)).limit(1))[0] ?? null;
  if (!row) { res.status(200).json({ ok: true, ignored: "unknown-account" }); return; }

  const outcome = applyBillingEvent(row, event);
  if (!outcome.applied) { res.status(200).json({ ok: true, ignored: outcome.reason }); return; }

  await db.update(testerProfiles)
    .set({ ...outcome.patch, updatedAt: new Date() })
    .where(eq(testerProfiles.testerId, event.testerId));
  res.json({ ok: true, plan: outcome.patch.plan ?? row.plan });
});

/** What the app believes, for reconciling against the provider when the two
 *  disagree — which is the billing failure that actually costs people money. */
router.get("/billing/status", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const row = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.testerId, testerId)).limit(1))[0] ?? null;
  res.json({
    ...entitlementFor(row),
    provider: billing().name,
    configured: billing().configured,
    billingStatus: row?.billingStatus ?? null,
  });
});

export default router;
