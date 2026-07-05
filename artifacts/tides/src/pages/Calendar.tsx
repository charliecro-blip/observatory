import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTidesWeek, useSkyEvents, useGCalStatus, useGCalEvents, useCautionDays, type GCalEvent, type CautionDayHit } from "@/hooks/useTides";
import { useTimeFormat } from "@/contexts/preferences-context";
import { useTester } from "@/contexts/tester-context";
import { useIsMobile } from "@/hooks/useIsMobile";
import { CAUTION_PLANET_ARCHETYPE } from "@/lib/tester-profile";
import type { TidesNow, WeekDay, PlanningWindow, SkyEvent } from "@/lib/types";
import { PLANET_GLYPH as PLANET_ICONS, SIGN_GLYPH as SIGN_SYMBOL } from "@/lib/glyphs";

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
const ELEMENT_TINT: Record<string, string> = {
  water:"#ebf1f7",fire:"#f9f0e8",earth:"#edf3e8",air:"#f4efdd",
};
const ELEMENT_ACCENT: Record<string, string> = {
  water:"#3a5a80",fire:"#8a3a20",earth:"#3a6030",air:"#c19a3a",
};
const ELEMENT_LABEL: Record<string, string> = {
  water:"#4a6a90",fire:"#9a4a30",earth:"#4a7040",air:"#c19a3a",
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
const PLANET_COLORS: Record<string, string> = {
  Sun:"#c08020",Moon:"#7080a0",Mercury:"#608060",Venus:"#a06080",
  Mars:"#c04040",Jupiter:"#6040a0",Saturn:"#807060",
  Uranus:"#3090a0",Neptune:"#5060b0",Pluto:"#703060",
};
const ASPECT_SYM: Record<string, string> = {
  conjunction:"☌", opposition:"☍", square:"□", trine:"△", sextile:"⚹",
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
  social:"#d06060",relationship:"#b04080",recovery:"#60a080",study:"#5060a0",launch:"#c04040",retreat:"#6080a0",
};
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const CHALDEAN: string[] = ["Saturn","Jupiter","Mars","Sun","Venus","Mercury","Moon"];
const WEEKDAY_RULERS: string[] = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];

type CalView = "month" | "week" | "day";
type LayerLevel = 0 | 1 | 2;

interface PlanetHour {
  ruler: string;
  startTime: Date;
  endTime: Date;
  isDayHour: boolean;
  hourNumber: number;
}

// ── Astro Helpers ─────────────────────────────────────────────────────────────

function approxSunriseSunset(dateStr: string, lat: number, lon: number): { sunrise: Date; sunset: Date } | null {
  const base = new Date(dateStr + "T12:00:00");
  const jd = base.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * Math.PI / 180;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  const sinDec = Math.sin(23.439 * Math.PI / 180) * Math.sin(lambda);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat * Math.PI / 180) * sinDec) /
               (Math.cos(lat * Math.PI / 180) * cosDec);
  if (Math.abs(cosH) > 1) return null;
  const H = Math.acos(cosH) * 180 / Math.PI;
  const B = (360 / 365) * (n - 81) * Math.PI / 180;
  const EqT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const lstNoon = 12 - lon / 15 - EqT / 60;
  const sunriseH = lstNoon - H / 15;
  const sunsetH  = lstNoon + H / 15;
  const midnight = new Date(dateStr + "T00:00:00");
  return {
    sunrise: new Date(midnight.getTime() + sunriseH * 3600000),
    sunset:  new Date(midnight.getTime() + sunsetH  * 3600000),
  };
}

