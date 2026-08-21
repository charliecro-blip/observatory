/**
 * THE RECORD AUDITS THE PRIOR (design §1, §8c). Which rhythm Home led with
 * each day, set against that day's felt rating and wins. When a rival
 * rhythm has enough rated days and a clearly higher share of aligned ones,
 * the notice says so and offers the switch. The person can prove Compass
 * wrong; that is the feature.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RHYTHMS, TRIM_NAME, type Rhythm } from "@/lib/preferences";

interface Row { rhythm: Rhythm; days: number; rated: number; aligned: number; mixed: number; off: number; wins: number }
interface Audit {
  enough: boolean; rows: Row[]; current: Rhythm | null;
  suggestion: { rhythm: Rhythm; alignedShare: number; currentShare: number; days: number } | null;
}

export function useRhythmAudit(testerId: string | null, enabled = true) {
  return useQuery<Audit | null>({
    queryKey: ["rhythm-audit", testerId],
    queryFn: async () => {
      const r = await fetch("/api/account/rhythm-audit", { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId && enabled,
    staleTime: 6 * 3600 * 1000,
  });
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The table, for Settings and the Bearings room. */
export function RhythmRecordTable({ testerId }: { testerId: string | null }) {
  const { data } = useRhythmAudit(testerId);
  if (!data) return null;
  if (!data.enough) {
    const total = data.rows.reduce((n, r) => n + r.days, 0);
    return (
      <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.6 }}>
        {total === 0 ? "No days on record yet." : `${total} day${total === 1 ? "" : "s"} on record. After a week in one rhythm, and your felt ratings in the Log, this compares them.`}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 11.5, lineHeight: 1.7, color: "var(--text-2)" }}>
      {data.rows.map(r => (
        <div key={r.rhythm}>
          <b style={{ color: "var(--color-foreground)" }}>{TRIM_NAME[r.rhythm]}</b>
          <span style={{ color: "var(--color-muted)" }}> · {r.days} day{r.days === 1 ? "" : "s"}{r.rated ? ` · ${pct(r.aligned / r.rated)} of ${r.rated} rated days aligned` : " · no felt ratings yet"} · {r.wins} win{r.wins === 1 ? "" : "s"}</span>
          {r.rhythm === data.current && <span style={{ color: "var(--text-3)" }}> · now</span>}
        </div>
      ))}
    </div>
  );
}

/** The notice on Home — only when there is something to say. */
export default function RhythmRecordNotice({ testerId, onSwitch }: { testerId: string | null; onSwitch: (r: Rhythm) => void }) {
  const { data } = useRhythmAudit(testerId);
  const s = data?.suggestion ?? null;
  const key = s ? `compass-rhythm-record-${testerId}-${s.rhythm}` : "";
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return !!key && localStorage.getItem(key) === "1"; } catch { return false; }
  });
  if (!s || !data?.current || dismissed) return null;
  const label = RHYTHMS.find(r => r.key === s.rhythm)?.label ?? TRIM_NAME[s.rhythm];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", flexWrap: "wrap",
      background: "var(--color-card)", border: "1px solid var(--color-border)", borderLeft: "3px solid #3f7a4a", borderRadius: 10,
    }}>
      <div style={{ flex: 1, minWidth: 220, fontSize: 12, lineHeight: 1.55, color: "var(--color-muted)" }}>
        Compass is set to <b style={{ color: "var(--color-foreground)" }}>{TRIM_NAME[data.current]}</b>, and your record says something else: on the {s.days} days set to <b style={{ color: "var(--color-foreground)" }}>{TRIM_NAME[s.rhythm]}</b> you rated {pct(s.alignedShare)} of days aligned, against {pct(s.currentShare)} here.
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onSwitch(s.rhythm)} style={{
          fontSize: 11.5, fontWeight: 600, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
          border: "none", background: "var(--color-primary)", color: "#fff",
        }}>Switch to {label}</button>
        <button onClick={() => { setDismissed(true); try { localStorage.setItem(key, "1"); } catch {} }} style={{
          fontSize: 11.5, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
          border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-muted)",
        }}>Keep it</button>
      </div>
    </div>
  );
}
