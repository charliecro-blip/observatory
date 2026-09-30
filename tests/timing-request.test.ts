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
    "paint after 3pm tomorrow",
    "workout Saturday or Sunday",
    "paint next month",
    "deep work this weekend after lunch",
    "painting September 20",
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
    "paint this week",
    "paint now or tomorrow",
    "paint tomorrow night",
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
