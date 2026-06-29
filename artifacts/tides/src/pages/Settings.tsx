import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";
import { usePreferences } from "@/contexts/preferences-context";
import type { NotificationPrefs, DisplayPrefs } from "@/lib/preferences";

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
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
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
    <div style={{ background: "#fff", border: "1px solid #e8e4de", borderRadius: 10, padding: "16px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: sub ? 2 : 10 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginBottom: 12 }}>{sub}</div>}
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #f0ede8", margin: "2px 0" }} />;
}

// ---- Notification section ----

const ALL_PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

function NotificationSection() {
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
    try {
      const perm = await Notification.requestPermission();
      setPermState(perm);
      if (perm !== "granted") { setSubMsg("Permission denied by browser."); setSubscribing(false); return; }

      // Register service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Get VAPID key
      const keyRes = await fetch("/api/push/vapid-key");
      if (!keyRes.ok) { setSubMsg("Push not configured on server yet."); setSubscribing(false); return; }
      const { publicKey } = await keyRes.json();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      const testerId = localStorage.getItem("obs_tester_id");
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: authH(testerId),
        body: JSON.stringify(sub.toJSON()),
      });

      updateNotifications({ enabled: true });
      setSubMsg("Notifications enabled ✓");
    } catch (e: any) {
      setSubMsg(e.message ?? "Failed to subscribe.");
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
                  style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #d8d2ca", fontSize: 11, background: "#faf8f5" }}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 12 }}>to</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase" }}>Until</span>
                <select value={n.quietEnd} onChange={e => updateNotifications({ quietEnd: Number(e.target.value) })}
                  style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #d8d2ca", fontSize: 11, background: "#faf8f5" }}>
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
  { key: "moon" as const,       label: "Moon & element",   sub: "Phase, sign, biodynamic type" },
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
        style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid #d8d2ca", fontSize: 12, background: "#faf8f5", width: "100%" }}>
        <option value="">Any</option>
        {WINDOW_TYPES.map(wt => <option key={wt} value={wt}>{WINDOW_LABELS[wt]}</option>)}
      </select>
    </SectionCard>
  );
}

// ---- Main Settings page ----

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

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#aaa" }}>{label}</label>
      {children}
    </div>
  );

  const input = (val: string, onChange: (v: string) => void, rest = {} as any) => (
    <input value={val} onChange={e => onChange(e.target.value)} {...rest}
      style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid #d8d2ca", fontSize: 13, background: "#faf8f5", outline: "none", ...(rest.style ?? {}) }} />
  );

  const icalUrl = testerId ? `/api/tides/calendar.ics?tid=${testerId}` : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #d0cbc3", background: "#ece8e2", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: "#888" }}>Settings</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>

        {/* Notifications */}
        <NotificationSection />

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
            <button onClick={resetProfile} style={{ marginLeft: "auto", fontSize: 11, padding: "5px 12px", borderRadius: 7, border: "1px solid #d0cbc3", background: "#fff", color: "#888", cursor: "pointer" }}>
              Switch profile
            </button>
          </div>
        </SectionCard>

        {/* Natal chart */}
        <SectionCard title="Natal chart" sub="Used for personal transit overlays in the Today view.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="Birth date">{input(natalForm.birthDate, v => setNatalForm(f => ({ ...f, birthDate: v })), { type: "date" })}</Field>
            <Field label="Birth time">{input(natalForm.birthTime, v => setNatalForm(f => ({ ...f, birthTime: v })), { type: "time" })}</Field>
            <Field label="Place">{input(natalForm.birthPlace, v => setNatalForm(f => ({ ...f, birthPlace: v })), { placeholder: "City, Country" })}</Field>
            <Field label="UTC offset">{input(natalForm.utcOffset, v => setNatalForm(f => ({ ...f, utcOffset: v })), { placeholder: "-5", type: "number", step: "0.5" })}</Field>
            <Field label="Latitude">{input(natalForm.birthLat, v => setNatalForm(f => ({ ...f, birthLat: v })), { placeholder: "40.7", type: "number", step: "0.01" })}</Field>
            <Field label="Longitude">{input(natalForm.birthLon, v => setNatalForm(f => ({ ...f, birthLon: v })), { placeholder: "-74.0", type: "number", step: "0.01" })}</Field>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 12 }}>
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
              style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid #d0cbc3", background: "#f8f5f0", color: "#555", cursor: "pointer" }}
            >
              {geoLoading ? "Locating…" : "⊙ Use my location"}
            </button>
          </div>
          {geoError && <div style={{ fontSize: 10, color: "#c05030", marginBottom: 8 }}>{geoError}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="City">{input(locationForm.label, v => setLocationForm(f => ({ ...f, label: v })), { placeholder: "New York" })}</Field>
            <Field label="Latitude">{input(locationForm.lat, v => setLocationForm(f => ({ ...f, lat: v })), { type: "number", step: "0.0001" })}</Field>
            <Field label="Longitude">{input(locationForm.lon, v => setLocationForm(f => ({ ...f, lon: v })), { type: "number", step: "0.0001" })}</Field>
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
                  <div key={date} style={{ borderTop: "1px solid #f0ede8", paddingTop: 10 }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#bbb", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#444", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* iCal */}
        {icalUrl && (
          <SectionCard title="Calendar export" sub="Subscribe to your planning windows in Apple Calendar or Google Calendar.">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, fontSize: 10, fontFamily: "monospace", background: "#f5f2ee", padding: "7px 10px", borderRadius: 6, color: "#555", wordBreak: "break-all" }}>
                {window.location.origin}{icalUrl}
              </div>
              <button onClick={() => navigator.clipboard.writeText(window.location.origin + icalUrl)} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 7, border: "1px solid #d0cbc3", background: "#fff", color: "#555", cursor: "pointer", flexShrink: 0 }}>
                Copy
              </button>
            </div>
            <a href={icalUrl} download="tides.ics" style={{ display: "inline-block", marginTop: 8, fontSize: 10, color: "#6090c0" }}>
              ↓ Download .ics file
            </a>
          </SectionCard>
        )}

      </div>
    </div>
  );
}
