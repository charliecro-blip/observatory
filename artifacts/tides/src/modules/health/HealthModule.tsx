import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModuleShell } from "../shared/ModuleShell";
import { healthLogic } from "./healthLogic";
import { useTidesWeek, useGCalStatus, useGCalEvents } from "@/hooks/useTides";

// Moon phase score based on biodynamic day + element
function dayTrainingScore(day: any): number {
  // fire element = high energy; earth = grounded strength; water = recovery; air = light
  const elemScore: Record<string, number> = { fire: 1.0, earth: 0.85, air: 0.6, water: 0.4 };
  const el = (day.element ?? "water").toLowerCase();
  const base = elemScore[el] ?? 0.5;
  // Quality score 0-7
  const q = (day.qualityScore ?? 4) / 7;
  // VOC is a soft penalty
  const vocPen = day.voidPeriods ? 0.15 : 0;
  // Moon phase bias via moon phase name if available
  const phase = (day.moonPhase ?? "").toLowerCase();
  let phaseMult = 1.0;
  if (phase.includes("new")) phaseMult = 0.5;
  else if (phase.includes("waxing crescent")) phaseMult = 0.7;
  else if (phase.includes("first quarter")) phaseMult = 0.85;
  else if (phase.includes("waxing gibbous")) phaseMult = 0.95;
  else if (phase.includes("full")) phaseMult = 1.0;
  else if (phase.includes("waning gibbous")) phaseMult = 0.9;
  else if (phase.includes("last quarter")) phaseMult = 0.75;
  else if (phase.includes("waning crescent")) phaseMult = 0.55;
  return Math.max(0, Math.min(1, (base * 0.4 + q * 0.4) * phaseMult - vocPen));
}

function elementColor(el: string) {
  return ({ fire:"#c04020", earth:"#5a7040", air:"#6040a0", water:"#3060a0" } as any)[el?.toLowerCase()] ?? "#888";
}

