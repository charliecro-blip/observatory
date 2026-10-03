import { describe, expect, it } from "vitest";
import { buildTransitNote } from "../artifacts/api-server/src/lib/natal";

const PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron"];
const ASPECTS = ["Conjunction", "Sextile", "Square", "Trine", "Opposition"];
const all = PLANETS.flatMap(t => ASPECTS.flatMap(a => Array.from({ length: 12 }, (_, i) => ({ t, a, h: i + 1, note: buildTransitNote(t, "Mars", a, i + 1) }))));

describe("transit notes", () => {
  it("read as a fact and a condition, never the health tracker's instructions", () => {
    // 2026-10-03: the notes told people to track digestion and energy dips and
    // named "stress-related symptoms" and "inflammation-adjacent patterns".
    const banned = /symptom|digestion|inflammation|hydration|nutrition|somatic|fatigue|health|track|monitor|consider|watch for|prioritiz|worth tracking/i;
    for (const { t, a, h, note } of all) expect(note, `${t} ${a} ${h}`).not.toMatch(banned);
  });

  it("is two sentences: the transit, then what it tends to be like", () => {
    for (const { t, a, h, note } of all) {
      expect(note.match(/[.!?](\s|$)/g)?.length, `${t} ${a} ${h}: ${note}`).toBe(2);
    }
  });

  it("names the aspect, the house and its theme in plain words", () => {
    expect(buildTransitNote("Saturn", "Mars", "Square", 9))
      .toBe("Saturn squares your natal Mars in your 9th house (study, travel and belief). Saturn under tension tends to bring limits and slow progress, a stretch where pacing usually holds up better than force.");
    expect(buildTransitNote("Sun", "Venus", "Conjunction", 2)).toMatch(/^The Sun joins your natal Venus in your 2nd house \(money and what you value\)\./);
    expect(buildTransitNote("Moon", "Saturn", "Trine", 11)).toMatch(/^The Moon trines your natal Saturn in your 11th house/);
  });
});
