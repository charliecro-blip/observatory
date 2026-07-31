import { describe, it } from "vitest";
describe("election window edges", () => {
  it("checks boundaries against planetary hours and void spans", async () => {
    const E: any = await import("../artifacts/api-server/src/lib/electionEngine.js");
    const A: any = await import("../artifacts/api-server/src/lib/astro.js");
    const D: any = await import("../artifacts/api-server/src/lib/dayarc.js");
    const LAT = 30.27, LON = -97.74, TZ = 300;
    const start = new Date("2026-08-01T12:00:00Z");
    const res = E.computeElections({ activityKey: "negotiate", span: "week", lat: LAT, lon: LON, tzOffsetMin: TZ, natal: null, startAt: start });
    const wins = res.windows ?? res ?? [];
    console.log("windows returned:", wins.length);
    let worstEdge = 0, vocOverlaps = 0, checked = 0;
    for (const w of wins.slice(0, 25)) {
      const s = Date.parse(w.startAt), e = Date.parse(w.endAt);
      // Edge must coincide with a real planetary-hour boundary
      const ph = A.getPlanetaryHour(new Date(s + 1000), LAT, LON);
      worstEdge = Math.max(worstEdge, Math.abs(Date.parse(ph.startTime) - s) / 1000);
      // Must not overlap a void span (the engine filters these)
      const arc = D.computeDayArc(new Date(s), LAT, LON, TZ);
      for (const v of arc.vocWindows ?? []) {
        if (s < Date.parse(v.end) && Date.parse(v.start) < e) vocOverlaps++;
      }
      checked++;
    }
    console.log(`ELECTION EDGES  n=${checked}  worst edge vs planetary hour: ${worstEdge.toFixed(1)} sec  | windows overlapping a void: ${vocOverlaps}`);
  }, 180000);
});
