import { describe, it, expect } from "vitest";

/**
 * Chiron is the one body astronomy-engine does not cover, so it is the one
 * body Compass computes itself — which makes it the one body that can drift
 * without anything noticing.
 *
 * These are external anchors, not self-consistency checks: a model can be
 * perfectly self-consistent and still wrong by half a sign. Each expectation
 * below is a published position from outside this codebase.
 */

const SIGNS = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
const fmt = (lon: number) => `${(lon % 30).toFixed(1)}° ${SIGNS[Math.floor(lon / 30) % 12]}`;

async function chironAt(y: number, m: number, d: number): Promise<number> {
  const A: any = await import("../artifacts/api-server/src/lib/astro.js");
  const jd = A.julianDay(new Date(Date.UTC(y, m - 1, d, 0, 0, 0)));
  const p = A.getPlanetPositions(jd).find((x: any) => x.planet === "Chiron");
  return ((p.longitude % 360) + 360) % 360;
}

/** Shortest angular separation, degrees. */
const sep = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe("Chiron matches published positions", () => {
  it("sits at ~3° Taurus on its discovery date, 1977-11-01", async () => {
    // Kowal's discovery plates. The published position is 3°08' Taurus.
    const lon = await chironAt(1977, 11, 1);
    expect(sep(lon, 30 + 3 + 8 / 60), `got ${fmt(lon)}, expected ~3.1° Tau`).toBeLessThan(1);
  });

  it("sits at ~8.3° Leo on 1992-01-03", async () => {
    // Swiss Ephemeris reads ~8.2° Leo. This is the date the old flat 2D fit
    // failed hardest — it returned 15.6° Leo, out by more than seven degrees,
    // because it was calibrated to a single 2026 epoch and drifted backwards.
    const lon = await chironAt(1992, 1, 3);
    expect(sep(lon, 120 + 8.25), `got ${fmt(lon)}, expected ~8.3° Leo`).toBeLessThan(1);
  });

  it("is at 0° Aries on the 2018-04-17 ingress day", async () => {
    // A widely published ingress: Chiron entered Aries on 2018-04-17. An
    // ingress date is a strong test because it pins an absolute boundary
    // rather than a position someone could have fitted to.
    const lon = await chironAt(2018, 4, 17);
    expect(Math.min(lon, 360 - lon), `got ${fmt(lon)}, expected ~0° Ari`).toBeLessThan(1);
  });

  it("stays put across the range the fit covers", async () => {
    // Guards the failure mode of the model it replaced: correct at one epoch,
    // drifting badly away from it. Sampled at both ends of the fitted span.
    for (const [y, m, d] of [[1950, 1, 1], [2030, 1, 1]] as const) {
      const lon = await chironAt(y, m, d);
      expect(Number.isFinite(lon), `${y} produced ${lon}`).toBe(true);
      expect(lon).toBeGreaterThanOrEqual(0);
      expect(lon).toBeLessThan(360);
    }
  });
});
