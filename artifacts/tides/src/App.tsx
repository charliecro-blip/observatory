import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApiErrorBanner } from "@/components/ApiError";
import { TesterProvider, useTester } from "@/contexts/tester-context";
import { CHRONOTYPE_OPTIONS } from "@/lib/tester-profile";
import type { ChronotypeProfile, Weekday, FreeWindow } from "@/lib/tester-profile";
import { PreferencesProvider } from "@/contexts/preferences-context";
import { setAstroDetail } from "@/lib/preferences";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { PremiumProvider } from "@/contexts/premium-context";
import { useIsMobile, getForceMobile, setForceMobile } from "@/hooks/useIsMobile";
import Rail, { MobileInstruments } from "@/components/Rail";
import SpotlightTour from "@/components/SpotlightTour";
import { tourPending } from "@/lib/tour";
import { applyTextScale } from "@/lib/textScale";
import GuidingStarsHub from "@/pages/GuidingStarsHub";
import BearingsCard from "@/components/BearingsCard";
import { SessionTimer } from "@/components/SessionTimer";
import Today from "@/pages/Today";
import Tasks from "@/pages/Tasks";
import Calendar from "@/pages/Calendar";
import Habits from "@/pages/Habits";
import Launch from "@/pages/Launch";
import Planets from "@/pages/Planets";
import Log from "@/pages/Log";
import Settings from "@/pages/Settings";
import { useTidesNow, useTidesWeek } from "@/hooks/useTides";
import { logEvent } from "@/lib/analytics";
import { ELEMENT_COLORS } from "@/lib/elements";
import { PLANET_COLORS } from "@/lib/planetColors";
import { parseWhen, formatDueChip } from "@/lib/parseWhen";
import { localToday } from "@/lib/dates";
import Home from "@/pages/Home";

type WorkTab = "overview" | "tasks" | "habits";

function WorkPage({ testerId, now, lat, lon, seedElement, onSeedConsumed, focusStarId, onFocusConsumed, onOpenSettings, onLeaveWork }: { testerId: string|null; now: any; lat: number; lon: number; seedElement?: string|null; onSeedConsumed?: ()=>void; focusStarId?: number|null; onFocusConsumed?: ()=>void; onOpenSettings?: ()=>void; onLeaveWork?: (v: string)=>void }) {
  const [tab, setTab] = useState<WorkTab>("overview");
  // Arriving with an element seed (from the Almanac reference) always lands on
  // Guiding Stars, where the pre-filled creation form opens.
  useEffect(() => { if (seedElement) setTab("overview"); }, [seedElement]);
  useEffect(() => { if (focusStarId != null) setTab("overview"); }, [focusStarId]);
  // Guiding Stars leads (the why), then the two daily-doing axes (tasks,
  // habits). Currents (long-cycle context) is now a header at the top.
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
            color: tab===t.id ? "var(--color-foreground)" : "var(--color-muted)",
            borderBottom: tab===t.id ? "2px solid #1a2a3a" : "2px solid transparent",
            marginBottom:-1,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{flex:1, overflow:"auto", display:"flex", flexDirection:"column", padding:"16px 20px"}}>
        {/* Your bearings — where you are in time (year + chapter + landmarks).
            Replaced CurrentsContextHeader (owner 2026-07-27: "locating someone
            in time" is the product; you steer from where you are). */}
        <BearingsCard testerId={testerId} onOpenSettings={onOpenSettings} />

        {/* Tab content — inherits flex from parent, scrollable together with header */}
        {tab==="overview"  && <GuidingStarsHub testerId={testerId} lat={lat} lon={lon} onNavigate={setTab} seedElement={seedElement} onSeedConsumed={onSeedConsumed} focusStarId={focusStarId} onFocusConsumed={onFocusConsumed}/>}
        {tab==="tasks"     && <Tasks    testerId={testerId} now={now} lat={lat} lon={lon}/>}
        {tab==="habits"    && <Habits   testerId={testerId} now={now} lat={lat} lon={lon} onNavigate={onLeaveWork}/>}
      </div>
    </div>
  );
}

// Calendar's slim sub-tab bar — the course ahead (Calendar) and the wake
// behind (Log) share time's home rather than holding top-level tabs.
function SubTabbed({ tabs, children, initial }: { tabs: string[]; children: (active: string) => React.ReactNode; initial?: string }) {
  const [active, setActive] = useState(initial && tabs.includes(initial) ? initial : tabs[0]);
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ display:"flex", borderBottom:"1px solid var(--color-border)", background:"var(--color-rail)", flexShrink:0, padding:"0 20px" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActive(t)} style={{
            padding:"9px 16px", border:"none", background:"none", cursor:"pointer",
            fontSize:12, fontWeight: active===t ? 600 : 400,
            color: active===t ? "var(--color-primary)" : "var(--color-muted)",
            borderBottom: active===t ? "2px solid var(--color-primary)" : "2px solid transparent", marginBottom:-1,
          }}>{t}</button>
        ))}
      </div>
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>{children(active)}</div>
    </div>
  );
}

/**
 * Measured 2026-08-02: a single cold load fired **27 API requests across 20
 * distinct paths**, seven of them duplicated. Production TTFB is ~0.5s on
 * every endpoint — even `/api/healthz`, which does no work — so the cost is
 * per-REQUEST, not per-byte (payloads are already gzipped: the day payload is
 * 9.4 KB on the wire). With ~6 connections per host that's several round-trip
 * waves before the page settles.
 *
 * The client was constructed with no defaults at all, which means React
 * Query's own: `staleTime: 0` (every component that mounts re-fetches, even
 * if an identical query resolved a second ago) and `retry: 3` (a 404 or a 503
 * from an unconfigured integration is attempted four times).
 *
 * These defaults are chosen for data that describes the SKY: it changes on
 * the scale of minutes, so a minute of staleness is invisible to the user and
 * removes a whole class of redundant fetches. Individual queries that need
 * fresher data still override staleTime themselves.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      /**
       * FAIL LOUDLY, NEVER PAUSE SILENTLY.
       *
       * react-query's default `networkMode: "online"` consults its own
       * onlineManager before fetching or retrying; if that reports offline,
       * the query PAUSES — `status: "pending"` indefinitely, `isError` never
       * fires, and every error branch in the app keyed on `isError` becomes
       * unreachable in the one situation it was written for. Home's outage
       * state was measured unreachable this way: `fetchStatus: "paused"`,
       * `failureCount: 1`, spinner forever, while a hand-rolled fetch to the
       * same URL answered 500 in 12ms.
       *
       * "always" lets the fetch run and FAIL, which reaches the error states
       * the app has spent weeks building. This is the house rule — "a failed
       * request stops looking like an empty life" — applied to the transport:
       * a browser that thinks it is offline is a hypothesis, and an actual
       * failed request is the fact. The retry policy below still bounds the
       * cost at one retry.
       */
      networkMode: "always",
      // A 4xx is a fact about the request, not a transient failure — retrying
      // a missing natal chart three more times cannot make it exist. Retry
      // only genuine server/network errors, and only once.
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      // Coming back to the tab shouldn't re-run twenty queries; staleTime
      // already governs when the data is genuinely old enough to refresh.
      refetchOnWindowFocus: false,
    },
    // Mutations pause the same way, and a paused mutation is worse: the user
    // acted, the write is parked, and the ✓ they are waiting for never comes —
    // with no error either. The write-status sprint made every mutation check
    // `r.ok`; that check can only run if the request is allowed to happen.
    mutations: {
      networkMode: "always",
    },
  },
});

