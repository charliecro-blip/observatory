import { describe, it, expect } from "vitest";
import { computeElections, evaluateActivityInterval } from "../artifacts/api-server/src/lib/electionEngine.js";
import { findLongSessions } from "../artifacts/api-server/src/lib/longSession.js";
import { weaveDay } from "../artifacts/api-server/src/lib/dayWeaver.js";
import { weaveWeek } from "../artifacts/api-server/src/lib/weekWeaver.js";

const AUSTIN = { lat: 30.27, lon: -97.74 };
const KEYS = ["deep-work", "train-hard", "sign-contract", "finish-polish", "endurance", "first-draft"];

/**
 * THE INVARIANT.
 *
 * One interval plus one activity must have exactly one astrological verdict,
 * everywhere. Higher layers add practical constraints — a calendar clash, a
 * full day, a missing duration — and may refuse a placement for those reasons.
 * They may not improve or worsen the sky's judgment.
 *
 * This is the test the design review asked for, and it was written because the
 * violation was real rather than theoretical: longSession derived suitability
 * from `backgroundFit`, a rule the engine does not have, and the two disagreed
 * on 25 of 125 activity-days. The engine said `clear`; the session finder said
 * `qualified`; a user would have seen both.
 */
describe("one astrological authority", () => {
  it("the engine and the session finder never disagree about the same day", () => {
    const disagreements: string[] = [];
    let compared = 0;
    for (const key of KEYS) {
      for (let d = 1; d <= 21; d++) {
        const date = new Date(2026, 7, d, 12, 0);
        const eng = computeElections({
          activityKey: key, span: "day", ...AUSTIN, tzOffsetMin: 300,
          natal: null, timeKnown: true, locationKnown: true, startAt: date,
        });
        const ls = findLongSessions({ activityKey: key, minutes: 120, date, ...AUSTIN });
        if (!eng?.windows?.length || !ls?.options?.length) continue;
        compared++;
        const a = [...new Set((eng.windows as any[]).map(w => w.suitability))].sort().join(",");
        const b = [...new Set(ls.options.map(o => o.candidate.suitability))].sort().join(",");
        if (a !== b) disagreements.push(`${key} Aug ${d}: engine=[${a}] longSession=[${b}]`);
      }
    }
    // Without this the loop could pass by comparing nothing.
    expect(compared).toBeGreaterThan(80);
    expect(disagreements).toEqual([]);
  });

  // The orchestrators may REFUSE for practical reasons, but a placement they do
  // make must carry the verdict it was given. This is what stops a day or week
  // layer from quietly upgrading a qualified block to a clear one.
  it("the day weaver never places a block the session finder deferred", () => {
    const items = [{ id: "1", title: "Deep work sprint", kind: "task" as const, estMinutes: 120 }];
    for (let d = 1; d <= 14; d++) {
      const date = new Date(2026, 7, d, 12, 0);
      const w = weaveDay({ items, date, ...AUSTIN });
      for (const p of w.placed) {
        if (!p.activityKey || p.basis !== "elected") continue;
        const ls = findLongSessions({ activityKey: p.activityKey, minutes: p.minutes, date, ...AUSTIN });
        const match = ls?.options.find(o => o.candidate.startAt.getTime() === p.startAt.getTime());
        if (match) expect(match.candidate.suitability).not.toBe("defer");
      }
    }
  });

  // Same rule one level up: the week distributes and may decline, but it hands
  // placement to the day weaver rather than judging the sky a third time.
  it("the week weaver introduces no verdict of its own", () => {
    const items = [
      { id: "1", title: "Deep work sprint", kind: "task" as const, estMinutes: 120 },
      { id: "2", title: "Long run", kind: "star-step" as const, estMinutes: 60 },
    ];
    const wk = weaveWeek({ items, startDate: new Date(2026, 7, 5, 12, 0), ...AUSTIN });
    for (const day of wk.days) {
      for (const p of day.woven.placed) {
        if (!p.activityKey || p.basis !== "elected") continue;
        const ls = findLongSessions({ activityKey: p.activityKey, minutes: p.minutes, date: day.date, ...AUSTIN });
        const match = ls?.options.find(o => o.candidate.startAt.getTime() === p.startAt.getTime());
        if (match) expect(match.candidate.suitability).not.toBe("defer");
      }
    }
  });

  // Moon sign is a background PRIOR, not a veto. It may order candidates; it
  // may not change what any of them is judged to be.
  it("background fit orders candidates without changing their verdict", () => {
    for (let d = 1; d <= 21; d++) {
      const ls = findLongSessions({ activityKey: "deep-work", minutes: 120, date: new Date(2026, 7, d, 12, 0), ...AUSTIN });
      for (const o of ls?.options ?? []) {
        if (o.candidate.backgroundFit !== "contrary") continue;
        // A contrary Moon sign must not be listed as a reason the block is
        // qualified — that was the rule that created two authorities.
        expect(o.candidate.suitabilityReasons.join(" ")).not.toMatch(/against the grain/);
      }
    }
  });
});

describe("the canonical evaluator", () => {
  // The point of extracting it: the same interval and activity must return the
  // same verdict no matter who asks, and asking twice must not drift.
  it("is deterministic for the same interval", () => {
    const a = evaluateActivityInterval({ activityKey: "deep-work", startAt: new Date(2026, 7, 5, 13, 0), endAt: new Date(2026, 7, 5, 17, 0) })!;
    const b = evaluateActivityInterval({ activityKey: "deep-work", startAt: new Date(2026, 7, 5, 13, 0), endAt: new Date(2026, 7, 5, 17, 0) })!;
    expect(b.suitability).toBe(a.suitability);
    expect(b.suitabilityReasons.map(r => r.kind)).toEqual(a.suitabilityReasons.map(r => r.kind));
    expect(b.backgroundFit).toBe(a.backgroundFit);
  });

  it("refuses an unknown activity rather than guessing", () => {
    expect(evaluateActivityInterval({ activityKey: "no-such-thing", startAt: new Date(), endAt: new Date() })).toBeNull();
  });

  // Suitability is a pure function of the reasons — it cannot drift out of step
  // with the list the UI shows, which is the property that makes the verdict
  // inspectable rather than oracular.
  it("derives suitability only from its own recorded reasons", () => {
    let clearWithReasons = 0, gradedWithout = 0, seen = 0;
    for (const key of KEYS) {
      for (let d = 1; d <= 21; d++) {
        const a = evaluateActivityInterval({
          activityKey: key,
          startAt: new Date(2026, 7, d, 13, 0), endAt: new Date(2026, 7, d, 17, 0),
        })!;
        seen++;
        if (a.suitability === "clear" && a.suitabilityReasons.length) clearWithReasons++;
        if (a.suitability !== "clear" && !a.suitabilityReasons.length) gradedWithout++;
      }
    }
    expect(seen).toBeGreaterThan(100);
    expect(gradedWithout).toBe(0);   // never graded without saying why
  });

  // Moon sign must remain a prior. If it ever starts producing a suitability
  // reason, the 20% disagreement comes straight back.
  it("never turns background fit into a suitability reason", () => {
    for (let d = 1; d <= 28; d++) {
      const a = evaluateActivityInterval({
        activityKey: "deep-work",
        startAt: new Date(2026, 7, d, 13, 0), endAt: new Date(2026, 7, d, 17, 0),
      })!;
      if (a.backgroundFit !== "contrary") continue;
      expect(a.suitabilityReasons.map(r => r.kind).join(" ")).not.toMatch(/sign|moon|background/i);
    }
  });
});
