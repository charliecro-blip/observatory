import React from "react";
import type { TidesNow } from "@/lib/types";

const ELEMENT_COLORS: Record<string, string> = {
  water: "#3a5a80", fire: "#8a3a20", earth: "#3a6030", air: "#602080",
};

const ASPECT_COLORS: Record<string, string> = {
  "☌": "#f0b060", "□": "#e06060", "△": "#60a060", "⚹": "#6090d0", "☍": "#e06060",
};

const PLANET_ICONS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆",
};

function planetColor(planet: string) {
  const map: Record<string, string> = {
    Sun: "#c08020", Moon: "#7080a0", Mercury: "#608060", Venus: "#a06080",
    Mars: "#c04040", Jupiter: "#6040a0", Saturn: "#807060",
  };
  return map[planet] ?? "#888";
}

function progressPct(began: string, ends: string) {
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const b = parse(began), e = parse(ends);
  if (e <= b) return 50;
  return Math.min(100, Math.max(0, ((cur - b) / (e - b)) * 100));
}

export default function Rail({ now }: { now: TidesNow | undefined }) {
  if (!now) {
    return (
      <div className="rail">
        <div style={{ padding: "16px", color: "#aaa", fontSize: "12px" }}>Loading…</div>
      </div>
    );
  }

  const { planetaryHour, upcomingHours, moonSign, moonPhase, moonIllumination, biodynamicType, element } = now;
  const pct = progressPct(planetaryHour.began, planetaryHour.ends);
  const elemColor = ELEMENT_COLORS[element?.element ?? "water"] ?? "#888";
  const pColor = planetColor(planetaryHour.planet);

  return (
    <aside style={{
      width: 210, minWidth: 210, background: "#e8e4de", borderRight: "1px solid #d0cbc3",
      display: "flex", flexDirection: "column", overflowY: "auto", fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #d0cbc3" }}>
        <div style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#c8b89a" }} />
          Tides
        </div>
        <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Moon */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #d8d3cd" }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6 }}>Moon</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: "radial-gradient(circle at 60% 40%, #e8e0d0, #9a9080)",
          }} />
          <div>
            <div style={{ fontWeight: 600 }}>{moonPhase?.replace(/_/g, " ")}</div>
            <div style={{ color: "#777", marginTop: 1 }}>{Math.round(moonIllumination ?? 0)}% · {moonSign}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: `${elemColor}22`, color: elemColor }}>
            {element?.element}
          </span>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: "#d0e0cc", color: "#3a6030" }}>
            {biodynamicType}
          </span>
          {now.qualityScore && (
            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: "#d8e8d0", color: "#3a6030" }}>
              {now.quality} · {now.qualityScore}
            </span>
          )}
        </div>
      </div>

      {/* Planetary Hour */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #d8d3cd" }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6 }}>Planetary hour</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 14, flexShrink: 0,
            background: `${pColor}22`, color: pColor,
          }}>
            {PLANET_ICONS[planetaryHour.planet] ?? "○"}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{planetaryHour.planet}</div>
            <div style={{ fontSize: 9, color: "#888" }}>{planetaryHour.archetype ?? planetaryHour.quality}</div>
          </div>
        </div>

        {/* Hour progress bar */}
        <div style={{ fontSize: 9, color: "#bbb", display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span>{planetaryHour.began}</span><span>{planetaryHour.ends}</span>
        </div>
        <div style={{ height: 3, background: "#d0cbc3", borderRadius: 2, marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pColor, borderRadius: 2 }} />
        </div>

        {/* Upcoming hours */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(upcomingHours ?? []).slice(0, 4).map((h) => (
            <div key={h.time} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#777" }}>
              <span style={{ color: "#aaa", width: 16 }}>{PLANET_ICONS[h.planet] ?? "○"}</span>
              <span style={{ flex: 1 }}>{h.planet}</span>
              <span>{h.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Personal transits */}
      {now.personalTransits && now.personalTransits.length > 0 && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #d8d3cd" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6 }}>Your transits</div>
          {now.personalTransits.slice(0, 3).map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 0", fontSize: 10, color: "#555" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.exact ? "#e0a040" : "#c0c0c0", flexShrink: 0 }} />
              <span>{t.summary}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