type View = "home"|"today"|"calendar"|"work"|"launch"|"planets"|"settings";

// Primary tabs = the loop (owner 2026-07-29: Compass is an enchanted
// productivity app — the nav carries only the daily journey). Today is the
// tide you're in; Calendar is time's whole home (grid + 30-day water strip +
// Log as sub-tab); Aims is where you steer (Guiding Stars → Tasks + Habits);
// Plan is scheduling/electional. Everything else is enchantment content
// reached in context, not by tab: Planets (like Settings) is a destination
// you land on from teachable moments, Log flavor stamps, and the reference
// that lives on it (the Almanac tab is retired; its wave chart moved to
// Calendar, its reference moved to Planets).
// Order mirrors the journey (game plan §8D, owner-ratified 2026-08-01):
// orient → act/schedule → connect to direction → inspect the wider timeline.
// "Stars" over "Aims": the feature is called Guiding Stars everywhere else,
// and one name per concept is the terminology rule (GPT audit §11).
// 2026-08-04: Home leads. The owner's brief was that the homepage becomes a
// dashboard centred on the Compass and the to-do dump, and that Today — which
// had grown "super busy and a little overwhelming" — keeps the narrower job of
// laying the day out in time. Today stays in the nav because it is still the
// place the sky is read; it is no longer the place you land.
const TOP_TABS: {id:View; label:string; zoom?:boolean}[] = [
  {id:"home",     label:"Home"},
  {id:"today",    label:"Today",    zoom:true},
  {id:"launch",   label:"Plan"},
  {id:"work",     label:"Stars"},
  {id:"calendar", label:"Calendar", zoom:true},
];

// Structured election context handed from Auspice's picker into Ask. The
// windows are facts from the deterministic engine; the note is the user's own.
export interface AskElectionContext {
  activity: string;
  note?: string;
  windows: { label: string; tier?: string; why?: string }[];
}

const WINDOW_TYPES = [
  "deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat",
];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",admin:"Admin",
  social:"Social",relationship:"Relationship",recovery:"Recovery",study:"Study",launch:"Launch",retreat:"Retreat",
};

function QuickCapture({ testerId, onClose, onDumpToPlanner }: { testerId: string|null; onClose: () => void; onDumpToPlanner: (text: string) => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [windowType, setWindowType] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // One task per non-empty line, so a single capture can be a whole brain-dump.
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Lines whose parsed date the user has waved off, keyed by the raw text
  // rather than by row index — indices shift as you type above a line, which
  // would silently move a rejection onto someone else's task. Keying by text
  // also means editing a line re-offers the date, which is right: the words
  // changed, so the old refusal no longer refers to anything.
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const today = localToday();

  const parsed = useMemo(() => lines.map(raw => {
    const p = parseWhen(raw, today);
    const off = rejected.has(raw);
    return {
      raw,
      title: off ? raw : p.title,
      dueDate: off ? null : p.dueDate,
      // Kept even when rejected, so the row can offer the date back.
      offered: p.dueDate,
      off,
    };
  }), [text, rejected, today]);

  const dated = parsed.filter(p => p.offered);

  async function addAll() {
    if (lines.length === 0 || !testerId) return;
    setAdding(true);
    setAddError(false);
    try {
      const results = await Promise.all(parsed.map(p => fetch("/api/tasks", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        // `?? undefined` and not `?? null`: the column is nullable and the
        // route spreads the body straight into the insert, so an explicit null
        // and an absent key mean the same thing here — but undefined keeps the
        // payload honest about what the user actually specified.
        body: JSON.stringify({ title: p.title, dueDate: p.dueDate ?? undefined, bestWindowType: windowType || undefined }),
      })));
      // Was unconditional — a mid-list failure silently dropped that task
      // while the modal still closed on "success" (audit P0 #4).
      if (results.some(r => !r.ok)) { setAddError(true); return; }
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    } catch {
      setAddError(true);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999,
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120,
      padding: "120px 16px 16px",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      {/* Was a fixed 440px with no maxWidth — the Add button sat off-screen on
          a 390px phone, making quick capture unusable on mobile (audit P0 #7). */}
      <div style={{
        background: "var(--color-card)", borderRadius: 14, padding: "20px 22px", width: 440, maxWidth: "100%",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid var(--color-border)",
      }}>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>Quick capture</div>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", marginBottom: 10 }}>One thing per line — dump as many as you like. Say when, and it'll be read as a due date.</div>
        <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addAll(); if (e.key === "Escape") onClose(); }}
          placeholder={"reply to the landlord\ngo for a 45 min run\nbrainstorm names for the launch\ncall mom"}
          rows={4}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13.5, lineHeight: 1.6, outline: "none", background: "var(--color-card-2)", marginBottom: 10, resize: "vertical", fontFamily: "inherit", color: "var(--color-foreground)" }}
        />
        {/* Live parse preview. Shows ONLY the lines a date was found in — the
            textarea above already shows everything else, and repeating it would
            turn a small confirmation into a second copy of the input.
            What it must make visible is the part the user can't see coming:
            that some of their words are about to leave the title. */}
        {dated.length > 0 && (
          <div style={{
            marginBottom: 10, padding: "8px 10px", borderRadius: 8,
            background: "var(--color-card-2)", border: "1px solid var(--color-border)",
          }}>
            {dated.map(p => (
              <div key={p.raw} style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.5,
                  color: p.off ? "var(--text-3)" : "var(--text-1)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{p.title}</span>
                <button
                  onClick={() => setRejected(prev => {
                    const next = new Set(prev);
                    if (next.has(p.raw)) next.delete(p.raw); else next.add(p.raw);
                    return next;
                  })}
                  title={p.off ? "Read this as a due date after all" : "Keep these words in the title instead"}
                  style={{
                    flexShrink: 0, padding: "2px 8px", borderRadius: 20, fontSize: 10.5, cursor: "pointer",
                    border: "1px solid var(--color-border)",
                    background: p.off ? "transparent" : "var(--color-card)",
                    color: p.off ? "var(--text-3)" : "var(--text-2)",
                    textDecoration: p.off ? "line-through" : "none",
                    fontFamily: "inherit",
                  }}>
                  {formatDueChip(p.offered!, today)}{p.off ? "" : " ×"}
                </button>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6, lineHeight: 1.5 }}>
              Tap a date to keep those words in the title instead. Or "quote a phrase" to stop it being read at all.
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={windowType} onChange={e => setWindowType(e.target.value)}
            style={{ flex: 1, minWidth: 140, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 11, color: "var(--text-2)", background: "var(--color-card-2)" }}>
            <option value="">Best time: any</option>
            {WINDOW_TYPES.map(t => <option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
          </select>
          {/* Weave capture into scheduling (#15): hand the dump to the Planner,
              which reads each item's nature and finds it a good window. */}
          <button onClick={() => { if (lines.length) { onDumpToPlanner(text); } }} disabled={lines.length === 0}
            title="Send these to the Planner to schedule"
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12, cursor: lines.length ? "pointer" : "default", background: "var(--color-card)", color: lines.length ? "var(--color-foreground)" : "var(--text-3)", fontWeight: 500 }}>
            ✦ Dump &amp; schedule →
          </button>
          <button onClick={addAll} disabled={lines.length === 0 || adding}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500, cursor: lines.length ? "pointer" : "default", background: lines.length ? "#1a2a3a" : "var(--color-border)", color: lines.length ? "#fff" : "var(--text-3)" }}>
            {adding ? "Adding…" : lines.length > 1 ? `Add ${lines.length}` : "Add"}
          </button>
        </div>
        {addError && <div style={{ fontSize: 11, color: "#a03030", marginTop: 8 }}>Some of these didn't save — try again.</div>}
      </div>
    </div>
  );
}

