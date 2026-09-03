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
    // A title with truly nothing to go on gets no candidates and no question.
    const blank = needsResolution([{ id: "1", title: "xyzzy plugh qwerty" }]);
    expect(blank.needsActivity).toEqual([]);

    // "Renew the domain" used to be this module's own example of the same
    // thing — until admin-errands learned "renew" (2026-09-03). It is real
    // shorthand for real admin work, not the unclassifiable case anymore, and
    // now offering it as a candidate (not a confident pick — see the sibling
    // duration test, which still finds no "particular kind") is the fix.
    const r = needsResolution([{ id: "2", title: "Renew the domain" }]);
    expect(r.needsActivity).toHaveLength(1);
    expect(r.needsActivity[0].options.map(o => o.key)).toContain("admin-errands");

    const r2 = needsResolution([{ id: "3", title: "Call the accountant back" }]);
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

describe("a confirmed activity outranks the matcher", () => {
  // The question used to be read-only: Compass asked "what kind of work is
  // this?" and had nowhere to put the reply, so the same question came back
  // every time. Tasks now carry `activity_key`, and a confirmed answer is used
  // rather than re-derived.
  it("stops asking once the person has answered", () => {
    const before = needsResolution([{ id: "1", title: "Call the accountant back" }]);
    expect(before.needsActivity.length).toBe(1);

    const after = needsResolution([{ id: "1", title: "Call the accountant back", activityKey: "call-family" }]);
    expect(after.needsActivity).toEqual([]);
  });

  // ...and the answer must actually shape what follows, not merely silence the
  // question — the duration chips are chosen from the activity's window type.
  it("uses the confirmed activity for the duration chips", () => {
    const generic = needsResolution([{ id: "1", title: "Some unrecognisable errand" }]).needsDuration[0];
    const confirmed = needsResolution([{ id: "1", title: "Some unrecognisable errand", activityKey: "deep-work" }]).needsDuration[0];
    expect(generic.activityLabel).toBe("no particular kind");
    expect(confirmed.activityLabel).toBe("Deep work sprint");
    expect(confirmed.chips).not.toEqual(generic.chips);
  });

  // A key that no longer exists is stale, not authoritative.
  it("falls back to matching when the stored key is unknown", () => {
    const r = needsResolution([{ id: "1", title: "Deep work sprint", activityKey: "no-such-activity" }]);
    const d = r.needsDuration[0];
    expect(d.activityLabel).toBe("Deep work sprint");
  });
});
