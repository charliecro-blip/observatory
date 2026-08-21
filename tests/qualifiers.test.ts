import { describe, it, expect } from "vitest";
import { julianDay, getPlanetPositions } from "../artifacts/api-server/src/lib/astro.js";
import { computeQualifiers } from "../artifacts/api-server/src/lib/qualifiers.js";

/**
 * ANCHORED to an instant, never the live sky (day-flaky-sky-tests): 2026-08-21
 * 18:30 UTC, measured with the engine the day the layer was written — Sun
 * 28.7° Leo on the South Node (29.8° Leo, 1.1°), nine days after the total
 * solar eclipse at 20° Leo, Mercury 6.1° from the Sun, Saturn retrograde,
 * Sun + Mercury + Jupiter in Leo.
 */
const AT = julianDay(new Date("2026-08-21T18:30:00Z"));
const qs = computeQualifiers(AT, getPlanetPositions(AT), { voc: false });
const keys = qs.map(q => q.key);

describe("qualifiers on 2026-08-21", () => {
  it("names the Sun on the South Node, with its orb", () => {
    const q = qs.find(x => x.key === "sun-south-node")!;
    expect(q).toBeTruthy();
    expect(q.literal).toMatch(/^Sun on the South Node · 1\.\d°$/);
    expect(q.bodies).toEqual(["Sun"]);          // one home: the Sun's, not the season's
  });
  it("knows it is an eclipse corridor, files it under the season, and ranks it above the node", () => {
    expect(keys[0]).toMatch(/^eclipse:/);
    expect(qs[0].bodies).toEqual(["season"]);
    expect(keys.indexOf("sun-south-node")).toBeLessThan(keys.indexOf("combust:Mercury"));
  });
  it("sees Mercury combust and Saturn retrograde and the Leo emphasis", () => {
    expect(keys).toContain("combust:Mercury");
    expect(keys).toContain("retrograde:Saturn");
    expect(keys).toContain("emphasis:Leo");
    expect(qs.find(x => x.key === "emphasis:Leo")!.literal).toBe("3 planets in Leo: Sun, Mercury, Jupiter");
  });
  it("every qualifier carries the fact twice and the approach once", () => {
    for (const q of qs) {
      expect(q.literal.length).toBeGreaterThan(3);
      expect(q.plain.length).toBeGreaterThan(3);
      expect(q.approach).toMatch(/;|,/);          // a clause with a hinge, never a slogan
      expect(q.approach).not.toMatch(/\.$/);      // the composer adds the full stop
      expect(["tradition", "compass"]).toContain(q.provenance);
    }
  });
  it("is sorted by salience, rarest first", () => {
    for (let i = 1; i < qs.length; i++) expect(qs[i - 1].salience).toBeGreaterThanOrEqual(qs[i].salience);
  });
  it("the void is a Moon qualifier that takes the sign's own feel", () => {
    const v = computeQualifiers(AT, getPlanetPositions(AT), { voc: true, vocFeel: "nothing settles the scale" }).find(x => x.key === "void")!;
    expect(v.bodies).toEqual(["Moon"]);
    expect(v.approach).toBe("nothing settles the scale");
  });
});
