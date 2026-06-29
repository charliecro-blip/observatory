import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTidesWeek, useSkyEvents } from "@/hooks/useTides";
import type { TidesNow, WeekDay, PlanningWindow, SkyEvent } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOON_EMOJI: Record<string, string> = {
  "New Moon":"🌑","Waxing Crescent":"🌒","First Quarter":"🌓",
  "Waxing Gibbous":"🌔","Full Moon":"🌕","Waning Gibbous":"🌖",
  "Last Quarter":"🌗","Waning Crescent":"🌘","Balsamic Moon":"🌑",
};
const MOON_MEANING: Record<string, string> = {
  "New Moon":       "Seed-planting. Set intentions; avoid external launches.",
  "Waxing Crescent":"First steps. Begin what the new moon seeded.",
  "First Quarter":  "Push through resistance. Make the decision.",
  "Waxing Gibbous": "Refine and intensify. Nearly at peak.",
  "Full Moon":      "Peak visibility and emotion. Share, celebrate, complete.",
  "Waning Gibbous": "Gratitude. Share what you've learned.",
  "Last Quarter":   "Edit and release. Remove what no longer serves.",
  "Waning Crescent":"Rest. Let the field lie fallow.",
  "Balsamic Moon":  "Surrender. Deepest inner work before the new cycle.",
};

const SIGN_SYMBOL: Record<string, string> = {
  Aries:"♈",Taurus:"♉",Gemini:"♊",Cancer:"♋",Leo:"♌",Virgo:"♍",
  Libra:"♎",Scorpio:"♏",Sagittarius:"♐",Capricorn:"♑",Aquarius:"♒",Pisces:"♓",
};
const SIGN_ABBR: Record<string, string> = {
  Aries:"Ari",Taurus:"Tau",Gemini:"Gem",Cancer:"Can",Leo:"Leo",Virgo:"Vir",
  Libra:"Lib",Scorpio:"Sco",Sagittarius:"Sag",Capricorn:"Cap",Aquarius:"Aqu",Pisces:"Pis",
};

const ELEMENT_TINT: Record<string, string> = {
  water:"#ebf1f7", fire:"#f9f0e8", earth:"#edf3e8", air:"#f1edf8",
};
const ELEMENT_ACCENT: Record<string, string> = {
  water:"#3a5a80",fire:"#8a3a20",earth:"#3a6030",air:"#602080",
};
const ELEMENT_LABEL: Record<string, string> = {
  water:"#4a6a90",fire:"#9a4a30",earth:"#4a7040",air:"#7030a0",
};
const ELEMENT_NOTE: Record<string, string> = {
  water:"Emotional depth, intuition, and receptive energy.",
  fire:"Bold, assertive, and expressive energy.",
  earth:"Grounding, patience, and practical focus.",
  air:"Conceptual, communicative, and eclectic energy.",
};

const BIO_COLOR: Record<string, string> = {
  fruit:"#c07030",root:"#806050",flower:"#b05070",leaf:"#408070",
};
const BIO_LABEL: Record<string, string> = {
  fruit:"Fruit",root:"Root",flower:"Flower",leaf:"Leaf",
};
const BIO_NOTE: Record<string, string> = {
  fruit:"Peak vitality — train, perform, and take on challenges.",
  root:"Grounding — strength work, steady habits, earthy foods.",
  flower:"Sensitivity — self-care, aesthetic work, gentle movement.",
  leaf:"Cleansing — hydration, rest, light fasting, lymphatic support.",
};

const PLANET_COLORS: Record<string, string> = {
  Sun:"#c08020",Moon:"#7080a0",Mercury:"#608060",Venus:"#a06080",
  Mars:"#c04040",Jupiter:"#6040a0",Saturn:"#807060",
};
const PLANET_ICONS: Record<string, string> = {
  Sun:"☉",Moon:"☽",Mercury:"☿",Venus:"♀",Mars:"♂",Jupiter:"♃",Saturn:"♄",
};

