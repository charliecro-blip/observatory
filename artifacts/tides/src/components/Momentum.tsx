import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Momentum — the daily progress loop's shared UI (owner 2026-07-17):
 *   morning : StarRows — one tappable row per Guiding Star (next move + today's
 *             best window) → that star's game plan
 *   evening : EveningHarvest — auto-harvested wins + "name a win" + the helm streak
 *   anytime : WakeList — the continual wins ledger, filterable by star
 * All three read one endpoint (/api/planning/momentum); auto wins are derived
 * server-side from completions, so nothing here double-books.
 */

export interface MomentumStar {
  id: number; title: string; element: string | null;
  stepsDone: number; stepsTotal: number; openTasks: number;
  nextMove: { kind: string; id: number; title: string } | null;
  bestWindowToday: { startClock: string; endClock: string } | null;
  winsWeek: number; winsCycle: number; winsToday: number;
}
export interface MomentumData {
  today: string; streak: number; cycleStart: string; weekStart: string;
  winsToday: number; winsWeek: number; winsCycle: number;
  stars: MomentumStar[];
  ledger: { date: string; goalId: number | null; text: string; source: string; winId?: number }[];
}

const EL_COLOR: Record<string, string> = { fire: "#c04830", earth: "#4a7040", air: "#c19a3a", water: "#3a5a80" };
const elc = (el?: string | null) => EL_COLOR[el ?? ""] ?? "#8a8278";

