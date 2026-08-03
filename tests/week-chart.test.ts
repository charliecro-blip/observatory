import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The week chart drew one bar per day whose height mixed two unrelated things:
 * how full the Moon was, and how much aspect activity the day carried. That is
 * an ontological error, not a weighting error — the two are not alternate
 * measurements of the same substance, so no choice of weights makes the bar
 * mean something.
 *
 * The measured case that settled it (2026-08-02, NYC): Aug 10 carried the
 * HIGHEST structural pressure of the fortnight, 0.85, and was drawn as one of
 * the smallest bars, height 0.31. A reader planning around that chart would
 * have read the most demanding day of their fortnight as their emptiest.
 *
 * So the phenomena are now drawn separately: height = illumination, a lane
 * above = pressure, a word below = where in the making cycle the day sits.
 * These tests exist to keep them separate — the failure mode is someone later
 * "simplifying" them back into one number.
 */

const HARD_ASP = new Set(["conjunction", "square", "opposition"]);

/** The route's own derivation, reproduced against the same ephemeris. */
function dayOf(astro: any, date: Date) {
  const noonJd = astro.julianDay(new Date(date.getTime() + 12 * 3600000));
  const weather = astro.getMajorAspects(noonJd)
    .filter((a: any) => a.planet1 !== "Moon" && a.planet2 !== "Moon" && a.orb <= 1.5)
    .slice(0, 4)
    .map((a: any) => ({ hard: HARD_ASP.has(a.aspect), orb: a.orb }));
  const pressure = Math.min(1, weather
    .filter((w: any) => w.hard)
    .reduce((acc: number, w: any) => acc + (1 - w.orb / 1.5) * 0.5, 0));
  const phase = astro.moonPhase(noonJd);
  return { pressure, fraction: phase.fraction, phase };
}

describe("the two encodings measure different things", () => {
  let scan: Array<{ date: string; pressure: number; fraction: number }>;

  beforeAll(async () => {
    const astro: any = await import("../artifacts/api-server/src/lib/astro.js");
    scan = [];
    // A full lunar cycle plus change, so illumination covers its whole range.
    for (let d = 0; d < 40; d++) {
      const at = new Date(Date.UTC(2026, 7, 1 + d, 0, 0, 0));
      const { pressure, fraction } = dayOf(astro, at);
      scan.push({ date: at.toISOString().slice(0, 10), pressure, fraction });
    }
  }, 60_000);

  it("finds days that are structurally heavy AND lunar-dark", () => {
    // The exact combination the old single bar could not draw. If this ever
    // returns empty the scan has stopped being representative and the rest of
    // these assertions are not testing what they claim to.
    const heavyAndDark = scan.filter((d) => d.pressure >= 0.4 && d.fraction <= 0.45);
    expect(heavyAndDark.length, "no heavy+dark day in a 40-day scan").toBeGreaterThan(0);
  });

  it("reads a real illumination range — guards the correlation test below", () => {
    // Written after the correlation test passed against an all-zero column: I
    // had guessed the field name, every fraction came back undefined→0, and a
    // zero-variance series yields r = 0, which looks exactly like the result
    // the test wanted. A vacuous pass on the load-bearing assertion.
    const fs = scan.map((d) => d.fraction);
    expect(Math.max(...fs), "illumination never reaches full").toBeGreaterThan(0.9);
    expect(Math.min(...fs), "illumination never reaches new").toBeLessThan(0.1);
  });

  it("keeps pressure and illumination close to uncorrelated", () => {
    // The justification for two channels instead of one. If these tracked each
    // other, one bar really would have sufficed.
    const n = scan.length;
    const mp = scan.reduce((a, d) => a + d.pressure, 0) / n;
    const mf = scan.reduce((a, d) => a + d.fraction, 0) / n;
    let num = 0, dp = 0, df = 0;
    for (const d of scan) {
      num += (d.pressure - mp) * (d.fraction - mf);
      dp += (d.pressure - mp) ** 2;
      df += (d.fraction - mf) ** 2;
    }
    const r = num / Math.sqrt(dp * df || 1);
    expect(Math.abs(r), `|r| between pressure and illumination was ${r.toFixed(2)}`).toBeLessThan(0.5);
  });

  it("moves pressure across a real range rather than sitting flat", () => {
    // A channel that never varies is decoration. It must actually distinguish
    // days, or the lane should not be on screen at all.
    const ps = scan.map((d) => d.pressure);
    expect(Math.max(...ps)).toBeGreaterThan(0.4);
    expect(Math.min(...ps)).toBeLessThan(0.1);
  });
});

