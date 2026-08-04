import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES, modeOf } from "../artifacts/api-server/src/lib/activityCorrespondences";

/**
 * WHERE does the permissiveness come from?
 *
 * The episode measurement put an ordinary October at 4–9.8 convergence
 * episodes per palette-week against a defensible one to three, with an episode
 * on all 30 days. The contract is not the suspect — it was just decided on
 * doctrinal grounds and should not be re-opened to hit a number. The suspect is
 * that an ESTABLISHING family fires far too often to be discriminating.
 *
 * Hypothesis: `lunar-contact` is near-continuous. The Moon makes roughly a
 * dozen aspects a day; an activity with two or three significators therefore
 * has a Moon contact almost every day, which makes "the Moon is applying to
 * this activity's significator" an ambient condition wearing an event's
 * clothes — exactly what the establishing/reinforcing split exists to prevent.
 *
 * This measures, per activity over a month: on how many DAYS does each family
 * appear at all. A family present on 25+ days out of 30 is not establishing
 * anything.
 */
describe("family frequency", () => {
  it("counts days per month each family fires, per activity", () => {
    const natal: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
    const START = new Date(Date.UTC(2026, 9, 15, 12));
    const dayCount: Record<string, number[]> = {};   // family -> per-activity day counts
    const perActivity: Record<string, Record<string, number>> = {};
    const sigCount: Record<string, number> = {};

    for (const act of ACTIVITIES) {
      const r = computeElections({
        activityKey: act.key, span: "month",
        lat: 29.4246, lon: -98.49514, tzOffsetMin: 300, natal, startAt: START,
      });
      if (!r) continue;
      sigCount[act.key] = Object.keys(act.planets).length;
      const daysWith: Record<string, Set<string>> = {};
      for (const w of r.windows) {
        for (const f of w.families) {
          (daysWith[f] ??= new Set()).add(w.date);
        }
      }
      perActivity[act.key] = {};
      for (const [f, days] of Object.entries(daysWith)) {
        (dayCount[f] ??= []).push(days.size);
        perActivity[act.key][f] = days.size;
      }
    }

    const summary: Record<string, any> = {};
    for (const [f, counts] of Object.entries(dayCount)) {
      counts.sort((a, b) => a - b);
      summary[f] = {
        activitiesWhereItAppears: counts.length,
        medianDaysPerMonth: counts[Math.floor(counts.length / 2)],
        maxDaysPerMonth: counts[counts.length - 1],
        appearsOn25PlusDaysFor: counts.filter(c => c >= 25).length,
      };
    }
    console.log(JSON.stringify(summary, null, 1));

    // Does significator count drive lunar-contact frequency?
    const pairs = Object.entries(perActivity)
      .map(([k, fams]) => ({ k, sigs: sigCount[k] ?? 0, lunar: fams["lunar-contact"] ?? 0 }))
      .filter(x => x.sigs > 0);
    const bySigs: Record<number, number[]> = {};
    for (const p of pairs) (bySigs[p.sigs] ??= []).push(p.lunar);
    const lunarBySigCount: Record<string, number> = {};
    for (const [n, arr] of Object.entries(bySigs)) {
      lunarBySigCount[`${n}-significators`] =
        parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
    }
    console.log("mean lunar-contact days/month by significator count:", JSON.stringify(lunarBySigCount));

    mkdirSync("tools/out", { recursive: true });
    writeFileSync("tools/out/family-frequency.json",
      JSON.stringify({ summary, lunarBySigCount, perActivity }, null, 2));
    expect(Object.keys(summary).length).toBeGreaterThan(0);
  }, 1_800_000);
});
