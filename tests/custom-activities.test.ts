import { describe, it, expect } from "vitest";
import { computeElections, evaluateActivityInterval } from "../artifacts/api-server/src/lib/electionEngine";
import type { ActivityCorrespondence } from "../artifacts/api-server/src/lib/activityCorrespondences";

/**
 * `extraActivities` — the seam a tester's own custom activities (owner
 * 2026-09-03) ride through, without ever being merged into the shared
 * ACTIVITIES table itself. Every existing election test calls computeElections
 * and evaluateActivityInterval with no fourth/extra argument at all and stays
 * green, which is the backward-compatibility half of this guarantee; these
 * pin the other half — that a caller who DOES supply one gets it searched.
 */

const AT = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));
const PLACE = { lat: 29.4246, lon: -98.49514, tzOffsetMin: 300 };

const CUSTOM: ActivityCorrespondence = {
  key: "custom-999", label: "Practice guitar", category: "craft",
  keywords: ["practice guitar"],
  element: "air", planets: { Mercury: 1.0, Venus: 0.7 }, hourRulers: ["Mercury", "Venus"],
  aspects: "soft", signs: {}, houses: [3, 7],
  phase: null, voc: "neutral", mercuryRx: null,
  windowType: "creative", gloss: "A made-up rule set for the test.",
};

describe("computeElections reads a tester's own custom activities", () => {
  it("resolves a custom key when extraActivities carries it", () => {
    const result = computeElections({
      activityKey: "custom-999", span: "week", ...PLACE, startAt: AT,
      extraActivities: [CUSTOM],
    });
    expect(result, "a custom activity given via extraActivities should resolve").not.toBeNull();
    expect(result!.windows.length).toBeGreaterThan(0);
  });

  it("returns null for the same key with no extraActivities — no leakage into the shared table", () => {
    const result = computeElections({ activityKey: "custom-999", span: "week", ...PLACE, startAt: AT });
    expect(result, "a custom key must not resolve without being explicitly supplied").toBeNull();
  });

  it("does not let a custom activity shadow a real one sharing no key", () => {
    // Built-in activities keep resolving normally alongside an unrelated
    // extraActivities list — the merge is additive, not a replacement.
    const result = computeElections({
      activityKey: "train-hard", span: "week", ...PLACE, startAt: AT,
      extraActivities: [CUSTOM],
    });
    expect(result).not.toBeNull();
    expect(result!.windows.length).toBeGreaterThan(0);
  });
});

describe("evaluateActivityInterval reads them too", () => {
  it("assesses a custom activity's own window when given extraActivities", () => {
    const startAt = new Date(Date.UTC(2026, 9, 16, 14, 0, 0));
    const endAt = new Date(Date.UTC(2026, 9, 16, 15, 0, 0));
    const assessment = evaluateActivityInterval({
      activityKey: "custom-999", startAt, endAt, extraActivities: [CUSTOM],
    });
    expect(assessment).not.toBeNull();
  });

  it("returns null for the same custom key with no extraActivities", () => {
    const startAt = new Date(Date.UTC(2026, 9, 16, 14, 0, 0));
    const endAt = new Date(Date.UTC(2026, 9, 16, 15, 0, 0));
    const assessment = evaluateActivityInterval({ activityKey: "custom-999", startAt, endAt });
    expect(assessment).toBeNull();
  });
});
