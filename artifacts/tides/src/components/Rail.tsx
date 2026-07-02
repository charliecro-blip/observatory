import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

const ASPECT_MEANINGS: Record<string, { name: string; nature: string; desc: string }> = {
  conjunction: { name:"Conjunction ☌", nature:"Amplifying", desc:"The two planets merge energies — their themes intensify and blend. Effects depend on the planets involved." },
  trine:       { name:"Trine △", nature:"Harmonious", desc:"120° apart — energy flows easily and supportively between these planetary themes. A natural, gifting aspect." },
  sextile:     { name:"Sextile ⚹", nature:"Supportive", desc:"60° apart — a gentle, helpful connection. Opportunities and ease, though less effortless than a trine." },
  square:      { name:"Square □", nature:"Tension", desc:"90° apart — friction and challenge between these themes. Productive tension if channeled; frustration if resisted." },
  opposition:  { name:"Opposition ☍", nature:"Polarity", desc:"180° apart — polarization between two themes. Integration and balance are needed; others may mirror this tension." },
};

const PLANET_MEANING: Record<string, string> = {
  Sun:     "Core identity, vitality, authority, creative expression",
  Moon:    "Emotions, intuition, instinct, the body's wisdom",
  Mercury: "Mind, communication, movement, craft, perception",
  Venus:   "Beauty, values, pleasure, relationship, aesthetics",
  Mars:    "Drive, assertion, courage, desire, physical force",
  Jupiter: "Expansion, meaning, abundance, generosity, philosophy",
  Saturn:  "Structure, discipline, time, responsibility, limits",
  Uranus:  "Liberation, disruption, innovation, awakening",
  Neptune: "Imagination, dissolution, spirituality, the subtle",
  Pluto:   "Transformation, power, depth, endings, regeneration",
};

// Approximate sunrise/sunset for the Rail (mirrors Today.tsx logic)
function railSunTimes(lat: number, lon: number): { sunrise: Date; sunset: Date; solarNoon: Date } | null {
  const today = new Date().toISOString().slice(0, 10);
  // lstNoon below is expressed in UTC hours, so the base these offsets are added
  // to must also be UTC midnight — otherwise sun times are shifted by the local
  // timezone offset (e.g. solar noon rendering as ~5pm instead of ~1pm).
  const midnight = new Date(today + "T00:00:00Z");
  const base = new Date(today + "T12:00:00Z");
  const jd = base.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * Math.PI / 180;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  const sinDec = Math.sin(23.439 * Math.PI / 180) * Math.sin(lambda);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat * Math.PI / 180) * sinDec) /
               (Math.cos(lat * Math.PI / 180) * cosDec);
  if (Math.abs(cosH) > 1) return null;
  const H = Math.acos(cosH) * 180 / Math.PI;
  const B = (360 / 365) * (n - 81) * Math.PI / 180;
  const EqT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const lstNoon = 12 - lon / 15 - EqT / 60;
  return {
    sunrise: new Date(midnight.getTime() + (lstNoon - H / 15) * 3600000),
    sunset:  new Date(midnight.getTime() + (lstNoon + H / 15) * 3600000),
    solarNoon: new Date(midnight.getTime() + lstNoon * 3600000),
  };
}

