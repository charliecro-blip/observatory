import React, { useRef } from "react";
import { CHARACTER_ELEMENT, CHARACTER_ESSENCE, type TideCharacter } from "@/lib/elements";
import { smoothPathD } from "@/lib/smoothPath";

// Lightened element accents that read on the deep night background.
const CHAR_ACCENT: Record<TideCharacter, string> = {
  deep: "#5b8fb9", surge: "#d9694a", building: "#7fa661", clear: "#9b7bd0",
};

const W = 520, H = 680;
const CX0 = 40, CX1 = 480, CY_TOP = 388, CY_BOT = 524; // curve chart region

function fmtDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function TideCard({ now }: { now: any }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tide = now?.tide;
  const character = (tide?.character ?? "deep") as TideCharacter;
  const accent = CHAR_ACCENT[character] ?? "#5b8fb9";
  const curve: any[] = now?.dayArc?.curve ?? [];

  const x = (h: number) => CX0 + (h / 24) * (CX1 - CX0);
  const y = (e: number) => CY_BOT - e * (CY_BOT - CY_TOP);
  const nowH = curve.length ? (Date.now() - new Date(now.dayArc.dayStart).getTime()) / 3600000 : 12;
  const energyAt = (h: number) => {
    if (!curve.length) return 0.5;
    const i = Math.max(0, Math.min(curve.length - 2, Math.floor((h / 24) * (curve.length - 1))));
    const a = curve[i], b = curve[i + 1], sp = (b.hour - a.hour) || 1;
    return a.e + (b.e - a.e) * Math.max(0, Math.min(1, (h - a.hour) / sp));
  };
  const curvePoints = curve.map((p) => ({ x: x(p.hour), y: y(p.e) }));
  const lineD = curve.length ? smoothPathD(curvePoints) : "";
  const areaD = curve.length ? `${lineD} L${CX1},${CY_BOT} L${CX0},${CY_BOT} Z` : "";

  const illum = now?.moonIllumination ?? 0.5;
  const shadowShift = (0.5 - illum) * 44; // moon disc lit fraction

  function download() {
    const el = svgRef.current;
    if (!el) return;
    const xml = new XMLSerializer().serializeToString(el);
    const svg64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = W * scale; canvas.height = H * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `tides-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    };
    img.src = svg64;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W * 0.62} height={H * 0.62}
        xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 18, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        <defs>
          <radialGradient id="bg" cx="50%" cy="34%" r="80%">
            <stop offset="0%" stopColor="#213345" />
            <stop offset="100%" stopColor="#141f2b" />
          </radialGradient>
          <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} rx="18" fill="url(#bg)" />

        {/* Header */}
        <text x="40" y="52" fill="#c0b090" fontSize="14" fontWeight="700" letterSpacing="4" fontFamily="Georgia, serif">AUSPICE</text>
        <text x={W - 40} y="52" textAnchor="end" fill="#8a97a4" fontSize="13" fontFamily="Georgia, serif">{fmtDate()}</text>

        {/* Moon */}
        <g transform={`translate(${W / 2}, 150)`}>
          <circle cx="0" cy="0" r="46" fill="#d8ccb0" />
          <circle cx={shadowShift} cy="0" r="46" fill="#182634" opacity={Math.abs(0.5 - illum) < 0.06 ? 0 : 0.92} />
        </g>

        {/* Headline */}
        <text x={W / 2} y="270" textAnchor="middle" fill={accent} fontSize="46" fontWeight="700"
          fontFamily="Georgia, serif" letterSpacing="-0.5">{tide?.headline ?? "Tide"}</text>
        <text x={W / 2} y="304" textAnchor="middle" fill="#e8e2d6" fontSize="19" fontFamily="Georgia, serif" fontStyle="italic">
          {tide?.levelLabel ?? ""}
        </text>
        <text x={W / 2} y="336" textAnchor="middle" fill="#9aa6b2" fontSize="13.5" fontFamily="Georgia, serif">
          {now?.moonSign ? `${now.moonSign} moon` : ""}{now?.planetaryHour?.planet ? ` · ${now.planetaryHour.planet} hour` : ""}
        </text>

        {/* The signature tide curve */}
        {curve.length > 1 && (
          <>
            <path d={areaD} fill="url(#tideFill)" />
            <path d={lineD} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.95" />
            <circle cx={x(nowH)} cy={y(energyAt(nowH))} r="6" fill={accent} stroke="#141f2b" strokeWidth="2.5" />
          </>
        )}
        {/* baseline */}
        <line x1={CX0} y1={CY_BOT} x2={CX1} y2={CY_BOT} stroke="#2c3d4e" strokeWidth="1" />

        {/* Guidance */}
        <text x={W / 2} y="576" textAnchor="middle" fill="#cdd4dc" fontSize="15" fontFamily="Georgia, serif">
          {CHARACTER_ESSENCE[character]}
        </text>

        {/* Footer */}
        <text x={W / 2} y={H - 34} textAnchor="middle" fill="#6a7682" fontSize="12" letterSpacing="1.5" fontFamily="Georgia, serif">
          your rhythm, read daily
        </text>
      </svg>

      <button onClick={download} style={{
        fontSize: 12, padding: "8px 18px", borderRadius: 9, border: "none",
        background: "#1a2a3a", color: "#f0ede8", cursor: "pointer", fontWeight: 600,
      }}>↓ Download image</button>
    </div>
  );
}

// ── Weekly report card ───────────────────────────────────────────────────────

function feltFor(testerId: string | null, date: string): { felt?: string; character?: string } | null {
  try { return JSON.parse(localStorage.getItem(`obs_felt_${testerId ?? "anon"}_${date}`) ?? "null"); } catch { return null; }
}

export function WeeklyCard({ week, northStars, testerId }: { week: any; northStars: any[]; testerId: string | null }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const days: any[] = (week?.days ?? []).slice(0, 7);
  if (!days.length) return <div style={{ fontSize: 12, color: "#999", padding: 30 }}>Loading the week…</div>;

  const BAR_X0 = 56, BAR_W = 52, BAR_GAP = 8, BAR_BASE = 380, BAR_MAX = 150;

  // Felt-rating retrospective for the shown week
  const feltCounts: Record<string, { aligned: number; total: number }> = {};
  let ratedDays = 0;
  for (const d of days) {
    const r = feltFor(testerId, d.date);
    if (r?.felt) {
      ratedDays++;
      const c = r.character ?? d.tide?.character ?? "deep";
      feltCounts[c] = feltCounts[c] ?? { aligned: 0, total: 0 };
      feltCounts[c].total++;
      if (r.felt === "aligned") feltCounts[c].aligned++;
    }
  }
  const bestChar = Object.entries(feltCounts).sort((a, b) => (b[1].aligned / b[1].total) - (a[1].aligned / a[1].total))[0]?.[0] ?? null;

  const sessionsDone = (northStars ?? []).reduce((n, s) => n + (s.completedCount ?? 0), 0);
  const starCount = (northStars ?? []).length;

  const weekStart = new Date(days[0].date + "T12:00:00");
  const weekEnd = new Date(days[days.length - 1].date + "T12:00:00");
  const rangeLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  function download() {
    const el = svgRef.current;
    if (!el) return;
    const xml = new XMLSerializer().serializeToString(el);
    const svg64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 520 * 2; canvas.height = 680 * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `tides-week-${days[0].date}.png`;
      a.click();
    };
    img.src = svg64;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg ref={svgRef} viewBox="0 0 520 680" width={520 * 0.62} height={680 * 0.62}
        xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 18, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        <defs>
          <radialGradient id="wbg" cx="50%" cy="30%" r="85%">
            <stop offset="0%" stopColor="#213345" /><stop offset="100%" stopColor="#141f2b" />
          </radialGradient>
        </defs>
        <rect width="520" height="680" rx="18" fill="url(#wbg)" />

        <text x="40" y="52" fill="#c0b090" fontSize="14" fontWeight="700" letterSpacing="4" fontFamily="Georgia, serif">AUSPICE</text>
        <text x="480" y="52" textAnchor="end" fill="#8a97a4" fontSize="13" fontFamily="Georgia, serif">{rangeLabel}</text>

        <text x="260" y="110" textAnchor="middle" fill="#e8e2d6" fontSize="26" fontWeight="700" fontFamily="Georgia, serif">The week's tides</text>

        {/* 7 day bars, colored by character */}
        {days.map((d, i) => {
          const char = (d.tide?.character ?? "deep") as TideCharacter;
          const accent = CHAR_ACCENT[char] ?? "#5b8fb9";
          const e = d.tide?.energy ?? 0.5;
          const h = 24 + e * BAR_MAX;
          const x0 = BAR_X0 + i * (BAR_W + BAR_GAP);
          const dow = new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
          const r = feltFor(testerId, d.date);
          return (
            <g key={d.date}>
              <rect x={x0} y={BAR_BASE - h} width={BAR_W} height={h} rx="7" fill={accent} opacity="0.75" />
              {r?.felt && (
                <circle cx={x0 + BAR_W / 2} cy={BAR_BASE - h - 14} r="4"
                  fill={r.felt === "aligned" ? "#7fc98f" : r.felt === "mixed" ? "#d9b96a" : "#c98a7f"} />
              )}
              <text x={x0 + BAR_W / 2} y={BAR_BASE + 20} textAnchor="middle" fill="#8a97a4" fontSize="11" fontFamily="Georgia, serif">{dow}</text>
            </g>
          );
        })}
        <line x1="40" y1={BAR_BASE} x2="480" y2={BAR_BASE} stroke="#2c3d4e" strokeWidth="1" />

        {/* Legend */}
        <g fontFamily="Georgia, serif" fontSize="11">
          {(["deep","surge","building","clear"] as TideCharacter[]).map((c, i) => (
            <g key={c} transform={`translate(${60 + i * 105}, 436)`}>
              <rect width="10" height="10" rx="3" fill={CHAR_ACCENT[c]} opacity="0.75" />
              <text x="16" y="9" fill="#8a97a4">{c.charAt(0).toUpperCase() + c.slice(1)}</text>
            </g>
          ))}
        </g>

        {/* Summary lines */}
        <text x="260" y="500" textAnchor="middle" fill="#cdd4dc" fontSize="15" fontFamily="Georgia, serif">
          {starCount > 0 ? `${sessionsDone} North Star session${sessionsDone === 1 ? "" : "s"} this week` : "Set a North Star to track the week's work"}
        </text>
        {bestChar && ratedDays >= 2 && (
          <text x="260" y="530" textAnchor="middle" fill={CHAR_ACCENT[bestChar as TideCharacter] ?? "#cdd4dc"} fontSize="14" fontStyle="italic" fontFamily="Georgia, serif">
            Most aligned on {bestChar.charAt(0).toUpperCase() + bestChar.slice(1)} tides
          </text>
        )}
        {ratedDays > 0 && (
          <text x="260" y="558" textAnchor="middle" fill="#6a7682" fontSize="12" fontFamily="Georgia, serif">
            {ratedDays} of {days.length} days logged
          </text>
        )}

        <text x="260" y="646" textAnchor="middle" fill="#6a7682" fontSize="12" letterSpacing="1.5" fontFamily="Georgia, serif">
          your rhythm, read weekly
        </text>
      </svg>

      <button onClick={download} style={{
        fontSize: 12, padding: "8px 18px", borderRadius: 9, border: "none",
        background: "#1a2a3a", color: "#f0ede8", cursor: "pointer", fontWeight: 600,
      }}>↓ Download image</button>
    </div>
  );
}

export function TideCardModal({ now, week, northStars, testerId, onClose }: {
  now: any; week?: any; northStars?: any[]; testerId?: string | null; onClose: () => void;
}) {
  const [mode, setMode] = React.useState<"daily" | "weekly">("daily");
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(15,20,30,0.6)", zIndex: 1100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ background: "var(--color-card-2)", borderRadius: 16, padding: "20px", position: "relative", maxHeight: "92vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 14, background: "none", border: "none", fontSize: 20, color: "#aaa", cursor: "pointer", zIndex: 1 }}>×</button>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
          {(["daily", "weekly"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              fontSize: 11, padding: "4px 14px", borderRadius: 14, cursor: "pointer",
              border: mode === m ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
              background: mode === m ? "#1a2a3a" : "transparent",
              color: mode === m ? "#f0ede8" : "var(--color-muted)", fontWeight: mode === m ? 600 : 400,
            }}>{m === "daily" ? "Today" : "This week"}</button>
          ))}
        </div>
        {mode === "daily" ? <TideCard now={now} /> : <WeeklyCard week={week} northStars={northStars ?? []} testerId={testerId ?? null} />}
      </div>
    </div>
  );
}
