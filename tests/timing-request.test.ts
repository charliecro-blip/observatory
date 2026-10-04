import { describe, it, expect } from "vitest";
import { interpretTimingRequest } from "../artifacts/api-server/src/lib/timingRequest";
import { interpretTimingActivity } from "../artifacts/api-server/src/lib/timingInterpretation";

const now = new Date("2026-09-04T15:00:00Z");
describe("one timing request contract", () => {
  it.each([
    "deep work for 2 to 3 hours",
    "painting for two or three hours",
    "write for 2-3h",
    "paint in two hours",
  ])("clarifies duration ranges and delays: %s", (text) => {
    expect(
      interpretTimingRequest(text, "UTC", now).draft.needsRangeReview,
    ).toBe(true);
  });
  it.each([
    ["deep work for 1h 30m", 90],
    ["painting for forty-five minutes", 45],
    ["workout for twenty five minutes", 25],
  ] as const)("reads a compact or compound duration: %s", (text, duration) => {
    expect(interpretTimingRequest(text, "UTC", now).durationMinutes).toBe(
      duration,
    );
  });
  it("resolves activity, duration and a local weekend together", () => {
    expect(
      interpretTimingRequest(
        "Three hours of deep work this weekend",
        "America/Chicago",
        now,
      ),
    ).toMatchObject({
      state: "resolved",
      options: [{ key: "deep-work" }],
      durationMinutes: 180,
      horizon: {
        start: "2026-09-05T05:00:00.000Z",
        end: "2026-09-07T05:00:00.000Z",
      },
      unresolved: [],
    });
  });
  it("does not use the process timezone for an Indian evening", () => {
    expect(
      interpretTimingRequest("Painting tomorrow evening", "Asia/Kolkata", now),
    ).toMatchObject({
      horizon: {
        start: "2026-09-05T12:30:00.000Z",
        end: "2026-09-05T17:30:00.000Z",
      },
      unresolved: [],
    });
  });
  it("spans the 49-hour fall DST weekend", () => {
    const r = interpretTimingRequest(
      "workout this weekend",
      "America/Chicago",
      new Date("2026-10-30T15:00:00Z"),
    );
    expect(
      (Date.parse(r.horizon.end) - Date.parse(r.horizon.start)) / 3600000,
    ).toBe(49);
  });
  it("keeps Sunday in the current weekend", () => {
    const r = interpretTimingRequest(
      "painting this weekend",
      "America/Chicago",
      new Date("2026-09-06T15:00:00Z"),
    );
    expect(r.horizon).toEqual({
      start: "2026-09-06T15:00:00.000Z",
      end: "2026-09-07T05:00:00.000Z",
    });
  });
  it("combines hours and minutes", () =>
    expect(
      interpretTimingRequest(
        "deep work for one hour and thirty minutes tomorrow",
        "UTC",
        now,
      ).durationMinutes,
    ).toBe(90));
  it.each([
    "workout Saturday or Sunday",
    "paint next month",
    "deep work this weekend after lunch",
  ])("requires correction for an unsupported constraint: %s", (text) =>
    expect(
      interpretTimingRequest(text, "America/Chicago", now).draft
        .needsRangeReview,
    ).toBe(true),
  );
  it("invalid zones fail instead of falling back", () =>
    expect(() =>
      interpretTimingRequest("paint", "Mars/Olympus", now),
    ).toThrow());
  it.each([
    "paint tomorrow morning or evening",
    "paint tomorrow but not in the morning",
    "deep work overnight tomorrow",
    "paint tomorrow at noon",
    "paint tomorrow at midnight",
    "workout at sunrise tomorrow",
    "paint in two days",
    "paint now or tomorrow",
    "paint tomorrow at 3pm",
    "paint after 9 tomorrow",
    "stretch every morning",
  ])("does not silently discard a time constraint: %s", (text) => {
    const result = interpretTimingRequest(text, "America/Chicago", now);
    expect(result.draft.needsRangeReview).toBe(true);
    expect(result.unresolved.length).toBeGreaterThan(0);
  });
  it.each([
    "paint tomorrow morning",
    "paint the day after tomorrow",
    "paint for two hours tomorrow",
    "workout this weekend",
    "paint right now",
  ])("keeps supported requests automatic: %s", (text) => {
    expect(interpretTimingRequest(text, "America/Chicago", now).unresolved).toEqual([]);
  });
});
// 2026-10-03: phrases that used to ask now resolve to the window they name.
// "Does not silently discard" still holds: each is answered, not dropped.
// Worded apart from tests/eval/timing-heldout.ts, which is never tuned against.
describe("ordinary time phrases resolve (Friday 2026-09-04, 10:00 Chicago)", () => {
  const tz = "America/Chicago";
  it.each([
    ["paint this week", "2026-09-04T10:00", "2026-09-07T00:00", undefined],
    ["paint next week", "2026-09-07T00:00", "2026-09-14T00:00", undefined],
    ["paint tomorrow night", "2026-09-05T18:00", "2026-09-05T23:00", undefined],
    ["paint after 3pm tomorrow", "2026-09-05T15:00", "2026-09-06T00:00", undefined],
    ["painting September 20", "2026-09-20T00:00", "2026-09-21T00:00", undefined],
    ["painting Aug 3", "2027-08-03T00:00", "2027-08-04T00:00", undefined],
    ["sketch at lunch", "2026-09-04T12:00", "2026-09-04T13:30", undefined],
    ["stretch before bed", "2026-09-04T18:00", "2026-09-04T23:00", undefined],
    ["paint in the evening", "2026-09-04T18:00", "2026-09-04T23:00", undefined],
    ["paint saturday 10-11:30am", "2026-09-05T10:00", "2026-09-05T11:30", "90"],
    ["deep work tomorrow 1pm to 4pm", "2026-09-05T13:00", "2026-09-05T16:00", "180"],
    ["call the dentist before 4", "2026-09-04T10:00", "2026-09-04T16:00", undefined],
    ["paint before monday", "2026-09-04T10:00", "2026-09-07T00:00", undefined],
    ["paint by monday", "2026-09-04T10:00", "2026-09-08T00:00", undefined],
    ["paint before friday", "2026-09-04T10:00", "2026-09-11T00:00", undefined],
    ["paint after lunch", "2026-09-04T12:00", "2026-09-04T18:00", undefined],
  ] as const)("%s", (text, start, end, duration) => {
    const r = interpretTimingRequest(text, tz, now);
    expect(r.unresolved).toEqual([]);
    expect(r.draft.start).toBe(start);
    expect(r.draft.end).toBe(end);
    if (duration) expect(r.draft.duration).toBe(duration);
  });
});

describe("language counterexamples", () => {
  it.each([
    "I don't want a workout",
    "painting and workout",
    "prepare a presentation",
  ])("asks instead of first-match routing: %s", (text) =>
    expect(interpretTimingActivity(text).state).toBe("ambiguous"),
  );
  it("distinguishes painting a room from making art", () =>
    expect(
      interpretTimingActivity("painting the kitchen").options[0]?.key,
    ).toBe("beautify"));
  it("does not turn drawing a bath into making art", () =>
    expect(interpretTimingActivity("draw a bath").state).toBe("unsupported"));
  it("does not turn a yoga workout into hard training", () =>
    expect(interpretTimingActivity("a yoga workout").options[0]?.key).toBe(
      "gentle-movement",
    ));
});
