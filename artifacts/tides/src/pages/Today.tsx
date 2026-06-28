import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTidesNow, useTidesWeek, usePractices, useTodayWindows } from "@/hooks/useTides";
import type { Goal } from "@/lib/types";

const ELEMENT_COLORS: Record<string, string> = {
  water: "#3a5a80", fire: "#8a3a20", earth: "#3a6030", air: "#602080",
};

const QUALITY_COLORS: Record<string, string> = {
  good: "#60a060", supported: "#60a060", challenging: "#c04040", caution: "#d0a040", neutral: "#888",
};

const WINDOW_COLORS: Record<string, string> = {
  deep_work: "#3a7aaa", creative: "#9060b0", planning: "#c08040", admin: "#888",
  social: "#d06060", relationship: "#b04080", recovery: "#60a080", retreat: "#6080a0",
  launch: "#c04040", study: "#5060a0",
};

function heroText(now: any): string {
  const el = now?.element?.element ?? "water";
  const q = now?.quality ?? "supported";
  const bio = now?.biodynamicType ?? "";
  const map: Record<string, Record<string, string>> = {
    water: {
      good: "Deep, still water — ideal for absorption and focus.",
      supported: "High, slow water — good for deep, absorbing work.",
      challenging: "Turbulent water — move carefully, attend to feelings.",
      caution: "Shifting tides — steady, methodical work holds.",
      neutral: "Calm water — a good moment for reflection.",
    },
    fire: {
      good: "Bright fire — driven, visible action flourishes.",
      supported: "Warm fire — energy is available, use it boldly.",
      challenging: "Harsh fire — tempers run high, choose words carefully.",
      caution: "Flickering fire — ambition is present but scattered.",
      neutral: "Steady fire — good for sustained creative effort.",
    },
    earth: {
      good: "Rich earth — grounded, patient work yields results.",
      supported: "Stable earth — a good moment for structure and planning.",
      challenging: "Heavy earth — progress is slow, persistence wins.",
      caution: "Shifting ground — tend to foundations before expanding.",
      neutral: "Firm earth — reliable conditions for methodical work.",
    },
    air: {
      good: "Clear air — communication and ideas flow well.",
      supported: "Moving air — connection and outreach are favored.",
      challenging: "Gusty air — scattered attention, anchor before acting.",
      caution: "Thin air — ideas surface easily but may not stick.",
      neutral: "Still air — good for writing, editing, thinking.",
    },
  };
  return map[el]?.[q] ?? map[el]?.["neutral"] ?? "A moment worth inhabiting.";
}

