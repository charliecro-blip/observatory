import React, { useState, useEffect, useRef } from "react";
import { localToday } from "@/lib/dates";
import { useQuery } from "@tanstack/react-query";
import { ELEMENT_COLORS, CHARACTER_ELEMENT, type TideCharacter } from "@/lib/elements";
import { smoothPathD } from "@/lib/smoothPath";
import { useTester } from "@/contexts/tester-context";
import { isWithinFreeWindow, isAwakeDuring, sleepIntervals } from "@/lib/chronotype";
import { railSunTimes } from "@/components/Rail";
import { useTidesWeek } from "@/hooks/useTides";
import type { WeekDay } from "@/lib/types";

// The hero. If the app is called Tides, this picture carries the brand — it has
// to read as WATER under a real SKY, and answer three questions at a glance:
// what is now, what's next, when is high water. Design decisions:
//  - Sky above the waterline is a time-of-day gradient anchored to the user's
//    real sunrise/sunset — the chart doubles as a sun-clock.
//  - The day's own range fills the canvas (with a floor so quiet days don't
//    become fake mountains); absolute height lives in the label, not the axis.
//  - Tide-table callouts: "high water 5:52p" / "low water 3:10a".
//  - One labeled NEXT event chip; everything else stays a quiet dot.
//  - Lens switches morph the same water instead of swapping charts.

const ASPECT_GLYPH: Record<string, string> = {
  conjunction: "☌︎", sextile: "⚹", square: "□", trine: "△", opposition: "☍︎",
};

const CHARACTER_WORD: Record<string, string> = {
  deep: "Deep", surge: "Surge", building: "Building", clear: "Clear",
};

// Plain-language readings for the element lenses — the treaty bridge: the
// element names the domain, the hint says what kind of doing it means.
const LENS_HINTS: Record<string, string> = {
  fire:  "bold moves — start, train, perform, lead",
  earth: "build & finish — craft, tend, organize, complete",
  air:   "words & connection — write, meet, learn, trade",
  water: "feeling & rest — heal, dream, tend the inner life",
};

// Deepwater tone the vertical gradient sinks into (shared across characters so
// the "deep" always feels like the same ocean).
const DEEP = "#141d30";

// Muted equivalents for the low-stimulation styles — same hue family, desaturated
// and lightened so nothing reads as bright or saturated against the card background.
const MUTED_ELEMENT_COLORS: Record<string, string> = {
  fire: "#a87868", earth: "#7a9070", air: ELEMENT_COLORS.air, water: "#6c8398",
};

export type ChartStyle = "water" | "calm" | "minimal" | "bars";
export const CHART_STYLES: { key: ChartStyle; label: string; hint: string }[] = [
  { key: "water",   label: "Water",   hint: "animated sea + sky — the original" },
  { key: "calm",    label: "Calm",    hint: "muted, mostly still" },
  { key: "minimal", label: "Minimal", hint: "one quiet line" },
  { key: "bars",    label: "Bars",    hint: "flat character strip, no curve" },
];

