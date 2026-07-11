import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TidesNow, PlanningWindow } from "@/lib/types";
import { useCurrents } from "@/hooks/useTides";
import { usePremium } from "@/contexts/premium-context";
import { useTester } from "@/contexts/tester-context";
import { CAUTION_PLANET_ARCHETYPE } from "@/lib/tester-profile";
import { ScheduleSuggest } from "@/components/ScheduleSuggest";
import { PLANET_GLYPH } from "@/lib/glyphs";


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
  goalId?:number; projectId?:number;
}

interface GoalLite { id:number; title:string; element?:string|null; }
interface ProjectLite { id:number; title:string; goalId?:number|null; }

const ELEMENT_COLORS: Record<string,string> = { fire:"#c04830", earth:"#4a7040", air:"#c19a3a", water:"#3a5a80" };

function authH(tid:string|null) {
  return { ...(tid ? {"x-tester-id":tid} : {}), "Content-Type":"application/json" };
}

export default function Tasks({ testerId, now, lat = 40.7, lon = -74.0 }: { testerId:string|null; now:TidesNow|undefined; lat?:number; lon?:number }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0,10);
  const [showAdd, setShowAdd] = useState(false);
  // After a task is created, offer to find it a good time (→ Ahead calendar).
  const [suggestFor, setSuggestFor] = useState<{ title: string; goalId?: number; projectId?: number } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newWindow, setNewWindow] = useState("");
  const [newPlanWindow, setNewPlanWindow] = useState<number|"">("");
  const [newDueDate, setNewDueDate] = useState(today);
  const [newGoalId, setNewGoalId] = useState<number|"">("");
  const [newProjectId, setNewProjectId] = useState<number|"">("");

  // "Guarding" — the same self-reported caution windows shown on Guiding
  // Stars/Currents, surfaced right where you're committing to something new.
  const { unlocked: premiumUnlocked } = usePremium();
  const { profile } = useTester();
  const { data: currentsData } = useCurrents(testerId, localStorage.getItem("obs_house_system") ?? "whole-sign");
  const cautionPlanets = profile?.cautionPlanets;
  // cautionWindows from /api/currents is a snapshot of what's active RIGHT NOW —
  // there's no forward-looking version yet (that would need date-range transit
  // scanning like getNextAngularCrossings does for Sky), so this only means
  // something when the task is actually due today.
  const activeCautionMatches = premiumUnlocked && cautionPlanets && cautionPlanets.length > 0
    ? (currentsData?.cautionWindows ?? []).filter((t: any) => cautionPlanets.includes(t.cautionPlanet))
    : [];

  const { data: upcomingWindows = [] } = useQuery<PlanningWindow[]>({
    queryKey: ["planning-windows-all", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/windows", { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
  });

  const { data: goalsList = [] } = useQuery<GoalLite[]>({
    queryKey: ["planning-goals-active", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals?status=active", { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
  });

  const { data: projectsList = [] } = useQuery<ProjectLite[]>({
    queryKey: ["planning-projects-active", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/projects?status=active", { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
  });

  const goalsById = Object.fromEntries(goalsList.map(g => [g.id, g]));
  const projectsById = Object.fromEntries(projectsList.map(p => [p.id, p]));

  // Always fetch ALL tasks — this is one page grouped by timeframe, so nothing
  // ever lives on a hidden "All" tab. A task with no due date (e.g. one spun
  // off a Guiding Star) lands in "Someday", always visible, never lost.
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks", testerId],
    queryFn: async () => {
      const r = await fetch("/api/tasks", { headers: authH(testerId) });
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
          dueDate: newDueDate || undefined,
          bestWindowType: newWindow || undefined,
          planningWindowId: newPlanWindow || undefined,
          goalId: newGoalId || undefined,
          projectId: newProjectId || undefined,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({queryKey:["tasks"]});
      // Offer scheduling for the just-created task before clearing the form —
      // unless the user already picked a specific planning-window block.
      if (!newPlanWindow) {
        setSuggestFor({ title: newTitle.trim(), goalId: newGoalId || undefined, projectId: newProjectId || undefined });
      }
      setNewTitle(""); setNewWindow(""); setNewPlanWindow(""); setNewGoalId(""); setNewProjectId("");
      setNewDueDate(today);
      setShowAdd(false);
    },
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

  // Timeframe buckets — one page, every active task lands in exactly one, and
  // "Someday" (no due date) is always shown so nothing can hide.
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const buckets: { key: string; label: string; accent?: string; tasks: Task[] }[] = [
    { key: "overdue",  label: "Overdue",     accent: "#a04040", tasks: active.filter(t => t.dueDate && t.dueDate < today) },
    { key: "today",    label: "Today",       accent: "#3a6020", tasks: active.filter(t => t.dueDate === today) },
    { key: "week",     label: "This week",   tasks: active.filter(t => t.dueDate && t.dueDate > today && t.dueDate <= weekEnd) },
    { key: "later",    label: "Scheduled later", tasks: active.filter(t => t.dueDate && t.dueDate > weekEnd) },
    { key: "someday",  label: "Someday",     tasks: active.filter(t => !t.dueDate) },
  ];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--color-border)",background: "var(--color-rail)",flexShrink:0}}>
        <div style={{fontSize:12,color:"#888"}}>Tasks · everything, by when</div>
        <button onClick={() => { if (!showAdd) setNewDueDate(today); setShowAdd(v => !v); }} style={{fontSize:11,padding:"5px 12px",borderRadius:7,border:"1px solid var(--color-border)",background:showAdd?"#1a2a3a":"#fff",color:showAdd?"#fff":"#555",cursor:"pointer"}}>
          + New task
        </button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>

        {showAdd && (
          <div style={{background: "var(--color-card)",border:"1px solid var(--color-border)",borderRadius:10,padding:"14px 16px"}}>
            {newDueDate === today && activeCautionMatches.length > 0 && (
              <div style={{fontSize:10.5,color:"#a04040",background:"#a0404008",border:"1px solid #a0404030",borderRadius:7,padding:"6px 9px",marginBottom:8,lineHeight:1.5}}>
                Heads up — {activeCautionMatches.map((t:any,i:number) => (
                  <span key={i}>{i>0 && ", "}{PLANET_GLYPH[t.triggerPlanet]} {t.triggerPlanet} {String(t.aspect).toLowerCase()} your {t.cautionPlanet} ({CAUTION_PLANET_ARCHETYPE[t.cautionPlanet as keyof typeof CAUTION_PLANET_ARCHETYPE]?.label.toLowerCase()})</span>
                ))} is active today — one of your advisories.
              </div>
            )}
            <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key==="Enter" && newTitle.trim() && addTask.mutate()}
              placeholder="Task title…"
              style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:13,marginBottom:8,outline:"none",background: "var(--color-card-2)"}}
            />
            <div style={{display:"flex",gap:8,marginBottom:6}}>
              <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"#555",background: "var(--color-card-2)"}}
              />
              <select value={newWindow} onChange={e => setNewWindow(e.target.value)}
                style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"#555",background: "var(--color-card-2)"}}>
                <option value="">Best time: any</option>
                {WINDOW_TYPES.map(t => <option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
              </select>
            </div>
            {(goalsList.length > 0 || projectsList.length > 0) && (
              <div style={{display:"flex",gap:8,marginBottom:6}}>
                {goalsList.length > 0 && (
                  <select value={newGoalId} onChange={e => setNewGoalId(e.target.value ? Number(e.target.value) : "")}
                    style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"#555",background: "var(--color-card-2)"}}>
                    <option value="">Guiding Star: none</option>
                    {goalsList.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                )}
                {projectsList.length > 0 && (
                  <select value={newProjectId} onChange={e => setNewProjectId(e.target.value ? Number(e.target.value) : "")}
                    style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"#555",background: "var(--color-card-2)"}}>
                    <option value="">Project: none</option>
                    {projectsList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                )}
              </div>
            )}
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

        {/* Timeframe buckets — one page, nothing hidden */}
        {buckets.filter(b => b.tasks.length > 0).map(b => (
          <Sect key={b.key} label={`${b.label} · ${b.tasks.length}`} accent={b.accent}>
            {b.tasks.map(t => (
              <Row key={t.id} task={t}
                goal={t.goalId ? goalsById[t.goalId] : undefined}
                project={t.projectId ? projectsById[t.projectId] : undefined}
                today={today}
                onToggle={() => toggle.mutate({id:t.id,done:t.done!=="true"})}
                onDelete={() => remove.mutate(t.id)}
                onSchedule={() => setSuggestFor({ title: t.title, goalId: t.goalId, projectId: t.projectId })}
                highlight={b.key === "today" && (!t.bestWindowType || t.bestWindowType === bestNow)}
              />
            ))}
          </Sect>
        ))}

        {active.length === 0 && !showAdd && (
          <div style={{textAlign:"center",padding:"48px 0",color:"#bbb",fontSize:13}}>
            {testerId ? "Clear — add a task above." : "Set up your profile to track tasks."}
          </div>
        )}

        {done.length > 0 && (
          <Sect label={`Done · ${done.length}`} muted>
            {done.map(t => <Row key={t.id} task={t} goal={t.goalId ? goalsById[t.goalId] : undefined} project={t.projectId ? projectsById[t.projectId] : undefined} today={today} onToggle={() => toggle.mutate({id:t.id,done:false})} onDelete={() => remove.mutate(t.id)} dim />)}
          </Sect>
        )}
      </div>

      {suggestFor && (
        <ScheduleSuggest
          title={suggestFor.title} testerId={testerId} lat={lat} lon={lon}
          goalId={suggestFor.goalId} projectId={suggestFor.projectId} kind="task"
          onClose={() => setSuggestFor(null)}
        />
      )}
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