describe("approach names the cycle position, never an amount", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/routes/tides.ts"), "utf-8");

  it("maps every phase the engine can emit", async () => {
    // An unmapped phase silently falls back to "build", which would label a
    // waning day as a building one — the original error wearing a new hat.
    const astro: any = await import("../artifacts/api-server/src/lib/astro.js");
    const mapped = new Set(
      [...src.matchAll(/^\s*"([A-Z][A-Za-z ]+)":\s*"(initiate|build|refine|consolidate|release|recover)",/gm)]
        .map((m) => m[1]));
    expect(mapped.size).toBeGreaterThanOrEqual(8);
    const seen = new Set<string>();
    for (let d = 0; d < 60; d++) {
      const jd = astro.julianDay(new Date(Date.UTC(2026, 7, 1 + d, 12, 0, 0)));
      seen.add(astro.moonPhase(jd).name);
    }
    for (const p of seen) expect(mapped.has(p), `phase "${p}" has no approach`).toBe(true);
  });

  it("assigns waning phases a doing-word, not a deficit", () => {
    // "Waning Gibbous" must read as consolidate — something to DO — rather
    // than as a smaller quantity of whatever waxing had.
    expect(src).toMatch(/"Waning Gibbous":\s*"consolidate"/);
    expect(src).toMatch(/"Waning Crescent":\s*"recover"/);
    expect(src).toMatch(/"Full Moon":\s*"release"/);
    expect(src).toMatch(/"New Moon":\s*"initiate"/);
  });
});

describe("the summary matches the bars beneath it", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/routes/tides.ts"), "utf-8");

  it("derives the week's tone from approach, not from element alone", () => {
    // Caught on screen: every day was labelled "consolidate" while the caption
    // read "An active week. Energy is available for initiation" — because the
    // tone was keyed off the week's dominant ELEMENT and knew nothing about
    // the phase labels printed directly below it.
    expect(src).not.toMatch(/An active week\. Energy is available for initiation/);
    expect(src).toMatch(/APPROACH_TONE/);
    expect(src).toMatch(/weekApproach/);
  });

  it("reports pressure separately instead of averaging it into the tone", () => {
    expect(src).toMatch(/pressureNote/);
  });

  it("names the heaviest days, not the earliest three", () => {
    // A summary listing seven days has stopped summarising — but truncating
    // chronologically hid the heaviest day of a real month inside "and 4
    // more". Rank by pressure to choose, then re-sort by date to say.
    expect(src).toMatch(/\.sort\(\(a, b\) => b\.pressure - a\.pressure\)/);
    expect(src).toMatch(/\.slice\(0, 3\)/);
    expect(src).toMatch(/\.sort\(\(a, b\) => a\.date\.localeCompare\(b\.date\)\)/);
  });

  it("switches vocabulary for spans longer than a week", () => {
    // Two failures the week wording produced at month length: weekday names
    // repeat ("Mon, Sat, Mon"), and a modal approach across a full lunar cycle
    // is an artifact of where the window starts. Month spans name dates and
    // turning points instead, and drop the element claim — across 29 days the
    // Moon visits every sign, so "leaning fire" says nothing.
    expect(src).toMatch(/const isMonth = days\.length > 10/);
    expect(src).toMatch(/MONTH_ABBR/);
    expect(src).toMatch(/The cycle turns at/);
  });
});

describe("the client draws the phenomena apart", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/tides/src/components/TideWater.tsx"), "utf-8");

  /** The strip only — the day chart elsewhere in this file legitimately uses
   *  the tide scalar, so asserting against the whole file would be meaningless. */
  const strip = src.slice(src.indexOf("function WeekMonthStrip"),
                          src.indexOf("export function UnifiedTideChart"));

  it("takes bar height from illumination and nothing else", () => {
    // The load-bearing line. Asserting merely that "moonFraction" appears
    // somewhere would pass even if the height were `fraction * tide.energy`,
    // so this pins the actual height source and then rules the scalar out.
    expect(strip).toMatch(/const lunar = days\.map\(\(d\) => d\.moonFraction/);
    expect(strip).toMatch(/const h = heightOf\(lunar\[i\]\)/);
    // heightOf must be a function of its argument alone.
    expect(strip).toMatch(/const heightOf = \(f: number\) => [^;]*\bf \*/);
    // No path from the blended scalar into the geometry.
    expect(strip).not.toMatch(/heightOf\([^)]*(tide|energy|qualityScore|pressure)/);
    expect(strip).not.toMatch(/tide\?\.(energy|level|height)/);
  });

  it("gives pressure its own lane rather than folding it into height", () => {
    expect(strip).toMatch(/PRESSURE_H/);
    // The lane is drawn from PAD_T — the top of the chart — so it cannot move
    // the bar below it.
    expect(strip).toMatch(/y=\{PAD_T\}[^>]*height=\{PRESSURE_H\}/);
    // Element still colours the bar; that is a category, not a magnitude, so
    // it does not reintroduce a second quantity into the height.
    expect(strip).toMatch(/d\.tide\?\.element/);
  });
});
