/**
 * WHICH RULE MAKES A WINDOW PERSONAL? (2026-10-07)
 *
 * The calibration harness counts personal windows; this says which testimony
 * put each one there, by reading the "personal" evidence lines, and counts the
 * windows where one class is the ONLY personal testimony (what removing or
 * tightening that rule would change). Evidence-only lines (the personal day and
 * hour, the rising sign, a natal planet on an angle) are listed but never make
 * a window personal. Same sample as natal-resonance-calibration.test.ts, every
 * rule as in production. About four minutes.
 *
 * Run: artifacts/api-server/node_modules/.bin/esbuild tools/natal-personal-drivers.ts --bundle \
 *   --platform=node --format=esm --outfile=/tmp/pd.mjs --log-level=warning \
 *   && node /tmp/pd.mjs tools/out/natal-personal-drivers.json
 */
import { writeFileSync } from "node:fs";
import { computeElections } from "../artifacts/api-server/src/lib/electionEngine";
import { computeNatalChart } from "../artifacts/api-server/src/lib/natal";
import { ACTIVITIES } from "../artifacts/api-server/src/lib/activityCorrespondences";
const CHARTS = [
  { birthDate: "1992-01-03", time: "17:37", lat: 29.4246, lon: -98.49514, off: -6 },
  { birthDate: "1985-04-22", time: "06:10", lat: 40.71, lon: -74.0, off: -4 },
  { birthDate: "1978-08-09", time: "13:45", lat: 51.5, lon: -0.12, off: 1 },
  { birthDate: "2001-11-30", time: "22:05", lat: 35.68, lon: 139.69, off: 9 },
  { birthDate: "1969-06-15", time: "03:30", lat: -33.87, lon: 151.2, off: 10 },
  { birthDate: "1995-02-11", time: "11:20", lat: 19.43, lon: -99.13, off: -6 },
  { birthDate: "1988-09-27", time: "19:55", lat: 59.33, lon: 18.07, off: 2 },
  { birthDate: "1999-12-24", time: "08:40", lat: 28.61, lon: 77.21, off: 5.5 },
];
const WEEKS = ["2026-01-12", "2026-04-13", "2026-06-15", "2026-10-12"];
const PLACE = { lat: 30.19, lon: -97.8, tzOffsetMin: 300, timeZone: "America/Chicago" };
const ACTS = ACTIVITIES.filter((_, i) => i % 2 === 0);
const days = WEEKS.flatMap(w => Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${w}T05:00:00Z`) + i * 86400000)));
const charts = CHARTS.map(c => ({ ...c, natal: computeNatalChart(c.birthDate, c.time, c.lat, c.lon, c.off, "whole-sign") as any }));
const EVIDENCE_ONLY = new Set(["day-or-hour", "rising-sign", "natal-on-angle"]);
function classify(t: string): string {
  { const m = /^(\w+) is moving through your \d+\w* — this matter's own house/.exec(t); if (m) return "in-house:" + m[1]; }
  if (/^the Moon crosses your/.test(t)) return "moon-in-primary-house";
  if (/'s (day|hour)(,| and)/.test(t)) return "day-or-hour";
  if (/is rising, as it was when you were born/.test(t)) return "rising-sign";
  if (/^Your natal \w+( (rises|culminates)|, which rules your)/.test(t)) return "natal-on-angle";
  if (/returns to its place in your chart/.test(t)) return "lunar-return";
  if (/^The Moon .* your natal/.test(t)) return "moon-to-natal-point";
  const own = /^(\w+) (conjoins|trines|sextiles) your natal (\w+)$/.exec(t);
  if (own && own[1] === own[3]) return "own-place:" + own[1];
  { const m = /^(\w+) .*your natal/.exec(t); if (m) return "transit:" + m[1]; }
  return "other:" + t.slice(0, 40);
}
let windows = 0, personal = 0;
const present: Record<string, number> = {}, sole: Record<string, number> = {};
const t0 = Date.now();
for (const d of days) for (const c of charts) for (const a of ACTS) {
  const r: any = computeElections({ activityKey: a.key, span: "day", ...PLACE, natal: c.natal, timeKnown: true, birthDate: c.birthDate, startAt: d } as any);
  if (!r) continue;
  for (const w of r.windows) {
    windows++;
    if (!w.personal) continue;
    personal++;
    const classes = new Set<string>((w.evidence ?? []).filter((e: any) => e.family === "personal").map((e: any) => classify(e.text)));
    for (const k of classes) present[k] = (present[k] ?? 0) + 1;
    const making = [...classes].filter(k => !EVIDENCE_ONLY.has(k));
    if (making.length === 1) sole[making[0]] = (sole[making[0]] ?? 0) + 1;
    if (making.length === 0) sole["(no personal line)"] = (sole["(no personal line)"] ?? 0) + 1;
  }
}
const pct = (n: number, of: number) => +(100 * n / of).toFixed(1);
const out = {
  minutes: +((Date.now() - t0) / 60000).toFixed(1), windows, personal, personalShare: pct(personal, windows),
  presentInPersonalWindows: Object.fromEntries(Object.entries(present).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, { windows: v, pctOfPersonal: pct(v, personal), pctOfAll: pct(v, windows) }])),
  soleDriver: Object.fromEntries(Object.entries(sole).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, { windows: v, pctOfAll: pct(v, windows) }])),
};
console.log(JSON.stringify(out, null, 2));
writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
