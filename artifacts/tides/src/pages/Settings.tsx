import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { resetTour } from "@/lib/tour";
import { localToday, addDaysLocal } from "@/lib/dates";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";
import { logEvent } from "@/lib/analytics";
import { useEntitlements } from "@/contexts/entitlements-context";
import { PREMIUM_FEATURES, FREE_KEEPS } from "@/lib/premium";
import { TEXT_SCALES, getTextScale, setTextScale } from "@/lib/textScale";
import { useTheme, PALETTES } from "@/contexts/theme-context";
import { usePreferences } from "@/contexts/preferences-context";
import { RHYTHMS, TRIM_FOLDS, HELP_TIMING_OPTIONS, type NotificationPrefs, type DisplayPrefs } from "@/lib/preferences";
import RhythmProposal from "@/components/RhythmProposal";
import { RhythmRecordTable } from "@/components/RhythmRecord";
import { CHRONOTYPE_OPTIONS, purgeLocalData } from "@/lib/tester-profile";
import { Guide } from "@/components/Guide";
import { enablePush } from "@/lib/pushSubscribe";
import type { ChronotypeProfile } from "@/lib/tester-profile";
import { CautionQuestionnaireModal } from "@/components/CautionQuestionnaire";
import { ELEMENT_COLORS } from "@/lib/elements";

function authH(tid: string | null) {
  return { ...(tid ? { "x-tester-id": tid } : {}), "Content-Type": "application/json" };
}

// ---- Small UI primitives ----

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 38, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
        background: on ? "#1a2a3a" : "var(--color-border)", position: "relative", flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: "50%", background: "var(--color-card)",
        position: "absolute", top: 3, left: on ? 19 : 3, transition: "left 0.15s",
      }} />
    </button>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: "var(--color-foreground)" }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "16px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: sub ? 2 : 10 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12 }}>{sub}</div>}
      {children}
    </div>
  );
}

function GuideSection({ testerId }: { testerId: string | null }) {
  const [open, setOpen] = useState(false);
  // Replaying clears this account's tour verdict; Today re-arms it on open.
  const [replayArmed, setReplayArmed] = useState(false);
  return (
    <>
      {open && <Guide onClose={() => setOpen(false)} />}
      <SectionCard title="How Compass works" sub="The walkthrough points at the live dashboard; the guide is the fuller reference.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => { resetTour(testerId); setReplayArmed(true); logEvent("tour_replay_requested"); }} style={{
            fontSize: 12, padding: "7px 16px", borderRadius: 8, cursor: "pointer",
            border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--text-1)",
          }}>Replay the walkthrough</button>
          <button onClick={() => setOpen(true)} style={{
            fontSize: 12, padding: "7px 16px", borderRadius: 8, cursor: "pointer",
            border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--text-1)",
          }}>Open the guide</button>
          {replayArmed && <span style={{ fontSize: 11, color: "var(--text-3)" }}>It'll start when you open Today.</span>}
        </div>
      </SectionCard>
    </>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--color-border)", margin: "2px 0" }} />;
}

// ── Delete account ───────────────────────────────────────────────────────────
// The privacy policy promised deletion but the only route was emailing a human,
// which is a promise with a person-shaped single point of failure. This makes it
// self-serve and immediate.
//
// Three deliberate choices:
//   · collapsed by default — this is not a setting anyone browses toward
//   · it says what goes, specifically, BEFORE asking for a decision
//   · a typed phrase, not an "are you sure?" — the one action here with no undo
//     should cost more than a reflex click
const DELETE_PHRASE = "DELETE MY ACCOUNT";

