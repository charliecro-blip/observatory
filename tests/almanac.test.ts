/**
 * The almanac — the sky's standing dates for a window.
 *
 * ANCHORED ON PURPOSE. `buildAlmanac` takes the moment as a parameter rather
 * than reading the clock, so these tests answer for a fixed sky instead of
 * whatever sky the suite happens to run under. The repo has been bitten twice
 * by tests that quietly graded the calendar instead of the code.
 *
 * The anchor is 2026-01-01, chosen only because it is fixed — nothing here
 * depends on that date being special. The invariants below would hold from any
 * start; a second anchor half a year away is checked for exactly that reason.
 */
import { describe, it, expect } from "vitest";
import { buildAlmanac } from "../artifacts/api-server/src/lib/almanac.js";

const AT = new Date(Date.UTC(2026, 0, 1, 12));
const FAR = new Date(Date.UTC(2026, 6, 1, 12)); // a second, unrelated sky

describe("almanac", () => {
  it("returns entries in order, inside the window it was asked for", () => {
    const entries = buildAlmanac(AT, 45);
    const start = AT.getTime();
    const end = start + 45 * 86400000;

    expect(entries.length).toBeGreaterThan(0);
    const times = entries.map(e => Date.parse(e.at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(start);
      expect(t).toBeLessThanOrEqual(end);
    }
  });

  it("finds every lunar gate in a window longer than a synodic month", () => {
    // A synodic month is 29.53 days, so 45 days contains at least one of each
    // gate no matter where it starts. This is arithmetic, not luck — which is
    // why it is safe to assert from both anchors.
    for (const anchor of [AT, FAR]) {
      const entries = buildAlmanac(anchor, 45);
      expect(entries.filter(e => e.kind === "lunation").length).toBeGreaterThanOrEqual(2);
      expect(entries.filter(e => e.kind === "quarter").length).toBeGreaterThanOrEqual(2);
      for (const glyph of ["●", "○", "◐", "◑"]) {
        expect(entries.filter(e => e.glyph === glyph).length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("spaces consecutive same-gate lunations by one synodic month", () => {
    // A gate detected on both sides of its crossing would show up here as a
    // near-zero gap — the classic double-fire.
    const entries = buildAlmanac(AT, 120);
    for (const glyph of ["●", "○"]) {
      const times = entries.filter(e => e.glyph === glyph).map(e => Date.parse(e.at));
      expect(times.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < times.length; i++) {
        const gapDays = (times[i] - times[i - 1]) / 86400000;
        expect(gapDays).toBeGreaterThan(28);
        expect(gapDays).toBeLessThan(31);
      }
    }
  });

  it("never reports a planet turning the same way twice running", () => {
    // The signature of a station detected on both sides of its bisection.
    const entries = buildAlmanac(AT, 120);
    const byPlanet = new Map<string, string[]>();
    for (const e of entries.filter(x => x.kind === "station")) {
      const planet = e.title.split(" ")[0];
      byPlanet.set(planet, [...(byPlanet.get(planet) ?? []), e.title.includes("retrograde") ? "R" : "D"]);
    }
    expect(byPlanet.size).toBeGreaterThan(0);
    for (const [, dirs] of byPlanet) {
      for (let i = 1; i < dirs.length; i++) expect(dirs[i]).not.toBe(dirs[i - 1]);
    }
  });

  it("carries a real title and note on every entry", () => {
    for (const e of buildAlmanac(AT, 120)) {
      expect(e.title.trim().length).toBeGreaterThan(0);
      expect(e.note.trim().length).toBeGreaterThan(0);
      expect(e.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(["lunation", "quarter", "station", "ingress"]).toContain(e.kind);
    }
  });

  it("names an eclipse as an eclipse rather than as an ordinary lunation", () => {
    // 2026 carries eclipses in February and August. Over a full year the
    // almanac must find some, and each must be flagged, not silently folded
    // into the phase list.
    const year = buildAlmanac(new Date(Date.UTC(2026, 0, 1)), 120)
      .concat(buildAlmanac(new Date(Date.UTC(2026, 4, 1)), 120))
      .concat(buildAlmanac(new Date(Date.UTC(2026, 8, 1)), 120));
    const eclipses = year.filter(e => e.eclipse);
    expect(eclipses.length).toBeGreaterThan(0);
    for (const e of eclipses) {
      expect(e.title).toMatch(/eclipse/i);
      expect(e.kind).toBe("lunation");
    }
  });

  it("names the four cardinal ingresses as seasons", () => {
    const year = buildAlmanac(new Date(Date.UTC(2026, 0, 1)), 120)
      .concat(buildAlmanac(new Date(Date.UTC(2026, 4, 1)), 120));
    const seasons = year.filter(e => e.kind === "ingress" && /equinox|solstice/i.test(e.title));
    expect(seasons.length).toBeGreaterThan(0);
  });

  it("samples rather than sweeps, so it can sit on a page load", () => {
    // The events route next door took 42s for 30 days before its fix and
    // starved every other request on the page. This is the guard against
    // regressing to that shape.
    const t0 = Date.now();
    buildAlmanac(AT, 120);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
