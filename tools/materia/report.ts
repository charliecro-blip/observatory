// Materia — a natal medical astrology report generator.
//
//   EB=node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild
//   $EB tools/materia/report.ts --bundle --platform=node --format=esm \
//       --outfile=/tmp/materia.mjs && node /tmp/materia.mjs --chart=path/to/birth.json
//
// or via the wrapper, which does the bundling for you:
//
//   ./tools/materia/materia birth.json > report.md
//
// Everything in the report is computed. Nothing is generated prose: the chart
// geometry comes from the app's ephemeris, the dignities from its dignity
// engine, the temperament from the eleven-factor composite in Part V of the
// knowledge base, and the mixed testimony from the chart's own internal
// disagreements. Where a number cannot be honestly derived the report says so
// instead of supplying one.

import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { buildChart, type BirthData, type MateriaChart } from "./chart";
import { computeTemperament, type TemperamentReading } from "./temperament";
import {
  readMedicalHouses, readMelothesia, readTestimony, readContradictions,
  readDistribution, readCrossTradition,
} from "./significators";
import {
  TEMPERAMENT_PROFILE, CULTIVATION, PLANET_REGISTER, PLANET_BODY,
  SIGN_BODY, MEDICAL_HOUSES, CLASSICAL_SEVEN, type Sign,
} from "./qualities";
import { retrieveForChart, kbAvailable } from "./kb";
import type { HouseSystem } from "../../artifacts/api-server/src/lib/houses";

const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const deg = (d: number) => `${Math.floor(d)}°${String(Math.round((d % 1) * 60)).padStart(2, "0")}′`;
const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

// ── The report ───────────────────────────────────────────────────────────────

