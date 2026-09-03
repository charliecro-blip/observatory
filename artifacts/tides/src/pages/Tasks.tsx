import React, { useState, useEffect } from "react";
import { Row as Row_, Disclosure } from "@/components/primitives";
import { jsonArray, listState } from "@/lib/jsonArray";
import { localToday, addDaysLocal } from "@/lib/dates";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TidesNow, PlanningWindow } from "@/lib/types";
import { useCurrents } from "@/hooks/useTides";
import { usePreferences } from "@/contexts/preferences-context";
import { useTester } from "@/contexts/tester-context";
import { CAUTION_PLANET_ARCHETYPE } from "@/lib/tester-profile";
import { ScheduleSuggest } from "@/components/ScheduleSuggest";
import { PLANET_GLYPH } from "@/lib/glyphs";
import { touchLine, type TouchTrail } from "@/lib/touches";
import { ELEMENT_COLORS, elementColor } from "@/lib/elements";
import { PLANET_COLORS } from "@/lib/planetColors";


const WINDOW_TYPES = [
  "deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat"
];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",admin:"Admin",
  social:"Social",relationship:"Relationship",recovery:"Recovery",study:"Study",launch:"Launch",retreat:"Retreat",
};
const WINDOW_COLORS: Record<string,string> = {
  deep_work:"#3a7aaa",creative:"#9060b0",planning:"#c08040",admin:"#888888",
  social:"#d06060",relationship:"#b04080",recovery:"#60a080",study:"#5060a0",launch:PLANET_COLORS.Mars,retreat:"#6080a0",
};
const HOUR_WINDOW: Record<string,string> = {
  Sun:"deep_work",Moon:"recovery",Mercury:"planning",
  Venus:"social",Mars:"deep_work",Jupiter:"creative",Saturn:"study",
};

interface Task {
  id:number; title:string; notes?:string; done:string;
  dueDate?:string; bestWindowType?:string; planningWindowId?:number;
  estMinutes?:number; energy?:string;
  goalId?:number; projectId?:number;
  // Set when auto-rollover has carried this forward — the date it started on.
  originalDueDate?:string|null;
}

// "carried from Tue" — the point of keeping the original date. Says the task
// has been travelling without scolding anyone about it.
function carriedLabel(t: Task, today: string): string | null {
  if (!t.originalDueDate || t.originalDueDate >= today) return null;
  const from = new Date(t.originalDueDate + "T12:00:00");
  const days = Math.round((Date.parse(today + "T12:00:00") - from.getTime()) / 86400000);
  if (days >= 14) return `carried for ${Math.floor(days / 7)} weeks`;
  if (days >= 7) return "carried for a week";
  return `carried from ${from.toLocaleDateString(undefined, { weekday: "short" })}`;
}

const ENERGY_META: Record<string,{label:string;bg:string;fg:string}> = {
  low:    { label:"low",    bg:"#e8efe6", fg:ELEMENT_COLORS.earth },
  medium: { label:"med",    bg:"#f2ecdd", fg:"#9a7a2a" },
  high:   { label:"high",   bg:"#f3e4de", fg:"#b0502e" },
};
function fmtEst(m:number){ return m >= 120 ? `${Math.round(m/60)}h` : m >= 60 ? "1h" : `${m}m`; }

interface GoalLite { id:number; title:string; element?:string|null; }
interface ProjectLite { id:number; title:string; goalId?:number|null; }


function authH(tid:string|null) {
  return { ...(tid ? {"x-tester-id":tid} : {}), "Content-Type":"application/json" };
}

