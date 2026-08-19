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
    // DOMAIN[target] and never looked at the aspect, so a trine and a square
    // produced identical copy.
    //
    // It deliberately does NOT pin particular wording. The theme prefers
    // Astrolyrica's written register for the shape (knowledge/
    // astrolyrica-sprints) and falls back to the composed mode line, so
    // asserting a prefix would just break the next time the copy improves —
    // which is exactly what happened when the tables landed. The invariant
    // is the one that matters: same pair, different aspect, different words.
    expect(spans.length).toBeGreaterThan(0);
    for (const s of spans) expect(s.theme.length).toBeGreaterThan(0);

    const byPair = new Map<string, Map<string, string>>();
    for (const s of spans) {
      const pair = `${s.transitPlanet}-${s.targetPlanet}`;
      if (!byPair.has(pair)) byPair.set(pair, new Map());
      byPair.get(pair)!.set(s.aspect, s.theme);
    }
    for (const [, byAspect] of byPair) {
      if (byAspect.size > 1) {
        expect(new Set(byAspect.values()).size).toBe(byAspect.size);
      }
    }
  });

  it("carries concrete, tally-able ideas for the windows the tables cover", () => {
    // The pair table is high-signal pairings only, so not every span has
    // ideas — but a span that has them must have usable ones, and they must
    // never carry the framing the brief ruled out.
    const withIdeas = spans.filter(s => (s.ideas?.length ?? 0) > 0);
    for (const s of withIdeas) {
      for (const idea of s.ideas) {
        expect(idea.length).toBeGreaterThan(3);
        expect(idea.toLowerCase()).not.toMatch(/day \d+ of \d+|don't break|streak/);
      }
    }
  });

  it("keys are stable identities: pair, aspect, peak date", () => {
    for (const s of spans) {
      expect(s.key).toBe(
        `${s.transitPlanet.toLowerCase()}-${s.aspect}-${s.targetPlanet.toLowerCase()}-${s.peakDate}`);
    }
  });
});
