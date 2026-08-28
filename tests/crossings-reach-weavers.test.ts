import { describe, it, expect } from "vitest";
import { evaluateActivityInterval } from "../artifacts/api-server/src/lib/electionEngine";
import { findLongSessions } from "../artifacts/api-server/src/lib/longSession";

const LA = { lat: 34.05, lon: -118.24 };

describe("the shared evaluator can see crossings", () => {
  it("never fires the family without a location", () => {
    // The angles are cut from the local horizon; a guessed meridian gives
    // every crossing the wrong minute, and the minute is the whole claim.
    let sawAny = false;
    for (let h = 0; h < 24; h += 2) {
      const startAt = new Date(Date.UTC(2026, 8, 1, h));
      const a = evaluateActivityInterval({
        activityKey: "train-hard", startAt, endAt: new Date(startAt.getTime() + 3600000),
      });
      if (a?.families.includes("angle-crossing")) sawAny = true;
    }
    expect(sawAny).toBe(false);
  });

  it("fires somewhere across a day once a location is given", () => {
    let hits = 0;
    for (let h = 0; h < 24; h++) {
      const startAt = new Date(Date.UTC(2026, 8, 1, h));
      const a = evaluateActivityInterval({
        activityKey: "train-hard", startAt, endAt: new Date(startAt.getTime() + 3600000), ...LA,
      });
      if (a?.families.includes("angle-crossing")) hits++;
    }
    // Mars and Sun each cross four angles a day, so a few hours of a day carry
    // one — but not most of them, or the family would be worthless.
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(14);
  });

  it("stays reinforcing, so it cannot converge an interval by itself", () => {
    for (let h = 0; h < 24; h++) {
      const startAt = new Date(Date.UTC(2026, 8, 1, h));
      const a = evaluateActivityInterval({
        activityKey: "train-hard", startAt, endAt: new Date(startAt.getTime() + 3600000), ...LA,
      })!;
      if (a.families.length === 1 && a.families[0] === "angle-crossing") {
        expect(a.supportLevel).toBe("supported");
      }
    }
  });
});

describe("and the weavers get it through findLongSessions", () => {
  it("passes the real location down, and withholds a guessed one", () => {
    const src = require("node:fs").readFileSync("artifacts/api-server/src/lib/longSession.ts", "utf8");
    expect(src).toContain("...(locationKnown ? { lat, lon } : {})");
    // Both call sites, not just the one that was easy to find.
    expect(src.split("...(locationKnown ? { lat, lon } : {})").length - 1).toBe(2);
  });

  it("still returns sessions, and does not blow up the day", () => {
    const r: any = findLongSessions({
      activityKey: "deep-work", minutes: 90, date: new Date("2026-09-01T00:00:00Z"),
      ...LA, locationKnown: true,
    } as any);
    expect(Array.isArray(r?.options ?? r)).toBe(true);
  });
});
