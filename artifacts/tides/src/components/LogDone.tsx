/**
 * Log a finished stretch of work — the universal "I did a thing" door
 * (home-base build 2026-08-16; asks 2, 3 and 4 composed in one place).
 *
 * One writer, two records, chosen by the link:
 *   · star            → an ad-hoc session (planning_windows.adHoc) with a
 *                       retroactive time range — the record star progress
 *                       already counts, generalized from GuidingStarsHub's
 *                       one-tap "+ log"
 *   · task/habit/none → a named win (wins), carrying taskId/habitId/minutes.
 *                       A task-linked win is a TOUCH: worked on, not done.
 *
 * Both land in the Wake. Neither invents a task that never needed doing, and
 * declining leaves no record at all — same as today.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Linkable { value: string; label: string }

export default function LogDone({ testerId, defaultTitle = "", defaultMinutes, onLogged, onSkip }: {
  testerId: string | null;
  defaultTitle?: string;
  defaultMinutes?: number;
  onLogged: () => void;
  onSkip: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(defaultTitle);
  const [link, setLink] = useState("");            // "" | task-N | habit-N | star-N
  const [minutes, setMinutes] = useState(defaultMinutes != null ? String(defaultMinutes) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(false);
  const headers = { "x-tester-id": testerId ?? "", "Content-Type": "application/json" };

  // Fetched only while this panel is open — three small lists for the select.
  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ["logdone-tasks", testerId],
    queryFn: async () => {
      const r = await fetch("/api/tasks", { headers });
      const j = await r.json();
      return Array.isArray(j) ? j.filter(t => t.done !== "true") : [];
    },
    enabled: !!testerId,
  });
  const { data: habits = [] } = useQuery<any[]>({
    queryKey: ["logdone-habits", testerId],
    queryFn: async () => {
      const r = await fetch("/api/habits", { headers });
      const j = await r.json();
      return Array.isArray(j) ? j.filter(h => h.status === "active") : [];
    },
    enabled: !!testerId,
  });
  const { data: stars = [] } = useQuery<any[]>({
    queryKey: ["logdone-stars", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals", { headers });
      const j = await r.json();
      return Array.isArray(j) ? j.filter(g => g.status === "active") : [];
    },
    enabled: !!testerId,
  });

  const groups: { label: string; items: Linkable[] }[] = [
    { label: "Tasks", items: tasks.map(t => ({ value: `task-${t.id}`, label: t.title })) },
    { label: "Habits", items: habits.map(h => ({ value: `habit-${h.id}`, label: h.name })) },
    { label: "Stars", items: stars.map(g => ({ value: `star-${g.id}`, label: g.title })) },
  ].filter(g => g.items.length > 0);

  const save = useMutation({
    mutationFn: async () => {
      const mins = parseInt(minutes, 10) > 0 ? parseInt(minutes, 10) : null;
      const [kind, idStr] = link ? link.split("-") : ["", ""];
      const id = parseInt(idStr, 10);
      // An untitled but linked stretch names itself after the thing it
      // touched, in the ledger's own voice ("finished:", "kept:", …).
      const linkedLabel = groups.flatMap(g => g.items).find(i => i.value === link)?.label;
      const text = title.trim() || (linkedLabel ? `worked on: ${linkedLabel}` : "a stretch of work");
      if (kind === "star") {
        // The star record IS the ad-hoc session — that's what star progress
        // counts. Retroactive range from the minutes, not a zero-length stamp.
        const end = new Date();
        const start = new Date(end.getTime() - (mins ?? 0) * 60000);
        const r = await fetch("/api/planning/windows", {
          method: "POST", headers,
          body: JSON.stringify({ title: text, goalId: id, adHoc: true, startTime: start.toISOString(), endTime: end.toISOString() }),
        });
        if (!r.ok) throw new Error(`session failed (${r.status})`);
      } else {
        const r = await fetch("/api/planning/wins", {
          method: "POST", headers,
          body: JSON.stringify({
            text,
            taskId: kind === "task" ? id : undefined,
            habitId: kind === "habit" ? id : undefined,
            minutes: mins ?? undefined,
            tz: new Date().getTimezoneOffset(),
          }),
        });
        if (!r.ok) throw new Error(`win failed (${r.status})`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["momentum"] });
      qc.invalidateQueries({ queryKey: ["north-stars"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      onLogged();
    },
    onError: () => setErr(true),
    onSettled: () => setSaving(false),
  });

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-3)", marginBottom: 6 }}>
        Log what this was for
      </div>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="What were you working on?"
        style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 11, marginBottom: 6, background: "var(--color-card-2)", color: "var(--color-foreground)" }}
      />
      <select value={link} onChange={e => setLink(e.target.value)}
        style={{ width: "100%", padding: "6px 8px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 11, marginBottom: 6, background: "var(--color-card-2)", color: "var(--color-foreground)" }}>
        <option value="">No link — just the log</option>
        {groups.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </optgroup>
        ))}
      </select>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <input type="number" min={1} max={1440} value={minutes} onChange={e => setMinutes(e.target.value)}
          style={{ width: 60, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card-2)", color: "var(--color-foreground)" }} />
        <span style={{ fontSize: 10.5, color: "var(--color-muted)" }}>minutes</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => { setSaving(true); setErr(false); save.mutate(); }} disabled={saving} style={{
          flex: 1, padding: "7px 0", borderRadius: 7, border: "none",
          background: "#1a2a3a", color: "#ffffff", fontSize: 11, cursor: "pointer",
        }}>{saving ? "Logging…" : "Log it"}</button>
        <button onClick={onSkip} style={{
          flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid var(--color-border)",
          background: "var(--color-card)", color: "var(--text-2)", fontSize: 11, cursor: "pointer",
        }}>Skip</button>
      </div>
      {err && <div style={{ fontSize: 10, color: "#a03030", marginTop: 6 }}>Didn't save — try again.</div>}
    </div>
  );
}
