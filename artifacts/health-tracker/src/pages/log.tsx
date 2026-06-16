import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PenLine, Check, ChevronDown, ChevronUp, Plus, X, Loader2,
  ArrowLeft, RotateCcw, Timer, Sprout,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTester } from "@/contexts/tester-context";
import { useToast } from "@/hooks/use-toast";
import { getListLogsQueryKey } from "@workspace/api-client-react";
import {
  todayStr, yesterdayStr,
  ELEMENT_ICONS, ELEMENT_DOT_CLS, ELEMENT_RING_CLS, DOMAIN_COLORS,
  type ElementKey,
} from "@/lib/elements";

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function loggedAtTimestamp(dateStr: string): string {
  const now = new Date();
  const [h, m, s] = [now.getHours(), now.getMinutes(), now.getSeconds()];
  return `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Element helpers ───────────────────────────────────────────────────────────

const ELEMENT_STYLE: Record<string, { icon: React.ElementType; dot: string; ring: string }> = {
  fire:   { icon: ELEMENT_ICONS.fire,   dot: ELEMENT_DOT_CLS.fire,   ring: ELEMENT_RING_CLS.fire },
  earth:  { icon: ELEMENT_ICONS.earth,  dot: ELEMENT_DOT_CLS.earth,  ring: ELEMENT_RING_CLS.earth },
  air:    { icon: ELEMENT_ICONS.air,    dot: ELEMENT_DOT_CLS.air,    ring: ELEMENT_RING_CLS.air },
  water:  { icon: ELEMENT_ICONS.water,  dot: ELEMENT_DOT_CLS.water,  ring: ELEMENT_RING_CLS.water },
  spirit: { icon: ELEMENT_ICONS.spirit, dot: ELEMENT_DOT_CLS.spirit, ring: ELEMENT_RING_CLS.spirit },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface CultivationRow {
  id: number;
  title: string;
  domain: string;
  element: string | null;
  elements: string[] | null;
  targetPractice: string | null;
  frequency: string;
  status: string;
}

interface PracticeEntry {
  cultivationId: number;
  title: string;
  domain: string;
  element: string | null;
  elements: string[] | null;
  targetPractice: string | null;
  checked: boolean;
  expanded: boolean;
  duration: string;
  note: string;
}

const FREE_TYPES = ["symptom", "note", "mood", "supplement", "activity"] as const;
type FreeType = typeof FREE_TYPES[number];

interface FreeEntry {
  key: string;
  type: FreeType;
  name: string;
  content: string;
  duration: string;
}

type Phase = "composing" | "saving" | "success";
type DateMode = "today" | "yesterday" | "custom";

// ── Component ─────────────────────────────────────────────────────────────────

export default function LogPage() {
  const { profile } = useTester();
  const testerId = profile?.testerId ?? null;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const headers = useCallback(
    (extra: Record<string, string> = {}) => ({
      "x-tester-id": testerId || "",
      "Content-Type": "application/json",
      ...extra,
    }),
    [testerId],
  );

  // Read ?date=YYYY-MM-DD from URL (e.g. from Calendar "Log for this day" link)
  const initialDate = (() => {
    const d = new URLSearchParams(window.location.search).get("date");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  })();

  const [phase, setPhase] = useState<Phase>("composing");
  const [savedDate, setSavedDate] = useState<string>(initialDate ?? todayStr());
  const [savedCount, setSavedCount] = useState(0);

  const [dateMode, setDateMode] = useState<DateMode>(
    initialDate
      ? initialDate === todayStr()
        ? "today"
        : initialDate === yesterdayStr()
        ? "yesterday"
        : "custom"
      : "today",
  );
  const [customDate, setCustomDate] = useState<string>(initialDate ?? todayStr());
  const [practices, setPractices] = useState<PracticeEntry[]>([]);
  const [freeEntries, setFreeEntries] = useState<FreeEntry[]>([]);

  const computedDate =
    dateMode === "today" ? todayStr() :
    dateMode === "yesterday" ? yesterdayStr() :
    customDate || todayStr();

  const { data: cultivations, isLoading: cultsLoading } = useQuery<CultivationRow[]>({
    queryKey: ["cultivations-log", testerId],
    queryFn: async () => {
      const res = await fetch("/api/cultivations?status=active", { headers: headers() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!testerId,
  });

  useEffect(() => {
    if (!cultivations) return;
    setPractices(
      cultivations.map((c) => ({
        cultivationId: c.id,
        title: c.title,
        domain: c.domain,
        element: c.elements?.[0] ?? c.element ?? null,
        elements: c.elements ?? null,
        targetPractice: c.targetPractice,
        checked: false,
        expanded: false,
        duration: "",
        note: "",
      })),
    );
  }, [cultivations]);

  const togglePractice = (idx: number) => {
    setPractices((prev) =>
      prev.map((p, i) =>
        i === idx
          ? { ...p, checked: !p.checked, expanded: !p.checked ? true : p.expanded }
          : p,
      ),
    );
  };

  const toggleExpand = (idx: number) => {
    setPractices((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, expanded: !p.expanded } : p)),
    );
  };

  const updatePractice = (idx: number, field: "duration" | "note", value: string) => {
    setPractices((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    );
  };

  const addFreeEntry = () => {
    setFreeEntries((prev) => [
      ...prev,
      { key: `${Date.now()}`, type: "note", name: "", content: "", duration: "" },
    ]);
  };

  const updateFreeEntry = (key: string, field: keyof FreeEntry, value: string) => {
    setFreeEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)),
    );
  };

  const removeFreeEntry = (key: string) => {
    setFreeEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const checkedPractices = practices.filter((p) => p.checked);
  const hasAnything = checkedPractices.length > 0 || freeEntries.some((e) => e.content.trim() || e.name.trim());

  const handleSubmit = async () => {
    if (!hasAnything) return;
    setPhase("saving");

    try {
      const date = computedDate;
      const logAt = loggedAtTimestamp(date);
      let count = 0;
      const all: Promise<Response>[] = [];

      for (const p of checkedPractices) {
        all.push(
          fetch(`/api/cultivations/${p.cultivationId}/check-ins`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
              completed: true,
              note: p.note.trim() || undefined,
              durationMinutes: p.duration ? (parseInt(p.duration, 10) || null) : null,
              date,
            }),
          }),
        );
        count++;
      }

      for (const entry of freeEntries) {
        const body: Record<string, unknown> = { loggedAt: logAt, logDate: date };
        if (entry.type === "note") {
          if (!entry.content.trim()) continue;
          body.type = "note";
          body.notes = entry.content.trim();
        } else if (entry.type === "symptom") {
          if (!entry.content.trim()) continue;
          body.type = "symptom";
          body.symptoms = entry.content.trim();
          body.notes = entry.content.trim();
        } else if (entry.type === "mood") {
          const v = parseInt(entry.content, 10);
          if (!v) continue;
          body.type = "mood";
          body.mood = Math.min(10, Math.max(1, v));
        } else if (entry.type === "supplement") {
          if (!entry.name.trim()) continue;
          body.type = "supplement";
          body.supplementName = entry.name.trim();
          body.dosageTaken = entry.content.trim() || null;
        } else if (entry.type === "activity") {
          if (!entry.name.trim()) continue;
          body.type = "activity";
          body.activityName = entry.name.trim();
          body.durationMinutes = entry.duration ? (parseInt(entry.duration, 10) || null) : null;
          body.notes = entry.content.trim() || null;
        }
        all.push(
          fetch("/api/logs", {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(body),
          }),
        );
        count++;
      }

      await Promise.all(all);

      queryClient.invalidateQueries({ queryKey: ["cultivations", testerId] });
      queryClient.invalidateQueries({ queryKey: ["cultivations-log", testerId] });
      queryClient.invalidateQueries({ queryKey: ["cultivations-widget", testerId] });
      queryClient.invalidateQueries({ queryKey: getListLogsQueryKey() });

      setSavedDate(date);
      setSavedCount(count);
      setPhase("success");
    } catch {
      setPhase("composing");
      toast({ title: "Save failed — please try again", variant: "destructive" });
    }
  };

  const handleLogAnother = () => {
    setPractices((prev) => prev.map((p) => ({ ...p, checked: false, expanded: false, duration: "", note: "" })));
    setFreeEntries([]);
    setPhase("composing");
  };

  // ── Success state ────────────────────────────────────────────────────────────

  if (phase === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-full bg-chart-2/10 border border-chart-2/20 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-chart-2" />
            </div>
            <div className="space-y-1">
              <p className="font-serif text-2xl text-foreground tracking-wide">
                Logged. The field remembers.
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDisplayDate(savedDate)} · {savedCount} {savedCount === 1 ? "entry" : "entries"}
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <Link href="/">
              <button className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl border border-border/50 bg-card/40 text-muted-foreground hover:text-foreground hover:border-border transition-all">
                <ArrowLeft className="w-3.5 h-3.5" />
                Today
              </button>
            </Link>
            <button
              onClick={handleLogAnother}
              className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl bg-chart-2/15 border border-chart-2/30 text-chart-2 hover:bg-chart-2/25 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Log another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Composing state ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8 pb-24">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <PenLine className="w-4 h-4 text-primary" />
          </div>
          <h1 className="font-serif text-2xl text-foreground tracking-wide">Log</h1>
        </div>

        {/* Date selector */}
        <div className="flex items-center gap-2 pl-11 flex-wrap">
          {(["today", "yesterday", "custom"] as DateMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setDateMode(mode)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all capitalize ${
                dateMode === mode
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
          {dateMode === "custom" && (
            <input
              type="date"
              value={customDate}
              max={todayStr()}
              onChange={(e) => setCustomDate(e.target.value)}
              className="text-xs bg-background/50 border border-border/50 rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          )}
          {dateMode !== "custom" && (
            <span className="text-xs text-muted-foreground/50">
              {formatDisplayDate(computedDate)}
            </span>
          )}
        </div>
      </div>

      {/* Practices */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sprout className="w-3.5 h-3.5 text-chart-2/70" />
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Practices</h2>
        </div>

        {cultsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : practices.length === 0 ? (
          <div className="rounded-xl border border-border/20 bg-card/20 px-5 py-6 text-center">
            <p className="text-sm text-muted-foreground/60">No active cultivations.</p>
            <Link href="/cultivator">
              <span className="text-xs text-primary/70 hover:text-primary transition-colors">Plant one in Cultivator →</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {practices.map((p, idx) => {
              const elKey = p.element ?? "earth";
              const elStyle = ELEMENT_STYLE[elKey] ?? ELEMENT_STYLE.earth;
              const domainCls = DOMAIN_COLORS[p.domain] ?? "bg-muted/30 text-muted-foreground border-border/30";

              return (
                <div
                  key={p.cultivationId}
                  className={`rounded-xl border transition-all ${
                    p.checked
                      ? "border-chart-2/40 bg-chart-2/5"
                      : "border-border/30 bg-card/30"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => togglePractice(idx)}
                      className={`w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                        p.checked
                          ? "bg-chart-2 border-chart-2"
                          : "border-border/50 hover:border-chart-2/50"
                      }`}
                    >
                      {p.checked && <Check className="w-3 h-3 text-background" />}
                    </button>

                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-background ${elStyle.dot} ${elStyle.ring}`}
                    />

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${p.checked ? "text-foreground" : "text-foreground/70"}`}>
                        {p.title}
                      </p>
                      {p.targetPractice && !p.expanded && (
                        <p className="text-xs text-muted-foreground/50 truncate">{p.targetPractice}</p>
                      )}
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${domainCls}`}>
                      {p.domain.replace(/-/g, " ")}
                    </span>

                    {p.checked && (
                      <button
                        onClick={() => toggleExpand(idx)}
                        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0"
                      >
                        {p.expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {p.checked && p.expanded && (
                    <div className="border-t border-border/20 px-4 py-3 space-y-3">
                      {p.targetPractice && (
                        <p className="text-xs text-muted-foreground/60 italic">{p.targetPractice}</p>
                      )}
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-32">
                          <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                            <Timer className="w-3 h-3" /> Duration (min)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="480"
                            value={p.duration}
                            onChange={(e) => updatePractice(idx, "duration", e.target.value)}
                            placeholder="—"
                            className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-chart-2/50 transition-colors"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground mb-1 block">Reflection</label>
                          <textarea
                            value={p.note}
                            onChange={(e) => updatePractice(idx, "note", e.target.value)}
                            placeholder="How did it go…"
                            rows={2}
                            className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-chart-2/50 transition-colors resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Other observations */}
      {freeEntries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Other observations
          </h2>
          <div className="space-y-2">
            {freeEntries.map((entry) => (
              <div
                key={entry.key}
                className="rounded-xl border border-border/30 bg-card/30 px-4 py-3 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <select
                    value={entry.type}
                    onChange={(e) => updateFreeEntry(entry.key, "type", e.target.value)}
                    className="text-xs bg-background/50 border border-border/40 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  >
                    {FREE_TYPES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                  <div className="flex-1" />
                  <button
                    onClick={() => removeFreeEntry(entry.key)}
                    className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {(entry.type === "supplement" || entry.type === "activity") && (
                  <input
                    type="text"
                    value={entry.name}
                    onChange={(e) => updateFreeEntry(entry.key, "name", e.target.value)}
                    placeholder={entry.type === "supplement" ? "Supplement name" : "Activity name"}
                    className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                )}

                {entry.type === "activity" && (
                  <input
                    type="number"
                    value={entry.duration}
                    onChange={(e) => updateFreeEntry(entry.key, "duration", e.target.value)}
                    placeholder="Duration (minutes)"
                    className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                )}

                {entry.type === "mood" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Mood (1–10)</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => updateFreeEntry(entry.key, "content", String(n))}
                          className={`w-8 h-8 text-xs rounded-lg border transition-all ${
                            entry.content === String(n)
                              ? "bg-chart-4/20 border-chart-4/50 text-chart-4"
                              : "border-border/30 text-muted-foreground/60 hover:border-chart-4/30"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={entry.content}
                    onChange={(e) => updateFreeEntry(entry.key, "content", e.target.value)}
                    placeholder={
                      entry.type === "symptom" ? "Describe the symptom…" :
                      entry.type === "supplement" ? "Dosage taken (optional)…" :
                      entry.type === "activity" ? "Notes (optional)…" :
                      "Write a note…"
                    }
                    rows={2}
                    className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors resize-none"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add observation button */}
      <button
        onClick={addFreeEntry}
        className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground/60 hover:text-muted-foreground border border-dashed border-border/30 hover:border-border/60 rounded-xl py-3 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        Add symptom, note, mood, or supplement
      </button>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-background/80 backdrop-blur-md border-t border-border/30 flex gap-3 justify-end max-w-2xl mx-auto">
        <Link href="/">
          <button className="text-sm px-4 py-2.5 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-all">
            Cancel
          </button>
        </Link>
        <button
          onClick={handleSubmit}
          disabled={!hasAnything || phase === "saving"}
          className="flex items-center gap-2 text-sm font-medium px-6 py-2.5 rounded-xl bg-chart-2/15 border border-chart-2/30 text-chart-2 hover:bg-chart-2/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {phase === "saving" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Recording…
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Record this
            </>
          )}
        </button>
      </div>
    </div>
  );
}
