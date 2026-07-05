import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>
            Your long weather
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
            The seasons your stars can ride
          </div>
        </div>
        <span style={{ fontSize: 11, color: "#ccc", flexShrink: 0 }}>
          {collapsed ? "+" : "−"}
        </span>
      </button>

      {!collapsed && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          {isLoading ? (
            <div style={{ fontSize: 12, color: "#888" }}>Loading…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Slow transits (outer planets) */}
              {currents?.slowTransits && currents.slowTransits.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase", marginBottom: 6 }}>
                    Major cycles
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {currents.slowTransits.slice(0, 3).map((t: any, i: number) => (
                      <div key={i} style={{ fontSize: 11, color: "#666", lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600 }}>{t.planet}</span> in your{" "}
                        <span style={{ fontWeight: 600 }}>{t.houseName || t.house}</span> · {t.summary}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Profections */}
              {currents?.profection && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase", marginBottom: 6 }}>
                    Your year ahead
                  </div>
                  <div style={{ fontSize: 11, color: "#666", lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600 }}>{currents.profection.ruler}</span> year ·{" "}
                    {currents.profection.summary}
                  </div>
                </div>
              )}

              {/* Quick hint */}
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background: "#f8f4f0",
                  borderRadius: 6,
                  fontSize: 10,
                  color: "#888",
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
