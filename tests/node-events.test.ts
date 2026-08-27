import { describe, it, expect } from "vitest";
import { nodeTiming, nodeIngress } from "../artifacts/api-server/src/lib/nodeEvents";
import { computeQualifiers } from "../artifacts/api-server/src/lib/qualifiers";
import { voidOfCourse, julianDay, getPlanetPositions } from "../artifacts/api-server/src/lib/astro";

// Anchored, never the live sky — this repo has twice had a red suite that was
// the test reading whatever day it ran on.
const AT = new Date("2026-08-27T13:42:08Z");   // Moon Aqu 27.18°, true NN Aqu 29.94°
const JD = julianDay(AT);

describe("nodeTiming", () => {
  it("names the moment, not just the orb", () => {
    const t = nodeTiming(JD, "North");
    // Measured independently: separation 2.76° at AT, closing ~0.55°/hr.
    const hours = (Date.parse(t.exactAt) - AT.getTime()) / 3600000;
    expect(hours).toBeGreaterThan(4);
    expect(hours).toBeLessThan(6.5);
  });

  it("beats a mean-rate estimate, which is why it walks", () => {
    // A 4-hourly sample of this same morning put exactness near +4h; the true
    // minimum is past +5h. The Moon's speed varies by over a tenth across its
    // orbit, so dividing by an average is worth most of an hour of error.
    const t = nodeTiming(JD, "North");
    const hours = (Date.parse(t.exactAt) - AT.getTime()) / 3600000;
    expect(Math.abs(hours - 4)).toBeGreaterThan(0.75);
  });

  it("knows the Moon is still closing", () => {
    expect(nodeTiming(JD, "North").applying).toBe(true);
  });

  it("reports separating once she is past", () => {
    const after = julianDay(new Date(AT.getTime() + 9 * 3600000));
    expect(nodeTiming(after, "North").applying).toBe(false);
  });

  it("agrees with itself either side of exact", () => {
    // The instant found should not move as the sampling origin moves.
    const a = nodeTiming(julianDay(new Date(AT.getTime() - 2 * 3600000)), "North");
    const b = nodeTiming(julianDay(new Date(AT.getTime() + 2 * 3600000)), "North");
    expect(Math.abs(Date.parse(a.exactAt) - Date.parse(b.exactAt))).toBeLessThan(20 * 60 * 1000);
  });
});

describe("the qualifier carries the timing", () => {
  const qs = computeQualifiers(JD, getPlanetPositions(JD));
  const node = qs.find(q => q.key === "moon-north-node");

  it("still fires the way it always did", () => {
    expect(node).toBeTruthy();
    expect(node!.literal).toContain("Moon on the North Node");
    expect(node!.bodies).toEqual(["Moon"]);
  });

  it("now says when, and which way", () => {
    expect(node!.exactAt).toBeTruthy();
    expect(node!.applying).toBe(true);
  });

  it("sends an instant, never a formatted clock", () => {
    // The server runs in UTC in production and has told someone the wrong day
    // by formatting there before.
    expect(node!.exactAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(node!.literal).not.toMatch(/\d\s?(AM|PM)/i);
  });

  it("leaves the Sun's node meeting untimed", () => {
    // The Sun takes days over the same 3°; a clock reading would imply a
    // precision the event does not have.
    const sun = qs.find(q => q.key.startsWith("sun-") && q.key.endsWith("-node"));
    if (sun) expect(sun.exactAt).toBeUndefined();
  });
});

describe("a node does NOT end a void of course", () => {
  it("leaves the Moon void on the very morning she meets the node", () => {
    // The doctrinal point, pinned. A void ends when the Moon perfects a
    // further aspect to a PLANET before leaving her sign; the nodes have no
    // body and neither Lilly nor Bonatti counts them. If anyone ever adds a
    // node to VOC_PLANETS, this fails.
    expect(computeQualifiers(JD, getPlanetPositions(JD)).some(q => q.key === "moon-north-node")).toBe(true);
    expect(voidOfCourse(JD).voc).toBe(true);
  });
});

describe("nodeIngress", () => {
  it("finds the Pisces to Aquarius crossing near this date", () => {
    const g = nodeIngress(JD)!;
    expect(g.from).toBe("Pisces");
    expect(g.to).toBe("Aquarius");
    expect(g.daysAway).toBeLessThanOrEqual(0);
    expect(g.daysAway).toBeGreaterThan(-21);
  });

  it("is null through the long middle of a nodal transit", () => {
    // ~18 months per sign, so most dates have no crossing in the window.
    expect(nodeIngress(julianDay(new Date("2026-02-15T12:00:00Z")))).toBeNull();
  });

  it("uses the mean node, so one cusp is named once and not four times", () => {
    // The true node wobbled across Aquarius 30° repeatedly through August.
    const seen = new Set<string>();
    for (let d = 0; d < 30; d += 3) {
      const g = nodeIngress(julianDay(new Date(AT.getTime() - d * 86400000)));
      if (g) seen.add(`${g.from}->${g.to}`);
    }
    expect(seen.size).toBeLessThanOrEqual(1);
  });
});

describe("the plain wording", () => {
  const qs = computeQualifiers(JD, getPlanetPositions(JD));
  const node = qs.find(q => q.key === "moon-north-node")!;

  it("never says the Moon is on the Moon's node", () => {
    // One shared template produced exactly that, and the rail showed it.
    expect(node.plain).not.toMatch(/Moon is .*the Moon's/i);
    expect(node.plain).not.toContain("Moon's North Node");
  });

  it("glosses the node rather than naming its owner", () => {
    // `plain` is the slot that has to read without a glossary.
    expect(node.plain).toContain("the point where eclipses fall");
  });

  it("keeps the technical name in the literal, where it belongs", () => {
    expect(node.literal).toContain("North Node");
  });
});
