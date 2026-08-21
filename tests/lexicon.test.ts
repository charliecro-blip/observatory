import { describe, it, expect } from "vitest";
import { SIGNS, SIGN_ORDER } from "../lib/lexicon/src/signs.js";
import { SIGN_MYTHOS } from "../artifacts/tides/src/lib/mythos.js";
import { SIGN_INFLECTION } from "../artifacts/tides/src/lib/sky-readings.js";
import { SIGN_GUIDE } from "../artifacts/api-server/src/lib/interpretation.js";

/**
 * ONE VOICE PER SIGN. Four tables used to describe each sign in four voices;
 * this pins that they are now one record, read four ways.
 */
describe("the sign lexicon", () => {
  it("has twelve signs, each with every field", () => {
    expect(SIGN_ORDER).toHaveLength(12);
    for (const s of Object.values(SIGNS)) {
      for (const f of ["approach", "image", "inflection", "watch", "tideFeel"] as const) expect(s[f].length, `${s.key}.${f}`).toBeGreaterThan(10);
      expect(s.favors.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("approach lines are one clause with a hinge, no full stop, no em dash", () => {
    for (const s of Object.values(SIGNS)) {
      expect(s.approach, s.key).toMatch(/;|,/);
      expect(s.approach, s.key).not.toMatch(/\.$/);
      expect(s.approach, s.key).not.toMatch(/—/);
      expect(s.approach.split(" ").length, s.key).toBeLessThan(22);
    }
  });
  it("the client and the server read the same record", () => {
    for (const k of SIGN_ORDER) {
      expect(SIGN_MYTHOS[k].approach).toBe(SIGNS[k].approach);
      expect(SIGN_MYTHOS[k].favors).toEqual(SIGNS[k].favors);
      expect(SIGN_MYTHOS[k].shadow).toBe(SIGNS[k].watch);
      expect(SIGN_INFLECTION[k]).toBe(SIGNS[k].inflection);
      expect(SIGN_GUIDE[k].feel).toBe(SIGNS[k].inflection);
      expect(SIGN_GUIDE[k].favors).toEqual(SIGNS[k].favors.slice(0, 4));
    }
  });
  it("tide vocabulary stays in the tideFeel field", () => {
    for (const s of Object.values(SIGNS)) {
      expect(`${s.approach} ${s.inflection} ${s.watch}`, s.key).not.toMatch(/\b(surf|tide|slack water|fog|ocean|shallows|chop)\b/i);
    }
  });
});
