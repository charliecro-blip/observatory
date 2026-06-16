import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const natalBlueprints = pgTable("natal_blueprints", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull(),
  natalChartId: integer("natal_chart_id").notNull(),
  blueprintJson: jsonb("blueprint_json"),
  generatedText: text("generated_text"),
  promptVersion: text("prompt_version").notNull().default("v1"),
  chartUpdatedAt: timestamp("chart_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type NatalBlueprint = typeof natalBlueprints.$inferSelect;