function PracticeScheduler({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const [practiceName, setPracticeName] = useState("Workout");
  const [duration, setDuration] = useState(60);
  const [frequency, setFrequency] = useState(4);
  const [windowType, setWindowType] = useState("recovery");
  const [scheduled, setScheduled] = useState<Set<string>>(new Set());
  const [scheduling, setScheduling] = useState<string | null>(null);

  const { data: weekData } = useTidesWeek(14, 40.7, -74.0);

  // Conflict detection: load GCal + planning windows for the 14-day range
  const today = new Date().toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const { data: gcalStatus } = useGCalStatus(testerId);
  const { data: gcalData } = useGCalEvents(testerId, today + "T00:00:00Z", endDate + "T23:59:59Z", !!(gcalStatus?.connected));
  const { data: existingWindows } = useQuery<any[]>({
    queryKey: ["planning-windows", testerId],
    enabled: !!testerId,
    queryFn: async () => {
      const r = await fetch("/api/planning/windows", { headers: { "x-tester-id": testerId! } });
      return r.json();
    },
    staleTime: 60_000,
  });

  // Build a set of busy dates (have ≥2 events or a long event covering morning)
  const busyDates = new Set<string>();
  for (const ev of (gcalData?.events ?? [])) {
    const d = ev.start?.slice(0, 10);
    if (d) busyDates.add(d);
  }
  // Dates that already have a scheduled planning window of this practice
  const alreadyScheduled = new Set<string>(
    (existingWindows ?? [])
      .filter((w: any) => w.title === practiceName)
      .map((w: any) => (w.startTime ?? "").slice(0, 10))
  );

  const days = (weekData?.days ?? []).map((d: any) => ({
    ...d,
    score: dayTrainingScore(d),
    busy: busyDates.has(d.date) && !alreadyScheduled.has(d.date),
    done: alreadyScheduled.has(d.date),
  }));

  // Pick top N days by score for suggestion highlighting
  const sorted = [...days].sort((a: any, b: any) => b.score - a.score);
  const topDates = new Set(sorted.slice(0, frequency * 2).map((d: any) => d.date));

  async function scheduleDay(day: any) {
    if (!testerId) return;
    setScheduling(day.date);
    try {
      const startISO = `${day.date}T09:00:00`;
      const endISO   = `${day.date}T${String(9 + Math.floor(duration / 60)).padStart(2,"0")}:${String(duration % 60).padStart(2,"0")}:00`;
      await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: practiceName,
          windowType,
          startTime: startISO,
          endTime: endISO,
          note: `Scheduled via Health module (${frequency}×/week target)`,
        }),
      });
      setScheduled(prev => new Set([...prev, day.date]));
      qc.invalidateQueries({ queryKey: ["planning-windows"] });
    } finally {
      setScheduling(null);
    }
  }

  return (
    <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"18px 20px" }}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Practice scheduling</div>
      <div style={{ fontSize:10.5, color:"#aaa", marginBottom:16, lineHeight:1.5 }}>
        Plan recurring sessions across the next 14 days. Recommendations weight element, quality, and moon phase —
        more intensity near the full moon, gentler near the new moon.
      </div>

      {/* Config row */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
        <input
          value={practiceName}
          onChange={e => setPracticeName(e.target.value)}
          placeholder="Practice name"
          style={{ padding:"6px 10px", borderRadius:7, border:"1px solid #d8d2ca", fontSize:11, flex:"1 1 120px", background:"#faf8f5" }}
        />
        <select value={windowType} onChange={e => setWindowType(e.target.value)}
          style={{ padding:"6px 10px", borderRadius:7, border:"1px solid #d8d2ca", fontSize:11, background:"#faf8f5", color:"#555" }}>
          <option value="recovery">Recovery</option>
          <option value="deep_work">Deep work</option>
          <option value="creative">Creative</option>
          <option value="social">Social</option>
          <option value="planning">Planning</option>
        </select>
        <select value={duration} onChange={e => setDuration(Number(e.target.value))}
          style={{ padding:"6px 10px", borderRadius:7, border:"1px solid #d8d2ca", fontSize:11, background:"#faf8f5", color:"#555" }}>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>1 hour</option>
          <option value={90}>90 min</option>
          <option value={120}>2 hours</option>
        </select>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#555" }}>
          <span>×/week:</span>
          {[2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setFrequency(n)} style={{
              width:24, height:24, borderRadius:"50%", border:"none", cursor:"pointer", fontSize:10, fontWeight:500,
              background: frequency === n ? "#1a2a3a" : "#e8e4de",
              color: frequency === n ? "#fff" : "#555",
            }}>{n}</button>
          ))}
        </div>
      </div>

      {/* Moon phase legend */}
      <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap" }}>
        {[["Full moon", "#c07030"],["Fire days", "#c04020"],["Earth days", "#5a7040"],["Low / rest", "#aaa"]].map(([label, color]) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:4, fontSize:9.5, color:"#888" }}>
            <div style={{ width:8, height:8, borderRadius:2, background:color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {days.map((day: any) => {
          const isBusy = day.busy;
          const isTop = topDates.has(day.date) && !isBusy;
          const isScheduled = scheduled.has(day.date) || day.done;
          const isLoading = scheduling === day.date;
          const ec = elementColor(day.element);
          const scoreBar = Math.round(day.score * 100);
          const date = new Date(day.date + "T12:00:00");
          const label = date.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });

          return (
            <div key={day.date} style={{
              display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8,
              background: isScheduled ? "#f0f8f0" : isTop ? `${ec}10` : "#faf8f5",
              border: `1px solid ${isScheduled ? "#b0d8b0" : isTop ? ec+"30" : "#e8e4de"}`,
              opacity: isBusy ? 0.5 : 1,
            }}>
              <div style={{ width:90, fontSize:10.5, color:"#555", flexShrink:0 }}>{label}</div>
              <div style={{ flex:1, height:5, borderRadius:3, background:"#e8e4de", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${scoreBar}%`, background: day.score > 0.75 ? "#4a7040" : day.score > 0.5 ? "#b07040" : "#aaa", borderRadius:3 }} />
              </div>
              <div style={{ fontSize:9.5, color:ec, fontWeight:500, width:60, flexShrink:0, textAlign:"center" }}>
                {day.element} {day.moonSign ? `· ${day.moonSign}` : ""}
              </div>
              {isTop && <div style={{ fontSize:8.5, color:"#3a6030", fontWeight:600, flexShrink:0 }}>★</div>}
              {isBusy && <div style={{ fontSize:8.5, color:"#a08060", flexShrink:0 }}>gcal</div>}
              <button
                onClick={() => scheduleDay(day)}
                disabled={isScheduled || isLoading || !testerId || isBusy}
                style={{
                  fontSize:9.5, padding:"3px 10px", borderRadius:6, border:"none",
                  cursor: (isScheduled || isBusy) ? "default" : "pointer", flexShrink:0,
                  background: isScheduled ? "#e8f5e0" : isBusy ? "#f0ede8" : "#1a2a3a",
                  color: isScheduled ? "#3a6030" : isBusy ? "#bbb" : "#fff",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isScheduled ? "✓" : isLoading ? "…" : isBusy ? "busy" : "+ Add"}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:12, fontSize:9.5, color:"#bbb", lineHeight:1.5 }}>
        Sessions added to Planning windows at 9 AM. Adjust times in Calendar.
      </div>
    </div>
  );
}

export default function HealthModule({
  testerId, lat = 40.7, lon = -74.0,
}: { testerId: string | null; lat?: number; lon?: number }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:20, fontWeight:600, color:"#1a2a3a" }}>Health & Body</div>
      <div style={{ fontSize:11, color:"#888", marginTop:-8 }}>
        Physical training, recovery, fasting, and vitality windows aligned to biodynamic and lunar cycles.
      </div>
      <ModuleShell testerId={testerId} lat={lat} lon={lon} logic={healthLogic} />
      <PracticeScheduler testerId={testerId} />
    </div>
  );
}
