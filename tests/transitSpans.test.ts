import { describe, it, expect } from "vitest";
import { transitSpans } from "../artifacts/api-server/src/lib/transitSpans";

/**
 * Week-scale transit spans (owner 2026-08-18). Anchored to a FIXED sky —
 * the day-flaky lesson: a test that reads the live ephemeris inherits the
 * weather of whichever day it runs on.
 *
 * These pin the module's CLAIMS, not particular aspects: the shape of a
 * span, the bounds that make it sprint-scale, and the exclusions that keep
 * it honest (no Moon, no season-length windows, nothing already over).
 */

const ANCHOR = new Date("2026-08-18T18:00:00Z");
const TZ = 300; // a Chicago-ish viewer

describe("transit spans", () => {
  const spans = transitSpans({ tzOffsetMin: TZ, now: ANCHOR });

  it("finds week-scale windows at all", () => {
    // Five fast planets against nine targets across five weeks of scan —
    // an empty answer would mean the detector, not the sky, is quiet.
    expect(spans.length).toBeGreaterThan(0);
  });

  it("every span is transited by a fast planet, and never involves the Moon", () => {
    const FAST = new Set(["Sun", "Mercury", "Venus", "Mars", "Jupiter"]);
    for (const s of spans) {
      expect(FAST.has(s.transitPlanet)).toBe(true);
      expect(s.transitPlanet).not.toBe("Moon");
      expect(s.targetPlanet).not.toBe("Moon");
    }
  });

  it("every window is sprint-scale and internally ordered", () => {
    for (const s of spans) {
      expect(s.days).toBeGreaterThanOrEqual(1);
      expect(s.days).toBeLessThanOrEqual(21);
      expect(s.startDate <= s.peakDate).toBe(true);
      expect(s.peakDate <= s.endDate).toBe(true);
    }
  });

  it("offers nothing that is already over", () => {
    const today = new Date(ANCHOR.getTime() - TZ * 60000).toISOString().slice(0, 10);
    for (const s of spans) expect(s.endDate >= today).toBe(true);
  });

  it("marks active spans as the ones containing today", () => {
    const today = new Date(ANCHOR.getTime() - TZ * 60000).toISOString().slice(0, 10);
    for (const s of spans) {
      expect(s.active).toBe(s.startDate <= today && today <= s.endDate);
    }
  });

  it("is deterministic for a fixed anchor", () => {
    const again = transitSpans({ tzOffsetMin: TZ, now: ANCHOR });
    expect(again.map(s => s.key)).toEqual(spans.map(s => s.key));
  });

  it("carries a conditions theme, never an outcome promise", () => {
    for (const s of spans) {
      expect(s.theme.length).toBeGreaterThan(0);
      // The describe-conditions-never-promise rule, pinned at the vocabulary
      // level: no "will", no "you'll", no guarantees.
      expect(s.theme.toLowerCase()).not.toMatch(/\bwill\b|\byou'll\b|guarantee/);
    }
  });

  it("keys are stable identities: pair, aspect, peak date", () => {
    for (const s of spans) {
      expect(s.key).toBe(
        `${s.transitPlanet.toLowerCase()}-${s.aspect}-${s.targetPlanet.toLowerCase()}-${s.peakDate}`);
    }
  });
});
