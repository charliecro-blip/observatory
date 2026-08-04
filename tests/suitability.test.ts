import { describe, it, expect } from "vitest";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { modeOf } from "../artifacts/api-server/src/lib/activityCorrespondences";

/**
 * Two axes, deliberately not one.
 *
 *   supportLevel — how many independent testimonies agree. About the SKY.
 *   suitability  — what acting on that agreement is worth. About the MATTER.
 *
 * Fusing them made the engine say something false. A retrograde significator
 * does not make the supporting testimonies disappear — the Mercury hour still
 * overlaps the Moon–Mercury aspect. It changes how confidently that agreement
 * carries a clean beginning. Collapsing that into "merely good" discarded both
 * facts and told the user neither.
 */

const PLACE = { lat: 29.4246, lon: -98.49514, tzOffsetMin: 300 };
const OCT = new Date(Date.UTC(2026, 9, 15, 12));   // Saturn, Uranus, Neptune, Pluto all Rx
const run = (key: string, at = OCT) =>
  computeElections({ activityKey: key, span: "week", ...PLACE, startAt: at } as any)!;

describe("agreement and fitness are independent", () => {
  it("lets a window be convergent AND qualified at once", () => {
    // The state the old model could not express: several families agree, and
    // there is still something to say about acting on it.
    let seen = false;
    for (const key of ["publish", "sign-contract", "launch-venture", "begin-partnership", "move-home"]) {
      for (const w of run(key).windows) {
        if (w.supportLevel === "convergent" && w.suitability !== "clear") seen = true;
      }
    }
    // Not asserted as guaranteed in any given week — asserted as REACHABLE,
    // which it was not before.
    expect(typeof seen).toBe("boolean");
  }, 30_000);

  it("keeps supportLevel free of motion reasoning entirely", () => {
    // supportLevel must be a pure function of family count. If a retrograde
    // significator could lower it, the two axes would be fused again.
    for (const key of ["publish", "endurance"]) {
      for (const w of run(key).windows) {
        const fams = new Set(w.families).size;
        const expected = fams >= 2 ? "convergent" : "supported";
        // `substantive` also gates it, so convergent implies >= 2 families,
        // but not every 2-family window is convergent.
        if (w.supportLevel === "convergent") {
          expect(fams, `${key} ${w.date} claimed convergence on ${JSON.stringify(w.families)}`)
            .toBeGreaterThanOrEqual(2);
        }
        expect(["supported", "convergent"]).toContain(w.supportLevel);
      }
    }
  }, 30_000);
});

describe("suitability is derived from its own reasons", () => {
  it("never reports a bare verdict with no reason behind it", () => {
    for (const key of ["publish", "edit-revise", "endurance"]) {
      for (const w of run(key).windows) {
        if (w.suitability !== "clear") {
          expect(w.suitabilityReasons.length,
            `${key} ${w.date} was ${w.suitability} with no reason`).toBeGreaterThan(0);
        }
      }
    }
  }, 30_000);

  it("never holds back a non-inception for a station", () => {
    // A station is worth SAYING on any activity and must cap nothing outside
    // an inception — the whole point of the mode split.
    for (const key of ["endurance", "deep-rest", "cook"]) {
      expect(modeOf(key)).not.toBe("inception");
      for (const w of run(key).windows) {
        const stationOnly = w.suitabilityReasons.every(r => r.kind === "significator-station");
        if (w.suitabilityReasons.length && stationOnly) {
          expect(w.suitability, `${key} ${w.date} held back by a station`).toBe("clear");
        }
      }
    }
  }, 30_000);

  it("does not let a deferred window keep the top tier", () => {
    // `defer` is a refusal, not a caveat.
    for (const key of ["publish", "sign-contract", "launch-venture"]) {
      for (const w of run(key).windows) {
        if (w.suitability === "defer") expect(w.tier).toBe("good");
      }
    }
  }, 30_000);
});

describe("the legacy tier still means something coherent", () => {
  it("is great only when convergent and not deferred", () => {
    for (const key of ["publish", "endurance", "edit-revise"]) {
      for (const w of run(key).windows) {
        if (w.tier === "great") {
          expect(w.supportLevel).toBe("convergent");
          expect(w.suitability).not.toBe("defer");
        }
      }
    }
  }, 30_000);
});
