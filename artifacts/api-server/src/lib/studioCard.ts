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

import { julianDay, moonLongitude, sunLongitude, moonPhase, getSunriseSunset, SIGNS, scanMoonPerfections, type MoonPerfection } from "./astro.js";

// Waxing = the Moon is AHEAD of the Sun by <180° of elongation. Phase-NAME
// regexes get this wrong at the edges (the "Full Moon" bucket starts a day
// early, mislabeling a still-waxing day as waning) — geometry doesn't.
const isWaxingAt = (jd: number): boolean =>
  (((moonLongitude(jd) - sunLongitude(jd)) % 360) + 360) % 360 < 180;
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
  const waxing = isWaxingAt(jd);
  // Day ruler: weekday ruler, switching at local sunrise (before sunrise the
  // previous day still rules) — same convention as /api/tides/now.
  const local = new Date(now.getTime() - tzOffsetMin * 60000);
  // getSunriseSunset takes a JULIAN DAY, not a Date. Passing `now` produced an
  // Invalid Date, so `now < sun.sunrise` was always false and the day ruler
  // never applied its before-sunrise rule — a card generated before dawn named
  // the wrong ruling planet. (The typechecker had been reporting this the whole
  // time, inside the "known baseline" nobody read.)
  const sun = getSunriseSunset(julianDay(now), lat, lon);
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
  parts.push(`<text x="${W / 2}" y="110" text-anchor="middle" font-family="${SERIF}" font-size="34" letter-spacing="12" font-weight="700" fill="${s.sub}">COMPASS</text>`);
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
// Best-times cards — weekly (and monthly) elections for four everyday needs
// (owner 2026-07-17): effort/workouts, rest, connection/pleasure, deep study.
//
// Signal vocabulary (all UNIVERSAL instants — safe on a shareable card; only
// the clock label is a timezone, stamped in the kicker. Planetary hours and
// angle crossings are location-bound, so they stay OFF these cards):
//   · Moon aspects to the important planets — majors AND minors (semi-sextile,
//     semi-square, quintile, sesquiquadrate, biquintile, quincunx)
//   · per-activity aspect palettes: effort gets Moon–Mars/Sun SQUARES too —
//     hard aspects are high-charge fuel when the job is exertion
//   · the Moon's SIGN as an all-day quality entry (fallback when timed
//     elections are scarce — a Virgo moon is a study day even with no aspect)
//   · void-of-course stretches (rest windows: "slack water")
//   · the week's standing planet-planet aspect as a headline
// ═════════════════════════════════════════════════════════════════════════════

import { getMajorAspects, getPlanetPositions, isRetrograde } from "./astro.js";

const norm360 = (d: number) => ((d % 360) + 360) % 360;

interface Activity {
  key: string; label: string; planet: string;
  planetW: Record<string, number>;         // Moon-to-X target → weight
  aspectW: Record<string, number>;         // which geometry qualifies → weight
  // Per-planet geometry exclusions — e.g. rest takes Saturn's trine/sextile
  // (disciplined stillness) but never its conjunction (heaviness, insomnia),
  // and effort takes Jupiter softs but not its squares (overreach ≠ fuel).
  exclude?: Record<string, string[]>;
  signAffinity: Record<string, string>;    // moon SIGN → gloss (all-day entries)
  pairPlanets?: string[];
  maxRows: number;
  eveningBias?: boolean; waxingBias?: boolean; waningBias?: boolean; vocAsWindow?: boolean;
  fullMoonBoost?: boolean;                 // peak-light nights (connection)
  balsamicBoost?: boolean;                 // dark-of-the-moon days (rest)
  mercuryRxNote?: boolean;                 // study: Rx favors review — say so
}

const SOFT = { conjunction: 1.0, trine: 0.85, sextile: 0.65, quintile: 0.5, "semi-sextile": 0.35 };

