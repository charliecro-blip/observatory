import { pgTable, serial, text, real, timestamp, boolean } from "drizzle-orm/pg-core";
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
  // Whether the birth TIME is actually known. When false the chart is computed
  // at noon as an approximation, and everything that genuinely depends on the
  // exact time — Ascendant, Midheaven, houses, profections — is suppressed
  // rather than fabricated. Planet signs (Moon approximate) and aspects remain.
  timeKnown: boolean("time_known").notNull().default(true),
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
