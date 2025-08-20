-- Database Optimization Script for CIM Share Application
-- This script adds missing indexes and optimizes query performance
-- Run this against your production database to improve performance for 100+ concurrent users

-- =====================================================
-- CRITICAL INDEXES - These are missing and causing slow queries
-- =====================================================

-- 1. User lookups (frequent authentication queries)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(subscription_id);

-- 2. CIM Documents (most frequent queries)
CREATE INDEX IF NOT EXISTS idx_cim_documents_user_id ON cim_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_cim_documents_share_slug ON cim_documents(share_slug);
CREATE INDEX IF NOT EXISTS idx_cim_documents_custom_slug ON cim_documents(custom_slug);
CREATE INDEX IF NOT EXISTS idx_cim_documents_created_at ON cim_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cim_documents_user_created ON cim_documents(user_id, created_at DESC); -- Composite for user's documents

-- 3. Financial Files (frequently queried with CIM documents)
CREATE INDEX IF NOT EXISTS idx_financial_files_cim_document_id ON financial_files(cim_document_id);
CREATE INDEX IF NOT EXISTS idx_financial_files_user_id ON financial_files(user_id);

-- 4. Custom Sections (loaded with documents)
CREATE INDEX IF NOT EXISTS idx_custom_sections_cim_document_id ON custom_sections(cim_document_id);
CREATE INDEX IF NOT EXISTS idx_custom_sections_position ON custom_sections(cim_document_id, position);

-- 5. NDA Templates and Signatures
CREATE INDEX IF NOT EXISTS idx_nda_templates_user_id ON nda_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_nda_signatures_cim_document_id ON nda_signatures(cim_document_id);
CREATE INDEX IF NOT EXISTS idx_nda_signatures_signer_email ON nda_signatures(signer_email);
CREATE INDEX IF NOT EXISTS idx_nda_signatures_status ON nda_signatures(status);
CREATE INDEX IF NOT EXISTS idx_nda_access_tokens_token ON nda_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_nda_access_tokens_signature_id ON nda_access_tokens(nda_signature_id);

-- 6. Uploaded Files
CREATE INDEX IF NOT EXISTS idx_uploaded_files_cim_document_id ON uploaded_files(cim_document_id);

-- 7. Share Links
CREATE INDEX IF NOT EXISTS idx_share_links_user_id ON share_links(user_id);
CREATE INDEX IF NOT EXISTS idx_share_links_cim_document_id ON share_links(cim_document_id);
CREATE INDEX IF NOT EXISTS idx_share_links_share_slug ON share_links(share_slug);

-- 8. Document Views (for analytics)
CREATE INDEX IF NOT EXISTS idx_document_views_document_id ON document_views(document_id);
CREATE INDEX IF NOT EXISTS idx_document_views_viewed_at ON document_views(viewed_at DESC);

-- 9. Collaborators
CREATE INDEX IF NOT EXISTS idx_collaborators_cim_document_id ON collaborators(cim_document_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user_id ON collaborators(user_id);

-- 10. Message Threads (for messaging feature)
CREATE INDEX IF NOT EXISTS idx_message_threads_user_id ON message_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_cim_document_id ON message_threads(cim_document_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_updated_at ON message_threads(updated_at DESC);

-- 11. Messages
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- 12. Session table (critical for auth performance)
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
CREATE INDEX IF NOT EXISTS idx_session_sess_data ON session USING gin((sess::jsonb));

-- =====================================================
-- COMPOSITE INDEXES for complex queries
-- =====================================================

-- For share page lookups (combines multiple conditions)
CREATE INDEX IF NOT EXISTS idx_cim_share_lookup ON cim_documents(share_slug, share_enabled, share_expires_at);

-- For user document listing with search
CREATE INDEX IF NOT EXISTS idx_cim_user_search ON cim_documents(user_id, title, created_at DESC);

-- For NDA signature workflow
CREATE INDEX IF NOT EXISTS idx_nda_sig_workflow ON nda_signatures(cim_document_id, status, created_at DESC);

-- =====================================================
-- PARTIAL INDEXES for filtered queries
-- =====================================================

-- Only index active shares
CREATE INDEX IF NOT EXISTS idx_cim_active_shares ON cim_documents(share_slug) 
WHERE share_enabled = true;

-- Only index pending NDA signatures
CREATE INDEX IF NOT EXISTS idx_nda_pending ON nda_signatures(signer_email, created_at DESC) 
WHERE status = 'pending';

-- Only index unarchived messages
CREATE INDEX IF NOT EXISTS idx_messages_unarchived ON message_threads(user_id, updated_at DESC) 
WHERE archived = false;

-- =====================================================
-- TEXT SEARCH INDEXES
-- =====================================================

-- Full text search on documents
CREATE INDEX IF NOT EXISTS idx_cim_fulltext ON cim_documents 
USING gin(to_tsvector('english', title || ' ' || COALESCE(directions, '')));

-- =====================================================
-- ANALYZE TABLES for query planner optimization
-- =====================================================

ANALYZE users;
ANALYZE cim_documents;
ANALYZE financial_files;
ANALYZE custom_sections;
ANALYZE nda_templates;
ANALYZE nda_signatures;
ANALYZE uploaded_files;
ANALYZE share_links;
ANALYZE session;

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- Create a view to monitor slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    min_time
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking more than 100ms on average
ORDER BY mean_time DESC
LIMIT 20;

-- Create a view to monitor index usage
CREATE OR REPLACE VIEW index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- =====================================================
-- VACUUM and MAINTENANCE
-- =====================================================

-- Run VACUUM ANALYZE on heavily used tables
VACUUM ANALYZE users;
VACUUM ANALYZE cim_documents;
VACUUM ANALYZE session;
VACUUM ANALYZE financial_files;

-- =====================================================
-- CONNECTION POOLING RECOMMENDATIONS
-- =====================================================

-- Current settings support 30 connections in production
-- For 100+ concurrent users, consider:
-- 1. Using PgBouncer for connection pooling
-- 2. Setting these PostgreSQL parameters:
--    max_connections = 200
--    shared_buffers = 256MB
--    effective_cache_size = 1GB
--    work_mem = 4MB
--    maintenance_work_mem = 64MB

COMMENT ON SCHEMA public IS 'Optimized for CIM Share application - Indexes added for 100+ concurrent users';