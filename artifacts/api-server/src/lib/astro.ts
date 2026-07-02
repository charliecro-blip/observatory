/**
 * Ephemeris calculations for astrological context.
 *
 * All planets use proper heliocentric orbital mechanics:
 *   1. heliocentricEcliptic()  — mean longitude → true heliocentric longitude + radius
 *   2. geoFromHelio()          — heliocentric → geocentric ecliptic longitude
 *
 * Previous bug (fixed): Mars (and outer planets) were computed with
 * approxPlanetLongitude() which used only mean longitude — no equation of
 * center and no heliocentric→geocentric conversion.  For Mars this caused a
 * ~21° error (e.g. 26° Pisces instead of 18° Aries on 2026-05-03).
 */

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

/** Equation of center in degrees — converts mean anomaly → true longitude correction */
function equationOfCenter(Mrad: number, e: number): number {
  return RAD2DEG * (
    (2 * e - 0.25 * e * e * e) * Math.sin(Mrad) +
    1.25 * e * e * Math.sin(2 * Mrad) +
    (13 / 12) * e * e * e * Math.sin(3 * Mrad)
  );
}

interface OrbitalElements {
  L0: number; Lrate: number;       // mean longitude at J2000 (deg) + rate (deg/century)
  peri0: number; periRate: number; // longitude of perihelion (deg) + rate (deg/century)
  a: number; e: number;            // semi-major axis (AU), eccentricity
}

/** True heliocentric ecliptic longitude (deg) and radius vector (AU) */
function heliocentricEcliptic(T: number, p: OrbitalElements): { lambda: number; r: number } {
  const L    = normalize360(p.L0    + p.Lrate    * T);
  const peri = normalize360(p.peri0 + p.periRate * T);
  const M    = normalize360(L - peri);
  const C    = equationOfCenter(M * DEG2RAD, p.e);
  const lambda = normalize360(L + C);
  const nu   = normalize360(lambda - peri);
  const r    = p.a * (1 - p.e * p.e) / (1 + p.e * Math.cos(nu * DEG2RAD));
  return { lambda, r };
}

/** Heliocentric planet position → geocentric ecliptic longitude */
function geoFromHelio(lambdaP: number, rP: number, lambdaE: number, rE: number): number {
  const dx = rP * Math.cos(lambdaP * DEG2RAD) - rE * Math.cos(lambdaE * DEG2RAD);
  const dy = rP * Math.sin(lambdaP * DEG2RAD) - rE * Math.sin(lambdaE * DEG2RAD);
  return normalize360(Math.atan2(dy, dx) * RAD2DEG);
}

// ── Orbital elements (VSOP87 mean orbit at J2000, Meeus Table 33.a) ────────────
// Valid for ~1800-2050. periRate in deg/century.

const ORBITAL: Record<string, OrbitalElements> = {
  Mercury: { L0: 252.25032350, Lrate: 149472.67411175, peri0: 77.45779628,  periRate:  0.15940013, a:  0.38709893, e: 0.20563069 },
  Venus:   { L0: 181.97980785, Lrate:  58517.81538729, peri0: 131.60246718, periRate:  0.00268329, a:  0.72333199, e: 0.00677323 },
  // FIX: Mars was previously computed as mean-longitude only (no EoC, no geo correction)
  Mars:    { L0: 355.433275,   Lrate:  19140.2993313,  peri0: 336.04084,    periRate:  1.84969142, a:  1.52366231, e: 0.09339410 },
  Jupiter: { L0:  34.351519,   Lrate:   3034.9057,     peri0:  14.331,      periRate:  1.00,       a:  5.20260,   e: 0.048498   },
  Saturn:  { L0:  50.077444,   Lrate:   1222.1138,     peri0:  93.057,      periRate:  1.96,       a:  9.53707,   e: 0.056116   },
  Uranus:  { L0: 314.055005,   Lrate:    428.4677,     peri0: 173.005,      periRate:  1.49,       a: 19.1913,    e: 0.047168   },
  Neptune: { L0: 304.348665,   Lrate:    218.4862,     peri0:  48.120,      periRate:  1.43,       a: 30.0689,    e: 0.008590   },
  Pluto:   { L0: 238.92881,    Lrate:    145.9800,     peri0: 224.067,      periRate: -1.80,       a: 39.4821,    e: 0.248835   },
};

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

export function sunLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const L0 = normalize360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = normalize360(357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG2RAD;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  return normalize360(L0 + C);
}

