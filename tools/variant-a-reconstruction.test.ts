import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";
import { isRetrograde, julianDay } from "../artifacts/api-server/src/lib/astro";

/**
 * Reconstruct variant A exactly, instead of inferring it.
 *
 * A was only ever measured on the eclipse month, so the October figure had no
 * baseline beside it and the claim "the delta is the narrowing" was inference.
 * The old code is gone, but A's rule is simple enough to reapply: it capped
 * GREAT whenever ANY non-luminary significator was retrograde that day.
 *
 * So for every window B calls convergent, ask whether A would have capped it.
 * That gives the exact delta without resurrecting the old engine.
 */
describe("variant A reconstruction", () => {
  it("counts how many B-convergent windows A would have capped", () => {
    const natal: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
    const MONTHS = [
      { name: "aug-eclipse", start: new Date(Date.UTC(2026, 7, 3, 12)) },
      { name: "oct-ordinary", start: new Date(Date.UTC(2026, 9, 15, 12)) },
    ];
    const out: any[] = [];
    for (const m of MONTHS) {
      let convergent = 0, cappedByA = 0, cappedByOuterOnly = 0;
      const rxCache = new Map<string, boolean>();
      const rxOn = (p: string, jd: number) => {
        const k = `${p}:${Math.floor(jd)}`;
        if (!rxCache.has(k)) rxCache.set(k, isRetrograde(p, jd));
        return rxCache.get(k)!;
      };
      const OUTERS = new Set(["Uranus", "Neptune", "Pluto"]);
      for (const act of ACTIVITIES) {
        const sigs = Object.keys(act.planets).filter(p => p !== "Sun" && p !== "Moon");
        if (!sigs.length) continue;
        const r = computeElections({
          activityKey: act.key, span: "month",
          lat: 29.4246, lon: -98.49514, tzOffsetMin: 300, natal, startAt: m.start,
        });
        if (!r) continue;
        for (const w of r.windows) {
          if (w.supportLevel !== "convergent") continue;
          convergent++;
          const jd = julianDay(new Date(w.startAt));
          const rx = sigs.filter(p => rxOn(p, jd));
          if (rx.length) {
            cappedByA++;
            // The sharper number: capped ONLY because of a planet the rule was
            // never written about.
            if (rx.every(p => OUTERS.has(p))) cappedByOuterOnly++;
          }
        }
      }
      const row = {
        month: m.name,
        bConvergent: convergent,
        wouldBeCappedByA: cappedByA,
        cappedSolelyByOuterPlanets: cappedByOuterOnly,
        aConvergentSurviving: convergent - cappedByA,
        pctOfBLostUnderA: convergent ? Math.round((100 * cappedByA) / convergent) : 0,
        pctOfBLostToOutersAlone: convergent ? Math.round((100 * cappedByOuterOnly) / convergent) : 0,
      };
      out.push(row);
      console.log(JSON.stringify(row));
    }
    mkdirSync("tools/out", { recursive: true });
    writeFileSync("tools/out/variant-a-reconstruction.json", JSON.stringify(out, null, 2));
    expect(out.length).toBe(2);
  }, 1_800_000);
});
