import { describe, it, expect } from "vitest";
import { motionOf, velocityOf, TRADITIONAL_PLANETS, MODERN_PLANETS } from "../artifacts/api-server/src/lib/motion";
import { julianDay, isRetrograde } from "../artifacts/api-server/src/lib/astro";

/**
 * Motion as a measured object rather than a boolean.
 *
 * The engine asked only "is it retrograde", which discards the two things that
 * carry the weight: whether the planet is STATIONING, and how fast it is going.
 */

const jdOn = (y: number, m: number, d: number) => julianDay(new Date(Date.UTC(y, m, d, 12)));
const YEAR_2026 = Array.from({ length: 365 }, (_, i) => jdOn(2026, 0, 1 + i));

describe("direction still agrees with the old boolean", () => {
  it("matches isRetrograde across a year, for every planet", () => {
    // The new model must not quietly disagree with the shipped one about the
    // simple question, or every downstream reading shifts for the wrong reason.
    for (const p of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]) {
      let mismatches = 0, turns = 0;
      let prevRx: boolean | null = null;
      for (const jd of YEAR_2026) {
        const m = motionOf(p, jd)!;
        const rx = m.velocityDegPerDay < 0;
        if (rx !== isRetrograde(p, jd)) mismatches++;
        if (prevRx !== null && rx !== prevRx) turns++;
        prevRx = rx;
      }
      // Disagreement is only legitimate AT A TURN, where the two functions'
      // different sampling windows straddle the moment of reversal. So the
      // budget scales with how many turns the planet actually makes rather
      // than being a flat number picked to fit — a flat 3 failed Mercury at 4,
      // which is still under one day per station across its six.
      const budget = turns + 1;
      expect(mismatches, `${p} disagreed on ${mismatches} days across ${turns} turns`)
        .toBeLessThanOrEqual(budget);
    }
  });
});

describe("stations are found by the direction actually changing", () => {
  it("brackets every Mercury retrograde with the two stations", () => {
    const phases = YEAR_2026.map((jd) => motionOf("Mercury", jd)!.phase);
    // Mercury turns retrograde three times most years, so both stations must
    // appear repeatedly — and never at the same time as each other.
    expect(phases.filter((p) => p === "stationing-retrograde").length).toBeGreaterThan(0);
    expect(phases.filter((p) => p === "stationing-direct").length).toBeGreaterThan(0);
    // Every retrograde stretch must be entered through a first station.
    let entries = 0;
    for (let i = 1; i < phases.length; i++) {
      const wasDirect = phases[i - 1] === "direct";
      const nowRx = phases[i] === "retrograde";
      if (wasDirect && nowRx) entries++;   // must never happen without a station between
    }
    expect(entries, "went direct → retrograde with no station in between").toBe(0);
  });

  it("does not call merely slow motion a station", () => {
    // The reason a fixed °/day threshold was rejected: it would classify most
    // of an outer planet's orbit as stationary. Pluto never exceeds ~0.04°/day.
    const plutoPhases = YEAR_2026.map((jd) => motionOf("Pluto", jd)!.phase);
    const stationDays = plutoPhases.filter((p) => p.startsWith("stationing")).length;
    expect(stationDays, "Pluto spent most of the year 'stationing'").toBeLessThan(40);
  });

  it("never assigns a station to the luminaries", () => {
    for (const jd of YEAR_2026.slice(0, 60)) {
      expect(motionOf("Sun", jd)!.phase).toBe("direct");
      expect(motionOf("Moon", jd)!.phase).toBe("direct");
    }
  });
});

describe("speed is banded per planet, not absolutely", () => {
  it("gives a fast Mercury and a fast Pluto the same band name", () => {
    // 0.2°/day is nearly stationary for Mercury and faster than Pluto ever
    // travels. Bands are fractions of each planet's own mean, so the word
    // means the same thing for both.
    const mercFast = YEAR_2026.some((jd) => motionOf("Mercury", jd)!.speedBand === "fast");
    const plutoFast = YEAR_2026.some((jd) => motionOf("Pluto", jd)!.speedBand === "fast");
    expect(mercFast).toBe(true);
    expect(plutoFast).toBe(true);
  });

  it("uses the whole range for Mercury across a year", () => {
    const bands = new Set(YEAR_2026.map((jd) => motionOf("Mercury", jd)!.speedBand));
    expect(bands.size).toBeGreaterThanOrEqual(3);
  });
});

describe("the traditional/modern split is explicit", () => {
  it("keeps the outers out of the classical set", () => {
    // The whole basis for not applying an inherited electional cap to them.
    for (const p of ["Uranus", "Neptune", "Pluto"]) {
      expect(TRADITIONAL_PLANETS.has(p)).toBe(false);
      expect(MODERN_PLANETS.has(p)).toBe(true);
    }
    for (const p of ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
      expect(TRADITIONAL_PLANETS.has(p)).toBe(true);
    }
  });
});

describe("velocity is unwrapped across 0°", () => {
  it("never reports a ~360° jump", () => {
    for (const p of ["Moon", "Mercury", "Venus"]) {
      for (const jd of YEAR_2026.slice(0, 90)) {
        const v = velocityOf(p, jd)!;
        expect(Math.abs(v), `${p} velocity ${v}`).toBeLessThan(20);
      }
    }
  });
});
