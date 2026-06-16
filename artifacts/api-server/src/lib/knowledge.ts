import { readFileSync } from "fs";
import { resolve } from "path";

const KB_DIR = resolve(process.cwd(), "knowledge/medical-astrology-v1");

// ── File maps ─────────────────────────────────────────────────────────────────

const PLANET_FILES: Record<string, string> = {
  Saturn:  "02_planets/01_saturn.md",
  Jupiter: "02_planets/02_jupiter.md",
  Mars:    "02_planets/03_mars.md",
  Sun:     "02_planets/04_sun.md",
  Venus:   "02_planets/05_venus.md",
  Mercury: "02_planets/06_mercury.md",
  Moon:    "02_planets/07_moon.md",
  Uranus:  "02_planets/08_uranus.md",
  Neptune: "02_planets/09_neptune.md",
  Pluto:   "02_planets/10_pluto.md",
};

const SIGN_FILES: Record<string, string> = {
  Aries:       "03_signs/01_aries.md",
  Taurus:      "03_signs/02_taurus.md",
  Gemini:      "03_signs/03_gemini.md",
  Cancer:      "03_signs/04_cancer.md",
  Leo:         "03_signs/05_leo.md",
  Virgo:       "03_signs/06_virgo.md",
  Libra:       "03_signs/07_libra.md",
  Scorpio:     "03_signs/08_scorpio.md",
  Sagittarius: "03_signs/09_sagittarius.md",
  Capricorn:   "03_signs/10_capricorn.md",
  Aquarius:    "03_signs/11_aquarius.md",
  Pisces:      "03_signs/12_pisces.md",
};

const HOUSE_FILES: Record<number, string> = {
  1:  "04_houses/01_first.md",
  2:  "04_houses/02_second.md",
  3:  "04_houses/03_third.md",
  4:  "04_houses/04_fourth.md",
  5:  "04_houses/05_fifth.md",
  6:  "04_houses/06_sixth.md",
  7:  "04_houses/07_seventh.md",
  8:  "04_houses/08_eighth.md",
  9:  "04_houses/09_ninth.md",
  10: "04_houses/10_tenth.md",
  11: "04_houses/11_eleventh.md",
  12: "04_houses/12_twelfth.md",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  file: string;
  section: string;
  label: string;
  content: string;
  approxTokens: number;
}

export interface KnowledgeResult {
  block: string;
  manifest: KnowledgeEntry[];
  totalTokens: number;
}

// ── Core extraction helpers ───────────────────────────────────────────────────

function readKBFile(relativePath: string): string {
  try {
    return readFileSync(resolve(KB_DIR, relativePath), "utf-8");
  } catch {
    return "";
  }
}

