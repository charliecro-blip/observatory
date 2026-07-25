import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

// Email report subscriptions — the morning report, actually delivered.
// One row per tester; spans picks which composed reports they get:
//   "day"     — every morning at sendHour (subscriber-local)
//   "week"    — Sunday mornings (the week ahead)
//   "newmoon" — the morning a New Moon lands
// lat/lon stored as text to match push_subscriptions; the notifier derives the
// subscriber-local clock from lon (15° ≈ 1 hour), same as push.
export const emailSubscriptions = pgTable("email_subscriptions", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().unique(),
  email: text("email").notNull(),
  spans: jsonb("spans").$type<string[]>().notNull().default(["day"]),
  sendHour: integer("send_hour").notNull().default(7),
  enabled: text("enabled").notNull().default("true"),
  lat: text("lat"),
  lon: text("lon"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EmailSubscription = typeof emailSubscriptions.$inferSelect;
