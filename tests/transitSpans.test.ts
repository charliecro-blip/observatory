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

  it("reads the ASPECT, not just the planet pair", () => {
    // The defect this pins: themeFor() concatenated PUSH[transiting] +
    // DOMAIN[target] and never looked at the aspect, so a trine and a
    // square produced identical copy. Every theme must now open with the
    // mode the aspect's own shape contributes.
    const MODES = [
      "a good stretch to begin something",
      "an easy opening, if you want it",
      "friction worth using",
      "a stretch that should run smoothly",
      "a stretch that asks for the other side of something",
    ];
    expect(spans.length).toBeGreaterThan(0);
    for (const s of spans) {
      expect(MODES.some(m => s.theme.startsWith(m))).toBe(true);
    }
    // And two spans over the SAME pair with different aspects must differ.
    const byPair = new Map<string, Set<string>>();
    for (const s of spans) {
      const pair = `${s.transitPlanet}-${s.targetPlanet}`;
      if (!byPair.has(pair)) byPair.set(pair, new Set());
      byPair.get(pair)!.add(`${s.aspect}|${s.theme}`);
    }
    for (const [, variants] of byPair) {
      const aspects = new Set([...variants].map(v => v.split("|")[0]));
      const themes = new Set([...variants].map(v => v.split("|")[1]));
      if (aspects.size > 1) expect(themes.size).toBeGreaterThan(1);
    }
  });

  it("keys are stable identities: pair, aspect, peak date", () => {
    for (const s of spans) {
      expect(s.key).toBe(
        `${s.transitPlanet.toLowerCase()}-${s.aspect}-${s.targetPlanet.toLowerCase()}-${s.peakDate}`);
    }
  });
});