const WINDOW_TYPES = ["deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat"];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",admin:"Admin",
  social:"Social",relationship:"Relationship",recovery:"Recovery",study:"Study",launch:"Launch",retreat:"Retreat",
};
const WINDOW_COLORS: Record<string,string> = {
  deep_work:"#3a7aaa",creative:"#9060b0",planning:"#c08040",admin:"#888",
  social:"#d06060",relationship:"#b04080",recovery:"#60a080",study:"#5060a0",launch:"#c04040",retreat:"#6080a0",
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type LayerLevel = 0 | 1 | 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

function qColor(score: number): string {
  if (score >= 6) return "#3a7040";
  if (score >= 4) return "#8a8030";
  if (score >= 2) return "#c07030";
  return "#a04030";
}
function qLabel(score: number): string {
  if (score >= 7) return "Exceptional";
  if (score >= 6) return "Excellent";
  if (score >= 5) return "Good";
  if (score >= 4) return "Supported";
  if (score >= 3) return "Moderate";
  if (score >= 2) return "Challenging";
  return "Difficult";
}
function parseSign(moonSign: string): string | null {
  return Object.keys(SIGN_SYMBOL).find(s => moonSign.includes(s)) ?? null;
}
function crossingNature(planet: string): "benefic" | "malefic" | "neutral" {
  if (["Venus","Jupiter"].includes(planet)) return "benefic";
  if (["Mars","Saturn"].includes(planet)) return "malefic";
  return "neutral";
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
function timeToHourFrac(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

// ── DayCell ───────────────────────────────────────────────────────────────────

function DayCell({ dateStr, dayData, isToday, isSelected, isPast, layer, showSignNames, vocFrac, onClick }: {
  dateStr: string;
  dayData?: WeekDay;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  layer: LayerLevel;
  showSignNames: boolean;
  vocFrac?: { top: number; height: number } | null;
  onClick: () => void;
}) {
  const dayNum = parseInt(dateStr.split("-")[2]);
  const elem     = dayData?.element ?? "";
  const phase    = dayData?.moonPhase ?? "";
  const bio      = dayData?.biodynamicType ?? "";
  const qs       = dayData?.qualityScore ?? 0;
  const voc      = dayData?.voidPeriods ?? false;
  const crossings = dayData?.crossings ?? [];
  const moonSign = dayData?.moonSign ?? "";
  const signKey  = parseSign(moonSign);

  const bg = layer >= 1 && dayData && !isPast
    ? (ELEMENT_TINT[elem] ?? "#faf8f5")
    : "#faf8f5";
  const border = isSelected
    ? "2px solid #1a2a3a"
    : isToday
    ? `2px solid #c09040`
    : "2px solid transparent";

  return (
    <button onClick={onClick} style={{
      height:80, borderRadius:8, border, background:bg, cursor:"pointer",
      padding:"5px 6px 4px", position:"relative",
      display:"flex", flexDirection:"column", gap:1,
      textAlign:"left", overflow:"hidden",
      opacity: isPast && !isToday ? 0.48 : 1,
      transition:"border-color 0.1s, opacity 0.1s",
      boxShadow: isSelected ? "0 0 0 1px #1a2a3a" : "none",
    }}>

      {/* VOC diagonal stripe — proportional to time-of-day */}
      {layer >= 1 && voc && (
        vocFrac ? (
          <div style={{
            position:"absolute",
            left:0, right:0,
            top:`${vocFrac.top * 100}%`,
            height:`${vocFrac.height * 100}%`,
            borderRadius:4, pointerEvents:"none",
            background:"repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.07) 5px,rgba(0,0,0,0.07) 6px)",
          }}/>
        ) : (
          <div style={{
            position:"absolute", inset:0, borderRadius:6, pointerEvents:"none",
            background:"repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.05) 5px,rgba(0,0,0,0.05) 6px)",
          }}/>
        )
      )}

      {/* Row 1: date + moon phase emoji */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
        <span style={{
          fontSize:13, lineHeight:1, fontWeight: isToday ? 700 : 500,
          color: isToday ? "#b07820" : isSelected ? "#1a2a3a" : "#444",
        }}>{dayNum}</span>
        {dayData && phase && (
          <span style={{ fontSize:11, lineHeight:1 }}>{MOON_EMOJI[phase] ?? ""}</span>
        )}
      </div>

      {/* Row 2: moon sign (layer 1+, toggle-controlled) */}
      {layer >= 1 && signKey && dayData && (
        <div style={{
          fontSize:8.5, fontWeight:500, lineHeight:1,
          color: ELEMENT_LABEL[elem] ?? "#aaa", letterSpacing:"0.1px",
        }}>
          {showSignNames ? `${SIGN_SYMBOL[signKey]} ${SIGN_ABBR[signKey]}` : SIGN_SYMBOL[signKey]}
        </div>
      )}

      {/* Bottom row: bio dot (Full only) + crossing count + VOC label */}
      {layer >= 1 && dayData && (
        <div style={{ display:"flex", alignItems:"center", gap:3, marginTop:"auto", flexShrink:0 }}>
          {layer >= 2 && bio && (
            <div title={BIO_LABEL[bio]} style={{
              width:6, height:6, borderRadius:"50%", flexShrink:0,
              background: BIO_COLOR[bio] ?? "#bbb",
            }}/>
          )}
          {layer >= 2 && crossings.length > 0 && (
            <span style={{
              fontSize:7, fontWeight:600, color:"#b07820",
              background:"#fffbf0", padding:"0 3px 1px", borderRadius:3,
              border:"1px solid #e8d890", lineHeight:1.4,
            }}>
              {crossings.length}⚡
            </span>
          )}
          {layer >= 2 && voc && (
            <span style={{ fontSize:7, fontWeight:600, color:"#9a9060", letterSpacing:"0.2px" }}>VOC</span>
          )}
        </div>
      )}

      {/* Quality bar — always visible at bottom */}
      {dayData && qs > 0 && (
        <div style={{
          position:"absolute", bottom:0, left:0, right:0, height:2.5,
          background:"#e0dbd2", borderRadius:"0 0 6px 6px",
        }}>
          <div style={{
            height:"100%", borderRadius:"0 0 6px 6px",
            width:`${(qs / 7) * 100}%`,
            background: qColor(qs),
          }}/>
        </div>
      )}
    </button>
  );
}

// ── CrossingTimeline SVG ──────────────────────────────────────────────────────

function CrossingTimeline({ crossings, vocEvents, ingressForDay, isToday }: {
  crossings: WeekDay["crossings"];
  vocEvents: SkyEvent[];
  ingressForDay: SkyEvent[];
  isToday: boolean;
}) {
  const W = 236;
  const H = 38;
  const HOUR_START = 5;
  const HOUR_END = 23;
  const SPAN = HOUR_END - HOUR_START;

  function xOf(timeStr: string): number {
    const h = timeToHourFrac(timeStr);
    return Math.max(0, Math.min(W, ((h - HOUR_START) / SPAN) * W));
  }

  // VOC shading: from voc.time → next ingress time (same day) or end of timeline
  const vocBands = vocEvents.filter(v => v.time).map(voc => {
    const startX = xOf(voc.time!);
    const nextIngress = ingressForDay.find(e => e.time && e.time > voc.time!);
    const endX = nextIngress?.time ? Math.min(W, xOf(nextIngress.time)) : W;
    return { startX, endX };
  });

  // Current time marker
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const nowX = isToday && nowH >= HOUR_START && nowH <= HOUR_END
    ? ((nowH - HOUR_START) / SPAN) * W
    : null;

  const hourTicks = [6, 9, 12, 15, 18, 21];
  const sortedCrossings = [...(crossings ?? [])].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div>
      <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:6 }}>
        Day timeline
      </div>
      <svg width={W} height={H + 18} style={{ overflow:"visible", display:"block" }}>
        {/* Hour tick lines */}
        {hourTicks.map(h => {
          const x = ((h - HOUR_START) / SPAN) * W;
          const label = h === 12 ? "12p" : h > 12 ? `${h-12}p` : `${h}a`;
          return (
            <g key={h}>
              <line x1={x} y1={0} x2={x} y2={H} stroke="#ece8e2" strokeWidth={1}/>
              <text x={x} y={H + 12} textAnchor="middle" fontSize={7} fill="#c8c4bc">{label}</text>
            </g>
          );
        })}

        {/* Main track */}
        <rect x={0} y={H/2 - 1.5} width={W} height={3} fill="#e0dbd2" rx={1.5}/>

        {/* VOC shading */}
        {vocBands.map((b, i) => (
          <rect key={i} x={b.startX} y={2} width={Math.max(0, b.endX - b.startX)} height={H - 4}
            fill="#f5f3e0" opacity={0.8} rx={2}/>
        ))}

        {/* Crossings */}
        {sortedCrossings.filter(c => c.time).map((c, i) => {
          const x = xOf(c.time);
          const col = PLANET_COLORS[c.planet] ?? "#888";
          const icon = PLANET_ICONS[c.planet] ?? c.planet[0];
          return (
            <g key={i}>
              <line x1={x} y1={4} x2={x} y2={H - 4} stroke={col} strokeWidth={1.5} opacity={0.8}/>
              <circle cx={x} cy={H / 2} r={4} fill={col}/>
              <text x={x} y={H/2 + 3.5} textAnchor="middle" fontSize={6} fill="#fff" fontWeight="bold">
                {icon}
              </text>
              <text x={x} y={-4} textAnchor="middle" fontSize={6.5} fill={col}>
                {c.angle}
              </text>
            </g>
          );
        })}

        {/* Now line */}
        {nowX !== null && (
          <g>
            <line x1={nowX} y1={0} x2={nowX} y2={H} stroke="#1a2a3a" strokeWidth={1.5} strokeDasharray="2,2"/>
            <circle cx={nowX} cy={H / 2} r={4.5} fill="#1a2a3a"/>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── DayDetailPanel ────────────────────────────────────────────────────────────

function DayDetailPanel({ dateStr, dayData, eventsForDay, testerId, now }: {
  dateStr: string;
  dayData?: WeekDay;
  eventsForDay: SkyEvent[];
  testerId: string | null;
  now?: TidesNow;
}) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title:"", type:"deep_work", startTime:"09:00", endTime:"11:00" });

  const today = new Date().toISOString().slice(0, 10);
  const isToday = dateStr === today;
  const dateObj = new Date(dateStr + "T12:00:00");
  const dayLabel = dateObj.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });

  const { data: windows = [] } = useQuery<PlanningWindow[]>({
    queryKey: ["windows", testerId, dateStr],
    queryFn: async () => {
      const r = await fetch(`/api/planning/windows?date=${dateStr}`, {
        headers: { ...(testerId ? {"x-tester-id":testerId} : {}), "Content-Type":"application/json" },
      });
      return r.json();
    },
    enabled: !!testerId,
  });

  const addWindow = useMutation({
    mutationFn: async () => {
      const start = new Date(`${dateStr}T${form.startTime}:00`);
      const end   = new Date(`${dateStr}T${form.endTime}:00`);
      await fetch("/api/planning/windows", {
        method:"POST",
        headers: { ...(testerId ? {"x-tester-id":testerId} : {}), "Content-Type":"application/json" },
        body: JSON.stringify({ title: form.title || WINDOW_LABELS[form.type], windowType: form.type, startTime: start.toISOString(), endTime: end.toISOString() }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["windows"]}); setShowAdd(false); setForm({ title:"", type:"deep_work", startTime:"09:00", endTime:"11:00" }); },
  });

  const removeWindow = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/planning/windows/${id}`, {
        method:"DELETE",
        headers: testerId ? {"x-tester-id":testerId} : {},
      });
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["windows"]}),
  });

  const elem       = dayData?.element ?? "";
  const phase      = dayData?.moonPhase ?? "";
  const bio        = dayData?.biodynamicType ?? "";
  const qs         = dayData?.qualityScore ?? 0;
  const voc        = dayData?.voidPeriods ?? false;
  const crossings  = dayData?.crossings ?? [];
  const moonSign   = dayData?.moonSign ?? "";
  const dayRuler   = dayData?.dayRuler ?? "";
  const signKey    = parseSign(moonSign);

  const vocEvents     = eventsForDay.filter(e => e.type === "voc");
  const ingressEvents = eventsForDay.filter(e => e.type === "ingress");

  return (
    <div style={{
      width:286, minWidth:286, borderLeft:"1px solid #d0cbc3",
      background:"#faf8f5", display:"flex", flexDirection:"column",
      flexShrink:0, overflowY:"auto",
    }}>
      {/* Header */}
      <div style={{
        padding:"14px 16px 12px", flexShrink:0,
        borderBottom:"1px solid #e8e4de",
        background: elem && dayData ? ELEMENT_TINT[elem] ?? "#f5f2ee" : "#f5f2ee",
      }}>
        <div style={{ fontSize:10, color:"#aaa", marginBottom:3 }}>
          {isToday ? "Today" : "Selected day"}
        </div>
        <div style={{ fontSize:15, fontWeight:700, color:"#1a2a3a", lineHeight:1.25, marginBottom:4 }}>
          {dayLabel}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {dayRuler && (
            <span style={{ fontSize:10, color: PLANET_COLORS[dayRuler] ?? "#888" }}>
              {PLANET_ICONS[dayRuler]} Day of {dayRuler}
            </span>
          )}
          {isToday && now?.planetaryHour && (
            <span style={{ fontSize:10, color: PLANET_COLORS[now.planetaryHour.planet] ?? "#888" }}>
              · {PLANET_ICONS[now.planetaryHour.planet]} {now.planetaryHour.planet} hour
            </span>
          )}
        </div>
      </div>

      <div style={{ flex:1, padding:"12px 14px", display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>

        {!dayData && (
          <div style={{ fontSize:11, color:"#bbb", textAlign:"center", padding:"28px 0", lineHeight:1.7 }}>
            No timing data for this date.<br/>
            <span style={{ fontSize:10 }}>Available for today and future dates.</span>
          </div>
        )}

        {dayData && (
          <>
            {/* Moon */}
            <div style={{ background:"#fff", borderRadius:9, padding:"12px 13px", border:"1px solid #e8e4de" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
                <span style={{ fontSize:22, lineHeight:1, flexShrink:0 }}>{MOON_EMOJI[phase] ?? "●"}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#1a2a3a", lineHeight:1.2 }}>{phase}</div>
                  {signKey && (
                    <div style={{ fontSize:10, color: ELEMENT_LABEL[elem] ?? "#aaa", marginTop:1 }}>
                      {SIGN_SYMBOL[signKey]} {moonSign}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize:10.5, color:"#666", lineHeight:1.65 }}>
                {MOON_MEANING[phase] ?? ""}
              </div>
              {voc && (
                <div style={{ marginTop:8, padding:"6px 9px", borderRadius:6, background:"#faf5e0", border:"1px solid #e0d090", fontSize:10, color:"#8a7830" }}>
                  ◌ Void of course periods today — avoid new starts.
                </div>
              )}
            </div>

            {/* Quality + Element */}
            <div style={{ background:"#fff", borderRadius:9, padding:"12px 13px", border:"1px solid #e8e4de" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.5px", color:"#bbb", marginBottom:5 }}>Quality</div>
                  <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                    <div style={{ flex:1, height:4, borderRadius:2, background:"#e8e4de" }}>
                      <div style={{ height:"100%", borderRadius:2, width:`${(qs/7)*100}%`, background:qColor(qs) }}/>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color:qColor(qs), flexShrink:0 }}>{qs}/7</span>
                  </div>
                  <div style={{ fontSize:10, color:qColor(qs), fontWeight:500 }}>{qLabel(qs)}</div>
                </div>
                <div>
                  <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.5px", color:"#bbb", marginBottom:5 }}>Element</div>
                  <div style={{ fontSize:12, fontWeight:600, color: ELEMENT_LABEL[elem] ?? "#888", textTransform:"capitalize", marginBottom:2 }}>{elem}</div>
                  <div style={{ fontSize:9.5, color:"#aaa", lineHeight:1.4 }}>{ELEMENT_NOTE[elem]}</div>
                </div>
              </div>
            </div>

            {/* Biodynamic */}
            {bio && (
              <div style={{ background:"#fff", borderRadius:9, padding:"12px 13px", border:"1px solid #e8e4de" }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background: BIO_COLOR[bio] ?? "#bbb", flexShrink:0 }}/>
                  <div style={{ fontSize:12, fontWeight:600, color:"#333" }}>{BIO_LABEL[bio]} day</div>
                </div>
                <div style={{ fontSize:10.5, color:"#666", lineHeight:1.6 }}>{BIO_NOTE[bio]}</div>
              </div>
            )}

            {/* Crossings */}
            {crossings.length > 0 && (
              <div style={{ background:"#fff", borderRadius:9, padding:"12px 13px", border:"1px solid #e8e4de" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#333", marginBottom:9 }}>
                  Angle crossings
                  <span style={{ fontWeight:400, color:"#bbb", fontSize:10, marginLeft:5 }}>{crossings.length} today</span>
                </div>
                {crossings.map((c, i) => {
                  const col = PLANET_COLORS[c.planet] ?? "#888";
                  const nature = crossingNature(c.planet);
                  const natureIcon = nature === "benefic" ? "♡" : nature === "malefic" ? "△" : "○";
                  return (
                    <div key={i} style={{
                      display:"flex", alignItems:"center", gap:9,
                      paddingBottom: i < crossings.length-1 ? 8 : 0,
                      marginBottom: i < crossings.length-1 ? 8 : 0,
                      borderBottom: i < crossings.length-1 ? "1px solid #f0ede8" : "none",
                    }}>
                      <div style={{
                        width:26, height:26, borderRadius:"50%", flexShrink:0,
                        background:`${col}20`, color:col, fontSize:13,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        {PLANET_ICONS[c.planet] ?? c.planet[0]}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11, fontWeight:500, color:"#333" }}>
                          {c.planet} at {c.angle}
                        </div>
                        <div style={{ fontSize:9, color:"#aaa" }}>{c.time}</div>
                      </div>
                      <span style={{
                        fontSize:9, color:col, background:`${col}12`,
                        border:`1px solid ${col}30`, padding:"1px 5px", borderRadius:4,
                        flexShrink:0,
                      }}>
                        {natureIcon}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Timeline */}
            {(crossings.length > 0 || voc) && (
              <div style={{ background:"#fff", borderRadius:9, padding:"12px 13px", border:"1px solid #e8e4de" }}>
                <CrossingTimeline
                  crossings={crossings}
                  vocEvents={vocEvents}
                  ingressForDay={ingressEvents}
                  isToday={isToday}
                />
              </div>
            )}

            {/* Planning windows */}
            <div style={{ background:"#fff", borderRadius:9, padding:"12px 13px", border:"1px solid #e8e4de" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#333" }}>Planning windows</div>
                <button onClick={() => setShowAdd(v => !v)} style={{
                  fontSize:9, padding:"2px 8px", borderRadius:6, border:"1px solid #d0cbc3",
                  background: showAdd ? "#1a2a3a" : "#fff", color: showAdd ? "#fff" : "#666", cursor:"pointer",
                }}>
                  + Add
                </button>
              </div>

              {showAdd && (
                <div style={{ marginBottom:10, display:"flex", flexDirection:"column", gap:6, paddingBottom:10, borderBottom:"1px solid #f0ede8" }}>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({...f, title:e.target.value}))}
                    placeholder={WINDOW_LABELS[form.type]}
                    style={{ padding:"5px 8px", borderRadius:5, border:"1px solid #d8d2ca", fontSize:11, outline:"none", background:"#faf8f5" }}
                  />
                  <select value={form.type} onChange={e => setForm(f => ({...f, type:e.target.value}))}
                    style={{ padding:"5px 8px", borderRadius:5, border:"1px solid #d8d2ca", fontSize:11, background:"#faf8f5" }}>
                    {WINDOW_TYPES.map(t => <option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
                  </select>
                  <div style={{ display:"flex", gap:6 }}>
                    <input type="time" value={form.startTime} onChange={e => setForm(f => ({...f, startTime:e.target.value}))}
                      style={{ flex:1, padding:"5px 6px", borderRadius:5, border:"1px solid #d8d2ca", fontSize:11, background:"#faf8f5" }}/>
                    <input type="time" value={form.endTime} onChange={e => setForm(f => ({...f, endTime:e.target.value}))}
                      style={{ flex:1, padding:"5px 6px", borderRadius:5, border:"1px solid #d8d2ca", fontSize:11, background:"#faf8f5" }}/>
                  </div>
                  <button onClick={() => addWindow.mutate()} style={{
                    padding:"6px 0", borderRadius:6, border:"none",
                    background:"#1a2a3a", color:"#fff", fontSize:11, fontWeight:500, cursor:"pointer",
                  }}>
                    Save window
                  </button>
                </div>
              )}

              {windows.length === 0 && !showAdd && (
                <div style={{ fontSize:10, color:"#bbb", textAlign:"center", padding:"6px 0" }}>No windows planned</div>
              )}
              {(windows as PlanningWindow[]).map(w => {
                const col = WINDOW_COLORS[w.type as string] ?? WINDOW_COLORS[(w as any).windowType] ?? "#888";
                const start = new Date(w.startTime);
                const end   = new Date(w.endTime);
                return (
                  <div key={w.id} style={{
                    display:"flex", alignItems:"center", gap:7, marginBottom:5,
                    padding:"6px 8px", borderRadius:6, background:`${col}0e`, border:`1px solid ${col}28`,
                  }}>
                    <div style={{ width:3, height:28, borderRadius:2, background:col, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10.5, fontWeight:500, color:"#333", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.title}</div>
                      <div style={{ fontSize:9, color:"#aaa" }}>
                        {start.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} – {end.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                      </div>
                    </div>
                    <button onClick={() => removeWindow.mutate(w.id)} style={{
                      fontSize:11, background:"none", border:"none", color:"#ccc", cursor:"pointer",
                    }}>✕</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Calendar ─────────────────────────────────────────────────────────────

export default function Calendar({ testerId, now, lat, lon }: {
  testerId: string | null;
  now: TidesNow | undefined;
  lat: number;
  lon: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const todayYear  = parseInt(today.slice(0, 4));
  const todayMonth = parseInt(today.slice(5, 7)) - 1;

  const [year,          setYear]          = useState(todayYear);
  const [month,         setMonth]         = useState(todayMonth);
  const [selectedDate,  setSelectedDate]  = useState(today);
  const [layer,         setLayer]         = useState<LayerLevel>(1);
  const [showSignNames, setShowSignNames] = useState(false);

  const { data: weekData }   = useTidesWeek(90, lat, lon);
  const { data: eventsData } = useSkyEvents(90, lat, lon);

  const dataMap = useMemo(() => {
    const map = new Map<string, WeekDay>();
    for (const d of weekData?.days ?? []) map.set(d.date, d);
    return map;
  }, [weekData]);

  const eventsMap = useMemo(() => {
    const map = new Map<string, SkyEvent[]>();
    for (const e of eventsData?.events ?? []) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [eventsData]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function goToday() {
    setYear(todayYear); setMonth(todayMonth); setSelectedDate(today);
  }

  const LAYERS: { level: LayerLevel; label: string; desc: string }[] = [
    { level:0, label:"Essentials", desc:"Moon phase + quality bar" },
    { level:1, label:"Standard",   desc:"+ sign, element tint, VOC" },
    { level:2, label:"Full",       desc:"+ crossings, biodynamic, VOC label" },
  ];

  // Compute VOC proportional fraction for a day cell (top/height as 0-1 of 80px cell)
  function vocFracForDate(dateStr: string): { top: number; height: number } | null {
    const events = eventsMap.get(dateStr) ?? [];
    const vocEv = events.find(e => e.type === "voc" && e.time);
    if (!vocEv?.time) return null;
    const DAY_START = 6, DAY_END = 24, SPAN = DAY_END - DAY_START;
    const vocH = timeToHourFrac(vocEv.time);
    const nextIngress = events.find(e => e.type === "ingress" && e.time && e.time > vocEv.time!);
    const endH = nextIngress?.time ? Math.min(DAY_END, timeToHourFrac(nextIngress.time)) : DAY_END;
    const top    = Math.max(0, (vocH - DAY_START) / SPAN);
    const height = Math.max(0.05, Math.min(1 - top, (endH - vocH) / SPAN));
    return { top, height };
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Topbar */}
      <div style={{
        padding:"9px 18px", borderBottom:"1px solid #d0cbc3", background:"#ece8e2",
        flexShrink:0, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
      }}>
        {/* Month nav */}
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <button onClick={prevMonth} style={{ fontSize:14, padding:"1px 8px", borderRadius:5, border:"1px solid #d0cbc3", background:"#fff", color:"#555", cursor:"pointer", lineHeight:1.4 }}>‹</button>
          <div style={{ fontSize:13, fontWeight:600, color:"#1a2a3a", minWidth:140, textAlign:"center" }}>
            {MONTH_NAMES[month]} {year}
          </div>
          <button onClick={nextMonth} style={{ fontSize:14, padding:"1px 8px", borderRadius:5, border:"1px solid #d0cbc3", background:"#fff", color:"#555", cursor:"pointer", lineHeight:1.4 }}>›</button>
        </div>
        <button onClick={goToday} style={{ fontSize:10, padding:"3px 9px", borderRadius:6, border:"1px solid #d0cbc3", background:"#fff", color:"#666", cursor:"pointer" }}>
          Today
        </button>

        {/* Sign names toggle */}
        <button onClick={() => setShowSignNames(v => !v)} style={{
          marginLeft:"auto", fontSize:9, padding:"3px 9px", borderRadius:6,
          border:"1px solid #d0cbc3",
          background: showSignNames ? "#fff8f0" : "#f0ede8",
          color: showSignNames ? "#b07020" : "#aaa", cursor:"pointer",
        }}>
          {showSignNames ? "Signs: on" : "Signs: off"}
        </button>

        {/* Layer toggle */}
        <div style={{ display:"flex", alignItems:"center", gap:2, background:"#e0dcd6", borderRadius:8, padding:"3px" }}>
          {LAYERS.map(ll => (
            <button key={ll.level} onClick={() => setLayer(ll.level)} title={ll.desc} style={{
              fontSize:10, padding:"3px 11px", borderRadius:6, border:"none", cursor:"pointer",
              background: layer === ll.level ? "#fff" : "transparent",
              color: layer === ll.level ? "#1a2a3a" : "#999",
              fontWeight: layer === ll.level ? 600 : 400,
              boxShadow: layer === ll.level ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition:"background 0.1s",
            }}>
              {ll.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        {/* Month grid */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflowY:"auto", padding:"0 14px 14px", minWidth:0 }}>

          {/* Legend row */}
          <div style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 0 6px", flexShrink:0, flexWrap:"wrap" }}>
            {layer >= 2 && Object.entries(BIO_COLOR).map(([k, c]) => (
              <div key={k} style={{ display:"flex", alignItems:"center", gap:3, fontSize:8.5, color:"#aaa" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:c }}/>
                {BIO_LABEL[k]}
              </div>
            ))}
            {layer >= 1 && (
              <div style={{ display:"flex", alignItems:"center", gap:3, fontSize:8.5, color:"#aaa" }}>
                <div style={{ width:16, height:6, borderRadius:2, background:"repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.14) 3px,rgba(0,0,0,0.14) 4px)", border:"1px solid #e0dbd4" }}/>
                VOC
              </div>
            )}
            {layer >= 2 && (
              <div style={{ fontSize:8.5, color:"#aaa" }}>⚡ crossings</div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:3, fontSize:8.5, color:"#aaa" }}>
              <div style={{ width:24, height:3, borderRadius:2, background:"linear-gradient(to right, #a04030, #8a8030, #3a7040)" }}/>
              quality
            </div>
          </div>

          {/* Day of week headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:3, marginBottom:3, flexShrink:0 }}>
            {DOW.map(d => (
              <div key={d} style={{ textAlign:"center", fontSize:9, fontWeight:600, color:"#c8c4bc", textTransform:"uppercase", letterSpacing:"0.4px", padding:"3px 0" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Cell grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:3 }}>
            {grid.map((dateStr, i) => {
              if (!dateStr) return <div key={`pad-${i}`}/>;
              return (
                <DayCell
                  key={dateStr}
                  dateStr={dateStr}
                  dayData={dataMap.get(dateStr)}
                  isToday={dateStr === today}
                  isSelected={dateStr === selectedDate}
                  isPast={dateStr < today}
                  layer={layer}
                  showSignNames={showSignNames}
                  vocFrac={vocFracForDate(dateStr)}
                  onClick={() => setSelectedDate(dateStr)}
                />
              );
            })}
          </div>

          {/* Phase legend (always) */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, padding:"10px 0 0" }}>
            {Object.entries(MOON_EMOJI).slice(0, 8).map(([phase, emoji]) => (
              <div key={phase} style={{ display:"flex", alignItems:"center", gap:3, fontSize:8.5, color:"#aaa" }}>
                <span style={{ fontSize:10 }}>{emoji}</span>
                <span>{phase.replace(" Moon","").replace("Waxing ","⬆ ").replace("Waning ","⬇ ")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel */}
        <DayDetailPanel
          dateStr={selectedDate}
          dayData={dataMap.get(selectedDate)}
          eventsForDay={eventsMap.get(selectedDate) ?? []}
          testerId={testerId}
          now={now}
        />
      </div>
    </div>
  );
}