export function useMomentum(testerId: string | null, lat = 40.7, lon = -74.0) {
  return useQuery<MomentumData>({
    queryKey: ["momentum", testerId],
    queryFn: async () => {
      const r = await fetch(`/api/planning/momentum?tz=${new Date().getTimezoneOffset()}&lat=${lat}&lon=${lon}`,
        { headers: { "x-tester-id": testerId ?? "" } });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 1000 * 60 * 5,
  });
}

// ── Morning: one row per star — the 10-second glance ─────────────────────────
export function StarRows({ testerId, lat, lon, onOpenStar }: {
  testerId: string | null; lat?: number; lon?: number;
  onOpenStar?: (goalId: number) => void;
}) {
  const { data } = useMomentum(testerId, lat, lon);
  const stars = data?.stars ?? [];
  if (stars.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "#aaa" }}>Your stars today</span>
        {(data?.streak ?? 0) > 0 && (
          <span style={{ fontSize: 9, color: "#8a7a5e" }} title="Days you've closed the loop — one missed day lowers sail without sinking the run">
            ⚓ {data!.streak} day{data!.streak === 1 ? "" : "s"} at the helm
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {stars.map(s => {
          const c = elc(s.element);
          return (
            <button key={s.id} onClick={() => onOpenStar?.(s.id)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9,
              border: `1px solid ${c}35`, background: "var(--color-card)", cursor: "pointer", textAlign: "left",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  ✦ {s.title}
                </div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.nextMove ? `next: ${s.nextMove.title}` : s.openTasks > 0 ? `${s.openTasks} open tasks` : "break it into a first step →"}
                </div>
              </div>
              {s.bestWindowToday && (
                <span style={{ fontSize: 9.5, color: c, fontWeight: 600, flexShrink: 0 }}
                  title="Today's best stretch for this star's element, from the tide curve">
                  ◷ {s.bestWindowToday.startClock}–{s.bestWindowToday.endClock}
                </span>
              )}
              <span style={{ fontSize: 10, color: "#ccc", flexShrink: 0 }}>→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Evening: the harvest — what moved, name a win, streak ────────────────────
export function EveningHarvest({ testerId, lat, lon }: { testerId: string | null; lat?: number; lon?: number }) {
  const qc = useQueryClient();
  const { data } = useMomentum(testerId, lat, lon);
  const [text, setText] = useState("");
  const [starId, setStarId] = useState<number | "">("");
  const nameWin = useMutation({
    mutationFn: async () => {
      await fetch("/api/planning/wins", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), goalId: starId || undefined, tz: new Date().getTimezoneOffset() }),
      });
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["momentum"] }); },
  });
  if (!data) return null;
  const todayWins = data.ledger.filter(l => l.date === data.today);
  const starTitle = (id: number | null) => data.stars.find(s => s.id === id)?.title;

  return (
    <div style={{ marginBottom: 8 }}>
      {todayWins.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "#aaa", marginBottom: 4 }}>
            Today's wins · {todayWins.length}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {todayWins.map((w, i) => (
              <span key={i} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 14, fontWeight: 600,
                background: w.source === "named" ? "#8a6a2012" : "#4a806012",
                border: w.source === "named" ? "1px solid #c8b06a55" : "1px solid #4a806030",
                color: w.source === "named" ? "#8a6a20" : "#4a8060",
              }}>
                {w.source === "named" ? "★" : "✓"} {w.text}{starTitle(w.goalId) ? ` · ${starTitle(w.goalId)}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Name a win — the written line that carries the meaning */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && text.trim() && nameWin.mutate()}
          placeholder="Name a win in your own words…"
          style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 11.5, background: "var(--color-card)", outline: "none" }} />
        {data.stars.length > 0 && (
          <select value={starId} onChange={e => setStarId(e.target.value ? Number(e.target.value) : "")}
            style={{ padding: "6px 6px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 10, color: "#777", background: "var(--color-card)", maxWidth: 110 }}>
            <option value="">no star</option>
            {data.stars.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
        <button onClick={() => text.trim() && nameWin.mutate()} disabled={!text.trim() || nameWin.isPending}
          style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: text.trim() ? "#1a2a3a" : "#e0dcd6", color: text.trim() ? "#fff" : "#aaa", fontSize: 10.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          ★ log it
        </button>
      </div>
      <div style={{ fontSize: 9.5, color: "#998a76", marginTop: 5 }}>
        ⚓ {data.streak} day{data.streak === 1 ? "" : "s"} at the helm · {data.winsWeek} win{data.winsWeek === 1 ? "" : "s"} this week · {data.winsCycle} this moon cycle
      </div>
    </div>
  );
}

// ── The Wake: the continual wins ledger ──────────────────────────────────────
export function WakeList({ testerId, lat, lon }: { testerId: string | null; lat?: number; lon?: number }) {
  const { data } = useMomentum(testerId, lat, lon);
  const [filter, setFilter] = useState<number | "all">("all");
  if (!data || data.ledger.length === 0) return null;
  const items = data.ledger.filter(l => filter === "all" || l.goalId === filter);
  const starTitle = (id: number | null) => data.stars.find(s => s.id === id)?.title;
  const starEl = (id: number | null) => data.stars.find(s => s.id === id)?.element;
  // Group by date for scannable days
  const byDate: Record<string, typeof items> = {};
  for (const it of items) (byDate[it.date] = byDate[it.date] ?? []).push(it);
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>The wake</div>
        <div style={{ fontSize: 9.5, color: "#8a7a5e" }}>
          ⚓ {data.streak}d at the helm · {data.winsWeek} this week · {data.winsCycle} this cycle
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#999", marginBottom: 8 }}>
        Every win, trailing behind the ship — done things harvested automatically, starred ones named by you.
      </div>
      {data.stars.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          <button onClick={() => setFilter("all")} style={{
            fontSize: 9.5, padding: "3px 10px", borderRadius: 12, cursor: "pointer",
            border: filter === "all" ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
            background: filter === "all" ? "#1a2a3a" : "transparent", color: filter === "all" ? "#fff" : "#888",
          }}>all</button>
          {data.stars.map(s => (
            <button key={s.id} onClick={() => setFilter(s.id)} style={{
              fontSize: 9.5, padding: "3px 10px", borderRadius: 12, cursor: "pointer",
              border: filter === s.id ? `1px solid ${elc(s.element)}` : "1px solid var(--color-border)",
              background: filter === s.id ? `${elc(s.element)}18` : "transparent",
              color: filter === s.id ? elc(s.element) : "#888", fontWeight: filter === s.id ? 600 : 400,
            }}>✦ {s.title}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
        {dates.map(d => (
          <div key={d}>
            <div style={{ fontSize: 9, color: "#b0a898", marginBottom: 3 }}>
              {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {d >= data.cycleStart ? "" : " · last cycle"}
            </div>
            {byDate[d].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 7, fontSize: 11, padding: "2px 0" }}>
                <span style={{ color: w.source === "named" ? "#c8a04a" : "#4a8060", flexShrink: 0 }}>
                  {w.source === "named" ? "★" : "✓"}
                </span>
                <span style={{ color: "var(--color-foreground)", flex: 1 }}>{w.text}</span>
                {starTitle(w.goalId) && (
                  <span style={{ fontSize: 9, color: elc(starEl(w.goalId)), flexShrink: 0 }}>✦ {starTitle(w.goalId)}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
