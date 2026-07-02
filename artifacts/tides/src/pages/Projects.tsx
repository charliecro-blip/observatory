import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function authH(testerId: string | null): Record<string, string> {
  return testerId ? { "x-tester-id": testerId, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

const HORIZONS = ["near", "mid", "long"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;
const MS_STATUS = ["pending", "in_progress", "completed"] as const;

const PRIORITY_COLOR: Record<string, string> = { high: "#c04040", medium: "#c08030", low: "#60a060" };
const MS_STATUS_COLOR: Record<string, string> = { pending: "#aaa", in_progress: "#c08030", completed: "#60a060" };

function InlineAdd({ placeholder, onAdd, disabled }: { placeholder: string; onAdd: (v: string) => void; disabled?: boolean }) {
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) return (
    <button onClick={() => setOpen(true)} disabled={disabled} style={{
      fontSize: 10, color: "#bbb", background: "none", border: "none", cursor: "pointer", padding: "4px 0",
    }}>+ {placeholder}</button>
  );
  return (
    <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
      <input autoFocus value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); setOpen(false); }
          if (e.key === "Escape") { setOpen(false); setVal(""); }
        }}
        placeholder={placeholder}
        style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, outline: "none", background: "var(--color-card-2)" }}
      />
      <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); setOpen(false); } }}
        style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#1a2a3a", color: "#fff", fontSize: 10, cursor: "pointer" }}>Add</button>
      <button onClick={() => { setOpen(false); setVal(""); }}
        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "#888", fontSize: 10, cursor: "pointer" }}>✕</button>
    </div>
  );
}

function MilestoneRow({ ms, testerId, onDelete }: { ms: any; testerId: string | null; onDelete: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ms.title);
  const [targetDate, setTargetDate] = useState(ms.targetDate ?? "");

  const patch = useMutation({
    mutationFn: async (body: object) => {
      await fetch(`/api/planning/milestones/${ms.id}`, {
        method: "PATCH", headers: authH(testerId), body: JSON.stringify(body),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milestones"] }); setEditing(false); },
  });

  const col = MS_STATUS_COLOR[ms.status] ?? "#aaa";

  if (editing) return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "5px 0" }}>
      <input value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") patch.mutate({ title, targetDate: targetDate || null }); if (e.key === "Escape") setEditing(false); }}
        style={{ flex: 1, padding: "3px 7px", borderRadius: 5, border: "1px solid var(--color-border)", fontSize: 11, outline: "none" }}
      />
      <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
        style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid var(--color-border)", fontSize: 10, outline: "none" }}
      />
      <button onClick={() => patch.mutate({ title, targetDate: targetDate || null })}
        style={{ padding: "3px 9px", borderRadius: 5, border: "none", background: "#1a2a3a", color: "#fff", fontSize: 10, cursor: "pointer" }}>Save</button>
      <button onClick={() => setEditing(false)}
        style={{ padding: "3px 7px", borderRadius: 5, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "#888", fontSize: 10, cursor: "pointer" }}>✕</button>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", borderBottom: "1px solid #f5f0ea" }}>
      <button onClick={() => {
        const next = ms.status === "pending" ? "in_progress" : ms.status === "in_progress" ? "completed" : "pending";
        patch.mutate({ status: next });
      }} style={{
        width: 14, height: 14, borderRadius: "50%", border: `2px solid ${col}`,
        background: ms.status === "completed" ? col : "transparent",
        cursor: "pointer", flexShrink: 0, padding: 0,
      }} title={`Status: ${ms.status}`} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 11, color: ms.status === "completed" ? "#aaa" : "#333", textDecoration: ms.status === "completed" ? "line-through" : "none" }}>
          {ms.title}
        </span>
        {ms.targetDate && (
          <span style={{ fontSize: 9, color: "#aaa", marginLeft: 6 }}>{ms.targetDate}</span>
        )}
      </div>
      <span style={{ fontSize: 9, color: col, background: `${col}18`, padding: "1px 5px", borderRadius: 4 }}>{ms.status.replace("_", " ")}</span>
      <button onClick={() => setEditing(true)} style={{ fontSize: 9, color: "#bbb", background: "none", border: "none", cursor: "pointer", padding: "0 3px" }}>✎</button>
      <button onClick={onDelete} style={{ fontSize: 9, color: "#e08080", background: "none", border: "none", cursor: "pointer", padding: "0 3px" }}>✕</button>
    </div>
  );
}

