import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const supportPreferences = pgTable("support_preferences", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().unique(),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SupportPreferences = typeof supportPreferences.$inferSelect;
