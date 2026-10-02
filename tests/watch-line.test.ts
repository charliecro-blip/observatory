import { describe, expect, it } from "vitest";
import { watchLine } from "../artifacts/tides/src/components/ReadZone";

describe("watchLine", () => {
  it("drops the word watch inside parentheses, keeping them whole", () => {
    // 2026-10-02: "(watch the short fuse, the rush)" printed as "(; the short fuse, the rush)".
    expect(watchLine("— though Mercury grinds against Mars (0.3° separating) — complicates effort and the decisive cut (watch the short fuse, the rush). Hold the day's shape loosely there."))
      .toBe("Mercury grinds against Mars (0.3° separating) — complicates effort and the decisive cut (the short fuse, the rush). Hold the day's shape loosely there.");
  });

  it("still turns a trailing watch clause into a semicolon", () => {
    expect(watchLine("— though Saturn presses the Moon; watch the mood going heavy"))
      .toBe("Saturn presses the Moon; the mood going heavy");
  });

  it("leaves a counterpoint without the word alone", () => {
    expect(watchLine("— though Venus opposes Saturn")).toBe("Venus opposes Saturn");
  });
});
