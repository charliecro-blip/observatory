import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ELEMENT_MYTHOS, sortIntentToElement } from "@/lib/mythos";
import { useCurrents } from "@/hooks/useTides";
import { usePremium } from "@/contexts/premium-context";
import { HOUSE_MEANINGS } from "@/lib/currents-content";

interface Milestone { id:number; projectId:number; title:string; status:string; targetDate?:string; }
interface Project { id:number; title:string; goalId?:number; status:string; priority:string; milestones?:Milestone[]; }
interface Goal {
  id:number; title:string; description?:string; horizon:string; status:string; isNorthStar?:boolean; element?:string|null;
  anchorKind?:string|null; anchorPlanet?:string|null; anchorHouse?:number|null; anchorUntil?:string|null;
}

// A goal's cycle anchor — the long-cycle context that suggested/supports it.
interface PendingAnchor {
  kind: "chapter" | "profection";
  planet?: string;
  house: number;
  until: string | null;
  element: string;
  label: string;
}

const PLANET_GLYPH: Record<string,string> = {
  Sun:"☉", Moon:"☽", Mercury:"☿", Venus:"♀", Mars:"♂", Jupiter:"♃", Saturn:"♄", Uranus:"♅", Neptune:"♆", Pluto:"♇",
};

// House → element by triplicity: 1/5/9 fire, 2/6/10 earth, 3/7/11 air, 4/8/12 water.
const houseElement = (h:number) => (["water","fire","earth","air"] as const)[h % 4];

const ordinal = (n:number) => { const v = n % 100; const s = ["th","st","nd","rd"]; return `${n}${s[(v-20)%10] ?? s[v] ?? s[0]}`; };

const fmtMonth = (iso:string|null|undefined) => iso ? new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",year:"numeric"}) : null;

// Horizon from how long the anchoring cycle has left — a chapter closing soon is
// near-term work; a Pluto chapter with a decade to run is a long game.
const horizonFromUntil = (until:string|null) => {
  if (!until) return "long";
  const months = (new Date(until+"T12:00:00").getTime() - Date.now()) / (30.44*86400000);
  return months <= 6 ? "near" : months <= 18 ? "mid" : "long";
};

const daysUntil = (iso:string|null|undefined) =>
  iso ? Math.round((new Date(iso+"T12:00:00").getTime() - Date.now()) / 86400000) : null;

const HORIZON_COLORS: Record<string,{bg:string;color:string}> = {
  near: {bg:"#dbeafe",color:"#2a5a90"},
  mid:  {bg:"#f0e8d8",color:"#8a5020"},
  long: {bg:"#e8d8f0",color:"#602080"},
};

const ELEMENT_INFO: Record<string,{color:string;label:string}> = {
  fire:  {color:"#c04830", label:"Fire"},
  earth: {color:"#4a7040", label:"Earth"},
  air:   {color:"#7040a0", label:"Air"},
  water: {color:"#3a5a80", label:"Water"},
};

function authH(tid:string|null) {
  return { ...(tid?{"x-tester-id":tid}:{}), "Content-Type":"application/json" };
}

