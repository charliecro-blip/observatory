import { describe, it, expect } from "vitest";
import { timingEnabledFor } from "../artifacts/api-server/src/lib/timingAccess";
import { interpretTimingActivity } from "../artifacts/api-server/src/lib/timingInterpretation";
import { presentTiming } from "../artifacts/api-server/src/lib/timingPresentation";
import { searchTiming } from "../artifacts/api-server/src/lib/timingSearch";
import {
  interpretTimingRange,
  timingIcal,
} from "../artifacts/tides/src/lib/timingQuery";
import {
  activityByKey,
  modeOf,
} from "../artifacts/api-server/src/lib/activityCorrespondences";
import { ROMANTIC_TIME } from "../artifacts/api-server/src/lib/romanticTime";

describe("timing beta cohort", () => {
  it("fails closed and admits only explicitly listed testers", () => {
    expect(timingEnabledFor("obs_a", undefined, undefined)).toBe(false);
    expect(timingEnabledFor("obs_a", "false", "obs_a")).toBe(false);
    expect(timingEnabledFor("obs_a", "true", "")).toBe(false);
    expect(timingEnabledFor("obs_a", "true", "obs_b, obs_a")).toBe(true);
    expect(timingEnabledFor("obs_c", "true", "obs_b, obs_a")).toBe(false);
    expect(timingEnabledFor("scratch", "true", "*")).toBe(true);
  });
});

describe("Phase A interpretation", () => {
  it("reads a duration and the whole weekend, with editable civil dates", () => {
    const r = interpretTimingRange(
      "Three hours of deep work this weekend",
      new Date(2026, 8, 4, 10),
    );
    expect(r).toMatchObject({
      start: "2026-09-05T00:00",
      end: "2026-09-07T00:00",
      duration: "180",
    });
    expect(
      interpretTimingActivity("Three hours of deep work this weekend"),
    ).toMatchObject({ state: "resolved", options: [{ key: "deep-work" }] });
  });
  it("keeps Sunday inside this weekend rather than jumping ahead", () => {
    const r = interpretTimingRange(
      "Three hours this weekend",
      new Date(2026, 8, 6, 10),
    );
    expect(r.start).toBe("2026-09-06T10:00");
    expect(r.end).toBe("2026-09-07T00:00");
  });
  it("does not map unsupported psychedelic requests to meditation", () => {
    expect(
      interpretTimingActivity(
        "meditation for a psychedelic journey this month",
      ),
    ).toEqual({ state: "unsupported", options: [] });
  });
  it("distinguishes first-date, ambiguous dates, and ordinary romantic time", () => {
    expect(
      interpretTimingActivity("first date with someone Saturday").options[0]
        ?.key,
    ).toBe("first-date");
    expect(interpretTimingActivity("a date Saturday").state).toBe("ambiguous");
    expect(
      interpretTimingActivity("date night with my wife Saturday").state,
    ).toBe("resolved");
    expect(modeOf("first-date")).toBe("inception");
    expect(activityByKey("first-date")).toMatchObject({
      phase: "waxing",
      voc: "avoid",
      planets: { Venus: 1, Moon: 0.6 },
    });
    expect(ROMANTIC_TIME).toMatchObject({
      phase: null,
      voc: "neutral",
      mercuryRx: null,
    });
  });
  it("flags unsupported range phrases for explicit correction", () => {
    expect(
      interpretTimingRange("Write next month", new Date(2026, 8, 4))
        .needsRangeReview,
    ).toBe(true);
  });
});
it("preserves identical candidate identities and evidence through calendar checking", () => {
  const q = {
    activity: "deep-work",
    start: "2026-09-05T05:00:00Z",
    end: "2026-09-07T05:00:00Z",
    timeZone: "America/Chicago",
    durationMinutes: 180,
  };
  const raw = presentTiming(searchTiming(q));
  const checked = presentTiming(
    searchTiming({
      ...q,
      calendar: {
        source: "fixture",
        fetchedAt: q.start,
        result: {
          ok: true,
          connected: true,
          busy: [{ startMs: Date.parse(q.start), endMs: Date.parse(q.end) }],
        },
      },
    }),
  );
  expect(raw.candidates.length).toBeGreaterThan(0);
  expect(checked.candidates.map((c) => c.id)).toEqual(
    raw.candidates.map((c) => c.id),
  );
  expect(checked.candidates.map((c) => c.evidence)).toEqual(
    raw.candidates.map((c) => c.evidence),
  );
  expect(
    checked.candidates.every((c) => c.availability.status === "conflict"),
  ).toBe(true);
});
it("exports the saved window identity and exact UTC bounds", () => {
  const ics = timingIcal(
    42,
    "Write, then revise",
    "2026-09-05T13:15:00Z",
    "2026-09-05T16:15:00Z",
    new Date("2026-09-04T00:00:00Z"),
  );
  expect(ics).toContain("UID:window-42@tides.app\r\n");
  expect(ics).toContain("DTSTART:20260905T131500Z\r\n");
  expect(ics).toContain("DTEND:20260905T161500Z\r\n");
  expect(ics).toContain("SUMMARY:Write\\, then revise");
});
