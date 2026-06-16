import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetBodyWeatherToday,
} from "@workspace/api-client-react";
import {
  Loader2, PenLine, Check, Sparkles,
  ChevronDown, ChevronUp, Timer, Sprout, Eye,
} from "lucide-react";
import { Link } from "wouter";
import { useTester } from "@/contexts/tester-context";
import { useToast } from "@/hooks/use-toast";
import {
  DOMAIN_COLORS, todayStr,
  ELEMENT_ICONS, ELEMENT_BADGE_CLS, ELEMENT_DOT_CLS, ELEMENT_COLOR_CLS,
  ELEMENT_LABELS, resolveElement,
  type ElementKey,
} from "@/lib/elements";

// ── Auspice now ───────────────────────────────────────────────────────────────

interface AuspiceNow {
  momentLabel: string;
  quality: string;
  element: { element: ElementKey; source: string; moonSign: string; voidOfCourse: boolean };
  planetaryHour: { ruler: string; hourNumber: number; isDayHour: boolean; prompt: string; supports: string[] };
  voidOfCourse: boolean;
  moonPhase: string;
  moonSign: string;
  sunSign: string;
  retrogrades: string[];
  invitation: string;
}

const ELEMENT_META: Record<
  ElementKey,
  { label: string; icon: React.ElementType; glyph: string; color: string; bg: string; border: string; pulse: string; line: string; dot: string; badge: string }
> = {
  fire: {
    label: ELEMENT_LABELS.fire, icon: ELEMENT_ICONS.fire, glyph: "△",
    color: ELEMENT_COLOR_CLS.fire, bg: "bg-orange-500/8", border: "border-orange-500/20",
    pulse: "bg-orange-400/40", line: "Vital force is high. Move, create, initiate.",
    dot: ELEMENT_DOT_CLS.fire, badge: ELEMENT_BADGE_CLS.fire,
  },
  earth: {
    label: ELEMENT_LABELS.earth, icon: ELEMENT_ICONS.earth, glyph: "▽",
    color: ELEMENT_COLOR_CLS.earth, bg: "bg-emerald-500/8", border: "border-emerald-500/20",
    pulse: "bg-emerald-400/40", line: "Ground and tend. Steady rhythm serves you now.",
    dot: ELEMENT_DOT_CLS.earth, badge: ELEMENT_BADGE_CLS.earth,
  },
  air: {
    label: ELEMENT_LABELS.air, icon: ELEMENT_ICONS.air, glyph: "△",
    color: ELEMENT_COLOR_CLS.air, bg: "bg-sky-500/8", border: "border-sky-500/20",
    pulse: "bg-sky-400/40", line: "Mental clarity peaks. Connect, write, exchange.",
    dot: ELEMENT_DOT_CLS.air, badge: ELEMENT_BADGE_CLS.air,
  },
  water: {
    label: ELEMENT_LABELS.water, icon: ELEMENT_ICONS.water, glyph: "▽",
    color: ELEMENT_COLOR_CLS.water, bg: "bg-blue-500/8", border: "border-blue-500/20",
    pulse: "bg-blue-400/40", line: "Rest and receive. The inner tides ask for stillness.",
    dot: ELEMENT_DOT_CLS.water, badge: ELEMENT_BADGE_CLS.water,
  },
  spirit: {
    label: ELEMENT_LABELS.spirit, icon: ELEMENT_ICONS.spirit, glyph: "✦",
    color: ELEMENT_COLOR_CLS.spirit, bg: "bg-violet-500/8", border: "border-violet-500/20",
    pulse: "bg-violet-400/40", line: "The subtle field is awake. Listen, ritual, presence.",
    dot: ELEMENT_DOT_CLS.spirit, badge: ELEMENT_BADGE_CLS.spirit,
  },
};

