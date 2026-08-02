import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Saturn and Neptune take energy OUT of a day.
 *
 * Every aspect crest in dayarc was positive, scaled only by how "activating"
 * the planet is — so a tight Moon–Saturn square lifted the tide, just less
 * than a Moon–Mars square would. The model read "hard aspect" as "high charge"
 * and stopped, which is why an afternoon carrying a heavy Saturn contact
 * rendered as a peak. Reported live 2026-08-02: "why does the fire element
 * decrease in the afternoon even tho the moon enters aries… a day that
 * features strong neptune or saturn aspects in the middle of the day might
 * also be diminished in height."
 *
 * The tide still measures coherence/available energy, not favourability —
 * this says Saturn and Neptune REMOVE available energy on a hard contact,
 * which is a different claim from "Saturn days are bad."
 */
describe("dayarc dampeners", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/lib/dayarc.ts"), "utf-8");

  it("gives Saturn and Neptune negative arousal on hard contacts", () => {
    const block = src.match(/const DAMPENERS[^}]+}/)?.[0] ?? "";
    expect(block, "DAMPENERS table missing").toMatch(/Saturn/);
    expect(block).toMatch(/Neptune/);
    // Both must be negative — a positive value here silently restores the bug.
    const nums = [...block.matchAll(/-?\d*\.?\d+/g)].map(m => parseFloat(m[0]));
    expect(nums.length).toBeGreaterThan(0);
    for (const n of nums) expect(n).toBeLessThan(0);
  });

  it("applies the dampener only to hard aspects", () => {
    // A Moon–Saturn TRINE is genuinely steadying and must keep its lift;
    // dampening every Saturn contact would be the opposite error.
    expect(src).toMatch(/HARD_ASPECTS\s*=\s*new Set\(\["conjunction",\s*"square",\s*"opposition"\]\)/);
    expect(src).toMatch(/HARD_ASPECTS\.has\(p\.aspect\)\s*&&\s*DAMPENERS\[p\.planet\]/);
  });

  it("leaves the soft-aspect and non-dampener path on PLANET_AROUSAL", () => {
    // The fallback must still be the original table, not a blanket negative.
    expect(src).toMatch(/PLANET_AROUSAL\[p\.planet\]\s*\?\?\s*0\.5/);
  });

  it("produces a curve that actually varies across a real day", async () => {
    const D: any = await import("../artifacts/api-server/src/lib/dayarc.js");
    // A fixed date so this is reproducible; NYC.
    const arc = D.computeDayArc(new Date("2026-08-02T12:00:00Z"), 40.7, -74.0, 0);
    const es = arc.curve.map((p: any) => p.e);
    expect(es.length).toBeGreaterThan(10);
    const spread = Math.max(...es) - Math.min(...es);
    // A dead-flat curve means the shape terms cancelled out entirely — the
    // chart would be a straight line and tell the reader nothing.
    expect(spread).toBeGreaterThan(0.01);
    // And it must stay in range after signed crests were introduced.
    for (const e of es) { expect(e).toBeGreaterThanOrEqual(0); expect(e).toBeLessThanOrEqual(1); }
  });

  it("still reports the phase-driven floor that makes a new moon low", () => {
    // The owner asked whether new moon was integrated; it is, as the dominant
    // height term. Guard it so a refactor can't quietly drop it.
    expect(src).toMatch(/0\.50 \* illum/);
  });
});
