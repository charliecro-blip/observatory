import { describe, it, expect } from "vitest";
import { dayReading, readingSubject } from "../artifacts/api-server/src/lib/synthesis.js";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal.js";

/**
 * THE SUBJECT — the body running the moment (workshop, 2026-08-21).
 *
 * The owner read a panel in which five of the eight strongest testimonies were
 * Venus and the interface never said her name as a subject: it split her across
 * three duration bands in three grammars. These pin the finding, the threshold's
 * FIRE RATE (a subject that fires daily is a label; one that never fires is a
 * curiosity), and the end of the tautology that made the lead line restate its
 * own subject.
 *
 * Anchored to a fixed instant and a fixed chart — never the live sky.
 */
const natal = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.4951, -6, "whole-sign");
const NF = {
  planets: natal.planets.map(p => ({ planet: p.planet, longitude: p.longitude })),
  asc: natal.ascendant.longitude, mc: natal.midheaven.longitude,
};
const AT = new Date("2026-08-21T18:30:00Z");
const SAN_ANTONIO = [29.4246, -98.4951] as const;
const read = (at: Date) => dayReading(at, SAN_ANTONIO[0], SAN_ANTONIO[1], { natal: NF } as never);

describe("the reading's subject", () => {
  it("names Venus on the evening the owner flagged, with the ways she pulls", () => {
    const s = read(AT).subject;
    expect(s).toBeTruthy();
    expect(s!.planet).toBe("Venus");
    expect(s!.count).toBeGreaterThanOrEqual(4);
    expect(s!.ofTop).toBe(8);
    expect(s!.supports).toContain("your sense of yourself");
    expect(s!.presses).toContain("your need for room");
    expect(s!.against).toContain("Saturn");
    expect(s!.gift).toBeTruthy();
    expect(s!.shadow).toBeTruthy();
  });

  it("fires on roughly a third of moments, and not always on the Moon", () => {
    // The Moon is in every reading by construction (her sign, the phase), so a
    // share computed over ALL testimonies made her the subject on 72% of days.
    // Structural sources are excluded from both sides of the arithmetic; this
    // guards that fix by measuring the outcome, not the code.
    const start = Date.UTC(2026, 7, 21, 18, 0);
    const subjects = Array.from({ length: 120 }, (_, d) => read(new Date(start + d * 86400000)).subject);
    const fired = subjects.filter(Boolean);
    const rate = fired.length / subjects.length;
    expect(rate, `fire rate ${(rate * 100).toFixed(0)}%`).toBeGreaterThan(0.2);
    expect(rate, `fire rate ${(rate * 100).toFixed(0)}%`).toBeLessThan(0.5);
    const planets = new Set(fired.map(s => s!.planet));
    expect(planets.size, `only ${[...planets].join(", ")} ever lead`).toBeGreaterThanOrEqual(4);
    const moonShare = fired.filter(s => s!.planet === "Moon").length / fired.length;
    expect(moonShare, "the Moon has taken the subject over").toBeLessThan(0.7);
  });

  it("no transit line restates its own subject", () => {
    // "Venus strikes sparks with your sense of yourself (1.9°) — support for
    // your sense of yourself" named the natal point twice and added one
    // valence word. The second half now carries the transiting planet's own
    // gift or shadow, which is information the first half did not hold.
    const start = Date.UTC(2026, 7, 21, 18, 0);
    for (let d = 0; d < 40; d++) {
      for (const t of read(new Date(start + d * 86400000)).testimonies) {
        if (!t.source.startsWith("transit:")) continue;
        const [head, tail] = t.note.split(" — ");
        if (!tail) continue;
        const target = tail.replace(/^watch /, "").trim();
        expect(head.includes(target), `restates its subject: ${t.note}`).toBe(false);
        expect(t.note, t.note).not.toMatch(/support for|pressure on/);
      }
    }
  });

  it("returns nothing when no body carries enough", () => {
    expect(readingSubject([])).toBeUndefined();
  });
});
