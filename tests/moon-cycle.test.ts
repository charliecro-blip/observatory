import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Where the Moon is in its month.
 *
 * The hero drew a sine wave labelled LOW · RISING · HIGH · EBB · LOW with a
 * marker on it. The owner asked the question that ended it — "what is the
 * cycle?" — and there wasn't one: the wave came from Math.sin and the marker
 * was a five-way lookup from a categorical tide level, so it could only jump
 * between five fixed stops on a period nothing computed.
 *
 * The replacement is a real position in a real period. These tests exist to
 * keep it real: the value must move continuously, complete exactly one turn
 * per synodic month, and above all distinguish waxing from waning — the thing
 * illumination alone cannot do, and therefore the reason the angle is the
 * source rather than the brightness.
 */

const SYNODIC = 29.530588;

function cyclePos(astro: any, at: Date): number {
  const jd = astro.julianDay(at);
  const sun = astro.getPlanetPositions(jd).find((p: any) => p.planet === "Sun")!.longitude;
  const moon = astro.getPlanetPositions(jd).find((p: any) => p.planet === "Moon")!.longitude;
  const elong = (((moon - sun) % 360) + 360) % 360;
  return elong / 360;
}

describe("the cycle position is a real position in a real period", () => {
  let astro: any;
  beforeAll(async () => { astro = await import("../artifacts/api-server/src/lib/astro.js"); }, 60_000);

  it("distinguishes first quarter from last quarter", () => {
    // THE test. Both are ~50% lit, so illumination cannot tell them apart —
    // which is precisely why a brightness-driven marker could never be an
    // honest cycle indicator. Position must put them half a month apart.
    const samples: Array<{ pos: number; frac: number }> = [];
    for (let d = 0; d < 40; d++) {
      const at = new Date(Date.UTC(2026, 7, 1 + d, 12, 0, 0));
      samples.push({ pos: cyclePos(astro, at), frac: astro.moonPhase(astro.julianDay(at)).fraction });
    }
    const halfLit = samples.filter((s) => Math.abs(s.frac - 0.5) < 0.06);
    expect(halfLit.length, "no half-lit days in 40").toBeGreaterThan(1);
    const first = halfLit.filter((s) => s.pos < 0.5);
    const last = halfLit.filter((s) => s.pos > 0.5);
    expect(first.length, "no first-quarter sample").toBeGreaterThan(0);
    expect(last.length, "no last-quarter sample").toBeGreaterThan(0);
    // Same brightness, opposite halves of the month.
    for (const f of first) expect(f.pos).toBeGreaterThan(0.15);
    for (const f of first) expect(f.pos).toBeLessThan(0.35);
    for (const l of last) expect(l.pos).toBeGreaterThan(0.65);
    for (const l of last) expect(l.pos).toBeLessThan(0.85);
  });

  it("puts the full Moon at the halfway mark", () => {
    let best = { pos: 0, frac: 0 };
    for (let d = 0; d < 40; d++) {
      const at = new Date(Date.UTC(2026, 7, 1 + d, 12, 0, 0));
      const frac = astro.moonPhase(astro.julianDay(at)).fraction;
      if (frac > best.frac) best = { pos: cyclePos(astro, at), frac };
    }
    expect(best.frac).toBeGreaterThan(0.97);
    expect(Math.abs(best.pos - 0.5), `fullest day sat at ${best.pos}`).toBeLessThan(0.03);
  });

  it("advances continuously rather than jumping between stops", () => {
    // The old marker had five reachable values. This must take many.
    const seen = new Set<string>();
    for (let h = 0; h < 24 * 10; h += 6) {
      seen.add(cyclePos(astro, new Date(Date.UTC(2026, 7, 1, h, 0, 0))).toFixed(3));
    }
    expect(seen.size).toBeGreaterThan(30);
  });

  it("completes exactly one turn per synodic month", () => {
    // A cycle that drifts is not a cycle. One synodic month later the Moon
    // must be back where it started.
    const t0 = new Date(Date.UTC(2026, 7, 1, 12, 0, 0));
    const t1 = new Date(t0.getTime() + SYNODIC * 86400000);
    const a = cyclePos(astro, t0), b = cyclePos(astro, t1);
    const gap = Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
    expect(gap, `drifted ${gap.toFixed(3)} of a cycle`).toBeLessThan(0.02);
  });

  it("increases monotonically within a cycle, wrapping only at new Moon", () => {
    let wraps = 0, prev = cyclePos(astro, new Date(Date.UTC(2026, 7, 1, 0, 0, 0)));
    for (let h = 6; h < 24 * 30; h += 6) {
      const p = cyclePos(astro, new Date(Date.UTC(2026, 7, 1, h, 0, 0)));
      if (p < prev) { wraps++; expect(prev).toBeGreaterThan(0.9); expect(p).toBeLessThan(0.1); }
      prev = p;
    }
    expect(wraps, "should wrap exactly once in 30 days").toBe(1);
  });
});

/**
 * Strip comments before asserting a string is absent.
 *
 * The first run failed on this file's own explanation: the comment describing
 * why "not a graph of the day" was removed contains that phrase. A source-text
 * test that cannot tell code from prose about the code will fail every time
 * someone documents a removal properly.
 */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("the cycle bar no longer draws what it cannot compute", () => {
  // The hero that drew this retired with the Today page (2026-08-19); the bar
  // moved to Calendar, which is where a position in a period belongs. The
  // claims are unchanged — they were never about which page drew it.
  const src = stripComments(readFileSync(
    join(process.cwd(), "artifacts/tides/src/components/LunarCycle.tsx"), "utf-8"));

  it("has no invented sine wave and no five-way marker lookup", () => {
    expect(src).not.toMatch(/Math\.sin\(Math\.PI \* x/);
    expect(src).not.toMatch(/tide\?\.level === "rising" \? 0\.28/);
  });

  it("dropped the disclaimer instead of keeping the picture that needed one", () => {
    // "not a graph of the day" printed under a graph is an admission that the
    // picture is lying and a request to be forgiven for it. The owner's call:
    // if it needs that caption, the design is wrong.
    expect(src).not.toMatch(/not a graph of the day/);
    expect(src).not.toMatch(/WHERE IN THE CYCLE/);
  });

  it("reads the angle rather than the brightness", () => {
    expect(src).toMatch(/moonCycle/);
    expect(src).toMatch(/mc\.position/);
  });
});

describe("the server exposes the cycle without a new request", () => {
  const src = readFileSync(
    join(process.cwd(), "artifacts/api-server/src/routes/tides.ts"), "utf-8");

  it("rides on /tides/now, which the page already fetches", () => {
    // The spec's standing constraint: the dashboard must assemble from
    // /api/tides/now. Adding an endpoint would worsen a measured load problem.
    expect(src).toMatch(/const moonCycle = \{/);
    expect(src).toMatch(/^\s*moonCycle,$/m);
  });

  it("derives position from elongation, not from illumination", () => {
    expect(src).toMatch(/elongation \/ 360/);
  });

  it("shares one approach vocabulary with the week chart", () => {
    // Two surfaces naming the same lunar stretch differently is how the week
    // caption came to contradict its own day labels. Same six words here.
    for (const w of ["initiate", "build", "refine", "release", "consolidate", "recover"]) {
      expect(src, `approach "${w}" missing`).toContain(`"${w}"`);
    }
  });
});
