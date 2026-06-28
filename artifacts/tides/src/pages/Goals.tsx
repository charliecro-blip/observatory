import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Milestone { id:number; projectId:number; title:string; status:string; targetDate?:string; }
interface Project { id:number; title:string; goalId?:number; status:string; priority:string; milestones?:Milestone[]; }
interface Goal { id:number; title:string; description?:string; horizon:string; status:string; }

const HORIZON_COLORS: Record<string,{bg:string;color:string}> = {
  near: {bg:"#dbeafe",color:"#2a5a90"},
  mid:  {bg:"#f0e8d8",color:"#8a5020"},
  long: {bg:"#e8d8f0",color:"#602080"},
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
      await fetch("/api/planning/goals", {method:"POST",headers:authH(testerId),body:JSON.stringify(goalForm)});
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["goals"]}); setGoalForm({title:"",description:"",horizon:"near"}); setShowGoalForm(false); },
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

  const MS_COLORS: Record<string,string> = { pending:"#d0cbc3", in_progress:"#c8b89a", completed:"#80b870" };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #d0cbc3",background:"#ece8e2",flexShrink:0}}>
        <div style={{fontSize:12,color:"#888"}}>Goals · Projects · Milestones</div>
        <button onClick={()=>setShowGoalForm(v=>!v)} style={{fontSize:11,padding:"5px 12px",borderRadius:7,border:"1px solid #d0cbc3",background:showGoalForm?"#1a2a3a":"#fff",color:showGoalForm?"#fff":"#555",cursor:"pointer"}}>
          + New goal
        </button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>

        {showGoalForm && (
          <div style={{background:"#fff",border:"1px solid #d0cbc3",borderRadius:10,padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
            <input autoFocus value={goalForm.title} onChange={e=>setGoalForm(f=>({...f,title:e.target.value}))} placeholder="Goal title…"
              style={{padding:"7px 10px",borderRadius:7,border:"1px solid #d8d2ca",fontSize:13,background:"#faf8f5",outline:"none"}}/>
            <input value={goalForm.description} onChange={e=>setGoalForm(f=>({...f,description:e.target.value}))} placeholder="Description (optional)"
              style={{padding:"7px 10px",borderRadius:7,border:"1px solid #d8d2ca",fontSize:12,background:"#faf8f5",outline:"none"}}/>
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
            <div key={goal.id} style={{background:"#fff",border:"1px solid #e8e4de",borderRadius:10,overflow:"hidden"}}>
              {/* Goal header */}
              <div style={{padding:"12px 14px",display:"flex",alignItems:"flex-start",gap:10,borderBottom:goalProjects.length?"1px solid #f0ede8":"none"}}>
                <div style={{fontSize:8,padding:"3px 7px",borderRadius:4,fontWeight:700,textTransform:"uppercase",flexShrink:0,marginTop:2,...hc}}>{goal.horizon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:"#1a1a1a"}}>{goal.title}</div>
                  {goal.description&&<div style={{fontSize:11,color:"#888",marginTop:2}}>{goal.description}</div>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setShowProjectForm(showProjectForm===goal.id?null:goal.id)} style={{fontSize:10,color:"#6090c0",background:"none",border:"none",cursor:"pointer"}}>+ project</button>
                  <button onClick={()=>cycleGoal.mutate({id:goal.id,status:goal.status})} style={{fontSize:10,color:"#bbb",background:"none",border:"none",cursor:"pointer"}}>pause</button>
                </div>
              </div>

              {/* Add project form */}
              {showProjectForm===goal.id && (
                <div style={{padding:"10px 14px",background:"#f8f6f2",borderBottom:"1px solid #f0ede8",display:"flex",gap:6}}>
                  <input autoFocus value={projectForm.title} onChange={e=>setProjectForm(f=>({...f,title:e.target.value}))}
                    onKeyDown={e=>e.key==="Enter"&&projectForm.title.trim()&&addProject.mutate(goal.id)}
                    placeholder="Project name…"
                    style={{flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid #d8d2ca",fontSize:12,background:"#fff",outline:"none"}}/>
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
                  <div key={project.id} style={{padding:"10px 14px 10px 24px",borderBottom:"1px solid #f0ede8"}}>
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
                          style={{flex:1,padding:"4px 8px",borderRadius:6,border:"1px solid #d8d2ca",fontSize:11,background:"#fff",outline:"none"}}/>
                        <input type="date" value={milestoneForm.targetDate} onChange={e=>setMilestoneForm(f=>({...f,targetDate:e.target.value}))}
                          style={{padding:"4px 6px",borderRadius:6,border:"1px solid #d8d2ca",fontSize:11,background:"#fff"}}/>
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
          <div style={{paddingTop:8,borderTop:"1px solid #e8e4de"}}>
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
