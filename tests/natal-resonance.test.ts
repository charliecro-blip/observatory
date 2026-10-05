import { describe, it, expect, afterEach } from "vitest";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { computeElections, supportLevelFrom, ENGINE_CALIBRATION } from "../artifacts/api-server/src/lib/electionEngine";
import { natalFrame, moonToNatal } from "../artifacts/api-server/src/lib/natalResonance";
import { moonLongitude, julianDay } from "../artifacts/api-server/src/lib/astro";

// Plan Part A, Phase 1 (2026-10-04). Anchored to the owner's own chart and the
// haircut fortnight that exposed the gap: Cancer rising (the Moon rules the
// Ascendant), an 11th-house profection (Venus is lord of the year), the Moon's
// return on Oct 16, transiting Venus square natal Saturn Oct 11-15, and
// transiting Saturn square the natal Ascendant all fortnight.
const natal: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
const AUSTIN = { lat: 30.1912, lon: -97.8028, tzOffsetMin: 300, timeZone: "America/Chicago" };
const day = (date: string, over: object = {}) => computeElections({
  activityKey: "haircut", span: "day", ...AUSTIN, natal, timeKnown: true, birthDate: "1992-01-03",
  startAt: new Date(`${date}T05:00:00Z`), ...over,
} as any)!;
const lines = (r: ReturnType<typeof day>) => r.windows.flatMap(w => w.evidence.map(e => e.text));
const objections = (r: ReturnType<typeof day>) => r.windows.flatMap(w => w.suitabilityReasons.flatMap(x => x.kind === "natal-objection" ? [x.text] : []));

describe("natal resonance in elections", () => {
  afterEach(() => { ENGINE_CALIBRATION.personalCountsOnce = true; });

  it("reads the Moon's return, the chart ruler's hour and the year lord's day on Oct 16", () => {
    const r = day("2026-10-16");
    const all = lines(r);
    expect(all.some(t => /^The Moon returns to its place in your chart, exact at 12:2\d PM/.test(t))).toBe(true);
    expect(all).toContain("The Moon's hour, and the Moon rules your Ascendant");
    expect(all).toContain("Venus's day, and Venus is lord of your year (an 11th-house profection)");
    // The return is named once, not again as a conjunction to the natal Moon.
    expect(all.some(t => t.startsWith("The Moon conjoins your natal Moon"))).toBe(false);
  });

  it("objects to Venus squaring natal Saturn on the days it holds, and only those", () => {
    expect(objections(day("2026-10-11"))).toContain("Venus squares your natal Saturn");
    expect(objections(day("2026-10-14"))).toContain("Venus squares your natal Saturn");
    expect(objections(day("2026-10-17"))).not.toContain("Venus squares your natal Saturn");
  });

  it("states a slow contact once for the stretch instead of stamping every window", () => {
    // Saturn sits within 1° of the square to the natal Ascendant on Oct 9.
    const r = day("2026-10-09");
    expect(r.cautions).toContain("Saturn squares your natal Ascendant, a slow contact that holds through this stretch.");
    expect(objections(r).some(t => t.startsWith("Saturn"))).toBe(false);
  });

  it("never holds an objected window at the top tier", () => {
    for (const d of ["2026-10-09", "2026-10-11", "2026-10-14", "2026-10-16", "2026-10-17"])
      for (const w of day(d).windows)
        if (w.suitabilityReasons.some(x => x.kind === "natal-objection")) expect(w.tier, `${d} ${w.startClock}`).toBe("good");
  });

  it("lists each moment once", () => {
    for (const d of ["2026-10-09", "2026-10-11", "2026-10-16", "2026-10-17"]) {
      const spans = day(d).windows.map(w => `${w.startAt}|${w.endAt}`);
      expect(new Set(spans).size, d).toBe(spans.length);
    }
  });

  it("withholds every rule that needs the Ascendant when the birth time is unknown", () => {
    const all = [...lines(day("2026-10-16", { timeKnown: false })), ...objections(day("2026-10-16", { timeKnown: false }))].join("\n");
    for (const banned of [/rules your Ascendant/, /natal Ascendant/, /returns to its place/, /lord of your year/, / rises at /, / culminates at /, /is rising/])
      expect(all).not.toMatch(banned);
  });

  it("withholds the year's lord without a birth date", () => {
    expect(lines(day("2026-10-16", { birthDate: undefined })).join("\n")).not.toMatch(/lord of your year/);
  });

  it("adds nothing personal without a chart", () => {
    const r = day("2026-10-16", { natal: null });
    expect(r.windows.every(w => !w.personal)).toBe(true);
    expect(lines(r).join("\n")).not.toMatch(/your natal|your chart|your Ascendant|your year/);
  });

  it("counts the chart as one family toward convergence", () => {
    expect(supportLevelFrom(["natal-contact", "natal-resonance"] as any)).toBe("supported");
    expect(supportLevelFrom(["lunar-contact", "natal-resonance"] as any)).toBe("convergent");
    ENGINE_CALIBRATION.personalCountsOnce = false;
    expect(supportLevelFrom(["natal-contact", "natal-resonance"] as any)).toBe("convergent");
  });

  it("times the Moon's contacts with natal points to the minute", () => {
    const f = natalFrame(natal, ["Venus"], true);
    const evs = moonToNatal(f, Date.parse("2026-10-11T05:00:00Z"), Date.parse("2026-10-18T05:00:00Z"));
    expect(evs.length).toBeGreaterThan(5);
    const target: Record<string, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
    for (const ev of evs) {
      const natalLon = ev.target === "ASC" ? natal.ascendant.longitude : natal.planets.find((p: any) => p.planet === ev.target).longitude;
      const d = Math.abs(((moonLongitude(julianDay(new Date(ev.timeMs))) - natalLon) % 360 + 540) % 360 - 180);
      const off = Math.min(Math.abs(d - target[ev.aspect]), Math.abs(d - (360 - target[ev.aspect])));
      expect(off, `${ev.phrase} ${new Date(ev.timeMs).toISOString()}`).toBeLessThan(0.02); // ~2 minutes of Moon motion
    }
  });
}, 120_000);
