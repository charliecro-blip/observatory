import { describe, it, expect } from "vitest";
import { previewHours } from "../artifacts/tides/src/lib/calendarPreview";
const local = (s: string) => new Date(s).toISOString();
describe("candidate calendar projection", () => {
  it("shows a multi-day interval on both intersected days", () => {
    const start = local("2026-09-08T20:00:00"),
      end = local("2026-09-09T09:00:00");
    expect(previewHours(start, end, "2026-09-08")).toEqual({
      start: 20,
      end: 23,
    });
    expect(previewHours(start, end, "2026-09-09")).toEqual({
      start: 5,
      end: 9,
    });
    expect(previewHours(start, end, "2026-09-10")).toBeNull();
  });
  it("does not show midnight's endpoint on the following day", () => {
    expect(
      previewHours(
        local("2026-09-08T20:00:00"),
        local("2026-09-09T00:00:00"),
        "2026-09-09",
      ),
    ).toBeNull();
  });
  it("uses local calendar bounds on the autumn clock-change day", () => {
    expect(
      previewHours(
        local("2026-11-01T00:00:00"),
        local("2026-11-02T00:00:00"),
        "2026-11-01",
      ),
    ).toEqual({ start: 5, end: 23 });
  });
});