// ── Intro slides ─────────────────────────────────────────────────────────────

// Three slides, one per job (beta pass 2026-08-01, reconciled with the GPT
// audit): what fits now → what you're steering toward → when to do it. The
// old six taught the cosmology before the product — four day-characters, tide
// levels, and a nine-rung nested-rhythms gauge whose compact mode stripped its
// own labels. One slide also still promised the RETIRED felt-rating loop
// ("log how days actually felt — it learns"). Concepts now get taught by the
// spotlight tour on the real dashboard, where they have labels and live data.
const INTRO_SLIDES: {
  glyph: string; glyphColor: string; overline?: string; title: string; body: string;
  visual: "today" | "star" | "plan"; footer?: string;
}[] = [
  {
    glyph: "◐",
    glyphColor: ELEMENT_COLORS.water,
    overline: "A weather report for time",
    title: "Know what fits now.",
    body: "Compass reads the sky around this moment and turns it into a plain suggestion — focus, move, connect, rest, or wait.",
    visual: "today",
  },
  {
    glyph: "✦",
    glyphColor: ELEMENT_COLORS.air,
    title: "Give your time a direction.",
    body: "Name a few Guiding Stars — the longer things you're building. Compass connects today's choices to where you're actually going.",
    visual: "star",
  },
  {
    glyph: "▲",
    glyphColor: ELEMENT_COLORS.earth,
    title: "Plan with the current.",
    body: "Paste a list, or pick something you want to begin. Compass finds the better windows — and tells you when the timing is against it.",
    visual: "plan",
    footer: "Personalized by your rhythm, your calendar, and — optionally — your birth chart.",
  },
];

/** Miniature product compositions for the intro — each slide previews the
 *  real surface it describes, instead of an abstract diagram. */
function IntroVisual({ kind }: { kind: "today" | "star" | "plan" }) {
  const card: React.CSSProperties = {
    background: "var(--color-card-2)", border: "1px solid var(--color-border)",
    borderRadius: 10, padding: "10px 12px", textAlign: "left",
  };
  if (kind === "today") {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: ELEMENT_COLORS.earth }}>Building Tide</span>
          <span style={{ fontSize: 9.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>high · rising</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-2)", margin: "4px 0 8px" }}>Good for patient, constructive work.</div>
        <div style={{ fontSize: 10.5, color: "var(--text-2)", borderTop: "1px solid var(--color-border)", paddingTop: 7 }}>
          <span style={{ color: ELEMENT_COLORS.earth, fontWeight: 600 }}>Next move</span> · Draft the proposal — 9:30–11:00 suits it
        </div>
      </div>
    );
  }
  if (kind === "star") {
    return (
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>✦ Finish the book</div>
        <div style={{ fontSize: 10.5, color: "var(--text-2)", marginTop: 4 }}>Next step · Outline chapter four</div>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>A good stretch for it: Tue 10:30–12:00</div>
      </div>
    );
  }
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 5 }}>
      {[
        ["Write the proposal", "Wednesday morning", "var(--text-2)"],
        ["The hard conversation", "Thursday evening", "var(--text-2)"],
        ["Launch the project", "Avoid this week", "#a03030"],
      ].map(([what, when, color]) => (
        <div key={what} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5 }}>
          <span style={{ color: "var(--text-2)" }}>{what}</span>
          <span style={{ color, fontWeight: when === "Avoid this week" ? 700 : 400, flexShrink: 0 }}>→ {when}</span>
        </div>
      ))}
    </div>
  );
}

