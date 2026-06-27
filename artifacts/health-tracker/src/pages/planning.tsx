import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Target, FolderOpen, Flag, Clock, Plus, X, Check, ChevronDown,
  ChevronUp, Loader2, Trash2, Circle, ArrowRight, Compass,
} from "lucide-react";
import { useTester } from "@/contexts/tester-context";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuspiceNow {
  moonSign: string;
  moonPhase: string;
  biodynamicType: string;
  planetaryHour: { planet: string };
  elementEmphasis: string;
}

interface Goal {
  id: number;
  title: string;
  description: string | null;
  horizon: string | null;
  status: string;
  createdAt: string;
}

interface Project {
  id: number;
  title: string;
  description: string | null;
  goalId: number | null;
  status: string;
  priority: string;
}

interface Milestone {
  id: number;
  title: string;
  description: string | null;
  projectId: number;
  targetDate: string | null;
  status: string;
}

interface PlanningWindow {
  id: number;
  title: string;
  windowType: string;
  startTime: string;
  endTime: string;
  projectId: number | null;
  notes: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WINDOW_TYPES = [
  { value: "deep_work", label: "Deep Work" },
  { value: "planning", label: "Planning" },
  { value: "creative", label: "Creative" },
  { value: "admin", label: "Admin" },
  { value: "social", label: "Social" },
  { value: "relationship", label: "Relationship" },
  { value: "recovery", label: "Recovery" },
  { value: "retreat", label: "Retreat" },
  { value: "launch", label: "Launch" },
  { value: "study", label: "Study" },
];

const WINDOW_COLORS: Record<string, string> = {
  deep_work:    "bg-indigo-500/15 border-indigo-500/30 text-indigo-300",
  planning:     "bg-sky-500/15 border-sky-500/30 text-sky-300",
  creative:     "bg-violet-500/15 border-violet-500/30 text-violet-300",
  admin:        "bg-slate-500/15 border-slate-500/30 text-slate-300",
  social:       "bg-amber-500/15 border-amber-500/30 text-amber-300",
  relationship: "bg-rose-500/15 border-rose-500/30 text-rose-300",
  recovery:     "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
  retreat:      "bg-teal-500/15 border-teal-500/30 text-teal-300",
  launch:       "bg-orange-500/15 border-orange-500/30 text-orange-300",
  study:        "bg-blue-500/15 border-blue-500/30 text-blue-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   "text-rose-400",
  medium: "text-amber-400",
  low:    "text-muted-foreground/50",
};

const HORIZON_LABELS: Record<string, string> = {
  near: "Near-term",
  mid:  "Mid-range",
  long: "Long-term",
};

function todayStr() { return new Date().toISOString().split("T")[0]; }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function isToday(iso: string) {
  return iso.startsWith(todayStr());
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { profile } = useTester();
  const testerId = profile?.testerId ?? null;
  const queryClient = useQueryClient();
  const headers = useCallback(
    (extra: Record<string, string> = {}) => ({
      "x-tester-id": testerId || "",
      "Content-Type": "application/json",
      ...extra,
    }),
    [testerId],
  );

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showWindowForm, setShowWindowForm] = useState(false);
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [newMilestoneFor, setNewMilestoneFor] = useState<number | null>(null);

