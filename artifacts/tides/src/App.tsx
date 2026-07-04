import React, { useState, useRef, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApiErrorBanner } from "@/components/ApiError";
import { TesterProvider, useTester } from "@/contexts/tester-context";
import { CHRONOTYPE_OPTIONS } from "@/lib/tester-profile";
import type { ChronotypeProfile, Weekday, FreeWindow } from "@/lib/tester-profile";
import { PreferencesProvider } from "@/contexts/preferences-context";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { PremiumProvider } from "@/contexts/premium-context";
import { useIsMobile } from "@/hooks/useIsMobile";
import Rail from "@/components/Rail";
import GuidingStarsHub from "@/pages/GuidingStarsHub";
import { SessionTimer } from "@/components/SessionTimer";
import Today from "@/pages/Today";
import Tasks from "@/pages/Tasks";
import Calendar from "@/pages/Calendar";
import Habits from "@/pages/Habits";
import Sky from "@/pages/Sky";
import Currents from "@/pages/Currents";
import Launch from "@/pages/Launch";
import Settings from "@/pages/Settings";
import { useTidesNow, useTidesWeek } from "@/hooks/useTides";

type WorkTab = "overview" | "tasks" | "habits";

function WorkPage({ testerId, now, lat, lon }: { testerId: string|null; now: any; lat: number; lon: number }) {
  const [tab, setTab] = useState<WorkTab>("overview");
  // Guiding Stars leads (the why), then the two daily-doing axes (tasks,
  // habits). Projects was removed as a tab — its one useful bit (breaking a
  // complex aim into ordered steps) is folded into each Guiding Star as
  // optional milestones, so most people never meet the concept at all.
  const TABS: {id:WorkTab; label:string}[] = [
    {id:"overview",  label:"Guiding Stars"},
    {id:"tasks",     label:"Tasks"},
    {id:"habits",    label:"Habits"},
  ];
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
      {/* Sub-tab bar */}
      <div style={{display:"flex", borderBottom:"1px solid var(--color-border)", background: "var(--color-rail)", flexShrink:0, padding:"0 20px"}}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"10px 18px", border:"none", background:"none", cursor:"pointer",
            fontSize:12, fontWeight: tab===t.id ? 600 : 400,
            color: tab===t.id ? "#1a2a3a" : "#888",
            borderBottom: tab===t.id ? "2px solid #1a2a3a" : "2px solid transparent",
            marginBottom:-1,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{flex:1, overflow:"hidden", display:"flex", flexDirection:"column"}}>
        {tab==="overview"  && <GuidingStarsHub testerId={testerId} lat={lat} lon={lon} onNavigate={setTab}/>}
        {tab==="tasks"     && <Tasks    testerId={testerId} now={now} lat={lat} lon={lon}/>}
        {tab==="habits"    && <Habits   testerId={testerId} now={now} lat={lat} lon={lon}/>}
      </div>
    </div>
  );
}

// Ahead (Calendar) and Almanac each get a slim sub-tab that folds Currents in,
// so the long-cycle personal view lives with the time surfaces it belongs to
// rather than as its own top-level tab.
function SubTabbed({ tabs, children }: { tabs: string[]; children: (active: string) => React.ReactNode }) {
  const [active, setActive] = useState(tabs[0]);
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ display:"flex", borderBottom:"1px solid var(--color-border)", background:"var(--color-rail)", flexShrink:0, padding:"0 20px" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActive(t)} style={{
            padding:"9px 16px", border:"none", background:"none", cursor:"pointer",
            fontSize:12, fontWeight: active===t ? 600 : 400,
            color: active===t ? "var(--color-primary)" : "#888",
            borderBottom: active===t ? "2px solid var(--color-primary)" : "2px solid transparent", marginBottom:-1,
          }}>{t}</button>
        ))}
      </div>
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>{children(active)}</div>
    </div>
  );
}

const queryClient = new QueryClient();

type View = "today"|"calendar"|"work"|"launch"|"settings";

// Primary tabs (2026-07-03): Today is the tide you're in; Calendar is the whole
// "time & sky" home — your grid, the Almanac (sky events + reference/meanings),
// and Currents (your long cycles) as sub-tabs, since they all answer "when /
// what's in the sky" and separating them just confused people; Helm is where
// you steer (Guiding Stars -> Tasks + Habits); Launch is electional; Compass
// (the advisor) is in the global bar.
const TOP_TABS: {id:View; label:string; zoom?:boolean}[] = [
  {id:"today",    label:"Today",    zoom:true},
  {id:"calendar", label:"Calendar", zoom:true},
  {id:"work",     label:"Helm"},
  {id:"launch",   label:"Launch"},
];