function Row({ task, goal, project, today, onToggle, onDelete, onSchedule, highlight, dim }: {
  task:Task; goal?:GoalLite; project?:ProjectLite; today:string;
  onToggle:()=>void; onDelete:()=>void; onSchedule?:()=>void; highlight?:boolean; dim?:boolean;
}) {
  const isDone = task.done === "true";
  const wc = task.bestWindowType ? WINDOW_COLORS[task.bestWindowType] : undefined;
  const goalColor = goal?.element ? ELEMENT_COLORS[goal.element] : undefined;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:7,border:`1px solid ${highlight?"#c0d8b0":"#e8e4de"}`,background:highlight?"#f5faf2":"var(--color-card-2)",opacity:dim?0.5:1}}>
      <button onClick={onToggle} style={{width:17,height:17,borderRadius:4,border:`1.5px solid ${isDone?"#80b870":"#c0bab0"}`,background:isDone?"#80b870":"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff"}}>
        {isDone?"✓":""}
      </button>
      <div style={{flex:1,minWidth:0,fontSize:12,color:isDone?"#bbb":"#222",textDecoration:isDone?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</div>
      {task.dueDate && task.dueDate !== today && !isDone && (
        <div style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:"#f0ede8",color:"#999",fontWeight:600,flexShrink:0}}>{task.dueDate}</div>
      )}
      {goal && !isDone && (
        <div title={`Goal: ${goal.title}`} style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:`${goalColor ?? "#8a8278"}18`,color:goalColor ?? "#8a8278",fontWeight:600,flexShrink:0,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>★ {goal.title}</div>
      )}
      {project && !isDone && (
        <div title={`Project: ${project.title}`} style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:"#3a5a8018",color:"#3a5a80",fontWeight:600,flexShrink:0,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>◆ {project.title}</div>
      )}
      {task.planningWindowId && !isDone ? (
        <div style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:"#e8f0f8",color:"#3a5a80",fontWeight:600,flexShrink:0}}>▦ block</div>
      ) : (!isDone && onSchedule && (
        // Schedule an EXISTING task — the sky picks a good time (owner: 'if a
        // task exists, I should be encouraged to schedule it').
        <button onClick={onSchedule} title="Find a good time for this" style={{fontSize:8.5,padding:"2px 7px",borderRadius:5,border:"1px solid #c8b06a55",background:"#c8b06a12",color:"#8a6a20",fontWeight:600,cursor:"pointer",flexShrink:0}}>◷ schedule</button>
      ))}
      {task.bestWindowType && !isDone && (
        <div style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:`${wc}20`,color:wc,fontWeight:600,flexShrink:0}}>{WINDOW_LABELS[task.bestWindowType]}</div>
      )}
      <button onClick={onDelete} style={{fontSize:11,color:"#ddd",background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>✕</button>
    </div>
  );
}