const ACTIVITIES: Activity[] = [
  {
    key: "effort", label: "Effort & training", planet: "Mars",
    // Jupiter softs = endurance and the classic sports benefic — but Jupiter's
    // hard aspects are overreach, not fuel, so they're excluded below.
    planetW: { Mars: 1.0, Sun: 0.8, Jupiter: 0.5 },
    // Squares are FUEL for exertion — high-charge geometry pointed at a body.
    aspectW: { ...SOFT, square: 0.7, "semi-square": 0.4, sesquiquadrate: 0.4 },
    exclude: { Jupiter: ["square", "semi-square", "sesquiquadrate"] },
    signAffinity: { Aries: "fast fire", Leo: "proud fire", Sagittarius: "far-ranging fire", Capricorn: "endurance earth", Scorpio: "Mars-ruled depth" },
    pairPlanets: ["Mars", "Sun"], maxRows: 4,
  },
  {
    key: "rest", label: "Deep rest", planet: "Moon",
    // Neptune = dissolving, dreamy rest (conjunction welcome here). Saturn
    // softs = DISCIPLINED rest — containment, the early night that actually
    // happens, retreat elections — but never the conjunction (heavy, sleepless).
    planetW: { Neptune: 1.0, Saturn: 0.6, Venus: 0.5 },
    aspectW: SOFT,
    exclude: { Saturn: ["conjunction", "semi-sextile", "quintile"] },
    signAffinity: { Cancer: "home water", Pisces: "open-sea water", Taurus: "slow settled earth" },
    maxRows: 3, waningBias: true, vocAsWindow: true, balsamicBoost: true,
  },
  {
    key: "connection", label: "Connection & pleasure", planet: "Venus",
    planetW: { Venus: 1.0, Jupiter: 0.7, Moon: 0 },
    aspectW: SOFT,
    signAffinity: { Libra: "partnered air", Leo: "warm stage-light", Taurus: "sensual earth", Pisces: "boundless water" },
    pairPlanets: ["Venus", "Jupiter"], maxRows: 3, eveningBias: true, waxingBias: true, fullMoonBoost: true,
  },
  {
    key: "study", label: "Deep study", planet: "Mercury",
    planetW: { Mercury: 1.0, Saturn: 0.8 },
    aspectW: SOFT,
    signAffinity: { Gemini: "quick air", Virgo: "orderly earth", Aquarius: "systems air", Capricorn: "long-haul earth" },
    pairPlanets: ["Mercury", "Saturn"], maxRows: 3, mercuryRxNote: true,
  },
];
// Sign-quality all-day entries sit below real timed elections but above the
// weakest minors — a Virgo moon beats a Moon semi-sextile Saturn.
const SIGN_DAY_SCORE = 0.45;

interface DayPick {
  date: string; dow: string; startClock: string; endClock: string;
  score: number; why: string; allDay?: boolean;
  ord: number;   // day index within the scanned span — chronological sort key
}

