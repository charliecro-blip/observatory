import { describe, it, expect } from "vitest";
import {
  ACTIVITIES,
  activityByKey,
  matchActivity,
  rankActivities,
  modeOf,
  primarySignificatorsOf,
} from "../artifacts/api-server/src/lib/activityCorrespondences";
import { interpretTimingActivity } from "../artifacts/api-server/src/lib/timingInterpretation";
import {
  ROMANTIC_TIME,
  relationshipActivityKey,
} from "../artifacts/api-server/src/lib/romanticTime";
import { searchTiming } from "../artifacts/api-server/src/lib/timingSearch";
import { interpretTimingRange } from "../artifacts/tides/src/lib/timingQuery";

describe("approved ordinary romantic time", () => {
  it.each([
    "date night with my wife Saturday",
    "romantic evening with my partner",
    "a date with my husband",
    "romantic time together",
  ])("resolves %s consistently", (text) => {
    expect(matchActivity(text)?.activity.key).toBe("romantic-time");
    expect(rankActivities(text)[0]?.activity.key).toBe("romantic-time");
    expect(interpretTimingActivity(text)).toEqual({
      state: "resolved",
      options: [{ key: "romantic-time", label: ROMANTIC_TIME.label }],
    });
  });
  it.each([
    "first date with someone Saturday",
    "first-date dinner",
    "first date night with someone",
  ])("preserves first-date meaning for %s", (text) => {
    expect(matchActivity(text)?.activity.key).toBe("first-date");
    expect(rankActivities(text)[0]?.activity.key).toBe("first-date");
    expect(interpretTimingActivity(text).options[0]?.key).toBe("first-date");
  });
  it("keeps ambiguous dates and unsupported requests explicit", () => {
    expect(interpretTimingActivity("a date Saturday")).toMatchObject({
      state: "ambiguous",
      options: [{ key: "romantic-time" }, { key: "first-date" }],
    });
    expect(interpretTimingActivity("psychedelic date night").state).toBe(
      "unsupported",
    );
    expect(relationshipActivityKey("write a romantic novel")).toBeNull();
  });
  it("registers one execution correspondence without changing first-date doctrine", () => {
    expect(ACTIVITIES.filter((a) => a.key === ROMANTIC_TIME.key)).toEqual([
      ROMANTIC_TIME,
    ]);
    expect(modeOf(ROMANTIC_TIME.key)).toBe("execution");
    const first = activityByKey("first-date")!;
    expect(modeOf(first.key)).toBe("inception");
    expect(primarySignificatorsOf(first.key, first.planets)).toEqual(["Venus"]);
    expect(first).toMatchObject({
      element: "air",
      planets: { Venus: 1, Moon: 0.6 },
      hourRulers: ["Venus"],
      aspects: "soft",
      signs: {
        Libra: "partnered air",
        Leo: "warm stage-light",
        Taurus: "the senses",
        Pisces: "the glow",
      },
      houses: [5, 7],
      phase: "waxing",
      voc: "avoid",
      mercuryRx: null,
      windowType: "relationship",
    });
  });
  it("supports chartless ordinary windows and duration searches canonically", () => {
    const q = {
      activity: "romantic-time",
      start: "2026-09-05T05:00:00Z",
      end: "2026-09-07T05:00:00Z",
      timeZone: "America/Chicago",
    };
    for (const duration of [undefined, 120]) {
      const r = searchTiming({ ...q, durationMinutes: duration });
      if (!("days" in r)) throw Error(JSON.stringify(r));
      expect(r.status).toBe("complete");
      expect(r.outcome).toBe("results");
      expect(r.context.natal).toBe("absent");
      expect(r.interpretation.activity).toBe("romantic-time");
    }
  });
  it("offers editable evening bounds for an explicitly named date night", () => {
    const r = interpretTimingRange(
      "Two hours for date night with my wife Saturday",
      new Date(2026, 8, 4, 10),
    );
    expect(r).toMatchObject({
      start: "2026-09-05T18:00",
      end: "2026-09-06T00:00",
      duration: "120",
      needsRangeReview: false,
    });
  });
});
