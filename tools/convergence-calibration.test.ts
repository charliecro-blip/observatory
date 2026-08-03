import { describe, it, expect } from "vitest";

/**
 * CONVERGENCE CALIBRATION HARNESS.
 *
 * Skipped by default and kept out of tests/ on purpose: it takes ~170s, and
 * Railway's deploy runs `pnpm test` before building. Run it deliberately:
 *
 *     npx vitest run --dir tools
 *
 * Why it exists: thresholds for a tier like "great" must come from a measured
 * distribution, not from taste — the same discipline that fixed the lead
 * module, where a hand-picked floor sat below every sample in a 240-moment
 * scan and made "quiet" unreachable.
 *
 * First run, 2026-08-03 — Charlie's chart, San Antonio, 30 days, all
 * activities. It inverted the assumption the redesign was being planned on:
 *
 *     good  = 635
 *     great = 9
 *     GREAT windows resolving to <2 distinct source families = 0
 *     distinct-family histogram for GREAT = {3: 9}
 *     activities producing any GREAT = 8 of 46
 *
 * So the risk is NOT convergence inflation. It is convergence STARVATION:
 * across a whole month and every activity, "great" fires nine times, and
 * 38 of 46 activities never converge at all. A Compass centred on that tier
 * would usually have nothing to show.
 *
 * It also settles the double-counting question empirically. `greatSignals`
 * is computed from `daySources.length` BEFORE the emit-time dedupe, and three
 * separate branches push the literal "natal" — so the tier CAN be reached by
 * one family counted twice. On this sample it never was: every great window
 * carried exactly three distinct families. A latent bug, not an active one —
 * still worth fixing before the tier is promoted, because promotion changes
 * the exposure, but it is not currently mis-tiering anything.
 */
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";

describe.skip("convergence calibration harness — opt in with --dir tools", () => {
  it("measures tier scarcity and family independence", () => {
    const natal: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
    let good = 0, great = 0, greatOneFamily = 0;
    const perAct: Record<string, number> = {};
    const famHist: Record<number, number> = {};
    for (const act of ACTIVITIES) {
      const r = computeElections({
        activityKey: act.key, span: "month",
        lat: 29.4246, lon: -98.49514, tzOffsetMin: 300,
        natal, startAt: new Date(Date.UTC(2026, 7, 3, 12, 0, 0)),
      });
      if (!r) continue;
      for (const w of r.windows) {
        if (w.tier === "great") {
          great++; perAct[act.key] = (perAct[act.key] ?? 0) + 1;
          const n = new Set(w.sources ?? []).size;
          famHist[n] = (famHist[n] ?? 0) + 1;
          if (n < 2) greatOneFamily++;
        } else good++;
      }
    }
    console.log(`WINDOWS over 30 days x ${ACTIVITIES.length} activities: good=${good} great=${great}`);
    console.log(`GREAT resolving to <2 distinct families: ${greatOneFamily}`);
    console.log(`distinct-family histogram for GREAT:`, JSON.stringify(famHist));
    console.log(`activities producing any GREAT: ${Object.keys(perAct).length} of ${ACTIVITIES.length}`);
    console.log(`top:`, JSON.stringify(Object.entries(perAct).sort((a,b)=>b[1]-a[1]).slice(0,6)));
    expect(great + good).toBeGreaterThan(0);
  }, 300_000);
});
