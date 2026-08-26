import { describe, it, expect } from "vitest";
import { planForCrossing, blockForCrossing, HALF_WINDOW_MIN } from "../artifacts/tides/src/lib/crossingPlans";

describe("planForCrossing", () => {
  it("covers the seven visible planets and nothing else", () => {
    for (const p of ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"]) {
      expect(planForCrossing(p), p).not.toBeNull();
    }
  });

  it("returns null for an outer planet rather than inventing a small activity", () => {
    // A 26-minute Pluto block is not a thing anyone can act on, and a generic
    // fallback would put words in the sky's mouth.
    for (const p of ["Uranus","Neptune","Pluto","Chiron",""]) {
      expect(planForCrossing(p), p).toBeNull();
    }
  });

  it("stays in the small register the window can actually hold", () => {
    // The owner's ask was "small activities (breaks, pace changes)", against
    // AngleCrossing's larger table ("a hard workout", "the big ask, teaching").
    // Nothing here should promise something that needs an afternoon.
    const big = /workout|teaching|campaign|launch|presentation|retreat/i;
    for (const p of ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"]) {
      expect(planForCrossing(p)!.what, p).not.toMatch(big);
    }
  });

  it("gives every plan a title short enough to read in a day column", () => {
    for (const p of ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"]) {
      expect(planForCrossing(p)!.title.length, p).toBeLessThanOrEqual(20);
    }
  });

  it("only uses window types Calendar actually offers", () => {
    const TYPES = ["deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat"];
    for (const p of ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"]) {
      expect(TYPES, p).toContain(planForCrossing(p)!.type);
    }
  });
});

describe("blockForCrossing", () => {
  // 14:00 local on a fixed date, built locally so the assertions hold in any
  // timezone the suite runs under.
  const at = new Date(2026, 7, 25, 14, 0, 0).toISOString();

  it("centers the block on the moment of exactness", () => {
    // Not started-at: the approach counts as much as the separation, so a
    // block beginning at exact spends half its length after the window shuts.
    const b = blockForCrossing("Mars", "Ascendant", at)!;
    expect(b.startTime).toBe("13:47");
    expect(b.endTime).toBe("14:13");
  });

  it("is the full window wide, not half of it", () => {
    const b = blockForCrossing("Venus", "Midheaven", at)!;
    const mins = (t: string) => Number(t.slice(0,2))*60 + Number(t.slice(3));
    expect(mins(b.endTime) - mins(b.startTime)).toBe(HALF_WINDOW_MIN * 2);
  });

  it("carries the title and type from the plan", () => {
    const b = blockForCrossing("Saturn", "Descendant", at)!;
    expect(b.title).toBe(planForCrossing("Saturn")!.title);
    expect(b.type).toBe(planForCrossing("Saturn")!.type);
  });

  it("notes the fact and its width, and promises no outcome", () => {
    const b = blockForCrossing("Mercury", "Ascendant", at)!;
    expect(b.notes).toContain("Mercury crosses your Ascendant");
    expect(b.notes).toContain(`${HALF_WINDOW_MIN * 2} minutes wide`);
    expect(b.notes).not.toMatch(/will |should |guarantee|best time|perfect/i);
  });

  it("returns null for a planet with no plan", () => {
    expect(blockForCrossing("Neptune", "Ascendant", at)).toBeNull();
  });

  it("returns null for an unparseable instant instead of guessing a time", () => {
    expect(blockForCrossing("Mars", "Ascendant", "not a date")).toBeNull();
    expect(blockForCrossing("Mars", "Ascendant", "")).toBeNull();
  });

  it("pads to HH:MM so the time inputs accept it", () => {
    const early = new Date(2026, 7, 25, 9, 5, 0).toISOString();
    const b = blockForCrossing("Moon", "Ascendant", early)!;
    expect(b.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(b.endTime).toMatch(/^\d{2}:\d{2}$/);
    expect(b.startTime).toBe("08:52");
  });
});
