import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const googleCalTokens = pgTable("google_cal_tokens", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  calendarEmail: text("calendar_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
