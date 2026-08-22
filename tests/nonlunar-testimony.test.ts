import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The missing voice.
 *
 * Every layer of the sky produced testimony except planet-to-planet aspects.
 * Those were computed, folded into the day's HEIGHT at weight 0.05, and never
 * spoken — which is why a week could carry heavy slow configurations and still
 * render as the flattest bars of the month. Measured 2026-08-02: `standing`
 * climbed 0.63 → 1.00 across the same stretch where the tide fell 0.68 → 0.28.
 *
 * This family is what lets the dashboard's "this stretch" band exist, and what
 * makes the convergence rule countable by SOURCE FAMILY rather than by
 * rendered line.
 */
describe("non-lunar aspect testimony", () => {
  it("is emitted for real dates", async () => {
    const S: any = await import("../artifacts/api-server/src/lib/synthesis.js");
    const r = S.dayReading(new Date(Date.UTC(2026, 7, 2, 15, 0, 0)), 40.7, -74.0, { tzOffsetMin: 300 });
    const nl = r.testimonies.filter((t: any) => t.source.startsWith("aspect:"));
    expect(nl.length).toBeGreaterThan(0);
  });

  it("never includes the Moon — that is a different family", async () => {
    // The whole point of counting families is that Moon-Saturn and a
    // Saturn-Neptune square are different voices. If lunar aspects leaked in
    // here they would be counted twice.
    const S: any = await import("../artifacts/api-server/src/lib/synthesis.js");
    for (const d of [2, 9, 16, 23]) {
      const r = S.dayReading(new Date(Date.UTC(2026, 7, d, 15, 0, 0)), 40.7, -74.0, { tzOffsetMin: 300 });
      for (const t of r.testimonies.filter((x: any) => x.source.startsWith("aspect:"))) {
        expect(t.source, `Aug${d}`).not.toMatch(/Moon/);
        expect(t.facts.planet, `Aug${d}`).not.toBe("Moon");
        expect(t.facts.partner, `Aug${d}`).not.toBe("Moon");
      }
    }
  });

  it("carries a duration estimate that ranks pairs correctly", async () => {
    const S: any = await import("../artifacts/api-server/src/lib/synthesis.js");
    // Scan a month and collect any pair we happen to catch, then assert the
    // ORDERING is astronomically sane rather than pinning exact day counts.
    const seen = new Map<string, number>();
    for (let d = 1; d <= 28; d++) {
      const r = S.dayReading(new Date(Date.UTC(2026, 7, d, 15, 0, 0)), 40.7, -74.0, { tzOffsetMin: 300 });
      for (const t of r.testimonies.filter((x: any) => x.source.startsWith("aspect:"))) {
        expect(t.facts.durationDays, t.source).toBeGreaterThan(0);
        seen.set(t.source.replace("aspect:", ""), t.facts.durationDays);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    // Any pair of two slow bodies must outlast any pair involving a fast one.
    const SLOW = new Set(["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);
    const slowSlow: number[] = [], hasFast: number[] = [];
    for (const [pair, days] of seen) {
      const [a, b] = pair.split("-");
      (SLOW.has(a) && SLOW.has(b) ? slowSlow : hasFast).push(days);
    }
    if (slowSlow.length && hasFast.length) {
      expect(Math.min(...slowSlow)).toBeGreaterThan(Math.min(...hasFast));
    }
  });

  it("keeps salience below the Moon's — weather, not the engine", async () => {
    // These persist for days; an applying Moon aspect is what actually moves
    // today. If the standing weather could outshout the Moon the reading would
    // stop changing hour to hour.
    const S: any = await import("../artifacts/api-server/src/lib/synthesis.js");
    const src = readFileSync(
      join(process.cwd(), "artifacts/api-server/src/lib/synthesis.ts"), "utf-8");
    // The scalars moved into the SAL table on 2026-08-22, when the owner's
    // ordering (hours and days secondary to lunar placement, lunar aspects and
    // other planetary aspects) was written down in one place. Assert the
    // RELATION rather than the literals, which is what this test was ever
    // about: non-lunar aspects are the weather, the Moon is the engine.
    const num = (k: string) => Number(new RegExp(`${k}:\\s*Number\\(process\\.env\\.\\w+ \\?\\? ([\\d.]+)\\)`).exec(src)![1]);
    expect(num("aspect")).toBeLessThan(num("moonAspect"));
    expect(num("moonAspect")).toBeGreaterThan(num("hour"));
    expect(num("aspect")).toBeGreaterThan(num("hour"));
    // And confirm it holds on real data for a day carrying both.
    for (let d = 1; d <= 28; d++) {
      const r = S.dayReading(new Date(Date.UTC(2026, 7, d, 15, 0, 0)), 40.7, -74.0, { tzOffsetMin: 300 });
      const nl = r.testimonies.filter((t: any) => t.source.startsWith("aspect:"));
      // Against the Moon's own scalar rather than a literal — 0.56 was the old
      // ceiling and pinned the constant, not the commitment.
      for (const t of nl) expect(t.salience, `Aug${d} ${t.source}`).toBeLessThan(num("moonAspect"));
    }
  });

  it("only admits tight aspects to the surface layer", async () => {
    const S: any = await import("../artifacts/api-server/src/lib/synthesis.js");
    for (let d = 1; d <= 28; d++) {
      const r = S.dayReading(new Date(Date.UTC(2026, 7, d, 15, 0, 0)), 40.7, -74.0, { tzOffsetMin: 300 });
      for (const t of r.testimonies.filter((x: any) => x.source.startsWith("aspect:"))) {
        expect(t.facts.orbDeg, t.source).toBeLessThanOrEqual(3);
      }
    }
  });

  it("gives every family a distinct source prefix, so convergence can count them", async () => {
    // The rule that stops the duplication bug returning: a pattern derived from
    // an aspect must be attributable back to that aspect's family.
    const S: any = await import("../artifacts/api-server/src/lib/synthesis.js");
    const r = S.dayReading(new Date(Date.UTC(2026, 7, 2, 15, 0, 0)), 40.7, -74.0, { tzOffsetMin: 300 });
    const prefixes = new Set(r.testimonies.map((t: any) => t.source.split(":")[0]));
    // Every source must be recognisable as one of the known families.
    const KNOWN = new Set(["sect", "sectMalefic", "hour", "dayRuler", "moonSign",
                           "moonAspect", "aspect", "phase", "voc", "transit"]);
    for (const p of prefixes) expect(KNOWN.has(p as string), `unknown family: ${p}`).toBe(true);
  });
});
