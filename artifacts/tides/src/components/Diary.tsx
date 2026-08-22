/**
 * THE DIARY — workings (owner 2026-08-21: "a sort of magical diary… to file
 * in moments where I'm really trying to be intentional with my aims, and how
 * it goes. that may or may not need to be connected to habits/tasks").
 *
 * An entry is an intention set on purpose, stamped with the sky as it stood,
 * and closed later with how it went. The tie to a star, task or habit is
 * optional. The stamp is facts only — signs, phase, the hour's ruler, the
 * moment's qualifiers — so the reading of the conditions stays the person's.
 */
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jsonArray } from "@/lib/jsonArray";
import { localToday } from "@/lib/dates";
import { useAstroDetail } from "@/contexts/preferences-context";

interface Working {
  id: number; date: string; intention: string; goalId: number | null; taskId: number | null; habitId: number | null;
  skyStamp: { at: string; sun: string; moon: string; phase: string; voc: boolean; hour: string | null; retrograde: string[]; qualifiers: { key: string; literal: string; plain: string }[] } | null;
  outcome: string | null; felt: string | null; outcomeAt: string | null; createdAt: string;
}
interface Star { id: number; title: string; status?: string }
interface Task { id: number; title: string; done: string | null }
interface Habit { id: number; name: string; emoji?: string | null }

const FELT: { key: string; label: string; icon: string; color: string }[] = [
  { key: "aligned", label: "Aligned", icon: "●", color: "#4a8060" },
  { key: "mixed", label: "Mixed", icon: "◐", color: "#a08040" },
  { key: "off", label: "Off", icon: "○", color: "#9a6060" },
];
const BOX: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8,
  border: "1px solid var(--color-border)", background: "var(--color-card-2)",
  fontSize: 13, lineHeight: 1.55, color: "var(--color-foreground)", resize: "vertical", fontFamily: "inherit",
};
const CHIP = (on: boolean): React.CSSProperties => ({
  fontSize: 10.5, padding: "3px 9px", borderRadius: 11, cursor: "pointer",
  border: `1px solid ${on ? "var(--color-primary)" : "var(--color-border)"}`,
  background: on ? "var(--color-primary)" : "var(--color-card-2)", color: on ? "#fff" : "var(--color-muted)",
});

