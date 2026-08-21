import { describe, it, expect } from "vitest";
import { promptsFor } from "../artifacts/tides/src/components/LogComposer";

/**
 * The Log's questions have to come from the day, or they're wallpaper.
 *
 * The point of the prompt bank is that the FIRST thing asked knows something
 * about the day you're looking at — how much you logged, what the sky was
 * doing, which planet the Moon hit. A generic question is the fallback, never
 * the opener when the day has something to say.
 *
 * Also pinned: the rotation is a function of the date, not of when you opened
 * the page. Coming back to Tuesday should ask Tuesday's question again.
 */
describe("promptsFor", () => {
  const base = { date: "2026-08-19", ledgerCount: 0, element: null, flavors: null };

  it("asks about the record first when the day has one", () => {
    const p = promptsFor({ ...base, ledgerCount: 3 });
    expect(p[0]).toBe("Of the 3 things you logged, which one actually mattered?");
  });

  it("asks what happened at all when the day is empty", () => {
    const p = promptsFor({ ...base, ledgerCount: 0 });
    expect(p[0]).toBe("Nothing's on Wednesday yet. What did you actually do?");
  });

  it("says nothing about the count when a single thing is logged", () => {
    // "Of the 1 things you logged" — and asking which of one mattered is a
    // question with one answer.
    const p = promptsFor({ ...base, ledgerCount: 1 });
    expect(p[0]).not.toMatch(/you logged|Nothing's on/);
  });

  it("reads the day's element in plain words", () => {
    const p = promptsFor({ ...base, ledgerCount: 1, element: "water" });
    expect(p[0]).toBe("Did Wednesday feel as deep from the inside as the sky read it?");
  });

  it("names the planet the Moon met", () => {
    const p = promptsFor({ ...base, ledgerCount: 1, flavors: ["Mercury", "Saturn"] });
    expect(p[0]).toBe("Mercury was in that day; where did you meet it?");
  });

  it("keeps day-derived questions ahead of general ones", () => {
    const p = promptsFor({ date: "2026-08-19", ledgerCount: 4, element: "fire", flavors: ["Mars"] });
    expect(p.slice(0, 3)).toEqual([
      "Of the 4 things you logged, which one actually mattered?",
      "Did Wednesday feel as hot from the inside as the sky read it?",
      "Mars was in that day; where did you meet it?",
    ]);
  });

  it("asks the same day the same question every time it's opened", () => {
    const a = promptsFor(base);
    const b = promptsFor(base);
    expect(a).toEqual(b);
  });

  it("gives different days different general questions", () => {
    const a = promptsFor({ ...base, date: "2026-08-19", ledgerCount: 1 });
    const b = promptsFor({ ...base, date: "2026-08-20", ledgerCount: 1 });
    expect(a[0]).not.toBe(b[0]);
  });

  it("always leaves something to ask", () => {
    expect(promptsFor(base).length).toBeGreaterThan(5);
  });

  it("survives a date it can't parse", () => {
    // A NaN seed indexed the general bank with NaN and filled the list with
    // undefined — a blank question rather than a thrown one, which is worse.
    const p = promptsFor({ ...base, date: "not-a-date" });
    expect(p.every((q) => typeof q === "string" && q.length > 0)).toBe(true);
  });
});
