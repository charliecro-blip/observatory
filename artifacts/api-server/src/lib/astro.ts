/**
 * Ephemeris calculations for astrological context.
 *
 * 2026-07-20: Sun, Moon, and the eight planets delegate to astronomy-engine
 * (see ephemeris.ts) — the audit found the old hand-rolled model wrong-sign up
 * to ~6% for the outers.
 *
 * 2026-07-27: Chiron (the one body astronomy-engine doesn't cover) moved from
 * a flat 2D mean-elements fit to a full 3D Kepler solution from fitted JPL
 * osculating elements (see CHIRON below) — the 2D fit was calibrated to a
 * single 2026 epoch and drifted ~7° by 1992 (item #26). The old 2D Kepler
 * machinery (ORBITAL/heliocentricEcliptic/geoFromHelio) was removed with it.
 *
 * Asteroids (Ceres/Pallas/Juno/Vesta) use the same 3D Kepler solver further
 * down, from J2000 mean elements with a calibrated M0.
 */

import { accurateLongitude, accurateRetrograde, HAS_ACCURATE } from "./ephemeris.js";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

// Health influences by sign
const SIGN_HEALTH: Record<string, string[]> = {
  Aries:       ["head", "energy surges", "inflammation watch"],
  Taurus:      ["throat", "thyroid", "grounding practices"],
  Gemini:      ["nervous system", "lungs", "breath work"],
  Cancer:      ["digestion", "emotional eating", "gut health"],
  Leo:         ["heart", "spine", "vitality"],
  Virgo:       ["digestion", "detox", "nervous system refinement"],
  Libra:       ["kidneys", "adrenals", "balance"],
  Scorpio:     ["elimination", "hormones", "deep healing"],
  Sagittarius: ["liver", "hips", "expansion"],
  Capricorn:   ["bones", "joints", "discipline"],
  Aquarius:    ["circulation", "ankles", "innovation"],
  Pisces:      ["lymph", "feet", "deep rest"],
};

// ── Core math ─────────────────────────────────────────────────────────────────

function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function longitudeToSign(deg: number): { sign: string; degree: number } {
  const norm  = normalize360(deg);
  const index = Math.floor(norm / 30) % 12;
  return { sign: SIGNS[index], degree: norm % 30 };
}

// ── Chiron (2060 Chiron) — 3D Kepler from fitted osculating elements ─────────
// A centaur, not covered by astronomy-engine. Base elements: JPL Horizons
// soln JPL#171 (epoch JD 2457916.5 TDB = 2017-Jun-12), then all six elements
// + mean motion least-squares-fitted against 987 Horizons apparent
// ecliptic-of-date longitudes at 30-day steps spanning 1950–2030 (fit run
// 2026-07-27; the fit absorbs two-body drift away from the osculating epoch).
// Residuals vs Horizons: max 0.10°, rms 0.05° across the whole 1950–2030 range.
// Verified epochs: 1977-11-01 discovery 3.1° Tau (published 3°08' Tau),
// 1992-01-03 8.3° Leo (Swiss Ephemeris ~8.2° Leo — the old 2D model said
// 15.6° Leo, item #26), 2018-04-17 Aries ingress day 0.0° Ari.
// Elements live in the J2000 ecliptic frame: Earth is precessed INTO that
// frame and the result precessed BACK to of-date, matching astronomy-engine's
// apparent-of-date convention used for the planets. n in deg/day.
const CHIRON = {
  a: 13.657229, e: 0.380605, i: 7.080841, om: 209.213632, w: 339.559240,
  M0: 152.288105, epoch: 2457916.5, n: 0.019542262,
};

/** Earth's radius vector in AU (Meeus low-precision; ±0.017 AU annual swing). */
function earthRadiusAU(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const M = normalize360(357.52911 + 35999.05029 * T) * DEG2RAD;
  const e = 0.016708634 - 0.000042037 * T;
  const nu = M + (2 * e - 0.25 * e ** 3) * Math.sin(M) + 1.25 * e * e * Math.sin(2 * M);
  return 1.000001018 * (1 - e * e) / (1 + e * Math.cos(nu));
}

/** Geocentric apparent ecliptic-of-date longitude of Chiron, degrees 0..360. */
function chironGeoLongitude(jd: number): number {
  const el = CHIRON;
  const M = normalize360(el.M0 + el.n * (jd - el.epoch)) * DEG2RAD;
  // Kepler's equation for eccentric anomaly (e≈0.38 needs the Newton iteration)
  let E = M;
  for (let k = 0; k < 20; k++) E = E - (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
  const xv = el.a * (Math.cos(E) - el.e);
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const v = Math.atan2(yv, xv);                      // true anomaly
  const r = Math.hypot(xv, yv);
  const O = el.om * DEG2RAD, w = el.w * DEG2RAD, inc = el.i * DEG2RAD;
  const u = v + w;
  const xh = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(inc));
  const yh = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(inc));
  const T = (jd - 2451545.0) / 36525;
  const p = (5029.0966 * T + 1.11113 * T * T) / 3600; // general precession in longitude, deg
  const earthLam = normalize360(sunLongitude(jd) + 180 - p) * DEG2RAD;
  const rE = earthRadiusAU(jd);
  const xg = xh - rE * Math.cos(earthLam), yg = yh - rE * Math.sin(earthLam);
  return normalize360(Math.atan2(yg, xg) * RAD2DEG + p);
}

// ── Public functions ──────────────────────────────────────────────────────────

export function julianDay(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400;
  const A = Math.trunc(y / 100);
  const B = 2 - A + Math.trunc(A / 4);
  if (m < 3) {
    return Math.trunc(365.25 * (y - 1)) + Math.trunc(30.6001 * (m + 13)) + d + 1720994.5 + B;
  }
  return Math.trunc(365.25 * y) + Math.trunc(30.6001 * (m + 1)) + d + 1720994.5 + B;
}

// Sun & Moon now come from astronomy-engine (accurate to sub-arcminute); the
// old polynomial series are retired. The Moon especially: max error dropped
// from ~31 min of timing to seconds, which the election engine depends on.
export function sunLongitude(jd: number): number {
  return accurateLongitude("Sun", jd);
}

export function moonLongitude(jd: number): number {
  return accurateLongitude("Moon", jd);
}

export function moonPhase(jd: number): { name: string; fraction: number } {
  const sun  = sunLongitude(jd);
  const moon = moonLongitude(jd);
  const elongation = normalize360(moon - sun);
  const fraction = (1 - Math.cos((elongation * DEG2RAD))) / 2;

  let name: string;
  if      (elongation <  22.5) name = "New Moon";
  else if (elongation <  67.5) name = "Waxing Crescent";
  else if (elongation < 112.5) name = "First Quarter";
  else if (elongation < 157.5) name = "Waxing Gibbous";
  else if (elongation < 202.5) name = "Full Moon";
  else if (elongation < 247.5) name = "Waning Gibbous";
  else if (elongation < 292.5) name = "Last Quarter";
  else if (elongation < 337.5) name = "Waning Crescent";
  else                          name = "New Moon";

  return { name, fraction };
}

/** Geocentric longitude of a named planet at a given JD. The eight planets via
 *  astronomy-engine; Chiron via the fitted 3D Kepler model above. */
function geocentricLongitude(name: string, jd: number): number {
  if (HAS_ACCURATE(name)) return accurateLongitude(name, jd);
  if (name === "Chiron") return chironGeoLongitude(jd);
  return NaN; // unknown body — callers pass fixed name lists
}

/**
 * Returns true if the planet's geocentric longitude is decreasing (retrograde).
 * Sun and Moon cannot retrograde.
 */
export function isRetrograde(planet: string, jd: number): boolean {
  if (planet === "Sun" || planet === "Moon") return false;
  if (HAS_ACCURATE(planet)) return accurateRetrograde(planet, jd);
  if (planet !== "Chiron") return false;
  const lon1 = geocentricLongitude(planet, jd);
  const lon2 = geocentricLongitude(planet, jd + 1);
  return normalize360(lon2 - lon1) > 180;
}

