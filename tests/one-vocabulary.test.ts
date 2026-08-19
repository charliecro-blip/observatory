import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
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
  // EVERY consumer, FOUND rather than listed. The first version checked
  // Rail.tsx alone, which is exactly the mistake it was written about: the fix
  // had been applied per-surface instead of per-vocabulary. Listing two files
  // was the same mistake one step later — it broke the day Today retired and
  // the Resonant Now cards moved to components/SkyReadouts, and a hard-coded
  // list would have silently stopped covering a consumer that merely moved.
  const CLIENT = "artifacts/tides/src";
  function consumers(): string[] {
    const out: string[] = [];
    for (const dir of ["components", "pages", "hooks"]) {
      for (const f of readdirSync(join(process.cwd(), CLIENT, dir))) {
        if (!/\.tsx?$/.test(f)) continue;
        const rel = `${CLIENT}/${dir}/${f}`;
        if (/PLANET_ACTIVITIES\[/.test(read(rel))) out.push(rel);
      }
    }
    return out;
  }
  const FILES = consumers();

  it("has at least one consumer, and the vocabulary still exists", () => {
    // A discovery-based scan is worthless if it silently finds nothing.
    expect(read("artifacts/tides/src/lib/mythos.ts")).toMatch(/PLANET_ACTIVITIES/);
    expect(FILES.length, "no surface reads PLANET_ACTIVITIES any more").toBeGreaterThan(0);
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
    // EVERY other call site must carry the same two facts — found, not listed.
    // This named Today.tsx until that page retired and the Resonant Now cards
    // moved; a named file would have stopped checking the call site rather
    // than following it.
    let checked = 0;
    for (const f of FILES) {
      for (const m of read(f).matchAll(/approachOptions\(\{([\s\S]{0,260}?)\}\)/g)) {
        checked++;
        // Shorthand counts. `voc,` passes the flag exactly as `voc: voc`
        // does, and requiring the colon would fail a call site that is
        // correct — which is what widening this scan to the rail turned up.
        expect(m[1], `${f}: approachOptions called without sleepTime:\n${m[1]}`).toMatch(/sleepTime/);
        expect(m[1], `${f}: approachOptions called without the void flag:\n${m[1]}`)
          .toMatch(/\bvoc\b\s*[,:}]/);
      }
    }
    expect(checked, "no approachOptions call sites found outside the rail").toBeGreaterThan(0);
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
