/**
 * Server-side Studio day card — the automated-daily-render twin of the
 * frontend Studio's DayCard (artifacts/tides/src/components/Studio.tsx).
 * Builds the same SVG from the same primary sky facts, so the content
 * pipeline can produce the day's shareable without a browser.
 *
 * Content stance (owner 2026-07-15): primary facts only — moon sign +
 * phase, planetary day, timed aspects, sign favors. Never the synthetic
 * tide index.
 *
 * The glyph tables below are a deliberate small copy of the frontend's
 * celestialGlyphs.ts (design-handoff recipe: FE0E selector, Noto symbol
 * faces, per-glyph optical thinning, element tints). Keep in sync if the
 * handoff values ever change.
 */

import { julianDay, moonLongitude, moonPhase, getSunriseSunset, SIGNS } from "./astro.js";
import { computeDayArc } from "./dayarc.js";

export type CardTheme = "tide" | "almanac" | "observatory" | "minimal";
export type CardFormat = "story" | "post";

const FE0E = "︎";
const SIGN_GLYPH: Record<string, { cp: number; element: string }> = {
  Aries: { cp: 0x2648, element: "fire" }, Taurus: { cp: 0x2649, element: "earth" },
  Gemini: { cp: 0x264a, element: "air" }, Cancer: { cp: 0x264b, element: "water" },
  Leo: { cp: 0x264c, element: "fire" }, Virgo: { cp: 0x264d, element: "earth" },
  Libra: { cp: 0x264e, element: "air" }, Scorpio: { cp: 0x264f, element: "water" },
  Sagittarius: { cp: 0x2650, element: "fire" }, Capricorn: { cp: 0x2651, element: "earth" },
  Aquarius: { cp: 0x2652, element: "air" }, Pisces: { cp: 0x2653, element: "water" },
};
const PLANET_GLYPH: Record<string, { cp: number; element: string }> = {
  Sun: { cp: 0x2609, element: "fire" }, Moon: { cp: 0x263d, element: "water" },
  Mercury: { cp: 0x263f, element: "air" }, Venus: { cp: 0x2640, element: "water" },
  Mars: { cp: 0x2642, element: "fire" }, Jupiter: { cp: 0x2643, element: "earth" },
  Saturn: { cp: 0x2644, element: "earth" }, Uranus: { cp: 0x2645, element: "air" },
  Neptune: { cp: 0x2646, element: "water" }, Pluto: { cp: 0x2bd3, element: "earth" },
};
const THIN: Record<string, number> = {
  Sun: 0.011, Mercury: 0.019, Venus: 0.010, Mars: 0.010, Jupiter: 0.015,
  Saturn: 0.023, Uranus: 0.012, Neptune: 0.019, Pluto: 0.012,
  Virgo: 0.011, Libra: 0.011, Scorpio: 0.011,
};
const ELEMENT_COLORS: Record<CardTheme, Record<string, string>> = {
  tide: { fire: "#C2613E", earth: "#5E9A52", air: "#CBA13C", water: "#3F8493" },
  almanac: { fire: "#A2503A", earth: "#6E7355", air: "#B28A2E", water: "#3E6C82" },
  observatory: { fire: "#FF7A59", earth: "#5FC98A", air: "#F2C94C", water: "#46C2E6" },
  minimal: { fire: "#111111", earth: "#111111", air: "#111111", water: "#111111" },
};
const SURFACE: Record<CardTheme, { bg: string; ink: string; sub: string; line: string }> = {
  tide: { bg: "#F2EFE9", ink: "#1A2A3A", sub: "#8A8278", line: "#D8D2C8" },
  almanac: { bg: "#F3E9D6", ink: "#3A3226", sub: "#8A7A5E", line: "#DCCFB4" },
  observatory: { bg: "#0E1420", ink: "#E8ECF4", sub: "#8F9AB4", line: "#263044" },
  minimal: { bg: "#FFFFFF", ink: "#111111", sub: "#777777", line: "#E2E2E2" },
};
// Condensed copy of the frontend SIGN_MYTHOS "favors" (first three per sign).
const SIGN_FAVORS: Record<string, string> = {
  Aries: "start the thing · hard training · the direct ask",
  Taurus: "finish and polish · cook well · tend money slowly",
  Gemini: "write & edit · calls, errands, emails · learn something quick",
  Cancer: "tend home & kitchen · family · journal from feeling",
  Leo: "perform, present, publish · creative play · host generously",
  Virgo: "edit & refine · organize the system · health routines",
  Libra: "negotiate & mediate · partner on the work · beautify a shared room",
  Scorpio: "deep sealed-off focus · research · the honest hard conversation",
  Sagittarius: "plan the journey · study the big idea · teach",
  Capricorn: "the unglamorous right thing · long-term structure · prune",
  Aquarius: "systems thinking · the unconventional approach · community",
  Pisces: "make art from feeling · meditate, drift · rest generously",
};
const WEEKDAY_RULERS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;

