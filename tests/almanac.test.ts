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
import { scoreElection } from "../artifacts/api-server/src/lib/inceptionElection.js";

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

/**
 * THE LENS — the almanac's second axis, and the only half that has an opinion.
 *
 * /tides/almanac says what the sky does; /tides/almanac/lens says what a run of
 * days is good FOR, one scoreElection call per day. Anchored for the same
 * reason as everything above: a lens graded against the live sky would be a
 * test of the week rather than of the code.
 */
describe("the almanac lens", () => {
  const LAT = 30.27, LON = -97.74;
  const scan = (from: Date, days: number, category: string) =>
    Array.from({ length: days }, (_, i) => {
      const at = new Date(from);
      at.setUTCDate(from.getUTCDate() + i);
      return scoreElection(at, LAT, LON, category);
    });

  it("does not grade every day the same — it discriminates, or it is decoration", () => {
    // A lens that says "strong" every day is a calendar with no opinion, and a
    // lens that says "avoid" every day is a guilt ledger. Both are failures of
    // the same kind: the verdict has to vary with the sky.
    const verdicts = new Set(scan(AT, 30, "creative_launch").map(r => r.verdict));
    expect(verdicts.size, `only ${[...verdicts]} across 30 days`).toBeGreaterThan(1);
  });

  it("refuses some days, and can say why", () => {
    const refused = scan(AT, 30, "creative_launch").filter(r => r.verdict === "avoid");
    expect(refused.length, "nothing refused in a month").toBeGreaterThan(0);
    for (const r of refused) {
      const failed = r.rules.filter(x => !x.passed && x.severity !== "support");
      expect(failed.length, `refused ${r.date} with no reason to give`).toBeGreaterThan(0);
      for (const f of failed) expect(f.label.trim()).not.toBe("");
    }
  });

  it("two different questions do not get the same answer", () => {
    // The lens is worth having only if the category changes the verdict. Same
    // days, same place, different question.
    const a = scan(AT, 30, "creative_launch").map(r => r.verdict);
    const b = scan(AT, 30, "financial_venture").map(r => r.verdict);
    expect(a.join("|"), "every category grades identically").not.toBe(b.join("|"));
  });

  it("holds from an unrelated sky too", () => {
    const verdicts = new Set(scan(FAR, 30, "conversation").map(r => r.verdict));
    expect(verdicts.size).toBeGreaterThan(1);
  });

  it("stays affordable — this is the reason it uses scoreElection at all", () => {
    // Measured at ~32ms/day when written. The ceiling is deliberately loose:
    // it exists to catch a regression that makes the lens a loop of window
    // searches again, not to police normal variance. This repo has shipped a
    // 42-second election scan and a 90-second calendar request.
    const t0 = Date.now();
    scan(AT, 30, "creative_launch");
    expect(Date.now() - t0, "a 30-day lens should stay near a second").toBeLessThan(8000);
  });
});
