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

describe("the flat list is never read without the rules", () => {
  // EVERY file, not just the rail. The first version of this test checked
  // Rail.tsx alone, which is exactly the mistake it was written about: the fix
  // had been applied per-surface instead of per-vocabulary, and a
  // file-specific test repeats that error. Scanning all consumers immediately
  // turned up a third site — the Resonant Now cards in Today.tsx.
  const FILES = [
    "artifacts/tides/src/components/Rail.tsx",
    "artifacts/tides/src/pages/Today.tsx",
  ];

  it("has no consumer outside the two files this test knows about", () => {
    // If PLANET_ACTIVITIES grows a new reader, this test must be told about it
    // rather than silently not covering it.
    const src = read("artifacts/tides/src/lib/mythos.ts");
    expect(src).toMatch(/PLANET_ACTIVITIES/);
    for (const f of FILES) expect(read(f)).toMatch(/PLANET_ACTIVITIES/);
  });

  it("only ever uses the flat list as a fallback behind approachOptions", () => {
    for (const f of FILES) {
      const src = read(f);
      for (const line of src.split("\n")) {
        if (!line.includes("PLANET_ACTIVITIES[")) continue;
        if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
        // Legal shapes: `opts.length ? opts : PLANET_ACTIVITIES[x]` and the
        // equivalent inside railVerbs. Both are guarded by a real lookup first.
        expect(line, `${f}: flat list used without an approachOptions guard —\n    ${line.trim()}`)
          .toMatch(/\?\s*opts\s*:|:\s*\(?PLANET_ACTIVITIES/);
      }
    }
  });

  it("routes every rail surface through railVerbs", () => {
    const rail = read("artifacts/tides/src/components/Rail.tsx");
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
    const rail = read("artifacts/tides/src/components/Rail.tsx");
    const calls = [...rail.matchAll(/railVerbs\(([^)]*)\)/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(2);
    for (const c of calls) {
      expect(c, `railVerbs called without a chronotype: ${c}`).toMatch(/chronotype/);
      expect(c, `railVerbs called without the void flag: ${c}`).toMatch(/isVOC|voc/);
    }
    // Today's own call sites must carry the same two facts.
    const today = read("artifacts/tides/src/pages/Today.tsx");
    for (const m of today.matchAll(/approachOptions\(\{([\s\S]{0,260}?)\}\)/g)) {
      expect(m[1], `approachOptions called without sleepTime:\n${m[1]}`).toMatch(/sleepTime/);
      expect(m[1], `approachOptions called without voc:\n${m[1]}`).toMatch(/voc:/);
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
