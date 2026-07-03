import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ELEMENT_COLORS, CHARACTER_ELEMENT, type TideCharacter } from "@/lib/elements";
import { smoothPathD } from "@/lib/smoothPath";
import { useTester } from "@/contexts/tester-context";
import { isWithinFreeWindow } from "@/lib/chronotype";
import { railSunTimes } from "@/components/Rail";

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
  conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍",
};

const CHARACTER_WORD: Record<string, string> = {
  deep: "Deep", surge: "Surge", building: "Building", clear: "Clear",
};

// Deepwater tone the vertical gradient sinks into (shared across characters so
// the "deep" always feels like the same ocean).
const DEEP = "#141d30";

function easeInOut(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function clockAt(dayStartMs: number, hour: number) {
  return new Date(dayStartMs + hour * 3600000)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase().replace(" ", "");
}

export function UnifiedTideChart({ arc, now, lat, lon }: { arc: any; now: any; lat: number; lon: number }) {
  const { profile } = useTester();
  const W = 700, H = 210, PAD_T = 12, PAD_B = 26;
  const WATER_TOP = PAD_T + 26;      // highest the surface can reach (leaves sky visible)
  const WATER_BOT = H - PAD_B - 14;  // lowest the surface can fall (keeps some depth)
  const [lens, setLens] = useState("overall");
  const lenses: { key: string; label: string }[] = arc.lenses ?? [{ key: "overall", label: "Overall" }];
  const dark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
  const reduceMotion = useRef(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;

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

  if (target.length < 2 || dispE.length < 2) return null;

  // ── Normalization: the day's own range fills the water column, floored so a
  // near-flat day amplifies at most ~5x instead of turning noise into cliffs.
  const minE = Math.min(...dispE), maxE = Math.max(...dispE);
  const mid = (minE + maxE) / 2;
  const span = Math.max(maxE - minE, 0.16);
  const lo = mid - span / 2, hi = mid + span / 2;
  const x = (h: number) => (h / 24) * W;
  const y = (e: number) => WATER_BOT - ((e - lo) / (hi - lo)) * (WATER_BOT - WATER_TOP);

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

  const events: any[] = (arc.events ?? []).filter((e: any) => e.kind === "aspect" || e.kind === "ingress");
  const nextEvent = events.find((e: any) => !e.past);
  const nowSeg = segByHour(Math.max(0, Math.min(24, nowH)));
  const nowChar = (nowSeg?.character ?? "water") as string;
  const nowEl = CHARACTER_ELEMENT[nowChar as TideCharacter] ?? "water";
  const nowColor = ELEMENT_COLORS[nowEl] ?? "#4a6a90";
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
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>The tide today</div>
        <div style={{ fontSize: 9.5, color: nowColor, fontWeight: 600 }}>
          {CHARACTER_WORD[nowChar] ?? "—"} water <span style={{ color: "#aaa", fontWeight: 400 }}>· {heightWord}</span>
        </div>
      </div>

      {lenses.length > 1 && (
        <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
          {lenses.map((L) => (
            <button key={L.key} onClick={() => setLens(L.key)} style={{
              fontSize: 10, padding: "3px 11px", borderRadius: 20, cursor: "pointer",
              border: lens === L.key ? "1px solid #1a2a3a" : "1px solid #e0dad0",
              background: lens === L.key ? "#1a2a3a" : "var(--color-card-2)",
              color: lens === L.key ? "var(--color-background)" : "#8a8278",
              fontWeight: lens === L.key ? 600 : 400,
            }}>{L.label}</button>
          ))}
        </div>
      )}

      {lens !== "overall" && bestTimes?.windows?.length > 0 && (() => {
        const chronotype = profile?.chronotype;
        const allWindows: any[] = bestTimes.windows;
        const ranked = chronotype
          ? [...allWindows.filter(w => isWithinFreeWindow(w, chronotype)), ...allWindows.filter(w => !isWithinFreeWindow(w, chronotype))]
          : allWindows;
        const shown = ranked.slice(0, 3);
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, fontSize: 10.5, color: "#6a6258" }}>
            <span style={{ color: "#999" }}>Best this week for {bestTimes.windows[0].label}:</span>
            {shown.map((w: any, i: number) => {
              const fits = chronotype ? isWithinFreeWindow(w, chronotype) : null;
              return (
                <span key={i} style={{ fontWeight: 500, color: "var(--color-foreground)" }}>
                  {fits && <span title="Fits your usual free time" style={{ color: "#4a8060", marginRight: 2 }}>✓</span>}
                  {new Date(w.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })} {w.startClock}–{w.endClock}
                  {i < shown.length - 1 ? " ·" : ""}
                </span>
              );
            })}
          </div>
        );
      })()}

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", borderRadius: 8, overflow: "hidden" }}>
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
        </defs>

        {/* Sky */}
        <rect x="0" y="0" width={W} height={H - PAD_B} fill="url(#twSky)" opacity={dark ? 0.9 : 0.75} />

        {/* Sunrise / sunset ticks */}
        {[{ h: srH, up: true }, { h: ssH, up: false }].map(({ h, up }, i) => (h > 0 && h < 24) ? (
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
        <g className="tw-layer-b" opacity={dark ? 0.14 : 0.12}>
          <path d={extArea} fill="url(#twChar)" transform="translate(0,16)" />
        </g>
        <g className="tw-layer-a" opacity={dark ? 0.22 : 0.18}>
          <path d={extArea} fill="url(#twChar)" transform="translate(0,8)" />
        </g>
        <path d={surfaceArea} fill="url(#twChar)" opacity={dark ? 0.42 : 0.34} />
        <path d={surfaceArea} fill="url(#twDepth)" />
        <path d={surfaceD} fill="none" stroke="url(#twChar)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <path d={surfaceD} fill="none" stroke={dark ? "rgba(240,246,255,0.5)" : "rgba(255,255,255,0.75)"} strokeWidth="0.9"
          strokeLinejoin="round" strokeLinecap="round" transform="translate(0,-1.1)" />

        {/* High / low water — the tide table */}
        <g>
          <circle cx={x(hours[hiIdx])} cy={y(targetE[hiIdx])} r="2.6" fill={dark ? "#f0f4ff" : "#fff"} stroke="url(#twChar)" strokeWidth="1.4" />
          <text x={hiX} y={Math.max(WATER_TOP - 16, y(targetE[hiIdx]) - 12)} textAnchor="middle" fontSize="9" fontWeight="700" fill={dark ? "#dfe6f5" : "#3a3428"}>
            high water {clockAt(dayStartMs, hours[hiIdx])}
          </text>
          <text x={loX} y={Math.min(H - PAD_B - 6, y(targetE[loIdx]) + 16)} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={dark ? "#8f9ab4" : "rgba(255,255,255,0.95)"}>
            low water {clockAt(dayStartMs, hours[loIdx])}
          </text>
        </g>

        {/* Event dots — quiet, on the surface */}
        {events.map((e: any, i: number) => {
          const h = hourOf(e.time);
          if (h < 0 || h > 24) return null;
          const isNext = e === nextEvent;
          const col = e.kind === "ingress" ? "#7fae72" : e.aspect === "square" || e.aspect === "opposition" ? "#c08a8a" : "#9db4d4";
          return (
            <g key={i} opacity={e.past ? 0.35 : 1}>
              <circle cx={x(h)} cy={y(energyAt(h))} r={isNext ? 3.4 : 2.4} fill={isNext ? col : (dark ? "#1a2233" : "#fff")} stroke={col} strokeWidth="1.3" />
            </g>
          );
        })}

        {/* NEXT — the one labeled event */}
        {nextEvent && (() => {
          const h = hourOf(nextEvent.time);
          if (h < 0 || h > 24) return null;
          const ex = x(h), ey = y(energyAt(h));
          const glyph = nextEvent.kind === "ingress" ? "⇒" : (ASPECT_GLYPH[nextEvent.aspect] ?? "·");
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
            <circle className="tw-halo" cx={x(nowH)} cy={y(energyAt(nowH))} r="10" fill={nowColor} />
            <circle cx={x(nowH)} cy={y(energyAt(nowH))} r="4.6" fill={nowColor} stroke={dark ? "#0d1120" : "#fff"} strokeWidth="2" />
          </g>
        )}

        {/* Hour axis */}
        {[0, 6, 12, 18, 24].map((h) => (
          <text key={h} x={Math.min(W - 10, Math.max(10, x(h)))} y={H - 8} textAnchor="middle" fontSize="8" fill={axisCol}>
            {h === 0 || h === 24 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`}
          </text>
        ))}
      </svg>

      {/* Upcoming events — only what's ahead */}
      {(() => {
        const upcoming = events.filter((e: any) => !e.past).slice(0, 4);
        if (!upcoming.length) return null;
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
            {upcoming.map((e: any, i: number) => (
              <div key={i} style={{ fontSize: 10, color: labelCol, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#aaa" }}>{e.clock}</span>
                <span>{e.kind === "ingress" ? "⇒" : (ASPECT_GLYPH[e.aspect] ?? "·")}</span>
                <span>{e.label}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
