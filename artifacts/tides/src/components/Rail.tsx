import React, { useState, useCallback } from "react";
import { Skeleton } from "@/components/Skeleton";
import { HelpBadge, Tooltip } from "@/components/Tooltip";
import { usePreferences } from "@/contexts/preferences-context";
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

const PLANET_SIGNIFICATION: Record<string, string> = {
  Sun: "Visibility, leadership, vitality. Good for presenting yourself, making decisions, and creative assertion.",
  Moon: "Nourishment, care, routine. Tend to home, body, and emotional space.",
  Mercury: "Communication, ideas, movement. Write, pitch, learn, travel.",
  Venus: "Beauty, pleasure, connection. Relationship, art, sensory enjoyment.",
  Mars: "Action, ignition, assertion. Physical work, bold starts, decisive moves.",
  Jupiter: "Expansion, abundance, generosity. Think big, share widely, grow.",
  Saturn: "Structure, focus, consolidation. Slow down, commit, build foundations.",
};

const ARCHETYPE_QUALITY: Record<string, string> = {
  Sun: "high · visibility",
  Moon: "reflective · intuitive",
  Mercury: "sharp · communicative",
  Venus: "gentle · connective",
  Mars: "active · assertive",
  Jupiter: "expansive · optimistic",
  Saturn: "grounding · disciplined",
};

