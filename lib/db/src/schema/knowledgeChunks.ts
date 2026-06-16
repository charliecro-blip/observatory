import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: serial("id").primaryKey(),
    filePath: text("file_path").notNull(),
    title: text("title").notNull(),
    moduleFeeds: text("module_feeds").array().notNull().default([]),
    sectionHeading: text("section_heading").notNull(),
    sectionIndex: integer("section_index").notNull(),
    content: text("content").notNull(),
    tags: text("tags").array().notNull().default([]),
    approxTokens: integer("approx_tokens").notNull().default(0),
    corpusVersion: text("corpus_version").notNull().default("medical-astrology-v1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("knowledge_chunks_file_section_idx").on(t.filePath, t.sectionIndex)],
);

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