  const [goalForm, setGoalForm] = useState({ title: "", description: "", horizon: "near" });
  const [projectForm, setProjectForm] = useState({ title: "", description: "", goalId: "", priority: "medium" });
  const [windowForm, setWindowForm] = useState({
    title: "", windowType: "deep_work", projectId: "",
    date: todayStr(), startHour: "09", startMin: "00", endHour: "11", endMin: "00",
  });
  const [milestoneForm, setMilestoneForm] = useState({ title: "", targetDate: "" });

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: auspice } = useQuery<AuspiceNow>({
    queryKey: ["tides-now-planning", testerId],
    queryFn: async () => {
      const r = await fetch("/api/tides/now", { headers: headers({ "Content-Type": "" }) });
      return r.ok ? r.json() : null;
    },
    enabled: !!testerId,
    refetchInterval: 300_000,
  });

  const { data: goalsList = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals?status=active", { headers: headers({ "Content-Type": "" }) });
      return r.ok ? r.json() : [];
    },
    enabled: !!testerId,
  });

  const { data: projectsList = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["projects", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/projects?status=active", { headers: headers({ "Content-Type": "" }) });
      return r.ok ? r.json() : [];
    },
    enabled: !!testerId,
  });

  const { data: milestonesList = [] } = useQuery<Milestone[]>({
    queryKey: ["milestones", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/milestones", { headers: headers({ "Content-Type": "" }) });
      return r.ok ? r.json() : [];
    },
    enabled: !!testerId,
  });

  const { data: windowsList = [] } = useQuery<PlanningWindow[]>({
    queryKey: ["planning-windows", testerId, todayStr()],
    queryFn: async () => {
      const r = await fetch(`/api/planning/windows?date=${todayStr()}`, { headers: headers({ "Content-Type": "" }) });
      return r.ok ? r.json() : [];
    },
    enabled: !!testerId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const createGoal = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/planning/goals", { method: "POST", headers: headers(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", testerId] });
      setGoalForm({ title: "", description: "", horizon: "near" });
      setShowGoalForm(false);
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/planning/goals/${id}`, { method: "DELETE", headers: headers({ "Content-Type": "" }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", testerId] }),
  });

  const createProject = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/planning/projects", { method: "POST", headers: headers(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", testerId] });
      setProjectForm({ title: "", description: "", goalId: "", priority: "medium" });
      setShowProjectForm(false);
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/planning/projects/${id}`, { method: "DELETE", headers: headers({ "Content-Type": "" }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", testerId] });
      queryClient.invalidateQueries({ queryKey: ["milestones", testerId] });
    },
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & object) => {
      const r = await fetch(`/api/planning/milestones/${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify(body) });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["milestones", testerId] }),
  });

  const createMilestone = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/planning/milestones", { method: "POST", headers: headers(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones", testerId] });
      setMilestoneForm({ title: "", targetDate: "" });
      setNewMilestoneFor(null);
    },
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/planning/milestones/${id}`, { method: "DELETE", headers: headers({ "Content-Type": "" }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["milestones", testerId] }),
  });

  const createWindow = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/planning/windows", { method: "POST", headers: headers(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning-windows", testerId, todayStr()] });
      setWindowForm({ title: "", windowType: "deep_work", projectId: "", date: todayStr(), startHour: "09", startMin: "00", endHour: "11", endMin: "00" });
      setShowWindowForm(false);
    },
  });

  const deleteWindow = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/planning/windows/${id}`, { method: "DELETE", headers: headers({ "Content-Type": "" }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planning-windows", testerId, todayStr()] }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.title.trim()) return;
    createGoal.mutate(goalForm);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.title.trim()) return;
    createProject.mutate({
      ...projectForm,
      goalId: projectForm.goalId ? parseInt(projectForm.goalId, 10) : null,
    });
  };

  const handleCreateWindow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!windowForm.title.trim()) return;
    const startTime = new Date(`${windowForm.date}T${windowForm.startHour}:${windowForm.startMin}:00`).toISOString();
    const endTime = new Date(`${windowForm.date}T${windowForm.endHour}:${windowForm.endMin}:00`).toISOString();
    createWindow.mutate({
      title: windowForm.title,
      windowType: windowForm.windowType,
      startTime, endTime,
      projectId: windowForm.projectId ? parseInt(windowForm.projectId, 10) : null,
    });
  };

  const handleCreateMilestone = (e: React.FormEvent, projectId: number) => {
    e.preventDefault();
    if (!milestoneForm.title.trim()) return;
    createMilestone.mutate({ ...milestoneForm, projectId });
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const todayWindows = windowsList.filter((w) => isToday(w.startTime));
  const now = new Date();
  const activeWindows = todayWindows.filter((w) => new Date(w.startTime) <= now && new Date(w.endTime) >= now);
  const upcomingWindows = todayWindows.filter((w) => new Date(w.startTime) > now);

  const milestonesForProject = (projectId: number) =>
    milestonesList.filter((m) => m.projectId === projectId);

  const goalForProject = (goalId: number | null) =>
    goalId ? goalsList.find((g) => g.id === goalId) : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
            <Compass className="w-4 h-4 text-sky-400" />
          </div>
          <h1 className="font-serif text-2xl text-foreground tracking-wide">Planning</h1>
        </div>
        <p className="text-sm text-muted-foreground pl-11 italic">
          Orient, aim, protect, tend.
        </p>
      </div>

      {/* ── Temporal weather strip ───────────────────────────────────────────── */}
      {auspice && (
        <div className="rounded-xl border border-border/20 bg-card/30 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Now</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-foreground/80">
            <span>Moon in <span className="text-foreground font-medium">{auspice.moonSign}</span></span>
            <span className="text-muted-foreground/40">·</span>
            <span className="capitalize">{auspice.moonPhase}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{auspice.elementEmphasis ?? auspice.biodynamicType}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground/70">{auspice.planetaryHour?.planet} hour</span>
          </div>
        </div>
      )}

      {/* ── Today's Windows ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Today's windows
          </p>
          <button
            onClick={() => setShowWindowForm((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-sky-400 transition-colors"
          >
            {showWindowForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showWindowForm ? "Cancel" : "Add window"}
          </button>
        </div>

        {showWindowForm && (
          <form onSubmit={handleCreateWindow} className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-3">
            <input
              type="text"
              value={windowForm.title}
              onChange={(e) => setWindowForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Window name, e.g. Morning deep work"
              className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-sky-500/50 transition-colors"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <select
                  value={windowForm.windowType}
                  onChange={(e) => setWindowForm((f) => ({ ...f, windowType: e.target.value }))}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-sky-500/50 transition-colors"
                >
                  {WINDOW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                <input
                  type="date"
                  value={windowForm.date}
                  onChange={(e) => setWindowForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-sky-500/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <select value={windowForm.startHour} onChange={(e) => setWindowForm((f) => ({ ...f, startHour: e.target.value }))}
                className="bg-background/50 border border-border/50 rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-sky-500/50 transition-colors">
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-muted-foreground">:</span>
              <select value={windowForm.startMin} onChange={(e) => setWindowForm((f) => ({ ...f, startMin: e.target.value }))}
                className="bg-background/50 border border-border/50 rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-sky-500/50 transition-colors">
                {["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <select value={windowForm.endHour} onChange={(e) => setWindowForm((f) => ({ ...f, endHour: e.target.value }))}
                className="bg-background/50 border border-border/50 rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-sky-500/50 transition-colors">
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-muted-foreground">:</span>
              <select value={windowForm.endMin} onChange={(e) => setWindowForm((f) => ({ ...f, endMin: e.target.value }))}
                className="bg-background/50 border border-border/50 rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-sky-500/50 transition-colors">
                {["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {projectsList.length > 0 && (
              <select value={windowForm.projectId} onChange={(e) => setWindowForm((f) => ({ ...f, projectId: e.target.value }))}
                className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-sky-500/50 transition-colors">
                <option value="">— Link to project (optional) —</option>
                {projectsList.map((p) => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
              </select>
            )}
            <button type="submit" disabled={createWindow.isPending}
              className="flex items-center gap-2 text-sm font-medium bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 hover:border-sky-500/50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              {createWindow.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              Add window
            </button>
          </form>
        )}

        {activeWindows.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-sky-400/70 uppercase tracking-wider font-medium">Active now</p>
            {activeWindows.map((w) => <WindowCard key={w.id} w={w} projects={projectsList} onDelete={() => deleteWindow.mutate(w.id)} />)}
          </div>
        )}

        {upcomingWindows.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Upcoming today</p>
            {upcomingWindows.map((w) => <WindowCard key={w.id} w={w} projects={projectsList} onDelete={() => deleteWindow.mutate(w.id)} />)}
          </div>
        )}

        {todayWindows.length === 0 && !showWindowForm && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground/50">No windows planned for today.</p>
          </div>
        )}
      </section>

      {/* ── Projects ─────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3" /> Projects
          </p>
          <button
            onClick={() => setShowProjectForm((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showProjectForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showProjectForm ? "Cancel" : "New project"}
          </button>
        </div>

        {showProjectForm && (
          <form onSubmit={handleCreateProject} className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
            <input
              type="text"
              value={projectForm.title}
              onChange={(e) => setProjectForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Project name"
              className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border/80 transition-colors"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <select value={projectForm.priority} onChange={(e) => setProjectForm((f) => ({ ...f, priority: e.target.value }))}
                className="bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none transition-colors">
                <option value="high">High priority</option>
                <option value="medium">Medium priority</option>
                <option value="low">Low priority</option>
              </select>
              {goalsList.length > 0 && (
                <select value={projectForm.goalId} onChange={(e) => setProjectForm((f) => ({ ...f, goalId: e.target.value }))}
                  className="bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none transition-colors">
                  <option value="">— Link to aim —</option>
                  {goalsList.map((g) => <option key={g.id} value={String(g.id)}>{g.title}</option>)}
                </select>
              )}
            </div>
            <textarea
              value={projectForm.description}
              onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border/80 transition-colors resize-none"
            />
            <button type="submit" disabled={createProject.isPending}
              className="flex items-center gap-2 text-sm font-medium bg-foreground/5 hover:bg-foreground/10 text-foreground/80 border border-border/40 px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              {createProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
              Add project
            </button>
          </form>
        )}

        {projectsLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" /></div>}

        {!projectsLoading && projectsList.length === 0 && !showProjectForm && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground/50">No active projects.</p>
          </div>
        )}

        <div className="space-y-2">
          {projectsList.map((p) => {
            const isExpanded = expandedProject === p.id;
            const pMilestones = milestonesForProject(p.id);
            const pending = pMilestones.filter((m) => m.status !== "completed").length;
            const goal = goalForProject(p.goalId);
            const isAddingMilestone = newMilestoneFor === p.id;

            return (
              <div key={p.id} className="rounded-xl border border-border/30 bg-card/40">
                <div className="flex items-start gap-3 p-4">
                  <FolderOpen className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-[10px] font-medium ${PRIORITY_COLORS[p.priority]}`}>
                        {p.priority}
                      </span>
                      {goal && (
                        <span className="text-[10px] text-muted-foreground/40">
                          → {goal.title}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/90 font-medium leading-snug">{p.title}</p>
                    {p.description && <p className="text-xs text-muted-foreground/60 mt-0.5">{p.description}</p>}
                    {pMilestones.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/40 mt-1">
                        {pending} threshold{pending !== 1 ? "s" : ""} remaining
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setExpandedProject(isExpanded ? null : p.id)}
                      className="text-muted-foreground/30 hover:text-muted-foreground transition-colors p-1">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteProject.mutate(p.id)}
                      className="text-muted-foreground/30 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/10 px-4 pb-4 pt-3 space-y-2">
                    {pMilestones.map((m) => (
                      <div key={m.id} className="flex items-start gap-2">
                        <button onClick={() => updateMilestone.mutate({ id: m.id, status: m.status === "completed" ? "pending" : "completed" })}
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                            m.status === "completed" ? "bg-chart-2 border-chart-2" : "border-border/50 hover:border-chart-2/50"
                          }`}>
                          {m.status === "completed" && <Check className="w-2.5 h-2.5 text-background" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${m.status === "completed" ? "text-muted-foreground/40 line-through" : "text-foreground/80"}`}>
                            {m.title}
                          </p>
                          {m.targetDate && (
                            <p className="text-[10px] text-muted-foreground/40">by {m.targetDate}</p>
                          )}
                        </div>
                        <button onClick={() => deleteMilestone.mutate(m.id)}
                          className="text-muted-foreground/20 hover:text-red-400 transition-colors p-0.5 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {isAddingMilestone ? (
                      <form onSubmit={(e) => handleCreateMilestone(e, p.id)} className="flex items-center gap-2 mt-2">
                        <Circle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                        <input
                          type="text"
                          autoFocus
                          value={milestoneForm.title}
                          onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                          placeholder="Next threshold…"
                          className="flex-1 bg-background/40 border border-border/40 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-chart-2/40 transition-colors"
                        />
                        <input type="date" value={milestoneForm.targetDate}
                          onChange={(e) => setMilestoneForm((f) => ({ ...f, targetDate: e.target.value }))}
                          className="bg-background/40 border border-border/40 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none transition-colors"
                        />
                        <button type="submit" className="text-chart-2 hover:text-chart-2/80 transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => { setNewMilestoneFor(null); setMilestoneForm({ title: "", targetDate: "" }); }}
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    ) : (
                      <button onClick={() => { setNewMilestoneFor(p.id); setMilestoneForm({ title: "", targetDate: "" }); }}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-1">
                        <Plus className="w-3 h-3" /> Add threshold
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Aims (Goals) ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Aims
          </p>
          <button
            onClick={() => setShowGoalForm((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showGoalForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showGoalForm ? "Cancel" : "New aim"}
          </button>
        </div>

        {showGoalForm && (
          <form onSubmit={handleCreateGoal} className="rounded-xl border border-border/30 bg-card/40 p-4 space-y-3">
            <input
              type="text"
              value={goalForm.title}
              onChange={(e) => setGoalForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Directional aim, e.g. Build a sustainable creative practice"
              className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border/80 transition-colors"
              required
            />
            <div className="flex gap-3">
              {(["near", "mid", "long"] as const).map((h) => (
                <button key={h} type="button"
                  onClick={() => setGoalForm((f) => ({ ...f, horizon: h }))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    goalForm.horizon === h
                      ? "bg-foreground/10 border-foreground/30 text-foreground"
                      : "border-border/30 text-muted-foreground/50 hover:text-muted-foreground"
                  }`}>
                  {HORIZON_LABELS[h]}
                </button>
              ))}
            </div>
            <textarea
              value={goalForm.description}
              onChange={(e) => setGoalForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Why this aim matters (optional)"
              rows={2}
              className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors resize-none"
            />
            <button type="submit" disabled={createGoal.isPending}
              className="flex items-center gap-2 text-sm font-medium bg-foreground/5 hover:bg-foreground/10 text-foreground/80 border border-border/40 px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              {createGoal.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
              Set aim
            </button>
          </form>
        )}

        {goalsLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" /></div>}

        {!goalsLoading && goalsList.length === 0 && !showGoalForm && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground/50">No aims set. Add one above.</p>
          </div>
        )}

        <div className="space-y-2">
          {goalsList.map((g) => {
            const linkedProjects = projectsList.filter((p) => p.goalId === g.id);
            return (
              <div key={g.id} className="rounded-xl border border-border/20 bg-card/20 p-4 flex items-start gap-3">
                <Target className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {g.horizon && (
                      <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                        {HORIZON_LABELS[g.horizon] ?? g.horizon}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 font-medium">{g.title}</p>
                  {g.description && <p className="text-xs text-muted-foreground/50 mt-0.5">{g.description}</p>}
                  {linkedProjects.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                      {linkedProjects.map((p) => (
                        <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full border border-border/30 text-muted-foreground/50">
                          {p.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteGoal.mutate(g.id)}
                  className="text-muted-foreground/20 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-[11px] text-muted-foreground/30 text-center leading-relaxed px-4">
        Planning supports orientation, not prediction.
      </p>
    </div>
  );
}

// ── WindowCard ─────────────────────────────────────────────────────────────────

function WindowCard({
  w, projects, onDelete,
}: { w: PlanningWindow; projects: Project[]; onDelete: () => void }) {
  const colorCls = WINDOW_COLORS[w.windowType] ?? "bg-slate-500/15 border-slate-500/30 text-slate-300";
  const linkedProject = w.projectId ? projects.find((p) => p.id === w.projectId) : null;
  const now = new Date();
  const isNow = new Date(w.startTime) <= now && new Date(w.endTime) >= now;

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${isNow ? colorCls : "border-border/20 bg-card/20"}`}>
      <Clock className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isNow ? "" : "text-muted-foreground/30"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${colorCls}`}>
            {WINDOW_TYPES.find((t) => t.value === w.windowType)?.label ?? w.windowType}
          </span>
          {linkedProject && (
            <span className="text-[10px] text-muted-foreground/40">{linkedProject.title}</span>
          )}
        </div>
        <p className="text-sm text-foreground/90 font-medium">{w.title}</p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
          {formatTime(w.startTime)} – {formatTime(w.endTime)}
        </p>
        {w.notes && <p className="text-xs text-muted-foreground/40 mt-0.5 italic">{w.notes}</p>}
      </div>
      <button onClick={onDelete} className="text-muted-foreground/20 hover:text-red-400 transition-colors p-1 flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
