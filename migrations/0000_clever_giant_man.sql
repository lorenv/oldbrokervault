CREATE TABLE "analysis_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"custom_directions" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cim_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"transcript" text NOT NULL,
	"directions" text NOT NULL,
	"section_directions" jsonb,
	"formatting_profile" text DEFAULT 'balanced',
	"regeneration_count" integer DEFAULT 0 NOT NULL,
	"analysis" jsonb NOT NULL,
	"is_uploaded_file" boolean DEFAULT false NOT NULL,
	"uploaded_file_name" text,
	"uploaded_file_path" text,
	"uploaded_file_size" integer,
	"uploaded_file_mime_type" text,
	"edited_content" jsonb,
	"logo_url" text,
	"website_url" text,
	"website_screenshot_url" text,
	"selected_images" text[],
	"logo_url_backup" text,
	"selected_images_backup" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"share_enabled" boolean DEFAULT false NOT NULL,
	"share_slug" text,
	"custom_slug" text,
	"share_password" text,
	"share_expires_at" timestamp,
	"share_view_count" integer DEFAULT 0 NOT NULL,
	"share_last_viewed" timestamp,
	"nda_protected" boolean DEFAULT false NOT NULL,
	"nda_template_id" integer,
	"nda_approval_required" boolean DEFAULT false NOT NULL,
	"copy_me_on_emails" boolean DEFAULT false NOT NULL,
	"financials_enabled" boolean DEFAULT true NOT NULL,
	"asking_price" text,
	"asking_price_included" boolean DEFAULT true NOT NULL,
	"revenue" text,
	"revenue_included" boolean DEFAULT true NOT NULL,
	"ebitda" text,
	"ebitda_included" boolean DEFAULT true NOT NULL,
	"current_editor_id" integer,
	"current_editor_name" text,
	"edit_started_at" timestamp,
	"last_activity_at" timestamp,
	"cover_image_url" text,
	"cover_image_position" text,
	"cover_image_attribution" text,
	"cover_image_backup" text,
	"search_vector" text,
	"version" integer DEFAULT 1 NOT NULL,
	"last_modified_by" integer,
	"is_example" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"display_settings" jsonb,
	CONSTRAINT "cim_documents_share_slug_unique" UNIQUE("share_slug"),
	CONSTRAINT "cim_documents_custom_slug_unique" UNIQUE("custom_slug")
);
--> statement-breakpoint
CREATE TABLE "collaborators" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"email" text NOT NULL,
	"user_id" integer,
	"permission" text NOT NULL,
	"invited_by" integer NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"invite_token" text NOT NULL,
	CONSTRAINT "collaborators_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"website" text,
	"industry" text,
	"size" text,
	"annual_revenue" text,
	"address" text,
	"city" text,
	"state" text,
	"country" text,
	"phone" text,
	"linkedin_url" text,
	"owner_id" integer,
	"custom_properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_style_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"section_directions" jsonb NOT NULL,
	"formatting_profile" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" integer NOT NULL,
	"performed_by" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"title" text,
	"description" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"object_type" text NOT NULL,
	"object_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"title" text,
	"department" text,
	"company_id" integer,
	"owner_id" integer,
	"lifecycle_stage" text DEFAULT 'lead',
	"lead_status" text DEFAULT 'new',
	"custom_properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text,
	"last_activity_date" timestamp,
	"linkedin_url" text,
	"notes" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"object_type" text NOT NULL,
	"object_id" integer NOT NULL,
	"content" text NOT NULL,
	"rich_content" jsonb,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"content" text,
	"custom_css" text,
	"image_urls" text[],
	"image_url" text,
	"image_urls_backup" text[],
	"position" integer NOT NULL,
	"insert_after_section" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"role" text DEFAULT 'other',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"cim_document_id" integer NOT NULL,
	"linked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"amount" text,
	"currency" text DEFAULT 'USD',
	"pipeline_id" integer NOT NULL,
	"stage_id" integer NOT NULL,
	"close_date" timestamp,
	"closed_at" timestamp,
	"probability" integer,
	"owner_id" integer,
	"company_id" integer,
	"custom_properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text,
	"lost_reason" text,
	"description" text,
	"priority" text DEFAULT 'normal',
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"user_id" integer,
	"user_name" text,
	"user_email" text,
	"action" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"session_id" text
);
--> statement-breakpoint
CREATE TABLE "document_baselines" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"baseline_transcript" text,
	"baseline_directions" text,
	"baseline_financials" jsonb,
	"original_transcript" text NOT NULL,
	"original_directions" text NOT NULL,
	"company_name" text,
	"industry" text,
	"business_model" text,
	"primary_market" text,
	"original_revenue" text,
	"original_ebitda" text,
	"original_employee_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_baselines_cim_document_id_unique" UNIQUE("cim_document_id")
);
--> statement-breakpoint
CREATE TABLE "document_downloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"viewer_email" text,
	"viewer_identifier" text,
	"download_type" text NOT NULL,
	"ip_address" text,
	"downloaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" text NOT NULL,
	"user_email" text NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"taken_over_from" integer,
	CONSTRAINT "document_locks_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"version" integer NOT NULL,
	"changes" jsonb NOT NULL,
	"changed_by" integer NOT NULL,
	"change_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"viewer_type" text NOT NULL,
	"viewer_identifier" text,
	"ip_address" text,
	"user_agent" text,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"location" text,
	"session_id" text,
	"time_spent_seconds" integer DEFAULT 0,
	"last_heartbeat" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"message_id" integer,
	"sendgrid_message_id" text,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"sync_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esign_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"envelope_id" integer NOT NULL,
	"recipient_id" integer,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"location" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esign_envelopes" (
	"id" serial PRIMARY KEY NOT NULL,
	"envelope_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"signing_order" text DEFAULT 'parallel' NOT NULL,
	"document_url" text NOT NULL,
	"page_images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_pages" integer DEFAULT 1 NOT NULL,
	"template_id" integer,
	"document_hash" text,
	"signed_document_hash" text,
	"signed_document_url" text,
	"certificate_url" text,
	"completed_at" timestamp,
	"voided_at" timestamp,
	"void_reason" text,
	"declined_at" timestamp,
	"declined_by" text,
	"decline_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "esign_envelopes_envelope_id_unique" UNIQUE("envelope_id")
);
--> statement-breakpoint
CREATE TABLE "esign_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"envelope_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"type" text NOT NULL,
	"x" text NOT NULL,
	"y" text NOT NULL,
	"width" text NOT NULL,
	"height" text NOT NULL,
	"page" integer DEFAULT 1 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"value" text,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "esign_recent_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"use_count" integer DEFAULT 1 NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esign_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"envelope_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'signer' NOT NULL,
	"placeholder_label" text,
	"color" text NOT NULL,
	"signing_order" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"access_token" text NOT NULL,
	"consented_at" timestamp,
	"consent_ip_address" text,
	"decline_reason" text,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"declined_at" timestamp,
	"ip_address" text,
	"location" text,
	"user_agent" text,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp,
	CONSTRAINT "esign_recipients_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "esign_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"document_url" text NOT NULL,
	"page_images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_pages" integer DEFAULT 1 NOT NULL,
	"placeholder_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"filename" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_automation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"automation_id" integer NOT NULL,
	"connection_id" integer,
	"event_type" text NOT NULL,
	"event_id" text NOT NULL,
	"event_payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"skipped_reason" text,
	"request_payload" jsonb,
	"response_status" integer,
	"response_body" text,
	"error_message" text,
	"external_id" text,
	"external_url" text,
	"file_uploaded" boolean DEFAULT false NOT NULL,
	"file_name" text,
	"file_size" integer,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"connection_id" integer,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"trigger_event" text NOT NULL,
	"trigger_condition" jsonb,
	"destination_type" text NOT NULL,
	"destination_config" jsonb NOT NULL,
	"behavior" text DEFAULT 'upsert',
	"match_field" text,
	"field_mappings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"include_file" boolean DEFAULT false NOT NULL,
	"file_source" text,
	"file_destination" text,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"successful_runs" integer DEFAULT 0 NOT NULL,
	"failed_runs" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text,
	"provider_account_name" text,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp,
	"scopes" text[],
	"webhook_url" text,
	"webhook_secret" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp,
	"last_error" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"notes" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"last_contact_date" timestamp,
	"next_follow_up_date" timestamp,
	"total_document_views" integer DEFAULT 0 NOT NULL,
	"total_time_spent_minutes" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"location" text,
	"is_potential_vpn" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"cim_document_id" integer NOT NULL,
	"inquirer_email" text NOT NULL,
	"inquirer_name" text NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"thread_email_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_threads_thread_email_address_unique" UNIQUE("thread_email_address")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"sender_type" text NOT NULL,
	"sender_email" text NOT NULL,
	"content" text NOT NULL,
	"rich_content" jsonb,
	"message_type" text NOT NULL,
	"sendgrid_message_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nda_access_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"cim_document_id" integer NOT NULL,
	"nda_signature_id" integer NOT NULL,
	"signer_email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "nda_access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "nda_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"signing_session_id" integer NOT NULL,
	"recipient_id" integer,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nda_field_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"recipient_id" integer NOT NULL,
	"signing_session_id" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"prefilled" boolean DEFAULT false NOT NULL,
	"prefilled_value" text,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"field_value" text
);
--> statement-breakpoint
CREATE TABLE "nda_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"signing_session_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'signer' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"access_token" text NOT NULL,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"ip_address" text,
	"location" text,
	"user_agent" text,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp,
	CONSTRAINT "nda_recipients_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "nda_redirect_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"redirect_id" text NOT NULL,
	"current_token_id" integer NOT NULL,
	"cim_document_id" integer NOT NULL,
	"signer_email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nda_redirect_links_redirect_id_unique" UNIQUE("redirect_id")
);
--> statement-breakpoint
CREATE TABLE "nda_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"share_slug" text,
	"signer_name" text NOT NULL,
	"signer_email" text NOT NULL,
	"signer_ip_address" text NOT NULL,
	"signer_location" text,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"signed_nda_content" text NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp,
	"approved_by" integer,
	"rejected" boolean DEFAULT false NOT NULL,
	"rejected_at" timestamp,
	"rejected_by" integer,
	"field_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signing_session_id" integer,
	"stage" text
);
--> statement-breakpoint
CREATE TABLE "nda_signing_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"cim_document_id" integer,
	"share_slug" text,
	"title" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "nda_signing_sessions_share_slug_unique" UNIQUE("share_slug")
);
--> statement-breakpoint
CREATE TABLE "nda_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"file_content" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"signature_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"page_images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_pages" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_email_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"template_id" text NOT NULL,
	"delay_in_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by" integer,
	"invited_at" timestamp,
	"joined_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" integer NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subscription_tier" text DEFAULT 'free',
	"seat_count" integer DEFAULT 1 NOT NULL,
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"pipeline_id" integer NOT NULL,
	"name" text NOT NULL,
	"display_order" integer NOT NULL,
	"probability" integer DEFAULT 0,
	"color" text DEFAULT '#6B7280',
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"deal_rotting" integer DEFAULT 30,
	"currency" text DEFAULT 'USD',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sde_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"original_filename" text NOT NULL,
	"original_file_path" text NOT NULL,
	"original_file_size" integer NOT NULL,
	"original_mime_type" text NOT NULL,
	"result_filename" text,
	"result_file_path" text,
	"result_file_size" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"analysis_warnings" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processing_started_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"claude_file_id" text,
	"claude_result_file_id" text,
	"claude_request_id" text,
	"processing_time_seconds" integer,
	"use_filesystem_storage" boolean DEFAULT false,
	"download_count" integer DEFAULT 0 NOT NULL,
	"last_downloaded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "search_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"content" text NOT NULL,
	"content_type" text NOT NULL,
	"search_vector" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"cim_document_id" integer NOT NULL,
	"share_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "share_links_share_slug_unique" UNIQUE("share_slug")
);
--> statement-breakpoint
CREATE TABLE "teaser_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"teaser_id" integer NOT NULL,
	"viewer_ip" text,
	"viewer_user_agent" text,
	"referrer" text,
	"session_id" text,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"clicked_sign_nda" boolean DEFAULT false NOT NULL,
	"clicked_contact" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teasers" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"headline" text,
	"summary" text,
	"industry_tags" text[] DEFAULT '{}',
	"deal_type_tags" text[] DEFAULT '{}',
	"cover_image_url" text,
	"cover_image_attribution" text,
	"use_cim_cover_image" boolean DEFAULT true NOT NULL,
	"show_financials" boolean DEFAULT false NOT NULL,
	"revenue" text,
	"earnings" text,
	"asking_price" text,
	"share_slug" text,
	"share_password" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"include_watermark" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp,
	"cim_updated_since_sync" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_order" integer DEFAULT 0,
	"listing_status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teasers_document_id_unique" UNIQUE("document_id"),
	CONSTRAINT "teasers_share_slug_unique" UNIQUE("share_slug")
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"cim_document_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_branding" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#0072CE' NOT NULL,
	"company_name" text,
	"email_from_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_branding_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_email_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"sequence_id" integer NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_teaser_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tag_type" text NOT NULL,
	"tag_value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"subscription_status" text DEFAULT 'free' NOT NULL,
	"subscription_ends_at" timestamp,
	"monthly_usage" integer DEFAULT 0 NOT NULL,
	"annual_documents_created" integer DEFAULT 0 NOT NULL,
	"annual_regenerations_used" integer DEFAULT 0 NOT NULL,
	"last_usage_reset" timestamp DEFAULT now() NOT NULL,
	"monthly_documents_created" integer DEFAULT 0 NOT NULL,
	"monthly_regenerations_used" integer DEFAULT 0 NOT NULL,
	"monthly_sde_analyses" integer DEFAULT 0 NOT NULL,
	"stripe_customer_id" text,
	"subscription_id" text,
	"google_access_token" text,
	"google_refresh_token" text,
	"google_token_expiry" timestamp,
	"name" text,
	"first_name" text,
	"last_name" text,
	"title" text,
	"phone_number" text,
	"business_name" text,
	"business_logo" text,
	"profile_photo" text,
	"business_logo_backup" text,
	"profile_photo_backup" text,
	"reset_token" text,
	"reset_token_expiry" timestamp,
	"cognito_user_id" text,
	"cognito_username" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_code" text,
	"verification_code_expiry" timestamp,
	"pdf_background_template" text DEFAULT 'classic',
	"custom_subdomain" text,
	"brand_colors" jsonb,
	"pdf_primary_color" text,
	"pdf_secondary_color" text,
	"branded_pdf_template" text DEFAULT 'none',
	"email_preferences" jsonb DEFAULT '{"onboarding":true,"marketing":true,"transactional":true}'::jsonb,
	"unsubscribe_token" text,
	"unsubscribe_token_expiry" timestamp,
	"default_display_settings" jsonb,
	"listings_enabled" boolean DEFAULT false NOT NULL,
	"listings_slug" text,
	"listings_title" text,
	"listings_tagline" text,
	"listings_banner_url" text,
	"listings_layout" text DEFAULT 'grid',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_subscription_id_unique" UNIQUE("subscription_id"),
	CONSTRAINT "users_listings_slug_unique" UNIQUE("listings_slug")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_code" integer,
	"response_body" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
