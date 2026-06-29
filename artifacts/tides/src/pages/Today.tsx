import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTidesNow, useTidesWeek, usePractices, useTodayWindows, useTidesWindows } from "@/hooks/useTides";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { usePreferences } from "@/contexts/preferences-context";
import { Tooltip, HelpBadge } from "@/components/Tooltip";
import { SessionTimer } from "@/components/SessionTimer";
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

function journalKey(testerId: string | null, date: string) {
  return `tides-journal-${testerId ?? "anon"}-${date}`;
}

export default function Today({ testerId, lat = 40.7, lon = -74.0 }: { testerId: string | null; lat?: number; lon?: number }) {
  const qc = useQueryClient();
  const { prefs } = usePreferences();
  const { todayShowVOC, todayShowWave, todayShow14Day, todayShowJournal } = prefs.display;
  const today = new Date().toISOString().slice(0, 10);
  const [crossingsOn, setCrossingsOn] = useState(true);
  const [tideView, setTideView] = useState<"day" | "week">("day");
  const [activeTab, setActiveTab] = useState<"habits" | "tasks" | "goals">("habits");
  const [journalText, setJournalText] = useState("");
  const [journalSaved, setJournalSaved] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [waveHover, setWaveHover] = useState<{ x: number; y: number; hourIdx: number } | null>(null);
  const waveRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(journalKey(testerId, today));
    if (saved) setJournalText(saved);
  }, [testerId, today]);

  function saveJournal(text: string) {
    setJournalText(text);
    localStorage.setItem(journalKey(testerId, today), text);
    setJournalSaved(true);
    setTimeout(() => setJournalSaved(false), 1500);
  }

  const { data: now, isLoading: nowLoading } = useTidesNow(testerId, lat, lon);
  const { data: week } = useTidesWeek(14, lat, lon);
  const { data: practicesData } = usePractices(testerId, lat, lon);
  const { data: windows } = useTodayWindows(testerId, today);
  const { data: tidesWindowsData } = useTidesWindows(lat, lon);

  const { data: goals } = useQuery<Goal[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals", { headers: testerId ? { "x-tester-id": testerId } : {} });
      return r.json();
    },
    enabled: !!testerId,
  });

  interface SimpleTask { id: number; title: string; done: string; bestWindowType?: string; }
  const { data: todayTasks = [] } = useQuery<SimpleTask[]>({
    queryKey: ["tasks-today", testerId, today],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?date=${today}`, { headers: testerId ? { "x-tester-id": testerId } : {} });
      return r.json();
    },
    enabled: !!testerId,
    refetchInterval: 30_000,
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ done: String(done) }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueDate: today }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setNewTaskTitle(""); setShowAddTask(false); },
  });

  const practices = practicesData?.practices ?? [];
  const resonant = practices.filter(p => p.timing === "resonant");
  const supported = practices.filter(p => p.timing === "supported");
  const soften = practices.filter(p => p.timing === "soften" || p.timing === "protect");

  const el = now?.element?.element ?? "water";
  const elemColor = ELEMENT_COLORS[el] ?? "#888";
  const qColor = QUALITY_COLORS[now?.quality ?? "neutral"] ?? "#888";

  // Find next angle crossing from week data — only within 30 minutes
  const todayData = week?.days?.find(d => d.date === today);
  const nowMinutesForCross = new Date().getHours() * 60 + new Date().getMinutes();
  const nextCrossing = (todayData?.crossings ?? []).find(c => {
    if (!c.time) return false;
    const [ch, cm] = c.time.split(":").map(Number);
    const crossMin = ch * 60 + (cm ?? 0);
    return crossMin >= nowMinutesForCross - 5 && crossMin <= nowMinutesForCross + 30;
  });

  if (nowLoading) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 20px", borderBottom: "1px solid #d0cbc3", background: "#ece8e2", flexShrink: 0, height: 42 }} />
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <SkeletonCard rows={3} />
          <SkeletonCard rows={2} />
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} width={40} height={72} borderRadius={8} />
            ))}
          </div>
          <SkeletonCard rows={4} />
        </div>
      </div>
    );
  }

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
          <Tooltip content={
            <div>
              <div style={{ fontWeight: 600, color: "#fff", marginBottom: 4 }}>{el} element · {now?.quality}</div>
              <div style={{ fontSize: 10, color: "#b0aaa4" }}>Element shapes the day's quality. Moon in {now?.moonSign} gives a {el} quality to this time.</div>
            </div>
          }>
            <div style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: `${elemColor}20`, color: elemColor, border: `1px solid ${elemColor}40`, cursor: "help" }}>
              {el} · {now?.quality}
            </div>
          </Tooltip>
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
          <SessionTimer planetaryHour={now?.planetaryHour} />
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

        {/* VOC banner */}
        {todayShowVOC && now?.voc?.isVOC && (
          <div style={{
            background: "#f5f0ea", border: "1px solid #d8d0c0", borderLeft: "3px solid #b0a080",
            borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>◌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6a5030" }}>
                Moon void of course{now.voc.nextIngress ? ` · until ${now.voc.nextIngress}` : ""}
              </div>
              <div style={{ fontSize: 10, color: "#9a7050", marginTop: 2 }}>
                Avoid new beginnings. Good for completion, review, routine, and rest.
              </div>
            </div>
          </div>
        )}

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
              {(["Day", "Week"] as const).map(t => (
                <div key={t} onClick={() => setTideView(t.toLowerCase() as "day"|"week")} style={{
                  fontSize: 10, padding: "3px 10px", borderRadius: 4,
                  background: tideView === t.toLowerCase() ? "#fff" : "transparent",
                  color: tideView === t.toLowerCase() ? "#333" : "#888",
                  fontWeight: tideView === t.toLowerCase() ? 500 : 400, cursor: "pointer",
                }}>{t}</div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 10 }}>
            {now?.momentLabel}
          </div>

          {/* Dynamic tide wave + resonance bands */}
          {todayShowWave && tideView === "day" && (() => {
            const WIDTH = 600, WAVE_H = 96, BAND_H = 11, BAND_GAP = 2, BANDS = 2;
            const TOTAL_H = WAVE_H + BANDS * (BAND_H + BAND_GAP) + 4;
            const DAY_START_H = 6, DAY_END_H = 24;
            const DAY_SPAN = (DAY_END_H - DAY_START_H) * 60;
            const hourWindows = tidesWindowsData?.windows ?? [];

            const QUALITY_SCORE: Record<string, number> = {
              excellent: 7, good: 6, workable: 4, mixed: 3, avoid_if_possible: 2,
            };

            // Build per-hour data (18 hours, 6am–midnight)
            const hourData: { x: number; y: number; score: number; win: any; hour: number }[] = [];
            const now_ = new Date();
            const nowMinutes = now_.getHours() * 60 + now_.getMinutes();

            for (let h = DAY_START_H; h <= DAY_END_H; h++) {
              const minFromStart = (h - DAY_START_H) * 60;
              const x = (minFromStart / DAY_SPAN) * WIDTH;
              const win = hourWindows.find(w => {
                const wh = new Date(w.startTime).getHours();
                const eh = new Date(w.endTime).getHours();
                return h >= wh && h < eh;
              });
              const score = win ? (QUALITY_SCORE[win.quality] ?? 4) : 4;
              const adj = Math.max(1, score - (win?.voidOfCourse ? 2 : 0));
              const y = WAVE_H - 12 - ((adj / 7) * (WAVE_H - 24));
              hourData.push({ x, y, score: adj, win, hour: h });
            }

            if (hourData.length < 2) {
              return (
                <svg width="100%" height={WAVE_H} viewBox={`0 0 ${WIDTH} ${WAVE_H}`}>
                  <rect width={WIDTH} height={WAVE_H} fill="#f8f6f2" rx="4"/>
                  <path d={`M0,55 C150,35 300,15 ${WIDTH},45 L${WIDTH},${WAVE_H} L0,${WAVE_H}Z`} fill={`${elemColor}30`}/>
                </svg>
              );
            }

            // Wave path
            let pathD = `M${hourData[0].x},${hourData[0].y}`;
            for (let i = 1; i < hourData.length; i++) {
              const prev = hourData[i - 1], curr = hourData[i];
              const cpx = (prev.x + curr.x) / 2;
              pathD += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
            }
            const last = hourData[hourData.length - 1];
            const fillPath = `${pathD} L${last.x},${WAVE_H} L${hourData[0].x},${WAVE_H}Z`;

            const nowX = Math.min(WIDTH, Math.max(0, ((nowMinutes - DAY_START_H * 60) / DAY_SPAN) * WIDTH));
            const nowIdx = Math.floor((nowMinutes - DAY_START_H * 60) / 60);
            const nowY = hourData[Math.min(nowIdx, hourData.length - 1)]?.y ?? WAVE_H / 2;

            // Crossings
            const todayCrossings = (todayData?.crossings ?? []).filter(c =>
              c.planet === "Moon" || ["Venus","Jupiter","Mars","Saturn","Sun"].includes(c.planet)
            ).slice(0, 8);

            // Resonance scoring: high if quality≥5 AND non-VOC AND (favorable bio or good phase)
            const moonPhaseName = now?.moonPhase ?? "";
            const isWaxing = moonPhaseName.toLowerCase().includes("waxing") || moonPhaseName.toLowerCase().includes("full");
            const bioDayScore: Record<string, number> = { fruit: 2, flower: 2, root: 1, leaf: 0 };
            const bioScore = bioDayScore[now?.biodynamicType ?? ""] ?? 1;
            const phaseBonus = isWaxing ? 1 : 0;

            // Band colors
            const PHASE_COLORS: Record<string, string> = {
              "new moon":"#1a2a3a", "waxing crescent":"#4a6080", "first quarter":"#5a7090",
              "waxing gibbous":"#6a8aa0", "full moon":"#8a9aaa", "waning gibbous":"#7a8a9a",
              "last quarter":"#5a6a7a", "waning crescent":"#3a4a5a",
            };
            const phaseColor = PHASE_COLORS[moonPhaseName.toLowerCase().replace(/_/g," ")] ?? "#6a8090";

            // Hover data
            const hoverH = waveHover ? (DAY_START_H + Math.round((waveHover.hourIdx))) : null;
            const hoverWin = waveHover ? hourData[Math.min(waveHover.hourIdx, hourData.length - 1)] : null;
            const hoverCrossings = waveHover && hoverH !== null ? todayCrossings.filter(c => {
              const ch = parseInt(c.time?.split(":")?.[0] ?? "99");
              return Math.abs(ch - hoverH) < 1;
            }) : [];

            const BAND_Y = (i: number) => WAVE_H + 4 + i * (BAND_H + BAND_GAP);

            return (
              <div style={{ position: "relative" }}>
                <svg
                  ref={waveRef}
                  width="100%" height={TOTAL_H}
                  viewBox={`0 0 ${WIDTH} ${TOTAL_H}`}
                  style={{ display: "block", cursor: "crosshair" }}
                  onMouseMove={e => {
                    const rect = waveRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
                    const hourIdx = Math.round((svgX / WIDTH) * (DAY_END_H - DAY_START_H));
                    setWaveHover({ x: svgX, y: e.clientY - rect.top, hourIdx: Math.max(0, Math.min(hourIdx, hourData.length - 1)) });
                  }}
                  onMouseLeave={() => setWaveHover(null)}
                >
                  <rect width={WIDTH} height={TOTAL_H} fill="#f8f6f2" rx="4"/>

                  {/* Resonance glow — where score is high */}
                  {hourData.slice(0, -1).map((pt, i) => {
                    const resScore = pt.score + bioScore + phaseBonus;
                    if (resScore < 5) return null;
                    const nextPt = hourData[i + 1];
                    const colWidth = nextPt.x - pt.x;
                    const alpha = Math.min(0.18, (resScore - 4) * 0.05);
                    return <rect key={i} x={pt.x} y={0} width={colWidth} height={WAVE_H} fill={`rgba(210,170,60,${alpha})`}/>;
                  })}

                  {/* VOC zone background */}
                  {hourWindows.filter(w => w.voidOfCourse).map((w, i) => {
                    const x1 = Math.max(0, ((new Date(w.startTime).getHours() - DAY_START_H) * 60 / DAY_SPAN) * WIDTH);
                    const x2 = Math.min(WIDTH, ((new Date(w.endTime).getHours() - DAY_START_H) * 60 / DAY_SPAN) * WIDTH);
                    return <rect key={i} x={x1} y={0} width={x2 - x1} height={WAVE_H} fill="#f0ece4" opacity="0.55"/>;
                  })}

                  {/* Wave fill + line */}
                  <path d={fillPath} fill={`${elemColor}28`}/>
                  <path d={pathD} stroke={elemColor} strokeWidth="1.5" fill="none"/>

                  {/* Crossing spikes */}
                  {crossingsOn && todayCrossings.map((c, i) => {
                    if (!c.time) return null;
                    const [ch, cm] = c.time.split(":").map(Number);
                    const cx_ = ((ch * 60 + cm - DAY_START_H * 60) / DAY_SPAN) * WIDTH;
                    if (cx_ < 0 || cx_ > WIDTH) return null;
                    const isBenefic = ["Venus", "Jupiter"].includes(c.planet);
                    const col = isBenefic ? "#60a060" : "#e0a040";
                    return (
                      <g key={i}>
                        <line x1={cx_} y1={0} x2={cx_} y2={WAVE_H} stroke={col} strokeWidth="1" strokeDasharray="2,2" opacity="0.7"/>
                        <polygon points={`${cx_},2 ${cx_-4},9 ${cx_+4},9`} fill={col}/>
                        <text x={cx_ + 3} y={WAVE_H - 3} fontSize="6" fill={col} fontFamily="sans-serif">{c.planet[0]}</text>
                      </g>
                    );
                  })}

                  {/* Now marker */}
                  <line x1={nowX} y1={0} x2={nowX} y2={WAVE_H} stroke="#1a2a3a" strokeWidth="1" strokeDasharray="3,2"/>
                  <circle cx={nowX} cy={nowY} r="3.5" fill="#1a2a3a"/>
                  <text x={nowX + 5} y={nowY - 4} fontSize="7" fill="#1a2a3a" fontFamily="sans-serif">NOW</text>

                  {/* Scheduled windows bar */}
                  {(windows ?? []).map((w, i) => {
                    const [sh, sm] = w.startTime.split(":").map(Number);
                    const [eh, em] = w.endTime.split(":").map(Number);
                    const x0 = Math.max(0, ((sh * 60 + sm - DAY_START_H * 60) / DAY_SPAN) * WIDTH);
                    const x1 = Math.max(x0 + 20, ((eh * 60 + em - DAY_START_H * 60) / DAY_SPAN) * WIDTH);
                    const color = WINDOW_COLORS[w.type] ?? "#888";
                    return (
                      <g key={w.id}>
                        <rect x={x0} y={WAVE_H - 22} width={x1 - x0} height={18} rx="3" fill={color} opacity="0.85"/>
                        <text x={(x0 + x1) / 2} y={WAVE_H - 10} fontSize="6.5" fill="#fff" fontFamily="sans-serif" textAnchor="middle">{w.title}</text>
                      </g>
                    );
                  })}

                  {/* ── Resonance bands ── */}

                  {/* Band 1: Quality gradient */}
                  {hourData.slice(0, -1).map((pt, i) => {
                    const nextPt = hourData[i + 1];
                    const colW = nextPt.x - pt.x;
                    const q = pt.score;
                    const hue = q >= 5 ? "#60a060" : q >= 3 ? "#d0a040" : "#c06040";
                    return <rect key={i} x={pt.x} y={BAND_Y(0)} width={colW} height={BAND_H} fill={hue} opacity={0.3 + q * 0.09}/>;
                  })}
                  <text x={2} y={BAND_Y(0) + 8} fontSize="6.5" fill="#aaa" fontFamily="sans-serif">quality</text>

                  {/* Band 2: Lunar phase */}
                  <rect x={0} y={BAND_Y(1)} width={WIDTH} height={BAND_H} fill={phaseColor} opacity={0.4}/>
                  <text x={2} y={BAND_Y(1) + 8} fontSize="6.5" fill="#ccc" fontFamily="sans-serif">{(moonPhaseName ?? "").replace(/_/g," ")}</text>

                  {/* Crossing dots on bands */}
                  {todayCrossings.map((c, i) => {
                    if (!c.time) return null;
                    const [ch, cm] = c.time.split(":").map(Number);
                    const cx_ = ((ch * 60 + cm - DAY_START_H * 60) / DAY_SPAN) * WIDTH;
                    if (cx_ < 0 || cx_ > WIDTH) return null;
                    const isBenefic = ["Venus", "Jupiter"].includes(c.planet);
                    return <circle key={i} cx={cx_} cy={BAND_Y(0) + BAND_H / 2} r={3} fill={isBenefic ? "#60a060" : "#e0a040"} opacity={0.9}/>;
                  })}

                  {/* Hover line */}
                  {waveHover && (
                    <line
                      x1={waveHover.x} y1={0} x2={waveHover.x} y2={WAVE_H}
                      stroke="#1a2a3a" strokeWidth="0.75" strokeDasharray="2,3" opacity="0.4"
                    />
                  )}
                </svg>

                {/* Hover tooltip card */}
                {waveHover && hoverWin && (
                  <div style={{
                    position: "absolute",
                    top: Math.min(waveHover.y - 80, WAVE_H - 90),
                    left: Math.min(Math.max(waveHover.x * (waveRef.current?.getBoundingClientRect().width ?? 600) / WIDTH - 70, 0), (waveRef.current?.getBoundingClientRect().width ?? 600) - 160),
                    background: "#1a2a3a", color: "#e8e4de", borderRadius: 8, padding: "8px 11px",
                    fontSize: 10.5, lineHeight: 1.4, width: 160, pointerEvents: "none",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 3 }}>
                      {DAY_START_H + waveHover.hourIdx}:00 — quality {hoverWin.score}/7
                    </div>
                    {hoverWin.win && (
                      <div style={{ color: "#b0aaa4", fontSize: 10 }}>
                        {hoverWin.win.quality?.replace(/_/g," ")}
                        {hoverWin.win.voidOfCourse ? " · VOC" : ""}
                      </div>
                    )}
                    {hoverCrossings.length > 0 && (
                      <div style={{ marginTop: 4, color: "#c8b870" }}>
                        {hoverCrossings.map(c => `${c.planet} ${c.angle ?? ""}`).join(", ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Band legend row */}
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 8, color: "#bbb", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div style={{ width: 12, height: 5, background: "linear-gradient(to right, #c06040, #d0a040, #60a060)", borderRadius: 2 }} />
                    quality
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div style={{ width: 12, height: 5, background: phaseColor, borderRadius: 2, opacity: 0.7 }} />
                    lunar phase
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#c8b870" }} />
                    crossing
                  </div>
                  <HelpBadge term="resonance" style={{ marginLeft: "auto" }} />
                </div>
              </div>
            );
          })()}
          {todayShowWave && tideView === "day" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#ccc", marginTop: 1 }}>
            {["6am","9am","12pm","3pm","6pm","9pm","12am"].map(t => <span key={t}>{t}</span>)}
          </div>}

          {/* Week view — 7-day quality bars */}
          {tideView === "week" && (() => {
            const ELEMENT_COLORS_W: Record<string, string> = { water:"#3a5a80",fire:"#8a3a20",earth:"#3a6030",air:"#602080" };
            const days7 = (week?.days ?? []).slice(0, 7);
            return (
              <div style={{ display:"flex", gap:4 }}>
                {days7.map(d => {
                  const isToday = d.date === today;
                  const ec = ELEMENT_COLORS_W[d.element ?? "water"] ?? "#888";
                  const qs = d.qualityScore ?? 4;
                  const qc = qs >= 5 ? "#3a7040" : qs >= 3 ? "#8a8030" : "#c07030";
                  return (
                    <div key={d.date} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"8px 4px", borderRadius:8, border:`1px solid ${isToday ? "#c0b090" : "#e8e4de"}`, background: isToday ? "#faf6f0" : "#faf8f5" }}>
                      <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.4px", color: isToday ? "#b07030" : "#aaa", fontWeight: isToday ? 600 : 400 }}>{d.label?.slice(0,3)}</div>
                      <div style={{ fontSize:11, fontWeight: isToday ? 700 : 500, color: isToday ? "#b07030" : "#444" }}>{new Date(d.date+"T12:00:00").getDate()}</div>
                      <div style={{ fontSize:8, color:ec }}>{d.moonPhase?.replace(/_/g," ").split(" ")[0]}</div>
                      <div style={{ width:"100%", height:3, borderRadius:2, background:"#e8e4de" }}>
                        <div style={{ height:"100%", borderRadius:2, width:`${(qs/7)*100}%`, background:qc }}/>
                      </div>
                      <div style={{ fontSize:7, color:ec }}>
                        {d.moonSign?.split(" ")[0] ?? ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Week strip — 14 days */}
        {todayShow14Day && <div style={{ background: "#fff", border: "1px solid #d8d2ca", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>14 days ahead</div>
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {(week?.days ?? []).map(day => {
              const isToday = day.date === today;
              const ec = ELEMENT_COLORS[day.element ?? "water"] ?? "#888";
              const qc = QUALITY_COLORS[day.quality ?? "neutral"] ?? "#888";
              return (
                <div key={day.date} style={{
                  minWidth: 40, border: `1px solid ${isToday ? "#c0b090" : "#e8e4de"}`,
                  borderRadius: 8, padding: "6px 4px", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3, background: isToday ? "#faf6f0" : "transparent", flexShrink: 0,
                }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", color: isToday ? "#b07030" : "#aaa", fontWeight: isToday ? 600 : 400 }}>
                    {day.label?.slice(0, 3)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isToday ? "#b07030" : "#444" }}>
                    {new Date(day.date + "T12:00:00").getDate()}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: qc }} />
                  <div style={{ fontSize: 7.5, color: ec, textAlign:"center", lineHeight:1 }}>
                    {day.moonSign?.split(" ")[0] ?? (day.element !== "spirit" ? day.element : "transit")}
                  </div>
                  {(day.crossings ?? []).length > 0 && (
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#e0a040" }} title="Angle crossing" />
                  )}
                </div>
              );
            })}
          </div>
        </div>}

        {/* Journal prompt */}
        {todayShowJournal && <div style={{ background: "#fff", border: "1px solid #d8d2ca", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Today's reflection</div>
            {journalSaved && <span style={{ fontSize: 9, color: "#60a060" }}>saved ✓</span>}
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 8, fontStyle: "italic" }}>
            {heroText(now).replace(/\.$/, "")} — what does this day call for?
          </div>
          <textarea
            value={journalText}
            onChange={e => setJournalText(e.target.value)}
            onBlur={e => e.target.value.trim() && saveJournal(e.target.value)}
            placeholder="A few words about where you're putting your energy today…"
            rows={3}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0dbd4",
              fontSize: 12, lineHeight: 1.5, resize: "none", outline: "none",
              background: "#faf8f5", color: "#333", fontFamily: "inherit",
            }}
          />
        </div>}

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

          {/* Tasks — today's list */}
          {activeTab === "tasks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {todayTasks.filter(t => t.done !== "true").map(t => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                  borderRadius: 7, border: "1px solid #e8e4de", background: "#faf8f5",
                }}>
                  <button onClick={() => toggleTask.mutate({ id: t.id, done: true })} style={{
                    width: 17, height: 17, borderRadius: 4, border: "1.5px solid #c0bab0",
                    background: "transparent", flexShrink: 0, cursor: "pointer",
                  }} />
                  <div style={{ flex: 1, fontSize: 12, color: "#222" }}>{t.title}</div>
                  {t.bestWindowType && (
                    <div style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: "#e8e4de", color: "#777" }}>
                      {t.bestWindowType.replace("_", " ")}
                    </div>
                  )}
                </div>
              ))}
              {showAddTask ? (
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newTaskTitle.trim()) addTask.mutate(newTaskTitle); if (e.key === "Escape") { setShowAddTask(false); setNewTaskTitle(""); } }}
                    placeholder="Task for today…"
                    style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: "1px solid #d8d2ca", fontSize: 12, outline: "none", background: "#faf8f5" }}
                  />
                  <button onClick={() => newTaskTitle.trim() && addTask.mutate(newTaskTitle)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#fff", fontSize: 11, cursor: "pointer" }}>Add</button>
                </div>
              ) : (
                <button onClick={() => setShowAddTask(true)} style={{ fontSize: 11, color: "#aaa", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" }}>
                  + Add task for today
                </button>
              )}
              {todayTasks.filter(t => t.done === "true").length > 0 && (
                <div style={{ fontSize: 9, color: "#bbb", marginTop: 4 }}>
                  {todayTasks.filter(t => t.done === "true").length} done today ✓
                </div>
              )}
              {todayTasks.length === 0 && !showAddTask && (
                <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: "16px 0" }}>No tasks for today yet.</div>
              )}
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
