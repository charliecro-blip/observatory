import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";

/**
 * A guessed location must not become evidence.
 *
 * Hiding estimated planetary hours in the interface was only half the fix.
 * They were still generating candidate windows, contributing the
 * `planetary-time` family, and therefore changing which windows exist and
 * whether they converge. A hidden guessed factor that changes the answer is
 * worse than a visible one — the user cannot even discount it.
 *
 * Planetary hours are cut from local sunrise and sunset, so on a guessed
 * meridian every boundary is wrong. Universal lunar and planetary testimony is
 * unaffected: the Moon aspects the same planets wherever you stand.
 */

const PLACE = { lat: 29.4246, lon: -98.49514, tzOffsetMin: 300 };
const AT = new Date(Date.UTC(2026, 9, 15, 12));
const run = (o: any = {}) =>
  computeElections({ activityKey: "deep-study", span: "week", ...PLACE, startAt: AT, ...o } as any)!;

describe("unknown location produces no local evidence", () => {
  it("emits no planetary-time family at all", () => {
    for (const w of run({ locationKnown: false }).windows) {
      expect(w.families, `${w.date} used a guessed hour`).not.toContain("planetary-time");
    }
  });

  it("emits planetary-time when the location is real", () => {
    // Otherwise the test above would pass for the wrong reason.
    const withLocation = run({ locationKnown: true }).windows;
    expect(withLocation.some(w => w.families.includes("planetary-time")),
      "no hour evidence even with a known location — the test above proves nothing").toBe(true);
  });

  it("keeps universal testimony, which does not depend on where you stand", () => {
    const r = run({ locationKnown: false });
    const universal = r.windows.some(w =>
      w.families.includes("lunar-contact") || w.families.includes("lunar-condition") ||
      w.families.includes("standing-sky"));
    expect(universal, "suppressed more than the local layer").toBe(true);
  });

  it("cannot mark a window stacked without an hour to stack with", () => {
    for (const w of run({ locationKnown: false }).windows) {
      expect(w.stackedHourMoon, `${w.date}`).toBe(false);
    }
  });

  it("defaults to known, so existing callers keep their meaning", () => {
    const a = run({});
    const b = run({ locationKnown: true });
    expect(a.windows.length).toBe(b.windows.length);
  });
});

describe("the route does not invent a location", () => {
  it("treats absent coordinates as unknown rather than as New York", () => {
    const src = readFileSync("artifacts/api-server/src/routes/elections.ts", "utf-8");
    expect(src).toMatch(/const hasCoords = req\.query\.lat != null && req\.query\.lon != null/);
    expect(src).toMatch(/locationKnown/);
  });

  it("passes it into the engine rather than dropping it at the boundary", () => {
    const src = readFileSync("artifacts/api-server/src/routes/elections.ts", "utf-8");
    expect(src).toMatch(/computeElections\(\{[^}]*locationKnown[^}]*\}\)/);
  });
});

describe("consumers send it, and key their cache on it", () => {
  it("sends locationKnown and includes it in the query key", () => {
    for (const f of ["ElectionPicker", "ActivityTimesHint"]) {
      const src = readFileSync(`artifacts/tides/src/components/${f}.tsx`, "utf-8");
      expect(src, `${f} request`).toMatch(/locationKnown=\$\{locationKnown\}/);
      expect(src, `${f} cache key`).toMatch(/queryKey: \["election-times"[^\]]*locationKnown\]/);
    }
  });
});
