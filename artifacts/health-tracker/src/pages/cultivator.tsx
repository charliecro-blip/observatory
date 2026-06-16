import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sprout, Plus, X, Check, ChevronDown, ChevronUp, Loader2, Leaf, Pause, RotateCcw, Trash2, Calendar } from "lucide-react";
import { useTester } from "@/contexts/tester-context";
import {
  CULTIVATION_DOMAINS, DOMAIN_COLORS, todayStr,
  ELEMENT_BADGE_CLS, ELEMENT_COLOR_CLS,
  ELEMENT_LABELS, ELEMENT_SYMBOLS,
  type ElementKey,
} from "@/lib/elements";

// ── Constants ─────────────────────────────────────────────────────────────────

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "a few times a week", label: "A few times a week" },
  { value: "weekly", label: "Weekly" },
  { value: "as needed", label: "As needed" },
];

const ELEMENT_META: Record<ElementKey, { label: string; symbol: string; chipCls: string; activeCls: string; badgeCls: string }> = {
  fire:   { label: ELEMENT_LABELS.fire,   symbol: ELEMENT_SYMBOLS.fire,   chipCls: "border-orange-500/30 text-orange-300/60 hover:border-orange-400/60 hover:text-orange-300", activeCls: "bg-orange-500/20 border-orange-500/50 text-orange-300",  badgeCls: ELEMENT_BADGE_CLS.fire },
  earth:  { label: ELEMENT_LABELS.earth,  symbol: ELEMENT_SYMBOLS.earth,  chipCls: "border-emerald-500/30 text-emerald-300/60 hover:border-emerald-400/60 hover:text-emerald-300", activeCls: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300", badgeCls: ELEMENT_BADGE_CLS.earth },
  air:    { label: ELEMENT_LABELS.air,    symbol: ELEMENT_SYMBOLS.air,    chipCls: "border-sky-500/30 text-sky-300/60 hover:border-sky-400/60 hover:text-sky-300", activeCls: "bg-sky-500/20 border-sky-500/50 text-sky-300",         badgeCls: ELEMENT_BADGE_CLS.air },
  water:  { label: ELEMENT_LABELS.water,  symbol: ELEMENT_SYMBOLS.water,  chipCls: "border-blue-500/30 text-blue-300/60 hover:border-blue-400/60 hover:text-blue-300", activeCls: "bg-blue-500/20 border-blue-500/50 text-blue-300",       badgeCls: ELEMENT_BADGE_CLS.water },
  spirit: { label: ELEMENT_LABELS.spirit, symbol: ELEMENT_SYMBOLS.spirit, chipCls: "border-violet-500/30 text-violet-300/60 hover:border-violet-400/60 hover:text-violet-300", activeCls: "bg-violet-500/20 border-violet-500/50 text-violet-300", badgeCls: ELEMENT_BADGE_CLS.spirit },
};

// Day-of-week initials indexed by getDay() (0=Sun)
const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const EFFORT_LABELS = ["", "gentle", "moderate", "substantial", "deep", "full presence"];

// ── Date helpers ──────────────────────────────────────────────────────────────

function thirtyDaysAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().split("T")[0];
}

