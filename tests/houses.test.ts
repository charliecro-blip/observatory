import { describe, it, expect } from "vitest";
import {
  computeCusps, assignHouse, PolarLatitudeError, HOUSE_SYSTEMS, type CuspInput,
} from "../artifacts/api-server/src/lib/houses.js";

/**
 * House cusps feed natal charts, profections, and transit-by-house — and until
 * now the module (including an iterative Placidus solver) had no tests at all
 * (audit 2026-08-08 §3). The strategy here is "measure, don't read": reference
 * values come from independent arithmetic inside this file — sign boundaries
 * for whole-sign, the textbook angle formulas for ASC/MC, and the *defining
 * equation* of Placidus checked as a residual — never from re-running the
 * module and pasting its output back in.
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const norm360 = (d: number) => ((d % 360) + 360) % 360;
/** Shortest signed distance a→b on the circle, for tolerant comparisons. */
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

// Independent reference formulas (standard spherical astronomy, same as any
// textbook — deliberately NOT imported from the code under test).
function refMC(ramc: number, eps: number): number {
  return norm360(Math.atan2(Math.sin(ramc * DEG2RAD), Math.cos(ramc * DEG2RAD) * Math.cos(eps * DEG2RAD)) * RAD2DEG);
}
function refASC(ramc: number, eps: number, lat: number): number {
  const r = ramc * DEG2RAD, e = eps * DEG2RAD, p = lat * DEG2RAD;
  return norm360(Math.atan2(-Math.cos(r), Math.sin(e) * Math.tan(p) + Math.cos(e) * Math.sin(r)) * RAD2DEG + 180);
}
/** Right ascension of an ecliptic longitude. */
function refRA(lonDeg: number, eps: number): number {
  const l = lonDeg * DEG2RAD, e = eps * DEG2RAD;
  return norm360(Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) * RAD2DEG);
}
/** Declination of an ecliptic longitude. */
function refDecl(lonDeg: number, eps: number): number {
  return Math.asin(Math.sin(eps * DEG2RAD) * Math.sin(lonDeg * DEG2RAD)) * RAD2DEG;
}

const EPS = 23.4367; // obliquity of date, current era

/** A self-consistent chart input at an arbitrary sidereal moment. */
function chartAt(ramc: number, lat: number, eps = EPS): CuspInput {
  return { ascLon: refASC(ramc, eps, lat), mcLon: refMC(ramc, eps), ramc, eps, lat };
}

// A mid-latitude chart (New-York-ish) at an unremarkable RAMC — nothing about
// the assertions depends on these particular values, they just have to be
// non-degenerate.
const MID = chartAt(50, 40.7);

describe("whole-sign — cross-checked against pure sign arithmetic", () => {
  it("cusps are the 0° boundaries of twelve consecutive signs starting at the ASC's sign", () => {
    // Whole-sign is the reference system the others get sanity-checked
    // against, so it is itself pinned to arithmetic done here, not in houses.ts.
    const cusps = computeCusps("whole-sign", MID);
    const ascSignStart = Math.floor(MID.ascLon / 30) * 30;
    for (let i = 0; i < 12; i++) {
      expect(cusps[i], `house ${i + 1}`).toBe(norm360(ascSignStart + i * 30));
    }
  });

  it("cusp 1 is the sign START, not the ASC degree (profections assume this)", () => {
    // If someone "fixes" whole-sign to start at the ASC degree it becomes the
    // equal system, and every profection downstream shifts.
    expect(MID.ascLon % 30, "test premise: ASC must not sit exactly on a sign boundary").not.toBe(0);
    const cusps = computeCusps("whole-sign", MID);
    expect(cusps[0]).not.toBe(MID.ascLon);
    expect(cusps[0] % 30).toBe(0);
  });
});