export function getPlanetPositions(jd: number) {
  const sun  = sunLongitude(jd);
  const moon = moonLongitude(jd);

  const results: Array<{ planet: string; sign: string; degree: number; longitude: number; retrograde: boolean }> = [
    { planet: "Sun",  longitude: sun,  retrograde: false, ...longitudeToSign(sun)  },
    { planet: "Moon", longitude: moon, retrograde: false, ...longitudeToSign(moon) },
  ];

  for (const name of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron"] as const) {
    const geo = geocentricLongitude(name, jd);
    results.push({ planet: name, longitude: geo, retrograde: isRetrograde(name, jd), ...longitudeToSign(geo) });
  }

  return results;
}

// Mean lunar nodes — the Moon's orbital nodes: the ascending North Node (☊) and
// the opposite South Node (☋). The eclipse axis; a core natal placement in most
// traditions. Standard mean-node formula (retrograde by nature, ~-0.053°/day).
// Kept out of getPlanetPositions on purpose so nodes don't silently enter every
// daily aspect/transit calc; callers add them where they're actually wanted.
export function lunarNodes(jd: number): {
  north: { longitude: number; sign: string; degree: number };
  south: { longitude: number; sign: string; degree: number };
} {
  const d = jd - 2451545.0;
  const north = normalize360(125.0445479 - 0.0529537222 * d);
  const south = normalize360(north + 180);
  return {
    north: { longitude: north, ...longitudeToSign(north) },
    south: { longitude: south, ...longitudeToSign(south) },
  };
}

// ── Asteroid goddesses (Ceres, Pallas, Juno, Vesta) — EXPERIMENTAL ──────────
// The main-belt asteroids aren't in astronomy-engine, so we solve them from
// J2000 osculating elements with a full 3D Kepler (inclination + node — needed
// because Pallas is inclined ~35°, which the flat 2D model used for the planets
// would get badly wrong). Accuracy is approximate (elements are mean, not
// perturbed) — verify against a known position and calibrate M0 if it drifts,
// the same way Chiron and the nodes were dialed in.
interface AsteroidElements {
  a: number; e: number; i: number; om: number; w: number; M0: number; // deg, J2000 epoch
}
// M0 calibrated 2026-07-23 against real observed positions (Ceres 22°Gem26',
// Pallas 21°Ari20', Juno 4°Aqu27'R, Vesta 24°Ari05') — matched to <0.001°.
// a/e/i/Ω/ω are standard J2000 mean elements; since a (the rate driver) is
// accurate, positions stay close for years, drifting slowly. Re-calibrate M0
// against a fresh observation if it wanders.
const ASTEROIDS: Record<string, AsteroidElements> = {
  Ceres:  { a: 2.7658, e: 0.0785, i: 10.607, om: 80.328,  w: 73.115,  M0: 6.002 },
  Pallas: { a: 2.7724, e: 0.2313, i: 34.843, om: 173.128, w: 309.965, M0: 354.456 },
  Juno:   { a: 2.6693, e: 0.2579, i: 12.999, om: 169.913, w: 247.717, M0: 241.373 },
  Vesta:  { a: 2.3615, e: 0.0887, i: 7.141,  om: 103.917, w: 150.735, M0: 340.372 },
};

function asteroidGeoLongitude(jd: number, el: AsteroidElements): number {
  const d = jd - 2451545.0;                          // days since J2000
  const n = 0.9856076686 / Math.pow(el.a, 1.5);      // mean motion, deg/day
  const M = normalize360(el.M0 + n * d) * DEG2RAD;
  // Kepler's equation for eccentric anomaly E
  let E = M;
  for (let k = 0; k < 12; k++) E = E - (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
  // position in the orbital plane
  const xv = el.a * (Math.cos(E) - el.e);
  const yv = el.a * (Math.sqrt(1 - el.e * el.e) * Math.sin(E));
  const v = Math.atan2(yv, xv);                      // true anomaly
  const r = Math.sqrt(xv * xv + yv * yv);
  // rotate orbital plane → heliocentric ecliptic (Ω, i, ω)
  const O = el.om * DEG2RAD, w = el.w * DEG2RAD, inc = el.i * DEG2RAD;
  const u = v + w;
  const xh = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(inc));
  const yh = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(inc));
  // Earth heliocentric (ecliptic plane, r≈1)
  const earthLambda = normalize360(sunLongitude(jd) + 180) * DEG2RAD;
  const xg = xh - Math.cos(earthLambda), yg = yh - Math.sin(earthLambda);
  return normalize360(Math.atan2(yg, xg) / DEG2RAD);
}

// The four asteroid goddesses with sign/degree + retrograde (from the sign of
// the day-to-day geocentric motion). EXPERIMENTAL — see note above.
export function getAsteroids(jd: number): Array<{ planet: string; sign: string; degree: number; longitude: number; retrograde: boolean }> {
  return Object.entries(ASTEROIDS).map(([name, el]) => {
    const lon = asteroidGeoLongitude(jd, el);
    const lonNext = asteroidGeoLongitude(jd + 1, el);
    const retrograde = normalize360(lonNext - lon) > 180; // moving backward through the zodiac
    return { planet: name, longitude: lon, retrograde, ...longitudeToSign(lon) };
  });
}

export function getActiveTransits(planets: ReturnType<typeof getPlanetPositions>): string[] {
  const transits: string[] = [];
  const sun     = planets.find((p) => p.planet === "Sun")!;
  const moon    = planets.find((p) => p.planet === "Moon")!;
  const mars    = planets.find((p) => p.planet === "Mars")!;
  const mercury = planets.find((p) => p.planet === "Mercury")!;
  const saturn  = planets.find((p) => p.planet === "Saturn")!;

  transits.push(`Sun in ${sun.sign}`);
  transits.push(`Moon in ${moon.sign}`);
  if (Math.abs(mercury.longitude - sun.longitude) < 8 ||
      Math.abs(mercury.longitude - sun.longitude) > 352)
    transits.push("Mercury conjunct Sun — heightened mental clarity");
  if (Math.abs(mars.degree - moon.degree) < 8)
    transits.push("Mars aspecting Moon — emotional intensity elevated");
  // Saturn–Sun square / opposition (within 10°)
  const satSunAngle = normalize360(saturn.longitude - sun.longitude);
  if (Math.abs(satSunAngle - 90) < 10 || Math.abs(satSunAngle - 270) < 10)
    transits.push("Saturn square Sun — focus and structure called for");
  if (Math.abs(satSunAngle - 180) < 10)
    transits.push("Saturn opposition Sun — tension between effort and ease");

  return transits;
}

export function getHealthInfluences(planets: ReturnType<typeof getPlanetPositions>): string[] {
  const influences: string[] = [];
  const sun  = planets.find((p) => p.planet === "Sun")!;
  const moon = planets.find((p) => p.planet === "Moon")!;

  const sunInfluences  = SIGN_HEALTH[sun.sign]  ?? [];
  const moonInfluences = SIGN_HEALTH[moon.sign] ?? [];

  sunInfluences.forEach((s) => influences.push(`Sun in ${sun.sign}: focus on ${s}`));
  moonInfluences.slice(0, 2).forEach((s) =>
    influences.push(`Moon in ${moon.sign}: emotional body — ${s}`),
  );
  return influences;
}

// ── Void-of-course Moon ───────────────────────────────────────────────────────

const VOC_PLANETS = ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"] as const;
const MAJOR_ASPECTS = [0, 60, 90, 120, 180];

/** Signed 0..180 separation between two ecliptic longitudes. */
function sep180(a: number, b: number): number {
  const d = Math.abs(normalize360(a - b));
  return d > 180 ? 360 - d : d;
}

