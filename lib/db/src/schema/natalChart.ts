import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const natalCharts = pgTable("natal_charts", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time").notNull().default("12:00"),
  birthPlace: text("birth_place").notNull(),
  birthLat: real("birth_lat").notNull(),
  birthLon: real("birth_lon").notNull(),
  utcOffset: real("utc_offset").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertNatalChartSchema = createInsertSchema(natalCharts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type NatalChart = typeof natalCharts.$inferSelect;
export type InsertNatalChart = z.infer<typeof insertNatalChartSchema>;
