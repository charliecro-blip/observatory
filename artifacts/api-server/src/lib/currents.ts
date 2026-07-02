/**
 * Currents — the long-term personal timescales (year+).
 *
 *   Profection  — age-based annual (and monthly) house activation + time-lord.
 *   Transit-by-house — which natal house each slow planet is moving through now,
 *                      with approximate ingress/egress dates (the life "chapters").
 *
 * Profections are definitionally whole-sign. Transit-by-house uses whatever cusps
 * the caller passes (i.e. the user's chosen house system).
 */

import { getPlanetPositions, julianDay } from "./astro.js";
import { SIGNS, SIGN_RULERS, type ComputedNatalChart } from "./natal.js";
import { assignHouse } from "./houses.js";

// ── Profection ────────────────────────────────────────────────────────────────

export interface Profection {
  age: number;
  house: number;       // annual profected house (1–12)
  sign: string;        // whole-sign sign on that house
  timeLord: string;    // planetary ruler of that sign — the year's lord
  yearStart: string;   // ISO date (last birthday)
  yearEnd: string;     // ISO date (next birthday)
  monthHouse: number;  // current monthly profected house
  monthSign: string;
  monthLord: string;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

export function computeProfection(birthDate: string, onDate: Date, ascSign: string): Profection {
  const [, bm, bd] = birthDate.split("-").map(Number);
  const y = onDate.getUTCFullYear();
  const hadBirthday = (onDate.getUTCMonth() + 1 > bm) ||
    (onDate.getUTCMonth() + 1 === bm && onDate.getUTCDate() >= bd);
  const startYear = hadBirthday ? y : y - 1;
  let age = startYear - parseInt(birthDate.slice(0, 4));

  const houseIdx = ((age % 12) + 12) % 12;     // 0-based steps from the 1st
  const house = houseIdx + 1;
  const ascIdx = SIGNS.indexOf(ascSign);
  const sign = SIGNS[(ascIdx + houseIdx) % 12];
  const timeLord = SIGN_RULERS[sign] ?? "";

  const yearStart = `${startYear}-${pad(bm)}-${pad(bd)}`;
  const yearEnd = `${startYear + 1}-${pad(bm)}-${pad(bd)}`;

  // Monthly profection: the year splits into 12 ~28-day parts, each advancing a house.
  const span = Date.parse(yearEnd + "T00:00:00Z") - Date.parse(yearStart + "T00:00:00Z");
  const elapsed = onDate.getTime() - Date.parse(yearStart + "T00:00:00Z");
  const monthIdx = Math.max(0, Math.min(11, Math.floor((elapsed / span) * 12)));
  const monthHouseIdx = (houseIdx + monthIdx) % 12;
  const monthSign = SIGNS[(ascIdx + monthHouseIdx) % 12];

  return {
    age, house, sign, timeLord, yearStart, yearEnd,
    monthHouse: monthHouseIdx + 1,
    monthSign,
    monthLord: SIGN_RULERS[monthSign] ?? "",
  };
}

// ── Transit-by-house ───────────────────────────────────────────────────────────

export interface TransitHousePlacement {
  planet: string;
  sign: string;
  house: number;
  retrograde: boolean;
  enteredHouse: string | null;  // approx ISO date it entered this house
  leavesHouse: string | null;   // approx ISO date it leaves
}

// Planets whose house tenancy defines multi-month/year chapters.
const CHAPTER_PLANETS = ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

function planetLon(name: string, jd: number): number | null {
  const p = getPlanetPositions(jd).find((x) => x.planet === name);
  if (!p) return null;
  return SIGNS.indexOf(p.sign) * 30 + p.degree;
}

// Step outward in `dir` (±1) by 30-day increments (refined to ~2 days) to find the
// date the planet's house differs from `house`. Capped at ~22 years (Pluto-safe).
function scanHouseBoundary(
  name: string, from: Date, cusps: number[], house: number, dir: 1 | -1,
): string | null {
  const COARSE = 30 * 86400000, MAXSTEPS = 270;
  let t = from.getTime();
  let found = false;
  for (let i = 0; i < MAXSTEPS; i++) {
    const next = t + dir * COARSE;
    const lon = planetLon(name, julianDay(new Date(next)));
    if (lon == null) return null;
    if (assignHouse(lon, cusps) !== house) { t = next; found = true; break; }
    t = next;
  }
  if (!found) return null;
  // Refine between t and the previous coarse step (2-day resolution)
  let lo = t - dir * COARSE, hi = t;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const lon = planetLon(name, julianDay(new Date(mid)));
    if (lon == null) break;
    if (assignHouse(lon, cusps) === house) lo = mid; else hi = mid;
  }
  return new Date(dir === 1 ? hi : lo).toISOString().slice(0, 10);
}

export function computeTransitsByHouse(
  onDate: Date, cusps: number[],
): TransitHousePlacement[] {
  const jd = julianDay(onDate);
  const planets = getPlanetPositions(jd);
  const out: TransitHousePlacement[] = [];
  for (const name of CHAPTER_PLANETS) {
    const p = planets.find((x) => x.planet === name);
    if (!p) continue;
    const lon = SIGNS.indexOf(p.sign) * 30 + p.degree;
    const house = assignHouse(lon, cusps);
    out.push({
      planet: name,
      sign: p.sign,
      house,
      retrograde: p.retrograde,
      enteredHouse: scanHouseBoundary(name, onDate, cusps, house, -1),
      leavesHouse: scanHouseBoundary(name, onDate, cusps, house, 1),
    });
  }
  return out;
}
