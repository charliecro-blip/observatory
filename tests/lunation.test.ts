import { describe, it, expect } from "vitest";
import { illuminationAt, readLunation, lunationLine, SYNODIC_DAYS } from "../artifacts/tides/src/lib/lunation";

describe("illuminationAt", () => {
  it("is dark at new and lit at full", () => {
    expect(illuminationAt(0)).toBeCloseTo(0, 10);
    expect(illuminationAt(0.5)).toBeCloseTo(1, 10);
    expect(illuminationAt(1)).toBeCloseTo(0, 10);
  });

  it("is half lit at both quarters", () => {
    expect(illuminationAt(0.25)).toBeCloseTo(0.5, 10);
    expect(illuminationAt(0.75)).toBeCloseTo(0.5, 10);
  });

  it("matches the ephemeris rather than approximating it", () => {
    // Live reading 2026-08-25: elongation 155.79°, server moonFraction
    // 0.9560353758640101. The curve is drawn from geometry, so this pins that
    // the geometry is the same geometry.
    const fromElongation = (1 - Math.cos((155.79 * Math.PI) / 180)) / 2;
    expect(fromElongation).toBeCloseTo(0.9560353758640101, 4);
    expect(illuminationAt(155.79 / 360)).toBeCloseTo(fromElongation, 12);
  });

  it("is symmetric about full", () => {
    for (const p of [0.05, 0.17, 0.33, 0.48]) {
      expect(illuminationAt(p)).toBeCloseTo(illuminationAt(1 - p), 12);
    }
  });

  it("rises monotonically from new to full", () => {
    let prev = -1;
    for (let i = 0; i <= 50; i++) {
      const f = illuminationAt(i / 100);
      expect(f).toBeGreaterThan(prev);
      prev = f;
    }
  });
});

describe("readLunation", () => {
  it("returns null for a missing or unusable cycle instead of guessing a position", () => {
    expect(readLunation(undefined)).toBeNull();
    expect(readLunation(null)).toBeNull();
    expect(readLunation({} as any)).toBeNull();
    expect(readLunation({ position: NaN, waxing: true })).toBeNull();
  });

  it("reads the live 2026-08-25 cycle the way the server does", () => {
    const r = readLunation({ position: 0.4328, waxing: true, phase: "Waxing Gibbous" })!;
    expect(r.lit).toBeCloseTo(0.95609, 4);
    expect(r.dayOfCycle).toBe(13);
    expect(r.cycleLength).toBe(30);
    expect(r.daysToFull).toBe(2);
    expect(r.waxing).toBe(true);
  });

  it("counts forward to the NEXT full once full has passed", () => {
    // Not a negative number, and not the full that already happened.
    const r = readLunation({ position: 0.75, waxing: false })!;
    expect(r.daysToFull).toBe(Math.round(0.75 * SYNODIC_DAYS));
    expect(r.daysToFull).toBeGreaterThan(0);
    expect(r.daysToNew).toBe(Math.round(0.25 * SYNODIC_DAYS));
  });

  it("wraps a position outside the unit interval rather than drawing off the arc", () => {
    const a = readLunation({ position: 1.25, waxing: true })!;
    const b = readLunation({ position: 0.25, waxing: true })!;
    expect(a.position).toBeCloseTo(b.position, 12);
    expect(a.lit).toBeCloseTo(b.lit, 12);
  });

  it("starts the day count at 1, so a new moon is day 1 and never day 0", () => {
    expect(readLunation({ position: 0, waxing: true })!.dayOfCycle).toBe(1);
    expect(readLunation({ position: 0.999, waxing: false })!.dayOfCycle).toBe(30);
  });
});

describe("lunationLine", () => {
  const line = (position: number, waxing = true) => lunationLine(readLunation({ position, waxing })!);

  it("leads with the nearer turn", () => {
    expect(line(0.4328)).toContain("full in 2 days");
    expect(line(0.92, false)).toContain("new moon in 2 days");
  });

  it("says 'today' rather than counting zero days", () => {
    expect(line(0.5)).toContain("full today");
    expect(line(0.5)).not.toContain("0 day");
    // Both sides of the turn. Standing ON a new moon must not read as the
    // next one being a whole cycle away.
    expect(line(0.0, true)).toContain("new moon today");
    expect(line(0.999, false)).toContain("new moon today");
    expect(line(0.492, true)).toContain("full today");
  });

  it("makes the day singular when there is one", () => {
    const l = line(0.466);
    expect(l).toContain("full in 1 day");
    expect(l).not.toContain("1 days");
  });

  it("carries the cycle day and the percentage", () => {
    expect(line(0.4328)).toBe("Day 13 of 30 · 96% lit · full in 2 days");
  });

  it("names no outcome and gives no instruction", () => {
    for (let i = 0; i < 30; i++) {
      const l = line(i / 30, i / 30 < 0.5);
      expect(l, l).not.toMatch(/should|will |good time|best|avoid|perfect|lucky/i);
    }
  });
});
