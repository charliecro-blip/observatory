import { describe, it, expect } from "vitest";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";

/**
 * What a window's REASONING is allowed to look like.
 *
 * Two changes, both about not throwing away something the engine already knew.
 *
 *  - Every testimony is computed separately and was then joined into one `why`
 *    string. The join discarded which KIND of claim each one made, so a surface
 *    could only reprint the blur — and a short verdict line had to be written a
 *    second time by hand, where it drifted from the evidence it summarised.
 *  - "Nothing is contradicted" is a claim about the sky and needs an exhaustive
 *    search to be true. `noObjections` is the narrower thing Compass can
 *    actually know: its own reasons list came back empty. These tests exist to
 *    keep the second from quietly becoming the first.
 */

const AT = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));
const PLACE = { lat: 29.4246, lon: -98.49514, tzOffsetMin: 300 };

const run = (o: Partial<Parameters<typeof computeElections>[0]> = {}) =>
  computeElections({ activityKey: "investigate", span: "week", ...PLACE, startAt: AT, ...o } as any)!;

describe("evidence carries its family", () => {
  it("splits the joined `why` into one entry per testimony", () => {
    const withReasons = run().windows.filter(w => (w.evidence?.length ?? 0) > 1);
    expect(withReasons.length, "some window should carry more than one testimony").toBeGreaterThan(0);

    for (const w of withReasons) {
      // The joined string is still produced, and must remain exactly the
      // concatenation — the two are one fact in two shapes, and a surface that
      // shows one while the engine ranks on the other would be showing a
      // different reason than the one it acted on.
      expect(w.evidence!.map(e => e.text).join(" · "), "why must equal the joined evidence").toBe(w.why);
    }
  }, 20_000);

  it("labels every testimony with a non-empty family", () => {
    const all = run().windows.flatMap(w => w.evidence ?? []);
    expect(all.length, "the run should produce testimony at all").toBeGreaterThan(0);
    // Not an enum check on purpose: the family set is open, and asserting a
    // fixed list here would make adding a new kind of testimony fail a test
    // rather than show up in the UI. What must hold is that nothing arrives
    // unlabelled, because an unlabelled row renders as a blank column.
    expect(all.filter(e => !e.family || !e.family.trim()), "no testimony may be unlabelled").toEqual([]);
  }, 20_000);

  it("attributes the planetary hour to the hour and the Moon to the Moon", () => {
    const all = run().windows.flatMap(w => w.evidence ?? []);
    const hour = all.find(e => / hour$/.test(e.text));
    const moon = all.find(e => e.text.startsWith("Moon–"));
    expect(hour?.family, "a planetary-hour testimony belongs to the hour family").toBe("hour");
    expect(moon?.family, "a Moon aspect belongs to the moon family").toBe("moon");
  }, 20_000);
});

describe("noObjections is a claim about the reasons list, not about the sky", () => {
  it("is true exactly when no suitability reason was recorded", () => {
    const windows = run().windows;
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(w.noObjections, `noObjections must track suitabilityReasons for ${w.startAt}`)
        .toBe(w.suitabilityReasons.length === 0);
    }
  }, 20_000);

  it("is false on a window the engine did qualify", () => {
    // Mercury retrograde is the reliably-reachable objection: it qualifies
    // rather than defers, so windows survive to be inspected. If this ever
    // finds nothing the test has stopped proving the negative case, so it
    // fails loudly rather than passing vacuously.
    const qualified = run({ span: "month" as const, activityKey: "sign-contract" })
      .windows.filter(w => w.suitabilityReasons.length > 0);
    expect(qualified.length, "expected at least one qualified window to test against").toBeGreaterThan(0);
    expect(qualified.every(w => w.noObjections === false), "a qualified window claims no absence").toBe(true);
  }, 30_000);
});