export function buildReport(birth: BirthData, houseSystem: HouseSystem = "whole-sign"): string {
  const chart = buildChart(birth, houseSystem);
  const temp = computeTemperament(chart);
  const houses = readMedicalHouses(chart);
  const melothesia = readMelothesia(chart);
  const testimony = readTestimony(chart);
  const contradictions = readContradictions(chart);
  const dist = readDistribution(chart);

  const L: string[] = [];
  const w = (s = "") => L.push(s);

  // ── Heading ────────────────────────────────────────────────────────────────
  w(`# ${birth.name} — constitutional reading`);
  w();
  w(`${birth.date} at ${birth.time}${birth.place ? `, ${birth.place}` : ""} · ${fmtLat(birth.lat)} ${fmtLon(birth.lon)} · UTC${birth.utcOffset >= 0 ? "+" : ""}${birth.utcOffset}`);
  w();
  w(`${houseSystemLabel(houseSystem)} houses · ${chart.sect.label} chart · tropical zodiac · traditional seven-planet rulership`);
  if (birth.timeAccuracy === "approximate" || birth.timeAccuracy === "unknown") {
    w();
    w(`> The birth time is ${birth.timeAccuracy}. The Ascendant moves roughly a degree every four minutes, so everything resting on it — the rising sign, the house cusps, the almuten, and factors 1 through 5 of the temperament calculation — moves with it. The Moon, the planetary signs, and the aspects between planets are stable at this precision; the angles are not.`);
  }
  if (chart.polarWarning) {
    w();
    w(`> ${chart.polarWarning}`);
  }

  // ── 1. The chart ───────────────────────────────────────────────────────────
  w();
  w(`## The chart`);
  w();
  w(`| | Sign | Degree | House | Essential | Accidental | Total | Condition |`);
  w(`|---|---|---|---|---|---|---|---|`);
  w(`| **Ascendant** | ${chart.natal.ascendant.sign} | ${deg(chart.natal.ascendant.degree)} | — | — | — | — | ${SIGN_BODY[chart.natal.ascendant.sign as Sign]} |`);
  w(`| **Midheaven** | ${chart.natal.midheaven.sign} | ${deg(chart.natal.midheaven.degree)} | — | — | — | — | — |`);
  for (const d of chart.dignities) {
    w(`| **${d.planet}**${d.retrograde ? " ℞" : ""} | ${d.sign} | ${deg(d.degree)} | ${d.house} | ${sign(d.essential.score)} | ${sign(d.accidental.score)} | **${sign(d.total)}** | ${d.condition} |`);
  }
  w();
  w(`Sect: **${chart.sect.label}** — the Sun stood ${Math.abs(chart.sect.sunAltitude).toFixed(1)}° ${chart.sect.sunAltitude > 0 ? "above" : "below"} the horizon. ${chart.sect.luminary} is the luminary in favour, ${chart.sect.benefic} the benefic of the sect, ${chart.sect.malefic} the malefic in sect and ${chart.sect.outOfSectMalefic} the one out of it. Sect sets which triplicity ruler scores, so it moves every essential dignity in the table above.`);
  w();
  w(`Lord of the Ascendant: **${chart.ascRuler}** in ${chart.ascRulerPlacement.sign} ${deg(chart.ascRulerPlacement.degree)}, ${ord(chart.ascRulerPlacement.houseNumber)} house. Almuten of the Ascendant degree: **${chart.almuten.winners.join(" and ")}**${chart.almuten.tied ? " (tied)" : ""}. Lord of the Geniture: **${chart.lord.planet}** at ${sign(chart.lord.total)}${chart.lord.clear ? "" : `, only ${chart.lord.total - chart.lord.runnerUp.total} clear of ${chart.lord.runnerUp.planet}`}.`);

  // Aspects
  w();
  w(`### Aspects between the classical seven`);
  w();
  if (chart.aspects.length === 0) {
    w(`No Ptolemaic aspect between any two of the seven falls within orb. This is unusual and it matters: the planets in this chart are largely not talking to each other, so each one's testimony stands more on its own than it usually would.`);
  } else {
    w(`| Aspect | Orb | Character |`);
    w(`|---|---|---|`);
    for (const a of chart.aspects) {
      w(`| ${a.a} ${a.name} ${a.b} | ${a.orb.toFixed(1)}° | ${a.nature} |`);
    }
  }

  // ── 2. Constitution ────────────────────────────────────────────────────────
  w();
  w(`## Constitution`);
  w();
  w(temp.verdict);
  w();
  w(`| | Hot | Cold | | Wet | Dry |`);
  w(`|---|---|---|---|---|---|`);
  w(`| **Quality totals** | ${temp.tally.hot} | ${temp.tally.cold} | | ${temp.tally.wet} | ${temp.tally.dry} |`);
  w();
  w(`| Combination | Temperament | Total |`);
  w(`|---|---|---|`);
  for (const r of temp.ranked) {
    const p = TEMPERAMENT_PROFILE[r.temperament];
    w(`| ${p.qualities} | ${r.temperament === temp.ranked[0].temperament ? `**${r.temperament}**` : r.temperament} | ${r.score} |`);
  }
  w();
  w(`${temp.factors.filter(f => f.weight > 0).length} scored factors carrying ${temp.totalWeight} points of weight, each contributing to one thermal and one humidal quality, for ${temp.tally.hot + temp.tally.cold + temp.tally.wet + temp.tally.dry} points distributed across the four.`);
  w();
  w(`**Clarity gate.** Part V names a temperament only when two thresholds clear. The combination gap needs to reach 20% of the leading total: here ${temp.clarity.combinationGap} against ${temp.clarity.combinationThreshold.toFixed(1)} — ${temp.clarity.combinationClear ? "**cleared**" : "**not cleared**"}. Each quality axis needs its dominant to lead by 30%: warm/cool ${(temp.clarity.thermalGap * 100).toFixed(0)}% ${temp.clarity.thermalClear ? "**cleared**" : "**not cleared**"}, moist/dry ${(temp.clarity.humidalGap * 100).toFixed(0)}% ${temp.clarity.humidalClear ? "**cleared**" : "**not cleared**"}. ${temp.named ? `All three clear, so the label is named.` : `The reading stays with the qualities and does not name a label — a temperament named past its evidence tends to become an identity rather than a description.`}`);

  const primary = temp.named ?? temp.ranked[0].temperament;
  const prof = TEMPERAMENT_PROFILE[primary];
  w();
  w(`| | ${temp.named ? "Named" : "Leading"} | Secondary |`);
  w(`|---|---|---|`);
  w(`| Temperament | ${primary} | ${temp.secondary} |`);
  w(`| Qualities | ${prof.qualities} | ${TEMPERAMENT_PROFILE[temp.secondary].qualities} |`);
  w(`| Element | ${prof.element} | ${TEMPERAMENT_PROFILE[temp.secondary].element} |`);
  w(`| Humor | ${prof.humor} | ${TEMPERAMENT_PROFILE[temp.secondary].humor} |`);
  w(`| Register | ${prof.register} | ${TEMPERAMENT_PROFILE[temp.secondary].register} |`);

  // ── 3. The eleven factors ──────────────────────────────────────────────────
  w();
  w(`### The eleven factors`);
  w();
  w(`The composite method's premise is that no single placement decides a temperament. This is the whole calculation, so any one line can be checked or disputed.`);
  w();
  w(`| # | Factor | Weight | What in the chart | Contributes |`);
  w(`|---|---|---|---|---|`);
  for (const f of temp.factors) {
    const contributes = f.pair
      ? `${f.pair.thermal} + ${f.pair.humidal}`
      : "— not scored";
    w(`| ${f.n} | ${f.name} | ${f.weight || "—"} | ${f.detail}${f.note ? ` *(${f.note})*` : ""} | ${contributes} |`);
  }

  // ── 4. Significators ───────────────────────────────────────────────────────
  w();
  w(`## The body's significators`);
  w();
  w(`The six houses the reference flags at full medical weight, each with the sign on its cusp, its lord, and the condition that lord is in. A house is read through its lord: where the lord sits and how well it sits there is the house's testimony.`);
  w();
  for (const h of houses) {
    w(`### ${ord(h.number)} house — ${h.field}`);
    w();
    w(`**${h.sign}** on the cusp (${h.strength}). Body region: ${h.bodyBySign}.`);
    w();
    w(`Lord **${h.lord}** in ${h.lordPlacement.sign} ${deg(h.lordPlacement.degree)}, ${ord(h.lordPlacement.house)} house${h.lordPlacement.retrograde ? ", retrograde" : ""} — ${h.lordCondition}. Dignity total ${sign(h.lordTotal)}.`);
    if (h.occupants.length) {
      w();
      w(`Occupied by ${h.occupants.map(o => `**${o.planet}** (${o.sign} ${deg(o.degree)})`).join(", ")}.`);
    }
    w();
  }

  // ── 5. Melothesia ──────────────────────────────────────────────────────────
  w(`## Where the chart concentrates`);
  w();
  w(`Melothesic emphasis — which regions of the body this chart weights, and why. These are the resonances the reference maps sign to body; they name where to pay attention, not what is wrong.`);
  w();
  w(`| Sign | Region | Weight | Why |`);
  w(`|---|---|---|---|`);
  for (const m of melothesia.slice(0, 6)) {
    w(`| **${m.sign}** | ${m.region} | ${m.score} | ${m.reasons.join("; ")} |`);
  }
  w();
  const elementLine = dist.dominantElement
    ? `The classical seven concentrate in **${dist.dominantElement}** (${dist.elements[dist.dominantElement as keyof typeof dist.elements].planets.join(", ")}).`
    : `The classical seven spread across the elements without one dominating — ${(Object.entries(dist.elements) as Array<[string, { count: number }]>).map(([k, v]) => `${k} ${v.count}`).join(", ")}.`;
  const lackLine = dist.lacking.length
    ? ` No classical planet occupies ${dist.lacking.join(" or ")}.`
    : "";
  w(elementLine + lackLine);

  // ── 6. Testimony ───────────────────────────────────────────────────────────
  w();
  w(`## Demanding and supportive testimony`);
  w();
  w(`The reference translates the traditional malefic as *demanding* and benefic as *supportive*, and holds sect as the thing that decides how tractable each one is.`);
  w();
  for (const t of testimony) {
    w(`**${t.planet}**, ${t.role}, ${t.inSect ? "in sect" : "out of sect"}. ${t.placement}; ${t.condition}. ${t.reading} Body register: ${t.bodyRegion}.${t.aspectsToLuminaries.length ? ` Contacts the luminaries by ${t.aspectsToLuminaries.join(", ")}.` : " No contact with either luminary."}`);
    w();
  }

  // ── 7. Mixed testimony ─────────────────────────────────────────────────────
  w(`## Mixed testimony`);
  w();
  if (contradictions.length === 0) {
    w(`The chart's testimony is unusually consistent: no planet lords two full-weight medical houses, neither benefic sits on difficult ground, neither malefic holds essential dignity, and no planet's sign-strength contradicts its circumstance. That consistency is itself the finding — this chart says one thing rather than several, which makes it easier to read and gives it fewer places to surprise you.`);
  } else {
    w(`Where the chart disagrees with itself. These are kept rather than resolved — the reference's sixth principle is that mixed testimony is expected, and flattening it produces a cleaner reading than the chart supports.`);
    w();
    for (const c of contradictions) {
      w(`**${c.kind}.**${c.weight === "moderate" ? " *(moderate)*" : ""} ${c.statement}`);
      w();
    }
  }

  // ── 8. Cultivation ─────────────────────────────────────────────────────────
  w(`## Cultivation`);
  w();
  w(`The humoral logic is *like supports like, opposite tempers excess*. It names registers, not prescriptions — the reference draws a hard line at foods, herbs, doses, and treatments, and this report keeps it.`);
  w();
  w(`For a ${temp.named ? "" : "predominantly "}${primary} constitution:`);
  w();
  w(`- **Supported by** ${CULTIVATION[primary].supports}.`);
  w(`- **Tempered, when in excess, by** ${CULTIVATION[primary].tempers}.`);
  if (!temp.named) {
    const others = temp.ranked.slice(1).filter(r => r.score === temp.ranked[1].score);
    for (const o of others) {
      w(`- The ${o.temperament} register sits level enough with it that its own supports apply nearly as much: ${CULTIVATION[o.temperament].supports}.`);
    }
    w(`- With the chart unresolved across ${others.length + 1 > 2 ? "these three" : "both"} registers, which one is forward at a given time is something the body reports rather than something the chart settles.`);
  }
  w();
  w(`**Planetary signature.** Born on **${WEEKDAY_OF[chart.planetaryDay]}**, ruled by ${chart.planetaryDay === "Sun" || chart.planetaryDay === "Moon" ? "the " + chart.planetaryDay : chart.planetaryDay}${chart.planetaryHour ? `, in an hour of **${chart.planetaryHour.ruler}** (${chart.planetaryHour.isDayHour ? "day" : "night"} hour ${chart.planetaryHour.hourNumber} of twelve)` : "; the planetary hour is withheld, for the reason given above"}. ${planetarySignature(chart, primary, temp)}`);

  // ── 9. Cross-tradition ─────────────────────────────────────────────────────
  const crossPlanets = [...new Set([chart.ascRuler, chart.lord.planet, ...chart.almuten.winners])];
  const cross = readCrossTradition(chart, crossPlanets);
  if (cross.length) {
    w();
    w(`## Cross-tradition`);
    w();
    w(`The reference holds the Western and TCM systems side by side rather than merging them, and grades each correspondence by how well it actually converges. For this chart's governing planets:`);
    w();
    w(`| Planet | TCM element | Convergence | Note |`);
    w(`|---|---|---|---|`);
    for (const c of cross) {
      w(`| ${c.planet} | ${c.element} | ${c.strength} | ${c.note} |`);
    }
  }

  // ── 10. Method notes ───────────────────────────────────────────────────────
  w();
  w(`## Method`);
  w();
  w(`Chart geometry from the Observatory ephemeris. Essential dignity by Lilly's table — domicile ${sign(5)}, exaltation ${sign(4)}, triplicity ${sign(3)} by sect (Dorothean), Egyptian bounds ${sign(2)}, Chaldean face ${sign(1)}, detriment −5, fall −4, peregrine −5. Accidental dignity by house, motion, and solar phase. Temperament by the eleven-factor composite of Part V, at the weights in Appendix C §6, gated at 20% and 30%.`);
  w();
  w(`Sect is computed from the Sun's true altitude rather than its house, because under whole-sign houses a Sun risen a few degrees above the Ascendant falls in the 12th and would read as a night chart. Sect decides triplicity rulership, so that error would re-score every planet in the table.`);
  if (temp.methodNotes.length) {
    w();
    for (const n of temp.methodNotes) { w(`- ${n}`); w(); }
  }
  w();
  w(`**On the clarity gate itself.** Appendix D question 29 asks whether 20% and 30% are the right numbers. Measured over 2,280 charts spread across 1950–2005 and five latitudes, the pair names a temperament in 16.3% of them. The two checks are not independent: because every factor adds its weight to one quality on each axis, the two axes always sum to the same total, and the combination gate then works out stricter than the axis gate in every case — it needs the dominant quality to lead by a quarter of the total weight where the 30% axis check needs only 0.176 of it. Across 2,240 further charts the axis check rejected nothing the combination check had passed. As specified the 30% gate is inert; it would have to exceed 40% before it bound on anything.`);
  w();
  w(`The modern outers are not scored in the temperament composite. The reference calls them an interpretive overlay carrying no dignity, and Appendix D question 2 leaves their prominence unresolved; letting an unratified overlay move a constitutional reading is the drift the reference warns against. They appear in the melothesic and significator layers, where the reference does cite them.`);

  // ── 11. Reference consulted ────────────────────────────────────────────────
  if (kbAvailable()) {
    const retrieval = retrieveForChart({
      ascSign: chart.natal.ascendant.sign,
      sixthSign: chart.natal.houses[5].sign,
      ascRuler: chart.ascRuler,
      lordOfGeniture: chart.lord.planet,
      almuten: chart.almuten.winners,
      emphasisedSigns: melothesia.slice(0, 3).map(m => m.sign),
      emphasisedPlanets: ["Mars", "Saturn", "Venus", "Jupiter", "Moon"],
    });
    w();
    w(`## Reference consulted`);
    w();
    w(`${retrieval.entries.length} sections of the medical astrology knowledge base bear on this chart, roughly ${(retrieval.totalTokens / 1000).toFixed(1)}k tokens of reading:`);
    w();
    for (const e of retrieval.entries) {
      w(`- \`${e.file}\` — ${e.section}: ${e.label}`);
    }
    if (retrieval.missing.length) {
      w();
      w(`Not found in the knowledge base, so not consulted: ${retrieval.missing.join(", ")}.`);
    }
  }

  w();
  return L.join("\n");
}

