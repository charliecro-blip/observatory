import { describe, it, expect } from "vitest";
import { PAIR_MEANINGS, pairKey, PLANET_ORDER } from "../artifacts/tides/src/lib/aspectMeanings.js";

const ALL = Object.entries(PAIR_MEANINGS).flatMap(([k, v]) =>
  (["meaning", "conj", "soft", "hard"] as const).map(f => ({ where: `${k}.${f}`, text: v[f] })),
);

describe("aspect copy holds its register", () => {
  it("covers every pair with all four readings", () => {
    expect(ALL.length).toBe(24 * 4);
    // `meaning` names the pair in a breath ("Force meets resistance.") — a
    // floor tuned to the three readings would have flagged the best of them.
    expect(ALL.filter(x => x.text.length < (x.where.endsWith(".meaning") ? 15 : 40))).toEqual([]);
  });

  // The specific shapes the old table had. Each is a real pattern from the
  // no-ai-slop rules, not a taste preference — and each one was actually
  // present before the rewrite, which is why they are worth pinning.
  const BANNED: [string, RegExp][] = [
    ["Excellent-for opener", /\bexcellent for\b/i],
    ["abstract noun is elevated", /\b(is|are) (elevated|heightened)\b/i],
    ["banned vocabulary", /\b(transformative|effortless|robust|leverage|harness|elevate|holistic|seamless|unlock)\b/i],
    ["importance puffery", /\b(a testament to|underscor\w+|pivotal|vital role)\b/i],
    ["superficial -ing analysis", /, (highlighting|underscoring|reflecting|showcasing) /i],
    ["binary contrast", /\bit'?s not (just )?\w[^.]{0,40}[,.] it'?s\b/i],
  ];

  for (const [name, re] of BANNED) {
    it(`has no ${name}`, () => {
      expect(ALL.filter(x => re.test(x.text)).map(x => `${x.where}: ${x.text}`)).toEqual([]);
    });
  }

  // "Good for X, Y, or Z" was the old table's default sentence. One or two is
  // natural writing; fourteen is a template. Cap it well below the old count so
  // the shape cannot quietly return one entry at a time.
  it("does not resolve into three-item lists by default", () => {
    const tricolon = ALL.filter(x => /\b\w+, \w[\w\s]*, (or |and )\w/.test(x.text));
    expect(tricolon.length).toBeLessThanOrEqual(6);
  });

  // What actually made the old table read as generated was TEMPLATE: the same
  // sentence shape reused across unrelated skies, "Excellent for …" fourteen
  // times over. That is measurable; "is this advice actionable" is not, and an
  // earlier version of this test faked it by grepping a hand-written verb list
  // — a check that would have passed a table of pure mood description as long
  // as the words happened to appear.
  it("does not reuse an opening shape", () => {
    const counts = new Map<string, string[]>();
    for (const x of ALL) {
      if (x.where.endsWith(".meaning")) continue;
      const opener = x.text.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
      counts.set(opener, [...(counts.get(opener) ?? []), x.where]);
    }
    expect([...counts].filter(([, w]) => w.length > 2)).toEqual([]);
  });

  it("builds the same key from either planet order", () => {
    expect(pairKey("Saturn", "Moon")).toBe("Moon|Saturn");
    expect(pairKey("Moon", "Saturn")).toBe("Moon|Saturn");
    for (const k of Object.keys(PAIR_MEANINGS)) {
      const [a, b] = k.split("|");
      expect(PLANET_ORDER.indexOf(a)).toBeLessThan(PLANET_ORDER.indexOf(b));
      expect(pairKey(b, a)).toBe(k);
    }
  });
});
