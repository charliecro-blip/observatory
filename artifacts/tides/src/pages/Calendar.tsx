import React, { useState, useMemo, useEffect, useRef } from "react";
import { jsonArray } from "@/lib/jsonArray";
import { localToday, localDateStr, localDayRange } from "@/lib/dates";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTidesWeek, useSkyEvents, useGCalStatus, useGCalEvents, useCautionDays, type GCalEvent, type CautionDayHit } from "@/hooks/useTides";
import { useTimeFormat, useAstroDetail } from "@/contexts/preferences-context";
import { useTester } from "@/contexts/tester-context";
import { useIsMobile } from "@/hooks/useIsMobile";
import { CAUTION_PLANET_ARCHETYPE } from "@/lib/tester-profile";
import type { TidesNow, WeekDay, PlanningWindow, SkyEvent } from "@/lib/types";
import { PLANET_GLYPH as PLANET_ICONS, SIGN_GLYPH as SIGN_SYMBOL } from "@/lib/glyphs";
import { QualityStrip } from "@/components/QualityStrip";
import { PLANET_COLORS } from "@/lib/planetColors";
import { ELEMENT_COLORS } from "@/lib/elements";

const DEFAULT_LAT = 40.7, DEFAULT_LON = -74.0;
function hasRealLocation(lat: number, lon: number): boolean {
  return !(Math.abs(lat - DEFAULT_LAT) < 0.01 && Math.abs(lon - DEFAULT_LON) < 0.01);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOON_EMOJI: Record<string, string> = {
  "New Moon":"🌑","Waxing Crescent":"🌒","First Quarter":"🌓","Waxing Gibbous":"🌔",
  "Full Moon":"🌕","Waning Gibbous":"🌖","Last Quarter":"🌗","Waning Crescent":"🌘","Balsamic Moon":"🌑",
};
const MOON_MEANING: Record<string, string> = {
  "New Moon":"Seed-planting. Set intentions; avoid external launches.",
  "Waxing Crescent":"First steps. Begin what the new moon seeded.",
  "First Quarter":"Push through resistance. Make the decision.",
  "Waxing Gibbous":"Refine and intensify. Nearly at peak.",
  "Full Moon":"Peak visibility and emotion. Share, celebrate, complete.",
  "Waning Gibbous":"Gratitude. Share what you've learned.",
  "Last Quarter":"Edit and release. Remove what no longer serves.",
  "Waning Crescent":"Rest. Let the field lie fallow.",
  "Balsamic Moon":"Surrender. Deepest inner work before the new cycle.",
};
// Alpha tints over var(--color-card) so the grid follows the theme — the
// old hardcoded pastels kept week/day views bright in night mode.
const ELEMENT_TINT: Record<string, string> = {
  water:"#3a5a801c",fire:"#8a3a2016",earth:"#3a60301a",air:"#c19a3a1c",
};
// Plain meaning per planet for the crossing hover — what the window is FOR.
const CROSSING_MEANING: Record<string, string> = {
  Sun: "visibility, decisions, being seen", Moon: "care, feelings, home matters",
  Mercury: "writing, calls, sending the thing", Venus: "connection, beauty, asking nicely",
  Mars: "decisive action, workouts, the hard cut", Jupiter: "launches, asks, thinking bigger",
  Saturn: "structure, commitments, the disciplined task",
};

const ELEMENT_ACCENT: Record<string, string> = {
  water:ELEMENT_COLORS.water,fire:ELEMENT_COLORS.fire,earth:ELEMENT_COLORS.earth,air:ELEMENT_COLORS.air,
};
const ELEMENT_LABEL: Record<string, string> = {
  water:"#4a6a90",fire:"#9a4a30",earth:ELEMENT_COLORS.earth,air:ELEMENT_COLORS.air,
};
const ELEMENT_NOTE: Record<string, string> = {
  water:"Emotional depth, intuition, and receptive energy.",
  fire:"Bold, assertive, and expressive energy.",
  earth:"Grounding, patience, and practical focus.",
  air:"Conceptual, communicative, and eclectic energy.",
};
// Plain-language meaning of the day's coherence tier (backend quality label),
// so "Workable" et al. explain themselves instead of reading as jargon.
const QUALITY_NOTE: Record<string, string> = {
  excellent:"an unusually clear, well-aligned day",
  good:"smooth, well-supported conditions",
  workable:"fine for most things — nothing pushing hard either way",
  mixed:"crosscurrents — keep plans flexible",
};
const ASPECT_SYM: Record<string, string> = {
  conjunction:"☌︎", opposition:"☍︎", square:"□", trine:"△", sextile:"⚹",
};
const PLANET_QUALITY: Record<string, string> = {
  Sun:"Clarity, leadership, vitality",
  Moon:"Intuition, emotion, receptivity",
  Mercury:"Communication, learning, analysis",
  Venus:"Beauty, connection, ease",
  Mars:"Drive, courage, action",
  Jupiter:"Expansion, wisdom, abundance",
  Saturn:"Structure, discipline, mastery",
};
const WINDOW_TYPES = ["deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat"];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",admin:"Admin",
  social:"Social",relationship:"Relationship",recovery:"Recovery",study:"Study",launch:"Launch",retreat:"Retreat",
};
const WINDOW_COLORS: Record<string,string> = {
  deep_work:"#3a7aaa",creative:"#9060b0",planning:"#c08040",admin:"#808090",
  social:"#d06060",relationship:"#b04080",recovery:"#60a080",study:"#5060a0",launch:PLANET_COLORS.Mars,retreat:"#6080a0",
};
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAY_RULERS: string[] = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];

type CalView = "agenda" | "month" | "week" | "day";
type LayerLevel = 0 | 1 | 2;

interface PlanetHour {
  ruler: string;
  startTime: Date;
  endTime: Date;
  isDayHour: boolean;
  hourNumber: number;
}

// ── Astro Helpers ─────────────────────────────────────────────────────────────

// Planetary hours and the solar geometry behind them USED to be computed here,
// in a client copy of the Chaldean sequence and its own sunrise/sunset. They
// now come from /api/tides/planetary-hours via usePlanetaryHours, because a
// local reimplementation of a shared astronomical fact diverges eventually even
// when both start correct — and these two already had, disagreeing about
// whether the polar circles have hours at all.
//
// Roughly ninety lines removed rather than left dormant: a second correct
// implementation is a second thing to keep correct.


// ── General Helpers ───────────────────────────────────────────────────────────

