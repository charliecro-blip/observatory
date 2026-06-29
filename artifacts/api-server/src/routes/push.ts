import { Router } from "express";
import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptions } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const vapidPublic = process.env["VAPID_PUBLIC_KEY"];
const vapidPrivate = process.env["VAPID_PRIVATE_KEY"];

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails("mailto:hello@tides.app", vapidPublic, vapidPrivate);
}

// GET /api/push/vapid-key — return public key so client can subscribe
router.get("/api/push/vapid-key", (_req, res) => {
  if (!vapidPublic) { res.status(503).json({ error: "Push not configured" }); return; }
  res.json({ publicKey: vapidPublic });
});

// POST /api/push/subscribe — save a push subscription
router.post("/api/push/subscribe", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string;
  if (!testerId) { res.status(401).json({ error: "Missing tester id" }); return; }

  const { endpoint, keys } = req.body ?? {};
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
  });

  res.json({ ok: true });
});

// POST /api/push/unsubscribe
router.post("/api/push/unsubscribe", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string;
  if (!testerId) { res.status(401).json({ error: "Missing tester id" }); return; }
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.testerId, testerId));
  res.json({ ok: true });
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
      }
    }
  }
}

export default router;
