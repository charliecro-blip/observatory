import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickLead, familyOf, bandOf, type LeadTestimony } from "../artifacts/tides/src/lib/lead";

/**
 * What leads the READ — and whether anything should.
 *
 * The state that matters most is `quiet`. An earlier draft always promoted a
 * dominant row, which would have broken the product's oldest commitment (never
 * manufacture significance on a quiet day) using the very feature meant to
 * sharpen the reading. These tests exist mostly to keep that from regressing.
 */

const t = (o: Partial<LeadTestimony> & { source: string }): LeadTestimony => ({
  note: o.source, salience: 0.5, weight: 1, polarity: 1, ...o,
});

describe("families are counted, not renderings", () => {
  it("maps every engine source to a family", () => {
    expect(familyOf("hour")).toBe("hour");
    expect(familyOf("dayRuler")).toBe("hour");
    expect(familyOf("moonAspect:Saturn")).toBe("moonAspect");
    expect(familyOf("moonSign")).toBe("moonCycle");
    expect(familyOf("phase")).toBe("moonCycle");
    expect(familyOf("aspect:Venus-Mars")).toBe("nonLunarAspect");
    expect(familyOf("sect")).toBe("chartCondition");
    expect(familyOf("transit:Saturn→Sun")).toBe("personal");
    expect(familyOf("voc")).toBe("voc");
  });

  it("does not let a named pattern become its own family", () => {
    // Patterns are DERIVED from other testimony. Counting one as an
    // independent voice is how "three testimonies agree" becomes a lie about
    // a single fact seen three ways.
    expect(familyOf("Void of course")).toBe("chartCondition");
    expect(familyOf("Saturn pressure")).toBe("chartCondition");
  });

  it("counts support by distinct family, never by line count", () => {
    // Four loud testimonies, but only two families besides the lead.
    const res = pickLead([
      t({ source: "moonAspect:Saturn", salience: 0.95, weight: 1.2, facts: { applying: true } }),
      t({ source: "hour", salience: 0.8, weight: 1.1 }),
      t({ source: "dayRuler", salience: 0.8, weight: 1.1 }),   // same family as hour
      t({ source: "phase", salience: 0.8, weight: 1.1 }),
      t({ source: "moonSign", salience: 0.8, weight: 1.1 }),   // same family as phase
    ]);
    expect(res.state).toBe("leads");
    if (res.state !== "leads") return;
    expect(new Set(res.support).size).toBe(res.support.length);   // no repeats
    // Ambient families cannot lead, but they can and should corroborate.
    expect(res.support).toEqual(expect.arrayContaining(["hour", "moonCycle"]));
    expect(res.support).not.toContain("moonAspect");             // that IS the lead
  });
});

describe("the three states are all reachable", () => {
  it("promotes a clear single voice", () => {
    const res = pickLead([
      t({ source: "moonAspect:Saturn", salience: 0.95, weight: 1.3, facts: { applying: true, orbDeg: 0.5 } }),
      t({ source: "phase", salience: 0.3, weight: 0.8 }),
    ]);
    expect(res.state).toBe("leads");
  });

  it("declines to promote anything when nothing is loud", () => {
    const res = pickLead([
      t({ source: "moonAspect:Venus", salience: 0.2, weight: 0.6 }),
      t({ source: "aspect:Mercury-Venus", salience: 0.15, weight: 0.7 }),
    ]);
    expect(res.state).toBe("quiet");
  });

  it("will not let ambient conditions alone lift a sky out of quiet", () => {
    // The measured failure that produced the ambient/event split: every moment
    // HAS a planetary hour, so if a dignified hour ruler could promote by
    // itself, whether a sky counted as quiet depended on which clock hour you
    // happened to sample. Ambient conditions are real and are still described —
    // they are just never the reason a day stops being quiet.
    const res = pickLead([
      t({ source: "hour", salience: 0.9, weight: 1.4 }),
      t({ source: "dayRuler", salience: 0.9, weight: 1.4 }),
      t({ source: "moonSign", salience: 0.9, weight: 1.4 }),
      t({ source: "phase", salience: 0.9, weight: 1.4 }),
      t({ source: "sect", salience: 0.9, weight: 1.4 }),
    ]);
    expect(res.state).toBe("quiet");
  });

  it("reports crosscurrents rather than picking a winner", () => {
    const res = pickLead([
      t({ source: "moonAspect:Mars", salience: 0.9, weight: 1.2, polarity: 1 }),
      t({ source: "aspect:Saturn-Neptune", salience: 0.88, weight: 1.2, polarity: -1 }),
    ]);
    expect(res.state).toBe("crosscurrents");
  });

  it("does NOT call same-family disagreement a crosscurrent", () => {
    // Two lunar aspects disagreeing is the Moon being complicated, not two
    // independent forces pulling apart.
    const res = pickLead([
      t({ source: "moonAspect:Jupiter", salience: 0.9, weight: 1.2, polarity: 1 }),
      t({ source: "moonAspect:Saturn", salience: 0.89, weight: 1.2, polarity: -1 }),
    ]);
    expect(res.state).toBe("leads");
  });

  it("treats an empty sky as quiet, not as an error", () => {
    expect(pickLead([]).state).toBe("quiet");
  });
});

