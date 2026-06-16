import { readdirSync, readFileSync, statSync } from "fs";
import { resolve, relative, basename, dirname } from "path";
import { fileURLToPath } from "url";
import { db, knowledgeChunks } from "@workspace/db";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = resolve(__dirname, "../..");

const CORPUS_VERSION = "medical-astrology-v1";
const KB_DIR = resolve(WORKSPACE_ROOT, "knowledge", CORPUS_VERSION);

// ── Tag inference ─────────────────────────────────────────────────────────────

const PLANET_NAMES = [
  "saturn", "jupiter", "mars", "sun", "venus", "mercury",
  "moon", "uranus", "neptune", "pluto",
];

const SIGN_NAMES = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

const HOUSE_ORDINALS: Record<string, string> = {
  "first": "1", "second": "2", "third": "3", "fourth": "4",
  "fifth": "5", "sixth": "6", "seventh": "7", "eighth": "8",
  "ninth": "9", "tenth": "10", "eleventh": "11", "twelfth": "12",
};

function inferTags(filePath: string): string[] {
  const tags: string[] = [];
  const lower = filePath.toLowerCase();
  const stem = basename(lower, ".md").replace(/^\d+_/, "");

  if (lower.includes("02_planets/")) {
    tags.push("planet");
    if (PLANET_NAMES.includes(stem)) tags.push(stem);
    if (lower.includes("combinations")) tags.push("combinations");
    if (lower.includes("overview")) tags.push("overview");
  } else if (lower.includes("03_signs/")) {
    tags.push("sign");
    if (SIGN_NAMES.includes(stem)) tags.push(stem);
    if (lower.includes("melothesia")) { tags.push("melothesia"); tags.push("body-parts"); }
    if (lower.includes("axes")) tags.push("axes");
  } else if (lower.includes("04_houses/")) {
    tags.push("house");
    if (HOUSE_ORDINALS[stem]) tags.push(`house-${HOUSE_ORDINALS[stem]}`);
    if (lower.includes("overview")) tags.push("overview");
  } else if (lower.includes("appendices/")) {
    tags.push("appendix");
    if (lower.includes("glossary")) tags.push("glossary");
    if (lower.includes("sources")) tags.push("sources");
    if (lower.includes("tables")) tags.push("tables");
  }

  const thematic: Record<string, string[]> = {
    "00_index": ["index", "navigation"],
    "01_foundations": ["foundations", "doctrine", "humors", "elements"],
    "05_temperament": ["temperament", "constitution"],
    "06_body_weather": ["body-weather", "timing", "transits", "lunar"],
    "07_decumbiture": ["decumbiture", "horary"],
    "08_materia_medica": ["materia-medica", "herbal"],
    "09_workbench": ["workbench", "practitioner"],
    "10_safety_floor": ["safety", "ethics", "guardrails"],
    "11_cross_tradition": ["cross-tradition", "tcm", "ayurveda"],
  };

  for (const [key, keyTags] of Object.entries(thematic)) {
    if (lower.includes(key)) {
      tags.push(...keyTags);
      break;
    }
  }

  return [...new Set(tags)];
}

// ── Module feeds parsing ──────────────────────────────────────────────────────

function parseModuleFeeds(content: string): string[] {
  const match = content.match(/\*\*Module feeds:\*\*\s*(.+)/);
  if (!match) return [];
  const raw = match[1];
  const feeds: string[] = [];
  const backtickPattern = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = backtickPattern.exec(raw)) !== null) {
    feeds.push(m[1].trim());
  }
  if (feeds.length > 0) return feeds;
  return raw
    .split(/[·,]/)
    .map((s) => s.trim().replace(/^[`*]+|[`*]+$/g, ""))
    .filter(Boolean);
}

// ── File parsing ──────────────────────────────────────────────────────────────

interface Chunk {
  filePath: string;
  title: string;
  moduleFeeds: string[];
  sectionHeading: string;
  sectionIndex: number;
  content: string;
  tags: string[];
  approxTokens: number;
  corpusVersion: string;
}

function parseFile(absolutePath: string, relPath: string): Chunk[] {
  const raw = readFileSync(absolutePath, "utf-8");
  const lines = raw.split("\n");
  const tags = inferTags(relPath);

  let title = basename(relPath, ".md").replace(/^\d+_/, "").replace(/_/g, " ");
  const h1 = lines.find((l) => l.startsWith("# "));
  if (h1) title = h1.replace(/^# /, "").trim();

  const moduleFeeds = parseModuleFeeds(raw);
  const chunks: Chunk[] = [];

  const approxTokens = (t: string) => Math.ceil(t.length / 4);

  let sectionIndex = 0;
  let currentHeading = "_header";
  let currentLines: string[] = [];

  function flush() {
    const content = currentLines.join("\n").trim();
    if (!content) return;
    chunks.push({
      filePath: relPath,
      title,
      moduleFeeds,
      sectionHeading: currentHeading,
      sectionIndex,
      content,
      tags,
      approxTokens: approxTokens(content),
      corpusVersion: CORPUS_VERSION,
    });
    sectionIndex++;
  }

  for (const line of lines) {
    if (/^#{1,2} /.test(line) && !line.startsWith("# ")) {
      flush();
      currentHeading = line.replace(/^#{1,2} /, "").trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return chunks;
}

// ── File discovery ────────────────────────────────────────────────────────────

function collectFiles(dir: string, base: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = resolve(dir, entry);
    if (statSync(abs).isDirectory()) {
      results.push(...collectFiles(abs, base));
    } else if (entry.endsWith(".md")) {
      results.push(relative(base, abs));
    }
  }
  return results.sort();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Ingesting knowledge base from: ${KB_DIR}`);
  console.log(`Corpus version: ${CORPUS_VERSION}`);

  const files = collectFiles(KB_DIR, KB_DIR);
  console.log(`Found ${files.length} files`);

  const allChunks: Chunk[] = [];
  for (const relPath of files) {
    const abs = resolve(KB_DIR, relPath);
    const chunks = parseFile(abs, relPath);
    allChunks.push(...chunks);
    console.log(`  ${relPath} → ${chunks.length} chunks`);
  }

  console.log(`\nTotal chunks to ingest: ${allChunks.length}`);
  console.log("Clearing existing rows for this corpus version...");

  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.corpusVersion, CORPUS_VERSION));

  console.log("Inserting chunks...");
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const batch = allChunks.slice(i, i + BATCH);
    await db.insert(knowledgeChunks).values(batch);
    inserted += batch.length;
  }

  console.log(`\n✓ Ingested ${inserted} chunks from ${files.length} files`);

  const totalTokens = allChunks.reduce((s, c) => s + c.approxTokens, 0);
  const bySection: Record<string, number> = {};
  for (const c of allChunks) {
    bySection[c.sectionHeading] = (bySection[c.sectionHeading] ?? 0) + 1;
  }
  console.log(`\nApprox total tokens: ${totalTokens.toLocaleString()}`);
  console.log("\nTop section headings:");
  Object.entries(bySection)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .forEach(([h, n]) => console.log(`  ${n}x  ${h}`));

  await (db as unknown as { end?: () => Promise<void> }).end?.();
  process.exit(0);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