function DeleteAccountSection({ testerId }: { testerId: string | null }) {
  const { profile } = useTester();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"idle" | "deleting" | "done" | "error">("idle");
  const [result, setResult] = useState<{ rowsDeleted: number; googleRevoked: boolean | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const armed = typed.trim().toUpperCase() === DELETE_PHRASE && state === "idle";

  const doDelete = async () => {
    if (!testerId) return;
    setState("deleting");
    setError(null);
    try {
      const r = await fetch("/api/account", {
        method: "DELETE",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: DELETE_PHRASE }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        // The server deletes in one transaction, so a failure means nothing
        // was removed. Say that plainly — otherwise the honest thing to assume
        // is a half-deleted account, which is far more alarming than the truth.
        setError(data?.message ?? "Couldn't reach the server. Nothing was deleted — try again.");
        setState("error");
        return;
      }
      setResult({ rowsDeleted: data.rowsDeleted ?? 0, googleRevoked: data.googleRevoked ?? null });
      setState("done");
      purgeLocalData();
    } catch {
      setError("Couldn't reach the server. Nothing was deleted — try again.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <SectionCard title="Account deleted">
        <div style={{ fontSize: 12, color: "var(--color-foreground)", lineHeight: 1.6 }}>
          {result?.rowsDeleted ?? 0} records erased, and this browser has been cleared.
          {result?.googleRevoked === true && " Your Google Calendar access was revoked."}
          {result?.googleRevoked === false && (
            <> We <strong>couldn't confirm</strong> that Google revoked our calendar access — please
            remove it yourself at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google account permissions</a>.</>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, lineHeight: 1.6 }}>
          Our database host keeps point-in-time backups, so copies may persist there briefly
          before they age out. Your account key no longer restores anything.
        </div>
        <button onClick={() => window.location.reload()} style={{
          marginTop: 12, padding: "8px 20px", borderRadius: 8, border: "none",
          fontSize: 12, cursor: "pointer", background: "#1a2a3a", color: "#ffffff",
        }}>Start over</button>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Delete account">
      {!open ? (
        <button onClick={() => setOpen(true)} style={{
          fontSize: 11, padding: "5px 12px", borderRadius: 7, cursor: "pointer",
          border: "1px solid var(--color-border)", background: "var(--color-card)", color: "#9a6060",
        }}>Delete my account and data…</button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, color: "var(--color-foreground)", lineHeight: 1.6 }}>
            This erases everything, immediately and permanently: your birth details and chart,
            tasks, habits and their history, planning windows, Guiding Stars, wins, journal and
            logbook entries, felt ratings, cycle data, advisor conversations, email and push
            subscriptions, your calendar-feed link, usage records, and your account key.
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.6 }}>
            Any Google Calendar connection is revoked with Google. Database backups may hold
            copies briefly before they age out. There is no undo, and your account key will not
            bring it back.
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
            Type <strong style={{ color: "#9a6060", fontFamily: "monospace" }}>{DELETE_PHRASE}</strong> to confirm:
          </div>
          <SettingsInput
            value={typed}
            onChange={setTyped}
            placeholder={DELETE_PHRASE}
            aria-label={`Type ${DELETE_PHRASE} to confirm deletion`}
            autoComplete="off"
            spellCheck={false}
          />
          {error && <div style={{ fontSize: 11, color: "#a03030", lineHeight: 1.5 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={doDelete} disabled={!armed} style={{
              padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 12,
              cursor: armed ? "pointer" : "not-allowed",
              background: armed ? "#9a3030" : "var(--color-card-2)",
              color: armed ? "#ffffff" : "var(--text-3)",
            }}>{state === "deleting" ? "Deleting…" : "Delete permanently"}</button>
            <button onClick={() => { setOpen(false); setTyped(""); setError(null); setState("idle"); }} style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
              border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-muted)",
            }}>Cancel</button>
          </div>
          {profile?.recoveryCode && (
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>
              Wanting a clean browser but keeping the account? Use “Switch profile” under Profile
              instead — your key ({profile.recoveryCode}) restores it later.
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function ThemeSection() {
  const { palette, setPalette } = useTheme();
  return (
    <SectionCard title="Theme" sub="The whole app's look. More coming — this is the first set from the design studio.">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {PALETTES.map((p) => (
          <button key={p.key} onClick={() => setPalette(p.key)} style={{
            display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer",
            padding: "11px 13px", borderRadius: 10,
            border: palette === p.key ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
            background: palette === p.key ? "var(--color-card-2)" : "var(--color-card)",
          }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: p.swatch, flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
            <span>
              <span style={{ fontSize: 12.5, fontWeight: palette === p.key ? 700 : 500, color: "var(--color-foreground)", display: "block" }}>{p.name}</span>
              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{p.mode === "dark" ? "Dark" : "Light"}</span>
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// Email reports — the morning bulletin, actually delivered. Save an address +
// which reports; the server's cron sends them at your chosen hour (needs
// RESEND_API_KEY on the server — until then "send test" reports honestly).
function EmailReportsSection({ testerId }: { testerId: string | null }) {
  const prefsForEmail = usePreferences().prefs;
  const tz = new Date().getTimezoneOffset();
  const { lat, lon } = useTester();
  const [email, setEmail] = useState("");
  const [spans, setSpans] = useState<string[]>(["day"]);
  const [sendHour, setSendHour] = useState(7);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [senderConfigured, setSenderConfigured] = useState<boolean | null>(null);
  const authH: Record<string, string> = testerId ? { "x-tester-id": testerId } : {};

  useEffect(() => {
    if (!testerId) return;
    fetch("/api/reports/email-subscription", { headers: authH })
      .then(r => r.json())
      .then(d => {
        setSenderConfigured(d.senderConfigured ?? null);
        if (d.subscription) {
          setEmail(d.subscription.email ?? "");
          setSpans(d.subscription.spans ?? ["day"]);
          setSendHour(d.subscription.sendHour ?? 7);
          setSaved(true);
        }
      }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testerId]);

  const save = async () => {
    setStatus(null);
    const r = await fetch("/api/reports/email-subscription", {
      method: "POST", headers: { ...authH, "Content-Type": "application/json" },
      body: JSON.stringify({ email, spans, sendHour, enabled: true, lat, lon, detail: prefsForEmail.display.astroDetail ?? "medium", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    if (r.ok) {
      logEvent("email_subscribe", { spans, sendHour });
      setSaved(true);
      // Was unconditional — promised delivery even when senderConfigured was
      // already known false, i.e. sends can't actually happen yet.
      setStatus(senderConfigured === false
        ? "Saved, but the server has no email key yet (RESEND_API_KEY) — nothing can send until it's set."
        : "Saved — reports will arrive at your chosen hour.");
    }
    else setStatus((await r.json().catch(() => null))?.error ?? "Couldn't save — check the address.");
  };
  const sendTest = async () => {
    setStatus("Sending…");
    const r = await fetch(`/api/reports/email-test?tz=${tz}`, { method: "POST", headers: authH });
    const d = await r.json().catch(() => null);
    setStatus(d?.sent ? "Test sent — check your inbox."
      : d?.senderConfigured === false ? "Saved, but the server has no email key yet (RESEND_API_KEY) — nothing can send until it's set."
      : "Couldn't send — save your address first.");
  };
  const toggleSpan = (s: string) => setSpans(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const open = (span: string) => {
    fetch(`/api/reports/preview?span=${span}&tz=${tz}`, { headers: authH })
      .then(r => r.text())
      .then(html => { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); } });
  };
  const SPAN_LABELS: Record<string, string> = { day: "The day · every morning", week: "The week · Sundays", newmoon: "New Moon mornings" };

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", marginBottom: 3 }}>
        Email reports
        {saved && <span style={{ fontSize: 10.5, fontWeight: 600, color: "#4a7a52", background: "#4a7a5222", padding: "1px 6px", borderRadius: 6, marginLeft: 6 }}>ON</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 10 }}>
        A short weather bulletin for your life, delivered each morning — the woven day, your windows, your aims.
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address for the bulletin"
          style={{ flex: 1, minWidth: 190, padding: "7px 11px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)", color: "var(--color-foreground)" }} />
        <select value={sendHour} onChange={e => setSendHour(parseInt(e.target.value, 10))} aria-label="Hour to send the bulletin" style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 11.5, background: "var(--color-card-2)", color: "var(--color-foreground)" }}>
          {[5, 6, 7, 8, 9, 10].map(h => <option key={h} value={h}>{h} AM</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {(["day", "week", "newmoon"] as const).map(s => (
          <button key={s} onClick={() => toggleSpan(s)} style={{
            fontSize: 10.5, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
            border: spans.includes(s) ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
            background: spans.includes(s) ? "#1a2a3a10" : "var(--color-card-2)",
            color: spans.includes(s) ? "var(--color-foreground)" : "var(--text-3)", fontWeight: spans.includes(s) ? 600 : 400,
          }}>{SPAN_LABELS[s]}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={save} disabled={!email} style={{ fontSize: 11, fontWeight: 600, padding: "6px 16px", borderRadius: 8, cursor: email ? "pointer" : "default", border: "none", background: email ? "#1a2a3a" : "#c9c4bb", color: "#ffffff" }}>
          {saved ? "Update" : "Turn on"}
        </button>
        {saved && (
          <button onClick={sendTest} style={{ fontSize: 11, padding: "6px 13px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)" }}>
            Send me a test
          </button>
        )}
        <span style={{ flex: 1 }} />
        {(["day", "week"] as const).map(s => (
          <button key={s} onClick={() => open(s)} style={{ fontSize: 10, padding: "5px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: "none", color: "var(--text-3)" }}>
            preview the {s} ↗
          </button>
        ))}
      </div>
      {status && <div style={{ fontSize: 10.5, color: status.startsWith("Saved") || status.startsWith("Test") ? "#4a7a52" : "#8a6a30", marginTop: 8, lineHeight: 1.5 }}>{status}</div>}
      {senderConfigured === false && !status && (
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 8 }}>Server note: RESEND_API_KEY isn't set yet — subscriptions save, sends wait for the key.</div>
      )}
    </div>
  );
}

function TextSizeSection() {
  const [scale, setScale] = useState(getTextScale());
  return (
    <SectionCard title="Text size" sub="Make everything bigger and easier to read. Applies across the whole app.">
      <div style={{ display: "flex", gap: 8 }}>
        {TEXT_SCALES.map((t) => (
          <button key={t.key} onClick={() => { setTextScale(t.key); setScale(t.key); }} style={{
            flex: 1, padding: "9px 0", borderRadius: 9, cursor: "pointer",
            border: scale === t.key ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
            background: scale === t.key ? "#1a2a3a10" : "var(--color-card-2)",
            color: scale === t.key ? "var(--color-foreground)" : "var(--color-muted)", fontWeight: scale === t.key ? 600 : 400,
            fontSize: t.key === "default" ? 12 : t.key === "large" ? 13.5 : 15,
          }}>{t.label}</button>
        ))}
      </div>
    </SectionCard>
  );
}

// ---- Notification section ----

const ALL_PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

function NotificationSection({ lat, lon }: { lat: number; lon: number }) {
  const { prefs, updateNotifications } = usePreferences();
  const n = prefs.notifications;
  const [permState, setPermState] = useState<NotificationPermission>("default");
  const [subscribing, setSubscribing] = useState(false);
  const [subMsg, setSubMsg] = useState("");

  useEffect(() => {
    if ("Notification" in window) setPermState(Notification.permission);
  }, []);

  async function enableNotifications() {
    setSubscribing(true);
    setSubMsg("");
    const res = await enablePush({ lat, lon });
    if ("Notification" in window) setPermState(Notification.permission);
    if (res.ok) {
      updateNotifications({ enabled: true });
      setSubMsg("Notifications enabled ✓");
    } else {
      setSubMsg(res.reason);
    }
    setSubscribing(false);
  }

  async function disableNotifications() {
    const testerId = localStorage.getItem("obs_tester_id");
    await fetch("/api/push/unsubscribe", { method: "POST", headers: authH(testerId) });
    updateNotifications({ enabled: false });
    setSubMsg("Notifications disabled.");
  }

  const hourShiftPlanetsIsAll = n.hourShiftPlanets === "all";
  const hourShiftPlanets = Array.isArray(n.hourShiftPlanets) ? n.hourShiftPlanets : ALL_PLANETS;

  function toggleHourPlanet(planet: string) {
    const current = hourShiftPlanets;
    const next = current.includes(planet)
      ? current.filter(p => p !== planet)
      : [...current, planet];
    updateNotifications({ hourShiftPlanets: next.length === ALL_PLANETS.length ? "all" : next });
  }

  return (
    <SectionCard title="Notifications" sub="Push alerts delivered via your browser. You control exactly what fires.">

      {/* Master enable */}
      <Row label="Enable push notifications" sub={permState === "denied" ? "Blocked in browser settings — check Site Settings." : permState === "default" ? "Browser will ask for permission." : "Active"}>
        <Toggle on={n.enabled} onChange={v => v ? enableNotifications() : disableNotifications()} />
      </Row>
      {subscribing && <div style={{ fontSize: 10, color: "var(--color-muted)", marginBottom: 6 }}>Setting up…</div>}
      {subMsg && <div style={{ fontSize: 10, color: subMsg.includes("✓") ? "#60a060" : "#c05030", marginBottom: 6 }}>{subMsg}</div>}
      {n.enabled && (
        <button onClick={async () => {
          const tid = localStorage.getItem("obs_tester_id");
          const r = await fetch("/api/push/test", { method: "POST", headers: { ...(tid ? { "x-tester-id": tid } : {}), "Content-Type": "application/json" } });
          setSubMsg(r.ok ? "Test sent — check your notifications ✓" : "Test failed — check subscription.");
        }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--text-2)", cursor: "pointer", marginBottom: 6 }}>
          Send test notification
        </button>
      )}

      {n.enabled && (
        <>
          <Divider />

          {/* Quiet hours */}
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: "var(--text-1)", marginBottom: 6 }}>Quiet hours</div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 8 }}>No notifications will be sent during this window.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase" }}>From</span>
                <select value={n.quietStart} onChange={e => updateNotifications({ quietStart: Number(e.target.value) })} aria-label="Quiet hours start"
                  style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card-2)" }}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 12 }}>to</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase" }}>Until</span>
                <select value={n.quietEnd} onChange={e => updateNotifications({ quietEnd: Number(e.target.value) })} aria-label="Quiet hours end"
                  style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card-2)" }}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Divider />

          {/* Hour shifts */}
          <Row label="Planetary hour shifts" sub="Alert when the ruling planet changes.">
            <Toggle on={n.hourShifts} onChange={v => updateNotifications({ hourShifts: v })} />
          </Row>
          {n.hourShifts && (
            <div style={{ paddingBottom: 8 }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 6 }}>Alert for these planets:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => updateNotifications({ hourShiftPlanets: "all" })}
                  style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, border: "1px solid", cursor: "pointer",
                    background: hourShiftPlanetsIsAll ? "#1a2a3a" : "var(--color-card)",
                    color: hourShiftPlanetsIsAll ? "#ffffff" : "var(--text-2)",
                    borderColor: hourShiftPlanetsIsAll ? "#1a2a3a" : "#d0cbc3",
                  }}>All</button>
                {ALL_PLANETS.map(p => {
                  const on = !hourShiftPlanetsIsAll && hourShiftPlanets.includes(p);
                  return (
                    <button key={p} onClick={() => toggleHourPlanet(p)}
                      style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, border: "1px solid", cursor: "pointer",
                        background: on ? "var(--color-card-2)" : "var(--color-card)",
                        color: on ? "var(--text-1)" : "var(--color-muted)",
                        borderColor: on ? "#c0bab0" : "#e0dbd4",
                      }}>{p}</button>
                  );
                })}
              </div>
            </div>
          )}

          <Divider />

          {/* Angle crossings */}
          <Row label="Angle crossings" sub="When planets cross ASC or MC.">
            <Toggle on={n.crossings} onChange={v => updateNotifications({ crossings: v })} />
          </Row>
          {n.crossings && (
            <div style={{ paddingBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Planet filter:</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["benefic", "malefic", "both", "all"] as const).map(opt => (
                    <button key={opt} onClick={() => updateNotifications({ crossingPlanets: opt })}
                      style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, border: "1px solid", cursor: "pointer",
                        background: n.crossingPlanets === opt ? "#1a2a3a" : "var(--color-card)",
                        color: n.crossingPlanets === opt ? "#ffffff" : "var(--text-2)",
                        borderColor: n.crossingPlanets === opt ? "#1a2a3a" : "#d0cbc3",
                      }}>{opt === "both" ? "Both" : opt === "all" ? "All" : opt === "benefic" ? "Benefics" : "Malefics"}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Angles:</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["ASC", "MC", "DSC", "IC"] as const).map(ang => {
                    const on = n.crossingAngles.includes(ang);
                    return (
                      <button key={ang} onClick={() => {
                        const next = on ? n.crossingAngles.filter(a => a !== ang) : [...n.crossingAngles, ang];
                        updateNotifications({ crossingAngles: next });
                      }} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, border: "1px solid", cursor: "pointer",
                        background: on ? "var(--color-card-2)" : "var(--color-card)", color: on ? "var(--text-1)" : "var(--color-muted)",
                        borderColor: on ? "#c0bab0" : "#e0dbd4",
                      }}>{ang}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <Divider />

          {/* Moon events */}
          <Row label="New moon" sub="When the lunar cycle resets.">
            <Toggle on={n.newMoon} onChange={v => updateNotifications({ newMoon: v })} />
          </Row>
          <Divider />
          <Row label="Full moon" sub="Peak of the lunar cycle.">
            <Toggle on={n.fullMoon} onChange={v => updateNotifications({ fullMoon: v })} />
          </Row>
          <Divider />
          <Row label="Void of Course start" sub="When the moon stops making aspects.">
            <Toggle on={n.vocAlert} onChange={v => updateNotifications({ vocAlert: v })} />
          </Row>
          <Divider />
          <Row label="High-quality windows" sub="When quality score jumps above 6.">
            <Toggle on={n.highQuality} onChange={v => updateNotifications({ highQuality: v })} />
          </Row>
        </>
      )}
    </SectionCard>
  );
}

// ---- Display section ----

const RAIL_SECTIONS = [
  { key: "moon" as const,       label: "Moon & element",   sub: "Phase, sign, element" },
  { key: "aspects" as const,    label: "Moon aspects",     sub: "Current applying/separating aspects" },
  { key: "retrogrades" as const, label: "Retrogrades",     sub: "Planets in retrograde motion" },
  { key: "hour" as const,       label: "Planetary hour",   sub: "Current hour + upcoming 4" },
  { key: "transits" as const,   label: "Personal transits", sub: "Requires natal chart" },
];

function DisplaySection() {
  const { prefs, updateDisplay } = usePreferences();
  const d = prefs.display;
  const testerId = useTester().profile?.testerId ?? null;

  function toggleRailSection(key: typeof RAIL_SECTIONS[number]["key"]) {
    const next = d.railSections.includes(key)
      ? d.railSections.filter(s => s !== key)
      : [...d.railSections, key];
    updateDisplay({ railSections: next });
  }

  return (
    <SectionCard title="Display" sub="Choose what appears in the sidebar and Today view.">
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Sidebar sections</div>
      {RAIL_SECTIONS.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <Divider />}
          <Row label={s.label} sub={s.sub}>
            <Toggle on={d.railSections.includes(s.key)} onChange={() => toggleRailSection(s.key)} />
          </Row>
        </React.Fragment>
      ))}

      <div style={{ height: 16 }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Time display</div>
      <Row label="Time format" sub="How times appear across the app.">
        <div style={{ display: "flex", background: "var(--color-card-2)", borderRadius: 7, padding: 3, gap: 1 }}>
          {(["12h", "24h"] as const).map(fmt => (
            <button key={fmt} onClick={() => updateDisplay({ timeFormat: fmt })} style={{
              fontSize: 11, padding: "3px 12px", borderRadius: 5, border: "none", cursor: "pointer",
              background: d.timeFormat === fmt ? "var(--color-card)" : "transparent",
              color: d.timeFormat === fmt ? "var(--color-foreground)" : "var(--text-3)",
              fontWeight: d.timeFormat === fmt ? 600 : 400,
            }}>{fmt}</button>
          ))}
        </div>
      </Row>
      <Divider />
      <Row label="How much astrology" sub="Same engine underneath — this only changes what's shown. Minimal quiets the sky across the whole app: plain reasons on the compass, a bare calendar, the instrument rail folded away. Medium keeps the moon and the day's character. Full shows everything in the sky's own words. Starting a session quiets the sky on its own, for as long as it runs.">
        <div style={{ display: "flex", background: "var(--color-card-2)", borderRadius: 7, padding: 3, gap: 1 }}>
          {(["minimal", "medium", "full"] as const).map(lvl => (
            <button key={lvl} onClick={() => updateDisplay({ astroDetail: lvl })} style={{
              fontSize: 11, padding: "3px 11px", borderRadius: 5, border: "none", cursor: "pointer", textTransform: "capitalize",
              background: d.astroDetail === lvl ? "var(--color-card)" : "transparent",
              color: d.astroDetail === lvl ? "var(--color-foreground)" : "var(--text-3)",
              fontWeight: d.astroDetail === lvl ? 600 : 400,
            }}>{lvl}</button>
          ))}
        </div>
      </Row>
      <Divider />
      <Row label="How you want to be met" sub="Same tasks and the same sky, with a different first question. One clear move leads with the thing to push on; Protect my routines with what you keep; Keep options open with a few ways in. Read the day first is the app as it has been.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {RHYTHMS.map(r => (
            <button key={r.key} onClick={() => updateDisplay({ rhythm: r.key, rhythmOverride: null, collapsedModules: TRIM_FOLDS[r.key] })} title={r.blurb} style={{
              fontSize: 11, padding: "4px 11px", borderRadius: 7, cursor: "pointer",
              border: `1px solid ${(d.rhythm ?? "tide") === r.key ? "var(--color-primary)" : "var(--color-border)"}`,
              background: (d.rhythm ?? "tide") === r.key ? "var(--color-primary)" : "var(--color-card-2)",
              color: (d.rhythm ?? "tide") === r.key ? "#fff" : "var(--text-3)",
              fontWeight: (d.rhythm ?? "tide") === r.key ? 600 : 400,
            }}>{r.label}</button>
          ))}
        </div>
      </Row>
      <Row label="The Log" sub="The days, the wake, the felt pattern and the diary. Off hides the tab; nothing is deleted, and it comes back when you turn it on.">
        <div style={{ display: "flex", background: "var(--color-card-2)", borderRadius: 7, padding: 3, gap: 1 }}>
          {([["on", true], ["off", false]] as const).map(([label, val]) => (
            <button key={label} onClick={() => updateDisplay({ showLog: val })} style={{
              fontSize: 11, padding: "3px 12px", borderRadius: 5, border: "none", cursor: "pointer",
              background: (d.showLog ?? true) === val ? "var(--color-card)" : "transparent",
              color: (d.showLog ?? true) === val ? "var(--color-foreground)" : "var(--text-3)",
              fontWeight: (d.showLog ?? true) === val ? 600 : 400,
            }}>{label}</button>
          ))}
        </div>
      </Row>
      <Divider />
      <Row label="By your chart" sub="Four functions, read off four placements. The chart proposes them; the record below is what decides.">
        <div style={{ maxWidth: 560 }}>
          <RhythmProposal testerId={testerId} current={d.rhythm ?? "tide"} onUse={(r) => updateDisplay({ rhythm: r, rhythmOverride: null, collapsedModules: TRIM_FOLDS[r] })} />
        </div>
      </Row>
      <Row label="Your record" sub="Which rhythm Home led with each day, against how you rated the day in the Log.">
        <div style={{ maxWidth: 560 }}><RhythmRecordTable testerId={testerId} /></div>
      </Row>
      <Divider />
      <Row label="How much on screen" sub="Essential: the tide, today's plan, your aims. Expanded: adds rhythm, big sky, pulse, and standing conditions.">
        <div style={{ display: "flex", background: "var(--color-card-2)", borderRadius: 7, padding: 3, gap: 1 }}>
          {(["essential", "expanded"] as const).map(lvl => (
            <button key={lvl} onClick={() => updateDisplay({ uiDensity: lvl })} style={{
              fontSize: 11, padding: "3px 11px", borderRadius: 5, border: "none", cursor: "pointer", textTransform: "capitalize",
              background: (d.uiDensity ?? "essential") === lvl ? "var(--color-card)" : "transparent",
              color: (d.uiDensity ?? "essential") === lvl ? "var(--color-foreground)" : "var(--text-3)",
              fontWeight: (d.uiDensity ?? "essential") === lvl ? 600 : 400,
            }}>{lvl}</button>
          ))}
        </div>
      </Row>
      <Divider />
      <Row label="Sky language" sub="At the full level: plain keeps the app's own words (Deep, Surge); bilingual adds the sky's words next to them (Moon in Pisces).">
        <div style={{ display: "flex", background: "var(--color-card-2)", borderRadius: 7, padding: 3, gap: 1 }}>
          {(["plain", "bilingual"] as const).map(mode => (
            <button key={mode} onClick={() => updateDisplay({ skyLanguage: mode })} style={{
              fontSize: 11, padding: "3px 12px", borderRadius: 5, border: "none", cursor: "pointer", textTransform: "capitalize",
              background: d.skyLanguage === mode ? "var(--color-card)" : "transparent",
              color: d.skyLanguage === mode ? "var(--color-foreground)" : "var(--text-3)",
              fontWeight: d.skyLanguage === mode ? 600 : 400,
            }}>{mode}</button>
          ))}
        </div>
      </Row>

      <div style={{ height: 16 }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Tasks</div>
      <Row label="Carry unfinished tasks forward" sub="Overdue tasks move to today, labelled with where they came from. Scheduled blocks never move on their own.">
        <Toggle on={d.autoRollover} onChange={v => updateDisplay({ autoRollover: v })} />
      </Row>

      <div style={{ height: 16 }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Today page</div>
      <Row label="Void Moon" sub="Show it on Home when the Moon goes void.">
        <Toggle on={d.todayShowVOC} onChange={v => updateDisplay({ todayShowVOC: v })} />
      </Row>
      <Divider />
      <Row label="Tide wave" sub="Dynamic quality curve across the day.">
        <Toggle on={d.todayShowWave} onChange={v => updateDisplay({ todayShowWave: v })} />
      </Row>
      <Divider />
      <Row label="14-day strip" sub="Scrollable quality overview below the wave.">
        <Toggle on={d.todayShow14Day} onChange={v => updateDisplay({ todayShow14Day: v })} />
      </Row>
      <Divider />
      <Row label="Journal" sub="Daily reflection prompt.">
        <Toggle on={d.todayShowJournal} onChange={v => updateDisplay({ todayShowJournal: v })} />
      </Row>
      <Divider />
      <Row label="Angle crossings" sub="Timed markers when planets cross the local angles (moved here from the Today page).">
        <Toggle on={d.todayShowCrossings} onChange={v => updateDisplay({ todayShowCrossings: v })} />
      </Row>
    </SectionCard>
  );
}

// ---- Timing section ----

const PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const WINDOW_TYPES = ["deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat"];
const WINDOW_LABELS: Record<string, string> = {
  deep_work:"Deep work", creative:"Creative", planning:"Planning", admin:"Admin",
  social:"Social", relationship:"Relationship", recovery:"Recovery", study:"Study",
  launch:"Launch", retreat:"Retreat",
};

function TimingSection() {
  const { prefs, updateTiming } = usePreferences();
  const t = prefs.timing;

  function togglePlanet(p: string) {
    const next = t.watchPlanets.includes(p)
      ? t.watchPlanets.filter(x => x !== p)
      : [...t.watchPlanets, p];
    updateTiming({ watchPlanets: next });
  }

  return (
    <SectionCard title="Timing focus" sub="Highlight your preferred planets and set a default window type.">
      <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 8 }}>Watch planets (highlighted in sidebar):</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {PLANETS.map(p => {
          const on = t.watchPlanets.includes(p);
          return (
            <button key={p} onClick={() => togglePlanet(p)}
              style={{ fontSize: 11, padding: "4px 11px", borderRadius: 12, border: "1px solid", cursor: "pointer",
                background: on ? "var(--color-card-2)" : "var(--color-card)", color: on ? "var(--color-foreground)" : "var(--color-muted)",
                borderColor: on ? "#c0bab0" : "#e0dbd4", fontWeight: on ? 500 : 400,
              }}>{p}</button>
          );
        })}
      </div>

      {/* ══ WHAT YOU WANT HELP TIMING ══════════════════════════════════
          Intake asks this, and until now only intake did — so the question
          existed and nobody already using Compass could answer it. Same list
          as the first-run step, imported rather than copied: two tables of
          the same thing is how the app came to contradict itself about
          planetary suggestions once already.

          Empty is a real state, not an unset one, so the row says what
          happens when you choose nothing rather than leaving it to be
          guessed at. */}
      <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 6 }}>What you want help timing:</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
        {HELP_TIMING_OPTIONS.map(o => {
          const on = (t.helpTiming ?? []).includes(o.key);
          return (
            <button key={o.key} aria-pressed={on}
              onClick={() => {
                const cur = t.helpTiming ?? [];
                updateTiming({ helpTiming: on ? cur.filter(k => k !== o.key) : [...cur, o.key] });
              }}
              style={{
                fontSize: 11, padding: "4px 11px", borderRadius: 12, cursor: "pointer",
                border: `1px solid ${on ? "var(--color-primary)" : "var(--color-border)"}`,
                background: on ? "var(--color-primary)" : "var(--color-card-2)",
                color: on ? "#fff" : "var(--text-3)", fontWeight: on ? 600 : 400,
              }}>{o.label}</button>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 16, lineHeight: 1.5 }}>
        {(t.helpTiming ?? []).length
          ? "These lead the Almanac's week view. All fifty stay behind \u201Call\u201D."
          : "Nothing chosen, so the Almanac shows a general shortlist."}
      </div>

      <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 6 }}>Default window type for new tasks:</div>
      <select value={t.defaultWindowType} onChange={e => updateTiming({ defaultWindowType: e.target.value })} aria-label="Default window type for new tasks"
        style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)", width: "100%" }}>
        <option value="">Any</option>
        {WINDOW_TYPES.map(wt => <option key={wt} value={wt}>{WINDOW_LABELS[wt]}</option>)}
      </select>
    </SectionCard>
  );
}