function extractSection(fileContent: string, headingPattern: RegExp): string {
  const lines = fileContent.split("\n");
  let inSection = false;
  const out: string[] = [];

  for (const line of lines) {
    if (!inSection) {
      if (headingPattern.test(line)) {
        inSection = true;
        out.push(line);
      }
      continue;
    }
    if (/^#{1,2} /.test(line)) break;
    out.push(line);
  }

  return out.join("\n").trim();
}

function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function trimToTokens(text: string, maxTokens: number): string {
  if (approxTokens(text) <= maxTokens) return text;
  const limit = maxTokens * 4;
  const cut = text.slice(0, limit);
  const lastPara = cut.lastIndexOf("\n\n");
  return (lastPara > limit * 0.6 ? cut.slice(0, lastPara) : cut) + "\n[…]";
}

// ── Named section extractors ──────────────────────────────────────────────────

function getObsTranslation(filePath: string, label: string): KnowledgeEntry | null {
  const content = readKBFile(filePath);
  if (!content) return null;
  const section = extractSection(content, /^## Observatory translation/i);
  if (!section) return null;
  return {
    file: filePath,
    section: "Observatory translation",
    label,
    content: section,
    approxTokens: approxTokens(section),
  };
}

function getSafetyFlags(filePath: string, label: string): KnowledgeEntry | null {
  const content = readKBFile(filePath);
  if (!content) return null;
  const section =
    extractSection(content, /^## ⚠ Safety flags/) ||
    extractSection(content, /^## Safety flags/);
  if (!section) return null;
  return {
    file: filePath,
    section: "Safety flags",
    label,
    content: section,
    approxTokens: approxTokens(section),
  };
}

// ── Block formatter ───────────────────────────────────────────────────────────

function formatContextBlock(entries: KnowledgeEntry[], title: string): string {
  if (entries.length === 0) return "";
  const body = entries
    .map((e) => `### [${e.label}]\n${e.content}`)
    .join("\n\n");
  return (
    `\n--- ${title} ---\n` +
    `The following is selected reference material from the Observatory medical astrology knowledge base.\n` +
    `Use it for precise, grounded, non-deterministic language — not as a script.\n\n` +
    body +
    `\n--- END ${title} ---\n`
  );
}

// ── Blueprint context ─────────────────────────────────────────────────────────

export interface BlueprintKnowledgeParams {
  ascSign: string;
  chartRulerPlanet: string;
  sixthHouseSign: string;
  eighthHouseSign: string;
}

export function selectBlueprintContext(params: BlueprintKnowledgeParams): KnowledgeResult {
  const TOKEN_BUDGET = 1500;
  const entries: KnowledgeEntry[] = [];
  let tokenCount = 0;

  function addEntry(fn: () => KnowledgeEntry | null, tokenCap: number): void {
    if (tokenCount >= TOKEN_BUDGET) return;
    const entry = fn();
    if (!entry) return;
    const available = Math.min(tokenCap, TOKEN_BUDGET - tokenCount);
    if (available < 80) return;
    if (entry.approxTokens > available) {
      entry.content = trimToTokens(entry.content, available);
      entry.approxTokens = approxTokens(entry.content);
    }
    entries.push(entry);
    tokenCount += entry.approxTokens;
  }

  const ascFile = SIGN_FILES[params.ascSign];
  const rulerFile = PLANET_FILES[params.chartRulerPlanet];
  const sixthSignFile = SIGN_FILES[params.sixthHouseSign];
  const eighthSignFile = SIGN_FILES[params.eighthHouseSign];

  addEntry(() => ascFile ? getObsTranslation(ascFile, `Ascendant sign: ${params.ascSign}`) : null, 350);
  addEntry(() => rulerFile ? getObsTranslation(rulerFile, `Chart ruler: ${params.chartRulerPlanet}`) : null, 300);
  addEntry(() => getObsTranslation(HOUSE_FILES[6], "6th house (health, illness, routine)"), 300);
  addEntry(() => sixthSignFile ? getObsTranslation(sixthSignFile, `6th house sign: ${params.sixthHouseSign}`) : null, 200);
  addEntry(() => getObsTranslation(HOUSE_FILES[8], "8th house (chronicity, hidden processes)"), 200);
  addEntry(() => eighthSignFile ? getObsTranslation(eighthSignFile, `8th house sign: ${params.eighthHouseSign}`) : null, 150);

  const sixthSafety = getSafetyFlags(HOUSE_FILES[6], "6th house safety constraints");
  if (sixthSafety) {
    const available = Math.min(150, TOKEN_BUDGET + 200 - tokenCount);
    if (available >= 80) {
      sixthSafety.content = trimToTokens(sixthSafety.content, available);
      sixthSafety.approxTokens = approxTokens(sixthSafety.content);
      entries.push(sixthSafety);
      tokenCount += sixthSafety.approxTokens;
    }
  }

  const block = formatContextBlock(entries, "NATAL BLUEPRINT REFERENCE CONTEXT");
  return { block, manifest: entries, totalTokens: tokenCount };
}

// ── Body Weather context ──────────────────────────────────────────────────────

export interface BodyWeatherKnowledgeParams {
  moonSign: string;
  topTransitPlanets: string[];
}

export function selectBodyWeatherContext(params: BodyWeatherKnowledgeParams): KnowledgeResult {
  const TOKEN_BUDGET = 600;
  const entries: KnowledgeEntry[] = [];
  let tokenCount = 0;

  function addEntry(fn: () => KnowledgeEntry | null, tokenCap: number): void {
    if (tokenCount >= TOKEN_BUDGET) return;
    const entry = fn();
    if (!entry) return;
    const available = Math.min(tokenCap, TOKEN_BUDGET - tokenCount);
    if (available < 60) return;
    if (entry.approxTokens > available) {
      entry.content = trimToTokens(entry.content, available);
      entry.approxTokens = approxTokens(entry.content);
    }
    entries.push(entry);
    tokenCount += entry.approxTokens;
  }

  const bwContent = readKBFile("06_body_weather.md");
  if (bwContent) {
    const firstPrinciple = extractSection(bwContent, /^## First principle: transits are weather/);
    if (firstPrinciple) {
      const trimmed = trimToTokens(firstPrinciple, 220);
      entries.push({
        file: "06_body_weather.md",
        section: "First principle: transits are weather, not forecast",
        label: "Body Weather doctrine",
        content: trimmed,
        approxTokens: approxTokens(trimmed),
      });
      tokenCount += approxTokens(trimmed);
    }
  }

  const moonSignFile = SIGN_FILES[params.moonSign];
  if (moonSignFile) {
    addEntry(() => getObsTranslation(moonSignFile, `Moon sign: ${params.moonSign}`), 180);
  }

  for (const planet of params.topTransitPlanets.slice(0, 1)) {
    const pFile = PLANET_FILES[planet];
    if (pFile) {
      addEntry(() => getObsTranslation(pFile, `Active transit planet: ${planet}`), 150);
    }
  }

  const block = formatContextBlock(entries, "BODY WEATHER REFERENCE CONTEXT");
  return { block, manifest: entries, totalTokens: tokenCount };
}

// ── Oracle context ────────────────────────────────────────────────────────────

export interface OracleKnowledgeParams {
  ascSign: string;
  topTransitPlanets: string[];
}

export function selectOracleContext(params: OracleKnowledgeParams): KnowledgeResult {
  const TOKEN_BUDGET = 700;
  const entries: KnowledgeEntry[] = [];
  let tokenCount = 0;

  function addEntry(fn: () => KnowledgeEntry | null, tokenCap: number): void {
    if (tokenCount >= TOKEN_BUDGET) return;
    const entry = fn();
    if (!entry) return;
    const available = Math.min(tokenCap, TOKEN_BUDGET - tokenCount);
    if (available < 60) return;
    if (entry.approxTokens > available) {
      entry.content = trimToTokens(entry.content, available);
      entry.approxTokens = approxTokens(entry.content);
    }
    entries.push(entry);
    tokenCount += entry.approxTokens;
  }

  const ascFile = SIGN_FILES[params.ascSign];
  if (ascFile) {
    addEntry(() => getObsTranslation(ascFile, `Ascendant sign: ${params.ascSign}`), 300);
  }

  for (const planet of params.topTransitPlanets.slice(0, 2)) {
    const pFile = PLANET_FILES[planet];
    if (pFile) {
      addEntry(() => getObsTranslation(pFile, `Active transit: ${planet}`), 200);
    }
  }

  const block = formatContextBlock(entries, "ORACLE REFERENCE CONTEXT");
  return { block, manifest: entries, totalTokens: tokenCount };
}