/** Geocentric longitude for any classical body, including the Sun. */
function bodyLongitude(name: string, jd: number): number {
  return name === "Sun" ? normalize360(sunLongitude(jd)) : geocentricLongitude(name, jd);
}

/** Nearest major-aspect separation in degrees between two longitudes. */
function nearestAspectDiff(a: number, b: number): number {
  // Fold to 0..180 BEFORE comparing: aspects are unsigned separations, so a
  // 270° raw angle IS a square (90°). The old circular-distance-to-asp math
  // returned 180 for that case, making every WANING square/sextile/trine
  // invisible — getLastMoonAspect (rail) and getMoonContacts (sky literacy)
  // silently skipped half the Moon's aspects.
  const angle = sep180(a, b);
  return Math.min(...MAJOR_ASPECTS.map((asp) => Math.abs(angle - asp)));
}

/**
 * Moon void-of-course: Moon has no applying major aspects to classical planets
 * before it exits its current sign.  Steps forward in 2-hour increments.
 */
export function voidOfCourse(jd: number): { voc: boolean } {
  // Traditional rule: the Moon is void if it perfects NO further major aspect to a
  // classical planet before it leaves its current sign. The key is *perfection*
  // (the separation passes exactly through an aspect angle) BEFORE the ingress —
  // an aspect that only completes after the sign change does not count.
  const moonLon0 = normalize360(moonLongitude(jd));
  const sign0    = Math.floor(moonLon0 / 30);
  const degLeft  = 30 - (moonLon0 % 30);
  const daysLeft = degLeft / 13.0;                 // Moon ~13°/day
  const STEP     = 0.25 / 24;                       // 15-minute steps

  // Perfection detection uses the SIGNED separation (0..360), not the folded
  // 0..180 one: the folded distance only *touches* 0 at a conjunction and 180
  // at an opposition without changing sign, so a sign-crossing test silently
  // misses both — which declared the Moon void early whenever its last aspect
  // before ingress was a conjunction or opposition. The signed delta increases
  // monotonically (the Moon outruns every classical planet), so every aspect
  // angle — including 0 and 180 — is a clean crossing.
  const ANGLES = [0, 60, 90, 120, 180, 240, 270, 300];
  const prevDelta: Record<string, number> = {};
  for (const name of VOC_PLANETS) prevDelta[name] = normalize360(moonLon0 - bodyLongitude(name, jd));

  for (let dt = STEP; dt <= daysLeft + STEP; dt += STEP) {
    const cj    = jd + dt;
    const mLon  = normalize360(moonLongitude(cj));
    if (Math.floor(mLon / 30) !== sign0) break;    // reached ingress — stop

    for (const name of VOC_PLANETS) {
      const d = normalize360(mLon - bodyLongitude(name, cj));
      const p = prevDelta[name];
      if (d >= p) {
        for (const A of ANGLES) if (p < A && A <= d) return { voc: false };
      } else {
        // Wrapped past 360 → 0: crossings are any angle above p, plus 0 itself.
        for (const A of ANGLES) if (A > p || A <= d) return { voc: false };
      }
      prevDelta[name] = d;
    }
  }
  return { voc: true };
}

// ── Moon's FINAL aspect in its current sign ──────────────────────────────────
// Hampar's electional key: the Moon's last aspect before leaving her sign tells
// how the matter ENDS — a benefic soft final aspect makes a GREAT election
// possible; a malefic hard one caps it. Same signed-separation scan as
// voidOfCourse, but collecting every perfection to the ingress and keeping the last.
const FINAL_ANGLE_NAME: Record<number, string> = {
  0: "conjunction", 60: "sextile", 90: "square", 120: "trine", 180: "opposition",
  240: "trine", 270: "square", 300: "sextile",
};
export function moonFinalAspectInSign(jd: number): { planet: string; aspect: string; atJd: number } | null {
  const moonLon0 = normalize360(moonLongitude(jd));
  const sign0    = Math.floor(moonLon0 / 30);
  const degLeft  = 30 - (moonLon0 % 30);
  const daysLeft = degLeft / 13.0;
  const STEP     = 0.25 / 24;
  const ANGLES = [0, 60, 90, 120, 180, 240, 270, 300];
  const prevDelta: Record<string, number> = {};
  for (const name of VOC_PLANETS) prevDelta[name] = normalize360(moonLon0 - bodyLongitude(name, jd));

  let last: { planet: string; aspect: string; atJd: number } | null = null;
  for (let dt = STEP; dt <= daysLeft + STEP; dt += STEP) {
    const cj   = jd + dt;
    const mLon = normalize360(moonLongitude(cj));
    if (Math.floor(mLon / 30) !== sign0) break;
    for (const name of VOC_PLANETS) {
      const d = normalize360(mLon - bodyLongitude(name, cj));
      const p = prevDelta[name];
      if (d >= p) {
        for (const A of ANGLES) if (p < A && A <= d) last = { planet: name, aspect: FINAL_ANGLE_NAME[A], atJd: cj };
      } else {
        for (const A of ANGLES) if (A > p || A <= d) last = { planet: name, aspect: FINAL_ANGLE_NAME[A], atJd: cj };
      }
      prevDelta[name] = d;
    }
  }
  return last;
}

// ── Eclipse window ───────────────────────────────────────────────────────────
// Hampar: delay elections within ±1 week of any eclipse. An eclipse is a
// lunation close to the nodal axis: New Moon within ~15° of a node = solar,
// Full Moon within ~12° = lunar. We scan ±7 days for a lunation and test node
// distance at the crossing day (mean node — plenty for a week-wide gate).
export function eclipseWindow(jd: number): { active: boolean; kind?: "solar" | "lunar"; daysAway?: number } {
  let prevElong = normalize360(moonLongitude(jd - 8) - sunLongitude(jd - 8));
  for (let d = -7; d <= 7; d++) {
    const cj = jd + d;
    const elong = normalize360(moonLongitude(cj) - sunLongitude(cj));
    // elongation grows ~12.2°/day; detect 0 (new) and 180 (full) crossings
    const crossedNew  = elong < prevElong;                       // wrapped 360→0
    const crossedFull = prevElong < 180 && elong >= 180;
    if (crossedNew || crossedFull) {
      const sunL = normalize360(sunLongitude(cj));
      const node = lunarNodes(cj).north.longitude;
      const fold = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };
      const toAxis = Math.min(fold(sunL, node), fold(sunL, node + 180));
      const limit = crossedNew ? 15 : 12;
      if (toAxis <= limit) return { active: true, kind: crossedNew ? "solar" : "lunar", daysAway: Math.abs(d) };
    }
    prevElong = elong;
  }
  return { active: false };
}

// ── Sunrise / Sunset ──────────────────────────────────────────────────────────

/**
 * Approximate sunrise and sunset times for a given JD and location.
 * Accurate to ±2 minutes for latitudes ±60°.
 */