function ProjectCard({ project, goals, testerId }: { project: any; goals: any[]; testerId: string | null }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [goalId, setGoalId] = useState<string>(project.goalId ? String(project.goalId) : "");

  const { data: milestones = [] } = useQuery<any[]>({
    queryKey: ["milestones", project.id],
    queryFn: async () => {
      const r = await fetch(`/api/planning/milestones?projectId=${project.id}`, { headers: authH(testerId) });
      return r.json();
    },
    enabled: expanded,
  });

  const patchProject = useMutation({
    mutationFn: async (body: object) => {
      await fetch(`/api/planning/projects/${project.id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setEditing(false); },
  });

  const archiveProject = useMutation({
    mutationFn: async () => {
      await fetch(`/api/planning/projects/${project.id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify({ status: "archived" }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const addMilestone = useMutation({
    mutationFn: async (t: string) => {
      await fetch("/api/planning/milestones", { method: "POST", headers: authH(testerId), body: JSON.stringify({ title: t, projectId: project.id }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", project.id] }),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/planning/milestones/${id}`, { method: "DELETE", headers: authH(testerId) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", project.id] }),
  });

  const pColor = PRIORITY_COLOR[project.priority] ?? "#aaa";
  const doneCount = milestones.filter((m: any) => m.status === "completed").length;
  const goalLabel = goals.find(g => g.id === project.goalId)?.title;

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", cursor: "pointer" }} onClick={() => setExpanded(v => !v)}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: pColor, flexShrink: 0 }} />
        {editing ? (
          <div style={{ flex: 1, display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
            <input value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") patchProject.mutate({ title, goalId: goalId ? parseInt(goalId) : null }); if (e.key === "Escape") setEditing(false); }}
              style={{ flex: 1, padding: "3px 7px", borderRadius: 5, border: "1px solid var(--color-border)", fontSize: 12, outline: "none" }}
            />
            <select value={goalId} onChange={e => setGoalId(e.target.value)} style={{ padding: "3px 5px", borderRadius: 5, border: "1px solid var(--color-border)", fontSize: 10 }}>
              <option value="">No goal</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            <button onClick={() => patchProject.mutate({ title, goalId: goalId ? parseInt(goalId) : null })}
              style={{ padding: "3px 9px", borderRadius: 5, border: "none", background: "#1a2a3a", color: "#fff", fontSize: 10, cursor: "pointer" }}>Save</button>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>{project.title}</div>
            {goalLabel && <div style={{ fontSize: 9, color: "#9070c0", marginTop: 1 }}>↳ {goalLabel}</div>}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: pColor, background: `${pColor}18`, padding: "1px 5px", borderRadius: 4 }}>{project.priority}</span>
          {milestones.length > 0 && (
            <span style={{ fontSize: 9, color: "#888" }}>{doneCount}/{milestones.length}</span>
          )}
          {!editing && <button onClick={e => { e.stopPropagation(); setEditing(true); }} style={{ fontSize: 9, color: "#bbb", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}>✎</button>}
          <button onClick={e => { e.stopPropagation(); if (confirm("Archive this project?")) archiveProject.mutate(); }}
            style={{ fontSize: 9, color: "#e08080", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}>✕</button>
          <span style={{ fontSize: 9, color: "#ccc", transform: expanded ? "rotate(180deg)" : "none", display: "inline-block" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--color-border)", padding: "10px 14px" }}>
          {milestones.map((ms: any) => (
            <MilestoneRow key={ms.id} ms={ms} testerId={testerId} onDelete={() => deleteMilestone.mutate(ms.id)} />
          ))}
          <div style={{ marginTop: 6 }}>
            <InlineAdd placeholder="Add milestone" onAdd={t => addMilestone.mutate(t)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Projects({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);

  const { data: goals = [] } = useQuery<any[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals", { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["projects", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/projects?status=active", { headers: authH(testerId) });
      return r.json();
    },
    enabled: !!testerId,
  });

  const addGoal = useMutation({
    mutationFn: async (title: string) => {
      await fetch("/api/planning/goals", { method: "POST", headers: authH(testerId), body: JSON.stringify({ title }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const addProject = useMutation({
    mutationFn: async (title: string) => {
      await fetch("/api/planning/projects", {
        method: "POST", headers: authH(testerId),
        body: JSON.stringify({ title, goalId: selectedGoalId }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const archiveGoal = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/planning/goals/${id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify({ status: "archived" }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const visibleProjects = selectedGoalId === null
    ? projects
    : selectedGoalId === 0
      ? projects.filter((p: any) => !p.goalId)
      : projects.filter((p: any) => p.goalId === selectedGoalId);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 22px 10px", borderBottom: "1px solid var(--color-border)", background: "var(--color-card-2)", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary)", marginBottom: 2 }}>Projects</div>
        <div style={{ fontSize: 10, color: "#aaa" }}>Goal → Project → Milestone · the planning spine</div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Goals sidebar */}
        <div style={{ width: 200, minWidth: 200, borderRight: "1px solid var(--color-border)", overflowY: "auto", padding: "12px 0", flexShrink: 0, background: "var(--color-card-2)" }}>
          <div style={{ padding: "0 12px 8px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#aaa" }}>Goals</div>

          <button onClick={() => setSelectedGoalId(null)} style={{
            width: "100%", textAlign: "left", padding: "7px 14px", background: selectedGoalId === null ? "#e8e4de" : "transparent",
            border: "none", cursor: "pointer", fontSize: 11, color: "#333", fontWeight: selectedGoalId === null ? 600 : 400,
          }}>All projects</button>

          <button onClick={() => setSelectedGoalId(0)} style={{
            width: "100%", textAlign: "left", padding: "7px 14px", background: selectedGoalId === 0 ? "#e8e4de" : "transparent",
            border: "none", cursor: "pointer", fontSize: 11, color: "#888",
          }}>No goal</button>

          <div style={{ height: 1, background: "#d8d2ca", margin: "6px 12px" }} />

          {goals.filter((g: any) => g.status === "active").map((g: any) => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <button onClick={() => setSelectedGoalId(g.id)} style={{
                flex: 1, textAlign: "left", padding: "7px 14px", background: selectedGoalId === g.id ? "#e8e4de" : "transparent",
                border: "none", cursor: "pointer", fontSize: 11, color: selectedGoalId === g.id ? "#1a2a3a" : "#555",
                fontWeight: selectedGoalId === g.id ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                <span style={{ color: "#9060c0", marginRight: 5 }}>◆</span>{g.title}
                {g.horizon && <span style={{ fontSize: 8, color: "#bbb", marginLeft: 4 }}>{g.horizon}</span>}
              </button>
              <button onClick={() => { if (confirm("Archive this goal?")) archiveGoal.mutate(g.id); }}
                style={{ fontSize: 8, color: "#ddd", background: "none", border: "none", cursor: "pointer", padding: "0 8px 0 0", flexShrink: 0 }}>✕</button>
            </div>
          ))}

          <div style={{ padding: "8px 12px 0" }}>
            <InlineAdd placeholder="New goal" onAdd={t => addGoal.mutate(t)} />
          </div>
        </div>

        {/* Projects main area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {selectedGoalId !== null && selectedGoalId > 0 && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: "#f0ebf8", borderRadius: 8, border: "1px solid #d8c8f0" }}>
              <div style={{ fontSize: 10, color: "#9060c0", fontWeight: 600, marginBottom: 1 }}>
                Goal · {goals.find(g => g.id === selectedGoalId)?.horizon ?? ""}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-primary)" }}>{goals.find(g => g.id === selectedGoalId)?.title}</div>
              {goals.find(g => g.id === selectedGoalId)?.description && (
                <div style={{ fontSize: 10, color: "#777", marginTop: 4 }}>{goals.find(g => g.id === selectedGoalId)?.description}</div>
              )}
            </div>
          )}

          {visibleProjects.length === 0 && (
            <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", marginTop: 32 }}>No projects yet. Add one below.</div>
          )}

          {visibleProjects.map((p: any) => (
            <ProjectCard key={p.id} project={p} goals={goals} testerId={testerId} />
          ))}

          <div style={{ marginTop: 8 }}>
            <InlineAdd placeholder="Add project" onAdd={t => addProject.mutate(t)} />
          </div>
        </div>
      </div>
    </div>
  );
}
