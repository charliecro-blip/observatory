import { describe, it, expect } from "vitest";
import { associateDeterministic } from "../artifacts/api-server/src/lib/associate";

// A title with no keyword and no matching activity, so only the shape can speak.
const MUTE = "zzq frobnicate the widget";

describe("nothing is a real answer", () => {
  it("returns no element when nothing points anywhere", () => {
    // It used to return "earth" and apologise. The owner caught that twice:
    // once as a whole list coming back identical, and again on 2026-08-31.
    const a = associateDeterministic(MUTE);
    expect(a.element).toBeNull();
    expect(a.planets).toEqual([]);
    expect(a.source).toBe("none");
  });

  it("asks instead of defaulting", () => {
    const a = associateDeterministic(MUTE);
    expect(a.rationale).not.toMatch(/earth/i);
    expect(a.rationale).toMatch(/pick an element/i);
  });

  it("says nothing rather than something for an ordinary-length task", () => {
    // 45 minutes is what a MISSING estimate becomes, so the middle band has to
    // stay silent or the default gets laundered into a finding.
    for (const minutes of [30, 45, 60, 75]) {
      const a = associateDeterministic(MUTE, { minutes, energy: "medium" });
      expect(a.element, `${minutes} min`).toBeNull();
    }
  });
});

describe("a task's own shape, when its words say nothing", () => {
  it("reads a very short task as Mercury", () => {
    const a = associateDeterministic(MUTE, { minutes: 10, energy: "medium" });
    expect(a.planets).toContain("Mercury");
    expect(a.source).toBe("shape");
  });

  it("reads a long task as Saturn, and a stretch as Jupiter", () => {
    expect(associateDeterministic(MUTE, { minutes: 180, energy: "medium" }).planets).toContain("Saturn");
    expect(associateDeterministic(MUTE, { minutes: 100, energy: "medium" }).planets).toContain("Jupiter");
  });

  it("reads high energy as Mars and low as the Moon", () => {
    expect(associateDeterministic(MUTE, { energy: "high" }).planets[0]).toBe("Mars");
    expect(associateDeterministic(MUTE, { energy: "low" }).planets[0]).toBe("Moon");
  });

  it("lets stated energy lead a machine-guessed duration", () => {
    // "high" is something a person said about the work; the estimate is often
    // a default. Both are kept, energy first.
    const a = associateDeterministic(MUTE, { minutes: 180, energy: "high" });
    expect(a.planets[0]).toBe("Mars");
    expect(a.planets).toContain("Saturn");
  });

  it("treats medium energy as no opinion, not as a middle", () => {
    const a = associateDeterministic(MUTE, { minutes: 45, energy: "medium" });
    expect(a.source).toBe("none");
  });

  it("takes its element from the planet it named", () => {
    const a = associateDeterministic(MUTE, { energy: "high" });
    expect(a.element).toBe("fire");           // Mars
    expect(associateDeterministic(MUTE, { energy: "low" }).element).toBe("water"); // Moon
  });

  it("says which signal spoke, and that it was the shape", () => {
    const a = associateDeterministic(MUTE, { minutes: 10, energy: "medium" });
    expect(a.rationale).toMatch(/read from its shape/i);
    expect(a.rationale).toContain("10 minutes");
  });
});

describe("the stronger signals still win", () => {
  it("prefers a matched activity over the shape", () => {
    const a = associateDeterministic("write a first draft of the report", { minutes: 5, energy: "low" });
    expect(a.source).toBe("correspondence");
    expect(a.activityKey).toBe("first-draft");
  });

  it("prefers keywords over the shape", () => {
    const a = associateDeterministic("a hard workout at the gym", { minutes: 5, energy: "low" });
    expect(["correspondence", "keywords"]).toContain(a.source);
    expect(a.element).not.toBeNull();
  });
});
