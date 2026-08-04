import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES, modeOf } from "../artifacts/api-server/src/lib/activityCorrespondences";

/**
 * Variant B vs the old A: how much scarcity came from the category error?
 *
 * A (before) — any retrograde non-luminary significator caps GREAT.
 * B (now)    — only traditional significators, and only for inceptions.
 *
 * A is no longer runnable in-process, so the comparison is against the
 * recorded A figures from tools/out/convergence-calibration.json.
 */
describe("cap variant B", () => {
  it("measures the narrowed rule across two months", () => {
    const natal: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
    const MONTHS = [
      { name: "aug-eclipse", start: new Date(Date.UTC(2026, 7, 3, 12)) },
      { name: "oct-ordinary", start: new Date(Date.UTC(2026, 9, 15, 12)) },
    ];
    const out: any[] = [];
    for (const m of MONTHS) {
      let good = 0, great = 0;
      const byMode: Record<string, { good: number; great: number }> = {};
      const actsWithGreat = new Set<string>();
      for (const act of ACTIVITIES) {
        const mode = modeOf(act.key);
        byMode[mode] ??= { good: 0, great: 0 };
        const r = computeElections({
          activityKey: act.key, span: "month",
          lat: 29.4246, lon: -98.49514, tzOffsetMin: 300,
          natal, startAt: m.start,
        });
        if (!r) continue;
        for (const w of r.windows) {
          if (w.tier === "great") { great++; byMode[mode].great++; actsWithGreat.add(act.key); }
          else { good++; byMode[mode].good++; }
        }
      }
      out.push({
        month: m.name, variant: "B", good, great,
        activitiesWithGreat: actsWithGreat.size, totalActivities: ACTIVITIES.length,
        byMode,
      });
      console.log(`${m.name}: good=${good} great=${great} activitiesWithGreat=${actsWithGreat.size}/${ACTIVITIES.length}`);
      console.log(`   by mode: ${JSON.stringify(byMode)}`);
    }
    mkdirSync("tools/out", { recursive: true });
    writeFileSync("tools/out/cap-variant-b.json", JSON.stringify(out, null, 2));
    expect(out.length).toBe(2);
  }, 1_200_000);
});