export default function Today({ testerId }: { testerId: string | null }) {
  const today = new Date().toISOString().slice(0, 10);
  const [crossingsOn, setCrossingsOn] = useState(true);
  const [activeTab, setActiveTab] = useState<"habits" | "tasks" | "goals">("habits");

  const { data: now } = useTidesNow(testerId);
  const { data: week } = useTidesWeek();
  const { data: practicesData } = usePractices(testerId);
  const { data: windows } = useTodayWindows(testerId, today);

  const { data: goals } = useQuery<Goal[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals", { headers: testerId ? { "x-tester-id": testerId } : {} });
      return r.json();
    },
    enabled: !!testerId,
  });

  const practices = practicesData?.practices ?? [];
  const resonant = practices.filter(p => p.timing === "resonant");
  const supported = practices.filter(p => p.timing === "supported");
  const soften = practices.filter(p => p.timing === "soften" || p.timing === "protect");

  const el = now?.element?.element ?? "water";
  const elemColor = ELEMENT_COLORS[el] ?? "#888";
  const qColor = QUALITY_COLORS[now?.quality ?? "neutral"] ?? "#888";

  // Find next angle crossing from week data
  const todayData = week?.days?.find(d => d.date === today);
  const nextCrossing = todayData?.crossings?.[0];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Topbar */}
      <div style={{
        padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #d0cbc3", background: "#ece8e2", flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {new Date().toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: `${elemColor}20`, color: elemColor, border: `1px solid ${elemColor}40` }}>
            {el} · {now?.biodynamicType} · {now?.quality}
          </div>
          <button
            onClick={() => setCrossingsOn(v => !v)}
            style={{
              fontSize: 9, padding: "3px 8px", borderRadius: 8, border: "1px solid #d0cbc3",
              background: crossingsOn ? "#fff8f0" : "#f0ede8", color: crossingsOn ? "#b07020" : "#aaa",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: crossingsOn ? "#e0a040" : "#ccc", display: "inline-block" }} />
            Crossings {crossingsOn ? "on" : "off"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Hero card */}
        <div style={{
          background: `linear-gradient(135deg, ${elemColor}18, ${elemColor}08)`,
          border: `1px solid ${elemColor}30`, borderRadius: 12, padding: "18px 22px", position: "relative",
        }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: elemColor, marginBottom: 8 }}>
            Right now · {now?.planetaryHour?.planet} hour · {el} day
          </div>
          <div style={{ fontSize: 22, fontWeight: 400, lineHeight: 1.35, color: "#1a2a3a", fontFamily: "Georgia, serif", maxWidth: 380 }}>
            {heroText(now)}
          </div>
          {/* Moon glyph */}
          <div style={{
            position: "absolute", right: 20, top: 18, width: 64, height: 64, borderRadius: "50%",
            background: "radial-gradient(circle at 60% 40%, #e8e0d0, #9a9080)", opacity: 0.65,
          }} />
          <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
            {[
              { dot: elemColor, text: `${now?.moonSign} · ${el}` },
              { dot: qColor, text: `${now?.quality} · ${now?.qualityScore ?? ""}` },
              now?.voc?.isVOC ? { dot: "#aaa", text: "Moon VOC" } : null,
            ].filter(Boolean).map((m: any, i) => (
              <div key={i} style={{ fontSize: 9, color: "#6090a0", display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot }} />
                {m.text}
              </div>
            ))}
          </div>
        </div>

        {/* Angle crossing alert */}
        {crossingsOn && nextCrossing && (
          <div style={{
            background: "#fff8f0", border: "1px solid #f0d8b0", borderLeft: "3px solid #e0a040",
            borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#8a5020" }}>
                {nextCrossing.planet} crosses {nextCrossing.angle} · {nextCrossing.time}
              </div>
              <div style={{ fontSize: 10, color: "#b07040", marginTop: 2 }}>
                Peak window for driven, angular action — schedule your highest-leverage work here.
              </div>
            </div>
            <div style={{ fontSize: 8, background: "#f0e0c0", color: "#a06020", padding: "2px 7px", borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
              {nextCrossing.angle}
            </div>
          </div>
        )}

        {/* Tide chart */}
        <div style={{ background: "#fff", border: "1px solid #d8d2ca", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>The tide</div>
            <div style={{ display: "flex", background: "#f0ede8", borderRadius: 5, padding: 2, gap: 1 }}>
              {["Day", "Week"].map(t => (
                <div key={t} style={{
                  fontSize: 10, padding: "3px 10px", borderRadius: 4,
                  background: t === "Day" ? "#fff" : "transparent",
                  color: t === "Day" ? "#333" : "#888", fontWeight: t === "Day" ? 500 : 400, cursor: "pointer",
                }}>{t}</div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 10 }}>
            {now?.momentLabel} · {now?.biodynamicType}
          </div>

          {/* SVG tide wave */}
          <svg width="100%" height="88" viewBox="0 0 600 88" style={{ display: "block" }}>
            <rect width="600" height="88" fill="#f8f6f2" rx="4"/>
            {/* VOC zone */}
            {now?.voc?.isVOC && <rect x="480" y="0" width="120" height="88" fill="#f5f0ea" opacity="0.8"/>}
            {/* Wave fill */}
            <path d="M0,55 C40,35 80,15 120,20 C160,25 190,50 220,46 C250,42 280,16 310,14 C340,12 365,28 390,33 C415,38 435,50 460,60 C485,70 520,76 560,79 L560,88 L0,88Z" fill={`${elemColor}30`}/>
            <path d="M0,55 C40,35 80,15 120,20 C160,25 190,50 220,46 C250,42 280,16 310,14 C340,12 365,28 390,33 C415,38 435,50 460,60 C485,70 520,76 560,79" stroke={elemColor} strokeWidth="1.5" fill="none"/>
            {/* Now marker */}
            <line x1="305" y1="0" x2="305" y2="88" stroke="#1a2a3a" strokeWidth="1" strokeDasharray="3,2"/>
            <circle cx="305" cy="14" r="3" fill="#1a2a3a"/>
            <text x="309" y="11" fontSize="7" fill="#1a2a3a" fontFamily="sans-serif">NOW</text>
            {/* Angle crossing spike */}
            {crossingsOn && nextCrossing && (
              <>
                <line x1="350" y1="0" x2="350" y2="88" stroke="#e0a040" strokeWidth="1.5"/>
                <polygon points="350,2 345,10 355,10" fill="#e0a040"/>
                <text x="354" y="12" fontSize="7" fill="#c08020" fontFamily="sans-serif">{nextCrossing.angle} {nextCrossing.time}</text>
              </>
            )}
            {/* Scheduled windows */}
            {(windows ?? []).map((w, i) => {
              const [sh, sm] = w.startTime.split(":").map(Number);
              const [eh, em] = w.endTime.split(":").map(Number);
              const startPct = ((sh - 6) * 60 + sm) / (18 * 60);
              const endPct = ((eh - 6) * 60 + em) / (18 * 60);
              const x = Math.max(0, startPct * 600);
              const w2 = Math.max(20, (endPct - startPct) * 600);
              const color = WINDOW_COLORS[w.type] ?? "#888";
              return (
                <g key={w.id}>
                  <rect x={x} y={58} width={w2} height={22} rx="3" fill={color} opacity="0.8"/>
                  <text x={x + w2 / 2} y={72} fontSize="7" fill="#fff" fontFamily="sans-serif" textAnchor="middle">{w.title}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#ccc", marginTop: 2 }}>
            {["6am","9am","12pm","3pm","6pm","9pm","12am"].map(t => <span key={t}>{t}</span>)}
          </div>
        </div>

        {/* Week strip */}
        <div style={{ background: "#fff", border: "1px solid #d8d2ca", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Week ahead</div>
          <div style={{ display: "flex", gap: 5 }}>
            {(week?.days ?? []).slice(0, 7).map(day => {
              const isToday = day.date === today;
              const ec = ELEMENT_COLORS[day.element ?? "water"] ?? "#888";
              const qc = QUALITY_COLORS[day.quality ?? "neutral"] ?? "#888";
              return (
                <div key={day.date} style={{
                  flex: 1, border: `1px solid ${isToday ? "#c0b090" : "#e8e4de"}`,
                  borderRadius: 8, padding: "6px 4px", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3, background: isToday ? "#faf6f0" : "transparent",
                }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", color: isToday ? "#b07030" : "#aaa", fontWeight: isToday ? 600 : 400 }}>
                    {day.label?.slice(0, 3)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isToday ? "#b07030" : "#444" }}>
                    {new Date(day.date + "T12:00:00").getDate()}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: qc }} />
                  <div style={{ fontSize: 8, color: ec }}>{day.element}</div>
                  {(day.crossings ?? []).length > 0 && (
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#e0a040" }} title="Angle crossing" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom tabs: Habits / Tasks / Goals */}
        <div style={{ background: "#fff", border: "1px solid #d8d2ca", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ display: "flex", gap: 2, marginBottom: 12, background: "#f0ede8", borderRadius: 6, padding: 2 }}>
            {(["habits", "tasks", "goals"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                flex: 1, padding: "5px 0", borderRadius: 5, fontSize: 11, border: "none", cursor: "pointer",
                background: activeTab === t ? "#fff" : "transparent",
                color: activeTab === t ? "#333" : "#888", fontWeight: activeTab === t ? 500 : 400,
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Habits */}
          {activeTab === "habits" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {resonant.length > 0 && (
                <div style={{ fontSize: 9, color: "#3a6020", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
                  ✦ Resonant now
                </div>
              )}
              {resonant.map(p => <PracticeRow key={p.id} practice={p} />)}
              {supported.length > 0 && (
                <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4, marginBottom: 2 }}>
                  Supported
                </div>
              )}
              {supported.map(p => <PracticeRow key={p.id} practice={p} />)}
              {soften.length > 0 && (
                <div style={{ fontSize: 9, color: "#c06020", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4, marginBottom: 2 }}>
                  Soften or skip
                </div>
              )}
              {soften.map(p => <PracticeRow key={p.id} practice={p} dim />)}
              {practices.length === 0 && (
                <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: "16px 0" }}>
                  Add practices in the Cultivator to see timing here.
                </div>
              )}
            </div>
          )}

          {/* Tasks placeholder */}
          {activeTab === "tasks" && (
            <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: "20px 0" }}>
              Native tasks coming soon.<br/>
              <span style={{ fontSize: 10 }}>Connect Todoist or Linear in the meantime.</span>
            </div>
          )}

          {/* Goals */}
          {activeTab === "goals" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(goals ?? []).map(g => (
                <div key={g.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
                  borderRadius: 8, border: "1px solid #e8e4de", background: "#faf8f5",
                }}>
                  <div style={{
                    fontSize: 8, padding: "2px 6px", borderRadius: 4, fontWeight: 600,
                    textTransform: "uppercase", flexShrink: 0, marginTop: 1,
                    background: g.horizon === "near" ? "#dbeafe" : g.horizon === "mid" ? "#f0e8d8" : "#e8d8f0",
                    color: g.horizon === "near" ? "#2a5a90" : g.horizon === "mid" ? "#8a5020" : "#602080",
                  }}>
                    {g.horizon}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#333" }}>{g.title}</div>
                </div>
              ))}
              {(goals ?? []).length === 0 && (
                <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: "16px 0" }}>
                  No goals yet. Add them in Planning.
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function PracticeRow({ practice, dim }: { practice: any; dim?: boolean }) {
  const timingColors: Record<string, string> = {
    resonant: "#2a6020", supported: "#3a5a80", soften: "#8a5020", protect: "#8a3020",
  };
  const timingBg: Record<string, string> = {
    resonant: "#d0f0c0", supported: "#d0e0f8", soften: "#f0e0c0", protect: "#f0d0c0",
  };
  const color = timingColors[practice.timing] ?? "#888";
  const bg = timingBg[practice.timing] ?? "#e8e4de";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
      borderRadius: 7, border: `1px solid ${practice.timing === "resonant" ? "#c0d8b0" : "#e8e4de"}`,
      background: practice.timing === "resonant" ? "#f0f8ec" : "#faf8f5",
      opacity: dim ? 0.65 : 1,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "#222" }}>{practice.name}</div>
        {practice.reasons?.[0] && (
          <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>{practice.reasons[0]}</div>
        )}
      </div>
      <div style={{ fontSize: 8, padding: "2px 6px", borderRadius: 4, background: bg, color, fontWeight: 600, flexShrink: 0 }}>
        {practice.timing}
      </div>
    </div>
  );
}
