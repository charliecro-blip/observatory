import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { approachOptions } from "../artifacts/tides/src/lib/approach";

/**
 * One activity vocabulary, one rule set, on every surface that renders it.
 *
 * `PLANET_ACTIVITIES` (lib/mythos.ts) is the ORIGINAL flat planet→verbs map:
 * no sense of the clock, no idea the Moon is void. lib/approach.ts was written
 * to replace it after a Mars hour proposed "train hard" at 21:20 against a
 * stated 23:00 bedtime.
 *
 * That replacement was done on Today and in the expanded rail — and missed in
 * the collapsed rail's popovers, which kept reading the flat list raw. So the
 * exact sentence the fix was named after could still appear late at night, one
 * panel over, for a year. Found 2026-08-03 by grepping a production bundle for
 * a string the voice pass should have removed and finding it still there.
 */

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf-8");

describe("the flat list is never rendered without the rules", () => {
  const rail = read("artifacts/tides/src/components/Rail.tsx");

  it("routes every rail surface through the approach layer", () => {
    // PLANET_ACTIVITIES may still appear — as the FALLBACK inside railVerbs,
    // for bodies the approach layer has no entry for. What must not exist is a
    // component reading it straight into a rendered list.
    expect(rail).toMatch(/function railVerbs/);
    const rendered = [...rail.matchAll(/options=\{([^}]*)\}/g)].map((m) => m[1]);
    expect(rendered.length, "no options= props found — did the rail change shape?").toBeGreaterThan(2);
    for (const expr of rendered) {
      expect(expr, `renders the flat list directly: options={${expr}}`)
        .not.toMatch(/PLANET_ACTIVITIES/);
    }
  });

  it("passes the sleep hours and the void flag wherever it asks for verbs", () => {
    // Without these the approach layer degrades to the flat list's behaviour.
    const calls = [...rail.matchAll(/railVerbs\(([^)]*)\)/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(2);
    for (const c of calls) {
      expect(c, `railVerbs called without a chronotype: ${c}`).toMatch(/chronotype/);
      expect(c, `railVerbs called without the void flag: ${c}`).toMatch(/isVOC|voc/);
    }
  });
});

describe("the rule the flat list could not keep", () => {
  const RHYTHM = { wakeTime: "07:00", sleepTime: "23:00" };
  const at = (h: number, m = 0) => new Date(2026, 7, 3, h, m, 0);

  it("offers nothing high-arousal in the wind-down, for any planet", () => {
    // The reported case, asserted on the source the rail now reads.
    for (const planet of ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
      for (const o of approachOptions({ planet, at: at(21, 20), ...RHYTHM })) {
        expect(o, `${planet} wind-down offered "${o}"`).not.toMatch(/train hard|compete|sprint/i);
      }
    }
  });

  it("still offers hard training in the morning — the guard did not flatten it", () => {
    expect(approachOptions({ planet: "Mars", at: at(9), ...RHYTHM }).join(" | ")).toMatch(/train hard/);
  });

  it("gives only re-verbs when the Moon is void, at any hour", () => {
    for (const h of [9, 14, 21]) {
      for (const o of approachOptions({ planet: "Mars", at: at(h), voc: true, ...RHYTHM })) {
        expect(o, `void hour ${h} offered "${o}"`).not.toMatch(/\btrain hard\b|\bcompete\b/i);
      }
    }
  });
});
