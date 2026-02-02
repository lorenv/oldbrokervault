-- Performance indexes for critical scalability improvements
-- Added 2026-02-02 as part of security/scalability audit

-- CIM Documents indexes for user queries
CREATE INDEX IF NOT EXISTS cim_documents_user_id_idx ON cim_documents(user_id);
CREATE INDEX IF NOT EXISTS cim_documents_user_deleted_idx ON cim_documents(user_id, deleted_at);

-- Deals indexes for organization and stage queries
CREATE INDEX IF NOT EXISTS deals_organization_stage_idx ON deals(organization_id, stage_id);
CREATE INDEX IF NOT EXISTS deals_org_closed_updated_idx ON deals(organization_id, closed_at, updated_at);

-- CRM Activities indexes for activity log queries
CREATE INDEX IF NOT EXISTS crm_activities_org_type_object_idx ON crm_activities(organization_id, object_type, object_id);
CREATE INDEX IF NOT EXISTS crm_activities_org_timestamp_idx ON crm_activities(organization_id, timestamp);

-- Organization members indexes for user lookups
CREATE INDEX IF NOT EXISTS organization_members_user_org_idx ON organization_members(user_id, organization_id);

-- CRM Contacts indexes for email lookups
CREATE INDEX IF NOT EXISTS crm_contacts_org_email_idx ON crm_contacts(organization_id, email);

-- Messages indexes for thread queries
CREATE INDEX IF NOT EXISTS messages_thread_read_idx ON messages(thread_id, is_read);

-- CRM Notes indexes for object lookups
CREATE INDEX IF NOT EXISTS crm_notes_object_idx ON crm_notes(object_type, object_id);

-- Document activity log indexes
CREATE INDEX IF NOT EXISTS document_activity_log_document_idx ON document_activity_log(document_id, created_at);

-- Share links indexes for slug lookups (highly queried)
CREATE INDEX IF NOT EXISTS cim_documents_share_slug_idx ON cim_documents(share_slug) WHERE share_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS cim_documents_share_enabled_idx ON cim_documents(share_enabled) WHERE share_enabled = true;

-- Pipeline stages indexes for pipeline queries
CREATE INDEX IF NOT EXISTS pipeline_stages_pipeline_order_idx ON pipeline_stages(pipeline_id, display_order);

-- Financial files indexes
CREATE INDEX IF NOT EXISTS financial_files_cim_document_idx ON financial_files(cim_document_id);
