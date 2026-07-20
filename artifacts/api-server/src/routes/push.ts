import { Router } from "express";
import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptions } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
// Module cycle with lib/notifier (it imports sendPushToTester from here) is
// benign: both sides only call the other's functions at runtime, never at load.
import { bustSubscriptionCache } from "../lib/notifier";

const router = Router();

const vapidPublic = process.env["VAPID_PUBLIC_KEY"];
const vapidPrivate = process.env["VAPID_PRIVATE_KEY"];

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails("mailto:hello@tides.app", vapidPublic, vapidPrivate);
}

// GET /api/push/vapid-key — return public key so client can subscribe
router.get("/push/vapid-key", (_req, res) => {
  if (!vapidPublic) { res.status(503).json({ error: "Push not configured" }); return; }
  res.json({ publicKey: vapidPublic });
});

// POST /api/push/subscribe — save a push subscription
router.post("/push/subscribe", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string;
  if (!testerId) { res.status(401).json({ error: "Missing tester id" }); return; }

  const { endpoint, keys, lat, lon } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription object" }); return;
  }

  // Upsert: delete old, insert new
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.testerId, testerId));
  await db.insert(pushSubscriptions).values({
    testerId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    lat: lat != null ? String(lat) : null,
    lon: lon != null ? String(lon) : null,
  });
  // New subscriber gets pings on the next tick, not after the hourly refresh.
  bustSubscriptionCache();

  res.json({ ok: true });
});

// POST /api/push/unsubscribe
router.post("/push/unsubscribe", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string;
  if (!testerId) { res.status(401).json({ error: "Missing tester id" }); return; }
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.testerId, testerId));
  bustSubscriptionCache();
  res.json({ ok: true });
});

// POST /api/push/test — send a test notification to this tester
router.post("/push/test", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string;
  if (!testerId) { res.status(401).json({ error: "Missing tester id" }); return; }
  if (!vapidPublic || !vapidPrivate) { res.status(503).json({ error: "Push not configured" }); return; }
  try {
    await sendPushToTester(testerId, {
      title: "✦ Compass test notification",
      body: "Push notifications are working. You'll get alerts for planetary hour shifts, VOC, and moon phases.",
      tag: "test",
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Internal helper — exported for the notifier
export async function sendPushToTester(testerId: string, payload: object) {
  if (!vapidPublic || !vapidPrivate) return;
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.testerId, testerId));

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (e: any) {
      // 410 Gone = subscription expired, clean it up
      if (e.statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        bustSubscriptionCache();
      }
    }
  }
}

export default router;
