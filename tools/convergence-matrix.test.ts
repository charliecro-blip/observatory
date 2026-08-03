import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";

/**
 * TRACK A — system-wide calibration across season, latitude and chart state.
 *
 * The single-month run was misleading twice over: it landed in an eclipse
 * season, and it used one chart at one latitude. This sweeps the axes that
 * could each distort the picture on their own, so a threshold is never chosen
 * from a coincidence again.
 *
 *     npx vitest run --config vitest.tools.config.ts tools/convergence-matrix.test.ts
 *
 * Chart states are three, not two. "untimed" is a chart whose birth time was
 * never known — Settings stores a substituted noon with timeKnown:false, so
 * its Ascendant is fabricated and house testimony must be withheld while
 * planet-to-natal contacts survive.
 */
describe("convergence matrix", () => {
  it("sweeps season x latitude x chart state", () => {
    const timed = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
    // Same birth DAY, no known time: Settings would have stored noon.
    const untimed = computeNatalChart("1992-01-03", "12:00", 29.4246, -98.49514, -6, "whole-sign");

    const MONTHS = [
      { name: "feb", start: new Date(Date.UTC(2026, 1, 2, 12)) },
      { name: "may", start: new Date(Date.UTC(2026, 4, 4, 12)) },
      { name: "aug-eclipse", start: new Date(Date.UTC(2026, 7, 3, 12)) },
      { name: "oct", start: new Date(Date.UTC(2026, 9, 15, 12)) },
    ];
    const PLACES = [
      { name: "equatorial", lat: 1.35, lon: 103.8, tz: -480 },   // Singapore
      { name: "mid-north", lat: 29.42, lon: -98.50, tz: 300 },   // San Antonio
      { name: "high-north", lat: 60.17, lon: 24.94, tz: -120 },  // Helsinki
    ];
    const CHARTS: Array<{ name: string; natal: any; timeKnown: boolean }> = [
      { name: "timed", natal: timed, timeKnown: true },
      { name: "untimed", natal: untimed, timeKnown: false },
      { name: "none", natal: null, timeKnown: true },
    ];

    const rows: any[] = [];
    for (const m of MONTHS) for (const pl of PLACES) for (const ch of CHARTS) {
      let good = 0, great = 0, personal = 0, personalDecided = 0;
      const capped: Record<string, number> = {};
      const famUse: Record<string, number> = {};
      const famHist: Record<number, number> = {};
      const actsWithGreat = new Set<string>();
      for (const act of ACTIVITIES) {
        const r = computeElections({
          activityKey: act.key, span: "month",
          lat: pl.lat, lon: pl.lon, tzOffsetMin: pl.tz,
          natal: ch.natal, timeKnown: ch.timeKnown, startAt: m.start,
        });
        if (!r) continue;
        for (const w of r.windows) {
          const n = (w.families ?? []).length;
          famHist[n] = (famHist[n] ?? 0) + 1;
          for (const f of w.families ?? []) famUse[f] = (famUse[f] ?? 0) + 1;
          if (w.personal) personal++;
          if (w.personalDecidedTier) personalDecided++;
          if (w.cappedBy) capped[w.cappedBy] = (capped[w.cappedBy] ?? 0) + 1;
          if (w.tier === "great") { great++; actsWithGreat.add(act.key); } else good++;
        }
      }
      rows.push({
        month: m.name, place: pl.name, chart: ch.name,
        good, great,
        greatPerActivity: parseFloat((great / ACTIVITIES.length).toFixed(2)),
        activitiesWithGreat: actsWithGreat.size,
        personalWindows: personal, personalDecidedTier: personalDecided,
        capped, familyUsage: famUse, familyHistogram: famHist,
      });
    }
    mkdirSync("tools/out", { recursive: true });
    writeFileSync("tools/out/convergence-matrix.json", JSON.stringify(rows, null, 2));
    expect(rows.length).toBe(MONTHS.length * PLACES.length * CHARTS.length);
  }, 3_600_000);
});