function planetarySignature(chart: MateriaChart, primary: string, temp: TemperamentReading): string {
  const dayReg = PLANET_REGISTER[chart.planetaryDay];
  if (!chart.planetaryHour) {
    return `That gives a ${dayReg} signature — a secondary cultivation key, held under the constitutional reading rather than beside it.`;
  }
  const same = chart.planetaryDay === chart.planetaryHour.ruler;
  const hourReg = PLANET_REGISTER[chart.planetaryHour.ruler];
  const gloss = (r: string) => r.split("—")[1]?.trim() ?? r;
  if (same) {
    return `Day and hour agree, concentrating the signature into a doubled ${chart.planetaryDay} key: ${gloss(dayReg)}. Part V keeps this secondary. A ${chart.planetaryDay}-day, ${chart.planetaryDay}-hour birth on a ${primary} chart reads as ${primary} carrying a ${chart.planetaryDay} signature, with the chart's own temperament still dominant.`;
  }
  return `That gives two registers rather than one. The day contributes ${gloss(dayReg)}; the hour contributes ${gloss(hourReg)}. Both sit beneath the constitutional reading, which Part V keeps dominant, and count as a secondary cultivation key.`;
}

const WEEKDAY_OF: Record<string, string> = {
  Sun: "a Sunday", Moon: "a Monday", Mars: "a Tuesday", Mercury: "a Wednesday",
  Jupiter: "a Thursday", Venus: "a Friday", Saturn: "a Saturday",
};