function qColor(score: number): string {
  if (score >= 6) return "#3a7040";
  if (score >= 4) return "#8a8030";
  if (score >= 2) return "#c07030";
  return "#a04030";
}
function parseSign(moonSign: string): string | null {
  return Object.keys(SIGN_SYMBOL).find(s => moonSign.includes(s)) ?? null;
}
function buildMonthGrid(year: number, month: number): Array<string | null> {
  const firstDow = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const grid: Array<string | null> = Array(firstDow).fill(null);
  for (let d = 1; d <= lastDate; d++) {
    grid.push(`${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  }
  return grid;
}
function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const nd = new Date(d);
    nd.setDate(d.getDate() - dow + i);
    dates.push(localDateStr(nd));
  }
  return dates;
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60), mn = m % 60;
  return `${h.toString().padStart(2,"0")}:${mn.toString().padStart(2,"0")}`;
}
function fmtHour(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}
// fmtTime is injected via useTimeFormat() hook per-component
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}
function vocRangeForDate(dateStr: string, eventsMap: Map<string, SkyEvent[]>): { startMin: number; endMin: number } | null {
  const events = eventsMap.get(dateStr) ?? [];
  const vocEv = events.find(e => e.type === "voc" && e.time);
  if (!vocEv?.time) return null;
  const startMin = timeToMinutes(vocEv.time);
  const nextIngress = events.find(e => e.type === "ingress" && e.time && timeToMinutes(e.time) > startMin);
  const endMin = nextIngress?.time ? timeToMinutes(nextIngress.time) : 24 * 60;
  return { startMin, endMin };
}

// ── EventModal ────────────────────────────────────────────────────────────────

function EventModal({ dateStr, startHour, testerId, onClose }: {
  dateStr: string; startHour?: number; testerId: string | null; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    type: "deep_work",
    startTime: minutesToTime((startHour ?? 9) * 60),
    endTime: minutesToTime(((startHour ?? 9) + 1) * 60),
    notes: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const start = new Date(`${dateStr}T${form.startTime}:00`);
      const end   = new Date(`${dateStr}T${form.endTime}:00`);
      const r = await fetch("/api/planning/windows", {
        method:"POST",
        headers: { ...(testerId ? {"x-tester-id":testerId} : {}), "Content-Type":"application/json" },
        body: JSON.stringify({
          title: form.title || WINDOW_LABELS[form.type],
          windowType: form.type,
          startTime: start.toISOString(),
          endTime:   end.toISOString(),
          notes: form.notes || undefined,
        }),
      });
      if (!r.ok) throw new Error(`save failed (${r.status})`);
    },
    onSuccess: () => { invalidateWindows(qc); onClose(); },
  });
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:999,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:100,padding:"100px 16px 16px" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      {/* Was a fixed 380px, no maxWidth — Cancel/Save clipped off-screen on
          phones, and this is the only way to add an event (audit P0 #7). */}
      <div style={{ background: "var(--color-card)",borderRadius:14,padding:"22px 24px",width:380,maxWidth:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",border:"1px solid var(--color-border)" }}>
        <div style={{ fontSize:14,fontWeight:600,color: "var(--color-primary)",marginBottom:14 }}>
          New event · {new Date(dateStr+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          <input autoFocus value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
            onKeyDown={e=>{if(e.key==="Enter"&&form.title.trim())save.mutate();if(e.key==="Escape")onClose();}}
            placeholder={WINDOW_LABELS[form.type]}
            style={{ padding:"9px 12px",borderRadius:8,border:"1px solid var(--color-border)",fontSize:13,outline:"none",background: "var(--color-card-2)" }}/>
          <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
            style={{ padding:"8px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card-2)",color:"var(--text-1)" }}>
            {WINDOW_TYPES.map(t=><option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
          </select>
          <div style={{ display:"flex",gap:8 }}>
            <label style={{ flex:1,fontSize:11,color:"var(--color-muted)" }}>Start
              <input type="time" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))}
                style={{ display:"block",marginTop:3,width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card-2)" }}/>
            </label>
            <label style={{ flex:1,fontSize:11,color:"var(--color-muted)" }}>End
              <input type="time" value={form.endTime} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))}
                style={{ display:"block",marginTop:3,width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card-2)" }}/>
            </label>
          </div>
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
            placeholder="Notes (optional)" rows={2}
            style={{ padding:"8px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card-2)",resize:"vertical",outline:"none" }}/>
        </div>
        {save.isError && <div style={{ marginTop:10,fontSize:11.5,color:"#a03030" }}>Couldn't save — the event wasn't added. Check your connection and try again.</div>}
        <div style={{ display:"flex",gap:8,marginTop:14 }}>
          <button onClick={onClose} style={{ flex:1,padding:"9px 0",borderRadius:8,border:"1px solid var(--color-border)",background:"transparent",color:"var(--color-muted)",fontSize:12,cursor:"pointer" }}>Cancel</button>
          <button onClick={()=>save.mutate()} disabled={save.isPending}
            style={{ flex:2,padding:"9px 0",borderRadius:8,border:"none",background:"#1a2a3a",color:"#ffffff",fontSize:12,fontWeight:600,cursor:"pointer" }}>
            {save.isPending?"Saving…":"Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EventBlock ────────────────────────────────────────────────────────────────

function EventBlock({ win, topPct, heightPct, onDelete }: {
  win: PlanningWindow; topPct: number; heightPct: number; onDelete: () => void;
}) {
  const fmtTime = useTimeFormat();
  const col = WINDOW_COLORS[win.type as string] ?? "#888888";
  const start = new Date(win.startTime), end = new Date(win.endTime);
  const shortTime = `${fmtTime(start)} – ${fmtTime(end)}`;
  return (
    <div style={{
      position:"absolute",left:2,right:2,
      top:`${topPct*100}%`,height:`${Math.max(heightPct*100,2.5)}%`,
      background:`${col}dd`,borderRadius:5,padding:"3px 6px",overflow:"hidden",
      borderLeft:`3px solid ${col}`,cursor:"pointer",zIndex:10,
      boxShadow:"0 1px 4px rgba(0,0,0,0.12)",
    }}>
      <div style={{ fontSize:9.5,fontWeight:600,color:"#ffffff",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
        {win.title}
      </div>
      {heightPct>0.04 && <div style={{ fontSize:8,color:"rgba(255,255,255,0.75)",marginTop:1 }}>{shortTime}</div>}
      <button onClick={e=>{e.stopPropagation();onDelete();}} aria-label={`Delete "${win.title}"`} style={{ position:"absolute",top:2,right:3,background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:9,cursor:"pointer",lineHeight:1,padding:0 }}>✕</button>
    </div>
  );
}

// ── GCal Event Block ──────────────────────────────────────────────────────────

function GCalBlock({ ev, topPct, heightPct }: { ev: GCalEvent; topPct: number; heightPct: number }) {
  const fmtTime = useTimeFormat();
  const col = ev.color ?? "#4285f4";
  const start = new Date(ev.start);
  const end   = new Date(ev.end);
  const shortTime = ev.allDay ? "all day" : `${fmtTime(start)} – ${fmtTime(end)}`;
  return (
    <div style={{
      position:"absolute", left:"50%", right:2,
      top:`${topPct*100}%`, height:`${Math.max(heightPct*100, 2)}%`,
      background:`${col}bb`, borderRadius:4, padding:"2px 5px", overflow:"hidden",
      borderLeft:`2px solid ${col}`, zIndex:9,
      boxShadow:"0 1px 3px rgba(0,0,0,0.1)",
    }}>
      <div style={{ fontSize:8.5, fontWeight:600, color:"#ffffff", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {ev.title}
      </div>
      {heightPct > 0.03 && <div style={{ fontSize:7.5, color:"rgba(255,255,255,0.8)", marginTop:1 }}>{shortTime}</div>}
      <div style={{ position:"absolute", top:1, right:2, fontSize:6.5, color:"rgba(255,255,255,0.7)", fontWeight:700 }}>G</div>
    </div>
  );
}

// ── Google Calendar connect button / status ───────────────────────────────────

function GCalButton({ testerId, qc }: { testerId: string | null; qc: ReturnType<typeof useQueryClient> }) {
  const { data: status } = useGCalStatus(testerId);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      // Both ends now check: the popup targets our origin, and we ignore
      // anything that didn't come from it.
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "google-cal-connected") {
        qc.invalidateQueries({ queryKey: ["gcal-status"] });
        qc.invalidateQueries({ queryKey: ["gcal-events"] });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [qc]);

  const disconnect = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/integrations/google-cal/disconnect", {
        method: "DELETE",
        headers: testerId ? { "x-tester-id": testerId } : {},
      });
      if (!r.ok) throw new Error("Couldn't disconnect — try again.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gcal-status"] });
      qc.invalidateQueries({ queryKey: ["gcal-events"] });
    },
  });

  function connect() {
    if (!testerId) return;
    const url = `/api/integrations/google-cal/auth?testerId=${encodeURIComponent(testerId)}`;
    popupRef.current = window.open(url, "gcal-connect", "width=500,height=600,left=200,top=100");
  }

  if (status?.configured === false) {
    // Unconfigured = the Google OAuth credentials aren't set on the server
    // (owner Railway task per GCAL-SETUP.md). Say so plainly so it doesn't
    // read as a broken button — but don't leave it a dead end: the webcal
    // feed solves the same user problem in the other direction (Compass's
    // blocks OUT to any calendar, rather than their events IN), and this is
    // exactly the moment someone wants it.
    // (The "send mine to my calendar" feed button that briefly lived here was
    // withdrawn 2026-07-30 — the feed URL carried the account credential. It
    // returns once the feed has its own revocable token. See BACKLOG §2.)
    return (
      <div title="Google Calendar sync isn't set up on the server yet — coming soon." style={{
        fontSize:9, padding:"3px 9px", borderRadius:6, border:"1px dashed var(--color-border)",
        background:"var(--color-card-2)", color:"var(--color-muted)", cursor:"default",
        display:"flex", alignItems:"center", gap:4,
      }}>
        <span style={{ fontSize:10 }}>📅</span> Google Cal · coming soon
      </div>
    );
  }

  if (status?.connected && status?.needsReconnect) {
    // The state a tester actually hits: Google drops the grant (every 7 days
    // while the OAuth app is in Testing mode), the row survives, and the
    // calendar quietly shows nothing. This is the chip that turns a mystery
    // into one tap — it sits where the empty calendar is, not in Settings.
    return (
      <button onClick={connect} title="Google signed us out — click to reconnect" style={{
        fontSize:9, padding:"3px 9px", borderRadius:6, border:"1px solid #e0c0a0",
        background:"#a0602018", color:"#a06020", cursor:"pointer",
        display:"flex", alignItems:"center", gap:4,
      }}>
        <span style={{ fontSize:10 }}>⚠</span> Google signed us out · Reconnect
      </button>
    );
  }

  if (status?.connected) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <div style={{
          fontSize:9, padding:"3px 9px", borderRadius:6, border:"1px solid #b0d0b0",
          background:"#3a602018", color:"#408040",
          display:"flex", alignItems:"center", gap:4,
        }}>
          <span style={{ fontSize:10 }}>📅</span>
          <span>{status.email ?? "Google Cal"}</span>
        </div>
        <button onClick={() => disconnect.mutate()} title="Disconnect Google Calendar" aria-label="Disconnect Google Calendar" style={{
          fontSize:9, padding:"2px 6px", borderRadius:5, border:"1px solid #e0ccc0",
          background:"#8a3a2012", color:"#c06040", cursor:"pointer",
        }}>✕</button>
      </div>
    );
  }

  return (
    <button onClick={connect} style={{
      fontSize:9, padding:"3px 9px", borderRadius:6, border:"1px solid var(--color-border)",
      background: "var(--color-card)", color:"var(--text-2)", cursor:"pointer",
      display:"flex", alignItems:"center", gap:4,
    }}>
      <span style={{ fontSize:10 }}>📅</span> Connect Google Cal
    </button>
  );
}

// ── TimeGrid (week + day) ─────────────────────────────────────────────────────

/**
 * ONE SOURCE OF TRUTH FOR THE HOUR GRID.
 *
 * Calendar built these locally, from a client copy of the Chaldean sequence and
 * its own solar geometry. A local reimplementation of a shared astronomical
 * fact diverges eventually even when both start correct — and these already
 * had: the client returned null above the polar circles while the server
 * fabricated a symmetric twelve-hour day, so the two disagreed about whether
 * Tromsø had planetary hours at all.
 *
 * A hook rather than a query in each component, because TimeGrid and the
 * Agenda both need them and two copies of the fetch is how the two copies of
 * the MATHS started. At most seven dates are ever requested — the month view
 * shows no hours — so this is one small call.
 */
function usePlanetaryHours(dates: string[], lat: number, lon: number) {
  const key = dates.join(",");
  return useQuery<{ hours: Record<string, PlanetHour[] | null> }>({
    queryKey: ["planetary-hours", key, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/planetary-hours?dates=${key}&lat=${lat}&lon=${lon}&tz=${new Date().getTimezoneOffset()}`);
      if (!r.ok) throw new Error("hours unavailable");
      const j = await r.json();
      const hours: Record<string, PlanetHour[] | null> = {};
      for (const [d, list] of Object.entries(j.hours ?? {})) {
        // `null` means genuinely unavailable — polar day or night, where there
        // is no daylight span to divide. Different from "none loaded yet".
        hours[d] = list === null ? null : (list as any[]).map(h => ({
          ruler: h.ruler,
          startTime: new Date(h.startAt),
          endTime: new Date(h.endAt),
          isDayHour: h.isDayHour,
          hourNumber: h.hourNumber,
        }));
      }
      return { hours };
    },
    enabled: dates.length > 0,
    staleTime: 3_600_000,
  });
}