export function moonLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const L1 = normalize360(218.3165 + 481267.8813 * T);
  const M  = normalize360(357.5291 + 35999.0503 * T)  * DEG2RAD;
  const M1 = normalize360(134.9634 + 477198.8676 * T) * DEG2RAD;
  const D  = normalize360(297.8502 + 445267.1115 * T) * DEG2RAD;
  const F  = normalize360(93.2721  + 483202.0175 * T) * DEG2RAD;
  return normalize360(
    L1 +
    6.2888 * Math.sin(M1) +
    1.274  * Math.sin(2 * D - M1) +
    0.6583 * Math.sin(2 * D) +
    0.2136 * Math.sin(2 * M1) -
    0.1851 * Math.sin(M) -
    0.1144 * Math.sin(2 * F) +
    0.0588 * Math.sin(2 * D - 2 * M1),
  );
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

/** Geocentric longitude of a named planet at a given JD. Used for retrograde detection. */
function geocentricLongitude(name: string, jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const earthLambda = normalize360(sunLongitude(jd) + 180);
  const el = ORBITAL[name];
  const { lambda, r } = heliocentricEcliptic(T, el);
  return geoFromHelio(lambda, r, earthLambda, 1.0);
}

/**
 * Returns true if the planet's geocentric longitude is decreasing (retrograde motion).
 * Compares longitude at jd vs jd+1. Sun and Moon cannot retrograde.
 */
export function isRetrograde(planet: string, jd: number): boolean {
  if (planet === "Sun" || planet === "Moon") return false;
  if (!ORBITAL[planet]) return false;
  const lon1 = geocentricLongitude(planet, jd);
  const lon2 = geocentricLongitude(planet, jd + 1);
  const diff = normalize360(lon2 - lon1);
  return diff > 180; // longitude decreased → retrograde
}

