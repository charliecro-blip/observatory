import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TidesNow, PlanningWindow } from "@/lib/types";
import { useCurrents } from "@/hooks/useTides";
import { usePremium } from "@/contexts/premium-context";
import { useTester } from "@/contexts/tester-context";
import { CAUTION_PLANET_ARCHETYPE } from "@/lib/tester-profile";

const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

const WINDOW_TYPES = [
  "deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat"
];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",admin:"Admin",
  social:"Social",relationship:"Relationship",recovery:"Recovery",study:"Study",launch:"Launch",retreat:"Retreat",
};
const WINDOW_COLORS: Record<string,string> = {
  deep_work:"#3a7aaa",creative:"#9060b0",planning:"#c08040",admin:"#888",
  social:"#d06060",relationship:"#b04080",recovery:"#60a080",study:"#5060a0",launch:"#c04040",retreat:"#6080a0",
};
const HOUR_WINDOW: Record<string,string> = {
  Sun:"deep_work",Moon:"recovery",Mercury:"planning",
  Venus:"social",Mars:"deep_work",Jupiter:"creative",Saturn:"study",
};

interface Task {
  id:number; title:string; notes?:string; done:string;
  dueDate?:string; bestWindowType?:string; planningWindowId?:number;
}

function authH(tid:string|null) {
  return { ...(tid ? {"x-tester-id":tid} : {}), "Content-Type":"application/json" };
}

