import { useTester } from "@/contexts/tester-context";
import { useRhythmProposal } from "@/components/RhythmProposal";
import React, { useRef, useState } from "react";
import { localToday } from "@/lib/dates";
import { useQuery } from "@tanstack/react-query";
import {
  glyphChar, GLYPH_INDEX, fontFor, thinFor, GLYPH_ELEMENT_COLORS, type GlyphTheme,
} from "@/lib/celestialGlyphs";
import { SIGN_MYTHOS } from "@/lib/mythos";

/**
 * The Studio — IG-shareable views of the day, the week, and the lunation.
 *
 * Content stance (owner 2026-07-15): cards lead with PRIMARY sky facts —
 * moon sign, phase, planetary day, timed aspects — never the synthetic tide
 * index. "New Moon in Cancer · Mercury's day" is defensible and teachable;
 * a derived energy % is not something to publish under the brand's name.
 *
 * Three subjects × two formats × the four glyph themes, exported as
 * 1080-px PNGs (story 1080×1920, post 1080×1350). Glyphs are real type
 * (celestialGlyphs.ts recipe: FE0E selector, Noto symbol faces, optical
 * thinning as an SVG stroke painted in the surface color).
 */

type Subject = "day" | "week" | "lunation" | "activity" | "rhythm";
type Format = "story" | "post";

// Exported so the sprint card (components/SprintCard.tsx) shares this exact
// palette, chrome and exporter rather than growing a second card system —
// two share surfaces that drift would be the WeekStrip/AlreadyWoven shape in
// the one place users actually publish under the brand's name.
export const SURFACE: Record<GlyphTheme, { bg: string; ink: string; sub: string; line: string }> = {
  tide:        { bg: "#F2EFE9", ink: "#1A2A3A", sub: "#8A8278", line: "#D8D2C8" },
  almanac:     { bg: "#F3E9D6", ink: "#3A3226", sub: "#8A7A5E", line: "#DCCFB4" },
  observatory: { bg: "#0E1420", ink: "#E8ECF4", sub: "#8F9AB4", line: "#263044" },
  minimal:     { bg: "#FFFFFF", ink: "#111111", sub: "#777777", line: "#E2E2E2" },
};

export const SERIF = "Georgia, 'Times New Roman', serif";

// One glyph as SVG text — the celestialGlyphs recipe translated to SVG:
// fill = element color for the theme; the optical-thinning stroke is painted
// in the surface color (SVG paints fill then stroke, so the stroke eats the
// outer edges exactly like -webkit-text-stroke does in HTML).
function G({ name, x, y, size, theme, anchor = "middle" }: {
  name: string; x: number; y: number; size: number; theme: GlyphTheme; anchor?: "start" | "middle" | "end";
}) {
  const gi = GLYPH_INDEX[name];
  if (!gi) return null;
  const color = GLYPH_ELEMENT_COLORS[theme][gi.element];
  const thin = thinFor(name);
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontFamily={fontFor(name)} fill={color}
      stroke={thin > 0 ? SURFACE[theme].bg : "none"} strokeWidth={thin > 0 ? +(thin * size).toFixed(2) : 0}>
      {glyphChar(gi.cp)}
    </text>
  );
}