// ---- Location search autocomplete ----

interface LocResult {
  displayName: string; city: string | null; state: string | null; country: string | null;
  lat: number; lon: number; timezoneName: string | null;
  utcOffsetStandard: number | null; utcOffsetDST: number | null;
  abbreviationSTD: string | null; abbreviationDST: string | null;
}

function LocationSearchInput({
  value, onChange, onSelect, placeholder, id,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (r: LocResult) => void;
  placeholder?: string;
  id?: string;
}) {
  const [results, setResults] = useState<LocResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  function updateDropPos() {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: "var(--z-tooltip)",
      background: "var(--color-card)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
      overflow: "hidden",
    });
  }

  function handleChange(v: string) {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length < 3) { setResults([]); setOpen(false); return; }
    updateDropPos();
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/location-search?q=${encodeURIComponent(v)}`);
        const data = await r.json();
        if (Array.isArray(data)) { setResults(data); setOpen(data.length > 0); updateDropPos(); }
      } catch { /* ignore */ }
      setLoading(false);
    }, 280);
  }

  function pick(r: LocResult) {
    onChange(r.city ?? r.displayName);
    onSelect(r);
    setOpen(false);
    setResults([]);
  }

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input ref={inputRef} id={id} value={value} onChange={e => handleChange(e.target.value)}
          placeholder={placeholder ?? "Search city…"}
          onFocus={() => { if (results.length > 0) { updateDropPos(); setOpen(true); } }}
          style={{ width: "100%", padding: "7px 28px 7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 13, background: "var(--color-card-2)", boxSizing: "border-box" }}
        />
        {loading && <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-3)" }}>…</span>}
      </div>
      {open && results.length > 0 && (
        <div style={dropStyle}>
          {results.map((r, i) => (
            <button key={i} onMouseDown={() => pick(r)} style={{
              display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
              border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "var(--text-1)",
              borderBottom: i < results.length - 1 ? "1px solid var(--color-border)" : "none",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f2ed")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <div style={{ fontWeight: 500 }}>{r.city ?? r.displayName}</div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>{r.displayName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Form helpers (module-level to avoid remount-on-render bug) ----

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const generatedId = React.useId();
  // Wire the label to the form control so a screen reader announces the caption
  // when focus lands in the field — this is the screen where someone types
  // their birth data, so unlabelled inputs are worst exactly here.
  //
  // Deliberately NOT React.Children.only: that throws on zero or several
  // children, so a future <Field> holding an input and a hint would crash the
  // whole Settings render rather than merely lose its label. Wiring is a
  // nicety; taking the page down over one is not a trade worth making. With
  // several children there is no single control to point at, so the label
  // stands unattached — the visible caption is unaffected either way.
  const kids = React.Children.toArray(children);
  const only = kids.length === 1 && React.isValidElement<{ id?: string }>(kids[0]) ? kids[0] : null;
  const id = only ? (only.props.id ?? generatedId) : undefined;
  const control = only && id ? React.cloneElement(only, { id }) : children;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label htmlFor={id} style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)" }}>{label}</label>
      {control}
    </div>
  );
}

function SettingsInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} {...rest}
      style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 13, background: "var(--color-card-2)", ...(rest.style ?? {}) }} />
  );
}

// ---- Cycle phases ----

const CYCLE_PHASES = [
  { name: "Menstrual", days: [1, 5],  color: "#c04050", desc: "Rest · release · introspection · low energy" },
  { name: "Follicular", days: [6, 13], color: "#d08020", desc: "Rising energy · creativity · learning · planning" },
  { name: "Ovulatory", days: [14, 17], color: "#50a050", desc: "Peak energy · communication · visibility · connection" },
  { name: "Luteal",    days: [18, 28], color: "#6050a0", desc: "Focus · detail work · nesting · introspection" },
];

function getCyclePhase(cycleStartDate: string, cycleLength: number, lutealLength: number): {
  phase: string; dayOfCycle: number; daysLeft: number; color: string; desc: string;
} | null {
  const start = new Date(cycleStartDate + "T12:00:00");
  const today = new Date();
  const diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
  if (diff < 0) return null;
  const dayOfCycle = (diff % cycleLength) + 1;
  const follEnd = cycleLength - lutealLength;

  let phase = CYCLE_PHASES[3];
  if (dayOfCycle <= 5) phase = CYCLE_PHASES[0];
  else if (dayOfCycle <= follEnd - 4) phase = CYCLE_PHASES[1];
  else if (dayOfCycle <= follEnd) phase = CYCLE_PHASES[2];

  const phaseEnd = dayOfCycle <= 5 ? 5 : dayOfCycle <= follEnd - 4 ? follEnd - 4 : dayOfCycle <= follEnd ? follEnd : cycleLength;
  return { phase: phase.name, dayOfCycle, daysLeft: phaseEnd - dayOfCycle, color: phase.color, desc: phase.desc };
}

function CycleSection({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ cycleStartDate: "", cycleLength: "28", lutealLength: "14" });

  const { data: cycle } = useQuery<{ cycleStartDate: string; cycleLength: number; lutealLength: number } | null>({
    queryKey: ["cycle", testerId],
    queryFn: async () => {
      const r = await fetch("/api/cycle", { headers: authH(testerId) });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId,
  });

  useEffect(() => {
    if (cycle) setForm({ cycleStartDate: cycle.cycleStartDate, cycleLength: String(cycle.cycleLength), lutealLength: String(cycle.lutealLength) });
  }, [cycle]);

  const save = useMutation({
    mutationFn: async () => {
      const method = cycle ? "PATCH" : "POST";
      const r = await fetch("/api/cycle", {
        method, headers: authH(testerId),
        body: JSON.stringify({ cycleStartDate: form.cycleStartDate, cycleLength: parseInt(form.cycleLength), lutealLength: parseInt(form.lutealLength) }),
      });
      // Was unconditional "Saved ✓" regardless of status (audit P0 #4).
      if (!r.ok) throw new Error("cycle save failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cycle"] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const del = useMutation({
    mutationFn: async () => { await fetch("/api/cycle", { method: "DELETE", headers: authH(testerId) }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cycle"] }); setForm({ cycleStartDate: "", cycleLength: "28", lutealLength: "14" }); },
  });

  const currentPhase = cycle ? getCyclePhase(cycle.cycleStartDate, cycle.cycleLength, cycle.lutealLength) : null;

  return (
    <SectionCard title="Cycle tracking" sub="Optional. Integrates menstrual cycle phases into timing and advisor context.">
      {currentPhase && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: `${currentPhase.color}12`, border: `1px solid ${currentPhase.color}40` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: currentPhase.color }}>{currentPhase.phase} phase · day {currentPhase.dayOfCycle}</div>
          <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 3 }}>{currentPhase.desc}</div>
          {currentPhase.daysLeft > 0 && <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 3 }}>{currentPhase.daysLeft} day{currentPhase.daysLeft !== 1 ? "s" : ""} remaining in phase</div>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Last period start (day 1)">
          <SettingsInput value={form.cycleStartDate} onChange={v => setForm(f => ({ ...f, cycleStartDate: v }))} type="date" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Cycle length (days)">
            <SettingsInput value={form.cycleLength} onChange={v => setForm(f => ({ ...f, cycleLength: v }))} type="number" min="21" max="40" />
          </Field>
          <Field label="Luteal phase (days)">
            <SettingsInput value={form.lutealLength} onChange={v => setForm(f => ({ ...f, lutealLength: v }))} type="number" min="10" max="18" />
          </Field>
        </div>

        {/* Phase overview */}
        <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", height: 8 }}>
          {CYCLE_PHASES.map(p => (
            <div key={p.name} style={{ flex: p.days[1] - p.days[0] + 1, background: p.color, opacity: 0.7 }} title={`${p.name}: days ${p.days[0]}–${p.days[1]}`} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CYCLE_PHASES.map(p => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "var(--color-muted)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />{p.name}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => save.mutate()} disabled={!form.cycleStartDate} style={{
            padding: "7px 16px", borderRadius: 7, border: "none", fontSize: 11,
            background: form.cycleStartDate ? "#1a2a3a" : "var(--color-border)", color: form.cycleStartDate ? "#ffffff" : "var(--text-3)", cursor: "pointer",
          }}>{save.isPending ? "Saving…" : saved ? <>Saved <span aria-hidden="true">✓</span></> : cycle ? "Update" : "Save"}</button>
          {cycle && <button onClick={() => del.mutate()} style={{ fontSize: 10, color: "#c06060", background: "none", border: "none", cursor: "pointer" }}>Remove</button>}
          {save.isError && <span style={{ fontSize: 10, color: "#a03030" }}>Couldn't save — try again.</span>}
        </div>
      </div>
    </SectionCard>
  );
}

// ---- Export section ----

// ---- Your plan ----
// This was a TOGGLE: a localStorage boolean letting you flip between the
// "unlocked" and "locked" views. It described the old free/paid line — paid
// meant Currents, personal advisories and Ask — which the pricing decision of
// 2026-08-19 replaced, and it controlled a gate that is now server-side, so
// flipping it would have changed nothing except what the page claimed.
//
// A switch that does nothing is worse than no switch, so this reports the
// plan the SERVER says you are on, and the trial's real remaining days.

function PlanSection() {
  const { entitlement, loading } = useEntitlements();
  const plan = entitlement?.plan;
  const left = entitlement?.trialDaysLeft;
  const label = loading || !plan ? "…"
    : plan === "beta" ? "Beta · everything, at no charge"
    : plan === "trial" ? `Trial · ${left} day${left === 1 ? "" : "s"} left`
    : plan === "paid" ? "Full Compass"
    : "Free";
  return (
    <SectionCard title="Your plan" sub="Nothing costs anything yet; everyone is on the beta plan while billing is built.">
      <Row label={label} sub={plan === "free"
        ? "Today's read, your planner, and every reason behind a suggestion, with shaping days and weeks on the paid half."
        : "Every part of Compass, including shaping the week and finding long sessions."}>
        <span />
      </Row>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "var(--color-card-2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6a8a5a", marginBottom: 5 }}>Free</div>
          <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.6 }}>
            {FREE_KEEPS.join(" · ")}
          </div>
        </div>
        <div style={{ background: "var(--color-card-2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a6a30", marginBottom: 5 }}>Paid <span aria-hidden="true">✦</span></div>
          <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.6 }}>
            {PREMIUM_FEATURES.map(f => f.title).join(" · ")}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ---- Caution planets section ----

// Was orphaned: the only surface that could open this questionnaire was the
// dead pages/Currents.tsx, so nobody could set or edit their caution planets
// even though Tasks, Calendar, and Guiding Stars all still read and display
// them (audit finding — a feature with consumers but no producer). This
// restores just the producer; the sensitivity-based suggestions Currents.tsx
// used to compute aren't re-plumbed here, so the questionnaire opens with
// plain manual picking instead of pre-suggested planets.
const CAUTION_PLANET_NAMES: Record<string, string> = { Uranus: "Uranus", Neptune: "Neptune", Pluto: "Pluto", Saturn: "Saturn", Mars: "Mars" };

function CautionPlanetsSection() {
  const { profile } = useTester();
  const [open, setOpen] = useState(false);
  const picked = profile?.cautionPlanets ?? [];
  return (
    <SectionCard title="Caution planets" sub="Which outer-planet transits you want flagged as advisories, on Tasks, Calendar, and your Guiding Stars.">
      <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 10 }}>
        {picked.length === 0 ? "None set — advisories are off." : `Watching: ${picked.map(p => CAUTION_PLANET_NAMES[p] ?? p).join(", ")}`}
      </div>
      <button onClick={() => setOpen(true)} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)", cursor: "pointer" }}>
        {picked.length === 0 ? "Set caution planets" : "Edit caution planets"}
      </button>
      {open && <CautionQuestionnaireModal onClose={() => setOpen(false)} />}
    </SectionCard>
  );
}

// ---- Chronotype section ----

function ChronotypeSection() {
  const { profile, updateChronotype } = useTester();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const existing = profile?.chronotype;
  const [chronoProfile, setChronoProfile] = useState<ChronotypeProfile | null>(existing?.profile ?? null);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [weekdayStart, setWeekdayStart] = useState(existing?.freeWindows?.mon?.start ?? "18:00");
  const [weekdayEnd, setWeekdayEnd] = useState(existing?.freeWindows?.mon?.end ?? "22:00");
  const [weekendStart, setWeekendStart] = useState(existing?.freeWindows?.sat?.start ?? "09:00");
  const [weekendEnd, setWeekendEnd] = useState(existing?.freeWindows?.sat?.end ?? "21:00");
  const [wakeTime, setWakeTime] = useState(existing?.wakeTime ?? "07:00");
  const [sleepTime, setSleepTime] = useState(existing?.sleepTime ?? "23:00");

  useEffect(() => {
    if (existing) {
      setChronoProfile(existing.profile);
      setDescription(existing.description ?? "");
      setWeekdayStart(existing.freeWindows?.mon?.start ?? "18:00");
      setWeekdayEnd(existing.freeWindows?.mon?.end ?? "22:00");
      setWeekendStart(existing.freeWindows?.sat?.start ?? "09:00");
      setWeekendEnd(existing.freeWindows?.sat?.end ?? "21:00");
      setWakeTime(existing.wakeTime ?? "07:00");
      setSleepTime(existing.sleepTime ?? "23:00");
    }
  }, [existing]);

  function save() {
    if (!chronoProfile) return;
    const weekdayWin = { start: weekdayStart, end: weekdayEnd, flexibility: "flex" as const };
    const weekendWin = { start: weekendStart, end: weekendEnd, flexibility: "flex" as const };
    updateChronotype({
      profile: chronoProfile,
      description: description.trim() || undefined,
      freeWindows: { mon: weekdayWin, tue: weekdayWin, wed: weekdayWin, thu: weekdayWin, fri: weekdayWin, sat: weekendWin, sun: weekendWin },
      wakeTime, sleepTime,
      updatedAt: new Date().toISOString(),
    });
    setSaved(true); setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  }

  const inputStyle: React.CSSProperties = { flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)", boxSizing: "border-box" };

  return (
    <SectionCard title="Your rhythm" sub="When you're usually free and how you naturally run — used to suggest timing that fits your life, not just the sky.">
      {existing && !editing ? (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>
                {CHRONOTYPE_OPTIONS.find(o => o.key === existing.profile)?.label ?? existing.profile}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                Weekdays {existing.freeWindows?.mon?.start}–{existing.freeWindows?.mon?.end} · Weekends {existing.freeWindows?.sat?.start}–{existing.freeWindows?.sat?.end}
                {existing.wakeTime && existing.sleepTime && <> · Awake {existing.wakeTime}–{existing.sleepTime}</>}
              </div>
              {existing.description && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4, fontStyle: "italic" }}>"{existing.description}"</div>}
            </div>
            <button onClick={() => setEditing(true)} style={{ fontSize: 11, padding: "5px 13px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--text-2)", cursor: "pointer" }}>
              Edit
            </button>
          </div>
          {saved && <div style={{ fontSize: 10, color: ELEMENT_COLORS.earth }}><span aria-hidden="true">✓</span> Saved</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!existing && <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Not set yet. Add your rhythm and suggestions will land inside your waking hours.</div>}

          <div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Morning or night person?</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {CHRONOTYPE_OPTIONS.map(o => (
                <button key={o.key} type="button" onClick={() => setChronoProfile(o.key)}
                  style={{
                    padding: "7px 9px", borderRadius: 7, textAlign: "left", cursor: "pointer",
                    border: chronoProfile === o.key ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
                    background: chronoProfile === o.key ? "#1a2a3a10" : "var(--color-card-2)",
                  }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: chronoProfile === o.key ? "var(--color-foreground)" : "var(--text-1)" }}>{o.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Usually awake</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={inputStyle} />
              <span style={{ color: "var(--text-3)", fontSize: 11 }}>to</span>
              <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Usually free — weekdays</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="time" value={weekdayStart} onChange={e => setWeekdayStart(e.target.value)} style={inputStyle} />
              <span style={{ color: "var(--text-3)", fontSize: 10 }}>to</span>
              <input type="time" value={weekdayEnd} onChange={e => setWeekdayEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Usually free — weekends</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="time" value={weekendStart} onChange={e => setWeekendStart(e.target.value)} style={inputStyle} />
              <span style={{ color: "var(--text-3)", fontSize: 10 }}>to</span>
              <input type="time" value={weekendEnd} onChange={e => setWeekendEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>In your own words <span style={{ opacity: 0.6 }}>(optional)</span></div>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. dead by 10pm, useless before coffee…" style={{ ...inputStyle, width: "100%" }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {existing && (
              <button onClick={() => setEditing(false)} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-muted)", cursor: "pointer" }}>
                Cancel
              </button>
            )}
            <button onClick={save} disabled={!chronoProfile} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", background: chronoProfile ? "#1a2a3a" : "var(--color-border)", color: chronoProfile ? "#ffffff" : "var(--text-3)", cursor: chronoProfile ? "pointer" : "default" }}>
              Save
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ---- Natal chart section ----

function NatalChartSection({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [locationResults, setLocationResults] = useState<any[]>([]);
  /** Why the dropdown is empty — searching, no match, or lookup unavailable. */
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: chart, isLoading } = useQuery<any>({
    queryKey: ["natal-chart", testerId],
    queryFn: async () => {
      if (!testerId) return null;
      const r = await fetch("/api/natal-chart", { headers: { "x-tester-id": testerId } });
      if (r.status === 404) return null;
      return r.json();
    },
    enabled: !!testerId,
    staleTime: Infinity,
  });

  const [form, setForm] = useState({ birthDate: "", birthTime: "", birthPlace: "", birthLat: null as number | null, birthLon: null as number | null, utcOffset: -new Date().getTimezoneOffset() / 60 });

  useEffect(() => {
    if (chart) {
      setForm({ birthDate: chart.birthDate ?? "", birthTime: chart.birthTime ?? "", birthPlace: chart.birthPlace ?? "", birthLat: chart.birthLat ?? null, birthLon: chart.birthLon ?? null, utcOffset: chart.utcOffset ?? 0 });
      setLocationSearch(chart.birthPlace ?? "");
    }
  }, [chart]);

  // A search that finds nothing and a search that CANNOT RUN look identical if
  // both just empty the dropdown — which is what happened: the endpoint answers
  // 503 with {error, message} when the geocoder key is missing, `Array.isArray`
  // is false, and the user got a silent empty list with no way to tell whether
  // their city was unknown or the lookup was broken. Same principle as "a
  // calendar failure must not look like a free week".
  async function searchLocation(q: string) {
    if (q.length < 2) { setLocationResults([]); setLocationNote(null); return; }
    setLocationNote("searching…");
    try {
      const r = await fetch(`/api/location-search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      const list = Array.isArray(data) ? data : (data.results ?? null);
      if (!r.ok || list == null) {
        setLocationResults([]);
        setLocationNote(data?.message ?? "Place lookup is unavailable right now — enter latitude and longitude below by hand.");
        return;
      }
      setLocationResults(list);
      setLocationNote(list.length ? null : `No match for “${q}”. Try “City, Country”, or enter latitude and longitude by hand.`);
    } catch {
      setLocationResults([]);
      setLocationNote("Couldn't reach the place lookup — check your connection, or enter latitude and longitude by hand.");
    }
  }

  function handleLocationInput(v: string) {
    setLocationSearch(v);
    setLocationNote(null);
    setForm(f => ({ ...f, birthPlace: v, birthLat: null, birthLon: null }));
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchLocation(v), 400);
  }

  function pickLocation(r: any) {
    setLocationNote(null);
    const place = r.displayName ?? r.formatted ?? r.name ?? locationSearch;
    setLocationSearch(place);
    setLocationResults([]);
    const offset = r.utcOffsetStandard != null ? Math.round(r.utcOffsetStandard)
      : r.lon != null ? Math.round(r.lon / 15) : form.utcOffset;
    setForm(f => ({ ...f, birthPlace: place, birthLat: r.lat, birthLon: r.lon, utcOffset: offset }));
  }

  async function save() {
    // A silent `return` here meant pressing Save did visibly nothing when the
    // place had been typed but never PICKED from the dropdown — typing clears
    // the coordinates, so the form was incomplete in a way the button gave no
    // account of. Say which field is missing instead.
    if (!testerId) return;
    if (!form.birthDate) { setLocationNote("Add a birth date before saving."); return; }
    if (form.birthLat == null) {
      setLocationNote("Pick your birthplace from the dropdown — typing alone doesn't set the coordinates, and the chart needs them.");
      return;
    }
    setSaving(true);
    setSaveError(false);
    try {
      const r = await fetch("/api/natal-chart", {
        method: "POST",
        headers: authH(testerId),
        body: JSON.stringify({ birthDate: form.birthDate, birthTime: form.birthTime || "12:00", birthPlace: form.birthPlace, birthLat: form.birthLat, birthLon: form.birthLon, utcOffset: form.utcOffset, timeKnown: !!form.birthTime }),
      });
      // Was unconditional — a 429/500 during a birth-TIME correction would
      // show "Saved" and close the editor while every reading kept using the
      // old (wrong) chart, with no sign anything was off (audit P0 #2).
      if (!r.ok) { setSaveError(true); return; }
      qc.invalidateQueries({ queryKey: ["natal-chart"] });
      qc.invalidateQueries({ queryKey: ["currents"] });
      setSaved(true); setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError(true);
    } finally { setSaving(false); }
  }

  const hasChart = !!chart;
  const inputStyle: React.CSSProperties = { width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)", boxSizing: "border-box" };

  return (
    <SectionCard title="Birth chart" sub="Used for personal transits — which planetary cycles are active in your chart right now.">
      {isLoading ? (
        <div style={{ fontSize: 11, color: "var(--text-3)", padding: "4px 0" }}>Loading…</div>
      ) : hasChart && !editing ? (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>{chart.birthDate}{chart.timeKnown === false ? " · time unknown" : chart.birthTime && ` at ${chart.birthTime}`}</div>
              <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>{chart.birthPlace}</div>
              {chart.timeKnown === false ? (
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>
                  ☉ {chart.planets?.find((p: any) => p.planet === "Sun")?.sign} · ☽ {chart.planets?.find((p: any) => p.planet === "Moon")?.sign} <span style={{ color: "var(--color-muted)" }}>(approx)</span>
                  <div style={{ color: "var(--color-muted)", marginTop: 2 }}>Rising sign, houses and Currents need a birth time. Add it below.</div>
                </div>
              ) : chart.ascendant && (
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>
                  ↑ {chart.ascendant.sign} rising · ☉ {chart.planets?.find((p: any) => p.planet === "Sun")?.sign} · ☽ {chart.planets?.find((p: any) => p.planet === "Moon")?.sign}
                </div>
              )}
            </div>
            <button onClick={() => setEditing(true)} style={{ fontSize: 11, padding: "5px 13px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--text-2)", cursor: "pointer" }}>
              Edit
            </button>
          </div>
          {saved && <div style={{ fontSize: 10, color: ELEMENT_COLORS.earth }}><span aria-hidden="true">✓</span> Saved</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!hasChart && <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>No birth chart saved yet. Add your birth data and the readings become yours rather than everyone's.</div>}

          <div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Date of birth</div>
            <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} style={inputStyle} />
          </div>

          <div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Time of birth <span style={{ opacity: 0.6 }}>(optional — needed for Ascendant)</span></div>
            <input type="time" value={form.birthTime} onChange={e => setForm(f => ({ ...f, birthTime: e.target.value }))} style={inputStyle} />
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Place of birth</div>
            <input value={locationSearch} onChange={e => handleLocationInput(e.target.value)} placeholder="City, country…" style={inputStyle} />
            {locationNote && (
              <div style={{ fontSize: 10.5, color: locationNote === "searching…" ? "var(--text-3)" : "#8a6a30", marginTop: 4, lineHeight: 1.45 }}>
                {locationNote}
              </div>
            )}
            {locationResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: "var(--z-field)", marginTop: 2, maxHeight: 180, overflowY: "auto" }}>
                {locationResults.map((r, i) => (
                  <button key={i} type="button" onClick={() => pickLocation(r)}
                    style={{ display: "block", width: "100%", padding: "8px 12px", textAlign: "left", border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "var(--text-1)", borderBottom: "1px solid var(--color-border)" }}>
                    {r.displayName ?? r.formatted ?? r.name}
                  </button>
                ))}
              </div>
            )}
            {form.birthLat != null && <div style={{ fontSize: 10, color: ELEMENT_COLORS.earth, marginTop: 3 }}><span aria-hidden="true">✓</span> Location set</div>}
          </div>

          {form.birthLat != null && (
            <div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>UTC offset at birth</div>
              <select value={form.utcOffset} onChange={e => setForm(f => ({ ...f, utcOffset: Number(e.target.value) }))} aria-label="UTC offset at birth"
                style={{ ...inputStyle, width: "auto" }}>
                {Array.from({ length: 27 }, (_, i) => i - 12).map(o => (
                  <option key={o} value={o}>UTC{o >= 0 ? "+" : ""}{o}:00</option>
                ))}
              </select>
            </div>
          )}

          {saveError && (
            <div style={{ fontSize: 10.5, color: "#a03030", marginBottom: 6 }}>Couldn't save — try again.</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {editing && (
              <button onClick={() => { setEditing(false); setLocationSearch(chart?.birthPlace ?? ""); setLocationResults([]); }}
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-muted)", cursor: "pointer" }}>
                Cancel
              </button>
            )}
            <button onClick={save} disabled={!form.birthDate || form.birthLat == null || saving}
              style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", cursor: (!form.birthDate || form.birthLat == null) ? "default" : "pointer",
                background: (!form.birthDate || form.birthLat == null) ? "var(--color-border)" : "#1a2a3a",
                color: (!form.birthDate || form.birthLat == null) ? "var(--text-3)" : "#ffffff" }}>
              {saving ? "Saving…" : "Save birth chart"}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function ExportSection({ testerId }: { testerId: string | null }) {
  // Feed token — the secret is returned ONCE at issue, so it's held in memory
  // only. Reload and you must reset the link to see a URL again, which is the
  // correct trade for not storing it.
  const [feedActive, setFeedActive] = useState(false);
  const [feedLastUsed, setFeedLastUsed] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedCopied, setFeedCopied] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const authFeed = testerId ? { "x-tester-id": testerId, "Content-Type": "application/json" } : undefined;

  useEffect(() => {
    if (!authFeed) return;
    fetch("/api/account/feed-token", { headers: authFeed })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setFeedActive(!!d.active); setFeedLastUsed(d.lastUsedAt ?? null); } })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testerId]);

  async function issueFeed(reset = false) {
    if (!authFeed) return;
    if (reset && !window.confirm("Reset the link? Any calendar already subscribed will stop updating until you paste the new one.")) return;
    setFeedBusy(true);
    try {
      const r = await fetch("/api/account/feed-token", { method: "POST", headers: authFeed });
      if (!r.ok) return;
      const { token } = await r.json();
      setFeedActive(true); setFeedLastUsed(null);
      setFeedUrl(`webcal://${window.location.host}/api/export/ical?feedToken=${encodeURIComponent(token)}`);
    } finally { setFeedBusy(false); }
  }

  async function revokeFeed() {
    if (!authFeed) return;
    if (!window.confirm("Turn off the calendar feed? Any calendar subscribed to it will stop updating.")) return;
    setFeedBusy(true);
    try {
      const r = await fetch("/api/account/feed-token", { method: "DELETE", headers: authFeed });
      if (r.ok) { setFeedActive(false); setFeedUrl(null); setFeedLastUsed(null); }
    } finally { setFeedBusy(false); }
  }

  async function copyFeed() {
    if (!feedUrl) { await issueFeed(true); return; }
    try { await navigator.clipboard.writeText(feedUrl); setFeedCopied(true); setTimeout(() => setFeedCopied(false), 2500); } catch { /* selectable above */ }
  }
  // The download is a SNAPSHOT — it goes stale the moment you schedule
  // anything else; the feed link above is the live version.
  //
  // Fetched with the auth HEADER, not a `?testerId=` URL. This button used to
  // build `/api/export/ical?testerId=…` and click an <a> at it — but the
  // server deliberately stopped accepting the id from the query string when
  // that same pattern turned subscription links into account credentials, so
  // the anchor had been downloading an error for as long as the withdrawal
  // has been live. An anchor click cannot carry a header; a fetch can, and
  // the blob URL keeps the one-click behaviour.
  async function downloadIcal() {
    try {
      const r = await fetch("/api/export/ical", { headers: testerId ? { "x-tester-id": testerId } : undefined });
      if (!r.ok) return;
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "compass-events.ics";
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* the button stays; a failed download is retryable */ }
  }

  return (
    <SectionCard title="Your calendar feed" sub="Your scheduled blocks and tasks, in any calendar app. Planetary hours and sky events aren't included.">
      {/* Restored 2026-07-30 behind a revocable, iCal-scoped token. The link
          no longer carries the account credential, so the worst case for a
          leaked feed is "someone sees your schedule" — stated plainly below
          — rather than account takeover. */}
      <Row label="Subscribe (stays up to date)" sub="Apple Calendar, Google Calendar, Outlook">
        {feedActive ? (
          <button onClick={copyFeed} style={{ fontSize: 11, padding: "5px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-primary)", cursor: "pointer", fontWeight: 600 }}>
            {feedCopied ? "Copied ✓" : feedUrl ? "Copy link" : "Show link"}
          </button>
        ) : (
          <button onClick={() => issueFeed()} disabled={feedBusy} style={{ fontSize: 11, padding: "5px 14px", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#ffffff", cursor: "pointer", fontWeight: 600 }}>
            {feedBusy ? "…" : "Create link"}
          </button>
        )}
      </Row>
      {feedUrl && (
        <div style={{
          fontSize: 11, fontFamily: "monospace", color: "var(--color-muted)", userSelect: "all",
          background: "var(--color-card-2)", border: "1px solid var(--color-border)",
          borderRadius: 6, padding: "6px 9px", margin: "2px 0 8px", overflowWrap: "anywhere",
        }}>{feedUrl}</div>
      )}
      {feedActive && (
        <div style={{ fontSize: 10, color: "var(--color-muted)", lineHeight: 1.55, marginBottom: 10 }}>
          Paste it into your calendar app's “add calendar by URL”. It refreshes on its
          own. This link shows your task titles and scheduled blocks to anyone who has
          it — it is <em>not</em> your account key, and you can reset it any time.
          {feedLastUsed && <> Last fetched {new Date(feedLastUsed).toLocaleDateString()}.</>}
          {!feedLastUsed && feedActive && <> Not fetched yet.</>}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={() => issueFeed(true)} disabled={feedBusy} style={{ fontSize: 10, background: "none", border: "none", color: "#8a7a58", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              reset link
            </button>
            <button onClick={revokeFeed} disabled={feedBusy} style={{ fontSize: 10, background: "none", border: "none", color: "#a06060", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              turn off
            </button>
          </div>
        </div>
      )}
      <Row label="One-time download" sub="A snapshot — won't update later">
        <button onClick={downloadIcal} style={{ fontSize: 11, padding: "5px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)", cursor: "pointer" }}>
          <span aria-hidden="true">↓</span> .ics
        </button>
      </Row>
    </SectionCard>
  );
}

// ---- Google Calendar section ----

function GoogleCalSection({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const popupRef = React.useRef<Window | null>(null);

  const { data: status, isLoading } = useQuery<{ connected: boolean; email?: string; configured?: boolean; needsReconnect?: boolean }>({
    queryKey: ["gcal-status", testerId],
    queryFn: async () => {
      const r = await fetch("/api/integrations/google-cal/status", { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 30_000,
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      await fetch("/api/integrations/google-cal/disconnect", { method: "DELETE", headers: authH(testerId) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gcal-status"] });
      qc.invalidateQueries({ queryKey: ["gcal-events"] });
    },
  });

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "google-cal-connected") {
        qc.invalidateQueries({ queryKey: ["gcal-status"] });
        qc.invalidateQueries({ queryKey: ["gcal-events"] });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [qc]);

  function connect() {
    if (!testerId) return;
    const url = `/api/integrations/google-cal/auth?testerId=${encodeURIComponent(testerId)}`;
    popupRef.current = window.open(url, "gcal-connect", "width=500,height=600,left=200,top=100");
  }

  return (
    <SectionCard title="Integrations">
      <Row label="Google Calendar" sub="Show your events alongside tidal timing in the Calendar view.">
        {isLoading ? (
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>…</span>
        ) : status?.configured === false ? (
          <span style={{ fontSize: 10, color: "var(--text-3)", padding: "4px 10px", border: "1px solid var(--color-border)", borderRadius: 6 }}>Not configured</span>
        ) : status?.connected && status?.needsReconnect ? (
          // Google dropped the grant. Say so plainly and make the fix one tap —
          // the alternative (and what shipped before) is a calendar that is
          // simply empty, with the app still claiming it is connected.
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#a06020", padding: "3px 10px", border: "1px solid #e0c0a0", borderRadius: 6, background: "#a0602018" }}>
              <span aria-hidden="true">⚠</span> Google signed us out
            </span>
            <button onClick={connect} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)", cursor: "pointer" }}>
              Reconnect
            </button>
          </div>
        ) : status?.connected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#408040", padding: "3px 10px", border: "1px solid #b0d0b0", borderRadius: 6, background: "#40804018" }}>
              📅 {status.email ?? "Connected"}
            </span>
            <button onClick={() => disconnect.mutate()} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid #e0ccc0", background: "#c0604016", color: "#c06040", cursor: "pointer" }}>
              Disconnect
            </button>
          </div>
        ) : (
          <button onClick={connect} style={{ fontSize: 11, padding: "5px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <span>📅</span> Connect
          </button>
        )}
      </Row>
    </SectionCard>
  );
}

// ---- Main Settings page ----

const HOUSE_SYSTEMS: { id: string; label: string; note: string }[] = [
  { id: "whole-sign",    label: "Whole Sign",    note: "The traditional system: each sign is one house, which is what profections and the Currents view use." },
  { id: "equal",         label: "Equal",         note: "30° houses measured from the Ascendant degree." },
  { id: "placidus",      label: "Placidus",      note: "The most common modern system, with time-based, unequal houses." },
  { id: "porphyry",      label: "Porphyry",      note: "Simple quadrant system; trisects each quadrant equally." },
  { id: "regiomontanus", label: "Regiomontanus", note: "Space-based quadrant system, favored in medical astrology." },
];

function HouseSystemSection() {
  const [system, setSystem] = useState(() => localStorage.getItem("obs_house_system") ?? "whole-sign");
  function pick(id: string) {
    setSystem(id);
    localStorage.setItem("obs_house_system", id);
  }
  return (
    <SectionCard title="House system" sub="How the chart is divided into houses. Affects the Currents view and personal house placements.">
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {HOUSE_SYSTEMS.map((h) => (
          <button key={h.id} onClick={() => pick(h.id)} style={{
            textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer",
            border: system === h.id ? "1.5px solid #3a4a68" : "1px solid #e0dad0",
            background: system === h.id ? "#f2f4f8" : "var(--color-card-2)",
          }}>
            <div style={{ fontSize: 12.5, fontWeight: system === h.id ? 600 : 500, color: "var(--color-primary)" }}>
              {h.label}{system === h.id && <span style={{ color: "#3a4a68", fontSize: 10, marginLeft: 6 }}><span aria-hidden="true">✓</span> selected</span>}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2, lineHeight: 1.4 }}>{h.note}</div>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Account section — the recovery key that carries this identity across
// devices. The key is minted on first profile sync; if it hasn't arrived yet
// (offline first load), the section says so instead of showing nothing.
function AccountSection() {
  const { profile } = useTester();
  const [copied, setCopied] = useState(false);
  const code = profile?.recoveryCode;

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — user can select the text manually */ }
  }

  return (
    <SectionCard
      title="Account"
      sub="Your data follows this key, not this browser. Save it somewhere safe — it's how you get everything back on a new device or after clearing this one."
    >
      {code ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              flex: 1, fontSize: 17, fontWeight: 700, letterSpacing: "2px", color: "var(--color-primary)",
              background: "var(--color-card-2)", border: "1px solid var(--color-border)", borderRadius: 9,
              padding: "10px 14px", textAlign: "center", userSelect: "all",
            }}>{code}</div>
            <button onClick={copy} style={{
              padding: "10px 16px", borderRadius: 9, border: "1px solid var(--color-border)",
              background: copied ? "#e8f5e0" : "var(--color-card)", color: copied ? "#3a6020" : "var(--color-primary)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0,
            }}>{copied ? <>Copied <span aria-hidden="true">✓</span></> : "Copy"}</button>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 8, lineHeight: 1.55 }}>
            On another device: open Compass → "Been here before?" on the first screen → enter this key.
            Anyone holding the key can restore your data, so treat it like a password.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.6 }}>
          Your account key hasn't been created yet — it appears here automatically the next time the
          app reaches the server. Check back in a moment.
        </div>
      )}

      {/* Feedback — beta channel */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          {/* Now the SECOND door, not the only one: the ◇ in the topbar sends
              from wherever you are and brings the page and your settings with
              it. This stays for the case that one cannot cover — the app too
              broken to post anything. */}
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-primary)" }}>Email us instead</div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 1 }}>The ◇ in the top bar is quicker and carries the details. Use this when the app itself is the thing that's broken.</div>
        </div>
        <a href="mailto:charliecro@gmail.com?subject=Compass%20feedback"
          style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-primary)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "7px 14px", textDecoration: "none", background: "var(--color-card-2)", flexShrink: 0 }}>
          ✉ Email
        </a>
      </div>
    </SectionCard>
  );
}

