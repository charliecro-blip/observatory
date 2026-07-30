/**
 * The one place the browser push-subscription dance lives, so every opt-in
 * surface (Settings, the Today banner, onboarding) shares it instead of
 * duplicating the requestPermission → SW register → VAPID → subscribe →
 * /api/push/subscribe sequence. The caller updates the preferences flag on
 * success (this helper stays free of the preferences context so it can run
 * from anywhere).
 */
export type EnablePushResult = { ok: true } | { ok: false; reason: string };

// Cache the one config fetch — every opt-in surface can check this before
// even rendering its prompt (audit: the OS permission dialog used to fire
// BEFORE this check, so a tester granted browser permission and then got a
// tail-swallowed "not configured" failure — asking for something real and
// getting nothing in return, exactly backwards).
let configuredCache: boolean | null = null;
export async function isPushConfigured(): Promise<boolean> {
  if (configuredCache != null) return configuredCache;
  try {
    const r = await fetch("/api/push/vapid-key");
    configuredCache = r.ok;
  } catch {
    configuredCache = false;
  }
  return configuredCache;
}

export async function enablePush(opts: { lat?: number; lon?: number } = {}): Promise<EnablePushResult> {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return { ok: false, reason: "This browser doesn't support notifications." };
    }
    const keyRes = await fetch("/api/push/vapid-key");
    if (!keyRes.ok) { configuredCache = false; return { ok: false, reason: "Push isn't configured on the server yet." }; }
    configuredCache = true;
    const { publicKey } = await keyRes.json();

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "Permission wasn't granted." };

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

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