export function getSunriseSunset(
  jd: number,
  latDeg: number,
  lonDeg: number,
): { sunrise: Date; sunset: Date; polar: "day" | "night" | null } {
  const T     = (jd - 2451545.0) / 36525;
  const L0    = normalize360(280.46646 + 36000.76983 * T);
  const M     = normalize360(357.52911 + 35999.05029 * T) * DEG2RAD;
  const C     = (1.914602 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M);
  const sunLon = normalize360(L0 + C);
  const sinDec = Math.sin(23.439291 * DEG2RAD) * Math.sin(sunLon * DEG2RAD);
  const decRad = Math.asin(sinDec);

  // Standard horizon dip + refraction offset
  const cosH = (Math.sin(-0.8333 * DEG2RAD) - Math.sin(latDeg * DEG2RAD) * sinDec) /
               (Math.cos(latDeg * DEG2RAD) * Math.cos(decRad));

  // Equation of time (minutes)
  const Lrad  = L0 * DEG2RAD;
  const y     = Math.tan(23.439291 * DEG2RAD / 2) ** 2;
  const eot   = 4 * RAD2DEG * (
    y * Math.sin(2 * Lrad) -
    2 * 0.016708634 * Math.sin(M) +
    4 * 0.016708634 * y * Math.sin(M) * Math.cos(2 * Lrad) -
    0.5 * y * y * Math.sin(4 * Lrad)
  );

  // Solar noon in minutes from UTC midnight
  const noonMinutes = 720 - 4 * lonDeg - eot;

  let riseMinutes: number;
  let setMinutes: number;
  // Above the Arctic/Antarctic circles the Sun may not rise or set at all.
  // The fallback below invents a symmetric twelve-hour day so that callers
  // wanting a Date always get one — but that day is FICTION, and callers that
  // divide it into planetary hours were consuming it as fact. Tromsø on the
  // winter solstice reported 12.00h of daylight and a full set of ~60-minute
  // hours. `polar` exists so those callers can withhold instead, which is the
  // treatment hours already get when the LOCATION is a guess: the app's
  // standing rule is that fiction dressed as a schedule needs removing, not a
  // caption.
  let polar: "day" | "night" | null = null;
  if (Math.abs(cosH) > 1) {
    polar = cosH > 1 ? "night" : "day";   // cosH > 1 → never rises
    riseMinutes = noonMinutes - 360;
    setMinutes  = noonMinutes + 360;
  } else {
    const H      = Math.acos(cosH) * RAD2DEG;
    riseMinutes  = noonMinutes - H * 4;
    setMinutes   = noonMinutes + H * 4;
  }

  // Base: UTC midnight of the JD date
  const baseDateMs = (Math.floor(jd - 0.5) + 0.5 - 2440587.5) * 86400000;

  return {
    sunrise: new Date(baseDateMs + riseMinutes * 60000),
    sunset:  new Date(baseDateMs + setMinutes  * 60000),
    polar,
  };
}

// ── Planetary Hours (Chaldean) ────────────────────────────────────────────────

// Descending Chaldean order: Saturn → Jupiter → Mars → Sun → Venus → Mercury → Moon
const CHALDEAN_ORDER = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"] as const;
// Day rulers indexed by getUTCDay() (0=Sunday)
const WEEKDAY_RULERS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;

export interface PlanetaryHour {
  ruler: string;
  hourNumber: number;    // 1–12
  isDayHour: boolean;
  startTime: Date;
  endTime: Date;
}

/**
 * Returns the Chaldean planetary hour for the given moment.
 * Day hours run from sunrise to sunset (divided into 12 equal parts).
 * Night hours run from sunset to next sunrise (12 equal parts).
 *
 * @param date   The moment to query.
 * @param lat    Observer latitude  (default 40.7°N — New York).
 * @param lon    Observer longitude (default −74.0°E).
 */
export function getPlanetaryHour(date: Date, lat = 40.7, lon = -74.0): PlanetaryHour {
  // getSunriseSunset anchors to the UTC CALENDAR date of the jd it's given —
  // correct for lon≈0, but for eastern longitudes (roughly ≥ UTC+7: Tokyo,
  // Sydney, most of Asia-Pacific) the local calendar date is often already a
  // day ahead of the UTC date at the query instant. julianDay(date) then
  // fetches sunrise/sunset for YESTERDAY's local day, both branches below
  // land in the past relative to `now`, and every query for several morning
  // hours fell through to the stale "last night" branch — wrong ruler, wrong
  // sect (audit F1, empirically: Tokyo 05:30–08:30 all returned "Jupiter,
  // hour 12, night" instead of Mercury's actual day hours). Anchor jd to the
  // LOCAL calendar date instead, the same longitude-shift trick localDow (a
  // few lines down) already uses for the day-ruler weekday.
  const localMidnightJd = (d: Date): number => {
    const shifted = new Date(d.getTime() + (lon / 15) * 3600000);
    const localMidnightUTC = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
    return julianDay(new Date(localMidnightUTC + 12 * 3600000)); // noon, to sit clear of julianDay's own date-line convention
  };
  const jd = localMidnightJd(date);
  const { sunrise, sunset } = getSunriseSunset(jd, lat, lon);
  const { sunrise: prevSunrise, sunset: prevSunset } = getSunriseSunset(jd - 1, lat, lon);
  const { sunrise: nextSunrise } = getSunriseSunset(jd + 1, lat, lon);

  const now     = date.getTime();
  const riseMs  = sunrise.getTime();
  const setMs   = sunset.getTime();
  const prevSetMs  = prevSunset.getTime();
  const nextRiseMs = nextSunrise.getTime();

  function computeHour(
    startBoundary: number,
    endBoundary: number,
    dayRulerName: string,
    baseHourOffset: number, // 0 for day, 12 for first night after that day
    isDay: boolean,
  ): PlanetaryHour {
    const duration = endBoundary - startBoundary;
    const hourLen  = duration / 12;
    const n        = Math.min(Math.floor((now - startBoundary) / hourLen), 11); // 0-based 0..11
    const rulerIdx = (CHALDEAN_ORDER.indexOf(dayRulerName as typeof CHALDEAN_ORDER[number]) + baseHourOffset + n) % 7;
    return {
      ruler:      CHALDEAN_ORDER[rulerIdx],
      hourNumber: n + 1,
      isDayHour:  isDay,
      startTime:  new Date(startBoundary + n * hourLen),
      endTime:    new Date(startBoundary + (n + 1) * hourLen),
    };
  }

  // The planetary DAY ruler is set by the weekday of the *local* daytime span,
  // not UTC. Derive the local civil day from longitude (local solar time ≈
  // UTC + lon/15h) so eastern-hemisphere users and instants near the UTC date
  // line get the right ruling planet. (getUTCDay on the raw instant was wrong
  // wherever local time and UTC fall on different calendar days.)
  const localDow = (d: Date) => new Date(d.getTime() + (lon / 15) * 3600000).getUTCDay();

  if (now >= riseMs && now < setMs) {
    // Today's day hours
    const dayRuler = WEEKDAY_RULERS[localDow(sunrise)];
    return computeHour(riseMs, setMs, dayRuler, 0, true);
  } else if (now >= setMs && now < nextRiseMs) {
    // Tonight's night hours
    const dayRuler = WEEKDAY_RULERS[localDow(sunrise)];
    return computeHour(setMs, nextRiseMs, dayRuler, 12, false);
  } else {
    // Last night's hours (before today's sunrise)
    const dayRuler = WEEKDAY_RULERS[localDow(prevSunrise)];
    return computeHour(prevSetMs, riseMs, dayRuler, 12, false);
  }
}

// ── Planetary Aspects ─────────────────────────────────────────────────────────

const ASPECT_DEFS = [
  { name: "conjunction",  angle: 0,   orb: 8, nature: "intensifying" },
  { name: "sextile",      angle: 60,  orb: 6, nature: "supportive"   },
  { name: "square",       angle: 90,  orb: 8, nature: "challenging"  },
  { name: "trine",        angle: 120, orb: 8, nature: "flowing"      },
  { name: "opposition",   angle: 180, orb: 8, nature: "polarizing"   },
] as const;

export interface PlanetAspect {
  planet1: string;
  planet2: string;
  aspect: string;
  nature: string;
  exactAngle: number;
  orb: number;      // degrees from exact
  applying: boolean;
  hoursToExact: number | null;     // real time-to-perfection, applying aspects only
  hoursSinceExact: number | null;  // real time-since-perfection, separating aspects only
  // True when a station turns the pair around before the aspect ever perfects
  // (e.g. Mercury stations retrograde short of the conjunction). Without this,
  // linear extrapolation invents an exact time for a perfection that never
  // happens — astrologically wrong, and readers who know stations notice.
  stationsBeforeExact?: boolean;   // applying now, but turns back before 0°
  neverPerfected?: boolean;        // separating now, but was never exact (approached, stationed, retreated)
}

