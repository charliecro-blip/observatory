import React, { useState } from "react";
import { CHARACTER_LABEL, CHARACTER_ELEMENT, CHARACTER_ESSENCE, CHARACTER_WHY, ELEMENT_COLORS, type TideCharacter, type Element } from "@/lib/elements";

// The four tides, explained — the explication the Deep/Surge/Building/Clear
// names need. A tap-to-open key: all four, why each is named that, and which
// element it is. Reachable from the tide hero so the names are never a locked
// code the user has to have memorized.

const ORDER: TideCharacter[] = ["deep", "surge", "building", "clear"];

export function FourTidesKey({ current }: { current?: TideCharacter }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 2 }}>
        Every day has one of four characters, set by the element the Moon is moving through. The name says both the element and what the day is for.
      </div>
      {ORDER.map((c) => {
        const el = CHARACTER_ELEMENT[c] as Element;
        const color = ELEMENT_COLORS[el] ?? "#888";
        const isCur = current === c;
        return (
          <div key={c} style={{
            padding: "9px 11px", borderRadius: 9, border: `1px solid ${isCur ? color : "var(--color-border)"}`,
            background: isCur ? `${color}10` : "var(--color-card-2)",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{CHARACTER_LABEL[c]}</span>
              <span style={{ fontSize: 9.5, color: "#999", textTransform: "capitalize" }}>{el} tide</span>
              {isCur && <span style={{ fontSize: 9, color, marginLeft: "auto", fontWeight: 600 }}>today</span>}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-foreground)", marginTop: 3, lineHeight: 1.5 }}>{CHARACTER_ESSENCE[c]}</div>
            <div style={{ fontSize: 10, color: "#8a8278", marginTop: 3, lineHeight: 1.5, fontStyle: "italic" }}>{CHARACTER_WHY[c]}</div>
          </div>
        );
      })}
    </div>
  );
}

// A small "?" that pops the key. Drop next to the tide character anywhere.
export function FourTidesBadge({ current }: { current?: TideCharacter }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="What are the four tides?"
        style={{
          width: 15, height: 15, borderRadius: "50%", border: "1px solid var(--color-border)",
          background: "var(--color-card)", color: "#999", fontSize: 9, cursor: "pointer",
          lineHeight: 1, padding: 0, verticalAlign: "middle",
        }}>?</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", top: "120%", left: 0, zIndex: 41, width: 290,
            background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12,
            padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", marginBottom: 8 }}>The four tides</div>
            <FourTidesKey current={current} />
          </div>
        </>
      )}
    </span>
  );
}