function clockOf(ms: number, tzOffsetMin: number): string {
  const s = new Date(ms - tzOffsetMin * 60000);
  let h = s.getUTCHours();
  const m = s.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function scanDays(days: number, lat: number, lon: number, tzOffsetMin: number, startAt?: Date): Record<string, DayPick[]> {
  const out: Record<string, DayPick[]> = Object.fromEntries(ACTIVITIES.map(a => [a.key, []]));
  const start = startAt ?? new Date();
  for (let d = 0; d < days; d++) {
    const instant = new Date(start.getTime() + d * 86400000);
    const arc = computeDayArc(instant, lat, lon, tzOffsetMin);
    const dayStartMs = new Date(arc.dayStart).getTime();
    const local = new Date(dayStartMs - tzOffsetMin * 60000 + 12 * 3600000);
    const jdNoon = julianDay(new Date(dayStartMs + 12 * 3600000));
    const phase = moonPhase(jdNoon);
    const waxing = isWaxingAt(jdNoon);
    const moonSign = SIGNS[Math.floor(norm360(moonLongitude(jdNoon)) / 30) % 12];
    const dayRuler = WEEKDAY_RULERS[local.getUTCDay()];
    const dow = local.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const dateLabel = local.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

    const perfections = scanMoonPerfections(dayStartMs);
    const phaseName = phase.name;
    const isFullMoon = phaseName === "Full Moon";
    const isBalsamic = phaseName === "Waning Crescent";
    const mercuryRx = isRetrograde("Mercury", jdNoon);
    const skyAspects = getMajorAspects(jdNoon).filter(pa => (SOFT as any)[pa.aspect] > 0 && pa.orb <= 3);

    for (const a of ACTIVITIES) {
      const candidates: DayPick[] = [];

      // ── Timed elections: the swell around each qualifying perfection ──────
      for (const ev of perfections) {
        const aw = a.aspectW[ev.aspect] ?? 0;
        const pw = a.planetW[ev.planet] ?? 0;
        if (aw === 0 || pw === 0) continue;
        if (a.exclude?.[ev.planet]?.includes(ev.aspect)) continue;
        const exactH = (ev.timeMs - dayStartMs) / 3600000;
        const startH = Math.max(exactH - 2.5, 7);
        const endH = Math.min(exactH + 2.5, 23);
        if (endH - startH < 1.5) continue;

        let score = aw * pw;
        const dayMatch = (a.planetW[dayRuler] ?? 0) > 0 || a.planet === dayRuler;
        if (dayMatch) score *= 1.15;
        if (a.eveningBias) score *= endH >= 17 ? 1.2 : 0.85;
        if (a.waxingBias) score *= waxing ? 1.12 : 0.9;
        if (a.waningBias) score *= waxing ? 0.9 : 1.12;
        if (a.fullMoonBoost && isFullMoon) score *= 1.15;
        if (a.balsamicBoost && isBalsamic) score *= 1.12;

        const hard = ev.aspect === "square" || ev.aspect === "semi-square" || ev.aspect === "sesquiquadrate";
        const whyBits = [`Moon ${ev.aspect} ${ev.planet} · exact ${clockOf(ev.timeMs, tzOffsetMin)}`];
        if (hard) whyBits.push("raw fuel");
        if (dayMatch) whyBits.push(`${dayRuler}'s day`);
        if (a.fullMoonBoost && isFullMoon) whyBits.push("full moon");
        if (a.balsamicBoost && isBalsamic) whyBits.push("dark of the moon");
        if (a.mercuryRxNote && mercuryRx && (ev.planet === "Mercury" || ev.planet === "Saturn")) whyBits.push("Mercury Rx — review over new");
        candidates.push({
          date: dateLabel, dow, ord: d,
          startClock: clockOf(dayStartMs + startH * 3600000, tzOffsetMin),
          endClock: clockOf(dayStartMs + endH * 3600000, tzOffsetMin),
          score, why: whyBits.join(" · "),
        });
      }

      // ── The Moon's sign as an all-day quality entry ───────────────────────
      const gloss = a.signAffinity[moonSign];
      if (gloss) {
        let score = SIGN_DAY_SCORE;
        if (a.waningBias) score *= waxing ? 0.95 : 1.1;
        if (a.waxingBias) score *= waxing ? 1.1 : 0.95;
        if (a.fullMoonBoost && isFullMoon) score *= 1.15;
        if (a.balsamicBoost && isBalsamic) score *= 1.12;
        candidates.push({
          date: dateLabel, dow, ord: d, startClock: "", endClock: "",
          score,
          why: `Moon in ${moonSign} · ${gloss}${a.fullMoonBoost && isFullMoon ? " · full moon" : ""}${a.balsamicBoost && isBalsamic ? " · dark of the moon" : ""}`,
          allDay: true,
        });
      }

      // ── Rest: void-of-course stretches are windows ────────────────────────
      if (a.vocAsWindow) {
        for (const v of arc.vocWindows ?? []) {
          let startH = Math.max((Date.parse(v.start) - dayStartMs) / 3600000, 7);
          const endH = Math.min((Date.parse(v.end) - dayStartMs) / 3600000, 23);
          startH = Math.max(startH, endH - 4);
          if (endH - startH < 1.5) continue;
          candidates.push({
            date: dateLabel, dow, ord: d,
            startClock: clockOf(dayStartMs + startH * 3600000, tzOffsetMin),
            endClock: clockOf(dayStartMs + endH * 3600000, tzOffsetMin),
            score: 0.6 * (waxing ? 0.95 : 1.15),
            why: `void of course · slack water${waxing ? "" : " · waning"}`,
          });
        }
      }

      // ── Standing planet-planet aspect lifts the whole day ─────────────────
      if (a.pairPlanets && candidates.length) {
        const pair = skyAspects.find(pa =>
          a.pairPlanets!.includes(pa.planet1) && a.pairPlanets!.includes(pa.planet2) && pa.planet1 !== pa.planet2);
        if (pair) for (const c of candidates) {
          c.score *= 1.2;
          c.why += ` · ${pair.planet1}–${pair.planet2} ${pair.aspect}`;
        }
      }

      // Keep the best TWO per day — effort wants multiple windows, and one
      // strong day shouldn't monopolize an activity's whole section.
      candidates.sort((x, z) => z.score - x.score);
      out[a.key].push(...candidates.slice(0, 2));
    }
  }
  return out;
}

// The week's defining planet-planet aspect (classical planets, tightest orb).
function weekHeadline(midJd: number): string | null {
  const CLASSICAL = new Set(["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);
  const named = getMajorAspects(midJd)
    .filter(pa => CLASSICAL.has(pa.planet1) && CLASSICAL.has(pa.planet2) && pa.orb <= 3.5)
    .sort((x, z) => x.orb - z.orb)[0];
  return named ? `the week's sky: ${named.planet1} ${named.aspect} ${named.planet2} (${named.orb.toFixed(1)}°)` : null;
}

export function buildBestTimesCardSvg(opts: {
  span: "week" | "month"; lat: number; lon: number; tzOffsetMin: number;
  theme?: CardTheme; format?: CardFormat; startAt?: Date; tzLabel?: string;
}): { svg: string; width: number; height: number } {
  const { span, lat, lon, tzOffsetMin } = opts;
  const theme = opts.theme ?? "tide";
  const format = opts.format ?? "story";
  const W = 1080, H = format === "story" ? 1920 : 1350;
  const s = SURFACE[theme];
  const days = span === "week" ? 7 : 30;
  const picks = scanDays(days, lat, lon, tzOffsetMin, opts.startAt);

  const start = opts.startAt ?? new Date();
  const startLocal = new Date(start.getTime() - tzOffsetMin * 60000);
  const end = new Date(startLocal.getTime() + (days - 1) * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const tzNote = opts.tzLabel ? ` · times in ${opts.tzLabel}` : "";
  const kicker = `${span === "week" ? "best times" : "best days"} · ${fmt(startLocal)} – ${fmt(end)}${tzNote}`;
  const title = span === "week" ? "The week's best times" : "The month's best days";
  const midJd = julianDay(new Date(start.getTime() + (days / 2) * 86400000));
  const headline = span === "week" ? weekHeadline(midJd) : null;

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${s.bg}"/>`);
  parts.push(`<text x="${W / 2}" y="104" text-anchor="middle" font-family="${SERIF}" font-size="34" letter-spacing="12" font-weight="700" fill="${s.sub}">COMPASS</text>`);
  parts.push(`<text x="${W / 2}" y="154" text-anchor="middle" font-family="${SERIF}" font-size="26" fill="${s.sub}">${esc(kicker)}</text>`);
  parts.push(`<text x="${W / 2}" y="${format === "story" ? 250 : 230}" text-anchor="middle" font-family="${SERIF}" font-size="56" font-weight="700" fill="${s.ink}">${esc(title)}</text>`);
  if (headline) parts.push(`<text x="${W / 2}" y="${format === "story" ? 300 : 276}" text-anchor="middle" font-family="${SERIF}" font-size="25" font-style="italic" fill="${s.sub}">${esc(headline)}</text>`);

  const left = 110;
  // Dynamic stacking: each section takes only the height its rows need, so a
  // 4-row effort block and a 2-row study block share the card honestly.
  let y = format === "story" ? (headline ? 380 : 350) : 330;
  const ROW_H = format === "story" ? 80 : 66;
  const HEAD_H = format === "story" ? 104 : 88;

  // ── Week selection: GLOBAL greedy by score ──────────────────────────────────
  // A shared window (Moon sextile Venus serves both rest and connection) must
  // go to whichever activity scores it HIGHER — section order must not claim it
  // first. Then trim lowest-score rows until everything fits above the footer.
  const chosen: Record<string, DayPick[]> = Object.fromEntries(ACTIVITIES.map(a => [a.key, []]));
  if (span === "week") {
    const all: { act: Activity; p: DayPick }[] = [];
    for (const a of ACTIVITIES) for (const p of picks[a.key]) all.push({ act: a, p });
    all.sort((x, z) => z.p.score - x.p.score);
    const claimed = new Set<string>();
    for (const { act, p } of all) {
      const key = p.allDay ? `${p.dow}|allday|${act.key}` : `${p.dow}|${p.startClock}`;
      if (claimed.has(key)) continue;
      if (chosen[act.key].length >= act.maxRows) continue;
      if (p.allDay && chosen[act.key].some(t => t.allDay)) continue; // sign-days are seasoning
      claimed.add(key);
      chosen[act.key].push(p);
    }
    // Height budget: trim the globally weakest row (from sections that keep ≥1)
    // until the stack clears the footer.
    const budget = H - 150 - y;
    const heightOf = () => ACTIVITIES.reduce((h, a) => {
      const n = chosen[a.key].length;
      return h + (n === 0 ? HEAD_H + 30 : HEAD_H + n * ROW_H + 26);
    }, 0);
    while (heightOf() > budget) {
      // Gather every droppable candidate, then take the lowest score. The
      // previous shape assigned to a closed-over `let` inside .forEach, which
      // TypeScript cannot narrow (it widened to `never` and flagged .key/.idx).
      type Worst = { key: string; idx: number; score: number };
      const candidates: Worst[] = [];
      for (const a of ACTIVITIES) {
        if (chosen[a.key].length <= 1) continue;
        chosen[a.key].forEach((p, idx) => candidates.push({ key: a.key, idx, score: p.score }));
      }
      if (candidates.length === 0) break;
      const drop = candidates.reduce((lo, c) => (c.score < lo.score ? c : lo));
      chosen[drop.key].splice(drop.idx, 1);
    }
    for (const a of ACTIVITIES) {
      chosen[a.key].sort((x, z) => Date.parse(`${x.date} 2000`) - Date.parse(`${z.date} 2000`));
    }
  }

  ACTIVITIES.forEach(a => {
    const accent = ELEMENT_COLORS[theme][(PLANET_GLYPH[a.planet] ?? { element: "water" }).element];
    parts.push(glyphText(a.planet, left + 26, y + 14, 46, theme));
    parts.push(`<text x="${left + 70}" y="${y + 12}" font-family="${SERIF}" font-size="42" font-weight="700" fill="${s.ink}">${esc(a.label)}</text>`);
    parts.push(`<line x1="${left}" y1="${y + 42}" x2="${W - left}" y2="${y + 42}" stroke="${accent}" stroke-width="2.5" opacity="0.5"/>`);

    if (span === "week") {
      const top = chosen[a.key];
      if (top.length === 0) {
        parts.push(`<text x="${left + 10}" y="${y + HEAD_H}" font-family="${SERIF}" font-size="26" font-style="italic" fill="${s.sub}">no clean window this week — a quiet stretch for this</text>`);
        y += HEAD_H + 30;
      } else {
        top.forEach((p, ri) => {
          const ry = y + HEAD_H + ri * ROW_H;
          const when = p.allDay ? `${p.dow} · all day` : `${p.dow} · ${p.startClock}–${p.endClock}`;
          parts.push(`<text x="${left + 10}" y="${ry}" font-family="${SERIF}" font-size="32" font-weight="600" fill="${s.ink}">${esc(when)}</text>`);
          parts.push(`<text x="${left + 10}" y="${ry + 32}" font-family="${SERIF}" font-size="22.5" fill="${s.sub}">${esc(p.why)}</text>`);
        });
        y += HEAD_H + top.length * ROW_H + 26;
      }
    } else {
      const ranked = [...picks[a.key]].sort((x, z) => z.score - x.score);
      const seen = new Set<string>();
      const topDays: DayPick[] = [];
      for (const p of ranked) {
        if (seen.has(p.date)) continue;
        seen.add(p.date);
        topDays.push(p);
        if (topDays.length >= 5) break;
      }
      topDays.sort((x, z) => Date.parse(`${x.date} 2000`) - Date.parse(`${z.date} 2000`));
      let cx = left + 10;
      for (const p of topDays) {
        const label = `${p.dow} ${p.date}`;
        const wCh = label.length * 14 + 40;
        if (cx + wCh > W - left) break; // never clip a chip off the card edge
        parts.push(`<rect x="${cx}" y="${y + 66}" width="${wCh}" height="52" rx="26" fill="${accent}" opacity="0.14"/>`);
        parts.push(`<text x="${cx + wCh / 2}" y="${y + 100}" text-anchor="middle" font-family="${SERIF}" font-size="27" font-weight="600" fill="${s.ink}">${esc(label)}</text>`);
        cx += wCh + 16;
      }
      if (ranked[0]) {
        // Cap the lead line to the card's text column; trim at a clean "·"
        // boundary rather than mid-word (the pair-aspect suffix can overflow).
        let lead = `lead: ${ranked[0].dow} ${ranked[0].date} · ${ranked[0].why}`;
        const MAX = 74;
        if (lead.length > MAX) {
          const cut = lead.lastIndexOf(" · ", MAX);
          lead = cut > 30 ? lead.slice(0, cut) : lead.slice(0, MAX - 1) + "…";
        }
        parts.push(`<text x="${left + 10}" y="${y + 162}" font-family="${SERIF}" font-size="24" fill="${s.sub}">${esc(lead)}</text>`);
      }
      y += 220;
    }
  });

  parts.push(`<text x="${W / 2}" y="${H - 64}" text-anchor="middle" font-family="${SERIF}" font-size="26" font-style="italic" fill="${s.sub}">move with time</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
  return { svg, width: W, height: H };
}

// ═════════════════════════════════════════════════════════════════════════════
// Single-modality cards — one activity per card, the content workhorse
// (owner 2026-07-17): "when to train this week" is a clear promise a post can
// make. Same election engine, roomier layout: hero glyph, one subject, up to
// 7 entries with their aspect anchors.
// ═════════════════════════════════════════════════════════════════════════════

const ACTIVITY_TITLES: Record<string, { week: string; month: string; sub: string }> = {
  effort: { week: "When to train this week", month: "The month's training days", sub: "effort, workouts, the hard push" },
  rest: { week: "When to rest this week", month: "The month's rest days", sub: "real rest — the kind you elect" },
  connection: { week: "Connection this week", month: "The month's days for pleasure", sub: "dates, friends, delight" },
  study: { week: "Deep study this week", month: "The month's study days", sub: "focus, learning, the long read" },
};

export function buildActivityCardSvg(opts: {
  span: "week" | "month"; activity: string; lat: number; lon: number; tzOffsetMin: number;
  theme?: CardTheme; format?: CardFormat; startAt?: Date; tzLabel?: string;
}): { svg: string; width: number; height: number } {
  const { span, lat, lon, tzOffsetMin } = opts;
  const act = ACTIVITIES.find(a => a.key === opts.activity) ?? ACTIVITIES[0];
  const titles = ACTIVITY_TITLES[act.key] ?? { week: act.label, month: act.label, sub: "" };
  const theme = opts.theme ?? "tide";
  const format = opts.format ?? "story";
  const W = 1080, H = format === "story" ? 1920 : 1350;
  const s = SURFACE[theme];
  const days = span === "week" ? 7 : 30;
  const picks = scanDays(days, lat, lon, tzOffsetMin, opts.startAt)[act.key] ?? [];
  const accent = ELEMENT_COLORS[theme][(PLANET_GLYPH[act.planet] ?? { element: "water" }).element];

  const start = opts.startAt ?? new Date();
  const startLocal = new Date(start.getTime() - tzOffsetMin * 60000);
  const end = new Date(startLocal.getTime() + (days - 1) * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const tzNote = opts.tzLabel ? ` · times in ${opts.tzLabel}` : "";
  const kicker = `${fmt(startLocal)} – ${fmt(end)}${tzNote}`;

  // Selection: top entries by score; at most 2 per day (week) / 1 per day
  // (month); at most one all-day sign entry — then chronological.
  const cap = format === "story" ? 7 : 5;
  const perDayCap = span === "week" ? 2 : 1;
  const byDay: Record<string, number> = {};
  const rows: DayPick[] = [];
  let vocRows = 0;
  for (const p of [...picks].sort((x, z) => z.score - x.score)) {
    if (rows.length >= cap) break;
    if ((byDay[p.date] ?? 0) >= perDayCap) continue;
    if (p.allDay && rows.some(r => r.allDay)) continue;
    // A month of rest days shouldn't read 'void of course' seven times —
    // cap the identical anchor so Neptune windows and sign-days get seats.
    const isVoc = p.why.startsWith("void of course");
    if (isVoc && vocRows >= 3) continue;
    if (isVoc) vocRows++;
    byDay[p.date] = (byDay[p.date] ?? 0) + 1;
    rows.push(p);
  }
  rows.sort((x, z) => x.ord - z.ord);

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${s.bg}"/>`);
  parts.push(`<text x="${W / 2}" y="104" text-anchor="middle" font-family="${SERIF}" font-size="34" letter-spacing="12" font-weight="700" fill="${s.sub}">COMPASS</text>`);
  parts.push(`<text x="${W / 2}" y="154" text-anchor="middle" font-family="${SERIF}" font-size="26" fill="${s.sub}">${esc(kicker)}</text>`);

  // Hero: the activity's planet, large, over a soft accent ring.
  const heroY = format === "story" ? 340 : 300;
  parts.push(`<circle cx="${W / 2}" cy="${heroY}" r="96" fill="${accent}" opacity="0.10"/>`);
  parts.push(`<circle cx="${W / 2}" cy="${heroY}" r="96" fill="none" stroke="${accent}" stroke-width="2" opacity="0.4"/>`);
  parts.push(glyphText(act.planet, W / 2, heroY + 38, 110, theme));
  const titleY = heroY + 180;
  parts.push(`<text x="${W / 2}" y="${titleY}" text-anchor="middle" font-family="${SERIF}" font-size="58" font-weight="700" fill="${s.ink}">${esc(span === "week" ? titles.week : titles.month)}</text>`);
  parts.push(`<text x="${W / 2}" y="${titleY + 46}" text-anchor="middle" font-family="${SERIF}" font-size="26" font-style="italic" fill="${s.sub}">${esc(titles.sub)}</text>`);

  const rowY0 = titleY + (format === "story" ? 130 : 100);
  const ROW = format === "story" ? 128 : 108;
  if (rows.length === 0) {
    parts.push(`<text x="${W / 2}" y="${rowY0 + 40}" text-anchor="middle" font-family="${SERIF}" font-size="28" font-style="italic" fill="${s.sub}">no clean window in this span — a quiet stretch</text>`);
  }
  rows.forEach((p, i) => {
    const ry = rowY0 + i * ROW;
    const when = p.allDay ? `${p.dow} ${p.date} · all day` : `${p.dow} ${p.date} · ${p.startClock}–${p.endClock}`;
    parts.push(`<circle cx="${110 + 7}" cy="${ry - 12}" r="7" fill="${accent}" opacity="0.8"/>`);
    parts.push(`<text x="${150}" y="${ry}" font-family="${SERIF}" font-size="37" font-weight="600" fill="${s.ink}">${esc(when)}</text>`);
    parts.push(`<text x="${150}" y="${ry + 40}" font-family="${SERIF}" font-size="24.5" fill="${s.sub}">${esc(p.why)}</text>`);
    if (i < rows.length - 1) parts.push(`<line x1="150" y1="${ry + 66}" x2="${W - 110}" y2="${ry + 66}" stroke="${s.line}" stroke-width="1.5"/>`);
  });

  parts.push(`<text x="${W / 2}" y="${H - 64}" text-anchor="middle" font-family="${SERIF}" font-size="26" font-style="italic" fill="${s.sub}">move with time</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
  return { svg, width: W, height: H };
}

// ═════════════════════════════════════════════════════════════════════════════
// The cycle-in-wins card — a personal lunation review (owner 2026-07-18):
// total wins since the New Moon, per-star counts, the named wins, the
// intention. Private by default; rendered from the same momentum data the app
// shows, so the card can't disagree with the Wake.
// ═════════════════════════════════════════════════════════════════════════════

export function buildCycleWinsCardSvg(m: any, opts: {
  theme?: CardTheme; format?: CardFormat; tzLabel?: string;
}): { svg: string; width: number; height: number } {
  const theme = opts.theme ?? "tide";
  const format = opts.format ?? "story";
  const W = 1080, H = format === "story" ? 1920 : 1350;
  const s = SURFACE[theme];
  const fmtD = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const kicker = `this lunation · since the ${fmtD(m.cycleStart)} New Moon`;
  const cycleLedger = (m.ledger ?? []).filter((l: any) => l.date >= m.cycleStart);
  const namedWins = cycleLedger.filter((l: any) => l.source === "named").slice(0, 5);
  const starOf = (id: number | null) => (m.stars ?? []).find((x: any) => x.id === id);

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${s.bg}"/>`);
  parts.push(`<text x="${W / 2}" y="104" text-anchor="middle" font-family="${SERIF}" font-size="34" letter-spacing="12" font-weight="700" fill="${s.sub}">COMPASS</text>`);
  parts.push(`<text x="${W / 2}" y="154" text-anchor="middle" font-family="${SERIF}" font-size="26" fill="${s.sub}">${esc(kicker)}</text>`);

  // Hero: the count, huge — the wake speaks for itself.
  const heroY = format === "story" ? 400 : 340;
  parts.push(phaseDisc(W / 2, heroY - 110, 64, 0.0, true, theme));
  parts.push(`<text x="${W / 2}" y="${heroY + 60}" text-anchor="middle" font-family="${SERIF}" font-size="170" font-weight="700" fill="${s.ink}">${m.winsCycle ?? 0}</text>`);
  parts.push(`<text x="${W / 2}" y="${heroY + 116}" text-anchor="middle" font-family="${SERIF}" font-size="32" fill="${s.sub}">wins in the wake · ${m.streak} day${m.streak === 1 ? "" : "s"} at the helm</text>`);
  if ((m.intentions ?? [])[0]) {
    parts.push(`<text x="${W / 2}" y="${heroY + 168}" text-anchor="middle" font-family="${SERIF}" font-size="27" font-style="italic" fill="${s.ink}">"${esc(m.intentions[0].text.slice(0, 60))}"</text>`);
  }

  // Per-star counts
  let y = heroY + (format === "story" ? 250 : 210);
  const left = 130;
  for (const st of (m.stars ?? []).filter((x: any) => x.winsCycle > 0)) {
    const c = ELEMENT_COLORS[theme][st.element ?? "water"] ?? s.sub;
    parts.push(`<circle cx="${left}" cy="${y - 10}" r="9" fill="${c}"/>`);
    parts.push(`<text x="${left + 28}" y="${y}" font-family="${SERIF}" font-size="34" font-weight="600" fill="${s.ink}">${esc(st.title)}</text>`);
    parts.push(`<text x="${W - left}" y="${y}" text-anchor="end" font-family="${SERIF}" font-size="34" font-weight="700" fill="${c}">${st.winsCycle}</text>`);
    y += 62;
  }

  // The named wins — the lines with meaning
  if (namedWins.length) {
    y += 30;
    parts.push(`<text x="${left}" y="${y}" font-family="${SERIF}" font-size="24" letter-spacing="4" fill="${s.sub}">NAMED ALONG THE WAY</text>`);
    y += 48;
    for (const w of namedWins) {
      const star = starOf(w.goalId);
      // The ★ marker gets its own text node — mixed into the sentence it drags
      // the whole run out of Spectral and into the symbol face.
      parts.push(`<text x="${left}" y="${y}" font-family="Noto Sans Symbols 2" font-size="24" fill="#C8A04A">★</text>`);
      parts.push(`<text x="${left + 38}" y="${y}" font-family="${SERIF}" font-size="28" fill="${s.ink}">${esc(w.text.slice(0, 52))}${star ? `  <tspan font-size="21" fill="${s.sub}">· ${esc(star.title)}</tspan>` : ""}</text>`);
      y += 52;
      if (y > H - 160) break;
    }
  }

  parts.push(`<text x="${W / 2}" y="${H - 64}" text-anchor="middle" font-family="${SERIF}" font-size="26" font-style="italic" fill="${s.sub}">move with time</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
  return { svg, width: W, height: H };
}

// ── The election card ────────────────────────────────────────────────────────
// The keepable artifact from PAYING-PERSONAS §A3, and the thing the "$49 elect
// a date" SKU is actually delivering. It renders THE ELECTION YOU JUST RAN —
// the specific windows for the specific thing you asked about — rather than the
// general best-times card, which runs a parallel computation over four broad
// buckets and cannot name your matter.
//
// Deliberately keeps the refusal. If the engine found nothing, the card says so
// and says why. A card that always produces a cheerful list of times would be a
// different product: the "Avoid" verdict is the most distinctive thing this
// engine does, and it survives onto the artifact people keep and send.

export function buildElectionCardSvg(opts: {
  activityLabel: string;
  windows: { date: string; dow: string; startClock: string; endClock: string; tier: "good" | "great"; why: string; allDay?: boolean }[];
  cautions: string[];
  personalized: boolean;
  spanLabel: string;
  theme?: CardTheme; format?: CardFormat; tzLabel?: string;
}): { svg: string; width: number; height: number } {
  const theme = opts.theme ?? "tide";
  const format = opts.format ?? "story";
  const W = 1080, H = format === "story" ? 1920 : 1350;
  const s = SURFACE[theme];
  const accent = ELEMENT_COLORS[theme].water;

  const tzNote = opts.tzLabel ? ` · times in ${opts.tzLabel}` : "";
  const kicker = `${opts.spanLabel}${tzNote}`;

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${s.bg}"/>`);
  parts.push(`<text x="${W / 2}" y="104" text-anchor="middle" font-family="${SERIF}" font-size="34" letter-spacing="12" font-weight="700" fill="${s.sub}">COMPASS</text>`);
  parts.push(`<text x="${W / 2}" y="154" text-anchor="middle" font-family="${SERIF}" font-size="26" fill="${s.sub}">${esc(kicker)}</text>`);
  parts.push(`<text x="${W / 2}" y="244" text-anchor="middle" font-family="${SERIF}" font-size="34" fill="${s.sub}">When to begin</text>`);
  parts.push(`<text x="${W / 2}" y="316" text-anchor="middle" font-family="${SERIF}" font-size="58" font-weight="700" fill="${s.ink}">${esc(opts.activityLabel)}</text>`);

  const left = 110;
  let y = 420;

  if (opts.windows.length === 0) {
    // The refusal, rendered as the answer rather than as an empty state.
    parts.push(`<text x="${W / 2}" y="${y + 40}" text-anchor="middle" font-family="${SERIF}" font-size="46" font-style="italic" fill="${s.ink}">Not in this window.</text>`);
    y += 130;
    const reason = opts.cautions[0] ?? "Nothing in this range clears the bar for this matter.";
    for (const line of wrapCardText(reason, 46).slice(0, 4)) {
      parts.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${SERIF}" font-size="27" fill="${s.sub}">${esc(line)}</text>`);
      y += 40;
    }
  } else {
    const ROW_H = 132;
    const budget = H - 220 - y;
    const rows = opts.windows.slice(0, Math.max(1, Math.floor(budget / ROW_H)));
    for (const w of rows) {
      const isGreat = w.tier === "great";
      parts.push(`<rect x="${left - 30}" y="${y - 46}" width="${W - 2 * (left - 30)}" height="${ROW_H - 18}" rx="14" fill="${isGreat ? accent + "14" : "none"}"/>`);
      if (isGreat) parts.push(`<text x="${left}" y="${y}" font-family="${SERIF}" font-size="22" letter-spacing="3" font-weight="700" fill="${accent}">GREAT</text>`);
      const when = w.allDay ? `${w.dow} · all day` : `${w.dow} · ${w.startClock}–${w.endClock}`;
      parts.push(`<text x="${left + (isGreat ? 108 : 0)}" y="${y}" font-family="${SERIF}" font-size="38" fill="${s.ink}">${esc(when)}</text>`);
      // The GREAT badge eats ~108px of the row, so its subtitle gets a shorter
      // budget — otherwise the one row the card is drawing attention to is the
      // one that truncates mid-word.
      parts.push(`<text x="${left}" y="${y + 42}" font-family="${SERIF}" font-size="24" fill="${s.sub}">${esc(truncCard(w.why, isGreat ? 54 : 64))}</text>`);
      parts.push(`<line x1="${left}" y1="${y + 68}" x2="${W - left}" y2="${y + 68}" stroke="${s.line}" stroke-width="1"/>`);
      y += ROW_H;
    }
    // Cautions ride under the list — the engine's honesty, not a disclaimer.
    if (opts.cautions.length) {
      y += 16;
      for (const line of wrapCardText(opts.cautions.join(" · "), 60).slice(0, 3)) {
        parts.push(`<text x="${left}" y="${y}" font-family="${SERIF}" font-size="24" font-style="italic" fill="${s.sub}">${esc(line)}</text>`);
        y += 36;
      }
    }
  }

  parts.push(`<text x="${W / 2}" y="${H - 108}" text-anchor="middle" font-family="${SERIF}" font-size="24" fill="${s.sub}">${esc(opts.personalized ? "read against your chart" : "read from the sky alone")}</text>`);
  parts.push(`<text x="${W / 2}" y="${H - 62}" text-anchor="middle" font-family="${SERIF}" font-size="26" font-style="italic" fill="${s.sub}">move with time</text>`);

  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`, width: W, height: H };
}

/** Greedy word wrap — the card has no text layout engine behind it. */
function wrapCardText(text: string, perLine: number): string[] {
  const words = String(text).split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > perLine) { if (line) out.push(line.trim()); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) out.push(line.trim());
  return out;
}
const truncCard = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