/**
 * Computes all current major aspects between planets.
 * "Applying" means the two bodies are moving toward the exact angle.
 * Applying aspects carry forward momentum; separating aspects describe what's completing.
 */
export function getMajorAspects(jd: number): PlanetAspect[] {
  const planets     = getPlanetPositions(jd);
  const planetsNext = getPlanetPositions(jd + 1 / 24); // 1 hour forward

  const aspects: PlanetAspect[] = [];

  // Snapshot cache for the station-aware scan below: positions at 6-hour steps,
  // computed lazily and shared across all non-Moon pairs in this call.
  const SCAN_STEP_H = 6, SCAN_SPAN_H = 14 * 24;
  const snapCache = new Map<number, ReturnType<typeof getPlanetPositions>>();
  const posAt = (hOffset: number) => {
    let s = snapCache.get(hOffset);
    if (!s) { s = getPlanetPositions(jd + hOffset / 24); snapCache.set(hOffset, s); }
    return s;
  };
  const sepAt = (hOffset: number, name1: string, name2: string, exactAngle: number) => {
    const snap = posAt(hOffset);
    const a = snap.find((p) => p.planet === name1)!;
    const b = snap.find((p) => p.planet === name2)!;
    const raw = normalize360(a.longitude - b.longitude);
    const angle = raw > 180 ? 360 - raw : raw;
    return Math.abs(angle - exactAngle);
  };
  // Sampled minimum can sit up to ~half a step off true perfection for the
  // fastest non-Moon mover (Mercury ~2°/day ≈ 0.5°/step), so "perfected" means
  // the scan dipped under this rather than exactly zero.
  const PERFECT_EPS = 0.3;

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i];
      const p2 = planets[j];

      const raw  = normalize360(p1.longitude - p2.longitude);
      const angle = raw > 180 ? 360 - raw : raw;

      for (const def of ASPECT_DEFS) {
        const sep = Math.abs(angle - def.angle);
        if (sep <= def.orb) {
          // Determine applying vs separating: compare orb now vs 1 hour later
          const p1n = planetsNext.find((p) => p.planet === p1.planet)!;
          const p2n = planetsNext.find((p) => p.planet === p2.planet)!;
          const rawN  = normalize360(p1n.longitude - p2n.longitude);
          const angleN = rawN > 180 ? 360 - rawN : rawN;
          const sepN   = Math.abs(angleN - def.angle);

          // Applying vs separating from a SHORT baseline. The one-hour
          // difference above straddles the perfection whenever the aspect
          // becomes exact within the hour — sep and sepN then sit on opposite
          // sides of zero, the apparent rate collapses toward nothing, and the
          // linear estimate below explodes. Measured 2026-08-02, Moon square
          // Mars: orb 0.28°, perfection 32 minutes away, reported as 6.6 HOURS.
          // Five minutes is short enough that the Moon (~0.5°/h) cannot cross
          // perfection inside it at any orb we report.
          const sepShort = sepAt(5 / 60, p1.planet, p2.planet, def.angle);
          const ratePerHour = (sep - sepShort) * 12;   // per hour, from a 5-min baseline
          const applying = sepShort < sep;
          void sepN;
          // Linear estimate — the fallback when perfection lies beyond the scan
          // window. Every pair now refines this against the real ephemeris below.
          let hoursToExact = applying && ratePerHour > 1e-6
            ? parseFloat((sep / ratePerHour).toFixed(2))
            : null;
          let hoursSinceExact = !applying && ratePerHour < -1e-6
            ? parseFloat((sep / -ratePerHour).toFixed(2))
            : null;
          let stationsBeforeExact = false;
          let neverPerfected = false;

          // Station-aware correction for non-Moon pairs: a linear estimate lies
          // when a planet stations and turns around short of perfection (e.g.
          // Mercury stationing retrograde before conjoining Jupiter). Walk the
          // real ephemeris to see whether the aspect actually perfects (ahead)
          // or actually perfected (behind).
          const isMoonPair = p1.planet === "Moon" || p2.planet === "Moon";
          if (isMoonPair) {
            // The Moon was the ONE pair left on a pure linear estimate, on the
            // grounds that it is fast and never stations. "Never stations"
            // justifies skipping the turn detection below; it says nothing
            // about timing accuracy, and the Moon's rate is least constant
            // exactly where the number matters most — near perfection.
            //
            // Ternary search for the true minimum. Separation from exact is
            // V-shaped through a perfection, so it is unimodal across one
            // approach; 24h covers any orb we report at ~0.5°/h.
            const dir = applying ? 1 : -1;
            let lo = 0, hi = 24;
            for (let k = 0; k < 60; k++) {
              const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
              if (sepAt(dir * m1, p1.planet, p2.planet, def.angle)
                < sepAt(dir * m2, p1.planet, p2.planet, def.angle)) hi = m2; else lo = m1;
            }
            const atH = parseFloat(((lo + hi) / 2).toFixed(2));
            if (sepAt(dir * atH, p1.planet, p2.planet, def.angle) <= PERFECT_EPS) {
              if (applying) hoursToExact = atH; else hoursSinceExact = atH;
            }
          } else {
            const dir = applying ? 1 : -1; // scan toward the supposed perfection
            let prev = sep, minSep = sep, minAtH = 0, turned = false;
            for (let h = SCAN_STEP_H; h <= SCAN_SPAN_H; h += SCAN_STEP_H) {
              const s = sepAt(dir * h, p1.planet, p2.planet, def.angle);
              if (s < minSep) { minSep = s; minAtH = h; }
              if (s > prev + 1e-9 && minSep > PERFECT_EPS) { turned = true; break; }
              if (minSep <= PERFECT_EPS && s > prev) break; // perfected, then moving off
              prev = s;
            }
            if (minSep <= PERFECT_EPS) {
              // The walk steps in 6 hours, so minAtH is a grid point and can sit
              // up to 3h from the real perfection — "exact in ~36h" for one that
              // lands at 33h. Refine within one step either side, same ternary
              // search the Moon branch uses.
              let lo = Math.max(0, minAtH - SCAN_STEP_H), hi = minAtH + SCAN_STEP_H;
              for (let k = 0; k < 60; k++) {
                const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
                if (sepAt(dir * m1, p1.planet, p2.planet, def.angle)
                  < sepAt(dir * m2, p1.planet, p2.planet, def.angle)) hi = m2; else lo = m1;
              }
              const refined = parseFloat(((lo + hi) / 2).toFixed(2));
              if (applying) hoursToExact = refined;
              else hoursSinceExact = refined;
            } else if (turned) {
              // The pair reverses before reaching exact — no perfection to report.
              if (applying) { stationsBeforeExact = true; hoursToExact = null; }
              else { neverPerfected = true; hoursSinceExact = null; }
            }
            // else: still closing at the window edge — keep the linear estimate.
          }

          aspects.push({
            planet1:    p1.planet,
            planet2:    p2.planet,
            aspect:     def.name,
            nature:     def.nature,
            exactAngle: def.angle,
            orb:        parseFloat(sep.toFixed(2)),
            applying,
            hoursToExact,
            hoursSinceExact,
            ...(stationsBeforeExact ? { stationsBeforeExact } : {}),
            ...(neverPerfected ? { neverPerfected } : {}),
          });
          break; // one aspect per planet pair
        }
      }
    }
  }

  return aspects;
}

// ── Last Moon Aspect (VOC characterization) ───────────────────────────────────

export interface LastMoonAspect {
  planet: string;
  aspect: string;
  nature: string;
  orbAtExact: number;   // degrees from exact at moment of perfection
  hoursAgo: number;
  benefic: boolean;
  malefic: boolean;
}

