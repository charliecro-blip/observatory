import { describe, it, expect } from "vitest";
import { julianDay, getAsteroids, lunarNodes, meanNodeLongitude } from "../artifacts/api-server/src/lib/astro.js";

/**
 * THE ENGINE AGAINST JPL HORIZONS.
 *
 * Reference values fetched 2026-08-21 from the Horizons API (geocentric
 * apparent ecliptic longitude, QUANTITIES=31; the Moon's osculating node from
 * EPHEM_TYPE=ELEMENTS). They are recorded here as numbers, not re-fetched,
 * so this test never needs the network and never drifts with it.
 *
 * Why it exists: the Kepler asteroid model was right in 2026 and 1–4° off
 * for births in the 1960s–1990s, and nothing measured it. (A first pass at
 * this comparison used Horizons COMMAND='1' — the Mercury barycenter — as
 * "Ceres" and concluded the asteroids were 49° off. Small bodies are '1;'.
 * The semicolon is the whole difference, which is its own lesson.)
 */
const ASTEROIDS: { at: string; Ceres: number; Pallas: number; Juno: number; Vesta: number }[] = [
  { at: "2026-08-21T18:30:00Z", Ceres: 93.3199, Pallas: 22.4786, Juno: 298.0069, Vesta: 27.7493 },
  { at: "1992-01-03T23:37:00Z", Ceres: 268.7541, Pallas: 247.6991, Juno: 317.5119, Vesta: 174.1335 },
  { at: "2005-11-20T12:00:00Z", Ceres: 261.5201, Pallas: 236.8930, Juno: 81.3022, Vesta: 113.1923 },
  { at: "2019-06-30T06:00:00Z", Ceres: 241.4628, Pallas: 193.4220, Juno: 124.4120, Vesta: 38.1955 },
  { at: "1975-03-15T00:00:00Z", Ceres: 9.7800, Pallas: 337.3933, Juno: 29.8404, Vesta: 316.7718 },
];
// Horizons' osculating ascending node of the Moon (geocentric, ECLIPTIC OF
// J2000 — Horizons' elements are always in the ICRF/J2000 frame). Astrology
// measures longitude on the ecliptic OF DATE, so each reference is shifted
// by the general precession in longitude, 1.396971° per Julian century from
// J2000, before comparing. Without that, the comparison drifts ~0.37° by 2026.
const NODES: { at: string; omega: number }[] = [
  { at: "1975-03-15T00:00:00Z", omega: 243.6901 },
  { at: "1992-01-03T00:00:00Z", omega: 279.9819 },
  { at: "2005-11-20T00:00:00Z", omega: 12.5236 },
  { at: "2019-06-30T00:00:00Z", omega: 107.4028 },
  { at: "2026-08-21T00:00:00Z", omega: 329.4401 },
  { at: "2033-02-10T00:00:00Z", omega: 203.0265 },
];
const sep = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };

describe("asteroid goddesses against Horizons", () => {
  for (const ref of ASTEROIDS) {
    it(`within 0.3° at ${ref.at}`, () => {
      const jd = julianDay(new Date(ref.at));
      const got = Object.fromEntries(getAsteroids(jd).map(a => [a.planet, a.longitude]));
      for (const name of ["Ceres", "Pallas", "Juno", "Vesta"] as const) {
        expect(sep(got[name], ref[name]), `${name} ${ref.at}: engine ${got[name].toFixed(2)} vs Horizons ${ref[name]}`).toBeLessThan(0.3);
      }
    });
  }
});

describe("the lunar node against Horizons", () => {
  for (const ref of NODES) {
    it(`true node within 0.2° of the osculating node at ${ref.at}`, () => {
      const jd = julianDay(new Date(ref.at));
      const n = lunarNodes(jd).north.longitude;
      const ofDate = ref.omega + 1.396971 * ((jd - 2451545.0) / 36525);
      expect(sep(n, ofDate), `engine ${n.toFixed(3)} vs Horizons (of date) ${ofDate.toFixed(3)}`).toBeLessThan(0.2);
    });
  }
  it("the mean node is what it was — secular only, and it can sit 1.7° from the true node", () => {
    const jd = julianDay(new Date("2026-08-21T18:30:00Z"));
    expect(sep(meanNodeLongitude(jd), 329.843)).toBeLessThan(0.01);
    // Somewhere in a year the two part by more than a degree; that gap is
    // the whole reason the true node exists.
    let maxGap = 0;
    for (let d = 0; d < 365; d += 1) {
      const j = julianDay(new Date(Date.UTC(2026, 0, 1) + d * 86400000));
      maxGap = Math.max(maxGap, sep(meanNodeLongitude(j), lunarNodes(j).north.longitude));
    }
    expect(maxGap).toBeGreaterThan(1);
    expect(maxGap).toBeLessThan(2);
  });
});
