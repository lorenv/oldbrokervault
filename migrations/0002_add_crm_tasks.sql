-- CRM Tasks table for task management linked to deals, contacts, and companies
CREATE TABLE IF NOT EXISTS "crm_tasks" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "due_date" timestamp,
  "due_time" text,
  "reminder" text DEFAULT 'none',
  "reminder_sent_at" timestamp,
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

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "crm_tasks_organization_id_idx" ON "crm_tasks" ("organization_id");
CREATE INDEX IF NOT EXISTS "crm_tasks_assigned_to_idx" ON "crm_tasks" ("assigned_to");
CREATE INDEX IF NOT EXISTS "crm_tasks_created_by_idx" ON "crm_tasks" ("created_by");
CREATE INDEX IF NOT EXISTS "crm_tasks_status_idx" ON "crm_tasks" ("status");
CREATE INDEX IF NOT EXISTS "crm_tasks_due_date_idx" ON "crm_tasks" ("due_date");
CREATE INDEX IF NOT EXISTS "crm_tasks_object_type_object_id_idx" ON "crm_tasks" ("object_type", "object_id");