export default function Diary({ testerId, lat, lon }: { testerId: string | null; lat: number; lon: number }) {
  const qc = useQueryClient();
  const { level } = useAstroDetail();
  const today = localToday();
  const H = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };

  const { data, isError } = useQuery<{ workings: Working[] }>({
    queryKey: ["diary", testerId],
    queryFn: async () => (await fetch("/api/diary", { headers: H })).json(),
    enabled: !!testerId,
  });
  const { data: stars } = useQuery<Star[]>({ queryKey: ["north-stars", testerId], queryFn: async () => jsonArray<Star>(await fetch("/api/planning/north-stars", { headers: H })), enabled: !!testerId });
  const { data: tasks } = useQuery<Task[]>({ queryKey: ["tasks", "all"], queryFn: async () => jsonArray<Task>(await fetch("/api/tasks", { headers: H })), enabled: !!testerId });
  const { data: habits } = useQuery<Habit[]>({ queryKey: ["habits", testerId, today, lat, lon], queryFn: async () => jsonArray<Habit>(await fetch(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`, { headers: H })), enabled: !!testerId });

  const [intention, setIntention] = useState("");
  const [tie, setTie] = useState<{ kind: "goal" | "task" | "habit"; id: number } | null>(null);
  const [tieOpen, setTieOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/diary", { method: "POST", headers: H, body: JSON.stringify({
        intention: intention.trim(), date: today, lat, lon,
        goalId: tie?.kind === "goal" ? tie.id : undefined, taskId: tie?.kind === "task" ? tie.id : undefined, habitId: tie?.kind === "habit" ? tie.id : undefined,
      }) });
      if (!r.ok) throw new Error(String(r.status));
    },
    onSuccess: () => { setIntention(""); setTie(null); setTieOpen(false); setErr(null); qc.invalidateQueries({ queryKey: ["diary"] }); },
    onError: () => setErr("Didn't save. It's still in the box."),
  });
  const close = useMutation({
    mutationFn: async ({ id, outcome, felt }: { id: number; outcome?: string; felt?: string | null }) => {
      const r = await fetch(`/api/diary/${id}`, { method: "PATCH", headers: H, body: JSON.stringify({ outcome, felt }) });
      if (!r.ok) throw new Error(String(r.status));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diary"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/diary/${id}`, { method: "DELETE", headers: H }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diary"] }),
  });

  const liveStars = (stars ?? []).filter(s => s.status !== "done" && s.status !== "paused");
  const openTasks = (tasks ?? []).filter(t => t.done !== "true");
  const nameOf = (w: Working) =>
    w.goalId ? `★ ${liveStars.find(s => s.id === w.goalId)?.title ?? stars?.find(s => s.id === w.goalId)?.title ?? "a star"}`
    : w.taskId ? (tasks ?? []).find(t => t.id === w.taskId)?.title ?? "a task"
    : w.habitId ? (habits ?? []).find(h => h.id === w.habitId)?.name ?? "a habit"
    : null;
  const tieLabel = tie
    ? tie.kind === "goal" ? `★ ${liveStars.find(s => s.id === tie.id)?.title}` : tie.kind === "task" ? openTasks.find(t => t.id === tie.id)?.title : (habits ?? []).find(h => h.id === tie.id)?.name
    : null;

  const rows = data?.workings ?? [];
  const open = rows.filter(w => !w.outcomeAt);
  const closed = rows.filter(w => !!w.outcomeAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* SET AN INTENTION */}
      <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 4 }}>Set an intention</div>
        <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8, lineHeight: 1.5 }}>
          What you're setting out to do, and how you mean to go about it. The sky as it stands gets stamped on it; you come back later and say how it went.
        </div>
        <textarea value={intention} onChange={e => setIntention(e.target.value)} rows={3} style={BOX}
          placeholder="The thing, and the way you mean to do it." />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={() => setTieOpen(v => !v)} style={CHIP(!!tie)}>{tieLabel ? `for ${tieLabel}` : "Tie it to a star, task or habit"}</button>
          {tie && <button onClick={() => setTie(null)} aria-label="Untie" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>}
          <span style={{ flex: 1 }} />
          {err && <span style={{ fontSize: 10.5, color: "#a03030" }}>{err}</span>}
          <button onClick={() => add.mutate()} disabled={add.isPending || !intention.trim()} style={{
            padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500,
            cursor: intention.trim() ? "pointer" : "default",
            background: intention.trim() ? "#1a2a3a" : "var(--color-border)", color: intention.trim() ? "#fff" : "var(--text-3)",
          }}>{add.isPending ? "Saving…" : "Set it"}</button>
        </div>
        {tieOpen && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5, fontSize: 11 }}>
            {liveStars.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{liveStars.map(s => <button key={`g${s.id}`} onClick={() => { setTie({ kind: "goal", id: s.id }); setTieOpen(false); }} style={CHIP(tie?.kind === "goal" && tie.id === s.id)}>★ {s.title}</button>)}</div>}
            {openTasks.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{openTasks.slice(0, 12).map(t => <button key={`t${t.id}`} onClick={() => { setTie({ kind: "task", id: t.id }); setTieOpen(false); }} style={CHIP(tie?.kind === "task" && tie.id === t.id)}>{t.title}</button>)}</div>}
            {(habits ?? []).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{(habits ?? []).map(h => <button key={`h${h.id}`} onClick={() => { setTie({ kind: "habit", id: h.id }); setTieOpen(false); }} style={CHIP(tie?.kind === "habit" && tie.id === h.id)}>{h.emoji ? `${h.emoji} ` : ""}{h.name}</button>)}</div>}
            {liveStars.length + openTasks.length + (habits ?? []).length === 0 && <div style={{ color: "var(--text-3)" }}>Nothing to tie it to yet; that's fine.</div>}
          </div>
        )}
      </div>

      {isError && <div style={{ fontSize: 11.5, color: "#a03030" }}>The diary didn't load. The entries are intact; it's the connection.</div>}

      {/* OPEN — waiting on how it went */}
      {open.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 8 }}>Open</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {open.map(w => <Entry key={w.id} w={w} tie={nameOf(w)} level={level} onClose={(outcome, felt) => close.mutate({ id: w.id, outcome, felt })} onRemove={() => remove.mutate(w.id)} />)}
          </div>
        </div>
      )}

      {/* CLOSED — the record */}
      {closed.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 8 }}>How it went</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {closed.map(w => <Entry key={w.id} w={w} tie={nameOf(w)} level={level} onClose={(outcome, felt) => close.mutate({ id: w.id, outcome, felt })} onRemove={() => remove.mutate(w.id)} />)}
          </div>
        </div>
      )}

      {rows.length === 0 && !isError && (
        <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>Nothing set yet; the first entry is whatever you're about to try on purpose.</div>
      )}
    </div>
  );
}

