import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tempoOf } from "../artifacts/api-server/src/lib/activityCorrespondences";
import { motionOf } from "../artifacts/api-server/src/lib/motion";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { julianDay } from "../artifacts/api-server/src/lib/astro";

/**
 * Mercury tempo — a Compass reading, and it must never claim otherwise.
 *
 * Lilly scores swift motion as fortifying and slow as weakening, full stop.
 * "Slow Mercury suits revision" is our synthesis. These tests guard the
 * provenance as much as the behaviour.
 */

const PLACE = { lat: 29.4246, lon: -98.49514, tzOffsetMin: 300 };
const run = (key: string, at: Date) =>
  computeElections({ activityKey: key, span: "week", ...PLACE, startAt: at } as any)!;

describe("tempo is assigned only where it is a real condition", () => {
  it("defaults to `either` rather than inventing a preference", () => {
    for (const k of ["train-hard", "deep-rest", "garden", "meditate"]) {
      expect(tempoOf(k), k).toBe("either");
    }
  });

  it("puts the returning-to work on deliberate", () => {
    for (const k of ["edit-revise", "investigate", "finish-polish", "repair"]) {
      expect(tempoOf(k), k).toBe("deliberate");
    }
  });

  it("puts short live exchange on quick", () => {
    for (const k of ["admin-errands", "network", "call-family"]) {
      expect(tempoOf(k), k).toBe("quick");
    }
  });
});

describe("a station is not a tempo", () => {
  it("matches neither quick nor deliberate while Mercury is stationing", () => {
    // The tradition reads a station as impeded, not as a favourable speed —
    // and a planet turning around is not "moving deliberately".
    let checkedAStation = false;
    for (let d = 0; d < 365 && !checkedAStation; d++) {
      const at = new Date(Date.UTC(2026, 0, 1 + d, 12));
      const mm = motionOf("Mercury", julianDay(at));
      if (!mm || !mm.phase.startsWith("stationing")) continue;
      checkedAStation = true;
      // Scoped to the stationing DAY. A week span legitimately includes days
      // either side where Mercury is moving normally and a tempo does apply —
      // the first version of this test failed on exactly that.
      const iso = at.toISOString().slice(0, 10);
      for (const key of ["edit-revise", "admin-errands"]) {
        for (const w of run(key, at).windows.filter(w => w.startAt.slice(0, 10) === iso)) {
          expect(w.why, `${key} claimed a tempo during a ${mm.phase}`)
            .not.toMatch(/Compass reads this as suiting/);
        }
      }
    }
    expect(checkedAStation, "no Mercury station found in 2026").toBe(true);
  }, 60_000);
});

describe("tempo does not move the convergence bar yet", () => {
  it("never contributes a planetary-motion family while the flag is off", () => {
    // Adding a convergence-eligible family while the threshold is under review
    // would be a threshold change wearing a feature's clothes.
    const AT = new Date(Date.UTC(2026, 9, 15, 12));
    for (const key of ["edit-revise", "investigate", "admin-errands"]) {
      for (const w of run(key, AT).windows) {
        expect(w.families, `${key} counted motion toward convergence`)
          .not.toContain("planetary-motion");
      }
    }
  }, 30_000);
});

describe("provenance is stated in the source", () => {
  it("labels tempo as Compass synthesis, not classical doctrine", () => {
    const src = readFileSync("artifacts/api-server/src/lib/activityCorrespondences.ts", "utf-8");
    expect(src).toMatch(/Compass synthesis rather than inherited doctrine/);
    expect(src).toMatch(/Lilly/);
  });

  it("says so in the user-facing note too", () => {
    const src = readFileSync("artifacts/api-server/src/lib/electionEngine.ts", "utf-8");
    // Narrowed to the TEMPO notes. The first version matched every string
    // starting "Mercury is" and caught a pre-existing caution — which was
    // useful, because that caution turned out to be stale, but it is not what
    // this test is for.
    const notes = src.match(/note: "Mercury is [^"]+"/g) ?? [];
    expect(notes.length, "no tempo notes found").toBeGreaterThan(0);
    for (const n of notes) expect(n, n).toMatch(/Compass reads this as/);
  });
});
