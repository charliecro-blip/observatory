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
  // How much astrology the email is allowed to speak. `astroDetail` is a
  // CLIENT preference (localStorage), so the composer had no way to honour it
  // — a subscriber who chose "just the guidance, no jargon" was still emailed
  // degrees, hour rulers and sign glyphs. Mirrored here at subscribe time so
  // the server can gate its own register. minimal | medium | full.
  detail: text("detail").notNull().default("medium"),
  // The subscriber's real IANA zone (e.g. "America/Chicago"). The notifier
  // used to infer a whole-hour offset from LONGITUDE, which is not a timezone:
  // it has no DST (already ~1h wrong across a US summer), no half-hour or
  // quarter-hour zones, and no political boundaries. Captured from the browser
  // at opt-in; longitude remains the fallback for rows saved before this.
  timeZone: text("time_zone"),
  lat: text("lat"),
  lon: text("lon"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EmailSubscription = typeof emailSubscriptions.$inferSelect;
