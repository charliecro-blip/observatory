import { useState } from "react";
import { usePreferences } from "@/contexts/preferences-context";
import { enablePush } from "@/lib/pushSubscribe";

/**
 * The morning "⛵ Cast off" and evening "🌙 Log the day" pushes are the app's
 * daily-return heartbeat — but they default off and used to live only in
 * Settings, so for most testers they never fired. This is a tasteful,
 * dismissible Today banner that turns them on in one tap. Shown only when
 * notifications aren't already on, the browser hasn't blocked them, and the
 * tester hasn't dismissed it.
 */
const DISMISS_KEY = "compass-notif-optin-dismissed";

export function NotificationOptIn({ lat, lon }: { lat?: number; lon?: number }) {
  const { prefs, updateNotifications } = usePreferences();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const unsupported = typeof window === "undefined" || !("Notification" in window);
  const blocked = !unsupported && Notification.permission === "denied";

  if (unsupported || blocked || dismissed || prefs.notifications?.enabled) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function enable() {
    setBusy(true);
    setErr("");
    const res = await enablePush({ lat, lon });
    setBusy(false);
    if (res.ok) {
      updateNotifications({ enabled: true });
      // It's on now — the banner will unmount on the next render.
    } else {
      setErr(res.reason);
      if (Notification.permission === "denied") dismiss();
    }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 12, padding: "12px 14px", marginBottom: 14,
    }}>
      <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>☾</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
          Keep the rhythm going?
        </div>
        <div style={{ fontSize: 11.5, color: "#8a8278", lineHeight: 1.5, marginTop: 1 }}>
          A morning star-glance and an evening check-in — the gentle two-taps that make it a daily habit. No spam; you choose exactly what fires.
        </div>
        {err && <div style={{ fontSize: 10.5, color: "#c05030", marginTop: 4 }}>{err}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={dismiss} style={{
          fontSize: 11, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
          border: "1px solid var(--color-border)", background: "transparent", color: "#888",
        }}>Not now</button>
        <button onClick={enable} disabled={busy} style={{
          fontSize: 11, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 600,
          border: "none", background: "#1a2a3a", color: "#fff", opacity: busy ? 0.6 : 1,
        }}>{busy ? "Enabling…" : "Enable"}</button>
      </div>
    </div>
  );
}
