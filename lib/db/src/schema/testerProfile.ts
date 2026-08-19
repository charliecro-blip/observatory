import { pgTable, text, timestamp, jsonb, index, serial } from "drizzle-orm/pg-core";

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
  // When this account was first credentialed (a session minted). Before this
  // instant the bare tester id behaves as it always did — which is what lets
  // the session model roll out without bricking a single existing device;
  // after it, every request must carry a valid session token. Null = the
  // pre-accounts world, still open, still claimable.
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  // Display and notification preferences, as the client's own TidesPreferences
  // object (audit 2026-08-19 §7).
  //
  // These lived in localStorage alone, which on the per-device session model
  // means a preference set on a laptop does not exist on the same person's
  // phone. Tolerable while the only settings were toggles someone flips once;
  // not tolerable for a dashboard people ARRANGE, where a layout silently
  // resetting on the second device is worse than never offering the feature.
  //
  // Stored whole rather than as columns: the shape is the client's to own and
  // grows with it, and the same wholesale-restore reasoning already applies to
  // chronotype above. Last write wins across devices, which is the honest
  // policy for a per-device model — nobody's edit is merged into a shape it
  // was not made against.
  prefs: jsonb("prefs"),
  // Entitlement, named now so billing has a column to read the day it exists.
  // Everyone is 'beta' — a gift received, not a bill arriving (BACKLOG §5).
  plan: text("plan").notNull().default("beta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("ix_tester_feed_token").on(t.feedTokenHash)]);

/**
 * Server-issued session credentials — the thing the tester id never was.
 *
 * One row per device/browser, so restoring on a phone does not sign out the
 * desktop. The token itself exists only in the moment it is minted; the row
 * keeps a SHA-256 hash, same doctrine as the feed token: a database dump must
 * not hand out working credentials. Keyed by tester_id so account deletion's
 * discovery sweep (lib/accountDeletion.testerScopedTables) takes these rows
 * with everything else, with no list to forget to update.
 */
export const accountSessions = pgTable("account_sessions", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  /** Where this session came from — "claim", "signup", "recovery". */
  origin: text("origin").notNull().default("claim"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
}, (t) => [
  index("ix_session_token_hash").on(t.tokenHash),
  index("ix_session_tester").on(t.testerId),
]);

export type AccountSessionRow = typeof accountSessions.$inferSelect;

export type TesterProfileRow = typeof testerProfiles.$inferSelect;
