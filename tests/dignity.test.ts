import { describe, it, expect } from "vitest";
import { essentialDignity, accidentalDignity, dignity } from "../artifacts/api-server/src/lib/dignity.js";

/**
 * Dignity is the WEIGHT scalar for the synthesis engine — if these tables or
 * rules drift, every "strong Mars hour" judgment drifts with them, invisibly.
 * The expectations below are hand-derived from Lilly's tables (the same source
 * the module cites), not read back from the code, so a transcription error in
 * the tables fails here rather than shipping.
 *
 * Longitudes are absolute ecliptic degrees: sign index × 30 + degree-in-sign.
 */
const lon = (signIndex: number, deg: number) => signIndex * 30 + deg;
const ARIES = 0, TAURUS = 1, GEMINI = 2, CANCER = 3, LEO = 4;

describe("essential dignity — sect flips triplicity", () => {
  // Saturn at 3° Gemini has exactly one possible dignity: day ruler of the air
  // triplicity. Nothing else applies (domicile Mercury, term Mercury, face
  // Jupiter, no detriment/fall). So this placement isolates the sect switch:
  // by day it scores +3, by night it holds NO dignity at all and goes
  // peregrine (−5). An 8-point swing from sect alone — which is why
  // dignity()'s `ctx.isDay ?? true` default (pinned below) is not a nicety.
  const saturnInGemini = lon(GEMINI, 3);

  it("scores Saturn in Gemini +3 (triplicity) by day", () => {
    const d = essentialDignity("Saturn", saturnInGemini, true);
    expect(d.score, "day-sect air triplicity ruler is Saturn (Dorothean)").toBe(3);
    expect(d.dignities).toEqual(["triplicity"]);
    expect(d.peregrine).toBe(false);
  });

  it("scores the same placement −5 (peregrine) by night", () => {
    const d = essentialDignity("Saturn", saturnInGemini, false);
    expect(d.score, "by night the air triplicity passes to Mercury, leaving Saturn with nothing").toBe(-5);
    expect(d.peregrine).toBe(true);
    expect(d.dignities).toEqual(["peregrine"]);
  });

  it("dignity() with sect unspecified currently behaves as DAY", () => {
    // Pins the `ctx.isDay ?? true` default (audit 2026-08-08 §3, "latent").
    // Every current caller that matters (synthesis.ts) passes isDay
    // explicitly, so the default is only reachable from new call sites — but
    // if it ever silently flipped or started guessing, an unaware caller's
    // scores would move by up to 8 points. Changing this default must be a
    // conscious decision that updates this test.
    const defaulted = dignity("Saturn", saturnInGemini, {});
    const day = dignity("Saturn", saturnInGemini, { isDay: true });
    const night = dignity("Saturn", saturnInGemini, { isDay: false });
    expect(defaulted.essential.score).toBe(day.essential.score);
    expect(day.essential.score, "sect must actually change the answer for this pin to mean anything").not.toBe(night.essential.score);
  });
});

