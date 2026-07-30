/**
 * Day-arc — the shape of a single day, not a snapshot.
 *
 * Scans the local day and produces:
 *   - character segments split at Moon ingresses (Building → Clear at 2:30pm)
 *   - VOC windows (from the last aspect perfected in a sign to the ingress out of it)
 *   - timed Moon-aspect perfections (Moon trine Mars ~5:45pm)
 *
 * This is what lets the app say "steady/earthy + void this morning, then airy with
 * afternoon trines" instead of collapsing the day into one reading.
 */

import { julianDay, moonLongitude, getPlanetPositions, sunLongitude, getPlanetaryHour, getNextAngularCrossings, voidOfCourse } from "./astro.js";
import { SIGN_TO_ELEMENT } from "./tide.js";

const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const ELEMENT_CHAR: Record<string,string> = { fire:"surge", earth:"building", air:"clear", water:"deep" };
const CHAR_LABEL: Record<string,string> = { surge:"Surge", building:"Building", clear:"Clear", deep:"Deep" };
const ASPECTS: { angle: number; name: string }[] = [
  { angle: 0, name: "conjunction" }, { angle: 60, name: "sextile" },
  { angle: 90, name: "square" }, { angle: 120, name: "trine" }, { angle: 180, name: "opposition" },
];
// Signed-separation form of ASPECTS (see the perfection-scan comment below) —
// every non-self-symmetric angle appears on both sides of the circle.
const SIGNED_ASPECTS: { angle: number; name: string }[] = ASPECTS.flatMap(({ angle, name }) =>
  angle === 0 || angle === 180 ? [{ angle, name }] : [{ angle, name }, { angle: 360 - angle, name }],
);
const ASPECT_PLANETS = ["Sun","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];

// Aspect crest by NATURE (hardness), not by ease: hard aspects are high-charge,
// conjunctions intensify, trines/sextiles are low-arousal ease.
const NATURE_AMP: Record<string, number> = {
  conjunction: 0.30, square: 0.26, opposition: 0.24, trine: 0.11, sextile: 0.08,
};
// How activating each planet is when the Moon touches it (OVERALL curve only).
// Mars/Uranus/Sun raise charge; Neptune/Venus barely do.
const PLANET_AROUSAL: Record<string, number> = {
  Mars: 1.0, Uranus: 0.95, Sun: 0.85, Jupiter: 0.7, Pluto: 0.65, Saturn: 0.55,
  Mercury: 0.55, Venus: 0.4, Neptune: 0.2,
};

const DEG2RAD = Math.PI / 180, RAD2DEG = 180 / Math.PI;
function norm360(d: number) { return ((d % 360) + 360) % 360; }
function sep180(a: number, b: number) { const d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; }

// Greenwich mean sidereal time (degrees).
function gmst(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T);
}

const OBLIQ = 23.439291 * DEG2RAD;

// Altitude (degrees) above the horizon of a body at ecliptic longitude `lonDeg`.
function altitudeOf(lonDeg: number, jd: number, lat: number, lon: number): number {
  const lambda = lonDeg * DEG2RAD;
  const ra = Math.atan2(Math.sin(lambda) * Math.cos(OBLIQ), Math.cos(lambda)) * RAD2DEG;
  const dec = Math.asin(Math.sin(OBLIQ) * Math.sin(lambda));
  const ha = norm360(gmst(jd) + lon - ra) * DEG2RAD;
  const latR = lat * DEG2RAD;
  return Math.asin(Math.sin(latR) * Math.sin(dec) + Math.cos(latR) * Math.cos(dec) * Math.cos(ha)) * RAD2DEG;
}
function moonAltitude(jd: number, lat: number, lon: number) { return altitudeOf(moonLongitude(jd), jd, lat, lon); }
function sunAltitude(jd: number, lat: number, lon: number) { return altitudeOf(sunLongitude(jd), jd, lat, lon); }
function signOf(lon: number) { return SIGNS[Math.floor(norm360(lon) / 30) % 12]; }
function charOf(sign: string) { const el = SIGN_TO_ELEMENT[sign] ?? "water"; return ELEMENT_CHAR[el] ?? "deep"; }