function formatDayHeader(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TimingMatch = "resonant" | "supported" | "neutral" | "soften" | "protect";

interface CultivationRow {
  id: number;
  title: string;
  domain: string;
  element: string | null;
  elements: string[] | null;
  targetPractice: string | null;
  minimumViable: string | null;
  frequency: string;
  status: string;
  todayCheckIn: { completed: boolean; effortLevel: number | null; durationMinutes: number | null } | null;
  // timing match fields from /api/auspice/practices
  match?: TimingMatch;
  recommendation?: string;
  score?: number;
}

interface AuspicePracticesResponse {
  asOf: string;
  timing: {
    element: ElementKey;
    voidOfCourse: boolean;
    moonPhase: string;
    phase: string;
    planetaryHourRuler: string;
    retrogrades: string[];
  };
  practices: CultivationRow[];
}

interface TendPanel {
  id: number;
  duration: string;
  note: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { profile } = useTester();
  const testerId = profile?.testerId ?? null;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const headers = useCallback(
    (extra: Record<string, string> = {}) => ({
      "x-tester-id": testerId || "",
      "Content-Type": "application/json",
      ...extra,
    }),
    [testerId],
  );

  const { data: bodyWeather } = useGetBodyWeatherToday();

  const { data: auspice } = useQuery<AuspiceNow>({
    queryKey: ["auspice-now"],
    queryFn: () => fetch("/api/auspice/now").then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const [tendPanel, setTendPanel] = useState<TendPanel | null>(null);
  const [successIds, setSuccessIds] = useState<Set<number>>(new Set());

  // Replaces the plain /api/cultivations fetch — returns server-sorted practices
  // with timing match scores, check-in state, and per-practice recommendations.
  const qKey = ["auspice-practices", testerId];

  const { data: practicesData, isLoading: cultsLoading } = useQuery<AuspicePracticesResponse>({
    queryKey: qKey,
    queryFn: async () => {
      const res = await fetch("/api/auspice/practices", { headers: headers() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!testerId,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const cultivations = practicesData?.practices ?? [];

  const checkInMutation = useMutation({
    mutationFn: async ({
      id, note, durationMinutes,
    }: { id: number; note: string; durationMinutes: number | null }) => {
      const res = await fetch(`/api/cultivations/${id}/check-ins`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          completed: true,
          note: note.trim() || undefined,
          durationMinutes,
          date: todayStr(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: qKey });
      setSuccessIds((prev) => new Set([...prev, vars.id]));
      setTimeout(
        () => setSuccessIds((prev) => { const n = new Set(prev); n.delete(vars.id); return n; }),
        3500,
      );
      setTendPanel(null);
    },
    onError: () => toast({ title: "Could not save — try again", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/cultivations/${id}/check-ins`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ completed: false, date: todayStr() }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });

  // Server returns practices pre-sorted by timing match; we only move tended ones to bottom
  const emphasisEl: ElementKey = (practicesData?.timing.element ?? auspice?.element?.element ?? "water") as ElementKey;
  const active = [...cultivations].sort((a, b) => {
    const aTended = a.todayCheckIn?.completed ? 1 : 0;
    const bTended = b.todayCheckIn?.completed ? 1 : 0;
    return aTended - bTended;
  });

  const tendedCount = active.filter((c) => c.todayCheckIn?.completed).length;

  const elMeta = ELEMENT_META[emphasisEl];
  const ElIcon = elMeta.icon;

  const daemonLine = bodyWeather?.bodyWeatherSummary
    ? bodyWeather.bodyWeatherSummary.split(".")[0]?.trim()
    : null;

  // Planetary hour prompt from Auspice, else fall back to nothing
  const timingLine = auspice?.planetaryHour?.prompt ?? null;

  return (
    <div className="max-w-xl mx-auto px-6 py-10 space-y-8 pb-20">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-serif text-2xl text-foreground tracking-wide">
          What needs tending today?
        </h1>
        <p className="text-sm text-muted-foreground">{formatDayHeader()}</p>
      </div>

      {/* Element / timing card */}
      {auspice && (
        <div className={`rounded-2xl border px-5 py-4 space-y-3 ${elMeta.bg} ${elMeta.border}`}>
          {/* Element row */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className={`w-10 h-10 rounded-full ${elMeta.pulse} animate-pulse flex items-center justify-center`}>
                <ElIcon className={`w-5 h-5 ${elMeta.color}`} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-widest ${elMeta.color}`}>
                  {auspice.voidOfCourse ? "void of course" : `${elMeta.label} field`}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  Moon in {auspice.moonSign}
                </span>
                {auspice.retrogrades.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/40">
                    ℞ {auspice.retrogrades.join(", ")}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground/80">{auspice.invitation}</p>
            </div>
          </div>

          {/* Planetary hour prompt */}
          <div className="border-t border-border/10 pt-2.5 flex items-start gap-2">
            <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest flex-shrink-0 mt-0.5">
              {auspice.planetaryHour.ruler} hour
            </span>
            <p className="text-xs text-muted-foreground/60 italic leading-relaxed">
              {auspice.planetaryHour.prompt}
            </p>
          </div>
        </div>
      )}

      {/* Active practices */}
      {cultsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
        </div>
      ) : active.length === 0 ? (
        <div className="rounded-xl border border-border/20 bg-card/20 px-5 py-8 text-center space-y-2">
          <Sprout className="w-6 h-6 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground/60">No active cultivations yet.</p>
          <Link href="/cultivator">
            <span className="text-xs text-primary/70 hover:text-primary transition-colors cursor-pointer">
              Plant your first practice →
            </span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sprout className="w-3.5 h-3.5 text-chart-2/70" />
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Practices</h2>
            </div>
            <span className="text-xs text-muted-foreground/50">
              {tendedCount}/{active.length} tended
            </span>
          </div>

          {/* Progress */}
          <div className="h-1 bg-border/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-chart-2/50 rounded-full transition-all duration-700"
              style={{ width: `${active.length > 0 ? (tendedCount / active.length) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-2">
            {active.map((c) => {
              const tended = c.todayCheckIn?.completed ?? false;
              const isSuccess = successIds.has(c.id);
              const isPanelOpen = tendPanel?.id === c.id;
              const elKey = resolveElement(c);
              const elStyle = ELEMENT_META[elKey];
              const ElC = elStyle.icon;
              const match = c.match ?? "neutral";
              const isResonant = !tended && (match === "resonant" || match === "supported");
              const isSoften  = !tended && (match === "soften"   || match === "protect");
              const domainCls = DOMAIN_COLORS[c.domain] ?? "bg-muted/30 text-muted-foreground border-border/30";

              return (
                <div
                  key={c.id}
                  className={`rounded-xl border transition-all ${
                    tended
                      ? "border-chart-2/30 bg-chart-2/5"
                      : isResonant
                      ? `${elMeta.bg} ${elMeta.border}`
                      : isSoften
                      ? "border-border/20 bg-card/20 opacity-75"
                      : "border-border/30 bg-card/30"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Status dot / check */}
                    {tended ? (
                      <button
                        onClick={() => removeMutation.mutate(c.id)}
                        className="w-5 h-5 rounded-full bg-chart-2 flex items-center justify-center flex-shrink-0 hover:opacity-70 transition-opacity"
                        title="Undo"
                      >
                        <Check className="w-3 h-3 text-background" />
                      </button>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-border/50 flex-shrink-0" />
                    )}

                    <ElC className={`w-3.5 h-3.5 flex-shrink-0 ${elStyle.color}`} />

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${tended ? "text-foreground/60 line-through decoration-muted-foreground/30" : "text-foreground/90"}`}>
                        {c.title}
                      </p>
                      {isSuccess && (
                        <p className="text-xs text-chart-2/70 italic">logged.</p>
                      )}
                      {!tended && !isSuccess && c.recommendation && (match === "soften" || match === "protect") && (
                        <p className="text-[10px] text-muted-foreground/50 italic leading-snug mt-0.5 truncate">
                          {c.recommendation}
                        </p>
                      )}
                    </div>

                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${domainCls}`}>
                      {c.domain.replace(/-/g, " ")}
                    </span>

                    {!tended && (
                      <button
                        onClick={() => setTendPanel(isPanelOpen ? null : { id: c.id, duration: "", note: "" })}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-chart-2 border border-border/40 hover:border-chart-2/40 px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                      >
                        Tend
                        {isPanelOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Quick-tend panel */}
                  {isPanelOpen && (
                    <div className="border-t border-border/20 px-4 py-3 space-y-3">
                      {c.targetPractice && (
                        <p className="text-xs text-muted-foreground/50 italic">{c.targetPractice}</p>
                      )}
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-28">
                          <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                            <Timer className="w-3 h-3" /> Min
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="480"
                            value={tendPanel?.duration ?? ""}
                            onChange={(e) =>
                              setTendPanel((p) => p ? { ...p, duration: e.target.value } : null)
                            }
                            placeholder="—"
                            className="w-full bg-background/50 border border-border/40 rounded-lg px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-chart-2/50 transition-colors"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground mb-1 block">Note (optional)</label>
                          <input
                            type="text"
                            value={tendPanel?.note ?? ""}
                            onChange={(e) =>
                              setTendPanel((p) => p ? { ...p, note: e.target.value } : null)
                            }
                            placeholder="Quick reflection…"
                            className="w-full bg-background/50 border border-border/40 rounded-lg px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-chart-2/50 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            tendPanel && checkInMutation.mutate({
                              id: tendPanel.id,
                              note: tendPanel.note,
                              durationMinutes: tendPanel.duration ? (parseInt(tendPanel.duration, 10) || null) : null,
                            })
                          }
                          disabled={checkInMutation.isPending}
                          className="flex items-center gap-1.5 text-xs font-medium bg-chart-2/15 hover:bg-chart-2/25 text-chart-2 border border-chart-2/30 hover:border-chart-2/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {checkInMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Mark tended
                        </button>
                        <button
                          onClick={() => setTendPanel(null)}
                          className="text-xs text-muted-foreground hover:text-foreground border border-border/30 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Log CTA */}
          <Link href="/log">
            <button className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border/30 hover:border-primary/30 bg-card/20 hover:bg-card/50 rounded-xl py-3 transition-all">
              <PenLine className="w-3.5 h-3.5" />
              Full log — add duration, reflections, symptoms…
            </button>
          </Link>
        </div>
      )}

      {/* Daemon glimpse */}
      {daemonLine && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 px-5 py-4 flex items-start gap-3">
          <Eye className="w-4 h-4 text-primary/40 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary/40 mb-1">Daemon</p>
            <p className="text-sm text-foreground/70 italic leading-relaxed">{daemonLine}.</p>
          </div>
        </div>
      )}

      {/* Supports list from planetary hour */}
      {timingLine && (
        <div className="flex items-start gap-2 px-1">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground/50 italic leading-relaxed">
            {timingLine}
          </p>
        </div>
      )}
    </div>
  );
}