const SERIF = "Spectral, Georgia, serif";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function glyphText(name: string, x: number, y: number, size: number, theme: CardTheme, anchor = "middle"): string {
  const gi = SIGN_GLYPH[name] ?? PLANET_GLYPH[name];
  if (!gi) return "";
  const color = ELEMENT_COLORS[theme][gi.element];
  const face = name === "Venus" ? "Noto Sans Symbols" : "Noto Sans Symbols 2";
  const thin = THIN[name] ?? 0;
  const stroke = thin > 0 ? ` stroke="${SURFACE[theme].bg}" stroke-width="${(thin * size).toFixed(2)}"` : "";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-family="${face}" fill="${color}"${stroke}>${String.fromCodePoint(gi.cp)}${FE0E}</text>`;
}

// True terminator geometry — same math as the frontend PhaseDisc.
function phaseDisc(cx: number, cy: number, r: number, frac: number, waxing: boolean, theme: CardTheme): string {
  const s = SURFACE[theme];
  const lit = theme === "observatory" ? "#D8CCB0" : theme === "minimal" ? "#CFC8B8" : "#CDBE97";
  const dark = theme === "observatory" ? "#1B2536" : s.line;
  const f = Math.max(0, Math.min(1, frac));
  let litPath = "";
  if (f >= 0.02) {
    const sweep = waxing ? 1 : 0;
    if (f > 0.98) {
      litPath = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${lit}"/>`;
    } else {
      const rx = Math.abs(2 * f - 1) * r;
      const termSweep = f > 0.5 ? sweep : 1 - sweep;
      litPath = `<path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z" fill="${lit}"/>`;
    }
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${dark}" opacity="0.5"/>${litPath}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.line}" stroke-width="2"/>`;
}

export function buildDayCardSvg(opts: {
  now?: Date; lat: number; lon: number; tzOffsetMin: number;
  theme?: CardTheme; format?: CardFormat;
}): { svg: string; width: number; height: number } {
  const { lat, lon, tzOffsetMin } = opts;
  const now = opts.now ?? new Date();
  const theme = opts.theme ?? "tide";
  const format = opts.format ?? "story";
  const W = 1080, H = format === "story" ? 1920 : 1350;
  const story = format === "story";
  const s = SURFACE[theme];

  // ── Primary sky facts ──────────────────────────────────────────────────────
  const jd = julianDay(now);
  const moonLon = ((moonLongitude(jd) % 360) + 360) % 360;
  const moonSign = SIGNS[Math.floor(moonLon / 30) % 12];
  const phase = moonPhase(jd);
  const waxing = /new|waxing|first/i.test(phase.name);
  // Day ruler: weekday ruler, switching at local sunrise (before sunrise the
  // previous day still rules) — same convention as /api/tides/now.
  const local = new Date(now.getTime() - tzOffsetMin * 60000);
  const sun = getSunriseSunset(now, lat, lon);
  const beforeSunrise = sun ? now < sun.sunrise : false;
  const dowIdx = (local.getUTCDay() + (beforeSunrise ? 6 : 0)) % 7;
  const dayRuler = WEEKDAY_RULERS[dowIdx];
  const arc = computeDayArc(now, lat, lon, tzOffsetMin);
  const events = arc.events.filter(e => e.kind === "aspect" || e.kind === "ingress").slice(0, story ? 3 : 2);
  const favors = SIGN_FAVORS[moonSign] ?? "";
  const dateLabel = local.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  // ── Layout (mirrors the frontend DayCard) ──────────────────────────────────
  const discY = story ? 460 : 380, discR = story ? 150 : 112;
  const signY = story ? 800 : 640, titleY = story ? 910 : 730, phaseY = story ? 962 : 778;
  const rulerY = story ? 1080 : 880, evY0 = story ? 1210 : 990, evGap = story ? 74 : 64;
  const favY = story ? 1560 : 1180;

  // Wrap favors into ≤2 lines of ~40 chars.
  const favLines: string[] = [];
  let cur = "";
  for (const w of favors.split(/\s+/)) {
    if ((cur + " " + w).trim().length > 40) { favLines.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) favLines.push(cur.trim());

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${s.bg}"/>`);
  parts.push(`<text x="${W / 2}" y="110" text-anchor="middle" font-family="${SERIF}" font-size="34" letter-spacing="12" font-weight="700" fill="${s.sub}">AUSPICE</text>`);
  parts.push(`<text x="${W / 2}" y="162" text-anchor="middle" font-family="${SERIF}" font-size="26" fill="${s.sub}">${esc(dateLabel)}</text>`);
  parts.push(phaseDisc(W / 2, discY, discR, phase.fraction, waxing, theme));
  parts.push(glyphText(moonSign, W / 2, signY, 130, theme));
  parts.push(`<text x="${W / 2}" y="${titleY}" text-anchor="middle" font-family="${SERIF}" font-size="64" font-weight="700" fill="${s.ink}">Moon in ${esc(moonSign)}</text>`);
  parts.push(`<text x="${W / 2}" y="${phaseY}" text-anchor="middle" font-family="${SERIF}" font-size="30" fill="${s.sub}">${esc(phase.name)} · ${Math.round(phase.fraction * 100)}% lit</text>`);
  parts.push(`<line x1="${W / 2 - 120}" y1="${rulerY - 68}" x2="${W / 2 + 120}" y2="${rulerY - 68}" stroke="${s.line}" stroke-width="2"/>`);
  parts.push(glyphText(dayRuler, W / 2 - 30, rulerY + 12, 42, theme, "end"));
  parts.push(`<text x="${W / 2 - 6}" y="${rulerY + 10}" font-family="${SERIF}" font-size="36" fill="${s.ink}">${esc(dayRuler)}'s day</text>`);
  events.forEach((e, i) => {
    parts.push(`<text x="${W / 2 - 40}" y="${evY0 + i * evGap}" text-anchor="end" font-family="${SERIF}" font-size="28" fill="${s.sub}">${esc(e.clock)}</text>`);
    parts.push(`<text x="${W / 2 - 10}" y="${evY0 + i * evGap}" font-family="${SERIF}" font-size="31" fill="${s.ink}">${esc(e.label)}</text>`);
  });
  if (story && favLines.length) {
    parts.push(`<text x="${W / 2}" y="${favY}" text-anchor="middle" font-family="${SERIF}" font-size="24" letter-spacing="4" fill="${s.sub}">FAVORS</text>`);
    favLines.slice(0, 2).forEach((l, i) => {
      parts.push(`<text x="${W / 2}" y="${favY + 52 + i * 44}" text-anchor="middle" font-family="${SERIF}" font-size="32" font-style="italic" fill="${s.ink}">${esc(l)}</text>`);
    });
  }
  parts.push(`<text x="${W / 2}" y="${H - 70}" text-anchor="middle" font-family="${SERIF}" font-size="26" font-style="italic" fill="${s.sub}">move with time</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
  return { svg, width: W, height: H };
}
