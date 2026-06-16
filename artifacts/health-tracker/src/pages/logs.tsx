import React, { useState } from "react";
import {
  useListLogs,
  useCreateLog,
  useDeleteLog,
  getListLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Mic, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { todayStr } from "@/lib/elements";

const LOG_TYPES = ["supplement", "activity", "symptom", "mood", "note"] as const;

const TYPE_COLORS: Record<string, string> = {
  supplement: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  activity: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  symptom: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  mood: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  note: "bg-muted/50 text-muted-foreground border-border/20",
};

type LogType = typeof LOG_TYPES[number] | "all";

export default function Logs() {
  const [filter, setFilter] = useState<LogType>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    type: "note" as typeof LOG_TYPES[number],
    notes: "",
    symptoms: "",
    mood: "",
    energyLevel: "",
    supplementName: "",
    activityName: "",
    dosageTaken: "",
    durationMinutes: "",
  });

  const { data: logs, isLoading } = useListLogs({ limit: 100 });
  const createLog = useCreateLog();
  const deleteLog = useDeleteLog();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = logs?.filter((l) => filter === "all" || l.type === filter) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLog.mutate(
      {
        data: {
          type: form.type,
          notes: form.notes || null,
          symptoms: form.symptoms || null,
          mood: form.mood ? parseInt(form.mood) : null,
          energyLevel: form.energyLevel ? parseInt(form.energyLevel) : null,
          supplementName: form.supplementName || null,
          activityName: form.activityName || null,
          dosageTaken: form.dosageTaken || null,
          durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : null,
          // @ts-expect-error logDate not in generated Zod type yet — required for calendar bucketing
          logDate: todayStr(),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLogsQueryKey() });
          setIsOpen(false);
          setForm({ type: "note", notes: "", symptoms: "", mood: "", energyLevel: "", supplementName: "", activityName: "", dosageTaken: "", durationMinutes: "" });
          toast({ title: "Entry logged" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this entry?")) return;
    deleteLog.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLogsQueryKey() });
        toast({ title: "Entry deleted" });
      },
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto pb-16 flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground tracking-tight">Log History</h1>
          <p className="text-muted-foreground mt-1">Your cosmic journal.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Entry</Button>
          </DialogTrigger>
          <DialogContent className="bg-card/95 backdrop-blur-xl border-border/50 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Log Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as any }))}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOG_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.type === "supplement" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Supplement name</Label>
                    <Input value={form.supplementName} onChange={(e) => setForm((p) => ({ ...p, supplementName: e.target.value }))} className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Dosage taken</Label>
                    <Input value={form.dosageTaken} onChange={(e) => setForm((p) => ({ ...p, dosageTaken: e.target.value }))} placeholder="e.g. 400mg" className="bg-background/50" />
                  </div>
                </div>
              )}

              {form.type === "activity" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Activity name</Label>
                    <Input value={form.activityName} onChange={(e) => setForm((p) => ({ ...p, activityName: e.target.value }))} className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input type="number" value={form.durationMinutes} onChange={(e) => setForm((p) => ({ ...p, durationMinutes: e.target.value }))} className="bg-background/50" />
                  </div>
                </div>
              )}

              {form.type === "symptom" && (
                <div className="space-y-2">
                  <Label>Symptoms</Label>
                  <Input value={form.symptoms} onChange={(e) => setForm((p) => ({ ...p, symptoms: e.target.value }))} placeholder="comma-separated" className="bg-background/50" />
                </div>
              )}

              {(form.type === "mood" || form.type === "symptom") && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Mood (1-10)</Label>
                    <Input type="number" min="1" max="10" value={form.mood} onChange={(e) => setForm((p) => ({ ...p, mood: e.target.value }))} className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Energy (1-10)</Label>
                    <Input type="number" min="1" max="10" value={form.energyLevel} onChange={(e) => setForm((p) => ({ ...p, energyLevel: e.target.value }))} className="bg-background/50" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full min-h-[80px] bg-background/50 border border-input rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <Button type="submit" className="w-full" disabled={createLog.isPending}>
                {createLog.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Entry"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {(["all", ...LOG_TYPES] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filter === t
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 text-muted-foreground border-border/40 hover:border-primary/30"
            }`}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card/30 p-12 text-center">
          <p className="text-muted-foreground">No {filter === "all" ? "" : filter} entries yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="group flex items-start gap-4 p-4 rounded-xl bg-card/40 border border-border/30 hover:border-border/60 transition-all backdrop-blur-sm"
            >
              <div className="flex-shrink-0 w-14 text-right pt-0.5">
                <p className="text-xs text-muted-foreground">{format(new Date(log.loggedAt), "MMM d")}</p>
                <p className="text-xs text-muted-foreground/50">{format(new Date(log.loggedAt), "h:mm a")}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[log.type] || TYPE_COLORS.note}`}>
                    {log.type}
                  </span>
                  {(log.supplementName || log.activityName) && (
                    <span className="text-sm font-medium text-foreground/90">{log.supplementName || log.activityName}</span>
                  )}
                  {log.dosageTaken && <span className="text-xs text-muted-foreground">{log.dosageTaken}</span>}
                  {log.durationMinutes && <span className="text-xs text-muted-foreground">{log.durationMinutes} min</span>}
                  {log.mood && <span className="text-xs text-muted-foreground">mood {log.mood}/10</span>}
                  {log.energyLevel && <span className="text-xs text-muted-foreground">energy {log.energyLevel}/10</span>}
                </div>
                {log.symptoms && <p className="text-sm text-chart-3/80 mb-0.5">{log.symptoms}</p>}
                {log.notes && <p className="text-sm text-muted-foreground/80 leading-relaxed">{log.notes}</p>}
                {log.transcribedFrom && (
                  <p className="text-xs text-muted-foreground/40 mt-1 flex items-center gap-1">
                    <Mic className="w-3 h-3" /> voice transcription
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(log.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all p-1 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
