import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const WINDOW_TYPES = [
  "deep_work", "planning", "creative", "admin", "social",
  "relationship", "recovery", "retreat", "launch", "study",
] as const;

export const GOAL_HORIZONS = ["near", "mid", "long"] as const;
export const PROJECT_PRIORITIES = ["low", "medium", "high"] as const;

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  title: text("title").notNull(),
  description: text("description"),
  horizon: text("horizon"), // near | mid | long
  status: text("status").notNull().default("active"), // active | paused | completed | archived
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  goalId: integer("goal_id"), // nullable FK to goals
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active | paused | completed | archived
  priority: text("priority").notNull().default("medium"), // low | medium | high
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: text("target_date"), // ISO date string YYYY-MM-DD
  status: text("status").notNull().default("pending"), // pending | in_progress | completed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const planningWindows = pgTable("planning_windows", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  projectId: integer("project_id"), // nullable FK to projects
  title: text("title").notNull(),
  windowType: text("window_type").notNull().default("deep_work"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type PlanningWindow = typeof planningWindows.$inferSelect;
