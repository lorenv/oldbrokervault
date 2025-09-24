-- Add soft delete column to cim_documents table
ALTER TABLE cim_documents
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index for efficient filtering of non-deleted documents
CREATE INDEX IF NOT EXISTS idx_cim_documents_deleted_at
ON cim_documents(deleted_at)
WHERE deleted_at IS NULL;

-- Add comment explaining the purpose
COMMENT ON COLUMN cim_documents.deleted_at IS 'Soft delete timestamp - when set, document is considered deleted but remains in database for subscription limit tracking';