/**
 * The one place the browser push-subscription dance lives, so every opt-in
 * surface (Settings, the Today banner, onboarding) shares it instead of
 * duplicating the requestPermission → SW register → VAPID → subscribe →
 * /api/push/subscribe sequence. The caller updates the preferences flag on
 * success (this helper stays free of the preferences context so it can run
 * from anywhere).
 */
export type EnablePushResult = { ok: true } | { ok: false; reason: string };

export async function enablePush(opts: { lat?: number; lon?: number } = {}): Promise<EnablePushResult> {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return { ok: false, reason: "This browser doesn't support notifications." };
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "Permission wasn't granted." };

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const keyRes = await fetch("/api/push/vapid-key");
    if (!keyRes.ok) return { ok: false, reason: "Push isn't configured on the server yet." };
    const { publicKey } = await keyRes.json();

    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });

    const testerId = localStorage.getItem("obs_tester_id");
    const r = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { ...(testerId ? { "x-tester-id": testerId } : {}), "Content-Type": "application/json" },
      body: JSON.stringify({ ...sub.toJSON(), lat: opts.lat, lon: opts.lon }),
    });
    if (!r.ok) return { ok: false, reason: "Couldn't save the subscription." };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "Something went wrong enabling notifications." };
  }
}
