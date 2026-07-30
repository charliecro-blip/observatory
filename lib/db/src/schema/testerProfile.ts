import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

// Server-side copy of the tester profile that otherwise lives only in the
// browser's localStorage. This is the "account": the tester id stays the
// primary identity (all other tables key on it), and the recovery code is the
// human-friendly secret that lets a user reclaim that id on a new device —
// no passwords, no email infrastructure, right-sized for beta.
export const testerProfiles = pgTable("tester_profiles", {
  testerId: text("tester_id").primaryKey(),
  displayName: text("display_name").notNull().default("Observer"),
  // Recovery key, e.g. "TIDE-7K2M-Q4XD". Unique bearer secret — whoever holds
  // it can restore the profile, so it's generated server-side from crypto
  // randomness and shown to the user in Settings.
  recoveryCode: text("recovery_code").notNull().unique(),
  // Mirrors of the localStorage profile fields, stored as-is so a restore can
  // reconstruct the client profile wholesale.
  chronotype: jsonb("chronotype"),
  cautionPlanets: jsonb("caution_planets"),
  // Calendar-feed token — a SEPARATE secret from both the tester id and the
  // recovery code, because a webcal URL is handed to Google/Apple and stored
  // by them indefinitely. Scoped to the iCal route only and never accepted as
  // an identity anywhere else, so leaking it exposes the schedule and nothing
  // more. Stored as a SHA-256 hash: a database dump shouldn't hand out live
  // feed URLs. Regenerating issues a new one and invalidates the old.
  feedTokenHash: text("feed_token_hash"),
  feedTokenCreatedAt: timestamp("feed_token_created_at", { withTimezone: true }),
  feedTokenLastUsedAt: timestamp("feed_token_last_used_at", { withTimezone: true }),
  lat: text("lat"),
  lon: text("lon"),
  locationLabel: text("location_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("ix_tester_feed_token").on(t.feedTokenHash)]);

export type TesterProfileRow = typeof testerProfiles.$inferSelect;