function easeInOut(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function clockAt(dayStartMs: number, hour: number) {
  return new Date(dayStartMs + hour * 3600000)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase().replace(" ", "");
}

// Week/month view — one bar per day (a day is a discrete unit at this zoom,
// not a continuous curve), muted palette to match the "calm" day style.
function WeekMonthStrip({ days, dark, timeframe }: { days: WeekDay[]; dark: boolean; timeframe: "week" | "month" }) {
  const W = 700, H = 150, PAD_T = 10, PAD_B = 22;
  const barTop = PAD_T, barBot = H - PAD_B;
  const n = days.length || 1;
  const gap = timeframe === "week" ? 6 : 2;
  const barW = (W - gap * (n - 1)) / n;
  const todayIso = localToday();
  const labelCol = dark ? "#9aa4bc" : "#7a7264";
  const axisCol = dark ? "#5a6478" : "#c4bcae";

  const energies = days.map((d) => d.tide?.energy ?? (d.qualityScore ?? 4) / 7);
  const minE = Math.min(...energies), maxE = Math.max(...energies);
  const span = Math.max(maxE - minE, 0.15);
  const heightOf = (e: number) => Math.max(6, ((e - minE) / span) * (barBot - barTop - 10) + 10);

  // Sparse date labels for month view — every 5th day plus first/last, to avoid crowding.
  const showLabel = (i: number) => timeframe === "week" ? true : (i === 0 || i === n - 1 || i % 5 === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {days.map((d, i) => {
        const el = d.tide?.element ?? d.element ?? "water";
        const col = MUTED_ELEMENT_COLORS[el] ?? "#8a8f9a";
        const h = heightOf(energies[i]);
        const bx = i * (barW + gap);
        const isToday = d.date === todayIso;
        return (
          <g key={d.date}>
            <rect x={bx} y={barBot - h} width={barW} height={h} rx={timeframe === "week" ? 3 : 1}
              fill={col} opacity={isToday ? (dark ? 0.85 : 0.75) : (dark ? 0.5 : 0.4)} />
            {isToday && <rect x={bx} y={barBot - h} width={barW} height={h} rx={timeframe === "week" ? 3 : 1} fill="none" stroke={col} strokeWidth="1.4" />}
            {showLabel(i) && (
              <text x={bx + barW / 2} y={H - 7} textAnchor="middle" fontSize={timeframe === "week" ? 9 : 7.5} fill={isToday ? labelCol : axisCol}>
                {timeframe === "week" ? d.label.slice(0, 3) : new Date(d.date + "T12:00:00").getDate()}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function UnifiedTideChart({ arc, now, lat, lon }: { arc: any; now: any; lat: number; lon: number }) {
  const { profile } = useTester();
  const W = 700, H = 210, PAD_T = 12, PAD_B = 26;
  const WATER_TOP = PAD_T + 26;      // highest the surface can reach (leaves sky visible)
  const WATER_BOT = H - PAD_B - 14;  // lowest the surface can fall (keeps some depth)
  const [lens, setLens] = useState("overall");
  const [style, setStyle] = useState<ChartStyle>(() => {
    const saved = localStorage.getItem("tw_style");
    return (saved === "calm" || saved === "minimal" || saved === "bars" || saved === "water") ? saved : "calm";
  });
  const setChartStyle = (s: ChartStyle) => { setStyle(s); localStorage.setItem("tw_style", s); };
  const [timeframe, setTimeframe] = useState<"day" | "week" | "month">(() => {
    const saved = localStorage.getItem("tw_timeframe");
    return (saved === "week" || saved === "month") ? saved : "day";
  });
  const setChartTimeframe = (t: "day" | "week" | "month") => { setTimeframe(t); localStorage.setItem("tw_timeframe", t); };
  const { data: weekData } = useTidesWeek(timeframe === "month" ? 30 : 7, lat, lon);
  // Display options — user-tunable, persisted. "fill" = the day's own range
  // fills the canvas (dramatic); off = true 0..1 height (honest/even). Only
  // relevant to the "water" style — the other styles have their own fixed look.
  const [showOpts, setShowOpts] = useState(false);
  // fill:false → absolute energy column (the honest default: a quiet day reads
  // quiet). fill:true → the old min-max stretch that fills the frame.
  const [opts, setOptsState] = useState<{ sky: boolean; motion: boolean; fill: boolean }>(() => {
    try { return { sky: true, motion: true, fill: false, ...JSON.parse(localStorage.getItem("tw_options") ?? "{}") }; }
    catch { return { sky: true, motion: true, fill: false }; }
  });
  const setOpt = (k: "sky" | "motion" | "fill", v: boolean) =>
    setOptsState(o => { const n = { ...o, [k]: v }; localStorage.setItem("tw_options", JSON.stringify(n)); return n; });
  const lenses: { key: string; label: string }[] = arc.lenses ?? [{ key: "overall", label: "Overall" }];
  const dark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
  const reduceMotion = useRef(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;

  // Hover-to-inspect (#tide-chart): scrub the day and read what's driving the
  // water at that moment — the level, the character, and any aspect/ingress/void.
  const [hoverH, setHoverH] = useState<number | null>(null);
  // POINTER events, not mouse events. The scrub — level, character, and the
  // aspect driving it — was bound to onMouseMove/onMouseLeave only, so the
  // hero chart's entire inspect interaction did not exist on a phone, and
  // phones are most of the cohort. Pointer events cover mouse, touch and pen
  // in one path rather than a parallel touch implementation.
  const onScrub = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    setHoverH(Math.max(0, Math.min(24, (vx / W) * 24)));
  };
  // Only capture the pointer once a touch drag is genuinely horizontal —
  // otherwise the chart swallows vertical page scrolling, which is far worse
  // than not having the scrub at all.
  const dragStart = useRef<{ x: number; y: number; capturing: boolean } | null>(null);
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragStart.current = { x: e.clientX, y: e.clientY, capturing: e.pointerType === "mouse" };
    onScrub(e); // a tap alone reads that moment
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragStart.current;
    if (e.pointerType === "mouse") { onScrub(e); return; }
    if (!d) return;
    if (!d.capturing) {
      const dx = Math.abs(e.clientX - d.x), dy = Math.abs(e.clientY - d.y);
      if (dy > dx && dy > 6) { dragStart.current = null; setHoverH(null); return; } // let the page scroll
      if (dx > 6) { d.capturing = true; e.currentTarget.setPointerCapture(e.pointerId); }
    }
    if (d.capturing) { e.preventDefault(); onScrub(e); }
  };
  const endScrub = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragStart.current;
    if (d?.capturing && e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    dragStart.current = null;
    if (e.pointerType === "mouse") setHoverH(null); // touch keeps the readout until you tap away
  };

  const { data: bestTimes } = useQuery<any>({
    queryKey: ["best-times", lens, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/best-times?lens=${lens}&lat=${lat}&lon=${lon}&days=7&tz=${new Date().getTimezoneOffset()}`);
      return r.json();
    },
    enabled: lens !== "overall",
    staleTime: 300_000,
  });

  const target: any[] = (arc.curves?.[lens] ?? arc.curve) ?? [];
  const targetE = target.map((p: any) => p.e as number);

  // Morph the displayed curve toward the selected lens — the same water
  // re-shaping, not a chart swap.
  const [dispE, setDispE] = useState<number[]>(targetE);
  const dispRef = useRef(dispE); dispRef.current = dispE;
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const from = dispRef.current;
    if (from.length !== targetE.length || reduceMotion) { setDispE(targetE); return; }
    if (from.every((v, i) => Math.abs(v - targetE[i]) < 1e-4)) return;
    const t0 = performance.now(), DUR = 380;
    const step = (t: number) => {
      const f = easeInOut(Math.min(1, (t - t0) / DUR));
      setDispE(from.map((v, i) => v + (targetE[i] - v) * f));
      if (f < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens, arc]);

  const dayStartMs = new Date(arc.dayStart).getTime();
  const hourOf = (iso: string) => (new Date(iso).getTime() - dayStartMs) / 3600000;
  const nowH = (Date.now() - dayStartMs) / 3600000;

  if (timeframe === "day" && (target.length < 2 || dispE.length < 2)) return null;

  // ── Vertical scale ──────────────────────────────────────────────────────────
  // ABSOLUTE by default: the y-axis is a true 0..1 energy column, so a quiet day
  // (new moon, no hard aspects) sits low in the frame and a charged day rides
  // high — you can see at a glance that "approaching the top of today's curve"
  // is NOT the same as a high-energy day. To keep the day's rhythm legible
  // without faking its level, the SHAPE is gently amplified around the day's own
  // mean (the band's center stays at the true absolute height; only the ripples
  // are magnified). "Fill" mode (the old min-max stretch) remains as a toggle.
  const minE = Math.min(...dispE), maxE = Math.max(...dispE);
  const meanE = dispE.reduce((s, e) => s + e, 0) / dispE.length;
  const SHAPE_GAIN = 2.4;              // magnify ripples so quiet days still read as a shape
  const absOf = (e: number) => Math.max(0, Math.min(1, meanE + (e - meanE) * SHAPE_GAIN));
  const mid = (minE + maxE) / 2;
  const span = Math.max(maxE - minE, 0.16);
  const lo = opts.fill ? mid - span / 2 : 0, hi = opts.fill ? mid + span / 2 : 1;
  const x = (h: number) => (h / 24) * W;
  const y = (e: number) => WATER_BOT - ((( opts.fill ? e : absOf(e)) - lo) / (hi - lo)) * (WATER_BOT - WATER_TOP);

  const hours = target.map((p: any) => p.hour as number);
  const pts = dispE.map((e, i) => ({ x: x(hours[i]), y: y(e) }));
  const surfaceD = smoothPathD(pts);
  // Extended points let the drifting layers slide without exposing edges.
  const extPts = [{ x: -40, y: pts[0].y }, ...pts, { x: W + 40, y: pts[pts.length - 1].y }];
  const extD = smoothPathD(extPts);
  const area = (d: string, fromPts: {x:number;y:number}[]) =>
    `${d} L${fromPts[fromPts.length - 1].x.toFixed(1)},${H - PAD_B} L${fromPts[0].x.toFixed(1)},${H - PAD_B} Z`;
  const surfaceArea = area(surfaceD, pts);
  const extArea = area(extD, extPts);

  const energyAt = (h: number) => {
    const i = Math.max(0, Math.min(dispE.length - 2, Math.floor((h / 24) * (dispE.length - 1))));
    const span2 = hours[i + 1] - hours[i] || 1;
    const f = Math.max(0, Math.min(1, (h - hours[i]) / span2));
    return dispE[i] + (dispE[i + 1] - dispE[i]) * f;
  };

  // ── Character gradient (horizontal, hard stops at ingresses) — the water's hue.
  const segs: any[] = arc.segments ?? [];
  const ingresses = segs.slice(1).map((s: any) => hourOf(s.start));
  const segByHour = (h: number) => segs.find((s: any) => h >= hourOf(s.start) && h < hourOf(s.end)) ?? segs[0];
  const bounds = [0, ...ingresses, 24];
  const charStops: { off: number; color: string }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const seg = segByHour((bounds[i] + bounds[i + 1]) / 2);
    const el = CHARACTER_ELEMENT[(seg?.character ?? "water") as TideCharacter] ?? "water";
    const c = ELEMENT_COLORS[el] ?? "#4a6a90";
    charStops.push({ off: bounds[i] / 24, color: c }, { off: bounds[i + 1] / 24, color: c });
  }
  // Muted equivalent for the "calm" style — same segment structure, desaturated tones.
  const mutedCharStops: { off: number; color: string }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const seg = segByHour((bounds[i] + bounds[i + 1]) / 2);
    const el = CHARACTER_ELEMENT[(seg?.character ?? "water") as TideCharacter] ?? "water";
    const c = MUTED_ELEMENT_COLORS[el] ?? "#8a8f9a";
    mutedCharStops.push({ off: bounds[i] / 24, color: c }, { off: bounds[i + 1] / 24, color: c });
  }

  // ── Sky: time-of-day gradient anchored to real sunrise/sunset.
  const sun = railSunTimes(lat, lon);
  const srH = sun ? (sun.sunrise.getTime() - dayStartMs) / 3600000 : 6;
  const ssH = sun ? (sun.sunset.getTime() - dayStartMs) / 3600000 : 18;
  const sky = dark
    ? { night: "#0d1120", dawn: "#463a58", day: "#22304a", dusk: "#41314a" }
    : { night: "#3a4260", dawn: "#eab68a", day: "#f7f0dd", dusk: "#dd9f6e" };
  const skyStops = [
    { off: 0, c: sky.night }, { off: (srH - 1) / 24, c: sky.night }, { off: srH / 24, c: sky.dawn },
    { off: (srH + 1.6) / 24, c: sky.day }, { off: (ssH - 1.6) / 24, c: sky.day },
    { off: ssH / 24, c: sky.dusk }, { off: (ssH + 1) / 24, c: sky.night }, { off: 1, c: sky.night },
  ].filter(s => s.off >= 0 && s.off <= 1);

  // ── Tide table: high & low water from the target curve (stable during morphs).
  let hiIdx = 0, loIdx = 0;
  targetE.forEach((e, i) => { if (e > targetE[hiIdx]) hiIdx = i; if (e < targetE[loIdx]) loIdx = i; });
  const hiX = Math.max(46, Math.min(W - 46, x(hours[hiIdx])));
  const loX = Math.max(46, Math.min(W - 46, x(hours[loIdx])));

  const events: any[] = (arc.events ?? []).filter((e: any) => e.kind === "aspect" || e.kind === "ingress" || e.kind === "crossing");
  const nextEvent = events.find((e: any) => !e.past);
  const nowSeg = segByHour(Math.max(0, Math.min(24, nowH)));
  const nowChar = (nowSeg?.character ?? "water") as string;
  const nowEl = CHARACTER_ELEMENT[nowChar as TideCharacter] ?? "water";
  const nowColor = ELEMENT_COLORS[nowEl] ?? "#4a6a90";
  const mutedNowColor = MUTED_ELEMENT_COLORS[nowEl] ?? "#8a8f9a";
  const heightWord = (arc.height ?? 0.5) >= 0.62 ? "high water day" : (arc.height ?? 0.5) >= 0.45 ? "mid water" : "quiet water";

  const axisCol = dark ? "#5a6478" : "#c4bcae";
  const labelCol = dark ? "#9aa4bc" : "#7a7264";

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 14px 8px" }}>
      <style>{`
        @keyframes tw-breathe { 0%,100% { opacity:.16; } 50% { opacity:.42; } }
        @keyframes tw-drift-a { from { transform: translateX(-14px); } to { transform: translateX(14px); } }
        @keyframes tw-drift-b { from { transform: translateX(12px); } to { transform: translateX(-12px); } }
        .tw-halo { animation: tw-breathe 2.6s ease-in-out infinite; }
        .tw-layer-a { animation: tw-drift-a 13s ease-in-out infinite alternate; }
        .tw-layer-b { animation: tw-drift-b 19s ease-in-out infinite alternate; }
        @media (prefers-reduced-motion: reduce) {
          .tw-halo, .tw-layer-a, .tw-layer-b { animation: none; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
            The tide {timeframe === "day" ? "today" : timeframe === "week" ? "this week" : "this month"}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {(["day", "week", "month"] as const).map((t) => (
              <button key={t} onClick={() => setChartTimeframe(t)} style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 8, cursor: "pointer", textTransform: "capitalize",
                border: timeframe === t ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                background: timeframe === t ? "var(--color-primary)" : "transparent",
                color: timeframe === t ? "var(--color-card)" : "var(--text-3)",
                fontWeight: timeframe === t ? 600 : 400,
              }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {timeframe === "day" && (
            <div style={{ fontSize: 9.5, color: style === "water" ? nowColor : mutedNowColor, fontWeight: 600 }}>
              {CHARACTER_WORD[nowChar] ?? "—"} water <span style={{ color: "var(--text-3)", fontWeight: 400 }}>· {heightWord}</span>
            </div>
          )}
          {timeframe !== "day" && weekData?.weekElement && (
            <div style={{ fontSize: 9.5, color: mutedNowColor, fontWeight: 600, textTransform: "capitalize" }}>
              {weekData.weekElement}-leaning
            </div>
          )}
          {timeframe === "day" && (
            <button onClick={() => setShowOpts(v => !v)} title="Chart options" style={{
              fontSize: 11, color: showOpts ? "var(--color-primary)" : "var(--text-3)", background: "none",
              border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1,
            }}>⚙</button>
          )}
        </div>
      </div>

      {timeframe === "day" && showOpts && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: opts && style === "water" ? 6 : 0, flexWrap: "wrap" }}>
            {CHART_STYLES.map((s) => (
              <button key={s.key} onClick={() => setChartStyle(s.key)} title={s.hint} style={{
                fontSize: 9.5, padding: "3px 10px", borderRadius: 10, cursor: "pointer",
                border: style === s.key ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
                background: style === s.key ? "#1a2a3a" : "var(--color-card-2)",
                color: style === s.key ? "#fff" : "var(--color-foreground)",
                fontWeight: style === s.key ? 600 : 400,
              }}>{s.label}</button>
            ))}
          </div>
          {style === "water" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([["fill", "fill the day", "true height"], ["sky", "sky", "no sky"], ["motion", "motion", "still"]] as const).map(([k, onLabel, offLabel]) => (
                <button key={k} onClick={() => setOpt(k, !opts[k])} style={{
                  fontSize: 9, padding: "2px 9px", borderRadius: 10, cursor: "pointer",
                  border: "1px solid var(--color-border)",
                  background: opts[k] ? "var(--color-card-2)" : "transparent",
                  color: opts[k] ? "var(--color-foreground)" : "var(--color-muted)",
                }}>{opts[k] ? onLabel : offLabel}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {timeframe === "day" && lenses.length > 1 && (
        <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
          {lenses.map((L) => {
            const ec = (ELEMENT_COLORS as Record<string, string>)[L.key]; // element lenses get their own color
            const active = lens === L.key;
            return (
              <button key={L.key} onClick={() => setLens(L.key)} style={{
                fontSize: 10, padding: "3px 11px", borderRadius: 20, cursor: "pointer",
                border: active ? `1px solid ${ec ?? "#1a2a3a"}` : "1px solid #e0dad0",
                background: active ? (ec ?? "#1a2a3a") : "var(--color-card-2)",
                color: active ? "#fff" : (ec ?? "var(--color-muted)"),
                fontWeight: active ? 600 : 500,
              }}>{L.label}</button>
            );
          })}
          {LENS_HINTS[lens] && (
            <span style={{ fontSize: 9.5, color: "var(--color-muted)", marginLeft: 4 }}>{LENS_HINTS[lens]}</span>
          )}
        </div>
      )}

      {timeframe === "day" && lens !== "overall" && bestTimes?.windows?.length > 0 && (() => {
        const chronotype = profile?.chronotype;
        const allWindows: any[] = bestTimes.windows;
        // Rank: awake + free first, then awake, then asleep (a sky-perfect window
        // at 3am is not a suggestion, it's a taunt).
        const rank = (w: any) => (isAwakeDuring(w, chronotype) ? 0 : 2) + (isWithinFreeWindow(w, chronotype) ? 0 : 1);
        const ranked = chronotype ? [...allWindows].sort((a, b) => rank(a) - rank(b)) : allWindows;
        const shown = ranked.slice(0, 3);
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, fontSize: 10.5, color: "var(--color-muted)" }}>
            <span style={{ color: "var(--text-3)" }}>Best this week for {String(bestTimes.windows[0].label).split(" — ")[0]}:</span>
            {shown.map((w: any, i: number) => {
              const fits = chronotype ? isWithinFreeWindow(w, chronotype) : null;
              const awake = isAwakeDuring(w, chronotype);
              return (
                <span key={i} style={{ fontWeight: 500, color: awake ? "var(--color-foreground)" : "var(--text-3)" }}>
                  {fits && awake && <span title="Fits your usual free time" style={{ color: "#4a8060", marginRight: 2 }}>✓</span>}
                  {!awake && <span title="You're usually asleep" style={{ marginRight: 2 }}>☾</span>}
                  {new Date(w.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })} {w.startClock}–{w.endClock}
                  {i < shown.length - 1 ? " ·" : ""}
                </span>
              );
            })}
          </div>
        );
      })()}

      {timeframe === "day" && <svg viewBox={`0 0 ${W} ${H}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={endScrub} onPointerCancel={endScrub} onPointerLeave={endScrub} style={{ width: "100%", height: "auto", display: "block", borderRadius: 8, overflow: "hidden", cursor: "crosshair", touchAction: "pan-y" }}>
        <defs>
          <linearGradient id="twSky" x1="0" y1="0" x2="1" y2="0">
            {skyStops.map((s, i) => <stop key={i} offset={`${(s.off * 100).toFixed(2)}%`} stopColor={s.c} />)}
          </linearGradient>
          <linearGradient id="twChar" x1="0" y1="0" x2="1" y2="0">
            {charStops.map((s, i) => <stop key={i} offset={`${(s.off * 100).toFixed(2)}%`} stopColor={s.color} />)}
          </linearGradient>
          <linearGradient id="twDepth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={DEEP} stopOpacity="0" />
            <stop offset="100%" stopColor={DEEP} stopOpacity={dark ? "0.85" : "0.55"} />
          </linearGradient>
          <linearGradient id="twMuted" x1="0" y1="0" x2="1" y2="0">
            {mutedCharStops.map((s, i) => <stop key={i} offset={`${(s.off * 100).toFixed(2)}%`} stopColor={s.color} />)}
          </linearGradient>
        </defs>

        {/* ── Hour axis + high/low labels are shared across every style ── */}
        {style === "water" && (<>
          {/* Sky */}
          {opts.sky && <rect x="0" y="0" width={W} height={H - PAD_B} fill="url(#twSky)" opacity={dark ? 0.9 : 0.75} />}

          {/* Sunrise / sunset ticks */}
          {opts.sky && [{ h: srH, up: true }, { h: ssH, up: false }].map(({ h, up }, i) => (h > 0 && h < 24) ? (
            <g key={i} opacity="0.8">
              <text x={x(h)} y={12} textAnchor="middle" fontSize="8" fill={dark ? "#c8b070" : "#b08830"}>☀{up ? "↑" : "↓"}</text>
            </g>
          ) : null)}

          {/* Slack water (VOC) */}
          {(arc.vocWindows ?? []).map((v: any, i: number) => {
            const x0 = x(hourOf(v.start)), x1 = x(hourOf(v.end));
            return (
              <g key={`voc${i}`}>
                <rect x={x0} y={0} width={x1 - x0} height={H - PAD_B} fill={dark ? "rgba(190,190,220,0.05)" : "rgba(120,110,90,0.07)"} />
                <text x={(x0 + x1) / 2} y={WATER_TOP - 6} textAnchor="middle" fontSize="7.5" fill={dark ? "#8a86a0" : "#a89660"} fontStyle="italic">slack water</text>
              </g>
            );
          })}

          {/* Water — drifting depth layers, then the lit surface */}
          <g className={opts.motion ? "tw-layer-b" : undefined} opacity={dark ? 0.14 : 0.12}>
            <path d={extArea} fill="url(#twChar)" transform="translate(0,16)" />
          </g>
          <g className={opts.motion ? "tw-layer-a" : undefined} opacity={dark ? 0.22 : 0.18}>
            <path d={extArea} fill="url(#twChar)" transform="translate(0,8)" />
          </g>
          <path d={surfaceArea} fill="url(#twChar)" opacity={dark ? 0.42 : 0.34} />
          <path d={surfaceArea} fill="url(#twDepth)" />
          <path d={surfaceD} fill="none" stroke="url(#twChar)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          <path d={surfaceD} fill="none" stroke={dark ? "rgba(240,246,255,0.5)" : "rgba(255,255,255,0.75)"} strokeWidth="0.9"
            strokeLinejoin="round" strokeLinecap="round" transform="translate(0,-1.1)" />

          {/* Personal night — hours the user is typically asleep (chronotype).
              Distinct from astronomical night: the sky shows the sun's day, this
              shows YOURS. High water while you sleep is information, not advice. */}
          {sleepIntervals(profile?.chronotype).map(([h0, h1], i) => (
            <g key={`sleep${i}`}>
              <rect x={x(h0)} y={0} width={x(h1) - x(h0)} height={H - PAD_B} fill={DEEP} opacity={dark ? 0.38 : 0.2} />
              {h1 - h0 > 1.5 && (
                <text x={(x(h0) + x(h1)) / 2} y={PAD_T + 8} textAnchor="middle" fontSize="8" fill={dark ? "#7a86a4" : "#8a90a8"} opacity="0.85">☾</text>
              )}
            </g>
          ))}

          {/* Event markers — the same symbols the list below the chart uses.
              They were unlabelled coloured dots here, so the strip reading
              "3:36 PM ⇒ Moon enters Aries" had no findable counterpart on the
              curve; the reader had to convert a clock time into an x position
              by eye. The glyph rides just above its dot, and only the future
              ones carry it — a day's worth of past glyphs is clutter, and the
              dot alone still marks where they were. */}
          {events.map((e: any, i: number) => {
            const h = hourOf(e.time);
            if (h < 0 || h > 24) return null;
            const isNext = e === nextEvent;
            const col = e.kind === "crossing" ? "#c8a84a" : e.kind === "ingress" ? "#7fae72" : e.aspect === "square" || e.aspect === "opposition" ? "#c08a8a" : "#9db4d4";
            const glyph = e.kind === "crossing" ? "◆" : e.kind === "ingress" ? "⇒" : (ASPECT_GLYPH[e.aspect] ?? "·");
            // The NEXT event already gets a full labelled callout below, so it
            // would otherwise show its symbol twice within 30px.
            const showGlyph = !e.past && !isNext;
            // Crossings are ~20-minute PEAK moments — a small diamond above the
            // surface, distinct from the round aspect/ingress dots on it.
            const cy0 = y(energyAt(h));
            const markY = e.kind === "crossing" ? cy0 - 6 : cy0;
            return (
              <g key={i} opacity={e.past ? 0.35 : 1}>
                {e.kind === "crossing" ? (
                  <rect x={x(h) - 2.6} y={markY - 2.6} width={5.2} height={5.2} transform={`rotate(45 ${x(h)} ${markY})`}
                    fill={isNext ? col : (dark ? "#1a2233" : "#fff")} stroke={col} strokeWidth="1.2" />
                ) : (
                  <circle cx={x(h)} cy={markY} r={isNext ? 3.4 : 2.4} fill={isNext ? col : (dark ? "#1a2233" : "#fff")} stroke={col} strokeWidth="1.3" />
                )}
                {showGlyph && (
                  <text x={x(h)} y={markY - 8} textAnchor="middle" fontSize="7.5" fontWeight="700"
                    fill={col} style={{ pointerEvents: "none" }}>{glyph}</text>
                )}
              </g>
            );
          })}

          {/* NEXT — the one labeled event */}
          {nextEvent && (() => {
            const h = hourOf(nextEvent.time);
            if (h < 0 || h > 24) return null;
            const ex = x(h), ey = y(energyAt(h));
            const glyph = nextEvent.kind === "crossing" ? "◆" : nextEvent.kind === "ingress" ? "⇒" : (ASPECT_GLYPH[nextEvent.aspect] ?? "·");
            const label = `${glyph} ${nextEvent.label} · ${nextEvent.clock}`;
            const wEst = label.length * 4.6 + 14;
            const bx = Math.max(4, Math.min(W - wEst - 4, ex - wEst / 2));
            const by = Math.max(4, ey - 34);
            return (
              <g>
                <line x1={ex} y1={ey} x2={ex} y2={by + 18} stroke={dark ? "#8fa0c0" : "#8a8070"} strokeWidth="0.7" strokeDasharray="2,2" opacity="0.6" />
                <rect x={bx} y={by} width={wEst} height={16} rx="8" fill={dark ? "rgba(20,28,46,0.92)" : "rgba(255,255,255,0.92)"} stroke={dark ? "#3a4560" : "#e0d8ca"} strokeWidth="0.8" />
                <text x={bx + wEst / 2} y={by + 11} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={dark ? "#dfe6f5" : "#4a4438"}>{label}</text>
              </g>
            );
          })()}

          {/* Now — beam + breathing halo */}
          {nowH >= 0 && nowH <= 24 && (
            <g>
              <rect x={x(nowH) - 7} y={0} width={14} height={H - PAD_B} fill={nowColor} opacity="0.07" />
              <line x1={x(nowH)} y1={0} x2={x(nowH)} y2={H - PAD_B} stroke={nowColor} strokeWidth="1.2" opacity="0.55" />
              <circle className={opts.motion ? "tw-halo" : undefined} cx={x(nowH)} cy={y(energyAt(nowH))} r="10" fill={nowColor} />
              <circle cx={x(nowH)} cy={y(energyAt(nowH))} r="4.6" fill={nowColor} stroke={dark ? "#0d1120" : "#fff"} strokeWidth="2" />
            </g>
          )}

          <g>
            <circle cx={x(hours[hiIdx])} cy={y(targetE[hiIdx])} r="2.6" fill={dark ? "#f0f4ff" : "#fff"} stroke="url(#twChar)" strokeWidth="1.4" />
            <text x={hiX} y={Math.max(WATER_TOP - 16, y(targetE[hiIdx]) - 12)} textAnchor="middle" fontSize="9" fontWeight="700" fill={dark ? "#dfe6f5" : "#3a3428"}>
              high water {clockAt(dayStartMs, hours[hiIdx])}
            </text>
            <text x={loX} y={Math.min(H - PAD_B - 6, y(targetE[loIdx]) + 16)} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={dark ? "#8f9ab4" : "rgba(255,255,255,0.95)"}>
              low water {clockAt(dayStartMs, hours[loIdx])}
            </text>
          </g>
        </>)}

        {/* ── CALM: muted single-tone fill, no sky, no drift, no glow ── */}
        {style === "calm" && (<>
          {(arc.vocWindows ?? []).map((v: any, i: number) => {
            const x0 = x(hourOf(v.start)), x1 = x(hourOf(v.end));
            return <rect key={`voc${i}`} x={x0} y={0} width={x1 - x0} height={H - PAD_B} fill={dark ? "rgba(190,190,220,0.05)" : "rgba(120,110,90,0.05)"} />;
          })}
          {sleepIntervals(profile?.chronotype).map(([h0, h1], i) => (
            <rect key={`sleep${i}`} x={x(h0)} y={0} width={x(h1) - x(h0)} height={H - PAD_B} fill={DEEP} opacity={dark ? 0.16 : 0.06} />
          ))}
          <path d={surfaceArea} fill="url(#twMuted)" opacity={0.14} />
          <path d={surfaceD} fill="none" stroke="url(#twMuted)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

          {/* Same symbols as the strip below the chart — see the note in the
              water style. "Calm" is the DEFAULT style, so without this the
              markers were invisible to most users; only the vivid style had
              them. Kept monochrome here to respect calm's restraint. */}
          {events.map((e: any, i: number) => {
            const h = hourOf(e.time);
            if (h < 0 || h > 24) return null;
            const glyph = e.kind === "crossing" ? "◆" : e.kind === "ingress" ? "⇒" : (ASPECT_GLYPH[e.aspect] ?? "·");
            const cy0 = y(energyAt(h));
            return (
              <g key={i} opacity={e.past ? 0.3 : 0.7}>
                <circle cx={x(h)} cy={cy0} r="2" fill={dark ? "#2a3142" : "#fff"} stroke={mutedNowColor} strokeWidth="1" />
                {!e.past && (
                  <text x={x(h)} y={cy0 - 7} textAnchor="middle" fontSize="7" fontWeight="600"
                    fill={mutedNowColor} style={{ pointerEvents: "none" }}>{glyph}</text>
                )}
              </g>
            );
          })}

          <text x={hiX} y={Math.max(WATER_TOP - 10, y(targetE[hiIdx]) - 10)} textAnchor="middle" fontSize="9" fontWeight="600" fill={labelCol}>
            high {clockAt(dayStartMs, hours[hiIdx])}
          </text>
          <text x={loX} y={Math.min(H - PAD_B - 6, y(targetE[loIdx]) + 14)} textAnchor="middle" fontSize="9" fontWeight="600" fill={labelCol}>
            low {clockAt(dayStartMs, hours[loIdx])}
          </text>

          {nowH >= 0 && nowH <= 24 && (
            <circle cx={x(nowH)} cy={y(energyAt(nowH))} r="4" fill={mutedNowColor} stroke={dark ? "#141a26" : "#fff"} strokeWidth="1.6" />
          )}
        </>)}

        {/* ── MINIMAL: one quiet monochrome line, nothing else moving ── */}
        {style === "minimal" && (<>
          <path d={surfaceD} fill="none" stroke={axisCol} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          {(arc.vocWindows ?? []).map((v: any, i: number) => (
            <line key={`voc${i}`} x1={x(hourOf(v.start))} y1={H - PAD_B} x2={x(hourOf(v.start))} y2={H - PAD_B + 5} stroke={axisCol} strokeWidth="1" />
          ))}
          <text x={hiX} y={Math.max(WATER_TOP - 8, y(targetE[hiIdx]) - 8)} textAnchor="middle" fontSize="8.5" fill={labelCol}>
            {clockAt(dayStartMs, hours[hiIdx])}
          </text>
          <text x={loX} y={Math.min(H - PAD_B - 4, y(targetE[loIdx]) + 12)} textAnchor="middle" fontSize="8.5" fill={labelCol}>
            {clockAt(dayStartMs, hours[loIdx])}
          </text>
          {nowH >= 0 && nowH <= 24 && (
            <circle cx={x(nowH)} cy={y(energyAt(nowH))} r="3" fill={labelCol} />
          )}
        </>)}

        {/* ── BARS: flat character strip — no curve, no water metaphor ── */}
        {style === "bars" && (() => {
          const barTop = H / 2 - 22, barH = 44;
          return (<>
            {bounds.slice(0, -1).map((b, i) => {
              const seg = segByHour((b + bounds[i + 1]) / 2);
              const el = CHARACTER_ELEMENT[(seg?.character ?? "water") as TideCharacter] ?? "water";
              const col = MUTED_ELEMENT_COLORS[el] ?? "#8a8278";
              return <rect key={i} x={x(b)} y={barTop} width={x(bounds[i + 1]) - x(b)} height={barH} fill={col} opacity={dark ? 0.55 : 0.4} />;
            })}
            {events.map((e: any, i: number) => {
              const h = hourOf(e.time);
              if (h < 0 || h > 24) return null;
              return <circle key={i} cx={x(h)} cy={barTop - 6} r="2" fill={labelCol} opacity={e.past ? 0.3 : 0.8} />;
            })}
            <text x={hiX} y={barTop - 10} textAnchor="middle" fontSize="9" fontWeight="600" fill={labelCol}>high {clockAt(dayStartMs, hours[hiIdx])}</text>
            <text x={loX} y={barTop + barH + 16} textAnchor="middle" fontSize="9" fontWeight="600" fill={labelCol}>low {clockAt(dayStartMs, hours[loIdx])}</text>
            {nowH >= 0 && nowH <= 24 && (
              <line x1={x(nowH)} y1={barTop - 4} x2={x(nowH)} y2={barTop + barH + 4} stroke={nowColor} strokeWidth="2" />
            )}
          </>);
        })()}

        {/* Hour axis */}
        {[0, 6, 12, 18, 24].map((h) => (
          <text key={h} x={Math.min(W - 10, Math.max(10, x(h)))} y={H - 8} textAnchor="middle" fontSize="8" fill={axisCol}>
            {h === 0 || h === 24 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`}
          </text>
        ))}

        {/* ── Hover inspector — a scrub line + a read-out of what's shaping the
            water at the pointer: level, character, and the nearest sky event. ── */}
        {hoverH != null && style !== "bars" && (() => {
          const eH = energyAt(hoverH);
          const px = x(hoverH), py = y(eH);
          const seg = segByHour(hoverH);
          const charLabel = seg?.characterLabel ?? "—";
          const inVoc = (arc.vocWindows ?? []).some((v: any) => hoverH >= hourOf(v.start) && hoverH < hourOf(v.end));
          const floor = arc.height ?? 0.3;
          // What's driving the charge here: every aspect still within its swell
          // (σ≈3.6h), ranked by how much it's lifting the tide *right now*.
          const SIGMA = 3.6;
          const drivers = (arc.events ?? [])
            .filter((ev: any) => ev.kind === "aspect")
            .map((ev: any) => {
              const dh = hourOf(ev.time) - hoverH;
              const env = Math.exp(-0.5 * (dh / SIGMA) ** 2);
              return { ev, contrib: (ev.weight ?? 0) * env };
            })
            .filter((d: any) => d.contrib > 0.004)
            .sort((a: any, b: any) => b.contrib - a.contrib)
            .slice(0, 2);
          const aboveFloor = eH - floor;
          const floorLine = Math.abs(aboveFloor) < 0.02 ? "at the day's still-water floor"
            : `${Math.round(Math.abs(aboveFloor) * 100)}% ${aboveFloor > 0 ? "above" : "below"} the floor`;
          const driverLines: string[] = inVoc ? ["slack water · void of course"]
            : drivers.map((d: any) => `${d.ev.label} · ${d.ev.charge === "high" ? "strong charge" : "barely lifts"}`);
          const lines = [`${charLabel} water · ${floorLine}`, ...driverLines];
          const boxW = Math.max(128, ...lines.map(l => l.length * 5.0 + 20));
          const flip = px > W - boxW - 12;
          const bx = flip ? px - boxW - 8 : px + 8;
          const tc = dark ? "#e8ecf4" : "#f4f6fb";
          const boxH = 22 + lines.length * 12;
          return (
            <g pointerEvents="none">
              <line x1={px} y1={WATER_TOP - 8} x2={px} y2={H - PAD_B} stroke={dark ? "rgba(220,228,245,0.5)" : "rgba(40,50,70,0.4)"} strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={px} cy={py} r="3.6" fill={dark ? "#0d1120" : "#fff"} stroke={dark ? "#c9d4ee" : "#2a3a52"} strokeWidth="1.6" />
              <rect x={bx} y={WATER_TOP - 6} width={boxW} height={boxH} rx="6" fill={dark ? "rgba(16,20,30,0.94)" : "rgba(26,34,52,0.94)"} />
              <text x={bx + 9} y={WATER_TOP + 8} fontSize="9.5" fontWeight="700" fill={tc}>
                {clockAt(dayStartMs, hoverH)} · charge {Math.round(eH * 100)}%
              </text>
              {lines.map((l, li) => (
                <text key={li} x={bx + 9} y={WATER_TOP + 21 + li * 12} fontSize="8.5"
                  fill={li > 0 && inVoc ? "#c8b06a" : (dark ? "#aeb8cc" : "#c2ccde")}>{l}</text>
              ))}
            </g>
          );
        })()}
      </svg>}

      {timeframe !== "day" && (
        weekData?.days?.length ? (
          <>
            <WeekMonthStrip days={weekData.days} dark={dark} timeframe={timeframe} />
            {weekData.weekTone && (
              <div style={{ fontSize: 10.5, color: labelCol, lineHeight: 1.5, marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
                {weekData.weekTone}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 11, color: "var(--text-3)", padding: "24px 0", textAlign: "center" }}>Reading the sky…</div>
        )
      )}

      {/* Upcoming events — only what's ahead */}
      {timeframe === "day" && (() => {
        const upcoming = events.filter((e: any) => !e.past).slice(0, 4);
        if (!upcoming.length) return null;
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
            {upcoming.map((e: any, i: number) => (
              <div key={i} style={{ fontSize: 10, color: labelCol, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "var(--text-3)" }}>{e.clock}</span>
                <span>{e.kind === "crossing" ? "◆" : e.kind === "ingress" ? "⇒" : (ASPECT_GLYPH[e.aspect] ?? "·")}</span>
                <span>{e.label}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
