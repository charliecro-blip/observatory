/**
 * Pluggable house systems.
 *
 * The natal chart historically hard-coded Regiomontanus (a medical-astrology
 * convention). This module offers whole-sign, equal, Porphyry, Placidus, and
 * Regiomontanus. Whole-sign is the default for the long-term / traditional layer
 * (profections assume it).
 *
 * All functions take the already-computed ASC/MC longitudes plus RAMC, obliquity,
 * and latitude, and return 12 cusp longitudes (index 0 = house 1).
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export type HouseSystem = "whole-sign" | "equal" | "porphyry" | "placidus" | "regiomontanus";

export const HOUSE_SYSTEMS: HouseSystem[] = ["whole-sign", "equal", "porphyry", "placidus", "regiomontanus"];

export const HOUSE_SYSTEM_LABEL: Record<HouseSystem, string> = {
  "whole-sign":   "Whole Sign",
  "equal":        "Equal",
  "porphyry":     "Porphyry",
  "placidus":     "Placidus",
  "regiomontanus": "Regiomontanus",
};

function norm360(d: number): number { return ((d % 360) + 360) % 360; }
function clamp(n: number, lo = -1, hi = 1): number { return Math.max(lo, Math.min(hi, n)); }

/**
 * Placidus is undefined above the polar circle: ecliptic degrees there can be
 * circumpolar (they never rise or set), so the semi-arc being trisected does
 * not exist. Refuse rather than fabricate — callers that let a user choose
 * Placidus catch this and say so, instead of returning plausible-looking cusps.
 */
export class PolarLatitudeError extends Error {
  readonly code = "PLACIDUS_POLAR_LATITUDE";
  constructor(lat: number, limit: number) {
    super(
      `Placidus houses are undefined at latitude ${lat.toFixed(1)}° ` +
      `(beyond the polar circle at ±${limit.toFixed(1)}°) — some ecliptic degrees never rise or set there. ` +
      `Choose whole-sign, equal, porphyry, or regiomontanus.`,
    );
    this.name = "PolarLatitudeError";
  }
}

// Ecliptic longitude of the point on the ecliptic at a given right ascension.
function lonFromRA(raDeg: number, epsRad: number): number {
  const ra = norm360(raDeg) * DEG2RAD;
  return norm360(Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(epsRad)) * RAD2DEG);
}

export interface CuspInput {
  ascLon: number;
  mcLon: number;
  ramc: number;   // right ascension of MC, degrees
  eps: number;    // obliquity, degrees
  lat: number;    // geographic latitude, degrees
}

// ── Whole-sign: cusps are the 0° boundary of each sign, starting from ASC's sign
function wholeSignCusps(ascLon: number): number[] {
  const ascSignStart = Math.floor(ascLon / 30) * 30;
  return Array.from({ length: 12 }, (_, i) => norm360(ascSignStart + i * 30));
}

// ── Equal: 30° arcs from the ASC degree
function equalCusps(ascLon: number): number[] {
  return Array.from({ length: 12 }, (_, i) => norm360(ascLon + i * 30));
}

// ── Porphyry: trisect each ecliptic quadrant (ASC→IC→DSC→MC) equally
function porphyryCusps(ascLon: number, mcLon: number): number[] {
  const dsc = norm360(ascLon + 180);
  const ic = norm360(mcLon + 180);
  const q1 = norm360(ic - ascLon) / 3;   // ASC → IC (houses 1,2,3)
  const q2 = norm360(dsc - ic) / 3;      // IC → DSC (houses 4,5,6)
  const cusps = new Array(12).fill(0);
  cusps[0] = ascLon;
  cusps[1] = norm360(ascLon + q1);
  cusps[2] = norm360(ascLon + 2 * q1);
  cusps[3] = ic;
  cusps[4] = norm360(ic + q2);
  cusps[5] = norm360(ic + 2 * q2);
  cusps[6] = dsc;
  cusps[7] = norm360(cusps[1] + 180);
  cusps[8] = norm360(cusps[2] + 180);
  cusps[9] = mcLon;
  cusps[10] = norm360(cusps[4] + 180);
  cusps[11] = norm360(cusps[5] + 180);
  return cusps;
}

