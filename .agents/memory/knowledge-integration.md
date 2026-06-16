---
name: Knowledge base integration
description: How the medical astrology knowledge base is structured and injected into AI prompts.
---

## Knowledge base location

`knowledge/medical-astrology-v1/` — 52 Markdown files, ~134k words.
Subdirs: `02_planets/` (12), `03_signs/` (14), `04_houses/` (13), `appendices/` (4). Root-level thematic files: `00_index.md`, `01_foundations.md`, `05_temperament_and_constitution.md`, `06_body_weather.md`, `07_decumbiture.md`, `08_materia_medica.md`, `09_workbench.md`, `10_safety_floor.md`, `11_cross_tradition.md`.

No YAML frontmatter. Each file uses inline `**Module feeds:**` tag for routing.

## Selector module

`artifacts/api-server/src/lib/knowledge.ts`

Three exported functions:
- `selectBlueprintContext({ ascSign, chartRulerPlanet, sixthHouseSign, eighthHouseSign })` → budget 1,500 tokens
- `selectBodyWeatherContext({ moonSign, topTransitPlanets })` → budget 600 tokens
- `selectOracleContext({ ascSign, topTransitPlanets })` → budget 700 tokens

Each returns `{ block: string, manifest: KnowledgeEntry[], totalTokens: number }`.

Section extraction targets `## Observatory translation` (case-insensitive) and `## ⚠ Safety flags` / `## Safety flags` heading variants. `extractSection()` reads until the next `##` or `#` heading.

**Why:** files use a Traditional→Observatory layered structure; only the Observatory translation section is suitable for prompt injection (Tradition prose is too raw and too long).

## Blueprint PROMPT_VERSION

Currently `"v2"`. Bump whenever the prompt shape changes — it invalidates cached blueprints for all testers (intentional behavior for quality improvements).

## Indexed layer (knowledge_chunks table)

- 589 section-level chunks (~233k approx tokens) from all 52 files
- Columns: `filePath`, `title`, `moduleFeeds[]`, `sectionHeading`, `sectionIndex`, `content`, `tags[]`, `approxTokens`, `corpusVersion`
- Unique constraint on `(filePath, sectionIndex)`
- Ingestion: `pnpm --filter @workspace/scripts run ingest-knowledge` (idempotent — deletes by corpusVersion, then re-inserts in batches of 50)
- Dev-only search: `GET /api/knowledge/search?q=&moduleFeed=&tag=&limit=` — supports keyword (ILIKE on content/title/sectionHeading), moduleFeed array-contains, tag array-contains, and any combination
- Dev-only stats: `GET /api/knowledge/stats` — counts by feed, tag, corpus version
- Both return 403 in production (`NODE_ENV === "production"`)
- Route: `artifacts/api-server/src/routes/knowledge.ts`

## Pre-existing lib TS errors

`pnpm run typecheck:libs` and `pnpm --filter @workspace/api-server run typecheck` both show errors unrelated to this project's code — stale `@workspace/api-zod` ambiguous exports and `lib/integrations-openai-ai-server` undeclared types. Server runs cleanly via esbuild. Do NOT attempt to fix these without explicit instruction.

## Debug logging

Each AI flow logs the knowledge manifest at `info` level:
- Blueprint: `req.log.info({ flow: "blueprint", knowledgeManifest, totalKnowledgeTokens }, "[knowledge] Blueprint context injected")`
- Body Weather: `logger.info({ flow: "body-weather", testerId, ... }, "[knowledge] Body Weather context injected")`
- Oracle: `logger.info({ flow: "oracle", conversationId, testerId, ... }, "[knowledge] Oracle context injected")`
