import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine.js";

// Does the "real testimony" floor leave a usable module, or does it empty it?
// Measured rather than assumed: a floor that silences Home 90% of the time
// would be a worse failure than the noise it removes.
const KEYS = ["deep-work","first-draft","sign-contract","hard-training","long-run","difficult-conversation","admin-batch","study-session"];
const has = (w: any) =>
  (w.establishingFamilies ?? []).length > 0 || (w.families ?? []).some((f: string) => f !== "planetary-time");

describe("lines-up fire rate", () => {
  it("reports how often a held item gets a headline-worthy window", () => {
    let days = 0, itemDays = 0, withAny = 0, withReal = 0, convergent = 0;
    const seen = new Set<string>();
    const base = Date.UTC(2026, 7, 5, 12, 0, 0);
    for (let d = 0; d < 30; d++) {
      days++;
      for (const k of KEYS) {
        itemDays++;
        const out = computeElections({
          activityKey: k, span: "day", lat: 30.27, lon: -97.74, tzOffsetMin: 300,
          natal: null, timeKnown: true, locationKnown: true,
          startAt: new Date(base + d * 86400000),
        });
        for (const w of out?.windows ?? []) seen.add((w as any).date);
        const ws = (out?.windows ?? []).filter((w: any) => w.suitability !== "defer");
        if (ws.length) withAny++;
        if (ws.some(has)) withReal++;
        if (ws.some((w: any) => w.supportLevel === "convergent")) convergent++;
      }
    }
    const pct = (n: number) => `${((n / itemDays) * 100).toFixed(1)}%`;
    const report = [
      `days=${days} item-days=${itemDays} distinct-days-seen=${seen.size}`,
      `any non-defer window : ${pct(withAny)}`,
      `passes the floor     : ${pct(withReal)}   <-- what Home shows`,
      `convergent           : ${pct(convergent)}`,
    ].join("\n");
    writeFileSync("/tmp/linesup-fire.txt", report);
    // The harness must prove it actually varied the day. A `now` option that
    // the engine ignores would have measured one day thirty times and reported
    // it as a rate — the same defect as measuring through a capped endpoint.
    expect(seen.size).toBe(days);
  });
});
