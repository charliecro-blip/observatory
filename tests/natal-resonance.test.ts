import { describe, it, expect, afterEach } from "vitest";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { computeElections, supportLevelFrom, ENGINE_CALIBRATION } from "../artifacts/api-server/src/lib/electionEngine";
import { natalFrame, moonToNatal } from "../artifacts/api-server/src/lib/natalResonance";
import { moonLongitude, julianDay } from "../artifacts/api-server/src/lib/astro";
import { searchTiming } from "../artifacts/api-server/src/lib/timingSearch";
import { presentTiming } from "../artifacts/api-server/src/lib/timingPresentation";

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

  // 2026-10-05: duration searches and comparisons read the chart too.
  const sessions = (over: object, start = "2026-10-16T05:00:00Z", end = "2026-10-17T05:00:00Z") => presentTiming(searchTiming({
    activity: "haircut", start, end, timeZone: "America/Chicago", durationMinutes: 60, location: { lat: 30.1912, lon: -97.8028 }, ...over,
  } as any)).candidates as any[];

  it("a duration search leads with the hour around the lunar return, and says why", () => {
    const withChart = sessions({ natal: { chart: natal, timeKnown: true, birthDate: "1992-01-03" } });
    const top = withChart.find(c => c.evidence.tradeoff === "uninterrupted");
    expect(top.evidence.assessment.natalEvidence.some((t: string) => t.startsWith("The Moon returns to its place in your chart"))).toBe(true);
    const plain = sessions({});
    expect(plain.every(c => c.evidence.assessment.natalEvidence.length === 0)).toBe(true);
  });

  it("a duration search names a personal objection in words", () => {
    const r = sessions({ natal: { chart: natal, timeKnown: true, birthDate: "1992-01-03" } }, "2026-10-11T05:00:00Z", "2026-10-12T05:00:00Z");
    expect(r.length).toBeGreaterThan(0);
    for (const c of r) expect(c.reasons).toContain("Venus squares your natal Saturn");
  });

  it("a comparison reads the chart as well", () => {
    const r = presentTiming(searchTiming({
      activity: "haircut", start: "2026-10-16T05:00:00Z", end: "2026-10-17T05:00:00Z", timeZone: "America/Chicago",
      location: { lat: 30.1912, lon: -97.8028 }, natal: { chart: natal, timeKnown: true, birthDate: "1992-01-03" },
      durationMinutes: 60,
      // 12:00–1:00 PM Chicago holds the 12:26 PM return; 8–9 AM does not.
      candidateIntervals: [{ start: "2026-10-16T17:00:00Z", end: "2026-10-16T18:00:00Z" }, { start: "2026-10-16T13:00:00Z", end: "2026-10-16T14:00:00Z" }],
    } as any));
    expect(r.result.context.natal).toBe("applied");
    expect((r.candidates[0] as any).evidence.natalEvidence.some((t: string) => t.startsWith("The Moon returns"))).toBe(true);
    expect((r.candidates[1] as any).evidence.natalEvidence.some((t: string) => t.startsWith("The Moon returns"))).toBe(false);
  });

  // 2026-10-05: self-reported caution planets are objections (O5), by the
  // caution window's own definition: the Moon or Sun within 3° of a hard
  // aspect to the planet's natal place.
  it("counts a caution planet lit by the Moon against the windows it touches, once", () => {
    const withCaution = day("2026-10-11", { cautionPlanets: ["Saturn"] });
    const late = withCaution.windows.find(w => w.startClock === "8:56 PM")!;
    const texts = late.suitabilityReasons.flatMap(x => x.kind === "natal-objection" ? [x.text] : []);
    expect(texts).toContain("The Moon squares your natal Saturn, one of your caution planets, exact at 10:02 PM");
    // The plain malefic objection gives way to the caution, not both.
    expect(texts.some(t => t.startsWith("The Moon squares your natal Saturn at"))).toBe(false);
    // Five hours before exact the Moon is still inside 3°, so the afternoon
    // window counts it too; on a day the Moon makes no hard aspect to natal
    // Saturn (Oct 9, Moon in Libra) nothing is objected to.
    const afternoon = withCaution.windows.find(w => w.startClock === "12:01 PM")!;
    expect(afternoon.suitabilityReasons.some(x => x.kind === "natal-objection" && x.text.includes("caution"))).toBe(true);
    expect(objections(day("2026-10-09", { cautionPlanets: ["Saturn"] })).some(t => t.includes("caution"))).toBe(false);
    // Without caution planets the day reads as before.
    expect(objections(day("2026-10-11")).some(t => t.includes("caution"))).toBe(false);
  });

  it("reaches duration searches too", () => {
    const r = presentTiming(searchTiming({
      activity: "haircut", start: "2026-10-12T01:00:00Z", end: "2026-10-12T05:00:00Z", timeZone: "America/Chicago", durationMinutes: 60,
      location: { lat: 30.1912, lon: -97.8028 }, natal: { chart: natal, timeKnown: true, birthDate: "1992-01-03", cautionPlanets: ["Saturn"] },
    } as any)).candidates as any[];
    expect(r.length).toBeGreaterThan(0);
    expect(r.some(c => c.reasons.some((t: string) => t.includes("one of your caution planets")))).toBe(true);
  });
}, 120_000);