function Entry({ w, tie, level, onClose, onRemove }: {
  w: Working; tie: string | null; level: string;
  onClose: (outcome: string, felt: string | null) => void; onRemove: () => void;
}) {
  const [outcome, setOutcome] = useState(w.outcome ?? "");
  const [felt, setFelt] = useState<string | null>(w.felt);
  const [editing, setEditing] = useState(!w.outcomeAt);
  const [stampOpen, setStampOpen] = useState(false);
  const s = w.skyStamp;
  const when = new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const stampLine = s ? [
    `Sun ${s.sun.split(" ")[0]}`, `Moon ${s.moon.split(" ")[0]} · ${s.phase}`,
    s.hour ? `${s.hour} hour` : null, s.voc ? "void" : null,
    ...(s.qualifiers ?? []).slice(0, 2).map(q => level === "full" ? q.literal : q.plain),
  ].filter(Boolean).join(" · ") : null;
  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderLeft: `3px solid ${w.felt ? FELT.find(f => f.key === w.felt)?.color : "var(--color-border)"}`, borderRadius: 10, padding: "11px 14px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{when}</span>
        {tie && <span style={{ fontSize: 10.5, color: "var(--color-muted)" }}>{tie}</span>}
        <span style={{ flex: 1 }} />
        <button onClick={onRemove} aria-label="Remove this entry" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--color-foreground)", lineHeight: 1.55, margin: "4px 0 6px", whiteSpace: "pre-wrap" }}>{w.intention}</div>
      {stampLine && (
        <div style={{ fontSize: 10.5, color: "var(--text-3)", lineHeight: 1.5 }}>
          <button onClick={() => setStampOpen(v => !v)} aria-expanded={stampOpen} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-3)", font: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>the sky then</button>
          {stampOpen && <span> · {stampLine}{s?.retrograde?.length ? ` · ${s.retrograde.join(", ")} retrograde` : ""}</span>}
        </div>
      )}
      {editing ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {FELT.map(f => (
              <button key={f.key} onClick={() => setFelt(felt === f.key ? null : f.key)} style={{
                flex: 1, padding: "5px 6px", borderRadius: 8, cursor: "pointer", fontSize: 11,
                border: felt === f.key ? `1.5px solid ${f.color}` : "1px solid var(--color-border)",
                background: felt === f.key ? `${f.color}12` : "var(--color-card-2)", color: felt === f.key ? f.color : "var(--color-muted)",
              }}>{f.icon} {f.label}</button>
            ))}
          </div>
          <textarea value={outcome} onChange={e => setOutcome(e.target.value)} rows={2} style={{ ...BOX, fontSize: 12.5 }} placeholder="How it went, when you know." />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            {w.outcomeAt && <button onClick={() => setEditing(false)} style={{ fontSize: 11, background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }}>Cancel</button>}
            <button onClick={() => { onClose(outcome, felt); setEditing(false); }} disabled={!outcome.trim() && !felt} style={{
              padding: "5px 13px", borderRadius: 8, border: "none", fontSize: 11.5, fontWeight: 500, cursor: "pointer",
              background: (outcome.trim() || felt) ? "#1a2a3a" : "var(--color-border)", color: (outcome.trim() || felt) ? "#fff" : "var(--text-3)",
            }}>Close it</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 }}>
          {w.felt && <span style={{ color: FELT.find(f => f.key === w.felt)?.color, marginRight: 6 }}>{FELT.find(f => f.key === w.felt)?.icon} {FELT.find(f => f.key === w.felt)?.label}</span>}
          <span style={{ whiteSpace: "pre-wrap" }}>{w.outcome}</span>
          <button onClick={() => setEditing(true)} style={{ marginLeft: 8, fontSize: 10.5, background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}>edit</button>
        </div>
      )}
    </div>
  );
}
