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

// ═════════════════════════════════════════════════════════════════════════════
// Best-times cards — "when to do X" for the week / the month (owner 2026-07-15,
// revised same day: the times must be a SELECTION OF ASPECTS, electional-style,
// not curve crests). Every listed window is anchored to a real timed sky event:
//
//   Deep study   → Moon conj/trine/sextile Mercury or Saturn
//   Training     → Moon conj/trine/sextile Mars or Sun
//   Dates & play → Moon conj/trine/sextile Venus or Jupiter · evenings ·
//                  waxing half · Venus–Jupiter sky aspects boost the day
//   Deep rest    → Moon trine/sextile Neptune (the low-arousal voice) ·
//                  void-of-course stretches count as windows ("slack water") ·
//                  waning half
//
// A window is the aspect's swell: exact ± 2.5h, clamped to waking hours
// (7:00–23:00); an exactness whose swell can't give 1.5 waking hours is
// dropped. The 'why' IS the aspect — "Moon trine Venus · exact 8:05 PM".
// Only supportive geometry (conjunction/trine/sextile) is published; squares
// and oppositions are energy too, but a public card elects clean windows.
// ═════════════════════════════════════════════════════════════════════════════

import { getMajorAspects } from "./astro.js";

interface Activity {
  key: string; label: string; planet: string;      // display glyph
  aspectPlanets: Record<string, number>;           // Moon-to-X target → weight
  pairPlanets?: string[];                          // planet-planet pairs worth flagging (month)
  eveningBias?: boolean;   // prefer windows overlapping 17:00–24:00
  waxingBias?: boolean;    // prefer the building half of the lunation
  waningBias?: boolean;    // prefer the releasing half
  vocAsWindow?: boolean;   // void-of-course stretches ARE windows (rest only)
}
const ACTIVITIES: Activity[] = [
  { key: "study", label: "Deep study", planet: "Mercury", aspectPlanets: { Mercury: 1.0, Saturn: 0.8 }, pairPlanets: ["Mercury", "Saturn"] },
  { key: "train", label: "Training", planet: "Mars", aspectPlanets: { Mars: 1.0, Sun: 0.8 }, pairPlanets: ["Mars", "Sun"] },
  { key: "love", label: "Dates & play", planet: "Venus", aspectPlanets: { Venus: 1.0, Jupiter: 0.7 }, pairPlanets: ["Venus", "Jupiter"], eveningBias: true, waxingBias: true },
  { key: "rest", label: "Deep rest", planet: "Moon", aspectPlanets: { Neptune: 1.0, Venus: 0.5 }, waningBias: true, vocAsWindow: true },
];
// Supportive geometry only, conjunction leading.
const ASPECT_W: Record<string, number> = { conjunction: 1.0, trine: 0.85, sextile: 0.65 };

interface DayPick {
  date: string; dow: string; startClock: string; endClock: string;
  score: number; why: string;
}

