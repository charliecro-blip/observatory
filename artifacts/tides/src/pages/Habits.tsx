import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TidesNow } from "@/lib/types";

const ELEMENTS = ["water","fire","earth","air"];
// Simplified lunation quarters for tagging — timingScore matches these against
// the live phase name via includes(), so "waxing" catches both crescent and
// gibbous. New = begin/reset, waxing = build, full = culminate, waning = release.
const PHASES = [
  { key:"new",    label:"New · begin" },
  { key:"waxing", label:"Waxing · build" },
  { key:"full",   label:"Full · culminate" },
  { key:"waning", label:"Waning · release" },
];
const BIO = ["leaf","root","flower","fruit"];
const WINDOW_TYPES = ["deep_work","creative","planning","social","recovery","study","retreat"];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",social:"Social",
  recovery:"Recovery",study:"Study",retreat:"Retreat",
};

const ELEMENT_COLORS: Record<string,string> = {
  water:"#3a5a80",fire:"#8a3a20",earth:"#3a6030",air:"#602080",
};

interface HabitDay { date: string; done: boolean; isToday: boolean; }
interface Habit {
  id: number; name: string; emoji?: string; description?: string;
  favoredElements?: string; favoredPhases?: string; favoredBiodynamic?: string;
  bestWindowType?: string; streak: number; doneToday: boolean;
  days: HabitDay[];
}

function authH(tid: string|null) {
  return { ...(tid ? {"x-tester-id":tid} : {}), "Content-Type":"application/json" };
}

// Score a habit against current conditions
function timingScore(h: Habit, now: TidesNow|undefined): "resonant"|"supported"|"neutral"|"soften" {
  if (!now) return "neutral";
  const el = now.element?.element ?? "";
  const phase = now.moonPhase?.toLowerCase() ?? "";
  const bio = now.biodynamicType?.toLowerCase() ?? "";
  let score = 0;
  if (h.favoredElements?.split(",").map(s=>s.trim()).includes(el)) score += 2;
  if (h.favoredPhases?.split(",").map(s=>s.trim()).some(p => phase.includes(p))) score += 1;
  if (h.favoredBiodynamic?.split(",").map(s=>s.trim()).includes(bio)) score += 1;
  if (score >= 3) return "resonant";
  if (score >= 1) return "supported";
  return "neutral";
}

const TIMING_COLORS = { resonant:"#3a6020", supported:"#3a5a80", neutral:"#888", soften:"#8a5020" };
const TIMING_BG = { resonant:"#d0f0c0", supported:"#d0e0f8", neutral:"#e8e4de", soften:"#f0e0c0" };

