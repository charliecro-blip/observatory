import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

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
  lat: text("lat"),
  lon: text("lon"),
  locationLabel: text("location_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TesterProfileRow = typeof testerProfiles.$inferSelect;