function clockOf(ms: number, tzOffsetMin: number): string {
  const s = new Date(ms - tzOffsetMin * 60000);
  let h = s.getUTCHours();
  const m = s.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Best window per activity per day, scored with the activity's biases.
function scanDays(days: number, lat: number, lon: number, tzOffsetMin: number): Record<string, DayPick[]> {
  const out: Record<string, DayPick[]> = Object.fromEntries(ACTIVITIES.map(a => [a.key, []]));
  const start = new Date();
  for (let d = 0; d < days; d++) {
    const instant = new Date(start.getTime() + d * 86400000);
    const arc = computeDayArc(instant, lat, lon, tzOffsetMin);
    const dayStartMs = new Date(arc.dayStart).getTime();
    const local = new Date(dayStartMs - tzOffsetMin * 60000 + 12 * 3600000); // local noon
    const jdNoon = julianDay(new Date(dayStartMs + 12 * 3600000));
    const phase = moonPhase(jdNoon);
    const waxing = /new|waxing|first/i.test(phase.name);
    const moonSign = SIGNS[Math.floor((((moonLongitude(jdNoon) % 360) + 360) % 360) / 30) % 12];
    const dayRuler = WEEKDAY_RULERS[local.getUTCDay()];
    const hasVoc = (arc.vocWindows ?? []).length > 0;
    const dow = local.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const dateLabel = local.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

    // Tight supportive planet-planet aspects standing today (checked at local
    // noon, ≤3° orb) — a Venus–Jupiter trine makes the whole day better for
    // dates, and deserves a mention on the month card's lead line.
    const skyAspects = getMajorAspects(jdNoon).filter(pa =>
      (ASPECT_W[pa.aspect] ?? 0) > 0 && pa.orb <= 3);

    for (const a of ACTIVITIES) {
      const candidates: DayPick[] = [];

      // ── Aspect-anchored windows: the swell around each perfection ─────────
      for (const ev of arc.events) {
        if (ev.kind !== "aspect" || !ev.planet || !ev.aspect) continue;
        const aw = ASPECT_W[ev.aspect] ?? 0;
        const pw = a.aspectPlanets[ev.planet] ?? 0;
        if (aw === 0 || pw === 0) continue;
        const exactH = (Date.parse(ev.time) - dayStartMs) / 3600000;
        // The swell: exact ± 2.5h, clamped to waking hours. A 3 AM exactness
        // whose swell can't give 1.5 waking hours is dropped, not shifted.
        const startH = Math.max(exactH - 2.5, 7);
        const endH = Math.min(exactH + 2.5, 23);
        if (endH - startH < 1.5) continue;

        let score = aw * pw;
        const dayMatch = (a.aspectPlanets[dayRuler] ?? 0) > 0 || a.planet === dayRuler;
        if (dayMatch) score *= 1.15;
        if (a.eveningBias) score *= endH >= 17 ? 1.2 : 0.85;
        if (a.waxingBias) score *= waxing ? 1.12 : 0.9;
        if (a.waningBias) score *= waxing ? 0.9 : 1.12;

        const whyBits = [`${ev.label} · exact ${ev.clock}`];
        if (dayMatch) whyBits.push(`${dayRuler}'s day`);
        candidates.push({
          date: dateLabel, dow,
          startClock: clockOf(dayStartMs + startH * 3600000, tzOffsetMin),
          endClock: clockOf(dayStartMs + endH * 3600000, tzOffsetMin),
          score, why: whyBits.join(" · "),
        });
      }

      // ── Rest only: void-of-course stretches ARE windows — slack water ─────
      if (a.vocAsWindow) {
        for (const v of arc.vocWindows ?? []) {
          let startH = Math.max((Date.parse(v.start) - dayStartMs) / 3600000, 7);
          const endH = Math.min((Date.parse(v.end) - dayStartMs) / 3600000, 23);
          // An all-day void isn't a 13-hour nap: show the final stretch before
          // the ingress, capped at 4 hours.
          startH = Math.max(startH, endH - 4);
          if (endH - startH < 1.5) continue;
          const score = 0.6 * (waxing ? 0.95 : 1.15);
          candidates.push({
            date: dateLabel, dow,
            startClock: clockOf(dayStartMs + startH * 3600000, tzOffsetMin),
            endClock: clockOf(dayStartMs + endH * 3600000, tzOffsetMin),
            score, why: `void of course · slack water${waxing ? "" : " · waning"}`,
          });
        }
      }

      // Standing sky-aspect boost (e.g. Venus trine Jupiter for dates): lifts
      // the whole day and rides along in the why.
      if (a.pairPlanets && candidates.length) {
        const pair = skyAspects.find(pa =>
          a.pairPlanets!.includes(pa.planet1) && a.pairPlanets!.includes(pa.planet2) && pa.planet1 !== pa.planet2);
        if (pair) for (const c of candidates) {
          c.score *= 1.2;
          c.why += ` · ${pair.planet1}–${pair.planet2} ${pair.aspect}`;
        }
      }

      // Best window per day per activity.
      const best = candidates.sort((x, z) => z.score - x.score)[0];
      if (best) out[a.key].push(best);
    }
  }
  return out;
}

export function buildBestTimesCardSvg(opts: {
  span: "week" | "month"; lat: number; lon: number; tzOffsetMin: number;
  theme?: CardTheme; format?: CardFormat;
}): { svg: string; width: number; height: number } {
  const { span, lat, lon, tzOffsetMin } = opts;
  const theme = opts.theme ?? "tide";
  const format = opts.format ?? "story";
  const W = 1080, H = format === "story" ? 1920 : 1350;
  const s = SURFACE[theme];
  const days = span === "week" ? 7 : 30;
  const picks = scanDays(days, lat, lon, tzOffsetMin);

  const start = new Date(Date.now() - tzOffsetMin * 60000);
  const end = new Date(start.getTime() + (days - 1) * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const kicker = span === "week" ? `best times · ${fmt(start)} – ${fmt(end)}` : `best days · ${fmt(start)} – ${fmt(end)}`;
  const title = span === "week" ? "The week's best times" : "The month's best days";

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${s.bg}"/>`);
  parts.push(`<text x="${W / 2}" y="110" text-anchor="middle" font-family="${SERIF}" font-size="34" letter-spacing="12" font-weight="700" fill="${s.sub}">AUSPICE</text>`);
  parts.push(`<text x="${W / 2}" y="162" text-anchor="middle" font-family="${SERIF}" font-size="26" fill="${s.sub}">${esc(kicker)}</text>`);
  parts.push(`<text x="${W / 2}" y="${format === "story" ? 280 : 250}" text-anchor="middle" font-family="${SERIF}" font-size="58" font-weight="700" fill="${s.ink}">${esc(title)}</text>`);

  const secY0 = format === "story" ? 400 : 340;
  const secH = format === "story" ? 350 : 240;
  const left = 110;

  // One window, one home: if two activities share a window (Venus serves both
  // dates and rest), it appears only under the activity that scored it higher.
  const claimed = new Set<string>();

  ACTIVITIES.forEach((a, i) => {
    const y = secY0 + i * secH;
    const accent = ELEMENT_COLORS[theme][(PLANET_GLYPH[a.planet] ?? { element: "water" }).element];
    parts.push(glyphText(a.planet, left + 26, y + 14, 46, theme));
    parts.push(`<text x="${left + 70}" y="${y + 12}" font-family="${SERIF}" font-size="42" font-weight="700" fill="${s.ink}">${esc(a.label)}</text>`);
    parts.push(`<line x1="${left}" y1="${y + 44}" x2="${W - left}" y2="${y + 44}" stroke="${accent}" stroke-width="2.5" opacity="0.5"/>`);

    if (span === "week") {
      // Top three distinct days, listed chronologically; the aspect IS the
      // why, so each entry is two lines: the window, then its anchor.
      const top: DayPick[] = [];
      for (const p of [...picks[a.key]].sort((x, z) => z.score - x.score)) {
        const key = `${p.dow}|${p.startClock}`;
        if (claimed.has(key)) continue;
        claimed.add(key);
        top.push(p);
        if (top.length >= 3) break;
      }
      top.sort((x, z) => x.date.localeCompare(z.date));
      if (top.length === 0) {
        parts.push(`<text x="${left + 10}" y="${y + 104}" font-family="${SERIF}" font-size="26" font-style="italic" fill="${s.sub}">no clean window this week — a quiet stretch for this</text>`);
      }
      top.forEach((p, ri) => {
        const ry = y + 96 + ri * 84;
        parts.push(`<text x="${left + 10}" y="${ry}" font-family="${SERIF}" font-size="33" font-weight="600" fill="${s.ink}">${esc(`${p.dow} · ${p.startClock}–${p.endClock}`)}</text>`);
        parts.push(`<text x="${left + 10}" y="${ry + 34}" font-family="${SERIF}" font-size="23" fill="${s.sub}">${esc(p.why)}</text>`);
      });
    } else {
      // Month: five best dates as chips + why the top one leads.
      const ranked = [...picks[a.key]].sort((x, z) => z.score - x.score);
      const top5 = ranked.slice(0, 5).sort((x, z) => Date.parse(x.date + " 2026") - Date.parse(z.date + " 2026"));
      let cx = left;
      top5.forEach(p => {
        const label = `${p.dow} ${p.date}`;
        const wCh = label.length * 12.5 + 32;
        parts.push(`<rect x="${cx}" y="${y + 70}" width="${wCh}" height="50" rx="25" fill="${accent}" opacity="0.14"/>`);
        parts.push(`<text x="${cx + wCh / 2}" y="${y + 103}" text-anchor="middle" font-family="${SERIF}" font-size="25" font-weight="600" fill="${s.ink}">${esc(label)}</text>`);
        cx += wCh + 12;
      });
      if (ranked[0]) parts.push(`<text x="${left + 10}" y="${y + 168}" font-family="${SERIF}" font-size="24" fill="${s.sub}">${esc(`lead day: ${ranked[0].dow} ${ranked[0].date} · ${ranked[0].why}`)}</text>`);
    }
  });

  parts.push(`<text x="${W / 2}" y="${H - 70}" text-anchor="middle" font-family="${SERIF}" font-size="26" font-style="italic" fill="${s.sub}">move with time</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
  return { svg, width: W, height: H };
}