export default function Rail({ now }: { now: TidesNow | undefined }) {
  const { prefs } = usePreferences();
  const { railSections } = prefs.display;
  const { watchPlanets } = prefs.timing;
  const [showNonMoonAspects, setShowNonMoonAspects] = useState(false);
  const [expandedHour, setExpandedHour] = useState<string | null>(null);
  const toggleHour = useCallback((key: string) => setExpandedHour(v => v === key ? null : key), []);
  if (!now) {
    return (
      <aside style={{ width: 210, minWidth: 210, background: "#e8e4de", borderRight: "1px solid #d0cbc3", display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #d0cbc3" }}>
          <Skeleton width={60} height={16} style={{ marginBottom: 6 }} />
          <Skeleton width={100} height={10} />
        </div>
        {[80, 100, 60, 80].map((h, i) => (
          <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #d8d3cd", display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton width={50} height={9} />
            <Skeleton width="90%" height={h === 80 ? 34 : 12} borderRadius={h === 80 ? 17 : 4} />
            {h > 60 && <Skeleton width="70%" height={10} />}
          </div>
        ))}
      </aside>
    );
  }

  const { planetaryHour, upcomingHours, moonSign, moonPhase, moonIllumination, element } = now;
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
      {railSections.includes("moon") && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #d8d3cd" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6, display: "flex", alignItems: "center" }}>Moon<HelpBadge term="moonPhase"/></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: "radial-gradient(circle at 60% 40%, #e8e0d0, #9a9080)",
            }} />
            <div>
              <div style={{ fontWeight: 600 }}>{moonPhase?.replace(/_/g, " ")}</div>
              <div style={{ color: "#777", marginTop: 1 }}>{Math.round((moonIllumination ?? 0) * 100)}% · {moonSign}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: `${elemColor}22`, color: elemColor }}>
              {element?.element}
            </span>
            {now.qualityScore && (
              <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: "#d8e8d0", color: "#3a6030" }}>
                {now.quality} · {now.qualityScore}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Moon Aspects */}
      {railSections.includes("aspects") && now.moonAspects && now.moonAspects.length > 0 && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #d8d3cd" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6, display: "flex", alignItems: "center" }}>Moon aspects<HelpBadge term="moonAspects"/></div>
          {now.moonAspects.slice(0, 5).map((a, i) => {
            const other = a.planet1 === "Moon" ? a.planet2 : a.planet1;
            const aspSym: Record<string,string> = { conjunction:"☌", opposition:"☍", square:"□", trine:"△", sextile:"⚹" };
            const aspColor: Record<string,string> = { conjunction:"#f0b060", opposition:"#e06060", square:"#e06060", trine:"#60a060", sextile:"#6090d0" };
            const sym = aspSym[a.aspect] ?? a.aspect;
            const col = aspColor[a.aspect] ?? "#888";
            const pCol = planetColor(other);
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 0", borderBottom: i < now.moonAspects!.length-1 ? "1px solid #e8e4de" : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}>
                  <span style={{ fontSize:11, color:"#7080a0" }}>☽</span>
                  <span style={{ color:col, fontWeight:700, fontSize:12 }}>{sym}</span>
                  <span style={{ color:pCol, fontWeight:600 }}>{PLANET_ICONS[other] ?? other[0]}</span>
                  <span style={{ color:"#555", fontSize:10 }}>{other}</span>
                </div>
                <div style={{ fontSize:9 }}>
                  {a.orb < 0.5
                    ? <span style={{ fontSize:8, background:"#f0e8d8", color:"#b07030", padding:"1px 4px", borderRadius:3, fontWeight:600 }}>exact now</span>
                    : a.applying
                      ? (() => {
                          const hrsToExact = a.orb / 0.55;
                          const now_ = new Date();
                          const exactAt = new Date(now_.getTime() + hrsToExact * 3600 * 1000);
                          const hh = exactAt.getHours().toString().padStart(2,"0");
                          const mm = exactAt.getMinutes().toString().padStart(2,"0");
                          return <span style={{ color: col, fontWeight:500 }}>→ {hh}:{mm}</span>;
                        })()
                      : <span style={{ color:"#ccc" }}>{a.orb.toFixed(1)}° past</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Retrogrades */}
      {railSections.includes("retrogrades") && now.retrogrades && now.retrogrades.length > 0 && (
        <div style={{ padding: "6px 14px", borderBottom: "1px solid #d8d3cd" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize:9, color:"#b07030" }}>℞ {now.retrogrades.join(", ")} retrograde</span>
            <Tooltip content={
              <div>
                <div style={{ fontWeight:600, marginBottom:5, color:"#fff" }}>Retrograde Planets</div>
                <div style={{ color:"#b0aaa4", fontSize:10.5, lineHeight:1.55 }}>
                  {now.retrogrades.map(p => {
                    const notes: Record<string,string> = {
                      Mercury: "Mercury retrograde affects communication, contracts, travel, and technology. Re-read, revise, and revisit rather than launch.",
                      Venus: "Venus retrograde affects relationships, finances, and aesthetics. Revisit rather than initiate new connections or purchases.",
                      Mars: "Mars retrograde affects decisive action and assertion. Redirect energy inward; avoid forcing outcomes.",
                      Jupiter: "Jupiter retrograde is a time for inner growth and philosophical review — expansion happens internally.",
                      Saturn: "Saturn retrograde calls for reassessing commitments, structures, and responsibilities.",
                      Uranus: "Uranus retrograde turns disruption inward — personal breakthroughs and course corrections.",
                      Neptune: "Neptune retrograde heightens clarity through illusion — a good time to review ideals and creative projects.",
                      Pluto: "Pluto retrograde intensifies inner transformation. Deep review of power dynamics and hidden patterns.",
                    };
                    return <div key={p} style={{ marginBottom:5 }}><strong style={{ color:"#e8e4de" }}>{p}:</strong> {notes[p] ?? `${p} retrograde — revisit and review rather than initiate.`}</div>;
                  })}
                </div>
              </div>
            } width={280}>
              <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:14, height:14, borderRadius:"50%", fontSize:8.5, fontWeight:600, background:"#d8d2ca", color:"#888", cursor:"help", marginLeft:4, flexShrink:0 }}>?</span>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Planetary Hour */}
      {railSections.includes("hour") && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #d8d3cd" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6, display: "flex", alignItems: "center" }}>Planetary hour<HelpBadge term="planetaryHour"/></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14, flexShrink: 0,
              background: `${pColor}22`, color: pColor,
              outline: watchPlanets.includes(planetaryHour.planet) ? `2px solid ${pColor}` : "none",
            }}>
              {PLANET_ICONS[planetaryHour.planet] ?? "○"}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{planetaryHour.planet}</div>
              <div style={{ fontSize: 9, color: "#888" }}>{planetaryHour.archetype ?? planetaryHour.quality}</div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: "#bbb", display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span>{planetaryHour.began}</span><span>{planetaryHour.ends}</span>
          </div>
          <div style={{ height: 3, background: "#d0cbc3", borderRadius: 2, marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pColor, borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {(upcomingHours ?? []).slice(0, 5).map((h) => {
              const hCol = planetColor(h.planet);
              const isWatched = watchPlanets.includes(h.planet);
              const key = h.time;
              const isExpanded = expandedHour === key;
              return (
                <div key={key}>
                  <button
                    onClick={() => toggleHour(key)}
                    style={{
                      display: "flex", alignItems: "center", width: "100%", gap: 6,
                      background: isExpanded ? `${hCol}14` : "transparent",
                      border: "none", borderRadius: 5, padding: "4px 4px", cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 11, color: hCol, width: 14, textAlign: "center", flexShrink: 0 }}>
                      {PLANET_ICONS[h.planet] ?? "○"}
                    </span>
                    <span style={{ flex: 1, fontSize: 10, color: isWatched ? "#222" : "#777", fontWeight: isWatched ? 600 : 400, textAlign: "left" }}>
                      {h.planet}
                    </span>
                    <span style={{ fontSize: 9, color: isWatched ? hCol : "#aaa", fontWeight: isWatched ? 600 : 400 }}>{h.time}</span>
                    <span style={{ fontSize: 7, color: "#ccc" }}>{isExpanded ? "▲" : "▾"}</span>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: "4px 8px 6px 24px", fontSize: 9, color: "#888", lineHeight: 1.45, borderLeft: `2px solid ${hCol}40`, marginLeft: 11, marginBottom: 2 }}>
                      {PLANET_SIGNIFICATION[h.planet] ?? `${h.planet} hour.`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-moon aspects — expand toggle */}
      {railSections.includes("aspects") && now.aspects && now.aspects.filter(a => a.planet1 !== "Moon" && a.planet2 !== "Moon").length > 0 && (
        <div style={{ padding: "8px 14px", borderBottom: "1px solid #d8d3cd" }}>
          <button onClick={() => setShowNonMoonAspects(v => !v)} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
            background:"none", border:"none", cursor:"pointer", padding:0,
          }}>
            <span style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.7px", color:"#aaa" }}>
              Planetary aspects
            </span>
            <span style={{ fontSize:8, color:"#c8b870", fontWeight:600, background:"#faf5e8", padding:"1px 5px", borderRadius:4, border:"1px solid #e8d890" }}>
              {showNonMoonAspects ? "▲ hide" : `${now.aspects.filter(a => a.planet1 !== "Moon" && a.planet2 !== "Moon").length} ▼`}
            </span>
          </button>
          {showNonMoonAspects && (() => {
            const aspSym: Record<string,string> = { conjunction:"☌", opposition:"☍", square:"□", trine:"△", sextile:"⚹" };
            const aspColor: Record<string,string> = { conjunction:"#f0b060", opposition:"#e06060", square:"#e06060", trine:"#60a060", sextile:"#6090d0" };
            const nonMoon = now.aspects!.filter(a => a.planet1 !== "Moon" && a.planet2 !== "Moon").slice(0, 8);
            return (
              <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:3 }}>
                {nonMoon.map((a, i) => {
                  const sym = aspSym[a.aspect] ?? a.aspect;
                  const col = aspColor[a.aspect] ?? "#888";
                  const p1c = planetColor(a.planet1), p2c = planetColor(a.planet2);
                  const qualLabel: Record<string,string> = { trine:"harmonious", sextile:"supportive", conjunction:"amplified", square:"friction", opposition:"tension" };
                  return (
                    <div key={i} style={{ padding:"4px 0", borderBottom: i < nonMoon.length-1 ? "1px solid #e8e4de" : "none" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10 }}>
                        <span style={{ color:p1c, fontWeight:700, fontSize:12 }}>{PLANET_ICONS[a.planet1] ?? a.planet1[0]}</span>
                        <span style={{ color:col, fontWeight:700, fontSize:13 }}>{sym}</span>
                        <span style={{ color:p2c, fontWeight:700, fontSize:12 }}>{PLANET_ICONS[a.planet2] ?? a.planet2[0]}</span>
                        <span style={{ flex:1, fontSize:9, color:"#777" }}>{a.planet1} · {a.planet2}</span>
                        <span style={{ fontSize:8, color: a.applying ? col : "#ccc", flexShrink:0, fontWeight: a.applying ? 600 : 400 }}>
                          {a.orb.toFixed(1)}°{a.applying ? " →" : "←"}
                        </span>
                      </div>
                      {qualLabel[a.aspect] && (
                        <div style={{ fontSize:8, color:"#bbb", paddingLeft:2, marginTop:1 }}>{qualLabel[a.aspect]} · {a.nature ?? (["trine","sextile"].includes(a.aspect) ? "harmonious" : "challenging")}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Personal transits */}
      {railSections.includes("transits") && now.personalTransits && now.personalTransits.length > 0 && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #d8d3cd" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6, display: "flex", alignItems: "center" }}>Your transits<HelpBadge term="angleCrossing"/></div>
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