function IntroSlides({ onDone }: { onDone: () => void }) {
  const [slide, setSlide] = useState(0);
  const s = INTRO_SLIDES[slide];
  const isLast = slide === INTRO_SLIDES.length - 1;

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background: "var(--color-background)", padding:"0 20px" }}>
      <div style={{ background: "var(--color-card)", border:"1px solid var(--color-border)", borderRadius:18, padding:"36px 32px 28px", maxWidth:380, width:"100%", display:"flex", flexDirection:"column", gap:0 }}>
        {/* Glyph */}
        <div style={{ fontSize:36, color:s.glyphColor, marginBottom:12, textAlign:"center", letterSpacing:4 }}>{s.glyph}</div>

        {/* Overline — the metaphor survives as a whisper, not a slide of its own */}
        {s.overline && <div style={{ fontSize:10, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"1px", textAlign:"center", marginBottom:6 }}>{s.overline}</div>}

        {/* Title */}
        <div style={{ fontSize:20, fontWeight:700, color: "var(--color-primary)", marginBottom:10, textAlign:"center", lineHeight:1.3, letterSpacing:"-0.3px" }}>{s.title}</div>

        {/* Body */}
        <div style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.7, textAlign:"center", marginBottom:16 }}>{s.body}</div>

        {/* The miniature product surface this slide describes */}
        <div style={{ marginBottom: s.footer ? 14 : 26 }}><IntroVisual kind={s.visual} /></div>

        {s.footer && <div style={{ fontSize:10.5, color:"var(--text-3)", textAlign:"center", lineHeight:1.6, marginBottom:20 }}>{s.footer}</div>}

        {/* Navigation */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Dots */}
          <div style={{ display:"flex", gap:5, flex:1 }}>
            {INTRO_SLIDES.map((_, i) => (
              <div key={i} style={{ width: i === slide ? 16 : 6, height:6, borderRadius:3, background: i === slide ? "#1a2a3a" : "var(--color-border)", transition:"width 0.2s" }} />
            ))}
          </div>
          <button onClick={() => isLast ? onDone() : setSlide(s => s + 1)}
            style={{ padding:"9px 22px", borderRadius:10, border:"none", background:"#1a2a3a", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            {isLast ? "See my day" : "Next →"}
          </button>
        </div>

        {/* Skip is available from slide one — a low-attention/skeptic user
            (persona study) shouldn't have to tap through the slides first. */}
        {!isLast && (
          <button onClick={() => { logEvent("onboard_intro_skipped"); onDone(); }} style={{ marginTop:10, fontSize:11, color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", textAlign:"center", width:"100%" }}>
            Skip intro →
          </button>
        )}

        {/* Returning users shouldn't have to sit through a pitch for a product
            they already use — one tap lands on the restore button. */}
        <button onClick={() => { logEvent("onboard_skip_to_restore"); onDone(); }} style={{ marginTop: isLast ? 10 : 4, fontSize:10.5, color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", textAlign:"center", width:"100%", textDecoration:"underline", textUnderlineOffset:2 }}>
          Been here before? Restore your account
        </button>
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
  // How much astrology to show — the intake question (owner 2026-07-22). Writes
  // straight to preferences so the provider (mounted after onboarding) picks it
  // up. Default "medium" is the friendlier middle for the glaze-over majority.
  const [astroDetail, setAstroDetailState] = useState<"minimal" | "medium" | "full">("medium");
  const chooseAstroDetail = (lvl: "minimal" | "medium" | "full") => { logEvent("onboard_astro_detail", { level: lvl }); setAstroDetailState(lvl); setAstroDetail(lvl); };
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
  // "I don't know my birth time" — computes a planets-only "timeless" chart
  // instead of inventing an Ascendant/houses off a noon guess.
  const [timeUnknown, setTimeUnknown] = useState(false);
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
  const [birthSaveError, setBirthSaveError] = useState(false);
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
  // The exact times / free windows / description are fine-tuning behind a
  // disclosure — picking a rhythm group already answers the question.
  const [chronoDetail, setChronoDetail] = useState(false);

  function buildFreeWindows(): Record<Weekday, FreeWindow> {
    const weekdayWin: FreeWindow = { start: weekdayStart, end: weekdayEnd, flexibility: "flex" };
    const weekendWin: FreeWindow = { start: weekendStart, end: weekendEnd, flexibility: "flex" };
    return { mon: weekdayWin, tue: weekdayWin, wed: weekdayWin, thu: weekdayWin, fri: weekdayWin, sat: weekendWin, sun: weekendWin };
  }

  function handleChronotypeSubmit(e: React.FormEvent) {
    e.preventDefault();
    onComplete(name.trim() || "Observer");
    // Submitting without picking a group used to save NOTHING — the same hole
    // as skipping. Store the defaults instead, flagged `assumed` so the app
    // never treats its own guess as the user's word (this is what keeps the
    // dead-of-night floor in force for them).
    updateChronotype({
      profile: chronoProfile ?? "steady",
      description: chronoDescription.trim() || undefined,
      freeWindows: buildFreeWindows(),
      wakeTime, sleepTime,
      ...(chronoProfile ? {} : { assumed: true as const }),
      updatedAt: new Date().toISOString(),
    });
  }

  // Skipping keeps the FORM'S DEFAULTS (07:00–23:00) rather than storing
  // nothing. Chronotype is load-bearing — ritual timing, the planner's waking
  // hours, and the sleep shading on the tide chart all read it — and with no
  // record at all `sleepIntervals` returns [], so the planner will happily
  // propose a 3am window. A typical rhythm is a far better prior than none,
  // and Settings still owns the real answer whenever they want to give it.
  function handleChronotypeSkip() {
    onComplete(name.trim() || "Observer");
    updateChronotype({
      profile: chronoProfile ?? "steady",
      freeWindows: buildFreeWindows(),
      wakeTime, sleepTime,
      assumed: true,   // not user-stated — never present this as their answer
      updatedAt: new Date().toISOString(),
    });
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

  // Was: fire-and-forget — a 429/500 here meant the person finished onboarding
  // believing their chart was saved, and every reading afterward silently said
  // "add your birth details" with no clue why (audit P0 #2). Now returns
  // success so the caller can block advancing and say so.
  async function saveBirthData(): Promise<boolean> {
    if (!createdTesterId || !birthDate || birthLat == null || birthLon == null) return false;
    setSaving(true);
    setBirthSaveError(false);
    try {
      const r = await fetch("/api/natal-chart", {
        method: "POST",
        headers: { "x-tester-id": createdTesterId, "Content-Type": "application/json" },
        body: JSON.stringify({
          birthDate,
          birthTime: timeUnknown ? "12:00" : (birthTime || "12:00"),
          birthPlace,
          birthLat,
          birthLon,
          utcOffset: utcOffset + (!timeUnknown && dstAtBirth ? 1 : 0),
          timeKnown: !timeUnknown && !!birthTime,
        }),
      });
      if (!r.ok) { setBirthSaveError(true); return false; }
      return true;
    } catch {
      setBirthSaveError(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleBirthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (birthDate && birthLat != null) {
      const ok = await saveBirthData();
      if (!ok) return; // stay on this step — don't advance past a save that didn't happen
    }
    logEvent("onboard_chart_added");
    setStep("chronotype");
  }

  function handleSkip() {
    // "Show me today →" skips the CHART, not the rhythm. It used to exit
    // onboarding entirely — which meant the chartless user (the one who most
    // needs behaviour-personalization) was exactly the one who never got asked
    // for wake/sleep, and rituals, re-homing and planner hours all fell back
    // to wall-clock guesses. Chronotype has its own skip; nobody is gated.
    //
    // The flag matters: the shell re-prompts for a chart whenever there is no
    // natal row AND no record of declining. Without it, skipping the chart
    // then finishing the rhythm step bounced straight back to the birth form
    // — an onboarding loop (caught live, first browser run of this change).
    localStorage.setItem("obs_birth_skipped", "1");
    logEvent("onboard_chart_skipped");
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
          <div style={{ fontSize:36, fontWeight:400, fontFamily:"var(--font-display)", letterSpacing:"0.01em", color: "var(--color-primary)", marginBottom:6 }}>Compass</div>
          <div style={{ fontSize:13, color:"var(--color-muted)", lineHeight:1.6 }}>Move with time — sky-timed planning that reads the day before you plan it.</div>
        </div>
        <form onSubmit={handleNameSubmit}>
          <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:6, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Your name</div>
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
          <button onClick={() => setShowRestore(true)} style={{ width:"100%", marginTop:12, fontSize:11, color:"var(--color-muted)", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
            Been here before? Restore with your account key
          </button>
        ) : (
          <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid var(--color-border)" }}>
            <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:6, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Your account key</div>
            <div style={{ display:"flex", gap:8 }}>
              <input
                value={restoreCode} onChange={e => { setRestoreCode(e.target.value); setRestoreError(null); }}
                onKeyDown={e => e.key === "Enter" && handleRestore()}
                placeholder="TIDE-XXXX-XXXX" autoFocus
                style={{ flex:1, padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background:"var(--color-card-2)", letterSpacing:"1px", textTransform:"uppercase" }}
              />
              <button onClick={handleRestore} disabled={restoring || !restoreCode.trim()}
                style={{ padding:"9px 16px", borderRadius:8, border:"none", fontSize:12, fontWeight:600, cursor:"pointer",
                  background: restoreCode.trim() ? "#1a2a3a" : "var(--color-border)", color: restoreCode.trim() ? "#fff" : "var(--text-3)" }}>
                {restoring ? "…" : "Restore"}
              </button>
            </div>
            {restoreError && <div style={{ fontSize:10.5, color:"#a04030", marginTop:6 }}>{restoreError}</div>}
            <div style={{ fontSize:9.5, color:"var(--text-3)", marginTop:6, lineHeight:1.5 }}>
              Your key is in Settings → Account on the device you signed up with.
            </div>
          </div>
        )}

        <div style={{ fontSize:10, color:"var(--text-3)", textAlign:"center", marginTop:16, lineHeight:1.5 }}>
          No password needed — you'll get an account key to bring your data to any device.
        </div>
      </div>
    </div>
  );

  if (step === "birth") return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background: "var(--color-background)", padding:"0 16px", overflowY:"auto" }}>
      <div style={cardStyle}>
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:18, fontWeight:700, color: "var(--color-primary)", marginBottom:6 }}>Your daily sky is ready ☾</div>
          <div style={{ fontSize:12, color:"var(--color-muted)", lineHeight:1.65 }}>
            You can jump in and read today right now. Adding your birth chart means the timing gets read from <em>your</em> own chart — the "great" times, your personal cycles. Optional, kept private to your account, and easy to add later.
          </div>
        </div>

        {/* Astro-detail intake — how much astrology to show. Same engine at every
            level; only what's on screen changes (owner: reduce the jargon that
            makes most people's eyes glaze over). */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:6, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>How much astrology do you want to see?</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7 }}>
            {([
              { key: "minimal", label: "Just the guidance", desc: "Plain language. What to do and when — no jargon." },
              { key: "medium",  label: "A little sky",       desc: "The moon and the day's character, kept simple." },
              { key: "full",    label: "The full chart",     desc: "Everything — glyphs, aspects, transits." },
            ] as const).map(o => (
              <button key={o.key} type="button" onClick={() => chooseAstroDetail(o.key)}
                style={{
                  padding:"9px 9px", borderRadius:9, textAlign:"left", cursor:"pointer",
                  border: astroDetail === o.key ? "1.5px solid var(--color-meridian, #3b3f8f)" : "1px solid var(--color-border)",
                  background: astroDetail === o.key ? "color-mix(in srgb, var(--color-meridian, #3b3f8f) 8%, transparent)" : "var(--color-card-2)",
                }}>
                <div style={{ fontSize:11.5, fontWeight:600, color: astroDetail === o.key ? "var(--color-meridian, #3b3f8f)" : "var(--color-foreground)" }}>{o.label}</div>
                <div style={{ fontSize:9, color:"var(--text-3)", marginTop:2, lineHeight:1.4 }}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleBirthSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Birth date */}
          <div>
            <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Date of birth</div>
            <input type="date" value={birthDate} onChange={e => { setBirthDate(e.target.value); suggestDst(e.target.value, birthLat); }}
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)", boxSizing:"border-box" }}
            />
          </div>

          {/* Birth time */}
          <div>
            <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>
              Time of birth <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>(needed for your rising sign & houses)</span>
            </div>
            <input type="time" value={birthTime} disabled={timeUnknown} onChange={e => setBirthTime(e.target.value)}
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)", boxSizing:"border-box", opacity: timeUnknown ? 0.45 : 1 }}
            />
            <label style={{ display:"flex", alignItems:"flex-start", gap:8, marginTop:7, cursor:"pointer" }}>
              <input type="checkbox" checked={timeUnknown}
                onChange={e => setTimeUnknown(e.target.checked)}
                style={{ marginTop:2, accentColor:"#1a2a3a" }} />
              <span style={{ fontSize:11, color:"var(--color-muted)", lineHeight:1.5 }}>
                I don't know my birth time <span style={{ color:"var(--text-3)" }}>— you'll get a chart from your planets and signs; your rising sign, houses, and long cycles need a birth time, so they stay empty until you add one.</span>
              </span>
            </label>
          </div>

          {/* Birth place */}
          <div style={{ position:"relative" }}>
            <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Place of birth</div>
            <input
              value={locationSearch} onChange={e => handleLocationInput(e.target.value)}
              placeholder="City, country…"
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)", boxSizing:"border-box" }}
            />
            {locationResults.length > 0 && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background: "var(--color-card)", border:"1px solid var(--color-border)", borderRadius:8, boxShadow:"0 4px 16px rgba(0,0,0,0.1)", zIndex:100, marginTop:2, maxHeight:180, overflowY:"auto" }}>
                {locationResults.map((r, i) => (
                  <button key={i} type="button" onClick={() => pickLocation(r)}
                    style={{ display:"block", width:"100%", padding:"9px 13px", textAlign:"left", border:"none", background:"none", cursor:"pointer", fontSize:12, color:"var(--text-1)", borderBottom:"1px solid var(--color-border)" }}>
                    {r.displayName ?? r.formatted ?? r.name}
                  </button>
                ))}
              </div>
            )}
            {birthLat != null && (
              <div style={{ fontSize:10, color:ELEMENT_COLORS.earth, marginTop:4 }}>✓ Location set · UTC{utcOffset >= 0 ? "+" : ""}{utcOffset}</div>
            )}
          </div>

          {/* UTC offset fine-tune */}
          {birthLat != null && (
            <div>
              <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>UTC offset at birth (standard time)</div>
              <select value={utcOffset} onChange={e => setUtcOffset(Number(e.target.value))}
                style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)" }}>
                {Array.from({ length: 27 }, (_, i) => i - 12).map(o => (
                  <option key={o} value={o}>UTC{o >= 0 ? "+" : ""}{o}:00</option>
                ))}
              </select>
              {/* DST only matters when we know the time-of-day. Hidden for a
                  timeless chart (which is computed at noon). */}
              {!timeUnknown && (
                <label style={{ display:"flex", alignItems:"flex-start", gap:8, marginTop:8, cursor:"pointer" }}>
                  <input type="checkbox" checked={dstAtBirth}
                    onChange={e => { setDstAtBirth(e.target.checked); setDstTouched(true); }}
                    style={{ marginTop:2, accentColor:"#1a2a3a" }} />
                  <span style={{ fontSize:11, color:"var(--color-muted)", lineHeight:1.5 }}>
                    Daylight saving time was in effect <span style={{ color:"var(--text-3)" }}>(adds 1 hour — usually true for spring/summer births in the US & Europe)</span>
                  </span>
                </label>
              )}
              {!timeUnknown && (
                <div style={{ fontSize:9.5, color:"var(--color-muted)", marginTop:4 }}>
                  Chart will use UTC{(utcOffset + (dstAtBirth ? 1 : 0)) >= 0 ? "+" : ""}{utcOffset + (dstAtBirth ? 1 : 0)}:00
                </div>
              )}
            </div>
          )}

          {birthSaveError && (
            <div style={{ fontSize:11, color:"#a03030", background:"#fdf0ec", border:"1px solid #e8c8c0", borderRadius:8, padding:"8px 12px", marginTop:4 }}>
              Couldn't save your chart — check your connection and try again.
            </div>
          )}
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            {/* Explore-first is a co-equal path (persona study: the birth-data
                wall costs the growth + skeptic audiences before they see value). */}
            <button type="button" onClick={handleSkip}
              style={{ flex:1, padding:"10px 0", borderRadius:10, border:"1px solid #1a2a3a", background: "var(--color-card)", color:"var(--color-foreground)", fontSize:12.5, cursor:"pointer", fontWeight:600 }}>
              Show me today →
            </button>
            <button type="submit" disabled={!birthDate || birthLat == null || saving}
              style={{ flex:1, padding:"10px 0", borderRadius:10, border:"none", cursor: (!birthDate || birthLat == null) ? "default" : "pointer", fontSize:12.5, fontWeight:600,
                background: (!birthDate || birthLat == null) ? "var(--color-border)" : ELEMENT_COLORS.earth,
                color: (!birthDate || birthLat == null) ? "var(--text-3)" : "#fff" }}>
              {saving ? "Saving…" : "Add my chart"}
            </button>
          </div>
          <div style={{ fontSize:10, color:"var(--color-muted)", marginTop:8, textAlign:"center" }}>
            You can add or edit your chart anytime in Settings.
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
          <div style={{ fontSize:12, color:"var(--color-muted)", lineHeight:1.65 }}>
            When you're usually free and how you naturally run helps Compass suggest timing that actually fits your life, not just the sky.
          </div>
        </div>

        <form onSubmit={handleChronotypeSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* ONE question. Each group carries its own hours, so picking one is
              a complete answer — the exact times and free windows below are
              fine-tuning, not more of the interview. This step used to ask
              five things (profile, wake/sleep, weekday free, weekend free, a
              description) before anyone had seen the app do anything. */}
          <div>
            <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:7, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>When are you usually up?</div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {CHRONOTYPE_OPTIONS.map(o => {
                const on = chronoProfile === o.key;
                return (
                  <button key={o.key} type="button"
                    onClick={() => { setChronoProfile(o.key); setWakeTime(o.wake); setSleepTime(o.sleep); }}
                    style={{
                      padding:"10px 12px", borderRadius:9, textAlign:"left", cursor:"pointer",
                      display:"flex", alignItems:"baseline", gap:9,
                      border: on ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
                      background: on ? "#1a2a3a10" : "var(--color-card-2)",
                    }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12.5, fontWeight:600, color:"var(--color-foreground)" }}>{o.label}</div>
                      <div style={{ fontSize:10, color:"var(--text-3)", marginTop:1 }}>{o.desc}</div>
                    </div>
                    {/* Show the hours the choice means — no hidden assumptions. */}
                    <span style={{ fontSize:10, color: on ? "var(--color-primary)" : "var(--text-3)", flexShrink:0, fontVariantNumeric:"tabular-nums" }}>
                      {fmtHour12(o.wake)}–{fmtHour12(o.sleep)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={() => setChronoDetail(v => !v)} style={{
            alignSelf:"flex-start", background:"none", border:"none", cursor:"pointer", padding:0,
            fontSize:10.5, color:"var(--text-3)", display:"flex", alignItems:"center", gap:5,
          }}>
            <span style={{ fontSize:8, display:"inline-block", transform: chronoDetail ? "rotate(180deg)" : "none" }}>▾</span>
            Fine-tune the hours
          </button>

          {chronoDetail && (<>
          {/* Solar profile — wake/sleep cycle */}
          <div>
            <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Usually awake</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
              <span style={{ color:"var(--text-3)", fontSize:11 }}>to</span>
              <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
            </div>
            <div style={{ fontSize:9.5, color:"var(--text-3)", marginTop:4, lineHeight:1.4 }}>
              Shapes your tide chart — hours you're asleep are shaded, and timing suggestions skip them.
            </div>
          </div>

          {/* Free windows — weekday + weekend, lightweight v1 */}
          <div>
            <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Usually free — weekdays</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="time" value={weekdayStart} onChange={e => setWeekdayStart(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
              <span style={{ color:"var(--text-3)", fontSize:11 }}>to</span>
              <input type="time" value={weekdayEnd} onChange={e => setWeekdayEnd(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>Usually free — weekends</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="time" value={weekendStart} onChange={e => setWeekendStart(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
              <span style={{ color:"var(--text-3)", fontSize:11 }}>to</span>
              <input type="time" value={weekendEnd} onChange={e => setWeekendEnd(e.target.value)}
                style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:12.5, outline:"none", background: "var(--color-card-2)" }} />
            </div>
          </div>

          {/* Optional free-text */}
          <div>
            <div style={{ fontSize:10.5, color:"var(--text-3)", marginBottom:5, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>
              In your own words <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional)</span>
            </div>
            <input value={chronoDescription} onChange={e => setChronoDescription(e.target.value)}
              placeholder="e.g. dead by 10pm, useless before coffee…"
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--color-border)", fontSize:13, outline:"none", background: "var(--color-card-2)", boxSizing:"border-box" }}
            />
          </div>
          </>)}

          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button type="button" onClick={handleChronotypeSkip}
              style={{ flex:1, padding:"10px 0", borderRadius:10, border:"1px solid var(--color-border)", background: "var(--color-card-2)", color:"var(--color-muted)", fontSize:12, cursor:"pointer", fontWeight:500 }}>
              Skip for now
            </button>
            <button type="submit"
              style={{ flex:2, padding:"10px 0", borderRadius:10, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, background:"#1a2a3a", color:"#fff" }}>
              Enter Compass
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return null;
}

/** "06:00" → "6am", "00:30" → "12:30am". The rhythm groups show the hours they
 *  mean, and 24h strings are the wrong register for a first-run question. */
function fmtHour12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function Shell() {
  const { profile, isReady, showModal, createAndApply, lat, lon } = useTester();
  const testerId = profile?.testerId ?? null;
  const [view, setView] = useState<View>("home");
  // The Log lives inside Calendar now (owner 2026-07-29): time's home, both
  // directions — the course ahead, the wake behind. This seed deep-links it.
  const [calendarSeed, setCalendarSeed] = useState<string | null>(null);
  // The nav is just the loop — TOP_TABS carries all four core tabs, so the
  // old essential-density "⋯" reveal (which held Log and Planets) is gone.
  const navTabs = TOP_TABS;
  // Usage analytics: which surface is being used (owner 2026-07-20).
  useEffect(() => { logEvent("view", { view }); }, [view]);
  const [capture, setCapture] = useState(false);

  // First-run spotlight tour. Armed only when (a) this account has no verdict
  // on the current tour version and (b) the hero anchor is genuinely in the
  // DOM — the tour's missing-anchor safety would otherwise auto-advance
  // through every step against a still-loading page and record a completion
  // the user never saw.
  const [tourArmed, setTourArmed] = useState(false);
  useEffect(() => {
    if (!testerId || view !== "today" || tourArmed || !tourPending(testerId)) return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (document.querySelector('[data-tour="today-hero"]')) { setTourArmed(true); clearInterval(t); }
      else if (tries > 40) clearInterval(t); // data never arrived — offer again next visit
    }, 500);
    return () => clearInterval(t);
  }, [testerId, view, tourArmed]);
  // "The first session is still happening" — true from the moment an account
  // lands on Today until it completes or skips the walkthrough. Today uses it
  // to hold back its self-promoting banners (push opt-in, premium discovery):
  // a first screen should be the day, not three asks stacked over it. Reads
  // fresh on every render, and the tour's own onDone re-renders App, so it
  // flips the moment the walkthrough resolves.
  const firstRun = tourArmed || tourPending(testerId);
  // Session timer + Advise trigger live in the global top bar so they're always
  // reachable, not just from the Today page. The advisor modal itself still
  // renders inside Today (it needs Today's gcalEvents/weekSummary context), so
  // opening it from elsewhere jumps to Today first.
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [advisorSeed, setAdvisorSeed] = useState<string | null>(null);
  // Structured context that rides into Ask alongside the seed message — the
  // Auspice engine's real candidate windows + the user's own note. Ask treats
  // the windows as given facts (see /api/advise electionContext).
  const [askContext, setAskContext] = useState<AskElectionContext | null>(null);
  const askCompass = (seed: string) => { setAskContext(null); setAdvisorSeed(seed); setView("today"); setShowAdvisor(true); };
  const askAboutElection = (ctx: AskElectionContext, seed: string) => {
    setAskContext(ctx); setAdvisorSeed(seed); setView("today"); setShowAdvisor(true);
  };
  // Teachable-moment deep link: "today feels saturnine" on Today → Star Base
  // opens on that planet's page.
  const [visitPlanet, setVisitPlanet] = useState<string | null>(null);
  const goToPlanet = (planet: string) => { setVisitPlanet(planet); setView("planets"); };
  // "Set a Guiding Star in this element" from the Almanac reference (#25):
  // seed the element, jump to Aims, let GuidingStarsHub open its form pre-filled.
  const [starSeedElement, setStarSeedElement] = useState<string | null>(null);
  const startStarInElement = (element: string) => { setStarSeedElement(element); setView("work"); };
  // Morning glance deep-link: tap a star row on Today → that star's game plan
  // in Aims, scrolled into view and briefly highlighted.
  const [focusStarId, setFocusStarId] = useState<number | null>(null);
  const openStar = (goalId: number) => { setFocusStarId(goalId); setView("work"); };
  // Quick-capture "dump & schedule" (#15): hand the raw list to the Plan tab's
  // Planner, which parses and weaves it into good windows.
  const [plannerSeed, setPlannerSeed] = useState<string | null>(null);
  const dumpToPlanner = (text: string) => { setPlannerSeed(text); setCapture(false); setView("launch"); };

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
    // "Skip for now" is remembered — without the flag this re-armed on every
    // load for anyone without a chart, re-onboarding them each visit. Birth
    // data stays one tap away in Settings.
    if (!chartLoading && existingChart === null && isReady && !showModal
        && !localStorage.getItem("obs_birth_skipped")) {
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
    return <OnboardingModal onComplete={name => {
      const p = createAndApply(name);
      // Seed the two starter dailies so the first screen isn't empty. Server-
      // side and idempotent (only into an account with zero habits), and
      // fire-and-forget — a failed seed must never block someone from getting
      // into the app they just signed up for.
      fetch("/api/habits/seed-starters", { method: "POST", headers: { "x-tester-id": p.testerId } }).catch(() => {});
    }} />;
  }

  if (showBirthPrompt && !chartLoading) {
    return (
      <OnboardingModal
        existingTesterId={testerId}
        skipNameStep={true}
        onComplete={() => { localStorage.setItem("obs_birth_skipped", "1"); setShowBirthPrompt(false); }}
      />
    );
  }

  // Bottom-bar glyphs for the phone layout — the four loop tabs, thumb-reachable.
  const TAB_GLYPHS: Record<string, string> = { today:"◉", calendar:"▦", work:"✦", launch:"▲" };

  return (
    <div style={{
      display:"flex",height:"calc(100dvh / var(--app-zoom, 1))",
      // Mobile preview on desktop: the forced-mobile layout renders in a
      // centered 390px phone frame so the one-page-at-a-time pacing is
      // reviewable from a desk.
      width: (getForceMobile() && window.matchMedia("(min-width: 769px)").matches) ? 390 : "100%",
      margin: (getForceMobile() && window.matchMedia("(min-width: 769px)").matches) ? "0 auto" : undefined,
      boxShadow: (getForceMobile() && window.matchMedia("(min-width: 769px)").matches) ? "0 0 0 1px var(--color-border), 0 12px 48px rgba(0,0,0,0.25)" : undefined,
      background:"var(--color-background)",overflow:"hidden",flexDirection:"column"}}>
      {nowError && <ApiErrorBanner retry={() => refetchNow()} />}
      {capture && testerId && <QuickCapture testerId={testerId} onClose={() => setCapture(false)} onDumpToPlanner={dumpToPlanner} />}
      {/* First-run spotlight tour — the walkthrough over the real interface.
          Armed only once the hero exists in the DOM (see effect), so the
          missing-anchor auto-advance can't burn through every step against an
          empty page and mark itself complete before the data arrives. */}
      {tourArmed && <SpotlightTour testerId={testerId} onDone={() => setTourArmed(false)} onFinalCta={() => setView("work")} />}

      {/* ── Top bar ── */}
      <div data-tour={isMobile ? undefined : "nav-tabs"} style={{
        display:"flex", alignItems:"center", background:"var(--color-rail)",
        borderBottom:"1px solid var(--color-border)", flexShrink:0, padding: isMobile ? "0 10px" : "0 16px",
      }}>
        {!isMobile && navTabs.map((t, i) => {
          // Divider after the last zoom tab (Now/Ahead/Currents) to separate the
          // time-ladder from the depth (Sky) and content (Life) tabs.
          const prev = navTabs[i - 1];
          const showDivider = prev?.zoom && !t.zoom;
          return (
            <React.Fragment key={t.id}>
              {showDivider && <div style={{ width:1, height:16, background:"var(--color-border)", margin:"0 10px" }} />}
              <button data-tour={t.id === "launch" ? "nav-plan" : undefined} onClick={() => { if (t.id === "calendar") setCalendarSeed(null); setView(t.id); }} title={t.zoom ? "Time view — further ahead →" : undefined} style={{
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
            {TOP_TABS.find(t => t.id === view)?.label ?? (view === "planets" ? "Planets" : "Settings")}
          </span>
        )}
        <div style={{flex:1}}/>
        {!isMobile && <span style={{fontSize:11,color:"var(--color-muted)",marginRight:12}}>{profile?.displayName}</span>}
        {now?.planetaryHour && (
          <div style={{ marginRight: 8 }}><SessionTimer planetaryHour={now.planetaryHour} /></div>
        )}
        <button
          onClick={() => { setAskContext(null); setAdvisorSeed(null); setView("today"); setShowAdvisor(true); }}
          style={{
            fontSize: 10, padding: "4px 12px", borderRadius: 8, border: "1px solid #c0bab0",
            background: "var(--color-card)", color: "var(--text-2)", cursor: "pointer", fontWeight: 500, marginRight: 6,
          }}
        >✦ Ask</button>
        {/* + task keeps its border. It is an ACTION, and it and Ask are the two
            controls a person actually reaches for. */}
        <button onClick={() => setCapture(true)} style={{
          fontSize:10, padding:"4px 11px", borderRadius:8, border:"1px solid #c0bab0",
          background:"var(--color-card)", color:"var(--text-2)", cursor:"pointer",
          fontWeight:500, marginRight:10,
        }}>+ task</button>

        {/* UTILITIES, visually quieted.
            Six controls with identical borders and backgrounds competed with
            the page — the mobile-layout preview carried the same weight as Ask.
            These three are things you touch rarely and never as the point of
            opening the app, so they lose their chrome and keep their function. */}
        {window.matchMedia("(min-width: 769px)").matches && (
          <button onClick={() => setForceMobile(!getForceMobile())}
            aria-label={getForceMobile() ? "Back to desktop layout" : "Preview the mobile layout"}
            title={getForceMobile() ? "Back to desktop layout" : "Preview the mobile layout"} style={{
            fontSize:11, padding:"4px 6px", borderRadius:6, border:"none",
            background: getForceMobile() ? "var(--color-border)" : "transparent",
            color:"var(--text-3)", cursor:"pointer", opacity: getForceMobile() ? 1 : 0.72,
          }}>📱</button>
        )}
        <button onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark" : "Switch to light"}
          title={theme === "light" ? "Switch to dark" : "Switch to light"} style={{
          fontSize:12, padding:"4px 6px", borderRadius:6, border:"none",
          background:"transparent", color:"var(--text-3)", cursor:"pointer", opacity:0.72,
        }}>{theme === "light" ? "☾" : "☀"}</button>
        <button onClick={() => setView("settings")} style={{
          display:"flex", alignItems:"center", gap:4,
          fontSize:11, padding:"5px 9px", borderRadius:6, border:"none",
          background: view==="settings" ? "var(--color-border)" : "transparent",
          color: view==="settings" ? "var(--color-foreground)" : "var(--text-3)", cursor:"pointer", marginBottom:-1,
          opacity: view==="settings" ? 1 : 0.72,
          borderBottom: view==="settings" ? "2px solid var(--color-primary)" : "2px solid transparent",
        }}>{isMobile ? "⚙" : "⚙ Settings"}</button>
      </div>

      {/* Mobile instrument strip — the rail's sky ladder as a horizontal glyph
          row on phones (which don't get the rail). Sky-facing views only. */}
      {isMobile && (view==="today" || view==="calendar") && <MobileInstruments now={now} />}

      {/* ── Content row ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Left sidebar: Rail (desktop only — the hero carries moon/hour on phones) */}
        {!isMobile && (
          <div style={{display:"flex",flexDirection:"column",borderRight:"1px solid var(--color-border)",width:210,minWidth:210,flexShrink:0,background:"var(--color-rail)"}}>
            <Rail now={now} testerId={testerId} lat={lat} lon={lon} onNavigate={(v)=>setView(v as any)} />
          </div>
        )}

        {/* Main content */}
        {view==="home"     && <Home     testerId={testerId} lat={lat} lon={lon} onNavigate={(v)=>{ if (v === "log") { setCalendarSeed("Log"); setView("calendar"); } else setView(v as View); }} onAskAboutElection={askAboutElection} onQuickCapture={()=>setCapture(true)}/>}
        {view==="today"    && <Today    testerId={testerId} lat={lat} lon={lon} onNavigate={(v)=>{ if (v === "log") { setCalendarSeed("Log"); setView("calendar"); } else setView(v as View); }} showAdvisor={showAdvisor} setShowAdvisor={setShowAdvisor} advisorSeed={advisorSeed} askContext={askContext} onOpenStar={openStar} firstRun={firstRun}/>}
        {view==="calendar" && (
          <SubTabbed key={calendarSeed ?? "default"} tabs={["Calendar","Log"]} initial={calendarSeed ?? undefined}>
            {(a) => a==="Log"
              ? <Log testerId={testerId} onVisitPlanet={goToPlanet}/>
              : <Calendar testerId={testerId} now={now} lat={lat} lon={lon}/>}
          </SubTabbed>
        )}
        {view==="work"     && <WorkPage testerId={testerId} now={now} lat={lat} lon={lon} seedElement={starSeedElement} onSeedConsumed={()=>setStarSeedElement(null)} focusStarId={focusStarId} onFocusConsumed={()=>setFocusStarId(null)} onOpenSettings={()=>setView("settings")} onLeaveWork={(v)=>setView(v as View)}/>}
        {view==="launch"   && <Launch   testerId={testerId} lat={lat} lon={lon} plannerSeed={plannerSeed} onPlannerSeedConsumed={()=>setPlannerSeed(null)} onAskAboutElection={askAboutElection}/>}
        {view==="planets"  && <Planets  testerId={testerId} lat={lat} lon={lon} onReflect={askCompass} initialPlanet={visitPlanet} onStartStar={startStarInElement}/>}
        {view==="settings" && <Settings testerId={testerId}/>}
      </div>

      {/* ── Bottom nav (phone) ── */}
      {isMobile && (
        <div data-tour="nav-tabs" style={{
          display:"flex", flexShrink:0, background:"var(--color-rail)",
          borderTop:"1px solid var(--color-border)",
          paddingBottom:"env(safe-area-inset-bottom)",
        }}>
          {navTabs.map(t => (
            <button key={t.id} data-tour={t.id === "launch" ? "nav-plan" : undefined} onClick={() => setView(t.id)} style={{
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
  // Register service worker + apply the saved text-size once on mount
  React.useEffect(() => {
    applyTextScale();
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