export default function Tasks({ testerId, now, lat = 40.7, lon = -74.0 }: { testerId:string|null; now:TidesNow|undefined; lat?:number; lon?:number }) {
  const qc = useQueryClient();
  const today = localToday();
  const [showAdd, setShowAdd] = useState(false);
  /**
   * DUMP MULTIPLE AT ONCE (owner, 2026-08-31: "on the tasks page, i should
   * be able to dump multiple tasks at once").
   *
   * Reuses /api/plan/parse rather than a second parser — Planner's weave
   * flow already turns a free-text dump into structured tasks (one AI call
   * for the whole list, falling back to a plain line-split when the model is
   * unreachable), and a second implementation here is exactly how two
   * "parse a to-do dump" features would drift into disagreeing about what a
   * line means.
   *
   * PREVIEWED, NOT ADDED BLIND. A parse can misread a line — the model is
   * asked for its best guess at minutes and energy, not told them — so each
   * parsed task is shown and can be dropped before anything is written.
   */
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  interface BulkItem { title: string; estimatedMinutes: number; energy: string; dueDate: string | null; include: boolean; }
  const [bulkPreview, setBulkPreview] = useState<BulkItem[] | null>(null);
  // After a task is created, offer to find it a good time (→ Ahead calendar).
  const [suggestFor, setSuggestFor] = useState<{ title: string; taskId?: number; goalId?: number; projectId?: number } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newWindow, setNewWindow] = useState("");
  const [newPlanWindow, setNewPlanWindow] = useState<number|"">("");
  const [newDueDate, setNewDueDate] = useState(today);
  const [newEstMinutes, setNewEstMinutes] = useState<number|"">("");
  const [newEnergy, setNewEnergy] = useState<""|"low"|"medium"|"high">("");
  const [newGoalId, setNewGoalId] = useState<number|"">("");
  const [newProjectId, setNewProjectId] = useState<number|"">("");

  // "Guarding" — the same self-reported caution windows shown on Guiding
  // Stars/Currents, surfaced right where you're committing to something new.
  // CAUTION PERIODS ARE NOT PAID any more. They are natal-derived, and the
  // pricing decision (2026-08-19) turned natal down as the paid axis — the
  // engine treats chartless as first-class, so charging here would charge for
  // the thing the architecture was built to make optional. Kept as a named
  // constant rather than deleted at every use site, so what changed stays
  // legible and the gate is one edit away if the line ever moves back.
  const premiumUnlocked = true;
  const { prefs } = usePreferences();
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
      return jsonArray(r);
    },
    enabled: !!testerId,
  });

  const { data: goalsList = [] } = useQuery<GoalLite[]>({
    queryKey: ["planning-goals-active", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals?status=active", { headers: authH(testerId) });
      return jsonArray(r);
    },
    enabled: !!testerId,
  });

  const { data: projectsList = [] } = useQuery<ProjectLite[]>({
    queryKey: ["planning-projects-active", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/projects?status=active", { headers: authH(testerId) });
      return jsonArray(r);
    },
    enabled: !!testerId,
  });

  const goalsById = Object.fromEntries(goalsList.map(g => [g.id, g]));
  const projectsById = Object.fromEntries(projectsList.map(p => [p.id, p]));

  // Touch trails — the dated "worked on" record per task (wins.taskId).
  const { data: touchData } = useQuery<{ touches: Record<string, TouchTrail> }>({
    queryKey: ["touches", testerId],
    queryFn: async () => {
      const r = await fetch(`/api/planning/touches?tz=${new Date().getTimezoneOffset()}`, { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
  });

  // Always fetch ALL tasks — this is one page grouped by timeframe, so nothing
  // ever lives on a hidden "All" tab. A task with no due date (e.g. one spun
  // off a Guiding Star) lands in "Someday", always visible, never lost.
  const { data: tasks = [], isError: tasksError, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["tasks", testerId],
    queryFn: async () => {
      const r = await fetch("/api/tasks", { headers: authH(testerId) });
      return jsonArray(r);
    },
    enabled: !!testerId,
    refetchInterval: 30_000,
  });

  // Auto-rollover: carry undone overdue tasks to today, once per local day.
  // Guarded by a localStorage stamp so it fires on the first visit of a new
  // day and not on every mount — and never touches scheduled windows, only
  // tasks. Silent when there's nothing to move; the "carried from" label on
  // each row is what makes it legible rather than spooky.
  const rolloverKey = `compass_rollover_${testerId ?? "anon"}`;
  useEffect(() => {
    if (!testerId) return;
    if (localStorage.getItem(rolloverKey) === today) return;
    if (!prefs.display.autoRollover) { localStorage.setItem(rolloverKey, today); return; }
    (async () => {
      try {
        const r = await fetch("/api/tasks/rollover", {
          method: "POST", headers: authH(testerId), body: JSON.stringify({ today }),
        });
        if (!r.ok) return; // try again next mount rather than marking the day done
        localStorage.setItem(rolloverKey, today);
        const { rolled } = await r.json().catch(() => ({ rolled: 0 }));
        if (rolled > 0) qc.invalidateQueries({ queryKey: ["tasks"] });
      } catch { /* offline — retry next mount */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testerId, today, prefs.display.autoRollover]);

  const addTask = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/tasks", {
        method:"POST", headers: authH(testerId),
        body: JSON.stringify({
          title: newTitle.trim(),
          dueDate: newDueDate || undefined,
          bestWindowType: newWindow || undefined,
          estMinutes: newEstMinutes || undefined,
          energy: newEnergy || undefined,
          planningWindowId: newPlanWindow || undefined,
          goalId: newGoalId || undefined,
          projectId: newProjectId || undefined,
        }),
      });
      if (!r.ok) throw new Error(`create task failed (${r.status})`);
      // Carried so the suggest sheet can pass taskId — without it, scheduling
      // from the sheet had no task to link the window to and a second POST to
      // /planning/windows would have cloned rather than linked (the same
      // orphan-window shape fixed for Save time elsewhere).
      return (await r.json()) as { id: number };
    },
    onSuccess: (created) => {
      qc.invalidateQueries({queryKey:["tasks"]});
      // Offer scheduling for the just-created task before clearing the form —
      // unless the user already picked a specific planning-window block.
      if (!newPlanWindow) {
        setSuggestFor({ title: newTitle.trim(), taskId: created?.id, goalId: newGoalId || undefined, projectId: newProjectId || undefined });
      }
      setNewTitle(""); setNewWindow(""); setNewPlanWindow(""); setNewGoalId(""); setNewProjectId("");
      setNewEstMinutes(""); setNewEnergy("");
      setNewDueDate(today);
      setShowAdd(false);
    },
  });

  const parseBulk = useMutation({
    mutationFn: async (): Promise<BulkItem[]> => {
      const r = await fetch("/api/plan/parse", {
        method: "POST", headers: authH(testerId),
        body: JSON.stringify({
          rawList: bulkText,
          tz: new Date().getTimezoneOffset(),
          tzName: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!r.ok) throw new Error(`parse failed (${r.status})`);
      const { tasks: parsed } = await r.json();
      return (Array.isArray(parsed) ? parsed : []).map((t: any) => ({
        title: String(t.title ?? "").trim(),
        estimatedMinutes: Number.isFinite(t.estimatedMinutes) ? t.estimatedMinutes : 45,
        energy: typeof t.energy === "string" ? t.energy : "medium",
        dueDate: typeof t.dueDate === "string" ? t.dueDate : null,
        include: true,
      })).filter((t: BulkItem) => t.title);
    },
    onSuccess: (items) => setBulkPreview(items),
  });

  const addBulk = useMutation({
    mutationFn: async () => {
      const items = (bulkPreview ?? []).filter(t => t.include);
      // Sequential, not Promise.all: this is the same POST /api/tasks the
      // single-add flow uses, one request per task with no batch endpoint —
      // parallel dozens of writes for one dump is the kind of burst that
      // turns a convenience feature into load on the same path a normal add
      // never has to share.
      for (const t of items) {
        await fetch("/api/tasks", {
          method: "POST", headers: authH(testerId),
          body: JSON.stringify({
            title: t.title,
            dueDate: t.dueDate || undefined,
            estMinutes: t.estimatedMinutes,
            energy: t.energy,
          }),
        });
      }
      return items.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setBulkText(""); setBulkPreview(null); setBulkMode(false); setShowAdd(false);
    },
  });

  const toggle = useMutation({
    mutationFn: async ({id,done}:{id:number;done:boolean}) => {
      await fetch(`/api/tasks/${id}`, { method:"PATCH", headers: authH(testerId), body: JSON.stringify({done:String(done)}) });
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["tasks"]}),
  });

  // Woven-in Log (#27): finishing something is the moment reflection lands, so
  // completing a task quietly offers a one-line note straight into the logbook —
  // no separate tab to remember to visit.
  const [reflectOn, setReflectOn] = useState<{ title: string } | null>(null);
  const [reflectText, setReflectText] = useState("");
  const saveReflection = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch("/api/logs", {
        method: "POST", headers: authH(testerId),
        body: JSON.stringify({ type: "note", notes: text, logDate: today, loggedAt: new Date().toISOString() }),
      });
      // Was unconditional — the modal closed and the typed note vanished on
      // any server error, with no error surfaced (audit P0 #4).
      if (!r.ok) throw new Error("reflection save failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["logs"] }); setReflectOn(null); setReflectText(""); },
  });
  function completeTask(id: number, title: string, wasDone: boolean) {
    toggle.mutate({ id, done: !wasDone });
    if (!wasDone) { setReflectOn({ title }); setReflectText(""); } // just marked done
  }

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
  const weekEnd = addDaysLocal(localToday(), 7);
  const buckets: { key: string; label: string; accent?: string; tasks: Task[] }[] = [
    { key: "overdue",  label: "Past its date",     accent: "#a04040", tasks: active.filter(t => t.dueDate && t.dueDate < today) },
    { key: "today",    label: "Today",       accent: "#3a6020", tasks: active.filter(t => t.dueDate === today) },
    { key: "week",     label: "This week",   tasks: active.filter(t => t.dueDate && t.dueDate > today && t.dueDate <= weekEnd) },
    { key: "later",    label: "Scheduled later", tasks: active.filter(t => t.dueDate && t.dueDate > weekEnd) },
    { key: "someday",  label: "Someday",     tasks: active.filter(t => !t.dueDate) },
  ];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--color-border)",background: "var(--color-rail)",flexShrink:0}}>
        <div style={{fontSize:12,color:"var(--color-muted)",display:"flex",alignItems:"center",gap:8}}>
          <span>Everything, by when</span>
          {/* empty / unavailable / stale are three different things. Showing
              "nothing here" for a failed load is a lie, and this app's whole
              claim is that it's paying attention. */}
          {(() => {
            const st = listState({ data: tasks, isError: tasksError, isLoading: tasksLoading });
            if (st === "stale") return <span title="Showing the last list we loaded" style={{fontSize:10,padding:"1px 7px",borderRadius:10,background:"#c0802014",color:"#a07830",fontWeight:600}}>· offline — showing last known</span>;
            if (st === "unavailable") return <span style={{fontSize:10,padding:"1px 7px",borderRadius:10,background:"#a0303014",color:"#a05050",fontWeight:600}}>· couldn't load your tasks</span>;
            return null;
          })()}
        </div>
        <button onClick={() => {
          if (!showAdd) setNewDueDate(today);
          // Closing the form loses the mode too, so reopening it always
          // starts on the single-task input rather than a stray dump.
          if (showAdd) { setBulkMode(false); setBulkText(""); setBulkPreview(null); }
          setShowAdd(v => !v);
        }} style={{fontSize:11,padding:"5px 12px",borderRadius:7,border:"1px solid var(--color-border)",background:showAdd?"#1a2a3a":"var(--color-card)",color:showAdd?"#ffffff":"var(--text-2)",cursor:"pointer"}}>
          + New task
        </button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>

        {/* Post-completion reflection — the woven-in logbook moment (#27) */}
        {reflectOn && (
          <div style={{background:"#f3f6ee",border:"1px solid #c8d8b8",borderRadius:10,padding:"11px 13px"}}>
            <div style={{fontSize:11,color:"#5a7040",fontWeight:600,marginBottom:6}}>✓ {reflectOn.title} — note what shifted? <span style={{color:"#9ab088",fontWeight:400}}>(optional, goes to your logbook)</span></div>
            <div style={{display:"flex",gap:8}}>
              <input autoFocus value={reflectText} onChange={e=>setReflectText(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&reflectText.trim()) saveReflection.mutate(reflectText.trim()); if(e.key==="Escape"){setReflectOn(null);setReflectText("");} }}
                placeholder="how it went, what you noticed…"
                style={{flex:1,padding:"7px 10px",borderRadius:7,border:"1px solid #c8d8b8",fontSize:12.5,background:"var(--color-card)"}} />
              <button onClick={()=>reflectText.trim()&&saveReflection.mutate(reflectText.trim())} disabled={!reflectText.trim()||saveReflection.isPending}
                style={{padding:"7px 14px",borderRadius:7,border:"none",fontSize:11.5,fontWeight:600,cursor:reflectText.trim()?"pointer":"default",background:reflectText.trim()?"#5a7040":"#dde5d3",color:reflectText.trim()?"#ffffff":"var(--text-3)"}}>Log it</button>
              <button onClick={()=>{setReflectOn(null);setReflectText("");}} style={{padding:"7px 8px",background:"none",border:"none",color:"var(--color-muted)",cursor:"pointer",fontSize:11}}>skip</button>
            </div>
            {saveReflection.isError && <div style={{fontSize:10.5,color:"#a03030",marginTop:6}}>Couldn't save that note — try again.</div>}
          </div>
        )}

        {showAdd && (
          <div style={{background: "var(--color-card)",border:"1px solid var(--color-border)",borderRadius:10,padding:"14px 16px"}}>
            {newDueDate === today && activeCautionMatches.length > 0 && (
              <div style={{fontSize:10.5,color:"#a04040",background:"#a0404008",border:"1px solid #a0404030",borderRadius:7,padding:"6px 9px",marginBottom:8,lineHeight:1.5}}>
                Heads up — {activeCautionMatches.map((t:any,i:number) => (
                  <span key={i}>{i>0 && ", "}<span aria-hidden="true">{PLANET_GLYPH[t.triggerPlanet]}</span> {t.triggerPlanet} {String(t.aspect).toLowerCase()} your {t.cautionPlanet} ({CAUTION_PLANET_ARCHETYPE[t.cautionPlanet as keyof typeof CAUTION_PLANET_ARCHETYPE]?.label.toLowerCase()})</span>
                ))} is active today — one of your advisories.
              </div>
            )}
            {!bulkMode && (
              <>
                <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && newTitle.trim() && addTask.mutate()}
                  placeholder="Task title…"
                  style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:13,marginBottom:6,background: "var(--color-card-2)"}}
                />
                {/* "on the tasks page, i should be able to dump multiple
                    tasks at once" (owner, 2026-08-31). Reuses the same
                    parser Planner's weave flow already runs a free-text dump
                    through — one line each, minutes and energy read as best
                    guesses rather than typed. */}
                <button onClick={() => setBulkMode(true)} style={{fontSize:10.5,color:"var(--text-3)",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:8,textDecoration:"underline"}}>
                  Add several at once →
                </button>
              </>
            )}
            {/* EVERYTHING BUT THE TITLE IS OPTIONAL, AND NOW FOLDED.
                This form opened with a date, a best-window select, a length,
                an energy band, a star, a project and a window link — seven
                controls in the way of typing "call the dentist", which is why
                the one-line capture on Home is where tasks actually get made.
                The fields are unchanged and one tap away. What changed is
                that the form asks your question before it asks the schema. */}
            {!bulkMode && (
            <Disclosure label="Details…">
              <div style={{display:"flex",gap:8,marginBottom:6}}>
                <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                  style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"var(--text-2)",background: "var(--color-card-2)"}}
                />
                <select value={newWindow} onChange={e => setNewWindow(e.target.value)}
                  style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"var(--text-2)",background: "var(--color-card-2)"}}>
                  <option value="">Best time: any</option>
                  {WINDOW_TYPES.map(t => <option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
                </select>
              </div>
              {/* How long + how much energy — the scheduler fits a block of this
                  length into a window, and "quick + low" tasks surface on flat days. */}
              <div style={{display:"flex",gap:8,marginBottom:6}}>
                <select value={newEstMinutes} onChange={e => setNewEstMinutes(e.target.value ? Number(e.target.value) : "")}
                  style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"var(--text-2)",background: "var(--color-card-2)"}}>
                  <option value="">Takes: any length</option>
                  <option value={15}>~15 min</option>
                  <option value={30}>~30 min</option>
                  <option value={60}>~1 hour</option>
                  <option value={120}>~2 hours</option>
                  <option value={240}>half a day</option>
                </select>
                <select value={newEnergy} onChange={e => setNewEnergy(e.target.value as ""|"low"|"medium"|"high")}
                  style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"var(--text-2)",background: "var(--color-card-2)"}}>
                  <option value="">Energy: any</option>
                  <option value="low">Low energy</option>
                  <option value="medium">Medium energy</option>
                  <option value="high">High energy</option>
                </select>
              </div>
              {(goalsList.length > 0 || projectsList.length > 0) && (
                <div style={{display:"flex",gap:8,marginBottom:6}}>
                  {goalsList.length > 0 && (
                    <select value={newGoalId} onChange={e => setNewGoalId(e.target.value ? Number(e.target.value) : "")}
                      style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"var(--text-2)",background: "var(--color-card-2)"}}>
                      <option value="">Guiding Star: none</option>
                      {goalsList.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </select>
                  )}
                  {projectsList.length > 0 && (
                    <select value={newProjectId} onChange={e => setNewProjectId(e.target.value ? Number(e.target.value) : "")}
                      style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"var(--text-2)",background: "var(--color-card-2)"}}>
                      <option value="">Project: none</option>
                      {projectsList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  )}
                </div>
              )}
              {upcomingWindows.length > 0 && (
                <div style={{marginBottom:8}}>
                  <select value={newPlanWindow} onChange={e => setNewPlanWindow(e.target.value ? Number(e.target.value) : "")}
                    style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"var(--text-2)",background: "var(--color-card-2)"}}>
                    <option value="">Link to calendar block: none</option>
                    {upcomingWindows.slice(0,10).map(w => (
                      <option key={w.id} value={w.id}>{w.title} · {w.startTime.slice(0,16).replace("T"," ")}</option>
                    ))}
                  </select>
                </div>
              )}
            </Disclosure>
            )}
            {!bulkMode && (
              <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:10}}>
                {addTask.isError && <span style={{fontSize:10.5,color:"#a03030"}}>Couldn't add it — try again.</span>}
                <button onClick={() => newTitle.trim() && addTask.mutate()} disabled={!newTitle.trim()||addTask.isPending}
                  style={{padding:"6px 14px",borderRadius:7,border:"none",fontSize:11,background:newTitle.trim()?"#1a2a3a":"var(--color-border)",color:newTitle.trim()?"#ffffff":"var(--text-3)",cursor:"pointer"}}>
                  {addTask.isPending ? "Adding…" : "Add task"}
                </button>
              </div>
            )}

            {/* THE DUMP. A textarea until parsed; a checked, editable-by-
                removal preview after — nothing is written until "Add N
                tasks" is pressed, so a bad parse costs a re-read, not a
                cleanup. */}
            {bulkMode && !bulkPreview && (
              <div>
                <textarea autoFocus value={bulkText} onChange={e => setBulkText(e.target.value)}
                  placeholder={"One task per line —\ncall the dentist\nsend the invoice by friday, 15 min\nreturn the library books"}
                  rows={6}
                  style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12.5,fontFamily:"inherit",background: "var(--color-card-2)",resize:"vertical",boxSizing:"border-box"}}
                />
                {parseBulk.isError && <div style={{fontSize:10.5,color:"#a03030",marginTop:6}}>Couldn't read that — try again.</div>}
                <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:10,marginTop:8}}>
                  <button onClick={() => { setBulkMode(false); setBulkText(""); }} style={{fontSize:11,color:"var(--text-3)",background:"none",border:"none",cursor:"pointer"}}>
                    Or add one at a time
                  </button>
                  <button onClick={() => bulkText.trim() && parseBulk.mutate()} disabled={!bulkText.trim()||parseBulk.isPending}
                    style={{padding:"6px 14px",borderRadius:7,border:"none",fontSize:11,background:bulkText.trim()?"#1a2a3a":"var(--color-border)",color:bulkText.trim()?"#ffffff":"var(--text-3)",cursor:"pointer"}}>
                    {parseBulk.isPending ? "Reading…" : "Read the list"}
                  </button>
                </div>
              </div>
            )}

            {bulkMode && bulkPreview && (
              <div>
                <div style={{fontSize:10.5,color:"var(--text-3)",marginBottom:8}}>
                  {bulkPreview.length} task{bulkPreview.length===1?"":"s"} found — uncheck any that aren't right, or go back and rewrite the list.
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10,maxHeight:280,overflowY:"auto"}}>
                  {bulkPreview.map((t,i) => (
                    <label key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"5px 6px",borderRadius:6,cursor:"pointer",opacity:t.include?1:0.45}}>
                      <input type="checkbox" checked={t.include} onChange={e => {
                        const v = e.target.checked;
                        setBulkPreview(p => p ? p.map((x,j)=> j===i ? {...x, include:v} : x) : p);
                      }} style={{marginTop:3,width:13,height:13,accentColor:"#1a2a3a",cursor:"pointer",flexShrink:0}} />
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,color:"var(--color-foreground)"}}>{t.title}</div>
                        <div style={{fontSize:10,color:"var(--text-3)",marginTop:1}}>
                          {t.estimatedMinutes}m · {t.energy} energy{t.dueDate ? ` · due ${t.dueDate}` : ""}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {addBulk.isError && <div style={{fontSize:10.5,color:"#a03030",marginBottom:6}}>Some of those didn't save — check the list.</div>}
                <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:10}}>
                  <button onClick={() => setBulkPreview(null)} style={{fontSize:11,color:"var(--text-3)",background:"none",border:"none",cursor:"pointer"}}>
                    ← Rewrite the list
                  </button>
                  <button onClick={() => addBulk.mutate()} disabled={!bulkPreview.some(t=>t.include)||addBulk.isPending}
                    style={{padding:"6px 14px",borderRadius:7,border:"none",fontSize:11,background:bulkPreview.some(t=>t.include)?"#1a2a3a":"var(--color-border)",color:bulkPreview.some(t=>t.include)?"#ffffff":"var(--text-3)",cursor:"pointer"}}>
                    {addBulk.isPending ? "Adding…" : `Add ${bulkPreview.filter(t=>t.include).length} task${bulkPreview.filter(t=>t.include).length===1?"":"s"}`}
                  </button>
                </div>
              </div>
            )}
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
                touch={touchData?.touches?.[String(t.id)]}
                onToggle={() => completeTask(t.id, t.title, t.done==="true")}
                onDelete={() => remove.mutate(t.id)}
                onSchedule={() => setSuggestFor({ title: t.title, taskId: t.id, goalId: t.goalId, projectId: t.projectId })}
                highlight={b.key === "today" && (!t.bestWindowType || t.bestWindowType === bestNow)}
              />
            ))}
          </Sect>
        ))}

        {active.length === 0 && !showAdd && (
          <div style={{textAlign:"center",padding:"48px 0",color:"var(--text-3)",fontSize:13}}>
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
          taskId={suggestFor.taskId}
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
      <div style={{fontSize: 10.5,textTransform:"uppercase",letterSpacing:"0.6px",color:accent??color??(muted?"var(--text-3)":"var(--text-3)"),fontWeight:600,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
        {label}<div style={{flex:1,height:1,background:"var(--color-card-2)"}}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>{children}</div>
    </div>
  );
}

/**
 * ONE TASK, AS A LINE.
 *
 * This row used to render up to EIGHT chips at 9px — a touch trail, where it
 * carried from, its due date, an estimate, an energy band, its star, its
 * project, whether it held a block, and which window type suited it — plus a
 * schedule button and a delete. Every one of those is a real field, and
 * together they turned a to-do list into a rendering of the schema.
 *
 * The line now says what you need to decide whether to do it:
 *
 *     ○  Revise the formulas notes
 *        Today · carried from Mon
 *
 * Everything else is one tap away, on the row itself. Nothing was removed from
 * the model; what changed is which half of it greets you.
 *
 * The delete stays hidden until the row is hovered or focused. Permanent
 * furniture on every line is most of what makes a list look like a database,
 * and it is reachable from the keyboard because focus reveals it too.
 */
function Row({ task, goal, project, today, touch, onToggle, onDelete, onSchedule, highlight, dim }: {
  task: Task; goal?: GoalLite; project?: ProjectLite; today: string; touch?: TouchTrail;
  onToggle: () => void; onDelete: () => void; onSchedule?: () => void;
  highlight?: boolean; dim?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [hot, setHot] = React.useState(false);
  const isDone = String(task.done) === "true";
  const goalColor = goal?.element ? elementColor(goal.element) : undefined;

  // The meta line: at most the three facts that change what you would do.
  // Due date first because it is the one that decides today; the carry note
  // second because "this is older than it looks" is the other thing worth
  // knowing before you skip it again.
  const bits: string[] = [];
  if (task.dueDate) bits.push(task.dueDate === today ? "Today" : task.dueDate);
  const carried = carriedLabel(task, today);
  if (carried && !isDone) bits.push(`carried from ${carried.replace(/^from /, "")}`);
  if (task.planningWindowId && !isDone) bits.push("has a block");

  return (
    <div onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} onFocus={() => setHot(true)} onBlur={() => setHot(false)}>
      <Row_
        muted={dim || isDone}
        mark={
          <button onClick={onToggle} aria-pressed={isDone} aria-label={`${isDone ? "Reopen" : "Complete"} ${task.title}`}
            style={{
              width: 24, height: 24, margin: -4, padding: 0, border: "none", background: "none",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}>
            <span style={{
              width: 15, height: 15, borderRadius: 4,
              border: isDone ? "none" : `1.5px solid ${highlight ? "var(--color-quality-good)" : "var(--color-border)"}`,
              background: isDone ? "var(--color-quality-good)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#ffffff", fontSize: 10.5, lineHeight: 1,
            }}>{isDone ? "✓" : ""}</span>
          </button>
        }
        title={<span style={{ textDecoration: isDone ? "line-through" : "none" }}>{task.title}</span>}
        meta={bits.length ? bits.join(" · ") : undefined}
        onClick={() => setOpen(v => !v)}
        trailing={
          <>
            {onSchedule && !task.planningWindowId && !isDone && (
              <button onClick={e => { e.stopPropagation(); onSchedule(); }}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-primary)", cursor: "pointer" }}>
                Find a time
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onDelete(); }} aria-label={`Delete ${task.title}`}
              style={{
                fontSize: 12, color: "var(--text-3)", background: "none", border: "none",
                cursor: "pointer", padding: "0 2px",
                visibility: hot ? "visible" : "hidden",
              }}>✕</button>
          </>
        }
      />
      {open && (
        <div style={{ padding: "2px 0 8px 34px", display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 11.5, color: "var(--text-3)" }}>
          {task.estMinutes ? <span>about {fmtEst(task.estMinutes)}</span> : <span>no length set</span>}
          {task.energy && ENERGY_META[task.energy] && <span>{ENERGY_META[task.energy].label.toLowerCase()} energy</span>}
          {goal && <span style={{ color: goalColor ?? "var(--color-muted)" }}>toward {goal.title}</span>}
          {project && <span>part of {project.title}</span>}
          {task.bestWindowType && <span>suits {WINDOW_LABELS[task.bestWindowType]}</span>}
          {touch && <span>{touchLine(touch)}</span>}
          {/* No "nothing recorded" fallback: "no length set" above is always
              printed when there is no estimate, so the empty case already says
              something true. Both at once read as the row contradicting
              itself, which is what it did on the first run of this. */}
        </div>
      )}
    </div>
  );
}
