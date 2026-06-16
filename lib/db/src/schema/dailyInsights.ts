import { pgTable, serial, text, integer, json, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyInsights = pgTable("daily_insights", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  date: text("date").notNull(), // YYYY-MM-DD; unique per (tester_id, date)
  checkInId: integer("check_in_id"),
  checkInUpdatedAt: text("check_in_updated_at"),
  capacityLevel: text("capacity_level"),
  capacityScore: integer("capacity_score"),
  bodyWeatherSummary: text("body_weather_summary"),
  bestUseTags: json("best_use_tags").$type<string[]>(),
  watchForTags: json("watch_for_tags").$type<string[]>(),
  supportTags: json("support_tags").$type<string[]>(),
  explanation: text("explanation"),
  generatedContext: json("generated_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_daily_insights_tester_date").on(t.testerId, t.date),
]);

export const insertDailyInsightSchema = createInsertSchema(dailyInsights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DailyInsight = typeof dailyInsights.$inferSelect;
export type InsertDailyInsight = z.infer<typeof insertDailyInsightSchema>;
