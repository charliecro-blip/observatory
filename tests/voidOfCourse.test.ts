import { describe, it, expect } from "vitest";
import { voidReading, LILLY_EXEMPT } from "../artifacts/api-server/src/lib/voidOfCourse.js";

const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

describe("void of course, by sign", () => {
  it("reads every sign, and says something different in each", () => {
    const feels = new Set<string>();
    for (const s of SIGNS) {
      const r = voidReading(s);
      expect(r, `no reading for ${s}`).toBeTruthy();
      feels.add(r!.feel);
      // Every void has something it IS good for. The counsel is
      // finish-don't-begin, never do-nothing — a card that only forbids is one
      // people learn to scroll past.
      expect(r!.instead.length).toBeGreaterThan(20);
    }
    expect(feels.size).toBe(12);
  });

  // Inherited doctrine, and the reason `benign` is a flag rather than a tone:
  // Lilly exempts exactly these four. A fifth appearing here is someone
  // editing on taste.
  it("marks exactly Lilly's four as benign", () => {
    expect([...LILLY_EXEMPT].sort()).toEqual(["Cancer","Pisces","Sagittarius","Taurus"]);
    expect(SIGNS.filter(s => voidReading(s)!.benign).sort()).toEqual(["Cancer","Pisces","Sagittarius","Taurus"]);
  });

  // The two checks that used to sit here grepped a word list — "don't|avoid|
  // never" — and called the result "does it scold". They flagged Cancer for
  // "people you don't have to perform for" (not a prohibition) and missed
  // Aries' "Start nothing you'd have to defend tomorrow" (exactly one). Same
  // defect as the aspect-copy verb list: vocabulary standing in for meaning.
  //
  // What IS mechanically true and worth guarding: a sign is on Lilly's list
  // for a reason, and the copy has to give the reader that reason. This
  // catches the actual risk — someone adding a fifth sign to LILLY_EXEMPT and
  // leaving prose that never explains why it is different.
  it("explains the exemption in each of the four exempt signs", () => {
    const silent = [...LILLY_EXEMPT].filter(s => !/Lilly|exempt/i.test(voidReading(s)!.feel));
    expect(silent).toEqual([]);
  });

  it("does not claim exemption in the eight that have none", () => {
    const overclaiming = SIGNS
      .filter(s => !LILLY_EXEMPT.has(s))
      .filter(s => /Lilly|exempt/i.test(voidReading(s)!.feel + voidReading(s)!.instead));
    expect(overclaiming).toEqual([]);
  });

  it("returns null rather than inventing a reading for a non-sign", () => {
    expect(voidReading("Ophiuchus")).toBeNull();
  });
});
