/**
 * A GEAR CHANGE, offered. The sky says one working style is lit this
 * stretch; the person says yes or not now. Yes sets a dated override on
 * the rhythm preference and Home leads that way until the date; not now
 * puts this particular invitation away. Sky vocabulary end to end, so the
 * quiet lens hides it outright.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RHYTHMS, type Rhythm } from "@/lib/preferences";

export default function GearChange({ testerId, current, base, onAccept }: {
  testerId: string | null;
  /** The rhythm in force now (override included). */
  current: Rhythm;
  /** The person's own base rhythm. */
  base: Rhythm;
  onAccept: (rhythm: Rhythm, until: string, reason: string) => void;
}) {
  const { data } = useQuery<{ available: boolean; gear: { rhythm: Rhythm; literal: string; reading: string; until: string } | null }>({
    queryKey: ["gear", testerId],
    queryFn: async () => {
      const r = await fetch("/api/account/gear", { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) return { available: false, gear: null };
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 6 * 3600 * 1000,
  });
  const gear = data?.gear ?? null;
  const dismissKey = gear ? `compass-gear-dismissed-${testerId}` : "";
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return localStorage.getItem(`compass-gear-dismissed-${testerId}`); } catch { return null; }
  });
  if (!gear || gear.rhythm === current || dismissed === gear.literal) return null;
  const label = RHYTHMS.find(r => r.key === gear.rhythm)?.label ?? gear.rhythm;
  const until = new Date(gear.until + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", flexWrap: "wrap",
      background: "var(--color-card)", border: "1px solid var(--color-border)", borderLeft: "3px solid #6f6a90", borderRadius: 10,
    }}>
      <div style={{ flex: 1, minWidth: 220, fontSize: 12, lineHeight: 1.55 }}>
        <div style={{ color: "var(--color-foreground)" }}>{gear.literal}</div>
        <div style={{ color: "var(--color-muted)" }}>
          Compass reads this as: {gear.reading}. Lead with <b style={{ color: "var(--color-foreground)" }}>{label}</b> through {until}?
          {base !== current && <span style={{ color: "var(--text-3)" }}> You'd come back to your own rhythm after.</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onAccept(gear.rhythm, gear.until, gear.literal)} style={{
          fontSize: 11.5, fontWeight: 600, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
          border: "none", background: "var(--color-primary)", color: "#fff",
        }}>Yes, through {until}</button>
        <button onClick={() => { setDismissed(gear.literal); try { localStorage.setItem(dismissKey, gear.literal); } catch {} }} style={{
          fontSize: 11.5, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
          border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-muted)",
        }}>Not now</button>
      </div>
    </div>
  );
}