export default function Tasks({ testerId, now }: { testerId:string|null; now:TidesNow|undefined }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0,10);
  const [filter, setFilter] = useState<"today"|"all">("today");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newWindow, setNewWindow] = useState("");
  const [newPlanWindow, setNewPlanWindow] = useState<number|"">("");

  // "Guarding" — the same self-reported caution windows shown on Guiding
  // Stars/Currents, surfaced right where you're committing to something new.
  const { unlocked: premiumUnlocked } = usePremium();
  const { profile } = useTester();
  const { data: currentsData } = useCurrents(testerId, localStorage.getItem("obs_house_system") ?? "whole-sign");
  const cautionPlanets = profile?.cautionPlanets;
  const activeCautionMatches = premiumUnlocked && cautionPlanets && cautionPlanets.length > 0
    ? (currentsData?.cautionWindows ?? []).filter((t: any) => cautionPlanets.includes(t.transitPlanet))
    : [];

  const { data: upcomingWindows = [] } = useQuery<PlanningWindow[]>({
    queryKey: ["planning-windows-all", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/windows", { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks", testerId, filter],
    queryFn: async () => {
      const url = filter === "today" ? `/api/tasks?date=${today}` : "/api/tasks";
      const r = await fetch(url, { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
    refetchInterval: 30_000,
  });

  const addTask = useMutation({
    mutationFn: async () => {
      await fetch("/api/tasks", {
        method:"POST", headers: authH(testerId),
        body: JSON.stringify({
          title: newTitle.trim(),
          dueDate: filter === "today" ? today : undefined,
          bestWindowType: newWindow || undefined,
          planningWindowId: newPlanWindow || undefined,
        }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["tasks"]}); setNewTitle(""); setNewWindow(""); setNewPlanWindow(""); setShowAdd(false); },
  });

  const toggle = useMutation({
    mutationFn: async ({id,done}:{id:number;done:boolean}) => {
      await fetch(`/api/tasks/${id}`, { method:"PATCH", headers: authH(testerId), body: JSON.stringify({done:String(done)}) });
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["tasks"]}),
  });

  const remove = useMutation({
    mutationFn: async (id:number) => {
      await fetch(`/api/tasks/${id}`, { method:"DELETE", headers: authH(testerId) });
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["tasks"]}),
  });

  const bestNow = now?.planetaryHour?.planet ? HOUR_WINDOW[now.planetaryHour.planet] : null;
  const active = tasks.filter(t => t.done !== "true");
  const done = tasks.filter(t => t.done === "true");
  const nowTasks = active.filter(t => !t.bestWindowType || t.bestWindowType === bestNow);
  const laterByType = active
    .filter(t => t.bestWindowType && t.bestWindowType !== bestNow)
    .reduce((acc,t) => { const k = t.bestWindowType!; (acc[k] ??= []).push(t); return acc; }, {} as Record<string,Task[]>);

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--color-border)",background: "var(--color-rail)",flexShrink:0}}>
        <div style={{display:"flex",gap:2,background:"#e0dcd6",borderRadius:6,padding:2}}>
          {(["today","all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{padding:"4px 12px",borderRadius:4,fontSize:11,border:"none",cursor:"pointer",background:filter===f?"#fff":"transparent",color:filter===f?"#333":"#888",fontWeight:filter===f?500:400}}>
              {f === "today" ? "Today" : "All"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(v => !v)} style={{fontSize:11,padding:"5px 12px",borderRadius:7,border:"1px solid var(--color-border)",background:showAdd?"#1a2a3a":"#fff",color:showAdd?"#fff":"#555",cursor:"pointer"}}>
          + New task
        </button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>

        {showAdd && (
          <div style={{background: "var(--color-card)",border:"1px solid var(--color-border)",borderRadius:10,padding:"14px 16px"}}>
            {filter === "today" && activeCautionMatches.length > 0 && (
              <div style={{fontSize:10.5,color:"#a04040",background:"#a0404008",border:"1px solid #a0404030",borderRadius:7,padding:"6px 9px",marginBottom:8,lineHeight:1.5}}>
                Heads up — {activeCautionMatches.map((t:any,i:number) => (
                  <span key={i}>{i>0 && ", "}{PLANET_GLYPH[t.transitPlanet]} {t.transitPlanet} ({CAUTION_PLANET_ARCHETYPE[t.transitPlanet as keyof typeof CAUTION_PLANET_ARCHETYPE]?.label.toLowerCase()})</span>
                ))} is active today — one of your caution windows.
              </div>
            )}
            <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key==="Enter" && newTitle.trim() && addTask.mutate()}
              placeholder="Task title…"
              style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:13,marginBottom:8,outline:"none",background: "var(--color-card-2)"}}
            />
            <div style={{display:"flex",gap:8,marginBottom:6}}>
              <select value={newWindow} onChange={e => setNewWindow(e.target.value)}
                style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"#555",background: "var(--color-card-2)"}}>
                <option value="">Best time: any</option>
                {WINDOW_TYPES.map(t => <option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
              </select>
            </div>
            {upcomingWindows.length > 0 && (
              <div style={{marginBottom:8}}>
                <select value={newPlanWindow} onChange={e => setNewPlanWindow(e.target.value ? Number(e.target.value) : "")}
                  style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"#555",background: "var(--color-card-2)"}}>
                  <option value="">Link to calendar block: none</option>
                  {upcomingWindows.slice(0,10).map(w => (
                    <option key={w.id} value={w.id}>{w.title} · {w.startTime.slice(0,16).replace("T"," ")}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button onClick={() => newTitle.trim() && addTask.mutate()} disabled={!newTitle.trim()}
                style={{padding:"6px 14px",borderRadius:7,border:"none",fontSize:11,background:newTitle.trim()?"#1a2a3a":"#e0dcd6",color:newTitle.trim()?"#fff":"#aaa",cursor:"pointer"}}>
                Add task
              </button>
            </div>
          </div>
        )}

        {/* Now */}
        {nowTasks.length > 0 && (
          <Sect label={`Now · ${bestNow ? WINDOW_LABELS[bestNow] : "any"} · ${now?.planetaryHour?.planet ?? ""} hour`} accent="#3a6020">
            {nowTasks.map(t => <Row key={t.id} task={t} onToggle={() => toggle.mutate({id:t.id,done:t.done!=="true"})} onDelete={() => remove.mutate(t.id)} highlight />)}
          </Sect>
        )}

        {/* Later grouped by window */}
        {Object.entries(laterByType).map(([wt, wtTasks]) => (
          <Sect key={wt} label={WINDOW_LABELS[wt] ?? wt} color={WINDOW_COLORS[wt]}>
            {wtTasks.map(t => <Row key={t.id} task={t} onToggle={() => toggle.mutate({id:t.id,done:t.done!=="true"})} onDelete={() => remove.mutate(t.id)} />)}
          </Sect>
        ))}

        {/* Anytime tasks (no window type) when not in nowTasks */}
        {active.filter(t => !t.bestWindowType && bestNow && t.done !== "true").length > 0 && (
          <Sect label="Anytime">
            {active.filter(t => !t.bestWindowType).map(t => <Row key={t.id} task={t} onToggle={() => toggle.mutate({id:t.id,done:t.done!=="true"})} onDelete={() => remove.mutate(t.id)} />)}
          </Sect>
        )}

        {active.length === 0 && !showAdd && (
          <div style={{textAlign:"center",padding:"48px 0",color:"#bbb",fontSize:13}}>
            {testerId ? "Clear — add a task above." : "Set up your profile to track tasks."}
          </div>
        )}

        {done.length > 0 && (
          <Sect label={`Done · ${done.length}`} muted>
            {done.map(t => <Row key={t.id} task={t} onToggle={() => toggle.mutate({id:t.id,done:false})} onDelete={() => remove.mutate(t.id)} dim />)}
          </Sect>
        )}
      </div>
    </div>
  );
}

function Sect({ label, children, accent, color, muted }: any) {
  return (
    <div>
      <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:accent??color??(muted?"#ccc":"#aaa"),fontWeight:600,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
        {label}<div style={{flex:1,height:1,background:"#e8e4de"}}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>{children}</div>
    </div>
  );
}

function Row({ task, onToggle, onDelete, highlight, dim }: {task:Task;onToggle:()=>void;onDelete:()=>void;highlight?:boolean;dim?:boolean}) {
  const isDone = task.done === "true";
  const wc = task.bestWindowType ? WINDOW_COLORS[task.bestWindowType] : undefined;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:7,border:`1px solid ${highlight?"#c0d8b0":"#e8e4de"}`,background:highlight?"#f5faf2":"var(--color-card-2)",opacity:dim?0.5:1}}>
      <button onClick={onToggle} style={{width:17,height:17,borderRadius:4,border:`1.5px solid ${isDone?"#80b870":"#c0bab0"}`,background:isDone?"#80b870":"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff"}}>
        {isDone?"✓":""}
      </button>
      <div style={{flex:1,fontSize:12,color:isDone?"#bbb":"#222",textDecoration:isDone?"line-through":"none"}}>{task.title}</div>
      {task.planningWindowId && !isDone && (
        <div style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:"#e8f0f8",color:"#3a5a80",fontWeight:600,flexShrink:0}}>▦ block</div>
      )}
      {task.bestWindowType && !isDone && (
        <div style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:`${wc}20`,color:wc,fontWeight:600,flexShrink:0}}>{WINDOW_LABELS[task.bestWindowType]}</div>
      )}
      <button onClick={onDelete} style={{fontSize:11,color:"#ddd",background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>✕</button>
    </div>
  );
}