function bodyLon(name: string, jd: number): number {
  if (name === "Sun") return norm360(sunLongitude(jd));
  const p = getPlanetPositions(jd).find(x => x.planet === name);
  return p ? SIGNS.indexOf(p.sign) * 30 + p.degree : 0;
}

// The Moon's next sign ingress after `fromMs` — coarse 3h steps (the Moon
// spends ~2.5 days per sign, so this is cheap) then a 10-min refine. Used
// only to close out a void-of-course window that runs past midnight.
function nextIngressAfterMs(fromMs: number): number {
  const startSign = signOf(moonLongitude(julianDay(new Date(fromMs))));
  const COARSE = 3 * 3600000;
  let t = fromMs;
  for (let i = 0; i < 32; i++) { // up to 4 days ahead
    t += COARSE;
    if (signOf(moonLongitude(julianDay(new Date(t)))) !== startSign) break;
  }
  // Refine backward to the actual crossing.
  let hi = t, lo = t - COARSE;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (signOf(moonLongitude(julianDay(new Date(mid)))) !== startSign) hi = mid; else lo = mid;
  }
  return hi;
}

export interface DayArcEvent {
  time: string;      // ISO
  clock: string;     // "5:45 PM"
  kind: "ingress" | "aspect" | "crossing";
  label: string;
  planet?: string;
  aspect?: string;
  past?: boolean;
  weight?: number;   // peak contribution to the OVERALL curve (0..1) — for the hover breakdown
  charge?: "high" | "low"; // whether this aspect raises charge much or barely
}

export interface DayArcSegment {
  start: string; end: string;
  sign: string; character: string; characterLabel: string;
  voc: boolean;
}

export interface DayArcCurvePoint {
  t: string;       // ISO
  hour: number;    // 0..24 local hour
  e: number;       // energy 0..1
  character: string;
}

export interface DayArc {
  dayStart: string; dayEnd: string;
  segments: DayArcSegment[];
  events: DayArcEvent[];
  vocWindows: { start: string; end: string }[];
  curve: DayArcCurvePoint[];
  curves: Record<string, DayArcCurvePoint[]>;
  lenses: { key: string; label: string }[];
  height: number;
  heightFactors: { phase: number; activation: number; season: number; standing: number };
}

