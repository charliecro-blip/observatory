// Birth data → engine NatalInput, via the api-server's natal engine.
//
// Loaded lazily from the chart view only, so the pair editor and gallery keep
// working even if the ephemeris fails to resolve. Uses materia's UTC-instant
// workaround: computeNatalChart floors utcOffset to whole hours, which breaks
// half-hour and 45-minute zones, so we build the UTC moment ourselves and
// always pass a zero offset.

import { computeNatalChart } from "../../../artifacts/api-server/src/lib/natal";
import { julianDay, getPlanetPositions } from "../../../artifacts/api-server/src/lib/astro";
import type { HouseSystem } from "../../../artifacts/api-server/src/lib/houses";
import { isEnginePlanet, type NatalInput } from "../engine/chart";
import type { TransitPosition } from "../engine/weather";
import type { Planet, Sign } from "../engine/types";

export interface BirthInput {
  date: string;      // "YYYY-MM-DD"
  time: string;      // "HH:MM"
  lat: number;
  lon: number;
  utcOffset: number; // hours, fractional allowed (5.5 for India)
}

export function computeChart(b: BirthInput, houseSystem: HouseSystem = "regiomontanus"): NatalInput {
  const [y, m, d] = b.date.split("-").map(Number);
  const [hh, mm] = b.time.split(":").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hh, mm) - b.utcOffset * 3600_000);
  const pad = (v: number) => String(v).padStart(2, "0");

  const natal = computeNatalChart(
    `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`,
    `${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}`,
    b.lat, b.lon, 0, houseSystem,
  );

  return {
    planets: natal.planets
      .filter((p) => isEnginePlanet(p.planet))
      .map((p) => ({
        planet: p.planet as Planet, sign: p.sign as Sign,
        longitude: p.longitude, houseNumber: p.houseNumber,
      })),
    ascendant: { sign: natal.ascendant.sign as Sign, longitude: natal.ascendant.longitude },
    midheaven: { sign: natal.midheaven.sign as Sign, longitude: natal.midheaven.longitude },
  };
}

/** The ten planets' positions at a moment — Color Weather's sky. */
export function computeTransits(at: Date): TransitPosition[] {
  const jd = julianDay(at);
  return getPlanetPositions(jd)
    .filter((p) => isEnginePlanet(p.planet))
    .map((p) => ({ planet: p.planet as Planet, sign: p.sign as Sign, longitude: p.longitude }));
}
