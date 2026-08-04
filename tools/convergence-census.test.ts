import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";

/**
 * A CENSUS, not a best-of list — correcting a flaw in every prior measurement.
 *
 * All the earlier calibration used `span: "month"`. That path does not return
 * the month; it returns THE TOP 14 WINDOWS BY SCORE, one per day:
 *
 *     if (out.length >= (span === "week" ? 10 : 14)) break;
 *
 * So every convergence figure reported so far — 214, 240, 249, and the episode
 * counts derived from them — was computed on a pre-filtered highlight reel,
 * capped at 14 per activity regardless of what the sky did. Two consequences:
 *
 *  1. The frequency diagnostic that appeared to refute "lunar-contact is
 *     near-continuous" could not have detected it. Every family showed a max
 *     of exactly 14 days, which is the cap, not a finding.
 *  2. Measuring convergence RATE on a top-by-score list systematically
 *     overstates it, because the highest-scoring windows are exactly the ones
 *     carrying the most agreeing families.
 *
 * This walks day by day with `span: "day"`, which returns everything
 * chronologically and uncapped.
 */
describe("convergence census", () => {
  it("counts every window in a real month, uncapped", () => {
    const natal: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
    const PLACE = { lat: 29.4246, lon: -98.49514, tzOffsetMin: 300 };
    const DAYS = 30;
    const START = Date.UTC(2026, 9, 15, 12);

    // GUARD RAIL, added after a product-selection limit silently became a
    // scientific conclusion. `span: "month"` returns the top fourteen by score;
    // every cadence figure computed through it was a highlight reel presented
    // as a census. A measurement harness must therefore PROVE it evaluated what
    // it claims to have evaluated, rather than trusting the route it called.
    const daysEvaluated = new Set<string>();
    let activitiesEvaluated = 0;

    let supported = 0, convergent = 0, totalWindows = 0;
    const famDays: Record<string, Set<string>> = {};
    const convergentDaysPerAct: Record<string, Set<string>> = {};

    for (const act of ACTIVITIES) {
      activitiesEvaluated++;
      for (let d = 0; d < DAYS; d++) {
        const at = new Date(START + d * 86400000);
        const r = computeElections({ activityKey: act.key, span: "day", ...PLACE, natal, startAt: at } as any);
        if (!r) continue;
        daysEvaluated.add(at.toISOString().slice(0, 10));
        for (const w of r.windows) {
          totalWindows++;
          for (const f of w.families) (famDays[f] ??= new Set()).add(`${act.key}|${w.date}`);
          if (w.supportLevel === "convergent") {
            convergent++;
            (convergentDaysPerAct[act.key] ??= new Set()).add(w.date);
          } else supported++;
        }
      }
    }

    const actDayPairs = ACTIVITIES.length * DAYS;
    const famRate: Record<string, string> = {};
    for (const [f, set] of Object.entries(famDays)) {
      famRate[f] = `${set.size}/${actDayPairs} activity-days (${Math.round(100 * set.size / actDayPairs)}%)`;
    }
    const convDays = Object.values(convergentDaysPerAct).map(s => s.size);
    convDays.sort((a, b) => a - b);

    const result = {
      note: "span:'day' — uncapped. Prior figures used span:'month', which returns only the top 14 by score.",
      totalWindows, supported, convergent,
      convergentPct: Math.round((100 * convergent) / Math.max(totalWindows, 1)),
      activitiesEverConvergent: convDays.length,
      totalActivities: ACTIVITIES.length,
      medianConvergentDaysPerActivityPerMonth: convDays.length ? convDays[Math.floor(convDays.length / 2)] : 0,
      maxConvergentDaysPerActivityPerMonth: convDays.length ? convDays[convDays.length - 1] : 0,
      familyPresenceRate: famRate,
    };
    // Assert the shape of the sample BEFORE reporting any frequency from it.
    // A census that quietly evaluated 14 days is not a census.
    expect(activitiesEvaluated, "did not evaluate every activity").toBe(ACTIVITIES.length);
    expect(daysEvaluated.size, `evaluated ${daysEvaluated.size} distinct days, expected ${DAYS}`).toBe(DAYS);
    // And no activity may be capped at a suspiciously round selection limit.
    const perActivityMax = Math.max(...Object.values(convergentDaysPerAct).map(s => s.size), 0);
    expect(perActivityMax, "an activity hit exactly 14 — the month-span cap may be in play")
      .not.toBe(14);

    console.log(JSON.stringify(result, null, 1));
    mkdirSync("tools/out", { recursive: true });
    writeFileSync("tools/out/convergence-census.json", JSON.stringify(result, null, 2));
    expect(totalWindows).toBeGreaterThan(0);
  }, 3_600_000);
});
