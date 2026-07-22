import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const WINDOW_TYPES = [
  "deep_work", "planning", "creative", "admin", "social",
  "relationship", "recovery", "retreat", "launch", "study",
] as const;

export const GOAL_HORIZONS = ["near", "mid", "long"] as const;
export const PROJECT_PRIORITIES = ["low", "medium", "high"] as const;

// Elements a North Star goal can be tagged with — one chief focus per element
// encourages spreading the 1-3 active North Stars across different life domains.
export const GOAL_ELEMENTS = ["fire", "earth", "air", "water"] as const;

// Guiding Stars — the long-term ideals a person is steering by. This table used
// to hold a bigger "Goals" tier with a smaller isNorthStar-flagged subset; that
// distinction is gone — every row here IS a Guiding Star, gated by a max-5-active
// cap enforced in the route layer instead of a boolean toggle.
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  title: text("title").notNull(),
  description: text("description"),
  horizon: text("horizon"), // near | mid | long
  status: text("status").notNull().default("active"), // active | paused | completed | archived
  element: text("element"), // fire | earth | air | water — the domain this goal lives in
  // The star's ruling planet — auto-diagnosed from the title (associateDeterministic)
  // with user override. Planets drive scheduling more precisely than elements
  // (Mars for training, Mercury for study), so this is what best-window timing
  // keys off when present. activityKey is the matched correspondence, if any,
  // which unlocks the precise election engine for the star's windows.
  planet: text("planet"), // Sun | Moon | Mercury | Venus | Mars | Jupiter | Saturn
  activityKey: text("activity_key"), // e.g. "train-hard" — the matched activity correspondence
  // Cycle anchor — ties a goal to the long-cycle context that suggested/supports
  // it, giving it a natural season instead of an invented deadline (cyclical
  // nesting: goals ride chapters — an outer planet moving through a natal house —
  // or the profected year).
  anchorKind: text("anchor_kind"), // chapter | profection
  anchorPlanet: text("anchor_planet"), // e.g. Saturn (chapter anchors only)
  anchorHouse: integer("anchor_house"), // 1-12 natal house
  anchorUntil: text("anchor_until"), // ISO date the chapter/year closes
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

// A planning window doubles as a "session" when linked to a goal: scheduled ahead
// of time (goalId + startTime/endTime set by the user), or logged ad-hoc after the
// fact (adHoc: true, completedAt set at creation) — the game-system-lite of North
// Stars without a separate table.
export const planningWindows = pgTable("planning_windows", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  projectId: integer("project_id"), // nullable FK to projects
  goalId: integer("goal_id"), // nullable FK to goals — set when this is a North Star session
  title: text("title").notNull(),
  windowType: text("window_type").notNull().default("deep_work"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }), // null = scheduled, not yet done
  adHoc: boolean("ad_hoc").notNull().default(false), // logged outside the schedule
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  title: text("title").notNull(),
  notes: text("notes"),
  done: text("done").notNull().default("false"), // "true" | "false"
  dueDate: text("due_date"), // ISO date YYYY-MM-DD, nullable
  bestWindowType: text("best_window_type"), // deep_work | creative | social | etc.
  // How long it needs and how much you'll have to bring — both feed the
  // scheduler (fit a block of the right length into a window whose energy the
  // sky supports) and let the list surface "quick + low" things on flat days.
  estMinutes: integer("est_minutes"),        // rough duration, nullable
  energy: text("energy"),                    // low | medium | high, nullable
  goalId: integer("goal_id"),
  projectId: integer("project_id"),
  // The missing join for project facilitation: a task can belong to a step
  // (milestone) of a Guiding Star, so progress rolls up task → step → star.
  milestoneId: integer("milestone_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Habits: recurring practices with streak tracking
export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  goalId: integer("goal_id"), // nullable FK to goals — a habit can serve a Guiding Star
  projectId: integer("project_id"), // nullable FK to projects — a habit can also serve a project
  milestoneId: integer("milestone_id"), // nullable FK to milestones — a recurring STEP becomes a habit
  name: text("name").notNull(),
  description: text("description"),
  emoji: text("emoji"),
  // Timing affinity — habits absorbed the old "practices/cultivations" timing
  // model in the 2026-07-09 merge, so one daily-doing concept carries it all.
  favoredElements: text("favored_elements"), // comma-separated: water,earth
  favoredPhases: text("favored_phases"),     // comma-separated: waxing,full
  favoredPlanets: text("favored_planets"),   // comma-separated: Mars,Sun — the planet(s) this supports
  bestWindowType: text("best_window_type"),  // deep_work | social | etc.
  minimumViable: text("minimum_viable"),     // smallest version on a hard day
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Individual habit completions
// Named wins — the reflective half of the daily loop (owner 2026-07-17):
// the evening harvest invites one line in your own words per star that moved.
// AUTO wins (completed tasks/steps/habits/sessions) are DERIVED at read time
// from their completion timestamps — only the written ones live here, so
// there's no double-entry and the ledger can never drift from reality.
export const wins = pgTable("wins", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  date: text("date").notNull(),        // YYYY-MM-DD (viewer-local day)
  goalId: integer("goal_id"),          // nullable — a win can be general
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// New-Moon intentions — the cycle's opening bookend (owner 2026-07-18):
// set at (or near) the New Moon, revisited at the next one against the wake.
export const intentions = pgTable("intentions", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  cycleStart: text("cycle_start").notNull(), // YYYY-MM-DD of the New Moon this belongs to
  goalId: integer("goal_id"),                // nullable — an intention can be general
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const habitLogs = pgTable("habit_logs", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull().default("obs_default_charlie"),
  habitId: integer("habit_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  lat: text("lat"),
  lon: text("lon"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Menstrual cycle tracking
export const cycleTracking = pgTable("cycle_tracking", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull(),
  cycleStartDate: text("cycle_start_date").notNull(), // YYYY-MM-DD of most recent cycle day 1
  cycleLength: integer("cycle_length").notNull().default(28),
  lutealLength: integer("luteal_length").notNull().default(14),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export type CycleTracking = typeof cycleTracking.$inferSelect;

export const daemonMemory = pgTable("daemon_memory", {
  id: serial("id").primaryKey(),
  testerId: text("tester_id").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull().default("advisor"), // advisor | journal | reflection
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type PlanningWindow = typeof planningWindows.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type DaemonMemory = typeof daemonMemory.$inferSelect;
