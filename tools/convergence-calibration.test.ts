import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";

/**
 * CONVERGENCE CALIBRATION HARNESS.
 *
 * Skipped by default and kept out of tests/ on purpose: it takes ~170s, and
 * Railway's deploy runs `pnpm test` before building. Run it deliberately:
 *
 *     npx vitest run --config vitest.tools.config.ts
 *
 * Why it exists: thresholds for a tier like "great" must come from a measured
 * distribution, not from taste — the same discipline that fixed the lead
 * module, where a hand-picked floor sat below every sample in a 240-moment
 * scan and made "quiet" unreachable.
 *
 * FIRST RUN WAS MEASURED ON AN ECLIPSE MONTH, AND ITS CONCLUSION WAS WRONG.
 *
 * Scanning 30 days from 2026-08-03 gave good=635, great=9, and zero great
 * windows without a birth chart. That produced two confident claims — that
 * convergence was starved, and that `great` was unreachable without a chart —
 * and both were artifacts of the sample. August 2026 sits in an eclipse
 * season, and the eclipse gate suppresses `great` for +/-7 days around ANY
 * eclipse; since eclipses arrive in pairs a fortnight apart, a season can cap
 * almost an entire month. 266 of the 281 windows that met the bar were
 * demoted by that one gate.
 *
 * Measured across four scenarios (30 days, all 46 activities, one real chart):
 *
 *   eclipse-month  / with-chart   good=635  great= 9   18% of acts
 *   eclipse-month  / no-chart     good=644  great= 0    0% of acts
 *   ordinary-month / with-chart   good=545  great=99   39% of acts
 *   ordinary-month / no-chart     good=612  great=32   13% of acts
 *
 * So convergence is NOT starved: an ordinary month yields 99 great windows for
 * a chart user, eleven times the eclipse-month figure. And `great` IS
 * reachable without a chart — 32 of them.
 *
 * The lesson is about method, not astrology: a single month is not a sample.
 * Any threshold set from the August run would have been calibrated against the
 * rarest fortnight of the year.
 *
 * What now dominates in an ordinary month is a different gate —
 * `retrograde-significator` demoted 141 windows. With several outer planets
 * retrograde for much of any year, every activity carrying an outer
 * significator is capped for months at a time. Whether that is doctrinally
 * intended or an over-broad reading is the next question worth measuring.
 *
 * Also settles the double-counting question empirically. `greatSignals` used
 * to read `daySources.length` before the emit-time dedupe, and three branches
 * pushed the bare string "natal", so the tier could be reached by one family
 * counted twice. It never actually was: every great window carried three
 * distinct families. Fixed because the code contradicted its own stated
 * semantics and because calibration must count what the UI claims it counts —
 * not because anyone hit it. The fix left good/great unchanged at 635/9 on the
 * original sample, which is how we know it moved no threshold.
 */
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";

describe("convergence calibration harness", () => {
  it("measures tier scarcity, family independence, and pre-tier candidates", () => {
    const chart: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
    // August 2026 sits in an ECLIPSE SEASON, and the eclipse gate is +/-7 days
    // around any eclipse — which, since eclipses arrive in pairs a fortnight
    // apart, can cap almost an entire month. Calibrating only there measured
    // the exception and called it the rule. October is between seasons.
    const AUG = new Date(Date.UTC(2026, 7, 3, 12, 0, 0));
    const OCT = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));
    const scenarios: Array<{ name: string; natal: any; start: Date }> = [
      { name: "eclipse-month/with-chart", natal: chart, start: AUG },
      { name: "eclipse-month/no-chart", natal: null, start: AUG },
      { name: "ordinary-month/with-chart", natal: chart, start: OCT },
      { name: "ordinary-month/no-chart", natal: null, start: OCT },
      // The decisive control. If `great` never fires without a chart, the tier
      // is not a statement about the sky at all — it is a statement about
      // having entered a birth time, and every chartless user sees a product
      // with its top tier permanently switched off.
    ];
    const reports: Record<string, any> = {};
    for (const sc of scenarios) {
    const natal = sc.natal;
    let good = 0, great = 0, greatOneFamily = 0, personalWindows = 0, personalDecided = 0;
    const perAct: Record<string, number> = {};
    const famHist: Record<number, number> = {};
    const allFamHist: Record<number, number> = {};
    const famUse: Record<string, number> = {};
    const capped: Record<string, number> = {};
    for (const act of ACTIVITIES) {
      const r = computeElections({
        activityKey: act.key, span: "month",
        lat: 29.4246, lon: -98.49514, tzOffsetMin: 300,
        natal, startAt: sc.start,
      });
      if (!r) continue;
      for (const w of r.windows) {
        const n = (w.families ?? []).length;
        allFamHist[n] = (allFamHist[n] ?? 0) + 1;
        for (const f of w.families ?? []) famUse[f] = (famUse[f] ?? 0) + 1;
        if (w.cappedBy) capped[w.cappedBy] = (capped[w.cappedBy] ?? 0) + 1;
        if (w.personal) personalWindows++;
        if (w.personalDecidedTier) personalDecided++;
        if (w.tier === "great") {
          great++; perAct[act.key] = (perAct[act.key] ?? 0) + 1;
          famHist[n] = (famHist[n] ?? 0) + 1;
          if (n < 2) greatOneFamily++;
        } else good++;
      }
    }
    reports[sc.name] = {
      scannedDays: 30, activities: ACTIVITIES.length,
      good, great,
      greatResolvingToFewerThanTwoFamilies: greatOneFamily,
      familyHistogramGreatOnly: famHist,
      familyHistogramAllWindows: allFamHist,
      familyUsage: famUse,
      wouldHaveBeenGreatButCapped: capped,
      windowsCarryingPersonalTestimony: personalWindows,
      windowsWherePersonalDecidedTier: personalDecided,
      activitiesProducingAnyGreat: Object.keys(perAct).length,
      perActivityGreat: perAct,
    };
    }
    // Written to a file rather than console.log: vitest swallows stdout under
    // some reporters, and a diagnostic you cannot read is not a diagnostic.
    mkdirSync("tools/out", { recursive: true });
    writeFileSync("tools/out/convergence-calibration.json", JSON.stringify(reports, null, 2));
    expect(Object.keys(reports).length).toBe(4);
    expect(reports["ordinary-month/with-chart"].good).toBeGreaterThan(0);
  }, 900_000);
});
