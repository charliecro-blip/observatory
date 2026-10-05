import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";

/**
 * NATAL RESONANCE CALIBRATION (plan Part A, Phase 1; 2026-10-04).
 *
 * Opt-in like the other harnesses here (`npx vitest run --config
 * vitest.tools.config.ts tools/natal-resonance-calibration.test.ts`); several
 * minutes, so never part of `pnpm test`.
 *
 * Two questions, answered by measurement rather than taste:
 *
 *   1. FIRE RATE. How often does each rule fire, per chart-day (day rules) or
 *      per chart-day as events (timed rules)? A rule that fires on most days is
 *      a label, not a testimony, whatever the doctrine says about it.
 *   2. WHAT IT CHANGES. Across the same sample, how many windows, top-tier
 *      windows, personal windows and objection-capped windows exist with the
 *      rules off, with only the "personal counts once" collapse, with
 *      everything on, and with everything on except the day/hour rules (R1, R2),
 *      which are the ones most likely to inflate the top tier.
 *
 * Sample: eight charts of varied birth date, time and latitude; every other
 * activity (26); four ordinary weeks of 2026 chosen clear of eclipse seasons
 * (the convergence harness's first run was measured in one and was wrong).
 * Output: tools/out/natal-resonance-calibration.json.
 */
import { computeElections, ENGINE_CALIBRATION } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES, primarySignificatorsOf } from "../artifacts/api-server/src/lib/activityCorrespondences";
import {
  RESONANCE_RULES, natalFrame, dayContacts, moonToNatal, natalOnAngles, ownSignRising, yearLordOn, type RuleId,
} from "../artifacts/api-server/src/lib/natalResonance";
import { getPlanetPositions, julianDay, moonLongitude, sunLongitude, SIGNS } from "../artifacts/api-server/src/lib/astro";

const CHARTS: { birthDate: string; time: string; lat: number; lon: number; off: number }[] = [
  { birthDate: "1992-01-03", time: "17:37", lat: 29.4246, lon: -98.49514, off: -6 },   // owner
  { birthDate: "1985-04-22", time: "06:10", lat: 40.71, lon: -74.0, off: -4 },
  { birthDate: "1978-08-09", time: "13:45", lat: 51.5, lon: -0.12, off: 1 },
  { birthDate: "2001-11-30", time: "22:05", lat: 35.68, lon: 139.69, off: 9 },
  { birthDate: "1969-06-15", time: "03:30", lat: -33.87, lon: 151.2, off: 10 },
  { birthDate: "1995-02-11", time: "11:20", lat: 19.43, lon: -99.13, off: -6 },
  { birthDate: "1988-09-27", time: "19:55", lat: 59.33, lon: 18.07, off: 2 },
  { birthDate: "1999-12-24", time: "08:40", lat: 28.61, lon: 77.21, off: 5.5 },
];
const WEEKS = ["2026-01-12", "2026-04-13", "2026-06-15", "2026-10-12"];
const PLACE = { lat: 30.19, lon: -97.8, tzOffsetMin: 300, timeZone: "America/Chicago" };
const ACTS = ACTIVITIES.filter((_, i) => i % 2 === 0);
const ALL: RuleId[] = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "O1", "O2", "O3", "O4"];