// Format an absolute instant as a wall-clock time in the viewer's timezone.
// tzOffsetMin follows Date.getTimezoneOffset (minutes to add to local to reach UTC).
function clock(d: Date, tzOffsetMin: number) {
  const s = new Date(d.getTime() - tzOffsetMin * 60000);
  let h = s.getUTCHours();
  const m = s.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Find the best (highest-energy) windows in a single day's lens curve — the
// "when should I work out / study / rest today" query. Greedy peak-pick with a
// minimum gap so we don't return five overlapping slices of the same swell.
export interface PeakWindow { startHour: number; endHour: number; peakHour: number; peakE: number }
export function findPeakWindows(curve: DayArcCurvePoint[], topN = 2, minGapHours = 3): PeakWindow[] {
  const sorted = [...curve].sort((a, b) => b.e - a.e);
  const picked: PeakWindow[] = [];
  for (const p of sorted) {
    if (picked.length >= topN) break;
    if (picked.some(w => Math.abs(w.peakHour - p.hour) < minGapHours)) continue;
    const threshold = p.e * 0.85;
    let start = p.hour, end = p.hour;
    for (const q of curve) {
      if (q.e >= threshold && Math.abs(q.hour - p.hour) < minGapHours) {
        start = Math.min(start, q.hour);
        end = Math.max(end, q.hour);
      }
    }
    picked.push({ startHour: start, endHour: end, peakHour: p.hour, peakE: p.e });
  }
  return picked.sort((a, b) => a.startHour - b.startHour);
}

export function computeDayArc(now: Date, _lat: number, _lon: number, tzOffsetMin = 0): DayArc {
  // Anchor the day to the viewer's local midnight (not the server's, which is UTC on
  // Railway). Shift the instant into viewer-local wall time, read its Y/M/D, then map
  // that local midnight back to a UTC instant.
  const shifted = new Date(now.getTime() - tzOffsetMin * 60000);
  const dayStart = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0, 0, 0) + tzOffsetMin * 60000,
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600000);
  const STEP_MS = 10 * 60000; // 10-minute resolution

  // Precompute all VOC/aspect planet longitudes are cheap enough per step.
  const ingresses: { t: Date; sign: string }[] = [];
  const perfections: { t: Date; planet: string; aspect: string }[] = [];

  let prevJd = julianDay(dayStart);
  let prevMoon = norm360(moonLongitude(prevJd));
  let prevSign = signOf(prevMoon);
  // SIGNED separation (Moon minus target, 0..360), not the folded 0..180 one:
  // the folded distance only *touches* 0 at a conjunction and 180 at an
  // opposition without a sign change, so the old product-sign crossing test
  // silently missed both, and any void-of-course whose defining perfection
  // was a conjunction/opposition started up to hours early (audit F2/F3b).
  // The signed delta increases monotonically (the Moon outruns every
  // classical planet), so every angle is a clean crossing — see voidOfCourse.
  const prevDelta: Record<string, number> = {};
  for (const p of ASPECT_PLANETS) prevDelta[p] = norm360(prevMoon - bodyLon(p, prevJd));

  for (let t = dayStart.getTime() + STEP_MS; t <= dayEnd.getTime(); t += STEP_MS) {
    const d = new Date(t);
    const jd = julianDay(d);
    const mLon = norm360(moonLongitude(jd));
    const sign = signOf(mLon);
    if (sign !== prevSign) ingresses.push({ t: d, sign });
    for (const p of ASPECT_PLANETS) {
      const del = norm360(mLon - bodyLon(p, jd));
      const prev = prevDelta[p];
      if (del >= prev) {
        for (const A of SIGNED_ASPECTS) if (prev < A.angle && A.angle <= del) { perfections.push({ t: d, planet: p, aspect: A.name }); break; }
      } else {
        for (const A of SIGNED_ASPECTS) if (A.angle > prev || A.angle <= del) { perfections.push({ t: d, planet: p, aspect: A.name }); break; }
      }
      prevDelta[p] = del;
    }
    prevSign = sign; prevMoon = mLon; prevJd = jd;
  }

  // Build character segments split at ingresses
  const boundaries: Date[] = [dayStart, ...ingresses.map(i => i.t), dayEnd];
  const segments: DayArcSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const s = boundaries[i], e = boundaries[i + 1];
    const mid = new Date((s.getTime() + e.getTime()) / 2);
    const sign = signOf(norm360(moonLongitude(julianDay(mid))));
    const character = charOf(sign);
    // VOC within this segment: from the last perfection inside it to the segment end (ingress).
    const inSeg = perfections.filter(p => p.t >= s && p.t < e);
    const lastPerf = inSeg.length ? inSeg[inSeg.length - 1].t : s;
    // The trailing segment ends at midnight, not a real ingress, so it never
    // had an ingress of its own to check the void tail against — a void that
    // starts today and runs past midnight was invisible here (audit F3a).
    // voidOfCourse scans forward to the REAL next ingress regardless of the
    // day boundary, so it answers this case correctly.
    const endsAtIngress = i < boundaries.length - 2;
    const voc = endsAtIngress
      ? lastPerf.getTime() < e.getTime()
      : voidOfCourse(julianDay(lastPerf)).voc;
    segments.push({
      start: s.toISOString(), end: e.toISOString(),
      sign, character, characterLabel: CHAR_LABEL[character] ?? character,
      voc,
    });
  }

  // VOC windows — includes a trailing cross-midnight window when the last
  // segment is void (audit F3a); its end is the real next ingress, found via
  // a short forward scan rather than assumed to fall within today.
  const vocWindows: { start: string; end: string }[] = [];
  for (let i = 0; i < boundaries.length - 2; i++) {
    const s = boundaries[i], e = boundaries[i + 1];
    const inSeg = perfections.filter(p => p.t >= s && p.t < e);
    const lastPerf = inSeg.length ? inSeg[inSeg.length - 1].t : s;
    if (lastPerf.getTime() < e.getTime()) vocWindows.push({ start: lastPerf.toISOString(), end: e.toISOString() });
  }
  {
    const lastSeg = segments[segments.length - 1];
    if (lastSeg?.voc) {
      const s = boundaries[boundaries.length - 2], e = boundaries[boundaries.length - 1];
      const inSeg = perfections.filter(p => p.t >= s && p.t < e);
      const lastPerf = inSeg.length ? inSeg[inSeg.length - 1].t : s;
      const ingressMs = nextIngressAfterMs(e.getTime());
      vocWindows.push({ start: lastPerf.toISOString(), end: new Date(ingressMs).toISOString() });
    }
  }

  // Angle crossings — the day's peak MOMENTS (a planet on the Ascendant or
  // Midheaven, ~20 min each). Luminaries + benefics/malefics only, and only
  // the two culminating angles, so the chart marks moments, not the full
  // 36-crossing diurnal churn. (Owner 2026-07-23: the tide chart should
  // include planetary angle crossings.)
  const CROSSING_PLANETS = new Set(["Sun", "Moon", "Venus", "Jupiter", "Mars", "Saturn"]);
  const ANGLE_WORD: Record<string, string> = { ASC: "rising", MC: "at the Midheaven" };
  const crossings = getNextAngularCrossings(julianDay(dayStart), _lat, _lon, 3, 24)
    .filter(c => CROSSING_PLANETS.has(c.planet) && (c.angle === "ASC" || c.angle === "MC"))
    .map(c => {
      const t = new Date(c.crossingTime);
      return {
        time: t.toISOString(), clock: clock(t, tzOffsetMin), kind: "crossing" as const,
        label: `${c.planet} ${ANGLE_WORD[c.angle]}`, planet: c.planet, past: t < now,
      };
    })
    .filter(c => c.time >= dayStart.toISOString() && c.time < dayEnd.toISOString());

  const events: DayArcEvent[] = [
    ...ingresses.map(i => ({
      time: i.t.toISOString(), clock: clock(i.t, tzOffsetMin), kind: "ingress" as const,
      label: `Moon enters ${i.sign}`, past: i.t < now,
    })),
    ...perfections.map(p => {
      const w = (NATURE_AMP[p.aspect] ?? 0.15) * (PLANET_AROUSAL[p.planet] ?? 0.5);
      return {
        time: p.t.toISOString(), clock: clock(p.t, tzOffsetMin), kind: "aspect" as const,
        label: `Moon ${p.aspect} ${p.planet}`, planet: p.planet, aspect: p.aspect, past: p.t < now,
        weight: parseFloat(w.toFixed(3)), charge: (w >= 0.14 ? "high" : "low") as "high" | "low",
      };
    }),
    ...crossings,
  ].sort((a, b) => a.time.localeCompare(b.time));

  // ── HEIGHT: where the whole day's tide floats (one value for the day) ────────
  // phase (moon/sun light) + cumulative aspect activation + season/daylight
  // (hemisphere-aware) + standing non-lunar aspects.
  const midJd = julianDay(new Date((dayStart.getTime() + dayEnd.getTime()) / 2));
  const sunMid = sunLongitude(midJd), moonMid = moonLongitude(midJd);
  const illum = (1 - Math.cos(norm360(moonMid - sunMid) * DEG2RAD)) / 2;   // 0..1

  // Cumulative activation: how many planets the Moon is lighting up (10° orb).
  let cluster = 0;
  for (const p of ASPECT_PLANETS) {
    const s = sep180(moonMid, bodyLon(p, midJd));
    const near = Math.min(...[0, 60, 90, 120, 180].map(A => Math.abs(s - A)));
    if (near <= 10) cluster += 1 - near / 10;
  }
  const clusterH = Math.min(1, cluster / 4);

  // Season / daylight fraction at this latitude — flips in the S. hemisphere for free.
  const decl = Math.asin(Math.sin(OBLIQ) * Math.sin(sunMid * DEG2RAD));
  const cosH = Math.max(-1, Math.min(1, -Math.tan(_lat * DEG2RAD) * Math.tan(decl)));
  const daylightFrac = Math.acos(cosH) / Math.PI;                          // 0..1

  // Standing non-lunar aspects (classical planets, tight) — smallest weight.
  let standing = 0;
  for (let i = 0; i < ASPECT_PLANETS.length; i++) {
    for (let j = i + 1; j < ASPECT_PLANETS.length; j++) {
      const s = sep180(bodyLon(ASPECT_PLANETS[i], midJd), bodyLon(ASPECT_PLANETS[j], midJd));
      const near = Math.min(...[0, 60, 90, 120, 180].map(A => Math.abs(s - A)));
      if (near <= 3) standing += 1 - near / 3;
    }
  }
  const standingH = Math.min(1, standing / 5);

  // The day's floor is set by PHASE first (a new moon is genuinely low, a full
  // moon genuinely high), with a small seasonal-daylight lift and a whisper of
  // standing background weather. Aspect *cluster* was removed from the floor —
  // individual aspects belong in the SHAPE as crests, not raising the whole day
  // (that double-counted, and let soft aspects inflate a quiet day's baseline).
  const height = Math.max(0, Math.min(1, 0.15 + 0.50 * illum + 0.13 * daylightFrac + 0.05 * standingH));

  // ── SHAPE: aspect crests + VOC becalming + hour whisper ──────────────────────
  // (Moon/sun *altitude* was removed — where the Moon sits above the horizon is
  // not an astrological energy signal, only an optics one, so it no longer wobbles
  // the curve. Owner call: "moon altitude shouldn't matter astrologically.")
  const CURVE_STEP_MS = 15 * 60000;
  const HOUR_ADJ: Record<string, number> = {   // planetary hours — a whisper only
    Moon: -0.02, Saturn: -0.03, Sun: 0.025, Mars: 0.03, Jupiter: 0.03, Venus: 0.01, Mercury: 0,
  };
  // The Moon crosses an aspect's orb over many hours (~0.5°/hr), so its charge
  // swells and fades gently rather than spiking — a wide envelope, not a needle.
  const SIGMA_H = 3.6;
  const W_MOON_ALT = 0, W_SUN_ALT = 0;          // altitude no longer shapes the curve
  const HOUR_BLEND_MIN = 20;                     // cross-fade window around each hour boundary

  // Smoothed hour-whisper: cross-fades between the current and next/previous hour's
  // adjustment near a boundary (cosine ease) instead of jumping instantly — this is
  // what removes the staircase steps from the curve.
  function smoothedHourAdj(t: number): number {
    const ph = getPlanetaryHour(new Date(t), _lat, _lon);
    const cur = HOUR_ADJ[ph.ruler] ?? 0;
    const msIntoHour = t - ph.startTime.getTime();
    const msToEnd = ph.endTime.getTime() - t;
    const blendMs = HOUR_BLEND_MIN * 60000;
    if (msIntoHour < blendMs) {
      const prevPh = getPlanetaryHour(new Date(ph.startTime.getTime() - 60000), _lat, _lon);
      const prev = HOUR_ADJ[prevPh.ruler] ?? 0;
      const f = 0.5 - 0.5 * Math.cos((msIntoHour / blendMs) * Math.PI); // 0→1 ease
      return prev + (cur - prev) * f;
    }
    if (msToEnd < blendMs) {
      const nextPh = getPlanetaryHour(new Date(ph.endTime.getTime() + 60000), _lat, _lon);
      const next = HOUR_ADJ[nextPh.ruler] ?? 0;
      const f = 0.5 - 0.5 * Math.cos(((blendMs - msToEnd) / blendMs) * Math.PI); // 0→1 ease
      return cur + (next - cur) * f;
    }
    return cur;
  }

  const steps: { t: number; hour: number; mAlt: number; sAlt: number }[] = [];
  for (let t = dayStart.getTime(); t <= dayEnd.getTime(); t += CURVE_STEP_MS) {
    const jd = julianDay(new Date(t));
    steps.push({ t, hour: (t - dayStart.getTime()) / 3600000, mAlt: moonAltitude(jd, _lat, _lon), sAlt: sunAltitude(jd, _lat, _lon) });
  }
  const nrm = (v: number, arr: number[]) => { const lo = Math.min(...arr), hi = Math.max(...arr); return (v - lo) / (hi - lo || 1); };
  const mAlts = steps.map(s => s.mAlt), sAlts = steps.map(s => s.sAlt);
  const vocMs = vocWindows.map(v => [Date.parse(v.start), Date.parse(v.end)] as [number, number]);
  const VOC_BLEND_MS = 20 * 60000;
  function vocFactorAt(t: number, windows: [number, number][]): number {
    for (const [a, b] of windows) {
      if (t >= a && t < b) {
        const inFromStart = t - a, inFromEnd = b - t;
        const edge = Math.min(inFromStart, inFromEnd, VOC_BLEND_MS);
        return edge >= VOC_BLEND_MS ? 0 : 0.5 + 0.5 * Math.cos((edge / VOC_BLEND_MS) * Math.PI); // 1 at edge, 0 deep inside
      }
      if (t < a && a - t < VOC_BLEND_MS) return 0.5 - 0.5 * Math.cos(((a - t) / VOC_BLEND_MS) * Math.PI);
      if (t >= b && t - b < VOC_BLEND_MS) return 0.5 - 0.5 * Math.cos(((t - b) / VOC_BLEND_MS) * Math.PI);
    }
    return 1;
  }
  const perfMs = perfections.map(p => ({
    t: p.t.getTime(), planet: p.planet, aspect: p.aspect,
    amp: NATURE_AMP[p.aspect] ?? 0.15,
    arousal: PLANET_AROUSAL[p.planet] ?? 0.5,
  }));

  // Base component per step — now just the smoothed planetary-hour whisper
  // (altitude terms removed; W_MOON_ALT/W_SUN_ALT are 0).
  const baseComp = steps.map(s => smoothedHourAdj(s.t));
  const signChar = steps.map(s => charOf(signOf(norm360(moonLongitude(julianDay(new Date(s.t)))))));

  // Lenses — the same tide, but SIGNED per-planet weights so lenses that pull in
  // opposite directions (Body vs Rest, Focus vs Connect) genuinely invert at the
  // same aspect crest rather than both just rising by different amounts.
  // Lenses = the four ELEMENTS (per the vocabulary treaty: elements are the
  // domains of a life). Replaced the old Focus/Body/Connect/Rest activity
  // lenses, which were a fourth vocabulary belonging to no treaty layer.
  // Each lens responds to (a) Moon-aspect crests via planet→element affinity
  // weights and (b) the Moon's SIGN element — a baseline lift when the Moon
  // swims through the lens's own element, a small dip in its antagonist
  // (fire↔water, earth↔air). The old lenses ignored (b) entirely, which is
  // why low-aspect days made every lens look identical.
  const LENSES: { key: string; label: string; w: Record<string, number> }[] = [
    { key: "overall", label: "Overall", w: {} },
    { key: "fire",    label: "Fire",    w: { Mars: 2.2, Sun: 1.6, Jupiter: 1.0, Moon: -0.2, Saturn: -0.8, Neptune: -0.8 } },
    { key: "earth",   label: "Earth",   w: { Saturn: 2.0, Venus: 1.2, Mercury: 0.8, Sun: 0.6, Mars: 0.3, Neptune: -0.6 } },
    { key: "air",     label: "Air",     w: { Mercury: 2.2, Uranus: 1.4, Venus: 1.2, Jupiter: 1.0, Sun: 0.5, Moon: -0.3, Saturn: -0.3 } },
    { key: "water",   label: "Water",   w: { Moon: 2.2, Neptune: 1.6, Venus: 1.0, Pluto: 0.6, Jupiter: 0.3, Mars: -1.0, Mercury: -0.5, Sun: -0.3 } },
  ];

  const CHAR_TO_ELEMENT: Record<string, string> = { deep: "water", surge: "fire", building: "earth", clear: "air" };
  const ELEMENT_ANTAGONIST: Record<string, string> = { fire: "water", water: "fire", earth: "air", air: "earth" };

  function buildCurve(weights: Record<string, number>, isOverall: boolean, lensElement?: string): DayArcCurvePoint[] {
    return steps.map((s, i) => {
      let crests = 0;
      for (const pf of perfMs) {
        // Specialized lenses ignore planets they have no opinion on (weight 0) —
        // only overall includes everything, so each lens's signal stays sharp.
        const w = weights[pf.planet] ?? (isOverall ? 1 : 0);
        if (w === 0) continue;
        // On the OVERALL curve, scale each crest by how activating the planet is,
        // so a Moon–Neptune trine barely lifts the tide while a Moon–Mars square
        // genuinely does. Lens curves keep their own thematic weighting.
        const arousal = isOverall ? pf.arousal : 1;
        crests += pf.amp * w * arousal * Math.exp(-0.5 * ((s.t - pf.t) / 3600000 / SIGMA_H) ** 2);
      }
      // Moon-sign element resonance for element lenses.
      let signLift = 0;
      if (lensElement) {
        const stepEl = CHAR_TO_ELEMENT[signChar[i]] ?? "water";
        if (stepEl === lensElement) signLift = 0.05;
        else if (ELEMENT_ANTAGONIST[lensElement] === stepEl) signLift = -0.03;
      }
      let e = height + baseComp[i] + crests + signLift;
      // VOC becalms the shape — eased in/out over a blend window (not an instant
      // multiply) so the curve doesn't step at the void's edges. vocF: 1 = fully
      // outside the void, 0 = deep inside it.
      const vocF = vocFactorAt(s.t, vocMs);
      e = height + (e - height) * (0.35 + 0.65 * vocF);
      e = Math.max(0, Math.min(1, e));
      return { t: new Date(s.t).toISOString(), hour: parseFloat(s.hour.toFixed(2)), e: parseFloat(e.toFixed(3)), character: signChar[i] };
    });
  }

  const curves: Record<string, DayArcCurvePoint[]> = {};
  for (const L of LENSES) curves[L.key] = buildCurve(L.w, L.key === "overall", L.key === "overall" ? undefined : L.key);

  // Planet-keyed curves ("planet:Mars", …) — a Guiding Star diagnosed to a
  // ruling planet gets timing from when the Moon activates THAT planet, which
  // is sharper than its element (Mars for training, not just "fire"). Each
  // planet borrows its own element for the Moon-sign baseline lift.
  const PLANET_LENS_ELEMENT: Record<string, string> = {
    Sun: "fire", Moon: "water", Mercury: "air", Venus: "earth", Mars: "fire", Jupiter: "fire", Saturn: "earth",
  };
  for (const [p, el] of Object.entries(PLANET_LENS_ELEMENT)) {
    curves[`planet:${p}`] = buildCurve({ [p]: 2.2 }, false, el);
  }

  return {
    dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString(),
    segments, events, vocWindows,
    curve: curves.overall,
    curves,
    lenses: LENSES.map(L => ({ key: L.key, label: L.label })),
    height: parseFloat(height.toFixed(3)),
    heightFactors: {
      phase: parseFloat(illum.toFixed(2)),
      activation: parseFloat(clusterH.toFixed(2)),
      season: parseFloat(daylightFrac.toFixed(2)),
      standing: parseFloat(standingH.toFixed(2)),
    },
  };
}