describe("essential dignity — Lilly's table values", () => {
  it("domicile: Moon at 15° Cancer scores exactly +5, either sect", () => {
    // 15° Cancer carries no other dignity for the Moon (term Mercury, face
    // Mercury, water triplicity Venus/Mars), so this pins domicile = +5 alone.
    for (const isDay of [true, false]) {
      const d = essentialDignity("Moon", lon(CANCER, 15), isDay);
      expect(d.score).toBe(5);
      expect(d.dignities).toEqual(["domicile"]);
    }
  });

  it("dignities accumulate: Sun at 19° Aries by day = exaltation + triplicity + face = +8", () => {
    // Lilly scores each dignity independently; a placement can hold several.
    const d = essentialDignity("Sun", lon(ARIES, 19), true);
    expect(d.score).toBe(4 + 3 + 1);
    expect(d.dignities).toEqual(["exaltation", "triplicity", "face"]);
  });

  it("dignity and debility coexist: Venus at 8° Aries = own term (+2) in detriment (−5) = −3", () => {
    // Venus rules the 6°–12° Aries term while Aries itself is her detriment.
    // A naive exclusive if/else chain would drop one of the two; Lilly sums.
    const d = essentialDignity("Venus", lon(ARIES, 8), true);
    expect(d.score).toBe(-3);
    expect(d.dignities).toEqual(["term", "detriment"]);
    expect(d.peregrine, "holding a term means NOT peregrine, even in detriment").toBe(false);
  });

  it("fall is not double-penalized as peregrine: Saturn at 10° Aries = −4, not −9", () => {
    // A debilitated planet is debilitated, not peregrine. If someone
    // "simplifies" the peregrine check to `dignities.length === 0 → −5 more`,
    // this catches the −9.
    const d = essentialDignity("Saturn", lon(ARIES, 10), true);
    expect(d.score).toBe(-4);
    expect(d.dignities).toEqual(["fall"]);
    expect(d.peregrine).toBe(false);
  });

  it("peregrine: Mars at 5° Leo holds nothing and scores −5, either sect", () => {
    for (const isDay of [true, false]) {
      const d = essentialDignity("Mars", lon(LEO, 5), isDay);
      expect(d.score).toBe(-5);
      expect(d.peregrine).toBe(true);
    }
  });

  it("a minor dignity alone rescues from peregrine: term (Jupiter 20° Taurus), face (Saturn 21° Taurus)", () => {
    // Lilly's definition: peregrine = no dignity AT ALL, terms and faces
    // included. The module's own header calls out that terms must count —
    // this is the assertion behind that claim.
    const term = essentialDignity("Jupiter", lon(TAURUS, 20), true);
    expect(term.score).toBe(2);
    expect(term.dignities).toEqual(["term"]);
    expect(term.peregrine).toBe(false);

    const face = essentialDignity("Saturn", lon(TAURUS, 21), true);
    expect(face.score).toBe(1);
    expect(face.dignities).toEqual(["face"]);
    expect(face.peregrine).toBe(false);
  });

  it("modern planets sit outside the classical scheme: neutral, never peregrine", () => {
    // Owner decision 2026-07-23: Uranus/Neptune/Pluto/Chiron/nodes are not
    // force-fit to rulerships. If someone later adds modern rulerships
    // (e.g. Uranus→Aquarius), that must be a deliberate spec change.
    for (const p of ["Uranus", "Neptune", "Pluto", "Chiron", "North Node"]) {
      const d = essentialDignity(p, lon(ARIES, 10), true);
      expect(d.score, `${p} must score neutral`).toBe(0);
      expect(d.dignities).toEqual([]);
      expect(d.peregrine).toBe(false);
    }
  });
});

describe("accidental dignity — Sun condition (cazimi / combust / under the beams)", () => {
  // These four pin the ORIENTATION of the separation math, not just the
  // boundaries. The formula once computed `sep = 180 − d` — inverting the
  // scale so exact conjunction read as "free of the Sun's beams" (+5) and
  // opposition read as cazimi (+5). Combustion is the single harshest
  // accidental debility, so the inversion flipped 10 points of weight on
  // exactly the placements where it matters most. Every synthesis weight
  // downstream inherited it. Each case asserts the factor NAME, so a
  // re-inverted formula fails on the label, not on an ambiguous score.
  const sunCase = (planetLon: number, sunLon: number) =>
    accidentalDignity("Venus", { longitude: planetLon, sunLongitude: sunLon });

  it("exact conjunction is cazimi (+5), not freedom", () => {
    const d = sunCase(100, 100.2); // 0.2° separation, inside the 0°17′ cazimi orb
    expect(d.factors).toContain("cazimi");
    expect(d.factors).not.toContain("free of the Sun's beams");
  });

  it("5° from the Sun is combust (−5)", () => {
    const d = sunCase(100, 105);
    expect(d.factors).toContain("combust");
  });

  it("10° from the Sun is under the beams (−4)", () => {
    const d = sunCase(100, 110);
    expect(d.factors).toContain("under the beams");
  });

  it("opposition is free of the Sun's beams (+5), not cazimi", () => {
    const d = sunCase(100, 280);
    expect(d.factors).toContain("free of the Sun's beams");
    expect(d.factors).not.toContain("cazimi");
  });

  it("separation is wrap-safe across 0° Aries: 359° vs Sun 2° is combust", () => {
    // 3° of real separation that naive subtraction reads as 357°.
    const d = sunCase(359, 2);
    expect(d.factors).toContain("combust");
  });

  it("the Sun is never combust by itself", () => {
    const d = accidentalDignity("Sun", { longitude: 100, sunLongitude: 100 });
    expect(d.factors.some((f) => ["cazimi", "combust", "under the beams", "free of the Sun's beams"].includes(f))).toBe(false);
  });
});

