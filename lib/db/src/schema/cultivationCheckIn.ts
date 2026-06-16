import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const cultivationCheckIns = pgTable("cultivation_check_ins", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  cultivationId: integer("cultivation_id").notNull(),
  date: text("date").notNull(),
  completed: boolean("completed").notNull().default(false),
  effortLevel: integer("effort_level"),
  note: text("note"),
  practicesCompleted: jsonb("practices_completed").$type<string[]>(),
  durationMinutes: integer("duration_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CultivationCheckIn = typeof cultivationCheckIns.$inferSelect;
