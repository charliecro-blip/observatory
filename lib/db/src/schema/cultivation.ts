import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const CULTIVATION_DOMAINS = [
  "sleep", "energy", "digestion", "nervous-system", "mood", "movement",
  "pain-tension", "creative-practice", "boundaries", "food-rhythm",
  "social-rhythm", "spiritual-practice", "study-learning", "recovery",
] as const;

export const CULTIVATION_ELEMENTS = ["fire", "earth", "air", "water", "spirit"] as const;
export type CultivationElement = typeof CULTIVATION_ELEMENTS[number];

export const cultivations = pgTable("cultivations", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  element: text("element"),
  elements: jsonb("elements").$type<CultivationElement[]>(),
  description: text("description"),
  relatedPlanet: text("related_planet"),
  relatedHouse: integer("related_house"),
  relatedBodyWeatherTags: jsonb("related_body_weather_tags").$type<string[]>(),
  targetPractice: text("target_practice"),
  frequency: text("frequency").notNull().default("daily"),
  status: text("status").notNull().default("active"),
  // ── Timing rules ──────────────────────────────────────────────────────────
  // Planets that support this practice (e.g. ["Mars", "Sun"] for strength training)
  favoredPlanets: jsonb("favored_planets").$type<string[]>(),
  // Planets that call for softening this practice (e.g. ["Saturn", "Neptune"])
  cautionPlanets: jsonb("caution_planets").$type<string[]>(),
  // Moon phase quadrants: "new" | "waxing" | "full" | "waning"
  favoredPhases: jsonb("favored_phases").$type<string[]>(),
  // The minimum viable version of this practice during adverse timing
  minimumViable: text("minimum_viable"),
  // ──────────────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Cultivation = typeof cultivations.$inferSelect;