describe("accidental dignity — motion and house", () => {
  it("retrograde swings 9 points against direct (−5 vs +4)", () => {
    expect(accidentalDignity("Mars", { retrograde: true }).score).toBe(-5);
    // NOTE: unknown motion (ctx.retrograde undefined) currently counts as
    // direct and takes the +4 — callers that don't know the motion are
    // crediting it. Pinned so a change to "unknown = neutral" is deliberate.
    expect(accidentalDignity("Mars", {}).score).toBe(4);
  });

  it("house placement follows Lilly's ladder (angular strong, 12th worst)", () => {
    // Isolate the house factor by differencing against the no-house baseline,
    // which carries only the direct-motion +4.
    const base = accidentalDignity("Mars", {}).score;
    const houseDelta = (h: number) => accidentalDignity("Mars", { house: h }).score - base;
    expect(houseDelta(1), "1st is angular").toBe(5);
    expect(houseDelta(10), "10th is angular").toBe(5);
    expect(houseDelta(11)).toBe(4);
    expect(houseDelta(5)).toBe(3);
    expect(houseDelta(9)).toBe(2);
    expect(houseDelta(3)).toBe(1);
    expect(houseDelta(6)).toBe(-2);
    expect(houseDelta(12), "the 12th is the pit").toBe(-5);
  });
});

describe("dignity() — the testimony weight", () => {
  it("maps net score to weight on the documented 1 + net/20 slope", () => {
    // Mars at 5° Aries: domicile + face = +6 essential; direct motion +4
    // accidental → net 10 → weight 1.5. Pins the slope so a retuned divisor
    // (which would rescale every testimony in the synthesis) is loud.
    const d = dignity("Mars", lon(ARIES, 5), { isDay: true, retrograde: false });
    expect(d.essential.score).toBe(6);
    expect(d.net).toBe(10);
    expect(d.weight).toBe(1.5);
  });

  it("weight is clamped to [0.2, 2.0] at the extremes", () => {
    // Best case: Mars dignified (+6), angular (+5), direct (+4), free of the
    // beams (+5) → net 20 → exactly the 2.0 ceiling.
    const best = dignity("Mars", lon(ARIES, 5), { isDay: true, house: 1, retrograde: false, sunLongitude: 200 });
    expect(best.net).toBe(20);
    expect(best.weight).toBe(2.0);

    // Worst case: Mars in fall (−4), 12th house (−5), retrograde (−5), slow
    // (−2), combust (−5) → net −21 → floor at 0.2, never zero or negative
    // (a voice can be faint but the multiplier must not erase or invert it).
    const worst = dignity("Mars", lon(CANCER, 10), { isDay: true, house: 12, retrograde: true, slow: true, sunLongitude: lon(CANCER, 15) });
    expect(worst.net).toBe(-21);
    expect(worst.weight).toBe(0.2);
  });
});
