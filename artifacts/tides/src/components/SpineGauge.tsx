import React from "react";
import { SPINE, SPINE_INTRO, type SpineRung } from "@/lib/spine";

// The depth gauge — the nested rhythms as a column of water: the fast beat at
// the bright surface, the slow currents in the deep. Cycles are the bands;
// aspects are the thinner threads that run between them.

const WATER_TOP = "#eaf2f6";
const WATER_BOTTOM = "#1a3a4a";
const WATER_TOP_DARK = "#1b2632";
const WATER_BOTTOM_DARK = "#060d14";

export default function SpineGauge({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  const top = dark ? WATER_TOP_DARK : WATER_TOP;
  const bottom = dark ? WATER_BOTTOM_DARK : WATER_BOTTOM;
  const cycles = SPINE.filter((r) => r.kind === "cycle");

  return (
    <div style={{ width: "100%" }}>
      {!compact && (
        <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--color-muted)", marginBottom: 16, maxWidth: 560 }}>
          {SPINE_INTRO}
        </div>
      )}
      <div style={{
        borderRadius: 14, overflow: "hidden", border: "1px solid var(--color-border)",
        background: `linear-gradient(180deg, ${top}, ${bottom})`,
      }}>
        {SPINE.map((r, i) => {
          // Progress 0 (surface) → 1 (seabed) for text contrast: labels flip to
          // light as the water darkens.
          const depth = i / (SPINE.length - 1);
          const onDark = depth > 0.5;
          const labelColor = onDark ? "rgba(255,255,255,0.95)" : "#1a2a33";
          const subColor = onDark ? "rgba(255,255,255,0.62)" : "#4a5a63";
          const isAspect = r.kind === "aspect";
          return (
            <div key={r.key} style={{
              display: "flex", alignItems: "baseline", gap: 12,
              padding: isAspect ? "7px 16px" : "13px 16px",
              borderTop: i === 0 ? "none" : `1px solid ${onDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
              // Aspects are the threads between cycles — inset + italic, lighter weight.
              paddingLeft: isAspect ? 34 : 16,
            }}>
              <div style={{ minWidth: compact ? 0 : 118, flexShrink: 0 }}>
                <div style={{
                  fontSize: isAspect ? 11 : 13.5, fontWeight: isAspect ? 500 : 700,
                  fontStyle: isAspect ? "italic" : "normal", color: labelColor,
                  letterSpacing: isAspect ? 0 : "-0.2px",
                }}>
                  {isAspect ? "↕ " : ""}{r.name}
                </div>
                {!compact && <div style={{ fontSize: 11, color: subColor, marginTop: 1, letterSpacing: "0.04em" }}>{r.period}</div>}
              </div>
              {!compact && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isAspect ? 11 : 12, color: onDark ? "rgba(255,255,255,0.85)" : "#2a3a43", lineHeight: 1.5 }}>{r.line}</div>
                  <div style={{ fontSize: 11, color: subColor, marginTop: 2, lineHeight: 1.45 }}>{r.feel}</div>
                </div>
              )}
              {compact && (
                <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: onDark ? "rgba(255,255,255,0.82)" : "#2a3a43", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.line}</div>
              )}
            </div>
          );
        })}
      </div>
      {!compact && (
        <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 8, textAlign: "center" }}>
          {cycles.length} nested cycles · the aspects are the moments between them
        </div>
      )}
    </div>
  );
}
