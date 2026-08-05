import { describe, it, expect } from "vitest";
import { an } from "../artifacts/api-server/src/lib/article.js";

const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const ASPECTS = ["conjunction","sextile","square","trine","opposition"];

describe("indefinite articles built from data", () => {
  // The two vowel signs are not obscure — the hero rendered "a Aries Moon"
  // whenever the Moon was in either, which is about a sixth of all days.
  it("says an Aries and an Aquarius", () => {
    expect(SIGNS.map(an).filter(s => s.startsWith("a A") || s.startsWith("a O") || s.startsWith("a I") || s.startsWith("a E") || s.startsWith("a U"))).toEqual([]);
    expect(an("Aries")).toBe("an Aries");
    expect(an("Aquarius")).toBe("an Aquarius");
    expect(an("Taurus")).toBe("a Taurus");
  });

  it("says an opposition", () => {
    expect(an("opposition")).toBe("an opposition");
    expect(ASPECTS.map(an).filter(s => /^a [aeiou]/.test(s))).toEqual([]);
  });
});