// Moon phase disc — real terminator geometry: a dark disc, with the LIT region
// drawn as (lit-side semicircle + elliptical terminator whose rx sweeps with
// the phase). Correct at every fraction including the quarters, where the old
// offset-shadow approximation collapsed and rendered a full disc.
function phaseLitPath(cx: number, cy: number, r: number, frac: number, waxing: boolean): string | null {
  const f = Math.max(0, Math.min(1, frac));
  if (f < 0.02) return null;                       // all dark
  const sweep = waxing ? 1 : 0;                    // lit limb: right when waxing, left when waning
  if (f > 0.98) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  const rx = Math.abs(2 * f - 1) * r;              // terminator ellipse half-width
  // terminator bulges toward the dark side when gibbous (f>0.5), toward the lit
  // limb when crescent — which flips the arc's sweep direction. (Return leg runs
  // bottom→top: same sweep as the limb = bulge INTO the dark half = gibbous.)
  const termSweep = f > 0.5 ? sweep : 1 - sweep;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z`;
}
function PhaseDisc({ cx, cy, r, frac, waxing, theme }: { cx: number; cy: number; r: number; frac: number; waxing: boolean; theme: GlyphTheme }) {
  const s = SURFACE[theme];
  const lit = theme === "observatory" ? "#D8CCB0" : theme === "minimal" ? "#CFC8B8" : "#CDBE97";
  const dark = theme === "observatory" ? "#1B2536" : s.line;
  const d = phaseLitPath(cx, cy, r, frac, waxing);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={dark} opacity={0.5} />
      {d && <path d={d} fill={lit} />}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={s.line} strokeWidth={2} />
    </g>
  );
}
const isWaxing = (phaseName?: string) => /new|waxing|first/i.test(phaseName ?? "");

function wrap(text: string, max: number): string[] {
  const words = (text ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

function fmtDay(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Header / footer shared by every card ─────────────────────────────────────
export function Chrome({ W, H, theme, kicker, foot }: { W: number; H: number; theme: GlyphTheme; kicker: string; foot?: string }) {
  const s = SURFACE[theme];
  return (
    <g fontFamily={SERIF}>
      <text x={W / 2} y={110} textAnchor="middle" fontSize={34} letterSpacing={12} fill={s.sub} fontWeight={700}>COMPASS</text>
      <text x={W / 2} y={162} textAnchor="middle" fontSize={26} fill={s.sub}>{kicker}</text>
      <text x={W / 2} y={H - 70} textAnchor="middle" fontSize={26} fontStyle="italic" fill={s.sub}>
        {foot ?? "move with time"}
      </text>
    </g>
  );
}

// ── The Day ──────────────────────────────────────────────────────────────────
function DayCard({ now, W, H, theme }: { now: any; W: number; H: number; theme: GlyphTheme }) {
  const s = SURFACE[theme];
  const story = H > 1500;
  const moonSign = now?.moonSign ?? "Cancer";
  const frac = now?.moonIllumination ?? 0.5;
  const phase = now?.moonPhase ?? "";
  const dayRuler = now?.dayRuler ?? "Sun";
  const events: any[] = ((now?.dayArc?.events ?? []) as any[]).filter(e => e.kind === "aspect" || e.kind === "ingress").slice(0, story ? 3 : 2);
  // The tightest planet-to-planet aspect, if there is a tight one. dayArc's
  // events are lunar and angular only, so a Venus opposite Saturn at 0.2° could
  // never reach a card whose stated stance is that it leads with PRIMARY sky
  // facts — "moon sign, phase, planetary day, timed aspects". It is exactly
  // that, and it is more defensible and more teachable than the planetary day.
  const skyAspect = (((now?.aspects ?? []) as any[])
    .filter(a => a.planet1 !== "Moon" && a.planet2 !== "Moon" && a.orb <= 2)
    .sort((a, b) => a.orb - b.orb))[0] ?? null;
  const ASPECT_WORD: Record<string, string> = {
    conjunction: "meets", opposition: "opposite", square: "square", trine: "trine", sextile: "sextile",
  };
  const favors = (SIGN_MYTHOS[moonSign]?.favors ?? []).slice(0, 3).join(" · ");
  const favLines = wrap(favors, 40);
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const discY = story ? 460 : 380;
  const discR = story ? 150 : 112;
  const signY = story ? 800 : 640;
  const titleY = story ? 910 : 730;
  const phaseY = story ? 962 : 778;
  // The timed events sit ABOVE the planetary day now. The day ruler had a
  // divider and 36px type over them, so a keynote true for twenty-four hours
  // outranked the day's actual timed events — the owner's ordering inverted on
  // the one surface people publish under the brand's name (2026-08-22).
  const evY0 = story ? 1080 : 880;
  const evGap = story ? 74 : 64;
  // The planet aspect, when there is one, takes a line between the timed events
  // and the day ruler — so the ruler needs that line's height as well, or the
  // two sit 38px apart at 31px and 28px type and very nearly touch.
  const rulerY = evY0 + (story ? 3 : 2) * evGap + (skyAspect ? (story ? 82 : 70) : (story ? 40 : 30));
  const favY = story ? 1560 : 1180;

  return (
    <g>
      <Chrome W={W} H={H} theme={theme} kicker={date} />
      <PhaseDisc cx={W / 2} cy={discY} r={discR} frac={frac} waxing={isWaxing(phase)} theme={theme} />
      <G name={moonSign} x={W / 2} y={signY} size={130} theme={theme} />
      <g fontFamily={SERIF}>
        <text x={W / 2} y={titleY} textAnchor="middle" fontSize={64} fill={s.ink} fontWeight={700}>Moon in {moonSign}</text>
        <text x={W / 2} y={phaseY} textAnchor="middle" fontSize={30} fill={s.sub}>
          {phase}{typeof frac === "number" ? ` · ${Math.round(frac * 100)}% lit` : ""}
        </text>
        <line x1={W / 2 - 120} y1={evY0 - 58} x2={W / 2 + 120} y2={evY0 - 58} stroke={s.line} strokeWidth={2} />
        {events.map((e, i) => (
          <g key={i}>
            <text x={W / 2 - 40} y={evY0 + i * evGap} textAnchor="end" fontSize={28} fill={s.sub}>{e.clock}</text>
            <text x={W / 2 - 10} y={evY0 + i * evGap} fontSize={31} fill={s.ink}>{e.label}</text>
          </g>
        ))}
        {skyAspect && (
          <text x={W / 2} y={evY0 + events.length * evGap + (story ? 12 : 8)} textAnchor="middle" fontSize={31} fill={s.ink}>
            {skyAspect.planet1} {ASPECT_WORD[skyAspect.aspect] ?? skyAspect.aspect} {skyAspect.planet2}
          </text>
        )}
        <G name={dayRuler} x={W / 2 - 30} y={rulerY + 12} size={34} theme={theme} anchor="end" />
        <text x={W / 2 - 6} y={rulerY + 10} fontSize={28} fill={s.sub}>{dayRuler}'s day</text>
        {story && favLines.length > 0 && (
          <g>
            <text x={W / 2} y={favY} textAnchor="middle" fontSize={24} letterSpacing={4} fill={s.sub}>FAVORS</text>
            {favLines.map((l, i) => (
              <text key={i} x={W / 2} y={favY + 52 + i * 44} textAnchor="middle" fontSize={32} fontStyle="italic" fill={s.ink}>{l}</text>
            ))}
          </g>
        )}
      </g>
    </g>
  );
}

// ── Your Compass Rhythm ──────────────────────────────────────────────────────

/**
 * THE COMPOSITE, as the shareable object (design §6). Four functions, four
 * placements, four presets — never one type. The differentiator is in the
 * sentence itself: a person contains several working styles.
 */
function RhythmCard({ proposal, W, H, theme }: {
  proposal: { overall: string; functions: { label: string; trim: string; literal: string }[] } | null; W: number; H: number; theme: GlyphTheme;
}) {
  const s = SURFACE[theme];
  const story = H > 1500;
  const NAME: Record<string, string> = { tide: "Tide", campaign: "Campaign", route: "Route", field: "Field" };
  const top = story ? 760 : 600;
  if (!proposal) {
    return (
      <text x={W / 2} y={story ? 900 : 700} textAnchor="middle" fill={s.sub} fontSize={30} fontFamily={SERIF}>add a birth chart and this card reads it</text>
    );
  }
  return (
    <>
      <text x={W / 2} y={story ? 470 : 360} textAnchor="middle" fill={s.sub}
        fontSize={30} letterSpacing={7} fontFamily={SERIF}>YOUR COMPASS RHYTHM</text>
      <text x={W / 2} y={story ? 590 : 460} textAnchor="middle" fill={s.ink}
        fontSize={story ? 110 : 90} fontFamily={SERIF}>{NAME[proposal.overall] ?? proposal.overall}</text>
      {proposal.functions.map((f, i) => (
        <g key={f.label}>
          <text x={W / 2 - 30} y={top + i * 120} textAnchor="end" fill={s.sub} fontSize={26} letterSpacing={4} fontFamily={SERIF}>{f.label.toUpperCase()}</text>
          <text x={W / 2} y={top + i * 120} fill={s.ink} fontSize={46} fontFamily={SERIF}>{NAME[f.trim] ?? f.trim}</text>
          <text x={W / 2} y={top + i * 120 + 40} fill={s.sub} fontSize={25} fontFamily={SERIF}>{f.literal}</text>
        </g>
      ))}
      <text x={W / 2} y={top + 4 * 120 + 30} textAnchor="middle" fill={s.sub} fontSize={24} fontFamily={SERIF}>read from a birth chart</text>
    </>
  );
}

// ── The Week ─────────────────────────────────────────────────────────────────

/**
 * THE WEEK FOR ONE ACTIVITY, as a shareable card.
 *
 * The same answer Plan draws as a grid, sized for a phone screen. It travels
 * better than the day card because it carries its own question — "the week
 * for deep work" is legible to somebody who has never seen Compass, where
 * "Surge Tide, rising" is not.
 *
 * IT PUBLISHES THE SAME REFUSAL IT SHOWS. A week with no strong window says
 * so on the card. Publishing only the good weeks would make the account a
 * different product from the app.
 */
function ActivityCard({ label, windows, W, H, theme }: {
  label: string; windows: any[]; W: number; H: number; theme: GlyphTheme;
}) {
  const s = SURFACE[theme];
  const story = H > 1500;
  const days: { dow: string; date: string; wins: any[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    days.push({
      dow: d.toLocaleDateString("en-US", { weekday: "short" }),
      date,
      wins: windows.filter(w => w.date === date),
    });
  }
  const colW = 118, gap = 14;
  const x0 = (W - (7 * colW + 6 * gap)) / 2;
  const top = story ? 700 : 540;
  return (
    <>
      <text x={W / 2} y={story ? 470 : 360} textAnchor="middle" fill={s.sub}
        fontSize={30} letterSpacing={7} fontFamily={SERIF}>THE WEEK FOR</text>
      <text x={W / 2} y={story ? 570 : 445} textAnchor="middle" fill={s.ink}
        fontSize={story ? 88 : 74} fontFamily={SERIF}>{label}</text>
      {days.map((d, i) => {
        const x = x0 + i * (colW + gap);
        return (
          <g key={i}>
            <text x={x + colW / 2} y={top} textAnchor="middle" fill={s.sub} fontSize={26} fontFamily={SERIF}>{d.dow}</text>
            {d.wins.length === 0 ? (
              <rect x={x} y={top + 24} width={colW} height={52} rx={9}
                fill="none" stroke={s.line} strokeDasharray="5 5" />
            ) : d.wins.slice(0, 3).map((w, j) => (
              <g key={j}>
                <rect x={x} y={top + 24 + j * 62} width={colW} height={52} rx={9}
                  fill={s.ink} fillOpacity={w.tier === "great" ? 0.88 : 0.12} />
                <text x={x + colW / 2} y={top + 56 + j * 62} textAnchor="middle"
                  fill={w.tier === "great" ? s.bg : s.ink} fontSize={w.allDay ? 20 : 24} fontFamily={SERIF}>{w.allDay ? "all day" : w.startClock}</text>
              </g>
            ))}
          </g>
        );
      })}
      <text x={W / 2} y={top + 260} textAnchor="middle" fill={s.sub} fontSize={26} fontFamily={SERIF}>
        {windows.length === 0
          ? `nothing this week stands out for ${label.toLowerCase()}`
          : `${windows.length} window${windows.length === 1 ? "" : "s"} this week`}
      </text>
    </>
  );
}

function WeekCard({ days, weekTone, W, H, theme }: { days: any[]; weekTone?: string; W: number; H: number; theme: GlyphTheme }) {
  const s = SURFACE[theme];
  const story = H > 1500;
  const week = days.slice(0, 7);
  if (!week.length) return null;
  const range = `${fmtDay(week[0].date)} – ${fmtDay(week[week.length - 1].date)}`;
  const colW = 120, gap = 14;
  const x0 = (W - (7 * colW + 6 * gap)) / 2;
  const barBase = story ? 1000 : 780;
  const barMax = story ? 300 : 240;
  // Keep whole sentences only — a card shouldn't trail off mid-thought.
  const toneAll = wrap(weekTone ?? "", 44);
  let toneLines = toneAll.slice(0, 3);
  if (toneAll.length > 3) {
    const joined = toneLines.join(" ");
    const lastStop = joined.lastIndexOf(".");
    toneLines = lastStop > 20 ? wrap(joined.slice(0, lastStop + 1), 44) : [...toneLines.slice(0, 2), toneLines[2] + "…"];
  }
  const toneY = story ? 1300 : 1030;

  return (
    <g>
      <Chrome W={W} H={H} theme={theme} kicker={`the week ahead · ${range}`} />
      <text x={W / 2} y={story ? 360 : 300} textAnchor="middle" fontFamily={SERIF} fontSize={60} fontWeight={700} fill={s.ink}>
        The week's water
      </text>
      {week.map((d, i) => {
        const x = x0 + i * (colW + gap);
        const el = (d.element ?? "water") as keyof typeof GLYPH_ELEMENT_COLORS["tide"];
        const col = GLYPH_ELEMENT_COLORS[theme][el] ?? s.sub;
        const h = 60 + Math.round(((d.qualityScore ?? 3) / 7) * barMax);
        const dow = new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" });
        return (
          <g key={d.date}>
            <rect x={x} y={barBase - h} width={colW} height={h} rx={14} fill={col} opacity={0.32} />
            <rect x={x} y={barBase - h} width={colW} height={7} rx={3.5} fill={col} />
            <G name={d.moonSign} x={x + colW / 2} y={barBase - h - 26} size={40} theme={theme} />
            <text x={x + colW / 2} y={barBase + 44} textAnchor="middle" fontFamily={SERIF} fontSize={27} fill={i === 0 ? s.ink : s.sub} fontWeight={i === 0 ? 700 : 400}>{dow}</text>
            {d.voidPeriods && <circle cx={x + colW / 2} cy={barBase + 76} r={6} fill="none" stroke={s.sub} strokeWidth={2.5} />}
          </g>
        );
      })}
      <g fontFamily={SERIF}>
        {toneLines.map((l, i) => (
          <text key={i} x={W / 2} y={toneY + i * 52} textAnchor="middle" fontSize={34} fontStyle="italic" fill={s.ink}>{l}</text>
        ))}
        <text x={W / 2} y={toneY + toneLines.length * 52 + 46} textAnchor="middle" fontSize={24} fill={s.sub}>○ = void-of-course stretch · glyph = the Moon's sign</text>
      </g>
    </g>
  );
}

// ── The Lunation ─────────────────────────────────────────────────────────────
function LunationCard({ days, W, H, theme }: { days: any[]; W: number; H: number; theme: GlyphTheme }) {
  const s = SURFACE[theme];
  const story = H > 1500;
  const month = days.slice(0, 30);
  if (!month.length) return null;
  const range = `${fmtDay(month[0].date)} – ${fmtDay(month[month.length - 1].date)}`;
  const cols = 6, rows = 5;
  const cellW = 160, cellH = story ? 230 : 170;
  const x0 = (W - cols * cellW) / 2 + cellW / 2;
  const y0 = story ? 480 : 400;
  const r = story ? 48 : 40;
  // First New/Full Moon in range get a label above the disc.
  const marks: Record<number, string> = {};
  const nm = month.findIndex(d => d.moonPhase === "New Moon");
  const fm = month.findIndex(d => d.moonPhase === "Full Moon");
  if (nm >= 0) marks[nm] = "new";
  if (fm >= 0) marks[fm] = "full";

  return (
    <g>
      <Chrome W={W} H={H} theme={theme} kicker={`this lunation · ${range}`}
        foot="new to full to dark · move with time" />
      <text x={W / 2} y={story ? 340 : 290} textAnchor="middle" fontFamily={SERIF} fontSize={60} fontWeight={700} fill={s.ink}>
        The month's shape
      </text>
      {month.map((d, i) => {
        const cx = x0 + (i % cols) * cellW;
        const cy = y0 + Math.floor(i / cols) * cellH;
        const el = (d.element ?? "water") as keyof typeof GLYPH_ELEMENT_COLORS["tide"];
        const col = GLYPH_ELEMENT_COLORS[theme][el] ?? s.sub;
        return (
          <g key={d.date}>
            {marks[i] && (
              <text x={cx} y={cy - r - 22} textAnchor="middle" fontFamily={SERIF} fontSize={24} letterSpacing={3} fill={s.ink} fontWeight={700}>
                {marks[i] === "new" ? "NEW" : "FULL"}
              </text>
            )}
            <PhaseDisc cx={cx} cy={cy} r={r} frac={d.moonFraction ?? 0.5} waxing={isWaxing(d.moonPhase)} theme={theme} />
            <rect x={cx - 26} y={cy + r + 16} width={52} height={6} rx={3} fill={col} />
            <text x={cx} y={cy + r + 52} textAnchor="middle" fontFamily={SERIF} fontSize={23} fill={s.sub}>
              {new Date(d.date + "T12:00:00").getDate()}
            </text>
            {d.voidPeriods && <circle cx={cx + 40} cy={cy + r + 46} r={5} fill="none" stroke={s.sub} strokeWidth={2} />}
          </g>
        );
      })}
      <text x={W / 2} y={y0 + rows * cellH - (story ? 40 : 30)} textAnchor="middle" fontFamily={SERIF} fontSize={24} fill={s.sub}>
        tick = the day's element · ○ = void-of-course
      </text>
    </g>
  );
}

// ── Export: SVG → PNG at full resolution, symbol fonts embedded ──────────────
let fontCssCache: string | null = null;
async function embeddedFontCss(): Promise<string> {
  if (fontCssCache != null) return fontCssCache;
  const cssUrl = "https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols&family=Noto+Sans+Symbols+2&display=swap";
  const css = await (await fetch(cssUrl)).text();
  const urls = [...css.matchAll(/url\((https:[^)]+\.woff2)\)/g)].map(m => m[1]);
  let out = css;
  for (const u of [...new Set(urls)]) {
    const buf = await (await fetch(u)).arrayBuffer();
    let bin = ""; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    out = out.split(u).join(`data:font/woff2;base64,${btoa(bin)}`);
  }
  fontCssCache = out;
  return out;
}

export async function exportPng(svg: SVGSVGElement, w: number, h: number, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  try {
    const css = await embeddedFontCss();
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = css;
    clone.insertBefore(style, clone.firstChild);
  } catch { /* export proceeds with system symbol fallback */ }
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── The Studio ───────────────────────────────────────────────────────────────
export function Studio({ now, lat, lon, onClose }: { now: any; lat: number; lon: number; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [subject, setSubject] = useState<Subject>("day");
  const [format, setFormat] = useState<Format>("story");
  const [theme, setTheme] = useState<GlyphTheme>("tide");
  const [busy, setBusy] = useState(false);

  // WHICH thing the "for one thing" card is about. Only fetched once that
  // subject is chosen — nobody making a day card should pay for a week scan.
  const [cardActivity, setCardActivity] = useState("deep-work");
  const { data: cardActs } = useQuery<{ activities: { key: string; label: string }[] }>({
    queryKey: ["election-activities"],
    queryFn: async () => (await fetch("/api/elections/activities")).json(),
    staleTime: Infinity,
    enabled: subject === "activity",
  });
  const { data: cardWindows } = useQuery<{ windows: any[] }>({
    queryKey: ["activity-week", cardActivity, lat.toFixed(2), lon.toFixed(2), new Date().getTimezoneOffset()],
    queryFn: async () => (await fetch(
      `/api/elections/times?activity=${encodeURIComponent(cardActivity)}&span=week&lat=${lat}&lon=${lon}&tz=${new Date().getTimezoneOffset()}&timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}&locationKnown=true`
    )).json(),
    enabled: subject === "activity",
  });

  // The chart's proposal, only once that card is chosen.
  const studioTesterId = useTester().profile?.testerId ?? null;
  const { data: rhythmData } = useRhythmProposal(studioTesterId, subject === "rhythm");

  // One 30-day pull covers both the week and the lunation.
  const { data: month } = useQuery<any>({
    queryKey: ["studio-month", lat, lon],
    queryFn: async () => (await fetch(`/api/tides/week?days=30&lat=${lat}&lon=${lon}&tz=${new Date().getTimezoneOffset()}`)).json(),
    staleTime: 1000 * 60 * 30,
  });
  const days: any[] = month?.days ?? [];

  const W = 1080, H = format === "story" ? 1920 : 1350;
  const s = SURFACE[theme];
  const today = localToday();

  async function doExport() {
    if (!svgRef.current || busy) return;
    setBusy(true);
    try { await exportPng(svgRef.current, W, H, `auspice-${subject}-${today}.png`); }
    finally { setBusy(false); }
  }

  const Seg = ({ value, options, onPick }: { value: string; options: [string, string][]; onPick: (v: any) => void }) => (
    <div style={{ display: "flex", gap: 5 }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onPick(v)} style={{
          fontSize: 11, padding: "5px 13px", borderRadius: 16, cursor: "pointer",
          border: value === v ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
          background: value === v ? "#1a2a3a" : "transparent",
          color: value === v ? "var(--text-3)" : "var(--color-muted)", fontWeight: value === v ? 600 : 400,
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
        <button onClick={onClose} aria-label="Close the studio" style={{ position: "absolute", top: 10, right: 14, background: "none", border: "none", fontSize: 20, color: "var(--text-3)", cursor: "pointer", zIndex: 1 }}>×</button>

        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 210, paddingTop: 6 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>Studio</div>
            <div style={{ fontSize: 10.5, color: "var(--color-muted)", marginTop: 2, lineHeight: 1.5 }}>
              A shareable reading of the sky — built from the primary facts, sized for Instagram.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-muted)", marginBottom: 5 }}>Subject</div>
            <Seg value={subject} onPick={setSubject} options={[["day", "The day"], ["week", "The week"], ["lunation", "The lunation"], ["activity", "One activity"], ["rhythm", "My rhythm"]]} />
          </div>
          {subject === "activity" && (
            <div>
              <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-muted)", marginBottom: 5 }}>Which activity</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(cardActs?.activities ?? []).slice(0, 14).map(a => (
                  <button key={a.key} onClick={() => setCardActivity(a.key)} style={{
                    fontSize: 10.5, padding: "3px 9px", borderRadius: 11, cursor: "pointer",
                    border: `1px solid ${a.key === cardActivity ? "var(--color-primary)" : "var(--color-border)"}`,
                    background: a.key === cardActivity ? "var(--color-primary)" : "var(--color-background)",
                    color: a.key === cardActivity ? "#ffffff" : "var(--text-2)",
                  }}>{a.label}</button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-muted)", marginBottom: 5 }}>Format</div>
            <Seg value={format} onPick={setFormat} options={[["story", "Story 9:16"], ["post", "Post 4:5"]]} />
          </div>
          <div>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-muted)", marginBottom: 5 }}>Theme</div>
            <Seg value={theme} onPick={setTheme} options={[["tide", "Tide"], ["almanac", "Almanac"], ["observatory", "Observatory"], ["minimal", "Minimal"]]} />
          </div>
          <button onClick={doExport} disabled={busy} style={{
            marginTop: 6, fontSize: 12.5, padding: "9px 18px", borderRadius: 9, border: "none",
            background: "#1a2a3a", color: "var(--text-3)", cursor: busy ? "default" : "pointer", fontWeight: 600,
          }}>{busy ? "Rendering…" : `↓ Export PNG · ${W}×${H}`}</button>
          <div style={{ fontSize: 9.5, color: "var(--color-muted)", lineHeight: 1.5 }}>
            Exports at full Instagram resolution with the glyph faces embedded.
          </div>
        </div>

        {/* Preview */}
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
          style={{ width: format === "story" ? 300 : 340, height: "auto", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.3)", flexShrink: 0 }}>
          <rect width={W} height={H} fill={s.bg} />
          {subject === "day" && <DayCard now={now} W={W} H={H} theme={theme} />}
          {subject === "rhythm" && <RhythmCard proposal={rhythmData?.proposal ?? null} W={W} H={H} theme={theme} />}
          {subject === "activity" && <ActivityCard label={(cardActs?.activities ?? []).find(a => a.key === cardActivity)?.label ?? cardActivity} windows={cardWindows?.windows ?? []} W={W} H={H} theme={theme} />}
          {subject === "week" && <WeekCard days={days} weekTone={month?.weekTone} W={W} H={H} theme={theme} />}
          {subject === "lunation" && <LunationCard days={days} W={W} H={H} theme={theme} />}
        </svg>
      </div>
    </div>
  );
}