const days = WEEKS.flatMap(w => Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${w}T05:00:00Z`) + i * 86400000)));
const charts = CHARTS.map(c => ({ ...c, natal: computeNatalChart(c.birthDate, c.time, c.lat, c.lon, c.off, "whole-sign") as any }));

function setRules(on: Partial<Record<RuleId, boolean>>, countsOnce: boolean) {
  for (const r of ALL) RESONANCE_RULES[r] = on[r] ?? false;
  ENGINE_CALIBRATION.personalCountsOnce = countsOnce;
}

function tally() {
  let windows = 0, great = 0, personal = 0, natalCapped = 0, withObjection = 0, personalDecided = 0;
  // Day outermost: the engine's per-day caches hold 16 days, and walking 28
  // days inside each activity evicted them on every call (a first run took
  // ~85 minutes instead of ~25).
  for (const d of days) for (const c of charts) for (const a of ACTS) {
    const r = computeElections({ activityKey: a.key, span: "day", ...PLACE, natal: c.natal, timeKnown: true, birthDate: c.birthDate, startAt: d } as any);
    if (!r) continue;
    for (const w of r.windows) {
      windows++;
      if (w.tier === "great") great++;
      if (w.personal) personal++;
      if (w.personalDecidedTier) personalDecided++;
      if (w.cappedBy === "natal-objection") natalCapped++;
      if (w.suitabilityReasons.some(x => x.kind === "natal-objection")) withObjection++;
    }
  }
  return { windows, great, greatShare: +(great / Math.max(1, windows)).toFixed(3), personal, personalDecided, withObjection, natalCapped };
}

describe("natal resonance calibration", () => {
  it("measures each rule's fire rate and what the rules change", () => {
    // ── 1. Fire rates, straight from the module, per chart-day ──────────────
    setRules(Object.fromEntries(ALL.map(r => [r, true])), true);
    const fire: Record<string, number> = Object.fromEntries(ALL.map(r => [r, 0]));
    const standing: Record<string, number> = {};
    const chartDays = charts.length * days.length;
    for (const c of charts) {
      // The activity matters only through its significators; Venus-ruled
      // (haircut) stands in for a typical single-significator activity.
      const sig = primarySignificatorsOf("haircut", ACTIVITIES.find(a => a.key === "haircut")!.planets);
      const f = natalFrame(c.natal, sig, true);
      for (const d of days) {
        const noon = new Date(+d + 12 * 3600000);
        const jd = julianDay(noon);
        const pos = getPlanetPositions(jd);
        const lonOf = (p: string) => p === "Sun" ? sunLongitude(jd) : p === "Moon" ? moonLongitude(jd)
          : (() => { const x = pos.find(y => y.planet === p); return x ? SIGNS.indexOf(x.sign) * 30 + x.degree : null; })();
        const dow = noon.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" });
        const ruler = { Sun: "Sun", Mon: "Moon", Tue: "Mars", Wed: "Mercury", Thu: "Jupiter", Fri: "Venus", Sat: "Saturn" }[dow];
        if (f.chartRuler === ruler) fire.R1++;
        if (yearLordOn(f, c.birthDate, noon)?.lord === ruler) fire.R2++;
        const dc = dayContacts(f, sig, lonOf);
        for (const x of new Set(dc.supports.map(s => s.rule))) fire[x]++;
        for (const x of new Set(dc.objections.map(s => s.rule))) fire[x]++;
        for (const x of dc.standing) standing[x.rule] = (standing[x.rule] ?? 0) + 1;
        for (const ev of moonToNatal(f, +d, +d + 24 * 3600000)) fire[ev.rule]++;
        const dayStart = +d;
        for (const x of natalOnAngles(f, dayStart, PLACE.lat, PLACE.lon)) fire[x.rule]++;
        if (ownSignRising(f, dayStart, PLACE.lat, PLACE.lon).length) fire.R8++;
      }
    }
    const perChartDay = Object.fromEntries(Object.entries(fire).map(([k, v]) => [k, +(v / chartDays).toFixed(2)]));

    // ── 2. What the rules change ────────────────────────────────────────────
    const on = Object.fromEntries(ALL.map(r => [r, true])) as Record<RuleId, boolean>;
    const scenarios: Record<string, ReturnType<typeof tally>> = {};
    setRules({}, false); scenarios["rules off (before Phase 1)"] = tally();
    setRules({}, true); scenarios["rules off, personal counts once"] = tally();
    setRules(on, true); scenarios["all rules on"] = tally();
    setRules({ ...on, R1: false, R2: false }, true); scenarios["all on except R1/R2 (personal day and hour)"] = tally();
    setRules({ ...on, O1: false, O2: false, O3: false, O4: false }, true); scenarios["supports only"] = tally();
    setRules(on, true);

    const report = {
      sample: { charts: charts.length, activities: ACTS.length, days: days.length, chartDays },
      firePerChartDay: perChartDay,
      standingContactsPerChartDay: Object.fromEntries(Object.entries(standing).map(([k, v]) => [k, +(v / chartDays).toFixed(2)])),
      scenarios,
    };
    mkdirSync("tools/out", { recursive: true });
    writeFileSync("tools/out/natal-resonance-calibration.json", JSON.stringify(report, null, 2));
    expect(scenarios["all rules on"].windows).toBeGreaterThan(0);
  }, 3_600_000);
});