/**
 * Finds the most recently perfected major aspect from the Moon to a classical planet.
 * The last aspect before a VOC period characterizes the quality of that void —
 * a trine to Jupiter leaves benevolent residue; a square to Saturn carries friction.
 * Scans back 48 hours in 1-hour steps to find local orb minima.
 */
export function getLastMoonAspect(jd: number): LastMoonAspect | null {
  const STEP_H   = 1;
  const LOOKBACK = 48;
  const MAX_ORB  = 1.5; // must have been within 1.5° to count as perfected

  let best: LastMoonAspect | null = null;
  let bestStepIndex = -1;

  const startJd = jd - LOOKBACK / 24;

  for (const name of VOC_PLANETS) {
    // Build orb time-series across the lookback window
    const orbs: number[] = [];
    for (let h = 0; h <= LOOKBACK; h++) {
      const t = startJd + h / 24;
      orbs.push(nearestAspectDiff(moonLongitude(t), bodyLongitude(name, t)));
    }

    // Find local minima (perfection moments) — most recent wins
    for (let h = LOOKBACK - 1; h >= 1; h--) {
      if (orbs[h] < orbs[h - 1] && orbs[h] < orbs[h + 1] && orbs[h] <= MAX_ORB) {
        if (h > bestStepIndex) {
          bestStepIndex = h;
          const t  = startJd + h / 24;
          const mLon = moonLongitude(t);
          const pLon = bodyLongitude(name, t);
          const raw  = normalize360(mLon - pLon);
          const ang  = raw > 180 ? 360 - raw : raw;

          let aspectName   = "conjunction";
          let aspectNature = "intensifying";
          for (const def of ASPECT_DEFS) {
            if (Math.abs(ang - def.angle) <= def.orb) {
              aspectName   = def.name;
              aspectNature = def.nature;
              break;
            }
          }

          best = {
            planet:     name,
            aspect:     aspectName,
            nature:     aspectNature,
            orbAtExact: parseFloat(orbs[h].toFixed(2)),
            hoursAgo:   parseFloat((LOOKBACK - h).toFixed(1)),
            benefic:    BENEFICS.has(name),
            malefic:    MALEFICS.has(name),
          };
        }
        break; // most recent minimum for this planet found — move to next planet
      }
    }
  }

  // Also catch very-recent separating aspects missed by 1h steps (orb < 0.5° now, separating)
  const currentAspects = getMajorAspects(jd);
  for (const asp of currentAspects) {
    if (asp.applying) continue;
    if (asp.planet1 !== "Moon" && asp.planet2 !== "Moon") continue;
    const p = asp.planet1 === "Moon" ? asp.planet2 : asp.planet1;
    if (asp.orb < 0.5 && asp.orb < (best?.orbAtExact ?? 999)) {
      // The perfection time is FOUND, not derived. This used to be
      // `orb / 0.5` — hours back-computed from a constant half-degree-per-hour
      // lunar separation, when the Moon actually runs 11–15°/day (±25% on the
      // constant), and the result was printed to users as "(3.4h ago)". The
      // hourly scan above reports a real scanned value; this branch reported a
      // guess in the same field and the same units. A two-minute backward walk
      // over the last two hours finds the actual orb minimum for ~60 cheap
      // longitude evaluations, so both branches now mean the same thing.
      let minOrb = Infinity, minMinutes = 0;
      for (let m = 0; m <= 120; m += 2) {
        const t = jd - m / (24 * 60);
        const o = nearestAspectDiff(moonLongitude(t), bodyLongitude(p, t));
        if (o < minOrb) { minOrb = o; minMinutes = m; }
      }
      best = {
        planet: p,
        aspect: asp.aspect,
        nature: asp.nature,
        orbAtExact: parseFloat(minOrb.toFixed(2)),
        hoursAgo: parseFloat((minMinutes / 60).toFixed(1)),
        benefic: BENEFICS.has(p),
        malefic: MALEFICS.has(p),
      };
    }
  }

  return best;
}

// ── Moon contacts to a single planet (the weekly teacher) ────────────────────
// The Moon perfects an aspect to every planet roughly weekly — the app's
// sky-literacy layer leans on that rhythm ("your saturnine day"). Scan a jd
// range hourly for perfection minima of Moon-to-planet aspects.

export interface MoonContact {
  jd: number;
  at: string;        // ISO instant of perfection (±30min at 1h steps)
  aspect: string;    // conjunction | sextile | square | trine | opposition
  nature: string;    // intensifying | supportive | challenging | flowing | polarizing
  hard: boolean;     // conjunction/square/opposition — the "flavor day" contacts
}

function jdToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

export function getMoonContacts(planet: string, jdStart: number, jdEnd: number): MoonContact[] {
  const MAX_ORB = 1.5;
  const hours = Math.max(0, Math.round((jdEnd - jdStart) * 24));
  const orbs: number[] = [];
  for (let h = 0; h <= hours; h++) {
    const t = jdStart + h / 24;
    orbs.push(nearestAspectDiff(moonLongitude(t), bodyLongitude(planet, t)));
  }

  const contacts: MoonContact[] = [];
  for (let h = 1; h < hours; h++) {
    if (orbs[h] < orbs[h - 1] && orbs[h] < orbs[h + 1] && orbs[h] <= MAX_ORB) {
      const t = jdStart + h / 24;
      const raw = normalize360(moonLongitude(t) - bodyLongitude(planet, t));
      const ang = raw > 180 ? 360 - raw : raw;
      let aspectName = "conjunction";
      let aspectNature = "intensifying";
      for (const def of ASPECT_DEFS) {
        if (Math.abs(ang - def.angle) <= def.orb) {
          aspectName = def.name;
          aspectNature = def.nature;
          break;
        }
      }
      contacts.push({
        jd: t,
        at: jdToDate(t).toISOString(),
        aspect: aspectName,
        nature: aspectNature,
        hard: aspectName === "conjunction" || aspectName === "square" || aspectName === "opposition",
      });
    }
  }
  return contacts;
}

// ── Angular Crossing Events ───────────────────────────────────────────────────

export interface AngularCrossing {
  planet: string;
  angle: "ASC" | "MC" | "DSC" | "IC";
  crossingTime: string;   // ISO string
  minutesFromNow: number;
  durationMinutes: number;
  orbAtExact: number;
  benefic: boolean;
  malefic: boolean;
}

/**
 * Returns upcoming moments when planets cross the four chart angles (ASC/MC/DSC/IC)
 * for the given location, within the specified lookahead window.
 *
 * Chart angles rotate ~360° per sidereal day (~1°/4 min), so a planet remains
 * within 3° of an angle for only ~12–24 minutes. These are brief but potent windows.
 *
 * @param jd             Julian Day (UT) — start of search
 * @param latDeg         Observer latitude
 * @param lonDeg         Observer longitude
 * @param orb            Orb in degrees (default 3° = ~12-min window each side)
 * @param lookAheadHours How many hours forward to scan (default 24)
 */

/**
 * The exact moment a planet is closest to an angle, refined off the 4-minute
 * scan grid.
 *
 * Two things were wrong with reporting the grid step directly. The small one:
 * the ASC moves ~1° per 4 minutes, so the coarse minimum sat up to ~2 minutes
 * and a few tenths of a degree away from the real one — printed to the minute,
 * next to an orb printed to two decimals.
 *
 * The large one: a crossing already IN PROGRESS when the scan began reported
 * its first step as the peak. Measured 2026-08-01, Chiron–IC: reported
 * 00:00:00 with orb 2.25°, actual perfection 23:51:22 with orb 0.002° — nine
 * minutes late and a hundredfold wrong on the orb, announced as happening now.
 * Hence `searchBack`: when the minimum lands on step 0, the true one is behind
 * us and has to be looked for there.
 */