function formatSuccessDate(dateStr: string): string {
  if (dateStr === todayStr()) return "today";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "active" | "paused" | "completed";

interface CheckIn {
  id: number;
  completed: boolean;
  effortLevel: number | null;
  note: string | null;
  practicesCompleted: string[] | null;
  durationMinutes: number | null;
}

interface CultivationRow {
  id: number;
  title: string;
  domain: string;
  element: string | null;
  elements: string[] | null;
  description: string | null;
  targetPractice: string | null;
  frequency: string;
  status: Status;
  relatedPlanet: string | null;
  relatedHouse: number | null;
  todayCheckIn: CheckIn | null;
  createdAt: string;
}

interface TendState {
  id: number;
  effort: number;
  note: string;
  date: string;
  practiceNote: string;
  durationMinutes: string;
}

type CreateBody = {
  title: string;
  domain: string;
  targetPractice: string;
  description: string;
  frequency: string;
  elements?: string[];
};

// ── Main component ────────────────────────────────────────────────────────────

export default function Cultivator() {
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

  const [showCreate, setShowCreate] = useState(false);
  const [tendState, setTendState] = useState<TendState | null>(null);
  const [showPaused, setShowPaused] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ id: number; date: string } | null>(null);

  const [form, setForm] = useState({
    title: "", domain: "", targetPractice: "", description: "", frequency: "daily", elements: [] as string[],
  });

  const qKey = ["cultivations", testerId];

  const { data: cultivations = [], isLoading } = useQuery<CultivationRow[]>({
    queryKey: qKey,
    queryFn: async () => {
      const res = await fetch("/api/cultivations", { headers: headers() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!testerId,
  });

  const createMutation = useMutation({
    mutationFn: async (body: CreateBody) => {
      const res = await fetch("/api/cultivations", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey });
      setForm({ title: "", domain: "", targetPractice: "", description: "", frequency: "daily", elements: [] });
      setShowCreate(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: Partial<CultivationRow> & { id: number }) => {
      const res = await fetch(`/api/cultivations/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/cultivations/${id}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });

  const checkInMutation = useMutation({
    mutationFn: async ({
      id, completed, effortLevel, note, date, practicesCompleted, durationMinutes,
    }: {
      id: number;
      completed: boolean;
      effortLevel?: number | null;
      note?: string;
      date?: string;
      practicesCompleted?: string[] | null;
      durationMinutes?: number | null;
    }) => {
      const body: Record<string, unknown> = {
        completed,
        effortLevel: effortLevel ?? null,
        note: note ?? null,
      };
      if (date) body.date = date;
      if (practicesCompleted !== undefined) body.practicesCompleted = practicesCompleted;
      if (durationMinutes !== undefined) body.durationMinutes = durationMinutes;
      const res = await fetch(`/api/cultivations/${id}/check-ins`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: qKey });
      if (variables.completed) {
        const savedDate = variables.date || todayStr();
        const savedId = variables.id;
        setSuccessInfo({ id: savedId, date: savedDate });
        setTimeout(
          () => setSuccessInfo((cur) => (cur?.id === savedId ? null : cur)),
          4000,
        );
      }
      setTendState(null);
    },
  });

  const active = cultivations.filter((c) => c.status === "active");
  const paused = cultivations.filter((c) => c.status === "paused");
  const completed = cultivations.filter((c) => c.status === "completed");
  const tendedCount = active.filter((c) => c.todayCheckIn?.completed).length;

  const handleOpenPanel = (c: CultivationRow) => {
    if (tendState?.id === c.id) return;
    setSuccessInfo(null);
    setTendState({ id: c.id, effort: 0, note: "", date: todayStr(), practiceNote: "", durationMinutes: "" });
  };

  const handleRemoveLog = (c: CultivationRow) => {
    setSuccessInfo(null);
    checkInMutation.mutate({ id: c.id, completed: false });
  };

  const handleConfirmTend = () => {
    if (!tendState) return;
    const practicesCompleted = tendState.practiceNote.trim() ? [tendState.practiceNote.trim()] : null;
    const durationMinutes = tendState.durationMinutes ? (parseInt(tendState.durationMinutes, 10) || null) : null;
    checkInMutation.mutate({
      id: tendState.id,
      completed: true,
      effortLevel: tendState.effort > 0 ? tendState.effort : null,
      note: tendState.note.trim() || undefined,
      date: tendState.date,
      practicesCompleted,
      durationMinutes,
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.domain) return;
    const { elements, ...rest } = form;
    createMutation.mutate({ ...rest, ...(elements.length > 0 ? { elements } : {}) });
  };

  const domainLabel = (d: string) =>
    CULTIVATION_DOMAINS.find((x) => x.value === d)?.label ?? d;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-chart-2/10 border border-chart-2/20 flex items-center justify-center flex-shrink-0">
            <Sprout className="w-4 h-4 text-chart-2" />
          </div>
          <h1 className="font-serif text-2xl text-foreground tracking-wide">Cultivator</h1>
        </div>
        <p className="text-sm text-muted-foreground pl-11 italic">
          Your inner garden: plants and planets, practices and patterns.
        </p>
      </div>

      {/* Progress bar + add button */}
      {active.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{tendedCount}</span> of {active.length} logged today
            </p>
            <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-chart-2/60 rounded-full transition-all duration-500"
                style={{ width: `${active.length > 0 ? (tendedCount / active.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-chart-2/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            {showCreate ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showCreate ? "Cancel" : "Plant new"}
          </button>
        </div>
      )}

      {/* Create form */}
      {(showCreate || (active.length === 0 && paused.length === 0 && completed.length === 0)) && (
        <div className="rounded-xl border border-chart-2/20 bg-chart-2/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground/90 flex items-center gap-2">
              <Leaf className="w-3.5 h-3.5 text-chart-2/70" />
              Plant a new cultivation
            </h3>
            {(active.length > 0 || paused.length > 0) && (
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">What are you tending?</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Wind-down ritual before 10 pm"
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-chart-2/50 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Domain</label>
                <select
                  value={form.domain}
                  onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-chart-2/50 transition-colors"
                  required
                >
                  <option value="">Select domain</option>
                  {CULTIVATION_DOMAINS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-chart-2/50 transition-colors"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Element selector — multi-select */}
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Elements <span className="text-muted-foreground/40">(choose one or more — or leave blank to auto-derive)</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Object.entries(ELEMENT_META).map(([key, meta]) => {
                    const isActive = form.elements.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((f) => ({
                          ...f,
                          elements: f.elements.includes(key)
                            ? f.elements.filter((e) => e !== key)
                            : [...f.elements, key],
                        }))}
                        className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                          isActive ? meta.activeCls : meta.chipCls
                        }`}
                      >
                        <span>{meta.symbol}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                  {form.elements.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, elements: [] }))}
                      className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      clear
                    </button>
                  )}
                  {form.elements.length === 0 && form.domain && (
                    <span className="text-[10px] text-muted-foreground/40 italic">auto from domain</span>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">
                  Minimum viable practice <span className="text-muted-foreground/40">(what specifically counts)</span>
                </label>
                <input
                  type="text"
                  value={form.targetPractice}
                  onChange={(e) => setForm((f) => ({ ...f, targetPractice: e.target.value }))}
                  placeholder="e.g. No screens 45 min before sleep, dim lights"
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-chart-2/50 transition-colors"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">
                  Notes / context <span className="text-muted-foreground/40">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Why this, why now…"
                  rows={2}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-chart-2/50 transition-colors resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending || !form.title.trim() || !form.domain}
              className="flex items-center gap-2 text-sm font-medium bg-chart-2/15 hover:bg-chart-2/25 text-chart-2 border border-chart-2/30 hover:border-chart-2/50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sprout className="w-3.5 h-3.5" />}
              Plant this cultivation
            </button>
          </form>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && active.length === 0 && paused.length === 0 && completed.length === 0 && !showCreate && (
        <div className="rounded-xl border border-border/20 bg-card/30 p-10 text-center space-y-3">
          <Sprout className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Your garden is empty. Plant your first cultivation above.</p>
        </div>
      )}

      {/* Active cultivations */}
      {!isLoading && active.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Active</p>
            {!showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-chart-2 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Plant new
              </button>
            )}
          </div>
          {active.map((c) => (
            <CultivationCard
              key={c.id}
              c={c}
              testerId={testerId}
              tendState={tendState?.id === c.id ? tendState : null}
              onOpenPanel={() => handleOpenPanel(c)}
              onConfirmTend={handleConfirmTend}
              onCancelTend={() => setTendState(null)}
              onTendStateChange={(s) => setTendState(s)}
              isSaving={checkInMutation.isPending && tendState?.id === c.id}
              onPause={() => updateMutation.mutate({ id: c.id, status: "paused" })}
              onComplete={() => updateMutation.mutate({ id: c.id, status: "completed" })}
              onDelete={() => deleteMutation.mutate(c.id)}
              onRemoveLog={() => handleRemoveLog(c)}
              domainLabel={domainLabel(c.domain)}
              successMessage={
                successInfo?.id === c.id
                  ? `Logged for ${formatSuccessDate(successInfo.date)}.`
                  : null
              }
            />
          ))}
        </div>
      )}

      {/* Paused / completed */}
      {!isLoading && (paused.length > 0 || completed.length > 0) && (
        <div className="space-y-2">
          <button
            onClick={() => setShowPaused((v) => !v)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
          >
            {showPaused ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span className="uppercase tracking-widest font-medium">
              Paused &amp; completed ({paused.length + completed.length})
            </span>
          </button>

          {showPaused && (
            <div className="space-y-2 pl-1">
              {[...paused, ...completed].map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/20 bg-card/20"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    {(c.elements && c.elements.length > 0 ? c.elements : c.element ? [c.element] : []).map((el) =>
                      ELEMENT_META[el] ? (
                        <span key={el} className={`text-[10px] px-2 py-0.5 rounded-full border ${ELEMENT_META[el].badgeCls}`}>
                          {ELEMENT_META[el].symbol}
                        </span>
                      ) : null
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${DOMAIN_COLORS[c.domain] ?? "bg-muted/20 text-muted-foreground border-border/20"}`}>
                      {domainLabel(c.domain)}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">{c.title}</span>
                    <span className={`text-[10px] ${c.status === "paused" ? "text-amber-400" : "text-muted-foreground/40"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.status === "paused" && (
                      <button
                        onClick={() => updateMutation.mutate({ id: c.id, status: "active" })}
                        className="text-xs text-chart-2/70 hover:text-chart-2 border border-border/30 hover:border-chart-2/30 px-2 py-1 rounded-lg transition-colors"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/40 text-center leading-relaxed px-4">
        Cultivator is a practice-tracking and intention-setting tool. It does not provide medical guidance and makes no health claims.
      </p>
    </div>
  );
}

// ── CultivationCard ───────────────────────────────────────────────────────────

function CultivationCard({
  c,
  testerId,
  tendState,
  onOpenPanel,
  onConfirmTend,
  onCancelTend,
  onTendStateChange,
  isSaving,
  onPause,
  onComplete,
  onDelete,
  onRemoveLog,
  domainLabel,
  successMessage,
}: {
  c: CultivationRow;
  testerId: string | null;
  tendState: TendState | null;
  onOpenPanel: () => void;
  onConfirmTend: () => void;
  onCancelTend: () => void;
  onTendStateChange: (s: TendState) => void;
  isSaving: boolean;
  onPause: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onRemoveLog: () => void;
  domainLabel: string;
  successMessage: string | null;
}) {
  const [showActions, setShowActions] = useState(false);
  const tended = c.todayCheckIn?.completed === true;
  const isTending = tendState !== null;
  const cultivationElements = (c.elements && c.elements.length > 0) ? c.elements : (c.element ? [c.element] : []);

  // ── 7-day rhythm history ───────────────────────────────────────────────────
  const { data: recentHistory = [] } = useQuery<Array<{ date: string; completed: boolean }>>({
    queryKey: ["cultivations", testerId, c.id, "history"],
    queryFn: async () => {
      if (!testerId) return [];
      const res = await fetch(`/api/cultivations/${c.id}/check-ins?days=7`, {
        headers: { "x-tester-id": testerId },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!testerId,
    staleTime: 30_000,
  });

  const checkInMap: Record<string, boolean> = {};
  for (const h of recentHistory) {
    checkInMap[h.date] = h.completed;
  }

  // Build array: index 0 = 6 days ago, index 6 = today
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    return {
      dateStr,
      dayInitial: DAY_INITIALS[d.getDay()],
      isToday: i === 6,
      completed: checkInMap[dateStr] === true,
    };
  });

  const tendedLast7 = last7Days.filter((d) => d.completed).length;

  return (
    <div className={`rounded-xl border backdrop-blur-sm transition-all ${
      tended ? "border-chart-2/25 bg-chart-2/5" : "border-border/30 bg-card/40"
    }`}>

      {/* ── Content row ── */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Status indicator — visual only */}
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all ${
            tended ? "bg-chart-2 border-chart-2 text-background" : "border-border/40 bg-transparent"
          }`}
        >
          {tended && <Check className="w-3 h-3" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {cultivationElements.map((el) => ELEMENT_META[el] ? (
              <span key={el} className={`text-[10px] px-2 py-0.5 rounded-full border ${ELEMENT_META[el].badgeCls}`}>
                {ELEMENT_META[el].symbol} {ELEMENT_META[el].label}
              </span>
            ) : null)}
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${DOMAIN_COLORS[c.domain] ?? "bg-muted/20 text-muted-foreground border-border/20"}`}>
              {domainLabel}
            </span>
          </div>

          <p className={`text-sm font-medium leading-snug ${
            tended ? "text-foreground/50 line-through decoration-chart-2/30" : "text-foreground/90"
          }`}>
            {c.title}
          </p>
        </div>

        {/* Actions menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowActions((v) => !v)}
            className="text-muted-foreground/30 hover:text-muted-foreground transition-colors p-1"
            title="More options"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showActions && (
            <div className="absolute right-0 top-7 z-10 bg-popover border border-border/50 rounded-xl shadow-lg p-1 min-w-[160px] space-y-0.5">
              {tended && (
                <button
                  onClick={() => { onRemoveLog(); setShowActions(false); }}
                  className="w-full flex items-center gap-2 text-xs text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" /> Remove today's log
                </button>
              )}
              <button
                onClick={() => { onPause(); setShowActions(false); }}
                className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Pause className="w-3 h-3" /> Pause
              </button>
              <button
                onClick={() => { onComplete(); setShowActions(false); }}
                className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Mark complete
              </button>
              <button
                onClick={() => { onDelete(); setShowActions(false); }}
                className="w-full flex items-center gap-2 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent rhythm ── */}
      <div className="mx-4 border-t border-border/10 pt-2.5 pb-3 space-y-2">
        {/* Dot row */}
        <div className="flex items-center gap-0.5">
          {last7Days.map(({ dateStr, dayInitial, isToday, completed }) => (
            <div key={dateStr} className="flex flex-col items-center gap-1 w-6">
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  completed
                    ? "bg-chart-2/70"
                    : isToday
                    ? "ring-1 ring-muted-foreground/25 bg-transparent"
                    : "bg-border/20"
                }`}
              />
              <span className={`text-[8px] leading-none font-medium ${
                isToday ? "text-muted-foreground/50" : "text-muted-foreground/20"
              }`}>
                {dayInitial}
              </span>
            </div>
          ))}
          <span className="text-[10px] text-muted-foreground/40 ml-1.5 leading-none">
            {tendedLast7} of 7
          </span>
        </div>

        {/* Rhythm + Minimum line */}
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground/40 leading-snug">
            Tended {tendedLast7} of last 7 days
            <span className="mx-1.5 opacity-50">·</span>
            Rhythm: {c.frequency}
          </p>
          {c.targetPractice && (
            <p className="text-[10px] text-muted-foreground/35 leading-snug">
              Minimum: {c.targetPractice}
            </p>
          )}
        </div>
      </div>

      {/* ── Footer: success / tended-info + Log practice button ── */}
      {!isTending && (
        <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-0">
          <div className="flex-1 min-w-0">
            {successMessage ? (
              <div className="flex items-center gap-1.5 text-sm text-chart-2 font-medium">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            ) : tended && c.todayCheckIn ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-chart-2/70">Logged</span>
                {c.todayCheckIn.effortLevel != null && (
                  <span className="text-[11px] text-muted-foreground/50">
                    {EFFORT_LABELS[c.todayCheckIn.effortLevel]} effort
                  </span>
                )}
                {c.todayCheckIn.durationMinutes != null && (
                  <span className="text-[11px] text-muted-foreground/50">
                    {c.todayCheckIn.durationMinutes} min
                  </span>
                )}
                {c.todayCheckIn.practicesCompleted != null &&
                  c.todayCheckIn.practicesCompleted.length > 0 && (
                    <span className="text-[11px] text-muted-foreground/50 italic truncate">
                      {c.todayCheckIn.practicesCompleted[0]}
                    </span>
                  )}
                {c.todayCheckIn.note && (
                  <span className="text-[11px] text-muted-foreground/40 italic truncate">
                    "{c.todayCheckIn.note}"
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <button
            onClick={onOpenPanel}
            className={`flex-shrink-0 flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
              tended
                ? "bg-chart-2/15 hover:bg-chart-2/25 text-chart-2 border border-chart-2/40"
                : "bg-chart-2 hover:bg-chart-2/90 text-background"
            }`}
          >
            <Leaf className="w-3.5 h-3.5" />
            {tended ? "Update log" : "Log practice"}
          </button>
        </div>
      )}

      {/* ── Tend panel ── */}
      {isTending && (
        <div className="border-t border-chart-2/20 bg-chart-2/[0.03] px-4 pb-5 pt-4 space-y-4">

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Leaf className="w-4 h-4 text-chart-2" />
              Log practice
            </h4>
            <button
              onClick={onCancelTend}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors p-1 -mr-1"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Date picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            <label className="text-xs text-muted-foreground whitespace-nowrap">Logging for</label>
            <input
              type="date"
              min={thirtyDaysAgoStr()}
              max={todayStr()}
              value={tendState?.date ?? todayStr()}
              onChange={(e) => onTendStateChange({ ...tendState!, date: e.target.value })}
              className="bg-background/40 border border-border/40 rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-chart-2/40 transition-colors"
            />
            {tendState?.date && tendState.date !== todayStr() && (
              <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5">
                past date
              </span>
            )}
          </div>

          {/* Effort */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">How did this practice feel?</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => onTendStateChange({ ...tendState!, effort: tendState!.effort === n ? 0 : n })}
                  className={`w-9 h-9 rounded-full border text-sm font-medium transition-all ${
                    (tendState?.effort ?? 0) >= n
                      ? "bg-chart-2/20 border-chart-2/50 text-chart-2"
                      : "border-border/40 text-muted-foreground/40 hover:border-chart-2/30 hover:text-muted-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
              {(tendState?.effort ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground/60 italic">
                  {EFFORT_LABELS[tendState?.effort ?? 0]}
                </span>
              )}
            </div>
          </div>

          {/* What did you practice */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              What did you practice? <span className="text-muted-foreground/40">(optional)</span>
            </label>
            <input
              type="text"
              value={tendState?.practiceNote ?? ""}
              onChange={(e) => onTendStateChange({ ...tendState!, practiceNote: e.target.value })}
              placeholder="e.g. Morning walk, journaling, breathwork…"
              className="w-full bg-background/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-chart-2/40 transition-colors"
            />
          </div>

          {/* Observation */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Observation <span className="text-muted-foreground/40">(optional)</span>
            </label>
            <input
              type="text"
              value={tendState?.note ?? ""}
              onChange={(e) => onTendStateChange({ ...tendState!, note: e.target.value })}
              placeholder="How did it feel, what did you notice…"
              className="w-full bg-background/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-chart-2/40 transition-colors"
            />
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="480"
              value={tendState?.durationMinutes ?? ""}
              onChange={(e) => onTendStateChange({ ...tendState!, durationMinutes: e.target.value })}
              placeholder="Duration"
              className="w-28 bg-background/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-chart-2/40 transition-colors"
            />
            <span className="text-xs text-muted-foreground/50">minutes (optional)</span>
          </div>

          {/* Save log */}
          <button
            onClick={onConfirmTend}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-chart-2 hover:bg-chart-2/90 text-background py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save log
          </button>

          <button
            onClick={onCancelTend}
            className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors pt-1"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
