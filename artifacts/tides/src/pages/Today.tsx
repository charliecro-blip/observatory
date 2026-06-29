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

const PLANET_COLORS: Record<string, string> = {
  Sun: "#c08020", Moon: "#7080a0", Mercury: "#608060", Venus: "#c06090",
  Mars: "#c04040", Jupiter: "#6040a0", Saturn: "#807060", Uranus: "#3090a0",
};

const PLANET_SIGNIFICATION: Record<string, string> = {
  Moon: "nourishment · care · small tasks · environment",
  Mars: "action · ignition · assertion · exertion",
  Saturn: "slowing · focusing · consolidation · rest",
  Venus: "beauty · pleasure · connection · relationship",
  Jupiter: "expansion · abundance · generosity · vision",
  Sun: "visibility · leadership · vitality · clarity",
  Mercury: "communication · ideas · movement · craft",
  Uranus: "disruption · surprise · liberation · shake-up",
};

const PLANET_ICONS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆",
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
        {crossingsOn && nextCrossing && (() => {
          const pCol = PLANET_COLORS[nextCrossing.planet] ?? "#c08020";
          const sig = PLANET_SIGNIFICATION[nextCrossing.planet];
          const isBenefic = ["Venus","Jupiter","Sun"].includes(nextCrossing.planet);
          return (
            <div style={{
              background: `${pCol}10`, border: `1px solid ${pCol}40`, borderLeft: `3px solid ${pCol}`,
              borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{PLANET_ICONS[nextCrossing.planet] ?? "⚡"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: pCol }}>
                  {nextCrossing.planet} crosses {nextCrossing.angle} · {nextCrossing.time}
                </div>
                {sig && (
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{sig}</div>
                )}
              </div>
              <div style={{ fontSize: 8, background: `${pCol}20`, color: pCol, padding: "2px 7px", borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                {isBenefic ? "↑" : "—"} {nextCrossing.angle}
              </div>
            </div>
          );
        })()}

        {/* Tide chart */}
        <TideChart
          elemColor={elemColor}
          todayData={todayData}
          tidesWindowsData={tidesWindowsData}
          windows={windows}
          now={now}
          week={week}
          today={today}
          tideView={tideView}
          setTideView={setTideView}
          crossingsOn={crossingsOn}
          waveRef={waveRef}
          waveHover={waveHover}
          setWaveHover={setWaveHover}
          todayShowWave={todayShowWave}
        />

        {/* 14 days ahead */}
        {todayShow14Day && <FourteenDays week={week} today={today} />}


        {/* Waves — flat unified list: practices + tasks + goals */}
        <div style={{ background: "#fff", border: "1px solid #d8d2ca", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>Waves</div>
            {todayTasks.filter(t => t.done === "true").length > 0 && (
              <span style={{ fontSize: 9, color: "#60a060" }}>{todayTasks.filter(t => t.done === "true").length} done ✓</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Resonant practices first */}
            {resonant.map(p => <WaveRow key={`p-${p.id}`} type="practice-resonant" label={p.name} sub={p.reasons?.[0]} />)}
            {/* Active tasks */}
            {todayTasks.filter(t => t.done !== "true").map(t => (
              <WaveRow key={`t-${t.id}`} type="task"
                label={t.title}
                sub={t.bestWindowType?.replace("_"," ")}
                onCheck={() => toggleTask.mutate({ id: t.id, done: true })}
              />
            ))}
            {/* Goals */}
            {(goals ?? []).slice(0, 4).map(g => (
              <WaveRow key={`g-${g.id}`} type="goal" label={g.title}
                sub={g.horizon} />
            ))}
            {/* Supported + soften practices below */}
            {supported.map(p => <WaveRow key={`ps-${p.id}`} type="practice-supported" label={p.name} sub={p.reasons?.[0]} />)}
            {soften.map(p => <WaveRow key={`pf-${p.id}`} type="practice-soften" label={p.name} />)}
            {/* Add task */}
            <div style={{ padding: "8px 18px", borderTop: "1px solid #f0ede8" }}>
              {showAddTask ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newTaskTitle.trim()) addTask.mutate(newTaskTitle); if (e.key === "Escape") { setShowAddTask(false); setNewTaskTitle(""); } }}
                    placeholder="Add task for today…"
                    style={{ flex: 1, padding: "5px 9px", borderRadius: 6, border: "1px solid #d8d2ca", fontSize: 12, outline: "none", background: "#faf8f5" }}
                  />
                  <button onClick={() => newTaskTitle.trim() && addTask.mutate(newTaskTitle)}
                    style={{ padding: "5px 11px", borderRadius: 6, border: "none", background: "#1a2a3a", color: "#fff", fontSize: 11, cursor: "pointer" }}>Add</button>
                </div>
              ) : (
                <button onClick={() => setShowAddTask(true)} style={{ fontSize: 11, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  + add task
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── TideChart ──────────────────────────────────────────────────────────────────

type ChartType = "flow" | "heart" | "create" | "move";

const CHART_TYPES: { id: ChartType; label: string; color: string; desc: string }[] = [
  { id: "flow",   label: "Overall",    color: "#3a5a80", desc: "General quality — all factors" },
  { id: "heart",  label: "Social",     color: "#c06090", desc: "Connection · relationship · love" },
  { id: "create", label: "Creative",   color: "#6040a0", desc: "Art · expression · making" },
  { id: "move",   label: "Active",     color: "#c04040", desc: "Movement · exercise · assertion" },
];

const CHART_AMPS: Record<ChartType, Record<string, number>> = {
  flow:   { Venus:2.5, Jupiter:2.5, Sun:1.5, Mercury:1.2, Moon:1.0, Mars:-1.0, Saturn:-1.5 },
  heart:  { Venus:4.0, Moon:3.0, Jupiter:1.5, Sun:1.0, Mercury:0.5, Mars:-0.5, Saturn:-2.0 },
  create: { Moon:3.5, Venus:2.5, Mercury:2.0, Jupiter:1.5, Mars:0.5, Saturn:-1.0, Sun:1.0 },
  move:   { Mars:4.0, Sun:2.5, Jupiter:1.5, Moon:0.5, Saturn:0.5, Venus:0.5, Mercury:0.5 },
};

const QUALITY_SCORE_MAP: Record<string, number> = {
  excellent:7, good:6, workable:4, mixed:3, avoid_if_possible:2,
};

const PHASE_COLORS: Record<string, string> = {
  "new moon":"#1a2a3a", "waxing crescent":"#4a6080", "first quarter":"#5a7090",
  "waxing gibbous":"#6a8aa0", "full moon":"#9ab0c0", "waning gibbous":"#7a8a9a",
  "last quarter":"#5a6a7a", "waning crescent":"#3a4a5a",
};

// Planetary hour quality contribution to wave score (per chart type)
const HOUR_QUALITY: Record<ChartType, Record<string, number>> = {
  flow:   { Sun:1.5, Moon:0.8, Mercury:1.0, Venus:1.5, Mars:-0.5, Jupiter:1.5, Saturn:-0.5 },
  heart:  { Sun:0.5, Moon:1.5, Mercury:0.5, Venus:2.5, Mars:-1.0, Jupiter:1.0, Saturn:-1.5 },
  create: { Sun:0.8, Moon:2.0, Mercury:1.5, Venus:2.0, Mars:0.3, Jupiter:1.0, Saturn:-0.8 },
  move:   { Sun:1.5, Moon:0.3, Mercury:0.5, Venus:0.0, Mars:2.5, Jupiter:1.0, Saturn:0.3 },
};

function buildWavePoints(
  crossings: any[],
  hourWindows: any[],
  chartType: ChartType,
  DAY_START_H: number,
  DAY_END_H: number,
  WIDTH: number,
  WAVE_H: number,
) {
  const STEP = 5; // 5-min resolution for smooth wave
  const DAY_SPAN = (DAY_END_H - DAY_START_H) * 60;
  const AMPS = CHART_AMPS[chartType];
  const HQ = HOUR_QUALITY[chartType];
  const pts: { x: number; y: number; score: number; win: any; label: string }[] = [];

  for (let minFromStart = 0; minFromStart <= DAY_SPAN; minFromStart += STEP) {
    const totalMin = DAY_START_H * 60 + minFromStart;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const x = (minFromStart / DAY_SPAN) * WIDTH;

    const win = hourWindows.find((w: any) => {
      const wh = new Date(w.startTime).getHours();
      const eh = new Date(w.endTime).getHours();
      return h >= wh && h < eh;
    });
    // Base quality: hourly window score + planetary hour contribution
    let score = win ? (QUALITY_SCORE_MAP[win.quality] ?? 4) : 4;
    if (win?.voidOfCourse) score -= 1.5;
    // Planetary hour quality
    const hourPlanet = win?.planet ?? win?.planetaryHour ?? null;
    if (hourPlanet && HQ[hourPlanet] !== undefined) {
      score += HQ[hourPlanet] * 0.6; // blend in at 60% weight
    }

    // Angular crossing Gaussian bumps
    for (const c of crossings) {
      if (!c.time) continue;
      const [ch, cm] = c.time.split(":").map(Number);
      const crossMin = (ch - DAY_START_H) * 60 + (cm ?? 0);
      const delta = minFromStart - crossMin;
      const amp = AMPS[c.planet] ?? 0;
      if (amp === 0) continue;
      const width = Math.abs(amp) > 2 ? 55 : 35;
      score += amp * Math.exp(-0.5 * (delta / width) ** 2);
    }

    const clamped = Math.max(0.2, Math.min(7, score));
    const y = WAVE_H - 10 - (clamped / 7) * (WAVE_H - 20);
    pts.push({ x, y, score: clamped, win, label: `${h}:${m.toString().padStart(2,"0")}` });
  }
  return { pts, STEP, DAY_SPAN };
}

function smoothPath(pts: { x: number; y: number }[], WAVE_H: number) {
  if (pts.length < 2) return { pathD: "", fillPath: "" };
  // Catmull-Rom-style smoothing via bezier control points
  let pathD = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    pathD += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1], first = pts[0];
  const fillPath = `${pathD} L${last.x},${WAVE_H} L${first.x},${WAVE_H}Z`;
  return { pathD, fillPath };
}

function TideChart({
  elemColor, todayData, tidesWindowsData, windows, now, week, today,
  tideView, setTideView, crossingsOn, waveRef, waveHover, setWaveHover, todayShowWave,
}: {
  elemColor: string; todayData: any; tidesWindowsData: any; windows: any;
  now: any; week: any; today: string;
  tideView: "day" | "week"; setTideView: (v: "day"|"week") => void;
  crossingsOn: boolean; waveRef: React.RefObject<SVGSVGElement | null>;
  waveHover: { x: number; y: number; hourIdx: number } | null;
  setWaveHover: (v: { x: number; y: number; hourIdx: number } | null) => void;
  todayShowWave: boolean;
}) {
  const [chartType, setChartType] = useState<ChartType>("flow");

  const todayCrossings = todayData?.crossings ?? [];
  const hourWindows = tidesWindowsData?.windows ?? [];
  const now_ = new Date();
  const nowMinutes = now_.getHours() * 60 + now_.getMinutes();

  const DAY_START_H = 5, DAY_END_H = 24;
  const WIDTH = 700, WAVE_H = 150, BAND_H = 10, BAND_GAP = 2, BANDS = 2;
  const TOTAL_H = WAVE_H + BANDS * (BAND_H + BAND_GAP) + 8;
  const DAY_SPAN = (DAY_END_H - DAY_START_H) * 60;

  const ct = CHART_TYPES.find(c => c.id === chartType)!;
  const waveColor = ct.color;

  const moonPhaseName = now?.moonPhase ?? "";
  const phaseColor = PHASE_COLORS[moonPhaseName.toLowerCase().replace(/_/g," ")] ?? "#6a8090";
  const isWaxing = moonPhaseName.toLowerCase().includes("waxing") || moonPhaseName.toLowerCase().includes("full");
  const phaseBonus = isWaxing ? 0.8 : 0;

  const STEP = 5;
  const BAND_Y = (i: number) => WAVE_H + 6 + i * (BAND_H + BAND_GAP);

  // Hour tick positions along X axis
  const hourTicks = [];
  for (let h = DAY_START_H; h <= DAY_END_H; h += 3) {
    const x = ((h - DAY_START_H) * 60 / DAY_SPAN) * WIDTH;
    const label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h-12}pm`;
    hourTicks.push({ x, label });
  }

  const { pts, } = buildWavePoints(todayCrossings, hourWindows, chartType, DAY_START_H, DAY_END_H, WIDTH, WAVE_H);
  const { pathD, fillPath } = smoothPath(pts, WAVE_H);

  const nowX = Math.min(WIDTH, Math.max(0, ((nowMinutes - DAY_START_H * 60) / DAY_SPAN) * WIDTH));
  const nowIdx = Math.round((nowMinutes - DAY_START_H * 60) / STEP);
  const nowPt = pts[Math.min(nowIdx, pts.length - 1)];
  const nowY = nowPt?.y ?? WAVE_H / 2;

  const hoverPt = waveHover ? pts[Math.min(waveHover.hourIdx, pts.length - 1)] : null;
  const hoverCrossings = hoverPt ? todayCrossings.filter((c: any) => {
    if (!c.time) return false;
    const [ch, cm] = c.time.split(":").map(Number);
    const crossMin = (ch - DAY_START_H) * 60 + (cm ?? 0);
    const hoverMin = (hoverPt.label.split(":").map(Number)[0] - DAY_START_H) * 60 + (hoverPt.label.split(":").map(Number)[1] ?? 0);
    return Math.abs(crossMin - hoverMin) < 45;
  }) : [];

  return (
    <div style={{ background: "#fff", border: "1px solid #d8d2ca", borderRadius: 12, overflow: "hidden" }}>
      {/* Header row */}
      <div style={{ padding: "12px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>The tide</div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>{now?.momentLabel}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", background: "#f0ede8", borderRadius: 5, padding: 2, gap: 1 }}>
            {(["Day", "Week"] as const).map(t => (
              <div key={t} onClick={() => setTideView(t.toLowerCase() as "day"|"week")} style={{
                fontSize: 10, padding: "2px 9px", borderRadius: 4,
                background: tideView === t.toLowerCase() ? "#fff" : "transparent",
                color: tideView === t.toLowerCase() ? "#333" : "#999",
                fontWeight: tideView === t.toLowerCase() ? 500 : 400, cursor: "pointer",
              }}>{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart type tabs */}
      <div style={{ display: "flex", gap: 0, padding: "10px 18px 0", borderBottom: "1px solid #f0ede8" }}>
        {CHART_TYPES.map(ct2 => (
          <button key={ct2.id} onClick={() => setChartType(ct2.id)} style={{
            fontSize: 10, padding: "5px 12px", border: "none", background: "none", cursor: "pointer",
            color: chartType === ct2.id ? ct2.color : "#bbb",
            fontWeight: chartType === ct2.id ? 600 : 400,
            borderBottom: chartType === ct2.id ? `2px solid ${ct2.color}` : "2px solid transparent",
            marginBottom: -1,
          }}>{ct2.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, color: "#bbb", alignSelf: "center", paddingBottom: 4 }}>{ct.desc}</div>
      </div>

      {/* Wave chart — day view */}
      {tideView === "day" && todayShowWave && (
        <div style={{ padding: "12px 18px 10px", position: "relative" }}>
          <svg
            ref={waveRef}
            width="100%" height={TOTAL_H}
            viewBox={`0 0 ${WIDTH} ${TOTAL_H}`}
            style={{ display: "block", cursor: "crosshair", overflow: "visible" }}
            onMouseMove={e => {
              const rect = waveRef.current?.getBoundingClientRect();
              if (!rect) return;
              const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
              const minFromStart = (svgX / WIDTH) * DAY_SPAN;
              const hourIdx = Math.max(0, Math.min(Math.round(minFromStart / STEP), pts.length - 1));
              setWaveHover({ x: svgX, y: e.clientY - rect.top, hourIdx });
            }}
            onMouseLeave={() => setWaveHover(null)}
          >
            <rect width={WIDTH} height={TOTAL_H} fill="#f9f7f4" rx="6"/>

            {/* Hour grid lines */}
            {hourTicks.map(({ x, label }) => (
              <g key={label}>
                <line x1={x} y1={0} x2={x} y2={WAVE_H} stroke="#e8e4de" strokeWidth="1"/>
                <text x={x} y={WAVE_H + 3} fontSize="7.5" fill="#c0bab0" fontFamily="sans-serif" textAnchor="middle" dominantBaseline="hanging">{label}</text>
              </g>
            ))}

            {/* Resonance glow */}
            {pts.slice(0, -1).map((pt, i) => {
              const resScore = pt.score + phaseBonus;
              if (resScore < 5.2) return null;
              const nextPt = pts[i + 1];
              const alpha = Math.min(0.16, (resScore - 5) * 0.07);
              return <rect key={i} x={pt.x} y={0} width={nextPt.x - pt.x + 0.5} height={WAVE_H} fill={`rgba(210,170,60,${alpha})`}/>;
            })}

            {/* VOC background */}
            {hourWindows.filter((w: any) => w.voidOfCourse).map((w: any, i: number) => {
              const x1 = Math.max(0, ((new Date(w.startTime).getHours() - DAY_START_H) * 60 / DAY_SPAN) * WIDTH);
              const x2 = Math.min(WIDTH, ((new Date(w.endTime).getHours() - DAY_START_H) * 60 / DAY_SPAN) * WIDTH);
              return <rect key={i} x={x1} y={0} width={x2 - x1} height={WAVE_H} fill="#ede9e2" opacity="0.6">
                <title>Void of Course</title>
              </rect>;
            })}

            {/* Wave fill + stroke */}
            {fillPath && <path d={fillPath} fill={`${waveColor}22`}/>}
            {pathD && <path d={pathD} stroke={waveColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}

            {/* Crossing markers */}
            {crossingsOn && todayCrossings.map((c: any, i: number) => {
              if (!c.time) return null;
              const [ch, cm] = c.time.split(":").map(Number);
              const cx_ = ((ch * 60 + cm - DAY_START_H * 60) / DAY_SPAN) * WIDTH;
              if (cx_ < -10 || cx_ > WIDTH + 10) return null;
              const pCol = PLANET_COLORS[c.planet] ?? "#c8b870";
              const AMPS = CHART_AMPS[chartType];
              const amp = AMPS[c.planet] ?? 0;
              const isBenefic = amp > 1.5;
              const isMalefic = amp < 0;
              return (
                <g key={i}>
                  <line x1={cx_} y1={6} x2={cx_} y2={WAVE_H - 2} stroke={pCol} strokeWidth="1" strokeDasharray={isMalefic ? "3,3" : "none"} opacity="0.5"/>
                  {isBenefic && <polygon points={`${cx_},4 ${cx_-5},12 ${cx_+5},12`} fill={pCol} opacity="0.8"/>}
                  {isMalefic && <polygon points={`${cx_},12 ${cx_-4},4 ${cx_+4},4`} fill={pCol} opacity="0.6"/>}
                  <text x={cx_} y={WAVE_H - 4} fontSize="7.5" fill={pCol} fontFamily="sans-serif" textAnchor="middle" opacity="0.9">
                    {PLANET_ICONS[c.planet] ?? c.planet[0]}
                  </text>
                </g>
              );
            })}

            {/* Now marker */}
            {nowX >= 0 && nowX <= WIDTH && <>
              <line x1={nowX} y1={0} x2={nowX} y2={WAVE_H} stroke="#1a2a3a" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.5"/>
              <circle cx={nowX} cy={nowY} r="4" fill={waveColor} stroke="#fff" strokeWidth="1.5"/>
              <rect x={nowX - 14} y={nowY - 17} width={28} height={13} rx="3" fill="#1a2a3a" opacity="0.85"/>
              <text x={nowX} y={nowY - 8} fontSize="7.5" fill="#fff" fontFamily="sans-serif" textAnchor="middle">now</text>
            </>}

            {/* Scheduled windows */}
            {(windows ?? []).map((w: any, i: number) => {
              const [sh, sm] = w.startTime.split(":").map(Number);
              const [eh, em] = w.endTime.split(":").map(Number);
              const x0 = Math.max(0, ((sh * 60 + sm - DAY_START_H * 60) / DAY_SPAN) * WIDTH);
              const x1 = Math.max(x0 + 16, ((eh * 60 + em - DAY_START_H * 60) / DAY_SPAN) * WIDTH);
              const color = WINDOW_COLORS[w.type] ?? "#888";
              return (
                <g key={w.id}>
                  <rect x={x0} y={WAVE_H - 20} width={x1 - x0} height={16} rx="3" fill={color} opacity="0.8"/>
                  <text x={(x0+x1)/2} y={WAVE_H - 9} fontSize="6" fill="#fff" fontFamily="sans-serif" textAnchor="middle">{w.title}</text>
                </g>
              );
            })}

            {/* Band 1: quality */}
            {pts.slice(0, -1).map((pt, i) => {
              const nextPt = pts[i + 1];
              const q = pt.score;
              const hue = q >= 5.5 ? "#50a050" : q >= 4 ? "#c8a030" : "#c06040";
              return <rect key={i} x={pt.x} y={BAND_Y(0)} width={nextPt.x - pt.x + 0.5} height={BAND_H} fill={hue} opacity={Math.min(0.9, 0.2 + q * 0.1)}/>;
            })}

            {/* Band 2: lunar phase */}
            <rect x={0} y={BAND_Y(1)} width={WIDTH} height={BAND_H} fill={phaseColor} opacity={0.35}/>
            <text x={4} y={BAND_Y(1) + 7.5} fontSize="7" fill="#e0ddd8" fontFamily="sans-serif" dominantBaseline="middle">
              {(moonPhaseName ?? "").replace(/_/g," ")}
            </text>

            {/* Crossing dots on quality band */}
            {todayCrossings.map((c: any, i: number) => {
              if (!c.time) return null;
              const [ch, cm] = c.time.split(":").map(Number);
              const cx_ = ((ch * 60 + cm - DAY_START_H * 60) / DAY_SPAN) * WIDTH;
              if (cx_ < 0 || cx_ > WIDTH) return null;
              return <circle key={i} cx={cx_} cy={BAND_Y(0) + BAND_H/2} r={3.5} fill={PLANET_COLORS[c.planet] ?? "#c8b870"} opacity={0.9}/>;
            })}

            {/* Hover scrubber line */}
            {waveHover && (
              <line x1={waveHover.x} y1={0} x2={waveHover.x} y2={WAVE_H + BANDS*(BAND_H+BAND_GAP)+4}
                stroke="#1a2a3a" strokeWidth="1" strokeDasharray="2,3" opacity="0.25"/>
            )}
          </svg>

          {/* Hover tooltip */}
          {waveHover && hoverPt && (() => {
            const svgW = waveRef.current?.getBoundingClientRect().width ?? WIDTH;
            const scaleX = svgW / WIDTH;
            const tipLeft = Math.min(Math.max(waveHover.x * scaleX - 90, 0), svgW - 200);
            const tipTop = Math.min(waveHover.y - 90, WAVE_H * (svgW/WIDTH) - 100);
            return (
              <div style={{
                position:"absolute", top:12+tipTop, left:18+tipLeft,
                background:"#1a2a3a", color:"#e8e4de", borderRadius:9, padding:"9px 12px",
                fontSize:10.5, lineHeight:1.45, width:200, pointerEvents:"none",
                boxShadow:"0 6px 20px rgba(0,0,0,0.25)",
              }}>
                <div style={{ fontWeight:600, marginBottom:3, display:"flex", justifyContent:"space-between" }}>
                  <span>{hoverPt.label}</span>
                  <span style={{ color:hoverPt.score>=5.5?"#80d080":hoverPt.score>=3.5?"#d0c060":"#e08060", fontWeight:400, fontSize:9.5 }}>
                    quality {hoverPt.score.toFixed(1)}
                  </span>
                </div>
                {hoverPt.win && (
                  <div style={{ color:"#8a9aaa", fontSize:9.5, marginBottom:hoverCrossings.length>0?5:0 }}>
                    {hoverPt.win.quality?.replace(/_/g," ")}
                    {hoverPt.win.voidOfCourse?" · void of course":""}
                  </div>
                )}
                {hoverCrossings.map((c: any, ci: number) => (
                  <div key={ci} style={{ marginTop:4, paddingTop: ci===0?4:0, borderTop: ci===0?"1px solid #2a3a4a":"none" }}>
                    <div style={{ color:PLANET_COLORS[c.planet]??"#c8b870", fontWeight:600, fontSize:10 }}>
                      {PLANET_ICONS[c.planet]??"○"} {c.planet} × {c.angle} · {c.time}
                    </div>
                    <div style={{ color:"#7080a0", fontSize:9, marginTop:1 }}>{PLANET_SIGNIFICATION[c.planet]}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Legend */}
          <div style={{ display:"flex", gap:12, marginTop:6, fontSize:8, color:"#bbb", alignItems:"center" }}>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <div style={{ width:14, height:5, background:"linear-gradient(to right, #c06040, #c8a030, #50a050)", borderRadius:2 }}/>
              quality band
            </div>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <div style={{ width:12, height:5, background:phaseColor, borderRadius:2, opacity:0.6 }}/>
              {(moonPhaseName ?? "").replace(/_/g," ").split(" ").slice(0,2).join(" ")}
            </div>
            {crossingsOn && <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:waveColor, opacity:0.7 }}/>
              crossings
            </div>}
            <HelpBadge term="resonance" style={{ marginLeft:"auto" }}/>
          </div>
        </div>
      )}

      {/* Week view — 7-day continuous wave */}
      {tideView === "week" && (() => {
        const WEEK_W = 700, WEEK_H = 140;
        const days7 = (week?.days ?? []).slice(0, 7);
        if (!days7.length) return <div style={{ padding:20, color:"#bbb", fontSize:12 }}>No week data.</div>;

        const DAY_W = WEEK_W / 7;
        const allWeekPts: { x: number; y: number; score: number; dayIdx: number }[] = [];

        days7.forEach((d: any, di: number) => {
          const dayCrossings = d.crossings ?? [];
          const qs = d.qualityScore ?? 4;
          const baseScore = qs;
          const xOffset = di * DAY_W;

          // Simple: flat quality with crossing spikes per day
          for (let h = 0; h <= 18; h++) {
            const x = xOffset + (h / 18) * DAY_W;
            let score = baseScore;
            for (const c of dayCrossings) {
              if (!c.time) continue;
              const [ch, cm] = c.time.split(":").map(Number);
              const crossH = ch + (cm ?? 0) / 60 - 6; // offset from 6am
              const delta = h - crossH;
              const amp = (CHART_AMPS[chartType][c.planet] ?? 0);
              if (amp === 0) continue;
              score += amp * Math.exp(-0.5 * (delta / 1.5) ** 2);
            }
            const clamped = Math.max(0.2, Math.min(7, score));
            const y = WEEK_H - 16 - (clamped / 7) * (WEEK_H - 30);
            allWeekPts.push({ x, y, score: clamped, dayIdx: di });
          }
        });

        const { pathD: wPathD, fillPath: wFillPath } = smoothPath(allWeekPts, WEEK_H);
        const weekElem = days7[0]?.element ?? "water";
        const weekColor = elemColor;

        return (
          <div style={{ padding:"12px 18px 10px" }}>
            <svg width="100%" height={WEEK_H + 20} viewBox={`0 0 ${WEEK_W} ${WEEK_H + 20}`} style={{ display:"block", overflow:"visible" }}>
              <rect width={WEEK_W} height={WEEK_H + 20} fill="#f9f7f4" rx="6"/>

              {/* Day separators and labels */}
              {days7.map((d: any, di: number) => {
                const x = di * DAY_W;
                const isToday = d.date === today;
                const ec = ELEMENT_COLORS[d.element ?? "water"] ?? "#888";
                return (
                  <g key={d.date}>
                    {di > 0 && <line x1={x} y1={0} x2={x} y2={WEEK_H} stroke="#e0dcd6" strokeWidth="1"/>}
                    <rect x={x} y={WEEK_H} width={DAY_W} height={20} fill={isToday ? `${ec}30` : "#f0ede8"}/>
                    <text x={x + DAY_W/2} y={WEEK_H + 13} fontSize="8" fill={isToday ? ec : "#999"} fontWeight={isToday ? "700" : "400"} fontFamily="sans-serif" textAnchor="middle">
                      {d.label?.slice(0,3)} {new Date(d.date+"T12:00:00").getDate()}
                    </text>
                    {/* Crossing dots */}
                    {(d.crossings ?? []).map((c: any, ci: number) => {
                      if (!c.time) return null;
                      const [ch, cm] = c.time.split(":").map(Number);
                      const cx_ = x + ((ch - 6) / 18) * DAY_W;
                      const pCol = PLANET_COLORS[c.planet] ?? "#c8b870";
                      return <circle key={ci} cx={cx_} cy={WEEK_H - 4} r={3} fill={pCol} opacity={0.8}/>;
                    })}
                  </g>
                );
              })}

              {/* Wave */}
              {wFillPath && <path d={wFillPath} fill={`${weekColor}20`}/>}
              {wPathD && <path d={wPathD} stroke={weekColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}

              {/* Today marker */}
              {(() => {
                const todayIdx = days7.findIndex((d: any) => d.date === today);
                if (todayIdx < 0) return null;
                const x = todayIdx * DAY_W + DAY_W / 2;
                return <line x1={x} y1={0} x2={x} y2={WEEK_H} stroke="#1a2a3a" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.4"/>;
              })()}
            </svg>
          </div>
        );
      })()}
    </div>
  );
}

// ── WaveRow ────────────────────────────────────────────────────────────────────
type WaveRowType = "practice-resonant" | "practice-supported" | "practice-soften" | "task" | "goal";

const WAVE_ROW_STYLE: Record<WaveRowType, { border: string; dot: string; textColor: string; dim?: boolean }> = {
  "practice-resonant":  { border: "#60a060", dot: "#60a060", textColor: "#2a5020" },
  "practice-supported": { border: "#6090d0", dot: "#6090d0", textColor: "#3a5a80" },
  "practice-soften":    { border: "#d0a060", dot: "#d0a060", textColor: "#8a5020", dim: true },
  "task":               { border: "#c0bab0", dot: "#8080a0", textColor: "#222" },
  "goal":               { border: "#a060c0", dot: "#a060c0", textColor: "#602080" },
};

function WaveRow({ type, label, sub, onCheck }: { type: WaveRowType; label: string; sub?: string; onCheck?: () => void }) {
  const s = WAVE_ROW_STYLE[type];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 18px",
      borderBottom: "1px solid #f5f2ee",
      borderLeft: `3px solid ${s.border}`,
      opacity: s.dim ? 0.6 : 1,
      background: type === "practice-resonant" ? "#fafff8" : "transparent",
    }}>
      {onCheck ? (
        <button onClick={onCheck} style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${s.border}`, background: "transparent", flexShrink: 0, cursor: "pointer" }} />
      ) : (
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: s.textColor, fontWeight: type === "practice-resonant" ? 500 : 400 }}>{label}</div>
        {sub && <div style={{ fontSize: 9, color: "#bbb", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── FourteenDays ───────────────────────────────────────────────────────────────

const MOON_GLYPHS: Record<string, string> = {
  new_moon:"🌑", waxing_crescent:"🌒", first_quarter:"🌓", waxing_gibbous:"🌔",
  full_moon:"🌕", waning_gibbous:"🌖", last_quarter:"🌗", waning_crescent:"🌘",
};
const ASP_SYM: Record<string, string> = { conjunction:"☌", trine:"△", sextile:"⚹", square:"□", opposition:"☍" };
const ASP_COLOR: Record<string, string> = { trine:"#60a060", sextile:"#6090d0", conjunction:"#f0b060", square:"#e06060", opposition:"#e06060" };

function FourteenDays({ week, today }: { week: any; today: string }) {
  const days = week?.days ?? [];
  if (!days.length) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #d8d2ca", borderRadius: 12, padding: "14px 18px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>14 days ahead</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {days.map((day: any) => {
          const isToday = day.date === today;
          const ec = ELEMENT_COLORS[day.element ?? "water"] ?? "#888";
          const phaseKey = (day.moonPhase ?? "").replace(/ /g,"_").toLowerCase();
          const phaseGlyph = MOON_GLYPHS[phaseKey];
          const aspects = (day.moonAspects ?? []) as { planet: string; aspect: string; applying: boolean; orb: number }[];
          const d = new Date(day.date + "T12:00:00");

          return (
            <div key={day.date} style={{
              display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 0",
              borderBottom: "1px solid #f5f2ee",
              background: isToday ? `${ec}08` : "transparent",
              borderLeft: isToday ? `3px solid ${ec}` : "3px solid transparent",
              paddingLeft: 8,
            }}>
              {/* Date */}
              <div style={{ width: 38, flexShrink: 0 }}>
                <div style={{ fontSize: 8.5, textTransform: "uppercase", color: isToday ? ec : "#bbb", fontWeight: isToday ? 700 : 400 }}>
                  {day.label?.slice(0,3)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: isToday ? ec : "#333", lineHeight: 1 }}>
                  {d.getDate()}
                </div>
              </div>
              {/* Moon info */}
              <div style={{ width: 80, flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: ec, fontWeight: 500 }}>{day.moonSign}</div>
                {phaseGlyph && (
                  <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>{phaseGlyph} {day.moonPhase?.replace(/_/g," ").split(" ").slice(0,2).join(" ")}</div>
                )}
                {day.voidPeriods && (
                  <div style={{ fontSize: 8, color: "#9a8050", marginTop: 1 }}>◌ VOC</div>
                )}
              </div>
              {/* Aspects */}
              <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "3px 8px" }}>
                {aspects.map((a, i) => {
                  const sym = ASP_SYM[a.aspect] ?? a.aspect;
                  const col = ASP_COLOR[a.aspect] ?? "#888";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9.5 }}>
                      <span style={{ color: "#7080a0" }}>☽</span>
                      <span style={{ color: col, fontWeight: 700 }}>{sym}</span>
                      <span style={{ color: "#555" }}>{a.planet}</span>
                      {a.applying && <span style={{ fontSize: 7, color: col }}>→</span>}
                    </div>
                  );
                })}
                {aspects.length === 0 && (
                  <div style={{ fontSize: 9, color: "#ddd" }}>quiet</div>
                )}
              </div>
              {/* Crossings */}
              {(day.crossings ?? []).length > 0 && (
                <div style={{ flexShrink: 0, fontSize: 8, color: "#c08020" }}>
                  {(day.crossings as any[]).slice(0,2).map((c: any, i: number) => (
                    <div key={i}>{c.planet[0]} {c.angle} {c.time}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
