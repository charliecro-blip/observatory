import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNorthStars } from "@/hooks/useTides";
import { ELEMENT_MYTHOS, type ElementMythos } from "@/lib/mythos";

const ELEMENTS = ["fire", "earth", "air", "water"] as const;

/**
 * The Life tab's front door — per the Life-tab rework schema (see memory:
 * tides-life-tab-rework-schema). North Stars (identity) + four element cards
 * (essence/domains/practices + this week's session count, from ELEMENT_MYTHOS
 * and the same North Stars data NorthStarsCard on Today already uses) + a
 * one-line weekly retro. Tasks/Habits/Goals/Projects/Practices stay as
 * sub-tabs beneath this for now — this is the hub, not a replacement.
 */
export default function GuidingStarsHub({ testerId, onNavigate }: {
  testerId: string | null;
  onNavigate: (tab: "tasks" | "habits" | "goals" | "projects" | "practices") => void;
}) {
  const qc = useQueryClient();
  const { data: stars, isLoading } = useNorthStars(testerId);

  const logSession = useMutation({
    mutationFn: async (goalId: number) => {
      const now = new Date().toISOString();
      await fetch("/api/planning/windows", {
        method: "POST", headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({ title: "Logged session", goalId, adHoc: true, startTime: now, endTime: now }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["north-stars"] }),
  });

  const list: any[] = stars ?? [];

  // Tally this week's sessions per element from the North Stars already tagged
  // with one. A North Star with no element assigned doesn't count toward any
  // card — that's a real gap in the data, not silently attributed anywhere.
  const byElement: Record<string, { completed: number; scheduled: number; stars: any[] }> = {};
  for (const el of ELEMENTS) byElement[el] = { completed: 0, scheduled: 0, stars: [] };
  for (const g of list) {
    const el = g.element as string | undefined;
    if (!el || !byElement[el]) continue;
    byElement[el].completed += g.completedCount ?? 0;
    byElement[el].scheduled += Math.max(g.scheduledCount ?? 0, 2);
    byElement[el].stars.push(g);
  }

  const topElement = ELEMENTS
    .map((el) => ({ el, completed: byElement[el].completed }))
    .sort((a, b) => b.completed - a.completed)[0];

  if (isLoading) {
    return <div style={{ padding: 40, color: "#999", fontSize: 13 }}>Reading your North Stars…</div>;
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.4px" }}>Guiding Stars</div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Your chief aims, and how each element is doing this week</div>
        </div>

        {/* North Stars */}
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "13px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>★ North Stars</div>
            <button onClick={() => onNavigate("goals")} style={{ fontSize: 9.5, color: "#aaa", background: "none", border: "none", cursor: "pointer" }}>manage →</button>
          </div>
          {list.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "#999", lineHeight: 1.6 }}>
              No North Stars set yet. Mark up to 3 goals as North Stars in the Goals tab to anchor this view.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {list.map((g: any) => {
                const info = ELEMENT_MYTHOS[g.element ?? ""];
                const target = Math.max(g.scheduledCount ?? 0, 2);
                const pct = Math.min(100, Math.round(((g.completedCount ?? 0) / target) * 100));
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: info?.color ?? "#8a8278", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                        {info && <span style={{ fontSize: 8.5, color: info.color }}>{info.name}</span>}
                      </div>
                      <div style={{ height: 3, background: "var(--color-background)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: info?.color ?? "#8a8278", borderRadius: 2, opacity: 0.75 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 9.5, color: "#999", flexShrink: 0 }}>{g.completedCount ?? 0}/{target} this wk</span>
                    <button onClick={() => logSession.mutate(g.id)} title="Log a session for this goal" style={{
                      fontSize: 9.5, padding: "3px 9px", borderRadius: 12, border: "1px solid #e0dad0",
                      background: "var(--color-card-2)", color: "#6a6258", cursor: "pointer", flexShrink: 0,
                    }}>+ log</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Weekly retro */}
        {topElement && topElement.completed > 0 && (
          <div style={{ fontSize: 11.5, color: "#888", padding: "2px 2px" }}>
            Most active element this week: <b style={{ color: ELEMENT_MYTHOS[topElement.el].color }}>{ELEMENT_MYTHOS[topElement.el].name}</b>
            {" "}({topElement.completed} session{topElement.completed === 1 ? "" : "s"} logged)
          </div>
        )}

        {/* Element cards */}
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "#a89a88", marginBottom: 10 }}>
            The four elements
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {ELEMENTS.map((el) => {
              const m: ElementMythos = ELEMENT_MYTHOS[el];
              const tally = byElement[el];
              return (
                <button key={el} onClick={() => onNavigate("practices")} style={{
                  textAlign: "left", cursor: "pointer", background: "var(--color-card)",
                  border: `1px solid ${m.color}30`, borderRadius: 12, padding: "12px 14px",
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)" }}>{m.name}</span>
                    {tally.stars.length === 0 && <span style={{ fontSize: 8.5, color: "#bbb", marginLeft: "auto" }}>no North Star</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.45 }}>{m.essence}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                    {m.domains.slice(0, 3).map((d, i) => (
                      <span key={i} style={{ fontSize: 8.5, color: m.color, background: `${m.color}12`, padding: "2px 7px", borderRadius: 8 }}>{d}</span>
                    ))}
                  </div>
                  {tally.completed > 0 && (
                    <div style={{ fontSize: 9.5, color: "#999", marginTop: 2 }}>{tally.completed} session{tally.completed === 1 ? "" : "s"} this week</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