function TimeGrid({ dates, dataMap, windowsMap, eventsMap, gcalMap, cautionMap, testerId, today, lat, lon, isDay, onAddEvent, onDeleteWindow }: {
  dates: string[];
  dataMap: Map<string, WeekDay>;
  windowsMap: Map<string, PlanningWindow[]>;
  eventsMap: Map<string, SkyEvent[]>;
  gcalMap: Map<string, GCalEvent[]>;
  cautionMap: Map<string, CautionDayHit[]>;
  testerId: string | null;
  today: string;
  lat: number; lon: number;
  isDay: boolean;
  onAddEvent: (date: string, hour: number) => void;
  onDeleteWindow: (id: number) => void;
}) {
  const fmtTime = useTimeFormat();
  // The astro-quiet lens strips the grid to plain scheduling: no astro strip,
  // no planetary-hour bands or legend, no VOC hatch, no crossings or aspect
  // markers. Events, planned windows, the now line and the add-block zones
  // are the calendar, and they all stay.
  const { level: calLevel } = useAstroDetail();
  const skyQuiet = calLevel === "minimal";
  const HOUR_START = 5, HOUR_END = 23, HOURS = HOUR_END - HOUR_START;
  const ROW_H = isDay ? 60 : 48;
  const LABEL_W = isDay ? 52 : 44;
  // Day: wide labeled planetary hour band left of grid; week: full-width subtle tint
  const PLANET_BAR_W = isDay && !skyQuiet ? 68 : 0;
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const realLocation = hasRealLocation(lat, lon);
  // Immediate hover info for angle crossings — the native title tooltip only
  // appears after a ~1s delay ("takes a minute to populate"); this shows the
  // read instantly at the cursor.
  const [hoverCross, setHoverCross] = useState<{ x: number; y: number; text: string; color: string } | null>(null);
  // Tap-to-pin, separate from hover: on desktop, clicking a crossing line
  // means hover already populated `hoverCross`, so toggling THAT off on click
  // would hide it the instant it's clicked. A phone has no hover at all, so
  // it needs its own state that a tap sets and a second tap (or a tap
  // elsewhere) clears (beta pass §B5 — this explainer was hover-only).
  const [pinnedCross, setPinnedCross] = useState<{ x: number; y: number; text: string; color: string } | null>(null);
  const shownCross = pinnedCross ?? hoverCross;

  const { data: hoursData } = usePlanetaryHours(dates, lat, lon);

  const planetaryHoursMap = useMemo(() => {
    const m = new Map<string, PlanetHour[]>();
    for (const d of dates) m.set(d, hoursData?.hours?.[d] ?? []);
    return m;
  }, [dates, hoursData]);

  // Planetary hours legend height (day view only, fixed below grid)
  const LEGEND_H = isDay && !skyQuiet ? 108 : 0;

  // One shared vertical scroll for the gutter + every day column, so the hour
  // labels stay locked to the grid rows while you scroll (previously each column
  // scrolled on its own and the labels sat still — the confusing part).
  // The astro strip's 32px leaves the header with the strip, or the gutter
  // corner floats above misaligned rows.
  const HDR_H = (isDay ? 48 : 44) + (skyQuiet ? 0 : 32); // day/date block + astro strip — matches each column header

  return (
    <div style={{ flex:1, overflowY:"auto", overflowX: isDay ? "hidden" : "auto", position:"relative" }}>
      <div style={{ display:"flex", minWidth: isDay ? "100%" : "max-content", alignItems:"stretch" }}>
        {/* Hour labels gutter — sticky on the left, scrolls vertically with the grid */}
        <div style={{ width:LABEL_W, flexShrink:0, position:"sticky", left:0, zIndex:30, background:"var(--color-card-2)", borderRight:"1px solid var(--color-border)" }}>
          {/* header spacer — sticky top so the corner stays put */}
          <div style={{ height:HDR_H, position:"sticky", top:0, zIndex:31, background:"var(--color-card-2)", borderBottom:"1px solid var(--color-border)" }}/>
          {isDay && <div style={{ height:LEGEND_H, borderBottom:"1px solid var(--color-border)", background:"var(--color-card-2)" }}/>}
          {Array.from({length:HOURS+1},(_,i)=>(
            <div key={i} style={{ height:ROW_H,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:8,paddingTop:2 }}>
              <span style={{ fontSize:9,color:"var(--text-3)",fontWeight:500 }}>{fmtHour(HOUR_START+i)}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {dates.map(dateStr => {
          const dayData = dataMap.get(dateStr);
          const isToday = dateStr===today;
          const ec = ELEMENT_ACCENT[dayData?.element ?? ""] ?? "#888888";
          const et = ELEMENT_TINT[dayData?.element ?? ""] ?? "var(--color-card)";
          const wins = windowsMap.get(dateStr) ?? [];
          const crossings = realLocation ? ((dayData?.crossings ?? []) as any[]) : [];
          const isPast = dateStr < today;
          const d = new Date(dateStr+"T12:00:00");
          const dayLabel = d.toLocaleDateString("en-US",{weekday:"short"});
          const dayNum = d.getDate();
          const elem = dayData?.element ?? "";
          const moonSign = dayData?.moonSign ?? "";
          const signKey = parseSign(moonSign);
          const phase = dayData?.moonPhase ?? "";
          const qs = dayData?.qualityScore ?? 0;
          const voc = vocRangeForDate(dateStr, eventsMap);
          const moonAspects = dayData?.moonAspects ?? [];
          const dayRuler = dayData?.dayRuler ?? "";
          const allHours = planetaryHoursMap.get(dateStr) ?? [];
          const nowHour = allHours.find(ph => now >= ph.startTime && now < ph.endTime);

          const HEADER_H = isDay ? 48 : 44;
          const ASTRO_STRIP_H = skyQuiet ? 0 : 32;

          return (
            <div key={dateStr} style={{ flex:1,minWidth:isDay?0:110,borderRight:"1px solid var(--color-border)",flexShrink:isDay?1:0,display:"flex",flexDirection:"column" }}>
              {/* Column header — sticky */}
              <div style={{
                flexShrink:0, borderBottom:"1px solid var(--color-border)",
                background:isToday?`${ec}18`:"var(--color-card-2)",
                position:"sticky", top:0, zIndex:20,
              }}>
                {/* Day + date */}
                <div style={{ height:HEADER_H,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,padding:"4px 0" }}>
                  <div style={{ fontSize:isDay?10:9,color:isToday?ec:"var(--text-3)",textTransform:"uppercase",fontWeight:600,letterSpacing:"0.3px" }}>{dayLabel}</div>
                  <div style={{
                    fontSize:isDay?18:15,fontWeight:700,color:isToday?"#ffffff":"var(--color-foreground)",lineHeight:1,
                    width:isDay?28:22,height:isDay?28:22,borderRadius:"50%",
                    background:isToday?ec:"transparent",
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>{dayNum}</div>
                  {isDay && !skyQuiet && dayRuler && (
                    <div style={{ fontSize:8,color:PLANET_COLORS[dayRuler]??"var(--text-3)" }}>{PLANET_ICONS[dayRuler]} {dayRuler}</div>
                  )}
                </div>

                {/* Astro strip — folded away entirely at the quiet lens */}
                {!skyQuiet && <div style={{
                  height:ASTRO_STRIP_H,borderTop:"1px solid var(--color-border)",
                  background:elem?et:"var(--color-card-2)",
                  padding:"3px 6px",display:"flex",flexDirection:"column",justifyContent:"center",gap:2,
                }}>
                  <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                    {phase && <span style={{ fontSize:9 }}>{MOON_EMOJI[phase]??""}</span>}
                    {signKey && <span style={{ fontSize:9,color:ELEMENT_LABEL[elem]??"var(--color-muted)",fontWeight:500 }}>{SIGN_SYMBOL[signKey]} {isDay ? moonSign.split(" ")[0] : (moonSign.split(" ")[0]??"")} </span>}
                    {/* week: show current planetary hour planet */}
                    {!isDay && isToday && nowHour && (
                      <span title={`${nowHour.ruler} hour`} style={{ marginLeft:"auto",fontSize:9,color:PLANET_COLORS[nowHour.ruler]??"var(--color-muted)" }}>{PLANET_ICONS[nowHour.ruler]}</span>
                    )}
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:4,overflow:"hidden" }}>
                    {voc && <span title="Void-of-course Moon — a liminal 'slack water' stretch: beginnings tend to drift, so finish and rest instead. Not a warning, just a different kind of time." style={{ fontSize:8,padding:"0 4px",borderRadius:3,background:"#6f6a9022",color:"var(--text-2)",border:"1px solid #d2cee2",lineHeight:"14px",whiteSpace:"nowrap" }}>◒ VOC</span>}
                    {(cautionMap.get(dateStr)?.length ?? 0) > 0 && (
                      <span title={`Advisory: ${cautionMap.get(dateStr)!.map(h => `${h.triggerPlanet} ${h.aspect.toLowerCase()} your ${h.cautionPlanet}`).join(" · ")} — one of your sensitivity planets is active.`}
                        style={{ fontSize:9,lineHeight:1,cursor:"help" }}>⚠️</span>
                    )}
                    {/* The day's aspects — lunar and planet-planet, with exact times */}
                    {(() => {
                      const dayAspects = (eventsMap.get(dateStr) ?? []).filter(ev => ev.type === "moon_aspect" || ev.type === "aspect");
                      if (dayAspects.length === 0) return null;
                      return dayAspects.slice(0, isDay ? 3 : 2).map((ev, ai) => {
                        const parts = aspectLineParts(ev);
                        if (!parts) return null;
                        const col = ev.quality === "caution" ? "#a05020" : ev.quality === "favorable" ? "#3a6020" : "#60708a";
                        return (
                          <span key={ai} title={`${ev.title}${ev.subtitle ? " — " + ev.subtitle : ""}`}
                            style={{ fontSize:8.5,color:col,fontWeight:ev.type==="aspect"?700:500,whiteSpace:"nowrap" }}>
                            {parts.left}{parts.sym}{parts.right}{ev.time ? ` ${ev.time}` : ""}
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>}
              </div>

              {/* Day view: planetary hours legend ABOVE scroll area */}
              {isDay && !skyQuiet && (
                <div style={{ flexShrink:0,height:LEGEND_H,borderBottom:"1px solid var(--color-border)",background:"var(--color-card-2)",padding:"6px 8px",overflowY:"auto" }}>
                  <div style={{ fontSize:7.5,color:"var(--text-3)",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.4px" }}>Planetary hours</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:2 }}>
                    {allHours.map((ph,i)=>{
                      const col = PLANET_COLORS[ph.ruler]??"#888888";
                      const isNow = now>=ph.startTime && now<ph.endTime;
                      if (!ph.isDayHour && !isNow) return null; // week: only show day hours + current night hour
                      return (
                        <div key={i} title={PLANET_QUALITY[ph.ruler]} style={{
                          display:"flex",alignItems:"center",gap:2,padding:"2px 5px",borderRadius:4,
                          border:`1px solid ${isNow ? col : col+"40"}`,
                          background:isNow?`${col}28`:`${col}10`,
                          opacity:ph.isDayHour||(isNow)?1:0.5,
                          fontWeight:isNow?700:400,
                        }}>
                          <span style={{ fontSize:8,color:col }}>{PLANET_ICONS[ph.ruler]}</span>
                          <span style={{ fontSize:7.5,color:col }}>{fmtTime(ph.startTime)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Time body — height comes from the rows; the whole grid scrolls as one */}
              <div style={{ position:"relative",background:isPast?"var(--color-card-2)":"var(--color-card)" }}>
                <div style={{ position:"relative",height:HOURS*ROW_H }}>

                  {/* Planetary hours — week: full-width tint; day: left bar */}
                  {!skyQuiet && allHours.map((ph,phi) => {
                    const startMs = ph.startTime.getTime();
                    const endMs   = ph.endTime.getTime();
                    const midnight = new Date(dateStr+"T00:00:00").getTime();
                    const startH = (startMs - midnight) / 3600000;
                    const endH   = (endMs   - midnight) / 3600000;
                    const topPx  = Math.max(0, (startH - HOUR_START) / HOURS * HOURS * ROW_H);
                    const botPx  = Math.min(HOURS*ROW_H, (endH - HOUR_START) / HOURS * HOURS * ROW_H);
                    if (botPx<=0||topPx>=HOURS*ROW_H) return null;
                    const col = PLANET_COLORS[ph.ruler] ?? "#888888";
                    if (isDay) {
                      // Left labeled bar
                      return (
                        <div key={phi} style={{
                          position:"absolute",top:topPx,height:Math.max(1,botPx-topPx),
                          left:0,width:PLANET_BAR_W,
                          background:`${col}${ph.isDayHour?"26":"14"}`,
                          borderTop:`1px solid ${col}28`,zIndex:1,overflow:"hidden",
                        }}>
                          {(botPx-topPx)>=15 && (
                            <div style={{ padding:"1px 4px",fontSize:7.5,color:col,fontWeight:600,lineHeight:1.3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis" }}>
                              {PLANET_ICONS[ph.ruler]} {ph.ruler}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      // Week: full-width background tint, very subtle (bands blend
                      // into a gradient of the day rather than reading as blocks)
                      return (
                        <div key={phi} style={{
                          position:"absolute",top:topPx,height:Math.max(1,botPx-topPx),
                          left:0,right:0,
                          background:`${col}${ph.isDayHour?"16":"0d"}`,
                          borderTop:`1px solid ${col}20`,zIndex:1,pointerEvents:"none",
                        }}/>
                      );
                    }
                  })}

                  {/* Hour grid lines + click zones */}
                  {Array.from({length:HOURS},(_,i)=>(
                    <div key={i} onClick={()=>!isPast&&onAddEvent(dateStr,HOUR_START+i)}
                      title={isPast ? undefined : `Add an event at ${fmtHour(HOUR_START+i)}`}
                      style={{
                        position:"absolute",left:PLANET_BAR_W,right:0,top:i*ROW_H,height:ROW_H,
                        borderBottom:"1px solid var(--color-border)",cursor:isPast?"default":"pointer",zIndex:2,
                      }}
                      onMouseEnter={e=>{ if(isPast) return; const el=e.currentTarget as HTMLElement; el.style.background="rgba(90,120,160,0.10)"; el.style.boxShadow="inset 0 0 0 1.5px rgba(90,120,160,0.45)"; const h=el.querySelector('[data-add]') as HTMLElement|null; if(h) h.style.opacity="1"; }}
                      onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.background=""; el.style.boxShadow=""; const h=el.querySelector('[data-add]') as HTMLElement|null; if(h) h.style.opacity="0"; }}
                    >
                      <div style={{ position:"absolute",left:0,right:0,top:"50%",borderTop:"1px dashed #f0ede8" }}/>
                      {!isPast && <span data-add style={{ position:"absolute",left:4,top:2,fontSize:8.5,fontWeight:700,color:"#5a78a0",opacity:0,transition:"opacity 0.1s",pointerEvents:"none" }}>＋ add</span>}
                    </div>
                  ))}

                  {/* VOC overlay */}
                  {!skyQuiet && voc && (()=>{
                    const topPx = Math.max(0,(voc.startMin/60-HOUR_START)/HOURS*HOURS*ROW_H);
                    const botPx = Math.min(HOURS*ROW_H,(voc.endMin/60-HOUR_START)/HOURS*HOURS*ROW_H);
                    if (botPx<=topPx) return null;
                    return (
                      <div style={{
                        position:"absolute",left:PLANET_BAR_W,right:0,top:topPx,height:botPx-topPx,
                        zIndex:3,pointerEvents:"none",
                        background:"repeating-linear-gradient(135deg,transparent,transparent 8px,rgba(111,106,144,0.08) 8px,rgba(111,106,144,0.08) 9px)",
                        borderLeft:"2px solid #6f6a9050",
                      }}>
                        <div style={{ position:"absolute",top:2,left:4,fontSize:7,color:"var(--text-2)",fontWeight:600 }}>◒ VOC</div>
                      </div>
                    );
                  })()}

                  {/* Aspect crossing lines — only with real location */}
                  {!skyQuiet && crossings.map((c:any,ci:number) => {
                    if (!c.time) return null;
                    const mins = timeToMinutes(c.time);
                    const topPx = ((mins/60-HOUR_START)/HOURS)*HOURS*ROW_H;
                    if (topPx<0||topPx>HOURS*ROW_H) return null;
                    const pCol = PLANET_COLORS[c.planet] ?? "#c8b870";
                    const crossText = `${c.planet} ${c.angle==="ASC"?"rises":c.angle==="MC"?"culminates":c.angle==="DSC"?"sets":"reaches the low point"} at ${c.time?.slice(0,5)} — a strong ~20-minute window for ${CROSSING_MEANING[c.planet] ?? "this planet's themes"}.`;
                    return (
                      <div key={ci}
                        onMouseEnter={(e)=>setHoverCross({ x:e.clientX, y:e.clientY, text:crossText, color:pCol })}
                        onMouseMove={(e)=>setHoverCross(h=>h?{ ...h, x:e.clientX, y:e.clientY }:h)}
                        onMouseLeave={()=>setHoverCross(null)}
                        // A second, independent pin — see pinnedCross above.
                        onClick={(e)=>{ e.stopPropagation(); setPinnedCross(h => h ? null : { x:e.clientX, y:e.clientY, text:crossText, color:pCol }); }}
                        style={{
                        position:"absolute",left:PLANET_BAR_W,right:0,
                        top:topPx-18,height:36,zIndex:4,cursor:"help",
                        background:`linear-gradient(to bottom,transparent 0%,${pCol}35 40%,${pCol}55 50%,${pCol}35 60%,transparent 100%)`,
                      }}>
                        <div style={{ position:"absolute",bottom:1,right:3,fontSize:7.5,color:pCol,fontWeight:600,background:"rgba(255,255,255,0.75)",padding:"0 2px",borderRadius:2 }}>
                          {PLANET_ICONS[c.planet]??c.planet[0]} {c.angle}
                        </div>
                      </div>
                    );
                  })}

                  {/* Lunar (and planet-planet) aspects — timed markers on the day itself */}
                  {!skyQuiet && (eventsMap.get(dateStr) ?? []).filter(ev => (ev.type==="moon_aspect"||ev.type==="aspect") && ev.at).map((ev,ei) => {
                    const d = new Date(ev.at!);
                    const mins = d.getHours()*60 + d.getMinutes();
                    const topPx = ((mins/60-HOUR_START)/HOURS)*HOURS*ROW_H;
                    if (topPx<0||topPx>HOURS*ROW_H) return null;
                    const parts = aspectLineParts(ev);
                    const col = ev.quality==="caution" ? "#a05020" : ev.quality==="favorable" ? "#3a6020" : "#60708a";
                    return (
                      <div key={`asp${ei}`} title={`${ev.title}${ev.subtitle ? " — " + ev.subtitle : ""}`} style={{
                        position:"absolute",left:PLANET_BAR_W,right:0,top:topPx-8,height:16,zIndex:5,
                        pointerEvents:"none",display:"flex",alignItems:"center",gap:3,
                      }}>
                        <div style={{ flex:1,borderTop:`1px dashed ${col}59` }}/>
                        {parts && (
                          <div style={{ fontSize:8,color:col,fontWeight:700,background:"rgba(255,255,255,0.82)",padding:"0 3px",borderRadius:3,whiteSpace:"nowrap" }}>
                            {parts.left}{parts.sym}{parts.right} {fmtTime(d)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* GCal events */}
                  {(gcalMap.get(dateStr) ?? []).filter(ev => !ev.allDay).map(ev => {
                    const s = new Date(ev.start), e = new Date(ev.end);
                    const sMin = s.getHours()*60+s.getMinutes();
                    const eMin = e.getHours()*60+e.getMinutes();
                    const topPct = Math.max(0,(sMin/60-HOUR_START)/HOURS);
                    const hPct   = Math.max(0,(eMin-sMin)/60/HOURS);
                    return <GCalBlock key={ev.id} ev={ev} topPct={topPct} heightPct={hPct}/>;
                  })}

                  {/* Planning window events */}
                  {wins.map(w=>{
                    const wS = new Date(w.startTime), wE = new Date(w.endTime);
                    const sMin = wS.getHours()*60+wS.getMinutes();
                    const eMin = wE.getHours()*60+wE.getMinutes();
                    const topPct = Math.max(0,(sMin/60-HOUR_START)/HOURS);
                    const hPct   = Math.max(0,(eMin-sMin)/60/HOURS);
                    return <EventBlock key={w.id} win={w} topPct={topPct} heightPct={hPct} onDelete={()=>onDeleteWindow(w.id)}/>;
                  })}

                  {/* Now line */}
                  {isToday && nowH>=HOUR_START && nowH<=HOUR_END && (
                    <div style={{
                      position:"absolute",left:0,right:0,
                      top:((nowH-HOUR_START)/HOURS)*HOURS*ROW_H,
                      height:2,background:"#e04040",zIndex:15,
                      boxShadow:"0 0 4px rgba(224,64,64,0.5)",
                    }}>
                      <div style={{ position:"absolute",left:PLANET_BAR_W>0?PLANET_BAR_W-4:0,top:-4,width:8,height:8,borderRadius:"50%",background:"#e04040" }}/>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Tapping anywhere else dismisses a pinned crossing — there's no
          mouseleave on a touch screen to fall back on. */}
      {pinnedCross && (
        <div onClick={()=>setPinnedCross(null)} style={{ position:"fixed", inset:0, zIndex:9998 }} />
      )}
      {shownCross && (
        <div style={{
          position:"fixed", left:Math.min(shownCross.x+14, window.innerWidth-236), top:shownCross.y+14,
          zIndex:9999, width:220, pointerEvents:"none",
          background:"var(--color-card)", border:`1px solid ${shownCross.color}55`, borderLeft:`3px solid ${shownCross.color}`,
          borderRadius:8, padding:"8px 10px", fontSize:11, lineHeight:1.5, color:"var(--color-foreground)",
          boxShadow:"0 6px 20px rgba(0,0,0,0.18)",
        }}>{shownCross.text}</div>
      )}
    </div>
  );
}

// ── MonthCell (bigger, richer) ────────────────────────────────────────────────

// Compact "☽□♀ 2:12p" line for a moon_aspect / planet-planet aspect event.
// Title formats are "Moon □ Venus" / "Sun □ Saturn" from the events endpoint.
function aspectLineParts(ev: SkyEvent): { left: string; sym: string; right: string } | null {
  const m = ev.title.split(" ");
  if (m.length < 3) return null;
  const [p1, sym, p2] = [m[0], m[1], m.slice(2).join(" ")];
  return {
    left: PLANET_ICONS[p1] ?? p1,
    sym,
    right: PLANET_ICONS[p2] ?? p2,
  };
}

function MonthCell({ dateStr, dayData, isToday, isSelected, isPast, showSignNames, vocFrac, wins, gcalEvents, skyEvents, cautionHits, simple = false, onClick }: {
  dateStr: string; dayData?: WeekDay; isToday: boolean; isSelected: boolean; isPast: boolean;
  showSignNames: boolean; vocFrac?: {top:number; height:number} | null;
  wins: PlanningWindow[]; gcalEvents: GCalEvent[]; skyEvents: SkyEvent[];
  cautionHits: CautionDayHit[]; simple?: boolean; onClick: () => void;
}) {
  const fmtTime = useTimeFormat();
  // At the quiet lens a month cell is a date and its events — the sky rows
  // (phase, sign, ruler, VOC, aspects, element tint) all fold away.
  const { level: cellLevel } = useAstroDetail();
  const cellQuiet = cellLevel === "minimal";
  const dayNum = parseInt(dateStr.split("-")[2]);
  const elem = dayData?.element ?? "";
  const phase = cellQuiet ? "" : (dayData?.moonPhase ?? "");
  const voc = !cellQuiet && (dayData?.voidPeriods ?? false);
  const moonSign = dayData?.moonSign ?? "";
  const signKey = cellQuiet ? null : parseSign(moonSign);
  const dayRuler = cellQuiet ? "" : (dayData?.dayRuler ?? "");
  const bg = dayData && !isPast && !cellQuiet ? (ELEMENT_TINT[elem] ?? "var(--color-card-2)") : "var(--color-card-2)";
  const border = isSelected ? "2px solid #1a2a3a" : isToday ? "2px solid #c09040" : "2px solid transparent";
  const rulerCol = PLANET_COLORS[dayRuler] ?? "#999999";

  // Aspects lead the cell: lunar + planet-planet, with times. Ingresses keep a
  // small line; crossings/quality bars are gone (they read as unexplained
  // glyphs and mystery bars).
  const aspectEvents = skyEvents.filter(ev => ev.type === "moon_aspect" || ev.type === "aspect");
  const ingressEvents = skyEvents.filter(ev => ev.type === "ingress");

  return (
    <button onClick={onClick} style={{
      height:128,borderRadius:8,border,background:bg,cursor:"pointer",
      padding:"6px 7px 4px",position:"relative",display:"flex",flexDirection:"column",gap:0,
      textAlign:"left",overflow:"hidden",opacity:isPast&&!isToday?0.48:1,
      boxShadow:isSelected?"0 2px 8px rgba(0,0,0,0.12)":"none",
    }}>
      {/* VOC hatch */}
      {voc && vocFrac && (
        <div style={{
          position:"absolute",left:0,right:0,top:`${vocFrac.top*100}%`,height:`${vocFrac.height*100}%`,
          borderRadius:4,pointerEvents:"none",
          background:"repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(180,150,0,0.1) 5px,rgba(180,150,0,0.1) 6px)",
        }}/>
      )}

      {/* Row 1: date + day ruler + moon phase + caution */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2 }}>
        <div style={{ display:"flex",flexDirection:"column",gap:0 }}>
          <span style={{ fontSize:16,lineHeight:1,fontWeight:isToday?700:500,color:isToday?"#b07820":"var(--text-1)" }}>{dayNum}</span>
          {isToday && <span style={{ fontSize:8,color:"#b07820",fontWeight:600,lineHeight:1.2 }}>TODAY</span>}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:4 }}>
          {!cellQuiet && cautionHits.length > 0 && (
            <span title={`Advisory: ${cautionHits.map(h => `${h.triggerPlanet} ${h.aspect.toLowerCase()} your ${h.cautionPlanet}`).join(" · ")} — one of your sensitivity planets is active. Move big commitments carefully.`}
              style={{ fontSize:10,lineHeight:1,cursor:"help" }}>⚠️</span>
          )}
          {dayRuler && (
            <span title={`${dayRuler}'s day`} style={{
              fontSize:9, color:rulerCol, background:`${rulerCol}18`, borderRadius:8,
              padding:"1px 5px", fontWeight:600, lineHeight:1.4,
            }}>{PLANET_ICONS[dayRuler] ?? dayRuler[0]}</span>
          )}
          {phase && <span style={{ fontSize:12 }}>{MOON_EMOJI[phase]??""}</span>}
        </div>
      </div>

      {/* Row 2: moon sign + element */}
      {dayData && signKey && showSignNames && (
        <div style={{ fontSize:11,fontWeight:500,lineHeight:1.3,color:ELEMENT_LABEL[elem]??"var(--text-3)",marginBottom:1 }}>
          {SIGN_SYMBOL[signKey]} {moonSign.split(" ").slice(0,2).join(" ")}
        </div>
      )}
      {dayData && !showSignNames && !cellQuiet && elem && (
        <div style={{ fontSize:11,fontWeight:500,lineHeight:1.3,color:ELEMENT_LABEL[elem]??"var(--text-3)",marginBottom:1 }}>
          {elem.charAt(0).toUpperCase()+elem.slice(1)}
        </div>
      )}

      {/* Row 3: VOC badge */}
      {dayData && voc && (
        <div style={{ display:"flex",alignItems:"center",gap:3,marginBottom:2 }}>
          <span title="Void-of-course Moon — a liminal 'slack water' stretch: beginnings tend to drift, so finish and rest instead. Not a warning." style={{ fontSize:8.5,padding:"0 4px",borderRadius:3,background:"#6f6a9022",color:"var(--text-2)",lineHeight:"14px",fontWeight:600 }}>◒ VOC</span>
        </div>
      )}

      {/* Aspects — the day's astrological granularity. Hidden in Simple mode
          (the default): a beginner meets element/phase/sign/ruler first, and
          taps the day for the aspect detail. */}
      {!simple && !cellQuiet && aspectEvents.length > 0 && (
        <div style={{ display:"flex",flexDirection:"column",gap:1,marginBottom:2 }}>
          {aspectEvents.slice(0,3).map((ev,i) => {
            const parts = aspectLineParts(ev);
            if (!parts) return null;
            const col = ev.quality === "caution" ? "#a05020" : ev.quality === "favorable" ? "#3a6020" : "#60708a";
            const isPP = ev.type === "aspect";
            return (
              <div key={i} title={`${ev.title}${ev.subtitle ? " — " + ev.subtitle : ""}`} style={{ fontSize:8.5,color:col,fontWeight:isPP?700:500,lineHeight:1.35,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                {parts.left}{parts.sym}{parts.right}{ev.time ? ` ${ev.time}` : ""}{isPP ? " exact" : ""}
              </div>
            );
          })}
          {aspectEvents.length > 3 && <div style={{ fontSize:7.5,color:"var(--text-3)" }}>+{aspectEvents.length-3} more</div>}
        </div>
      )}

      {/* Ingress — sign change marker (detail only) */}
      {!simple && !cellQuiet && ingressEvents.slice(0,1).map((ev,i) => (
        <div key={i} title={ev.title} style={{ fontSize:8,color:ELEMENT_COLORS.earth,marginBottom:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
          → {ev.title.replace("Moon enters ", "")}{ev.time ? ` ${ev.time}` : ""}
        </div>
      ))}

      {/* Event chips */}
      <div style={{ flex:1,overflow:"hidden",display:"flex",flexDirection:"column",gap:1 }}>
        {gcalEvents.slice(0,2).map(ev=>{
          const col = ev.color ?? "#4285f4";
          return (
            <div key={ev.id} style={{ fontSize:7,borderLeft:`2px solid ${col}`,paddingLeft:3,color:"var(--text-2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:"12px",display:"flex",gap:2,alignItems:"center" }}>
              <span style={{ color:col,fontWeight:700,fontSize:6.5 }}>G</span>
              {ev.allDay ? "" : <span style={{ color:"var(--text-3)" }}>{fmtTime(new Date(ev.start))}</span>}
              <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{ev.title}</span>
            </div>
          );
        })}
        {wins.slice(0,3).map(w=>{
          const col = WINDOW_COLORS[w.type as string]??"#888888";
          const s = new Date(w.startTime);
          return (
            <div key={w.id} style={{ fontSize:7,background:col,color:"#ffffff",borderRadius:2,padding:"0 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:"12px",display:"flex",gap:3,alignItems:"center" }}>
              <span style={{ opacity:0.8 }}>{fmtTime(s)}</span>
              <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{w.title}</span>
            </div>
          );
        })}
        {(wins.length + gcalEvents.length)>5 && <div style={{ fontSize:7,color:"var(--text-3)" }}>+{wins.length+gcalEvents.length-5} more</div>}
      </div>
    </button>
  );
}

// ── DayDetailPanel ────────────────────────────────────────────────────────────

function DayDetailPanel({ dateStr, dayData, testerId, now, cautionHits = [], onAddEvent }: {
  dateStr: string; dayData?: WeekDay; testerId: string | null; now?: TidesNow; cautionHits?: CautionDayHit[]; onAddEvent: () => void;
}) {
  const fmtTime = useTimeFormat();
  const qc = useQueryClient();
  // At the quiet lens the panel is the date, the add button and the schedule
  // — the sky cards (moon, conditions, aspects, crossings, cautions) fold.
  const { level: panelLevel } = useAstroDetail();
  const panelQuiet = panelLevel === "minimal";
  const isToday = dateStr===localToday();
  const dateObj = new Date(dateStr+"T12:00:00");
  const dayLabel = dateObj.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const elem = dayData?.element??"", phase = dayData?.moonPhase??"", qs = dayData?.qualityScore??0;
  const voc = dayData?.voidPeriods??false, crossings = (dayData?.crossings??[]) as any[];
  const moonSign = dayData?.moonSign??"", signKey = parseSign(moonSign);
  const dayRuler = dayData?.dayRuler??"";

  const { data: wins=[] } = useQuery<PlanningWindow[]>({
    queryKey:["windows",testerId,dateStr],
    queryFn: async()=>{
      const {from,to} = localDayRange(dateStr);
      const r = await fetch(`/api/planning/windows?date=${dateStr}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,{headers:{...(testerId?{"x-tester-id":testerId}:{}),"Content-Type":"application/json"}});
      return jsonArray(r);
    },
    enabled:!!testerId,
  });
  const del = useMutation({
    mutationFn: async(id:number)=>{await fetch(`/api/planning/windows/${id}`,{method:"DELETE",headers:testerId?{"x-tester-id":testerId}:{}});},
    onSuccess:()=>invalidateWindows(qc),
  });

  return (
    <div style={{ width:260,minWidth:260,borderLeft:"1px solid var(--color-border)",background: "var(--color-card-2)",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto" }}>
      <div style={{ padding:"12px 14px 10px",flexShrink:0,borderBottom:"1px solid var(--color-border)",background:elem&&dayData&&!panelQuiet?ELEMENT_TINT[elem]??"var(--color-card-2)":"var(--color-card-2)" }}>
        <div style={{ fontSize:9,color:"var(--text-3)",marginBottom:2 }}>{isToday?"Today":"Selected"}</div>
        <div style={{ fontSize:13,fontWeight:700,color: "var(--color-primary)",lineHeight:1.25,marginBottom:3 }}>{dayLabel}</div>
        {!panelQuiet && dayRuler && <div style={{ fontSize:9.5,color:PLANET_COLORS[dayRuler]??"var(--color-muted)",marginBottom:6 }}>{PLANET_ICONS[dayRuler]} Day of {dayRuler}</div>}
        <button onClick={onAddEvent} style={{ width:"100%",padding:"6px 0",borderRadius:7,border:"none",background:"#1a2a3a",color:"#ffffff",fontSize:11,fontWeight:600,cursor:"pointer" }}>+ Add event</button>
      </div>
      <div style={{ flex:1,padding:"9px 12px",display:"flex",flexDirection:"column",gap:8,overflowY:"auto" }}>
        {!dayData && !panelQuiet && <div style={{ fontSize:11,color:"var(--text-3)",textAlign:"center",padding:"24px 0" }}>No timing data.</div>}
        {dayData && (<>
          {!panelQuiet && <div style={{ background: "var(--color-card)",borderRadius:9,padding:"10px 11px",border:"1px solid var(--color-border)" }}>
            <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:4 }}>
              <span style={{ fontSize:18 }}>{MOON_EMOJI[phase]??"●"}</span>
              <div>
                <div style={{ fontSize:10.5,fontWeight:600,color: "var(--color-primary)" }}>{phase}</div>
                {signKey && <div style={{ fontSize:9,color:ELEMENT_LABEL[elem]??"var(--text-3)" }}>{SIGN_SYMBOL[signKey]} {moonSign}</div>}
              </div>
            </div>
            <div style={{ fontSize:9.5,color:"var(--text-2)",lineHeight:1.6 }}>{MOON_MEANING[phase]??""}</div>
            {voc && <div style={{ marginTop:6,padding:"4px 7px",borderRadius:5,background:"#6f6a9022",border:"1px solid #d2cee2",fontSize:9,color:"var(--text-2)" }}>◒ Void of course — a slack-water stretch. Good for finishing and rest; not for new starts.</div>}
            {/* Caution — the specific transit that flagged this day, explained.
                This is the "illuminate a specific day" the caution mark points to. */}
            {cautionHits.length > 0 && (
              <div style={{ marginTop:6,padding:"7px 9px",borderRadius:6,background:"#a0404008",border:"1px solid #a0404030",borderLeft:"3px solid #a04040" }}>
                {cautionHits.map((h, i) => {
                  const arch = CAUTION_PLANET_ARCHETYPE[h.cautionPlanet as keyof typeof CAUTION_PLANET_ARCHETYPE];
                  return (
                    <div key={i} style={{ marginBottom: i < cautionHits.length-1 ? 5 : 0 }}>
                      <div style={{ fontSize:10,fontWeight:600,color:"#a04040" }}>
                        Sun {h.aspect.toLowerCase()} your {h.cautionPlanet}{arch ? ` · ${arch.label.toLowerCase()}` : ""}
                      </div>
                      {arch && <div style={{ fontSize:9,color:"#8a6060",lineHeight:1.5,marginTop:1 }}>What to expect: {arch.feel}. Move big commitments gently for a day or two — it passes.</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>}
          {!panelQuiet && <div style={{ background: "var(--color-card)",borderRadius:9,padding:"10px 11px",border:"1px solid var(--color-border)" }}>
            <div style={{ fontSize:8,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--text-3)",marginBottom:5 }}>Conditions</div>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:5 }}>
              <div style={{ flex:1,height:4,borderRadius:2,background:"var(--color-card-2)" }}>
                <div style={{ height:"100%",borderRadius:2,width:`${(qs/7)*100}%`,background:qColor(qs) }}/>
              </div>
            </div>
            {/* element = the day's character; quality = how coherent conditions are */}
            <div style={{ fontSize:10.5,fontWeight:600,color:ELEMENT_LABEL[elem]??"var(--color-muted)",textTransform:"capitalize",marginBottom:2 }}>
              {elem} day · {dayData.quality?.replace(/_/g," ")}
            </div>
            <div style={{ fontSize:9.5,color:"var(--color-muted)",lineHeight:1.5 }}>
              {ELEMENT_NOTE[elem] ?? ""} {QUALITY_NOTE[dayData.quality ?? ""] ? `Overall: ${QUALITY_NOTE[dayData.quality ?? ""]}.` : ""}
            </div>
          </div>}
          {/* The day's Moon aspects — the fast, personal weather. Sorted so the
              one that perfects soonest reads first (same order as the rail). */}
          {(() => {
            if (panelQuiet) return null;
            const ma = ((dayData as any)?.moonAspects ?? []) as any[];
            if (!ma.length) return null;
            const ASP_SYM: Record<string,string> = { conjunction:"☌︎", opposition:"☍︎", square:"□", trine:"△", sextile:"⚹" };
            const ASP_COL: Record<string,string> = { conjunction:"#c8992e", opposition:"#c05050", square:"#c05050", trine:"#4a9060", sextile:"#4a7ab0" };
            const sorted = [...ma].sort((a,b)=> (a.applying?0:1)-(b.applying?0:1) || (a.orb??9)-(b.orb??9)).slice(0,5);
            return (
              <div style={{ background:"var(--color-card)",borderRadius:9,padding:"10px 11px",border:"1px solid var(--color-border)" }}>
                <div style={{ fontSize:9.5,fontWeight:600,color:"var(--text-1)",marginBottom:5 }}>Moon aspects</div>
                {sorted.map((a:any,i:number)=>{
                  const other = a.planet ?? (a.planet1==="Moon" ? a.planet2 : a.planet1);
                  const col = ASP_COL[a.aspect] ?? "#888888";
                  return (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:6,fontSize:10,paddingBottom:4,marginBottom:i<sorted.length-1?4:0,borderBottom:i<sorted.length-1?"1px solid var(--color-border)":"none" }}>
                      <span style={{ color:PLANET_COLORS.Moon }}>☽</span>
                      <span style={{ color:col,fontWeight:700 }}>{ASP_SYM[a.aspect] ?? "·"}</span>
                      <span style={{ color:PLANET_COLORS[other]??"var(--text-2)" }}>{PLANET_ICONS[other]??""}</span>
                      <span style={{ flex:1,color:"var(--text-2)" }}>{other}</span>
                      <span style={{ fontSize:8.5,color:a.applying?col:"var(--text-3)" }}>{a.applying?`${a.orb?.toFixed(1)}° applying`:`${a.orb?.toFixed(1)}° past`}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {!panelQuiet && crossings.length>0 && (
            <div style={{ background: "var(--color-card)",borderRadius:9,padding:"10px 11px",border:"1px solid var(--color-border)" }}>
              <div style={{ fontSize:9.5,fontWeight:600,color:"var(--text-1)",marginBottom:2 }}>Angle crossings</div>
              <div style={{ fontSize:8.5,color:"var(--text-3)",lineHeight:1.45,marginBottom:6 }}>
                Moments a planet crosses one of your local chart angles (rising point, midheaven) — a brief window, ~20 minutes, when that planet's themes peak.
              </div>
              {crossings.map((c:any,i:number)=>{
                const col = PLANET_COLORS[c.planet]??"#888888";
                const ANGLE_WORD: Record<string,string> = { ASC:"rises", MC:"culminates", DSC:"sets", IC:"grounds" };
                return (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:6,paddingBottom:5,marginBottom:i<crossings.length-1?5:0,borderBottom:i<crossings.length-1?"1px solid var(--color-border)":"none" }}>
                    <div style={{ width:20,height:20,borderRadius:"50%",background:`${col}20`,color:col,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{PLANET_ICONS[c.planet]??c.planet[0]}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10,fontWeight:500,color:"var(--text-1)" }}>{c.planet} {ANGLE_WORD[c.angle] ?? `crosses ${c.angle}`}</div>
                      <div style={{ fontSize:8,color:"var(--text-3)" }}>{c.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {(wins as PlanningWindow[]).length>0 && (
            <div style={{ background: "var(--color-card)",borderRadius:9,padding:"10px 11px",border:"1px solid var(--color-border)" }}>
              <div style={{ fontSize:11,fontWeight:600,color:"var(--color-primary)",marginBottom:6 }}>Your schedule</div>
              {(wins as PlanningWindow[]).map(w=>{
                const col = WINDOW_COLORS[w.type as string]??"#888888";
                const s = new Date(w.startTime), e = new Date(w.endTime);
                return (
                  <div key={w.id} style={{ display:"flex",alignItems:"center",gap:6,marginBottom:5,padding:"5px 7px",borderRadius:6,background:`${col}10`,border:`1px solid ${col}25` }}>
                    <div style={{ width:3,height:26,borderRadius:2,background:col,flexShrink:0 }}/>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:12,fontWeight:600,color:"var(--color-foreground)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{w.title}</div>
                      <div style={{ fontSize:10.5,color:"var(--color-muted)" }}>{fmtTime(s)} – {fmtTime(e)}</div>
                    </div>
                    <button onClick={()=>del.mutate(w.id)} aria-label={`Delete "${w.title}"`} style={{ background:"none",border:"none",color:"var(--text-3)",cursor:"pointer",fontSize:12 }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}

// ── Main Calendar ─────────────────────────────────────────────────────────────

// ── Agenda view ───────────────────────────────────────────────────────────────
// The day as a Google-Calendar-style schedule: a chronological list of the key
// sky moments (moon sign, aspects, VoC, planetary aspects, crossings) plus your
// scheduled blocks — plain language, no grid. Planetary hours and crossings are
// opt-in layers so the essentials read first (#13b, #20).
interface AgendaMoment { min: number; time: string; glyph: string; label: string; sub?: string; color: string; faded?: boolean; onDelete?: () => void; }

function AgendaView({ dateStr, today, dayData, events, windows, gcalEvents, lat, lon, showHours, showCrossings, hours, onAddEvent, onDeleteWindow }: {
  dateStr: string; today: string; dayData?: WeekDay; events: SkyEvent[]; windows: PlanningWindow[];
  gcalEvents: GCalEvent[]; lat: number; lon: number; showHours: boolean; showCrossings: boolean;
  /** Canonical hours for this date, from the server. `null` means genuinely
   *  unavailable (polar day or night), which is different from "none yet". */
  hours?: PlanetHour[] | null;
  onAddEvent: (hour?: number) => void; onDeleteWindow: (id: number) => void;
}) {
  const fmtTime = useTimeFormat();
  const realLoc = hasRealLocation(lat, lon);
  const minOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
  const elem = dayData?.element ?? "";
  const accent = ELEMENT_ACCENT[elem] ?? "#8a8278";
  const moonSign = dayData?.moonSign ?? "";
  const signKey = parseSign(moonSign);

  const moments: AgendaMoment[] = [];

  // Moon aspects + planetary aspects (the day's weather fronts) — timed ones
  for (const ev of events) {
    if ((ev.type === "moon_aspect" || ev.type === "aspect") && ev.at) {
      const d = new Date(ev.at);
      moments.push({
        min: minOf(d), time: fmtTime(d), glyph: ev.icon || (ev.type === "aspect" ? "✦" : "☽︎"),
        label: ev.title, sub: ev.subtitle, color: ev.type === "aspect" ? "var(--text-2)" : "#60708a",
      });
    }
  }

  // Void-of-course Moon — a rest window, shown as start/end bookends
  const voc = vocRangeForDate(dateStr, new Map([[dateStr, events]]));
  if (voc) {
    moments.push({ min: voc.startMin, time: minutesToTime(voc.startMin), glyph: "◒", label: "Void Moon begins", sub: "drifting — rest, don't launch", color: "var(--text-2)" });
    if (voc.endMin < 24 * 60) moments.push({ min: voc.endMin, time: minutesToTime(voc.endMin), glyph: "◓", label: "Void Moon ends", sub: "the Moon enters a new sign", color: "var(--text-2)" });
  }

  // Angle crossings (advanced layer)
  if (showCrossings && realLoc) {
    for (const c of (dayData?.crossings ?? []) as any[]) {
      const d = c.at ? new Date(c.at) : null;
      const min = d ? minOf(d) : (typeof c.time === "string" ? timeToMinutes(c.time) : 0);
      moments.push({
        min, time: d ? fmtTime(d) : c.time, glyph: PLANET_ICONS[c.planet] ?? "✷",
        label: `${c.planet} crosses your ${c.angle}`, sub: c.type, color: PLANET_COLORS[c.planet] ?? "var(--color-muted)", faded: true,
      });
    }
  }

  // Planetary hours (advanced layer) — the sky clock, woven in here (#20)
  // Handed down rather than recomputed — the parent already holds the
  // canonical hours for this date, and a second local implementation is how
  // the client and server came to disagree about the polar case.
  if (showHours) {
    for (const ph of (hours ?? [])) {
      moments.push({
        min: minOf(ph.startTime), time: fmtTime(ph.startTime), glyph: PLANET_ICONS[ph.ruler] ?? "·",
        label: `${ph.ruler} hour`, color: PLANET_COLORS[ph.ruler] ?? "var(--color-muted)", faded: true,
      });
    }
  }

  // Your scheduled blocks
  for (const w of windows) {
    const s = new Date(w.startTime);
    moments.push({ min: minOf(s), time: fmtTime(s), glyph: "▦", label: w.title, sub: "your block", color: ELEMENT_COLORS.water, onDelete: () => onDeleteWindow(w.id) });
  }
  for (const ev of gcalEvents) {
    if (ev.allDay) { moments.push({ min: -1, time: "all day", glyph: "◷", label: ev.title, sub: "Google Calendar", color: "#4a7a4a" }); continue; }
    const s = new Date(ev.start);
    moments.push({ min: minOf(s), time: fmtTime(s), glyph: "◷", label: ev.title, sub: "Google Calendar", color: "#4a7a4a" });
  }

  moments.sort((a, b) => a.min - b.min);
  const isToday = dateStr === today;
  const nowMin = isToday ? minOf(new Date()) : -999;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 40px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        {/* The day's character */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: `${accent}0e`, border: `1px solid ${accent}33`, marginBottom: 16 }}>
          <div style={{ fontSize: 22, color: accent }}>{signKey ? SIGN_SYMBOL[signKey] : "☽︎"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)" }}>
              {dayData?.tide?.character ? `${dayData.tide.character.charAt(0).toUpperCase()}${dayData.tide.character.slice(1)} Tide` : "The day"}
              {dayData?.tide?.levelLabel ? <span style={{ color: accent, fontWeight: 500 }}> · {dayData.tide.levelLabel}</span> : null}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 1 }}>
              {moonSign ? `Moon in ${moonSign.split(" ")[0]}` : ""}{dayData?.moonPhase ? ` · ${dayData.moonPhase}` : ""}
              {dayData?.dayRuler ? ` · ${dayData.dayRuler}'s day` : ""}
            </div>
          </div>
          <button onClick={() => onAddEvent()} style={{ fontSize: 10, padding: "4px 11px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)", cursor: "pointer", flexShrink: 0 }}>+ block</button>
        </div>

        {moments.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "24px 4px", textAlign: "center" }}>
            A quiet day — no standout sky moments. Turn on planetary hours for the full clock, or add a block.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {moments.map((m, i) => {
              const past = isToday && m.min >= 0 && m.min < nowMin;
              return (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 6px", borderTop: i === 0 ? "none" : "1px solid var(--color-border)", opacity: past ? 0.45 : (m.faded ? 0.7 : 1) }}>
                  <div style={{ width: 62, flexShrink: 0, fontSize: 11, color: "var(--text-3)", textAlign: "right", paddingTop: 1, fontVariantNumeric: "tabular-nums" }}>{m.time}</div>
                  <div style={{ width: 18, flexShrink: 0, textAlign: "center", fontSize: 13, color: m.color }}>{m.glyph}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: m.faded ? 400 : 600, color: m.faded ? "var(--color-muted)" : "var(--color-foreground)" }}>{m.label}</div>
                    {m.sub && <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 1 }}>{m.sub}</div>}
                  </div>
                  {m.onDelete && <button onClick={m.onDelete} title="Remove block" aria-label="Remove block" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✕</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Calendar({ testerId, now, lat, lon }: {
  testerId: string | null; now: TidesNow | undefined; lat: number; lon: number;
}) {
  const today = localToday();
  const todayYear  = parseInt(today.slice(0,4));
  const todayMonth = parseInt(today.slice(5,7))-1;

  // Phones default to the day view — a 7-column month grid at 390px is
  // unreadable slivers, and the side detail panel would crush it further.
  const isMobile = useIsMobile();
  // Phones open on the Agenda — a plain-language schedule of the day's key sky
  // moments, the "weave your day" surface (#13b). Desktop keeps the month grid.
  const [calView, setCalView]           = useState<CalView>(isMobile ? "agenda" : "month");
  // Agenda granularity — the fine layers are opt-in so the day reads as key
  // moments first; toggle them on for the full clock (#13b/#20).
  const [agHours, setAgHours]           = useState(false);
  const [agCrossings, setAgCrossings]   = useState(true);
  const [year, setYear]                 = useState(todayYear);
  const [month, setMonth]               = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showSignNames, setShowSignNames] = useState(true);
  // The astro-quiet lens: the water strip, the sky legend, the weekday planet
  // glyphs and the astro toggles fold away; events and schedule stay.
  const { level: calPageLevel } = useAstroDetail();
  const pageQuiet = calPageLevel === "minimal";
  // Same hook as the grid — one implementation, so the agenda and the week
  // can never disagree about what hour it is.
  const agendaHours = usePlanetaryHours([selectedDate], lat, lon).data;
  // Month view defaults to SIMPLE — the big/slow essentials only (element tint,
  // phase, moon sign, day ruler, VoC). Detailed adds the granular aspect times.
  // Nesting principle: an absolute beginner should meet the slow layer first.
  const [monthSimple, setMonthSimple] = useState(true);
  const [showDetail, setShowDetail]     = useState(!isMobile);
  const [addModal, setAddModal]         = useState<{date:string;hour?:number}|null>(null);
  const qc = useQueryClient();

  // A MONTH GRID IS 42 CELLS. Ask for that, not for a season.
  //
  // The first fix for the blank past-days asked for 120 forward + 45 back,
  // which is ~165 days of ephemeris — MEASURED at 11.7s, and this route is
  // synchronous, so Node's single thread blocked and every other request on
  // Calendar load queued behind it (the Log's timeline, the felt pattern and
  // the wins ledger all sat at "Loading…" forever). The blank cells were
  // real, the cure was worse than the disease.
  //
  // `days` is the TOTAL returned and `back` only shifts where it starts, so
  // 42 total starting 14 days back is exactly the six-week grid, centred on
  // the part of the month a person is usually looking at. Measured ~4s cold
  // against ~3s for the old 30-day window — a fair price for cells that are
  // no longer blank, and a third of what the first attempt cost.
  const { data: weekData }   = useTidesWeek(42, lat, lon, 14);
  const { data: eventsData } = useSkyEvents(90, lat, lon);

  // Caution days — ⚠ marks from the user's self-reported sensitivity (Currents
  // questionnaire). Only fetched when they've actually marked planets.
  const { profile: testerProfile } = useTester();
  const { data: cautionData } = useCautionDays(testerId, testerProfile?.cautionPlanets, 45);
  const cautionMap = useMemo(() => {
    const m = new Map<string, CautionDayHit[]>();
    for (const d of cautionData?.days ?? []) m.set(d.date, d.hits);
    return m;
  }, [cautionData]);

  const { data: gcalStatus } = useGCalStatus(testerId);
  const gcalStart = useMemo(() => new Date(today).toISOString(), [today]);
  const gcalEnd   = useMemo(() => new Date(Date.now() + 90*86400000).toISOString(), []);
  const { data: gcalData }   = useGCalEvents(testerId, gcalStart, gcalEnd, !!gcalStatus?.connected);

  const { data: allWindows=[] } = useQuery<PlanningWindow[]>({
    queryKey:["windows-all",testerId],
    queryFn: async()=>{
      const r = await fetch("/api/planning/windows?all=1",{headers:testerId?{"x-tester-id":testerId}:{}});
      return jsonArray(r);
    },
    enabled:!!testerId,
  });

  const delWindow = useMutation({
    mutationFn: async(id:number)=>{await fetch(`/api/planning/windows/${id}`,{method:"DELETE",headers:testerId?{"x-tester-id":testerId}:{}});},
    onSuccess:()=>invalidateWindows(qc),
  });

  const dataMap = useMemo(()=>{
    const m = new Map<string,WeekDay>();
    for (const d of weekData?.days??[]) m.set(d.date,d);
    return m;
  },[weekData]);

  const eventsMap = useMemo(()=>{
    const m = new Map<string,SkyEvent[]>();
    for (const e of eventsData?.events??[]) {
      const arr = m.get(e.date)??[];
      arr.push(e);
      m.set(e.date,arr);
    }
    return m;
  },[eventsData]);

  const gcalMap = useMemo(() => {
    const m = new Map<string, GCalEvent[]>();
    for (const ev of gcalData?.events ?? []) {
      const d = localDateStr(new Date(ev.start));
      const arr = m.get(d) ?? [];
      arr.push(ev);
      m.set(d, arr);
    }
    return m;
  }, [gcalData]);

  const windowsMap = useMemo(()=>{
    const m = new Map<string,PlanningWindow[]>();
    for (const w of allWindows) {
      const d = localDateStr(new Date(w.startTime));
      const arr = m.get(d)??[];
      arr.push(w);
      m.set(d,arr);
    }
    return m;
  },[allWindows]);

  const grid = useMemo(()=>buildMonthGrid(year,month),[year,month]);

  function prevPeriod() {
    if (calView==="month") { if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); }
    else if (calView==="week") setSelectedDate(d=>addDays(d,-7));
    else setSelectedDate(d=>addDays(d,-1));
  }
  function nextPeriod() {
    if (calView==="month") { if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); }
    else if (calView==="week") setSelectedDate(d=>addDays(d,7));
    else setSelectedDate(d=>addDays(d,1));
  }
  function goToday() { setYear(todayYear);setMonth(todayMonth);setSelectedDate(today); }

  // Single-key view switching (Notion Calendar's idiom): D/W/M/A for the four
  // views, T for today, ←/→ to page. Deliberately plain keys with no modifier —
  // that's the whole point of the pattern — so every handler bails when focus
  // is in a field or a modifier is held, or we'd eat characters mid-typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      const view = ({ d: "day", w: "week", m: "month", a: "agenda" } as Record<string, CalView>)[k];
      if (view) { setCalView(view); e.preventDefault(); return; }
      if (k === "t") { goToday(); e.preventDefault(); return; }
      if (e.key === "ArrowLeft") { prevPeriod(); e.preventDefault(); return; }
      if (e.key === "ArrowRight") { nextPeriod(); e.preventDefault(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function periodLabel() {
    if (calView==="month") return `${MONTH_NAMES[month]} ${year}`;
    if (calView==="week") {
      const dates = getWeekDates(selectedDate);
      const f = new Date(dates[0]+"T12:00:00"), l = new Date(dates[6]+"T12:00:00");
      return `${f.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${l.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
    }
    return new Date(selectedDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  }

  function vocFracForDate(dateStr: string): {top:number;height:number}|null {
    const voc = vocRangeForDate(dateStr,eventsMap);
    if (!voc) return null;
    const DAY_START=6, DAY_END=24, SPAN=DAY_END-DAY_START;
    const vocH = voc.startMin/60, endH = Math.min(DAY_END,voc.endMin/60);
    const top    = Math.max(0,(vocH-DAY_START)/SPAN);
    const height = Math.max(0.05,Math.min(1-top,(endH-vocH)/SPAN));
    return {top,height};
  }

  const weekDates = calView!=="month"?(calView==="week"?getWeekDates(selectedDate):[selectedDate]):[];

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      {/* Topbar */}
      <div style={{ padding:"7px 14px",borderBottom:"1px solid var(--color-border)",background: "var(--color-rail)",flexShrink:0,display:"flex",alignItems:"center",gap:7,flexWrap:"wrap" }}>
        <button onClick={prevPeriod} title="Previous — press ←" aria-label={`Previous ${calView}`} style={{ fontSize:15,padding:"1px 9px",borderRadius:5,border:"1px solid var(--color-border)",background: "var(--color-card)",color:"var(--text-2)",cursor:"pointer",lineHeight:1.5 }}>‹</button>
        <div style={{ fontSize:13,fontWeight:600,color: "var(--color-primary)",minWidth:150 }}>{periodLabel()}</div>
        <button onClick={nextPeriod} title="Next — press →" aria-label={`Next ${calView}`} style={{ fontSize:15,padding:"1px 9px",borderRadius:5,border:"1px solid var(--color-border)",background: "var(--color-card)",color:"var(--text-2)",cursor:"pointer",lineHeight:1.5 }}>›</button>
        <button onClick={goToday} title="Today — press T" style={{ fontSize:10,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background: "var(--color-card)",color:"var(--text-2)",cursor:"pointer" }}>Today</button>

        <div style={{ display:"flex",background:"var(--color-card-2)",border:"1px solid var(--color-border)",borderRadius:7,padding:3,gap:1 }}>
          {(["agenda","day","week","month"] as CalView[]).map(v=>(
            // The title carries the shortcut — an undiscoverable shortcut is a
            // shortcut nobody uses.
            <button key={v} onClick={()=>setCalView(v)} title={`${v[0].toUpperCase()}${v.slice(1)} — press ${v[0].toUpperCase()}`} style={{
              fontSize:10,padding:"3px 11px",borderRadius:5,border:"none",cursor:"pointer",
              background:calView===v?"var(--color-card)":"transparent",color:calView===v?"var(--color-primary)":"var(--text-3)",
              fontWeight:calView===v?600:400,textTransform:"capitalize",
            }}>{v}</button>
          ))}
        </div>

        <button onClick={()=>setAddModal({date:selectedDate})} style={{ fontSize:10,padding:"3px 11px",borderRadius:6,border:"none",background:"#1a2a3a",color:"#ffffff",cursor:"pointer",fontWeight:600 }}>+ Event</button>

        {calView==="agenda" && !pageQuiet && (
          <>
            <button onClick={()=>setAgHours(v=>!v)} title="Show every planetary hour" style={{ fontSize:9,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background:agHours?"#fff8f0":"var(--color-background)",color:agHours?"#b07020":"var(--text-3)",cursor:"pointer" }}>Planetary hours</button>
            <button onClick={()=>setAgCrossings(v=>!v)} title="Show angle crossings (advanced)" style={{ fontSize:9,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background:agCrossings?"#fff8f0":"var(--color-background)",color:agCrossings?"#b07020":"var(--text-3)",cursor:"pointer" }}>Crossings</button>
          </>
        )}

        {calView==="month" && (
          <>
            {!pageQuiet && (
              <button onClick={()=>setMonthSimple(v=>!v)} title={monthSimple?"Show aspect times and detail":"Show just the essentials"} style={{ fontSize:9,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background:monthSimple?"var(--color-background)":"#fff8f0",color:monthSimple?"var(--color-muted)":"#b07020",cursor:"pointer" }}>{monthSimple?"Simple":"Detailed"}</button>
            )}
            {!pageQuiet && <button onClick={()=>setShowSignNames(v=>!v)} style={{ fontSize:9,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background:showSignNames?"#fff8f0":"var(--color-background)",color:showSignNames?"#b07020":"var(--text-3)",cursor:"pointer" }}>Signs</button>}
            <button onClick={()=>setShowDetail(v=>!v)} style={{ fontSize:9,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background:showDetail?"var(--color-background)":"transparent",color:"var(--color-muted)",cursor:"pointer" }}>{showDetail?"Hide panel":"Show panel"}</button>
          </>
        )}

        <div style={{ marginLeft:"auto" }}><GCalButton testerId={testerId} qc={qc}/></div>
      </div>

      {/* The water ahead — the 30-day wave chart, inherited from the retired
          Almanac tab. Tap a bar to jump the calendar to that day. */}
      {!pageQuiet && <QualityStrip week={weekData} days={30} onPick={(d)=>{
        setSelectedDate(d);
        if (calView==="month") { setYear(parseInt(d.slice(0,4))); setMonth(parseInt(d.slice(5,7))-1); }
      }}/>}

      {/* On phones the detail panel stacks below the grid instead of crushing it */}
      <div style={{ flex:1,display:"flex",overflow:isMobile?"auto":"hidden",flexDirection:isMobile?"column":"row" }}>
        {/* Month view */}
        {calView==="month" && (
          <>
            <div style={{ flex:1,display:"flex",flexDirection:"column",overflowY:"auto",padding:"0 10px 10px",minWidth:0 }}>
              {/* Legend — every mark on the grid, named. Nothing to name at
                  the quiet lens; the marks it explains are folded away. */}
              {!pageQuiet && <div style={{ display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",paddingTop:8,fontSize:9,color:"var(--color-muted)",flexShrink:0 }}>
                <span>tint = the day's element (Moon's sign)</span>
                {!monthSimple && <span style={{ color:"#60708a" }}>☽□♀ = Moon aspect, with time</span>}
                {!monthSimple && <span style={{ color:"#60708a",fontWeight:700 }}>☉□♄ = planets exact that day</span>}
                <span><span style={{ background:"#6f6a9022",color:"var(--text-2)",padding:"0 3px",borderRadius:2,fontWeight:600 }}>◒ VOC</span> = void Moon (rest, don't launch)</span>
                {(testerProfile?.cautionPlanets?.length ?? 0) > 0 && <span>⚠️ = a caution day for you — tap the day to see what & why</span>}
              </div>}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4,paddingTop:6,flexShrink:0 }}>
                {DOW_SHORT.map((d,i)=>{
                  const ruler = WEEKDAY_RULERS[i];
                  return (
                    <div key={d} title={pageQuiet ? undefined : `${ruler}'s day`} style={{ textAlign:"center",fontSize:9,fontWeight:600,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.4px",padding:"3px 0" }}>
                      {d} {!pageQuiet && <span style={{ color:PLANET_COLORS[ruler]??"var(--text-3)",opacity:0.7 }}>{PLANET_ICONS[ruler]}</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,flex:1 }}>
                {grid.map((dateStr,i)=>{
                  if (!dateStr) return <div key={`pad-${i}`}/>;
                  return (
                    <MonthCell
                      key={dateStr} dateStr={dateStr} dayData={dataMap.get(dateStr)}
                      isToday={dateStr===today} isSelected={dateStr===selectedDate}
                      isPast={dateStr<today} showSignNames={showSignNames}
                      vocFrac={vocFracForDate(dateStr)}
                      wins={windowsMap.get(dateStr)??[]}
                      gcalEvents={gcalMap.get(dateStr)??[]}
                      skyEvents={eventsMap.get(dateStr)??[]}
                      cautionHits={cautionMap.get(dateStr)??[]}
                      simple={monthSimple}
                      onClick={()=>setSelectedDate(dateStr)}
                    />
                  );
                })}
              </div>
            </div>
            {showDetail && (
              <DayDetailPanel
                dateStr={selectedDate} dayData={dataMap.get(selectedDate)}
                testerId={testerId} now={now}
                cautionHits={cautionMap.get(selectedDate) ?? []}
                onAddEvent={()=>setAddModal({date:selectedDate})}
              />
            )}
          </>
        )}

        {/* Agenda — the day as a plain schedule of key sky moments (#13b/#20) */}
        {calView==="agenda" && (
          <AgendaView
            hours={agendaHours?.hours?.[selectedDate] ?? []}
            dateStr={selectedDate} today={today}
            // The quiet lens hands the agenda a plain day: no sky moments, no
            // day-character read — the schedule and the calendar events stay.
            dayData={pageQuiet ? undefined : dataMap.get(selectedDate)}
            events={pageQuiet ? [] : (eventsMap.get(selectedDate) ?? [])}
            windows={windowsMap.get(selectedDate) ?? []}
            gcalEvents={gcalMap.get(selectedDate) ?? []}
            lat={lat} lon={lon}
            showHours={!pageQuiet && agHours} showCrossings={!pageQuiet && agCrossings}
            onAddEvent={(hour)=>setAddModal({date:selectedDate,hour})}
            onDeleteWindow={id=>delWindow.mutate(id)}
          />
        )}

        {/* Week / Day view */}
        {(calView==="week"||calView==="day") && (
          <TimeGrid
            dates={weekDates} dataMap={dataMap} windowsMap={windowsMap} eventsMap={eventsMap}
            gcalMap={gcalMap} cautionMap={cautionMap}
            testerId={testerId} today={today} lat={lat} lon={lon}
            isDay={calView==="day"}
            onAddEvent={(date,hour)=>setAddModal({date,hour})}
            onDeleteWindow={id=>delWindow.mutate(id)}
          />
        )}
      </div>

      {addModal && (
        <EventModal dateStr={addModal.date} startHour={addModal.hour} testerId={testerId} onClose={()=>setAddModal(null)}/>
      )}
    </div>
  );
}
