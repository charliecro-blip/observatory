import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { supplements } from "./supplements";
import { activities } from "./activities";

export const healthLogs = pgTable("health_logs", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
  type: text("type").notNull(),
  supplementId: integer("supplement_id").references(() => supplements.id, {
    onDelete: "set null",
  }),
  activityId: integer("activity_id").references(() => activities.id, {
    onDelete: "set null",
  }),
  supplementName: text("supplement_name"),
  activityName: text("activity_name"),
  dosageTaken: text("dosage_taken"),
  durationMinutes: integer("duration_minutes"),
  intensity: integer("intensity"),
  mood: integer("mood"),
  energyLevel: integer("energy_level"),
  symptoms: text("symptoms"),
  notes: text("notes"),
  astroSnapshot: text("astro_snapshot"),
  transcribedFrom: text("transcribed_from"),
  // User's local calendar date (YYYY-MM-DD). Populated on write; NULL for legacy rows.
  // Needed because loggedAt is UTC and can't be reliably bucketed without timezone info.
  logDate: text("log_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertHealthLogSchema = createInsertSchema(healthLogs).omit({
  id: true,
  createdAt: true,
});

export type HealthLog = typeof healthLogs.$inferSelect;
export type InsertHealthLog = z.infer<typeof insertHealthLogSchema>;
