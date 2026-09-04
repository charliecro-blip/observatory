import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * CUSTOM ACTIVITIES (owner 2026-09-03: "an option for people to add their
 * own — to put in their own activity... and have that be something we
 * sortage into different astrological energies and create rule sets for").
 *
 * Shaped to match ActivityCorrespondence (activityCorrespondences.ts) field
 * for field, deliberately — a custom activity is not a second, lesser kind
 * of activity, it is a per-tester row the SAME election engine, matcher, and
 * ActivityWeek picker read alongside the built-in fifty. Auto-diagnosed the
 * way a Guiding Star already is (POST /api/associate → element, planets,
 * houses, windowType, gloss), with the same title/description input.
 *
 * `key` is namespaced "custom-<id>" so it can never collide with a built-in
 * activity's key, in either direction — a person naming their own activity
 * "Deep work" does not silently shadow the correspondence table's own
 * deep-work entry (or vice versa, if the built-in list ever grows one).
 */
export const customActivities = pgTable("custom_activities", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull(),
  key: text("key").notNull().unique(), // "custom-<id>", set after insert
  label: text("label").notNull(),
  description: text("description"),
  category: text("category"), // one of ACTIVITY_CATEGORIES' keys, or null
  keywords: jsonb("keywords").notNull().default([]), // string[] — sortage into tasks/habits/goals
  element: text("element"), // fire | earth | air | water
  planets: jsonb("planets").notNull().default({}), // Record<planet, weight>
  hourRulers: jsonb("hour_rulers").notNull().default([]), // string[]
  aspects: text("aspects").notNull().default("soft"), // soft | effort
  signs: jsonb("signs").notNull().default({}), // Record<sign, gloss>
  houses: jsonb("houses").notNull().default([]), // number[]
  phase: text("phase"), // waxing | waning | new | full | null
  voc: text("voc").notNull().default("neutral"), // avoid | neutral | favor
  mercuryRx: text("mercury_rx"), // hard | soft | favor | null
  windowType: text("window_type").notNull().default("deep_work"),
  gloss: text("gloss").notNull().default(""),
  // How the rule set was arrived at — surfaced in the UI so a diagnosis this
  // uncertain about itself is never presented as read like the built-in
  // table (source: "keywords" | "shape" | "ai" | "manual" | "none").
  source: text("source").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CustomActivity = typeof customActivities.$inferSelect;