export default function Habits({ testerId, now, lat = 40.7, lon = -74.0 }: { testerId:string|null; now:TidesNow|undefined; lat?:number; lon?:number }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0,10);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:"", emoji:"", favoredElements:[] as string[], favoredPhases:[] as string[], favoredBiodynamic:[] as string[], bestWindowType:"", minimumViable:"" });

  const { data: habits = [] } = useQuery<Habit[]>({
    queryKey: ["habits", testerId],
    queryFn: async () => {
      const r = await fetch("/api/habits", { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
    refetchInterval: 60_000,
  });

  const addHabit = useMutation({
    mutationFn: async () => {
      await fetch("/api/habits", {
        method: "POST", headers: authH(testerId),
        body: JSON.stringify({
          name: form.name.trim(), emoji: form.emoji || undefined,
          favoredElements: form.favoredElements.join(",") || undefined,
          favoredPhases: form.favoredPhases.join(",") || undefined,
          favoredBiodynamic: form.favoredBiodynamic.join(",") || undefined,
          bestWindowType: form.bestWindowType || undefined,
          minimumViable: form.minimumViable.trim() || undefined,
        }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["habits"]}); setShowAdd(false); setForm({name:"",emoji:"",favoredElements:[],favoredPhases:[],favoredBiodynamic:[],bestWindowType:"",minimumViable:""}); },
  });

  const toggleLog = useMutation({
    mutationFn: async ({ id, done }: { id:number; done:boolean }) => {
      if (done) {
        await fetch(`/api/habits/${id}/log`, { method:"DELETE", headers: authH(testerId) });
      } else {
        await fetch(`/api/habits/${id}/log`, { method:"POST", headers: authH(testerId), body: JSON.stringify({ date: today }) });
      }
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["habits"]}),
  });

  const removeHabit = useMutation({
    mutationFn: async (id:number) => {
      await fetch(`/api/habits/${id}`, { method:"DELETE", headers: authH(testerId) });
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["habits"]}),
  });

  const scored = habits
    .map(h => ({ ...h, timing: timingScore(h, now) }))
    .sort((a,b) => {
      const order = { resonant:0, supported:1, neutral:2, soften:3 };
      return order[a.timing] - order[b.timing];
    });

  // This week's completions per element — a habit tagged with multiple
  // elements counts toward each. Reuses the 14-day `days` log already fetched
  // per habit rather than a separate query.
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const weekByElement: Record<string, number> = { fire: 0, earth: 0, air: 0, water: 0 };
  for (const h of habits) {
    const els = h.favoredElements?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
    if (els.length === 0) continue;
    const completedThisWeek = h.days.filter(d => d.done && d.date >= weekAgo).length;
    for (const el of els) if (weekByElement[el] !== undefined) weekByElement[el] += completedThisWeek;
  }
  const weekTotal = Object.values(weekByElement).reduce((a, b) => a + b, 0);

  const toggleEl = (el: string) => setForm(f => ({
    ...f, favoredElements: f.favoredElements.includes(el) ? f.favoredElements.filter(e=>e!==el) : [...f.favoredElements, el]
  }));
  const toggleBio = (b: string) => setForm(f => ({
    ...f, favoredBiodynamic: f.favoredBiodynamic.includes(b) ? f.favoredBiodynamic.filter(e=>e!==b) : [...f.favoredBiodynamic, b]
  }));
  const togglePhase = (p: string) => setForm(f => ({
    ...f, favoredPhases: f.favoredPhases.includes(p) ? f.favoredPhases.filter(e=>e!==p) : [...f.favoredPhases, p]
  }));

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--color-border)",background: "var(--color-rail)",flexShrink:0}}>
        <div style={{fontSize:12,color:"#888"}}>
          {now ? `${now.element?.element} · ${now.biodynamicType} · ${now.moonPhase?.replace(/_/g," ")}` : "Loading…"}
        </div>
        <button onClick={() => setShowAdd(v=>!v)} style={{fontSize:11,padding:"5px 12px",borderRadius:7,border:"1px solid var(--color-border)",background:showAdd?"#1a2a3a":"#fff",color:showAdd?"#fff":"#555",cursor:"pointer"}}>
          + New habit
        </button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>

        {/* New-moon review — the lunation's reset point, the natural moment to
            re-choose habits at the cycle scale habits actually live on. */}
        {now?.moonPhase === "New Moon" && habits.length > 0 && (
          <div style={{background:"#50608a08",border:"1px solid #7080a040",borderLeft:"3px solid #7080a0",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:11,fontWeight:600,color:"#50608a",marginBottom:2}}>New moon — a natural reset</div>
            <div style={{fontSize:10.5,color:"#60709a",lineHeight:1.5}}>
              The lunation begins again. A good moment to look down this list and ask which habits still serve — retire what doesn't, recommit to what does.
            </div>
          </div>
        )}

        {/* This week per element */}
        {weekTotal > 0 && (
          <div style={{display:"flex",gap:6,alignItems:"center",fontSize:10.5,color:"#999",padding:"2px 2px"}}>
            <span style={{textTransform:"uppercase",letterSpacing:"0.5px",fontSize:9,color:"#bbb"}}>This week</span>
            {ELEMENTS.filter(el => weekByElement[el] > 0).map(el => (
              <span key={el} style={{color:ELEMENT_COLORS[el],fontWeight:600}}>
                {el} {weekByElement[el]}
              </span>
            ))}
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div style={{background: "var(--color-card)",border:"1px solid var(--color-border)",borderRadius:10,padding:"16px"}}>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} placeholder="🌿" maxLength={2}
                style={{width:44,padding:"7px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:18,textAlign:"center",background: "var(--color-card-2)",outline:"none"}}/>
              <input autoFocus value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&form.name.trim()&&addHabit.mutate()}
                placeholder="Habit name…"
                style={{flex:1,padding:"7px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:13,background: "var(--color-card-2)",outline:"none"}}/>
            </div>

            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"#aaa",marginBottom:5}}>Best elements</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {ELEMENTS.map(el => (
                  <button key={el} onClick={()=>toggleEl(el)} style={{
                    fontSize:10,padding:"3px 9px",borderRadius:10,border:"1px solid",cursor:"pointer",
                    borderColor:form.favoredElements.includes(el)?ELEMENT_COLORS[el]:"#d8d2ca",
                    background:form.favoredElements.includes(el)?`${ELEMENT_COLORS[el]}20`:"transparent",
                    color:form.favoredElements.includes(el)?ELEMENT_COLORS[el]:"#888",
                  }}>{el}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"#aaa",marginBottom:5}}>Best moon phase</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {PHASES.map(p => (
                  <button key={p.key} onClick={()=>togglePhase(p.key)} style={{
                    fontSize:10,padding:"3px 9px",borderRadius:10,border:"1px solid",cursor:"pointer",
                    borderColor:form.favoredPhases.includes(p.key)?"#7080a0":"#d8d2ca",
                    background:form.favoredPhases.includes(p.key)?"#7080a020":"transparent",
                    color:form.favoredPhases.includes(p.key)?"#50608a":"#888",
                  }}>{p.label}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"#aaa",marginBottom:5}}>Best biodynamic days</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {BIO.map(b => (
                  <button key={b} onClick={()=>toggleBio(b)} style={{
                    fontSize:10,padding:"3px 9px",borderRadius:10,border:"1px solid",cursor:"pointer",
                    borderColor:form.favoredBiodynamic.includes(b)?"#5a7a50":"#d8d2ca",
                    background:form.favoredBiodynamic.includes(b)?"#d0e8c8":"transparent",
                    color:form.favoredBiodynamic.includes(b)?"#3a5a30":"#888",
                  }}>{b}</button>
                ))}
              </div>
            </div>

            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
              <select value={form.bestWindowType} onChange={e=>setForm(f=>({...f,bestWindowType:e.target.value}))}
                style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,background: "var(--color-card-2)",color:"#555"}}>
                <option value="">Best time of day: any</option>
                {WINDOW_TYPES.map(t=><option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input value={form.minimumViable} onChange={e=>setForm(f=>({...f,minimumViable:e.target.value}))}
                placeholder="Minimum viable (e.g. 5 min walk)…"
                style={{flex:1,padding:"6px 9px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,background: "var(--color-card-2)",outline:"none",color:"#555"}}/>
              <button onClick={()=>form.name.trim()&&addHabit.mutate()} disabled={!form.name.trim()}
                style={{padding:"6px 16px",borderRadius:7,border:"none",fontSize:11,background:form.name.trim()?"#1a2a3a":"#e0dcd6",color:form.name.trim()?"#fff":"#aaa",cursor:"pointer"}}>
                Add
              </button>
            </div>
          </div>
        )}

        {/* Habit rows */}
        {scored.map(h => {
          const tc = TIMING_COLORS[h.timing];
          const tb = TIMING_BG[h.timing];
          return (
            <div key={h.id} style={{background: "var(--color-card)",border:`1px solid ${h.timing==="resonant"?"#c0d8b0":"#e8e4de"}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                {/* Check button */}
                <button onClick={()=>toggleLog.mutate({id:h.id,done:h.doneToday})} style={{
                  width:26,height:26,borderRadius:7,border:`2px solid ${h.doneToday?"#80b870":"#c0bab0"}`,
                  background:h.doneToday?"#80b870":"transparent",flexShrink:0,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",
                }}>{h.doneToday?"✓":""}</button>

                {h.emoji && <span style={{fontSize:18,lineHeight:1}}>{h.emoji}</span>}
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:h.doneToday?"#bbb":"#222",textDecoration:h.doneToday?"line-through":"none"}}>{h.name}</div>
                  {h.streak > 0 && <div style={{fontSize:9,color:"#aaa",marginTop:1}}>{h.streak}d streak</div>}
                </div>

                {h.favoredElements && (
                  <div style={{display:"flex",gap:2,flexShrink:0}} title={`Elements: ${h.favoredElements}`}>
                    {h.favoredElements.split(",").map(s=>s.trim()).filter(Boolean).map(el => (
                      <span key={el} style={{width:6,height:6,borderRadius:"50%",background:ELEMENT_COLORS[el]??"#ccc",display:"inline-block"}}/>
                    ))}
                  </div>
                )}
                <div style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:tb,color:tc,fontWeight:600,flexShrink:0}}>{h.timing}</div>
                <button onClick={()=>removeHabit.mutate(h.id)} style={{fontSize:11,color:"#ddd",background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>✕</button>
              </div>

              {/* 14-day streak dots */}
              <div style={{display:"flex",gap:3,alignItems:"center"}}>
                {h.days.map((d,i) => (
                  <div key={d.date} title={d.date} style={{
                    width:d.isToday?10:7, height:d.isToday?10:7, borderRadius:"50%", flexShrink:0,
                    background:d.done?"#80b870":d.isToday?"#e8e4de":"#e8e4de",
                    border:d.isToday?`1.5px solid ${h.doneToday?"#60a050":"#c0bab0"}`:"none",
                    opacity:d.done||d.isToday?1:0.4,
                  }}/>
                ))}
                <div style={{fontSize:8,color:"#ccc",marginLeft:4}}>14d</div>
              </div>

              {/* Timing note */}
              {h.timing === "resonant" && (
                <div style={{fontSize:9,color:"#3a6020",marginTop:6,paddingTop:6,borderTop:"1px solid #e8f0e4"}}>
                  ✦ Resonant now — {[h.favoredElements,h.favoredBiodynamic].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          );
        })}

        {habits.length === 0 && !showAdd && (
          <div style={{textAlign:"center",padding:"48px 0",color:"#bbb",fontSize:13}}>
            {testerId ? "No habits yet. Add one above." : "Set up your profile first."}
          </div>
        )}
      </div>
    </div>
  );
}