function DevicesSection({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  interface SessionRow { id: number; origin: string; createdAt: string; lastSeenAt: string | null; current: boolean }
  const { data, isError } = useQuery<{ sessions: SessionRow[] }>({
    queryKey: ["account-sessions", testerId],
    queryFn: async () => {
      const r = await fetch("/api/account/sessions", { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) throw new Error(`sessions ${r.status}`);
      return r.json();
    },
    enabled: !!testerId,
  });
  const revoke = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/account/sessions/${id}`, {
        method: "DELETE",
        headers: testerId ? { "x-tester-id": testerId } : {},
      });
      if (!r.ok) throw new Error(`revoke ${r.status}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-sessions"] }),
  });

  const sessions = data?.sessions ?? [];
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  const ORIGIN_LABEL: Record<string, string> = {
    signup: "created with the account",
    claim: "signed in automatically",
    recovery: "restored with the account key",
  };

  return (
    <SectionCard
      title="Devices"
      sub="Every browser signed into this account. Signing one out takes effect within a minute."
    >
      {isError ? (
        <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.6 }}>
          Couldn't load the device list just now — that's a connection problem, not an empty list.
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.6 }}>
          No signed-in devices yet — they appear here once the account reaches the server.
        </div>
      ) : (
        sessions.map((sRow) => (
          <div key={sRow.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
            borderTop: "1px solid var(--color-border)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--color-foreground)", fontWeight: sRow.current ? 600 : 400 }}>
                {ORIGIN_LABEL[sRow.origin] ?? sRow.origin}
                {sRow.current && (
                  <span style={{
                    marginLeft: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.5px",
                    textTransform: "uppercase", color: "#3f7a4a",
                    border: "1px solid #3f7a4a55", borderRadius: 999, padding: "1px 8px",
                  }}>this device</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>
                signed in {when(sRow.createdAt)}
                {sRow.lastSeenAt ? ` · last active ${when(sRow.lastSeenAt)}` : ""}
              </div>
            </div>
            {/* The current device can't revoke itself: it holds the account
                key, so the next request would silently sign it right back in.
                Signing out OTHER devices is the real capability. */}
            {!sRow.current && (
              <button
                onClick={() => revoke.mutate(sRow.id)}
                disabled={revoke.isPending}
                style={{
                  fontSize: 11, padding: "5px 12px", borderRadius: 7, cursor: "pointer",
                  border: "1px solid var(--color-border)", background: "var(--color-card)",
                  color: "#c05030", flexShrink: 0,
                }}>Sign out</button>
            )}
          </div>
        ))
      )}
      {revoke.isError && (
        <div style={{ fontSize: 10.5, color: "#a03030", marginTop: 6 }}>
          Couldn't sign that device out — try again.
        </div>
      )}
    </SectionCard>
  );
}

