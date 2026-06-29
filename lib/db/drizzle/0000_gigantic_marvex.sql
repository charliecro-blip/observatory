CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplements" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"name" text NOT NULL,
	"dosage" text,
	"unit" text,
	"frequency" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"supplement_id" integer,
	"activity_id" integer,
	"supplement_name" text,
	"activity_name" text,
	"dosage_taken" text,
	"duration_minutes" integer,
	"intensity" integer,
	"mood" integer,
	"energy_level" integer,
	"symptoms" text,
	"notes" text,
	"astro_snapshot" text,
	"transcribed_from" text,
	"log_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "natal_charts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"birth_date" text NOT NULL,
	"birth_time" text DEFAULT '12:00' NOT NULL,
	"birth_place" text NOT NULL,
	"birth_lat" real NOT NULL,
	"birth_lon" real NOT NULL,
	"utc_offset" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_check_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"date" text NOT NULL,
	"energy" integer,
	"mood" integer,
	"stress" integer,
	"focus" integer,
	"digestion" integer,
	"sleep_quality" integer,
	"pain" integer,
	"regulation" integer,
	"symptom_tags" json,
	"behavior_tags" json,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"date" text NOT NULL,
	"check_in_id" integer,
	"check_in_updated_at" text,
	"capacity_level" text,
	"capacity_score" integer,
	"body_weather_summary" text,
	"best_use_tags" json,
	"watch_for_tags" json,
	"support_tags" json,
	"explanation" text,
	"generated_context" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "natal_blueprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text NOT NULL,
	"natal_chart_id" integer NOT NULL,
	"blueprint_json" jsonb,
	"generated_text" text,
	"prompt_version" text DEFAULT 'v1' NOT NULL,
	"chart_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cultivations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"title" text NOT NULL,
	"domain" text NOT NULL,
	"element" text,
	"elements" jsonb,
	"description" text,
	"related_planet" text,
	"related_house" integer,
	"related_body_weather_tags" jsonb,
	"target_practice" text,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"favored_planets" jsonb,
	"caution_planets" jsonb,
	"favored_phases" jsonb,
	"minimum_viable" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cultivation_check_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"cultivation_id" integer NOT NULL,
	"date" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"effort_level" integer,
	"note" text,
	"practices_completed" jsonb,
	"duration_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_preferences_tester_id_unique" UNIQUE("tester_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_path" text NOT NULL,
	"title" text NOT NULL,
	"module_feeds" text[] DEFAULT '{}' NOT NULL,
	"section_heading" text NOT NULL,
	"section_index" integer NOT NULL,
	"content" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"approx_tokens" integer DEFAULT 0 NOT NULL,
	"corpus_version" text DEFAULT 'medical-astrology-v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_chunks_file_section_idx" UNIQUE("file_path","section_index")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"horizon" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"habit_id" integer NOT NULL,
	"date" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"emoji" text,
	"favored_elements" text,
	"favored_phases" text,
	"favored_biodynamic" text,
	"best_window_type" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_date" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_windows" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"project_id" integer,
	"title" text NOT NULL,
	"window_type" text DEFAULT 'deep_work' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"goal_id" integer,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tester_id" text DEFAULT 'obs_default_charlie' NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"done" text DEFAULT 'false' NOT NULL,
	"due_date" text,
	"best_window_type" text,
	"goal_id" integer,
	"project_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_logs" ADD CONSTRAINT "health_logs_supplement_id_supplements_id_fk" FOREIGN KEY ("supplement_id") REFERENCES "public"."supplements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_logs" ADD CONSTRAINT "health_logs_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily_check_ins_tester_date" ON "daily_check_ins" USING btree ("tester_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily_insights_tester_date" ON "daily_insights" USING btree ("tester_id","date");