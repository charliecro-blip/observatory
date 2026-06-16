import { Router, type IRouter } from "express";
import { db, knowledgeChunks } from "@workspace/db";
import { ilike, or, sql, and, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/knowledge/search", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "not_available", message: "Knowledge search is dev-only" });
    return;
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const moduleFeed = typeof req.query.moduleFeed === "string" ? req.query.moduleFeed.trim() : "";
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
  const rawLimit = parseInt(String(req.query.limit ?? "10"), 10);
  const limit = Math.min(isNaN(rawLimit) ? 10 : rawLimit, 50);

  const conditions: ReturnType<typeof ilike>[] = [];

  if (q) {
    conditions.push(
      or(
        ilike(knowledgeChunks.content, `%${q}%`),
        ilike(knowledgeChunks.title, `%${q}%`),
        ilike(knowledgeChunks.sectionHeading, `%${q}%`),
      )!,
    );
  }

  if (moduleFeed) {
    conditions.push(
      sql`${knowledgeChunks.moduleFeeds} @> ARRAY[${moduleFeed}]::text[]` as ReturnType<typeof ilike>,
    );
  }

  if (tag) {
    conditions.push(
      sql`${knowledgeChunks.tags} @> ARRAY[${tag}]::text[]` as ReturnType<typeof ilike>,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countRow] = await Promise.all([
    db
      .select({
        id: knowledgeChunks.id,
        filePath: knowledgeChunks.filePath,
        title: knowledgeChunks.title,
        sectionHeading: knowledgeChunks.sectionHeading,
        sectionIndex: knowledgeChunks.sectionIndex,
        moduleFeeds: knowledgeChunks.moduleFeeds,
        tags: knowledgeChunks.tags,
        approxTokens: knowledgeChunks.approxTokens,
        corpusVersion: knowledgeChunks.corpusVersion,
        content: knowledgeChunks.content,
      })
      .from(knowledgeChunks)
      .where(where)
      .orderBy(knowledgeChunks.filePath, knowledgeChunks.sectionIndex)
      .limit(limit),
    db
      .select({ count: sql<string>`COUNT(*)` })
      .from(knowledgeChunks)
      .where(where),
  ]);

  res.json({
    results: rows,
    total: parseInt(countRow[0]?.count ?? "0", 10),
    limit,
    query: { q: q || undefined, moduleFeed: moduleFeed || undefined, tag: tag || undefined },
  });
});

router.get("/knowledge/stats", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "not_available", message: "Knowledge stats is dev-only" });
    return;
  }

  const [totalRow, feedRows, tagRows] = await Promise.all([
    db.select({ count: sql<string>`COUNT(*)` }).from(knowledgeChunks),
    db
      .select({ feed: sql<string>`UNNEST(module_feeds)`, count: sql<string>`COUNT(*)` })
      .from(knowledgeChunks)
      .groupBy(sql`UNNEST(module_feeds)`)
      .orderBy(sql`COUNT(*) DESC`),
    db
      .select({ tag: sql<string>`UNNEST(tags)`, count: sql<string>`COUNT(*)` })
      .from(knowledgeChunks)
      .groupBy(sql`UNNEST(tags)`)
      .orderBy(sql`COUNT(*) DESC`),
  ]);

  const corpusRow = await db
    .select({ corpusVersion: knowledgeChunks.corpusVersion, count: sql<string>`COUNT(*)` })
    .from(knowledgeChunks)
    .groupBy(knowledgeChunks.corpusVersion);

  res.json({
    totalChunks: parseInt(totalRow[0]?.count ?? "0", 10),
    byCorpusVersion: corpusRow.map((r) => ({ version: r.corpusVersion, count: parseInt(r.count, 10) })),
    byModuleFeed: feedRows.map((r) => ({ feed: r.feed, count: parseInt(r.count, 10) })),
    byTag: tagRows.map((r) => ({ tag: r.tag, count: parseInt(r.count, 10) })),
  });
});

export default router;