// ── Placidus: proportional trisection of the semi-arcs (iterative)
function placidusCusps(input: CuspInput): number[] {
  const { ascLon, mcLon, ramc, eps, lat } = input;
  // Beyond ±(90° − ε) the ascensional-difference asin() has no real solution
  // for solstitial declinations and the clamp below would silently invent one.
  const polarLimit = 90 - eps;
  if (Math.abs(lat) >= polarLimit) throw new PolarLatitudeError(lat, polarLimit);
  const epsR = eps * DEG2RAD;
  const phiR = lat * DEG2RAD;

  // Cusp above the horizon (11,12): RA = RAMC + f·(90 + AD), measured from MC.
  // Below the polar limit |tanφ·tanδ| < 1 always holds, so the clamp inside
  // asin() only absorbs float noise — it can no longer fabricate cusps.
  function above(f: number): number {
    let ra = ramc + f * 90;
    for (let i = 0; i < 40; i++) {
      const lon = lonFromRA(ra, epsR) * DEG2RAD;
      const decl = Math.asin(Math.sin(epsR) * Math.sin(lon));
      const ad = Math.asin(clamp(Math.tan(phiR) * Math.tan(decl))) * RAD2DEG;
      ra = ramc + f * (90 + ad);
    }
    return lonFromRA(ra, epsR);
  }
  // Cusp below the horizon (2,3): RA = RAMC + 180 − f·(90 − AD), measured from IC.
  function below(f: number): number {
    let ra = ramc + 180 - f * 90;
    for (let i = 0; i < 40; i++) {
      const lon = lonFromRA(ra, epsR) * DEG2RAD;
      const decl = Math.asin(Math.sin(epsR) * Math.sin(lon));
      const ad = Math.asin(clamp(Math.tan(phiR) * Math.tan(decl))) * RAD2DEG;
      ra = ramc + 180 - f * (90 - ad);
    }
    return lonFromRA(ra, epsR);
  }

  const c11 = above(1 / 3), c12 = above(2 / 3);
  const c2 = below(2 / 3), c3 = below(1 / 3);
  const cusps = new Array(12).fill(0);
  cusps[0] = ascLon;
  cusps[1] = c2;
  cusps[2] = c3;
  cusps[3] = norm360(mcLon + 180); // IC
  cusps[4] = norm360(c11 + 180);
  cusps[5] = norm360(c12 + 180);
  cusps[6] = norm360(ascLon + 180); // DSC
  cusps[7] = norm360(c2 + 180);
  cusps[8] = norm360(c3 + 180);
  cusps[9] = mcLon;
  cusps[10] = c11;
  cusps[11] = c12;
  return cusps;
}

// ── Regiomontanus: equal 30° arcs on the equator, projected to the ecliptic
function regiomontanusCusps(input: CuspInput): number[] {
  const { ascLon, mcLon, ramc, eps, lat } = input;
  const latR = lat * DEG2RAD;
  const epsR = eps * DEG2RAD;
  function cusp(offset: number): number {
    // Ecliptic intersection of the great circle through the horizon's north/
    // south points and the equator at RA = RAMC + offset. The latitude term
    // MUST be modulated by sin(offset): it vanishes on the meridian (offset 0
    // → the MC formula) and is full at the horizon (offset 90 → the ASC
    // formula). An unmodulated tanφ·sinε here once skewed every intermediate
    // cusp and broke opposite-cusp symmetry (tests/houses.test.ts pins both).
    const theta = (ramc + offset) * DEG2RAD;
    const num = Math.sin(theta);
    const den = Math.cos(theta) * Math.cos(epsR) - Math.tan(latR) * Math.sin(offset * DEG2RAD) * Math.sin(epsR);
    return norm360(Math.atan2(num, den) * RAD2DEG);
  }
  // Oblique-ascension offsets from RAMC: MC=0, h11=30, h12=60, ASC=90,
  // h2=120, h3=150, IC=180, h5=210, h6=240, DSC=270, h8=300, h9=330.
  const cusps = new Array(12).fill(0);
  cusps[0] = ascLon;
  cusps[1] = cusp(120);
  cusps[2] = cusp(150);
  cusps[3] = norm360(mcLon + 180);
  cusps[4] = cusp(210);
  cusps[5] = cusp(240);
  cusps[6] = norm360(ascLon + 180);
  cusps[7] = cusp(300);
  cusps[8] = cusp(330);
  cusps[9] = mcLon;
  cusps[10] = cusp(30);
  cusps[11] = cusp(60);
  return cusps;
}

export function computeCusps(system: HouseSystem, input: CuspInput): number[] {
  switch (system) {
    case "whole-sign":   return wholeSignCusps(input.ascLon);
    case "equal":        return equalCusps(input.ascLon);
    case "porphyry":     return porphyryCusps(input.ascLon, input.mcLon);
    case "placidus":     return placidusCusps(input);
    case "regiomontanus": return regiomontanusCusps(input);
    default:             return wholeSignCusps(input.ascLon);
  }
}

/**
 * Which house (1–12) a body at `longitude` falls in, given cusp longitudes.
 * Works for any system: sorts cusps by zodiacal longitude and finds the arc.
 */
export function assignHouse(longitude: number, cusps: number[]): number {
  const lon = norm360(longitude);
  const sorted = cusps
    .map((cusp, idx) => ({ house: idx + 1, cusp: norm360(cusp) }))
    .sort((a, b) => a.cusp - b.cusp);
  for (let i = 0; i < 12; i++) {
    const start = sorted[i].cusp;
    const end = sorted[(i + 1) % 12].cusp;
    if (start < end) {
      if (lon >= start && lon < end) return sorted[i].house;
    } else {
      if (lon >= start || lon < end) return sorted[i].house;
    }
  }
  return 1;
}