function SunArc({ lat, lon }: { lat: number; lon: number }) {
  const sun = railSunTimes(lat, lon);
  if (!sun) return null;

  const now = new Date();
  const midnight = new Date(now.toISOString().slice(0, 10) + "T00:00:00");
  const totalMs = 24 * 3600000;
  const srPct = (sun.sunrise.getTime() - midnight.getTime()) / totalMs * 100;
  const ssPct = (sun.sunset.getTime() - midnight.getTime()) / totalMs * 100;
  const snPct = (sun.solarNoon.getTime() - midnight.getTime()) / totalMs * 100;
  const nowPct = Math.min(100, Math.max(0, (now.getTime() - midnight.getTime()) / totalMs * 100));

  const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const isDay = now > sun.sunrise && now < sun.sunset;

  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.5px", color: "#bbb", marginBottom: 6 }}>Daylight · sun {isDay ? "up" : "down"}</div>

      {/* Arc bar */}
      <div style={{ position: "relative", height: 20, marginBottom: 5 }}>
        {/* Night background */}
        <div style={{ position: "absolute", inset: "6px 0", borderRadius: 4, background: "#1a2a3a20" }} />
        {/* Day portion */}
        <div style={{
          position: "absolute", top: 4, bottom: 4, borderRadius: 3,
          left: `${srPct}%`, width: `${ssPct - srPct}%`,
          background: "linear-gradient(to right, #f0c060, #f0e080, #f0c060)",
          opacity: 0.85,
        }} />
        {/* Solar noon tick */}
        <div style={{ position: "absolute", top: 2, bottom: 2, left: `${snPct}%`, width: 1.5, background: "#e09020", opacity: 0.6 }} />
        {/* Now indicator */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `${nowPct}%`,
          width: 3, borderRadius: 2,
          background: isDay ? "#c07010" : "#3a4a5a",
          transform: "translateX(-50%)",
          boxShadow: isDay ? "0 0 4px #f0a030" : "none",
        }} />
      </div>

      {/* Labels row */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#aaa" }}>
        <div>☀ {fmt(sun.sunrise)}</div>
        <div style={{ color: "#c08020", fontSize: 8 }}>noon {fmt(sun.solarNoon)}</div>
        <div>{fmt(sun.sunset)} ☽</div>
      </div>

      {/* Day length */}
      <div style={{ fontSize: 8, color: "#ccc", marginTop: 3, textAlign: "center" }}>
        {(() => {
          const h = (sun.sunset.getTime() - sun.sunrise.getTime()) / 3600000;
          return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m daylight`;
        })()}
      </div>
    </div>
  );
}

export default function Rail({ now, testerId, lat = 40.7, lon = -74.0 }: { now: TidesNow | undefined; testerId: string | null; lat?: number; lon?: number }) {
  const { prefs } = usePreferences();
  const { railSections } = prefs.display;
  const { watchPlanets } = prefs.timing;
  const [showNonMoonAspects, setShowNonMoonAspects] = useState(false);
  const [expandedHour, setExpandedHour] = useState<string | null>(null);
  const [wavesOpen, setWavesOpen] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ["tasks-today", testerId, today],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?date=${today}`, { headers: testerId ? {"x-tester-id": testerId} : {} });
      return r.json();
    },
    enabled: !!testerId,
    refetchInterval: 30_000,
  });

  const { data: goals = [] } = useQuery<any[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals", { headers: testerId ? {"x-tester-id": testerId} : {} });
      return r.json();
    },
    enabled: !!testerId,
  });

  const { data: practicesData } = useQuery<any>({
    queryKey: ["practices", testerId],
    queryFn: async () => {
      const r = await fetch("/api/practices", { headers: testerId ? {"x-tester-id": testerId} : {} });
      return r.json();
    },
    enabled: !!testerId,
  });

  const toggleTask = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ done: "true" }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks-today"] }),
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueDate: today }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks-today"] }); setNewTaskTitle(""); setShowAddTask(false); },
  });
  const [expandedAspect, setExpandedAspect] = useState<number | null>(null);
  const [expandedNonMoon, setExpandedNonMoon] = useState<number | null>(null);
  const toggleHour = useCallback((key: string) => setExpandedHour(v => v === key ? null : key), []);
  const toggleAspect = useCallback((i: number) => setExpandedAspect(v => v === i ? null : i), []);
  const toggleNonMoon = useCallback((i: number) => setExpandedNonMoon(v => v === i ? null : i), []);
  if (!now) {
    return (
      <aside style={{ width: 210, minWidth: 210, background: "#e8e4de", borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--color-border)" }}>
          <Skeleton width={60} height={16} style={{ marginBottom: 6 }} />
          <Skeleton width={100} height={10} />
        </div>
        {[80, 100, 60, 80].map((h, i) => (
          <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 6 }}>
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
      width: 210, minWidth: 210, background: "#e8e4de",
      display: "flex", flexDirection: "column", overflowY: "auto", fontSize: 12,
      flex: 1, minHeight: 0,
    }}>
      {/* Header */}
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#c8b89a" }} />
          Tides
        </div>
        <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Sun arc — hidden for now; kept as a backend/optional element.
          Re-enable by rendering <SunArc lat={lat} lon={lon} /> here. */}

      {/* Moon */}
      {railSections.includes("moon") && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
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
            {now.tide ? (
              <span title="Today's tide — character (energy type) and level (how charged, which way it's moving)"
                style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: `${elemColor}22`, color: elemColor, fontWeight: 600 }}>
                {now.tide.headline} · {now.tide.levelLabel}
              </span>
            ) : (
              <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: `${elemColor}22`, color: elemColor }}>
                {element?.element}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Moon Aspects */}
      {railSections.includes("aspects") && now.moonAspects && now.moonAspects.length > 0 && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6, display: "flex", alignItems: "center" }}>Moon aspects<HelpBadge term="moonAspects"/></div>
          {now.moonAspects.slice(0, 5).map((a, i) => {
            const other = a.planet1 === "Moon" ? a.planet2 : a.planet1;
            const aspSym: Record<string,string> = { conjunction:"☌", opposition:"☍", square:"□", trine:"△", sextile:"⚹" };
            const aspColor: Record<string,string> = { conjunction:"#f0b060", opposition:"#e06060", square:"#e06060", trine:"#60a060", sextile:"#6090d0" };
            const sym = aspSym[a.aspect] ?? a.aspect;
            const col = aspColor[a.aspect] ?? "#888";
            const pCol = planetColor(other);
            const isExpanded = expandedAspect === i;
            const aspMeaning = ASPECT_MEANINGS[a.aspect];
            return (
              <div key={i} style={{ borderBottom: i < now.moonAspects!.length-1 ? "1px solid var(--color-border)" : "none" }}>
                <button onClick={() => toggleAspect(i)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", width:"100%", background:"none", border:"none", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}>
                    <span style={{ fontSize:11, color:"#7080a0" }}>☽</span>
                    <span style={{ color:col, fontWeight:700, fontSize:12 }}>{sym}</span>
                    <span style={{ color:pCol, fontWeight:600 }}>{PLANET_ICONS[other] ?? other[0]}</span>
                    <span style={{ color:"#555", fontSize:10 }}>{other}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ fontSize:9 }}>
                      {a.orb < 0.5
                        ? <span style={{ fontSize:8, background:"#f0e8d8", color:"#b07030", padding:"1px 4px", borderRadius:3, fontWeight:600 }}>exact now</span>
                        : a.applying
                          ? (() => {
                              // Use the backend's real per-pair closing speed so this
                              // matches the Planetary Pulse exact time for the same aspect.
                              // Fall back to the Moon's average speed only if unavailable.
                              const hrsToExact = a.hoursToExact ?? a.orb / 0.55;
                              const now_ = new Date();
                              const exactAt = new Date(now_.getTime() + hrsToExact * 3600 * 1000);
                              const hh = exactAt.getHours().toString().padStart(2,"0");
                              const mm = exactAt.getMinutes().toString().padStart(2,"0");
                              return <span style={{ color:col, fontWeight:500 }}>→ {hh}:{mm}</span>;
                            })()
                          : <span style={{ color:"#ccc" }}>{a.orb.toFixed(1)}° past</span>
                      }
                    </div>
                    <span style={{ fontSize:8, color: isExpanded ? col : "#ccc", transition:"transform 0.15s", display:"inline-block", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</span>
                  </div>
                </button>
                {isExpanded && aspMeaning && (
                  <div style={{ padding:"4px 6px 8px 14px", fontSize:9, color:"#888", lineHeight:1.55, borderLeft:`2px solid ${col}60`, background:`${col}08`, marginBottom:3, borderRadius:"0 0 4px 4px" }}>
                    <div style={{ fontWeight:600, color:col, marginBottom:2 }}>{aspMeaning.name} · {aspMeaning.nature}</div>
                    <div style={{ marginBottom:3 }}>{aspMeaning.desc}</div>
                    {PLANET_MEANING[other] && (
                      <div style={{ color:"#aaa" }}><strong style={{ color:pCol }}>{other}:</strong> {PLANET_MEANING[other]}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Retrogrades */}
      {railSections.includes("retrogrades") && now.retrogrades && now.retrogrades.length > 0 && (
        <div style={{ padding: "6px 14px", borderBottom: "1px solid var(--color-border)" }}>
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
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
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
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--color-border)" }}>
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
              <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:0 }}>
                {nonMoon.map((a, i) => {
                  const sym = aspSym[a.aspect] ?? a.aspect;
                  const col = aspColor[a.aspect] ?? "#888";
                  const p1c = planetColor(a.planet1), p2c = planetColor(a.planet2);
                  const aspMeaning = ASPECT_MEANINGS[a.aspect];
                  const isExp = expandedNonMoon === i;
                  return (
                    <div key={i} style={{ borderBottom: i < nonMoon.length-1 ? "1px solid var(--color-border)" : "none" }}>
                      <button onClick={() => toggleNonMoon(i)} style={{ display:"flex", alignItems:"center", gap:4, width:"100%", background:"none", border:"none", cursor:"pointer", padding:"5px 0" }}>
                        <span style={{ color:p1c, fontWeight:700, fontSize:12 }}>{PLANET_ICONS[a.planet1] ?? a.planet1[0]}</span>
                        <span style={{ color:col, fontWeight:700, fontSize:13 }}>{sym}</span>
                        <span style={{ color:p2c, fontWeight:700, fontSize:12 }}>{PLANET_ICONS[a.planet2] ?? a.planet2[0]}</span>
                        <span style={{ flex:1, fontSize:9, color:"#777", textAlign:"left" }}>{a.planet1} · {a.planet2}</span>
                        <span style={{ fontSize:8, color:a.applying?col:"#ccc", fontWeight:a.applying?600:400 }}>
                          {a.orb.toFixed(1)}°{a.applying?" →":"←"}
                        </span>
                        <span style={{ fontSize:8, color: isExp ? col : "#ccc", transition:"transform 0.15s", display:"inline-block", transform: isExp ? "rotate(180deg)" : "none", marginLeft:3 }}>▾</span>
                      </button>
                      {isExp && aspMeaning && (
                        <div style={{ padding:"4px 6px 8px 14px", fontSize:9, color:"#888", lineHeight:1.55, borderLeft:`2px solid ${col}60`, background:`${col}08`, marginBottom:3, borderRadius:"0 0 4px 4px" }}>
                          <div style={{ fontWeight:600, color:col, marginBottom:2 }}>{aspMeaning.name} · {aspMeaning.nature}</div>
                          <div style={{ marginBottom:3 }}>{aspMeaning.desc}</div>
                          <div style={{ color:"#aaa" }}>
                            <strong style={{ color:p1c }}>{a.planet1}:</strong> {PLANET_MEANING[a.planet1] ?? ""}
                          </div>
                          <div style={{ color:"#aaa", marginTop:1 }}>
                            <strong style={{ color:p2c }}>{a.planet2}:</strong> {PLANET_MEANING[a.planet2] ?? ""}
                          </div>
                        </div>
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
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6, display: "flex", alignItems: "center" }}>Your transits<HelpBadge term="angleCrossing"/></div>
          {now.personalTransits.slice(0, 3).map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 0", fontSize: 10, color: "#555" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.exact ? "#e0a040" : "#c0c0c0", flexShrink: 0 }} />
              <span>{t.summary}</span>
            </div>
          ))}
        </div>
      )}
      {/* Waves — habits / tasks / goals */}
      <div style={{ borderTop: "1px solid var(--color-border)" }}>
        <button onClick={() => setWavesOpen(v => !v)} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px", width: "100%", background: "none", border: "none",
          cursor: "pointer", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px",
          color: "#aaa",
        }}>
          <span>Waves</span>
          <span style={{ fontSize: 8, transform: wavesOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▾</span>
        </button>

        {wavesOpen && (
          <div style={{ paddingBottom: 8 }}>
            {/* Resonant practices */}
            {(practicesData?.practices ?? []).filter((p: any) => p.timing === "resonant").slice(0, 3).map((p: any) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "5px 14px",
                borderLeft: "3px solid #60a060", background: "#f8fff8",
              }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a060", flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: "#2a5020", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  {p.reasons?.[0] && <div style={{ fontSize: 8, color: "#aaa", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.reasons[0]}</div>}
                </div>
              </div>
            ))}

            {/* Tasks */}
            {(tasks as any[]).filter(t => t.done !== "true").slice(0, 6).map((t: any) => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "5px 14px",
                borderLeft: "3px solid #b0b0c0",
              }}>
                <button onClick={() => toggleTask.mutate(t.id)} style={{
                  width: 13, height: 13, borderRadius: 3, border: "1.5px solid #b0b0c0",
                  background: "transparent", flexShrink: 0, cursor: "pointer", padding: 0,
                }}/>
                <div style={{ fontSize: 10.5, color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
              </div>
            ))}

            {/* Goals */}
            {(goals as any[]).slice(0, 3).map((g: any) => (
              <div key={g.id} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "5px 14px",
                borderLeft: "3px solid #a060c0",
              }}>
                <div style={{ width: 5, height: 5, borderRadius: 1, background: "#a060c0", flexShrink: 0, transform: "rotate(45deg)" }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: "#602080", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</div>
                  {g.horizon && <div style={{ fontSize: 8, color: "#bbb" }}>{g.horizon}</div>}
                </div>
              </div>
            ))}

            {/* Add task inline */}
            {showAddTask ? (
              <div style={{ padding: "5px 14px", display: "flex", gap: 4 }}>
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newTaskTitle.trim()) addTask.mutate(newTaskTitle.trim());
                    if (e.key === "Escape") { setShowAddTask(false); setNewTaskTitle(""); }
                  }}
                  placeholder="Add task…"
                  style={{ flex: 1, padding: "4px 7px", borderRadius: 5, border: "1px solid var(--color-border)", fontSize: 10.5, outline: "none", background: "var(--color-card-2)" }}
                />
              </div>
            ) : (
              <button onClick={() => setShowAddTask(true)} style={{
                display: "block", width: "100%", textAlign: "left", padding: "5px 14px",
                background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#bbb",
              }}>
                + task
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