function refineCrossingPeak(
  centreMs: number, stepMs: number, sepAt: (ms: number) => number, searchBack: boolean,
): { atMs: number; sep: number } {
  let lo = centreMs - (searchBack ? 60 : 1) * stepMs;
  let hi = centreMs + stepMs;
  // Ternary search — separation is unimodal across a single approach.
  for (let i = 0; i < 60; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (sepAt(m1) < sepAt(m2)) hi = m2; else lo = m1;
  }
  const atMs = (lo + hi) / 2;
  return { atMs: Math.round(atMs / 1000) * 1000, sep: sepAt(atMs) };
}

export function getNextAngularCrossings(
  jd: number,
  latDeg = 40.7,
  lonDeg = -74.0,
  orb = 3,
  lookAheadHours = 24,
): AngularCrossing[] {
  const STEP_MIN = 4;                           // 4-minute resolution
  const STEP_JD  = STEP_MIN / (24 * 60);
  const STEPS    = Math.floor((lookAheadHours * 60) / STEP_MIN);

  // Snapshot planet positions — outer planets barely move in 24 h
  const snapPlanets = getPlanetPositions(jd);

  type Active = { startStep: number; minSep: number; minStep: number };
  const activeCrossings = new Map<string, Active>(); // key: `${planet}-${angle}`
  const crossings: AngularCrossing[] = [];

  // Live separation at an arbitrary instant — what the refinement minimises.
  const jdToMs = (j: number) => (j - 2440587.5) * 86400000;
  const sepProbe = (planetName: string, angleName: string) => (ms: number) => {
    const j = ms / 86400000 + 2440587.5;
    const ang = getLocalAngles(j, latDeg, lonDeg);
    const target = angleName === "ASC" ? ang.asc : angleName === "MC" ? ang.mc : angleName === "DSC" ? ang.dsc : ang.ic;
    const pLon = planetName === "Moon"
      ? moonLongitude(j)
      : (snapPlanets.find((p) => p.planet === planetName)?.longitude ?? 0);
    const raw = normalize360(Math.abs(pLon - target));
    return raw > 180 ? 360 - raw : raw;
  };

  for (let step = 0; step <= STEPS; step++) {
    const checkJd = jd + step * STEP_JD;
    const angles  = getLocalAngles(checkJd, latDeg, lonDeg);

    // Refresh Moon separately (moves ~0.5°/hr)
    const moonLon = moonLongitude(checkJd);

    const angleMap: { name: "ASC" | "MC" | "DSC" | "IC"; lon: number }[] = [
      { name: "ASC", lon: angles.asc },
      { name: "MC",  lon: angles.mc  },
      { name: "DSC", lon: angles.dsc },
      { name: "IC",  lon: angles.ic  },
    ];

    for (const snap of snapPlanets) {
      const pLon = snap.planet === "Moon" ? moonLon : snap.longitude;

      for (const { name, lon: angleLon } of angleMap) {
        const raw = normalize360(Math.abs(pLon - angleLon));
        const sep = raw > 180 ? 360 - raw : raw;
        const key = `${snap.planet}-${name}`;

        if (sep <= orb) {
          const existing = activeCrossings.get(key);
          if (!existing) {
            activeCrossings.set(key, { startStep: step, minSep: sep, minStep: step });
          } else if (sep < existing.minSep) {
            existing.minSep = sep;
            existing.minStep = step;
          }
        } else {
          const existing = activeCrossings.get(key);
          if (existing) {
            const peak = refineCrossingPeak(
              jdToMs(jd + existing.minStep * STEP_JD), STEP_MIN * 60000,
              sepProbe(snap.planet, name), existing.minStep === 0);
            crossings.push({
              planet:         snap.planet,
              angle:          name,
              crossingTime:   new Date(peak.atMs).toISOString(),
              minutesFromNow: Math.round((peak.atMs - jdToMs(jd)) / 60000),
              durationMinutes: (step - existing.startStep) * STEP_MIN,
              orbAtExact:     parseFloat(peak.sep.toFixed(2)),
              benefic:        BENEFICS.has(snap.planet),
              malefic:        MALEFICS.has(snap.planet),
            });
            activeCrossings.delete(key);
          }
        }
      }
    }
  }

  // Flush in-progress crossings at end of lookahead
  for (const [key, state] of activeCrossings) {
    const [planetName, angleName] = key.split("-") as [string, "ASC" | "MC" | "DSC" | "IC"];
    const peak = refineCrossingPeak(
      jdToMs(jd + state.minStep * STEP_JD), STEP_MIN * 60000,
      sepProbe(planetName, angleName), state.minStep === 0);
    crossings.push({
      planet:         planetName,
      angle:          angleName,
      crossingTime:   new Date(peak.atMs).toISOString(),
      minutesFromNow: Math.round((peak.atMs - jdToMs(jd)) / 60000),
      durationMinutes: (STEPS - state.startStep) * STEP_MIN,
      orbAtExact:     parseFloat(peak.sep.toFixed(2)),
      benefic:        BENEFICS.has(planetName),
      malefic:        MALEFICS.has(planetName),
    });
  }

  return crossings.sort((a, b) => a.minutesFromNow - b.minutesFromNow);
}

// ── Local Chart Angles (ASC / MC) ─────────────────────────────────────────────

export interface LocalAngles {
  asc: number;     // Ascendant ecliptic longitude (0–360°)
  mc: number;      // Midheaven ecliptic longitude (0–360°)
  dsc: number;     // Descendant (ASC + 180°)
  ic: number;      // Imum Coeli (MC + 180°)
  ascSign: string;
  mcSign: string;
}

/**
 * Computes ASC and MC for a given moment and geographic location.
 * Uses the standard Placidus/equal-house formulas from Meeus Ch. 14.
 * Accurate to ~0.5° for latitudes ±65°.
 *
 * @param jd     Julian Day (UT)
 * @param latDeg Observer latitude  (positive = north)
 * @param lonDeg Observer longitude (positive = east, negative = west)
 */
/**
 * Personal angle times — when FIXED natal degrees rise (cross the local
 * Ascendant) or culminate (cross the local Midheaven) at a given place.
 * The mirror of getNextAngularCrossings: that one asks "when do today's
 * planets hit the local angles" (collective); this asks "when do the local
 * angles sweep across the degrees of YOUR chart" (personal). Each natal
 * degree rises and culminates once per sidereal day, so a 24h scan finds
 * one of each per planet. Sign-change detection on the wrapped difference,
 * linearly interpolated — accurate to well under a minute at 2-min steps.
 */
export interface NatalAngleEvent {
  planet: string;
  angle: "ASC" | "MC";   // rising | culminating
  jd: number;            // instant of exactness
}

export function getNatalDegreeAngles(
  natalPlanets: { planet: string; longitude: number }[],
  jd: number,
  latDeg: number,
  lonDeg: number,
  lookAheadHours = 24,
): NatalAngleEvent[] {
  const STEP_MIN = 2;
  const STEP_JD = STEP_MIN / (24 * 60);
  const STEPS = Math.floor((lookAheadHours * 60) / STEP_MIN);
  const wrap180 = (d: number) => { const w = normalize360(d); return w > 180 ? w - 360 : w; };

  const out: NatalAngleEvent[] = [];
  // Previous wrapped differences per planet-angle pair
  const prev = new Map<string, number>();

  for (let step = 0; step <= STEPS; step++) {
    const t = jd + step * STEP_JD;
    const angles = getLocalAngles(t, latDeg, lonDeg);
    for (const p of natalPlanets) {
      for (const [name, lon] of [["ASC", angles.asc], ["MC", angles.mc]] as const) {
        const f = wrap180(lon - p.longitude); // angle sweeps forward past the degree: f crosses 0 upward
        const key = `${p.planet}-${name}`;
        const fPrev = prev.get(key);
        if (fPrev !== undefined && fPrev < 0 && f >= 0 && f - fPrev < 30) {
          const frac = -fPrev / (f - fPrev);
          out.push({ planet: p.planet, angle: name, jd: t - STEP_JD + frac * STEP_JD });
        }
        prev.set(key, f);
      }
    }
  }
  return out.sort((a, b) => a.jd - b.jd);
}

