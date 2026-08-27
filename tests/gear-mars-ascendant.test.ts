import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The rules are a private const inside rhythmProposal, and currentGear needs a
// natal chart to reach them. These assert the doctrine that made the split
// worth doing, at the level the module actually exposes it.
const SRC = readFileSync("artifacts/api-server/src/lib/rhythmProposal.ts", "utf8");

describe("Mars to the Ascendant is its own rule", () => {
  it("no longer shares a reading with the Sun and natal Mars", () => {
    // Lumped together, the Ascendant inherited a line about drive and
    // decisions, when the tradition reads it as heat in the body.
    expect(SRC).not.toContain('natal: new Set(["Mars", "Sun", "Ascendant"])');
    expect(SRC).toContain('natal: new Set(["Ascendant"])');
    expect(SRC).toContain('natal: new Set(["Mars", "Sun"])');
  });

  it("is matched before the wider Mars rule, or it could never fire", () => {
    // currentGear returns the FIRST matching rule, so order is the whole
    // mechanism: a chart with Mars on the Ascendant matches both.
    const asc = SRC.indexOf('natal: new Set(["Ascendant"])');
    const sun = SRC.indexOf('natal: new Set(["Mars", "Sun"])');
    expect(asc).toBeGreaterThan(-1);
    expect(asc).toBeLessThan(sun);
  });

  it("says something about the body, not only about the task list", () => {
    const line = SRC.split("\n").find(l => l.includes("you run hotter than usual"))!;
    expect(line).toBeTruthy();
    expect(line).toMatch(/exercise|physical|body|hotter/);
  });

  it("carries one concrete suggestion", () => {
    expect(SRC).toContain("suggest:");
    const s = SRC.split("\n").find(l => l.trim().startsWith("suggest:"))!;
    expect(s).toMatch(/workout|walk/);
  });

  it("drops the machine metaphor the reading used to open with", () => {
    expect(SRC).not.toContain("your action gear is louder");
  });

  it("still promises no outcome", () => {
    // House rule: describe conditions, never promise results.
    const lines = SRC.split("\n").filter(l => l.trim().startsWith('reading: "'));
    expect(lines.length).toBeGreaterThanOrEqual(5);   // the type decl must not be one of them
    for (const l of SRC.split("\n").filter(l => l.trim().startsWith('reading: "'))) {
      expect(l, l).not.toMatch(/\bwill\b|guarantee|best time|you'll|ensures/i);
      expect(l, l).toMatch(/tend to|tends to/);
    }
  });
});
