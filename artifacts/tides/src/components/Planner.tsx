import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// The Planner — dump everything you need to do, and it weaves each task into the
// calendar at the time the sky best supports it (GTD + astrology). Reuses the
// association + best-times engine on the server; this is just the intake and the
// review of what it proposes before anything is written.

const ELEMENT_COLOR: Record<string, string> = { fire: "#c04830", earth: "#4a7040", air: "#7040a0", water: "#3a5a80" };
const PLANET_GLYPH: Record<string, string> = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇" };

interface PlannedItem {
  title: string; estimatedMinutes: number; energy: string; dueDate: string | null;
  element: string; windowType: string; planets: string[]; rationale: string;
  date: string; startAt: string; endAt: string; planetaryHour: string; matchedLane: boolean;
}
interface UnplacedItem { title: string; element: string; reason: string; }
interface WeaveResult { horizon: string; planned: PlannedItem[]; unplaced: UnplacedItem[]; }

const HORIZONS: { key: string; label: string; hint: string }[] = [
  { key: "day", label: "Today", hint: "one line per thing you want to land today" },
  { key: "week", label: "This week", hint: "add deadlines like “report by Fri” — it'll respect them" },
  { key: "month", label: "This month", hint: "bigger arcs; note due dates and it schedules backward from them" },
];

function fmtDayHeader(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function Planner({ testerId, lat, lon }: { testerId: string | null; lat: number; lon: number }) {
  const qc = useQueryClient();
  const [horizon, setHorizon] = useState("week");
  const [rawList, setRawList] = useState("");
  const [result, setResult] = useState<WeaveResult | null>(null);
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [committed, setCommitted] = useState(false);

  const weave = useMutation({
    mutationFn: async (): Promise<WeaveResult> => {
      const r = await fetch("/api/plan/weave", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({ rawList, horizon, lat, lon, tz: new Date().getTimezoneOffset() }),
      });
      if (!r.ok) throw new Error("weave failed");
      return r.json();
    },
    onSuccess: (data) => { setResult(data); setDropped(new Set()); setCommitted(false); },
  });

  const commit = useMutation({
    mutationFn: async () => {
      const items = (result?.planned ?? []).filter((_, i) => !dropped.has(i));
      const r = await fetch("/api/plan/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({ items }),
      });
      if (!r.ok) throw new Error("commit failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["windows"] });
      qc.invalidateQueries({ queryKey: ["planning-windows-all"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setCommitted(true);
    },
  });

  const keptCount = (result?.planned.length ?? 0) - dropped.size;
  // Group kept items by local day for the review.
  const byDay: Record<string, { item: PlannedItem; idx: number }[]> = {};
  (result?.planned ?? []).forEach((item, idx) => {
    if (dropped.has(idx)) return;
    const k = dayKey(item.startAt);
    (byDay[k] ??= []).push({ item, idx });
  });

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.3px" }}>
        Plan
      </div>
      <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, marginBottom: 16 }}>
        Dump everything on your plate. The Planner reads each task's nature, then weaves it into the open
        stretches of your calendar where the sky best supports that kind of work — the deep stuff in focused
        windows, the outreach in social ones, and so on. Nothing is scheduled until you say so.
      </div>

      {/* Horizon */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {HORIZONS.map((h) => (
          <button key={h.key} onClick={() => { setHorizon(h.key); }} style={{
            padding: "5px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
            border: horizon === h.key ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
            background: horizon === h.key ? "#1a2a3a10" : "var(--color-card)",
            color: horizon === h.key ? "#1a2a3a" : "#888", fontWeight: horizon === h.key ? 600 : 400,
          }}>{h.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>{HORIZONS.find((h) => h.key === horizon)?.hint}</div>

      <textarea
        value={rawList}
        onChange={(e) => setRawList(e.target.value)}
        placeholder={"write the quarterly report — deep focus, ~2h, due Friday\nreply to the landlord\ngo for a 45 min run\nbrainstorm names for the launch\ncall mom"}
        rows={6}
        style={{
          width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--color-border)",
          fontSize: 12.5, lineHeight: 1.6, background: "var(--color-card-2)", color: "var(--color-foreground)",
          resize: "vertical", outline: "none", fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <button
          onClick={() => weave.mutate()}
          disabled={weave.isPending || !rawList.trim()}
          style={{
            padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600,
            cursor: rawList.trim() ? "pointer" : "default",
            background: rawList.trim() ? "#1a2a3a" : "#e0dcd6", color: rawList.trim() ? "#fff" : "#aaa",
          }}
        >{weave.isPending ? "Reading the sky…" : "✦ Weave it in"}</button>
        {weave.isError && <span style={{ fontSize: 11, color: "#a03030" }}>Something went wrong — try again.</span>}
      </div>

      {/* Proposed schedule */}
      {result && (
        <div style={{ marginTop: 22 }}>
          {keptCount > 0 ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", marginBottom: 10 }}>
              Proposed schedule · {keptCount} task{keptCount === 1 ? "" : "s"}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>Nothing scheduled.</div>
          )}

          {Object.entries(byDay).map(([day, entries]) => (
            <div key={day} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px", color: "#aaa", marginBottom: 6 }}>{fmtDayHeader(entries[0].item.startAt)}</div>
              {entries.map(({ item, idx }) => {
                const col = ELEMENT_COLOR[item.element] ?? "#888";
                return (
                  <div key={idx} style={{
                    display: "flex", gap: 10, padding: "9px 12px", marginBottom: 6, borderRadius: 9,
                    border: "1px solid var(--color-border)", background: "var(--color-card)", borderLeft: `3px solid ${col}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)" }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
                        {fmtTime(item.startAt)}–{fmtTime(item.endAt)} · {item.estimatedMinutes}m
                        <span style={{ color: col, marginLeft: 6 }}>● {item.element}</span>
                        <span style={{ color: "#999", marginLeft: 6 }}>{PLANET_GLYPH[item.planetaryHour] ?? ""} {item.planetaryHour} hour</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: "#999", marginTop: 3, lineHeight: 1.5 }}>{item.rationale}</div>
                    </div>
                    <button onClick={() => setDropped((prev) => new Set(prev).add(idx))} title="Drop this one"
                      style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 14, flexShrink: 0, lineHeight: 1 }}>✕</button>
                  </div>
                );
              })}
            </div>
          ))}

          {result.unplaced.length > 0 && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 9, background: "#8a6a2008", border: "1px solid #c8a84040" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a6a20", marginBottom: 4 }}>Couldn't place {result.unplaced.length}</div>
              {result.unplaced.map((u, i) => (
                <div key={i} style={{ fontSize: 11, color: "#8a7a50", lineHeight: 1.5 }}>
                  <b>{u.title}</b> — {u.reason}
                </div>
              ))}
              <div style={{ fontSize: 10, color: "#a99a70", marginTop: 4 }}>Try a longer horizon, or free up some calendar time.</div>
            </div>
          )}

          {keptCount > 0 && (
            committed ? (
              <div style={{ fontSize: 12, color: "#3a6020", fontWeight: 600, marginTop: 12 }}>✓ Woven into your calendar (Ahead) and added to Tasks.</div>
            ) : (
              <button onClick={() => commit.mutate()} disabled={commit.isPending} style={{
                marginTop: 12, padding: "9px 20px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600,
                background: "#3a6020", color: "#fff", cursor: "pointer",
              }}>{commit.isPending ? "Scheduling…" : `Schedule all ${keptCount} →`}</button>
            )
          )}
        </div>
      )}
    </div>
  );
}
