import { describe, it, expect } from "vitest";
import { planetInSign, GENERATIONAL } from "../artifacts/api-server/src/lib/planetInSign.js";

const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const CLASSICAL = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"];
const mid = (i: number) => i * 30 + 15;

describe("planet-in-sign copy", () => {
  it("covers all 84 classical placements", () => {
    const missing: string[] = [];
    for (const p of CLASSICAL) for (let i = 0; i < 12; i++) {
      if (!planetInSign(p, mid(i), true)) missing.push(`${p} in ${SIGNS[i]}`);
    }
    expect(missing).toEqual([]);
  });

  // A duplicated line means a placement was pasted rather than written, and the
  // reader would be told the same thing about two different skies. This is the
  // check that would have caught filling the table by generation.
  it("says something different for every placement", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const p of CLASSICAL) for (let i = 0; i < 12; i++) {
      const r = planetInSign(p, mid(i), true)!;
      for (const text of [r.does, r.misses]) {
        const where = `${p} in ${SIGNS[i]}`;
        if (seen.has(text)) dupes.push(`"${text}" — ${seen.get(text)} and ${where}`);
        else seen.set(text, where);
      }
    }
    expect(dupes).toEqual([]);
    expect(seen.size).toBe(84 * 2);
  });

  // Dignity is inherited doctrine, and it comes from lib/dignity — this asserts
  // the wiring, so a refactor there cannot silently start labelling the Sun in
  // Libra as exalted.
  it("labels the classical dignities correctly", () => {
    const at = (sign: string) => mid(SIGNS.indexOf(sign));
    expect(planetInSign("Sun", at("Leo"), true)!.dignity).toBe("domicile");
    expect(planetInSign("Sun", at("Aquarius"), true)!.dignity).toBe("detriment");
    expect(planetInSign("Sun", at("Libra"), true)!.dignity).toBe("fall");
    expect(planetInSign("Mars", at("Capricorn"), true)!.dignity).toBe("exaltation");
    expect(planetInSign("Venus", at("Virgo"), true)!.dignity).toBe("fall");
    expect(planetInSign("Saturn", at("Libra"), true)!.dignity).toBe("exaltation");
  });

  // Peregrine is the ordinary case; labelling it would bury the four that
  // matter. Assert it actually stays null for a plain placement AND that the
  // labelled ones are a minority — a table that labelled everything would pass
  // the test above while defeating its purpose.
  it("leaves the ordinary case unlabelled", () => {
    expect(planetInSign("Mercury", mid(SIGNS.indexOf("Leo")), true)!.dignity).toBeNull();
    let labelled = 0;
    for (const p of CLASSICAL) for (let i = 0; i < 12; i++) {
      if (planetInSign(p, mid(i), true)!.dignity) labelled++;
    }
    expect(labelled).toBeGreaterThan(0);
    expect(labelled).toBeLessThan(42);   // fewer than half of 84
  });

  it("refuses to write daily copy for generational placements", () => {
    for (const p of GENERATIONAL) {
      const r = planetInSign(p, mid(3), true)!;
      expect(r.generational).toBe(true);
      expect(r.does).toMatch(/years/);
    }
  });

  it("returns null rather than inventing a reading for a non-planet", () => {
    expect(planetInSign("North Node", mid(0), true)).toBeNull();
  });
});
