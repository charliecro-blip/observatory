import { describe, expect, it } from "vitest";
import { moonLine } from "../artifacts/tides/src/lib/moonLine";

const fmtTime = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
const mars = { aspect: "sextile", body2: "Mars", at: new Date("2026-09-30T20:06:42Z") };

describe("moonLine", () => {
  it("reads as Home always has on an ordinary day", () => {
    expect(moonLine({ sign: "Gemini", phaseName: "Waning Gibbous", illumination: 0.8, aspect: mars, scope: "today", fmtTime }))
      .toBe("The Moon is in Gemini, waning and 80% lit, and makes an exact sextile to Mars at 3:06pm.");
  });

  it("names the sign change on a day that has one, instead of the noon sign", () => {
    expect(moonLine({
      sign: "Taurus", ingress: { from: "Taurus", to: "Gemini", at: new Date("2026-09-30T17:26:00Z") },
      phaseName: "Waning Gibbous", illumination: 0.8, aspect: mars, scope: "day", fmtTime,
    })).toBe("The Moon is waning and 80% lit, moves from Taurus into Gemini at 12:26pm, and makes an exact sextile to Mars at 3:06pm.");
  });

  it("says when there is nothing left to perfect, in the day's own terms", () => {
    const base = { sign: "Gemini", phaseName: "Waning Gibbous", illumination: 80, aspect: null, fmtTime };
    expect(moonLine({ ...base, scope: "today" })).toBe("The Moon is in Gemini, waning and 80% lit, with no more exact aspects today.");
    expect(moonLine({ ...base, scope: "day" })).toBe("The Moon is in Gemini, waning and 80% lit, with no exact aspects that day.");
    expect(moonLine({
      ...base, scope: "day", ingress: { from: "Taurus", to: "Gemini", at: new Date("2026-09-30T17:26:00Z") },
    })).toBe("The Moon is waning and 80% lit, moves from Taurus into Gemini at 12:26pm, with no exact aspects that day.");
  });

  it("says the Sun, as English does", () => {
    expect(moonLine({ sign: "Gemini", phaseName: "Waning Gibbous", illumination: 0.71, scope: "day", fmtTime,
      aspect: { aspect: "trine", body2: "Sun", at: new Date("2026-10-01T07:05:37Z") } }))
      .toBe("The Moon is in Gemini, waning and 71% lit, and makes an exact trine to the Sun at 2:05am.");
  });

  it("stops at the phase while the aspects are still loading", () => {
    expect(moonLine({ sign: "Gemini", phaseName: "Waning Gibbous", illumination: 0.8, scope: "today", fmtTime }))
      .toBe("The Moon is in Gemini, waning and 80% lit.");
  });

  it("keeps Home's void clause, without the leading zero", () => {
    expect(moonLine({ sign: "Taurus", phaseName: "Waning Gibbous", illumination: 0.8, voidUntil: "08:01 AM", aspect: null, scope: "today", fmtTime }))
      .toBe("The Moon is in Taurus, waning and 80% lit, and void of course until it changes sign at 8:01 AM.");
  });
});