function houseSystemLabel(h: HouseSystem): string {
  return { "whole-sign": "Whole-sign", equal: "Equal", porphyry: "Porphyry", placidus: "Placidus", regiomontanus: "Regiomontanus" }[h];
}
const fmtLat = (n: number) => `${Math.abs(n).toFixed(4)}°${n >= 0 ? "N" : "S"}`;
const fmtLon = (n: number) => `${Math.abs(n).toFixed(4)}°${n >= 0 ? "E" : "W"}`;

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  const positional: string[] = [];
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? "true";
    else positional.push(a);
  }
  return { args, positional };
}

const USAGE = `materia — natal medical astrology report

  materia <birth.json> [--house-system=whole-sign] [--out=report.md]

birth.json:
  {
    "name": "A. Person",
    "date": "1988-03-14",          local date at the birthplace
    "time": "07:42",               local 24h time at the birthplace
    "lat": 37.7749,                degrees, north positive
    "lon": -122.4194,              degrees, east positive
    "utcOffset": -8,               hours east of UTC at that moment (PST = -8)
    "place": "San Francisco, CA",  optional, for the header
    "timeAccuracy": "exact"        exact | approximate | unknown
  }

House systems: whole-sign (default), equal, porphyry, placidus, regiomontanus.
The knowledge base confirms whole-sign as the default (Appendix D, Q22).
`;

function readBirth(path: string): BirthData {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as BirthData;
  } catch (e) {
    console.error(`Could not read birth data from ${path}: ${(e as Error).message}`);
    process.exit(1);
  }
}

function main() {
  const { args, positional } = parseArgs(process.argv.slice(2));
  const path = positional[0] ?? args.chart;
  if (!path || args.help) { console.log(USAGE); process.exit(path ? 0 : 1); }

  const birth = readBirth(path);

  for (const k of ["name", "date", "time", "lat", "lon", "utcOffset"] as const) {
    if (birth[k] === undefined) {
      console.error(`birth.json is missing "${k}". All six of name, date, time, lat, lon, utcOffset are required — a report built on a guessed birth time is a different chart, not an approximate one.`);
      process.exit(1);
    }
  }

  const hs = (args["house-system"] ?? "whole-sign") as HouseSystem;
  const report = buildReport(birth, hs);

  if (args.out) {
    writeFileSync(args.out, report);
    console.error(`Wrote ${args.out} (${report.split("\n").length} lines).`);
  } else {
    console.log(report);
  }
}

main();
