import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";

/**
 * EPISODES, not rows.
 *
 * "214 convergent windows a month" was never the product unit. One Moon–Mercury
 * configuration emits a row for first-draft, edit-revise, deep-study,
 * correspondence, research and planning — six rows, one moment. What a person
 * experiences is the moment.
 *
 * So windows are merged into episodes when they share an anchor (date + the
 * same establishing families) and their intervals overlap. Reported both ways,
 * because the raw count still measures engine coverage even though it badly
 * misdescribes the experience.
 */
describe("convergence episodes", () => {
  it("counts moments rather than rows, whole-engine and per palette", () => {
    const natal: any = computeNatalChart("1992-01-03", "17:37", 29.4246, -98.49514, -6, "whole-sign");
    // Representative palettes rather than random subsets — a real life
    // clusters, and clustered significators behave very differently from a
    // random five.
    const PALETTES: Record<string, string[]> = {
      "creative-independent": ["first-draft", "edit-revise", "deep-work", "publish", "network", "deep-rest"],
      "practitioner": ["teach-present", "deep-study", "first-draft", "admin-errands", "investigate", "retreat"],
      "relationship-home": ["hard-conversation", "intimacy", "host", "deep-clean", "call-family", "deep-rest"],
      "type-a-professional": ["strategize", "deep-work", "negotiate", "teach-present", "train-hard", "organize"],
    };
    const MONTHS = [
      { name: "aug-eclipse", start: new Date(Date.UTC(2026, 7, 3, 12)) },
      { name: "oct-ordinary", start: new Date(Date.UTC(2026, 9, 15, 12)) },
    ];

    type Row = { key: string; date: string; startAt: string; endAt: string; est: string[] };
    const out: any[] = [];

    for (const m of MONTHS) {
      const convergent: Row[] = [];
      let rawSupported = 0;
      for (const act of ACTIVITIES) {
        const r = computeElections({
          activityKey: act.key, span: "month",
          lat: 29.4246, lon: -98.49514, tzOffsetMin: 300, natal, startAt: m.start,
        });
        if (!r) continue;
        for (const w of r.windows) {
          if (w.supportLevel !== "convergent") { rawSupported++; continue; }
          convergent.push({ key: act.key, date: w.date, startAt: w.startAt, endAt: w.endAt,
                            est: [...w.establishingFamilies].sort() });
        }
      }
      // Merge on anchor + overlap.
      const episodes = (rows: Row[]) => {
        const byAnchor = new Map<string, Row[]>();
        for (const r of rows) {
          const k = `${r.date}|${r.est.join(",")}`;
          (byAnchor.get(k) ?? byAnchor.set(k, []).get(k)!).push(r);
        }
        let n = 0;
        for (const group of byAnchor.values()) {
          const sorted = [...group].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
          let end = -Infinity;
          for (const r of sorted) {
            const s = Date.parse(r.startAt);
            if (s > end) { n++; end = Date.parse(r.endAt); }
            else end = Math.max(end, Date.parse(r.endAt));
          }
        }
        return n;
      };

      const row: any = {
        month: m.name,
        rawSupported,
        rawConvergentWindows: convergent.length,
        convergenceEpisodes: episodes(convergent),
        distinctEpisodeDays: new Set(convergent.map(r => r.date)).size,
        palettes: {} as Record<string, any>,
      };
      for (const [name, keys] of Object.entries(PALETTES)) {
        const mine = convergent.filter(r => keys.includes(r.key));
        const eps = episodes(mine);
        row.palettes[name] = {
          rawWindows: mine.length,
          episodes: eps,
          episodesPerWeek: parseFloat((eps / (30 / 7)).toFixed(2)),
        };
      }
      out.push(row);
      console.log(`${m.name}: raw=${row.rawConvergentWindows} episodes=${row.convergenceEpisodes} days=${row.distinctEpisodeDays}`);
      for (const [n, v] of Object.entries(row.palettes)) {
        console.log(`   ${n}: ${(v as any).episodes} episodes = ${(v as any).episodesPerWeek}/week`);
      }
    }
    mkdirSync("tools/out", { recursive: true });
    writeFileSync("tools/out/convergence-episodes.json", JSON.stringify(out, null, 2));
    expect(out.length).toBe(2);
  }, 1_800_000);
});
