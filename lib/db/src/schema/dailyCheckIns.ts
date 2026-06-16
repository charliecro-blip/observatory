import { pgTable, serial, text, integer, json, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyCheckIns = pgTable("daily_check_ins", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  date: text("date").notNull(), // YYYY-MM-DD; unique per (tester_id, date)
  energy: integer("energy"),
  mood: integer("mood"),
  stress: integer("stress"),
  focus: integer("focus"),
  digestion: integer("digestion"),
  sleepQuality: integer("sleep_quality"),
  pain: integer("pain"),
  regulation: integer("regulation"),
  symptomTags: json("symptom_tags").$type<string[]>(),
  behaviorTags: json("behavior_tags").$type<string[]>(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_daily_check_ins_tester_date").on(t.testerId, t.date),
]);

export const insertDailyCheckInSchema = createInsertSchema(dailyCheckIns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DailyCheckIn = typeof dailyCheckIns.$inferSelect;
export type InsertDailyCheckIn = z.infer<typeof insertDailyCheckInSchema>;