describe("equal — 30° arcs from the ASC degree itself", () => {
  it("every cusp is ASC + 30i", () => {
    const cusps = computeCusps("equal", MID);
    for (let i = 0; i < 12; i++) {
      expect(angDiff(cusps[i], MID.ascLon + 30 * i), `house ${i + 1}`).toBeLessThan(1e-9);
    }
  });
});

describe("structural invariants shared by every system", () => {
  // These are the properties a garbage solver output would violate first:
  // twelve finite cusps, angles anchored, opposite cusps opposed, houses in
  // zodiacal order. Whole-sign anchors the sign boundary instead of the
  // degree, so the angle checks use sign-level tolerance there.
  for (const system of HOUSE_SYSTEMS) {
    it(`${system}: 12 finite cusps, angles anchored, opposite cusps 180° apart, zodiacal order`, () => {
      const cusps = computeCusps(system, MID);
      expect(cusps).toHaveLength(12);
      for (const c of cusps) {
        expect(Number.isFinite(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(360);
      }

      if (system !== "whole-sign") {
        expect(angDiff(cusps[0], MID.ascLon), "cusp 1 = ASC").toBeLessThan(1e-6);
        expect(angDiff(cusps[6], MID.ascLon + 180), "cusp 7 = DSC").toBeLessThan(1e-6);
      }
      if (system !== "whole-sign" && system !== "equal") {
        expect(angDiff(cusps[9], MID.mcLon), "cusp 10 = MC").toBeLessThan(1e-6);
        expect(angDiff(cusps[3], MID.mcLon + 180), "cusp 4 = IC").toBeLessThan(1e-6);
      }

      for (let i = 0; i < 6; i++) {
        expect(angDiff(cusps[i + 6], cusps[i] + 180), `cusps ${i + 1}/${i + 7} opposed`).toBeLessThan(1e-6);
      }

      // Houses must proceed zodiacally: offsets from cusp 1 strictly increase.
      // An iterative solver that diverged (or a quadrant mix-up) breaks this
      // long before any numeric comparison would notice.
      const offsets = cusps.map((c) => norm360(c - cusps[0]));
      for (let i = 1; i < 12; i++) {
        expect(offsets[i], `house ${i + 1} follows house ${i}`).toBeGreaterThan(offsets[i - 1]);
      }
    });
  }
});

describe("porphyry — each quadrant trisected on the ecliptic", () => {
  it("intermediate cusps sit exactly a third of the way through their quadrant", () => {
    const cusps = computeCusps("porphyry", MID);
    const ic = norm360(MID.mcLon + 180);
    const q1 = norm360(ic - MID.ascLon) / 3; // ASC→IC quadrant
    expect(angDiff(cusps[1], MID.ascLon + q1)).toBeLessThan(1e-9);
    expect(angDiff(cusps[2], MID.ascLon + 2 * q1)).toBeLessThan(1e-9);
  });
});

describe("placidus — the solver satisfies the system's defining equation", () => {
  // Placidus cusp 11 is DEFINED by: RA(cusp) = RAMC + ⅓·(90° + AD(cusp)),
  // cusp 12 by ⅔; below the horizon, cusp 2 by RAMC + 180° − ⅔·(90° − AD) and
  // cusp 3 by ⅓ — where AD = asin(tanφ·tanδ). Instead of trusting published
  // tables (or worse, the solver's own output), plug the returned cusp back
  // into the definition and require the residual to vanish. A solver that
  // stopped converging, iterated the wrong equation, or had its sign flipped
  // cannot pass this.
  const residual = (cuspLon: number, expectedRA: number) => angDiff(refRA(cuspLon, EPS), expectedRA);
  const ad = (cuspLon: number, lat: number) =>
    Math.asin(Math.tan(lat * DEG2RAD) * Math.tan(refDecl(cuspLon, EPS) * DEG2RAD)) * RAD2DEG;

  for (const lat of [40.7, -33.9, 60]) {
    it(`intermediate cusps close the semi-arc equation at lat ${lat}`, () => {
      const input = chartAt(50, lat);
      const cusps = computeCusps("placidus", input);
      const cases: Array<[number, number]> = [
        [cusps[10], norm360(input.ramc + (1 / 3) * (90 + ad(cusps[10], lat)))],       // house 11
        [cusps[11], norm360(input.ramc + (2 / 3) * (90 + ad(cusps[11], lat)))],       // house 12
        [cusps[1],  norm360(input.ramc + 180 - (2 / 3) * (90 - ad(cusps[1], lat)))],  // house 2
        [cusps[2],  norm360(input.ramc + 180 - (1 / 3) * (90 - ad(cusps[2], lat)))],  // house 3
      ];
      for (const [cusp, ra] of cases) {
        expect(residual(cusp, ra), `cusp at ${cusp.toFixed(3)}° drifted from its defining RA`).toBeLessThan(0.01);
      }
    });
  }

  it("collapses to Regiomontanus at the equator", () => {
    // At φ = 0 the ascensional difference is identically zero, so Placidus'
    // semi-arc trisection and Regiomontanus' equatorial trisection become the
    // same construction. Two independent code paths agreeing here catches a
    // broken projection in either one.
    const eq = chartAt(50, 0);
    const p = computeCusps("placidus", eq);
    const r = computeCusps("regiomontanus", eq);
    for (let i = 0; i < 12; i++) {
      expect(angDiff(p[i], r[i]), `house ${i + 1}`).toBeLessThan(1e-6);
    }
  });
});

describe("regiomontanus — cusps lie on their defining house circles", () => {
  // A Regiomontanus cusp is DEFINED as the ecliptic intersection of the great
  // circle through the horizon's north/south points and the celestial equator
  // at RA = RAMC + offset. So the returned longitude, as a vector, must be
  // orthogonal to that circle's pole. This is what caught the original bug:
  // the cusp formula's latitude term was not modulated by sin(offset), which
  // skewed every intermediate cusp (~9° at 40.7°N for houses 2/8) while
  // leaving the overwritten angles looking fine.
  const HOUSE_OFFSETS: Array<[number, number]> = [
    [1, 120], [2, 150], [4, 210], [5, 240], [7, 300], [8, 330], [10, 30], [11, 60],
  ];

  for (const lat of [40.7, -33.9, 60]) {
    it(`intermediate cusps sit on the house circle at lat ${lat}`, () => {
      const input = chartAt(50, lat);
      const cusps = computeCusps("regiomontanus", input);
      const e = EPS * DEG2RAD, p = lat * DEG2RAD;
      for (const [idx, offset] of HOUSE_OFFSETS) {
        // Cusp longitude as an equatorial-frame unit vector.
        const l = cusps[idx] * DEG2RAD;
        const v = [Math.cos(l), Math.sin(l) * Math.cos(e), Math.sin(l) * Math.sin(e)];
        // Pole of the house circle through horizon N/S and the equator at α₀.
        const a0 = (input.ramc + offset) * DEG2RAD, o = offset * DEG2RAD;
        const pole = [-Math.cos(p) * Math.sin(a0), Math.cos(p) * Math.cos(a0), -Math.sin(p) * Math.sin(o)];
        const mag = Math.hypot(...pole);
        const dot = (v[0] * pole[0] + v[1] * pole[1] + v[2] * pole[2]) / mag;
        expect(Math.abs(dot), `house ${idx + 1} cusp is off its defining circle`).toBeLessThan(1e-9);
      }
    });
  }
});

describe("placidus — refuses beyond the polar circle instead of fabricating", () => {
  // Above ±(90° − ε) some ecliptic degrees are circumpolar: they never rise or
  // set, so the semi-arc being trisected does not exist. The solver used to
  // clamp asin() out of range and return plausible-looking cusps — the exact
  // fabrication class the house rules ban. The decision (audit 2026-08-08 §3)
  // is to REFUSE with a typed error; routes/chart.ts and routes/currents.ts
  // catch it and answer 422 so a Tromsø user is told to pick another system
  // rather than shown an invented chart.
  const polarLimit = 90 - EPS; // ≈ 66.56°

  it("throws PolarLatitudeError at 70°N", () => {
    expect(() => computeCusps("placidus", chartAt(50, 70))).toThrow(PolarLatitudeError);
  });

  it("throws in the southern hemisphere too (−70°)", () => {
    expect(() => computeCusps("placidus", chartAt(50, -70))).toThrow(PolarLatitudeError);
  });

  it("the error is typed and says what to do instead", () => {
    // Routes match on the class/code, users read the message — both are API.
    try {
      computeCusps("placidus", chartAt(50, 70));
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PolarLatitudeError);
      expect((err as PolarLatitudeError).code).toBe("PLACIDUS_POLAR_LATITUDE");
      expect((err as Error).message).toMatch(/polar circle/);
      expect((err as Error).message).toMatch(/whole-sign/);
    }
  });

  it("still computes just inside the circle, and the boundary itself refuses", () => {
    // The refusal must not creep equatorward: 66.5° is a real, computable
    // Placidus chart (Iceland's north coast) and must keep working.
    expect(polarLimit).toBeGreaterThan(66.5);
    const cusps = computeCusps("placidus", chartAt(50, 66.5));
    expect(cusps).toHaveLength(12);
    for (const c of cusps) expect(Number.isFinite(c)).toBe(true);
    expect(() => computeCusps("placidus", chartAt(50, polarLimit))).toThrow(PolarLatitudeError);
  });

  it("other systems still work at 70°N — the refusal is Placidus-specific", () => {
    // Whole-sign, equal, and Regiomontanus remain mathematically defined at
    // polar latitudes; refusing them too would be over-withholding.
    for (const system of ["whole-sign", "equal", "porphyry", "regiomontanus"] as const) {
      const cusps = computeCusps(system, chartAt(50, 70));
      expect(cusps, system).toHaveLength(12);
      for (const c of cusps) expect(Number.isFinite(c), system).toBe(true);
    }
  });
});

describe("assignHouse", () => {
  // Whole-sign cusps with house 1 starting at 0° Leo (120°): houses are plain
  // 30° arcs, so every expectation is checkable by eye.
  const cusps = Array.from({ length: 12 }, (_, i) => norm360(120 + 30 * i));

  it("places a body inside an arc in that house", () => {
    expect(assignHouse(125, cusps)).toBe(1);
    expect(assignHouse(300, cusps)).toBe(7);
  });

  it("a cusp degree belongs to the house it BEGINS", () => {
    // Boundary convention: [cusp, next). If this flips to (cusp, next], a
    // planet exactly on the ASC drops into the 12th — astrologically the
    // difference between "rising" and "hidden".
    expect(assignHouse(120, cusps)).toBe(1);
    expect(assignHouse(150, cusps)).toBe(2);
  });

  it("handles the arc that wraps 0° Aries", () => {
    // With house 1 at 120°, house 8 spans 330°→0°: the wrap case where naive
    // `start <= lon < end` returns nothing.
    expect(assignHouse(355, cusps)).toBe(8);
    expect(assignHouse(0, cusps)).toBe(9);
    expect(assignHouse(5, cusps)).toBe(9);
  });

  it("agrees with quadrant cusps too, not just even 30° arcs", () => {
    // Porphyry cusps are unevenly spaced, exercising the sort-based lookup.
    const q = computeCusps("porphyry", MID);
    expect(assignHouse(norm360(MID.ascLon + 0.1), q), "just past the ASC is the 1st").toBe(1);
    expect(assignHouse(norm360(MID.ascLon - 0.1), q), "just before the ASC is the 12th").toBe(12);
    expect(assignHouse(norm360(MID.mcLon + 0.1), q), "just past the MC is the 10th").toBe(10);
    expect(assignHouse(norm360(MID.mcLon - 0.1), q), "just before the MC is the 9th").toBe(9);
  });
});
