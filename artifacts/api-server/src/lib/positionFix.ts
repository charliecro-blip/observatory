/**
 * Position fix — "where you are in time", the navigational read of a chart.
 *
 * Owner 2026-07-27: readings-as-essays aren't Compass; locating someone in
 * time IS. A compass gives bearings, not biographies. Three zooms:
 *   YEAR    — profection house + the lord of the year + when the lord is
 *             activated next (those dates are the year's power days)
 *   CHAPTER — the slow clocks as dated landmarks: Saturn-cycle stage with the
 *             next waypoint, and the outer-planet renovations in progress
 *   DAY     — already served by the synthesis engine (dayReading)
 *
 * Everything here is assembly of verified pieces: profections (currents.ts),
 * transit forecast (natal.ts), Hand's Saturn-cycle stages (SYNTHESIS-BOOK-NOTES).
 */
import { getPlanetPositions, julianDay } from "./astro.js";
import { computeProfection, type Profection } from "./currents.js";
import { computeTransitAspects, computeTransitForecast, type ComputedNatalChart } from "./natal.js";
import { transitMeaning } from "./interpretation.js";

const n360 = (d: number) => ((d % 360) + 360) % 360;
const fold = (a: number, b: number) => { const d = Math.abs(n360(a - b)); return d > 180 ? 360 - d : d; };

// The profected house as a navigation theme — where the year runs, said the
// way a navigator would, not a textbook.
const HOUSE_THEME: Record<number, string> = {
  1: "the self — body, direction, how you begin",
  2: "livelihood — money, worth, what you keep",
  3: "the daily word — skills, siblings, short roads",
  4: "home — roots, family, the ground floor",
  5: "creation — pleasure, play, what you make",
  6: "the practice — work, craft, health, routine",
  7: "partnership — the other chair",
  8: "shared depths — other people's resources, the vault",
  9: "the far shore — travel, teaching, belief",
  10: "the visible work — career, reputation",
  11: "allies and audience — community, gains",
  12: "the retreat — unseen work, rest, completion",
};

// Hand's Saturn cycle, banded into plain stages (waypoints are the aspects).
const SATURN_STAGES: [number, string][] = [
  [0,   "laying foundations — the new cycle's first build"],
  [60,  "consolidation corridor — adjust what you've built before the first test"],
  [90,  "after the first inspection — rebuild on what held"],
  [120, "the lift — momentum toward culmination"],
  [180, "harvest — the cycle's high water; steer by results"],
  [240, "the turn home — redirect what the harvest taught"],
  [270, "letting go — prune what won't make the next cycle"],
  [300, "the quiet — finish, rest, prepare the next foundation"],
];
const WAYPOINTS: [number, string][] = [
  [60, "first adjustment (sextile)"], [90, "first inspection (waxing square)"],
  [120, "the lift (trine)"], [180, "culmination (opposition)"],
  [240, "the turn home (trine)"], [270, "the letting-go test (waning square)"],
  [300, "final adjustment (sextile)"], [360, "Saturn return"],
];

export interface PositionFix {
  year: {
    age: number;
    house: number;
    sign: string;
    lord: string;
    theme: string;
    yearEnd: string;                     // next birthday — when the year turns
    monthHouse: number;
    monthTheme: string;
    lordActivations: { date: string; label: string }[];  // the year's power days (next ~90d)
  };
  chapter: {
    saturnStage: string;
    nextWaypoint: { name: string; date: string } | null;
    renovations: { line: string; note: string }[];       // slow transits in progress
  };
}

/** Find when transiting Saturn next perfects `angle` from natal Saturn.
 *  Monthly scan (Saturn ~0.033°/day) then a daily refine around the hit. */
function nextSaturnWaypointDate(natalSaturnLon: number, angle: number, from: Date): string | null {
  const target = n360(natalSaturnLon + angle);
  let prev: number | null = null;
  for (let m = 0; m < 132; m++) { // up to 11 years out
    const t = from.getTime() + m * 30.44 * 86400000;
    const sat = getPlanetPositions(julianDay(new Date(t))).find(p => p.planet === "Saturn")!;
    const sep = fold(sat.longitude, target);
    if (prev != null && sep < 2 && sep <= prev) {
      // close and closing — refine daily over the surrounding 90 days
      for (let d = -45; d <= 45; d++) {
        const td = t + d * 86400000;
        const s2 = getPlanetPositions(julianDay(new Date(td))).find(p => p.planet === "Saturn")!;
        if (fold(s2.longitude, target) < 0.15) return new Date(td).toISOString().slice(0, 10);
      }
      return new Date(t).toISOString().slice(0, 10); // month precision fallback
    }
    prev = sep;
  }
  return null;
}

export function positionFix(natal: ComputedNatalChart, birthDate: string, now = new Date()): PositionFix {
  const prof: Profection = computeProfection(birthDate, now, natal.ascendant.sign);

  // The year's power days: transits to the lord of the year, next ~90 days.
  const lordHits = computeTransitForecast(natal, 90)
    .filter(t => t.natalPlanet === prof.timeLord)
    .sort((a, b) => a.dayOffset - b.dayOffset)
    .slice(0, 3)
    .map(t => ({
      date: t.peakDate.slice(0, 10),
      label: `${t.transitPlanet} ${t.aspect.toLowerCase()} your ${prof.timeLord}`,
    }));

  // Saturn stage + next waypoint.
  const natSat = natal.planets.find(p => p.planet === "Saturn")!.longitude;
  const trSat = getPlanetPositions(julianDay(now)).find(p => p.planet === "Saturn")!.longitude;
  const phase = n360(trSat - natSat);
  let stage = SATURN_STAGES[0][1];
  for (const [deg, label] of SATURN_STAGES) if (phase >= deg) stage = label;
  const nextWp = WAYPOINTS.find(([deg]) => deg > phase) ?? WAYPOINTS[WAYPOINTS.length - 1];
  const wpDate = nextSaturnWaypointDate(natSat, nextWp[0] % 360, now);

  // Renovations: the slow transits currently pressing on the chart.
  const SLOW = new Set(["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);
  const renovations = computeTransitAspects(natal)
    .filter(t => SLOW.has(t.transitPlanet) && (t.severity === "major" || t.severity === "strong"))
    .slice(0, 3)
    .map(t => ({
      line: `${t.transitPlanet} ${t.aspect.toLowerCase()} your ${t.natalPlanet}`,
      note: transitMeaning(t.transitPlanet, t.aspect, t.natalPlanet),
    }));

  return {
    year: {
      age: prof.age,
      house: prof.house,
      sign: prof.sign,
      lord: prof.timeLord,
      theme: HOUSE_THEME[prof.house] ?? "",
      yearEnd: prof.yearEnd,
      monthHouse: prof.monthHouse,
      monthTheme: HOUSE_THEME[prof.monthHouse] ?? "",
      lordActivations: lordHits,
    },
    chapter: {
      saturnStage: stage,
      nextWaypoint: wpDate ? { name: nextWp[1], date: wpDate } : null,
      renovations,
    },
  };
}
