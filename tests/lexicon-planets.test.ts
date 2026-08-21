import { describe, it, expect } from "vitest";
import { PLANETS, PLANET_ORDER, CLASSICAL } from "../lib/lexicon/src/planets.js";
import { PLANET_MYTHOS, PLANET_ACTIVITIES } from "../artifacts/tides/src/lib/mythos.js";
import { PLANET_CORE } from "../artifacts/tides/src/lib/sky-readings.js";
import { PLANET_LITERACY } from "../artifacts/tides/src/lib/sky-literacy.js";

describe("the planet lexicon", () => {
  it("has ten planets, seven classical, each with every field", () => {
    expect(PLANET_ORDER).toHaveLength(10);
    expect(CLASSICAL).toEqual(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);
    for (const p of Object.values(PLANETS)) {
      expect(p.approach.length).toBeGreaterThan(10);
      expect(p.literacy.longArc.length).toBeGreaterThan(10);
      expect(p.core.use.length).toBeGreaterThan(3);
      if (p.classical) { expect(p.voice).toBeTruthy(); expect(p.roads).toBeTruthy(); expect(p.theme).toBeTruthy(); expect(p.activities!.length).toBeGreaterThan(3); }
    }
  });
  it("approach lines are one clause with a hinge, no full stop, no em dash, and do not all start the same way", () => {
    const starts = new Set<string>();
    for (const p of Object.values(PLANETS)) {
      expect(p.approach, p.key).toMatch(/;|,/);
      expect(p.approach, p.key).not.toMatch(/\.$/);
      expect(p.approach, p.key).not.toMatch(/—/);
      starts.add(p.approach.split(" ").slice(0, 2).join(" "));
    }
    expect(starts.size).toBeGreaterThan(6);
  });
  it("the client's planet tables are views of the record", () => {
    for (const k of CLASSICAL) {
      expect(PLANET_MYTHOS[k].whenLoud).toBe(PLANETS[k].voice!.whenLoud);
      expect(PLANET_ACTIVITIES[k]).toEqual(PLANETS[k].activities);
    }
    for (const k of PLANET_ORDER) {
      expect(PLANET_CORE[k]).toEqual(PLANETS[k].core);
      expect(PLANET_LITERACY[k]).toEqual(PLANETS[k].literacy);
    }
  });
});
