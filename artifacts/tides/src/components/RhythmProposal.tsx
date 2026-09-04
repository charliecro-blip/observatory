/**
 * What the chart proposes for a working rhythm — four functions, four
 * placements, literal first. Used in Settings (with "Use it") and in the
 * Bearings room (read-only). The record, not this, gets the last word.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PLANET_GLYPH } from "@/lib/glyphs";
import { RHYTHMS, TRIM_NAME, type Rhythm } from "@/lib/preferences";

export interface FunctionProposal {
  key: string; label: string; planet: string; sign: string; modality: string; element: string;
  trim: Rhythm; literal: string; reading: string;
}
export interface Proposal { overall: Rhythm; element: string; functions: FunctionProposal[] }

export function useRhythmProposal(testerId: string | null, enabled = true) {
  return useQuery<{ available: boolean; reason?: string; proposal?: Proposal; gated?: boolean }>({
    queryKey: ["rhythm-proposal", testerId],
    queryFn: async () => {
      const r = await fetch("/api/account/rhythm-proposal", { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (r.status === 402) return { available: false, gated: true };
      return r.json();
    },
    enabled: !!testerId && enabled,
    staleTime: 24 * 3600 * 1000,
  });
}

export default function RhythmProposal({ testerId, current, onUse, compact = false }: {
  testerId: string | null;
  current: Rhythm;
  onUse?: (r: Rhythm) => void;
  compact?: boolean;
}) {
  const { data } = useRhythmProposal(testerId);
  if (!data?.available || !data.proposal) return null;
  const p = data.proposal;
  const label = RHYTHMS.find(r => r.key === p.overall)?.label ?? TRIM_NAME[p.overall];
  const same = p.overall === current;
  return (
    <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--text-2)" }}>
      <div style={{ marginBottom: 4 }}>
        By your chart: <b style={{ color: "var(--color-foreground)" }}>{label}</b>
        {same ? <span style={{ color: "var(--text-3)" }}> · the one you're on</span>
          : onUse && <> · <button onClick={() => onUse(p.overall)} style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", color: "var(--color-primary)", textDecoration: "underline", textUnderlineOffset: 2 }}>use it</button></>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(240px, 1fr))", gap: "2px 18px" }}>
        {p.functions.map(f => (
          <div key={f.key}>
            <span style={{ color: "var(--text-3)", fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", marginRight: 6 }}>{f.label}</span>
            <b style={{ color: "var(--color-foreground)" }}>{TRIM_NAME[f.trim]}</b>
            <span style={{ color: "var(--color-muted)" }}> · <span role="img" aria-label={f.planet} style={{ fontFamily: "var(--font-symbol)" }}>{PLANET_GLYPH[f.planet] ?? ""}</span> {f.literal} — {f.reading}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