describe("duration bands place rows on the spine", () => {
  it("puts the hour in Now and lunar aspects in Today", () => {
    expect(bandOf(t({ source: "hour" }))).toBe("now");
    expect(bandOf(t({ source: "moonAspect:Venus" }))).toBe("today");
  });

  it("splits non-lunar aspects by their own measured duration", () => {
    // The reason durationDays exists: a fast pair is this-stretch weather, a
    // slow one is the era. Neither should be guessed from the planet names.
    expect(bandOf(t({ source: "aspect:Mercury-Venus", facts: { durationDays: 27 } }))).toBe("stretch");
    expect(bandOf(t({ source: "aspect:Saturn-Neptune", facts: { durationDays: 214 } }))).toBe("background");
  });
});

describe("calibration holds against real ephemeris", () => {
  // One scan, shared by both assertions — a full dayReading per sample is
  // expensive, and computing it twice doubled the suite's runtime for nothing.
  let scan: { counts: Record<string, number>; qAvg: number; lAvg: number; n: number };

  beforeAll(async () => {
    const S: any = await import("../artifacts/api-server/src/lib/synthesis.js");
    const counts: Record<string, number> = { leads: 0, crosscurrents: 0, quiet: 0 };
    let qa = 0, la = 0, nq = 0, nl = 0, n = 0;
    // 40 days × 3 times of day. Enough to make the rates stable; small enough
    // that the suite stays fast.
    for (let d = 0; d < 40; d++) for (const h of [9, 15, 21]) {
      const r = S.dayReading(new Date(Date.UTC(2026, 7, 1 + d, h, 0, 0)), 40.7, -74.0, { tzOffsetMin: 300 });
      const res = pickLead(r.testimonies);
      counts[res.state]++; n++;
      const applying = r.testimonies.filter((x: any) => x.facts?.applying).length;
      if (res.state === "quiet") { qa += applying; nq++; }
      if (res.state === "leads") { la += applying; nl++; }
    }
    scan = { counts, qAvg: qa / Math.max(nq, 1), lAvg: la / Math.max(nl, 1), n };
  }, 60_000);

  it("keeps the three states in their intended proportions", () => {
    // Thresholds were set FROM this measurement, so this is a regression guard:
    // if the synthesis weights change, the rates drift and this fails loudly
    // rather than silently making "quiet" impossible again.
    const { counts, n } = scan;
    // Quiet must be a real minority — never zero (the original bug) and never
    // the norm (which would make the app useless).
    // Measured at the chosen thresholds: leads ~74%, cross ~7%, quiet ~20%,
    // and stable to ±3 points across three different sampling schemes.
    expect(counts.quiet / n, "quiet rate").toBeGreaterThan(0.08);
    expect(counts.quiet / n, "quiet rate").toBeLessThan(0.33);
    // Crosscurrents must stay notable rather than routine — but must not
    // vanish either, or the state is decorative.
    expect(counts.crosscurrents / n, "crosscurrent rate").toBeGreaterThan(0.01);
    expect(counts.crosscurrents / n, "crosscurrent rate").toBeLessThan(0.20);
    // A single clear lead should still be the ordinary case.
    expect(counts.leads / n, "lead rate").toBeGreaterThan(0.55);
  });

  it("calls quiet on genuinely quieter skies — a validity check, not just a rate", () => {
    // A percentile cut could hit its target rate while meaning nothing. This
    // asserts the states track something real: quiet moments carry fewer
    // applying aspects than moments with a clear lead.
    expect(scan.qAvg, "quiet skies should have fewer applying aspects").toBeLessThan(scan.lAvg);
  });
});

describe("bands found by looking at the rendered page", () => {
  it("does not file the day ruler under 'this hour'", () => {
    // Caught on screen: "Moon's day — tending and feeling" was labelled
    // `this hour`. It shares the hour FAMILY (both are planetary-rulership
    // testimony, so they must not count as two independent voices) but it
    // spans the whole day.
    expect(bandOf(t({ source: "dayRuler" }))).toBe("today");
    expect(bandOf(t({ source: "hour" }))).toBe("now");
    // Still one family, so support cannot be inflated by counting both.
    expect(familyOf("dayRuler")).toBe(familyOf("hour"));
  });
});

describe("the READ zone never repeats its own lead", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/tides/src/components/ReadZone.tsx"), "utf-8");

  it("excludes the lead from the duration stack", () => {
    // Caught on screen: the lead rendered under LED BY and again, verbatim,
    // as the `today` row two lines below — the exact duplication this zone
    // was built to end.
    expect(src).toMatch(/\.filter\(t => t\.source !== leadSource\)/);
  });

  it("keeps all three lead states renderable", () => {
    for (const state of ["LED BY", "MIXED CURRENT", "QUIET SKY"]) {
      expect(src, `${state} not rendered`).toContain(state);
    }
  });

  it("says 'no meaningful change' rather than inventing news", () => {
    // For an app opened several times a day, the honest answer is usually
    // that nothing moved.
    expect(src).toMatch(/No meaningful change since your last check/);
  });

  it("adds no network call — the reading is already on the page", () => {
    // Load time is a measured problem (27 requests per cold load at ~0.5s
    // TTFB each). This zone must stay derived from data already fetched.
    expect(src).not.toMatch(/fetch\(|useQuery/);
  });
});
