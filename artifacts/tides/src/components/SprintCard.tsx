/**
 * The finished-sprint card — the first shareable object that works at every
 * lens (loyalty audit 2026-08-18, B3/A4).
 *
 * "I did a 7-day dopamine fast" travels; "I use a scheduling app" does not.
 * This renders that sentence as an object, reusing the Studio's palette,
 * chrome and PNG exporter rather than starting a second card system.
 *
 * WHAT IT REPORTS, AND WHAT IT DELIBERATELY OMITS.
 * The card states what HAPPENED: the push, the days kept, the window. It
 * does NOT render the target count. A private aim missed by two is a fact
 * worth keeping in the app and a shaming thing to publish under someone's
 * name — and this product's whole retention argument is that it never turns
 * a shortfall into an accusation. "4 days kept" is true and stands on its
 * own. Nothing here compares one person to another, and nothing posts
 * itself: the export is a download the person chooses.
 *
 * THE SKY IS OPTIONAL HERE TOO. At the quiet lens the transit line is
 * absent entirely — not softened, absent — so a secular user's card carries
 * no vocabulary they did not opt into.
 */

import { useRef, useState } from "react";
import { SURFACE, SERIF, Chrome, exportPng } from "@/components/Studio";
import type { GlyphTheme } from "@/lib/celestialGlyphs";
import { useAstroDetail } from "@/contexts/preferences-context";

export interface SprintCardSubject {
  title: string;
  startDate: string;
  endDate: string;
  tally: number;
  transitLabel?: string | null;
}

const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function wrapTitle(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines.slice(0, 3);
}

export default function SprintCard({ sprint, onClose }: { sprint: SprintCardSubject; onClose: () => void }) {
  const [theme, setTheme] = useState<GlyphTheme>("tide");
  const [format, setFormat] = useState<"story" | "post">("post");
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const { level } = useAstroDetail();
  const skyQuiet = level === "minimal";

  const W = 1080, H = format === "story" ? 1920 : 1350;
  const s = SURFACE[theme];
  const story = H > 1500;

  const days = Math.round((Date.parse(sprint.endDate) - Date.parse(sprint.startDate)) / 86400000) + 1;
  const titleLines = wrapTitle(sprint.title, 18);
  const window = `${fmtDay(sprint.startDate)} – ${fmtDay(sprint.endDate)}`;
  const showTransit = !skyQuiet && !!sprint.transitLabel;

  const countY = story ? 700 : 560;
  const titleY = story ? 1010 : 820;
  const metaY = story ? 1320 : 1080;

  async function doExport() {
    if (!svgRef.current) return;
    setBusy(true);
    try {
      await exportPng(svgRef.current, W, H, `compass-sprint-${sprint.startDate}.png`);
    } finally { setBusy(false); }
  }

  // Same shape as the Studio's control — one idiom for the two card surfaces.
  const Seg = ({ value, onPick, options }: {
    value: string; onPick: (v: any) => void; options: [string, string][];
  }) => (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onPick(v)} style={{
          fontSize: 11, padding: "5px 13px", borderRadius: 16, cursor: "pointer",
          border: value === v ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
          background: value === v ? "#1a2a3a" : "transparent",
          color: value === v ? "#ffffff" : "var(--color-muted)", fontWeight: value === v ? 600 : 400,
        }}>{label}</button>
      ))}
    </div>
  );

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(15,20,30,0.6)", zIndex: 1100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ background: "var(--color-card)", borderRadius: 16, padding: 20, position: "relative", maxHeight: "94vh", overflowY: "auto", display: "flex", gap: 22 }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 10, right: 14, background: "none", border: "none", fontSize: 20, color: "var(--text-3)", cursor: "pointer", zIndex: 1 }}>×</button>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 210, paddingTop: 6 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>A sprint, finished</div>
            <div style={{ fontSize: 10.5, color: "var(--color-muted)", marginTop: 2, lineHeight: 1.5 }}>
              Yours to keep or post. Nothing is shared unless you send it somewhere.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-muted)", marginBottom: 5 }}>Format</div>
            <Seg value={format} onPick={setFormat} options={[["post", "Post 4:5"], ["story", "Story 9:16"]]} />
          </div>
          <div>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-muted)", marginBottom: 5 }}>Theme</div>
            <Seg value={theme} onPick={setTheme} options={[["tide", "Tide"], ["almanac", "Almanac"], ["observatory", "Observatory"], ["minimal", "Minimal"]]} />
          </div>
          <button onClick={doExport} disabled={busy} style={{
            marginTop: 6, fontSize: 12.5, padding: "9px 18px", borderRadius: 9, border: "none",
            background: "#1a2a3a", color: "#ffffff", cursor: busy ? "default" : "pointer", fontWeight: 600,
          }}>{busy ? "Rendering…" : `↓ Export PNG · ${W}×${H}`}</button>
        </div>

        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
          style={{ width: format === "story" ? 300 : 340, height: "auto", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.3)", flexShrink: 0 }}>
          <rect width={W} height={H} fill={s.bg} />
          <Chrome W={W} H={H} theme={theme} kicker={`${days} days`} />
          <g fontFamily={SERIF} textAnchor="middle">
            {/* What happened, as the hero: days kept. Never a percentage,
                never the private target. */}
            <text x={W / 2} y={countY} fontSize={story ? 300 : 240} fill={s.ink}>{sprint.tally}</text>
            <text x={W / 2} y={countY + (story ? 90 : 74)} fontSize={story ? 40 : 34} letterSpacing={4} fill={s.sub}>
              {sprint.tally === 1 ? "DAY KEPT" : "DAYS KEPT"}
            </text>
            {titleLines.map((line, i) => (
              <text key={i} x={W / 2} y={titleY + i * (story ? 78 : 66)} fontSize={story ? 66 : 56} fill={s.ink}>{line}</text>
            ))}
            <text x={W / 2} y={metaY} fontSize={story ? 34 : 30} fill={s.sub}>{window}</text>
            {showTransit && (
              <text x={W / 2} y={metaY + (story ? 54 : 46)} fontSize={story ? 30 : 26} fontStyle="italic" fill={s.sub}>
                while {sprint.transitLabel}
              </text>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