export default function Goals({ testerId }: { testerId:string|null }) {
  const qc = useQueryClient();
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState<number|null>(null); // goalId
  const [showMilestoneForm, setShowMilestoneForm] = useState<number|null>(null); // projectId
  const [goalForm, setGoalForm] = useState({title:"",description:"",horizon:"near"});
  const [projectForm, setProjectForm] = useState({title:"",priority:"medium"});
  const [milestoneForm, setMilestoneForm] = useState({title:"",targetDate:""});
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor|null>(null);

  // Season context for goal suggestions — same /api/currents data the Horizon
  // page renders, so this is premium territory like the rest of the long-cycle
  // features. Panel simply doesn't render when locked or without a birth chart.
  const { unlocked: premiumUnlocked } = usePremium();
  const { data: currents } = useCurrents(testerId, localStorage.getItem("obs_house_system") ?? "whole-sign");

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => { const r = await fetch("/api/planning/goals", {headers:authH(testerId)}); return r.json(); },
    enabled: !!testerId,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects", testerId],
    queryFn: async () => { const r = await fetch("/api/planning/projects", {headers:authH(testerId)}); return r.json(); },
    enabled: !!testerId,
  });

  const { data: milestones = [] } = useQuery<Milestone[]>({
    queryKey: ["milestones", testerId],
    queryFn: async () => { const r = await fetch("/api/planning/milestones", {headers:authH(testerId)}); return r.json(); },
    enabled: !!testerId,
  });

  const addGoal = useMutation({
    mutationFn: async () => {
      const body = {
        ...goalForm,
        ...(pendingAnchor ? {
          element: pendingAnchor.element,
          anchorKind: pendingAnchor.kind,
          anchorPlanet: pendingAnchor.planet ?? null,
          anchorHouse: pendingAnchor.house,
          anchorUntil: pendingAnchor.until,
        } : {}),
      };
      await fetch("/api/planning/goals", {method:"POST",headers:authH(testerId),body:JSON.stringify(body)});
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["goals"]}); setGoalForm({title:"",description:"",horizon:"near"}); setPendingAnchor(null); setShowGoalForm(false); },
  });

  const clearAnchor = useMutation({
    mutationFn: async (id:number) => {
      await fetch(`/api/planning/goals/${id}`, {method:"PATCH",headers:authH(testerId),
        body:JSON.stringify({anchorKind:null,anchorPlanet:null,anchorHouse:null,anchorUntil:null})});
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["goals"]}); qc.invalidateQueries({queryKey:["north-stars"]}); },
  });

  const addProject = useMutation({
    mutationFn: async (goalId:number) => {
      await fetch("/api/planning/projects", {method:"POST",headers:authH(testerId),body:JSON.stringify({...projectForm,goalId})});
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["projects"]}); setProjectForm({title:"",priority:"medium"}); setShowProjectForm(null); },
  });

  const addMilestone = useMutation({
    mutationFn: async (projectId:number) => {
      await fetch("/api/planning/milestones", {method:"POST",headers:authH(testerId),body:JSON.stringify({...milestoneForm,projectId})});
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["milestones"]}); setMilestoneForm({title:"",targetDate:""}); setShowMilestoneForm(null); },
  });

  const cycleMilestone = useMutation({
    mutationFn: async ({id,status}:{id:number;status:string}) => {
      const next = status==="pending"?"in_progress":status==="in_progress"?"completed":"pending";
      await fetch(`/api/planning/milestones/${id}`, {method:"PATCH",headers:authH(testerId),body:JSON.stringify({status:next})});
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["milestones"]}),
  });

  const cycleGoal = useMutation({
    mutationFn: async ({id,status}:{id:number;status:string}) => {
      const next = status==="active"?"paused":"active";
      await fetch(`/api/planning/goals/${id}`, {method:"PATCH",headers:authH(testerId),body:JSON.stringify({status:next})});
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["goals"]}),
  });

  const [nsError, setNsError] = useState<string|null>(null);
  const toggleNorthStar = useMutation({
    mutationFn: async ({id,on}:{id:number;on:boolean}) => {
      const r = await fetch(`/api/planning/goals/${id}/north-star`, {method:"POST",headers:authH(testerId),body:JSON.stringify({on})});
      if (!r.ok) { const e = await r.json(); throw new Error(e.message ?? "Failed"); }
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["goals"]}); qc.invalidateQueries({queryKey:["north-stars"]}); setNsError(null); },
    onError: (e:any) => setNsError(e.message),
  });

  const setElement = useMutation({
    mutationFn: async ({id,element}:{id:number;element:string}) => {
      await fetch(`/api/planning/goals/${id}`, {method:"PATCH",headers:authH(testerId),body:JSON.stringify({element})});
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["goals"]}); qc.invalidateQueries({queryKey:["north-stars"]}); },
  });

  const MS_COLORS: Record<string,string> = { pending:"#d0cbc3", in_progress:"#c8b89a", completed:"#80b870" };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--color-border)",background: "var(--color-rail)",flexShrink:0}}>
        <div style={{fontSize:12,color:"#888"}}>Goals · Projects · Milestones</div>
        <button onClick={()=>setShowGoalForm(v=>!v)} style={{fontSize:11,padding:"5px 12px",borderRadius:7,border:"1px solid var(--color-border)",background:showGoalForm?"#1a2a3a":"#fff",color:showGoalForm?"#fff":"#555",cursor:"pointer"}}>
          + New goal
        </button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>

        {nsError && (
          <div style={{background:"#fdf0ec",border:"1px solid #e8c0b0",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#a04030",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            {nsError}
            <button onClick={()=>setNsError(null)} style={{background:"none",border:"none",color:"#a04030",cursor:"pointer",fontSize:14}}>×</button>
          </div>
        )}

        {/* Supported by this season — goal territories the long cycles currently
            back, from the same /api/currents data the Horizon page shows. One tap
            pre-fills a goal with the element (house triplicity) + cycle anchor,
            so the goal inherits a real season instead of an invented deadline. */}
        {premiumUnlocked && currents?.hasChart && (() => {
          const prof = currents.profection;
          const chapters: any[] = currents.transitsByHouse ?? [];
          if (!prof && chapters.length === 0) return null;
          const riding = (kind:string, house:number, planet?:string) =>
            goals.some(g => g.status==="active" && g.anchorKind===kind && g.anchorHouse===house && (kind!=="chapter" || g.anchorPlanet===planet));
          const start = (a:PendingAnchor) => {
            setPendingAnchor(a);
            setGoalForm(f => ({...f, horizon: horizonFromUntil(a.until)}));
            setShowGoalForm(true);
          };
          const Row = ({a, sub, isRiding}:{a:PendingAnchor; sub:string; isRiding:boolean}) => {
            const ec = ELEMENT_INFO[a.element]?.color ?? "#888";
            return (
              <div style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:"1px solid var(--color-border)"}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:ec,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11.5,fontWeight:600,color:"var(--color-primary)"}}>{a.label}</div>
                  <div style={{fontSize:9.5,color:"#999",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {sub}{a.until ? ` · until ${fmtMonth(a.until)}` : ""}
                  </div>
                </div>
                {isRiding
                  ? <span style={{fontSize:9,color:"#80a870",flexShrink:0}}>✓ riding this</span>
                  : <button onClick={()=>start(a)} style={{fontSize:9.5,padding:"3px 10px",borderRadius:8,border:`1px solid ${ec}50`,background:`${ec}10`,color:ec,cursor:"pointer",fontWeight:600,flexShrink:0}}>
                      Set a goal →
                    </button>}
              </div>
            );
          };
          return (
            <div style={{background:"var(--color-card)",border:"1px solid var(--color-border)",borderRadius:10,padding:"12px 16px 6px"}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.8px",color:"#a89a88",marginBottom:2}}>
                Supported by this season
              </div>
              <div style={{fontSize:10,color:"#999",marginBottom:6,lineHeight:1.5}}>
                Territories the long cycles are currently backing — a goal set here rides its cycle's natural season.
              </div>
              {prof && (
                <Row
                  a={{kind:"profection", house:prof.house, until:prof.yearEnd ?? null, element:houseElement(prof.house), label:`Your ${ordinal(prof.house)}-house year · ${HOUSE_MEANINGS[prof.house]?.title ?? ""}`}}
                  sub={`Ruler of the year: ${prof.timeLord}`}
                  isRiding={riding("profection", prof.house)}
                />
              )}
              {chapters.map((t:any) => (
                <Row key={t.planet}
                  a={{kind:"chapter", planet:t.planet, house:t.house, until:t.leavesHouse ?? null, element:houseElement(t.house), label:`${PLANET_GLYPH[t.planet] ?? ""} ${t.planet} through your ${ordinal(t.house)} · ${HOUSE_MEANINGS[t.house]?.title ?? ""}`}}
                  sub={`A slow chapter${t.retrograde ? " · currently retrograde" : ""}`}
                  isRiding={riding("chapter", t.house, t.planet)}
                />
              ))}
            </div>
          );
        })()}

        {showGoalForm && (
          <div style={{background: "var(--color-card)",border:"1px solid var(--color-border)",borderRadius:10,padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
            {pendingAnchor && (() => {
              const ec = ELEMENT_INFO[pendingAnchor.element]?.color ?? "#888";
              return (
                <div style={{display:"flex",alignItems:"center",gap:7,fontSize:10.5,color:ec,background:`${ec}10`,border:`1px solid ${ec}40`,borderRadius:7,padding:"6px 10px"}}>
                  <span style={{fontWeight:600}}>⏳ {pendingAnchor.label}</span>
                  {pendingAnchor.until && <span style={{color:"#999"}}>until {fmtMonth(pendingAnchor.until)}</span>}
                  <button onClick={()=>setPendingAnchor(null)} style={{marginLeft:"auto",background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:12,padding:0}}>✕</button>
                </div>
              );
            })()}
            <input autoFocus value={goalForm.title} onChange={e=>setGoalForm(f=>({...f,title:e.target.value}))} placeholder="Goal title…"
              style={{padding:"7px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:13,background: "var(--color-card-2)",outline:"none"}}/>
            <input value={goalForm.description} onChange={e=>setGoalForm(f=>({...f,description:e.target.value}))} placeholder="Description (optional)"
              style={{padding:"7px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card-2)",outline:"none"}}/>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {(["near","mid","long"] as const).map(h => (
                <button key={h} onClick={()=>setGoalForm(f=>({...f,horizon:h}))} style={{
                  flex:1,padding:"5px 0",borderRadius:6,border:`1px solid`,cursor:"pointer",fontSize:11,
                  borderColor:goalForm.horizon===h?HORIZON_COLORS[h].color:"#d8d2ca",
                  background:goalForm.horizon===h?HORIZON_COLORS[h].bg:"transparent",
                  color:goalForm.horizon===h?HORIZON_COLORS[h].color:"#888",fontWeight:goalForm.horizon===h?600:400,
                }}>{h}</button>
              ))}
              <button onClick={()=>goalForm.title.trim()&&addGoal.mutate()} disabled={!goalForm.title.trim()}
                style={{padding:"5px 16px",borderRadius:7,border:"none",fontSize:11,background:goalForm.title.trim()?"#1a2a3a":"#e0dcd6",color:goalForm.title.trim()?"#fff":"#aaa",cursor:"pointer"}}>
                Add
              </button>
            </div>
          </div>
        )}

        {goals.filter(g=>g.status==="active").map(goal => {
          const hc = HORIZON_COLORS[goal.horizon] ?? HORIZON_COLORS.long;
          const goalProjects = projects.filter(p=>p.goalId===goal.id&&p.status==="active");
          return (
            <div key={goal.id} style={{background: "var(--color-card)",border:goal.isNorthStar?"1px solid #d0a840":"1px solid var(--color-border)",borderRadius:10,overflow:"hidden",boxShadow:goal.isNorthStar?"0 0 0 1px #f0e0b020":"none"}}>
              {/* Goal header */}
              <div style={{padding:"12px 14px",display:"flex",alignItems:"flex-start",gap:10,borderBottom:goalProjects.length?"1px solid var(--color-border)":"none"}}>
                <button
                  onClick={()=>toggleNorthStar.mutate({id:goal.id,on:!goal.isNorthStar})}
                  title={goal.isNorthStar?"Retire as North Star":"Make this a North Star (max 3)"}
                  style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:0,marginTop:1,color:goal.isNorthStar?"#d0a020":"#ddd",flexShrink:0}}>
                  {goal.isNorthStar?"★":"☆"}
                </button>
                <div style={{fontSize:8,padding:"3px 7px",borderRadius:4,fontWeight:700,textTransform:"uppercase",flexShrink:0,marginTop:2,...hc}}>{goal.horizon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color: "var(--color-foreground)"}}>{goal.title}</div>
                  {goal.description&&<div style={{fontSize:11,color:"#888",marginTop:2}}>{goal.description}</div>}
                  {goal.anchorKind && goal.anchorHouse != null && (() => {
                    const ec = goal.element ? (ELEMENT_INFO[goal.element]?.color ?? "#8a8278") : "#8a8278";
                    const dLeft = daysUntil(goal.anchorUntil);
                    const closingSoon = dLeft != null && dLeft >= 0 && dLeft <= 30;
                    const label = goal.anchorKind === "chapter"
                      ? `rides ${goal.anchorPlanet} through your ${ordinal(goal.anchorHouse)}`
                      : `rides your ${ordinal(goal.anchorHouse)}-house year`;
                    return (
                      <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:4,fontSize:9.5,color:ec,background:`${ec}10`,border:`1px solid ${ec}30`,borderRadius:6,padding:"2px 7px"}}>
                        <span>⏳ {label}{goal.anchorUntil ? ` · until ${fmtMonth(goal.anchorUntil)}` : ""}</span>
                        {closingSoon && <span style={{color:"#a04040",fontWeight:700}}>closing soon</span>}
                        <button onClick={()=>clearAnchor.mutate(goal.id)} title="Unlink from this cycle"
                          style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:10,padding:0,lineHeight:1}}>✕</button>
                      </div>
                    );
                  })()}
                  {goal.isNorthStar && (() => {
                    const suggested = !goal.element ? sortIntentToElement(`${goal.title} ${goal.description ?? ""}`) : null;
                    const mythos = goal.element ? ELEMENT_MYTHOS[goal.element] : null;
                    return (
                      <>
                        <div style={{display:"flex",gap:4,marginTop:6,alignItems:"center"}}>
                          {Object.entries(ELEMENT_INFO).map(([key,info]) => (
                            <button key={key} onClick={()=>setElement.mutate({id:goal.id,element:key})} style={{
                              fontSize:9,padding:"2px 8px",borderRadius:10,cursor:"pointer",
                              border:goal.element===key?`1px solid ${info.color}`:suggested===key?`1px dashed ${info.color}`:"1px solid #e0dad0",
                              background:goal.element===key?`${info.color}18`:"var(--color-card-2)",
                              color:goal.element===key?info.color:suggested===key?info.color:"#999",
                              fontWeight:goal.element===key?600:400,
                            }}>{info.label}{suggested===key?" ?":""}</button>
                          ))}
                          {suggested && <span style={{fontSize:8.5,color:"var(--color-muted)"}}>suggested from the title</span>}
                        </div>
                        {mythos && (
                          <div style={{fontSize:10,color:ELEMENT_INFO[goal.element!]?.color,marginTop:5,fontStyle:"italic",lineHeight:1.45}}>
                            {mythos.essence}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setShowProjectForm(showProjectForm===goal.id?null:goal.id)} style={{fontSize:10,color:"#6090c0",background:"none",border:"none",cursor:"pointer"}}>+ project</button>
                  <button onClick={()=>cycleGoal.mutate({id:goal.id,status:goal.status})} style={{fontSize:10,color:"#bbb",background:"none",border:"none",cursor:"pointer"}}>pause</button>
                </div>
              </div>

              {/* Add project form */}
              {showProjectForm===goal.id && (
                <div style={{padding:"10px 14px",background: "var(--color-card-2)",borderBottom:"1px solid var(--color-border)",display:"flex",gap:6}}>
                  <input autoFocus value={projectForm.title} onChange={e=>setProjectForm(f=>({...f,title:e.target.value}))}
                    onKeyDown={e=>e.key==="Enter"&&projectForm.title.trim()&&addProject.mutate(goal.id)}
                    placeholder="Project name…"
                    style={{flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:12,background: "var(--color-card)",outline:"none"}}/>
                  <button onClick={()=>projectForm.title.trim()&&addProject.mutate(goal.id)}
                    style={{padding:"5px 12px",borderRadius:6,border:"none",fontSize:11,background:"#1a2a3a",color:"#fff",cursor:"pointer"}}>Add</button>
                </div>
              )}

              {/* Projects */}
              {goalProjects.map(project => {
                const pMilestones = milestones.filter(m=>m.projectId===project.id);
                const done = pMilestones.filter(m=>m.status==="completed").length;
                const pct = pMilestones.length ? Math.round((done/pMilestones.length)*100) : 0;
                return (
                  <div key={project.id} style={{padding:"10px 14px 10px 24px",borderBottom:"1px solid var(--color-border)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#333",flex:1}}>{project.title}</div>
                      {pMilestones.length>0 && (
                        <div style={{fontSize:9,color:"#aaa"}}>{done}/{pMilestones.length}</div>
                      )}
                      <button onClick={()=>setShowMilestoneForm(showMilestoneForm===project.id?null:project.id)} style={{fontSize:10,color:"#6090c0",background:"none",border:"none",cursor:"pointer"}}>+ milestone</button>
                    </div>

                    {/* Progress bar */}
                    {pMilestones.length>0 && (
                      <div style={{height:3,background:"#e8e4de",borderRadius:2,marginBottom:8}}>
                        <div style={{height:"100%",width:`${pct}%`,background:"#80b870",borderRadius:2,transition:"width 0.3s"}}/>
                      </div>
                    )}

                    {/* Add milestone form */}
                    {showMilestoneForm===project.id && (
                      <div style={{display:"flex",gap:6,marginBottom:6}}>
                        <input autoFocus value={milestoneForm.title} onChange={e=>setMilestoneForm(f=>({...f,title:e.target.value}))}
                          onKeyDown={e=>e.key==="Enter"&&milestoneForm.title.trim()&&addMilestone.mutate(project.id)}
                          placeholder="Milestone…"
                          style={{flex:1,padding:"4px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,background: "var(--color-card)",outline:"none"}}/>
                        <input type="date" value={milestoneForm.targetDate} onChange={e=>setMilestoneForm(f=>({...f,targetDate:e.target.value}))}
                          style={{padding:"4px 6px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,background: "var(--color-card)"}}/>
                        <button onClick={()=>milestoneForm.title.trim()&&addMilestone.mutate(project.id)}
                          style={{padding:"4px 10px",borderRadius:6,border:"none",fontSize:10,background:"#1a2a3a",color:"#fff",cursor:"pointer"}}>Add</button>
                      </div>
                    )}

                    {/* Milestones */}
                    {pMilestones.map(ms => (
                      <div key={ms.id} onClick={()=>cycleMilestone.mutate({id:ms.id,status:ms.status})} style={{display:"flex",alignItems:"center",gap:7,padding:"3px 0",cursor:"pointer"}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:MS_COLORS[ms.status]??"#888",flexShrink:0}}/>
                        <div style={{fontSize:11,color:ms.status==="completed"?"#bbb":"#555",textDecoration:ms.status==="completed"?"line-through":"none",flex:1}}>{ms.title}</div>
                        {ms.targetDate && <div style={{fontSize:9,color:"#ccc"}}>{ms.targetDate}</div>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}

        {goals.filter(g=>g.status==="active").length===0 && !showGoalForm && (
          <div style={{textAlign:"center",padding:"48px 0",color:"#bbb",fontSize:13}}>
            {testerId?"No active goals. Add one above.":"Set up your profile first."}
          </div>
        )}

        {/* Paused goals */}
        {goals.filter(g=>g.status!=="active").length>0 && (
          <div style={{paddingTop:8,borderTop:"1px solid var(--color-border)"}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"#ccc",marginBottom:8}}>Paused</div>
            {goals.filter(g=>g.status!=="active").map(g=>(
              <div key={g.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:7,opacity:0.5}}>
                <div style={{fontSize:8,padding:"2px 6px",borderRadius:4,...(HORIZON_COLORS[g.horizon]??HORIZON_COLORS.long)}}>{g.horizon}</div>
                <div style={{fontSize:12,color:"#888",flex:1}}>{g.title}</div>
                <button onClick={()=>cycleGoal.mutate({id:g.id,status:g.status})} style={{fontSize:10,color:"#6090c0",background:"none",border:"none",cursor:"pointer"}}>resume</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
