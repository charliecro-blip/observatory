import React, { useState } from "react";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";

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
  // Read ONCE per render: the cache key and the request must not be able to
  // disagree about which timezone they meant.
  const tzOffset = new Date().getTimezoneOffset();
  // The IANA zone, alongside the numeric offset — corrects the day
  // boundary for the specific day in question rather than trusting a
  // snapshot, which drifts by an hour across a DST transition.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { locationKnown } = useTester();
  const [scheduled, setScheduled] = useState<string | null>(null);

  const { data: match } = useQuery<Match | null>({
    queryKey: ["election-match", title],
    queryFn: async () => (await fetch(`/api/elections/match?text=${encodeURIComponent(title)}`)).json(),
    staleTime: Infinity,
  });

  const { data: times, isFetching } = useQuery<{ chartAvailable: boolean; personalized: boolean; windows: ElectionWindowT[] }>({
    // lat/lon/tz are COMPUTATIONAL INPUTS and therefore belong in the key.
    // Without them a location or timezone change left the previous place's
    // windows cached for the full stale period — the app quietly answering
    // "when should I do this here?" with times computed for somewhere else.
    // Rounded to 2dp so trivial GPS jitter does not thrash the cache while a
    // real move always does.
    queryKey: ["election-times", match?.key, "week", testerId, lat.toFixed(2), lon.toFixed(2), tzOffset, zone, locationKnown],
    queryFn: async () => (await fetch(
      `/api/elections/times?activity=${match!.key}&span=week&lat=${lat}&lon=${lon}&tz=${tzOffset}&timeZone=${encodeURIComponent(zone)}&locationKnown=${locationKnown}`,
      { headers: testerId ? { "x-tester-id": testerId } : {} },
    )).json(),
    enabled: open && !!match?.key,
    staleTime: 1000 * 60 * 10,
  });

  const schedule = useMutation({
    mutationFn: async (w: ElectionWindowT) => {
      const r = await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId ?? "" },
        body: JSON.stringify({ title, windowType: windowType ?? "deep_work", startTime: w.startAt, endTime: w.endAt }),
      });
      if (!r.ok) throw new Error(`schedule failed (${r.status})`);
      return `${w.dow}|${w.startClock}`;
    },
    onSuccess: (key) => {
      setScheduled(key);
      invalidateWindows(qc);
      setTimeout(() => setScheduled(null), 2200);
    },
  });

  if (!match) return null;
  const top = (times?.windows ?? []).slice(0, 3);

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        title={`${match.gloss} — its best times this week`}
        style={{ fontSize: 9, color: "#8a7a5e", background: "#c8b06a12", border: "1px solid #c8b06a40",
          borderRadius: 6, padding: "1px 6px", cursor: "pointer", whiteSpace: "nowrap" }}>
        ⚡ reads as {match.label}{open ? " ▴" : " ▾"}
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2, paddingLeft: 2 }}>
          {isFetching && <span style={{ fontSize: 9, color: "var(--text-3)" }}>reading the sky…</span>}
          {!isFetching && top.length === 0 && <span style={{ fontSize: 9, color: "var(--text-3)" }}>no clean window this week</span>}
          {top.map((w, i) => {
            const key = `${w.dow}|${w.startClock}`;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9.5 }}>
                <span style={{ color: w.tier === "great" ? "#c8a04a" : "var(--color-muted)", flexShrink: 0 }}>{w.tier === "great" ? "★" : "●"}</span>
                <span style={{ color: "var(--color-muted)", flexShrink: 0 }}>{w.dow} {w.allDay ? "all day" : `${w.startClock}–${w.endClock}`}</span>
                {!w.allDay && (scheduled === key
                  ? <span aria-hidden="true" style={{ color: "#4a8060", fontWeight: 600 }}>✓</span>
                  : <button onClick={() => schedule.mutate(w)} style={{ fontSize: 9, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>schedule</button>)}
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}
