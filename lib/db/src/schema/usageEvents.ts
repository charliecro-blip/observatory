import { pgTable, serial, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Usage events — lightweight product analytics (owner 2026-07-20): which
 * surfaces do people actually use, where do they drop? Written ONLY on user
 * action (a view change, a key conversion) — never on a timer, so it can't keep
 * the DB awake the way the notifier poll did. Fire-and-forget from the client.
 */
export const usageEvents = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id"),
  event: text("event").notNull(),       // e.g. "view", "election_schedule", "win_named"
  props: jsonb("props").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("ix_usage_events_event").on(t.event), index("ix_usage_events_created").on(t.createdAt)]);
