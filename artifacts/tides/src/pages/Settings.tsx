import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";
import { logEvent } from "@/lib/analytics";
import { usePremium } from "@/contexts/premium-context";
import { TEXT_SCALES, getTextScale, setTextScale } from "@/lib/textScale";
import { useTheme, PALETTES } from "@/contexts/theme-context";
import { usePreferences } from "@/contexts/preferences-context";
import type { NotificationPrefs, DisplayPrefs } from "@/lib/preferences";
import { CHRONOTYPE_OPTIONS } from "@/lib/tester-profile";
import { enablePush } from "@/lib/pushSubscribe";
import type { ChronotypeProfile } from "@/lib/tester-profile";

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
        background: on ? "#1a2a3a" : "#d0cbc3", position: "relative", flexShrink: 0,
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
        <div style={{ fontSize: 12, color: "#333" }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "16px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: sub ? 2 : 10 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginBottom: 12 }}>{sub}</div>}
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--color-border)", margin: "2px 0" }} />;
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
              <span style={{ fontSize: 9.5, color: "var(--color-muted)" }}>{p.mode === "dark" ? "Dark" : "Light"}</span>
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
      body: JSON.stringify({ email, spans, sendHour, enabled: true, lat, lon }),
    });
    if (r.ok) { logEvent("email_subscribe", { spans, sendHour }); setSaved(true); setStatus("Saved — reports will arrive at your chosen hour."); }
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
        {saved && <span style={{ fontSize: 9, fontWeight: 600, color: "#4a7a52", background: "#4a7a5222", padding: "1px 6px", borderRadius: 6, marginLeft: 6 }}>ON</span>}
      </div>
      <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6, marginBottom: 10 }}>
        A short weather bulletin for your life, delivered each morning — the woven day, your windows, your aims.
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
          style={{ flex: 1, minWidth: 190, padding: "7px 11px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12, outline: "none", background: "var(--color-card-2)", color: "var(--color-foreground)" }} />
        <select value={sendHour} onChange={e => setSendHour(parseInt(e.target.value, 10))} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 11.5, background: "var(--color-card-2)", color: "var(--color-foreground)" }}>
          {[5, 6, 7, 8, 9, 10].map(h => <option key={h} value={h}>{h} AM</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {(["day", "week", "newmoon"] as const).map(s => (
          <button key={s} onClick={() => toggleSpan(s)} style={{
            fontSize: 10.5, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
            border: spans.includes(s) ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
            background: spans.includes(s) ? "#1a2a3a10" : "var(--color-card-2)",
            color: spans.includes(s) ? "#1a2a3a" : "#999", fontWeight: spans.includes(s) ? 600 : 400,
          }}>{SPAN_LABELS[s]}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={save} disabled={!email} style={{ fontSize: 11, fontWeight: 600, padding: "6px 16px", borderRadius: 8, cursor: email ? "pointer" : "default", border: "none", background: email ? "#1a2a3a" : "#c9c4bb", color: "#fff" }}>
          {saved ? "Update" : "Turn on"}
        </button>
        {saved && (
          <button onClick={sendTest} style={{ fontSize: 11, padding: "6px 13px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)" }}>
            Send me a test
          </button>
        )}
        <span style={{ flex: 1 }} />
        {(["day", "week"] as const).map(s => (
          <button key={s} onClick={() => open(s)} style={{ fontSize: 10, padding: "5px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: "none", color: "#998a76" }}>
            preview the {s} ↗
          </button>
        ))}
      </div>
      {status && <div style={{ fontSize: 10.5, color: status.startsWith("Saved") || status.startsWith("Test") ? "#4a7a52" : "#8a6a30", marginTop: 8, lineHeight: 1.5 }}>{status}</div>}
      {senderConfigured === false && !status && (
        <div style={{ fontSize: 10, color: "#a89a88", marginTop: 8 }}>Server note: RESEND_API_KEY isn't set yet — subscriptions save, sends wait for the key.</div>
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
            color: scale === t.key ? "#1a2a3a" : "#777", fontWeight: scale === t.key ? 600 : 400,
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
      {subscribing && <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>Setting up…</div>}
      {subMsg && <div style={{ fontSize: 10, color: subMsg.includes("✓") ? "#60a060" : "#c05030", marginBottom: 6 }}>{subMsg}</div>}
      {n.enabled && (
        <button onClick={async () => {
          const tid = localStorage.getItem("obs_tester_id");
          const r = await fetch("/api/push/test", { method: "POST", headers: { ...(tid ? { "x-tester-id": tid } : {}), "Content-Type": "application/json" } });
          setSubMsg(r.ok ? "Test sent — check your notifications ✓" : "Test failed — check subscription.");
        }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "#555", cursor: "pointer", marginBottom: 6 }}>
          Send test notification
        </button>
      )}

      {n.enabled && (
        <>
          <Divider />

          {/* Quiet hours */}
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: "#333", marginBottom: 6 }}>Quiet hours</div>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 8 }}>No notifications will be sent during this window.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase" }}>From</span>
                <select value={n.quietStart} onChange={e => updateNotifications({ quietStart: Number(e.target.value) })}
                  style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card-2)" }}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 12 }}>to</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase" }}>Until</span>
                <select value={n.quietEnd} onChange={e => updateNotifications({ quietEnd: Number(e.target.value) })}
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
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6 }}>Alert for these planets:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => updateNotifications({ hourShiftPlanets: "all" })}
                  style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, border: "1px solid", cursor: "pointer",
                    background: hourShiftPlanetsIsAll ? "#1a2a3a" : "#fff",
                    color: hourShiftPlanetsIsAll ? "#fff" : "#555",
                    borderColor: hourShiftPlanetsIsAll ? "#1a2a3a" : "#d0cbc3",
                  }}>All</button>
                {ALL_PLANETS.map(p => {
                  const on = !hourShiftPlanetsIsAll && hourShiftPlanets.includes(p);
                  return (
                    <button key={p} onClick={() => toggleHourPlanet(p)}
                      style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, border: "1px solid", cursor: "pointer",
                        background: on ? "#e8e4de" : "#fff",
                        color: on ? "#333" : "#888",
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
                <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Planet filter:</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["benefic", "malefic", "both", "all"] as const).map(opt => (
                    <button key={opt} onClick={() => updateNotifications({ crossingPlanets: opt })}
                      style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, border: "1px solid", cursor: "pointer",
                        background: n.crossingPlanets === opt ? "#1a2a3a" : "#fff",
                        color: n.crossingPlanets === opt ? "#fff" : "#555",
                        borderColor: n.crossingPlanets === opt ? "#1a2a3a" : "#d0cbc3",
                      }}>{opt === "both" ? "Both" : opt === "all" ? "All" : opt === "benefic" ? "Benefics" : "Malefics"}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Angles:</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["ASC", "MC", "DSC", "IC"] as const).map(ang => {
                    const on = n.crossingAngles.includes(ang);
                    return (
                      <button key={ang} onClick={() => {
                        const next = on ? n.crossingAngles.filter(a => a !== ang) : [...n.crossingAngles, ang];
                        updateNotifications({ crossingAngles: next });
                      }} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 10, border: "1px solid", cursor: "pointer",
                        background: on ? "#e8e4de" : "#fff", color: on ? "#333" : "#888",
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

  function toggleRailSection(key: typeof RAIL_SECTIONS[number]["key"]) {
    const next = d.railSections.includes(key)
      ? d.railSections.filter(s => s !== key)
      : [...d.railSections, key];
    updateDisplay({ railSections: next });
  }

  return (
    <SectionCard title="Display" sub="Choose what appears in the sidebar and Today view.">
      <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Sidebar sections</div>
      {RAIL_SECTIONS.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <Divider />}
          <Row label={s.label} sub={s.sub}>
            <Toggle on={d.railSections.includes(s.key)} onChange={() => toggleRailSection(s.key)} />
          </Row>
        </React.Fragment>
      ))}

      <div style={{ height: 16 }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Time display</div>
      <Row label="Time format" sub="How times appear across the app.">
        <div style={{ display: "flex", background: "#e8e4de", borderRadius: 7, padding: 3, gap: 1 }}>
          {(["12h", "24h"] as const).map(fmt => (
            <button key={fmt} onClick={() => updateDisplay({ timeFormat: fmt })} style={{
              fontSize: 11, padding: "3px 12px", borderRadius: 5, border: "none", cursor: "pointer",
              background: d.timeFormat === fmt ? "#fff" : "transparent",
              color: d.timeFormat === fmt ? "#1a2a3a" : "#999",
              fontWeight: d.timeFormat === fmt ? 600 : 400,
            }}>{fmt}</button>
          ))}
        </div>
      </Row>
      <Divider />
      <Row label="How much astrology" sub="Same engine underneath — this only changes what's shown. Minimal: plain guidance, no jargon. Medium: the moon and the day. Full: glyphs, aspects, transits.">
        <div style={{ display: "flex", background: "#e8e4de", borderRadius: 7, padding: 3, gap: 1 }}>
          {(["minimal", "medium", "full"] as const).map(lvl => (
            <button key={lvl} onClick={() => updateDisplay({ astroDetail: lvl })} style={{
              fontSize: 11, padding: "3px 11px", borderRadius: 5, border: "none", cursor: "pointer", textTransform: "capitalize",
              background: d.astroDetail === lvl ? "#fff" : "transparent",
              color: d.astroDetail === lvl ? "#1a2a3a" : "#999",
              fontWeight: d.astroDetail === lvl ? 600 : 400,
            }}>{lvl}</button>
          ))}
        </div>
      </Row>
      <Divider />
      <Row label="How much on screen" sub="Essential: the core journey — the tide, today's plan, your aims. Expanded: the full instrument panel (rhythm, big sky, pulse, conditions…).">
        <div style={{ display: "flex", background: "#e8e4de", borderRadius: 7, padding: 3, gap: 1 }}>
          {(["essential", "expanded"] as const).map(lvl => (
            <button key={lvl} onClick={() => updateDisplay({ uiDensity: lvl })} style={{
              fontSize: 11, padding: "3px 11px", borderRadius: 5, border: "none", cursor: "pointer", textTransform: "capitalize",
              background: (d.uiDensity ?? "essential") === lvl ? "#fff" : "transparent",
              color: (d.uiDensity ?? "essential") === lvl ? "#1a2a3a" : "#999",
              fontWeight: (d.uiDensity ?? "essential") === lvl ? 600 : 400,
            }}>{lvl}</button>
          ))}
        </div>
      </Row>
      <Divider />
      <Row label="Sky language" sub="At the full level: plain keeps the app's own words (Deep, Surge); bilingual adds the sky's words next to them (Moon in Pisces).">
        <div style={{ display: "flex", background: "#e8e4de", borderRadius: 7, padding: 3, gap: 1 }}>
          {(["plain", "bilingual"] as const).map(mode => (
            <button key={mode} onClick={() => updateDisplay({ skyLanguage: mode })} style={{
              fontSize: 11, padding: "3px 12px", borderRadius: 5, border: "none", cursor: "pointer", textTransform: "capitalize",
              background: d.skyLanguage === mode ? "#fff" : "transparent",
              color: d.skyLanguage === mode ? "#1a2a3a" : "#999",
              fontWeight: d.skyLanguage === mode ? 600 : 400,
            }}>{mode}</button>
          ))}
        </div>
      </Row>

      <div style={{ height: 16 }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Today page</div>
      <Row label="VOC banner" sub="Show void-of-course warning at top.">
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
      <div style={{ fontSize: 10, color: "#aaa", marginBottom: 8 }}>Watch planets (highlighted in sidebar):</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {PLANETS.map(p => {
          const on = t.watchPlanets.includes(p);
          return (
            <button key={p} onClick={() => togglePlanet(p)}
              style={{ fontSize: 11, padding: "4px 11px", borderRadius: 12, border: "1px solid", cursor: "pointer",
                background: on ? "#e8e4de" : "#fff", color: on ? "#1a1a1a" : "#888",
                borderColor: on ? "#c0bab0" : "#e0dbd4", fontWeight: on ? 500 : 400,
              }}>{p}</button>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6 }}>Default window type for new tasks:</div>
      <select value={t.defaultWindowType} onChange={e => updateTiming({ defaultWindowType: e.target.value })}
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
  value, onChange, onSelect, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (r: LocResult) => void;
  placeholder?: string;
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
      zIndex: 9999,
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
        <input ref={inputRef} value={value} onChange={e => handleChange(e.target.value)}
          placeholder={placeholder ?? "Search city…"}
          onFocus={() => { if (results.length > 0) { updateDropPos(); setOpen(true); } }}
          style={{ width: "100%", padding: "7px 28px 7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 13, background: "var(--color-card-2)", outline: "none", boxSizing: "border-box" }}
        />
        {loading && <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#aaa" }}>…</span>}
      </div>
      {open && results.length > 0 && (
        <div style={dropStyle}>
          {results.map((r, i) => (
            <button key={i} onMouseDown={() => pick(r)} style={{
              display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
              border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "#333",
              borderBottom: i < results.length - 1 ? "1px solid var(--color-border)" : "none",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f2ed")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <div style={{ fontWeight: 500 }}>{r.city ?? r.displayName}</div>
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>{r.displayName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Form helpers (module-level to avoid remount-on-render bug) ----

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#aaa" }}>{label}</label>
      {children}
    </div>
  );
}

function SettingsInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} {...rest}
      style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 13, background: "var(--color-card-2)", outline: "none", ...(rest.style ?? {}) }} />
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
      await fetch("/api/cycle", {
        method, headers: authH(testerId),
        body: JSON.stringify({ cycleStartDate: form.cycleStartDate, cycleLength: parseInt(form.cycleLength), lutealLength: parseInt(form.lutealLength) }),
      });
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
          <div style={{ fontSize: 10, color: "#777", marginTop: 3 }}>{currentPhase.desc}</div>
          {currentPhase.daysLeft > 0 && <div style={{ fontSize: 9, color: "#bbb", marginTop: 3 }}>{currentPhase.daysLeft} day{currentPhase.daysLeft !== 1 ? "s" : ""} remaining in phase</div>}
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
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#888" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />{p.name}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => save.mutate()} disabled={!form.cycleStartDate} style={{
            padding: "7px 16px", borderRadius: 7, border: "none", fontSize: 11,
            background: form.cycleStartDate ? "#1a2a3a" : "#e0dcd6", color: form.cycleStartDate ? "#fff" : "#aaa", cursor: "pointer",
          }}>{saved ? "Saved ✓" : cycle ? "Update" : "Save"}</button>
          {cycle && <button onClick={() => del.mutate()} style={{ fontSize: 10, color: "#c06060", background: "none", border: "none", cursor: "pointer" }}>Remove</button>}
        </div>
      </div>
    </SectionCard>
  );
}

// ---- Export section ----

// ---- Premium preview toggle ----
// No billing exists yet. This toggle lets you flip between the unlocked view
// (what premium content looks like) and the locked view (the paywall/teaser
// UX new users without premium would see) — remove once real entitlements exist.

function PremiumPreviewSection() {
  const { unlocked, setUnlocked } = usePremium();
  return (
    <SectionCard title="Premium — try both sides" sub="No billing exists yet. Flip this to feel exactly what's free vs paid across the app.">
      <Row label={unlocked ? "Premium: ON" : "Premium: OFF (free view)"} sub={unlocked ? "You're seeing everything a paying user would." : "You're seeing the free experience a new user gets."}>
        <Toggle on={unlocked} onChange={setUnlocked} />
      </Row>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "var(--color-card-2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6a8a5a", marginBottom: 5 }}>Free</div>
          <div style={{ fontSize: 10.5, color: "#777", lineHeight: 1.6 }}>
            The daily tide & Big Sky · the Ahead calendar · scheduling tasks & habits yourself · the Almanac reference · Guiding Stars, tasks & habits as a plain planner
          </div>
        </div>
        <div style={{ background: "var(--color-card-2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a6a30", marginBottom: 5 }}>Premium ✦</div>
          <div style={{ fontSize: 10.5, color: "#777", lineHeight: 1.6 }}>
            Currents (your long cycles) · personal advisories · smart scheduling (best times found for you) · Ask — the "what do I do now" advisor
          </div>
        </div>
      </div>
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

  const inputStyle: React.CSSProperties = { flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)", outline: "none", boxSizing: "border-box" };

  return (
    <SectionCard title="Your rhythm" sub="When you're usually free and how you naturally run — used to suggest timing that fits your life, not just the sky.">
      {existing && !editing ? (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#333", fontWeight: 500 }}>
                {CHRONOTYPE_OPTIONS.find(o => o.key === existing.profile)?.label ?? existing.profile}
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                Weekdays {existing.freeWindows?.mon?.start}–{existing.freeWindows?.mon?.end} · Weekends {existing.freeWindows?.sat?.start}–{existing.freeWindows?.sat?.end}
                {existing.wakeTime && existing.sleepTime && <> · Awake {existing.wakeTime}–{existing.sleepTime}</>}
              </div>
              {existing.description && <div style={{ fontSize: 10, color: "#aaa", marginTop: 4, fontStyle: "italic" }}>"{existing.description}"</div>}
            </div>
            <button onClick={() => setEditing(true)} style={{ fontSize: 11, padding: "5px 13px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "#555", cursor: "pointer" }}>
              Edit
            </button>
          </div>
          {saved && <div style={{ fontSize: 10, color: "#3a6030" }}>✓ Saved</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!existing && <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>Not set yet — add your rhythm to unlock chronotype-aware timing suggestions.</div>}

          <div>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Morning or night person?</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {CHRONOTYPE_OPTIONS.map(o => (
                <button key={o.key} type="button" onClick={() => setChronoProfile(o.key)}
                  style={{
                    padding: "7px 9px", borderRadius: 7, textAlign: "left", cursor: "pointer",
                    border: chronoProfile === o.key ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
                    background: chronoProfile === o.key ? "#1a2a3a10" : "var(--color-card-2)",
                  }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: chronoProfile === o.key ? "#1a2a3a" : "#333" }}>{o.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Usually awake</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={inputStyle} />
              <span style={{ color: "#bbb", fontSize: 11 }}>to</span>
              <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Usually free — weekdays</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="time" value={weekdayStart} onChange={e => setWeekdayStart(e.target.value)} style={inputStyle} />
              <span style={{ color: "#bbb", fontSize: 10 }}>to</span>
              <input type="time" value={weekdayEnd} onChange={e => setWeekdayEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Usually free — weekends</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="time" value={weekendStart} onChange={e => setWeekendStart(e.target.value)} style={inputStyle} />
              <span style={{ color: "#bbb", fontSize: 10 }}>to</span>
              <input type="time" value={weekendEnd} onChange={e => setWeekendEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>In your own words <span style={{ opacity: 0.6 }}>(optional)</span></div>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. dead by 10pm, useless before coffee…" style={{ ...inputStyle, width: "100%" }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {existing && (
              <button onClick={() => setEditing(false)} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "#888", cursor: "pointer" }}>
                Cancel
              </button>
            )}
            <button onClick={save} disabled={!chronoProfile} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", background: chronoProfile ? "#1a2a3a" : "#e0dcd6", color: chronoProfile ? "#fff" : "#aaa", cursor: chronoProfile ? "pointer" : "default" }}>
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
  const [locationResults, setLocationResults] = useState<any[]>([]);
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

  async function searchLocation(q: string) {
    if (q.length < 2) { setLocationResults([]); return; }
    try {
      const r = await fetch(`/api/location-search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      setLocationResults(Array.isArray(data) ? data : (data.results ?? []));
    } catch { setLocationResults([]); }
  }

  function handleLocationInput(v: string) {
    setLocationSearch(v);
    setForm(f => ({ ...f, birthPlace: v, birthLat: null, birthLon: null }));
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchLocation(v), 400);
  }

  function pickLocation(r: any) {
    const place = r.displayName ?? r.formatted ?? r.name ?? locationSearch;
    setLocationSearch(place);
    setLocationResults([]);
    const offset = r.utcOffsetStandard != null ? Math.round(r.utcOffsetStandard)
      : r.lon != null ? Math.round(r.lon / 15) : form.utcOffset;
    setForm(f => ({ ...f, birthPlace: place, birthLat: r.lat, birthLon: r.lon, utcOffset: offset }));
  }

  async function save() {
    if (!testerId || !form.birthDate || form.birthLat == null) return;
    setSaving(true);
    try {
      await fetch("/api/natal-chart", {
        method: "POST",
        headers: authH(testerId),
        body: JSON.stringify({ birthDate: form.birthDate, birthTime: form.birthTime || "12:00", birthPlace: form.birthPlace, birthLat: form.birthLat, birthLon: form.birthLon, utcOffset: form.utcOffset, timeKnown: !!form.birthTime }),
      });
      qc.invalidateQueries({ queryKey: ["natal-chart"] });
      qc.invalidateQueries({ queryKey: ["currents"] });
      setSaved(true); setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  const hasChart = !!chart;
  const inputStyle: React.CSSProperties = { width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)", outline: "none", boxSizing: "border-box" };

  return (
    <SectionCard title="Birth chart" sub="Used for personal transits — which planetary cycles are active in your chart right now.">
      {isLoading ? (
        <div style={{ fontSize: 11, color: "#bbb", padding: "4px 0" }}>Loading…</div>
      ) : hasChart && !editing ? (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#333", fontWeight: 500 }}>{chart.birthDate}{chart.timeKnown === false ? " · time unknown" : chart.birthTime && ` at ${chart.birthTime}`}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{chart.birthPlace}</div>
              {chart.timeKnown === false ? (
                <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                  ☉ {chart.planets?.find((p: any) => p.planet === "Sun")?.sign} · ☽ {chart.planets?.find((p: any) => p.planet === "Moon")?.sign} <span style={{ color: "#b0a898" }}>(approx)</span>
                  <div style={{ color: "#b0a898", marginTop: 2 }}>Rising sign, houses & Currents need a birth time — add it below to unlock them.</div>
                </div>
              ) : chart.ascendant && (
                <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                  ↑ {chart.ascendant.sign} rising · ☉ {chart.planets?.find((p: any) => p.planet === "Sun")?.sign} · ☽ {chart.planets?.find((p: any) => p.planet === "Moon")?.sign}
                </div>
              )}
            </div>
            <button onClick={() => setEditing(true)} style={{ fontSize: 11, padding: "5px 13px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "#555", cursor: "pointer" }}>
              Edit
            </button>
          </div>
          {saved && <div style={{ fontSize: 10, color: "#3a6030" }}>✓ Saved</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!hasChart && <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>No birth chart saved yet. Add your birth data to unlock personal transits.</div>}

          <div>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Date of birth</div>
            <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} style={inputStyle} />
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Time of birth <span style={{ opacity: 0.6 }}>(optional — needed for Ascendant)</span></div>
            <input type="time" value={form.birthTime} onChange={e => setForm(f => ({ ...f, birthTime: e.target.value }))} style={inputStyle} />
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Place of birth</div>
            <input value={locationSearch} onChange={e => handleLocationInput(e.target.value)} placeholder="City, country…" style={inputStyle} />
            {locationResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 100, marginTop: 2, maxHeight: 180, overflowY: "auto" }}>
                {locationResults.map((r, i) => (
                  <button key={i} type="button" onClick={() => pickLocation(r)}
                    style={{ display: "block", width: "100%", padding: "8px 12px", textAlign: "left", border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "#333", borderBottom: "1px solid var(--color-border)" }}>
                    {r.displayName ?? r.formatted ?? r.name}
                  </button>
                ))}
              </div>
            )}
            {form.birthLat != null && <div style={{ fontSize: 10, color: "#3a6030", marginTop: 3 }}>✓ Location set</div>}
          </div>

          {form.birthLat != null && (
            <div>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>UTC offset at birth</div>
              <select value={form.utcOffset} onChange={e => setForm(f => ({ ...f, utcOffset: Number(e.target.value) }))}
                style={{ ...inputStyle, width: "auto" }}>
                {Array.from({ length: 27 }, (_, i) => i - 12).map(o => (
                  <option key={o} value={o}>UTC{o >= 0 ? "+" : ""}{o}:00</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {editing && (
              <button onClick={() => { setEditing(false); setLocationSearch(chart?.birthPlace ?? ""); setLocationResults([]); }}
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "#888", cursor: "pointer" }}>
                Cancel
              </button>
            )}
            <button onClick={save} disabled={!form.birthDate || form.birthLat == null || saving}
              style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", cursor: (!form.birthDate || form.birthLat == null) ? "default" : "pointer",
                background: (!form.birthDate || form.birthLat == null) ? "#e0dcd6" : "#1a2a3a",
                color: (!form.birthDate || form.birthLat == null) ? "#aaa" : "#fff" }}>
              {saving ? "Saving…" : "Save birth chart"}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function ExportSection({ testerId }: { testerId: string | null }) {
  function downloadIcal() {
    const tid = testerId ?? localStorage.getItem("obs_tester_id");
    const url = `/api/export/ical?testerId=${encodeURIComponent(tid ?? "")}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "tides-events.ics";
    a.click();
  }

  return (
    <SectionCard title="Export" sub="Download your tasks and planning windows. Planetary hours and astrological events are not included.">
      <Row label="Tasks + planning windows" sub="Calendar-compatible .ics file">
        <button onClick={downloadIcal} style={{ fontSize: 11, padding: "5px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "#555", cursor: "pointer" }}>
          ↓ Download .ics
        </button>
      </Row>
    </SectionCard>
  );
}

// ---- Google Calendar section ----

function GoogleCalSection({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const popupRef = React.useRef<Window | null>(null);

  const { data: status, isLoading } = useQuery<{ connected: boolean; email?: string; configured?: boolean }>({
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
          <span style={{ fontSize: 10, color: "#bbb" }}>…</span>
        ) : status?.configured === false ? (
          <span style={{ fontSize: 10, color: "#ccc", padding: "4px 10px", border: "1px solid var(--color-border)", borderRadius: 6 }}>Not configured</span>
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
          <button onClick={connect} style={{ fontSize: 11, padding: "5px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "#555", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <span>📅</span> Connect
          </button>
        )}
      </Row>
    </SectionCard>
  );
}

// ---- Main Settings page ----

const HOUSE_SYSTEMS: { id: string; label: string; note: string }[] = [
  { id: "whole-sign",    label: "Whole Sign",    note: "Traditional. Each sign = one house. Used for profections and the Currents view." },
  { id: "equal",         label: "Equal",         note: "30° houses measured from the Ascendant degree." },
  { id: "placidus",      label: "Placidus",      note: "Most common modern system. Time-based, unequal houses." },
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
              {h.label}{system === h.id && <span style={{ color: "#3a4a68", fontSize: 10, marginLeft: 6 }}>✓ selected</span>}
            </div>
            <div style={{ fontSize: 10.5, color: "#999", marginTop: 2, lineHeight: 1.4 }}>{h.note}</div>
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
            }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <div style={{ fontSize: 10, color: "#999", marginTop: 8, lineHeight: 1.55 }}>
            On another device: open Compass → "Been here before?" on the first screen → enter this key.
            Anyone holding the key can restore your data, so treat it like a password.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.6 }}>
          Your account key hasn't been created yet — it appears here automatically the next time the
          app reaches the server. Check back in a moment.
        </div>
      )}

      {/* Feedback — beta channel */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-primary)" }}>Send feedback</div>
          <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>Something confusing, wrong, or missing? Tell us — every note shapes the next build.</div>
        </div>
        <a href="mailto:charliecro@gmail.com?subject=Compass%20feedback"
          style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-primary)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "7px 14px", textDecoration: "none", background: "var(--color-card-2)", flexShrink: 0 }}>
          ✉ Email
        </a>
      </div>
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
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
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

  const saveNatal = useMutation({
    mutationFn: async () => {
      const method = natal ? "PATCH" : "POST";
      await fetch("/api/natal-chart", {
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
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["natal-chart"] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });


  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--color-border)", background: "var(--color-rail)", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: "#888" }}>Settings</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>

        {/* Account — recovery key */}
        <AccountSection />

        {/* Theme + text size */}
        <ThemeSection />
        <TextSizeSection />
        <EmailReportsSection testerId={testerId} />

        {/* Premium — near the top so it's easy to find and toggle */}
        <PremiumPreviewSection />

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
              <div style={{ fontSize: 10, color: "#aaa", fontFamily: "monospace", marginTop: 2 }}>{profile?.testerId}</div>
            </div>
            <button onClick={resetProfile} style={{ marginLeft: "auto", fontSize: 11, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "#888", cursor: "pointer" }}>
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
          <button onClick={() => saveNatal.mutate()} disabled={!natalForm.birthDate} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 12, cursor: "pointer",
            background: natalForm.birthDate ? "#1a2a3a" : "#e0dcd6", color: natalForm.birthDate ? "#fff" : "#aaa",
          }}>
            {saved ? "Saved ✓" : natal ? "Update chart" : "Save chart"}
          </button>
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
              border: "1.5px solid #1a2a3a", background: "#1a2a3a", color: "#f0ede8",
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
            {locSaved && <span style={{ fontSize: 10, color: "#60a060" }}>Saved ✓ All calculations now use this location.</span>}
            <button onClick={() => {
              const la = parseFloat(locationForm.lat), lo = parseFloat(locationForm.lon);
              if (!isNaN(la) && !isNaN(lo)) {
                updateLocation(la, lo, locationForm.label);
                setLocSaved(true);
                setTimeout(() => setLocSaved(false), 3000);
              }
            }} style={{ fontSize: 11, padding: "5px 14px", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#fff", cursor: "pointer" }}>
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
            <span style={{ fontSize: 11, color: "#aaa" }}>{journalOpen ? "▲" : "▼"} {journalEntries.length} entries (last 14 days)</span>
          </button>
          {journalOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {journalEntries.length === 0 && (
                <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", padding: "12px 0" }}>No journal entries yet.</div>
              )}
              {journalEntries.map(({ date, text }) => {
                const d = new Date(date + "T12:00:00");
                const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                return (
                  <div key={date} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#bbb", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#444", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>


      </div>
    </div>
  );
}
