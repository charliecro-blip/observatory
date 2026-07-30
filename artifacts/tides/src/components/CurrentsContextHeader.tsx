import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HOUSE_MEANINGS, PROFECTION_GUIDANCE } from "@/lib/currents-content";
import { PLANET_GLYPH } from "@/lib/glyphs";

// 1 → 1st, 3 → 3rd, 11 → 11th
function ord(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function CurrentsContextHeader({
  testerId,
  collapsed: initialCollapsed,
}: {
  testerId: string | null;
  collapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false);

  const { data: currents, isLoading } = useQuery({
    queryKey: ["currents", testerId],
    queryFn: async () => {
      if (!testerId) return null;
      const r = await fetch("/api/currents", { headers: { "x-tester-id": testerId } });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 1000 * 60 * 30,
  });

  if (!currents || !testerId) return null;

  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        marginBottom: 16,
      }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Your long weather
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
            The seasons your stars can ride
          </div>
        </div>
        <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
          {collapsed ? "+" : "−"}
        </span>
      </button>

      {!collapsed && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          {isLoading ? (
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>Loading…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Slow transits — the API returns these as transitsByHouse
                  (outer planets moving through your houses), not slowTransits.
                  Reading the wrong key was why this panel came up empty. */}
              {Array.isArray(currents?.transitsByHouse) && currents.transitsByHouse.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>
                    Major cycles
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {currents.transitsByHouse.slice(0, 4).map((t: any, i: number) => {
                      const h = HOUSE_MEANINGS[t.house];
                      return (
                        <div key={i} style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600 }}>{PLANET_GLYPH[t.planet] ?? ""} {t.planet}</span>
                          {t.retrograde ? " ℞" : ""} through your{" "}
                          <span style={{ fontWeight: 600 }}>{h ? `${ord(t.house)} · ${h.title}` : ord(t.house)}</span>
                          {h ? ` — ${h.domains}` : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Profection — real fields are timeLord + house/sign; there is no
                  ruler/summary. Compose the year's theme from the house meaning
                  and the profection guidance copy. */}
              {currents?.profection && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>
                    Your year ahead
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600 }}>
                      {PLANET_GLYPH[currents.profection.timeLord] ?? ""} {currents.profection.timeLord} year
                    </span>
                    {" · "}
                    {HOUSE_MEANINGS[currents.profection.house]?.title} ({ord(currents.profection.house)}) in {currents.profection.sign}
                    {PROFECTION_GUIDANCE[currents.profection.house] ? (
                      <div style={{ marginTop: 3, color: "var(--color-muted)" }}>{PROFECTION_GUIDANCE[currents.profection.house]}</div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Quick hint */}
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background: "var(--color-card-2)",
                  borderRadius: 6,
                  fontSize: 10,
                  color: "var(--color-muted)",
                  lineHeight: 1.5,
                }}
              >
                Your Guiding Stars live in these seasons. Each one rides a chapter of your longer cycles.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
