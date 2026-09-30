// Knowledge-base retrieval — pulls the reference sections a given chart
// actually needs.
//
// Same extraction shape as artifacts/api-server/src/lib/knowledge.ts, with two
// changes. The KB directory resolves from this file's own location rather than
// process.cwd(), so the tool works from any working directory. And a missing
// file is reported rather than silently returning "" — a report that quietly
// dropped its Saturn section would read as complete.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const KB_DIR = resolve(HERE, "../../knowledge/medical-astrology-v1");

export const PLANET_FILES: Record<string, string> = {
  Saturn: "02_planets/01_saturn.md", Jupiter: "02_planets/02_jupiter.md",
  Mars: "02_planets/03_mars.md", Sun: "02_planets/04_sun.md",
  Venus: "02_planets/05_venus.md", Mercury: "02_planets/06_mercury.md",
  Moon: "02_planets/07_moon.md", Uranus: "02_planets/08_uranus.md",
  Neptune: "02_planets/09_neptune.md", Pluto: "02_planets/10_pluto.md",
};

export const SIGN_FILES: Record<string, string> = {
  Aries: "03_signs/01_aries.md", Taurus: "03_signs/02_taurus.md",
  Gemini: "03_signs/03_gemini.md", Cancer: "03_signs/04_cancer.md",
  Leo: "03_signs/05_leo.md", Virgo: "03_signs/06_virgo.md",
  Libra: "03_signs/07_libra.md", Scorpio: "03_signs/08_scorpio.md",
  Sagittarius: "03_signs/09_sagittarius.md", Capricorn: "03_signs/10_capricorn.md",
  Aquarius: "03_signs/11_aquarius.md", Pisces: "03_signs/12_pisces.md",
};

export const HOUSE_FILES: Record<number, string> = {
  1: "04_houses/01_first.md", 2: "04_houses/02_second.md", 3: "04_houses/03_third.md",
  4: "04_houses/04_fourth.md", 5: "04_houses/05_fifth.md", 6: "04_houses/06_sixth.md",
  7: "04_houses/07_seventh.md", 8: "04_houses/08_eighth.md", 9: "04_houses/09_ninth.md",
  10: "04_houses/10_tenth.md", 11: "04_houses/11_eleventh.md", 12: "04_houses/12_twelfth.md",
};

export interface Entry {
  file: string; section: string; label: string; content: string; approxTokens: number;
}

export interface Retrieval {
  entries: Entry[];
  missing: string[];
  totalTokens: number;
}

export function kbAvailable(): boolean {
  return existsSync(resolve(KB_DIR, "00_index.md"));
}

function readKB(rel: string): string | null {
  const p = resolve(KB_DIR, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf-8");
}

/** Everything under a heading, up to the next heading of the same or higher level. */
export function extractSection(content: string, pattern: RegExp): string {
  const lines = content.split("\n");
  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    if (!inSection) {
      if (pattern.test(line)) { inSection = true; out.push(line); }
      continue;
    }
    if (/^#{1,2} /.test(line)) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

const approxTokens = (t: string) => Math.ceil(t.length / 4);

export function section(rel: string, pattern: RegExp, sectionName: string, label: string): Entry | null {
  const content = readKB(rel);
  if (content === null) return null;
  const body = extractSection(content, pattern);
  if (!body) return null;
  return { file: rel, section: sectionName, label, content: body, approxTokens: approxTokens(body) };
}

export const obsTranslation = (rel: string, label: string) =>
  section(rel, /^## Observatory translation/i, "Observatory translation", label);

export const safetyFlags = (rel: string, label: string) =>
  section(rel, /^## ⚠ Safety flags/, "Safety flags", label) ??
  section(rel, /^## Safety flags/, "Safety flags", label);

/**
 * The reference material this chart's own placements call for: the lords of
 * the medical houses, the signs on their cusps, the two malefics and two
 * benefics, plus the standing doctrine every report rests on.
 */
export function retrieveForChart(opts: {
  ascSign: string;
  sixthSign: string;
  ascRuler: string;
  lordOfGeniture: string;
  almuten: string[];
  emphasisedSigns: string[];
  emphasisedPlanets: string[];
}): Retrieval {
  const entries: Entry[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();

  const take = (e: Entry | null, what: string) => {
    if (!e) { missing.push(what); return; }
    const key = `${e.file}#${e.section}`;
    if (seen.has(key)) return;
    seen.add(key); entries.push(e);
  };

  take(section("01_foundations.md", /^## /, "Foundations", "Foundations — qualities, elements, humors"), "foundations");
  take(section("10_safety_floor.md", /^## /, "Safety floor", "The safety floor"), "safety floor");

  take(obsTranslation(SIGN_FILES[opts.ascSign], `${opts.ascSign} rising`), `${opts.ascSign} sign entry`);
  if (opts.sixthSign !== opts.ascSign) {
    take(obsTranslation(SIGN_FILES[opts.sixthSign], `${opts.sixthSign} on the 6th`), `${opts.sixthSign} sign entry`);
  }
  for (const s of opts.emphasisedSigns) {
    take(obsTranslation(SIGN_FILES[s], `${s} — emphasised`), `${s} sign entry`);
  }

  const planets = [...new Set([opts.ascRuler, opts.lordOfGeniture, ...opts.almuten, ...opts.emphasisedPlanets])];
  for (const p of planets) {
    if (!PLANET_FILES[p]) continue;
    take(obsTranslation(PLANET_FILES[p], `${p}`), `${p} planet entry`);
    take(safetyFlags(PLANET_FILES[p], `${p} — safety flags`), `${p} safety flags`);
  }

  for (const h of [1, 2, 6, 7, 8, 10]) {
    take(obsTranslation(HOUSE_FILES[h], `${h}th house`), `house ${h} entry`);
  }

  return { entries, missing, totalTokens: entries.reduce((s, e) => s + e.approxTokens, 0) };
}
