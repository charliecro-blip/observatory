import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { isRetrograde, julianDay } from "../artifacts/api-server/src/lib/astro";
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
    const vals = Object.values(capped).sort((a,b)=>a-b);
    const median = vals[Math.floor(vals.length/2)];
    writeFileSync("tools/out/retrograde-exposure.json", JSON.stringify({
      year: 2026,
      pctOfYearRetrogradePerPlanet: perPlanet,
      activitiesWithAnyNonLuminarySignificator: Object.keys(capped).length,
      pctOfYearCappedPerActivity: capped,
      medianPctOfYearCapped: median,
      activitiesCappedOver50pct: Object.entries(capped).filter(([,v])=>v>50).length,
      activitiesCappedOver75pct: Object.entries(capped).filter(([,v])=>v>75).length,
    }, null, 2));
    expect(vals.length).toBeGreaterThan(0);
  }, 600_000);
});
