import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { isRetrograde, julianDay, getPlanetPositions, SIGNS } from "../artifacts/api-server/src/lib/astro";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";

describe("retrograde exposure", () => {
  it("measures how much of a year each activity is capped", () => {
    const PLANETS = ["Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
    const days: { jd: number; rx: Set<string> }[] = [];
    for (let d = 0; d < 365; d++) {
      const jd = julianDay(new Date(Date.UTC(2026, 0, 1 + d, 12)));
      const rx = new Set(PLANETS.filter(p => isRetrograde(p, jd)));
      days.push({ jd, rx });
    }
    const pct = (n: number) => Math.round((100 * n) / 365);
    const perPlanet: Record<string, number> = {};
    for (const p of PLANETS) perPlanet[p] = pct(days.filter(d => d.rx.has(p)).length);
    // The engine's cap: dayRxSigs = significators (excluding Sun/Moon) retrograde.
    const capped: Record<string, number> = {};
    for (const act of ACTIVITIES) {
      const sigs = Object.keys(act.planets).filter(p => p !== "Sun" && p !== "Moon");
      if (!sigs.length) continue;
      capped[act.key] = pct(days.filter(d => sigs.some(s => d.rx.has(s))).length);
    }
    // SPEED, not just sign. The engine derives direction from two longitude
    // samples and discards the magnitude — but speed is the underlying
    // variable: retrograde is merely its sign, and a STATION (speed ~0) is
    // arguably the more electionally loaded state than retrogradation itself.
    const lonOf = (p: string, jd: number) => {
      const row = getPlanetPositions(jd).find(x => x.planet === p);
      return row ? SIGNS.indexOf(row.sign) * 30 + row.degree : null;
    };
    const speedOn = (p: string, jd: number) => {
      const a = lonOf(p, jd), b = lonOf(p, jd + 1);
      if (a == null || b == null) return null;
      let d = b - a;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      return d;
    };
    const merc: number[] = [];
    for (const d of days) { const v = speedOn("Mercury", d.jd); if (v != null) merc.push(v); }
    merc.sort((a, b) => a - b);
    const q = (f: number) => parseFloat(merc[Math.floor(f * (merc.length - 1))].toFixed(3));
    const nearStation = merc.filter(v => Math.abs(v) < 0.2).length;
    const speedProfile = {
      mercuryDegPerDay: { min: q(0), p10: q(0.1), median: q(0.5), p90: q(0.9), max: q(1) },
      daysNearStationary_absUnder0_2: nearStation,
      pctOfYearNearStationary: Math.round((100 * nearStation) / merc.length),
      pctOfYearRetrograde: Math.round((100 * merc.filter(v => v < 0).length) / merc.length),
    };

    const vals = Object.values(capped).sort((a,b)=>a-b);
    const median = vals[Math.floor(vals.length/2)];
    writeFileSync("tools/out/retrograde-exposure.json", JSON.stringify({
      year: 2026,
      pctOfYearRetrogradePerPlanet: perPlanet,
      activitiesWithAnyNonLuminarySignificator: Object.keys(capped).length,
      pctOfYearCappedPerActivity: capped,
      medianPctOfYearCapped: median,
      speedProfile,
      activitiesCappedOver50pct: Object.entries(capped).filter(([,v])=>v>50).length,
      activitiesCappedOver75pct: Object.entries(capped).filter(([,v])=>v>75).length,
    }, null, 2));
    expect(vals.length).toBeGreaterThan(0);
  }, 600_000);
});
