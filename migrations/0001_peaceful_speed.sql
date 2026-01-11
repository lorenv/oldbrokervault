CREATE TABLE "buyer_pipeline_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"display_order" integer NOT NULL,
	"color" text DEFAULT '#6B7280',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_buyers" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"contact_id" integer,
	"company_id" integer,
	"stage_id" integer NOT NULL,
	"notes" text,
	"last_contact_date" timestamp,
	"next_follow_up" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cim_documents" ADD COLUMN "deal_id" integer;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD COLUMN "contact_type" text DEFAULT 'other';