export function getLocalAngles(jd: number, latDeg: number, lonDeg: number): LocalAngles {
  const T = (jd - 2451545.0) / 36525;

  // Greenwich Mean Sidereal Time (degrees)
  const gmst = normalize360(
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    T * T * 0.000387933 -
    (T * T * T) / 38710000,
  );

  // Local Sidereal Time = RAMC (right ascension of midheaven), degrees
  const ramc    = normalize360(gmst + lonDeg);
  const ramcRad = ramc * DEG2RAD;

  // Mean obliquity of the ecliptic
  const ε    = (23.439291 - 0.013 * T) * DEG2RAD;
  const φ    = latDeg * DEG2RAD;

  // Midheaven: tan(λ_MC) = sin(RAMC) / (cos(RAMC) · cos(ε))
  const mc = normalize360(
    Math.atan2(Math.sin(ramcRad), Math.cos(ramcRad) * Math.cos(ε)) * RAD2DEG,
  );

  // Ascendant: tan(λ_ASC) = −cos(RAMC) / (sin(RAMC)·cos(ε) + tan(φ)·sin(ε))
  // atan2 can land in the wrong quadrant — ASC must be 0–180° ahead of MC in ecliptic longitude
  const yAsc = -Math.cos(ramcRad);
  const xAsc  = Math.sin(ramcRad) * Math.cos(ε) + Math.tan(φ) * Math.sin(ε);
  let asc     = normalize360(Math.atan2(yAsc, xAsc) * RAD2DEG);
  if (normalize360(asc - mc) > 180) asc = normalize360(asc + 180);

  return {
    asc,
    mc,
    dsc: normalize360(asc + 180),
    ic:  normalize360(mc  + 180),
    ascSign: longitudeToSign(asc).sign,
    mcSign:  longitudeToSign(mc).sign,
  };
}

export interface AngularPlanet {
  planet: string;
  angle: "ASC" | "MC" | "DSC" | "IC";
  orb: number;
  longitude: number;
  benefic: boolean;  // Venus or Jupiter
  malefic: boolean;  // Mars or Saturn
}

const BENEFICS = new Set(["Venus", "Jupiter"]);
const MALEFICS = new Set(["Mars", "Saturn"]);

/**
 * Returns planets within orb of the four chart angles for the given location.
 * Angular planets intensify their themes for the current moment and place.
 * Benefics angular = supportive; malefics angular = friction or challenge.
 */
export function getAngularPlanets(
  jd: number,
  latDeg = 40.7,
  lonDeg = -74.0,
  orb = 5,
): AngularPlanet[] {
  const angles  = getLocalAngles(jd, latDeg, lonDeg);
  const planets = getPlanetPositions(jd);

  const angleMap: { name: "ASC" | "MC" | "DSC" | "IC"; lon: number }[] = [
    { name: "ASC", lon: angles.asc },
    { name: "MC",  lon: angles.mc  },
    { name: "DSC", lon: angles.dsc },
    { name: "IC",  lon: angles.ic  },
  ];

  const result: AngularPlanet[] = [];

  for (const p of planets) {
    for (const { name, lon: angleLon } of angleMap) {
      const raw = normalize360(Math.abs(p.longitude - angleLon));
      const sep = raw > 180 ? 360 - raw : raw;
      if (sep <= orb) {
        result.push({
          planet:   p.planet,
          angle:    name,
          orb:      parseFloat(sep.toFixed(2)),
          longitude: p.longitude,
          benefic:  BENEFICS.has(p.planet),
          malefic:  MALEFICS.has(p.planet),
        });
      }
    }
  }

  return result.sort((a, b) => a.orb - b.orb);
}

// ── Daily Element Emphasis ────────────────────────────────────────────────────

const SIGN_TO_ELEMENT: Record<string, string> = {
  Aries:       "fire",   Leo:         "fire",   Sagittarius: "fire",
  Taurus:      "earth",  Virgo:       "earth",  Capricorn:   "earth",
  Gemini:      "air",    Libra:       "air",    Aquarius:    "air",
  Cancer:      "water",  Scorpio:     "water",  Pisces:      "water",
};

export interface DailyElementEmphasis {
  element: "fire" | "earth" | "air" | "water" | "spirit";
  source: "moon-sign" | "void-of-course";
  moonSign: string;
  voidOfCourse: boolean;
}

/**
 * Returns the elemental quality of the current moment.
 * When Moon is void-of-course, returns Spirit — a signal for rest,
 * reflection, and non-initiating practice.
 */
export function getDailyElementEmphasis(jd: number): DailyElementEmphasis {
  const moonLon  = moonLongitude(jd);
  const moonSign = longitudeToSign(moonLon).sign;
  const { voc }  = voidOfCourse(jd);

  if (voc) {
    return { element: "spirit", source: "void-of-course", moonSign, voidOfCourse: true };
  }

  const element = (SIGN_TO_ELEMENT[moonSign] ?? "water") as DailyElementEmphasis["element"];
  return { element, source: "moon-sign", moonSign, voidOfCourse: false };
}

export function getAstroSnapshot(date: Date, lat = 40.7, lon = -74.0) {
  const jd      = julianDay(date);
  const planets = getPlanetPositions(jd);
  const { name: moonPhaseName, fraction } = moonPhase(jd);
  const sunSign   = planets.find((p) => p.planet === "Sun")!.sign;
  const moonSign  = planets.find((p) => p.planet === "Moon")!.sign;
  const elemEmph  = getDailyElementEmphasis(jd);
  const planetaryHour  = getPlanetaryHour(date, lat, lon);
  const retrogrades    = planets.filter((p) => p.retrograde).map((p) => p.planet);
  const aspects        = getMajorAspects(jd);
  const localAngles    = getLocalAngles(jd, lat, lon);
  const angularPlanets = getAngularPlanets(jd, lat, lon);

  return {
    timestamp:          date.toISOString(),
    moonPhase:          moonPhaseName,
    moonFraction:       fraction,
    moonSign,
    sunSign,
    voidOfCourse:       elemEmph.voidOfCourse,
    elementEmphasis:    elemEmph,
    planetaryHour,
    retrogrades,
    planets,
    aspects,
    localAngles,
    angularPlanets,
    activeTransits:     getActiveTransits(planets),
    healthInfluences:   getHealthInfluences(planets),
  };
}

/** Debug snapshot: returns raw longitudes + sign labels for every planet.
 *  Exposed via GET /api/astro/debug for manual sanity checks. */
export function getDebugSnapshot(date: Date) {
  const jd      = julianDay(date);
  const T       = (jd - 2451545.0) / 36525;
  const planets = getPlanetPositions(jd);
  const { name: moonPhaseName, fraction } = moonPhase(jd);

  return {
    date:      date.toISOString(),
    julianDay: jd,
    T,
    moonPhase: moonPhaseName,
    moonFraction: fraction,
    planets: planets.map((p) => ({
      planet:    p.planet,
      longitude: parseFloat(p.longitude.toFixed(4)),
      sign:      p.sign,
      degree:    parseFloat(p.degree.toFixed(4)),
      label:     `${p.sign} ${p.degree.toFixed(2)}°`,
    })),
    expectedSanityCheck: {
      note: "Expected for 2026-05-03 tropical zodiac",
      Sun:     "Taurus",
      Moon:    "late Scorpio or early Sagittarius",
      Mercury: "late Aries or early Taurus",
      Venus:   "Gemini",
      Mars:    "Aries ~17-18°",
      Jupiter: "Cancer",
      Saturn:  "Aries",
      Uranus:  "early Gemini",
      Neptune: "Aries",
      Pluto:   "Aquarius",
    },
  };
}
