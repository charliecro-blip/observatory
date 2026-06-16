import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supplements = pgTable("supplements", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  name: text("name").notNull(),
  dosage: text("dosage"),
  unit: text("unit"),
  frequency: text("frequency"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSupplementSchema = createInsertSchema(supplements).omit({
  id: true,
  createdAt: true,
});

export type Supplement = typeof supplements.$inferSelect;
export type InsertSupplement = z.infer<typeof insertSupplementSchema>;