const WINDOW_TYPES = [
  "deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat",
];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",admin:"Admin",
  social:"Social",relationship:"Relationship",recovery:"Recovery",study:"Study",launch:"Launch",retreat:"Retreat",
};

function QuickCapture({ testerId, onClose }: { testerId: string|null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [windowType, setWindowType] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit() {
    if (!title.trim() || !testerId) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), bestWindowType: windowType || undefined }),
    });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999,
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--color-card)", borderRadius: 14, padding: "20px 22px", width: 420,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid var(--color-border)",
      }}>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>Quick capture</div>
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
          placeholder="What needs to get done?"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 14, outline: "none", background: "var(--color-card-2)", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={windowType} onChange={e => setWindowType(e.target.value)}
            style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 11, color: "#555", background: "var(--color-card-2)" }}>
            <option value="">Best time: any</option>
            {WINDOW_TYPES.map(t => <option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
          </select>
          <button onClick={submit} disabled={!title.trim()}
            style={{ padding: "7px 18px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", background: title.trim() ? "#1a2a3a" : "#e0dcd6", color: title.trim() ? "#fff" : "#aaa" }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Intro slides ─────────────────────────────────────────────────────────────

const INTRO_SLIDES: {
  glyph: string; glyphColor: string; title: string; body: string;
  cards?: { label: string; sub: string; color: string; bg: string; note: string }[];
}[] = [
  {
    glyph: "◐",
    glyphColor: "#2a5a80",
    title: "A weather report for time.",
    body: "Tides reads the sky and tells you what kind of moment you're in — and what it's good for. Like glancing at the weather before you head out, but for your day.",
  },
  {
    glyph: "◵ ◶ ◷ ◴",
    glyphColor: "#4a7040",
    title: "Every day has a character.",
    body: "Four kinds of energy, set by where the Moon is. You'll come to feel which one you're in.",
    cards: [
      { label: "Deep",     sub: "water", color: "#2a5a80", bg: "#eaf0f8", note: "feel · rest · create · listen" },
      { label: "Surge",    sub: "fire",  color: "#b84020", bg: "#fff0ec", note: "act · lead · initiate · move" },
      { label: "Building", sub: "earth", color: "#4a7040", bg: "#f0f5ee", note: "build · finish · organize · tend" },
      { label: "Clear",    sub: "air",   color: "#5040a0", bg: "#f0eef8", note: "think · write · connect · talk" },
    ],
  },
  {
    glyph: "◠ ◡",
    glyphColor: "#c08020",
    title: "High tide, low tide.",
    body: "Beyond its character, each moment has a level — how charged it is, and which way it's moving. High and rising: lean in. Low or ebbing: rest, and don't force it.",
  },
  {
    glyph: "✦",
    glyphColor: "#7040a0",
    title: "Then make it yours.",
    body: "Add your birth details and the tide becomes personal — your own timing, your year ahead, and the long cycles moving through your life right now.",
  },
];

function IntroSlides({ onDone }: { onDone: () => void }) {
  const [slide, setSlide] = useState(0);
  const s = INTRO_SLIDES[slide];
  const isLast = slide === INTRO_SLIDES.length - 1;

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background: "var(--color-background)", padding:"0 20px" }}>
      <div style={{ background: "var(--color-card)", border:"1px solid var(--color-border)", borderRadius:18, padding:"36px 32px 28px", maxWidth:380, width:"100%", display:"flex", flexDirection:"column", gap:0 }}>
        {/* Glyph */}
        <div style={{ fontSize:36, color:s.glyphColor, marginBottom:16, textAlign:"center", letterSpacing:4 }}>{s.glyph}</div>

        {/* Title */}
        <div style={{ fontSize:20, fontWeight:700, color: "var(--color-primary)", marginBottom:10, textAlign:"center", lineHeight:1.3, letterSpacing:"-0.3px" }}>{s.title}</div>

        {/* Body */}
        <div style={{ fontSize:13, color:"#666", lineHeight:1.7, textAlign:"center", marginBottom: s.cards ? 20 : 32 }}>{s.body}</div>

        {/* Character cards (the four tides) */}
        {s.cards && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:28 }}>
            {s.cards.map(c => (
              <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.color}30`, borderRadius:10, padding:"10px 12px" }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:3 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:c.color }}>{c.label}</span>
                  <span style={{ fontSize:9, color:`${c.color}99` }}>{c.sub}</span>
                </div>
                <div style={{ fontSize:9.5, color:"#888", lineHeight:1.4 }}>{c.note}</div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Dots */}
          <div style={{ display:"flex", gap:5, flex:1 }}>
            {INTRO_SLIDES.map((_, i) => (
              <div key={i} style={{ width: i === slide ? 16 : 6, height:6, borderRadius:3, background: i === slide ? "#1a2a3a" : "#d0cbc3", transition:"width 0.2s" }} />
            ))}
          </div>
          <button onClick={() => isLast ? onDone() : setSlide(s => s + 1)}
            style={{ padding:"9px 22px", borderRadius:10, border:"none", background:"#1a2a3a", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            {isLast ? "Get started" : "Next →"}
          </button>
        </div>

        {isLast && (
          <button onClick={onDone} style={{ marginTop:10, fontSize:11, color:"#bbb", background:"none", border:"none", cursor:"pointer", textAlign:"center" }}>
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────

type OnboardStep = "name" | "birth" | "chronotype" | "done";

function OnboardingModal({ onComplete, existingTesterId, skipNameStep }: {
  onComplete: (name: string) => void;
  existingTesterId?: string | null;
  skipNameStep?: boolean;
}) {
  const { updateChronotype, restoreFromCode } = useTester();
  const [step, setStep] = useState<OnboardStep>(skipNameStep ? "birth" : "name");
  const [name, setName] = useState("");
  // Returning-user path: restore an existing identity from its account key
  // instead of creating a fresh one.
  const [showRestore, setShowRestore] = useState(false);
  const [restoreCode, setRestoreCode] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function handleRestore() {
    if (!restoreCode.trim()) return;
    setRestoring(true);
    setRestoreError(null);
    const result = await restoreFromCode(restoreCode.trim());
    setRestoring(false);
    if (!result.ok) setRestoreError(result.message ?? "Couldn't restore that key.");
    // On success the tester context flips isReady/showModal itself — the app
    // proceeds straight past onboarding with everything back.
  }
  // For new users, we create a testerId on name submit. For existing users, use their real one.
  const [createdTesterId, setCreatedTesterId] = useState<string | null>(existingTesterId ?? null);

  // Birth form state
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [birthLat, setBirthLat] = useState<number | null>(null);
  const [birthLon, setBirthLon] = useState<number | null>(null);
  const [utcOffset, setUtcOffset] = useState<number>(-new Date().getTimezoneOffset() / 60);
  // The geocoder supplies the STANDARD-time offset. Births during daylight
  // saving need +1 or the whole chart shifts by about one house — a silent
  // trap for roughly half of all birthdays. Auto-suggested from birth month +
  // hemisphere; the user can always override.
  const [dstAtBirth, setDstAtBirth] = useState(false);
  const [dstTouched, setDstTouched] = useState(false);

  function suggestDst(dateStr: string, lat: number | null) {
    if (dstTouched || !dateStr || lat == null) return;
    const month = parseInt(dateStr.split("-")[1] ?? "0", 10);
    const northernSummer = month >= 4 && month <= 9 && lat >= 24;
    const southernSummer = (month >= 10 || month <= 3) && lat <= -24;
    setDstAtBirth(northernSummer || southernSummer);
  }
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chronotype form state — a lightweight v1: one weekday window + one weekend
  // window (applied across their respective days), rather than a full 7-day
  // editor. Per-day fine-tuning can be added to Settings later.
  const [chronoProfile, setChronoProfile] = useState<ChronotypeProfile | null>(null);
  const [chronoDescription, setChronoDescription] = useState("");
  const [weekdayStart, setWeekdayStart] = useState("18:00");
  const [weekdayEnd, setWeekdayEnd] = useState("22:00");
  const [weekendStart, setWeekendStart] = useState("09:00");
  const [weekendEnd, setWeekendEnd] = useState("21:00");
  // Solar profile — typical wake/sleep, so the tide chart can shade the
  // user's personal night and best-times can skip sleeping hours.
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");

  function buildFreeWindows(): Record<Weekday, FreeWindow> {
    const weekdayWin: FreeWindow = { start: weekdayStart, end: weekdayEnd, flexibility: "flex" };
    const weekendWin: FreeWindow = { start: weekendStart, end: weekendEnd, flexibility: "flex" };
    return { mon: weekdayWin, tue: weekdayWin, wed: weekdayWin, thu: weekdayWin, fri: weekdayWin, sat: weekendWin, sun: weekendWin };
  }

  function handleChronotypeSubmit(e: React.FormEvent) {
    e.preventDefault();
    onComplete(name.trim() || "Observer");
    if (chronoProfile) {
      updateChronotype({
        profile: chronoProfile,
        description: chronoDescription.trim() || undefined,
        freeWindows: buildFreeWindows(),
        wakeTime, sleepTime,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  function handleChronotypeSkip() {
    onComplete(name.trim() || "Observer");
  }

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim() || "Observer";
    // Generate a temporary testerId to POST natal chart against
    const tid = `obs_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
    setCreatedTesterId(tid);
    // Store in localStorage so TesterProvider picks it up
    localStorage.setItem("obs_tester_id", tid);
    localStorage.setItem("obs_display_name", n);
    setStep("birth");
  }

  async function searchLocation(q: string) {
    if (q.length < 2) { setLocationResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/location-search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      // Backend returns a bare array of LocationResult
      setLocationResults(Array.isArray(data) ? data : (data.results ?? []));
    } catch {
      setLocationResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleLocationInput(v: string) {
    setLocationSearch(v);
    setBirthPlace(v);
    setBirthLat(null); setBirthLon(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchLocation(v), 400);
  }

  function pickLocation(r: any) {
    const label = r.displayName ?? r.formatted ?? r.name ?? locationSearch;
    setBirthPlace(label);
    setBirthLat(r.lat);
    setBirthLon(r.lon);
    setLocationSearch(label);
    setLocationResults([]);
    // Prefer the geocoder's real timezone offset; fall back to a lon-based estimate.
    if (r.utcOffsetStandard != null) setUtcOffset(Math.round(r.utcOffsetStandard));
    else if (r.lon != null) setUtcOffset(Math.round(r.lon / 15));
    suggestDst(birthDate, r.lat ?? null);
  }

  async function saveBirthData() {
    if (!createdTesterId || !birthDate || birthLat == null || birthLon == null) return;
    setSaving(true);
    try {
      await fetch("/api/natal-chart", {
        method: "POST",
        headers: { "x-tester-id": createdTesterId, "Content-Type": "application/json" },
        body: JSON.stringify({
          birthDate,
          birthTime: birthTime || "12:00",
          birthPlace,
          birthLat,
          birthLon,
          utcOffset: utcOffset + (dstAtBirth ? 1 : 0),
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleBirthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (birthDate && birthLat != null) await saveBirthData();
    setStep("chronotype");
  }

  function handleSkip() {
    setStep("chronotype");
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16,
    padding: "36px 36px 32px", maxWidth: 380, width: "100%",
  };

  if (step === "name") return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background: "var(--color-background)", padding:"0 16px" }}>
      <div style={cardStyle}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.5px", color: "var(--color-primary)", marginBottom:6 }}>Tides</div>
          <div style={{ fontSize:13, color:"#888", lineHeight:1.6 }}>Your personal timing companion — lunar cycles, planetary hours, and daily rhythm.</div>
        </div>
        <form onSubmit={handleNameSubmit}>
          <div style={{ fontSize:11, color:"#aaa", marginBottom:6, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Your name</div>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="What should we call you?" autoFocus
            style={{ width:"100%", padding:"10px 13px", borderRadius:9, border:"1px solid var(--color-border)", fontSize:14, marginBottom:16, outline:"none", background: "var(--color-card-2)", boxSizing:"border-box" }}
          />
          <button type="submit" style={{ width:"100%", padding:"11px 0", borderRadius:10, background:"#1a2a3a", color:"#fff", fontSize:13, fontWeight:600, border:"none", cursor:"pointer", letterSpacing:"0.1px" }}>
            Continue →
          </button>
        </form>

        {/* Returning user — restore from account key */}
        {!showRestore ? (
          <button onClick={() => setShowRestore(true)} style={{ width:"100%", marginTop:12, fontSize:11, color:"#8a8278", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
            Been here before? Restore with your account key
          </button>
        ) : (
          <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid var(--color-border)" }}>
            <div style={{ fontSize:10.5, color:"#aaa", marginBottom:6, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Your account key</div>
            <div style={{ display:"flex", gap:8 }}>
              <input
                value={restoreCode} onChange={e => { setRestoreCode(e.target.value); setRestoreError(null); }}
                onKeyDown={e => e.key === "Enter" && handleRestore()}
                placeholder="TIDE-XXXX-XXXX" autoFocus
                style={{ flex:1, padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background:"var(--color-card-2)", letterSpacing:"1px", textTransform:"uppercase" }}
              />
              <button onClick={handleRestore} disabled={restoring || !restoreCode.trim()}
                style={{ padding:"9px 16px", borderRadius:8, border:"none", fontSize:12, fontWeight:600, cursor:"pointer",
                  background: restoreCode.trim() ? "#1a2a3a" : "#e0dcd6", color: restoreCode.trim() ? "#fff" : "#aaa" }}>
                {restoring ? "…" : "Restore"}
              </button>
            </div>
            {restoreError && <div style={{ fontSize:10.5, color:"#a04030", marginTop:6 }}>{restoreError}</div>}
            <div style={{ fontSize:9.5, color:"#bbb", marginTop:6, lineHeight:1.5 }}>
              Your key is in Settings → Account on the device you signed up with.
            </div>
          </div>
        )}

        <div style={{ fontSize:10, color:"#ccc", textAlign:"center", marginTop:16, lineHeight:1.5 }}>
          No password needed — you'll get an account key to bring your data to any device.
        </div>
      </div>
    </div>
  );

  if (step === "birth") return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background: "var(--color-background)", padding:"0 16px", overflowY:"auto" }}>
      <div style={cardStyle}>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:18, fontWeight:700, color: "var(--color-primary)", marginBottom:6 }}>Your birth chart</div>
          <div style={{ fontSize:12, color:"#888", lineHeight:1.65 }}>
            Tides uses your birth data to compute personal transits — showing which planetary cycles are active in <em>your</em> chart right now. This stays private on your device.
          </div>
        </div>

        <form onSubmit={handleBirthSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Birth date */}
          <div>
            <div style={{ fontSize:10.5, color:"#aaa", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Date of birth</div>
            <input type="date" value={birthDate} onChange={e => { setBirthDate(e.target.value); suggestDst(e.target.value, birthLat); }}
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)", boxSizing:"border-box" }}
            />
          </div>

          {/* Birth time */}
          <div>
            <div style={{ fontSize:10.5, color:"#aaa", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>
              Time of birth <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional — needed for Ascendant)</span>
            </div>
            <input type="time" value={birthTime} onChange={e => setBirthTime(e.target.value)}
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)", boxSizing:"border-box" }}
            />
          </div>

          {/* Birth place */}
          <div style={{ position:"relative" }}>
            <div style={{ fontSize:10.5, color:"#aaa", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Place of birth</div>
            <input
              value={locationSearch} onChange={e => handleLocationInput(e.target.value)}
              placeholder="City, country…"
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)", boxSizing:"border-box" }}
            />
            {locationResults.length > 0 && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background: "var(--color-card)", border:"1px solid var(--color-border)", borderRadius:8, boxShadow:"0 4px 16px rgba(0,0,0,0.1)", zIndex:100, marginTop:2, maxHeight:180, overflowY:"auto" }}>
                {locationResults.map((r, i) => (
                  <button key={i} type="button" onClick={() => pickLocation(r)}
                    style={{ display:"block", width:"100%", padding:"9px 13px", textAlign:"left", border:"none", background:"none", cursor:"pointer", fontSize:12, color:"#333", borderBottom:"1px solid var(--color-border)" }}>
                    {r.displayName ?? r.formatted ?? r.name}
                  </button>
                ))}
              </div>
            )}
            {birthLat != null && (
              <div style={{ fontSize:10, color:"#3a6030", marginTop:4 }}>✓ Location set · UTC{utcOffset >= 0 ? "+" : ""}{utcOffset}</div>
            )}
          </div>

          {/* UTC offset fine-tune */}
          {birthLat != null && (
            <div>
              <div style={{ fontSize:10.5, color:"#aaa", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>UTC offset at birth (standard time)</div>
              <select value={utcOffset} onChange={e => setUtcOffset(Number(e.target.value))}
                style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)" }}>
                {Array.from({ length: 27 }, (_, i) => i - 12).map(o => (
                  <option key={o} value={o}>UTC{o >= 0 ? "+" : ""}{o}:00</option>
                ))}
              </select>
              <label style={{ display:"flex", alignItems:"flex-start", gap:8, marginTop:8, cursor:"pointer" }}>
                <input type="checkbox" checked={dstAtBirth}
                  onChange={e => { setDstAtBirth(e.target.checked); setDstTouched(true); }}
                  style={{ marginTop:2, accentColor:"#1a2a3a" }} />
                <span style={{ fontSize:11, color:"#777", lineHeight:1.5 }}>
                  Daylight saving time was in effect <span style={{ color:"#aaa" }}>(adds 1 hour — usually true for spring/summer births in the US & Europe)</span>
                </span>
              </label>
              <div style={{ fontSize:9.5, color:"#b0a898", marginTop:4 }}>
                Chart will use UTC{(utcOffset + (dstAtBirth ? 1 : 0)) >= 0 ? "+" : ""}{utcOffset + (dstAtBirth ? 1 : 0)}:00
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button type="button" onClick={handleSkip}
              style={{ flex:1, padding:"10px 0", borderRadius:10, border:"1px solid var(--color-border)", background: "var(--color-card-2)", color:"#888", fontSize:12, cursor:"pointer", fontWeight:500 }}>
              Skip for now
            </button>
            <button type="submit" disabled={!birthDate || birthLat == null || saving}
              style={{ flex:2, padding:"10px 0", borderRadius:10, border:"none", cursor: (!birthDate || birthLat == null) ? "default" : "pointer", fontSize:13, fontWeight:600,
                background: (!birthDate || birthLat == null) ? "#e0dcd6" : "#1a2a3a",
                color: (!birthDate || birthLat == null) ? "#aaa" : "#fff" }}>
              {saving ? "Saving…" : "Continue →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (step === "chronotype") return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background: "var(--color-background)", padding:"0 16px", overflowY:"auto" }}>
      <div style={cardStyle}>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:18, fontWeight:700, color: "var(--color-primary)", marginBottom:6 }}>Your rhythm</div>
          <div style={{ fontSize:12, color:"#888", lineHeight:1.65 }}>
            When you're usually free and how you naturally run helps Tides suggest timing that actually fits your life, not just the sky.
          </div>
        </div>

        <form onSubmit={handleChronotypeSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Chronotype profile */}
          <div>
            <div style={{ fontSize:10.5, color:"#aaa", marginBottom:6, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Morning or night person?</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {CHRONOTYPE_OPTIONS.map(o => (
                <button key={o.key} type="button" onClick={() => setChronoProfile(o.key)}
                  style={{
                    padding:"9px 10px", borderRadius:9, textAlign:"left", cursor:"pointer",
                    border: chronoProfile === o.key ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
                    background: chronoProfile === o.key ? "#1a2a3a10" : "var(--color-card-2)",
                  }}>
                  <div style={{ fontSize:12, fontWeight:600, color: chronoProfile === o.key ? "#1a2a3a" : "var(--color-foreground)" }}>{o.label}</div>
                  <div style={{ fontSize:9.5, color:"#999", marginTop:1 }}>{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Solar profile — wake/sleep cycle */}
          <div>
            <div style={{ fontSize:10.5, color:"#aaa", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Usually awake</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
              <span style={{ color:"#bbb", fontSize:11 }}>to</span>
              <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
            </div>
            <div style={{ fontSize:9.5, color:"#bbb", marginTop:4, lineHeight:1.4 }}>
              Shapes your tide chart — hours you're asleep are shaded, and timing suggestions skip them.
            </div>
          </div>

          {/* Free windows — weekday + weekend, lightweight v1 */}
          <div>
            <div style={{ fontSize:10.5, color:"#aaa", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Usually free — weekdays</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="time" value={weekdayStart} onChange={e => setWeekdayStart(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
              <span style={{ color:"#bbb", fontSize:11 }}>to</span>
              <input type="time" value={weekdayEnd} onChange={e => setWeekdayEnd(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize:10.5, color:"#aaa", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Usually free — weekends</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="time" value={weekendStart} onChange={e => setWeekendStart(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
              <span style={{ color:"#bbb", fontSize:11 }}>to</span>
              <input type="time" value={weekendEnd} onChange={e => setWeekendEnd(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
            </div>
          </div>

          {/* Optional free-text */}
          <div>
            <div style={{ fontSize:10.5, color:"#aaa", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>
              In your own words <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional)</span>
            </div>
            <input value={chronoDescription} onChange={e => setChronoDescription(e.target.value)}
              placeholder="e.g. dead by 10pm, useless before coffee…"
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)", boxSizing:"border-box" }}
            />
          </div>

          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button type="button" onClick={handleChronotypeSkip}
              style={{ flex:1, padding:"10px 0", borderRadius:10, border:"1px solid var(--color-border)", background: "var(--color-card-2)", color:"#888", fontSize:12, cursor:"pointer", fontWeight:500 }}>
              Skip for now
            </button>
            <button type="submit"
              style={{ flex:2, padding:"10px 0", borderRadius:10, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, background:"#1a2a3a", color:"#fff" }}>
              Enter Tides
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return null;
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function Shell() {
  const { profile, isReady, showModal, createAndApply, lat, lon } = useTester();
  const testerId = profile?.testerId ?? null;
  const [view, setView] = useState<View>("today");
  const [capture, setCapture] = useState(false);
  // Session timer + Advise trigger live in the global top bar so they're always
  // reachable, not just from the Today page. The advisor modal itself still
  // renders inside Today (it needs Today's gcalEvents/weekSummary context), so
  // opening it from elsewhere jumps to Today first.
  const [showAdvisor, setShowAdvisor] = useState(false);

  const { data: now, isError: nowError, refetch: refetchNow } = useTidesNow(testerId, lat, lon);
  const { data: week } = useTidesWeek(14, lat, lon);

  // Check if existing user has natal chart — show birth step if not
  const [showBirthPrompt, setShowBirthPrompt] = useState(false);
  const { data: existingChart, isLoading: chartLoading } = useQuery({
    queryKey: ["natal-chart", testerId],
    queryFn: async () => {
      if (!testerId) return null;
      const r = await fetch("/api/natal-chart", { headers: { "x-tester-id": testerId } });
      if (r.status === 404) return null;
      return r.json();
    },
    enabled: !!testerId && isReady && !showModal,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!chartLoading && existingChart === null && isReady && !showModal) {
      setShowBirthPrompt(true);
    }
  }, [chartLoading, existingChart, isReady, showModal]);

  const [sawIntro, setSawIntro] = useState(() => !!localStorage.getItem("obs_saw_intro"));
  // Hooks must run on every render — keep these above the onboarding early-returns,
  // or the hook count changes when a user crosses from onboarding into the app.
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  if (showModal || !isReady) {
    if (!sawIntro) {
      return <IntroSlides onDone={() => { localStorage.setItem("obs_saw_intro","1"); setSawIntro(true); }} />;
    }
    return <OnboardingModal onComplete={name => createAndApply(name)} />;
  }

  if (showBirthPrompt && !chartLoading) {
    return (
      <OnboardingModal
        existingTesterId={testerId}
        skipNameStep={true}
        onComplete={() => setShowBirthPrompt(false)}
      />
    );
  }

  // Bottom-bar glyphs for the phone layout — the same five views, thumb-reachable.
  const TAB_GLYPHS: Record<string, string> = { today:"◉", calendar:"▦", work:"☰", launch:"▲" };

  return (
    <div style={{display:"flex",height:"100vh",width:"100%",background:"var(--color-background)",overflow:"hidden",flexDirection:"column"}}>
      {nowError && <ApiErrorBanner retry={() => refetchNow()} />}
      {capture && testerId && <QuickCapture testerId={testerId} onClose={() => setCapture(false)} />}

      {/* ── Top bar ── */}
      <div style={{
        display:"flex", alignItems:"center", background:"var(--color-rail)",
        borderBottom:"1px solid var(--color-border)", flexShrink:0, padding: isMobile ? "0 10px" : "0 16px",
      }}>
        {!isMobile && TOP_TABS.map((t, i) => {
          // Divider after the last zoom tab (Now/Ahead/Currents) to separate the
          // time-ladder from the depth (Sky) and content (Life) tabs.
          const prev = TOP_TABS[i - 1];
          const showDivider = prev?.zoom && !t.zoom;
          return (
            <React.Fragment key={t.id}>
              {showDivider && <div style={{ width:1, height:16, background:"var(--color-border)", margin:"0 10px" }} />}
              <button onClick={() => setView(t.id)} title={t.zoom ? "Time view — further ahead →" : undefined} style={{
                padding:"11px 16px", border:"none", background:"none", cursor:"pointer",
                fontSize:12, fontWeight: view===t.id ? 600 : 400,
                color: view===t.id ? "var(--color-primary)" : "var(--color-muted)",
                borderBottom: view===t.id ? "2px solid var(--color-primary)" : "2px solid transparent",
                marginBottom:-1,
              }}>{t.label}</button>
            </React.Fragment>
          );
        })}
        {isMobile && (
          <span style={{ fontSize:13, fontWeight:700, color:"var(--color-primary)", padding:"10px 6px", letterSpacing:"-0.3px" }}>
            {TOP_TABS.find(t => t.id === view)?.label ?? "Settings"}
          </span>
        )}
        <div style={{flex:1}}/>
        {!isMobile && <span style={{fontSize:11,color:"var(--color-muted)",marginRight:12}}>{profile?.displayName}</span>}
        {now?.planetaryHour && (
          <div style={{ marginRight: 8 }}><SessionTimer planetaryHour={now.planetaryHour} /></div>
        )}
        <button
          onClick={() => { setView("today"); setShowAdvisor(true); }}
          style={{
            fontSize: 10, padding: "4px 12px", borderRadius: 8, border: "1px solid #c0bab0",
            background: "var(--color-card)", color: "#4a5a6a", cursor: "pointer", fontWeight: 500, marginRight: 6,
          }}
        >🧭 Compass</button>
        <button onClick={toggleTheme} title={theme === "light" ? "Switch to dark" : "Switch to light"} style={{
          fontSize:12, padding:"4px 9px", borderRadius:6, border:"1px solid var(--color-border)",
          background:"var(--color-card)", color:"var(--color-foreground)", cursor:"pointer", marginRight:6,
        }}>{theme === "light" ? "☾" : "☀"}</button>
        <button onClick={() => setCapture(true)} style={{
          fontSize:10, padding:"4px 11px", borderRadius:6, border:"1px solid var(--color-border)",
          background:"var(--color-card)", color:"var(--color-foreground)", cursor:"pointer", marginRight:6,
        }}>+ task</button>
        <button onClick={() => setView("settings")} style={{
          display:"flex", alignItems:"center", gap:4,
          fontSize:11, padding:"5px 12px", borderRadius:6, border:"none",
          background: view==="settings" ? "var(--color-border)" : "transparent",
          color: view==="settings" ? "var(--color-foreground)" : "var(--color-muted)", cursor:"pointer", marginBottom:-1,
          borderBottom: view==="settings" ? "2px solid var(--color-primary)" : "2px solid transparent",
        }}>{isMobile ? "⚙" : "⚙ Settings"}</button>
      </div>

      {/* ── Content row ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Left sidebar: Rail (desktop only — the hero carries moon/hour on phones) */}
        {!isMobile && (
          <div style={{display:"flex",flexDirection:"column",borderRight:"1px solid var(--color-border)",width:210,minWidth:210,flexShrink:0,background:"var(--color-rail)"}}>
            <Rail now={now} testerId={testerId} lat={lat} lon={lon} onNavigate={(v)=>setView(v as any)} />
          </div>
        )}

        {/* Main content */}
        {view==="today"    && <Today    testerId={testerId} lat={lat} lon={lon} onNavigate={(v)=>setView(v as any)} showAdvisor={showAdvisor} setShowAdvisor={setShowAdvisor}/>}
        {view==="calendar" && (
          <SubTabbed tabs={["Calendar","Almanac","Currents"]}>
            {(a) => a==="Calendar"
              ? <Calendar testerId={testerId} now={now} lat={lat} lon={lon}/>
              : a==="Almanac"
              ? <Sky testerId={testerId} lat={lat} lon={lon}/>
              : <Currents testerId={testerId}/>}
          </SubTabbed>
        )}
        {view==="work"     && <WorkPage testerId={testerId} now={now} lat={lat} lon={lon}/>}
        {view==="launch"   && <Launch   testerId={testerId} lat={lat} lon={lon}/>}
        {view==="settings" && <Settings testerId={testerId}/>}
      </div>

      {/* ── Bottom nav (phone) ── */}
      {isMobile && (
        <div style={{
          display:"flex", flexShrink:0, background:"var(--color-rail)",
          borderTop:"1px solid var(--color-border)",
          paddingBottom:"env(safe-area-inset-bottom)",
        }}>
          {TOP_TABS.map(t => (
            <button key={t.id} onClick={() => setView(t.id)} style={{
              flex:1, padding:"8px 0 7px", border:"none", background:"none", cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              color: view===t.id ? "var(--color-primary)" : "var(--color-muted)",
            }}>
              <span style={{ fontSize:16, lineHeight:1 }}>{TAB_GLYPHS[t.id] ?? "·"}</span>
              <span style={{ fontSize:9, fontWeight: view===t.id ? 700 : 400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  // Register service worker once on mount
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TesterProvider>
          <PreferencesProvider>
            <PremiumProvider>
              <ErrorBoundary>
                <Shell/>
              </ErrorBoundary>
            </PremiumProvider>
          </PreferencesProvider>
        </TesterProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
