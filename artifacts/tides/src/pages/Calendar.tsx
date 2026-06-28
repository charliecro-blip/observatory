import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TidesNow, TidesWeek, PlanningWindow } from "@/lib/types";

const HOURS = Array.from({length:16}, (_,i) => i + 6); // 6am–9pm

const WINDOW_TYPES = ["deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat"];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",admin:"Admin",
  social:"Social",relationship:"Relationship",recovery:"Recovery",study:"Study",launch:"Launch",retreat:"Retreat",
};
const WINDOW_COLORS: Record<string,string> = {
  deep_work:"#3a7aaa",creative:"#9060b0",planning:"#c08040",admin:"#888",
  social:"#d06060",relationship:"#b04080",recovery:"#60a080",study:"#5060a0",launch:"#c04040",retreat:"#6080a0",
};
const ELEMENT_BG: Record<string,string> = {
  water:"#f0f4f8",fire:"#faf3ee",earth:"#f0f4ec",air:"#f4f0f8",
};
const QUALITY_COLORS: Record<string,string> = {
  good:"#60a060",supported:"#60a060",challenging:"#c04040",caution:"#d0a040",neutral:"#888",
};

function timeToY(hour:number, min:number, slotH:number) {
  return (hour - 6) * slotH + (min / 60) * slotH;
}
function authH(tid:string|null) {
  return { ...(tid ? {"x-tester-id":tid} : {}), "Content-Type":"application/json" };
}
function fmtTime(h:number) {
  if (h === 12) return "12pm";
  if (h === 0 || h === 24) return "12am";
  return h > 12 ? `${h-12}pm` : `${h}am`;
}

