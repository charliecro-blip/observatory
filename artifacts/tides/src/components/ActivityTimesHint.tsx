import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

/**
 * ActivityTimesHint (owner 2026-07-20): the sortage stitch. Given a step/task
 * title, ask the correspondence table what it reads as; if it matches, show a
 * quiet "⚡ reads as Deep study" chip that expands to that activity's tiered
 * election times (★ great / ● good) with one-tap scheduling. Makes the
 * election engine and Guiding Stars one system: every step knows its own hours.
 */

interface Match { key: string; label: string; gloss: string }
interface ElectionWindowT {
  date: string; dow: string; startAt: string; endAt: string;
  startClock: string; endClock: string; allDay?: boolean;
  tier: "good" | "great"; why: string;
}

export function ActivityTimesHint({ title, testerId, lat, lon, windowType }: {
  title: string; testerId: string | null; lat: number; lon: number; windowType?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scheduled, setScheduled] = useState<string | null>(null);

  const { data: match } = useQuery<Match | null>({
    queryKey: ["election-match", title],
    queryFn: async () => (await fetch(`/api/elections/match?text=${encodeURIComponent(title)}`)).json(),
    staleTime: Infinity,
  });

  const { data: times, isFetching } = useQuery<{ personalized: boolean; windows: ElectionWindowT[] }>({
    queryKey: ["election-times", match?.key, "week", testerId],
    queryFn: async () => (await fetch(
      `/api/elections/times?activity=${match!.key}&span=week&lat=${lat}&lon=${lon}&tz=${new Date().getTimezoneOffset()}`,
      { headers: testerId ? { "x-tester-id": testerId } : {} },
    )).json(),
    enabled: open && !!match?.key,
    staleTime: 1000 * 60 * 10,
  });

  const schedule = useMutation({
    mutationFn: async (w: ElectionWindowT) => {
      await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId ?? "" },
        body: JSON.stringify({ title, windowType: windowType ?? "deep_work", startTime: w.startAt, endTime: w.endAt }),
      });
      return `${w.dow}|${w.startClock}`;
    },
    onSuccess: (key) => {
      setScheduled(key);
      qc.invalidateQueries({ queryKey: ["planning-windows-all"] });
      setTimeout(() => setScheduled(null), 2200);
    },
  });

  if (!match) return null;
  const top = (times?.windows ?? []).slice(0, 3);

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        title={`${match.gloss} — its best times this week`}
        style={{ fontSize: 8.5, color: "#8a7a5e", background: "#c8b06a12", border: "1px solid #c8b06a40",
          borderRadius: 6, padding: "1px 6px", cursor: "pointer", whiteSpace: "nowrap" }}>
        ⚡ reads as {match.label}{open ? " ▴" : " ▾"}
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2, paddingLeft: 2 }}>
          {isFetching && <span style={{ fontSize: 9, color: "#aaa" }}>reading the sky…</span>}
          {!isFetching && top.length === 0 && <span style={{ fontSize: 9, color: "#aaa" }}>no clean window this week</span>}
          {top.map((w, i) => {
            const key = `${w.dow}|${w.startClock}`;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9.5 }}>
                <span style={{ color: w.tier === "great" ? "#c8a04a" : "#8a9a8a", flexShrink: 0 }}>{w.tier === "great" ? "★" : "●"}</span>
                <span style={{ color: "#6a6258", flexShrink: 0 }}>{w.dow} {w.allDay ? "all day" : `${w.startClock}–${w.endClock}`}</span>
                {!w.allDay && (scheduled === key
                  ? <span style={{ color: "#4a8060", fontWeight: 600 }}>✓</span>
                  : <button onClick={() => schedule.mutate(w)} style={{ fontSize: 8.5, color: "#8a8278", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>schedule</button>)}
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}
