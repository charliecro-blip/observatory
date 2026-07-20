import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logEvent } from "@/lib/analytics";

/**
 * The election picker (owner 2026-07-20): browse the extensive activity list,
 * pick one, get tiered times — ● good (planetary hours, Moon aspects, sign
 * days — localized) and ★ great (your natal houses/planets in play, standing
 * sky aspects, or stacked conditions). One tap schedules a window.
 * Data: /api/elections/activities + /api/elections/times (lib/
 * activityCorrespondences + electionEngine server-side).
 */

const EL_COLOR: Record<string, string> = { fire: "#c04830", earth: "#4a7040", air: "#c19a3a", water: "#3a5a80" };

interface ActivityLite {
  key: string; label: string; category: string; element: string;
  gloss: string; windowType: string;
}
interface ElectionWindowT {
  date: string; dow: string; startAt: string; endAt: string;
  startClock: string; endClock: string; allDay?: boolean;
  tier: "good" | "great"; why: string; score: number;
}

export function ElectionPicker({ testerId, lat, lon }: { testerId: string | null; lat: number; lon: number }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("body");
  const [activityKey, setActivityKey] = useState<string | null>(null);
  const [span, setSpan] = useState<"day" | "week" | "month">("week");
  const [scheduled, setScheduled] = useState<string | null>(null);

  const { data: list } = useQuery<{ categories: { key: string; label: string; gloss: string }[]; activities: ActivityLite[] }>({
    queryKey: ["election-activities"],
    queryFn: async () => (await fetch("/api/elections/activities")).json(),
    staleTime: Infinity,
  });

  const { data: times, isFetching } = useQuery<{ personalized: boolean; cautions: string[]; windows: ElectionWindowT[]; activity: ActivityLite }>({
    queryKey: ["election-times", activityKey, span, testerId],
    queryFn: async () => (await fetch(
      `/api/elections/times?activity=${activityKey}&span=${span}&lat=${lat}&lon=${lon}&tz=${new Date().getTimezoneOffset()}`,
      { headers: testerId ? { "x-tester-id": testerId } : {} },
    )).json(),
    enabled: !!activityKey,
    staleTime: 1000 * 60 * 10,
  });

  const schedule = useMutation({
    mutationFn: async (w: ElectionWindowT) => {
      const act = list?.activities.find(a => a.key === activityKey);
      await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId ?? "" },
        body: JSON.stringify({
          title: act?.label ?? "Election", windowType: act?.windowType ?? "deep_work",
          startTime: w.startAt, endTime: w.endAt,
        }),
      });
      return `${w.dow}|${w.startClock}`;
    },
    onSuccess: (key, w) => {
      logEvent("election_schedule", { activity: activityKey, tier: w.tier });
      setScheduled(key);
      qc.invalidateQueries({ queryKey: ["planning-windows-all"] });
      setTimeout(() => setScheduled(null), 2500);
    },
  });

  const activities = (list?.activities ?? []).filter(a => a.category === category);
  const selected = list?.activities.find(a => a.key === activityKey);

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "16px 18px", marginBottom: 18 }}>
      {/* The timing/election engine keeps the name Auspice — "under good
          auspices", the favorable moment — now that Compass is the product. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 2 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-primary)" }}>Find the time for anything</div>
        <span style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "#c8a04a", fontFamily: "var(--font-display)" }}>· Auspice</span>
      </div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
        Pick an activity — Auspice reads its good and great times from the sky{times?.personalized ? " and your chart" : ""}.
      </div>

      {/* Categories */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {(list?.categories ?? []).map(c => (
          <button key={c.key} onClick={() => { setCategory(c.key); setActivityKey(null); }} title={c.gloss} style={{
            fontSize: 10, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
            border: category === c.key ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
            background: category === c.key ? "#1a2a3a" : "transparent",
            color: category === c.key ? "#fff" : "#888", fontWeight: category === c.key ? 600 : 400,
          }}>{c.label}</button>
        ))}
      </div>

      {/* Activities in category */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: activityKey ? 12 : 0 }}>
        {activities.map(a => {
          const c = EL_COLOR[a.element] ?? "#8a8278";
          const on = activityKey === a.key;
          return (
            <button key={a.key} onClick={() => setActivityKey(a.key)} title={a.gloss} style={{
              fontSize: 11, padding: "6px 12px", borderRadius: 9, cursor: "pointer",
              border: on ? `1.5px solid ${c}` : "1px solid var(--color-border)",
              background: on ? `${c}14` : "var(--color-card-2)",
              color: on ? c : "var(--color-foreground)", fontWeight: on ? 700 : 400,
            }}>{a.label}</button>
          );
        })}
      </div>

      {activityKey && (
        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 10.5, color: "#8a8278", fontStyle: "italic" }}>{selected?.gloss}</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["day", "week", "month"] as const).map(s => (
                <button key={s} onClick={() => setSpan(s)} style={{
                  fontSize: 9.5, padding: "3px 10px", borderRadius: 10, cursor: "pointer",
                  border: span === s ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
                  background: span === s ? "#1a2a3a" : "transparent", color: span === s ? "#fff" : "#888",
                }}>{s}</button>
              ))}
            </div>
          </div>

          {(times?.cautions ?? []).map((c, i) => (
            <div key={i} style={{ fontSize: 10.5, color: "#8a6a20", background: "#c8b06a14", border: "1px solid #c8b06a45", borderRadius: 8, padding: "6px 10px", marginBottom: 8, lineHeight: 1.5 }}>
              ⚠ {c}
            </div>
          ))}
          {times && !times.personalized && (
            <div style={{ fontSize: 9.5, color: "#999", marginBottom: 8 }}>
              ○ Add your birth chart in Settings to unlock ★ great times read from your own houses.
            </div>
          )}

          {isFetching && <div style={{ fontSize: 11, color: "#999", padding: "10px 0" }}>Reading the sky…</div>}
          {!isFetching && (times?.windows ?? []).length === 0 && (
            <div style={{ fontSize: 11, color: "#999", padding: "6px 0" }}>No clean window in this span — a quiet stretch for this.</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(times?.windows ?? []).map((w, i) => {
              const key = `${w.dow}|${w.startClock}`;
              const great = w.tier === "great";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "7px 11px", borderRadius: 9,
                  border: great ? "1px solid #c8b06a70" : "1px solid var(--color-border)",
                  background: great ? "#c8b06a0e" : "var(--color-card-2)",
                }}>
                  <span title={great ? "Great — your chart or stacked sky conditions" : "Good — the sky's general weather"}
                    style={{ fontSize: great ? 13 : 10, color: great ? "#c8a04a" : "#8a9a8a", flexShrink: 0, width: 16, textAlign: "center" }}>
                    {great ? "★" : "●"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
                      {w.dow} {w.date} · {w.allDay ? "all day" : `${w.startClock}–${w.endClock}`}
                    </div>
                    <div style={{ fontSize: 9.5, color: "#8a8278", marginTop: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, lineHeight: 1.45 }}>
                      {w.why}
                    </div>
                  </div>
                  {!w.allDay && (
                    scheduled === key
                      ? <span style={{ fontSize: 10, color: "#4a8060", fontWeight: 600, flexShrink: 0 }}>✓ on the calendar</span>
                      : <button onClick={() => schedule.mutate(w)} disabled={schedule.isPending} style={{
                          fontSize: 9.5, padding: "4px 11px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
                          border: "1px solid var(--color-border)", background: "var(--color-card)", color: "#556", fontWeight: 600,
                        }}>schedule</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