export function getPlanetPositions(jd: number) {
  const T = (jd - 2451545.0) / 36525;

  // Sun (special formula, not orbital elements)
  const sun  = sunLongitude(jd);
  const moon = moonLongitude(jd);

  // Earth's heliocentric longitude is the geocentric Sun direction + 180°
  const earthLambda = normalize360(sun + 180);
  const earthR = 1.0; // AU (simplified; varies 0.983–1.017)

  const results: Array<{ planet: string; sign: string; degree: number; longitude: number; retrograde: boolean }> = [
    { planet: "Sun",  longitude: sun,  retrograde: false, ...longitudeToSign(sun)  },
    { planet: "Moon", longitude: moon, retrograde: false, ...longitudeToSign(moon) },
  ];

  for (const name of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"] as const) {
    const el = ORBITAL[name];
    const { lambda, r } = heliocentricEcliptic(T, el);
    const geo = geoFromHelio(lambda, r, earthLambda, earthR);
    results.push({ planet: name, longitude: geo, retrograde: isRetrograde(name, jd), ...longitudeToSign(geo) });
  }

  return results;
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
  const angle = normalize360(a - b);
  return Math.min(...MAJOR_ASPECTS.map((asp) => {
    const d = Math.abs(angle - asp);
    return Math.min(d, 360 - d);
  }));
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

  // Seed previous separations
  const prevSep: Record<string, number> = {};
  for (const name of VOC_PLANETS) prevSep[name] = sep180(moonLon0, bodyLongitude(name, jd));

  for (let dt = STEP; dt <= daysLeft + STEP; dt += STEP) {
    const cj    = jd + dt;
    const mLon  = normalize360(moonLongitude(cj));
    if (Math.floor(mLon / 30) !== sign0) break;    // reached ingress — stop

    for (const name of VOC_PLANETS) {
      const sepNow = sep180(mLon, bodyLongitude(name, cj));
      for (const A of MAJOR_ASPECTS) {
        // Perfection = (sep - A) changes sign between steps, i.e. crosses the aspect exactly.
        if ((prevSep[name] - A) * (sepNow - A) <= 0 && Math.abs(prevSep[name] - sepNow) < 3) {
          return { voc: false };
        }
      }
      prevSep[name] = sepNow;
    }
  }
  return { voc: true };
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
): { sunrise: Date; sunset: Date } {
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
  if (Math.abs(cosH) > 1) {
    // Midnight sun or polar night — use 6h offset
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
  const jd = julianDay(date);
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

  if (now >= riseMs && now < setMs) {
    // Today's day hours
    const dayRuler = WEEKDAY_RULERS[sunrise.getUTCDay()];
    return computeHour(riseMs, setMs, dayRuler, 0, true);
  } else if (now >= setMs && now < nextRiseMs) {
    // Tonight's night hours
    const dayRuler = WEEKDAY_RULERS[sunrise.getUTCDay()];
    return computeHour(setMs, nextRiseMs, dayRuler, 12, false);
  } else {
    // Last night's hours (before today's sunrise)
    const dayRuler = WEEKDAY_RULERS[prevSunrise.getUTCDay()];
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

          // Real closing speed for THIS pair, from actual ephemeris motion over 1 hour.
          // ratePerHour > 0 means the orb is shrinking (applying).
          const ratePerHour = sep - sepN;
          const applying = sepN < sep;
          const hoursToExact = applying && ratePerHour > 1e-6
            ? parseFloat((sep / ratePerHour).toFixed(1))
            : null;
          // Mirror of hoursToExact for separating aspects — how long ago this pair
          // was exact, from the same (negated) closing-speed approximation. Without
          // this, separating aspects showed no time at all in Planetary Pulse, which
          // read as "some aspects have timing and some don't."
          const hoursSinceExact = !applying && ratePerHour < -1e-6
            ? parseFloat((sep / -ratePerHour).toFixed(1))
            : null;

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
    const planet = asp.planet1 === "Moon" ? asp.planet2 : asp.planet1 === "Moon" ? asp.planet2 : null;
    if (!planet || (asp.planet1 !== "Moon" && asp.planet2 !== "Moon")) continue;
    const p = asp.planet1 === "Moon" ? asp.planet2 : asp.planet1;
    if (asp.orb < 0.5 && asp.orb < (best?.orbAtExact ?? 999)) {
      best = {
        planet: p,
        aspect: asp.aspect,
        nature: asp.nature,
        orbAtExact: parseFloat(asp.orb.toFixed(2)),
        hoursAgo: parseFloat((asp.orb / 0.5).toFixed(1)), // approximate
        benefic: BENEFICS.has(p),
        malefic: MALEFICS.has(p),
      };
    }
  }

  return best;
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
            const crossJd = jd + existing.minStep * STEP_JD;
            crossings.push({
              planet:         snap.planet,
              angle:          name,
              crossingTime:   new Date((crossJd - 2440587.5) * 86400000).toISOString(),
              minutesFromNow: existing.minStep * STEP_MIN,
              durationMinutes: (step - existing.startStep) * STEP_MIN,
              orbAtExact:     parseFloat(existing.minSep.toFixed(2)),
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
    const crossJd = jd + state.minStep * STEP_JD;
    crossings.push({
      planet:         planetName,
      angle:          angleName,
      crossingTime:   new Date((crossJd - 2440587.5) * 86400000).toISOString(),
      minutesFromNow: state.minStep * STEP_MIN,
      durationMinutes: (STEPS - state.startStep) * STEP_MIN,
      orbAtExact:     parseFloat(state.minSep.toFixed(2)),
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

// Biodynamic day types (after Maria Thun): Moon sign → plant/body resonance
const ELEMENT_TO_BIODYNAMIC: Record<string, string> = {
  fire:   "fruit-seed",   // Leo, Aries, Sagittarius — seed vitality, yang energy
  earth:  "root",         // Virgo, Taurus, Capricorn — grounding, structure, body
  air:    "flower",       // Gemini, Libra, Aquarius  — breath, pollination, relationship
  water:  "leaf",         // Cancer, Scorpio, Pisces  — fluid, receptive, emotional body
  spirit: "fallow",       // VOC — rest, threshold, between-worlds
};

export interface DailyElementEmphasis {
  element: "fire" | "earth" | "air" | "water" | "spirit";
  source: "moon-sign" | "void-of-course";
  moonSign: string;
  voidOfCourse: boolean;
  biodynamicType: string;  // fruit-seed | root | flower | leaf | fallow
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
    return { element: "spirit", source: "void-of-course", moonSign, voidOfCourse: true, biodynamicType: "fallow" };
  }

  const element = (SIGN_TO_ELEMENT[moonSign] ?? "water") as DailyElementEmphasis["element"];
  return { element, source: "moon-sign", moonSign, voidOfCourse: false, biodynamicType: ELEMENT_TO_BIODYNAMIC[element] ?? "root" };
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
