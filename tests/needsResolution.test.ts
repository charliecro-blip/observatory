import { describe, it, expect } from "vitest";
import { needsResolution } from "../artifacts/api-server/src/lib/needsResolution.js";

describe("what blocks placement", () => {
  it("counts an item with a duration as ready", () => {
    const r = needsResolution([{ id: "1", title: "Deep work sprint", estMinutes: 120 }]);
    expect(r.ready).toBe(1);
    expect(r.needsDuration).toEqual([]);
  });

  // Measured on real data: five of eight open tasks matched no activity, and
  // four had no candidates to offer either. Gating duration behind
  // classification meant those could never become placeable, and the person
  // was shown a question with no answers.
  it("asks for a duration even when it cannot name the work", () => {
    const r = needsResolution([{ id: "1", title: "Renew the domain" }]);
    expect(r.needsDuration.length).toBe(1);
    expect(r.needsDuration[0].chips.length).toBeGreaterThan(2);
    expect(r.needsDuration[0].activityLabel).toBe("no particular kind");
  });

  // A question with no answers is worse than no question.
  it("asks about the activity only where there is a real choice", () => {
    const r = needsResolution([{ id: "1", title: "Renew the domain" }]);
    expect(r.needsActivity).toEqual([]);
    const r2 = needsResolution([{ id: "2", title: "Call the accountant back" }]);
    for (const n of r2.needsActivity) expect(n.options.length).toBeGreaterThan(0);
  });

  // Chips are proposals. The module must never return a chosen duration —
  // that is what keeps a suggestion from quietly becoming a reserved block.
  it("offers durations without picking one", () => {
    const r = needsResolution([{ id: "1", title: "Deep work sprint" }]);
    const d = r.needsDuration[0];
    expect(d).toBeTruthy();
    expect(Object.keys(d)).not.toContain("minutes");
    expect(Object.keys(d)).not.toContain("selected");
  });

  it("shapes the chips to the kind of work when it knows it", () => {
    const deep = needsResolution([{ id: "1", title: "Deep work sprint" }]).needsDuration[0];
    const unknown = needsResolution([{ id: "2", title: "Renew the domain" }]).needsDuration[0];
    // Deep work should be offered longer options than a nameless chore.
    expect(Math.max(...deep.chips)).toBeGreaterThanOrEqual(Math.max(...unknown.chips));
    expect(deep.chips).not.toEqual(unknown.chips);
  });
});