function computeAllPlanetaryHours(dateStr: string, lat: number, lon: number): PlanetHour[] {
  const ss   = approxSunriseSunset(dateStr, lat, lon);
  const ss1  = approxSunriseSunset(addDays(dateStr, 1), lat, lon);
  const ssP  = approxSunriseSunset(addDays(dateStr, -1), lat, lon);
  if (!ss || !ss1 || !ssP) return [];
  const { sunrise, sunset } = ss;
  const { sunrise: nextSunrise } = ss1;
  const { sunset: prevSunset } = ssP;

  const dayRuler = WEEKDAY_RULERS[sunrise.getDay()];
  const dayRulerIdx = CHALDEAN.indexOf(dayRuler);
  const prevDayRuler = WEEKDAY_RULERS[prevSunset.getDay()];
  const prevRulerIdx = CHALDEAN.indexOf(prevDayRuler);

  const dayLen   = sunset.getTime() - sunrise.getTime();
  const dayH     = dayLen / 12;
  const nightLen = nextSunrise.getTime() - sunset.getTime();
  const nightH   = nightLen / 12;

  // Night hours before sunrise (last night = prevDay ruler offset 12)
  const preHours: PlanetHour[] = [];
  const preDur = sunrise.getTime() - prevSunset.getTime();
  const preH   = preDur / 12;
  for (let i = 0; i < 12; i++) {
    const s = prevSunset.getTime() + i * preH;
    const e = prevSunset.getTime() + (i + 1) * preH;
    if (e > sunrise.getTime()) break;
    if (new Date(e).toISOString().slice(0,10) !== dateStr) continue;
    preHours.push({
      ruler: CHALDEAN[(prevRulerIdx + 12 + i) % 7],
      startTime: new Date(s), endTime: new Date(e),
      isDayHour: false, hourNumber: 12 + i + 1,
    });
  }

  const hours: PlanetHour[] = [...preHours];
  for (let i = 0; i < 12; i++) {
    hours.push({
      ruler: CHALDEAN[(dayRulerIdx + i) % 7],
      startTime: new Date(sunrise.getTime() + i * dayH),
      endTime:   new Date(sunrise.getTime() + (i + 1) * dayH),
      isDayHour: true, hourNumber: i + 1,
    });
  }
  for (let i = 0; i < 12; i++) {
    hours.push({
      ruler: CHALDEAN[(dayRulerIdx + 12 + i) % 7],
      startTime: new Date(sunset.getTime() + i * nightH),
      endTime:   new Date(sunset.getTime() + (i + 1) * nightH),
      isDayHour: false, hourNumber: i + 1,
    });
  }
  return hours;
}

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
    dates.push(nd.toISOString().slice(0, 10));
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
  return d.toISOString().slice(0, 10);
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
      await fetch("/api/planning/windows", {
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
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["windows"]}); onClose(); },
  });
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:999,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:100 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background: "var(--color-card)",borderRadius:14,padding:"22px 24px",width:380,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",border:"1px solid var(--color-border)" }}>
        <div style={{ fontSize:14,fontWeight:600,color: "var(--color-primary)",marginBottom:14 }}>
          New event · {new Date(dateStr+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          <input autoFocus value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
            onKeyDown={e=>{if(e.key==="Enter"&&form.title.trim())save.mutate();if(e.key==="Escape")onClose();}}
            placeholder={WINDOW_LABELS[form.type]}
            style={{ padding:"9px 12px",borderRadius:8,border:"1px solid var(--color-border)",fontSize:13,outline:"none",background: "var(--color-card-2)" }}/>
          <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
            style={{ padding:"8px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card-2)",color:"#444" }}>
            {WINDOW_TYPES.map(t=><option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
          </select>
          <div style={{ display:"flex",gap:8 }}>
            <label style={{ flex:1,fontSize:11,color:"#888" }}>Start
              <input type="time" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))}
                style={{ display:"block",marginTop:3,width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card-2)" }}/>
            </label>
            <label style={{ flex:1,fontSize:11,color:"#888" }}>End
              <input type="time" value={form.endTime} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))}
                style={{ display:"block",marginTop:3,width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card-2)" }}/>
            </label>
          </div>
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
            placeholder="Notes (optional)" rows={2}
            style={{ padding:"8px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card-2)",resize:"vertical",outline:"none" }}/>
        </div>
        <div style={{ display:"flex",gap:8,marginTop:14 }}>
          <button onClick={onClose} style={{ flex:1,padding:"9px 0",borderRadius:8,border:"1px solid var(--color-border)",background:"transparent",color:"#888",fontSize:12,cursor:"pointer" }}>Cancel</button>
          <button onClick={()=>save.mutate()} disabled={save.isPending}
            style={{ flex:2,padding:"9px 0",borderRadius:8,border:"none",background:"#1a2a3a",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer" }}>
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
  const col = WINDOW_COLORS[win.type as string] ?? "#888";
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
      <div style={{ fontSize:9.5,fontWeight:600,color:"#fff",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
        {win.title}
      </div>
      {heightPct>0.04 && <div style={{ fontSize:8,color:"rgba(255,255,255,0.75)",marginTop:1 }}>{shortTime}</div>}
      <button onClick={e=>{e.stopPropagation();onDelete();}} style={{ position:"absolute",top:2,right:3,background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:9,cursor:"pointer",lineHeight:1,padding:0 }}>✕</button>
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
      <div style={{ fontSize:8.5, fontWeight:600, color:"#fff", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
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
      await fetch("/api/integrations/google-cal/disconnect", {
        method: "DELETE",
        headers: testerId ? { "x-tester-id": testerId } : {},
      });
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
    return (
      <div title="Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to enable" style={{
        fontSize:9, padding:"3px 9px", borderRadius:6, border:"1px solid var(--color-border)",
        background:"#f8f8f8", color:"#ccc", cursor:"not-allowed",
        display:"flex", alignItems:"center", gap:4,
      }}>
        <span style={{ fontSize:10 }}>📅</span> Google Cal
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <div style={{
          fontSize:9, padding:"3px 9px", borderRadius:6, border:"1px solid #b0d0b0",
          background:"#f0faf0", color:"#408040",
          display:"flex", alignItems:"center", gap:4,
        }}>
          <span style={{ fontSize:10 }}>📅</span>
          <span>{status.email ?? "Google Cal"}</span>
        </div>
        <button onClick={() => disconnect.mutate()} title="Disconnect Google Calendar" style={{
          fontSize:9, padding:"2px 6px", borderRadius:5, border:"1px solid #e0ccc0",
          background:"#fff8f5", color:"#c06040", cursor:"pointer",
        }}>✕</button>
      </div>
    );
  }

  return (
    <button onClick={connect} style={{
      fontSize:9, padding:"3px 9px", borderRadius:6, border:"1px solid var(--color-border)",
      background: "var(--color-card)", color:"#555", cursor:"pointer",
      display:"flex", alignItems:"center", gap:4,
    }}>
      <span style={{ fontSize:10 }}>📅</span> Connect Google Cal
    </button>
  );
}

// ── TimeGrid (week + day) ─────────────────────────────────────────────────────

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
  const HOUR_START = 5, HOUR_END = 23, HOURS = HOUR_END - HOUR_START;
  const ROW_H = isDay ? 60 : 48;
  const LABEL_W = isDay ? 52 : 44;
  // Day: wide labeled planetary hour band left of grid; week: full-width subtle tint
  const PLANET_BAR_W = isDay ? 68 : 0;
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const realLocation = hasRealLocation(lat, lon);

  const planetaryHoursMap = useMemo(() => {
    const m = new Map<string, PlanetHour[]>();
    for (const d of dates) m.set(d, computeAllPlanetaryHours(d, lat, lon));
    return m;
  }, [dates, lat, lon]);

  // Planetary hours legend height (day view only, fixed below grid)
  const LEGEND_H = isDay ? 108 : 0;

  // One shared vertical scroll for the gutter + every day column, so the hour
  // labels stay locked to the grid rows while you scroll (previously each column
  // scrolled on its own and the labels sat still — the confusing part).
  const HDR_H = (isDay ? 48 : 44) + 32; // day/date block + astro strip — matches each column header

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
              <span style={{ fontSize:9,color:"#bbb",fontWeight:500 }}>{fmtHour(HOUR_START+i)}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {dates.map(dateStr => {
          const dayData = dataMap.get(dateStr);
          const isToday = dateStr===today;
          const ec = ELEMENT_ACCENT[dayData?.element ?? ""] ?? "#888";
          const et = ELEMENT_TINT[dayData?.element ?? ""] ?? "#fff";
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
          const ASTRO_STRIP_H = 32;

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
                  <div style={{ fontSize:isDay?10:9,color:isToday?ec:"#bbb",textTransform:"uppercase",fontWeight:600,letterSpacing:"0.3px" }}>{dayLabel}</div>
                  <div style={{
                    fontSize:isDay?18:15,fontWeight:700,color:isToday?"#fff":"#444",lineHeight:1,
                    width:isDay?28:22,height:isDay?28:22,borderRadius:"50%",
                    background:isToday?ec:"transparent",
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>{dayNum}</div>
                  {isDay && dayRuler && (
                    <div style={{ fontSize:8,color:PLANET_COLORS[dayRuler]??"#aaa" }}>{PLANET_ICONS[dayRuler]} {dayRuler}</div>
                  )}
                </div>

                {/* Astro strip */}
                <div style={{
                  height:ASTRO_STRIP_H,borderTop:"1px solid var(--color-border)",
                  background:elem?et:"var(--color-card-2)",
                  padding:"3px 6px",display:"flex",flexDirection:"column",justifyContent:"center",gap:2,
                }}>
                  <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                    {phase && <span style={{ fontSize:9 }}>{MOON_EMOJI[phase]??""}</span>}
                    {signKey && <span style={{ fontSize:9,color:ELEMENT_LABEL[elem]??"#888",fontWeight:500 }}>{SIGN_SYMBOL[signKey]} {isDay ? moonSign.split(" ")[0] : (moonSign.split(" ")[0]??"")} </span>}
                    {/* week: show current planetary hour planet */}
                    {!isDay && isToday && nowHour && (
                      <span title={`${nowHour.ruler} hour`} style={{ marginLeft:"auto",fontSize:9,color:PLANET_COLORS[nowHour.ruler]??"#888" }}>{PLANET_ICONS[nowHour.ruler]}</span>
                    )}
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:4,overflow:"hidden" }}>
                    {voc && <span title="Void-of-course Moon — a liminal 'slack water' stretch: beginnings tend to drift, so finish and rest instead. Not a warning, just a different kind of time." style={{ fontSize:8,padding:"0 4px",borderRadius:3,background:"#ece9f4",color:"#6f6a90",border:"1px solid #d2cee2",lineHeight:"14px",whiteSpace:"nowrap" }}>◒ VOC</span>}
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
                </div>
              </div>

              {/* Day view: planetary hours legend ABOVE scroll area */}
              {isDay && (
                <div style={{ flexShrink:0,height:LEGEND_H,borderBottom:"1px solid var(--color-border)",background:"#f8f5f0",padding:"6px 8px",overflowY:"auto" }}>
                  <div style={{ fontSize:7.5,color:"#bbb",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.4px" }}>Planetary hours</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:2 }}>
                    {allHours.map((ph,i)=>{
                      const col = PLANET_COLORS[ph.ruler]??"#888";
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
              <div style={{ position:"relative",background:isPast?"var(--color-card-2)":"#fff" }}>
                <div style={{ position:"relative",height:HOURS*ROW_H }}>

                  {/* Planetary hours — week: full-width tint; day: left bar */}
                  {allHours.map((ph,phi) => {
                    const startMs = ph.startTime.getTime();
                    const endMs   = ph.endTime.getTime();
                    const midnight = new Date(dateStr+"T00:00:00").getTime();
                    const startH = (startMs - midnight) / 3600000;
                    const endH   = (endMs   - midnight) / 3600000;
                    const topPx  = Math.max(0, (startH - HOUR_START) / HOURS * HOURS * ROW_H);
                    const botPx  = Math.min(HOURS*ROW_H, (endH - HOUR_START) / HOURS * HOURS * ROW_H);
                    if (botPx<=0||topPx>=HOURS*ROW_H) return null;
                    const col = PLANET_COLORS[ph.ruler] ?? "#888";
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
                  {voc && (()=>{
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
                        <div style={{ position:"absolute",top:2,left:4,fontSize:7,color:"#8a86a8",fontWeight:600 }}>◒ VOC</div>
                      </div>
                    );
                  })()}

                  {/* Aspect crossing lines — only with real location */}
                  {crossings.map((c:any,ci:number) => {
                    if (!c.time) return null;
                    const mins = timeToMinutes(c.time);
                    const topPx = ((mins/60-HOUR_START)/HOURS)*HOURS*ROW_H;
                    if (topPx<0||topPx>HOURS*ROW_H) return null;
                    const pCol = PLANET_COLORS[c.planet] ?? "#c8b870";
                    return (
                      <div key={ci} style={{
                        position:"absolute",left:PLANET_BAR_W,right:0,
                        top:topPx-18,height:36,zIndex:4,pointerEvents:"none",
                        background:`linear-gradient(to bottom,transparent 0%,${pCol}35 40%,${pCol}55 50%,${pCol}35 60%,transparent 100%)`,
                      }}>
                        <div style={{ position:"absolute",bottom:1,right:3,fontSize:7.5,color:pCol,fontWeight:600,background:"rgba(255,255,255,0.75)",padding:"0 2px",borderRadius:2 }}>
                          {PLANET_ICONS[c.planet]??c.planet[0]} {c.angle}
                        </div>
                      </div>
                    );
                  })}

                  {/* Lunar (and planet-planet) aspects — timed markers on the day itself */}
                  {(eventsMap.get(dateStr) ?? []).filter(ev => (ev.type==="moon_aspect"||ev.type==="aspect") && ev.at).map((ev,ei) => {
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
  const dayNum = parseInt(dateStr.split("-")[2]);
  const elem = dayData?.element ?? "";
  const phase = dayData?.moonPhase ?? "";
  const voc = dayData?.voidPeriods ?? false;
  const moonSign = dayData?.moonSign ?? "";
  const signKey = parseSign(moonSign);
  const dayRuler = dayData?.dayRuler ?? "";
  const bg = dayData && !isPast ? (ELEMENT_TINT[elem] ?? "var(--color-card-2)") : "var(--color-card-2)";
  const border = isSelected ? "2px solid #1a2a3a" : isToday ? "2px solid #c09040" : "2px solid transparent";
  const rulerCol = PLANET_COLORS[dayRuler] ?? "#999";

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
          <span style={{ fontSize:16,lineHeight:1,fontWeight:isToday?700:500,color:isToday?"#b07820":"#333" }}>{dayNum}</span>
          {isToday && <span style={{ fontSize:8,color:"#b07820",fontWeight:600,lineHeight:1.2 }}>TODAY</span>}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:4 }}>
          {cautionHits.length > 0 && (
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
        <div style={{ fontSize:11,fontWeight:500,lineHeight:1.3,color:ELEMENT_LABEL[elem]??"#aaa",marginBottom:1 }}>
          {SIGN_SYMBOL[signKey]} {moonSign.split(" ").slice(0,2).join(" ")}
        </div>
      )}
      {dayData && !showSignNames && elem && (
        <div style={{ fontSize:11,fontWeight:500,lineHeight:1.3,color:ELEMENT_LABEL[elem]??"#aaa",marginBottom:1 }}>
          {elem.charAt(0).toUpperCase()+elem.slice(1)}
        </div>
      )}

      {/* Row 3: VOC badge */}
      {dayData && voc && (
        <div style={{ display:"flex",alignItems:"center",gap:3,marginBottom:2 }}>
          <span title="Void-of-course Moon — a liminal 'slack water' stretch: beginnings tend to drift, so finish and rest instead. Not a warning." style={{ fontSize:8.5,padding:"0 4px",borderRadius:3,background:"#ece9f4",color:"#6f6a90",lineHeight:"14px",fontWeight:600 }}>◒ VOC</span>
        </div>
      )}

      {/* Aspects — the day's astrological granularity. Hidden in Simple mode
          (the default): a beginner meets element/phase/sign/ruler first, and
          taps the day for the aspect detail. */}
      {!simple && aspectEvents.length > 0 && (
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
          {aspectEvents.length > 3 && <div style={{ fontSize:7.5,color:"#bbb" }}>+{aspectEvents.length-3} more</div>}
        </div>
      )}

      {/* Ingress — sign change marker (detail only) */}
      {!simple && ingressEvents.slice(0,1).map((ev,i) => (
        <div key={i} title={ev.title} style={{ fontSize:8,color:"#4a7040",marginBottom:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
          → {ev.title.replace("Moon enters ", "")}{ev.time ? ` ${ev.time}` : ""}
        </div>
      ))}

      {/* Event chips */}
      <div style={{ flex:1,overflow:"hidden",display:"flex",flexDirection:"column",gap:1 }}>
        {gcalEvents.slice(0,2).map(ev=>{
          const col = ev.color ?? "#4285f4";
          return (
            <div key={ev.id} style={{ fontSize:7,borderLeft:`2px solid ${col}`,paddingLeft:3,color:"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:"12px",display:"flex",gap:2,alignItems:"center" }}>
              <span style={{ color:col,fontWeight:700,fontSize:6.5 }}>G</span>
              {ev.allDay ? "" : <span style={{ color:"#aaa" }}>{fmtTime(new Date(ev.start))}</span>}
              <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{ev.title}</span>
            </div>
          );
        })}
        {wins.slice(0,3).map(w=>{
          const col = WINDOW_COLORS[w.type as string]??"#888";
          const s = new Date(w.startTime);
          return (
            <div key={w.id} style={{ fontSize:7,background:col,color:"#fff",borderRadius:2,padding:"0 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:"12px",display:"flex",gap:3,alignItems:"center" }}>
              <span style={{ opacity:0.8 }}>{fmtTime(s)}</span>
              <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{w.title}</span>
            </div>
          );
        })}
        {(wins.length + gcalEvents.length)>5 && <div style={{ fontSize:7,color:"#aaa" }}>+{wins.length+gcalEvents.length-5} more</div>}
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
  const isToday = dateStr===new Date().toISOString().slice(0,10);
  const dateObj = new Date(dateStr+"T12:00:00");
  const dayLabel = dateObj.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const elem = dayData?.element??"", phase = dayData?.moonPhase??"", qs = dayData?.qualityScore??0;
  const voc = dayData?.voidPeriods??false, crossings = (dayData?.crossings??[]) as any[];
  const moonSign = dayData?.moonSign??"", signKey = parseSign(moonSign);
  const dayRuler = dayData?.dayRuler??"";

  const { data: wins=[] } = useQuery<PlanningWindow[]>({
    queryKey:["windows",testerId,dateStr],
    queryFn: async()=>{
      const r = await fetch(`/api/planning/windows?date=${dateStr}`,{headers:{...(testerId?{"x-tester-id":testerId}:{}),"Content-Type":"application/json"}});
      return r.json();
    },
    enabled:!!testerId,
  });
  const del = useMutation({
    mutationFn: async(id:number)=>{await fetch(`/api/planning/windows/${id}`,{method:"DELETE",headers:testerId?{"x-tester-id":testerId}:{}});},
    onSuccess:()=>qc.invalidateQueries({queryKey:["windows"]}),
  });

  return (
    <div style={{ width:260,minWidth:260,borderLeft:"1px solid var(--color-border)",background: "var(--color-card-2)",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto" }}>
      <div style={{ padding:"12px 14px 10px",flexShrink:0,borderBottom:"1px solid var(--color-border)",background:elem&&dayData?ELEMENT_TINT[elem]??"var(--color-card-2)":"var(--color-card-2)" }}>
        <div style={{ fontSize:9,color:"#aaa",marginBottom:2 }}>{isToday?"Today":"Selected"}</div>
        <div style={{ fontSize:13,fontWeight:700,color: "var(--color-primary)",lineHeight:1.25,marginBottom:3 }}>{dayLabel}</div>
        {dayRuler && <div style={{ fontSize:9.5,color:PLANET_COLORS[dayRuler]??"#888",marginBottom:6 }}>{PLANET_ICONS[dayRuler]} Day of {dayRuler}</div>}
        <button onClick={onAddEvent} style={{ width:"100%",padding:"6px 0",borderRadius:7,border:"none",background:"#1a2a3a",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer" }}>+ Add event</button>
      </div>
      <div style={{ flex:1,padding:"9px 12px",display:"flex",flexDirection:"column",gap:8,overflowY:"auto" }}>
        {!dayData && <div style={{ fontSize:11,color:"#bbb",textAlign:"center",padding:"24px 0" }}>No timing data.</div>}
        {dayData && (<>
          <div style={{ background: "var(--color-card)",borderRadius:9,padding:"10px 11px",border:"1px solid var(--color-border)" }}>
            <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:4 }}>
              <span style={{ fontSize:18 }}>{MOON_EMOJI[phase]??"●"}</span>
              <div>
                <div style={{ fontSize:10.5,fontWeight:600,color: "var(--color-primary)" }}>{phase}</div>
                {signKey && <div style={{ fontSize:9,color:ELEMENT_LABEL[elem]??"#aaa" }}>{SIGN_SYMBOL[signKey]} {moonSign}</div>}
              </div>
            </div>
            <div style={{ fontSize:9.5,color:"#666",lineHeight:1.6 }}>{MOON_MEANING[phase]??""}</div>
            {voc && <div style={{ marginTop:6,padding:"4px 7px",borderRadius:5,background:"#ece9f4",border:"1px solid #d2cee2",fontSize:9,color:"#6f6a90" }}>◒ Void of course — a slack-water stretch. Good for finishing and rest; not for new starts.</div>}
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
          </div>
          <div style={{ background: "var(--color-card)",borderRadius:9,padding:"10px 11px",border:"1px solid var(--color-border)" }}>
            <div style={{ fontSize:8,textTransform:"uppercase",letterSpacing:"0.5px",color:"#bbb",marginBottom:5 }}>Conditions</div>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:5 }}>
              <div style={{ flex:1,height:4,borderRadius:2,background:"#e8e4de" }}>
                <div style={{ height:"100%",borderRadius:2,width:`${(qs/7)*100}%`,background:qColor(qs) }}/>
              </div>
            </div>
            {/* element = the day's character; quality = how coherent conditions are */}
            <div style={{ fontSize:10.5,fontWeight:600,color:ELEMENT_LABEL[elem]??"#888",textTransform:"capitalize",marginBottom:2 }}>
              {elem} day · {dayData.quality?.replace(/_/g," ")}
            </div>
            <div style={{ fontSize:9.5,color:"#888",lineHeight:1.5 }}>
              {ELEMENT_NOTE[elem] ?? ""} {QUALITY_NOTE[dayData.quality ?? ""] ? `Overall: ${QUALITY_NOTE[dayData.quality ?? ""]}.` : ""}
            </div>
          </div>
          {crossings.length>0 && (
            <div style={{ background: "var(--color-card)",borderRadius:9,padding:"10px 11px",border:"1px solid var(--color-border)" }}>
              <div style={{ fontSize:9.5,fontWeight:600,color:"#333",marginBottom:2 }}>Angle crossings</div>
              <div style={{ fontSize:8.5,color:"#999",lineHeight:1.45,marginBottom:6 }}>
                Moments a planet crosses one of your local chart angles (rising point, midheaven) — a brief window, ~20 minutes, when that planet's themes peak.
              </div>
              {crossings.map((c:any,i:number)=>{
                const col = PLANET_COLORS[c.planet]??"#888";
                const ANGLE_WORD: Record<string,string> = { ASC:"rises", MC:"culminates", DSC:"sets", IC:"grounds" };
                return (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:6,paddingBottom:5,marginBottom:i<crossings.length-1?5:0,borderBottom:i<crossings.length-1?"1px solid var(--color-border)":"none" }}>
                    <div style={{ width:20,height:20,borderRadius:"50%",background:`${col}20`,color:col,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{PLANET_ICONS[c.planet]??c.planet[0]}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10,fontWeight:500,color:"#333" }}>{c.planet} {ANGLE_WORD[c.angle] ?? `crosses ${c.angle}`}</div>
                      <div style={{ fontSize:8,color:"#aaa" }}>{c.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {(wins as PlanningWindow[]).length>0 && (
            <div style={{ background: "var(--color-card)",borderRadius:9,padding:"10px 11px",border:"1px solid var(--color-border)" }}>
              <div style={{ fontSize:9.5,fontWeight:600,color:"#333",marginBottom:6 }}>Events</div>
              {(wins as PlanningWindow[]).map(w=>{
                const col = WINDOW_COLORS[w.type as string]??"#888";
                const s = new Date(w.startTime), e = new Date(w.endTime);
                return (
                  <div key={w.id} style={{ display:"flex",alignItems:"center",gap:5,marginBottom:4,padding:"4px 6px",borderRadius:5,background:`${col}10`,border:`1px solid ${col}25` }}>
                    <div style={{ width:3,height:22,borderRadius:2,background:col,flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10,fontWeight:500,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{w.title}</div>
                      <div style={{ fontSize:8,color:"#aaa" }}>{fmtTime(s)} – {fmtTime(e)}</div>
                    </div>
                    <button onClick={()=>del.mutate(w.id)} style={{ background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:10 }}>✕</button>
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

export default function Calendar({ testerId, now, lat, lon }: {
  testerId: string | null; now: TidesNow | undefined; lat: number; lon: number;
}) {
  const today = new Date().toISOString().slice(0,10);
  const todayYear  = parseInt(today.slice(0,4));
  const todayMonth = parseInt(today.slice(5,7))-1;

  // Phones default to the day view — a 7-column month grid at 390px is
  // unreadable slivers, and the side detail panel would crush it further.
  const isMobile = useIsMobile();
  const [calView, setCalView]           = useState<CalView>(isMobile ? "day" : "month");
  const [year, setYear]                 = useState(todayYear);
  const [month, setMonth]               = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showSignNames, setShowSignNames] = useState(true);
  // Month view defaults to SIMPLE — the big/slow essentials only (element tint,
  // phase, moon sign, day ruler, VoC). Detailed adds the granular aspect times.
  // Nesting principle: an absolute beginner should meet the slow layer first.
  const [monthSimple, setMonthSimple] = useState(true);
  const [showDetail, setShowDetail]     = useState(!isMobile);
  const [addModal, setAddModal]         = useState<{date:string;hour?:number}|null>(null);
  const qc = useQueryClient();

  const { data: weekData }   = useTidesWeek(90, lat, lon);
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
      return r.json();
    },
    enabled:!!testerId,
  });

  const delWindow = useMutation({
    mutationFn: async(id:number)=>{await fetch(`/api/planning/windows/${id}`,{method:"DELETE",headers:testerId?{"x-tester-id":testerId}:{}});},
    onSuccess:()=>qc.invalidateQueries({queryKey:["windows-all"]}),
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
      const d = new Date(ev.start).toISOString().slice(0, 10);
      const arr = m.get(d) ?? [];
      arr.push(ev);
      m.set(d, arr);
    }
    return m;
  }, [gcalData]);

  const windowsMap = useMemo(()=>{
    const m = new Map<string,PlanningWindow[]>();
    for (const w of allWindows) {
      const d = new Date(w.startTime).toISOString().slice(0,10);
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
        <button onClick={prevPeriod} style={{ fontSize:15,padding:"1px 9px",borderRadius:5,border:"1px solid var(--color-border)",background: "var(--color-card)",color:"#555",cursor:"pointer",lineHeight:1.5 }}>‹</button>
        <div style={{ fontSize:13,fontWeight:600,color: "var(--color-primary)",minWidth:150 }}>{periodLabel()}</div>
        <button onClick={nextPeriod} style={{ fontSize:15,padding:"1px 9px",borderRadius:5,border:"1px solid var(--color-border)",background: "var(--color-card)",color:"#555",cursor:"pointer",lineHeight:1.5 }}>›</button>
        <button onClick={goToday} style={{ fontSize:10,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background: "var(--color-card)",color:"#666",cursor:"pointer" }}>Today</button>

        <div style={{ display:"flex",background:"#e0dcd6",borderRadius:7,padding:3,gap:1 }}>
          {(["day","week","month"] as CalView[]).map(v=>(
            <button key={v} onClick={()=>setCalView(v)} style={{
              fontSize:10,padding:"3px 11px",borderRadius:5,border:"none",cursor:"pointer",
              background:calView===v?"#fff":"transparent",color:calView===v?"#1a2a3a":"#999",
              fontWeight:calView===v?600:400,textTransform:"capitalize",
            }}>{v}</button>
          ))}
        </div>

        <button onClick={()=>setAddModal({date:selectedDate})} style={{ fontSize:10,padding:"3px 11px",borderRadius:6,border:"none",background:"#1a2a3a",color:"#fff",cursor:"pointer",fontWeight:600 }}>+ Event</button>

        {calView==="month" && (
          <>
            {calView==="month" && (
              <button onClick={()=>setMonthSimple(v=>!v)} title={monthSimple?"Show aspect times and detail":"Show just the essentials"} style={{ fontSize:9,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background:monthSimple?"var(--color-background)":"#fff8f0",color:monthSimple?"#888":"#b07020",cursor:"pointer" }}>{monthSimple?"Simple":"Detailed"}</button>
            )}
            <button onClick={()=>setShowSignNames(v=>!v)} style={{ fontSize:9,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background:showSignNames?"#fff8f0":"var(--color-background)",color:showSignNames?"#b07020":"#aaa",cursor:"pointer" }}>Signs</button>
            <button onClick={()=>setShowDetail(v=>!v)} style={{ fontSize:9,padding:"3px 9px",borderRadius:6,border:"1px solid var(--color-border)",background:showDetail?"var(--color-background)":"transparent",color:"#888",cursor:"pointer" }}>{showDetail?"Hide panel":"Show panel"}</button>
          </>
        )}

        <div style={{ marginLeft:"auto" }}><GCalButton testerId={testerId} qc={qc}/></div>
      </div>

      {/* On phones the detail panel stacks below the grid instead of crushing it */}
      <div style={{ flex:1,display:"flex",overflow:isMobile?"auto":"hidden",flexDirection:isMobile?"column":"row" }}>
        {/* Month view */}
        {calView==="month" && (
          <>
            <div style={{ flex:1,display:"flex",flexDirection:"column",overflowY:"auto",padding:"0 10px 10px",minWidth:0 }}>
              {/* Legend — every mark on the grid, named */}
              <div style={{ display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",paddingTop:8,fontSize:9,color:"#a09888",flexShrink:0 }}>
                <span>tint = the day's element (Moon's sign)</span>
                {!monthSimple && <span style={{ color:"#60708a" }}>☽□♀ = Moon aspect, with time</span>}
                {!monthSimple && <span style={{ color:"#60708a",fontWeight:700 }}>☉□♄ = planets exact that day</span>}
                <span><span style={{ background:"#ece9f4",color:"#6f6a90",padding:"0 3px",borderRadius:2,fontWeight:600 }}>◒ VOC</span> = void Moon (rest, don't launch)</span>
                {(testerProfile?.cautionPlanets?.length ?? 0) > 0 && <span>⚠️ = a caution day for you — tap the day to see what & why</span>}
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4,paddingTop:6,flexShrink:0 }}>
                {DOW_SHORT.map((d,i)=>{
                  const ruler = WEEKDAY_RULERS[i];
                  return (
                    <div key={d} title={`${ruler}'s day`} style={{ textAlign:"center",fontSize:9,fontWeight:600,color:"#c8c4bc",textTransform:"uppercase",letterSpacing:"0.4px",padding:"3px 0" }}>
                      {d} <span style={{ color:PLANET_COLORS[ruler]??"#c8c4bc",opacity:0.7 }}>{PLANET_ICONS[ruler]}</span>
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

        {/* Week / Day view */}
        {calView!=="month" && (
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