export default function Calendar({ testerId, now, week }: { testerId:string|null; now:TidesNow|undefined; week:any }) {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0,10));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title:"", type:"deep_work", startTime:"09:00", endTime:"11:00" });
  const slotH = 56; // px per hour

  const { data: windows = [] } = useQuery<PlanningWindow[]>({
    queryKey: ["windows", testerId, selectedDate],
    queryFn: async () => {
      const r = await fetch(`/api/planning/windows?date=${selectedDate}`, { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
  });

  const addWindow = useMutation({
    mutationFn: async () => {
      const [sh,sm] = form.startTime.split(":").map(Number);
      const [eh,em] = form.endTime.split(":").map(Number);
      const start = new Date(`${selectedDate}T${form.startTime}:00`);
      const end = new Date(`${selectedDate}T${form.endTime}:00`);
      await fetch("/api/planning/windows", {
        method:"POST", headers: authH(testerId),
        body: JSON.stringify({ title: form.title || WINDOW_LABELS[form.type], windowType: form.type, startTime: start.toISOString(), endTime: end.toISOString() }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["windows"]}); setShowAdd(false); setForm({title:"",type:"deep_work",startTime:"09:00",endTime:"11:00"}); },
  });

  const removeWindow = useMutation({
    mutationFn: async (id:number) => {
      await fetch(`/api/planning/windows/${id}`, { method:"DELETE", headers: authH(testerId) });
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["windows"]}),
  });

  // Current day data from week
  const dayData = week?.days?.find((d:any) => d.date === selectedDate);
  const el = dayData?.element ?? now?.element?.element ?? "water";
  const elemBg = ELEMENT_BG[el] ?? "#f8f6f2";
  const qColor = QUALITY_COLORS[dayData?.quality ?? now?.quality ?? "neutral"] ?? "#888";

  // Planetary hours for the day (from now if same day)
  const today = new Date().toISOString().slice(0,10);
  const isToday = selectedDate === today;
  const currentHourPlanet = isToday ? now?.planetaryHour?.planet : null;
  const nowH = isToday ? new Date().getHours() : null;
  const nowM = isToday ? new Date().getMinutes() : null;
  const nowY = (nowH !== null && nowM !== null) ? timeToY(nowH, nowM, slotH) : null;

  // Crossings
  const crossings = dayData?.crossings ?? [];

  // Week strip dates
  const weekDays = week?.days?.slice(0,7) ?? [];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Topbar */}
      <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #d0cbc3",background:"#ece8e2",flexShrink:0}}>
        <div style={{display:"flex",gap:4}}>
          {weekDays.map((d:any) => {
            const isSelected = d.date === selectedDate;
            const isT = d.date === today;
            const qc2 = QUALITY_COLORS[d.quality ?? "neutral"] ?? "#888";
            const num = new Date(d.date+"T12:00:00").getDate();
            return (
              <button key={d.date} onClick={() => setSelectedDate(d.date)} style={{
                display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"5px 8px",
                borderRadius:7,border:`1px solid ${isSelected?"#c0b090":"transparent"}`,
                background:isSelected?"#fff":isT?"#f5f0e8":"transparent",cursor:"pointer",minWidth:40,
              }}>
                <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:"0.4px",color:isT?"#b07030":"#aaa",fontWeight:isT?600:400}}>{d.label?.slice(0,3)}</div>
                <div style={{fontSize:13,fontWeight:600,color:isSelected?"#1a2a3a":isT?"#b07030":"#555"}}>{num}</div>
                <div style={{width:6,height:6,borderRadius:"50%",background:qc2}}/>
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowAdd(v => !v)} style={{fontSize:11,padding:"5px 12px",borderRadius:7,border:"1px solid #d0cbc3",background:showAdd?"#1a2a3a":"#fff",color:showAdd?"#fff":"#555",cursor:"pointer"}}>
          + Window
        </button>
      </div>

      {/* Add window form */}
      {showAdd && (
        <div style={{padding:"12px 20px",background:"#f5f2ee",borderBottom:"1px solid #d0cbc3",display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
          <div style={{display:"flex",flexDirection:"column",gap:3,flex:2,minWidth:140}}>
            <label style={{fontSize:9,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.5px"}}>Title (optional)</label>
            <input value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} placeholder={WINDOW_LABELS[form.type]}
              style={{padding:"6px 8px",borderRadius:6,border:"1px solid #d8d2ca",fontSize:12,background:"#fff",outline:"none"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3,flex:2,minWidth:120}}>
            <label style={{fontSize:9,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.5px"}}>Type</label>
            <select value={form.type} onChange={e => setForm(f => ({...f,type:e.target.value}))}
              style={{padding:"6px 8px",borderRadius:6,border:"1px solid #d8d2ca",fontSize:12,background:"#fff",color:WINDOW_COLORS[form.type]}}>
              {WINDOW_TYPES.map(t => <option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
            </select>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            <label style={{fontSize:9,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.5px"}}>Start</label>
            <input type="time" value={form.startTime} onChange={e => setForm(f => ({...f,startTime:e.target.value}))}
              style={{padding:"6px 8px",borderRadius:6,border:"1px solid #d8d2ca",fontSize:12,background:"#fff"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            <label style={{fontSize:9,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.5px"}}>End</label>
            <input type="time" value={form.endTime} onChange={e => setForm(f => ({...f,endTime:e.target.value}))}
              style={{padding:"6px 8px",borderRadius:6,border:"1px solid #d8d2ca",fontSize:12,background:"#fff"}}/>
          </div>
          <button onClick={() => addWindow.mutate()} style={{padding:"8px 16px",borderRadius:7,border:"none",background:"#1a2a3a",color:"#fff",fontSize:12,cursor:"pointer",alignSelf:"flex-end"}}>
            Save
          </button>
        </div>
      )}

      {/* Grid */}
      <div style={{flex:1,overflowY:"auto",padding:"0 20px 20px"}}>
        <div style={{display:"grid",gridTemplateColumns:"44px 1fr",position:"relative",marginTop:8}}>
          {HOURS.map(h => {
            const crossingsThisHour = crossings.filter((c:any) => {
              const ch = parseInt((c.time ?? "00:00").split(":")[0]);
              return ch === h;
            });

            return (
              <React.Fragment key={h}>
                {/* Time label */}
                <div style={{fontSize:9,color:"#ccc",textAlign:"right",paddingRight:8,paddingTop:4,height:slotH,position:"relative"}}>
                  {fmtTime(h)}
                </div>

                {/* Hour slot */}
                <div style={{
                  height:slotH, borderTop:"1px solid #f0ede8", position:"relative",
                  background: isToday && nowH === h ? `${elemBg}` : h % 2 === 0 ? elemBg : "transparent",
                }}>
                  {/* Planetary hour band (subtle) */}
                  {isToday && now?.planetaryHour && (() => {
                    const [bh] = (now.planetaryHour.began ?? "0:0").split(":").map(Number);
                    const [eh] = (now.planetaryHour.ends ?? "0:0").split(":").map(Number);
                    if (h >= bh && h < eh) {
                      return <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:`${WINDOW_COLORS["deep_work"]}40`,borderRadius:"0 2px 2px 0"}}/>;
                    }
                  })()}

                  {/* Crossing markers */}
                  {crossingsThisHour.map((c:any,i:number) => {
                    const [,cm] = (c.time ?? "00:00").split(":").map(Number);
                    const yOff = (cm / 60) * slotH;
                    return (
                      <div key={i} style={{position:"absolute",left:0,right:0,top:yOff,zIndex:3,display:"flex",alignItems:"center",gap:4,pointerEvents:"none"}}>
                        <div style={{flex:1,height:1.5,background:"#e0a040",opacity:0.7}}/>
                        <div style={{fontSize:8,color:"#c08020",background:"#fff9f0",padding:"0 4px",borderRadius:3,fontWeight:600,flexShrink:0}}>
                          ⚡ {c.planet} {c.angle} {c.time}
                        </div>
                        <div style={{flex:1,height:1.5,background:"#e0a040",opacity:0.7}}/>
                      </div>
                    );
                  })}
                </div>
              </React.Fragment>
            );
          })}

          {/* Now line */}
          {isToday && nowY !== null && nowY >= 0 && nowY <= HOURS.length * slotH && (
            <div style={{position:"absolute",left:44,right:0,top:nowY,zIndex:5,display:"flex",alignItems:"center",pointerEvents:"none"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#1a2a3a",marginLeft:-3.5,flexShrink:0}}/>
              <div style={{flex:1,height:1.5,background:"#1a2a3a"}}/>
            </div>
          )}

          {/* Windows overlay */}
          {windows.map((w:any) => {
            const start = new Date(w.startTime);
            const end = new Date(w.endTime);
            const sh = start.getHours(), sm = start.getMinutes();
            const eh = end.getHours(), em = end.getMinutes();
            const top = timeToY(sh, sm, slotH);
            const height = timeToY(eh, em, slotH) - top;
            const color = WINDOW_COLORS[w.windowType] ?? "#888";
            if (sh < 6 || sh > 21) return null;
            return (
              <div key={w.id} style={{
                position:"absolute", left:44+6, right:8, top, height:Math.max(20,height), zIndex:4,
                background:`${color}e8`, borderLeft:`3px solid ${color}`, borderRadius:5,
                padding:"3px 8px", overflow:"hidden", cursor:"default",
              }}>
                <div style={{fontSize:11,fontWeight:600,color:"#fff",lineHeight:1.2}}>{w.title}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.75)",marginTop:1}}>
                  {start.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} – {end.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                </div>
                <button onClick={() => removeWindow.mutate(w.id)} style={{
                  position:"absolute",top:3,right:5,fontSize:10,background:"none",border:"none",
                  color:"rgba(255,255,255,0.5)",cursor:"pointer",lineHeight:1,
                }}>✕</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
