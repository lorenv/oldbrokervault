CREATE TABLE "ai_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tokens_used" integer,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_token_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"model" text NOT NULL,
	"period_start" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" timestamp,
	"due_time" text,
	"reminder" text DEFAULT 'none',
	"reminder_sent_at" timestamp,
	"overdue_notified_at" timestamp,
	"assigned_to" integer,
	"created_by" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"object_type" text,
	"object_id" integer,
	"completed_at" timestamp,
	"completed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"object_type" text NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"description" text,
	"placeholder" text,
	"options" jsonb DEFAULT '[]'::jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"group_name" text DEFAULT 'Custom Fields',
	"min_value" integer,
	"max_value" integer,
	"max_length" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_briefings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"briefing" jsonb NOT NULL,
	"source_data" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"valid_for_date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sorting" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"view_mode" text DEFAULT 'list',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detail_page_layouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"object_type" text NOT NULL,
	"layout" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"category" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "incoming_webhook_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_id" integer NOT NULL,
	"request_id" text NOT NULL,
	"source_ip" text,
	"raw_payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mapped_data" jsonb,
	"created_entity_type" text,
	"created_entity_id" integer,
	"error_message" text,
	"processing_time_ms" integer,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "incoming_webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"action_type" text NOT NULL,
	"field_mappings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"action_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_received" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_received_at" timestamp,
	"last_success_at" timestamp,
	"last_error_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "incoming_webhooks_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"mentioned_user_id" integer NOT NULL,
	"mentioned_by_user_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"note_id" integer,
	"mention_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"actor_id" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"email_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"permission_key" text NOT NULL,
	"role" text NOT NULL,
	"granted" boolean NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_task_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_name" text NOT NULL,
	"execution_date" text NOT NULL,
	"metadata" jsonb,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"user_id" integer NOT NULL,
	"type" text DEFAULT 'bug' NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"browser_info" text,
	"page_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email_mentions" boolean DEFAULT true NOT NULL,
	"email_task_assigned" boolean DEFAULT true NOT NULL,
	"email_task_reminder" boolean DEFAULT true NOT NULL,
	"email_deal_updates" boolean DEFAULT false NOT NULL,
	"email_team_invites" boolean DEFAULT true NOT NULL,
	"email_esign_requests" boolean DEFAULT true NOT NULL,
	"email_esign_completed" boolean DEFAULT true NOT NULL,
	"email_weekly_digest" boolean DEFAULT false NOT NULL,
	"inapp_mentions" boolean DEFAULT true NOT NULL,
	"inapp_task_assigned" boolean DEFAULT true NOT NULL,
	"inapp_task_reminder" boolean DEFAULT true NOT NULL,
	"inapp_deal_updates" boolean DEFAULT true NOT NULL,
	"inapp_esign_requests" boolean DEFAULT true NOT NULL,
	"inapp_esign_completed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_source" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_fetch_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_last_fetch_at" timestamp;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD COLUMN "avatar_source" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'America/New_York';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "microsoft_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" text DEFAULT 'local';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_microsoft_id_unique" UNIQUE("microsoft_id");