export default function Settings({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const { profile, resetProfile, updateLocation, lat, lon } = useTester();
  const [saved, setSaved] = useState(false);
  const [natalForm, setNatalForm] = useState({
    birthDate: "", birthTime: "", birthLat: "", birthLon: "", utcOffset: "", birthPlace: ""
  });
  const [locationForm, setLocationForm] = useState({ lat: String(lat), lon: String(lon), label: profile?.locationLabel ?? "New York" });
  const [locSaved, setLocSaved] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [journalOpen, setJournalOpen] = useState(false);

  const journalEntries = useMemo(() => {
    const entries: { date: string; text: string }[] = [];
    for (let d = 0; d < 14; d++) {
      const date = addDaysLocal(localToday(), -d);
      const key = `tides-journal-${testerId ?? "anon"}-${date}`;
      const text = localStorage.getItem(key);
      if (text?.trim()) entries.push({ date, text });
    }
    return entries;
  }, [testerId, journalOpen]);

  const { data: natal } = useQuery({
    queryKey: ["natal-chart", testerId],
    queryFn: async () => {
      const r = await fetch("/api/natal-chart", { headers: authH(testerId) });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId,
  });

  useEffect(() => {
    if (natal) {
      setNatalForm({
        birthDate: natal.birthDate ?? "",
        birthTime: natal.birthTime ?? "",
        birthLat: String(natal.birthLat ?? ""),
        birthLon: String(natal.birthLon ?? ""),
        utcOffset: String(natal.utcOffset ?? ""),
        birthPlace: natal.birthPlace ?? "",
      });
    }
  }, [natal]);

  // NOTE: this is the SECOND natal-chart editor on this page (NatalChartSection
  // above is the other, and both POST the same endpoint). The duplicate is
  // worth collapsing into one, but that's a UI change — this fix is just the
  // correctness half: the same false-success bug already fixed in the sibling
  // was still live here, showing "Saved ✓" on a 429/500 while the chart every
  // reading depends on stayed unchanged.
  const saveNatal = useMutation({
    mutationFn: async () => {
      const method = natal ? "PATCH" : "POST";
      const r = await fetch("/api/natal-chart", {
        method, headers: authH(testerId),
        body: JSON.stringify({
          birthDate: natalForm.birthDate,
          birthTime: natalForm.birthTime,
          birthLat: parseFloat(natalForm.birthLat),
          birthLon: parseFloat(natalForm.birthLon),
          utcOffset: parseFloat(natalForm.utcOffset),
          birthPlace: natalForm.birthPlace,
        }),
      });
      if (!r.ok) throw new Error(`save chart failed (${r.status})`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["natal-chart"] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });


  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--color-border)", background: "var(--color-rail)", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: "var(--color-muted)" }}>Settings</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>

        {/* Account — recovery key */}
        <AccountSection />
        <DevicesSection testerId={testerId} />

        {/* Theme + text size */}
        <ThemeSection />
        <GuideSection testerId={testerId} />
        <TextSizeSection />
        <EmailReportsSection testerId={testerId} />

        {/* Premium — near the top so it's easy to find and toggle */}
        <PlanSection />

        {/* Caution planets — the questionnaire lost its only door when Currents
            was retired; Tasks/Calendar/Aims still read cautionPlanets. */}
        <CautionPlanetsSection />

        {/* Notifications */}
        <NotificationSection lat={lat} lon={lon} />

        {/* Display */}
        <DisplaySection />

        {/* Timing */}
        <TimingSection />

        {/* Profile */}
        <SectionCard title="Profile">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{profile?.displayName}</div>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "monospace", marginTop: 2 }}>{profile?.testerId}</div>
            </div>
            <button onClick={() => {
              // Was a one-tap, unconfirmed, unrecoverable action — clearProfile
              // wipes the recovery code from localStorage too, so a mis-tap
              // here silently destroyed the account with no way back
              // (audit P0 #5). Now requires reading and confirming the key.
              const code = profile?.recoveryCode;
              const warning = code
                ? `Switching clears this browser's profile. Your account key is:\n\n${code}\n\nWrite it down or copy it from Account above — it's the ONLY way back. Continue?`
                : `Switching clears this browser's profile, and no account key has synced yet — there may be no way back. Continue anyway?`;
              if (window.confirm(warning)) resetProfile();
            }} style={{ marginLeft: "auto", fontSize: 11, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-muted)", cursor: "pointer" }}>
              Switch profile
            </button>
          </div>
        </SectionCard>

        {/* Natal chart */}
        <SectionCard title="Natal chart" sub="Used for personal transit overlays in the Today view.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="Birth date"><SettingsInput value={natalForm.birthDate} onChange={v => setNatalForm(f => ({ ...f, birthDate: v }))} type="date" /></Field>
            <Field label="Birth time"><SettingsInput value={natalForm.birthTime} onChange={v => setNatalForm(f => ({ ...f, birthTime: v }))} type="time" /></Field>
            <Field label="Place">
              <LocationSearchInput
                value={natalForm.birthPlace}
                onChange={v => setNatalForm(f => ({ ...f, birthPlace: v }))}
                onSelect={r => setNatalForm(f => ({
                  ...f,
                  birthPlace: r.city ?? r.displayName,
                  birthLat: String(r.lat.toFixed(4)),
                  birthLon: String(r.lon.toFixed(4)),
                  utcOffset: r.utcOffsetStandard != null ? String(r.utcOffsetStandard) : f.utcOffset,
                }))}
                placeholder="Search city…"
              />
            </Field>
            <Field label="UTC offset"><SettingsInput value={natalForm.utcOffset} onChange={v => setNatalForm(f => ({ ...f, utcOffset: v }))} placeholder="-5" /></Field>
            <Field label="Latitude"><SettingsInput value={natalForm.birthLat} onChange={v => setNatalForm(f => ({ ...f, birthLat: v }))} placeholder="40.7" /></Field>
            <Field label="Longitude"><SettingsInput value={natalForm.birthLon} onChange={v => setNatalForm(f => ({ ...f, birthLon: v }))} placeholder="-74.0" /></Field>
          </div>
          <button onClick={() => saveNatal.mutate()} disabled={!natalForm.birthDate || saveNatal.isPending} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 12, cursor: "pointer",
            background: natalForm.birthDate ? "#1a2a3a" : "var(--color-border)", color: natalForm.birthDate ? "#ffffff" : "var(--text-3)",
          }}>
            {saveNatal.isPending ? "Saving…" : saved ? "Saved ✓" : natal ? "Update chart" : "Save chart"}
          </button>
          {saveNatal.isError && <div style={{ fontSize: 10.5, color: "#a03030", marginTop: 6 }}>Couldn't save — try again.</div>}
        </SectionCard>

        {/* Location */}
        <SectionCard title="Current location" sub="Used for planetary hours and angle calculations.">
          <button
            onClick={() => {
              if (!navigator.geolocation) { setGeoError("Geolocation not supported."); return; }
              setGeoLoading(true); setGeoError("");
              navigator.geolocation.getCurrentPosition(
                pos => {
                  const la = parseFloat(pos.coords.latitude.toFixed(4));
                  const lo = parseFloat(pos.coords.longitude.toFixed(4));
                  setLocationForm(f => ({ ...f, lat: String(la), lon: String(lo) }));
                  setGeoLoading(false);
                },
                err => { setGeoError(err.message); setGeoLoading(false); },
                { timeout: 8000 }
              );
            }}
            style={{
              width: "100%", marginBottom: 14, padding: "10px 0", borderRadius: 8,
              border: "1.5px solid #1a2a3a", background: "#1a2a3a", color: "var(--text-3)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {geoLoading ? "Locating…" : "⊙ Use my current location"}
          </button>
          {geoError && <div style={{ fontSize: 10, color: "#c05030", marginBottom: 8 }}>{geoError}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="City">
              <LocationSearchInput
                value={locationForm.label}
                onChange={v => setLocationForm(f => ({ ...f, label: v }))}
                onSelect={r => setLocationForm({ label: r.city ?? r.displayName, lat: String(r.lat.toFixed(4)), lon: String(r.lon.toFixed(4)) })}
                placeholder="Search city…"
              />
            </Field>
            <Field label="Latitude"><SettingsInput value={locationForm.lat} onChange={v => setLocationForm(f => ({ ...f, lat: v }))} placeholder="40.7" /></Field>
            <Field label="Longitude"><SettingsInput value={locationForm.lon} onChange={v => setLocationForm(f => ({ ...f, lon: v }))} placeholder="-74.0" /></Field>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            {locSaved && <span style={{ fontSize: 10, color: "#60a060" }}>Saved <span aria-hidden="true">✓</span> All calculations now use this location.</span>}
            <button onClick={() => {
              const la = parseFloat(locationForm.lat), lo = parseFloat(locationForm.lon);
              if (!isNaN(la) && !isNaN(lo)) {
                updateLocation(la, lo, locationForm.label);
                setLocSaved(true);
                setTimeout(() => setLocSaved(false), 3000);
              }
            }} style={{ fontSize: 11, padding: "5px 14px", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#ffffff", cursor: "pointer" }}>
              Save location
            </button>
          </div>
        </SectionCard>

        {/* Chronotype / rhythm */}
        <ChronotypeSection />

        {/* Birth chart */}
        <NatalChartSection testerId={testerId} />

        {/* House system */}
        <HouseSystemSection />

        {/* Cycle tracking */}
        <CycleSection testerId={testerId} />

        {/* Integrations */}
        <GoogleCalSection testerId={testerId} />

        {/* Export */}
        <ExportSection testerId={testerId} />

        {/* Journal history */}
        <SectionCard title="Journal history">
          <button onClick={() => setJournalOpen(v => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: journalOpen ? 12 : 0 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{journalOpen ? "▲" : "▼"} {journalEntries.length} entries (last 14 days)</span>
          </button>
          {journalOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {journalEntries.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", padding: "12px 0" }}>No journal entries yet.</div>
              )}
              {journalEntries.map(({ date, text }) => {
                const d = new Date(date + "T12:00:00");
                const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                return (
                  <div key={date} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
                    <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-1)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Deletion — the privacy policy promises this; it lives last, behind a
            disclosure, because nobody arrives at Settings looking for it. */}
                <DeleteAccountSection testerId={testerId} />

        <div style={{ textAlign: "center", padding: "8px 0 4px", fontSize: 11 }}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-3)" }}>Privacy policy</a>
        </div>

      </div>
    </div>
  );
}
