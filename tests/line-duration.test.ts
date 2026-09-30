import { describe, expect, it } from "vitest";
import { minutesInLine } from "../artifacts/api-server/src/lib/lineDuration";

describe("minutesInLine", () => {
  it("reads the durations people actually write", () => {
    expect(minutesInLine("study for herbs, 90 min")).toBe(90);
    expect(minutesInLine("make dr’s appt (20 min)")).toBe(20);
    expect(minutesInLine("read stats books 2h")).toBe(120);
    expect(minutesInLine("write the report ~1.5 hours")).toBe(90);
    expect(minutesInLine("record transcript 1h30")).toBe(90);
    expect(minutesInLine("deep work 2 hr 15 min")).toBe(135);
    expect(minutesInLine("go for a 45 min run")).toBe(45);
    expect(minutesInLine("call mom for half an hour")).toBe(30);
    expect(minutesInLine("an hour and a half of qigong")).toBe(90);
  });

  it("leaves lines with no duration, or a range, to the default", () => {
    expect(minutesInLine("reply to the landlord")).toBeNull();
    expect(minutesInLine("film Animal series")).toBeNull();
    expect(minutesInLine("clean the garage 1-2h")).toBeNull();
    expect(minutesInLine("write 2 to 3 hours")).toBeNull();
  });

  it("does not read a number that is not a duration", () => {
    expect(minutesInLine("study for herbs 2")).toBeNull();
    expect(minutesInLine("buy 3 lemons")).toBeNull();
    expect(minutesInLine("email 5 mentors")).toBeNull();
  });

  it("keeps an estimate inside the planner's range", () => {
    expect(minutesInLine("retreat 12 hours")).toBe(480);
  });
});
